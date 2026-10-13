"""Authenticated web jobs. Every action rechecks the Discord member and role permissions."""
from __future__ import annotations
import asyncio
import logging
from datetime import timedelta
from types import SimpleNamespace
import discord
from discord import app_commands
from server_ui import PanelError

log=logging.getLogger('worldforge.dashboard')
STAFF_COMMANDS=frozenset({'configurar','cargo','servidor','publicar','silenciar','expulsar','banir','limpar'})
PERMISSIONS={'setup':'administrator','publish-panel':'administrator','associate':'administrator',
 'permissions':'administrator','ticket-config':'administrator','settings':'administrator',
 'publish-official':'administrator','role-add':'manage_roles','role-remove':'manage_roles',
 'timeout':'moderate_members','kick':'kick_members','ban':'ban_members','clear':'manage_messages',
 'ticket-close':'ticket_staff'}

def identifier(value):
    if not isinstance(value,str) or not value.isdigit() or not 15<=len(value)<=22: raise PanelError('Selecione um identificador válido do Discord.')
    return int(value)

def text(value,limit=400):
    if not isinstance(value,str) or not value.strip() or len(value)>limit: raise PanelError('Preencha os campos com textos dentro do limite.')
    return value.strip()

def number(value,low,high):
    if isinstance(value,bool) or not isinstance(value,int) or not low<=value<=high: raise PanelError('Valor numérico fora do limite permitido.')
    return value

class DashboardWorker:
    def __init__(self,bot): self.bot=bot;self.task=None

    def start(self):
        if not self.task or self.task.done(): self.task=asyncio.create_task(self.run())

    async def close(self):
        if self.task:
            self.task.cancel()
            try: await self.task
            except asyncio.CancelledError: pass

    async def run(self):
        await self.bot.wait_until_ready()
        while not self.bot.is_closed():
            try:
                result=await self.bot.bridge.call('bot-claim-job',self.bot.user)
                job=result.get('job')
                if job:
                    try:
                        output=await self.execute(job)
                        state='done'
                    except (PanelError,app_commands.CheckFailure) as error:
                        output={'error':str(error)[:1000]};state='failed'
                    except discord.Forbidden:
                        output={'error':'O Discord recusou a operação. Confira os cargos e permissões do bot.'};state='failed'
                    except discord.HTTPException:
                        output={'error':'O Discord não confirmou a operação. Confira o servidor antes de repetir.'};state='failed'
                    except Exception as error:
                        log.error('Falha na ação web: %s',type(error).__name__)
                        output={'error':'A operação não foi concluída. Confira o servidor antes de repetir.'};state='failed'
                    # Never reexecute a claimed mutation after a network failure/crash.
                    await self.bot.bridge.call('bot-complete-job',self.bot.user,id=job['id'],state=state,result=output)
                    if job['action']!='status':
                        await self.bot.audit(self.bot.get_guild(self.bot.guild_id),'Painel web',
                            f'Ação: {job["action"]}\nResponsável: {job["discord_user_id"]}\nResultado: {state}\nPedido: {job["id"]}')
                    continue
            except asyncio.CancelledError: raise
            except Exception as error: log.warning('Painel indisponível: %s',type(error).__name__)
            await asyncio.sleep(15)

    async def execute(self,job):
        guild=self.bot.get_guild(self.bot.guild_id)
        if not guild or not guild.me: raise PanelError('O bot está desconectado do servidor.')
        actor=await guild.fetch_member(identifier(job['discord_user_id']))
        if actor.bot: raise PanelError('Contas de bot não administram o painel.')
        fresh_roles={r.id:r for r in await guild.fetch_roles()}
        actor_roles=[fresh_roles[r.id] for r in actor.roles if r.id in fresh_roles]
        permissions=discord.Permissions.none()
        for role in actor_roles: permissions.value |= role.permissions.value
        if actor.id==guild.owner_id or permissions.administrator: permissions=discord.Permissions.all()
        action=job['action'];payload=job['payload']
        ticket_config=self.bot.store.tickets_config(guild.id) or {}
        ticket_staff=permissions.administrator or any(r.id==ticket_config.get('staff_role_id') for r in actor_roles)
        if action=='status':
            if not ticket_staff and not any(getattr(permissions,flag) for flag in ('administrator','manage_roles','moderate_members','kick_members','ban_members','manage_messages','manage_channels')):
                raise PanelError('Seu Discord não possui um cargo da staff autorizado neste servidor.')
            return self.snapshot(guild,actor,permissions)
        permission=PERMISSIONS.get(action)
        if not permission or not (ticket_staff if permission=='ticket_staff' else getattr(permissions,permission)): raise PanelError('Seu cargo atual não permite esta ação.')
        context=SimpleNamespace(guild=guild,guild_id=guild.id,user=actor,id='web:'+job['id'])
        service=self.bot.server
        if action=='setup':
            report=await service.setup(context)
            return {'message':'Estrutura revisada e montada.','report':report}
        if action=='publish-panel':
            section=self.section(payload)
            if service.catalog[section]['kind']=='preserved': raise PanelError('As boas-vindas continuam com a Loritta.')
            await service.publish_one(context,section)
            return {'message':'Painel atualizado: '+section}
        if action=='associate':
            section=self.section(payload);channel=guild.get_channel(identifier(payload.get('channel_id')))
            expected=discord.ForumChannel if service.catalog[section]['kind']=='forum' else discord.TextChannel
            if not isinstance(channel,expected): raise PanelError('O tipo do canal não corresponde à seção.')
            self.bot.store.save_panel(guild.id,section,channel.id)
            return {'message':'Canal associado sem renomear.'}
        if action in ('permissions','ticket-config'):
            role=guild.get_role(identifier(payload.get('role_id')))
            if not role: raise PanelError('Cargo não encontrado.')
            if action=='permissions': return {'message':'Permissões revisadas.','report':await service.apply_permissions(context,role.id)}
            await service.configure_tickets(context,role)
            return {'message':'Atendimento privado configurado.'}
        if action=='settings':
            field=payload.get('field')
            if field not in self.bot.store.FIELDS: raise PanelError('Configuração inválida.')
            if field!='log_channel' and not self.bot.native_welcome: raise PanelError('Boas-vindas e cargo inicial estão sob responsabilidade da Loritta.')
            value=identifier(payload['value']) if payload.get('value') else None
            if value:
                item=guild.get_role(value) if field=='auto_role' else guild.get_channel(value)
                if field=='auto_role': self.bot.role_guard(guild,item,actor,automatic=True)
                elif not isinstance(item,discord.TextChannel): raise PanelError('Escolha um canal de texto.')
            self.bot.store.set(guild.id,field,value)
            return {'message':'Configuração salva.'}
        if action=='publish-official':
            section=self.section(payload)
            if section not in ('anúncios','atualizações','biblioteca-de-mundos','roadmap','testes-e-beta'): raise PanelError('Destino inválido.')
            if payload.get('confirmed') is not True: raise PanelError('Confirme que o conteúdo é real e verificado.')
            state=text(payload.get('state'),60)
            if state not in ('Disponível','Em desenvolvimento','Planejado','Em testes','Concluído'): raise PanelError('Estado inválido.')
            link=payload.get('link','')
            if link: service.validate_link(link)
            draft=SimpleNamespace(section=section,title=text(payload.get('title'),100),details=text(payload.get('details'),2300),state=state,link=link,request_id='web:'+job['id'])
            await service.publish_official(context,draft)
            return {'message':'Publicação enviada com as artes oficiais.'}
        if action=='ticket-close':
            channel=guild.get_channel(identifier(payload.get('channel_id')))
            ticket=self.bot.store.channel_ticket(channel.id) if channel else None
            if not ticket or ticket['status']!='open' or not self.channel_permissions(channel,actor,permissions).view_channel: raise PanelError('Selecione um ticket aberto ao qual você tem acesso.')
            # Keep the staff Discord command's private-history behavior, without a fake interaction response.
            member=guild.get_member(ticket['owner_id'])
            if member is None:
                try: member=await guild.fetch_member(ticket['owner_id'])
                except discord.NotFound: member=None
            staff=guild.get_role(ticket_config.get('staff_role_id'))
            if not staff: raise PanelError('Reconfigure o cargo da equipe de atendimento.')
            overwrites={guild.default_role:discord.PermissionOverwrite(view_channel=False),
                guild.me:discord.PermissionOverwrite(view_channel=True,send_messages=True,read_message_history=True,manage_channels=True),
                staff:discord.PermissionOverwrite(view_channel=True,send_messages=True,read_message_history=True)}
            if member: overwrites[member]=discord.PermissionOverwrite(view_channel=False,send_messages=False)
            await channel.edit(name='encerrado-'+ticket['id'][:8],overwrites=overwrites,reason=f'Ticket encerrado no painel por {actor.id}')
            self.bot.store.ticket_state(ticket['id'],'closed')
            return {'message':'Ticket encerrado; histórico privado preservado.'}
        if action=='clear':
            channel=guild.get_channel(identifier(payload.get('channel_id')))
            allowed=self.channel_permissions(channel,actor,permissions) if channel else discord.Permissions.none()
            if not isinstance(channel,discord.TextChannel) or not allowed.manage_messages or not allowed.view_channel:
                raise PanelError('Você não pode limpar esse canal.')
            if not channel.permissions_for(guild.me).manage_messages: raise PanelError('O bot não pode limpar esse canal.')
            count=number(payload.get('count'),1,100)
            cutoff=discord.utils.utcnow()-timedelta(days=14)
            deleted=await channel.purge(limit=count,check=lambda m:m.created_at>cutoff,reason=f'Painel web: {actor.id}')
            return {'message':f'{len(deleted)} mensagens recentes excluídas.'}
        target=await guild.fetch_member(identifier(payload.get('member_id')))
        if target.id in (guild.owner_id,actor.id,guild.me.id): raise PanelError('Esse membro não pode ser alvo desta ação.')
        target_roles=[fresh_roles[r.id] for r in target.roles if r.id in fresh_roles]
        actor_top=max(actor_roles);target_top=max(target_roles)
        bot_roles=[fresh_roles[r.id] for r in guild.me.roles if r.id in fresh_roles]
        if actor.id!=guild.owner_id and target_top>=actor_top: raise PanelError('O membro possui um cargo igual ou superior ao seu.')
        if target_top>=max(bot_roles): raise PanelError('O cargo do bot precisa ficar acima do membro.')
        if action in ('role-add','role-remove'):
            role=fresh_roles.get(identifier(payload.get('role_id')))
            if not role or role.managed or role.is_default() or role>=max(bot_roles) or (actor.id!=guild.owner_id and role>=actor_top): raise PanelError('Você não pode administrar esse cargo.')
            if role.permissions.value & ~permissions.value: raise PanelError('Você não pode atribuir poderes que seu próprio cargo não possui.')
            method=target.add_roles if action=='role-add' else target.remove_roles
            await method(role,reason=f'Painel web: {actor.id}')
            return {'message':'Cargo atualizado.'}
        reason=f'{actor.id}: '+text(payload.get('reason'))
        if not getattr(guild.me.guild_permissions,permission): raise PanelError('O bot não possui a permissão necessária.')
        if action=='timeout':
            if target.guild_permissions.administrator: raise PanelError('O Discord não permite silenciar administradores.')
            await target.timeout(timedelta(minutes=number(payload.get('minutes'),1,40320)),reason=reason)
        elif action=='kick': await target.kick(reason=reason)
        elif action=='ban': await target.ban(reason=reason,delete_message_seconds=0)
        return {'message':'Ação de moderação concluída.'}

    def section(self,payload):
        section=payload.get('section')
        if section not in self.bot.server.catalog: raise PanelError('Seção inválida.')
        return section

    def snapshot(self,guild,actor,permissions):
        service=self.bot.server
        channels=[{'id':str(c.id),'name':c.name,'type':str(c.type)} for c in guild.channels if self.channel_permissions(c,actor,permissions).view_channel]
        roles=[{'id':str(r.id),'name':r.name,'managed':r.managed} for r in guild.roles if not r.is_default()]
        tickets=self.bot.store.db.execute("select channel_id,kind,created_at from tickets where guild_id=? and status='open'",(guild.id,)).fetchall()
        return {'message':'Servidor conectado.','guild':{'id':str(guild.id),'name':guild.name,'members':guild.member_count,'channels':len(guild.channels)},
          'actor':{'name':actor.display_name,'id':str(actor.id)},'permissions':{**{flag:getattr(permissions,flag) for flag in set(PERMISSIONS.values()) if flag!='ticket_staff'},'ticket_staff':permissions.administrator or any(r.id==(self.bot.store.tickets_config(guild.id) or {}).get('staff_role_id') for r in actor.roles)},
          'channels':channels,'roles':roles,'settings':{k:str(v) if v else '' for k,v in self.bot.store.get(guild.id).items() if k!='guild_id'},
          'native_welcome':self.bot.native_welcome,'plan':service.plan(guild),
          'panels':[{'section':key,'title':data['title'],'kind':data['kind'],'channel_id':str(service.find_channel(guild,key).id) if service.find_channel(guild,key) else None} for key,data in service.catalog.items()],
          'tickets':[{'channel_id':str(t['channel_id']),'kind':t['kind'],'created_at':t['created_at']} for t in tickets if any(c['id']==str(t['channel_id']) for c in channels)],
          'ticket_config':{k:str(v) for k,v in (self.bot.store.tickets_config(guild.id) or {}).items() if k!='guild_id'}}

    def channel_permissions(self,channel,actor,base):
        if base.administrator: return discord.Permissions.all()
        result=discord.Permissions(base.value)
        default=channel.overwrites_for(channel.guild.default_role)
        allow,deny=default.pair();result.value=(result.value & ~deny.value)|allow.value
        role_ids={r.id for r in actor.roles if not r.is_default()}
        allow_bits=deny_bits=0
        for target,overwrite in channel.overwrites.items():
            if isinstance(target,discord.Role) and target.id in role_ids:
                allow,deny=overwrite.pair();allow_bits|=allow.value;deny_bits|=deny.value
        result.value=(result.value & ~deny_bits)|allow_bits
        allow,deny=channel.overwrites_for(actor).pair();result.value=(result.value & ~deny.value)|allow.value
        return result

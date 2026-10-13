"""Montagem do documento, publicação sem duplicatas e atendimento privado."""
from __future__ import annotations

import asyncio
import json
import logging
import re
import unicodedata
from pathlib import Path
from urllib.parse import urlparse

import discord
from discord import app_commands
from server_ui import (PanelError, PublicPanel, ForumControls, ForumModal, PublicationModal, SetupReview, TicketControls,
                       TicketModal, artwork, respond)

ROOT=Path(__file__).resolve().parent
INTERESTS=('Mestre de RPG','Criador de Mundos')


def normalized(value):
    value=unicodedata.normalize('NFKD',value.casefold())
    return re.sub(r'[^a-z0-9]+','-', ''.join(c for c in value if not unicodedata.combining(c))).strip('-')


def component_text(components):
    result=[]
    for item in components:
        text=getattr(item,'content',None)
        if isinstance(text,str): result.append(text)
        children=getattr(item,'children',None)
        if children: result.extend(component_text(children))
    return result


class ServerService:
    def __init__(self,bot):
        self.bot=bot
        self.catalog=json.loads((ROOT/'catalog.json').read_text(encoding='utf-8'))
        self.log=logging.getLogger('worldforge.server')
        self.operation_lock=asyncio.Lock()
        self.role_lock=asyncio.Lock()
        self.restored=False
        self.cooldowns={}

    def require_admin(self,interaction):
        if interaction.guild_id!=self.bot.guild_id or not isinstance(interaction.user,discord.Member):
            raise PanelError('Use este comando no servidor WorldForge.')
        if interaction.user.id!=interaction.guild.owner_id and not interaction.user.guild_permissions.administrator:
            raise PanelError('Somente o proprietário ou um administrador pode montar e publicar os painéis oficiais.')

    def find_channel(self,guild,section):
        saved=self.bot.store.panel(guild.id,section)
        bound=guild.get_channel(saved.get('channel_id')) if saved.get('channel_id') else None
        if bound: return bound
        matches=[c for c in guild.channels if normalized(c.name)==normalized(section)]
        if len(matches)>1:
            raise PanelError(f'Há mais de um canal equivalente a {section}. Associe o destino em Canais e painéis no painel web.')
        return matches[0] if matches else None

    def expect_channel(self,guild,section):
        channel=self.find_channel(guild,section)
        kind=self.catalog[section]['kind']
        expected=discord.ForumChannel if kind=='forum' else discord.TextChannel
        if channel and not isinstance(channel,expected):
            raise PanelError(f'{section} precisa ser um {"fórum" if kind=="forum" else "canal de texto"}. O canal existente não será convertido.')
        return channel

    def plan(self,guild):
        lines=[]
        for section,data in self.catalog.items():
            try:
                channel=self.expect_channel(guild,section)
                status='reutilizar' if channel else 'criar'
                if data['kind']=='preserved': status='preservar Loritta' if channel else 'criar canal vazio; Loritta permanece responsável'
                lines.append(f'• **{section}** — {status}')
            except PanelError as error:
                lines.append(f'• **{section}** — {error}')
        lines.append('• Cargos selecionáveis: **Mestre de RPG** e **Criador de Mundos** (sem privilégios).')
        lines.append('• Canais existentes não são renomeados; guias equivalentes são preservados.')
        return lines

    def ticket_ready(self,guild):
        if not guild or not guild.me: return False
        config=self.bot.store.tickets_config(guild.id)
        if not config: return False
        staff=guild.get_role(config['staff_role_id'])
        category=guild.get_channel(config['category_id'])
        return bool(staff and not staff.is_default() and isinstance(category,discord.CategoryChannel)
                    and guild.me.guild_permissions.manage_channels)

    def roles_ready(self,guild_id):
        guild=self.bot.get_guild(guild_id)
        saved=self.bot.store.interest_roles(guild_id)
        if not guild: return False
        try:
            for name in INTERESTS:
                role=guild.get_role(saved.get(name,0))
                if not role or role.name!=name: return False
                self.bot.role_guard(guild,role,automatic=True)
        except app_commands.CheckFailure:
            return False
        return True

    async def restore_views(self):
        if self.restored: return
        guild=self.bot.get_guild(self.bot.guild_id)
        if not guild: return
        for key,data in self.catalog.items():
            if data['kind']!='preserved': self.bot.add_view(PublicPanel(self,key))
        self.bot.add_view(TicketControls(self))
        # Recover reservations after an interrupted creation, without deleting channels.
        rows=self.bot.store.db.execute("select * from tickets where guild_id=? and status='creating'",(guild.id,)).fetchall()
        for row in rows:
            marker=f'wf:ticket:{row["id"]}:'
            channels=[c for c in guild.text_channels if (c.topic or '').startswith(marker)]
            self.bot.store.ticket_state(row['id'],'open' if len(channels)==1 else 'failed',channels[0].id if len(channels)==1 else None)
        self.restored=True

    async def setup(self,interaction):
        self.require_admin(interaction)
        guild=interaction.guild
        async with self.operation_lock:
            # Resolve every channel before making changes.
            channels={key:self.expect_channel(guild,key) for key in self.catalog}
            if any(self.catalog[key]['kind']=='forum' and channel is None for key,channel in channels.items()) and 'COMMUNITY' not in guild.features:
                raise PanelError('Ative Comunidade nas configurações do Discord para criar fóruns. Nenhum canal foi alterado.')
            if not guild.me.guild_permissions.manage_channels or not guild.me.guild_permissions.manage_roles:
                raise PanelError('A montagem precisa de Manage Channels e Manage Roles no cargo do bot.')
            if not guild.me.guild_permissions.manage_messages or not guild.me.guild_permissions.manage_threads:
                raise PanelError('O bot precisa de Manage Messages e Manage Threads para fixar os guias.')
            report=[]
            for name in INTERESTS:
                matches=[role for role in guild.roles if role.name==name]
                if len(matches)>1: raise PanelError(f'O cargo {name} está duplicado. Escolha um cargo único antes de montar.')
                role=matches[0] if matches else await guild.create_role(name=name,permissions=discord.Permissions.none(),
                                                                      colour=discord.Colour(0x8B5CF6 if name==INTERESTS[0] else 0xDBB877),
                                                                      mentionable=False,reason='Montagem WorldForge confirmada pelo administrador')
                self.bot.role_guard(guild,role,interaction.user,automatic=True)
                self.bot.store.set_role(guild.id,name,role.id)
            categories={}
            for title in dict.fromkeys(data['category'] for data in self.catalog.values()):
                matches=[c for c in guild.categories if normalized(c.name)==normalized(title)]
                if len(matches)>1: raise PanelError(f'A categoria {title} está duplicada. Não criei outra categoria.')
                categories[title]=matches[0] if matches else await guild.create_category(title,reason='Montagem WorldForge confirmada')
            for key,data in self.catalog.items():
                channel=channels[key]
                if not channel:
                    kwargs={'name':key,'category':categories[data['category']], 'reason':'Montagem WorldForge confirmada'}
                    if data['kind']=='forum':
                        channel=await guild.create_forum(**kwargs,topic=data['title'])
                    else:
                        # Read-only guides by default. Explicit permissions command can add the staff role.
                        kwargs['overwrites']={guild.default_role:discord.PermissionOverwrite(view_channel=True,read_message_history=True,
                                              send_messages=False,create_public_threads=False,create_private_threads=False),
                                              guild.me:discord.PermissionOverwrite(view_channel=True,send_messages=True,embed_links=True,
                                              attach_files=True,manage_messages=True)}
                        channel=await guild.create_text_channel(**kwargs)
                old=self.bot.store.panel(guild.id,key)
                self.bot.store.save_panel(guild.id,key,channel.id,old.get('message_id'),old.get('thread_id'))
                if data['kind']=='preserved':
                    report.append(f'✓ {key}: automação preservada')
                    continue
                try:
                    report.extend(await self._publish(guild,key,channel))
                except (discord.HTTPException,PanelError):
                    report.append(f'⚠ {key}: canal pronto; publicação pendente. Retome a publicação em Canais e painéis no painel web.')
            return report

    async def find_existing(self,channel,key):
        data=self.catalog[key]
        saved=self.bot.store.panel(channel.guild.id,key)
        if data['kind']=='forum':
            if saved.get('thread_id'):
                try:
                    thread=await self.bot.fetch_channel(saved['thread_id'])
                    if isinstance(thread,discord.Thread) and thread.parent_id==channel.id:
                        return await thread.fetch_message(saved['message_id'])
                except discord.NotFound: pass
            seen=set()
            for thread in channel.threads:
                seen.add(thread.id)
                if normalized(thread.name)==normalized(data['title']): return await thread.fetch_message(thread.id)
            count=0
            async for thread in channel.archived_threads(limit=1000):
                count+=1
                if thread.id not in seen and normalized(thread.name)==normalized(data['title']):
                    return await thread.fetch_message(thread.id)
            if count==1000: raise PanelError('Há muitos tópicos arquivados. Associe o guia existente antes de publicar outro.')
            return None
        if saved.get('message_id'):
            try: return await channel.fetch_message(saved['message_id'])
            except discord.NotFound: pass
        def equivalent(message):
            text=' '.join([message.content,*[e.title or '' for e in message.embeds],*component_text(message.components)])
            return normalized(data['title']) in normalized(text)
        async for message in channel.pins():
            if equivalent(message): return message
        count=0
        async for message in channel.history(limit=5000):
            count+=1
            if equivalent(message): return message
        if count==5000: raise PanelError('Canal com histórico extenso. Associe o painel existente antes de publicar outro.')
        return None

    async def _publish(self,guild,key,channel):
        if self.catalog[key]['kind']=='preserved': return ['Boas-vindas da Loritta preservadas.']
        if isinstance(channel,discord.ForumChannel):
            tags=list(channel.available_tags)
            for name in self.catalog[key]['tags']:
                if not any(t.name==name for t in tags):
                    if len(tags)>=20: raise PanelError('O fórum já atingiu o limite de etiquetas. Nenhuma etiqueta existente foi removida.')
                    moderated=name not in {'Novo','Nova ideia','Plataforma','Contas','Biblioteca','RPG'}
                    tags.append(discord.ForumTag(name=name,moderated=moderated))
            if len(tags)!=len(channel.available_tags): channel=await channel.edit(available_tags=tags,reason='Etiquetas do documento WorldForge')
        message=await self.find_existing(channel,key)
        if message and message.author.id!=self.bot.user.id:
            self.bot.store.save_panel(guild.id,key,channel.id,message.id,message.channel.id if isinstance(message.channel,discord.Thread) else None)
            if isinstance(message.channel,discord.Thread):
                thread=message.channel
                await thread.edit(pinned=True,archived=False,reason='Preservar e fixar guia existente WorldForge')
                saved=self.bot.store.panel(guild.id,key)
                controls=None
                if saved.get('controls_message_id'):
                    try: controls=await thread.fetch_message(saved['controls_message_id'])
                    except discord.NotFound: pass
                if controls and controls.author.id!=self.bot.user.id:
                    raise PanelError('A mensagem registrada de controles não pertence a este bot.')
                files=artwork(('logo-animated.gif',))
                try:
                    if controls:
                        await controls.edit(content=None,embeds=[],attachments=files,view=ForumControls(self,key))
                    else:
                        # Check recent controls if a previous run sent the message before saving its ID.
                        async for candidate in thread.history(limit=100):
                            if candidate.author.id==self.bot.user.id and 'Transforme seu feedback' in ' '.join(component_text(candidate.components)):
                                controls=candidate
                                break
                        if controls:
                            await controls.edit(content=None,embeds=[],attachments=files,view=ForumControls(self,key))
                        else:
                            controls=await thread.send(view=ForumControls(self,key),files=files,
                                                       allowed_mentions=discord.AllowedMentions.none(),silent=True)
                    self.bot.store.save_controls(guild.id,key,controls.id)
                finally:
                    for file in files:file.close()
            elif not message.pinned:
                await message.pin(reason='Preservar e fixar guia existente WorldForge')
            return [f'✓ {key}: guia existente preservado']
        view=PublicPanel(self,key)
        files=artwork()
        try:
            if message:
                if isinstance(message.channel,discord.Thread) and (message.channel.archived or message.channel.locked):
                    await message.channel.edit(archived=False,locked=False,reason='Atualização do guia permanente')
                message=await message.edit(content=None,embeds=[],attachments=files,view=view,allowed_mentions=discord.AllowedMentions.none())
            elif isinstance(channel,discord.ForumChannel):
                created=await channel.create_thread(name=self.catalog[key]['title'],view=view,files=files,
                    allowed_mentions=discord.AllowedMentions.none(),reason='Guia oficial WorldForge confirmado')
                message=created.message
            else:
                message=await channel.send(view=view,files=files,allowed_mentions=discord.AllowedMentions.none(),silent=True)
        finally:
            for file in files: file.close()
        thread=message.channel if isinstance(message.channel,discord.Thread) else None
        # Record before pinning so retries cannot duplicate a successfully sent message.
        self.bot.store.save_panel(guild.id,key,channel.id,message.id,thread.id if thread else None)
        if thread:
            if thread.archived: thread=await thread.edit(archived=False,reason='Atualização do guia oficial')
            await thread.edit(pinned=True,locked=True,reason='Guia permanente WorldForge')
        elif not message.pinned:
            await message.pin(reason='Guia permanente WorldForge')
        return [f'✓ {key}: painel atualizado e fixado']

    async def publish_one(self,interaction,key):
        self.require_admin(interaction)
        async with self.operation_lock:
            channel=self.expect_channel(interaction.guild,key)
            if not channel: raise PanelError('Canal não encontrado. Abra o painel web para montar a estrutura ou associar o canal.')
            return await self._publish(interaction.guild,key,channel)

    def can_post(self,interaction,key):
        if interaction.guild_id!=self.bot.guild_id or not isinstance(interaction.user,discord.Member): return False
        channel=self.expect_channel(interaction.guild,key)
        if not isinstance(channel,discord.ForumChannel): return False
        permissions=channel.permissions_for(interaction.user)
        return permissions.view_channel and permissions.send_messages

    def validate_attachments(self,guild,attachments):
        for attachment in attachments:
            if attachment.size > min(guild.filesize_limit,8*1024*1024):
                raise PanelError('Use um anexo de até 8 MB, dentro do limite deste servidor.')

    async def publish_forum(self,interaction,draft):
        if not draft.title.strip() or any(not text.strip() for _,text in draft.values):
            raise PanelError('Preencha o título e os campos com conteúdo.')
        if not self.bot.store.reserve_forum(draft.request_id):
            raise PanelError('Este formulário já foi enviado ou está sendo publicado.')
        channel=self.expect_channel(interaction.guild,draft.section)
        files=[]
        created=None
        try:
            files=[await attachment.to_file(use_cached=True) for attachment in draft.attachments]
            body='\n\n'.join(f'**{name}**\n{self.bot.text(value,1500)}' for name,value in draft.values)
            embed=discord.Embed(title=self.bot.text(draft.title,100),description=body,color=0x8B5CF6,
                                timestamp=discord.utils.utcnow())
            embed.set_author(name=self.bot.text(interaction.user.display_name,80),icon_url=interaction.user.display_avatar.url)
            embed.set_footer(text='WORLD FORGE RPG • Publicação da comunidade')
            initial={'reportar-bugs':'Novo','sugestões':'Nova ideia','dúvidas':None}[draft.section]
            tags=[tag for tag in channel.available_tags if tag.name==initial and not tag.moderated]
            created=await channel.create_thread(name=draft.title.strip()[:100],embed=embed,files=files,
                                               applied_tags=tags,allowed_mentions=discord.AllowedMentions.none(),
                                               reason=f'Formulário enviado por {interaction.user.id}')
            self.bot.store.finish_forum(draft.request_id,created.thread.id)
            return created.thread
        except Exception:
            if created is None: self.bot.store.retry_forum(draft.request_id)
            raise
        finally:
            for file in files: file.close()

    async def toggle_role(self,interaction,name):
        if name not in INTERESTS or not isinstance(interaction.user,discord.Member):
            raise PanelError('Cargo não disponível para autoatribuição.')
        await interaction.response.defer(ephemeral=True,thinking=True)
        async with self.role_lock:
            role_id=self.bot.store.interest_roles(interaction.guild_id).get(name)
            role=interaction.guild.get_role(role_id) if role_id else None
            if not role or role.name!=name: raise PanelError('Este cargo precisa ser configurado pela equipe.')
            self.bot.role_guard(interaction.guild,role,automatic=True)
            member=await interaction.guild.fetch_member(interaction.user.id)
            if role in member.roles:
                await member.remove_roles(role,reason='Escolha voluntária no painel WorldForge')
                result='removido'
            else:
                await member.add_roles(role,reason='Escolha voluntária no painel WorldForge')
                result='adicionado'
        await respond(interaction,f'**{name}** {result}. Seus demais cargos foram preservados.')

    def validate_link(self,link):
        if not link: return
        parsed=urlparse(link)
        if parsed.scheme!='https' or not parsed.hostname or parsed.username or parsed.password:
            raise PanelError('Informe uma URL HTTPS real, sem credenciais no endereço.')

    async def publish_official(self,interaction,draft):
        self.require_admin(interaction)
        channel=self.expect_channel(interaction.guild,draft.section)
        if not isinstance(channel,discord.TextChannel): raise PanelError('Associe um canal de texto a essa seção primeiro.')
        if not self.bot.store.reserve_forum(draft.request_id): raise PanelError('Esta publicação já foi enviada ou está em andamento.')
        view=discord.ui.LayoutView()
        children=[discord.ui.Section(discord.ui.TextDisplay(f'-# ✦ WORLD FORGE RPG • {draft.section.upper()}\n## {self.bot.text(draft.title,100)}'),
                    accessory=discord.ui.Thumbnail('attachment://logo.png',description='Logotipo oficial WorldForge')),
                  discord.ui.MediaGallery(discord.MediaGalleryItem('attachment://banner.png',description='Cenário oficial WorldForge')),
                  discord.ui.TextDisplay(f'**Estado:** {draft.state}\n\n{self.bot.text(draft.details,2300)}'),
                  discord.ui.Separator(),discord.ui.TextDisplay('-# ✦ WORLD FORGE RPG • Onde mundos ganham vida')]
        if draft.link: children.append(discord.ui.ActionRow(discord.ui.Button(label='Saiba mais',url=draft.link)))
        view.add_item(discord.ui.Container(*children,accent_colour=0x8B5CF6))
        files=artwork(('logo.png','banner.png'))
        message=None
        try:
            message=await channel.send(view=view,files=files,allowed_mentions=discord.AllowedMentions.none())
            self.bot.store.finish_forum(draft.request_id,message.id)
            return message
        except Exception:
            if message is None: self.bot.store.retry_forum(draft.request_id)
            raise
        finally:
            for file in files: file.close()

    async def apply_permissions(self,interaction,staff_id):
        self.require_admin(interaction)
        guild=interaction.guild
        staff=guild.get_role(staff_id)
        if not staff or staff.is_default() or staff.name in (*INTERESTS,'Aventureiro') or staff.managed:
            raise PanelError('Escolha um cargo exclusivo da equipe.')
        adventurers=[r for r in guild.roles if r.name=='Aventureiro']
        if len(adventurers)!=1: raise PanelError('O cargo Aventureiro precisa existir e ser único. A configuração da Loritta não será alterada.')
        async with self.operation_lock:
            report=[]
            for key,data in self.catalog.items():
                if data['kind']=='preserved': continue
                channel=self.expect_channel(guild,key)
                if not channel: report.append(f'⚠ {key}: canal ausente'); continue
                overwrites=channel.overwrites.copy()
                for target,permission in overwrites.items():
                    if isinstance(target,discord.Role) and target.id!=staff.id:
                        permission.view_channel=True
                        permission.read_message_history=True
                        permission.send_messages=False
                        permission.create_public_threads=False
                        permission.create_private_threads=False
                overwrites[guild.default_role]=discord.PermissionOverwrite(view_channel=True,read_message_history=True,
                    send_messages=False,create_public_threads=False,create_private_threads=False)
                overwrites[staff]=discord.PermissionOverwrite(view_channel=True,read_message_history=True,send_messages=True,
                    send_messages_in_threads=True,embed_links=True,attach_files=True)
                overwrites[guild.me]=discord.PermissionOverwrite(view_channel=True,read_message_history=True,send_messages=True,
                    send_messages_in_threads=True,embed_links=True,attach_files=True,manage_messages=True,manage_threads=True)
                if data['kind']=='forum':
                    overwrites[adventurers[0]]=discord.PermissionOverwrite(view_channel=True,read_message_history=True,
                        send_messages=True,send_messages_in_threads=True,add_reactions=True,attach_files=True,embed_links=True)
                await channel.edit(overwrites=overwrites,reason=f'Permissões do documento confirmadas por {interaction.user.id}')
                report.append(f'✓ {key}: permissões ajustadas')
            return report

    async def configure_tickets(self,interaction,staff):
        self.require_admin(interaction)
        guild=interaction.guild
        if staff.is_default() or staff.name in (*INTERESTS,'Aventureiro') or staff.managed:
            raise PanelError('Escolha um cargo exclusivo da equipe, sem autoatribuição.')
        if not guild.me.guild_permissions.manage_channels: raise PanelError('O bot precisa de Manage Channels para criar tickets privados.')
        matches=[c for c in guild.categories if normalized(c.name)=='atendimento-privado']
        if len(matches)>1: raise PanelError('Há categorias Atendimento Privado duplicadas. Resolva isso antes de ativar tickets.')
        overwrites={guild.default_role:discord.PermissionOverwrite(view_channel=False),
                    guild.me:discord.PermissionOverwrite(view_channel=True,send_messages=True,read_message_history=True,
                                                       embed_links=True,attach_files=True,manage_channels=True),
                    staff:discord.PermissionOverwrite(view_channel=True,send_messages=True,read_message_history=True)}
        # Existing category permissions are preserved. Tickets always receive explicit private overwrites.
        category=matches[0] if matches else await guild.create_category('Atendimento Privado',overwrites=overwrites,
                                                                       reason='Atendimento privado WorldForge confirmado')
        self.bot.store.set_tickets_config(guild.id,staff.id,category.id)
        panel=self.find_channel(guild,'abrir-ticket')
        if panel:
            async with self.operation_lock: await self._publish(guild,'abrir-ticket',panel)
        return category

    async def open_ticket(self,interaction,kind,subject,description,attachments):
        guild=interaction.guild
        if not self.ticket_ready(guild): raise PanelError('O atendimento privado precisa ser configurado pela equipe.')
        previous=self.bot.store.user_ticket(guild.id,interaction.user.id)
        if previous:
            channel=guild.get_channel(previous.get('channel_id')) if previous.get('channel_id') else None
            if channel: return channel
            if previous['status']=='open': self.bot.store.ticket_state(previous['id'],'failed')
            else: raise PanelError('Seu ticket está sendo criado. Aguarde antes de repetir.')
        config=self.bot.store.tickets_config(guild.id)
        ticket_id=self.bot.store.reserve_ticket(guild.id,interaction.user.id,kind)
        if not ticket_id: raise PanelError('Já existe um atendimento em criação para você.')
        channel=None
        files=[]
        try:
            staff=guild.get_role(config['staff_role_id'])
            category=guild.get_channel(config['category_id'])
            overwrites={guild.default_role:discord.PermissionOverwrite(view_channel=False),
                        guild.me:discord.PermissionOverwrite(view_channel=True,send_messages=True,read_message_history=True,
                                                           embed_links=True,attach_files=True,manage_channels=True),
                        staff:discord.PermissionOverwrite(view_channel=True,send_messages=True,read_message_history=True,attach_files=True),
                        interaction.user:discord.PermissionOverwrite(view_channel=True,send_messages=True,read_message_history=True,
                                                                     attach_files=True,embed_links=True)}
            channel=await guild.create_text_channel(f'ticket-{ticket_id[:8]}',category=category,overwrites=overwrites,
                topic=f'wf:ticket:{ticket_id}:{interaction.user.id}',reason=f'Atendimento solicitado por {interaction.user.id}')
            self.bot.store.ticket_state(ticket_id,'open',channel.id)
            files=[await item.to_file(use_cached=True) for item in attachments]
            embed=discord.Embed(title=self.bot.text(subject,100),description=self.bot.text(description,1800),color=0x8B5CF6,
                                timestamp=discord.utils.utcnow())
            embed.add_field(name='Assunto',value=kind,inline=False)
            embed.add_field(name='Solicitante',value=f'{self.bot.text(interaction.user.display_name,80)} · {interaction.user.id}',inline=False)
            embed.set_footer(text='WORLD FORGE RPG • Atendimento privado')
            await channel.send(embed=embed,files=files,allowed_mentions=discord.AllowedMentions.none())
            await channel.send(view=TicketControls(self),allowed_mentions=discord.AllowedMentions.none())
            return channel
        except Exception:
            if channel is None:
                self.bot.store.ticket_state(ticket_id,'failed')
                raise
            # Never delete a user's private channel on a partial failure.
            self.log.warning('Ticket criado; mensagem inicial pendente: %s',ticket_id[:8])
            return channel
        finally:
            for file in files: file.close()

    async def close_ticket(self,interaction):
        ticket=self.bot.store.channel_ticket(interaction.channel_id)
        config=self.bot.store.tickets_config(interaction.guild_id)
        if not ticket or not config: raise PanelError('Este canal não é um ticket gerenciado pelo WorldForge.')
        member=interaction.user
        allowed=member.id==ticket['owner_id'] or member.guild_permissions.administrator or any(r.id==config['staff_role_id'] for r in member.roles)
        if not allowed: raise PanelError('Somente o solicitante ou a equipe pode encerrar este ticket.')
        if ticket['status']=='closed':
            await respond(interaction,'O atendimento já foi encerrado.')
            return
        await interaction.response.defer(ephemeral=True,thinking=True)
        guild=interaction.guild
        staff=guild.get_role(config['staff_role_id'])
        if not staff: raise PanelError('O cargo da equipe foi removido. Peça ao administrador para reconfigurar o atendimento.')
        permissions={guild.default_role:discord.PermissionOverwrite(view_channel=False),
                     guild.me:discord.PermissionOverwrite(view_channel=True,send_messages=True,read_message_history=True,manage_channels=True),
                     staff:discord.PermissionOverwrite(view_channel=True,send_messages=True,read_message_history=True)}
        owner=guild.get_member(ticket['owner_id'])
        if owner: permissions[owner]=discord.PermissionOverwrite(view_channel=False,send_messages=False)
        await interaction.channel.edit(name=f'encerrado-{ticket["id"][:8]}',overwrites=permissions,reason=f'Ticket encerrado por {member.id}')
        self.bot.store.ticket_state(ticket['id'],'closed')
        await respond(interaction,'Atendimento encerrado. O histórico foi preservado em um canal privado da equipe.')


def install_commands(bot,service):
    group=app_commands.Group(name='servidor',description='Montar os canais e painéis oficiais WorldForge',
                             default_permissions=discord.Permissions(administrator=True),guild_only=True)
    choices=[app_commands.Choice(name=name,value=name) for name,data in service.catalog.items() if data['kind']!='preserved']

    @group.command(name='diagnostico',description='Conferir canais, fóruns e configurações sem alterar o servidor')
    async def diagnose(interaction:discord.Interaction):
        service.require_admin(interaction)
        await respond(interaction,'\n'.join(service.plan(interaction.guild))[:1950])

    @group.command(name='montar',description='Gerar o plano e confirmar a montagem dos canais do documento')
    async def setup(interaction:discord.Interaction):
        service.require_admin(interaction)
        await respond(interaction,view=SetupReview(service,interaction.user.id,service.plan(interaction.guild),'setup'))

    @group.command(name='previa',description='Ver um painel com as artes sem publicar no canal')
    @app_commands.choices(secao=choices)
    async def preview(interaction:discord.Interaction,secao:app_commands.Choice[str]):
        service.require_admin(interaction)
        await respond(interaction,view=PublicPanel(service,secao.value),files=artwork())

    @group.command(name='publicar',description='Revisar e publicar ou atualizar somente um painel permanente')
    @app_commands.choices(secao=choices)
    async def publish(interaction:discord.Interaction,secao:app_commands.Choice[str]):
        service.require_admin(interaction)
        channel=service.expect_channel(interaction.guild,secao.value)
        if not channel: raise PanelError('Canal não encontrado. Use /servidor montar primeiro.')
        await respond(interaction,view=SetupReview(service,interaction.user.id,
                      [f'Painel: **{secao.value}**',f'Destino: {channel.mention}','Guias publicados por outra pessoa ou bot serão preservados.'],
                      'publish',secao.value))

    @group.command(name='associar',description='Associar um canal existente à seção sem renomeá-lo')
    @app_commands.choices(secao=[app_commands.Choice(name=name,value=name) for name in service.catalog])
    async def associate(interaction:discord.Interaction,secao:app_commands.Choice[str],canal:discord.TextChannel|discord.ForumChannel):
        service.require_admin(interaction)
        expected=discord.ForumChannel if service.catalog[secao.value]['kind']=='forum' else discord.TextChannel
        if not isinstance(canal,expected): raise PanelError('O tipo do canal não corresponde ao documento.')
        bot.store.save_panel(interaction.guild_id,secao.value,canal.id)
        await respond(interaction,f'**{secao.value}** associado a {canal.mention}, sem renomear o canal.')

    tickets=app_commands.Group(name='tickets',description='Configurar e encerrar o atendimento privado',guild_only=True)

    @tickets.command(name='configurar',description='Ativar tickets com um cargo exclusivo da equipe')
    @app_commands.default_permissions(administrator=True)
    async def configure(interaction:discord.Interaction,equipe:discord.Role):
        service.require_admin(interaction)
        await interaction.response.defer(ephemeral=True,thinking=True)
        category=await service.configure_tickets(interaction,equipe)
        await respond(interaction,f'Tickets configurados em **{category.name}** para **{equipe.name}**. '
                      'Use /servidor previa abrir-ticket para conferir o painel; o solicitante e a equipe têm acesso privado.')

    @tickets.command(name='encerrar',description='Encerrar o atendimento deste canal sem apagar o histórico')
    async def close(interaction:discord.Interaction):
        await service.close_ticket(interaction)

    @tickets.command(name='abrir',description='Abrir o formulário de atendimento privado')
    async def open_form(interaction:discord.Interaction):
        if not service.ticket_ready(interaction.guild): raise PanelError('A equipe precisa configurar os tickets primeiro.')
        await interaction.response.send_modal(TicketModal(service,interaction.user.id))

    bot.tree.add_command(group)
    bot.tree.add_command(tickets)

    @group.command(name='permissoes',description='Revisar as permissões dos canais conforme o documento')
    async def permissions(interaction:discord.Interaction,equipe:discord.Role):
        service.require_admin(interaction)
        await respond(interaction,view=SetupReview(service,interaction.user.id,
            [f'Equipe autorizada a publicar: **{equipe.name}**.',
             'Os 12 canais de orientação ficam legíveis para todos. A Loritta e boas-vindas permanecem como estão.',
             'Canais permanentes: publicação da equipe, administradores e bot.',
             'Fóruns: Aventureiros podem criar posts, responder e anexar evidências.',
             'Permissões de publicação de outros cargos nesses canais serão removidas; tickets privados não serão alterados.'],
             'permissions',extra=equipe.id))

    publications=app_commands.Group(name='publicar',description='Publicar somente novidades e informações verificadas',
                                    default_permissions=discord.Permissions(administrator=True),guild_only=True)
    sections={'anuncio':'anúncios','atualizacao':'atualizações','mundo':'biblioteca-de-mundos','roadmap':'roadmap','beta':'testes-e-beta'}
    for command_name,section in sections.items():
        # Capture the section in a factory; the callback signature remains a single interaction.
        def make_callback(destination):
            async def callback(interaction:discord.Interaction):
                service.require_admin(interaction)
                await interaction.response.send_modal(PublicationModal(service,interaction.user.id,destination))
            return callback
        publications.add_command(app_commands.Command(name=command_name,description=f'Revisar e publicar conteúdo em {section}',
                                                       callback=make_callback(section)))
    bot.tree.add_command(publications)

    community=app_commands.Group(name='comunidade',description='Criar um tópico com formulário e revisão',guild_only=True)
    for name,destination in {'bug':'reportar-bugs','sugestao':'sugestões','duvida':'dúvidas'}.items():
        def make_form(section):
            async def callback(interaction:discord.Interaction):
                if not service.can_post(interaction,section): raise PanelError('Você não tem acesso para criar posts nesse fórum.')
                await interaction.response.send_modal(ForumModal(service,section,interaction.user.id))
            return callback
        community.add_command(app_commands.Command(name=name,description=f'Abrir formulário de {destination}',callback=make_form(destination)))
    bot.tree.add_command(community)

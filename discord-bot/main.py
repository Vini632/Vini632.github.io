"""Bot WorldForge: comandos de servidor e integração privada com o site."""
from __future__ import annotations

import logging
import os
import asyncio
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlparse

import discord
import aiohttp
from discord import app_commands
from dotenv import load_dotenv

from bridge import Bridge, BridgeError
from store import Store
from server import ServerService, install_commands
from server_ui import PanelError
from dashboard import DashboardWorker, STAFF_COMMANDS

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / '.env')
log = logging.getLogger('worldforge')
COLOR = 0x8B5CF6


def required_id(name: str) -> int:
    value = os.getenv(name, '')
    if not value.isdigit() or not 15 <= len(value) <= 22:
        raise ValueError(f'Preencha {name} no arquivo discord-bot/.env.')
    return int(value)


def safe_text(value: object, limit=1000) -> str:
    return discord.utils.escape_mentions(discord.utils.escape_markdown(str(value)))[:limit]


async def answer(interaction: discord.Interaction, message: str = '', **kwargs):
    if interaction.response.is_done():
        return await interaction.followup.send(message, ephemeral=True, **kwargs)
    return await interaction.response.send_message(message, ephemeral=True, **kwargs)


def manageable_target(interaction: discord.Interaction, member: discord.Member):
    guild, actor = interaction.guild, interaction.user
    if not guild or not isinstance(actor, discord.Member) or not guild.me:
        raise app_commands.CheckFailure('Este comando só funciona no servidor.')
    if member.guild.id != guild.id or member.id in (guild.owner_id, actor.id, guild.me.id):
        raise app_commands.CheckFailure('Este membro não pode ser alvo dessa ação.')
    if actor.id != guild.owner_id and member.top_role >= actor.top_role:
        raise app_commands.CheckFailure('O cargo desse membro é igual ou superior ao seu.')
    if member.top_role >= guild.me.top_role:
        raise app_commands.CheckFailure('Meu cargo precisa ficar acima do cargo desse membro.')


def manageable_role(guild: discord.Guild, role: discord.Role, actor=None, automatic=False):
    if role.guild.id != guild.id or role.is_default() or role.managed or not guild.me:
        raise app_commands.CheckFailure('Escolha um cargo comum deste servidor.')
    if role >= guild.me.top_role:
        raise app_commands.CheckFailure('Meu cargo precisa ficar acima desse cargo.')
    if actor and actor.id != guild.owner_id and role >= actor.top_role:
        raise app_commands.CheckFailure('Você só pode gerenciar cargos abaixo do seu.')
    dangerous = ('administrator','manage_guild','manage_roles','manage_channels','manage_webhooks',
                 'kick_members','ban_members','moderate_members','manage_messages','mention_everyone')
    if automatic and any(getattr(role.permissions, flag) for flag in dangerous):
        raise app_commands.CheckFailure('O cargo inicial precisa ser um cargo de membro, sem poderes de moderação.')


class WorldForgeTree(app_commands.CommandTree):
    async def interaction_check(self, interaction):
        if interaction.guild_id != self.client.guild_id:
            await answer(interaction, 'Este bot atende ao servidor oficial do WorldForge RPG.')
            return False
        return True

    async def on_error(self, interaction, error):
        original = getattr(error, 'original', error)
        if isinstance(original, (BridgeError, PanelError, app_commands.CheckFailure)):
            if isinstance(original, app_commands.CommandOnCooldown):
                message = f'Aguarde {max(1, int(original.retry_after))} segundos antes de repetir.'
            elif isinstance(original, app_commands.BotMissingPermissions):
                message = 'Meu cargo não tem as permissões necessárias para esta ação.'
            elif isinstance(original, app_commands.MissingPermissions):
                message = 'Você não tem permissão para usar este comando.'
            else:
                message = str(original)[:1500]
        elif isinstance(original, discord.Forbidden):
            message = 'O Discord recusou a ação. Confira as permissões e a posição do cargo do bot.'
        elif isinstance(original, discord.HTTPException):
            message = 'Não consegui concluir a ação no Discord. Tente novamente mais tarde.'
        else:
            log.error('Falha em comando: %s', type(original).__name__)
            message = 'Ocorreu um erro. O administrador pode conferir o registro do bot.'
        try:
            await answer(interaction, message)
        except discord.HTTPException:
            log.warning('Não foi possível responder a uma interação expirada.')


class WorldForgeBot(discord.Client):
    def __init__(self):
        self.guild_id = required_id('DISCORD_GUILD_ID')
        application_id = required_id('DISCORD_APPLICATION_ID')
        intents = discord.Intents.none()
        intents.guilds = True
        self.native_welcome = os.getenv('ENABLE_NATIVE_WELCOME','false').lower() == 'true'
        intents.members = self.native_welcome
        super().__init__(intents=intents, application_id=application_id,
                         allowed_mentions=discord.AllowedMentions.none())
        self.tree = WorldForgeTree(self)
        self.store = Store(ROOT / '.data' / 'settings.sqlite3')
        self.role_guard=manageable_role
        self.text=safe_text
        self.server=ServerService(self)
        self.site_url = os.getenv('WORLDFORGE_SITE_URL', 'https://vini632.github.io/')
        bridge_url = os.getenv('WORLDFORGE_BRIDGE_URL', '')
        if urlparse(bridge_url).scheme != 'https' or urlparse(self.site_url).scheme != 'https':
            raise ValueError('Os endereços do site e da integração precisam usar HTTPS.')
        self.bridge = Bridge(bridge_url, os.getenv('WORLDFORGE_BRIDGE_TOKEN', ''), self.guild_id)
        self.dashboard = DashboardWorker(self)
        self.web_staff = os.getenv('DASHBOARD_STAFF','true').lower() == 'true'

    async def setup_hook(self):
        if not self.user or self.user.id != self.application_id:
            raise ValueError('O token não pertence ao DISCORD_APPLICATION_ID configurado.')
        await self.bridge.start()
        self.tree.add_command(configure)
        self.tree.add_command(roles)
        install_commands(self,self.server)
        if self.web_staff:
            if not (await self.bridge.call('bot-dashboard-health',self.user)).get('ready'):
                raise RuntimeError('O painel web ainda não está disponível; os comandos da staff foram preservados.')
            for name in STAFF_COMMANDS: self.tree.remove_command(name)
            tickets=self.tree.get_command('tickets')
            if tickets: tickets.remove_command('configurar')
        self.tree.copy_global_to(guild=discord.Object(id=self.guild_id))
        await self.register_commands()

    async def register_commands(self):
        # Upsert only our commands; a bulk sync would remove unrelated commands.
        endpoint=f'https://discord.com/api/v10/applications/{self.application_id}/guilds/{self.guild_id}/commands'
        headers={'Authorization':'Bot '+os.getenv('DISCORD_TOKEN','').strip()}
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30)) as session:
            for command in self.tree.get_commands(guild=discord.Object(id=self.guild_id)):
                payload=command.to_dict(self.tree)
                # Context metadata applies to global commands, not guild commands.
                for field in ('contexts','integration_types','dm_permission'): payload.pop(field,None)
                if payload.get('default_member_permissions') is not None:
                    payload['default_member_permissions']=str(payload['default_member_permissions'])
                async with session.post(endpoint,headers=headers,json=payload) as response:
                    if response.status==429:
                        delay=min(30,max(1,float((await response.json()).get('retry_after',2))))
                    elif response.status in (200,201):
                        continue
                    else:
                        raise RuntimeError(f'Não foi possível registrar /{command.name} (HTTP {response.status}). Confira a instalação e o escopo applications.commands.')
                await asyncio.sleep(delay)
                async with session.post(endpoint,headers=headers,json=payload) as response:
                    if response.status not in (200,201):
                        raise RuntimeError('O registro de comandos foi limitado pelo Discord. Tente iniciar mais tarde.')
            if self.web_staff:
                async with session.get(endpoint,headers=headers) as response:
                    if response.status!=200: raise RuntimeError('Não foi possível conferir os comandos existentes.')
                    commands=await response.json()
                for command in commands:
                    if command['name'] in STAFF_COMMANDS:
                        for attempt in range(3):
                            async with session.delete(endpoint+'/'+command['id'],headers=headers) as response:
                                if response.status in (204,404): break
                                if response.status==429:
                                    delay=min(30,max(1,float((await response.json()).get('retry_after',2))))
                                else: raise RuntimeError(f'Não foi possível transferir /{command["name"]} para o painel (HTTP {response.status}).')
                            if attempt==2: raise RuntimeError('O Discord limitou a transferência dos comandos. Reinicie o bot em alguns minutos.')
                            await asyncio.sleep(delay)

    async def close(self):
        await self.dashboard.close()
        await self.bridge.close()
        self.store.close()
        await super().close()

    async def on_ready(self):
        await self.server.restore_views()
        self.dashboard.start()
        log.info('WorldForge conectado. Comandos disponíveis no servidor configurado.')
        await self.change_presence(activity=discord.Activity(type=discord.ActivityType.watching,
                                                            name='os mundos do WorldForge'))

    async def audit(self, guild, title: str, description: str):
        channel_id = self.store.get(guild.id).get('log_channel')
        channel = guild.get_channel(channel_id) if channel_id else None
        if not isinstance(channel, discord.TextChannel):
            log.info('Evento de servidor: %s', title)
            return
        try:
            await channel.send(embed=discord.Embed(title=title, description=description[:4000],
                                                  color=COLOR, timestamp=discord.utils.utcnow()))
        except discord.HTTPException:
            log.warning('Não foi possível publicar no canal de registros.')

    async def on_member_join(self, member):
        if not self.native_welcome or member.guild.id != self.guild_id or member.bot:
            return
        settings = self.store.get(member.guild.id)
        role_id = settings.get('auto_role')
        role = member.guild.get_role(role_id) if role_id else None
        if role:
            try:
                manageable_role(member.guild, role, automatic=True)
                await member.add_roles(role, reason='Cargo inicial configurado no WorldForge')
            except (discord.HTTPException, app_commands.CheckFailure):
                await self.audit(member.guild, 'Cargo inicial não aplicado', f'Membro: {member.id}. Confira cargo e permissões.')
        channel_id = settings.get('welcome_channel')
        channel = member.guild.get_channel(channel_id) if channel_id else None
        if isinstance(channel, discord.TextChannel):
            embed = discord.Embed(title='Uma nova aventura começa', color=COLOR,
                                  description=f'Bem-vindo ao WorldForge RPG, {member.mention}!\n'
                                              'Explore o servidor e use `/ajuda` para conhecer os comandos.\n'
                                              'Use `/vincular` para conectar sua conta do site.')
            embed.set_thumbnail(url=member.display_avatar.url)
            view = discord.ui.View()
            view.add_item(discord.ui.Button(label='Abrir WorldForge', url=self.site_url))
            try:
                await channel.send(embed=embed, view=view,
                                   allowed_mentions=discord.AllowedMentions(users=[member], roles=False, everyone=False))
            except discord.HTTPException:
                log.warning('Não foi possível enviar boas-vindas.')
        await self.audit(member.guild, 'Novo aventureiro', f'{safe_text(member)} · ID {member.id}')


configure = app_commands.Group(name='configurar', description='Configurações do servidor WorldForge')
roles = app_commands.Group(name='cargo', description='Gerenciar cargos de membros')
bot = WorldForgeBot()


@bot.tree.command(name='ajuda', description='Conheça os comandos do WorldForge')
async def help_command(interaction: discord.Interaction):
    embed = discord.Embed(title='WorldForge RPG', color=COLOR,
                          description='Seu ponto de encontro para criar e explorar mundos.')
    embed.add_field(name='Sua conta', value='`/vincular` · `/mundos` · `/perfil` · `/desvincular`', inline=False)
    embed.add_field(name='Comunidade',value='`/comunidade bug` · `/comunidade sugestao` · `/comunidade duvida`',inline=False)
    embed.add_field(name='Atendimento',value='Painel Abrir ticket · `/tickets abrir` · `/tickets encerrar`',inline=False)
    embed.add_field(name='Equipe',value=f'Configurações, montagem, publicações e moderação: {bot.site_url.rstrip("/")}/bot/',inline=False)
    embed.set_footer(text='A configuração e moderação exigem as permissões correspondentes.')
    await answer(interaction, embed=embed)


@bot.tree.command(name='ping', description='Ver a conexão do bot')
async def ping(interaction: discord.Interaction):
    await answer(interaction, f'WorldForge online · {round(bot.latency * 1000)} ms')


@configure.command(name='boas-vindas', description='Escolher o canal de boas-vindas')
@app_commands.default_permissions(manage_guild=True)
@app_commands.checks.has_permissions(manage_guild=True)
async def welcome_config(interaction: discord.Interaction, canal: discord.TextChannel):
    if not bot.native_welcome:
        raise app_commands.CheckFailure('As boas-vindas estão com a Loritta. A automação nativa permanece desligada para não duplicar mensagens.')
    permissions = canal.permissions_for(interaction.guild.me)
    if not permissions.view_channel or not permissions.send_messages or not permissions.embed_links:
        raise app_commands.CheckFailure('Preciso ver o canal, enviar mensagens e incorporar links nesse canal.')
    bot.store.set(interaction.guild_id, 'welcome_channel', canal.id)
    await answer(interaction, f'Boas-vindas configuradas em {canal.mention}.')


@configure.command(name='logs', description='Escolher o canal de registros do bot')
@app_commands.default_permissions(manage_guild=True)
@app_commands.checks.has_permissions(manage_guild=True)
async def log_config(interaction: discord.Interaction, canal: discord.TextChannel):
    permissions = canal.permissions_for(interaction.guild.me)
    if not permissions.view_channel or not permissions.send_messages or not permissions.embed_links:
        raise app_commands.CheckFailure('Preciso ver o canal, enviar mensagens e incorporar links nesse canal.')
    bot.store.set(interaction.guild_id, 'log_channel', canal.id)
    await answer(interaction, f'Registros configurados em {canal.mention}.')


@configure.command(name='cargo-inicial', description='Definir um cargo comum para novos membros')
@app_commands.default_permissions(manage_guild=True, manage_roles=True)
@app_commands.checks.has_permissions(manage_guild=True, manage_roles=True)
@app_commands.checks.bot_has_permissions(manage_roles=True)
async def auto_role_config(interaction: discord.Interaction, cargo: discord.Role):
    if not bot.native_welcome:
        raise app_commands.CheckFailure('O autorole Aventureiro está com a Loritta. A automação nativa permanece desligada.')
    manageable_role(interaction.guild, cargo, interaction.user, automatic=True)
    bot.store.set(interaction.guild_id, 'auto_role', cargo.id)
    await answer(interaction, f'Novos membros receberão o cargo {safe_text(cargo.name)}.')


@configure.command(name='desligar', description='Desativar um recurso configurado')
@app_commands.default_permissions(manage_guild=True)
@app_commands.checks.has_permissions(manage_guild=True)
@app_commands.choices(recurso=[app_commands.Choice(name='Boas-vindas', value='welcome_channel'),
                              app_commands.Choice(name='Registros', value='log_channel'),
                              app_commands.Choice(name='Cargo inicial', value='auto_role')])
async def disable_config(interaction: discord.Interaction, recurso: app_commands.Choice[str]):
    bot.store.set(interaction.guild_id, recurso.value, None)
    await answer(interaction, f'{recurso.name}: desativado.')


@configure.command(name='ver', description='Conferir as configurações do bot')
@app_commands.default_permissions(manage_guild=True)
@app_commands.checks.has_permissions(manage_guild=True)
async def show_config(interaction: discord.Interaction):
    config = bot.store.get(interaction.guild_id)
    rows = []
    for key, title in [('welcome_channel','Boas-vindas'),('log_channel','Registros'),('auto_role','Cargo inicial')]:
        value = config.get(key)
        item = interaction.guild.get_role(value) if key == 'auto_role' and value else interaction.guild.get_channel(value) if value else None
        rows.append(f'{title}: {safe_text(item.name) if item else "não configurado ou removido"}')
    await answer(interaction, '\n'.join(rows))


async def change_role(interaction, member, role, remove=False):
    manageable_target(interaction, member)
    manageable_role(interaction.guild, role, interaction.user)
    await interaction.response.defer(ephemeral=True, thinking=True)
    reason = f'WorldForge: cargo solicitado por {interaction.user.id}'
    if remove:
        await member.remove_roles(role, reason=reason)
    else:
        await member.add_roles(role, reason=reason)
    await bot.audit(interaction.guild, 'Cargo removido' if remove else 'Cargo adicionado',
                    f'Membro: {member.id}\nCargo: {safe_text(role.name)}\nResponsável: {interaction.user.id}')
    await answer(interaction, f'Cargo {safe_text(role.name)} {"removido" if remove else "adicionado"}.')


@roles.command(name='adicionar', description='Adicionar um cargo a um membro')
@app_commands.default_permissions(manage_roles=True)
@app_commands.checks.has_permissions(manage_roles=True)
@app_commands.checks.bot_has_permissions(manage_roles=True)
async def add_role(interaction: discord.Interaction, membro: discord.Member, cargo: discord.Role):
    await change_role(interaction, membro, cargo)


@roles.command(name='remover', description='Remover um cargo de um membro')
@app_commands.default_permissions(manage_roles=True)
@app_commands.checks.has_permissions(manage_roles=True)
@app_commands.checks.bot_has_permissions(manage_roles=True)
async def remove_role(interaction: discord.Interaction, membro: discord.Member, cargo: discord.Role):
    await change_role(interaction, membro, cargo, remove=True)


@bot.tree.command(name='silenciar', description='Aplicar um timeout a um membro')
@app_commands.default_permissions(moderate_members=True)
@app_commands.checks.has_permissions(moderate_members=True)
@app_commands.checks.bot_has_permissions(moderate_members=True)
async def timeout(interaction: discord.Interaction, membro: discord.Member,
                  minutos: app_commands.Range[int, 1, 40320], motivo: app_commands.Range[str, 1, 400]):
    manageable_target(interaction, membro)
    await interaction.response.defer(ephemeral=True, thinking=True)
    await membro.timeout(timedelta(minutes=minutos), reason=f'{interaction.user.id}: {motivo}')
    await bot.audit(interaction.guild, 'Membro silenciado',
                    f'Membro: {membro.id}\nDuração: {minutos} min\nResponsável: {interaction.user.id}\nMotivo: {safe_text(motivo)}')
    await answer(interaction, f'Timeout aplicado por {minutos} minutos.')


@bot.tree.command(name='expulsar', description='Expulsar um membro do servidor')
@app_commands.default_permissions(kick_members=True)
@app_commands.checks.has_permissions(kick_members=True)
@app_commands.checks.bot_has_permissions(kick_members=True)
async def kick(interaction: discord.Interaction, membro: discord.Member, motivo: app_commands.Range[str,1,400]):
    manageable_target(interaction, membro)
    await interaction.response.defer(ephemeral=True, thinking=True)
    await membro.kick(reason=f'{interaction.user.id}: {motivo}')
    await bot.audit(interaction.guild, 'Membro expulso', f'Membro: {membro.id}\nResponsável: {interaction.user.id}\nMotivo: {safe_text(motivo)}')
    await answer(interaction, 'Membro expulso.')


@bot.tree.command(name='banir', description='Banir um membro do servidor')
@app_commands.default_permissions(ban_members=True)
@app_commands.checks.has_permissions(ban_members=True)
@app_commands.checks.bot_has_permissions(ban_members=True)
async def ban(interaction: discord.Interaction, membro: discord.Member, motivo: app_commands.Range[str,1,400]):
    manageable_target(interaction, membro)
    await interaction.response.defer(ephemeral=True, thinking=True)
    await membro.ban(reason=f'{interaction.user.id}: {motivo}', delete_message_seconds=0)
    await bot.audit(interaction.guild, 'Membro banido', f'Membro: {membro.id}\nResponsável: {interaction.user.id}\nMotivo: {safe_text(motivo)}')
    await answer(interaction, 'Membro banido. O histórico de mensagens foi preservado.')


@bot.tree.command(name='limpar', description='Excluir até 100 mensagens recentes deste canal')
@app_commands.default_permissions(manage_messages=True)
@app_commands.checks.has_permissions(manage_messages=True)
@app_commands.checks.bot_has_permissions(manage_messages=True, read_message_history=True)
async def clear(interaction: discord.Interaction, quantidade: app_commands.Range[int,1,100]):
    if not isinstance(interaction.channel, (discord.TextChannel, discord.Thread)):
        raise app_commands.CheckFailure('Use este comando em um canal de texto.')
    await interaction.response.defer(ephemeral=True, thinking=True)
    cutoff = discord.utils.utcnow() - timedelta(days=14)
    deleted = await interaction.channel.purge(limit=quantidade, check=lambda m: m.created_at > cutoff,
                                              reason=f'Limpeza solicitada por {interaction.user.id}')
    await bot.audit(interaction.guild, 'Canal limpo',
                    f'Canal: {interaction.channel.id}\nMensagens: {len(deleted)}\nResponsável: {interaction.user.id}')
    await answer(interaction, f'{len(deleted)} mensagens recentes excluídas. Mensagens de 14 dias ou mais foram preservadas.')


@bot.tree.command(name='vincular', description='Conectar sua conta WorldForge ao Discord')
@app_commands.checks.cooldown(1, 60, key=lambda i: (i.guild_id,i.user.id))
async def link(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True, thinking=True)
    result = await bot.bridge.call('bot-create-link', interaction.user, discord_name=str(interaction.user))
    view = discord.ui.View()
    view.add_item(discord.ui.Button(label='Abrir WorldForge', url=bot.site_url))
    await answer(interaction, 'No site, entre em sua conta e abra **Configurações → Conta e acesso → Discord**.\n'
                 f'Cole este código e confirme o vínculo:\n```\n{result["code"]}\n```\n'
                 'O código expira em 10 minutos e só pode ser usado uma vez. Compartilhe-o apenas com sua própria conta.', view=view)


@bot.tree.command(name='mundos', description='Ver os seus mundos sincronizados do WorldForge')
@app_commands.checks.cooldown(1, 15, key=lambda i: (i.guild_id,i.user.id))
async def worlds(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True, thinking=True)
    result = await bot.bridge.call('bot-worlds', interaction.user)
    items = result.get('worlds', [])
    embed = discord.Embed(title='Seus mundos', color=COLOR)
    if not items:
        embed.description = 'Nenhum mundo sincronizado. No site, use **Dados & backup → Enviar cópia para a nuvem**.'
    for item in items:
        embed.add_field(name=safe_text(item['name'],80),
                        value=f'Turno {item["turn"]} · {item["realms"]} reinos · {item["cities"]} cidades · {item["npcs"]} personagens', inline=False)
    embed.set_footer(text='Até 20 mundos mais recentes. Somente você vê esta resposta.')
    await answer(interaction, embed=embed)


@bot.tree.command(name='perfil', description='Conferir seu vínculo com o WorldForge')
@app_commands.checks.cooldown(1, 15, key=lambda i: (i.guild_id,i.user.id))
async def profile(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True, thinking=True)
    result = await bot.bridge.call('bot-worlds', interaction.user)
    await answer(interaction, f'Conta vinculada ao WorldForge.\nDiscord: **{safe_text(result["discord_name"],100)}**\n'
                 f'Mundos encontrados: {len(result.get("worlds",[]))} (até 20 mais recentes).')


@bot.tree.command(name='desvincular', description='Desconectar sua conta do site sem apagar mundos')
@app_commands.checks.cooldown(1, 30, key=lambda i: (i.guild_id,i.user.id))
async def unlink(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True, thinking=True)
    await bot.bridge.call('bot-unlink', interaction.user)
    await answer(interaction, 'Conta desconectada do Discord. Seus mundos continuam no WorldForge.')


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    token = os.getenv('DISCORD_TOKEN', '').strip()
    if not token:
        raise SystemExit('Preencha DISCORD_TOKEN em discord-bot/.env antes de iniciar. Não envie o token no chat.')
    try:
        bot.run(token, log_level=logging.WARNING)
    except discord.PrivilegedIntentsRequired:
        raise SystemExit('Ative Server Members Intent no Developer Portal para usar boas-vindas e cargo inicial.')
    except discord.LoginFailure:
        raise SystemExit('O token do bot foi recusado. Confira DISCORD_TOKEN no arquivo .env local.')

"""Components V2, formulários com Labels e callbacks persistentes."""
from __future__ import annotations

import io
from pathlib import Path
import discord

ASSETS = Path(__file__).resolve().parent / 'assets'
PURPLE = 0x8B5CF6
GOLD = 0xDBB877


async def respond(interaction, content=None, **kwargs):
    kwargs['ephemeral'] = True
    if content is not None:
        kwargs['content'] = content
    if interaction.response.is_done():
        return await interaction.followup.send(**kwargs)
    return await interaction.response.send_message(**kwargs)


def artwork(names=('logo.png','banner.png','logo-animated.gif')):
    return [discord.File(ASSETS / filename, filename=filename) for filename in names]


class SafeLayout(discord.ui.LayoutView):
    def __init__(self, service, *, timeout=None, owner_id=None):
        super().__init__(timeout=timeout)
        self.service, self.owner_id = service, owner_id

    async def interaction_check(self, interaction):
        if interaction.guild_id != self.service.bot.guild_id:
            await respond(interaction, 'Use este painel no servidor WorldForge.')
            return False
        if self.owner_id and interaction.user.id != self.owner_id:
            await respond(interaction, 'Este painel pertence a outra pessoa.')
            return False
        return True

    async def on_error(self, interaction, error, item):
        self.service.log.warning('Componente recusado: %s', type(error).__name__)
        message = str(error) if isinstance(error, PanelError) else 'Não foi possível concluir. Confira permissões ou tente mais tarde.'
        try:
            await respond(interaction, message[:1500])
        except discord.HTTPException:
            pass


class PanelError(Exception):
    pass


class ActionButton(discord.ui.Button):
    def __init__(self, service, action, section, label, *, style=discord.ButtonStyle.secondary, emoji=None):
        super().__init__(label=label, style=style, emoji=emoji, custom_id=f'wf:{action}:{section}:v1')
        self.service, self.action, self.section = service, action, section

    async def callback(self, interaction):
        if self.action == 'role':
            await self.service.toggle_role(interaction, self.section)
        elif self.action == 'forum':
            if not self.service.can_post(interaction, self.section):
                raise PanelError('Você precisa ter acesso e permissão para criar posts nesse fórum.')
            await interaction.response.send_modal(ForumModal(self.service, self.section, interaction.user.id))
        elif self.action == 'ticket':
            if not self.service.ticket_ready(interaction.guild):
                raise PanelError('O atendimento privado precisa ser configurado pela equipe.')
            await interaction.response.send_modal(TicketModal(self.service, interaction.user.id))
        elif self.action == 'close':
            await self.service.close_ticket(interaction)
        elif self.action == 'template':
            template=self.service.catalog[self.section].get('template','')
            await respond(interaction, 'Modelo para preencher com informações confirmadas:',
                          file=discord.File(io.BytesIO(template.encode('utf-8')),filename=f'modelo-{self.section}.md'))


class PublicPanel(SafeLayout):
    def __init__(self, service, section):
        super().__init__(service)
        data=service.catalog[section]
        header=discord.ui.Container(
            discord.ui.Section(discord.ui.TextDisplay(f'-# {data["author"]}\n## {data["title"]}'),
                               accessory=discord.ui.Thumbnail('attachment://logo.png',description='Selo dourado WorldForge')),
            discord.ui.MediaGallery(discord.MediaGalleryItem('attachment://banner.png',description='Montanhas, portal e dragão do WorldForge')),
            accent_colour=PURPLE)
        self.add_item(header)
        body=data['body']
        rows=[]
        if section=='escolha-seus-cargos':
            if service.roles_ready(service.bot.guild_id):
                rows.append(discord.ui.ActionRow(
                    ActionButton(service,'role','Mestre de RPG','Mestre de RPG',emoji='⚔️'),
                    ActionButton(service,'role','Criador de Mundos','Criador de Mundos',emoji='🌌')))
                body += '\n\n**Clique novamente para remover um cargo.** O cargo Aventureiro continua com a Loritta.'
            else:
                body=body.replace('Use os botões ou o menu abaixo para adicionar ou remover seus cargos de interesse.',
                                  'A seleção de cargos aguarda configuração. Fale com a equipe se precisar de ajuda.')
        elif data['kind']=='forum':
            label={'reportar-bugs':'Reportar um bug','sugestões':'Enviar uma ideia','dúvidas':'Fazer uma pergunta'}[section]
            rows.append(discord.ui.ActionRow(ActionButton(service,'forum',section,label,style=discord.ButtonStyle.primary),
                                            ActionButton(service,'template',section,'Baixar modelo')))
            body += '\n\n**Use o formulário abaixo.** Você revisa o conteúdo antes de publicá-lo no fórum.'
        elif section=='abrir-ticket' and service.ticket_ready(service.bot.get_guild(service.bot.guild_id)):
            body=data['active_body']
            rows.append(discord.ui.ActionRow(ActionButton(service,'ticket',section,'Abrir ticket',style=discord.ButtonStyle.primary,emoji='🎫')))
        elif data.get('template'):
            rows.append(discord.ui.ActionRow(ActionButton(service,'template',section,'Modelo para a equipe')))
        contents=[discord.ui.TextDisplay(body)]
        for part in data.get('parts',[]):
            contents.extend([discord.ui.Separator(),discord.ui.TextDisplay(f'### {part["heading"]}\n{part["text"]}')])
        contents.extend(rows)
        contents += [discord.ui.Separator(), discord.ui.Section(
            discord.ui.TextDisplay(f'-# {data["footer"]}'),
            accessory=discord.ui.Thumbnail('attachment://logo-animated.gif',description='Selo animado WorldForge')),
            discord.ui.ActionRow(discord.ui.Button(label='Abrir WorldForge',url=service.bot.site_url),
                                 discord.ui.Button(label='Convite oficial',url='https://discord.gg/ea9BjNK9tp'))]
        self.add_item(discord.ui.Container(*contents,accent_colour=PURPLE))


class ForumControls(SafeLayout):
    """Adds real controls to an existing guide without replacing its author."""
    def __init__(self,service,section):
        super().__init__(service)
        label={'reportar-bugs':'Reportar um bug','sugestões':'Enviar uma ideia','dúvidas':'Fazer uma pergunta'}[section]
        self.add_item(discord.ui.Container(
            discord.ui.Section(discord.ui.TextDisplay('### Transforme seu feedback em um tópico\n'
                'Preencha o formulário e revise antes de publicar. O novo tópico será criado neste fórum, separado deste guia.'),
                accessory=discord.ui.Thumbnail('attachment://logo-animated.gif',description='Selo animado WorldForge')),
            discord.ui.Separator(),discord.ui.ActionRow(
                ActionButton(service,'forum',section,label,style=discord.ButtonStyle.primary),
                ActionButton(service,'template',section,'Baixar modelo')),
            discord.ui.TextDisplay('-# Não inclua credenciais ou dados privados em publicações públicas.'),accent_colour=PURPLE))


def labeled_input(modal, title, *, description=None, maximum=1500, paragraph=True, required=True):
    field=discord.ui.TextInput(style=discord.TextStyle.paragraph if paragraph else discord.TextStyle.short,
                               max_length=maximum,required=required)
    modal.add_item(discord.ui.Label(text=title,description=description,component=field))
    return field


class OwnedModal(discord.ui.Modal):
    def __init__(self, service, owner_id, title):
        super().__init__(title=title,timeout=600)
        self.service,self.owner_id=service,owner_id

    async def interaction_check(self,interaction):
        return interaction.user.id==self.owner_id and interaction.guild_id==self.service.bot.guild_id

    async def on_error(self,interaction,error):
        self.service.log.warning('Formulário recusado: %s',type(error).__name__)
        await respond(interaction,str(error)[:1500] if isinstance(error,PanelError) else 'Não foi possível enviar o formulário. Tente mais tarde.')


class ForumModal(OwnedModal):
    def __init__(self,service,section,owner_id):
        super().__init__(service,owner_id,{'reportar-bugs':'Reportar um bug','sugestões':'Sugerir uma melhoria','dúvidas':'Fazer uma pergunta'}[section])
        self.section=section
        self.title_field=labeled_input(self,'Título específico',maximum=90,paragraph=False)
        if section=='reportar-bugs':
            specs=[('O que aconteceu e o que era esperado',1500,'Compare os dois comportamentos.'),
                   ('Passos para reproduzir',1000,'Descreva os passos numerados.'),
                   ('Ambiente e frequência',300,'Dispositivo, navegador, sistema e quando acontece.')]
        elif section=='sugestões':
            specs=[('Problema atual',900,'Qual dificuldade precisa ser resolvida?'),
                   ('Solução proposta',1000,'Como a ideia funcionaria?'),
                   ('Benefício e exemplo de uso',800,'Quem se beneficia? Dê um exemplo.')]
        else:
            specs=[('Sua dúvida',1500,'Explique a pergunta com contexto.'),
                   ('O que você já tentou',1000,'Conte os passos realizados.'),
                   ('Assunto e referências',300,'Plataforma, biblioteca, RPG ou outro. Sem dados privados.')]
        self.fields=[(name,labeled_input(self,name,maximum=size,description=description)) for name,size,description in specs]
        self.upload=discord.ui.FileUpload(required=False,min_values=0,max_values=1)
        self.add_item(discord.ui.Label(text='Evidência opcional',description='Este post será público. Não anexe dados privados, senhas ou códigos.',component=self.upload))

    async def on_submit(self,interaction):
        if not self.service.can_post(interaction,self.section):
            raise PanelError('Você não tem permissão para publicar nesse fórum.')
        values=[(name,str(field.value)) for name,field in self.fields]
        files=list(self.upload.values)
        self.service.validate_attachments(interaction.guild,files)
        view=ForumReview(self.service,self.section,interaction.user.id,str(self.title_field.value),values,files,str(interaction.id))
        await respond(interaction,view=view)


class ForumReview(SafeLayout):
    def __init__(self,service,section,owner_id,title,values,attachments,request_id):
        super().__init__(service,timeout=300,owner_id=owner_id)
        self.section,self.title,self.values,self.attachments,self.request_id=section,title,values,attachments,request_id
        text=f'## Revise sua publicação\n**{service.bot.text(title,100)}**\n'
        text += '\n'.join(f'### {name}\n{service.bot.text(value,1500)}' for name,value in values)
        text += '\n\n**Este conteúdo ficará público no fórum.** Não inclua informações privadas.'
        if attachments:
            text += '\nAnexo: '+service.bot.text(attachments[0].filename,100)
        publish=discord.ui.Button(label='Publicar no fórum',style=discord.ButtonStyle.primary)
        cancel=discord.ui.Button(label='Cancelar',style=discord.ButtonStyle.secondary)
        publish.callback=self.publish
        cancel.callback=self.cancel
        self.add_item(discord.ui.Container(discord.ui.TextDisplay(text),discord.ui.Separator(),
                                          discord.ui.ActionRow(publish,cancel),accent_colour=PURPLE))

    async def publish(self,interaction):
        if not self.service.can_post(interaction,self.section):
            raise PanelError('Seu acesso ao fórum mudou. A publicação foi cancelada.')
        await interaction.response.defer(ephemeral=True,thinking=True)
        thread=await self.service.publish_forum(interaction,self)
        self.stop()
        await respond(interaction,f'Publicação criada: {thread.mention}')

    async def cancel(self,interaction):
        self.stop()
        await interaction.response.edit_message(view=discord.ui.LayoutView().add_item(
            discord.ui.TextDisplay('Publicação cancelada. Nenhum tópico foi criado.')))


class TicketModal(OwnedModal):
    def __init__(self,service,owner_id):
        super().__init__(service,owner_id,'Abrir atendimento privado')
        self.kind=discord.ui.Select(options=[discord.SelectOption(label=item,value=item) for item in
                                    ['Conta e acesso','Denúncia','Suporte técnico','Outros assuntos']])
        self.add_item(discord.ui.Label(text='Como podemos ajudar?',description='Selecione o assunto do atendimento.',component=self.kind))
        self.subject=labeled_input(self,'Assunto',maximum=90,paragraph=False)
        self.description=labeled_input(self,'Descreva o pedido',maximum=1800,
                                        description='Não envie senha, token ou código de autenticação. A equipe terá acesso ao ticket.')
        self.upload=discord.ui.FileUpload(required=False,min_values=0,max_values=1)
        self.add_item(discord.ui.Label(text='Anexo opcional',description='Inclua apenas uma evidência necessária ao atendimento.',component=self.upload))

    async def on_submit(self,interaction):
        await interaction.response.defer(ephemeral=True,thinking=True)
        self.service.validate_attachments(interaction.guild,list(self.upload.values))
        channel=await self.service.open_ticket(interaction,self.kind.values[0],str(self.subject.value),
                                               str(self.description.value),list(self.upload.values))
        await respond(interaction,f'Seu atendimento privado está em {channel.mention}. A equipe responderá conforme disponibilidade.')


class TicketControls(SafeLayout):
    def __init__(self,service):
        super().__init__(service)
        self.add_item(discord.ui.Container(
            discord.ui.TextDisplay('### Seu espaço de atendimento\nSomente o solicitante e a equipe autorizada têm acesso, além de administradores do Discord. '
                                   'Não compartilhe credenciais. Ao encerrar, o canal fica arquivado para a equipe.'),
            discord.ui.ActionRow(ActionButton(service,'close','ticket','Encerrar atendimento',style=discord.ButtonStyle.danger)),
            accent_colour=PURPLE))


class SetupReview(SafeLayout):
    def __init__(self,service,owner_id,lines,operation,section=None,extra=None):
        super().__init__(service,timeout=600,owner_id=owner_id)
        self.operation,self.section=operation,section
        self.extra=extra
        self.running=False
        confirm=discord.ui.Button(label='Confirmar montagem' if operation=='setup' else 'Confirmar publicação',style=discord.ButtonStyle.primary)
        confirm.callback=self.confirm
        cancel=discord.ui.Button(label='Cancelar',style=discord.ButtonStyle.secondary)
        cancel.callback=self.cancel
        self.add_item(discord.ui.Container(discord.ui.TextDisplay('## Plano do servidor\n'+'\n'.join(lines)),
            discord.ui.Separator(),discord.ui.TextDisplay('A montagem reutiliza canais e preserva mensagens existentes. '
                'Não altera a Loritta, o autorole Aventureiro nem o comando worldforge.'),
            discord.ui.ActionRow(confirm,cancel),accent_colour=PURPLE))

    async def confirm(self,interaction):
        self.service.require_admin(interaction)
        if self.running:
            await respond(interaction,'A operação já foi iniciada. Aguarde o resultado.')
            return
        self.running=True
        await interaction.response.defer(ephemeral=True,thinking=True)
        try:
            if self.operation=='setup': result=await self.service.setup(interaction)
            elif self.operation=='permissions': result=await self.service.apply_permissions(interaction,self.extra)
            else: result=await self.service.publish_one(interaction,self.section)
            await respond(interaction,'\n'.join(result)[:1900])
            self.stop()
        except Exception:
            self.running=False
            raise

    async def cancel(self,interaction):
        self.stop()
        view=discord.ui.LayoutView()
        view.add_item(discord.ui.TextDisplay('Operação cancelada.'))
        await interaction.response.edit_message(view=view)


class PublicationModal(OwnedModal):
    def __init__(self,service,owner_id,section):
        super().__init__(service,owner_id,'Publicar conteúdo oficial')
        self.section=section
        self.title_field=labeled_input(self,'Título da publicação',maximum=100,paragraph=False)
        states={'anúncios':['Informativo','Em testes','Disponível','Manutenção'],
                'atualizações':['Disponível','Em testes'],
                'biblioteca-de-mundos':['Disponível','Em testes','Em desenvolvimento'],
                'roadmap':['Em avaliação','Planejado','Em desenvolvimento','Em testes','Disponível'],
                'testes-e-beta':['Inscrições abertas','Teste iniciado','Teste encerrado']}
        self.state=discord.ui.Select(options=[discord.SelectOption(label=value,value=value) for value in states[section]])
        self.add_item(discord.ui.Label(text='Estado confirmado',description='Planejado não significa lançado.',component=self.state))
        descriptions={
            'anúncios':'Informe o que aconteceu, quem é afetado e quando (se aplicável).',
            'atualizações':'Versão/data, novidades, melhorias, correções e problemas conhecidos.',
            'biblioteca-de-mundos':'Tipo, gênero, sinopse, diferenciais, autor e créditos.',
            'roadmap':'Objetivo, escopo, última atualização e dependências. Prazo só se aprovado.',
            'testes-e-beta':'Objetivo, elegibilidade, período, acesso, feedback e limitações reais.'}
        self.details=labeled_input(self,'Informações verificadas',description=descriptions[section],maximum=2200)
        self.link=labeled_input(self,'Link real (opcional)',description='Use HTTPS. Não inclua códigos ou dados privados.',
                                maximum=350,paragraph=False,required=False)
        self.confirmed=labeled_input(self,'Confirmo que as informações foram verificadas',description='Digite CONFIRMADO para continuar.',
                                     maximum=20,paragraph=False)

    async def on_submit(self,interaction):
        self.service.require_admin(interaction)
        if str(self.confirmed.value).strip()!='CONFIRMADO':
            raise PanelError('Digite CONFIRMADO somente depois de conferir as informações da publicação.')
        self.service.validate_link(str(self.link.value).strip())
        if not str(self.title_field.value).strip() or not str(self.details.value).strip():
            raise PanelError('Preencha o título e os detalhes.')
        view=PublicationReview(self.service,interaction.user.id,self.section,str(self.title_field.value),
                               self.state.values[0],str(self.details.value),str(self.link.value).strip(),str(interaction.id))
        await respond(interaction,view=view)


class PublicationReview(SafeLayout):
    def __init__(self,service,owner_id,section,title,state,details,link,request_id):
        super().__init__(service,timeout=300,owner_id=owner_id)
        self.section,self.title,self.state,self.details,self.link,self.request_id=section,title,state,details,link,request_id
        self.running=False
        content=f'## Revisão da publicação\n### {service.bot.text(title,100)}\n**Estado:** {state}\n\n{service.bot.text(details,2300)}'
        if link: content += '\n\nLink: '+service.bot.text(link,350)
        publish=discord.ui.Button(label='Publicar no canal oficial',style=discord.ButtonStyle.primary)
        publish.callback=self.publish
        self.add_item(discord.ui.Container(discord.ui.TextDisplay(content),discord.ui.Separator(),
            discord.ui.TextDisplay(f'Destino: **{section}**. Confira os dados antes de confirmar.'),
            discord.ui.ActionRow(publish),accent_colour=PURPLE))

    async def publish(self,interaction):
        self.service.require_admin(interaction)
        if self.running: raise PanelError('A publicação já está sendo enviada.')
        self.running=True
        await interaction.response.defer(ephemeral=True,thinking=True)
        try:
            message=await self.service.publish_official(interaction,self)
            self.stop()
            await respond(interaction,f'Publicação enviada: {message.jump_url}')
        except Exception:
            self.running=False
            raise

# Bot oficial · WorldForge RPG

Bot Python para o servidor `1559443784255803464`, aplicação `1559439222308601897`.
O site continua no GitHub Pages. O processo do bot roda separadamente no Windows
ou em uma máquina com Python e conexão contínua ao Discord.

**Estado em 13/10/2026:** bot implantado e conectado na **HostSquare**, plano mensal
de 512 MB por R$ 2,50. Python 3.12; reconexão após reinício confirmada. A instância
Windows foi encerrada. Não inicie outra enquanto a hospedagem estiver ativa.
O SQLite da hospedagem é agora a cópia ativa; obtenha um backup recente antes de
mover o bot ou voltar a executá-lo localmente.

## Painel web: administração padrão

Abra **https://vini632.github.io/bot/**. Montagem, publicação de painéis, configurações,
permissões, cargos, moderação e publicações oficiais foram transferidos para o painel.
Entre na conta WorldForge, conecte seu Discord e ative/verifique o 2FA. As permissões
são conferidas no servidor a cada ação. Consulte [o painel](../bot/README.md) e
[a hospedagem](HOSPEDAGEM.md) para manter a implantação atual na HostSquare.

No Discord permanecem `/ajuda`, `/ping`, `/vincular`, `/mundos`, `/perfil`,
`/desvincular`, `/comunidade bug|sugestao|duvida` e `/tickets abrir|encerrar`,
além dos botões dos painéis. Guias de fóruns de outros autores são preservados;
os controles podem ser acrescentados ao mesmo tópico sem substituir o guia.

`DASHBOARD_STAFF=true` é o padrão. O bot confere a disponibilidade do backend
antes de retirar os comandos da staff. `DASHBOARD_STAFF=false` permite manter
temporariamente a interface antiga durante uma manutenção; nunca muda as
verificações de permissão do servidor.

## Comandos antigos (somente com DASHBOARD_STAFF=false)

| Comando | Resultado |
|---|---|
| `/servidor diagnostico` | Mostra quais canais serão reutilizados, ausentes ou ambíguos. Não altera o servidor. |
| `/servidor previa secao:` | Exibe o painel com as artes em uma resposta privada. |
| `/servidor montar` | Exibe o plano; depois da confirmação monta somente a estrutura necessária e os guias permanentes. |
| `/servidor publicar secao:` | Atualiza um único guia permanente, com revisão antes da publicação. |
| `/servidor associar secao: canal:` | Associa nomes personalizados aos destinos existentes, sem renomear. |
| `/servidor permissoes equipe:` | Mostra uma revisão antes de aplicar leitura/publicação dos canais do documento. |
| `/tickets configurar equipe:` | Configura a equipe, a categoria privada e o botão funcional de atendimento. |
| `/tickets encerrar` | Fecha o atendimento no canal atual e preserva o histórico privado da equipe. |
| `/publicar anuncio` | Formulário e revisão para um comunicado confirmado. |
| `/publicar atualizacao` | Formulário e revisão para uma atualização real. |
| `/publicar mundo` | Ficha oficial com estado, conteúdo e créditos informados pela equipe. |
| `/publicar roadmap` | Item com status explicitamente escolhido e informações verificadas. |
| `/publicar beta` | Convocação ou encerramento de testes somente quando confirmado pela equipe. |

### Ordem sugerida

1. `/servidor diagnostico`.
2. `/servidor previa secao: regras` para revisar o visual.
3. `/servidor montar` e confirmar o plano.
4. `/servidor permissoes equipe: Moderador` (ou o cargo exclusivo de sua equipe), revisar e confirmar.
5. `/tickets configurar equipe: Moderador` para ativar o atendimento privado.

Os três fóruns precisam ser do tipo Fórum. O bot não converte canais existentes,
não muda seus nomes e não recria categorias equivalentes. Nomes com emojis e
separadores são reconhecidos. Guias publicados por outros bots ou pessoas são
preservados. Mensagens do próprio WorldForge são atualizadas no lugar e seus IDs
ficam registrados para retomar operações interrompidas sem duplicação.

A busca de equivalentes consulta os fixados e o histórico. Em históricos muito
extensos a publicação é interrompida para evitar uma duplicata incerta. Se houver
duas correspondências de canal, use `/servidor associar`.

## Visual e componentes

Os painéis usam **Components V2**: `LayoutView`, `Container`, `Section`,
`Thumbnail`, `MediaGallery`, `TextDisplay`, `Separator` e `ActionRow`.
Formulários usam **Labels**, seletores, campos de texto e **FileUpload** opcional.
O destaque roxo `#8B5CF6` segue o documento; as artes adicionam ouro, marfim e
fantasia. O tema de fundo e a tipografia são controlados pelo cliente Discord.

Artes fornecidas pelo mantenedor, copiadas sem alteração:

- `assets/logo.png`: monograma dourado.
- `assets/banner.png`: montanhas, portal e dragão.
- `assets/logo-animated.gif`: selo animado.

As imagens são enviadas como anexos reais das mensagens. Não são usados links
inventados, nem é necessário publicar as imagens em outro serviço.

## Loritta e cargos

`ENABLE_NATIVE_WELCOME=false` é o padrão. A Loritta continua responsável pelas
boas-vindas, pelo autorole **Aventureiro** e pelo comando personalizado **worldforge**.
O registro dos comandos do WorldForge usa inclusão/atualização individual, sem
uma substituição completa que apagaria comandos desconhecidos da aplicação.

O painel de interesse oferece apenas **Mestre de RPG** e **Criador de Mundos**.
Os cargos são conferidos a cada interação, precisam ficar abaixo do bot e não
podem conter privilégios de moderação. Clicar de novo remove apenas aquele cargo.
Fundador, Administrador, Desenvolvedor, Moderador e Aventureiro não são oferecidos.

## Fóruns e tickets

- Bugs, sugestões e dúvidas abrem formulários privados. A pessoa revisa o texto
  e confirma antes de publicá-lo no fórum correspondente.
- Etiquetas existentes são preservadas; etiquetas faltantes são adicionadas.
  Etiquetas de triagem/status são moderadas quando apropriado.
- O guia do fórum é fixado. Os novos tópicos reais são independentes desse guia.
- Um ticket ativo por solicitante. O canal recebe permissões explícitas para o
  solicitante, cargo da equipe e bot. Proprietário e administradores do Discord
  também podem acessá-lo, conforme as regras da plataforma.
- O fechamento retira o acesso do solicitante e mantém o canal privado para a
  equipe. Não há exclusão automática de canais, mensagens ou históricos.
- Se o atendimento não estiver configurado, o painel usa o texto provisório do
  documento e não mostra um botão de abertura inoperante.
- Anexos opcionais são limitados a 8 MB e ao limite do servidor. Nunca devem conter
  senhas, códigos de autenticação ou informações privadas em fóruns públicos.

## Moderação e utilidades

`/ajuda`, `/ping`, `/configurar logs`, `/configurar ver`, `/cargo adicionar`,
`/cargo remover`, `/silenciar`, `/expulsar`, `/banir` e `/limpar`.
As permissões efetivas e a hierarquia do autor e do bot são verificadas.
`/banir` não apaga o histórico de mensagens. `/limpar` considera até 100 mensagens
recentes e preserva mensagens com 14 dias ou mais. Não há leitura do conteúdo
de chats para comandos de prefixo; o bot trabalha com comandos de barra.

## Integração com o site

1. No Discord, execute `/vincular`.
2. Entre na conta confirmada do site e abra **Configurações → Conta e acesso → Discord**.
3. Cole o código, leia a autorização e confirme.
4. Use `/mundos` ou `/perfil`. As respostas são privadas para o solicitante.

O código tem 128 bits aleatórios, validade de 10 minutos e uso único. A conexão
é individual: uma conta WorldForge por conta Discord. Somente mundos previamente
sincronizados aparecem, até 20 mais recentes. O bot lê apenas nomes e resumos
(turno e contagens); não recebe e-mail, senha, sessão do site ou os arquivos completos.
`/desvincular` ou o controle no site remove a conexão sem apagar os mundos.

O backend `discord-bridge` está no Supabase. Ele valida a sessão com Auth e
autentica o bot por uma chave dedicada, cujo hash é armazenado no banco.
O bot não contém a chave administrativa do Supabase. As funções de banco são
`SECURITY INVOKER`, disponíveis somente ao servidor; RLS isola o vínculo da pessoa.
Códigos antigos são limpos na próxima criação depois de expirados há um dia.

## Instalar e executar no Windows

Python 3.12 foi usado neste ambiente. Na raiz do projeto:

```powershell
python -m venv discord-bot/.venv
discord-bot/.venv/Scripts/python.exe -m pip install -r discord-bot/requirements.lock
discord-bot/.venv/Scripts/python.exe discord-bot/setup.py
```

Preencha **somente** `DISCORD_TOKEN` em `discord-bot/.env` com o token do bot.
Os IDs e a chave da integração já foram preparados no ambiente do mantenedor.
O token e a pasta `.data` são ignorados no GitHub.

```powershell
# Terminal com os registros visíveis:
./discord-bot/start-bot.ps1

# Processo em segundo plano:
./discord-bot/start-bot.ps1 -Background

# Encerrar somente o processo registrado deste bot:
./discord-bot/stop-bot.ps1
```

O modo em segundo plano escreve logs em `.data/bot-error.log` e `.data/bot-out.log`.
Não inicia com o Windows automaticamente. Se a máquina desligar ou suspender,
o bot ficará offline. Para hospedagem contínua, use um processo Python persistente
com disco persistente para `.data` e variáveis privadas equivalentes ao `.env`.
Não execute duas instâncias simultâneas para o mesmo servidor.

## Permissões do Discord

Instalação no servidor com os escopos `bot` e `applications.commands`.
O bot precisa, conforme os recursos utilizados: **View Channel**, **Send Messages**,
**Embed Links**, **Attach Files**, **Read Message History**, **Manage Channels**,
**Manage Roles**, **Manage Messages**, **Manage Threads**, **Kick Members**,
**Ban Members** e **Moderate Members**. Administrator não é exigido pelo código.
Os comandos de montagem e publicação são restritos ao proprietário/administradores.

O cargo do bot deve ficar acima dos cargos que ele administra. **Message Content
Intent não é necessário**. **Server Members Intent** só é necessário se a automação
nativa de boas-vindas for habilitada explicitamente no futuro, em substituição à Loritta.

## Manutenção

- `catalog.json` contém apenas guias permanentes extraídos do documento.
- Atualize `docs/world_forge_discord_canais.md` e rode `build_catalog.py` para recriar
  o catálogo; os modelos futuros continuam separados dos textos públicos.
- Preserve `.data/settings.sqlite3` para manter IDs de painéis, cargos e tickets.
- Preserve o `.env` ao mover o bot para outra máquina. Não envie credenciais para
  canais, chat, imagens, logs públicos ou repositório.
- Para outra instalação, `setup.py` gera uma nova chave. Registre somente o hash
  de `.data/register-bridge.sql` no Supabase depois de aplicar as migrações Discord.
  Rotacionar a chave do bot exige registrar o novo hash e desativar a chave antiga.

Referências: [componentes do Discord](https://docs.discord.com/developers/components/reference),
[discord.py](https://discordpy.readthedocs.io/en/stable/interactions/api.html).

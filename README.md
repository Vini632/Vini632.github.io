# WorldForge RPG

**Gerador procedural de mundos de RPG com interface web**

O WorldForge RPG cria mundos de fantasia com reinos, cidades, NPCs, monstros, missões, relações sociais e eventos dinâmicos. O projeto inclui um gerador em Python e uma interface web estática, que também funciona no GitHub Pages.

O gerador Python utiliza apenas a biblioteca padrão. A interface web não exige servidor nem dependências: pode ser hospedada como site estático e também instalada como aplicativo web progressivo (PWA) em navegadores compatíveis.

## Índice

1. [Funcionalidades](#funcionalidades)
2. [Requisitos](#requisitos)
3. [Instalação](#instalação)
4. [Como executar](#como-executar)
5. [Parâmetros disponíveis](#parâmetros-disponíveis)
6. [Sistemas do mundo](#sistemas-do-mundo)
7. [Exportação JSON](#exportação-json)
8. [Testes automatizados](#testes-automatizados)
9. [Reprodutibilidade](#reprodutibilidade)
10. [Solução de problemas](#solução-de-problemas)
11. [Estrutura e manutenção](#estrutura-e-manutenção)
12. [Próximas melhorias](#próximas-melhorias)
13. [Privacidade e segurança da interface web](#13-privacidade-e-segurança-da-interface-web)

---

## 1. Funcionalidades

O WorldForge RPG reúne os seguintes sistemas:

- **Geração de reinos:** cria territórios que compõem o mundo.
- **Geração de cidades:** associa cidades aos seus respectivos reinos.
- **Geração de NPCs:** cria personagens não jogáveis e os associa a cidades.
- **Geração de monstros:** disponibiliza criaturas para encontros e missões.
- **Geração de missões:** cria objetivos para aventuras.
- **Relações entre NPCs:** representa vínculos sociais, rivalidades e conflitos.
- **Eventos dinâmicos:** simula acontecimentos que podem durar vários turnos.
- **Avanço de turnos:** permite avançar o calendário e atualizar o estado dos eventos.
- **Validação de integridade:** verifica referências entre as entidades do mundo.
- **Exportação JSON:** salva os dados gerados para leitura por outras ferramentas.
- **Interface visual:** explore o mundo em um painel responsivo com tema escuro.
- **Backup local:** importe e exporte mundos JSON diretamente no navegador.
- **Biblioteca local:** mantenha vários mundos no mesmo navegador, alterne entre eles, duplique ou exclua mundos e exporte cada um separadamente.
- **Linha do tempo e anotações:** acompanhe eventos por turno e registre acontecimentos da mesa.
- **Busca e filtros:** refine registros por texto, reino, cidade, categoria, estado e outras propriedades.
- **Edição do mundo:** crie, edite e exclua reinos, cidades, personagens, missões, eventos e monstros.
- **Relações entre personagens:** busque e filtre vínculos, crie e edite relações e ajuste sua intensidade, sem permitir pares duplicados.
- **Backup completo:** exporte ou restaure a biblioteca inteira em um arquivo JSON.
- **Seed de geração:** permite reproduzir mundos e simulações com os mesmos parâmetros.
- **Biblioteca de Mundos:** catálogo disponível com três cenários iniciais, filtros, detalhes e cópia independente para a conta da pessoa.
- **Atualizações:** abra o histórico pela versão exibida no rodapé; as notas fazem parte do app, sem baixar scripts de um endereço arbitrário.

O projeto funciona como uma base para campanhas de RPG, ferramentas de criação de cenários ou futuros sistemas de simulação.

## 2. Requisitos

- Python 3.10 ou superior é recomendado.
- Terminal ou prompt de comando.
- Editor de código opcional, como Visual Studio Code.

O programa utiliza módulos da biblioteca padrão, como `argparse`, `json`, `random` e `pathlib`, conforme a implementação. Não é necessário instalar pacotes com `pip`.

## 3. Instalação

Coloque o arquivo `worldforge_rpg.py` em uma pasta de sua preferência.

Exemplo de organização:

```text
WorldForge/
├── index.html
├── styles.css
├── animations.css
├── theme-black.css
├── app.js
├── manifest.webmanifest
├── sw.js
├── assets/
│   └── icon.svg
├── worldforge_rpg.py
├── README.md
└── mundo.json
```

O arquivo `mundo.json` será criado quando você executar o programa com esse nome de saída.

Abra o terminal nessa pasta.

Para usar a interface, abra `index.html` no navegador. Para instalar o PWA e ativar o funcionamento offline, publique os arquivos em um endereço HTTPS, como o GitHub Pages.

### Publicar no GitHub Pages

1. Envie os arquivos do projeto para um repositório GitHub.
2. Nas configurações do repositório, abra **Pages** e selecione a branch e a pasta que contêm `index.html` (normalmente `main` e `/ (root)`).
3. Acesse o endereço publicado. A hospedagem continua sendo estática e os caminhos relativos funcionam tanto em páginas de projeto quanto em domínio próprio; com a configuração atual, login e uso da área de trabalho dependem do Supabase.

Os mundos da interface ficam no armazenamento local do navegador. Use **Configurações → Dados & backup** para exportar um JSON. O botão **Importar** aceita os arquivos gerados pela interface e pelo programa Python.

No Windows, navegadores Chromium podem instalar o site como aplicativo pelo menu de instalação. Os widgets configuráveis ficam no painel inicial do WorldForge. Widgets nativos da tela de Widgets do Windows exigem integração e empacotamento próprios do Windows e não fazem parte de um site estático do GitHub Pages.

Para verificar a instalação do Python:

```bash
python --version
```

No Windows, se o comando acima não funcionar, tente:

```bash
py --version
```

## 4. Como executar

### Geração básica

```bash
python worldforge_rpg.py
```

Essa execução utiliza os valores padrão definidos pelo programa e gera o arquivo de saída padrão.

### Geração personalizada

```bash
python worldforge_rpg.py --seed 2026 --reinos 3 --cidades 2 --npcs 3 --missoes 5 --saida mundo.json
```

Esse exemplo solicita:

- 3 reinos;
- 2 cidades por reino;
- 3 NPCs por cidade;
- 5 missões;
- seed `2026`;
- arquivo de saída `mundo.json`.

Se a geração seguir esses parâmetros, o mundo terá 6 cidades e 18 NPCs.

### Simular vários turnos

```bash
python worldforge_rpg.py --seed 2026 --reinos 3 --cidades 2 --npcs 3 --missoes 5 --eventos 4 --avancar-turnos 8 --saida campanha.json
```

Esse comando solicita quatro eventos iniciais e o avanço de oito turnos antes da exportação.

### Usar a interface web

Abra `index.html` no navegador para explorar a interface. Para testar o modo instalável e o cache offline localmente, sirva a pasta por HTTP:

```bash
python -m http.server 8000
```

Depois acesse `http://localhost:8000`. A tela inicial apresenta o WorldForge e oferece login, criação de conta ou continuação como visitante; para abrir a área de trabalho e usar os recursos, entre em uma conta configurada no Supabase. Selecione **Novo mundo** para gerar um universo e navegue pelas seções da barra lateral para abrir reinos, cidades, personagens, missões, eventos e criaturas. Avance os turnos pelos controles no cabeçalho da seção **Eventos**.

Em **Configurações**, escolha o tema escuro ou claro, os widgets exibidos, ajuste sons/notificações, renomeie o mundo e gerencie a biblioteca local. A preferência visual e os vários mundos são salvos por navegador e dispositivo. O seletor de mundo na barra lateral abre a biblioteca; nela, você pode alternar, duplicar, exportar ou excluir mundos. Na seção **Relações**, crie vínculos entre dois personagens, classifique o tipo e defina a intensidade de 1 a 5. Um mesmo par só pode ter uma relação, e relações de personagens excluídos são removidas automaticamente. Em cada seção do mundo, use **Adicionar** para criar registros; clique em um registro para abrir detalhes, editar ou excluir. Na seção **Eventos**, a linha do tempo reúne eventos e anotações organizados por turno. Os campos de busca e filtros ajudam a localizar registros. Em **Configurações → Dados & backup**, use **Backup completo** para baixar a biblioteca inteira; ao restaurar, confirme a substituição ou escolha mesclar os mundos. A importação de um mundo individual continua adicionando uma cópia sem substituir os mundos existentes. Se uma versão anterior já tiver salvo um mundo no navegador, ele será migrado automaticamente para a biblioteca na primeira abertura. Para abrir o histórico discreto de atualizações, clique no número da versão no rodapé.

Ao criar um mundo, a tela de forja mostra o progresso por um período aleatório entre 12 e 23 segundos. O app toca um breve sinal sonoro e mostra avisos temporários em vermelho; o navegador solicita permissão para enviar também notificações do sistema. Se a permissão for recusada, os avisos continuam visíveis no painel.

### Biblioteca de Mundos

**Biblioteca de Mundos** está disponível na navegação com três cenários para explorar: um mundo completo e dois modelos personalizáveis. Pesquise e filtre por gênero e tipo, consulte os detalhes e escolha **Usar este mundo** para salvar uma cópia independente. O uso da biblioteca requer uma sessão autenticada; a cópia é criada na conta Supabase e também adicionada à biblioteca local. O catálogo e as cópias podem ser controlados pelo flag público `worldLibraryEnabled` em `cloud-config.js`; o acesso à tabela remota continua protegido por RLS.

Os argumentos opcionais devem corresponder aos aceitos pela versão instalada. Use `--help` para consultar as opções efetivamente disponíveis.

## 5. Parâmetros disponíveis

| Parâmetro | Descrição |
|---|---|
| `--help` | Mostra a ajuda do programa. |
| `--seed` | Define a seed utilizada na geração. |
| `--reinos` | Define a quantidade de reinos. |
| `--cidades` | Define quantas cidades serão geradas por reino. |
| `--npcs` | Define quantos NPCs serão gerados por cidade. |
| `--missoes` | Define a quantidade de missões. |
| `--saida` | Define o caminho do arquivo JSON de saída. |
| `--eventos` | Define a quantidade inicial de eventos, se disponível na versão instalada. |
| `--avancar-turnos` | Define quantos turnos serão simulados antes da exportação, se disponível. |
| `--testar` | Executa os testes automatizados, se implementado na versão instalada. |

Para ver os argumentos suportados pela sua cópia:

```bash
python worldforge_rpg.py --help
```

**Importante:** os valores padrão, limites aceitos e opções disponíveis podem mudar entre versões. A ajuda gerada pelo próprio arquivo é a referência definitiva.

## 6. Sistemas do mundo

### 6.1 Reinos e cidades

Os reinos formam a estrutura territorial do mundo. As cidades pertencem a reinos específicos e podem servir como locais de origem de NPCs, missões e eventos.

A integridade dessas associações é importante: uma cidade não deve apontar para um reino inexistente.

### 6.2 NPCs

NPC significa *Non-Player Character*, ou personagem não jogável.

Os NPCs são entidades do mundo que podem participar de relações sociais, missões e acontecimentos. Cada personagem deve possuir um identificador único para permitir referências consistentes no JSON.

### 6.3 Monstros e missões

Os monstros representam criaturas que podem ser utilizadas em aventuras. As missões fornecem objetivos para o jogador ou para uma campanha.

Uma missão pode referenciar personagens, locais ou criaturas, dependendo de seu tipo. Toda referência deve apontar para uma entidade válida.

### 6.4 Relações entre NPCs

O sistema de relações representa conexões sociais entre personagens. Os tipos possíveis dependem das categorias definidas no código, podendo incluir:

- Amizade;
- Rivalidade;
- Parentesco;
- Mentoria;
- Dívida;
- Desconfiança.

As relações podem possuir intensidade, por exemplo, de 1 a 5, conforme a implementação.

As principais regras de integridade são:

- Os dois NPCs envolvidos precisam existir.
- Um personagem não pode se relacionar consigo mesmo.
- Um mesmo par não deve ser duplicado quando a regra do sistema o proíbe.
- Os valores de intensidade devem respeitar os limites definidos.

Esse sistema oferece uma base para intrigas políticas, alianças, conflitos pessoais e histórias emergentes.

### 6.5 Eventos dinâmicos

Os eventos representam acontecimentos que afetam o mundo ao longo do tempo.

As categorias possíveis podem incluir eventos políticos, comerciais, mágicos, ambientais, sociais e criminais, conforme o código.

Um evento pode possuir:

- Identificador;
- Tipo;
- Descrição;
- Turno de início;
- Duração;
- Estado atual;
- Referências opcionais a reino, cidade ou NPC.

Ao avançar os turnos, o programa pode atualizar os estados dos eventos e gerar novos acontecimentos, de acordo com as regras implementadas.

O estado de um evento precisa ser coerente com seu período de duração. Por exemplo, um evento encerrado não deve continuar sendo tratado como ativo.

O sistema é uma simulação procedural: não representa automaticamente uma simulação política ou econômica completa, a menos que essas regras tenham sido implementadas explicitamente.

## 7. Exportação JSON

O WorldForge RPG exporta os dados do mundo para JSON, um formato de texto estruturado amplamente utilizado para intercâmbio de dados.

Exemplo simplificado de estrutura:

```json
{
  "reinos": [],
  "cidades": [],
  "npcs": [],
  "monstros": [],
  "missoes": [],
  "relacoes": [],
  "eventos": [],
  "turno_atual": 0
}
```

Este exemplo é apenas ilustrativo. Os nomes reais das propriedades e a estrutura exata dependem da implementação presente no arquivo Python.

### Por que usar JSON?

- É legível por pessoas.
- Pode ser processado por Python, JavaScript e outras linguagens.
- Facilita a integração com interfaces gráficas e ferramentas de RPG.
- Permite inspecionar manualmente os dados gerados.
- Pode servir como base para um sistema futuro de salvamento e carregamento.

### Abrir o arquivo

Após gerar `mundo.json`, abra-o com o VS Code ou outro editor de texto.

Para verificar se o JSON é sintaticamente válido, execute:

```bash
python -m json.tool mundo.json
```

Se o arquivo for válido, o comando exibirá o conteúdo formatado. Caso haja um erro de sintaxe, o Python indicará onde ocorreu o problema.

A validação sintática do JSON não garante, por si só, que as referências entre NPCs, cidades e reinos estejam corretas. Para isso, utilize também os validadores do projeto.

## 8. Testes automatizados

Os testes ajudam a encontrar defeitos antes que novas funcionalidades sejam adicionadas.

Os testes de segurança JavaScript usam apenas módulos nativos do Node.js e não adicionam dependências ao site:

```bash
node --test tests/*.test.cjs
```

Eles cobrem compatibilidade com mundos antigos, validação dos três cenários oficiais, filtros/estados da Biblioteca, preservação da intenção de cópia durante login, validação comunitária, permissões RLS esperadas e cache/rede do service worker. O gerador Python também tem verificações rápidas:

Se a versão instalada implementar a opção `--testar`, execute:

```bash
python worldforge_rpg.py --testar
```

A suíte deve ser utilizada para verificar os comportamentos que estiverem efetivamente cobertos pelo código.

### Testes recomendados

**Geração e contagens**
- Conferir se o número de entidades corresponde aos parâmetros.
- Garantir que os identificadores sejam únicos.

**Integridade referencial**
- Confirmar que cidades apontam para reinos existentes.
- Confirmar que NPCs apontam para cidades válidas.
- Verificar as referências de missões, relações e eventos.

**Relações**
- Rejeitar autorrelações.
- Detectar pares duplicados indevidos.
- Validar a intensidade das relações.

**Eventos**
- Conferir a progressão dos turnos.
- Verificar o encerramento de eventos vencidos.
- Validar as referências opcionais aos locais e personagens.

**Reprodutibilidade**
- Gerar dois mundos com os mesmos parâmetros e seed.
- Comparar os dados relevantes.
- Desconsiderar metadados variáveis, como horário de geração, quando apropriado.

**Exportação**
- Gerar o JSON.
- Abrir o arquivo novamente.
- Verificar a validade sintática e a integridade dos dados.

**Casos extremos**
- Mundos com poucas entidades.
- Zero missões, quando permitido.
- Zero eventos, quando permitido.
- Parâmetros inválidos.
- Caminhos de saída inválidos ou sem permissão de escrita.

Não considere um teste aprovado apenas porque o programa terminou sem erro. O teste deve conferir explicitamente o comportamento esperado.

## 9. Reprodutibilidade

A seed controla a sequência pseudoaleatória usada na geração.

Por exemplo:

```bash
python worldforge_rpg.py --seed 1234 --saida mundo_a.json
python worldforge_rpg.py --seed 1234 --saida mundo_b.json
```

Com os mesmos parâmetros e a mesma implementação, os dados gerados devem ser reproduzíveis, desde que todas as operações aleatórias utilizem o gerador controlado pela seed.

O conteúdo dos arquivos pode diferir em campos como horário de geração. Para comparar os mundos corretamente, compare os dados do jogo e ignore metadados que mudam entre execuções.

Uma seed não garante resultados idênticos entre versões que alterem a ordem das operações aleatórias ou as regras de geração.

## 10. Solução de problemas

### O comando `python` não funciona

No Windows, tente:

```bash
py worldforge_rpg.py --help
```

Verifique se o Python está instalado e disponível no PATH.

### O programa informa que um argumento é desconhecido

Consulte a ajuda:

```bash
python worldforge_rpg.py --help
```

O argumento pode não existir na versão que você está executando.

### O JSON não é gerado

Verifique:

- Se o comando terminou sem erro;
- Se o caminho de saída está correto;
- Se você possui permissão para escrever na pasta;
- Se os parâmetros fornecidos são válidos.

### O teste automatizado falha

Leia a mensagem de erro completa e identifique qual teste falhou. Não ignore falhas para continuar desenvolvendo.

Após corrigir o defeito, execute novamente toda a suíte para verificar se a correção não afetou outras funcionalidades.

### O mundo não é idêntico em duas execuções

Confirme que a seed e todos os parâmetros são iguais. Verifique também se o código utiliza o mesmo gerador pseudoaleatório em todas as operações e se os arquivos diferem apenas em metadados variáveis.

## 11. Estrutura e manutenção

O projeto mantém a arquitetura de arquivo único:

```text
WorldForge/
├── worldforge_rpg.py
├── README.md
└── mundo.json
```

Essa estrutura facilita a distribuição e a execução inicial. Entretanto, conforme o projeto cresce, a concentração de todas as regras em um arquivo pode dificultar a manutenção.

Para preservar a confiabilidade, recomenda-se:

1. Manter funções com responsabilidades bem definidas.
2. Centralizar as regras de validação.
3. Evitar duplicar a lógica de geração.
4. Validar os dados antes de exportá-los.
5. Usar seeds explícitas nos testes.
6. Adicionar testes de regressão para cada correção.
7. Documentar alterações que mudem o formato JSON.

A arquitetura de arquivo único não impede a organização interna. Funções separadas, nomes consistentes e testes claros já melhoram bastante a manutenção.

## 12. Próximas melhorias

As seguintes melhorias são possibilidades futuras, não funcionalidades garantidas pela versão atual:

- Salvamento e carregamento de campanhas;
- Eventos com consequências sobre cidades e reinos;
- Relações que influenciam conflitos e missões;
- Missões encadeadas com escolhas e consequências;
- Sistema de combate;
- Magia, habilidades e equipamentos;
- Mapas procedurais e distâncias entre cidades;
- Testes mais granulares e cobertura automatizada;
- Versionamento do formato de salvamento;
- Edição manual das entidades pela interface.
- Integração segura com IA, após existir um serviço de backend para proteger credenciais.
- Créditos e assinaturas, quando houver infraestrutura de contas e pagamentos.

A interface web &eacute; est&aacute;tica e compat&iacute;vel com GitHub Pages. Na configuração atual, o acesso à área de trabalho requer uma conta Supabase; o envio de mundos à nuvem é opcional e iniciado pela pessoa. Contribui&ccedil;&otilde;es opcionais por Pix s&atilde;o transfer&ecirc;ncias feitas no banco, fora do aplicativo. Mundos e prefer&ecirc;ncias permanecem no armazenamento local, e a cópia remota é separada.

---

## 13. Privacidade, segurança e termos da interface web

O WorldForge é estático e compatível com GitHub Pages. É necessário autenticar-se pelo Supabase para acessar a área de trabalho; o envio de mundos para a nuvem continua opcional, enquanto o perfil visual e os mundos permanecem locais neste navegador. Não há analytics, publicidade, IA conectada ou processamento de pagamentos. Backups JSON são legíveis e devem ser protegidos.

Cookie essencial lembra a escolha por até 180 dias; se bloqueado, a preferência pode ficar localmente. Service worker guarda arquivos em cache. Não há cookies opcionais. GitHub Pages pode registrar IPs por segurança; veja a [documentação](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) e a [Declaração de Privacidade](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

Termos, privacidade, cookies e segurança estão nas Configurações. Contato: [GitHub Issues](https://github.com/Vini632/Vini632.github.io/issues); issues podem ser públicas, não envie dados confidenciais. Consulte [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm) e [guia da ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais).

Pix é voluntário e externo, sem processamento ou registro pelo app. Se novos recursos mudarem o tratamento de dados, revise estes avisos antes de ativá-los.

### Recursos comunitários

O Fórum da Forja permite ler tópicos publicamente e, com conta autenticada, publicar, responder, editar, excluir e denunciar conteúdo. A Vitrine mostra apenas resumos compartilhados voluntariamente: nome do mundo, nomes de até 12 reinos e 12 cidades e o resumo/nome público escolhidos. O arquivo completo, personagens, missões, eventos e anotações não são enviados à Vitrine. Guildas são privadas por convite; apenas participantes veem o grupo, a lista de membros e o mural. Convites expiram em sete dias e podem ser usados até 20 vezes. Denúncias são armazenadas no Supabase para triagem manual; ainda não há painel de moderação.

Os recursos comunitários estão disponíveis pelo flag `communityEnabled` em `cloud-config.js`. O esquema está versionado em `supabase/migrations/`; `supabase/schema.sql` permanece como referência completa. As migrations incrementais concedem somente as colunas necessárias aos fluxos públicos e privados; os limites de escrita são aplicados no Postgres, não pelo navegador. Para desenvolvimento local, instale e inicie o Docker Desktop e execute `npm exec -- supabase start`; conecte a extensão Supabase ao endereço local informado pela CLI. Para aplicar migrations futuras a um projeto remoto, autentique a CLI, vincule explicitamente o projeto correto, confira `npm exec -- supabase migration list` e só então execute `npm exec -- supabase db push`. Não compartilhe tokens ou senhas no chat nem os grave no código. Fórum e respostas são públicos para leitura; publicar, denunciar e participar das Guildas requer autenticação. A Vitrine compartilha apenas resumos confirmados: nome do mundo, nomes de até 12 reinos e 12 cidades e o resumo/nome público escolhidos; o arquivo completo, personagens, missões, eventos e anotações não são enviados. Guildas são privadas por convite; apenas participantes veem grupo, membros e mural. Convites expiram em sete dias e podem ser usados até 20 vezes. Não há importação de snapshots comunitários para mundos locais nem compartilhamento de arquivos completos nesta versão.

Quotas atuais por conta: 5 tópicos e 30 respostas por hora; 5 denúncias por hora; 3 publicações na Vitrine por hora; 3 guildas por dia; 10 convites por hora; 10 tentativas de entrada em guildas por dia; 30 mensagens de guilda por hora. As tentativas acima do limite recebem HTTP 429. Isso reduz spam básico, mas não é uma defesa abrangente contra abuso por múltiplas contas ou ataques distribuídos. Denúncias continuam sujeitas à triagem manual, sem painel de moderação.

A migration `20261013002000_community_rate_limits.sql` cria os contadores privados e os triggers de quota. `20261013003000_persist_guild_join_rate_limit.sql` registra também tentativas com convites inválidos sem revelar se um convite existe. Aplique ambas em ordem antes de publicar estes recursos.

### Limites e verificações de segurança

O site não tem servidor próprio. A chave publicável do Supabase pode estar no navegador; ela não concede acesso por si só. A proteção dos registros remotos depende das políticas RLS do banco. Nunca publique uma chave `secret` ou `service_role`. Tokens de sessão ficam no armazenamento do navegador e podem ser lidos por código malicioso que já consiga executar na origem do site; a aplicação estática não consegue torná-los secretos do próprio navegador. Use dispositivos confiáveis, proteja backups e encerre a sessão em dispositivos compartilhados.

Antes de ativar ou alterar a nuvem, verifique que:

- RLS está habilitado e cada operação da tabela `worldforge_worlds` restringe `owner_id` a `auth.uid()`.
- Duas contas de teste não conseguem ler, alterar ou apagar os mundos uma da outra; chamadas não autenticadas não conseguem acessar a tabela.
- As URLs de site e redirecionamento de autenticação no Supabase correspondem ao domínio publicado.
- A política CSP não registra violações inesperadas e os arquivos publicados não contêm chaves administrativas.
- A atualização do service worker funciona em uma instalação PWA e não remove caches pertencentes a outras aplicações no mesmo domínio.

O CSP é definido por uma meta tag porque a hospedagem é estática. `style-src 'unsafe-inline'` permanece necessário para estilos dinâmicos da interface; reduza essa permissão somente após testar banners e elementos dinâmicos em navegadores suportados. Diretivas que só funcionam em cabeçalhos HTTP devem ser configuradas pela plataforma de hospedagem, se ela oferecer esse controle.


## Conta e cópia na nuvem (GitHub Pages)

O site continua estático e usa Supabase Auth para as contas e uma tabela Postgres compartilhada para cópias opcionais; cada linha tem `owner_id`, e Row Level Security com `auth.uid()` restringe operações aos dados da própria conta. Não há um banco físico por usuário. A sessão é validada/restaurada ao abrir o site e renovada com o refresh token quando necessário. A interface envia uma cópia somente quando a pessoa escolhe **Enviar**; a restauração é uma mesclagem manual. Ainda não há sincronização automática, e excluir algo localmente não remove sua cópia remota.

Com a configuração atual, entrar ou criar conta é obrigatório para abrir a área de trabalho. **Continuar sem entrar** leva a uma tela de apresentação; não abre ferramentas nem inicia leitura/escrita na comunidade. Os mundos locais antigos permanecem no navegador, mas só voltam a ser acessíveis depois de uma sessão válida. O perfil visual (nome, foto, banner, cor e preferências) continua local. A landing oferece e-mail/senha, alternância entre login/cadastro e mensagens de erro/confirmação; o Supabase pode exigir confirmação do e-mail antes do primeiro login.

### Ativar o projeto

1. Crie um projeto Supabase sob controle do mantenedor e configure a autenticação por e-mail.
2. Para aplicar o esquema com histórico versionado, autentique a Supabase CLI, vincule o project ref correto, confira o estado com `npm exec -- supabase migration list`. No projeto remoto atual, a base foi instalada fora do histórico da CLI: reconcilie esse baseline antes de usar `npm exec -- supabase db push`, conforme o estado registrado abaixo. Se preferir o SQL Editor, confira primeiro o histórico e execute apenas os SQLs incrementais ainda não aplicados; `supabase/schema.sql` é a referência completa para instalações novas, não deve ser reaplicado cegamente sobre um banco existente.
3. Em Authentication → URL Configuration, defina Site URL como https://vini632.github.io/ e inclua essa mesma URL em Redirect URLs. O cadastro envia o link de confirmação para esse endereço.
4. Copie a Project URL e a publishable key (ou a chave legacy anon) para cloud-config.js. Esses identificadores são públicos em aplicações de navegador. Nunca use secret ou service_role no site.
5. A tela inicial permite criar conta ou entrar com e-mail/senha. A conta é necessária para abrir a área de trabalho; depois, em Configurações → Dados & backup, a pessoa pode enviar mundos locais, mesclar cópias de sua conta ou apagar os mundos remotos.

A conta requer e-mail e senha. Quando a confirmação de e-mail estiver habilitada no Supabase, a pessoa deve confirmar o endereço antes do primeiro login. Os tokens da sessão ficam no armazenamento local do navegador e, portanto, não são protegidos de código malicioso executado na mesma origem. A cópia remota inclui os mundos da biblioteca quando enviada explicitamente.

O projeto está configurado na região us-east-1 (N. Virginia, EUA). A cópia na nuvem já está ativada e os avisos identificam o provedor e a transferência internacional. A chave publicável é esperada no cliente, mas nunca substitui RLS; não desative as políticas. Não inclua no site chaves `secret`/`service_role`, tokens ou senhas.

### Estado atual — 13/10/2026

- Entrada centralizada e área de trabalho autenticada, configurações expansíveis, Biblioteca, Fórum, Vitrine e Guildas estão implementados no site estático. O perfil visual e as preferências continuam locais; enviar/restaurar mundos da nuvem é uma ação manual.
- Corrigida a leitura de `author_id` no mural privado das Guildas. As mensagens continuam restritas aos participantes por RLS; a identificação do autor permite mostrar a ação de exclusão correta.
- Os helpers de participação/propriedade ficam no schema `private`, fora da API pública. A migration `20261013015915_secure_private_guild_helpers.sql` espelha a alteração que já existia no remoto. Os RPCs públicos de criar Guilda, gerar convite e entrar continuam exigindo autenticação e verificações no banco.
- A migration `20261013050124_align_community_permissions_and_limits.sql` foi aplicada ao projeto remoto `urvtkpqpguxthjznmtyu`: concede a coluna necessária, instala os contadores e gatilhos de limites e mantém a entrada com convite usando o helper privado. Nenhum mundo ou conteúdo existente foi removido.
- Limites por conta: 5 tópicos/hora, 30 respostas/hora, 5 denúncias/hora, 3 publicações na Vitrine/hora, 3 Guildas/dia, 10 convites/hora, 30 mensagens/hora e 10 tentativas de entrada/dia. Convites inválidos retornam `false` e consomem tentativas; exceder o limite retorna SQLSTATE `PT429`/HTTP 429. Esses limites não eliminam abuso com várias contas.
- Corrigido o cancelamento da criação de mundos. Adicionar um reino agora também cria uma capital inicial editável, mantendo o mundo válido para exportação e reabertura; falha de armazenamento desfaz ambas as alterações.
- Service Worker: cache `v39`, `app.js?v=37` e `landing.css?v=2`. Mantenha os caminhos de assets alinhados entre `index.html`, `sw.js` e os testes.

#### Banco remoto e histórico de migrations

O histórico remoto consultado contém `20261013015915` e `20261013050124`. A base e os grants anteriores foram instalados fora desse histórico. Os arquivos locais `20261012235534`, `20261013000000`, `20261013001000`, `20261013002000` e `20261013003000` permanecem como histórico de desenvolvimento; o efeito dos dois últimos está incluído na migration de alinhamento aplicada em produção.

Não execute `db push` cegamente neste projeto existente: os arquivos anteriores aparecerão como pendentes, e reaplicá-los pode recriar helpers públicos ou conflitar com os privados. Antes do próximo deploy de banco via CLI, compare o schema completo e reconcilie o baseline com `supabase migration repair`, registrando apenas versões cujo efeito foi confirmado. Para instalações novas, use a sequência completa de migrations **ou** `supabase/schema.sql`; não combine os dois procedimentos no mesmo banco. Alterações futuras devem usar migrations incrementais geradas com `npm exec -- supabase migration new NOME`.

#### Verificações

```bash
node --test tests/*.test.cjs
node --check app.js
python worldforge_rpg.py --testar
```

O teste de regressão cruza as colunas pedidas pelo cliente das Guildas com os grants do schema. Há cobertura para renderização/exclusão de mensagens, escape de conteúdo, cancelamento de geração e criação de capital com rollback quando o navegador não consegue salvar.

`supabase/tests/community-access.sql` foi executado no remoto com três identidades sintéticas, dentro de uma transação descartada. Verificou leitura por membro, bloqueio de leitura/escrita por não participante, exclusão pelo autor/proprietário, bloqueio de acesso anônimo, sexto tópico bloqueado e décima primeira tentativa inválida bloqueada. Não cria contas duráveis nem deixa conteúdo de teste.

Os advisors foram consultados após a migration. A tabela de contadores não tem políticas/grants para o cliente por intenção; os três RPCs de Guilda precisam de `SECURITY DEFINER` e autorização interna. A proteção de senhas vazadas ainda aparece desativada na configuração de Auth. Os avisos informativos de índices devem ser avaliados conforme o volume real de uso.

Publicação: repositório `Vini632/Vini632.github.io`, branch `main`, raiz `/`, em https://vini632.github.io/. Os arquivos publicados são comparados com o workspace antes da atualização, preservando arquivos remotos não relacionados. A aplicação continua compatível com GitHub Pages, sem servidor de aplicação ou etapa de build JavaScript.


### Atualização do cache no Pages

A navegação agora consulta primeiro a rede e usa HTML do cache apenas em falhas de conexão. A instalação recarrega os assets, ativa o worker novo e assume as abas abertas. A página consulta atualizações sem usar o cache HTTP do worker. Os arquivos da Comunidade e Biblioteca receberam novas versões na URL para evitar reaproveitar código anterior. A atualização não recarrega formulários automaticamente nem apaga mundos, perfil ou sessão no localStorage.

### Recuperação de senha e exclusão de conta

Os logs de Auth confirmaram `over_email_send_rate_limit` em pedidos de cadastro: esse limite é compartilhado pelos envios de e-mail do projeto, incluindo confirmação de cadastro e recuperação. Ele pode ocorrer na primeira tentativa de uma pessoa. A interface agora diferencia esse caso de outros HTTP 429 e informa que o limite é do serviço de e-mail. O bloqueio de envio só será resolvido de forma adequada com a configuração de SMTP próprio e seus limites; alterar a mensagem não amplia a quota.

O login inclui **Esqueci a senha**. Em **Configurações → Conta e acesso**, há **Resetar senha** (envia o mesmo link ao e-mail da conta) e **Deletar conta**. Erros de cadastro/login são apresentados em português; o erro de chave duplicada do banco não é exibido diretamente.

O link de recuperação retorna à raiz do site, permitida nas URLs de redirecionamento do Auth. O aplicativo valida os tokens com `/auth/v1/user`, remove-os do endereço e abre o formulário de nova senha com confirmação. A sessão de recuperação fica apenas no armazenamento desta aba por até uma hora e não libera a área de trabalho. Ao concluir, solicita o encerramento global de sessões e pede novo login. Links inválidos/expirados permitem solicitar outro. Links de confirmação de cadastro também são processados e validados.

**Envio de e-mails:** o SMTP é o serviço responsável pela entrega. O mantenedor ainda não confirmou uma configuração própria. O envio padrão do Supabase é limitado aos endereços da equipe e não atende ao público geral. Para liberar a recuperação a todos:

1. Escolha um serviço de envio de e-mails e configure o remetente conforme suas instruções.
2. Configure host, porta, usuário, senha e remetente em [Supabase → Authentication → SMTP](https://supabase.com/dashboard/project/urvtkpqpguxthjznmtyu/auth/smtp). Credenciais ficam nesse painel, nunca no site, GitHub ou chat.
3. Confira Site URL e Redirect URLs com `https://vini632.github.io/`, os limites de envio e o modelo de e-mail de recuperação. O fluxo implementado usa o link padrão `ConfirmationURL`; também aceita `token_hash` e `type=recovery` em modelos personalizados.
4. Valide a entrega, inclusive spam, com uma conta controlada pelo mantenedor. Não foi disparado um e-mail nem alterada a senha de uma conta real nesta implementação.

Referência: [documentação oficial de SMTP do Supabase](https://supabase.com/docs/guides/auth/auth-smtp).

A Edge Function `delete-account` está instalada no Supabase e usa credenciais administrativas apenas no ambiente do servidor. Ela verifica o bearer token com o Auth, confirma a senha atual com o e-mail obtido da sessão, exige a palavra `DELETAR`, encerra as sessões e só então exclui o usuário autenticado. Não aceita um ID de usuário escolhido pelo cliente. O verificador JWT do gateway fica desativado porque a autenticação é feita explicitamente pelo handler; não remova essa verificação interna. O CORS permite o Pages atual e os endereços locais de desenvolvimento.

As chaves estrangeiras remotas foram conferidas: os registros ativos do WorldForge ligados à conta são removidos por `ON DELETE CASCADE`. Isso inclui tópicos e Guildas criados pela pessoa, com suas respostas/murais. O diálogo explica esse alcance. Há uma opção explícita para remover também mundos e perfil deste navegador. Backups baixados, dados de outros dispositivos e retenções técnicas do provedor não são removidos por esse controle. Tokens de acesso já emitidos podem permanecer válidos até expirar; refresh sessions são revogadas, a sessão local é removida e as demais abas são avisadas.

O endpoint remoto foi verificado para preflight permitido, método inválido, ausência de sessão, token inválido e origem não permitida. Nenhuma conta real foi excluída. O frontend continua estático e compatível com GitHub Pages; somente a operação administrativa é executada no Supabase. Cache atual: `v39`, `app.js?v=37`, `account-api.js?v=2` e `landing.css?v=2`.

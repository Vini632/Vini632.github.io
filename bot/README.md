# Central da Forja

Painel estático em uma rota não anunciada na interface principal, compatível com o GitHub Pages. O endereço é compartilhado separadamente com a equipe. O backend é a Edge Function `discord-bridge` e a fila privada no Supabase; o processo Python executa as ações no Discord. O caminho não é um controle de acesso: o painel continua protegido pela autenticação, 2FA e permissões verificadas pelo backend.

## Acesso

1. Entre no WorldForge com senha, Discord ou Google habilitado no Supabase.
2. Se o login não for Discord, use `/vincular` e conecte a conta nas configurações do site.
3. Ative o TOTP em Conta e acesso. Guarde a chave em um local seguro; o WorldForge não emite códigos de recuperação próprios.
4. Abra o endereço do painel compartilhado com a equipe e verifique seu autenticador. Só os membros com permissões reais da staff recebem acesso às ferramentas.

Cada solicitação é vinculada ao usuário, à sessão ativa e ao Discord. A função valida o JWT, exige AAL2 e um fator confirmado, limita solicitações e conserva o histórico por até 14 dias. O bot consulta o membro e os cargos atuais antes de executar cada ação; a interface não concede poderes. Canais privados só aparecem para quem tem acesso a eles. As chaves do Discord e do servidor não aparecem no site.

Operações exigem uma prévia e confirmação. Pedidos expiram após dois minutos sem execução. Uma operação já iniciada não é repetida automaticamente após uma falha; consulte o histórico e o Discord antes de solicitar novamente. Respostas são privadas à conta solicitante.

## Ferramentas

- Estrutura oficial, painéis permanentes e associação de canais existentes.
- Canal de registros, permissões e equipe de tickets; boas-vindas da Loritta preservadas por padrão.
- Cargos, timeout, expulsão, banimento e limpeza limitada às mensagens recentes.
- Publicações oficiais com as imagens enviadas, somente após confirmar o conteúdo real.
- Tickets abertos e encerramento com preservação do histórico privado.
- Histórico das próprias ações.

As operações de montagem/configuração/publicação exigem administrador. Moderação e cargos respeitam as permissões correspondentes e a hierarquia. O bot precisa estar rodando para responder; dados exibidos são obtidos do servidor, sem estatísticas fictícias.

## OAuth

Callback dos provedores: `https://urvtkpqpguxthjznmtyu.supabase.co/auth/v1/callback`.

Redirect permitido no Supabase: `https://vini632.github.io/`. O fluxo retorna à raiz e troca o código PKCE no navegador. Os Client Secrets ficam somente nos provedores do Supabase, nunca neste repositório. Google: cliente OAuth do tipo Web application, origem `https://vini632.github.io`, callback acima. Em modo de teste do Google, cadastre os usuários permitidos; para liberar a todos, ajuste o público de produção e os requisitos apresentados pelo Google.

## Desenvolvimento

`npm ci` e `npm run build:auth` recompilam `auth-bundle.js` com as versões fixadas no lockfile. HTML/CSS/JS prontos são servidos diretamente; o Pages não executa Python.

Referências: [Discord OAuth](https://supabase.com/docs/guides/auth/social-login/auth-discord), [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google), [TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp).

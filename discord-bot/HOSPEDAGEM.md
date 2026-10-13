# Bot online sem depender do seu computador

Consulta de preços: 13/10/2026. O site e o painel continuam no GitHub Pages; só o processo Python precisa da hospedagem.

| Serviço | Custo anunciado | Limites e escolha |
| --- | --- | --- |
| [HostSquare — Python](https://hostsquare.com.br/aplicacoes/bot-python) | **R$ 2,50/mês**, 512 MB; R$ 5/mês, 1 GB | **Escolha do mantenedor: 512 MB; pagamento informado em 13/10/2026.** Acesso ao serviço e implantação ainda pendentes. |
| [Square Cloud Hobby](https://squarecloud.app/pt-br/pricing) | R$ 12,49/mês no mensal; R$ 9,99/mês equivalente no anual | 1 GB no plano, Python e reinício automático. Recomendado dentro do teto de R$ 15. Confirme o valor final no checkout. |
| [Discloud gratuito](https://discloud.com/plans) | Gratuito | 100 MB. Pode servir para começar, mas o consumo deste bot com imagens e Discord precisa ser acompanhado. Reinício automático é restrito a planos superiores segundo a documentação. |
| [Oracle Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) | Recursos elegíveis gratuitos | Exige administrar uma VM, cadastro e disponibilidade de capacidade; pode recuperar instâncias consideradas ociosas. Menos simples para este projeto. |

## HostSquare: opção escolhida em 13/10/2026

O mantenedor escolheu o plano mensal de **512 MB por R$ 2,50**. O preço, o suporte a Python e o reinício automático foram reconferidos na página oficial. Não confundir **HostSquare** com **Square Cloud**: são provedores diferentes.

1. Contrate o plano mensal de 512 MB na [página de Python da HostSquare](https://hostsquare.com.br/aplicacoes/bot-python) e obtenha acesso ao painel. Confirme R$ 2,50 no checkout; não escolha cobrança anual nem adicionais sem revisar o total.
2. Execute `python pack-host.py --host pterodactyl` em `discord-bot`. O pacote privado é `.data/worldforge-pterodactyl.zip`.
3. Envie e extraia esse ZIP na raiz do servidor Pterodactyl. Escolha um runtime **Python 3.12 ou superior**, compatível com as dependências fixadas; arquivo inicial `main.py`.
4. Instale as dependências com `python -m pip install -r requirements.lock`. Configure o comando de início como `python main.py` se o painel permitir um comando completo; quando ele já usa `python` e pede só o arquivo, use `main.py`.
5. Configure os valores de `.env.example` como variáveis privadas do processo; se o painel não exportar essas variáveis para o Python, crie `.env` no gerenciador privado do servidor. Copie os valores diretamente do `.env` local para o painel, sem enviar ao chat, GitHub ou ZIP. Os dois tokens permanecem fora do pacote.
6. Preserve `.data/settings.sqlite3` no disco persistente do servidor. O ZIP contém um snapshot das associações atuais; não substitua um banco hospedado mais recente por um snapshot antigo.
7. Pare a instância local com `stop-bot.ps1` **somente quando a configuração hospedada estiver pronta para iniciar**. Inicie a hospedada, confira conexão e logs, depois verifique o painel `/bot/`. Se a implantação falhar, pare a hospedada antes de voltar a iniciar a local.
8. Acompanhe RAM, reinício automático e persistência após um reinício controlado. Os 512 MB ainda precisam de validação sob uso real; o processo Windows foi observado ativo, mas sua memória em repouso não representa o consumo máximo no Linux.

**Estado:** pagamento confirmado pelo mantenedor em 13/10/2026; pacote preparado sem credenciais. A área financeira abriu a tela de login, deixada para o mantenedor autenticar. Provisionamento do serviço e implantação ainda precisam de verificação no painel. Nenhuma segunda instância foi iniciada.

## Square Cloud: alternativa já preparada

1. Crie sua conta e escolha o plano. A contratação é feita por você.
2. Na pasta `discord-bot`, execute `python pack-host.py --host squarecloud`.
3. Envie `.data/worldforge-squarecloud.zip` ao painel da Square Cloud. A raiz do ZIP já contém `squarecloud.app` e `main.py`.
4. Antes de iniciar, configure as variáveis de `.env.example` como segredos privados na hospedagem. Copie DISCORD_TOKEN e WORLDFORGE_BRIDGE_TOKEN diretamente do seu `.env` local, sem postar no chat ou no GitHub. O pacote não contém essas chaves.
5. Pare o bot local com `stop-bot.ps1`, depois inicie a versão hospedada. Evite duas instâncias simultâneas, pois elas compartilham os mesmos canais e banco.
6. Confira os logs: conexão com Discord e ausência de falhas do painel. Em `https://vini632.github.io/bot/`, use Atualizar para conferir o acesso da sua conta.

O pacote inclui uma cópia consistente do SQLite local para preservar associações de painéis, cargos e atendimento. Esse ZIP é privado e não deve ser publicado no repositório. Se já houver uma instalação na host, não sobrescreva seu SQLite com uma cópia local antiga. Guarde backups e confira a política de persistência do serviço antes de reinstalar.

Na Discloud, use `python pack-host.py --host discloud`. O arquivo de configuração gratuito não solicita reinício automático pago. Se atingir o limite de memória, aumente o plano ou escolha a Square Cloud.

Referências: [Python na Square Cloud](https://squarecloud.app/en/runtimes/python), [configuração Discloud](https://docs.discloud.com/en/configurations/discloud.config).

# Bot online sem depender do seu computador

Consulta de preços: 13/10/2026. O site e o painel continuam no GitHub Pages; só o processo Python precisa da hospedagem.

| Serviço | Custo anunciado | Limites e escolha |
| --- | --- | --- |
| [Square Cloud Hobby](https://squarecloud.app/pt-br/pricing) | R$ 12,49/mês no mensal; R$ 9,99/mês equivalente no anual | 1 GB no plano, Python e reinício automático. Recomendado dentro do teto de R$ 15. Confirme o valor final no checkout. |
| [Discloud gratuito](https://discloud.com/plans) | Gratuito | 100 MB. Pode servir para começar, mas o consumo deste bot com imagens e Discord precisa ser acompanhado. Reinício automático é restrito a planos superiores segundo a documentação. |
| [Oracle Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) | Recursos elegíveis gratuitos | Exige administrar uma VM, cadastro e disponibilidade de capacidade; pode recuperar instâncias consideradas ociosas. Menos simples para este projeto. |

## Square Cloud: pacote pronto

1. Crie sua conta e escolha o plano. A contratação é feita por você.
2. Na pasta `discord-bot`, execute `python pack-host.py --host squarecloud`.
3. Envie `.data/worldforge-squarecloud.zip` ao painel da Square Cloud. A raiz do ZIP já contém `squarecloud.app` e `main.py`.
4. Antes de iniciar, configure as variáveis de `.env.example` como segredos privados na hospedagem. Copie DISCORD_TOKEN e WORLDFORGE_BRIDGE_TOKEN diretamente do seu `.env` local, sem postar no chat ou no GitHub. O pacote não contém essas chaves.
5. Pare o bot local com `stop-bot.ps1`, depois inicie a versão hospedada. Evite duas instâncias simultâneas, pois elas compartilham os mesmos canais e banco.
6. Confira os logs: conexão com Discord e ausência de falhas do painel. Em `https://vini632.github.io/bot/`, use Atualizar para conferir o acesso da sua conta.

O pacote inclui uma cópia consistente do SQLite local para preservar associações de painéis, cargos e atendimento. Esse ZIP é privado e não deve ser publicado no repositório. Se já houver uma instalação na host, não sobrescreva seu SQLite com uma cópia local antiga. Guarde backups e confira a política de persistência do serviço antes de reinstalar.

Na Discloud, use `python pack-host.py --host discloud`. O arquivo de configuração gratuito não solicita reinício automático pago. Se atingir o limite de memória, aumente o plano ou escolha a Square Cloud.

Referências: [Python na Square Cloud](https://squarecloud.app/en/runtimes/python), [configuração Discloud](https://docs.discloud.com/en/configurations/discloud.config).

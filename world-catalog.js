(function (root) {
  'use strict';

  const makeWorld = ({ name, seed, realms, cities, npcs = [], monsters = [], missions = [], relations = [], events = [], extras = {} }) => ({
    metadata: {
      nome: name,
      versao_gerador: '1.2.0',
      seed,
      gerado_em_utc: '2026-10-12T00:00:00.000Z'
    },
    estado_mundo: { turno: 1 },
    reinos: realms,
    cidades: cities,
    npcs,
    monstros: monsters,
    missoes: missions,
    relacoes: relations,
    eventos: events,
    notas_campanha: [],
    ...extras
  });

  const worlds = [
    {
      id: 'cinzas',
      slug: 'o-reino-das-cinzas',
      name: 'O Reino das Cinzas',
      description: 'Dois reinos disputam as brasas de um império destruído, enquanto uma antiga forja volta a despertar.',
      longDescription: 'Há vinte e três anos, uma chuva de fogo encerrou a dinastia de Arvend. Agora, a Coroa de Brasa tenta reunificar as terras, enquanto a Liga do Vidro protege as cidades livres e os segredos da antiga forja. Cinza ainda cai sobre os campos no início do inverno — e alguns juram que ela sussurra nomes.',
      cover: 'ashes',
      genre: 'Fantasia medieval',
      type: 'complete',
      development: 'Mundo completo',
      content: ['2 reinos', '4 cidades', '4 personagens', '2 criaturas', '2 missões', '2 eventos'],
      customization: ['Expanda os reinos e suas fronteiras', 'Crie alianças, facções e personagens', 'Avance os turnos para desenvolver os eventos'],
      world: makeWorld({
        name: 'O Reino das Cinzas',
        seed: 20261012,
        realms: [
          {
            id: 'reino-coroa-brasa',
            nome: 'Coroa de Brasa',
            governo: 'monarquia em disputa',
            bioma: 'planícies vulcânicas e campos de cinza',
            cultura: 'juramentos de fogo e memória dos ancestrais',
            recurso: 'ferro-negro e vidro vulcânico',
            conflito: 'a regente precisa provar que a antiga forja não destruiu o império',
            capital_id: 'cidade-forjafunda',
            cidade_ids: ['cidade-forjafunda', 'cidade-cinzeiro']
          },
          {
            id: 'reino-liga-vidro',
            nome: 'Liga do Vidro',
            governo: 'conselho de cidades livres',
            bioma: 'serras de obsidiana e vales enevoados',
            cultura: 'cartografia, comércio e pactos entre ofícios',
            recurso: 'cristais de memória',
            conflito: 'as cidades discutem se devem revelar a localização da forja perdida',
            capital_id: 'cidade-velavitra',
            cidade_ids: ['cidade-velavitra', 'cidade-porta-fria']
          }
        ],
        cities: [
          {
            id: 'cidade-forjafunda', nome: 'Forjafunda', reino_id: 'reino-coroa-brasa',
            tipo: 'capital-fortaleza', populacao: 28000,
            descricao: 'Erguida ao redor de uma fornalha apagada, cuja chaminé ainda exala calor.',
            npc_ids: ['npc-maela', 'npc-darian']
          },
          {
            id: 'cidade-cinzeiro', nome: 'Cinzeiro', reino_id: 'reino-coroa-brasa',
            tipo: 'vila de fronteira', populacao: 4300,
            descricao: 'Uma comunidade de carvoeiros que encontra metal antigo sob a terra.',
            npc_ids: ['npc-iona']
          },
          {
            id: 'cidade-velavitra', nome: 'Velavitra', reino_id: 'reino-liga-vidro',
            tipo: 'capital mercantil', populacao: 36000,
            descricao: 'Pontes de vidro colorido ligam mercados construídos sobre um cânion.',
            npc_ids: ['npc-soren']
          },
          {
            id: 'cidade-porta-fria', nome: 'Porta Fria', reino_id: 'reino-liga-vidro',
            tipo: 'posto de montanha', populacao: 6100,
            descricao: 'Último abrigo antes das serras onde os mapas da Liga deixam de ser confiáveis.',
            npc_ids: []
          }
        ],
        npcs: [
          {
            id: 'npc-maela', nome: 'Maela Vorn', idade: 34, papel: 'regente da Coroa',
            traco: 'ouve antes de julgar', cidade_id: 'cidade-forjafunda', reino_id: 'reino-coroa-brasa',
            objetivo_pessoal: 'descobrir quem sabotou a forja antes da queda da dinastia'
          },
          {
            id: 'npc-darian', nome: 'Darian Ferroluz', idade: 51, papel: 'mestre ferreiro',
            traco: 'protetor de aprendizes', cidade_id: 'cidade-forjafunda', reino_id: 'reino-coroa-brasa',
            objetivo_pessoal: 'impedir que a forja seja reativada sem compreender seu custo'
          },
          {
            id: 'npc-iona', nome: 'Iona Cinzabranca', idade: 27, papel: 'batedora',
            traco: 'curiosa e imprudente', cidade_id: 'cidade-cinzeiro', reino_id: 'reino-coroa-brasa',
            objetivo_pessoal: 'mapear as galerias que surgiram após o último tremor'
          },
          {
            id: 'npc-soren', nome: 'Soren Vale', idade: 42, papel: 'cartógrafo da Liga',
            traco: 'metódico e evasivo', cidade_id: 'cidade-velavitra', reino_id: 'reino-liga-vidro',
            objetivo_pessoal: 'proteger um mapa que contradiz a história oficial'
          }
        ],
        monsters: [
          { id: 'monstro-braseiro', nome: 'Braseiro Errante', nivel: 3, habitat: 'túneis vulcânicos', perigo: 'alto' },
          { id: 'monstro-corvo', nome: 'Corvo de Obsidiana', nivel: 2, habitat: 'serras de vidro', perigo: 'moderado' }
        ],
        missions: [
          {
            id: 'missao-forja', titulo: 'O pulso sob Forjafunda',
            objetivo: 'Investigar os tremores e encontrar a origem do calor na fornalha selada.',
            cidade_origem_id: 'cidade-forjafunda', reino_id: 'reino-coroa-brasa',
            ameaca: 'Braseiro Errante', nivel_recomendado: 3,
            recompensa: 'acesso aos arquivos da antiga dinastia', estado: 'disponível'
          },
          {
            id: 'missao-mapa', titulo: 'O mapa que não deveria existir',
            objetivo: 'Escoltar Soren até Porta Fria e confirmar a passagem marcada no mapa.',
            cidade_origem_id: 'cidade-velavitra', reino_id: 'reino-liga-vidro',
            ameaca: 'Corvo de Obsidiana', nivel_recomendado: 2,
            recompensa: 'um cristal de memória e salvo-conduto da Liga', estado: 'disponível'
          }
        ],
        relations: [
          {
            id: 'relacao-maela-darian', npc_a_id: 'npc-maela', npc_b_id: 'npc-darian',
            tipo: 'confiança cautelosa', descricao: 'Darian ensinou Maela a reconhecer metal adulterado.',
            intensidade: 4
          },
          {
            id: 'relacao-iona-soren', npc_a_id: 'npc-iona', npc_b_id: 'npc-soren',
            tipo: 'segredo compartilhado', descricao: 'Iona encontrou uma página do mapa de Soren nas galerias.',
            intensidade: 2
          }
        ],
        events: [
          {
            id: 'evento-tremor', tipo: 'mistério', titulo: 'Um pulso atravessa a cinza',
            descricao: 'Um tremor aquece os poços de Forjafunda e faz a chaminé cantar.',
            impacto: 'A população teme um novo desastre; Darian reconhece o ritmo da forja.',
            cidade_id: 'cidade-forjafunda', reino_id: 'reino-coroa-brasa',
            npc_envolvido_id: 'npc-darian', turno_inicio: 1, duracao_turnos: 4, turno_fim: 5, estado: 'ativo'
          },
          {
            id: 'evento-conselho', tipo: 'político', titulo: 'O conselho fecha as pontes',
            descricao: 'A Liga suspende o tráfego noturno até que o mapa de Soren seja explicado.',
            impacto: 'Comércio parado pressiona as cidades a escolher um lado.',
            cidade_id: 'cidade-velavitra', reino_id: 'reino-liga-vidro',
            npc_envolvido_id: 'npc-soren', turno_inicio: 1, duracao_turnos: 3, turno_fim: 4, estado: 'ativo'
          }
        ],
        extras: {
          geografia: ['Campos de cinza', 'Serras de obsidiana', 'Cânions de vidro'],
          faccoes: [
            { nome: 'Guarda da Brasa', objetivo: 'proteger os assentamentos da Coroa' },
            { nome: 'Cartógrafos da Liga', objetivo: 'preservar mapas e rotas comerciais' }
          ],
          cronica: ['A queda da dinastia de Arvend', 'A fundação da Liga do Vidro', 'Os tremores sob Forjafunda'],
          magia: 'A magia deixa resíduos minerais e pode ser armazenada em cristais; seu uso cobra lembranças recentes.'
        }
      })
    },
    {
      id: 'terras-desconhecidas',
      slug: 'as-terras-desconhecidas',
      name: 'As Terras Desconhecidas',
      description: 'Um continente recém-cartografado: linhas de costa, rotas e lugares de partida para inventar.',
      longDescription: 'Os mapas da expedição real terminam num litoral que ninguém reivindica. Duas regiões foram nomeadas pelos primeiros navegadores, mas seus interiores continuam sem fronteiras, cidades ou histórias oficiais. Use este modelo como uma tela inicial para criar povos, reinos, rotas e conflitos próprios.',
      cover: 'frontier',
      genre: 'Exploração e aventura',
      type: 'template',
      development: 'Modelo personalizável',
      content: ['2 regiões iniciais', '2 pontos de partida', 'geografia aberta', 'espaços para culturas e facções'],
      customization: ['Desenhe a costa e o interior do continente', 'Crie povos, reinos, cidades e personagens', 'Defina perigos, recursos e rotas de exploração'],
      world: makeWorld({
        name: 'As Terras Desconhecidas',
        seed: 20261013,
        realms: [
          {
            id: 'regiao-litoral', nome: 'Litoral das Primeiras Velas',
            governo: 'sem governo definido', bioma: 'costas temperadas e estuários',
            cultura: 'em formação; relatos de navegadores divergem',
            recurso: 'madeira de construção e água doce',
            conflito: 'expedições rivais disputam locais seguros para desembarque',
            capital_id: 'cidade-ancoradouro', cidade_ids: ['cidade-ancoradouro']
          },
          {
            id: 'regiao-altas-terras', nome: 'Altas Terras do Horizonte',
            governo: 'território não mapeado', bioma: 'colinas, campos e serras distantes',
            cultura: 'desconhecida para os cartógrafos da expedição',
            recurso: 'a determinar pelos exploradores',
            conflito: 'as rotas desaparecem antes de alcançar as montanhas',
            capital_id: 'cidade-marco-norte', cidade_ids: ['cidade-marco-norte']
          }
        ],
        cities: [
          {
            id: 'cidade-ancoradouro', nome: 'Ancoradouro', reino_id: 'regiao-litoral',
            tipo: 'acampamento costeiro', populacao: 340,
            descricao: 'Abrigo provisório junto a um rio navegável; sua expansão depende das escolhas do grupo.',
            npc_ids: []
          },
          {
            id: 'cidade-marco-norte', nome: 'Marco do Norte', reino_id: 'regiao-altas-terras',
            tipo: 'posto de observação', populacao: 28,
            descricao: 'Uma torre de madeira que marca o limite das cartas conhecidas.',
            npc_ids: []
          }
        ],
        extras: {
          geografia: ['Costa ainda sem escala', 'Rio navegável a explorar', 'Serras no horizonte'],
          culturas: [],
          faccoes: [],
          cronica: ['A primeira expedição chegou ao continente'],
          campos_personalizaveis: ['Povos e culturas', 'Fronteiras', 'Recursos', 'Lendas locais']
        }
      })
    },
    {
      id: 'floresta-esquecida',
      slug: 'a-floresta-esquecida',
      name: 'A Floresta Esquecida',
      description: 'Uma mata antiga apaga trilhas e memórias; três clareiras guardam pistas para construir o mistério.',
      longDescription: 'A Floresta de Nhal começa onde os marcos de pedra deixam de ter inscrições. Quem atravessa seus limites encontra caminhos diferentes na volta — e às vezes esquece por que entrou. O modelo oferece locais, rumores e perguntas em aberto, sem impor uma resposta para o segredo da mata.',
      cover: 'forest',
      genre: 'Fantasia sombria e mistério',
      type: 'template',
      development: 'Modelo personalizável',
      content: ['2 territórios iniciais', '2 clareiras habitáveis', 'mistério central em aberto', 'pistas para expansão'],
      customization: ['Decida o que a floresta esquece e por quê', 'Crie comunidades, criaturas e personagens', 'Escolha se o mistério é mágico, histórico ou natural'],
      world: makeWorld({
        name: 'A Floresta Esquecida',
        seed: 20261014,
        realms: [
          {
            id: 'territorio-borda', nome: 'Borda de Nhal',
            governo: 'aldeias independentes', bioma: 'bosque úmido e charneca',
            cultura: 'marcas de giz nas portas e nomes nunca repetidos à noite',
            recurso: 'ervas medicinais e madeira escura',
            conflito: 'as trilhas seguras mudam depois de cada lua nova',
            capital_id: 'cidade-clareira', cidade_ids: ['cidade-clareira']
          },
          {
            id: 'territorio-copa', nome: 'Sob a Copa Antiga',
            governo: 'não determinado', bioma: 'floresta fechada e pântanos de névoa',
            cultura: 'desconhecida; sinais aparecem em árvores recém-caídas',
            recurso: 'a determinar após a primeira travessia',
            conflito: 'uma canção distante parece responder aos viajantes',
            capital_id: 'cidade-marco-musgo', cidade_ids: ['cidade-marco-musgo']
          }
        ],
        cities: [
          {
            id: 'cidade-clareira', nome: 'Clareira do Sino',
            reino_id: 'territorio-borda', tipo: 'aldeia na borda da mata',
            populacao: 760, descricao: 'Uma aldeia construída ao redor de um sino que ninguém admite ter tocado.',
            npc_ids: []
          },
          {
            id: 'cidade-marco-musgo', nome: 'Marco de Musgo',
            reino_id: 'territorio-copa', tipo: 'acampamento abandonado',
            populacao: 0, descricao: 'Um círculo de tendas vazias com registros de expedições que ainda não aconteceram.',
            npc_ids: []
          }
        ],
        extras: {
          geografia: ['Charneca da Borda', 'Clareira do Sino', 'Pântano de Névoa', 'Copa Antiga'],
          pistas: [
            { titulo: 'O mapa reverso', detalhe: 'A trilha desenhada no verso de um mapa leva ao ponto de partida.' },
            { titulo: 'O sino rachado', detalhe: 'A rachadura parece nova, mas a ferrugem tem décadas.' }
          ],
          cronica: ['As inscrições dos marcos desapareceram sem deixar lascas'],
          perguntas_abertas: ['O que a floresta apaga?', 'Quem mantém o Marco de Musgo?', 'O sino chama alguém ou avisa a aldeia?']
        }
      })
    }
  ];

  // Compact authored records are expanded into the same editable world format
  // used by generated worlds. IDs are scoped to the scenario and linked here.
  function scenario(spec) {
    const id = (kind, index) => `${spec.id}-${kind}-${index + 1}`;
    const realms = spec.realms.map(([nome, governo, bioma, cultura, recurso, conflito], i) => ({
      id:id('reino',i), nome, governo, bioma, cultura, recurso, conflito,
      capital_id:id('cidade',spec.cities.findIndex(city => city[0] === i)),
      cidade_ids:spec.cities.flatMap((city,j) => city[0] === i ? [id('cidade',j)] : [])
    }));
    const cities = spec.cities.map(([realm,nome,tipo,populacao,descricao],i) => ({
      id:id('cidade',i), nome,tipo,populacao,descricao,reino_id:id('reino',realm),
      npc_ids:spec.npcs.flatMap((npc,j) => npc[0] === i ? [id('npc',j)] : [])
    }));
    const npcs = spec.npcs.map(([city,nome,idade,papel,traco,objetivo_pessoal],i) => ({
      id:id('npc',i),nome,idade,papel,traco,objetivo_pessoal,cidade_id:id('cidade',city),reino_id:cities[city].reino_id
    }));
    const monsters = spec.monsters.map(([nome,nivel,habitat,perigo],i) => ({id:id('criatura',i),nome,nivel,habitat,perigo}));
    const missions = spec.missions.map(([city,monster,titulo,objetivo,recompensa],i) => ({
      id:id('missao',i),titulo,objetivo,recompensa,cidade_origem_id:id('cidade',city),reino_id:cities[city].reino_id,
      ameaca:monsters[monster].nome,nivel_recomendado:monsters[monster].nivel,estado:'disponível'
    }));
    const relations = spec.relations.map(([a,b,tipo,intensidade,descricao],i) => ({
      id:id('relacao',i),npc_a_id:id('npc',a),npc_b_id:id('npc',b),tipo,intensidade,descricao
    }));
    const events = spec.events.map(([city,npc,tipo,titulo,descricao,impacto,duration],i) => ({
      id:id('evento',i),cidade_id:id('cidade',city),reino_id:cities[city].reino_id,npc_envolvido_id:npc === null ? null : id('npc',npc),
      tipo,titulo,descricao,impacto,turno_inicio:1,duracao_turnos:duration,turno_fim:1+duration,estado:'ativo'
    }));
    return {
      id:spec.id,slug:spec.slug,name:spec.name,description:spec.description,longDescription:spec.longDescription,
      genre:spec.genre,cover:spec.cover,type:spec.type,development:spec.type === 'complete' ? 'Mundo completo' : 'Ponto de partida',
      content:[`${realms.length} ${spec.type === 'complete' ? 'reinos' : realms.length === 1 ? 'território inicial' : 'territórios iniciais'}`,`${cities.length} lugares`,`${npcs.length} personagens`,`${monsters.length} ${monsters.length === 1 ? 'criatura' : 'criaturas'}`,`${missions.length} ${missions.length === 1 ? 'missão' : 'missões'}`,`${events.length} ${events.length === 1 ? 'evento' : 'eventos'}`],
      customization:spec.customization,
      world:makeWorld({name:spec.name,seed:spec.seed,realms,cities,npcs,monsters,missions,relations,events,extras:spec.extras})
    };
  }

  worlds.push(...[
    {
      id:'mares-lua',slug:'os-mares-da-lua-partida',name:'Os Mares da Lua Partida',seed:20261015,
      genre:'Fantasia marítima',cover:'tides',type:'complete',
      description:'Ilhas rivais, faróis de coral e uma maré impossível: a lua quebrada ameaça engolir as rotas do arquipélago.',
      longDescription:'Há dez anos, um fragmento lunar caiu no Mar de Nácar. Desde então, duas marés diferentes percorrem as ilhas. A República das Velas vive do comércio; o Pacto do Coral mantém faróis que acalmam as águas. Agora um desses faróis apagou, e cada governo acusa o outro. A verdade: o conselho mercantil desviou a pérola reguladora para alimentar um navio capaz de navegar contra a maré. A campanha começa com sobreviventes chegando a Porto Nácar e termina com a escolha entre devolver a pérola, compartilhar a tecnologia ou aceitar um novo equilíbrio das ilhas.',
      customization:['Escolha quem controla a pérola ao fim da campanha','Desenhe ilhas além das rotas conhecidas','Crie a tripulação e os vínculos do grupo com os dois governos'],
      realms:[
        ['República das Velas','conselho de capitães eleitos','ilhas de basalto e enseadas profundas','contratos cantados diante de testemunhas','sal, velame e transporte marítimo','uma frota experimental consome a energia dos faróis do Coral'],
        ['Pacto do Coral','assembleia de guardiões dos faróis','atóis vivos e bancos de areia móveis','ninguém se torna guardião sem resgatar um desconhecido','pérolas reguladoras e remédios de algas','os guardiões discutem fechar as rotas para obrigar a República a negociar']
      ],
      cities:[
        [0,'Porto Nácar','capital portuária',24000,'Estaleiros sobre palafitas; o livro de cargas do cais sete registra a pérola como simples lastro.'],
        [0,'Enseada do Remendo','porto de salvamento',3200,'Cascos naufragados viram casas. Sobreviventes guardam um sino que tocou debaixo da água.'],
        [1,'Vigília Azul','capital dos faroleiros',8900,'Um farol de coral acolhe feridos das duas nações; seu viveiro contém uma pérola jovem, ainda instável.'],
        [1,'Baixa-Mar','aldeia de mergulhadores',1100,'Ruínas lunares aparecem por uma hora em cada maré dupla. Cordas com nós indicam o caminho seguro de volta.']
      ],
      npcs:[
        [0,'Capitã Lira Salvento',38,'comandante da escuna Aurora','divide o último suprimento com a tripulação','levar os sobreviventes a Vigília sem entregar seu navio ao conselho'],
        [0,'Conselheiro Oren Tal',56,'financiador da frota experimental','fala em benefícios coletivos, mas evita registrar promessas','manter a pérola no navio enquanto tenta produzir uma substituta'],
        [1,'Nilo dos Naufrágios',22,'salvador e testemunha','coleciona objetos com nomes dos donos','encontrar a irmã que mergulhou atrás do sino lunar'],
        [2,'Guardiã Sena Marfim',47,'responsável pelos faróis','não aceita acordos sem prazo de reparação','recuperar a pérola sem punir marinheiros inocentes'],
        [2,'Doutora Yara Fioazul',31,'pesquisadora de marés','anota também os resultados que a contradizem','provar que a pérola jovem pode estabilizar duas rotas se cultivada em conjunto'],
        [3,'Beto Três-Nós',64,'guia de mergulho','reconta o mesmo caso mudando um detalhe','resgatar a aprendiz desaparecida e fechar a câmara que atrai monstros']
      ],
      monsters:[
        ['Raia de Vidro Lunar',2,'canais transparentes após a maré dupla','moderado'],
        ['Caranguejo de Sino',3,'câmara lunar e cascos afundados','alto'],
        ['Leviatã de Maré Dupla',5,'estreito entre os dois governos','extremo']
      ],
      missions:[
        [1,0,'A última carga da Aurora','Escoltar os sobreviventes até Vigília Azul. Lira oferece passagem; as raias seguem luz forte, permitindo desviar o enxame com lanternas ou atravessar ao amanhecer. O sino resgatado contém a marca do estaleiro de Oren.','passagem gratuita, confiança de Sena e acesso ao livro de cargas'],
        [0,1,'Lastro que não pesa','Investigar o cais sete e recuperar a pérola. Compare recibos com o casco experimental; negociar com Oren exige uma garantia de substituição. Invasão direta acelera o bloqueio do porto.','pérola reguladora ou contrato de pesquisa compartilhada'],
        [3,1,'Uma hora sob a lua','Descer com Beto à câmara de Baixa-Mar, resgatar a aprendiz e copiar as inscrições. O caranguejo protege o sino: reproduzir sua sequência de três toques permite passagem sem combate. A saída submerge ao final da hora.','diagrama de cultivo das pérolas e um sino de comunicação subaquática'],
        [2,2,'Duas marés, uma travessia','Reunir as duas delegações no estreito. Instalar a pérola original restaura a rota antiga; cultivar a jovem com o diagrama abre duas rotas, mas exige ceder os segredos dos faróis. O leviatã pode ser atraído para longe pelo sino.','salvo-conduto das ilhas e escolha do novo acordo marítimo']
      ],
      relations:[
        [0,3,'dívida de resgate',4,'Sena salvou a tripulação de Lira; ambas se recusam a obedecer ordens que sacrifiquem civis.'],
        [1,4,'patrocínio rompido',3,'Oren pagou a pesquisa de Yara e ocultou os relatórios sobre a queda dos faróis.'],
        [2,5,'confiança familiar',4,'Beto ensinou Nilo e sua irmã a mergulhar, mas esconde que autorizou a expedição ao sino.'],
        [3,4,'debate técnico',2,'Sena teme perder os faróis; Yara quer tornar seu cultivo acessível a todas as ilhas.']
      ],
      events:[
        [1,2,'resgate','O mar devolve uma escuna','A Aurora chega com sobreviventes e um sino coberto de coral fresco.','Sem ajuda, feridos pioram e uma testemunha parte com outro capitão.',2],
        [0,1,'político','Cais sob guarda','O conselho restringe o cais sete durante a partida do navio experimental.','Ao terminar o prazo, o navio leva a pérola ao estreito; pistas continuam no livro de cargas.',3],
        [2,3,'ambiental','Os faróis piscam juntos','Todos os faróis repetem o ritmo do sino lunar.','Ao fim do evento, o Pacto fecha a rota e a negociação exige também mantimentos para as ilhas.',5]
      ],
      extras:{
        geografia:['Mar de Nácar, com duas correntes sobrepostas','Estreito do Espelho, ponto de encontro dos governos','Ruínas lunares de Baixa-Mar'],
        magia:'Coral vivo armazena luz lunar. Pérolas reguladoras precisam ser cultivadas, nunca extraídas à força; o cultivo compartilhado reduz sua instabilidade.',
        faccoes:[{nome:'Capitães da Aurora',objetivo:'manter transporte e resgate mesmo durante o bloqueio'},{nome:'Conselho das Velas',objetivo:'controlar navegação contra a maré'},{nome:'Guardiões do Coral',objetivo:'preservar os faróis e responsabilizar quem os apagou'}],
        cronica:['Ano 0: o fragmento da lua cai no mar','Ano 7: o primeiro cultivo de pérolas estabiliza as rotas','Ano 10: Oren desvia a pérola e o farol se apaga'],
        pistas:[{titulo:'A marca no sino',detalhe:'Liga o objeto ao estaleiro; o recibo do cais confirma a carga.'},{titulo:'A irmã desaparecida',detalhe:'Está viva na câmara, sustentando a porta com uma corda; sabe o ritmo que acalma o guardião.'},{titulo:'Depois do acordo',detalhe:'Devolver a pérola preserva o Pacto; cultivo compartilhado divide poder. Reter a pérola mantém o bloqueio e torna o conselho dependente da escolta do grupo.'}]
      }
    },
    {
      id:'inverno-mecanico',slug:'o-inverno-das-engrenagens',name:'O Inverno das Engrenagens',seed:20261016,
      genre:'Fantasia industrial',cover:'clockwork',type:'complete',
      description:'Uma rede de aquecimento decide quem merece sobreviver ao inverno, enquanto oficinas e refugiados disputam suas chaves.',
      longDescription:'Na Bacia de Vésper, cidades sobrevivem graças a uma máquina térmica enterrada na montanha. A Diretoria de Latão administra seus registros; as Comunas da Neve mantêm bombas e túneis. Uma atualização alterou o protocolo: bairros sem escritura perderam calor. A engenheira responsável deixou provas de que a máquina aceita um cadastro comunitário, mas a Diretoria teme perder as tarifas que financiam sua guarda. O grupo pode recuperar o protocolo, impedir uma ruptura e negociar a gestão da rede. Nenhuma solução dispensa manutenção e combustível.',
      customization:['Defina a gestão da rede depois do inverno','Acrescente bairros e ofícios com interesses conflitantes','Escolha se o grupo é uma equipe de manutenção, uma caravana ou uma delegação comunitária'],
      realms:[
        ['Diretoria de Latão','diretoria de concessionários','vale industrial entre montanhas geladas','horários públicos e registros de trabalho','cobre, carvão e máquinas térmicas','a cobrança por escrituras exclui trabalhadores dos bairros antigos'],
        ['Comunas da Neve','federação de assembleias de bairro','encostas nevadas e túneis de vapor','mutirões de reparo e refeições coletivas','bombas hidráulicas e sementes de estufa','sem combustível suficiente, as comunas precisam negociar com quem corta seu calor']
      ],
      cities:[
        [0,'Vésper','capital industrial',48000,'A torre de tarifas exibe bairros aquecidos em verde. Um registro antigo comprova que as válvulas pertenciam à cidade.'],
        [0,'Ponte dos Rebites','entreposto ferroviário',7200,'Um trem de carvão está preso sob gelo; passageiros abrigam famílias sem documentos.'],
        [1,'Lume Baixo','capital comunitária',12500,'Oficinas e cozinhas dividem o último vapor. O cadastro de moradores é mantido em placas de metal.'],
        [1,'Estufa Sete','assentamento agrícola',2100,'Verduras crescem sobre dutos; uma válvula bloqueada põe em risco a safra que alimentaria todo o vale.']
      ],
      npcs:[
        [0,'Diretora Alba Cobre',49,'administradora da rede','conhece cada dívida pelo nome','financiar a guarda sem admitir que o protocolo exclui moradores legítimos'],
        [0,'Téo Linha',29,'arquivista de concessões','marca contradições com fitas vermelhas','encontrar a escritura original antes que os arquivos sejam transferidos'],
        [1,'Rute Carrilho',41,'condutora do trem de carvão','cumpre horários mesmo sem relógio','entregar combustível sem abandonar os refugiados nos vagões'],
        [2,'Engenheira Mina Vale',36,'autora do protocolo térmico','prefere demonstrar a argumentar','instalar o cadastro comunitário e assumir publicamente seu erro inicial'],
        [2,'Juno da Cozinha',58,'porta-voz dos mutirões','escuta as crianças antes das assembleias','garantir calor básico sem tornar as oficinas dependentes de Alba'],
        [3,'Silas Broto',25,'cultivador de estufa','mede perdas em refeições','salvar sementes e reparar o duto antes da próxima geada']
      ],
      monsters:[
        ['Sentinela de Geada',2,'ferrovia e passagens com registros inválidos','moderado'],
        ['Enxame de Ferrugem',3,'dutos úmidos e válvulas antigas','alto'],
        ['Regulador Desperto',5,'coração térmico de Vésper','extremo']
      ],
      missions:[
        [1,0,'O trem que aquece o vale','Liberar o trem de Rute. Sentinelas aceitam um comprovante coletivo de passageiros, que Téo pode assinar. Quebrar o bloqueio também funciona, mas danifica trilhos e exige reparos antes da próxima carga.','carvão para duas jornadas e apoio da ferrovia'],
        [0,0,'A escritura sob a torre','Encontrar a escritura original antes da transferência dos arquivos. Téo oferece o inventário; Alba pode autorizar acesso em troca de uma proposta viável de financiamento. O documento prova propriedade comunitária das válvulas.','direito de convocar uma audiência pública sobre a rede'],
        [3,1,'Não deixar a estufa morrer','Abrir o duto da Estufa Sete e preservar as sementes. O enxame segue óleo quente, permitindo removê-lo sem destruir as bombas. Silas empresta sua última reserva de óleo, reduzindo o tempo disponível para a safra.','sementes resistentes ao frio e abastecimento da cozinha de Juno'],
        [2,2,'Uma máquina, muitos nomes','Conduzir Mina ao coração térmico com o cadastro e carvão. Desligar o Regulador por uma jornada permite a atualização; mantê-lo ligado exige negociar suas prioridades enquanto as oficinas sustentam a pressão. Escolha quem audita o novo cadastro.','calor básico para o vale e assento na primeira assembleia da rede']
      ],
      relations:[
        [0,3,'responsabilidade dividida',5,'Alba encomendou o protocolo; Mina documentou o risco, mas aceitou instalá-lo antes da revisão.'],
        [1,4,'aliança cívica',3,'Juno entrega a Téo cópias dos registros comunitários que contradizem as cobranças.'],
        [2,5,'troca de mantimentos',4,'Rute traz carvão para a estufa e Silas alimenta passageiros retidos na ponte.'],
        [3,4,'confiança em reconstrução',3,'Juno abriga Mina, mas exige que a engenheira explique seu erro às famílias afetadas.']
      ],
      events:[
        [2,4,'social','A cozinha perde vapor','O sistema suspende o calor do bairro por falta de escritura.','Ao fim de duas jornadas, moradores se abrigam em Vésper; a crise chega à torre de tarifas.',2],
        [3,5,'ambiental','Vidros cobertos de gelo','A válvula da estufa reduz sua vazão a cada noite.','Se não for reparada, perde-se a safra; sementes salvas permitem replantio com ajuda das outras cidades.',3],
        [0,0,'político','Auditoria anunciada','Alba anuncia uma reunião para ratificar o protocolo.','Documentos ou depoimentos podem transformar a reunião numa revisão pública; sem intervenção, a exclusão se amplia.',5]
      ],
      extras:{
        geografia:['Bacia de Vésper, isolada por neve','Ferrovia dos Rebites, única rota de carvão','Coração térmico sob a montanha'],
        magia:'Runas de pressão animam máquinas, mas precisam de energia física. O Regulador interpreta cadastros literalmente e pode negociar critérios claros.',
        faccoes:[{nome:'Diretoria de Latão',objetivo:'manter a rede e seu monopólio tarifário'},{nome:'Mutirões de Lume',objetivo:'garantir calor e gestão auditável'},{nome:'Ferroviários dos Rebites',objetivo:'transportar combustível e passageiros em segurança'}],
        cronica:['Há 40 anos: oficinas constroem as primeiras válvulas','Há 12 anos: a Diretoria recebe a concessão de manutenção','Há 3 dias: o protocolo passa a exigir escrituras individuais'],
        pistas:[{titulo:'O registro vermelho',detalhe:'A exclusão começou na atualização, não numa falha de combustível; Mina conserva uma cópia das instruções.'},{titulo:'Combustível e autonomia',detalhe:'Calor universal exige carvão e equipes. Taxa progressiva, rodízio de manutenção ou fundo comunitário são propostas viáveis a discutir com Alba.'},{titulo:'Após a geada',detalhe:'Uma gestão compartilhada abre a campanha para sabotagens e auditorias. Preservar o monopólio alivia a crise imediata, mas deixa as comunas exigindo fiscalização.'}]
      }
    },
    {
      id:'jardins-estrela',slug:'os-jardins-da-estrela-caida',name:'Os Jardins da Estrela Caída',seed:20261017,
      genre:'Fantasia de desertos',cover:'starlight',type:'complete',
      description:'Oásis suspensos e arquivos de areia guardam uma estrela que alimenta os jardins e esgota os poços do deserto.',
      longDescription:'As cidades de Sefira dividem água por um pacto gravado em cerâmica. Há uma geração, uma estrela caiu sob os Jardins Altos e fez florescer terraços impossíveis. Agora poços secam nas caravanas, e a União das Dunas exige revisar o pacto. A estrela é um ser adormecido: seus sonhos puxam água para reproduzir o jardim de sua origem. Ela pode acordar e partir, ser convencida a sonhar outro lugar ou permanecer sob contenção. A campanha liga resgate, arqueologia e diplomacia; a resposta altera quem terá água e quem cuidará da estrela.',
      customization:['Decida o futuro da estrela e dos jardins','Expanda as rotas de caravana e seus acordos de água','Crie vínculos entre os personagens e os poços ameaçados'],
      realms:[
        ['Jardins Altos de Sefira','regência de casas de irrigação','terraços de pedra sobre um deserto quente','sementes oferecidas como compromisso público','frutas, fibras e água canalizada','a prosperidade dos jardins está drenando poços fora das muralhas'],
        ['União das Dunas','conselho itinerante de caravanas','dunas salgadas, oásis e cânions','todo viajante recebe a primeira taça de água sem cobrança','rotas, cerâmica e sal medicinal','as caravanas querem reparar o pacto sem destruir a agricultura de Sefira']
      ],
      cities:[
        [0,'Sefira','capital de terraços',31000,'Jardins pendem sobre a praça do pacto. O canal central pulsa quando a estrela sonha.'],
        [0,'Arquivo de Areia','cidade de escribas',4200,'Tabuletas de cerâmica registram a divisão dos poços; uma cópia revela a cláusula de emergência esquecida.'],
        [1,'Poço das Sete Cordas','capital itinerante',1800,'Caravanas montam seu conselho ao redor de um poço dividido por sete roldanas; duas já não alcançam água.'],
        [1,'Passo do Sal','posto de travessia',950,'Um cânion protege viajantes do vento. Raízes luminosas emergiram por baixo do antigo reservatório.']
      ],
      npcs:[
        [0,'Regente Amira Talha',44,'administradora dos terraços','leva sementes nas mangas','salvar a colheita e aceitar uma revisão do pacto sem perder apoio das casas'],
        [0,'Nara da Estrela',19,'cuidadora do santuário','ouve melodias nos canais','dar voz à estrela antes que a tratem como simples recurso'],
        [1,'Escriba Davi Ocre',63,'guardião das tabuletas','repete a fonte de cada afirmação','tornar pública a cláusula de emergência que sua casa ocultou'],
        [2,'Sael Sete-Cordas',35,'negociador das caravanas','nunca bebe antes dos visitantes','garantir água aos poços e impedir que a revolta feche as rotas'],
        [2,'Mestre Iri dos Vasos',52,'artesão e engenheiro de cisternas','testa ideias em modelos pequenos','construir uma rede de cisternas para dividir as perdas da transição'],
        [3,'Luma do Passo',28,'guia de cânions','narra o vento como se fosse um velho amigo','resgatar a caravana presa sob as raízes luminosas']
      ],
      monsters:[
        ['Escorpião de Sal',2,'cânions e reservatórios secos','moderado'],
        ['Guardião de Raiz Astral',4,'canais subterrâneos de Sefira','alto'],
        ['Miragem Faminta',3,'rotas entre o arquivo e os oásis','alto']
      ],
      missions:[
        [3,0,'A primeira taça','Resgatar a caravana presa no reservatório com Luma. Água derramada distrai escorpiões; escorar as raízes abre uma saída. Os viajantes viram o fluxo do poço se inverter quando uma melodia soou nos canais.','mapa dos reservatórios e testemunhas para o conselho'],
        [1,2,'A cláusula que secou','Levar Davi e a cópia do pacto ao Poço das Sete Cordas. A miragem imita água e desaparece diante de reflexos em cerâmica seca. A cláusula exige repartir escassez, inclusive dentro das muralhas.','legitimidade para convocar a revisão do pacto e acesso aos arquivos'],
        [0,1,'Quem sonha sob o jardim','Entrar com Nara no santuário subterrâneo. O guardião permite passagem a quem planta uma semente e deixa água para ela. Descubra pela canção que a estrela recria sua casa, e ofereça outro sonho: jardins menores junto a cada poço.','comunicação com a estrela e conhecimento para repartir o fluxo'],
        [2,1,'O pacto de amanhã','Reunir Amira, Sael, Nara e Iri. A partida da estrela exige cisternas antes da colheita; um sonho distribuído requer cuidar de vários santuários; contenção preserva os terraços, mas exige cotas fiscalizadas e assentimento da estrela.','um novo pacto, acesso às caravanas e escolha do futuro dos jardins']
      ],
      relations:[
        [0,3,'respeito sob pressão',4,'Amira e Sael administraram juntos a última seca; seus apoiadores agora exigem concessões opostas.'],
        [1,2,'aprendizado',3,'Davi ensinou Nara a ler a canção nas tabuletas anteriores à queda.'],
        [3,5,'confiança de estrada',5,'Luma guiou a caravana de Sael durante uma tempestade e espera seu apoio no resgate.'],
        [0,4,'proposta ignorada',2,'Iri ofereceu cisternas a Amira anos atrás; ela investiu em novos terraços e precisa reconsiderar.']
      ],
      events:[
        [3,5,'resgate','Raízes atravessam o reservatório','Uma caravana fica presa quando o chão se abre em luz.','O vento cobre a entrada em duas jornadas; o resgate passa a exigir escavar outra saída.',2],
        [2,3,'social','A sétima corda fica seca','A água baixa diante dos representantes das caravanas.','Sael precisa receber uma proposta concreta ou as caravanas suspendem o transporte de frutas.',4],
        [0,1,'mágico','A estrela muda sua canção','Os canais repetem um nome desconhecido e as flores se voltam ao céu.','A estrela começa a acordar; adiar a escolha torna os fluxos imprevisíveis e amplia a urgência das cisternas.',6]
      ],
      extras:{
        geografia:['Terraços de Sefira','Cânion do Passo do Sal','Sete poços ligados por canais subterrâneos'],
        magia:'Sonhos celestes orientam a água por raízes luminosas. A estrela entende imagens, músicas e promessas demonstradas; sua energia não cria água nova.',
        faccoes:[{nome:'Casas de Irrigação',objetivo:'preservar as colheitas e sua influência sobre o pacto'},{nome:'Conselho das Caravanas',objetivo:'dividir a escassez e manter rotas abertas'},{nome:'Cuidadores da Estrela',objetivo:'ouvir a vontade da estrela e impedir sua exploração'}],
        cronica:['Há 80 anos: sete caravanas assinam o pacto dos poços','Há 24 anos: a estrela cai e os terraços florescem','Neste verão: raízes desviam o fluxo dos reservatórios'],
        pistas:[{titulo:'O fluxo invertido',detalhe:'Relato dos viajantes e marca das raízes ligam a seca à canção, sem exigir acusar uma das nações.'},{titulo:'A cópia do pacto',detalhe:'Davi admite a omissão da cláusula; quebrar a tabuleta não apaga as cópias guardadas pelas caravanas.'},{titulo:'Depois da decisão',detalhe:'Partida da estrela abre viagens celestes; sonho distribuído cria novos oásis a proteger; contenção produz campanhas de fiscalização, direitos e renegociação.'}]
      }
    },
    {
      id:'porta-amanha',slug:'a-porta-de-amanha',name:'A Porta de Amanhã',seed:20261018,
      genre:'Mistério e viagem temporal',cover:'threshold',type:'template',
      description:'Uma estação fechada entrega cartas datadas de amanhã. A primeira descreve uma pessoa que ainda não chegou.',
      longDescription:'O sino da Estação de Orla toca numa linha abandonada. Toda manhã, uma carta aparece sob a porta lacrada; as previsões são pequenas, até que uma delas anuncia o desaparecimento de alguém do grupo. Este ponto de partida oferece uma vila, a estação, duas testemunhas e uma investigação inicial. A origem das cartas, a confiabilidade das previsões e o custo de mudar o futuro cabem ao mestre e à mesa.',
      customization:['Escolha quem escreve as cartas e de qual tempo','Defina quanto uma previsão pode ser alterada','Relacione o viajante esperado com um personagem do grupo'],
      realms:[['Orla do Trilho','conselho de moradores','colinas e um vale ferroviário','cartas são lidas em voz alta no mercado','ferro antigo e cereais','as previsões começam a influenciar decisões antes de serem verificadas']],
      cities:[[0,'Vila de Orla','vila ferroviária',1300,'O mercado conserva uma caixa de cartas que nunca foram enviadas.'],[0,'Estação do Amanhã','estação abandonada',2,'Uma porta lacrada e relógios em horários diferentes; pegadas aparecem do lado de dentro.']],
      npcs:[[0,'Rosa Postal',46,'carteira da vila','sela até bilhetes pessoais','encontrar o destinatário de uma carta sem nome'],[1,'Eli do Relógio',23,'vigia da estação','registra horários em dois cadernos','descobrir por que seu segundo caderno tem anotações que ainda não fez']],
      monsters:[['Eco de Passageiro',1,'plataformas fora de uso','incerto']],
      missions:[[0,0,'A carta sem destinatário','Comparar a carta com os registros de Rosa e observar a estação antes do próximo sino. Defina quem a carta descreve; ofereça pistas em papel, relógios e depoimentos sem exigir uma única interpretação.','acesso à estação e uma pergunta respondida sobre o próximo dia']],
      relations:[[0,1,'correspondência incompleta',2,'Rosa reconhece a letra de Eli nas cartas, mas ele diz nunca tê-las escrito.']],
      events:[[1,1,'mistério','O sino toca antes da hora','Uma carta aparece enquanto Eli observa a porta lacrada.','A mesa decide qual previsão será investigada primeiro.',3]],
      extras:{geografia:['Linha ferroviária interrompida','Vale de Orla'],pistas:[{titulo:'Tinta ainda fresca',detalhe:'Uma carta traz a marca de uma oficina que pode existir, ter fechado ou ainda não ter sido fundada.'}],perguntas_abertas:['Quem escreve as cartas?','As previsões descrevem um futuro fixo ou uma possibilidade?','Qual é o custo de impedir um acontecimento?','O Eco é passageiro, mensagem ou consequência?'],campos_personalizaveis:['Origem da porta','Regras do tempo','Identidade do viajante','Primeira previsão'],cronica:['A linha fechou; o motivo ainda será definido pela mesa']}
    },
    {
      id:'ilhas-vento',slug:'as-ilhas-que-seguem-o-vento',name:'As Ilhas que Seguem o Vento',seed:20261019,
      genre:'Fantasia celeste e exploração',cover:'sky',type:'template',
      description:'Duas ilhas flutuantes vão se cruzar pela primeira vez em décadas. Uma ponte incompleta espera por quem arrisque o encontro.',
      longDescription:'No céu de Aru, comunidades viajam com suas ilhas. A Vigília do Vento avista uma ilha cujo nome desapareceu dos mapas; a aldeia de Nuvem Baixa prepara uma ponte provisória. Há três noites para decidir como receber os visitantes. O modelo estabelece os dois assentamentos e um problema imediato; o mestre decide o que mantém as ilhas suspensas, quem vem na ilha desconhecida e se o encontro muda as rotas.',
      customization:['Desenhe a rota e a altura das ilhas','Decida a origem da sustentação e seus limites','Crie os visitantes e o que precisam negociar'],
      realms:[['Vigília do Vento','assembleia de navegadores','ilhas de pedra com vegetação rasteira','mapas bordados em velas','fibras e leitura de correntes','um encontro raro divide quem quer contato e quem teme mudar a rota']],
      cities:[[0,'Nuvem Baixa','aldeia suspensa',640,'Casas presas por cabos e jardins protegidos de ventos; uma ponte espera seu último vão.'],[0,'Mirante de Aru','posto de navegação',37,'Velas de observação apontam para uma ilha sem nome; um mapa bordado foi recortado nessa posição.']],
      npcs:[[0,'Ada Corda',33,'construtora de pontes','testa cada nó duas vezes','concluir a ponte sem comprometer os cabos que sustentam a aldeia'],[1,'Tami do Mirante',18,'aprendiz de navegação','reconhece correntes pelo som','entender quem apagou a ilha do mapa']],
      monsters:[['Ave de Turbilhão',2,'correntes entre ilhas','moderado']],
      missions:[[0,0,'O último vão','Levar uma vela de sinal ao Mirante e medir a distância da ilha visitante. As aves seguem correntes quentes; escolha se reagirão a comida, sinais ou intrusos. O resultado determina onde construir a ponte.','um mapa de aproximação e apoio da equipe de Ada']],
      relations:[[0,1,'mentoria',3,'Ada ensinou Tami a prender velas; Tami suspeita que Ada reconhece o recorte do mapa.']],
      events:[[1,1,'exploração','Luzes além da corrente','A ilha desconhecida acende três sinais repetidos.','O significado e a resposta cabem à mesa; o encontro exige uma escolha antes que as rotas se afastem.',3]],
      extras:{geografia:['Corrente Alta de Aru','Vão entre as duas ilhas'],perguntas_abertas:['O que sustenta as ilhas?','Quem recortou o mapa e por quê?','Quem envia os três sinais?','A ponte será comércio, refúgio ou invasão?'],campos_personalizaveis:['Ilha visitante','Sinais','Rotas celestes','Limites dos cabos'],cronica:['O último encontro das ilhas está nos relatos dos mais velhos, que discordam sobre seu resultado']}
    },
    {
      id:'cidade-submersa',slug:'a-cidade-sob-o-lago',name:'A Cidade sob o Lago',seed:20261020,
      genre:'Exploração e mistério aquático',cover:'depths',type:'template',
      description:'O lago recuou e revelou uma escadaria. O sino da cidade submersa toca toda vez que alguém desce um degrau.',
      longDescription:'A vila de Margem Serena vive de pesca num lago sem fundo conhecido. Uma estiagem revela degraus e telhados intactos. Um posto de mergulho surge sobre a cidade antiga, mas seus registros têm o mesmo nome de uma família da vila. Há uma primeira expedição, uma testemunha e um objeto para recuperar; quem afundou a cidade, quem ainda a habita e quanto tempo a água permanecerá baixa ficam em aberto.',
      customization:['Escolha a causa da submersão e quem a conhece','Decida se há habitantes na cidade antiga','Defina as condições da expedição e o retorno da água'],
      realms:[['Bacia Serena','conselho de pescadores','lago profundo e margens de juncos','ofertas de cerâmica antes da pesca','peixes e argila','a estiagem permite explorar ruínas, mas ameaça o sustento da vila']],
      cities:[[0,'Margem Serena','vila de pescadores',980,'O altar da vila tem um sino idêntico ao ouvido nas ruínas.'],[0,'Patamar do Lago','posto de mergulho',16,'Cordas descem até uma praça ainda alagada; portas parecem abertas de dentro para fora.']],
      npcs:[[0,'Ivo Junco',57,'guardião do altar','responde perguntas com histórias incompletas','recuperar uma caixa antes que a vila investigue seu conteúdo'],[1,'Mara Fundo-Claro',26,'líder de expedição','amarra cordas até em água rasa','retornar com todos os mergulhadores e um mapa confiável']],
      monsters:[['Enguia de Bronze',2,'praça e canais inundados','moderado']],
      missions:[[1,0,'A caixa da praça','Mapear a escadaria e localizar a caixa indicada por Ivo. Determine se a enguia guarda o objeto ou apenas sua toca. A mesa escolhe se devolve a caixa fechada, pede explicações ou leva uma testemunha para abri-la.','mapa do primeiro quarteirão e acesso ao relato de Ivo']],
      relations:[[0,1,'contrato desconfiado',2,'Ivo financia Mara, mas não aceita dizer como conhece a planta da cidade.']],
      events:[[0,0,'mistério','Dois sinos respondem','O sino do altar responde ao toque que vem do lago.','Moradores querem acompanhar a próxima descida; escolha quem reconhece a sequência.',4]],
      extras:{geografia:['Margens de juncos','Escadaria exposta','Praça inundada'],pistas:[{titulo:'O nome repetido',detalhe:'Uma placa na praça usa o sobrenome de uma família atual; o vínculo e sua relevância ainda não estão definidos.'}],perguntas_abertas:['Por que a cidade afundou?','O que está na caixa?','Quem toca o sino submerso?','O retorno da água protege alguém ou encobre um crime?'],campos_personalizaveis:['História da submersão','Conteúdo da caixa','Habitantes das ruínas','Prazo da estiagem']}
    },
    {
      id:'estrada-mascaras',slug:'a-estrada-das-mascaras',name:'A Estrada das Máscaras',seed:20261021,
      genre:'Folclore e intriga',cover:'masks',type:'template',
      description:'Um mercado itinerante chegou com máscaras que conhecem seus compradores. Na partida, alguém terá de ocupar uma barraca vazia.',
      longDescription:'Durante a Festa dos Caminhos, o Mercado das Máscaras estaciona entre uma vila e a encruzilhada. A artesã local reconhece uma máscara desaparecida de sua família; o responsável pelo mercado procura um substituto para uma barraca vazia. O modelo oferece negociação, pistas e uma primeira encomenda. A natureza do mercado, os efeitos das máscaras e o valor de um nome devem ser decididos pelo mestre, preservando escolhas claras para os jogadores.',
      customization:['Defina o que cada máscara oferece e exige','Escolha a relação do mercado com a vila','Estabeleça como recusar ou renegociar uma troca'],
      realms:[['Vale dos Caminhos','conselho de artesãos','colinas, pomares e encruzilhadas','rostos cobertos apenas durante a festa anual','cerâmica e tecidos','o retorno do mercado desperta promessas que ninguém admite ter feito']],
      cities:[[0,'Vila da Figueira','vila de artesãos',1500,'Máscaras de festa ficam penduradas nas portas, mas uma família mantém a sua virada para a parede.'],[0,'Mercado da Encruzilhada','acampamento itinerante',87,'Barracas surgem ao anoitecer; uma está vazia e suas contas trazem nomes da vila.']],
      npcs:[[0,'Celina Barro',39,'artesã de máscaras','lembra do rosto de cada cliente','descobrir como a máscara da família apareceu no mercado'],[1,'Senhor dos Fios',71,'organizador do mercado','explica preços, mas evita explicar prazos','encontrar quem aceite a barraca vazia antes da partida']],
      monsters:[['Cão de Retalhos',1,'barracas e marcos da estrada','incerto']],
      missions:[[0,0,'O rosto na vitrine','Acompanhar Celina ao mercado e comparar a máscara com um molde familiar. O cão segue um tecido escondido na peça; use o tecido como pista para outra barraca. Ofereça uma forma de investigar sem aceitar uma compra.','o primeiro termo de um acordo antigo e a confiança de Celina']],
      relations:[[0,1,'promessa herdada',3,'O organizador reconhece Celina pelo nome de sua avó; ela nunca o encontrou antes.']],
      events:[[1,1,'social','Uma barraca procura dono','Uma placa anuncia que o mercado partirá após a festa.','Defina o prazo da festa e o que acontece com a barraca vazia sem forçar um personagem a aceitar o contrato.',4]],
      extras:{geografia:['Pomar da Figueira','Encruzilhada de quatro estradas'],pistas:[{titulo:'O molde antigo',detalhe:'Um detalhe da máscara permite seguir sua autoria; a identidade do artesão e sua intenção permanecem abertas.'}],perguntas_abertas:['O mercado é humano, feérico ou uma tradição encenada?','O que uma máscara pode saber ou transformar?','Qual promessa liga a família à barraca?','Como um contrato pode ser recusado ou encerrado?'],campos_personalizaveis:['Natureza do mercado','Custos explícitos das máscaras','Promessa familiar','Destino da barraca']}
    }
  ].map(scenario));

  root.WORLDFORGE_WORLD_CATALOG = Object.freeze(worlds.map(entry => Object.freeze(entry)));
  if (typeof module === 'object' && module.exports) module.exports = worlds;
})(globalThis);

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

  root.WORLDFORGE_WORLD_CATALOG = Object.freeze(worlds.map(entry => Object.freeze(entry)));
  if (typeof module === 'object' && module.exports) module.exports = worlds;
})(globalThis);

(function (root) {
  'use strict';

  const MAX_COLLECTION_ITEMS = 20000;
  const MAX_TOTAL_ITEMS = 50000;
  const MAX_FIELD_LENGTH = 10000;
  const MAX_ID_LENGTH = 120;
  const MAX_TURN = 1000000000;

  function validateSheet(sheet) {
    if (!sheet || typeof sheet !== 'object' || Array.isArray(sheet) || sheet.version !== 1) throw new Error('Formato de ficha inválido.');
    for (const key of ['sistema','jogador','ancestralidade','classe','origem','alinhamento']) {
      if (typeof sheet[key] !== 'string' || sheet[key].length > 120) throw new Error(`Campo ${key} inválido na ficha.`);
    }
    for (const key of ['aparencia','historia','ideais','vinculos','defeitos','equipamentos','habilidades','magias','anotacoes']) {
      if (typeof sheet[key] !== 'string' || sheet[key].length > 6000) throw new Error(`Campo ${key} inválido na ficha.`);
    }
    for (const key of ['nivel','experiencia','vida_atual','vida_maxima','vida_temporaria','defesa','iniciativa','deslocamento','moedas']) {
      const min = key === 'iniciativa' || key === 'vida_atual' ? -9999 : key === 'nivel' ? 1 : 0;
      if (!Number.isSafeInteger(sheet[key]) || sheet[key] < min || sheet[key] > 999999) throw new Error(`Valor ${key} inválido na ficha.`);
    }
    if (sheet.vida_atual > sheet.vida_maxima) throw new Error('A vida atual não pode ultrapassar a vida máxima. Use vida temporária para bônus.');
    if (!Array.isArray(sheet.atributos) || sheet.atributos.length > 12) throw new Error('Use até 12 atributos na ficha.');
    const names = new Set();
    for (const attribute of sheet.atributos) {
      if (!attribute || typeof attribute.nome !== 'string' || !attribute.nome.trim() || attribute.nome.length > 40
        || names.has(attribute.nome.trim().toLocaleLowerCase('pt-BR')) || !Number.isSafeInteger(attribute.valor)
        || attribute.valor < -999 || attribute.valor > 999) throw new Error('Revise os nomes e valores dos atributos; os nomes devem ser únicos.');
      names.add(attribute.nome.trim().toLocaleLowerCase('pt-BR'));
    }
    return sheet;
  }

  function validateWorld(data) {
    const keys = ['metadata', 'estado_mundo', 'reinos', 'cidades', 'npcs', 'monstros', 'missoes', 'relacoes', 'eventos'];
    if (!data || typeof data !== 'object' || Array.isArray(data) || keys.some(key => !(key in data))) {
      throw new Error('o arquivo não parece ser um mundo WorldForge.');
    }

    for (const key of keys.slice(2)) {
      if (!Array.isArray(data[key])) throw new Error(`A coleção ${key} não é válida.`);
      if (data[key].length > MAX_COLLECTION_ITEMS) throw new Error(`A coleção ${key} excede o limite de registros.`);
    }
    const recordCount = keys.slice(2).reduce((total, key) => total + data[key].length, 0);
    if (recordCount > MAX_TOTAL_ITEMS) throw new Error('O mundo excede o limite total de registros.');

    if (!data.metadata || typeof data.metadata !== 'object' || Array.isArray(data.metadata)
      || typeof data.metadata.nome !== 'string' || !data.metadata.nome.trim()
      || data.metadata.nome.length > 160
      || !data.estado_mundo || typeof data.estado_mundo !== 'object'
      || !Number.isSafeInteger(data.estado_mundo.turno)
      || data.estado_mundo.turno < 1 || data.estado_mundo.turno > MAX_TURN) {
      throw new Error('metadata ou estado do mundo inválido.');
    }
    if (data.metadata.seed !== undefined && data.metadata.seed !== null && !Number.isSafeInteger(data.metadata.seed)) {
      throw new Error('A seed do mundo é inválida.');
    }
    if (data.metadata.versao_gerador !== undefined && typeof data.metadata.versao_gerador !== 'string') {
      throw new Error('A versão do gerador é inválida.');
    }
    if (data.metadata.gerado_em_utc !== undefined && typeof data.metadata.gerado_em_utc !== 'string') {
      throw new Error('A data de geração é inválida.');
    }

    const assertString = (item, field, label, maxLength = MAX_FIELD_LENGTH) => {
      if (typeof item[field] !== 'string' || item[field].length > maxLength) {
        throw new Error(`O campo ${field} em ${label} é inválido.`);
      }
    };
    const assertInteger = (item, field, label, min = 0, max = MAX_TURN) => {
      if (!Number.isSafeInteger(item[field]) || item[field] < min || item[field] > max) {
        throw new Error(`O campo ${field} em ${label} é inválido.`);
      }
    };
    const index = (items, label) => {
      const map = new Map();
      for (const item of items) {
        if (!item || typeof item !== 'object' || Array.isArray(item)
          || typeof item.id !== 'string' || !item.id.trim()
          || item.id.length > MAX_ID_LENGTH || map.has(item.id)) {
          throw new Error(`Registro inválido ou ID duplicado em ${label}.`);
        }
        map.set(item.id, item);
      }
      return map;
    };

    const collections = Object.fromEntries(keys.slice(2).map(key => [key, index(data[key], key)]));
    const realms = collections.reinos;
    const cities = collections.cidades;
    const npcs = collections.npcs;
    const monsters = new Set([...collections.monstros.values()].map(item => item.nome).filter(name => typeof name === 'string'));

    for (const realm of realms.values()) {
      for (const field of ['nome', 'governo', 'bioma', 'cultura', 'recurso', 'conflito']) assertString(realm, field, 'reinos');
      if (!realm.nome.trim() || !Array.isArray(realm.cidade_ids)
        || realm.cidade_ids.length > MAX_COLLECTION_ITEMS
        || realm.cidade_ids.some(id => typeof id !== 'string')
        || new Set(realm.cidade_ids).size !== realm.cidade_ids.length
        || typeof realm.capital_id !== 'string'
        || !cities.has(realm.capital_id)
        || !realm.cidade_ids.includes(realm.capital_id)) {
        throw new Error(`O reino ${realm.id} tem cidades ou capital inválidas.`);
      }
      for (const cityId of realm.cidade_ids) {
        if (cities.get(cityId)?.reino_id !== realm.id) throw new Error(`A cidade ${cityId} não pertence ao reino correto.`);
      }
    }

    const listedCities = new Set([...realms.values()].flatMap(realm => realm.cidade_ids));
    if (listedCities.size !== cities.size || [...cities.keys()].some(id => !listedCities.has(id))) {
      throw new Error('Há cidades sem reino ou listadas mais de uma vez.');
    }

    const listedNpcs = new Set();
    for (const city of cities.values()) {
      for (const field of ['nome', 'reino_id', 'tipo', 'descricao']) assertString(city, field, 'cidades');
      if (!city.nome.trim()) throw new Error(`A cidade ${city.id} não tem nome.`);
      assertInteger(city, 'populacao', 'cidades');
      if (!Array.isArray(city.npc_ids) || city.npc_ids.length > MAX_COLLECTION_ITEMS) {
        throw new Error(`A lista de personagens da cidade ${city.id} é inválida.`);
      }
      for (const npcId of city.npc_ids) {
        if (typeof npcId !== 'string' || npcs.get(npcId)?.cidade_id !== city.id || listedNpcs.has(npcId)) {
          throw new Error(`O personagem ${npcId} não está vinculado corretamente à cidade.`);
        }
        listedNpcs.add(npcId);
      }
    }
    if (listedNpcs.size !== npcs.size) throw new Error('Há personagens sem cidade ou vinculados mais de uma vez.');

    for (const npc of npcs.values()) {
      if (npc.ficha !== undefined) validateSheet(npc.ficha);
      for (const field of ['nome', 'papel', 'traco', 'cidade_id', 'reino_id', 'objetivo_pessoal']) assertString(npc, field, 'npcs');
      if (!npc.nome.trim()) throw new Error(`O personagem ${npc.id} não tem nome.`);
      assertInteger(npc, 'idade', 'npcs');
      if (cities.get(npc.cidade_id)?.reino_id !== npc.reino_id) {
        throw new Error(`O personagem ${npc.id} tem cidade ou reino inválido.`);
      }
    }

    for (const monster of collections.monstros.values()) {
      for (const field of ['nome', 'habitat', 'perigo']) assertString(monster, field, 'monstros');
      if (!monster.nome.trim()) throw new Error(`O monstro ${monster.id} não tem nome.`);
      assertInteger(monster, 'nivel', 'monstros');
    }
    if ([...collections.monstros.values()].some(monster => !monster.nome.trim())) {
      throw new Error('Há um monstro sem nome válido.');
    }

    for (const mission of collections.missoes.values()) {
      for (const field of ['titulo', 'objetivo', 'cidade_origem_id', 'reino_id', 'ameaca', 'recompensa', 'estado']) {
        assertString(mission, field, 'missoes');
      }
      assertInteger(mission, 'nivel_recomendado', 'missoes');
      if (!cities.has(mission.cidade_origem_id)
        || cities.get(mission.cidade_origem_id).reino_id !== mission.reino_id
        || !monsters.has(mission.ameaca)) {
        throw new Error(`A missão ${mission.id} tem referências inválidas.`);
      }
    }

    const pairs = new Set();
    for (const relation of collections.relacoes.values()) {
      for (const field of ['npc_a_id', 'npc_b_id', 'tipo', 'descricao']) assertString(relation, field, 'relacoes');
      const pair = [relation.npc_a_id, relation.npc_b_id].sort().join('|');
      if (!npcs.has(relation.npc_a_id) || !npcs.has(relation.npc_b_id)
        || relation.npc_a_id === relation.npc_b_id || pairs.has(pair)
        || !Number.isSafeInteger(relation.intensidade) || relation.intensidade < 1 || relation.intensidade > 5) {
        throw new Error(`A relação ${relation.id} é inválida.`);
      }
      pairs.add(pair);
    }

    for (const event of collections.eventos.values()) {
      for (const field of ['tipo', 'titulo', 'descricao', 'impacto', 'cidade_id', 'reino_id', 'estado']) {
        assertString(event, field, 'eventos');
      }
      if (!cities.has(event.cidade_id)
        || cities.get(event.cidade_id).reino_id !== event.reino_id
        || (event.npc_envolvido_id != null
          && (typeof event.npc_envolvido_id !== 'string' || !npcs.has(event.npc_envolvido_id)))) {
        throw new Error(`O evento ${event.id} tem local ou personagem inválido.`);
      }
      assertInteger(event, 'turno_inicio', 'eventos', 1);
      assertInteger(event, 'duracao_turnos', 'eventos', 1);
      assertInteger(event, 'turno_fim', 'eventos', 1);
      if (!['ativo', 'encerrado'].includes(event.estado)
        || event.turno_inicio + event.duracao_turnos !== event.turno_fim
        || (event.estado === 'ativo' && data.estado_mundo.turno >= event.turno_fim)
        || (event.estado === 'encerrado' && data.estado_mundo.turno < event.turno_fim)) {
        throw new Error(`O calendário do evento ${event.id} é inválido.`);
      }
    }

    if (data.notas_campanha !== undefined && !Array.isArray(data.notas_campanha)) {
      throw new Error('A coleção notas_campanha não é válida.');
    }
    const notes = data.notas_campanha || [];
    if (notes.length > MAX_COLLECTION_ITEMS || recordCount + notes.length > MAX_TOTAL_ITEMS) {
      throw new Error('A coleção de anotações excede o limite de registros.');
    }
    const noteIds = new Set();
    for (const note of notes) {
      if (!note || typeof note !== 'object' || Array.isArray(note)
        || typeof note.id !== 'string' || !note.id.trim() || note.id.length > MAX_ID_LENGTH
        || noteIds.has(note.id) || typeof note.titulo !== 'string' || note.titulo.length > MAX_FIELD_LENGTH
        || typeof note.texto !== 'string' || note.texto.length > MAX_FIELD_LENGTH
        || !Number.isSafeInteger(note.turno) || note.turno < 1 || note.turno > MAX_TURN) {
        throw new Error('Há uma anotação de campanha inválida.');
      }
      noteIds.add(note.id);
    }

    if (data.notas_campanha === undefined) data.notas_campanha = [];
    return data;
  }

  root.WORLDFORGE_VALIDATE_WORLD = validateWorld;
  root.WORLDFORGE_VALIDATE_SHEET = validateSheet;
  if (typeof module === 'object' && module.exports) module.exports = validateWorld;
})(globalThis);

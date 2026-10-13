const test = require('node:test');
const assert = require('node:assert/strict');
const validation = require('../community-validation.js');

test('validates and normalizes forum posts and replies', () => {
  assert.deepEqual(validation.forumPost({
    category: 'geral', title: '  Ideias para a campanha  ', body: '  Vamos conversar.  ', author_name: '  Exploradora  '
  }), {
    category: 'geral', title: 'Ideias para a campanha', body: 'Vamos conversar.', author_name: 'Exploradora'
  });
  assert.throws(() => validation.forumPost({
    category: 'invalid', title: 'x', body: 'conteúdo', author_name: 'Mestre'
  }), /categoria/);
  assert.throws(() => validation.forumReply({ body: ' ', author_name: 'Mestre' }), /resposta/);
});

test('showcase snapshot contains only the explicitly selected public fields', () => {
  const world = {
    metadata: { nome: '  Arquipélago  ', seed: 123 },
    reinos: Array.from({ length: 14 }, (_, index) => ({ nome: `Reino ${index + 1}` })),
    cidades: [{ nome: 'Porto das Brumas' }],
    npcs: [{ nome: 'Personagem privado' }],
    notas_campanha: [{ texto: 'Segredo do mestre' }]
  };
  const draft = validation.showcaseDraft(world, {
    creator_name: 'Criadora',
    summary: 'Um cenário de ilhas e antigas rotas comerciais.'
  });
  assert.deepEqual(Object.keys(draft).sort(), ['city_names', 'creator_name', 'realm_names', 'summary', 'world_name']);
  assert.equal(draft.realm_names.length, 12);
  assert.equal(draft.city_names[0], 'Porto das Brumas');
  assert.equal(JSON.stringify(draft).includes('Segredo do mestre'), false);
  assert.equal(JSON.stringify(draft).includes('Personagem privado'), false);
  assert.throws(() => validation.showcaseDraft(world, { creator_name: 'Criadora', summary: 'curto' }), /resumo/);
});

test('validates guild fields and one-time invite structure', () => {
  assert.deepEqual(validation.guild({ name: '  Guardiões  ', description: '  Campanha semanal  ' }), {
    name: 'Guardiões', description: 'Campanha semanal'
  });
  assert.throws(() => validation.guild({ name: 'x' }), /nome da guilda/);
  assert.deepEqual(validation.inviteCode('3f6f2f67-b3b6-4e36-93d9-29b26c9f08d2.4f6f2f67-b3b6-4e36-93d9-29b26c9f08d2'), {
    guildId: '3f6f2f67-b3b6-4e36-93d9-29b26c9f08d2',
    token: '4f6f2f67-b3b6-4e36-93d9-29b26c9f08d2'
  });
  assert.throws(() => validation.inviteCode('not-an-invite'), /convite válido/);
});

test('escapes community content before HTML rendering', () => {
  assert.equal(
    validation.escapeHtml(`<img src=x onerror="alert('x')">&`),
    '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;'
  );
});

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const validation = require('../community-validation.js');

const source = fs.readFileSync(path.join(__dirname, '..', 'community.js'), 'utf8');

function createClient({ enabled = true, user = null, world = null, activeWorldId = null, response = [] } = {}) {
  const roots = new Map();
  const requests = [];
  const listeners = new Map();
  const alerts = [];
  let sessionChecks = 0;
  const app = {
    communityEnabled: enabled,
    user,
    displayName: 'Explorador',
    activeWorldId,
    getWorld: () => world,
    ensureSession: async () => { sessionChecks++; },
    cloudFetch: async (path, options = {}) => {
      requests.push({ path, options });
      return typeof response === 'function' ? response(path, options) : response;
    }
  };
  const document = {
    querySelector: selector => {
      if (!selector.startsWith('#community-')) return null;
      const key = selector.slice('#community-'.length);
      if (!roots.has(key)) roots.set(key, { innerHTML: '' });
      return roots.get(key);
    },
    addEventListener: (name, handler) => listeners.set(name, handler)
  };
  class TestFormData {
    constructor(form) { this.entries = Object.entries(form.values || {}); }
    [Symbol.iterator]() { return this.entries[Symbol.iterator](); }
  }
  const window = {
    WORLDFORGE_APP: app,
    WORLDFORGE_COMMUNITY_VALIDATION: validation,
    location: { hash: '' },
    alert: message => alerts.push(message),
    confirm: () => true
  };
  vm.runInNewContext(source, {
    document, window, console, Date, FormData: TestFormData,
    crypto: { randomUUID: () => '4f6f2f67-b3b6-4e36-93d9-29b26c9f08d2' },
    navigator: { clipboard: { writeText: async () => {} } }
  });
  return {
    client: window.WORLDFORGE_COMMUNITY,
    roots, requests, alerts,
    get sessionChecks() { return sessionChecks; },
    click(action, recordId = '') {
      const handler = listeners.get('click');
      handler({
        preventDefault() {},
        target: {
          closest: selector => selector === '[data-community-action]'
            ? { dataset: { communityAction: action, recordId, viewName: '' } }
            : null
        }
      });
    },
    async submit(type, values, extras = {}) {
      const form = {
        dataset: { communityForm: type, ...extras },
        values,
        elements: { confirm_public: { checked: extras.confirmed === true } },
        closest: selector => selector === '[data-community-form]' ? form : null
      };
      await listeners.get('submit')({ preventDefault() {}, target: form });
    }
  };
}

test('community feature flag disables access before any backend request', async () => {
  const { client, roots, requests } = createClient({ enabled: false });
  await client.render('foruns');
  assert.match(roots.get('foruns').innerHTML, /Comunidade indisponível/);
  assert.equal(requests.length, 0);
});

test('anonymous forum rendering requests only public columns', async () => {
  const { client, roots, requests } = createClient();
  await client.render('foruns');
  assert.match(requests[0].path, /select=id,author_name,category,title,body,created_at,updated_at/);
  assert.doesNotMatch(requests[0].path, /author_id/);
  assert.match(roots.get('foruns').innerHTML, /Fórum da Forja/);
});

test('authenticated forum submission uses the session and validates the public author fields', async () => {
  const harness = createClient({ user: { id: 'user-id' } });
  const { client, requests, click, submit } = harness;
  await client.render('foruns');
  click('new-post');
  await submit('new-post', { category: 'geral', title: 'Uma nova campanha', body: 'Vamos construir um cenário juntos.' });
  await new Promise(resolve => setTimeout(resolve, 0));
  const createRequest = requests.find(request => request.path.endsWith('/worldforge_forum_posts') && request.options.method === 'POST');
  assert.ok(createRequest);
  assert.equal(JSON.parse(createRequest.options.body).author_id, 'user-id');
  assert.equal(JSON.parse(createRequest.options.body).author_name, 'Explorador');
  assert.equal(harness.sessionChecks, 1);
});

test('showcase submission sends only a confirmed public snapshot, never the full world', async () => {
  const world = {
    metadata: { nome: 'Arquipélago' },
    reinos: [{ nome: 'Reino da Bruma' }],
    cidades: [{ nome: 'Porto das Nuvens' }],
    npcs: [{ nome: 'Personagem privado' }],
    missoes: [{ nome: 'Plano confidencial' }]
  };
  const harness = createClient({ user: { id: 'user-id' }, world, activeWorldId: 'local-id' });
  await harness.client.render('vitrine');
  await harness.submit('publish-world', {
    creator_name: 'Criadora',
    summary: 'Um cenário de ilhas e antigas rotas comerciais.'
  }, { confirmed: true });
  await new Promise(resolve => setTimeout(resolve, 0));
  const publishRequest = harness.requests.find(request => request.path.endsWith('/worldforge_showcase') && request.options.method === 'POST');
  assert.ok(publishRequest);
  const payload = JSON.parse(publishRequest.options.body);
  assert.equal(payload.owner_id, 'user-id');
  assert.equal(payload.local_world_id, 'local-id');
  assert.deepEqual(Object.keys(payload).sort(), [
    'city_names', 'creator_name', 'local_world_id', 'owner_id',
    'published', 'realm_names', 'summary', 'world_name'
  ]);
  assert.doesNotMatch(JSON.stringify(payload), /Personagem privado|Plano confidencial/);
});

test('guild creation uses the authenticated RPC rather than direct table insertion', async () => {
  const harness = createClient({ user: { id: 'user-id' } });
  await harness.client.render('guilda');
  await harness.submit('create-guild', { name: 'Cartógrafos', description: 'Mapas e campanhas' });
  await new Promise(resolve => setTimeout(resolve, 0));
  const createRequest = harness.requests.find(request => request.path.endsWith('/rpc/worldforge_create_guild'));
  assert.ok(createRequest);
  assert.equal(createRequest.options.method, 'POST');
  assert.deepEqual(JSON.parse(createRequest.options.body), {
    p_name: 'Cartógrafos',
    p_description: 'Mapas e campanhas'
  });
});

test('showcase preview exposes only the approved world snapshot fields', async () => {
  const world = {
    metadata: { nome: 'Arquipélago' },
    reinos: [{ nome: 'Reino da Bruma' }],
    cidades: [{ nome: 'Porto das Nuvens' }],
    npcs: [{ nome: 'Segredo privado' }],
    missoes: [{ nome: 'Plano confidencial' }]
  };
  const { client, roots } = createClient({
    user: { id: 'owner-id' }, world, activeWorldId: 'local-id'
  });
  await client.render('vitrine');
  const html = roots.get('vitrine').innerHTML;
  assert.match(html, /Reino da Bruma/);
  assert.match(html, /Porto das Nuvens/);
  assert.doesNotMatch(html, /Segredo privado|Plano confidencial/);
  assert.match(html, /confirm_public/);
});

test('guild screen requires account and provides private group creation and invitations', async () => {
  const guest = createClient();
  await guest.client.render('guilda');
  assert.match(guest.roots.get('guilda').innerHTML, /Conta necessária/);

  const member = createClient({ user: { id: 'user-id' } });
  await member.client.render('guilda');
  assert.match(member.roots.get('guilda').innerHTML, /Criar guilda/);
  assert.match(member.roots.get('guilda').innerHTML, /Entrar com convite/);
});

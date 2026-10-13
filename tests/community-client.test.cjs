'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const validation = require('../community-validation.js');

const source = fs.readFileSync(path.join(__dirname, '..', 'community.js'), 'utf8');

function createClient({ enabled = true, workspaceAccess = true, user = null, world = null, activeWorldId = null, response = [] } = {}) {
  const roots = new Map();
  const requests = [];
  const listeners = new Map();
  const alerts = [];
  let sessionChecks = 0;
  const app = {
    communityEnabled: enabled,
    hasWorkspaceAccess: workspaceAccess,
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
    roots, requests, alerts, app,
    dispatchSubmit: form => listeners.get('submit')({preventDefault() {},target:form}),
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
        querySelectorAll: () => [],
        closest: selector => selector === '[data-community-form]' ? form : null
      };
      await listeners.get('submit')({ preventDefault() {}, target: form });
    }
  };
}

test('community feature flag shows an in-development card without backend requests', async () => {
  const { client, roots, requests } = createClient({ enabled: false });
  await client.render('foruns');
  assert.match(roots.get('foruns').innerHTML, /EM DESENVOLVIMENTO/);
  assert.match(roots.get('foruns').innerHTML, /Vitrine de Mundos/);
  assert.equal(requests.length, 0);
});

test('listed guild creation shares only selected visibility and requires the same authenticated RPC', async () => {
  const h=createClient({user:{id:'owner-id'}});
  await h.submit('create-guild',{name:'Cartógrafos',description:'Mapas',visibility:'listed'});
  const req=h.requests.find(r=>r.path.endsWith('/rpc/worldforge_create_guild'));
  assert.equal(JSON.parse(req.options.body).p_visibility,'listed');
});

test('directory uses search RPC, escapes metadata and never renders private directory fields', async () => {
  const h=createClient({user:{id:'owner-id'},response:path=>path.includes('/rpc/worldforge_guild_directory')
    ? [{id:'listed-id',name:'<img src=x>',description:'<script>bad</script>',owner_id:'secret-owner',members:['secret-member']}]:[]});
  await h.submit('guild-directory',{search:'  coral  '});
  const req=h.requests.find(r=>r.path.endsWith('/rpc/worldforge_guild_directory'));
  assert.deepEqual(JSON.parse(req.options.body),{p_search:'coral',p_offset:0});
  const html=h.roots.get('guilda').innerHTML;
  assert.match(html,/&lt;img src=x&gt;/);assert.doesNotMatch(html,/secret-owner|secret-member|<script>bad/);
  assert.match(html,/ENTRADA POR CONVITE/);
});

test('only the owner can change visibility and the update must return one affected guild', async () => {
  const h=createClient({user:{id:'owner-id'},response:(path,options)=>{
    if(options.method==='PATCH')return [];
    if(path.includes('/rpc/'))return [];
    return [{id:'guild-id',owner_id:'owner-id',name:'Guilda',description:'',visibility:'private'}];
  }});
  await h.client.render('guilda');
  await h.submit('guild-visibility',{visibility:'listed'},{recordId:'guild-id'});
  assert.match(h.alerts.at(-1),/Não foi possível alterar/);
  h.app.user={id:'member-id'};
  const before=h.requests.length;
  await h.submit('guild-visibility',{visibility:'listed'},{recordId:'guild-id'});
  assert.equal(h.requests.length,before);assert.match(h.alerts.at(-1),/Somente o dono/);
});

test('repeated form submissions while the request is pending create just one guild', async () => {
  let release;const pending=new Promise(resolve=>{release=resolve;});
  const h=createClient({user:{id:'owner-id'},response:path=>path.endsWith('/rpc/worldforge_create_guild')?pending:[]});
  const form={dataset:{communityForm:'create-guild'},values:{name:'Guilda de teste'},querySelectorAll:()=>[],
    closest:selector=>selector==='[data-community-form]'?form:null};
  const first=h.dispatchSubmit(form);const second=h.dispatchSubmit(form);
  await Promise.resolve();release('guild-id');await Promise.all([first,second]);
  assert.equal(h.requests.filter(r=>r.path.endsWith('/rpc/worldforge_create_guild')).length,1);
  assert.equal(form.dataset.submitting,undefined);
});

test('a late guild response cannot populate the screen after an account change', async () => {
  let release;const pending=new Promise(resolve=>{release=resolve;});
  const h=createClient({user:{id:'old-account'},response:()=>pending});
  const render=h.client.render('guilda');await Promise.resolve();h.app.user={id:'new-account'};
  release([{id:'old-private',name:'Private old account',description:'Secret',owner_id:'old-account'}]);await render;
  assert.doesNotMatch(h.roots.get('guilda').innerHTML,/Private old account|Secret/);
});

test('community cannot render data or make requests before workspace authentication', async () => {
  const { client, roots, requests } = createClient({ workspaceAccess: false });
  await client.render('foruns');
  assert.equal(roots.size, 0);
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
    p_description: 'Mapas e campanhas',
    p_visibility: 'private'
  });
});

test('guild join rejects a false RPC result instead of reporting success', async () => {
  const harness = createClient({ user: { id: 'user-id' }, response: false });
  await harness.client.render('guilda');
  await harness.submit('join-guild', {
    invite: '4f6f2f67-b3b6-4e36-93d9-29b26c9f08d2.4f6f2f67-b3b6-4e36-93d9-29b26c9f08d2'
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(harness.alerts.includes('Convite inválido, expirado ou indisponível.'));
  assert.equal(harness.alerts.includes('Convite aceito. Agora você participa desta guilda privada.'), false);
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

test('opening a private guild loads authors and offers deletion only for own messages', async () => {
  const harness = createClient({
    user: { id: 'member-id' },
    response: path => {
      if (path.includes('worldforge_guild_messages?')) return [
        { id: 'own-message', author_id: 'member-id', author_name: 'Me', body: 'Own text' },
        { id: 'other-message', author_id: 'other-id', author_name: 'Other', body: '<script>alert(1)</script>' }
      ];
      if (path.includes('worldforge_guild_members?')) return [{ user_id: 'member-id', role: 'member' }];
      return [{ id: 'guild-id', owner_id: 'owner-id', name: 'Private guild', description: '' }];
    }
  });
  await harness.client.render('guilda');
  harness.click('open-guild', 'guild-id');
  await new Promise(resolve => setTimeout(resolve, 0));
  const request = harness.requests.find(item => item.path.includes('worldforge_guild_messages?'));
  assert.ok(request);
  assert.match(request.path, /select=id,author_id,author_name,body,created_at,updated_at/);
  assert.match(request.path, /guild_id=eq.guild-id/);
  const html = harness.roots.get('guilda').innerHTML;
  assert.match(html, /data-community-action="delete-message" data-record-id="own-message"/);
  assert.doesNotMatch(html, /data-community-action="delete-message" data-record-id="other-message"/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

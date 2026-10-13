'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const catalog = require('../world-catalog.js');
const validateWorld = require('../world-validation.js');

const source = fs.readFileSync(path.join(__dirname, '..', 'world-library.js'), 'utf8');
const cloudConfigSource = fs.readFileSync(path.join(__dirname, '..', 'cloud-config.js'), 'utf8');
const PENDING_KEY = 'worldforge.world-library.pending.v1';

function createLibrary({ createCatalogCopy, enabled = true, pending = null } = {}) {
  const handlers = new Map();
  const stored = new Map();
  if (pending) stored.set(PENDING_KEY, JSON.stringify(pending));
  const target = {
    innerHTML: '',
    querySelectorAll: () => [],
    querySelector: () => null
  };
  const app = {
    user: null,
    createCatalogCopy: createCatalogCopy || (async () => {}),
    hasLocalWorld: () => false
  };
  const window = {
    WORLDFORGE_APP: app,
    WORLDFORGE_WORLD_CATALOG: catalog,
    WORLDFORGE_VALIDATE_WORLD: validateWorld,
    WORLDFORGE_CLOUD_CONFIG: { worldLibraryEnabled: enabled },
    location: { hash: '' }
  };
  const document = {
    querySelector: selector => selector === '#world-library' ? target : null,
    addEventListener: (name, handler) => handlers.set(name, handler)
  };
  const localStorage = {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, String(value)),
    removeItem: key => stored.delete(key)
  };
  vm.runInNewContext(source, { window, document, localStorage });
  return {
    app, target, stored,
    library: window.WORLDFORGE_WORLD_LIBRARY,
    click(action, slug) {
      const handler = handlers.get('click');
      handler({
        preventDefault() {},
        target: { closest: selector => selector === '[data-library-action]' ? { dataset: { libraryAction: action, worldSlug: slug } } : null }
      });
    }
  };
}

test('release config enables the world catalog without enabling community features', () => {
  const window = {};
  vm.runInNewContext(cloudConfigSource, { window });
  assert.equal(window.WORLDFORGE_CLOUD_CONFIG.worldLibraryEnabled, true);
  assert.equal(window.WORLDFORGE_CLOUD_CONFIG.communityEnabled, false);
});

test('catalog page lists the three worlds and filters fields are available', () => {
  const { library, target } = createLibrary();
  library.render('biblioteca-mundos');
  assert.match(target.innerHTML, /O Reino das Cinzas/);
  assert.match(target.innerHTML, /As Terras Desconhecidas/);
  assert.match(target.innerHTML, /A Floresta Esquecida/);
  assert.match(target.innerHTML, /data-library-search/);
  assert.match(target.innerHTML, /data-library-genre/);
  assert.match(target.innerHTML, /data-library-type/);
});

test('disabled catalog is marked coming soon and cancels any pending copy', () => {
  const { library, target, stored } = createLibrary({
    enabled: false,
    pending: { slug: 'o-reino-das-cinzas', localId: 'pending-world' }
  });
  library.render('biblioteca-mundos');
  assert.match(target.innerHTML, /Biblioteca de Mundos/);
  assert.match(target.innerHTML, /EM BREVE/);
  assert.doesNotMatch(target.innerHTML, /Usar este mundo|Pesquisar/);
  assert.equal(stored.has(PENDING_KEY), false);
});

test('details show available content without adding empty sections to templates', () => {
  const { target, click } = createLibrary();
  click('details', 'o-reino-das-cinzas');
  assert.match(target.innerHTML, /Criaturas/);
  assert.match(target.innerHTML, /Eventos iniciais/);
  assert.match(target.innerHTML, /Braseiro Errante/);

  click('details', 'a-floresta-esquecida');
  assert.doesNotMatch(target.innerHTML, /<h3>Personagens<\/h3>/);
  assert.match(target.innerHTML, /Perguntas para desenvolver/);
});

test('login intent survives and creates one authenticated copy after sign-in', async () => {
  const copies = [];
  const { app, library, target, stored, click } = createLibrary({
    createCatalogCopy: async (...args) => { copies.push(args); }
  });
  library.render('biblioteca-mundos');
  click('details', 'o-reino-das-cinzas');
  assert.match(target.innerHTML, /data-library-action="use"/);
  assert.match(target.innerHTML, /Cópia privada na sua conta/);
  click('use', 'o-reino-das-cinzas');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(target.innerHTML, /Sua escolha foi guardada/);
  assert.match(target.innerHTML, /Entrar ou criar conta/);
  click('use', 'o-reino-das-cinzas');
  await new Promise(resolve => setTimeout(resolve, 0));
  const pending = JSON.parse(stored.get(PENDING_KEY));
  assert.equal(pending.slug, 'o-reino-das-cinzas');
  assert.match(target.innerHTML, /Sua escolha foi guardada/);

  app.user = { id: 'authenticated-user' };
  await library.onSessionReady();
  assert.equal(copies.length, 1);
  assert.equal(copies[0][0].slug, pending.slug);
  assert.equal(copies[0][1], pending.localId);
  assert.equal(stored.has(PENDING_KEY), false);
});

test('failed cloud copy keeps the pending intent available for retry', async () => {
  let shouldFail = true;
  const { app, library, target, stored, click } = createLibrary({
    createCatalogCopy: async () => {
      if (shouldFail) throw new Error('Falha de rede');
    }
  });
  library.render('biblioteca-mundos');
  click('details', 'a-floresta-esquecida');
  click('use', 'a-floresta-esquecida');
  await new Promise(resolve => setTimeout(resolve, 0));
  app.user = { id: 'authenticated-user' };
  await library.onSessionReady();
  assert.ok(stored.has(PENDING_KEY));
  assert.match(target.innerHTML, /Falha de rede/);

  shouldFail = false;
  await library.onSessionReady();
  assert.equal(stored.has(PENDING_KEY), false);
});

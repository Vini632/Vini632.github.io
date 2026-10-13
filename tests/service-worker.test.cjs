'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

test('precache includes current app, community, and world-library assets', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const htmlAssets = [...html.matchAll(/(?:src|href)="(\.\/[^"?]+\.(?:js|css)(?:\?v=\d+)?)"/g)].map(match => match[1]);
  for (const asset of htmlAssets) {
    assert.ok(source.includes(`'${asset}'`), `${asset} must be precached with the same version as HTML`);
    assert.ok(fs.existsSync(path.join(__dirname,'..',asset.split('?')[0])), `${asset} must exist`);
  }
  assert.ok(htmlAssets.includes('./character-sheet.js?v=1'));
  assert.ok(htmlAssets.includes('./character-sheet.css?v=1'));
});

function loadWorker(scope, cacheKeys, {fetchResponse, matchResponse} = {}) {
  const handlers = new Map();
  const deleted = [];
  const calls = { fetch: [], put: [], precache: [], claimed: 0, activated: 0 };
  const self = {
    location: { origin: new URL(scope).origin },
    registration: { scope },
    addEventListener: (name, handler) => handlers.set(name, handler),
    skipWaiting: async () => { calls.activated++; },
    clients: { claim: async () => { calls.claimed++; } },
  };
  const caches = {
    open: async () => ({
      addAll: async requests => { calls.precache.push(...requests); },
      put: async (...args) => { calls.put.push(args); },
      match: async request => typeof matchResponse === 'function' ? matchResponse(request) : matchResponse,
    }),
    keys: async () => cacheKeys,
    delete: async key => { deleted.push(key); return true; },
    match: async () => null,
  };
  vm.runInNewContext(source, {
    URL,
    Request,
    caches,
    fetch: async (...args) => {
      calls.fetch.push(args);
      if (typeof fetchResponse === 'function') return fetchResponse(...args);
      return fetchResponse || { ok: true, clone: () => ({}) };
    },
    self,
  });
  return { handlers, deleted, calls };
}

test('activation removes only older caches owned by this app scope', async () => {
  const scope = 'https://example.test/worldforge/';
  const prefix = `worldforge-static:${encodeURIComponent('/worldforge/')}:`;
  const keys = [
    `${prefix}v23`,
    'another-app-cache',
    `worldforge-static:${encodeURIComponent('/other-app/')}:v23`,
    'worldforge-static-v23',
  ];
  const worker = loadWorker(scope, keys);
  let activation;
  worker.handlers.get('activate')({ waitUntil: promise => { activation = promise; } });
  await activation;
  assert.deepEqual(worker.deleted, [`${prefix}v23`]);
  assert.equal(worker.calls.claimed, 1);
});

test('installation reloads HTTP assets and activates without waiting for tabs to close', async () => {
  const worker = loadWorker('https://example.test/worldforge/', []);
  let installation;
  worker.handlers.get('install')({ waitUntil: promise => { installation = promise; } });
  await installation;
  assert.ok(worker.calls.precache.length > 10);
  assert.ok(worker.calls.precache.every(request => request.cache === 'reload'));
  assert.ok(worker.calls.precache.every(request => request.url.startsWith('https://example.test/worldforge/')));
  assert.ok(worker.calls.precache.some(request => request.url === 'https://example.test/worldforge/bot/admin/botp/index.html'));
  assert.ok(!worker.calls.precache.some(request => request.url.endsWith('/bot/index.html')));
  assert.equal(worker.calls.activated, 1);
});

async function requestFrom(worker, request) {
  const pending = [];
  let response;
  worker.handlers.get('fetch')({
    request, respondWith: promise => { response = promise; },
    waitUntil: promise => pending.push(promise)
  });
  const result = await response;
  await Promise.all(pending);
  return result;
}

test('navigation gets new HTML from the network even if old HTML is cached', async () => {
  const fresh = { ok: true, clone: () => ({ fresh: true }) };
  const worker = loadWorker('https://example.test/worldforge/', [], {
    fetchResponse: fresh, matchResponse: { stale: true }
  });
  const result = await requestFrom(worker, { method: 'GET', mode: 'navigate', url: 'https://example.test/worldforge/' });
  assert.equal(result, fresh);
  assert.equal(worker.calls.fetch[0][1].cache, 'no-cache');
  assert.equal(worker.calls.put.length, 1);
});

test('offline navigation falls back to this app cached entry page including links with queries', async () => {
  const fallback = { offline: true };
  const worker = loadWorker('https://example.test/worldforge/', [], {
    fetchResponse: () => { throw new Error('Offline'); },
    matchResponse: request => request === 'https://example.test/worldforge/index.html' ? fallback : null
  });
  assert.equal(await requestFrom(worker, { method: 'GET', mode: 'navigate', url: 'https://example.test/worldforge/?update=1' }), fallback);
});

test('offline navigation to the team panel falls back to its nested cached page', async () => {
  const fallback = { offline: true };
  const worker = loadWorker('https://example.test/worldforge/', [], {
    fetchResponse: () => { throw new Error('Offline'); },
    matchResponse: request => request === 'https://example.test/worldforge/bot/admin/botp/index.html' ? fallback : null
  });
  assert.equal(await requestFrom(worker, { method: 'GET', mode: 'navigate', url: 'https://example.test/worldforge/bot/admin/botp/?view=history' }), fallback);
});

test('versioned assets use this app cache without a network request', async () => {
  const asset = { cached: true };
  const worker = loadWorker('https://example.test/worldforge/', [], { matchResponse: asset });
  assert.equal(await requestFrom(worker, { method: 'GET', mode: 'cors', url: 'https://example.test/worldforge/app.js?v=35' }), asset);
  assert.equal(worker.calls.fetch.length, 0);
});

test('fetch handler ignores cross-origin and non-GET requests', () => {
  const worker = loadWorker('https://example.test/worldforge/', []);
  let handled = false;
  worker.handlers.get('fetch')({
    request: { method: 'GET', url: 'https://third-party.test/data' },
    respondWith: () => { handled = true; },
  });
  worker.handlers.get('fetch')({
    request: { method: 'POST', url: 'https://example.test/worldforge/data' },
    respondWith: () => { handled = true; },
  });
  assert.equal(handled, false);
});

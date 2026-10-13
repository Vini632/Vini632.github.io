'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

test('precache includes current app, community, and world-library assets', () => {
  assert.match(source, /const CACHE = `\$\{CACHE_PREFIX\}v33`/);
  assert.match(source, /community-validation\.js\?v=1/);
  assert.match(source, /community\.js\?v=3/);
  assert.match(source, /app\.js\?v=32/);
  assert.match(source, /cloud-config\.js\?v=6/);
  assert.match(source, /world-catalog\.js\?v=1/);
  assert.match(source, /world-library\.js\?v=4/);
});

function loadWorker(scope, cacheKeys) {
  const handlers = new Map();
  const deleted = [];
  const self = {
    location: { origin: new URL(scope).origin },
    registration: { scope },
    addEventListener: (name, handler) => handlers.set(name, handler),
  };
  const caches = {
    open: async () => ({ addAll: async () => {}, put: async () => {} }),
    keys: async () => cacheKeys,
    delete: async key => { deleted.push(key); return true; },
    match: async () => null,
  };
  vm.runInNewContext(source, {
    URL,
    caches,
    fetch: async () => ({ ok: true, clone: () => ({}) }),
    self,
  });
  return { handlers, deleted };
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

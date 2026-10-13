'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const route = path.join(root, 'bot', 'admin', 'botp');
const source = fs.readFileSync(path.join(route, 'request-id.js'), 'utf8');

function loadGenerator(crypto) {
  const window = {};
  vm.runInNewContext(source, { crypto, Uint8Array, window });
  return window.WORLDFORGE_REQUEST_ID;
}

test('request ID uses crypto.randomUUID when available', () => {
  let called = 0;
  const generate = loadGenerator({
    randomUUID: () => { called++; return 'secure-native-id'; },
    getRandomValues: () => { throw new Error('fallback should not run'); }
  });

  assert.equal(generate(), 'secure-native-id');
  assert.equal(called, 1);
});

test('request ID uses secure random bytes when randomUUID is unavailable', () => {
  const generate = loadGenerator({
    getRandomValues: bytes => {
      bytes.fill(0);
      return bytes;
    }
  });

  assert.equal(generate(), '00000000-0000-4000-8000-000000000000');
});

test('request ID does not fall back to non-cryptographic randomness', () => {
  const generate = loadGenerator({});
  assert.throws(generate, /geração criptográfica/);
});

test('status checks do not create mutation request IDs', () => {
  const panel = fs.readFileSync(path.join(route, 'panel.js'), 'utf8');
  assert.match(panel, /command==='status'\?undefined:createRequestId\(\)/);
});

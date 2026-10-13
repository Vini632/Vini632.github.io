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

test('status checks send the UUID required by the bridge without persisting a mutation', async () => {
  const panel = fs.readFileSync(path.join(route, 'panel.js'), 'utf8');
  const source=panel.slice(panel.indexOf('  async function request('),panel.indexOf('  async function connect('));
  let submitted;
  const context={currentOwner:'account-a',pending:()=>null,
    createRequestId:()=> '91a8d250-15a6-45c0-86de-20db971a3d31',
    savePending(){throw new Error('Status must not persist a mutation');},
    sessionStorage:{removeItem(){throw new Error('Status must not clear a mutation');}},
    api:async body=>{submitted=body;assert.match(body.request_id,/^[a-f0-9-]{36}$/);return {id:'status-job'};},
    waitFor:async id=>{assert.equal(id,'status-job');return {online:true};}};
  vm.runInNewContext(source,context);
  const result=await context.request('status');
  assert.equal(submitted.command,'status');assert.equal(result.online,true);
});

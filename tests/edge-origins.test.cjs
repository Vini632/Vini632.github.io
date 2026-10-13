const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

async function handlers() {
  let bridge;
  const source = fs.readFileSync('supabase/functions/discord-bridge/index.ts', 'utf8');
  vm.runInNewContext(transformSync(source, { loader: 'ts' }).code, {
    Deno: { env: { get() { return 'test-only'; } }, serve(handler) { bridge = handler; } },
    Response, TextEncoder,
    fetch() { throw new Error('No network calls expected for these checks'); }
  });
  const { createDeletionHandler } = await import('../supabase/functions/delete-account/handler.mjs');
  return [bridge, createDeletionHandler({ url: 'https://example.invalid', anonKey: 'test-only', serviceKey: 'test-only' })];
}

test('edge functions accept exact production origins and preserve development preflight', async () => {
  for (const handler of await handlers()) {
    for (const origin of ['https://worldforge.site', 'https://vini632.github.io', 'http://localhost:3000', 'http://127.0.0.1:8000']) {
      const response = await handler(new Request('https://example.invalid', { method: 'OPTIONS', headers: { Origin: origin } }));
      assert.equal(response.status, 204);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
    }
  }
});

test('edge functions reject lookalike domains and keep authentication required', async () => {
  for (const handler of await handlers()) {
    for (const origin of ['http://worldforge.site', 'https://worldforge.site.evil.invalid', 'https://evil-worldforge.site', 'https://other.invalid']) {
      const response = await handler(new Request('https://example.invalid', { method: 'OPTIONS', headers: { Origin: origin } }));
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    }
    const response = await handler(new Request('https://example.invalid', { method: 'POST', headers: { Origin: 'https://worldforge.site' }, body: '{}' }));
    assert.equal(response.status, 401);
  }
});

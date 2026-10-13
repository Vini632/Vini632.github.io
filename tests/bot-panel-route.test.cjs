'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const route = path.join(root, 'bot', 'admin', 'botp');

test('team panel is available only at the nested static route', () => {
  assert.ok(fs.existsSync(path.join(route, 'index.html')));
  assert.ok(fs.existsSync(path.join(route, 'panel.js')));
  assert.ok(fs.existsSync(path.join(route, 'panel.css')));
  assert.ok(fs.existsSync(path.join(route, 'request-id.js')));
  assert.ok(!fs.existsSync(path.join(root, 'bot', 'index.html')));
  assert.ok(!fs.existsSync(path.join(root, 'bot', 'panel.js')));
  assert.ok(!fs.existsSync(path.join(root, 'bot', 'panel.css')));
});

test('nested panel HTML keeps its local dependencies resolvable', () => {
  const html = fs.readFileSync(path.join(route, 'index.html'), 'utf8');
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map(match => match[1])
    .filter(value => !/^(?:[a-z]+:|#)/i.test(value));

  for (const asset of assets) {
    const localPath = new URL(asset, 'https://example.test/bot/admin/botp/').pathname;
    assert.ok(fs.existsSync(path.join(root, localPath.replace(/^\/+/, ''))), `${asset} must resolve to a workspace file`);
  }

  assert.match(html, /name="robots" content="noindex"/);
});

test('team panel is not linked from account settings and auth returns to its route', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const panel = fs.readFileSync(path.join(route, 'panel.js'), 'utf8');

  assert.doesNotMatch(app, /Abrir painel|href=["']\.\/bot\/["']/);
  assert.ok(app.includes("sessionStorage.getItem('worldforge.auth-return')==='/bot/admin/botp/'"));
  assert.ok(panel.includes("sessionStorage.setItem('worldforge.auth-return','/bot/admin/botp/')"));
});

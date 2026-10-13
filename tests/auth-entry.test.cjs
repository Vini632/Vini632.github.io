'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

test('landing page offers sign-in, account creation, and guest continuation before the workspace', () => {
  assert.match(html, /id="landing-auth-form"/);
  assert.match(html, /id="landing-auth-switch"/);
  assert.match(html, /data-action="continue-guest"/);
  assert.match(html, /id="guest-screen"/);
  assert.match(html, /class="app-shell hidden"/);
});

test('workspace navigation and actions are gated by an authenticated session', () => {
  assert.match(app, /function hasWorkspaceAccess\(\)\{return workspaceAccess==='authenticated'&&Boolean\(cloudSession\?\.user\?\.id\);\}/);
  assert.match(app, /function setView\(view\)\{if\(!hasWorkspaceAccess\(\)\)return;/);
  assert.match(app, /document\.addEventListener\('click',event=>\{if\(!hasWorkspaceAccess\(\)&&event\.target\.closest\('#app-shell'\)\)/);
  assert.match(app, /async function restoreCloudSession\(\)/);
});

test('settings, legal notices, and update history use expandable details panels', () => {
  assert.match(app, /function makeSettingsPanelsExpandable\(\)/);
  assert.match(app, /details\.open=panel\.id==='settings-appearance'/);
  assert.match(app, /summary\.className='settings-panel-summary'/);
  assert.match(app, /function scrollToSettings\(id\)\{const section=\$\('#settings-'\+id\);if\(section instanceof HTMLDetailsElement\)section\.open=true;/);
});

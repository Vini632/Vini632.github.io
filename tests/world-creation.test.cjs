'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const handler = source.match(/  async function createNewWorldFromForm\(event\)\{[^\n]+/)[0];

test('canceling world creation leaves the dialog default action and performs no generation', async () => {
  let touched = false;
  const context = {
    $() { touched = true; throw new Error('Cancel must not read generation inputs'); },
    runForgeAnimation() { touched = true; throw new Error('Cancel must not animate'); }
  };
  vm.createContext(context);
  vm.runInContext(handler, context);
  await context.createNewWorldFromForm({
    submitter: { value: 'cancel' },
    preventDefault() { touched = true; }
  });
  assert.equal(touched, false);
});

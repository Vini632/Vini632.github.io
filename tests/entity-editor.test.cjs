'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const validateWorld = require('../world-validation.js');
const catalog = require('../world-catalog.js');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const functions = source.slice(source.indexOf('  function syncEntityLinks('), source.indexOf('  function removeNPCRecords('));

for (const persists of [true, false]) {
  test(`creating a realm ${persists ? 'keeps a valid capital and reloadable world' : 'rolls back both realm and capital on storage failure'}`, () => {
    const world = JSON.parse(JSON.stringify(catalog[0].world));
    const before = JSON.stringify(world);
    const context = {
      world, editorState: { key: 'reinos', id: '' },
      editorFields: { reinos: [['nome'], ['governo'], ['bioma'], ['cultura'], ['recurso'], ['conflito']] },
      activeWorldId: 'local-id', library: { worlds: [{ id: 'local-id', data: world }] },
      FormData: class { entries() { return Object.entries({ nome: 'Novo reino', governo: 'Conselho', bioma: 'Floresta', cultura: 'Livros', recurso: 'Madeira', conflito: 'Fronteiras' }); } },
      newEntityId: key => `${key}-regression`,
      save: () => persists,
      $: () => ({ close() {} }), renderAll() {}, setView() {}, toast() {}
    };
    vm.createContext(context);
    vm.runInContext(functions, context);
    context.saveEntityEditor({ preventDefault() {}, target: {} });
    if (!persists) {
      assert.equal(JSON.stringify(context.world), before);
      assert.equal(context.library.worlds[0].data, context.world);
      return;
    }
    const realm = context.world.reinos.find(item => item.id === 'reinos-regression');
    const capital = context.world.cidades.find(item => item.id === realm.capital_id);
    assert.equal(capital.reino_id, realm.id);
    assert.equal(capital.tipo, 'capital');
    assert.equal(realm.cidade_ids.length, 1);
    assert.equal(realm.cidade_ids[0], capital.id);
    assert.doesNotThrow(() => validateWorld(JSON.parse(JSON.stringify(context.world))));
  });
}

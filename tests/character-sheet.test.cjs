'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const validateWorld = require('../world-validation.js');
const catalog = require('../world-catalog.js');

function sheet() {
  return {version:1,sistema:'Livre',jogador:'Ana',ancestralidade:'Humana',classe:'Cartógrafa',origem:'Porto',alinhamento:'Curiosa',
    nivel:1,experiencia:0,vida_atual:10,vida_maxima:10,vida_temporaria:0,defesa:10,iniciativa:-1,deslocamento:9,moedas:0,
    atributos:[{nome:'Força',valor:10}],aparencia:'',historia:'História com acentos',ideais:'',vinculos:'',defeitos:'',equipamentos:'Corda',habilidades:'',magias:'',anotacoes:''};
}
function world() { return JSON.parse(JSON.stringify(catalog[0].world)); }

test('worlds with and without character sheets survive JSON backup and validation', () => {
  const data = world();
  assert.doesNotThrow(()=>validateWorld(data));
  data.npcs[0].ficha=sheet();
  const backup=JSON.parse(JSON.stringify(data));
  assert.doesNotThrow(()=>validateWorld(backup));
  assert.deepEqual(backup.npcs[0].ficha,sheet());
});

test('sheet import rejects malformed attributes, bounds and oversized text', () => {
  for(const mutate of [
    s=>s.version=2, s=>s.nivel=0, s=>s.vida_atual=11, s=>s.iniciativa=-10000,
    s=>s.moedas=1.5, s=>s.historia='x'.repeat(6001), s=>s.atributos.push({nome:' FORÇA ',valor:9}),
    s=>s.atributos=[{nome:'',valor:1}], s=>s.atributos=[{nome:'Teste',valor:1000}],
    s=>s.atributos=Array.from({length:13},(_,i)=>({nome:`Atributo ${i}`,valor:1})), s=>s.jogador=null
  ]) {
    const data=world();data.npcs[0].ficha=sheet();mutate(data.npcs[0].ficha);
    assert.throws(()=>validateWorld(data));
  }
});

function editor(persists=true) {
  const data=world(); let opened;
  const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
  const context={world:data,activeWorldId:'world-a',library:{worlds:[{id:'world-a',data}]},hasWorkspaceAccess:()=>true,
    window:{WORLDFORGE_VALIDATE_SHEET:globalThis.WORLDFORGE_VALIDATE_SHEET,WORLDFORGE_SHEETS:{open:options=>{opened=options;}}},
    $:()=>({open:false}),cityName:()=> 'Forjafunda',toast(){},save:()=>persists,renderEntityView(){}
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  function openCharacterSheet('),source.indexOf('  function showDetail(')),context);
  context.openCharacterSheet(data.npcs[0].id);
  return {context,opened};
}

test('sheet save stays attached to the original NPC and does not retain mutable draft references', () => {
  const {context,opened}=editor();const draft=sheet();opened.save(draft);draft.historia='Changed after save';
  assert.equal(context.world.npcs[0].ficha.historia,sheet().historia);
  assert.equal(context.world.npcs[1].ficha,undefined);
});

test('storage failure restores the world and library without retaining a partial sheet', () => {
  const {context,opened}=editor(false);const before=JSON.stringify(context.world);
  assert.throws(()=>opened.save(sheet()),/salvar a ficha/);
  assert.equal(JSON.stringify(context.world),before);
  assert.equal(context.library.worlds[0].data,context.world);
});

test('saving is refused if the world changes, the character disappears, or access ends', () => {
  for(const mutate of [c=>c.activeWorldId='world-b', c=>c.world.npcs.shift(), c=>c.hasWorkspaceAccess=()=>false]) {
    const {context,opened}=editor();mutate(context);const before=JSON.stringify(context.world);
    assert.throws(()=>opened.save(sheet()));assert.equal(JSON.stringify(context.world),before);
  }
});

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const catalog = require('../world-catalog.js');
const validateWorld = require('../world-validation.js');

test('catalog preserves original scenarios and adds three complete worlds and four starting points', () => {
  assert.equal(catalog.length, 10);
  assert.equal(new Set(catalog.map(world => world.id)).size, catalog.length);
  assert.equal(new Set(catalog.map(world => world.slug)).size, catalog.length);
  assert.deepEqual(catalog.slice(0,3).map(world => world.type), ['complete', 'template', 'template']);
  assert.equal(catalog.filter(world => world.type === 'complete').length, 4);
  assert.equal(catalog.filter(world => world.type === 'template').length, 6);
  for (const entry of catalog) {
    assert.ok(entry.name);
    assert.ok(entry.description);
    assert.ok(entry.longDescription);
    assert.ok(entry.genre);
    assert.ok(entry.cover);
    assert.ok(entry.content.length);
    assert.ok(entry.customization.length);
    const copy = JSON.parse(JSON.stringify(entry.world));
    assert.equal(validateWorld(copy), copy);
  }
});

test('complete scenario contains campaign-ready entities while templates remain expandable', () => {
  for (const entry of catalog.filter(world => world.type === 'complete')) {
    const complete = entry.world;
    assert.ok(complete.reinos.length >= 2);
    assert.ok(complete.cidades.length >= 3);
    assert.ok(complete.npcs.length >= 3);
    assert.ok(complete.monstros.length);
    assert.ok(complete.missoes.length);
    assert.ok(complete.eventos.length);
    assert.ok(complete.relacoes.length);
    assert.ok(complete.faccoes.length);
  }

  const templates = catalog.filter(world => world.type === 'template');
  for (const template of templates) {
    assert.ok(template.world.reinos.length);
    assert.ok(template.world.cidades.length);
    assert.ok(template.world.campos_personalizaveis?.length || template.world.perguntas_abertas?.length);
  }
});

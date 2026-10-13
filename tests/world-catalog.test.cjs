'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const catalog = require('../world-catalog.js');
const validateWorld = require('../world-validation.js');

test('starter catalog has three distinct complete and template worlds', () => {
  assert.equal(catalog.length, 3);
  assert.equal(new Set(catalog.map(world => world.id)).size, catalog.length);
  assert.equal(new Set(catalog.map(world => world.slug)).size, catalog.length);
  assert.deepEqual(catalog.map(world => world.type), ['complete', 'template', 'template']);
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
  const complete = catalog.find(world => world.type === 'complete').world;
  assert.ok(complete.reinos.length >= 2);
  assert.ok(complete.cidades.length >= 3);
  assert.ok(complete.npcs.length >= 3);
  assert.ok(complete.monstros.length);
  assert.ok(complete.missoes.length);
  assert.ok(complete.eventos.length);

  const templates = catalog.filter(world => world.type === 'template');
  for (const template of templates) {
    assert.ok(template.world.reinos.length);
    assert.ok(template.world.cidades.length);
    assert.ok(template.world.campos_personalizaveis?.length || template.world.perguntas_abertas?.length);
  }
});

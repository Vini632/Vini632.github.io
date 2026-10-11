'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const validateWorld = require('../world-validation.js');

function sampleWorld() {
  return {
    metadata: { nome: 'Eldoria', seed: 2026 },
    estado_mundo: { turno: 1 },
    reinos: [{
      id: 'reino-1', nome: 'Aurelion', governo: 'monarquia', bioma: 'planícies',
      cultura: 'cavaleiros', recurso: 'trigo', conflito: 'sucessão',
      capital_id: 'cidade-1', cidade_ids: ['cidade-1'],
    }],
    cidades: [{
      id: 'cidade-1', nome: 'Valgard', reino_id: 'reino-1', tipo: 'capital',
      populacao: 1200, descricao: 'Uma cidade', npc_ids: ['npc-1', 'npc-2'],
    }],
    npcs: [
      { id: 'npc-1', nome: 'Ariane', idade: 24, papel: 'curandeira', traco: 'curiosa', cidade_id: 'cidade-1', reino_id: 'reino-1', objetivo_pessoal: 'proteger a cidade' },
      { id: 'npc-2', nome: 'Bram', idade: 30, papel: 'guarda', traco: 'honrado', cidade_id: 'cidade-1', reino_id: 'reino-1', objetivo_pessoal: 'encontrar a verdade' },
    ],
    monstros: [{ id: 'monstro-1', nome: 'Lobo de Cinza', nivel: 1, habitat: 'florestas', perigo: 'baixo' }],
    missoes: [{
      id: 'missao-1', titulo: 'Ecos de Valgard', objetivo: 'Investigar ruínas',
      cidade_origem_id: 'cidade-1', reino_id: 'reino-1', ameaca: 'Lobo de Cinza',
      nivel_recomendado: 1, recompensa: 'ouro', estado: 'disponível',
    }],
    relacoes: [{
      id: 'relacao-1', npc_a_id: 'npc-1', npc_b_id: 'npc-2',
      tipo: 'amizade', descricao: 'Confiam um no outro', intensidade: 3,
    }],
    eventos: [{
      id: 'evento-1', tipo: 'social', titulo: 'Festival',
      descricao: 'Uma celebração', impacto: 'Novos contatos',
      cidade_id: 'cidade-1', reino_id: 'reino-1', npc_envolvido_id: null,
      turno_inicio: 1, duracao_turnos: 2, turno_fim: 3, estado: 'ativo',
    }],
  };
}

test('accepts a valid world and migrates legacy worlds without campaign notes', () => {
  const world = sampleWorld();
  assert.equal(validateWorld(world), world);
  assert.deepEqual(world.notas_campanha, []);
});

test('accepts a valid campaign note', () => {
  const world = sampleWorld();
  world.notas_campanha = [{
    id: 'nota-1', titulo: 'Chegada', texto: 'A campanha começou.', turno: 1,
  }];
  assert.equal(validateWorld(world), world);
});

test('rejects invalid field types and out-of-range numbers', () => {
  const world = sampleWorld();
  world.cidades[0].populacao = '1200';
  assert.throws(() => validateWorld(world), /populacao/);

  const secondWorld = sampleWorld();
  secondWorld.relacoes[0].intensidade = 6;
  assert.throws(() => validateWorld(secondWorld), /relação/);
});

test('rejects broken references and duplicate IDs', () => {
  const world = sampleWorld();
  world.npcs[0].cidade_id = 'ausente';
  assert.throws(() => validateWorld(world), /personagem/);

  const duplicateWorld = sampleWorld();
  duplicateWorld.npcs[1].id = duplicateWorld.npcs[0].id;
  assert.throws(() => validateWorld(duplicateWorld), /ID duplicado/);
});

test('rejects oversized collections, identifiers, and text fields', () => {
  const oversizedCollection = sampleWorld();
  oversizedCollection.eventos = Array.from({ length: 20001 }, () => ({}));
  assert.throws(() => validateWorld(oversizedCollection), /limite de registros/);

  const oversizedId = sampleWorld();
  oversizedId.reinos[0].id = 'r'.repeat(121);
  assert.throws(() => validateWorld(oversizedId), /ID duplicado/);

  const oversizedText = sampleWorld();
  oversizedText.npcs[0].objetivo_pessoal = 'x'.repeat(10001);
  assert.throws(() => validateWorld(oversizedText), /objetivo_pessoal/);
});

test('rejects malformed campaign notes instead of silently discarding them', () => {
  const world = sampleWorld();
  world.notas_campanha = {};
  assert.throws(() => validateWorld(world), /notas_campanha/);
});

test('rejects events whose state conflicts with their turn dates', () => {
  const world = sampleWorld();
  world.eventos[0].turno_fim = 2;
  assert.throws(() => validateWorld(world), /calendário/);
});

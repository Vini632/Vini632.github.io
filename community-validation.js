(function (root) {
  'use strict';

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const CATEGORIES = new Set(['geral', 'criacao', 'campanhas', 'procurando-mesa']);

  function text(value, label, { min = 0, max } = {}) {
    if (typeof value !== 'string') throw new Error(`${label} precisa ser texto.`);
    const normalized = value.trim();
    if (normalized.length < min || normalized.length > max) {
      throw new Error(`${label} deve ter entre ${min} e ${max} caracteres.`);
    }
    return normalized;
  }

  function forumPost(input) {
    const category = input?.category;
    if (!CATEGORIES.has(category)) throw new Error('Escolha uma categoria válida.');
    return {
      category,
      title: text(input.title, 'O título', { min: 3, max: 120 }),
      body: text(input.body, 'A publicação', { min: 1, max: 4000 }),
      author_name: text(input.author_name, 'O nome público', { min: 1, max: 40 })
    };
  }

  function forumReply(input) {
    return {
      body: text(input.body, 'A resposta', { min: 1, max: 2000 }),
      author_name: text(input.author_name, 'O nome público', { min: 1, max: 40 })
    };
  }

  function showcaseDraft(world, input) {
    if (!world || typeof world !== 'object' || !world.metadata || !Array.isArray(world.reinos) || !Array.isArray(world.cidades)) {
      throw new Error('Selecione um mundo WorldForge válido.');
    }
    return {
      creator_name: text(input.creator_name, 'O nome público', { min: 1, max: 40 }),
      world_name: text(world.metadata.nome, 'O nome do mundo', { min: 1, max: 160 }),
      summary: text(input.summary, 'O resumo público', { min: 20, max: 600 }),
      realm_names: world.reinos.slice(0, 12).map(item => text(item?.nome, 'O nome do reino', { min: 1, max: 160 })),
      city_names: world.cidades.slice(0, 12).map(item => text(item?.nome, 'O nome da cidade', { min: 1, max: 160 }))
    };
  }

  function guild(input) {
    return {
      name: text(input.name, 'O nome da guilda', { min: 3, max: 60 }),
      description: text(input.description || '', 'A descrição', { max: 500 })
    };
  }

  function inviteCode(input) {
    const match = typeof input === 'string' && input.trim().match(/^([0-9a-f-]{36})\.([0-9a-f-]{36})$/i);
    if (!match || !UUID.test(match[1]) || !UUID.test(match[2])) {
      throw new Error('Cole um convite válido no formato id.token.');
    }
    return { guildId: match[1], token: match[2] };
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  const api = Object.freeze({ forumPost, forumReply, showcaseDraft, guild, inviteCode, escapeHtml });
  root.WORLDFORGE_COMMUNITY_VALIDATION = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);

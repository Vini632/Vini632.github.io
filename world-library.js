(function () {
  'use strict';

  const app = window.WORLDFORGE_APP;
  const catalog = window.WORLDFORGE_WORLD_CATALOG;
  const validateWorld = window.WORLDFORGE_VALIDATE_WORLD;
  const PENDING_KEY = 'worldforge.world-library.pending.v1';
  const enabled = window.WORLDFORGE_WORLD_LIBRARY_ENABLED === true;
  const state = { selected: null, search: '', genre: '', type: '', busySlug: '', error: '' };
  const $ = (selector, root = document) => root.querySelector(selector);

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }
  function root() { return $('#world-library'); }
  function renderComingSoon(view) {
    if (view !== 'biblioteca-mundos') return;
    const target = root();
    if (!target) return;
    target.innerHTML = '<div class="community-notice world-library-coming-soon"><span class="entity-tag">EM BREVE</span><h2>Biblioteca de Mundos</h2><p>Estamos preparando cenários completos e modelos personalizáveis para você explorar e levar para suas campanhas.</p></div>';
  }
  if (!enabled) {
    let pendingCleared = true;
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {
      pendingCleared = false;
    }
    window.WORLDFORGE_WORLD_LIBRARY = Object.freeze({
      render: renderComingSoon,
      onSessionReady: async () => {}
    });
    if (!pendingCleared) {
      const target = root();
      if (target) target.insertAdjacentHTML('beforeend', '<p class="community-error" role="status">Não foi possível cancelar uma cópia pendente da Biblioteca neste navegador. Limpe os dados do site antes de entrar na conta.</p>');
    }
    if (window.location.hash.slice(1) === 'biblioteca-mundos') renderComingSoon('biblioteca-mundos');
    return;
  }
  function getPending() {
    try {
      const pending = JSON.parse(localStorage.getItem(PENDING_KEY));
      if (pending && catalog.some(world => world.slug === pending.slug)
        && typeof pending.localId === 'string' && pending.localId.length <= 120) return pending;
      return null;
    } catch {
      return null;
    }
  }
  function storePending(pending) {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    } catch {
      throw new Error('Não foi possível guardar sua intenção neste navegador. Libere espaço e tente novamente.');
    }
  }
  function clearPending() {
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {
      throw new Error('A cópia foi salva, mas não foi possível limpar a intenção pendente neste navegador.');
    }
  }
  function newLocalId() {
    if (window.crypto?.randomUUID) return `world-lib-${window.crypto.randomUUID()}`;
    return `world-lib-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
  function catalogWorld(slug) { return catalog.find(world => world.slug === slug); }
  function pendingFor(slug) {
    const pending = getPending();
    return pending?.slug === slug ? pending : null;
  }
  function heading() {
    return '<div class="page-heading"><div><div class="eyebrow"><span class="eyebrow-mark">✳</span> CENÁRIOS PARA SUA PRÓXIMA HISTÓRIA</div><h1>Biblioteca de Mundos</h1><p>Explore cenários prontos e modelos para transformar em uma campanha sua.</p></div></div>';
  }
  function filterPanel() {
    const genres = [...new Set(catalog.map(world => world.genre))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return `<div class="world-library-toolbar"><label class="field-label">Pesquisar<input class="text-field" type="search" data-library-search value="${esc(state.search)}" placeholder="Nome, tema ou descrição" aria-label="Pesquisar mundos"></label><label class="field-label">Gênero<select class="text-field" data-library-genre><option value="">Todos os gêneros</option>${genres.map(genre => `<option value="${esc(genre)}" ${state.genre === genre ? 'selected' : ''}>${esc(genre)}</option>`).join('')}</select></label><label class="field-label">Tipo<select class="text-field" data-library-type><option value="">Todos os tipos</option><option value="complete" ${state.type === 'complete' ? 'selected' : ''}>Mundo completo</option><option value="template" ${state.type === 'template' ? 'selected' : ''}>Modelo personalizável</option></select></label></div>`;
  }
  function worldCard(world) {
    return `<article class="world-library-card" data-world-card="${esc(world.slug)}" data-genre="${esc(world.genre)}" data-type="${world.type}" data-search="${esc(`${world.name} ${world.description} ${world.genre} ${world.development}`.toLocaleLowerCase('pt-BR'))}"><div class="world-library-cover cover-${esc(world.cover)}"><span>${world.type === 'complete' ? 'CENÁRIO COMPLETO' : 'PONTO DE PARTIDA'}</span><strong>${esc(world.name)}</strong></div><div class="world-library-card-body"><div class="world-library-tags"><span class="entity-tag">${esc(world.genre)}</span><span class="entity-tag">${esc(world.development)}</span></div><p>${esc(world.description)}</p><ul class="world-library-content">${world.content.map(item => `<li>${esc(item)}</li>`).join('')}</ul><button class="button button-quiet button-small" type="button" data-library-action="details" data-world-slug="${esc(world.slug)}">Ver detalhes</button></div></article>`;
  }
  function renderCatalog(target) {
    const cards = catalog.map(worldCard).join('');
    target.innerHTML = heading() + filterPanel() + `<p class="world-library-result-count" aria-live="polite"></p><div class="world-library-grid">${cards}</div><div class="community-empty hidden" data-library-empty>Nenhum mundo corresponde a esses filtros.</div>`;
    applyFilters(target);
  }
  function sectionList(title, values, getText) {
    if (!Array.isArray(values) || !values.length) return '';
    return `<section class="world-library-detail-section"><h3>${esc(title)}</h3><ul>${values.map(value => `<li>${esc(getText(value))}</li>`).join('')}</ul></section>`;
  }
  function detailMarkup(world) {
    const summary = world.world;
    const pending = pendingFor(world.slug);
    const action = `<button type="button" class="button button-primary" data-library-action="use" data-world-slug="${esc(world.slug)}" ${state.busySlug === world.slug ? 'disabled' : ''}>${state.busySlug === world.slug ? 'Salvando cópia…' : 'Usar este mundo'}</button>`;
    const needsLogin = !app?.user?.id
      ? `<div class="community-notice"><strong>${pending ? 'Sua escolha foi guardada' : 'Cópia privada na sua conta'}</strong><p>${pending ? 'Entre na conta para salvar este mundo. Sua escolha será retomada automaticamente.' : 'Ao usar este mundo, guardaremos sua escolha e pediremos que entre antes de criar a cópia.'}</p>${pending ? '<a class="button button-quiet button-small" href="#configuracoes" data-view="configuracoes" data-open-settings="data">Entrar ou criar conta</a>' : ''}</div>`
      : '';
    const error = state.error ? `<div class="community-notice community-error" role="alert"><strong>Não foi possível concluir</strong><p>${esc(state.error)}</p></div>` : '';
    const visibleRealms = summary.reinos.map(realm => `${realm.nome} — ${realm.bioma}; ${realm.conflito}`);
    const visibleCities = summary.cidades.map(city => `${city.nome} — ${city.descricao}`);
    const visibleNpcs = summary.npcs.map(npc => `${npc.nome}, ${npc.papel}: ${npc.objetivo_pessoal}`);
    const npcsById = new Map(summary.npcs.map(npc => [npc.id, npc.nome]));
    const visibleFactions = Array.isArray(summary.faccoes) ? summary.faccoes.map(faction => `${faction.nome}: ${faction.objetivo}`) : [];
    const visibleMonsters = summary.monstros.map(monster => `${monster.nome} — ${monster.habitat}; nível ${monster.nivel}, perigo ${monster.perigo}`);
    const visibleMissions = summary.missoes.map(mission => `${mission.titulo}: ${mission.objetivo}`);
    const visibleRelations = summary.relacoes.map(relation => `${npcsById.get(relation.npc_a_id)} — ${relation.tipo} — ${npcsById.get(relation.npc_b_id)}: ${relation.descricao}`);
    const visibleEvents = summary.eventos.map(item => `${item.titulo}: ${item.descricao} Impacto: ${item.impacto}`);
    const extraSections = [
      sectionList('Regiões e conflitos', visibleRealms, value => value),
      sectionList('Lugares', visibleCities, value => value),
      sectionList('Personagens', visibleNpcs, value => value),
      sectionList('Facções', visibleFactions, value => value),
      sectionList('Criaturas', visibleMonsters, value => value),
      sectionList('Missões', visibleMissions, value => value),
      sectionList('Relações', visibleRelations, value => value),
      sectionList('Eventos iniciais', visibleEvents, value => value),
      sectionList('Geografia', summary.geografia, value => value),
      sectionList('Crônica', summary.cronica, value => value),
      sectionList('Pistas', summary.pistas, value => `${value.titulo}: ${value.detalhe}`),
      sectionList('Perguntas para desenvolver', summary.perguntas_abertas, value => value)
    ].filter(Boolean).join('');
    const themes = summary.magia ? `<section class="world-library-detail-section"><h3>Magia e ambientação</h3><p>${esc(summary.magia)}</p></section>` : '';
    const customization = world.customization?.length
      ? `<section class="world-library-detail-section"><h3>O que você pode desenvolver</h3><ul>${world.customization.map(value => `<li>${esc(value)}</li>`).join('')}</ul></section>`
      : '';
    return `${heading()}<button class="community-back" type="button" data-library-action="back">← Voltar ao catálogo</button><article class="world-library-detail"><div class="world-library-cover world-library-detail-cover cover-${esc(world.cover)}"><span>${world.type === 'complete' ? 'CENÁRIO COMPLETO' : 'MODELO PERSONALIZÁVEL'}</span><strong>${esc(world.name)}</strong></div><div class="world-library-detail-copy"><div class="world-library-tags"><span class="entity-tag">${esc(world.genre)}</span><span class="entity-tag">${esc(world.development)}</span></div><p class="world-library-lead">${esc(world.longDescription)}</p><p>${esc(world.description)}</p>${needsLogin}${error}<div class="world-library-detail-actions">${action}<span>Uma cópia independente será salva na sua conta.</span></div><div class="world-library-detail-grid">${extraSections}${themes}${customization}</div></div></article>`;
  }
  function render(view) {
    if (view !== 'biblioteca-mundos') return;
    const target = root();
    if (!target) return;
    if (!Array.isArray(catalog) || typeof validateWorld !== 'function') {
      target.innerHTML = `${heading()}<div class="community-notice community-error"><strong>Catálogo indisponível</strong><p>Os dados da Biblioteca de Mundos não foram carregados corretamente.</p></div>`;
      return;
    }
    if (!catalog.length) {
      target.innerHTML = `${heading()}<div class="community-empty">Ainda não há mundos no catálogo. Volte mais tarde para descobrir novos cenários.</div>`;
      return;
    }
    if (state.selected) {
      const selected = catalogWorld(state.selected);
      if (!selected) state.selected = null;
      else {
        target.innerHTML = detailMarkup(selected);
        return;
      }
    }
    renderCatalog(target);
  }
  function applyFilters(target = root()) {
    if (!target) return;
    let visible = 0;
    target.querySelectorAll('[data-world-card]').forEach(card => {
      const matches = (!state.search || card.dataset.search.includes(state.search.toLocaleLowerCase('pt-BR')))
        && (!state.genre || card.dataset.genre === state.genre)
        && (!state.type || card.dataset.type === state.type);
      card.classList.toggle('hidden', !matches);
      if (matches) visible++;
    });
    const count = target.querySelector('.world-library-result-count');
    if (count) count.textContent = `${visible} ${visible === 1 ? 'mundo encontrado' : 'mundos encontrados'}`;
    target.querySelector('[data-library-empty]')?.classList.toggle('hidden', visible !== 0);
  }
  async function useWorld(slug) {
    const selected = catalogWorld(slug);
    if (!selected) throw new Error('Este mundo não está mais disponível no catálogo.');
    if (!app?.user?.id) {
      const previous = pendingFor(slug);
      storePending(previous || { slug, localId: newLocalId() });
      state.error = '';
      render('biblioteca-mundos');
      return;
    }
    if (state.busySlug) return;
    const pending = pendingFor(slug) || { slug, localId: newLocalId() };
    if (app.hasLocalWorld?.(pending.localId)) {
      clearPending();
      state.selected = null;
      state.error = '';
      render('biblioteca-mundos');
      return;
    }
    storePending(pending);
    state.busySlug = slug;
    state.error = '';
    render('biblioteca-mundos');
    try {
      validateWorld(JSON.parse(JSON.stringify(selected.world)));
      await app.createCatalogCopy(selected, pending.localId);
      clearPending();
      state.selected = null;
      state.error = '';
    } catch (error) {
      state.error = error?.message || 'Ocorreu um erro ao salvar a cópia.';
      render('biblioteca-mundos');
    } finally {
      state.busySlug = '';
      if (state.selected) render('biblioteca-mundos');
    }
  }
  async function onSessionReady() {
    const pending = getPending();
    if (!pending || !app?.user?.id) return;
    state.selected = pending.slug;
    state.error = '';
    await useWorld(pending.slug);
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-library-action]');
    if (!button) return;
    event.preventDefault();
    const action = button.dataset.libraryAction;
    const slug = button.dataset.worldSlug;
    if (action === 'back') {
      state.selected = null;
      state.error = '';
      render('biblioteca-mundos');
    } else if (action === 'details') {
      state.selected = slug;
      state.error = '';
      render('biblioteca-mundos');
    } else if (action === 'use') {
      useWorld(slug).catch(error => {
        state.error = error?.message || 'Ocorreu um erro ao iniciar a cópia.';
        render('biblioteca-mundos');
      });
    }
  });
  document.addEventListener('input', event => {
    if (!event.target.matches('[data-library-search]')) return;
    state.search = event.target.value.trim();
    applyFilters();
  });
  document.addEventListener('change', event => {
    if (event.target.matches('[data-library-genre]')) state.genre = event.target.value;
    else if (event.target.matches('[data-library-type]')) state.type = event.target.value;
    else return;
    applyFilters();
  });

  window.WORLDFORGE_WORLD_LIBRARY = Object.freeze({ render, onSessionReady });
  if (window.location.hash.slice(1) === 'biblioteca-mundos') render('biblioteca-mundos');
  if (app?.user?.id) onSessionReady();
})();

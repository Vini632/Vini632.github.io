(function () {
  'use strict';

  const app = window.WORLDFORGE_APP;
  const validate = window.WORLDFORGE_COMMUNITY_VALIDATION;
  const state = {
    view: '',
    posts: [],
    selectedPost: null,
    replies: [],
    editing: null,
    showcase: [],
    guilds: [],
    selectedGuild: null,
    members: [],
    messages: [],
    inviteCode: ''
  };
  const $ = (selector, root = document) => root.querySelector(selector);
  const limit = 50;
  const categories = {
    geral: 'Conversa geral',
    criacao: 'Criação de mundos',
    campanhas: 'Campanhas',
    'procurando-mesa': 'Procurando mesa'
  };

  function esc(value) { return validate.escapeHtml(value); }
  function date(value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'Data indisponível' : parsed.toLocaleString('pt-BR');
  }
  function rootFor(view) { return $(`#community-${view}`); }
  function signedIn() { return Boolean(app?.user?.id); }
  function accountLink() {
    return '<a class="button button-quiet button-small" href="#configuracoes" data-view="configuracoes" data-open-settings="data">Entrar ou criar conta</a>';
  }
  function disabledPanel() {
    return '<div class="community-notice"><strong>Comunidade indisponível no momento</strong><p>Os recursos comunitários aguardam a instalação e ativação do esquema seguro no Supabase.</p></div>';
  }
  function authNotice(copy = 'Entre na sua conta para participar.') {
    return `<div class="community-notice"><strong>Conta necessária</strong><p>${copy}</p>${accountLink()}</div>`;
  }
  function errorPanel(error, retryView) {
    const message = error?.message || 'Não foi possível carregar este conteúdo.';
    return `<div class="community-notice community-error"><strong>Não foi possível carregar</strong><p>${esc(message)}</p><button class="button button-quiet button-small" data-community-action="retry" data-view-name="${retryView}">Tentar novamente</button></div>`;
  }
  function heading(eyebrow, title, copy, actions = '') {
    return `<div class="page-heading"><div><div class="eyebrow"><span class="eyebrow-mark">✳</span>${eyebrow}</div><h1>${title}</h1><p>${copy}</p></div><div class="heading-actions">${actions}</div></div>`;
  }
  function ensureEnabled(root) {
    if (!app?.communityEnabled) {
      root.innerHTML = disabledPanel();
      return false;
    }
    return true;
  }
  async function request(path, options = {}) {
    const { requireAuth = false, ...requestOptions } = options;
    if (requireAuth) await app.ensureSession();
    return app.cloudFetch(path, requestOptions);
  }
  function setRoot(view, html) {
    const root = rootFor(view);
    if (root) root.innerHTML = html;
  }
  function authorActions(record, kind) {
    if (!signedIn() || record.author_id !== app.user.id) return '';
    return `<span class="community-record-actions"><button type="button" data-community-action="edit-${kind}" data-record-id="${esc(record.id)}">Editar</button><button type="button" data-community-action="delete-${kind}" data-record-id="${esc(record.id)}">Excluir</button></span>`;
  }

  async function renderForum() {
    const root = rootFor('foruns');
    if (!root || !ensureEnabled(root)) return;
    root.innerHTML = heading('PORTAL DA COMUNIDADE', 'Fórum da Forja', 'Converse sobre criação de mundos, campanhas e mesas.')
      + '<div class="community-loading" role="status">Carregando conversas…</div>';
    try {
      const postFields = signedIn()
        ? 'id,author_id,author_name,category,title,body,created_at,updated_at'
        : 'id,author_name,category,title,body,created_at,updated_at';
      state.posts = await request(`/rest/v1/worldforge_forum_posts?select=${postFields}&order=created_at.desc&limit=${limit}`);
      if (!Array.isArray(state.posts)) throw new Error('Resposta inválida do fórum.');
      if (state.selectedPost && !state.posts.some(post => post.id === state.selectedPost.id)) state.selectedPost = null;
      if (state.selectedPost) {
        const latest = state.posts.find(post => post.id === state.selectedPost.id);
        state.selectedPost = latest || null;
        const replyFields = signedIn()
          ? 'id,author_id,author_name,body,created_at,updated_at'
          : 'id,author_name,body,created_at,updated_at';
        state.replies = latest ? await request(`/rest/v1/worldforge_forum_replies?select=${replyFields}&post_id=eq.${encodeURIComponent(latest.id)}&order=created_at.asc&limit=100`) : [];
      }
      renderForumContent();
    } catch (error) {
      setRoot('foruns', heading('PORTAL DA COMUNIDADE', 'Fórum da Forja', 'Converse sobre criação de mundos, campanhas e mesas.') + errorPanel(error, 'foruns'));
    }
  }
  function renderForumContent() {
    const toolbar = `<div class="community-toolbar"><span class="entity-count">${state.posts.length} ${state.posts.length === 1 ? 'conversa recente' : 'conversas recentes'}</span>${signedIn() ? '<button class="button button-primary button-small" data-community-action="new-post">Novo tópico</button>' : accountLink()}</div>`;
    if (state.selectedPost) {
      const post = state.selectedPost;
      const postEdit = state.editing?.kind === 'post' && state.editing.id === post.id;
      const postContent = postEdit
        ? `<form class="community-form" data-community-form="edit-post" data-record-id="${esc(post.id)}"><label class="field-label">Título<input class="text-field" name="title" required minlength="3" maxlength="120" value="${esc(post.title)}"></label><label class="field-label">Mensagem<textarea class="text-field community-textarea" name="body" required maxlength="4000">${esc(post.body)}</textarea></label><div class="community-form-actions"><button class="button button-primary button-small" type="submit">Salvar edição</button><button class="button button-quiet button-small" type="button" data-community-action="cancel-edit">Cancelar</button></div></form>`
        : `<h2>${esc(post.title)}</h2><p class="community-record-body">${esc(post.body)}</p>`;
      const replies = state.replies.map(reply => {
        const editing = state.editing?.kind === 'reply' && state.editing.id === reply.id;
        return `<article class="community-reply"><div class="community-record-meta"><strong>${esc(reply.author_name)}</strong><time>${esc(date(reply.created_at))}</time>${authorActions(reply, 'reply')}<button type="button" data-community-action="report" data-content-type="forum_reply" data-record-id="${esc(reply.id)}">Denunciar</button></div><form class="community-report-form hidden" data-community-form="report" data-record-id="${esc(reply.id)}" data-content-type="forum_reply">${reportFields()}</form>${editing
          ? `<form class="community-form" data-community-form="edit-reply" data-record-id="${esc(reply.id)}"><label class="field-label">Resposta<textarea class="text-field community-textarea" name="body" required maxlength="2000">${esc(reply.body)}</textarea></label><div class="community-form-actions"><button class="button button-primary button-small" type="submit">Salvar</button><button class="button button-quiet button-small" type="button" data-community-action="cancel-edit">Cancelar</button></div></form>`
          : `<p class="community-record-body">${esc(reply.body)}</p>`}</article>`;
      }).join('') || '<p class="community-empty">Seja a primeira pessoa a responder.</p>';
      const replyForm = signedIn()
        ? `<form class="community-form" data-community-form="reply"><label class="field-label">Sua resposta<textarea class="text-field community-textarea" name="body" required maxlength="2000" placeholder="Escreva com respeito e cuidado."></textarea></label><button class="button button-primary button-small" type="submit">Responder</button></form>`
        : authNotice('É necessário entrar para responder ao tópico.');
      setRoot('foruns', heading('PORTAL DA COMUNIDADE', 'Fórum da Forja', 'Conversas abertas para leitura; participação exige conta.')
        + toolbar + `<section class="community-card"><button class="community-back" data-community-action="forum-back">← Voltar à lista</button><div class="community-record-meta"><span class="entity-tag">${esc(categories[post.category] || 'Conversa')}</span><strong>${esc(post.author_name)}</strong><time>${esc(date(post.created_at))}</time>${authorActions(post, 'post')}<button type="button" data-community-action="report" data-content-type="forum_post" data-record-id="${esc(post.id)}">Denunciar</button></div>${postContent}<form class="community-report-form hidden" data-community-form="report" data-record-id="${esc(post.id)}" data-content-type="forum_post">${reportFields()}</form></section><section class="community-card"><h3>Respostas (${state.replies.length})</h3>${replies}${replyForm}</section>`);
      return;
    }
    const newPost = state.editing?.kind === 'new-post'
      ? `<section class="community-card"><h3>Novo tópico</h3><form class="community-form" data-community-form="new-post"><label class="field-label">Categoria<select class="text-field" name="category">${Object.entries(categories).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></label><label class="field-label">Título<input class="text-field" name="title" required minlength="3" maxlength="120"></label><label class="field-label">Mensagem<textarea class="text-field community-textarea" name="body" required maxlength="4000"></textarea></label><div class="community-form-actions"><button class="button button-primary button-small" type="submit">Publicar tópico</button><button class="button button-quiet button-small" type="button" data-community-action="cancel-edit">Cancelar</button></div></form></section>`
      : '';
    const posts = state.posts.map(post => `<article class="community-card community-post-card"><div class="community-record-meta"><span class="entity-tag">${esc(categories[post.category] || 'Conversa')}</span><strong>${esc(post.author_name)}</strong><time>${esc(date(post.created_at))}</time></div><button class="community-post-title" data-community-action="open-post" data-record-id="${esc(post.id)}">${esc(post.title)}</button><p class="community-record-body">${esc(post.body.length > 220 ? `${post.body.slice(0, 220)}…` : post.body)}</p><button class="button button-quiet button-small" data-community-action="open-post" data-record-id="${esc(post.id)}">Abrir conversa</button></article>`).join('') || '<div class="community-empty">Ainda não há tópicos. Crie uma conversa para iniciar a comunidade.</div>';
    setRoot('foruns', heading('PORTAL DA COMUNIDADE', 'Fórum da Forja', 'Converse sobre criação de mundos, campanhas e mesas.') + toolbar + newPost + `<div class="community-list">${posts}</div>`);
  }
  function reportFields() {
    return `<label class="field-label">Motivo<select class="text-field" name="reason"><option value="spam">Spam</option><option value="abuse">Assédio ou abuso</option><option value="privacy">Privacidade</option><option value="rights">Direitos autorais</option><option value="other">Outro</option></select></label><label class="field-label">Detalhes (opcional)<textarea class="text-field community-textarea" name="details" maxlength="1000"></textarea></label><button class="button button-quiet button-small" type="submit">Enviar denúncia</button>`;
  }

  async function renderShowcase() {
    const root = rootFor('vitrine');
    if (!root || !ensureEnabled(root)) return;
    root.innerHTML = heading('MUNDOS DA COMUNIDADE', 'Vitrine de Mundos', 'Descubra cenários compartilhados voluntariamente por seus criadores.')
      + '<div class="community-loading" role="status">Carregando mundos públicos…</div>';
    try {
      const publicRows = await request('/rest/v1/worldforge_showcase?select=id,creator_name,world_name,summary,realm_names,city_names,updated_at&published=eq.true&order=updated_at.desc&limit=' + limit);
      let ownRows = [];
      if (signedIn()) ownRows = await request(`/rest/v1/worldforge_showcase?select=id,owner_id,local_world_id,creator_name,world_name,summary,realm_names,city_names,published,updated_at&owner_id=eq.${encodeURIComponent(app.user.id)}&order=updated_at.desc&limit=100`);
      if (!Array.isArray(publicRows) || !Array.isArray(ownRows)) throw new Error('Resposta inválida da vitrine.');
      const ownIds = new Set(ownRows.map(row => row.id));
      state.showcase = [...ownRows, ...publicRows.filter(row => !ownIds.has(row.id))];
      renderShowcaseContent();
    } catch (error) {
      setRoot('vitrine', heading('MUNDOS DA COMUNIDADE', 'Vitrine de Mundos', 'Descubra cenários compartilhados voluntariamente por seus criadores.') + errorPanel(error, 'vitrine'));
    }
  }
  function renderShowcaseContent() {
    const world = app.getWorld();
    const localId = app.activeWorldId;
    const owned = signedIn() && state.showcase.find(item => item.local_world_id === localId && item.owner_id === app.user.id);
    const publishForm = signedIn() && world && localId
      ? `<section class="community-card"><h2>${owned?.published ? 'Sua publicação' : 'Compartilhar um mundo'}</h2><p class="community-note">Nada será publicado sem confirmação. Só o resumo e os nomes listados abaixo serão enviados; personagens, missões, eventos, anotações e o arquivo completo permanecem privados.</p><form class="community-form" data-community-form="publish-world" data-existing-id="${esc(owned?.id || '')}"><label class="field-label">Como quer aparecer?<input class="text-field" name="creator_name" required minlength="1" maxlength="40" value="${esc(owned?.creator_name || app.displayName)}"></label><label class="field-label">Resumo público<textarea class="text-field community-textarea" name="summary" required minlength="20" maxlength="600" placeholder="Descreva o que torna este cenário interessante."></textarea></label><div class="community-preview"><strong>Prévia dos dados públicos</strong><p><b>Mundo:</b> ${esc(world.metadata.nome)}</p><p><b>Reinos:</b> ${esc(world.reinos.slice(0, 12).map(item => item.nome).join(', ') || 'Nenhum')}</p><p><b>Cidades:</b> ${esc(world.cidades.slice(0, 12).map(item => item.nome).join(', ') || 'Nenhuma')}</p></div><label class="community-consent"><input type="checkbox" name="confirm_public" required><span>Entendo que este resumo ficará visível publicamente enquanto publicado.</span></label><div class="community-form-actions"><button class="button button-primary button-small" type="submit">${owned ? 'Atualizar publicação' : 'Publicar resumo'}</button>${owned?.published ? '<button type="button" class="button button-quiet button-small" data-community-action="unpublish" data-record-id="' + esc(owned.id) + '">Retirar da vitrine</button>' : ''}</div></form></section>`
      : signedIn() ? '<div class="community-notice"><strong>Selecione um mundo</strong><p>Abra um mundo salvo para preparar uma prévia de publicação.</p><button class="button button-quiet button-small" data-action="library">Abrir biblioteca</button></div>' : authNotice('Entre para compartilhar um resumo de um mundo seu.');
    const entries = state.showcase.map(item => {
      const own = signedIn() && item.owner_id === app.user.id;
      return `<article class="community-card showcase-card"><div class="community-record-meta"><span class="entity-tag">${own && !item.published ? 'Rascunho privado' : 'Público'}</span><strong>${esc(item.creator_name)}</strong><time>${esc(date(item.updated_at))}</time></div><h2>${esc(item.world_name)}</h2><p class="community-record-body">${esc(item.summary)}</p>${item.realm_names?.length ? `<p><b>Reinos:</b> ${item.realm_names.map(esc).join(' · ')}</p>` : ''}${item.city_names?.length ? `<p><b>Cidades:</b> ${item.city_names.map(esc).join(' · ')}</p>` : ''}${own && item.published ? `<button class="button button-quiet button-small" data-community-action="unpublish" data-record-id="${esc(item.id)}">Retirar da vitrine</button>` : ''}${!own && signedIn() ? `<button class="button button-quiet button-small" data-community-action="report" data-content-type="showcase" data-record-id="${esc(item.id)}">Denunciar</button>` : ''}<form class="community-report-form hidden" data-community-form="report" data-record-id="${esc(item.id)}" data-content-type="showcase">${reportFields()}</form></article>`;
    }).join('') || '<div class="community-empty">Ainda não há mundos publicados. A primeira publicação é sempre voluntária.</div>';
    setRoot('vitrine', heading('MUNDOS DA COMUNIDADE', 'Vitrine de Mundos', 'Explore resumos públicos. A publicação não compartilha o arquivo privado do mundo.')
      + publishForm + `<div class="community-section-heading"><h2>Explorar</h2><span>${state.showcase.filter(item => item.published).length} públicos</span></div><div class="community-grid">${entries}</div>`);
  }

  async function renderGuilds() {
    const root = rootFor('guilda');
    if (!root || !ensureEnabled(root)) return;
    if (!signedIn()) {
      setRoot('guilda', heading('JORNADA EM EQUIPE', 'Guilda de Criadores', 'Espaços privados para organizar campanhas e ideias em grupo.') + authNotice('As guildas e seus murais só podem ser acessados por participantes convidados.'));
      return;
    }
    root.innerHTML = heading('JORNADA EM EQUIPE', 'Guilda de Criadores', 'Espaços privados para organizar campanhas e ideias em grupo.')
      + '<div class="community-loading" role="status">Carregando suas guildas…</div>';
    try {
      state.guilds = await request(`/rest/v1/worldforge_guilds?select=id,owner_id,name,description,created_at&order=created_at.desc&limit=100`, { requireAuth: true });
      if (!Array.isArray(state.guilds)) throw new Error('Resposta inválida das guildas.');
      if (state.selectedGuild && !state.guilds.some(guild => guild.id === state.selectedGuild.id)) state.selectedGuild = null;
      if (state.selectedGuild) {
        state.selectedGuild = state.guilds.find(guild => guild.id === state.selectedGuild.id);
        const filter = `guild_id=eq.${encodeURIComponent(state.selectedGuild.id)}`;
        [state.members, state.messages] = await Promise.all([
          request(`/rest/v1/worldforge_guild_members?select=user_id,role,joined_at&${filter}&order=joined_at.asc`, { requireAuth: true }),
          request(`/rest/v1/worldforge_guild_messages?select=id,author_id,author_name,body,created_at,updated_at&${filter}&order=created_at.asc&limit=100`, { requireAuth: true })
        ]);
        if (!Array.isArray(state.members) || !Array.isArray(state.messages)) throw new Error('Resposta inválida do mural privado.');
      }
      renderGuildContent();
    } catch (error) {
      setRoot('guilda', heading('JORNADA EM EQUIPE', 'Guilda de Criadores', 'Espaços privados para organizar campanhas e ideias em grupo.') + errorPanel(error, 'guilda'));
    }
  }
  function renderGuildContent() {
    const selected = state.selectedGuild;
    const isOwner = selected?.owner_id === app.user.id;
    const create = `<section class="community-card"><h2>Criar guilda</h2><form class="community-form community-inline-form" data-community-form="create-guild"><label class="field-label">Nome<input class="text-field" name="name" required minlength="3" maxlength="60"></label><label class="field-label">Descrição (opcional)<input class="text-field" name="description" maxlength="500"></label><button class="button button-primary button-small" type="submit">Criar</button></form></section>`;
    const join = `<section class="community-card"><h2>Entrar com convite</h2><form class="community-form community-inline-form" data-community-form="join-guild"><label class="field-label">Código de convite<input class="text-field" name="invite" required placeholder="id.token" autocomplete="off"></label><button class="button button-quiet button-small" type="submit">Entrar na guilda</button></form></section>`;
    const guildList = state.guilds.map(guild => `<button class="community-guild-item ${selected?.id === guild.id ? 'active' : ''}" data-community-action="open-guild" data-record-id="${esc(guild.id)}"><strong>${esc(guild.name)}</strong><small>${esc(guild.description || 'Sem descrição')}</small><span>${guild.owner_id === app.user.id ? 'Sua guilda' : 'Participante'}</span></button>`).join('') || '<p class="community-empty">Você ainda não participa de uma guilda.</p>';
    let detail = '<div class="community-card community-empty">Selecione uma guilda ou crie uma nova. O acesso é privado por convite.</div>';
    if (selected) {
      const roster = state.members.map(member => `<div class="community-member"><span>${member.role === 'owner' ? 'Proprietário' : 'Membro'}</span>${isOwner && member.user_id !== app.user.id ? `<button type="button" data-community-action="remove-member" data-member-id="${esc(member.user_id)}" data-record-id="${esc(selected.id)}">Remover</button>` : ''}</div>`).join('');
      const messages = state.messages.map(message => `<article class="community-reply"><div class="community-record-meta"><strong>${esc(message.author_name)}</strong><time>${esc(date(message.created_at))}</time>${(message.author_id === app.user.id || isOwner) ? `<button data-community-action="delete-message" data-record-id="${esc(message.id)}">Excluir</button>` : ''}</div><p class="community-record-body">${esc(message.body)}</p></article>`).join('') || '<p class="community-empty">O mural ainda está vazio.</p>';
      const ownerActions = isOwner
        ? `<button class="button button-quiet button-small" data-community-action="create-invite" data-record-id="${esc(selected.id)}">Gerar convite de 7 dias</button><button class="button button-quiet button-small" data-community-action="delete-guild" data-record-id="${esc(selected.id)}">Excluir guilda</button>`
        : `<button class="button button-quiet button-small" data-community-action="leave-guild" data-record-id="${esc(selected.id)}">Sair da guilda</button>`;
      detail = `<section class="community-card guild-detail"><div class="community-section-heading"><div><h2>${esc(selected.name)}</h2><p>${esc(selected.description)}</p></div><div class="community-form-actions">${ownerActions}</div></div>${state.inviteCode ? `<div class="community-invite" role="status"><strong>Convite válido por 7 dias (até 20 usos)</strong><code>${esc(state.inviteCode)}</code><button class="button button-quiet button-small" data-community-action="copy-invite">Copiar convite</button><button class="community-record-actions" data-community-action="dismiss-invite">Fechar</button></div>` : ''}<h3>Participantes (${state.members.length})</h3><div class="community-roster">${roster}</div><h3>Mural privado</h3><div class="community-messages">${messages}</div><form class="community-form" data-community-form="guild-message"><label class="field-label">Mensagem<textarea class="text-field community-textarea" name="body" required maxlength="2000" placeholder="Compartilhe um próximo passo ou uma ideia."></textarea></label><button class="button button-primary button-small" type="submit">Publicar no mural</button></form></section>`;
    }
    setRoot('guilda', heading('JORNADA EM EQUIPE', 'Guilda de Criadores', 'Conteúdo privado visível apenas a participantes convidados.')
      + `<div class="community-grid guild-create-grid">${create}${join}</div><div class="community-guild-layout"><section class="community-card"><h2>Suas guildas (${state.guilds.length})</h2><div class="community-guild-list">${guildList}</div></section>${detail}</div>`);
  }

  async function refresh(view = state.view) {
    if (view === 'foruns') await renderForum();
    if (view === 'vitrine') await renderShowcase();
    if (view === 'guilda') await renderGuilds();
  }
  async function submitForm(form) {
    const fields = Object.fromEntries(new FormData(form));
    const type = form.dataset.communityForm;
    if (type === 'new-post') {
      const post = validate.forumPost({ ...fields, author_name: app.displayName });
      await request('/rest/v1/worldforge_forum_posts', {
        requireAuth: true, method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ...post, author_id: app.user.id })
      });
      state.editing = null;
      return refresh('foruns');
    }
    if (type === 'edit-post') {
      const post = state.posts.find(item => item.id === form.dataset.recordId);
      if (!post || post.author_id !== app.user.id) throw new Error('Você só pode editar seus próprios tópicos.');
      const clean = validate.forumPost({ ...post, ...fields, author_name: post.author_name });
      await request(`/rest/v1/worldforge_forum_posts?id=eq.${encodeURIComponent(post.id)}`, {
        requireAuth: true, method: 'PATCH', body: JSON.stringify({ category: clean.category, title: clean.title, body: clean.body })
      });
      state.editing = null;
      return refresh('foruns');
    }
    if (type === 'reply') {
      const reply = validate.forumReply({ ...fields, author_name: app.displayName });
      await request('/rest/v1/worldforge_forum_replies', {
        requireAuth: true, method: 'POST', body: JSON.stringify({ ...reply, author_id: app.user.id, post_id: state.selectedPost.id })
      });
      return refresh('foruns');
    }
    if (type === 'edit-reply') {
      const reply = state.replies.find(item => item.id === form.dataset.recordId);
      if (!reply || reply.author_id !== app.user.id) throw new Error('Você só pode editar suas próprias respostas.');
      const clean = validate.forumReply({ ...fields, author_name: reply.author_name });
      await request(`/rest/v1/worldforge_forum_replies?id=eq.${encodeURIComponent(reply.id)}`, {
        requireAuth: true, method: 'PATCH', body: JSON.stringify({ body: clean.body })
      });
      state.editing = null;
      return refresh('foruns');
    }
    if (type === 'report') {
      const contentId = form.dataset.recordId;
      const contentType = form.dataset.contentType;
      if (!['forum_post', 'forum_reply', 'showcase'].includes(contentType) || !contentId) throw new Error('Conteúdo inválido para denúncia.');
      const details = validateText(fields.details || '', 'Os detalhes', 1000);
      if (!['spam', 'abuse', 'privacy', 'rights', 'other'].includes(fields.reason)) throw new Error('Motivo inválido.');
      await request('/rest/v1/worldforge_community_reports', {
        requireAuth: true, method: 'POST', body: JSON.stringify({
          reporter_id: app.user.id, content_type: contentType, content_id: contentId,
          reason: fields.reason, details
        })
      });
      window.alert('Denúncia enviada para triagem. Obrigado por ajudar a manter a comunidade segura.');
      return;
    }
    if (type === 'publish-world') {
      if (!form.elements.confirm_public.checked) throw new Error('Confirme que entendeu quais dados ficarão públicos.');
      const draft = validate.showcaseDraft(app.getWorld(), { ...fields, creator_name: fields.creator_name });
      const payload = {
        owner_id: app.user.id, local_world_id: app.activeWorldId, ...draft, published: true
      };
      const existingId = form.dataset.existingId;
      const path = existingId
        ? `/rest/v1/worldforge_showcase?id=eq.${encodeURIComponent(existingId)}`
        : '/rest/v1/worldforge_showcase';
      await request(path, {
        requireAuth: true, method: existingId ? 'PATCH' : 'POST',
        headers: existingId ? {} : { Prefer: 'return=minimal' },
        body: JSON.stringify(existingId ? { ...draft, published: true } : payload)
      });
      window.alert('Resumo publicado. Você pode retirá-lo da vitrine quando quiser.');
      return refresh('vitrine');
    }
    if (type === 'create-guild') {
      const details = validate.guild(fields);
      await request('/rest/v1/rpc/worldforge_create_guild', {
        requireAuth: true, method: 'POST', body: JSON.stringify({ p_name: details.name, p_description: details.description })
      });
      return refresh('guilda');
    }
    if (type === 'join-guild') {
      const invite = validate.inviteCode(fields.invite);
      await request('/rest/v1/rpc/worldforge_join_guild', {
        requireAuth: true, method: 'POST', body: JSON.stringify({ p_guild_id: invite.guildId, p_token: invite.token })
      });
      state.selectedGuild = null;
      window.alert('Convite aceito. Agora você participa desta guilda privada.');
      return refresh('guilda');
    }
    if (type === 'guild-message') {
      const body = validateText(fields.body, 'A mensagem', 2000, 1);
      await request('/rest/v1/worldforge_guild_messages', {
        requireAuth: true, method: 'POST', body: JSON.stringify({
          guild_id: state.selectedGuild.id, author_id: app.user.id, author_name: app.displayName, body
        })
      });
      return refresh('guilda');
    }
  }
  function validateText(value, label, max, min = 0) {
    if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
      throw new Error(`${label} deve ter entre ${min} e ${max} caracteres.`);
    }
    return value.trim();
  }
  async function handleAction(button) {
    const action = button.dataset.communityAction;
    const id = button.dataset.recordId;
    if (action === 'retry') return refresh(button.dataset.viewName);
    if (action === 'new-post') { state.editing = { kind: 'new-post' }; return renderForumContent(); }
    if (action === 'cancel-edit') { state.editing = null; return renderForumContent(); }
    if (action === 'forum-back') { state.selectedPost = null; state.replies = []; state.editing = null; return renderForumContent(); }
    if (action === 'open-post') {
      state.selectedPost = state.posts.find(post => post.id === id) || null;
      state.editing = null;
      return refresh('foruns');
    }
    if (action === 'edit-post') { state.editing = { kind: 'post', id }; return renderForumContent(); }
    if (action === 'edit-reply') { state.editing = { kind: 'reply', id }; return renderForumContent(); }
    if (action === 'delete-post' || action === 'delete-reply') {
      const post = state.posts.find(item => item.id === id);
      const reply = state.replies.find(item => item.id === id);
      const record = action === 'delete-post' ? post : reply;
      if (!record || record.author_id !== app.user?.id || !window.confirm('Excluir este conteúdo? Esta ação não pode ser desfeita.')) return;
      const table = action === 'delete-post' ? 'worldforge_forum_posts' : 'worldforge_forum_replies';
      await request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, { requireAuth: true, method: 'DELETE' });
      if (action === 'delete-post') { state.selectedPost = null; state.replies = []; }
      state.editing = null;
      return refresh('foruns');
    }
    if (action === 'report') {
      if (!signedIn()) return window.alert('Entre na conta para enviar uma denúncia.');
      const form = button.closest('.community-reply')?.querySelector('.community-report-form')
        || button.closest('.community-post-card')?.querySelector('.community-report-form')
        || button.closest('.community-card')?.querySelector('.community-report-form');
      if (!form) return window.alert('Não foi possível abrir a denúncia.');
      form.classList.toggle('hidden');
      form.elements.details?.focus();
      return;
    }
    if (action === 'unpublish') {
      if (!window.confirm('Retirar este resumo da vitrine pública?')) return;
      await request(`/rest/v1/worldforge_showcase?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(app.user.id)}`, {
        requireAuth: true, method: 'PATCH', body: JSON.stringify({ published: false })
      });
      return refresh('vitrine');
    }
    if (action === 'open-guild') {
      state.selectedGuild = state.guilds.find(guild => guild.id === id) || null;
      state.inviteCode = '';
      return refresh('guilda');
    }
    if (action === 'create-invite') {
      if (!window.crypto?.randomUUID) throw new Error('Este navegador não oferece geração segura de convites.');
      const token = crypto.randomUUID();
      await request('/rest/v1/rpc/worldforge_create_guild_invite', {
        requireAuth: true, method: 'POST', body: JSON.stringify({ p_guild_id: id, p_token: token })
      });
      state.inviteCode = `${id}.${token}`;
      return renderGuildContent();
    }
    if (action === 'copy-invite') {
      if (!state.inviteCode) return;
      await navigator.clipboard.writeText(state.inviteCode);
      return window.alert('Convite copiado. Envie-o somente às pessoas que devem entrar na guilda.');
    }
    if (action === 'dismiss-invite') { state.inviteCode = ''; return renderGuildContent(); }
    if (action === 'remove-member') {
      if (!window.confirm('Remover esta pessoa da guilda?')) return;
      await request(`/rest/v1/worldforge_guild_members?guild_id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(button.dataset.memberId)}`, {
        requireAuth: true, method: 'DELETE'
      });
      return refresh('guilda');
    }
    if (action === 'leave-guild' || action === 'delete-guild') {
      const prompt = action === 'delete-guild'
        ? 'Excluir esta guilda e todo o mural para todos os participantes?'
        : 'Sair desta guilda? Você precisará de um novo convite para voltar.';
      if (!window.confirm(prompt)) return;
      if (action === 'delete-guild') {
        await request(`/rest/v1/worldforge_guilds?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(app.user.id)}`, { requireAuth: true, method: 'DELETE' });
      } else {
        await request(`/rest/v1/worldforge_guild_members?guild_id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(app.user.id)}&role=eq.member`, { requireAuth: true, method: 'DELETE' });
      }
      state.selectedGuild = null;
      state.inviteCode = '';
      return refresh('guilda');
    }
    if (action === 'delete-message') {
      if (!window.confirm('Excluir esta mensagem do mural?')) return;
      await request(`/rest/v1/worldforge_guild_messages?id=eq.${encodeURIComponent(id)}&guild_id=eq.${encodeURIComponent(state.selectedGuild.id)}`, { requireAuth: true, method: 'DELETE' });
      return refresh('guilda');
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-community-action]');
    if (!button) return;
    event.preventDefault();
    handleAction(button).catch(error => window.alert(error.message || 'A ação não foi concluída.'));
  });
  document.addEventListener('submit', event => {
    const form = event.target.closest('[data-community-form]');
    if (!form) return;
    event.preventDefault();
    submitForm(form).catch(error => window.alert(error.message || 'A ação não foi concluída.'));
  });

  window.WORLDFORGE_COMMUNITY = Object.freeze({ render: refresh });
  const initialView = window.location.hash.slice(1);
  if (['foruns', 'vitrine', 'guilda'].includes(initialView)) refresh(initialView);
})();

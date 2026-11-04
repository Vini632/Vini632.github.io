import {
  uid,
  dateKey,
  addDays,
  seed,
  tasksFor,
  toggleTask,
  reviewCard,
  minutesFor,
  streak,
  descendants,
  parseBackup,
  validateState,
} from "./model.js";
import {
  openStore,
  writeStore,
  escapeHTML as esc,
  download,
} from "./storage.js";
import { mathHTML, mathToolbar, markdown, insertText } from "./math.js";
import { mountDesign } from "./design.js";
const $ = (s) => document.querySelector(s),
  main = $("#main");
const routes = {
  today: "Meu dia",
  tasks: "Rotina de estudos",
  vocabulary: "Vocabulário",
  journal: "Diário em inglês",
  thor: "Projeto THOR",
  settings: "Preferências e backup",
};
let state,
  route = "today",
  day = dateKey(),
  folder = null,
  activeFile = null,
  reviewId = null,
  revealed = false,
  vocabFilter = "",
  fileFilter = "",
  saveTimer,
  unsaved = false,
  failed = false,
  saveChain = Promise.resolve(),
  toastTimer,
  saveRevision = 0;
const channel =
  "BroadcastChannel" in window
    ? new BroadcastChannel("worldforge-english")
    : null;
let externalChange = false;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4200);
}
function setStatus(text, error = false) {
  $("#save-status").textContent = text;
  $("#save-status").classList.toggle("error", error);
}
function persist() {
  clearTimeout(saveTimer);
  if (externalChange)
    return Promise.reject(new Error("Recarregue a página para continuar."));
  unsaved = true;
  setStatus("Salvando…");
  const copy = structuredClone(state),
    revision = ++saveRevision;
  saveChain = saveChain
    .catch(() => {})
    .then(() => {
      if (externalChange) throw new Error("Dados atualizados em outra aba.");
      return writeStore(copy);
    })
    .then(() => {
      if (revision === saveRevision) {
        unsaved = false;
        failed = false;
        setStatus("Salvo neste navegador");
      }
      channel?.postMessage("changed");
    })
    .catch((error) => {
      failed = true;
      unsaved = true;
      setStatus("Falha ao salvar — exporte backup", true);
      toast(
        "Falha no armazenamento. Exporte um backup antes de fechar a página.",
      );
      throw error;
    });
  saveChain.catch(() => {});
  return saveChain;
}
function scheduleSave() {
  saveRevision++;
  unsaved = true;
  setStatus("Alterações pendentes…");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persist(), 350);
}
function heading(eyebrow, title, subtitle, action = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`;
}
function empty(title, copy) {
  return `<div class="empty"><span>✧</span><h3>${title}</h3><p>${copy}</p></div>`;
}
function categoryClass(c) {
  return c.toLowerCase();
}
function taskRows(tasks, selectedDay) {
  return tasks.length
    ? tasks
        .map(
          (t) =>
            `<div class="task-row ${t.done.includes(selectedDay) ? "is-done" : ""}"><input class="task-check" type="checkbox" data-task="${t.id}" aria-label="Concluir: ${esc(t.title)}" ${t.done.includes(selectedDay) ? "checked" : ""}><div class="task-details"><span class="task-title">${esc(t.title)}</span><div class="task-meta"><span class="category ${categoryClass(t.category)}">${t.category}</span><span>${t.minutes} min</span>${t.repeat ? '<span title="Repete todos os dias a partir da data inicial">↻ Diária</span>' : ""}</div></div><button class="icon-btn" data-edit-task="${t.id}" title="Editar tarefa" aria-label="Editar ${esc(t.title)}">↗</button><button class="icon-btn delete" data-delete-task="${t.id}" title="Excluir tarefa" aria-label="Excluir ${esc(t.title)}">×</button></div>`,
        )
        .join("")
    : empty(
        "Espaço para o próximo passo",
        "Adicione uma tarefa e comece no seu ritmo.",
      );
}
function bindTasks(selectedDay) {
  main.querySelectorAll("[data-task]").forEach(
    (b) =>
      (b.onchange = () => {
        const task = state.tasks.find((t) => t.id === b.dataset.task);
        toggleTask(task, selectedDay);
        persist();
        render();
      }),
  );
  main
    .querySelectorAll("[data-edit-task]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          taskDialog(state.tasks.find((t) => t.id === b.dataset.editTask))),
    );
  main.querySelectorAll("[data-delete-task]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (
          await confirmDialog(
            "Excluir tarefa?",
            "A tarefa e todas as marcações dela serão removidas.",
          )
        ) {
          state.tasks = state.tasks.filter(
            (t) => t.id !== b.dataset.deleteTask,
          );
          persist();
          render();
        }
      }),
  );
  main
    .querySelectorAll("[data-new-task]")
    .forEach((b) => (b.onclick = () => taskDialog()));
}
async function dialog(title, fields, submit = "Salvar") {
  if ($("#dialog").open) return null;
  $("#dialog-title").textContent = title;
  $("#dialog-fields").innerHTML = fields;
  $("#dialog-submit").textContent = submit;
  $("#dialog").showModal();
  return new Promise((resolve) => {
    const form = $("#dialog-form"),
      dlg = $("#dialog");
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      dlg.close();
      form.onsubmit = null;
      dlg.oncancel = null;
      resolve(value);
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      if (form.reportValidity()) finish(Object.fromEntries(new FormData(form)));
    };
    $("#dialog-cancel").onclick = () => finish(null);
    $("#dialog-close").onclick = () => finish(null);
    dlg.oncancel = (e) => {
      e.preventDefault();
      finish(null);
    };
    requestAnimationFrame(() =>
      $(
        "#dialog-fields input, #dialog-fields textarea, #dialog-submit",
      )?.focus(),
    );
  });
}
async function confirmDialog(title, copy) {
  return !!(await dialog(title, `<p>${esc(copy)}</p>`, "Confirmar"));
}
async function taskDialog(task) {
  const result = await dialog(
    task ? "Editar tarefa" : "Um novo passo",
    `<label>Tarefa<input name="title" required maxlength="300" placeholder="Ex.: ler um artigo em inglês" value="${esc(task?.title || "")}"></label><div class="field-grid"><label>Habilidade<select name="category">${["Listening", "Speaking", "Reading", "Writing", "Vocabulary", "Grammar"].map((c) => `<option ${task?.category === c ? "selected" : ""}>${c}</option>`).join("")}</select></label><label>Tempo estimado (min)<input name="minutes" type="number" min="1" max="600" value="${task?.minutes || 10}" required></label></div><label>Data inicial<input name="date" type="date" required value="${task?.date || day}"></label><label class="checkbox-label"><input name="repeat" type="checkbox" ${task?.repeat ? "checked" : ""}> Repetir todos os dias a partir desta data</label><p class="hint">Cada dia tem sua própria marcação. O tempo estudado é registrado nas sessões de foco.</p>`,
  );
  if (!result || !result.title.trim()) return;
  const values = {
    title: result.title.trim(),
    category: result.category,
    minutes: Number(result.minutes),
    date: result.date,
    repeat: result.repeat === "on",
  };
  if (task) Object.assign(task, values);
  else state.tasks.push({ id: uid(), ...values, done: [] });
  persist();
  render();
}
function renderToday() {
  const today = dateKey(),
    tasks = tasksFor(state, today),
    done = tasks.filter((t) => t.done.includes(today)).length,
    minutes = minutesFor(state, today),
    goal = state.settings.goal,
    percent = Math.min(100, Math.round((minutes / goal) * 100));
  main.innerHTML =
    heading(
      "ENGLISH / SEU PRÓXIMO CAPÍTULO",
      `Let's make progress${state.settings.name ? ", " + esc(state.settings.name) : ""}.`,
      "Pequenos passos hoje. Novas possibilidades amanhã.",
      `<span class="date-pill">${new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "long" })}</span>`,
    ) +
    `
  <section class="hero"><div class="hero-copy"><span class="hero-tag"><span class="status-dot"></span> CONSISTENCY OVER PERFECTION</span><h2>Um pouco<br>todos os dias<span class="lime">.</span></h2><p>Aprenda uma palavra. Compartilhe uma ideia.<br>Construa o seu próximo capítulo.</p><button class="button lime-button" id="hero-focus">Começar uma sessão <span>↗</span></button></div><div class="hero-art" aria-hidden="true"><div class="orbit one"></div><div class="orbit two"></div><div class="orbit three"></div><span class="art-star">✳</span><div class="art-card card-back">a little<br>better.</div><div class="art-card card-front"><span class="art-small">WORD OF THE DAY</span><strong>become</strong><span>/bɪˈkʌm/</span><div class="art-line"></div><span>tornar-se</span><small>You're becoming your future self.</small></div><span class="floating-label">keep growing ↗</span></div></section>
  <section class="stats-grid" aria-label="Seu progresso"><div class="stat"><span class="stat-icon green">◷</span><div><span>Tempo estudado hoje</span><strong>${minutes}<small> / ${goal} min</small></strong></div><div class="mini-progress" style="--progress:${percent}%"><span>${percent}%</span></div></div><div class="stat"><span class="stat-icon peach">✓</span><div><span>Passos concluídos</span><strong>${done}<small> / ${tasks.length} tarefas</small></strong></div></div><div class="stat"><span class="stat-icon lavender">ϟ</span><div><span>Sequência de estudo</span><strong>${streak(state, today)}<small> dias</small></strong></div></div></section>
  <div class="dashboard-grid"><section class="panel"><div class="panel-heading"><div><h2>Seu plano de hoje <span class="count">${tasks.length}</span></h2><p>Uma tarefa de cada vez.</p></div><button class="button small secondary" data-new-task>+ Nova tarefa</button></div><div>${taskRows(tasks, today)}</div><a class="panel-link" href="#tasks">Organizar minha rotina <span>→</span></a></section><section class="panel focus-panel" id="focus-panel"><div class="panel-heading"><h2>Hora de focar</h2><span class="eyebrow">POMODORO</span></div><div class="focus-ring"><span class="focus-clock" id="focus-clock">25:00</span><span id="focus-caption">UM PASSO DE CADA VEZ</span></div><div class="focus-controls"><button class="button" id="timer-toggle">Iniciar foco</button><button class="icon-btn reset-btn" id="timer-reset" aria-label="Reiniciar cronômetro">↺</button></div><button class="text-button" id="manual-session">+ Registrar estudo manualmente</button><p class="hint">Somente sessões de inglês entram na meta diária.</p></section></div>
  <div class="dashboard-grid bottom-grid"><section class="panel week-panel"><div class="panel-heading"><div><h2>Seu ritmo, nesta semana</h2><p>Tempo registrado nos últimos sete dias.</p></div><span class="eyebrow">7 DIAS</span></div><div class="week-bars">${Array.from(
    { length: 7 },
    (_, i) => {
      const d = addDays(today, i - 6),
        m = minutesFor(state, d);
      return `<div class="week-day ${d === today ? "current" : ""}"><span>${m} min</span><div class="bar-track"><div class="bar-fill" style="height:${Math.min(100, (m / goal) * 100)}%"></div></div><small>${new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</small></div>`;
    },
  ).join(
    "",
  )}</div></section><a class="thor-teaser" href="#thor"><div class="teaser-top"><span class="eyebrow">SEU LABORATÓRIO DE IDEIAS</span><span>↗</span></div><span class="thor-symbol">✳</span><h2>Think beyond.<br>Build THOR.</h2><p>Notas, fórmulas e designs.<br>Uma ideia ganha forma aqui.</p><span class="teaser-bottom">ABRIR PROJETO <span>→</span></span></a></div>`;
  bindTasks(today);
  $("#timer-toggle").onclick = toggleTimer;
  $("#timer-reset").onclick = resetTimer;
  $("#manual-session").onclick = manualSession;
  $("#hero-focus").onclick = () => {
    $("#focus-panel").scrollIntoView({ behavior: "smooth", block: "center" });
    if (!state.timer?.end) toggleTimer();
  };
  updateClock();
}
function renderTasks() {
  const tasks = tasksFor(state, day);
  main.innerHTML =
    heading(
      "ENGLISH / ROTINA",
      "Make room for learning.",
      "Planeje suas habilidades, acompanhe seus dias e mantenha o ritmo.",
      `<button class="button" data-new-task>+ Nova tarefa</button>`,
    ) +
    `<div class="toolbar panel"><label class="inline-label">Visualizar dia <input type="date" id="task-date" value="${day}" required></label><button class="button secondary small" id="today-date">Hoje</button><span class="muted">${tasks.filter((t) => t.done.includes(day)).length} de ${tasks.length} concluídas</span></div><section class="panel">${taskRows(tasks, day)}</section><section class="panel history"><div class="panel-heading"><div><h2>Histórico de estudo</h2><p>Sessões de foco e registros manuais de inglês.</p></div><button class="button secondary small" id="manual-session">+ Registrar tempo</button></div>${
      state.sessions.length
        ? [...state.sessions]
            .reverse()
            .slice(0, 100)
            .map(
              (s) =>
                `<div class="history-row"><span>${new Date(s.date + "T12:00:00").toLocaleDateString("pt-BR")}</span><strong>${s.minutes} min</strong><span>${esc(s.label)}</span><button class="icon-btn" data-delete-session="${s.id}" aria-label="Excluir sessão de ${s.minutes} minutos">×</button></div>`,
            )
            .join("")
        : empty(
            "Seu ritmo começa aqui",
            "Inicie um foco no Meu dia ou registre uma sessão de estudo.",
          )
    }<p class="hint">Exibindo até 100 sessões recentes. O backup contém o histórico completo.</p></section>`;
  bindTasks(day);
  $("#task-date").onchange = (e) => {
    if (e.target.value) {
      day = e.target.value;
      render();
    }
  };
  $("#today-date").onclick = () => {
    day = dateKey();
    render();
  };
  $("#manual-session").onclick = manualSession;
  main.querySelectorAll("[data-delete-session]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (
          await confirmDialog(
            "Excluir sessão?",
            "Este tempo será removido do histórico e da meta diária.",
          )
        ) {
          state.sessions = state.sessions.filter(
            (s) => s.id !== b.dataset.deleteSession,
          );
          persist();
          render();
        }
      }),
  );
}
async function manualSession() {
  const r = await dialog(
    "Registrar tempo de estudo",
    `<label>Tempo (minutos)<input name="minutes" type="number" min="1" max="600" value="15" required></label><label>Data<input name="date" type="date" value="${dateKey()}" max="${dateKey()}" required></label><label>O que você estudou?<input name="label" maxlength="100" value="Estudo de inglês" required></label>`,
  );
  if (!r || !r.label.trim()) return;
  state.sessions.push({
    id: uid(),
    date: r.date,
    minutes: Number(r.minutes),
    label: r.label.trim(),
  });
  persist();
  render();
}
function toggleTimer() {
  if (!state.timer)
    state.timer = {
      id: uid(),
      duration: state.settings.focus * 60,
      remaining: state.settings.focus * 60,
      end: null,
    };
  const t = state.timer;
  if (t.end) {
    t.remaining = Math.max(0, Math.ceil((t.end - Date.now()) / 1000));
    t.end = null;
  } else t.end = Date.now() + t.remaining * 1000;
  persist();
  updateClock();
}
async function resetTimer() {
  if (
    state.timer &&
    (await confirmDialog(
      "Reiniciar foco?",
      "O tempo desta sessão ainda não concluída será descartado.",
    ))
  ) {
    state.timer = null;
    persist();
    updateClock();
  }
}
function updateClock() {
  const t = state?.timer;
  let left = t
    ? t.end
      ? Math.max(0, Math.ceil((t.end - Date.now()) / 1000))
      : t.remaining
    : state?.settings.focus * 60;
  if (t?.end && left === 0) {
    state.sessions.push({
      id: t.id,
      date: dateKey(new Date(t.end)),
      minutes: t.duration / 60,
      label: "Sessão de foco",
    });
    state.timer = null;
    persist();
    toast("Sessão concluída! Seu tempo de estudo foi registrado.");
    render();
    return;
  }
  if ($("#focus-clock")) {
    $("#focus-clock").textContent =
      `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
    $("#timer-toggle").textContent = t?.end
      ? "Pausar foco"
      : t
        ? "Continuar"
        : "Iniciar foco";
    $("#focus-caption").textContent = t?.end
      ? "VOCÊ ESTÁ CONSTRUINDO SEU FUTURO"
      : t
        ? "SESSÃO PAUSADA"
        : "UM PASSO DE CADA VEZ";
  }
}
function renderVocabulary() {
  const today = dateKey(),
    due = state.cards.filter((c) => c.due <= today);
  let card = due.find((c) => c.id === reviewId) || due[0];
  reviewId = card?.id;
  const filter = vocabFilter.toLowerCase(),
    cards = state.cards.filter((c) =>
      (c.word + " " + c.meaning).toLowerCase().includes(filter),
    );
  main.innerHTML =
    heading(
      "ENGLISH / VOCABULÁRIO",
      "Words open worlds.",
      "Construa seu repertório com contexto e revisão espaçada.",
      `<button class="button" id="new-card">+ Nova palavra</button>`,
    ) +
    `<div class="vocab-grid"><section class="panel review-panel"><div class="panel-heading"><h2>Revisão do dia</h2><span class="pill">${due.length} pendentes</span></div>${card ? `<div class="flashcard"><span class="eyebrow">COMO VOCÊ DIRIA ISSO EM PORTUGUÊS?</span><h2>${esc(card.word)}</h2><button class="text-button" id="speak-card">◖ Ouvir pronúncia</button>${revealed ? `<div class="card-answer"><strong>${esc(card.meaning)}</strong><p>${esc(card.example || "Adicione uma frase de exemplo para dar contexto.")}</p></div>` : '<p class="muted">Pense no significado e em uma frase de exemplo.</p>'}</div>${revealed ? `<div class="review-actions"><button class="button secondary" id="review-again">Rever hoje</button><button class="button" id="review-known">Lembrei ✓</button></div><p class="hint">Lembrei: próxima revisão em ${card.interval ? Math.min(180, card.interval * 2) : 1} dia(s). Rever hoje: retorna à fila.</p>` : '<button class="button full-width" id="reveal-card">Mostrar significado</button>'}` : empty("Tudo revisado por aqui!", "Adicione novas palavras ou volte na próxima data de revisão.")}</section><section class="panel vocab-library"><div class="panel-heading"><div><h2>Meu repertório <span class="count">${state.cards.length}</span></h2><p>Palavras, significados e suas próprias frases.</p></div></div><label class="search-label"><span>⌕</span><input id="vocab-search" type="search" aria-label="Buscar palavra ou significado" placeholder="Buscar uma palavra…" value="${esc(vocabFilter)}"></label><div id="vocab-list">${cards.length ? cards.map((c) => `<div class="vocab-row"><div><strong>${esc(c.word)}</strong><p>${esc(c.meaning)}</p><small>Revisão: ${new Date(c.due + "T12:00:00").toLocaleDateString("pt-BR")}</small></div><div><button class="icon-btn" data-edit-card="${c.id}" aria-label="Editar ${esc(c.word)}">↗</button><button class="icon-btn" data-delete-card="${c.id}" aria-label="Excluir ${esc(c.word)}">×</button></div></div>`).join("") : empty("Nenhuma palavra encontrada", "Adicione uma palavra ou tente outro termo.")}</div></section></div>`;
  $("#new-card").onclick = () => cardDialog();
  main
    .querySelectorAll("[data-edit-card]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          cardDialog(state.cards.find((c) => c.id === b.dataset.editCard))),
    );
  main.querySelectorAll("[data-delete-card]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (
          await confirmDialog(
            "Excluir palavra?",
            "A palavra e seu histórico de revisão serão removidos.",
          )
        ) {
          state.cards = state.cards.filter(
            (c) => c.id !== b.dataset.deleteCard,
          );
          persist();
          render();
        }
      }),
  );
  $("#vocab-search").oninput = (e) => {
    const pos = e.target.selectionStart;
    vocabFilter = e.target.value;
    renderVocabulary();
    $("#vocab-search").focus();
    $("#vocab-search").setSelectionRange(pos, pos);
  };
  $("#reveal-card")?.addEventListener("click", () => {
    revealed = true;
    renderVocabulary();
  });
  const review = (known) => {
    reviewCard(card, known, today);
    reviewId = due.find((c) => c.id !== card.id)?.id;
    revealed = false;
    persist();
    render();
  };
  $("#review-again")?.addEventListener("click", () => review(false));
  $("#review-known")?.addEventListener("click", () => review(true));
  $("#speak-card")?.addEventListener("click", () => {
    if (!("speechSynthesis" in window)) {
      toast("Pronúncia indisponível neste navegador.");
      return;
    }
    speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(card.word);
    speech.lang = "en-US";
    speech.rate = 0.85;
    speechSynthesis.speak(speech);
  });
}
async function cardDialog(card) {
  const r = await dialog(
    card ? "Editar palavra" : "Uma nova palavra",
    `<label>Palavra ou expressão em inglês<input name="word" maxlength="200" required value="${esc(card?.word || "")}" placeholder="Ex.: figure out"></label><label>Significado<input name="meaning" maxlength="500" required value="${esc(card?.meaning || "")}" placeholder="Ex.: entender, descobrir"></label><label>Frase de exemplo<textarea name="example" maxlength="1000" rows="3" placeholder="I will figure it out.">${esc(card?.example || "")}</textarea></label>`,
  );
  if (!r || !r.word.trim() || !r.meaning.trim()) return;
  const values = {
    word: r.word.trim(),
    meaning: r.meaning.trim(),
    example: r.example.trim(),
  };
  if (card) Object.assign(card, values);
  else
    state.cards.push({
      id: uid(),
      ...values,
      due: dateKey(),
      interval: 0,
      reviews: 0,
    });
  persist();
  render();
}
let journalDate = dateKey();
function renderJournal() {
  const entry = state.journals.find((j) => j.date === journalDate);
  main.innerHTML =
    heading(
      "ENGLISH / DIÁRIO",
      "Put your day into words.",
      "Escreva livremente em inglês. Guarde ideias, novas expressões e pequenas vitórias.",
    ) +
    `<div class="journal-layout"><section class="panel"><div class="panel-heading"><label class="inline-label">Entrada de <input type="date" id="journal-date" value="${journalDate}" required></label><span class="pill" id="word-count">0 palavras</span></div><div class="writing-prompt"><span>WRITING PROMPT</span><p>What did you learn today? What would you like to try tomorrow?</p></div><textarea id="journal-content" class="journal-editor" maxlength="100000" aria-label="Seu diário em inglês" placeholder="Today I learned…">${esc(entry?.content || "")}</textarea><div class="editor-bottom"><span>Salvamento automático</span><div class="button-row"><button class="text-button" id="export-journal">↓ Exportar .txt</button><button class="text-button delete" id="delete-journal">Excluir entrada</button></div></div></section><aside class="panel journal-aside"><h2>Suas páginas</h2><p class="hint">Um registro do quanto você já caminhou.</p>${
      state.journals
        .filter((j) => j.content.trim())
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(
          (j) =>
            `<button class="journal-entry ${j.date === journalDate ? "selected" : ""}" data-journal="${j.date}"><strong>${new Date(j.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}</strong><span>${esc(j.content.slice(0, 65))}</span></button>`,
        )
        .join("") || '<p class="hint">Sua primeira página começa ao lado.</p>'
    }<div class="journal-tip"><span>✧</span><strong>Done is better than perfect.</strong><p>Escreva primeiro. Revise depois. Cada frase é prática.</p></div></aside></div>`;
  const area = $("#journal-content"),
    count = () => {
      $("#word-count").textContent =
        `${area.value.trim() ? area.value.trim().split(/\s+/).length : 0} palavras`;
    };
  count();
  area.oninput = () => {
    let j = state.journals.find((j) => j.date === journalDate);
    if (!j) {
      j = { id: uid(), date: journalDate, content: "" };
      state.journals.push(j);
    }
    j.content = area.value;
    scheduleSave();
    count();
  };
  $("#journal-date").onchange = (e) => {
    if (e.target.value) {
      journalDate = e.target.value;
      render();
    }
  };
  main.querySelectorAll("[data-journal]").forEach(
    (b) =>
      (b.onclick = () => {
        journalDate = b.dataset.journal;
        render();
      }),
  );
  $("#export-journal").onclick = () =>
    download(
      new Blob([area.value], { type: "text/plain;charset=utf-8" }),
      `english-diary-${journalDate}.txt`,
    );
  $("#delete-journal").onclick = async () => {
    if (
      await confirmDialog(
        "Excluir entrada?",
        "Esta página do diário será removida.",
      )
    ) {
      state.journals = state.journals.filter((j) => j.date !== journalDate);
      persist();
      render();
    }
  };
}
const fileIcons = {
  folder: "▱",
  doc: "▤",
  text: "≡",
  formula: "ƒ",
  design: "◈",
  attachment: "↗",
};
function folderPath(id) {
  const path = [];
  let f = state.files.find((f) => f.id === id);
  while (f) {
    path.unshift(f);
    f = state.files.find((p) => p.id === f.parent);
  }
  return path;
}
function renderThor() {
  if (
    folder &&
    !state.files.some((f) => f.id === folder && f.kind === "folder")
  )
    folder = null;
  const current = state.files.find(
    (f) => f.id === activeFile && f.kind !== "folder",
  );
  const children = state.files
    .filter(
      (f) =>
        f.parent === folder &&
        f.name.toLowerCase().includes(fileFilter.toLowerCase()),
    )
    .sort(
      (a, b) =>
        (a.kind === "folder" ? 0 : 1) - (b.kind === "folder" ? 0 : 1) ||
        a.name.localeCompare(b.name),
    );
  main.innerHTML =
    heading(
      "WORLDFORGE / LABORATÓRIO DE IDEIAS",
      'THOR<span class="title-dot">✳</span>',
      "Thermonuclear Heat Optimization Reactor · Reator termonuclear conceitual",
      `<button class="button" id="new-file">+ Criar</button>`,
    ) +
    `<div class="thor-context"><span class="status-dot"></span> PROJETO CONCEITUAL <span class="context-divider">/</span> ${state.files.filter((f) => f.kind !== "folder").length} arquivos <span class="context-divider">/</span> Documente hipóteses, referências e descobertas.</div><div class="workspace panel"><aside class="file-explorer"><div class="explorer-header"><h2>Explorador</h2><button class="icon-btn" id="upload-files" title="Importar arquivos" aria-label="Importar arquivos">↑</button></div><div class="file-breadcrumb"><button data-folder="root">THOR</button>${folderPath(
      folder,
    )
      .map(
        (f) =>
          `<span>/</span><button data-folder="${f.id}">${esc(f.name)}</button>`,
      )
      .join(
        "",
      )}</div><input type="search" id="file-search" aria-label="Buscar na pasta atual" placeholder="Buscar nesta pasta…" value="${esc(fileFilter)}"><div class="file-list">${folder ? '<button class="file-item parent-folder" id="folder-up"><span>↰</span> Voltar uma pasta</button>' : ""}${children.map((f) => `<button class="file-item ${activeFile === f.id ? "selected" : ""}" data-file="${f.id}"><span class="file-type ${f.kind}">${fileIcons[f.kind]}</span><span class="file-name">${esc(f.name)}</span>${f.kind === "folder" ? "<span>›</span>" : ""}</button>`).join("") || '<p class="hint explorer-empty">Nenhum arquivo nesta pasta.</p>'}</div><div class="explorer-footer"><button class="text-button" id="new-folder">+ Nova pasta</button>${folder ? '<button class="text-button" id="rename-folder">Renomear pasta</button><button class="text-button delete" id="delete-folder">Excluir pasta</button>' : ""}</div></aside><section class="file-workspace" id="file-workspace">${current ? `<div class="file-topbar"><div><span class="file-type ${current.kind}">${fileIcons[current.kind]}</span><strong>${esc(current.name)}</strong></div><div class="button-row"><button class="icon-btn" id="rename-file" title="Renomear" aria-label="Renomear arquivo">✎</button><button class="icon-btn" id="move-file" title="Mover" aria-label="Mover arquivo">⇄</button><button class="icon-btn" id="download-file" title="Baixar arquivo" aria-label="Baixar arquivo">↓</button><button class="icon-btn delete" id="delete-file" title="Excluir" aria-label="Excluir arquivo">×</button></div></div><div id="file-editor"></div>` : `<div class="workspace-empty"><span class="workspace-star">✳</span><span class="eyebrow">IDEIAS PRECISAM DE ESPAÇO</span><h2>O próximo conceito<br>começa com uma página.</h2><p>Crie documentos, organize referências, desenhe<br>e dê forma às suas fórmulas matemáticas.</p><div class="creation-options"><button data-create="doc"><span>▤</span> Documento</button><button data-create="formula"><span>√</span> Fórmula</button><button data-create="design"><span>◈</span> Design gráfico</button></div><p class="hint">Tudo é salvo neste navegador. Faça backups em Preferências.</p></div>`}</section></div>`;
  main.querySelectorAll("[data-file]").forEach(
    (b) =>
      (b.onclick = () => {
        const file = state.files.find((f) => f.id === b.dataset.file);
        if (file.kind === "folder") {
          folder = file.id;
          activeFile = null;
          fileFilter = "";
        } else activeFile = file.id;
        render();
      }),
  );
  main.querySelectorAll("[data-folder]").forEach(
    (b) =>
      (b.onclick = () => {
        folder = b.dataset.folder === "root" ? null : b.dataset.folder;
        activeFile = null;
        fileFilter = "";
        render();
      }),
  );
  $("#folder-up")?.addEventListener("click", () => {
    folder = state.files.find((f) => f.id === folder)?.parent ?? null;
    activeFile = null;
    fileFilter = "";
    render();
  });
  $("#file-search").oninput = (e) => {
    fileFilter = e.target.value;
    const pos = e.target.selectionStart;
    renderThor();
    $("#file-search").focus();
    $("#file-search").setSelectionRange(pos, pos);
  };
  $("#new-file").onclick = () => newFile();
  $("#new-folder").onclick = () => newFile("folder");
  main
    .querySelectorAll("[data-create]")
    .forEach((b) => (b.onclick = () => newFile(b.dataset.create)));
  $("#upload-files").onclick = () => $("#attachment-input").click();
  $("#rename-folder")?.addEventListener("click", () =>
    renameFile(state.files.find((f) => f.id === folder)),
  );
  $("#delete-folder")?.addEventListener("click", () =>
    deleteFile(state.files.find((f) => f.id === folder)),
  );
  if (current) {
    $("#rename-file").onclick = () => renameFile(current);
    $("#delete-file").onclick = () => deleteFile(current);
    $("#move-file").onclick = () => moveFile(current);
    $("#download-file").onclick = () => downloadFile(current);
    renderFileEditor(current);
  }
}
async function newFile(kind) {
  const fields = `${kind ? `<input type="hidden" name="kind" value="${kind}">` : '<label>Tipo<select name="kind"><option value="doc">Documento (Markdown + fórmulas)</option><option value="text">Arquivo de texto</option><option value="formula">Fórmula matemática (LaTeX)</option><option value="design">Design gráfico</option><option value="folder">Pasta</option></select></label>'}<label>Nome<input name="name" maxlength="180" required placeholder="Dê um nome à sua ideia"></label>`;
  const r = await dialog(
    kind === "folder" ? "Nova pasta" : "Criar no THOR",
    fields,
    "Criar",
  );
  if (!r || !r.name.trim()) return;
  let name = r.name.trim();
  const extensions = {
    doc: ".md",
    text: ".txt",
    formula: ".tex",
    design: ".design.json",
  };
  if (extensions[r.kind] && !name.toLowerCase().endsWith(extensions[r.kind]))
    name += extensions[r.kind];
  if (
    state.files.some(
      (f) => f.parent === folder && f.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    toast("Já existe um item com esse nome nesta pasta.");
    return;
  }
  const f = {
    id: uid(),
    parent: folder,
    kind: r.kind,
    name,
    content:
      r.kind === "design"
        ? "[]"
        : r.kind === "formula"
          ? "x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}"
          : "",
    updated: new Date().toISOString(),
  };
  state.files.push(f);
  if (f.kind === "folder") {
    folder = f.id;
    activeFile = null;
  } else activeFile = f.id;
  persist();
  fileFilter = "";
  render();
}
async function renameFile(file) {
  const r = await dialog(
    "Renomear",
    `<label>Novo nome<input name="name" maxlength="200" required value="${esc(file.name)}"></label>`,
  );
  if (!r || !r.name.trim()) return;
  if (
    state.files.some(
      (f) =>
        f.id !== file.id &&
        f.parent === file.parent &&
        f.name.toLowerCase() === r.name.trim().toLowerCase(),
    )
  ) {
    toast("Já existe um item com esse nome.");
    return;
  }
  file.name = r.name.trim();
  file.updated = new Date().toISOString();
  persist();
  render();
}
async function deleteFile(file) {
  const ids = descendants(state.files, file.id);
  if (
    !(await confirmDialog(
      file.kind === "folder" ? "Excluir pasta e conteúdo?" : "Excluir arquivo?",
      `“${file.name}” será removido${ids.size > 1 ? ` junto com ${ids.size - 1} item(ns)` : ""}.`,
    ))
  )
    return;
  state.files = state.files.filter((f) => !ids.has(f.id));
  if (ids.has(activeFile)) activeFile = null;
  if (ids.has(folder)) folder = file.parent;
  persist();
  render();
}
async function moveFile(file) {
  const r = await dialog(
    "Mover arquivo",
    `<label>Pasta de destino<select name="parent"><option value="">THOR (raiz)</option>${state.files
      .filter((f) => f.kind === "folder")
      .map(
        (f) =>
          `<option value="${f.id}" ${file.parent === f.id ? "selected" : ""}>${esc(
            folderPath(f.id)
              .map((p) => p.name)
              .join(" / "),
          )}</option>`,
      )
      .join("")}</select></label>`,
  );
  if (!r) return;
  const parent = r.parent || null;
  if (
    state.files.some(
      (f) =>
        f.id !== file.id &&
        f.parent === parent &&
        f.name.toLowerCase() === file.name.toLowerCase(),
    )
  ) {
    toast("Já existe um arquivo com esse nome no destino.");
    return;
  }
  file.parent = parent;
  folder = parent;
  persist();
  render();
}
function downloadFile(file) {
  if (file.kind === "attachment") {
    const [header, encoded] = file.content.split(",");
    const binary = atob(encoded),
      bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    download(
      new Blob([bytes], { type: "application/octet-stream" }),
      file.name,
    );
  } else
    download(
      new Blob([file.content], {
        type:
          file.kind === "design"
            ? "application/json"
            : "text/plain;charset=utf-8",
      }),
      file.name,
    );
}
function renderFileEditor(file) {
  const host = $("#file-editor");
  const onChange = () => {
    file.updated = new Date().toISOString();
    scheduleSave();
  };
  if (file.kind === "design") {
    mountDesign(host, file, onChange, toast);
    return;
  }
  if (file.kind === "attachment") {
    host.innerHTML = `<div class="attachment-preview"><span>${fileIcons.attachment}</span><h2>${esc(file.name)}</h2><p>Arquivo importado · ${esc(file.mime || "arquivo")}</p><button class="button" id="download-attachment">↓ Baixar arquivo</button><p class="hint">Arquivos importados ficam anexados. O conteúdo não é executado.</p></div>`;
    $("#download-attachment").onclick = () => downloadFile(file);
    if (/^data:image\/(png|jpeg|gif|webp);base64,/.test(file.content)) {
      const img = document.createElement("img");
      img.src = file.content;
      img.alt = file.name;
      img.className = "image-preview";
      host.prepend(img);
    }
    return;
  }
  if (file.kind === "formula") {
    host.innerHTML = `<div class="formula-editor"><div class="panel-heading"><div><h2>Escreva com matemática.</h2><p>Use os botões ou digite em LaTeX. Troque as letras entre chaves pelos seus valores.</p></div></div>${mathToolbar()}<label>Fórmula em LaTeX<textarea id="file-content" class="code-editor" spellcheck="false" rows="5" maxlength="100000">${esc(file.content)}</textarea></label><span class="eyebrow">PRÉVIA</span><div class="formula-preview" id="formula-preview">${mathHTML(file.content, true)}</div><div class="math-examples"><h3>Uma pequena referência</h3><p><code>\\sqrt{x}</code> raiz quadrada · <code>x^{2}</code> potência · <code>\\frac{a}{b}</code> fração com barra horizontal</p><p><code>x_{n}</code> índice · <code>\\sqrt[3]{x}</code> raiz cúbica · <code>\\alpha</code> α · <code>\\theta</code> θ</p><p class="hint">Esta área escreve e apresenta fórmulas. Não calcula nem valida modelos físicos.</p></div></div>`;
  } else {
    host.innerHTML = `<div class="document-toolbar">${file.kind === "doc" ? '<div class="button-row"><button class="symbol" data-insert="# Título\n">H1</button><button class="symbol" data-insert="## Seção\n">H2</button><button class="symbol" data-insert="**texto em negrito**">B</button><button class="symbol" data-insert="- Item\n">☷</button><button class="symbol" data-insert="$$x^{2}$$">ƒ Fórmula</button></div>' : '<span class="eyebrow">ARQUIVO DE TEXTO</span>'}<span class="hint">Salvamento automático</span></div>${file.kind === "doc" ? mathToolbar() : ""}<div class="document-columns ${file.kind === "text" ? "text-only" : ""}"><div class="source-pane"><span class="pane-title">${file.kind === "doc" ? "EDITOR · MARKDOWN" : "EDITOR · TEXTO"}</span><textarea id="file-content" spellcheck="false" maxlength="2000000" aria-label="Conteúdo do documento" placeholder="Sua próxima ideia começa aqui…">${esc(file.content)}</textarea></div>${file.kind === "doc" ? `<div class="preview-pane"><span class="pane-title">PRÉVIA</span><article class="document-preview" id="document-preview">${markdown(file.content)}</article></div>` : ""}</div>`;
  }
  const area = $("#file-content");
  area.oninput = () => {
    file.content = area.value;
    onChange();
    if ($("#document-preview"))
      $("#document-preview").innerHTML = markdown(file.content);
    if ($("#formula-preview"))
      $("#formula-preview").innerHTML = mathHTML(file.content, true);
  };
  host
    .querySelectorAll("[data-math]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          insertText(
            area,
            file.kind === "formula" ? b.dataset.math : `$${b.dataset.math}$`,
          )),
    );
  host
    .querySelectorAll("[data-insert]")
    .forEach((b) => (b.onclick = () => insertText(area, b.dataset.insert)));
}
async function uploadFiles(event) {
  const files = [...event.target.files],
    destination = folder;
  event.target.value = "";
  let count = 0;
  for (const file of files) {
    if (file.size > 8 * 1024 * 1024) {
      toast(`“${file.name}” excede o limite de 8 MB por arquivo.`);
      continue;
    }
    try {
      const name = file.name.slice(0, 180);
      if (
        state.files.some(
          (f) =>
            f.parent === destination &&
            f.name.toLowerCase() === name.toLowerCase(),
        )
      ) {
        toast(`“${name}” já existe nesta pasta.`);
        continue;
      }
      const textFile = /\.(md|txt|tex|csv|json)$/i.test(file.name);
      const f = {
        id: uid(),
        parent: destination,
        kind: "attachment",
        name,
        content: "",
        updated: new Date().toISOString(),
      };
      if (textFile) {
        f.content = await file.text();
        f.kind = /\.design\.json$/i.test(name)
          ? "design"
          : /\.md$/i.test(name)
            ? "doc"
            : /\.tex$/i.test(name)
              ? "formula"
              : "text";
        if (f.content.length > 2000000) {
          toast("Arquivos de texto têm limite de 2 milhões de caracteres.");
          continue;
        }
      } else {
        f.content = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        f.mime = file.type || "application/octet-stream";
      }
      const candidate = { ...state, files: [...state.files, f] };
      if (new Blob([JSON.stringify(candidate)]).size > 50 * 1024 * 1024) {
        toast(
          "Limite de 50 MB do espaço atingido. Exporte arquivos e um backup antes de remover itens.",
        );
        break;
      }
      validateState(candidate);
      if (externalChange) break;
      state.files.push(f);
      activeFile = f.id;
      count++;
    } catch {
      toast(
        `Não foi possível importar “${file.name}”. Verifique o formato do arquivo.`,
      );
    }
  }
  if (count) {
    folder = destination;
    persist();
    render();
    toast(`${count} arquivo(s) importado(s).`);
  }
}
function renderSettings() {
  const size = new Blob([JSON.stringify(state)]).size;
  main.innerHTML =
    heading(
      "WORLDFORGE / PREFERÊNCIAS",
      "Your space. Your pace.",
      "Ajuste sua rotina e mantenha uma cópia do que você construiu.",
    ) +
    `<div class="settings-grid"><section class="panel settings-card"><div class="panel-heading"><div><h2>No seu ritmo</h2><p>Metas simples para continuar avançando.</p></div></div><form id="settings-form"><label>Como quer ser chamado?<input name="name" maxlength="80" value="${esc(state.settings.name)}" placeholder="Seu nome"></label><div class="field-grid"><label>Meta diária (min)<input type="number" min="1" max="600" name="goal" required value="${state.settings.goal}"></label><label>Sessão de foco (min)<input type="number" min="1" max="180" name="focus" required value="${state.settings.focus}"></label></div><p class="hint">A duração é aplicada à próxima sessão de foco.</p><button class="button">Salvar preferências</button></form></section><section class="panel settings-card"><div class="panel-heading"><div><h2>Uma cópia para levar</h2><p>Backup completo do English e do THOR.</p></div><span class="backup-icon">↓</span></div><p>Seus dados ficam neste navegador e neste dispositivo. Limpar os dados do site pode apagá-los. Não há sincronização automática com o GitHub ou entre dispositivos.</p><div class="storage-summary"><strong>${(size / 1024 / 1024).toFixed(2)} MB</strong><span>${state.files.length} itens THOR · ${state.cards.length} palavras · ${state.journals.length} páginas</span></div><div class="button-row"><button class="button" id="export-backup">↓ Exportar backup</button><button class="button secondary" id="import-backup">↑ Restaurar backup</button></div><p class="hint">A restauração substitui o espaço atual após validação e confirmação. Exporte uma cópia antes de restaurar.</p></section><section class="panel settings-card"><h2>Publicação em /english</h2><p>Este aplicativo é estático e usa caminhos relativos. O mesmo build funciona em GitHub Pages, em <strong>worldforge.site/english/</strong> ou em um subdomínio.</p><p>As instruções de publicação estão no README do projeto. A pasta do build é <code>dist/</code>.</p><p class="hint">A publicação contém o aplicativo. Seus estudos e arquivos permanecem no armazenamento do seu navegador.</p></section><section class="panel settings-card"><h2>Sobre este espaço</h2><p>Uma evolução da Central Pessoal, focada em inglês e na organização do projeto THOR.</p><p>Matemática renderizada com KaTeX. Editor gráfico vetorial com formas e textos. Pronúncia pela voz disponível no navegador.</p><span class="pill">ENGLISH · WORLDFORGE · v1.0</span></section></div>`;
  $("#settings-form").onsubmit = (e) => {
    e.preventDefault();
    const r = Object.fromEntries(new FormData(e.target));
    state.settings = {
      name: r.name.trim(),
      goal: Number(r.goal),
      focus: Number(r.focus),
    };
    persist()
      .then(() => toast("Preferências salvas."))
      .catch(() => {});
  };
  $("#export-backup").onclick = exportBackup;
  $("#import-backup").onclick = () => $("#backup-input").click();
}
function exportBackup() {
  download(
    new Blob(
      [
        JSON.stringify(
          {
            app: "worldforge-english",
            exportedAt: new Date().toISOString(),
            state,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
    `worldforge-english-${dateKey()}.json`,
  );
  toast("Backup exportado. Guarde o arquivo em um lugar seguro.");
}
async function importBackup(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  if (file.size > 80 * 1024 * 1024) {
    toast("O backup excede o limite de 80 MB.");
    return;
  }
  try {
    const next = parseBackup(await file.text());
    if (
      !(await confirmDialog(
        "Restaurar este backup?",
        `O espaço atual será substituído por ${next.tasks.length} tarefa(s), ${next.cards.length} palavra(s) e ${next.files.length} item(ns) THOR. Exporte primeiro um backup se quiser manter os dados atuais.`,
      ))
    )
      return;
    clearTimeout(saveTimer);
    await saveChain.catch(() => {});
    await writeStore(next);
    state = next;
    activeFile = null;
    folder = null;
    reviewId = null;
    unsaved = false;
    failed = false;
    channel?.postMessage("changed");
    render();
    setStatus("Backup restaurado");
    toast("Backup validado e restaurado.");
  } catch (error) {
    toast(error.message || "Não foi possível restaurar o backup.");
  }
}
function render() {
  if (!state) return;
  if (unsaved && !failed && !externalChange) persist();
  document
    .querySelectorAll("[data-route]")
    .forEach((a) => a.classList.toggle("active", a.dataset.route === route));
  $("#page-label").textContent = routes[route];
  $("#due-badge").textContent = state.cards.filter(
    (c) => c.due <= dateKey(),
  ).length;
  document.title = `${routes[route]} — English · Worldforge`;
  ({
    today: renderToday,
    tasks: renderTasks,
    vocabulary: renderVocabulary,
    journal: renderJournal,
    thor: renderThor,
    settings: renderSettings,
  })[route]();
}
function navigate() {
  const requested = location.hash.slice(1);
  route = routes[requested] ? requested : "today";
  render();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", navigate);
window.addEventListener("beforeunload", (e) => {
  if (unsaved || failed) {
    e.preventDefault();
    e.returnValue = "";
  }
});
document.addEventListener("visibilitychange", () => {
  if (state && document.hidden && unsaved && !externalChange) persist();
});
channel?.addEventListener("message", () => {
  if (externalChange) return;
  externalChange = true;
  clearTimeout(saveTimer);
  setStatus("Outra aba alterou os dados — recarregue", true);
  main.inert = true;
  $("#conflict-banner").hidden = false;
});
$("#conflict-export").onclick = exportBackup;
$("#conflict-reload").onclick = () => {
  unsaved = false;
  failed = false;
  location.reload();
};
$("#backup-input").onchange = importBackup;
$("#attachment-input").onchange = uploadFiles;
async function boot() {
  try {
    const saved = await openStore();
    state = saved ? validateState(saved) : seed();
    if (!saved) await persist();
    else setStatus("Salvo neste navegador");
    navigate();
    setInterval(() => {
      if (!externalChange) updateClock();
    }, 1000);
    setInterval(() => {
      if (dateKey() !== day && route === "today") render();
    }, 60000);
    if ("serviceWorker" in navigator && location.protocol !== "file:")
      navigator.serviceWorker.register("./sw.js").catch(() => {});
  } catch (error) {
    main.innerHTML = `<section class="panel empty"><h1>Não foi possível abrir seu espaço.</h1><p>O armazenamento do navegador pode estar bloqueado ou conter dados incompatíveis. Tente recarregar ou usar outro navegador. Os dados existentes foram preservados.</p><pre>${esc(error.message)}</pre><button class="button" onclick="location.reload()">Recarregar</button></section>`;
    setStatus("Armazenamento indisponível", true);
  }
}
boot();

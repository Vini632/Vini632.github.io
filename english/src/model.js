export const uid = () => crypto.randomUUID();
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function addDays(day, count) {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + count);
  return dateKey(d);
}
export function seed() {
  const today = dateKey();
  return {
    version: 1,
    settings: { goal: 30, focus: 25, name: "" },
    tasks: [
      {
        id: uid(),
        title: "Ouvir 10 minutos de inglês",
        category: "Listening",
        minutes: 10,
        repeat: true,
        date: today,
        done: [],
      },
      {
        id: uid(),
        title: "Revisar 5 palavras e falar em voz alta",
        category: "Vocabulary",
        minutes: 5,
        repeat: true,
        date: today,
        done: [],
      },
      {
        id: uid(),
        title: "Escrever sobre o meu dia em inglês",
        category: "Writing",
        minutes: 15,
        repeat: true,
        date: today,
        done: [],
      },
    ],
    cards: [
      ["build", "construir", "I build something new every day."],
      ["learn", "aprender", "I want to learn English."],
      ["research", "pesquisa / pesquisar", "My project starts with research."],
      ["improve", "melhorar", "Small steps help me improve."],
    ].map(([word, meaning, example]) => ({
      id: uid(),
      word,
      meaning,
      example,
      due: today,
      interval: 0,
      reviews: 0,
    })),
    journals: [],
    sessions: [],
    timer: null,
    files: [
      {
        id: "thor-notes",
        parent: null,
        kind: "folder",
        name: "Pesquisa e notas",
        content: "",
        updated: new Date().toISOString(),
      },
      {
        id: "thor-designs",
        parent: null,
        kind: "folder",
        name: "Designs",
        content: "",
        updated: new Date().toISOString(),
      },
      {
        id: "thor-start",
        parent: "thor-notes",
        kind: "doc",
        name: "Visão do projeto.md",
        content:
          "# THOR\n\nThermonuclear Heat Optimization Reactor\n\nReator termonuclear conceitual.\n\n## Perguntas de pesquisa\n\n- Qual é a ideia central do projeto?\n- Quais conceitos preciso estudar?\n- Quais fontes e referências sustentam cada hipótese?\n\n## Próximos passos\n\nRegistre aqui seus objetivos, ideias e referências.\n\n## Notação matemática\n\nExemplo de fração, raiz e potência:\n\n$$x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}$$",
        updated: new Date().toISOString(),
      },
    ],
  };
}
export function tasksFor(state, day) {
  return state.tasks.filter((t) => (t.repeat ? t.date <= day : t.date === day));
}
export function toggleTask(task, day) {
  task.done = task.done.includes(day)
    ? task.done.filter((d) => d !== day)
    : [...task.done, day];
}
export function reviewCard(card, known, day) {
  card.interval = known
    ? Math.min(180, card.interval ? card.interval * 2 : 1)
    : 0;
  card.due = addDays(day, card.interval);
  card.reviews += 1;
}
export function minutesFor(state, day) {
  return state.sessions
    .filter((s) => s.date === day)
    .reduce((n, s) => n + s.minutes, 0);
}
export function streak(state, today) {
  let day = minutesFor(state, today) > 0 ? today : addDays(today, -1),
    count = 0;
  while (minutesFor(state, day) > 0 && count < 36600) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}
export function descendants(files, id) {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of files) {
      if (ids.has(f.parent) && !ids.has(f.id)) {
        ids.add(f.id);
        changed = true;
      }
    }
  }
  return ids;
}
const isDay = (d) =>
  typeof d === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(d) &&
  !Number.isNaN(Date.parse(d)) &&
  dateKey(new Date(`${d}T12:00:00`)) === d;
const str = (v, max = 2000000) => typeof v === "string" && v.length <= max;
const num = (v, max = 1000000) => Number.isFinite(v) && v >= 0 && v <= max;
const validId = (v) =>
  typeof v === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
const list = (v) => Array.isArray(v) && v.length <= 20000;
export function validateState(s) {
  const fail = () => {
    throw new Error(
      "Backup inválido ou incompatível. Nenhum dado foi alterado.",
    );
  };
  if (
    !s ||
    s.version !== 1 ||
    !s.settings ||
    !str(s.settings.name, 80) ||
    !num(s.settings.goal, 600) ||
    s.settings.goal < 1 ||
    !num(s.settings.focus, 180) ||
    s.settings.focus < 1
  )
    fail();
  if (
    !["tasks", "cards", "journals", "sessions", "files"].every((k) =>
      list(s[k]),
    )
  )
    fail();
  for (const t of s.tasks)
    if (
      !t ||
      !validId(t.id) ||
      !str(t.title, 300) ||
      ![
        "Listening",
        "Speaking",
        "Reading",
        "Writing",
        "Vocabulary",
        "Grammar",
      ].includes(t.category) ||
      !num(t.minutes, 600) ||
      typeof t.repeat !== "boolean" ||
      !isDay(t.date) ||
      !list(t.done) ||
      !t.done.every(isDay)
    )
      fail();
  for (const c of s.cards)
    if (
      !c ||
      !validId(c.id) ||
      !str(c.word, 200) ||
      !str(c.meaning, 500) ||
      !str(c.example, 1000) ||
      !isDay(c.due) ||
      !num(c.interval, 180) ||
      !num(c.reviews)
    )
      fail();
  for (const j of s.journals)
    if (!j || !validId(j.id) || !isDay(j.date) || !str(j.content, 100000))
      fail();
  for (const x of s.sessions)
    if (
      !x ||
      !validId(x.id) ||
      !isDay(x.date) ||
      !num(x.minutes, 600) ||
      !str(x.label, 100)
    )
      fail();
  const ids = new Set();
  for (const f of s.files) {
    if (
      !f ||
      !validId(f.id) ||
      ids.has(f.id) ||
      !str(f.name, 200) ||
      !(f.parent === null || validId(f.parent)) ||
      !["folder", "doc", "text", "formula", "design", "attachment"].includes(
        f.kind,
      ) ||
      !str(f.content, 12000000) ||
      !str(f.updated, 50)
    )
      fail();
    ids.add(f.id);
    if (
      f.kind === "attachment" &&
      (!/^data:[a-zA-Z0-9.+\-/]*;base64,[A-Za-z0-9+/=]*$/.test(f.content) ||
        !str(f.mime, 150))
    )
      fail();
    if (f.kind === "design") {
      let shapes;
      try {
        shapes = JSON.parse(f.content);
      } catch {
        fail();
      }
      if (!Array.isArray(shapes) || shapes.length > 200) fail();
      for (const p of shapes)
        if (
          !p ||
          !validId(p.id) ||
          !["rect", "ellipse", "text", "line"].includes(p.type) ||
          !/^#[a-f\d]{6}$/i.test(p.color) ||
          !str(p.text, 300) ||
          !["x", "y", "w", "h"].every((k) => num(p[k], 1000))
        )
          fail();
    }
  }
  if (
    s.files.some(
      (f) =>
        f.parent !== null &&
        !s.files.some((p) => p.id === f.parent && p.kind === "folder"),
    )
  )
    fail();
  for (const f of s.files) {
    let parent = f.parent;
    const seen = new Set([f.id]);
    while (parent !== null) {
      if (seen.has(parent)) fail();
      seen.add(parent);
      parent = s.files.find((p) => p.id === parent)?.parent ?? null;
    }
  }
  for (const k of ["tasks", "cards", "journals", "sessions"])
    if (new Set(s[k].map((x) => x.id)).size !== s[k].length) fail();
  if (
    s.timer !== null &&
    (!s.timer ||
      !validId(s.timer.id) ||
      !num(s.timer.duration, 10800) ||
      !num(s.timer.remaining, 10800) ||
      !(s.timer.end === null || num(s.timer.end, 9999999999999)))
  )
    fail();
  return structuredClone(s);
}
export function parseBackup(text) {
  let b;
  try {
    b = JSON.parse(text);
  } catch {
    throw new Error("O arquivo não contém JSON válido.");
  }
  if (b.app !== "worldforge-english")
    throw new Error("Selecione um backup do English · Worldforge.");
  return validateState(b.state);
}

(function exposeLowstatePlanner(root, factory) {
  const commonJS = typeof module === "object" && module.exports;
  const api = factory(commonJS ? require("./core.js") : root.LowstateCore);
  if (commonJS) module.exports = api;
  else root.LowstatePlanner = api;
})(typeof globalThis !== "undefined" ? globalThis : this, (core) => {
  const { startOfDay, toISODate, parseISODate } = core;

  // Ink colors: indigo, vermilion, matcha, yamabuki, wisteria, asagi, sakura,
  // grey.
  const PALETTE = ["#34508a", "#d64a32", "#7c8c4a", "#e2a43a", "#8b78bd", "#3e9aa8", "#e59aa6", "#8d8a85"];
  const DEFAULT_CATEGORY_NAMES = {
    en: ["Work", "Personal", "Health", "Study"],
    pt: ["Trabalho", "Pessoal", "Saúde", "Estudos"],
  };

  function newId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function addDays(date, amount) {
    const day = startOfDay(date);
    day.setDate(day.getDate() + amount);
    return day;
  }

  // weekStartsOn follows Date#getDay(): 0 = Sunday, 1 = Monday.
  function startOfWeek(date, weekStartsOn = 1) {
    const day = startOfDay(date);
    day.setDate(day.getDate() - ((day.getDay() - weekStartsOn + 7) % 7));
    return day;
  }

  function weekDays(date, weekStartsOn = 1) {
    const start = startOfWeek(date, weekStartsOn);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }

  function isoWeekNumber(date) {
    const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
    return Math.ceil(((day - yearStart) / 86400000 + 1) / 7);
  }

  function isTime(value) {
    return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  function timeToMinutes(value) {
    if (!isTime(value)) return null;
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  }

  function minutesToTime(total) {
    const clamped = Math.max(0, Math.min(1439, Math.round(total)));
    return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
  }

  function slug(name) {
    return String(name || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "category";
  }

  function displayName(name) {
    const text = String(name || "").trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";
  }

  // How a dated item is weighed on its day: must do, could do, not today.
  const FOCUS = ["must", "could", "later"];

  function normalizeItem(raw, now = Date.now()) {
    const item = raw && typeof raw === "object" ? raw : {};
    const date = parseISODate(item.date) ? item.date : null;
    const start = date && isTime(item.start) ? item.start : null;
    const duration = start && Number.isFinite(item.duration) && item.duration > 0
      ? Math.min(Math.round(item.duration), 1440)
      : null;
    const done = Boolean(item.done);
    return {
      id: typeof item.id === "string" && item.id ? item.id : newId(),
      title: String(item.title ?? "").trim(),
      date,
      start,
      duration,
      done,
      doneAt: done && Number.isFinite(item.doneAt) ? item.doneAt : null,
      priority: item.priority === "urgent" ? "urgent" : "normal",
      focus: FOCUS.includes(item.focus) ? item.focus : item.priority === "urgent" ? "must" : "could",
      category: typeof item.category === "string" && item.category ? item.category : null,
      notes: String(item.notes ?? ""),
      createdAt: Number.isFinite(item.createdAt) ? item.createdAt : now,
      order: Number.isFinite(item.order) ? item.order : 0,
    };
  }

  function defaultCategories(language = "en") {
    const names = DEFAULT_CATEGORY_NAMES[language] || DEFAULT_CATEGORY_NAMES.en;
    return names.map((name, index) => ({ id: slug(DEFAULT_CATEGORY_NAMES.en[index]), name, color: PALETTE[index] }));
  }

  function nextColor(categories) {
    const used = new Set(categories.map((category) => category.color));
    return PALETTE.find((color) => !used.has(color)) || PALETTE[categories.length % PALETTE.length];
  }

  // Untimed tasks first (manual order), then time-blocked items by start time.
  function compareInDay(a, b) {
    const aTimed = Boolean(a.start);
    const bTimed = Boolean(b.start);
    if (aTimed !== bTimed) return aTimed ? 1 : -1;
    if (aTimed && a.start !== b.start) return a.start < b.start ? -1 : 1;
    if (a.order !== b.order) return a.order - b.order;
    return a.createdAt - b.createdAt;
  }

  function compareInbox(a, b) {
    return a.order !== b.order ? a.order - b.order : a.createdAt - b.createdAt;
  }

  function itemsForDay(items, iso) {
    return items.filter((item) => item.date === iso).sort(compareInDay);
  }

  function inboxItems(items) {
    return items.filter((item) => !item.date && !item.done).sort(compareInbox);
  }

  function overdueItems(items, todayISO) {
    return items
      .filter((item) => item.date && item.date < todayISO && !item.done)
      .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : compareInDay(a, b)));
  }

  function bucketOf(items, date) {
    return date
      ? items.filter((item) => item.date === date).sort(compareInDay)
      : items.filter((item) => !item.date && !item.done).sort(compareInbox);
  }

  function nextOrder(items, date) {
    const bucket = bucketOf(items, parseISODate(date) ? date : null);
    return bucket.length ? Math.max(...bucket.map((item) => item.order)) + 10 : 0;
  }

  function createItem(items, fields = {}, now = Date.now()) {
    const date = parseISODate(fields.date) ? fields.date : null;
    return normalizeItem({ ...fields, date, order: nextOrder(items, date), createdAt: now }, now);
  }

  // Moves an item into a day (or back to the unscheduled list when date is
  // null), placing it before `beforeId` and reindexing that bucket's order.
  // `focus` optionally moves it into a must/could/later group as well.
  function moveItem(items, id, { date = null, beforeId = null, focus = null } = {}) {
    const moving = items.find((item) => item.id === id);
    if (!moving) return items;
    const target = parseISODate(date) ? date : null;
    const moved = { ...moving, date: target };
    if (FOCUS.includes(focus)) moved.focus = focus;
    if (!target) Object.assign(moved, { start: null, duration: null, done: false, doneAt: null });

    const bucket = bucketOf(items.filter((item) => item.id !== id), target);
    let index = beforeId ? bucket.findIndex((item) => item.id === beforeId) : -1;
    if (index < 0) index = bucket.length;
    bucket.splice(index, 0, moved);
    const orders = new Map(bucket.map((item, position) => [item.id, position * 10]));

    return items
      .map((item) => (item.id === id ? moved : item))
      .map((item) => (orders.has(item.id) ? { ...item, order: orders.get(item.id) } : item));
  }

  // Completing something that was never scheduled counts as done today, so it
  // shows up in today's column instead of silently disappearing from the inbox.
  function toggleDone(item, todayISO, now = Date.now()) {
    if (item.done) return { ...item, done: false, doneAt: null };
    return { ...item, done: true, doneAt: now, date: item.date || todayISO };
  }

  function weekStats(items, days) {
    const isos = new Set(days.map((day) => toISODate(day)));
    const inWeek = items.filter((item) => isos.has(item.date));
    return { total: inWeek.length, done: inWeek.filter((item) => item.done).length };
  }

  const TIME_PATTERN = /(^|\s)@?(\d{1,2})(?::([0-5]\d)|h([0-5]\d)?)(?=\s|$)/i;

  // Quick capture: everything core understands (#category, !urgent, @tomorrow…)
  // plus a start time written as 14:30, 14h or 9h30.
  function parseCapture(input, now = new Date()) {
    const parsed = core.parseTaskCapture(input, now);
    let title = parsed.title;
    let start = null;
    const match = title.match(TIME_PATTERN);
    if (match && Number(match[2]) <= 23) {
      start = `${String(Number(match[2])).padStart(2, "0")}:${match[3] || match[4] || "00"}`;
      title = title.replace(match[0], " ").replace(/\s+/g, " ").trim();
    }
    return {
      title,
      date: parsed.dueDate || null,
      start,
      priority: parsed.priority === "boss" ? "urgent" : "normal",
      category: parsed.category,
    };
  }

  function legacyTaskToItem(todo, now = Date.now()) {
    return normalizeItem({
      id: todo?.id,
      title: todo?.title,
      date: todo?.dueDate || null,
      done: todo?.done,
      doneAt: todo?.done ? todo?.createdAt : null,
      priority: todo?.priority === "boss" ? "urgent" : "normal",
      category: todo?.category ? slug(todo.category) : null,
      createdAt: todo?.createdAt,
    }, now);
  }

  // Converts the 1.x notebook data (tasks + categories) into planner data.
  // Legacy keys are only read, never removed, so older backups stay valid.
  function migrateLegacy({ todos = [], categories = [], categoryColors = {} } = {}, now = Date.now()) {
    const migratedCategories = [];
    const addCategory = (name) => {
      const id = slug(name);
      if (migratedCategories.some((category) => category.id === id)) return;
      migratedCategories.push({
        id,
        name: displayName(name),
        color: categoryColors?.[name] || PALETTE[migratedCategories.length % PALETTE.length],
      });
    };
    (Array.isArray(categories) ? categories : []).forEach((name) => typeof name === "string" && name && addCategory(name));

    const legacy = (Array.isArray(todos) ? todos : []).filter((todo) => todo && String(todo.title || "").trim());
    legacy.forEach((todo) => todo.category && addCategory(todo.category));

    // Old order values were either sequential or -createdAt; keep their
    // relative order inside each day but renumber them for the planner.
    const sorted = legacy.slice().sort((a, b) => {
      const orderA = a.order ?? -a.createdAt;
      const orderB = b.order ?? -b.createdAt;
      return orderA - orderB;
    });
    const counters = new Map();
    const items = sorted.map((todo) => {
      const item = legacyTaskToItem(todo, now);
      const key = item.date || "";
      const position = counters.get(key) || 0;
      counters.set(key, position + 1);
      return { ...item, order: position * 10 };
    });
    return { items, categories: migratedCategories };
  }

  // ISO-8601 week key ("2026-W43"). Notes and goals are keyed by it so they
  // stay attached to the same week whether it starts on Monday or Sunday.
  function isoWeekKey(date) {
    const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
    return `${day.getUTCFullYear()}-W${String(isoWeekNumber(date)).padStart(2, "0")}`;
  }

  // ---------- Moon ----------
  const SYNODIC_MONTH = 29.530588853;
  const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
  const MOON_PHASES = ["new", "waxing-crescent", "first-quarter", "waxing-gibbous", "full", "waning-gibbous", "last-quarter", "waning-crescent"];

  // Fraction of the lunar cycle at local noon: 0 = new moon, 0.5 = full moon.
  function moonPhase(date) {
    const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    const days = (noon.getTime() - REFERENCE_NEW_MOON) / 86400000;
    return (((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH) / SYNODIC_MONTH;
  }

  function moonPhaseName(phase) {
    return MOON_PHASES[Math.round(phase * 8) % 8];
  }

  // SVG path of the lit part of the moon for a circle of radius r at (cx, cy).
  // The terminator is an ellipse whose x-radius follows cos(2π·phase).
  function moonLitPath(phase, cx = 6, cy = 6, r = 5) {
    const k = Math.cos(2 * Math.PI * phase);
    const rx = Math.abs(k) * r;
    const top = `${cx} ${cy - r}`;
    const bottom = `${cx} ${cy + r}`;
    const fmt = (value) => Number(value.toFixed(3));
    if (phase < 0.5) {
      return `M${top}A${r} ${r} 0 0 1 ${bottom}A${fmt(rx)} ${r} 0 0 ${k > 0 ? 0 : 1} ${top}Z`;
    }
    return `M${top}A${r} ${r} 0 0 0 ${bottom}A${fmt(rx)} ${r} 0 0 ${k < 0 ? 0 : 1} ${top}Z`;
  }

  // ---------- Brazilian national holidays ----------
  const HOLIDAY_NAMES = {
    newYear: { pt: "Confraternização Universal", en: "New Year's Day" },
    carnival: { pt: "Carnaval", en: "Carnival" },
    goodFriday: { pt: "Sexta-feira Santa", en: "Good Friday" },
    tiradentes: { pt: "Tiradentes", en: "Tiradentes Day" },
    labour: { pt: "Dia do Trabalho", en: "Labour Day" },
    corpusChristi: { pt: "Corpus Christi", en: "Corpus Christi" },
    independence: { pt: "Independência do Brasil", en: "Independence Day" },
    aparecida: { pt: "Nossa Senhora Aparecida", en: "Our Lady of Aparecida" },
    allSouls: { pt: "Finados", en: "All Souls' Day" },
    republic: { pt: "Proclamação da República", en: "Republic Day" },
    blackConsciousness: { pt: "Consciência Negra", en: "Black Consciousness Day" },
    christmas: { pt: "Natal", en: "Christmas" },
  };

  // Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
  function easterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  const holidayCache = new Map();

  // National holidays plus the Carnival and Corpus Christi "pontos
  // facultativos" most people treat as days off. Returns Map<ISO, key>.
  function brazilHolidays(year) {
    if (holidayCache.has(year)) return holidayCache.get(year);
    const easter = easterSunday(year);
    const fixed = [
      ["01-01", "newYear"], ["04-21", "tiradentes"], ["05-01", "labour"], ["09-07", "independence"],
      ["10-12", "aparecida"], ["11-02", "allSouls"], ["11-15", "republic"], ["12-25", "christmas"],
    ];
    if (year >= 2024) fixed.push(["11-20", "blackConsciousness"]);
    const holidays = new Map(fixed.map(([monthDay, key]) => [`${year}-${monthDay}`, key]));
    [[-48, "carnival"], [-47, "carnival"], [-2, "goodFriday"], [60, "corpusChristi"]].forEach(([offset, key]) => {
      holidays.set(toISODate(addDays(easter, offset)), key);
    });
    holidayCache.set(year, holidays);
    return holidays;
  }

  function holidayName(iso, language = "en") {
    const date = parseISODate(iso);
    if (!date) return null;
    const key = brazilHolidays(date.getFullYear()).get(iso);
    return key ? HOLIDAY_NAMES[key][language] || HOLIDAY_NAMES[key].en : null;
  }

  // ---------- Page quotes ----------
  const PROVERBS = [
    { en: "Fall seven times, get up eight.", pt: "Caia sete vezes, levante-se oito." },
    { en: "A journey of a thousand miles begins with a single step.", pt: "Uma jornada de mil léguas começa com um passo." },
    { en: "Even dust, piled up, becomes a mountain.", pt: "Até a poeira, acumulada, vira montanha." },
    { en: "When in a hurry, take the long way round.", pt: "Se está com pressa, vá pelo caminho mais longo." },
    { en: "Persistence is power.", pt: "Persistência é força." },
    { en: "One time, one meeting — treasure each moment.", pt: "Um encontro, uma única vez — valorize cada momento." },
    { en: "Sit on a cold stone for three years and it grows warm.", pt: "Sente-se três anos numa pedra fria e ela se aquece." },
    { en: "After the rain, the ground grows firm.", pt: "Depois da chuva, a terra fica firme." },
    { en: "Good fortune comes to the house that laughs.", pt: "A sorte chega à casa onde se ri." },
    { en: "Doing it is easier than worrying about it.", pt: "Fazer é mais fácil do que se preocupar." },
    { en: "Even monkeys fall from trees.", pt: "Até os macacos caem das árvores." },
    { en: "Tomorrow's winds will blow tomorrow.", pt: "Amanhã sopram os ventos de amanhã." },
    { en: "Ten people, ten colors.", pt: "Dez pessoas, dez cores." },
    { en: "Stop when you are eight-tenths full.", pt: "Pare quando estiver oito décimos satisfeito." },
    { en: "The skilled hawk hides its talons.", pt: "O falcão habilidoso esconde as garras." },
    { en: "One stone, two birds.", pt: "Uma pedra, dois pássaros." },
    { en: "Be prepared and you will have nothing to fear.", pt: "Quem se prepara não tem o que temer." },
    { en: "Rising early is worth three coins.", pt: "Acordar cedo vale três moedas." },
    { en: "Never forget your beginner's mind.", pt: "Nunca esqueça o espírito de iniciante." },
    { en: "Old Saiō's horse — luck and misfortune are hard to tell apart.", pt: "O cavalo do velho Saiō — sorte e azar são difíceis de distinguir." },
  ];

  const MOTIVATIONAL = [
    { en: "One step at a time is still moving.", pt: "Um passo de cada vez ainda é andar." },
    { en: "Done is better than perfect.", pt: "Feito é melhor que perfeito." },
    { en: "You don't have to do it all today — just the next step.", pt: "Você não precisa fazer tudo hoje — só o próximo passo." },
    { en: "Small progress is still progress.", pt: "Pequenos progressos ainda são progressos." },
    { en: "Start small, but start.", pt: "Comece pequeno, mas comece." },
    { en: "Consistency beats rushing.", pt: "A constância vence a pressa." },
    { en: "Today is a blank page.", pt: "Hoje é uma página em branco." },
    { en: "Discipline is remembering what you want.", pt: "Disciplina é lembrar o que você quer." },
    { en: "Rest is part of the plan too.", pt: "Descansar também faz parte do plano." },
    { en: "Hard gets easier with practice.", pt: "O difícil fica fácil com prática." },
    { en: "Your pace is the right pace.", pt: "Seu ritmo é o ritmo certo." },
    { en: "Finish one thing before starting three.", pt: "Termine uma coisa antes de começar três." },
    { en: "Courage is doing it anyway.", pt: "Coragem é fazer mesmo com medo." },
    { en: "Every crossed-off task is a win.", pt: "Cada tarefa riscada é uma vitória." },
    { en: "Focus on what you can control.", pt: "Foco no que dá para controlar." },
    { en: "Better than yesterday is enough.", pt: "Melhor que ontem já é suficiente." },
    { en: "Motivation shows up after you start.", pt: "A motivação aparece depois que você começa." },
    { en: "You've made it through harder days.", pt: "Você já passou por dias mais difíceis." },
    { en: "Great things are made of ordinary days.", pt: "Grandes coisas são feitas de dias comuns." },
    { en: "Breathe. Prioritize. Do.", pt: "Respire. Priorize. Faça." },
    { en: "Don't wait for the perfect moment — make it.", pt: "Não espere o momento perfeito — crie o momento." },
    { en: "Your future self will thank you for today.", pt: "Seu eu de amanhã agradece o que você fizer hoje." },
    { en: "Mistakes are part of trying.", pt: "Errar faz parte de tentar." },
    { en: "Simplify. Then simplify again.", pt: "Simplifique. Depois, simplifique de novo." },
    { en: "Persistence turns the impossible into routine.", pt: "A persistência transforma o impossível em rotina." },
    { en: "A good day starts with a short list.", pt: "Um bom dia começa com uma lista curta." },
    { en: "Celebrate what you've already done.", pt: "Celebre o que você já fez." },
    { en: "Slow still gets there.", pt: "Devagar também se chega." },
    { en: "Be kind to yourself along the way.", pt: "Seja gentil com você no meio do caminho." },
    { en: "Today counts.", pt: "Hoje conta." },
  ];

  const IRONIC = [
    { en: "Today is a great day to procrastinate with conviction.", pt: "Hoje é um ótimo dia para adiar algo com muita convicção." },
    { en: "Believe in yourself. Someone has to.", pt: "Acredite em você. Alguém tem que acreditar." },
    { en: "If nothing works out, at least you made a list.", pt: "Se nada der certo, pelo menos você fez uma lista." },
    { en: "You can do anything. Including nothing.", pt: "Você é capaz de tudo. Inclusive de não fazer nada." },
    { en: "Dream big. Nap bigger.", pt: "Sonhe grande. Cochile maior ainda." },
    { en: "Success is right there, after one more coffee.", pt: "O sucesso está logo ali, depois de mais um café." },
    { en: "Every great journey begins with \"five more minutes\".", pt: "Toda grande jornada começa com \"só mais cinco minutinhos\"." },
    { en: "Be the person your calendar thinks you are.", pt: "Seja a pessoa que sua agenda acha que você é." },
    { en: "Deep breath. The emails aren't going anywhere. Sadly.", pt: "Respire fundo. Os e-mails não vão a lugar nenhum. Infelizmente." },
    { en: "Today you'll shine. Or at least show up.", pt: "Hoje você vai brilhar. Ou pelo menos aparecer." },
    { en: "Nothing is impossible. Just very tedious.", pt: "Nada é impossível. Só muito chato." },
    { en: "When life gives you lemons, add them to tomorrow's list.", pt: "Se a vida te der limões, coloque na lista de amanhã." },
    { en: "Remember: that meeting could have been an email.", pt: "Lembre-se: essa reunião poderia ter sido um e-mail." },
    { en: "Focus, strength and snacks.", pt: "Foco, força e lanchinho." },
    { en: "The first step is the hardest. So is the second.", pt: "O primeiro passo é o mais difícil. O segundo também." },
    { en: "It's not late, it's a personal time zone.", pt: "Não é atraso, é fuso horário próprio." },
    { en: "Being organized means knowing exactly where the mess is.", pt: "Organização é saber exatamente onde está a bagunça." },
    { en: "Do today what you can reschedule tomorrow.", pt: "Faça hoje o que você pode reagendar amanhã." },
    { en: "Productivity is a vibe. Today's vibe is different.", pt: "Produtividade é uma vibe. Hoje a vibe é outra." },
    { en: "Think positive: Monday only lasts one day.", pt: "Pense positivo: a segunda-feira só dura um dia." },
    { en: "Courage! The list won't cross itself off.", pt: "Coragem! A lista não vai se riscar sozinha." },
    { en: "The universe is on your side. It's just a bit busy.", pt: "O universo conspira a seu favor. Só está meio ocupado." },
    { en: "Great achievements require small naps.", pt: "Grandes conquistas exigem pequenos cochilos." },
    { en: "Today you'll be unstoppable. Until lunch.", pt: "Hoje ninguém te segura. Até o almoço." },
    { en: "Plan it all on Sunday, improvise it all on Monday.", pt: "Quem planeja tudo no domingo improvisa tudo na segunda." },
    { en: "You're stronger than the office Wi-Fi.", pt: "Você é mais forte que o Wi-Fi do escritório." },
    { en: "Feeling lazy? Do it lazily, then.", pt: "Deu preguiça? Faça com preguiça mesmo." },
    { en: "Your potential is infinite. Your social battery isn't.", pt: "Seu potencial é infinito. Sua bateria social, não." },
    { en: "It'll all work out. Maybe not today, but it will.", pt: "Vai dar tudo certo. Talvez não hoje, mas vai." },
    { en: "Mark it done and pretend it was easy.", pt: "Marque como feito e finja que foi fácil." },
  ];

  const QUOTES = { proverbs: PROVERBS, motivational: MOTIVATIONAL, ironic: IRONIC };
  const QUOTE_STYLES = ["proverbs", "motivational", "ironic", "off"];

  // Cycles through one style's quotes; used with the week number on week
  // pages and with the day of the year on day pages. "off" gives null.
  function quoteFor(style, n) {
    const list = QUOTES[style];
    if (!list) return null;
    const index = ((Math.round(n) - 1) % list.length + list.length) % list.length;
    return list[index];
  }

  // ---------- Mood of the day ----------
  const MOODS = ["great", "good", "okay", "tiring", "stressed", "rough"];

  // ---------- Habits ----------
  // Habits are [{ id, name, color, icon, days }]; the log is
  // { iso: [habitId, …] }. `days` lists the weekdays (0 = Sunday) a habit is
  // planned for; an empty list means every day.
  const HABIT_ICONS = ["dumbbell", "run", "bike", "swim", "yoga", "book", "pen", "lotus", "pill", "moon", "heart", "leaf"];

  function normalizeDays(days) {
    const list = [...new Set((Array.isArray(days) ? days : []).map(Number))]
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      .sort((a, b) => a - b);
    return list.length === 7 ? [] : list;
  }

  // Per-weekday times: { "1": { start: "07:00", duration: 60 }, … }.
  function normalizeTimes(raw) {
    if (!raw || typeof raw !== "object") return {};
    return Object.fromEntries(Object.entries(raw)
      .filter(([day, time]) => /^[0-6]$/.test(day) && time && isTime(time.start))
      .map(([day, time]) => [day, {
        start: time.start,
        duration: Number.isFinite(time.duration) && time.duration > 0 ? Math.min(Math.round(time.duration), 720) : 60,
      }]));
  }

  function normalizeHabits(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    return raw
      .filter((habit) => habit && typeof habit.id === "string" && String(habit.name ?? "").trim() && !seen.has(habit.id) && seen.add(habit.id))
      .map((habit, index) => ({
        id: habit.id,
        name: String(habit.name).trim().slice(0, 60),
        color: PALETTE.includes(habit.color) ? habit.color : PALETTE[index % PALETTE.length],
        icon: HABIT_ICONS.includes(habit.icon) ? habit.icon : null,
        days: normalizeDays(habit.days),
        // Optional time of day, so a habit like the gym sits on the timeline:
        // one for every planned day, or `times` per weekday.
        start: isTime(habit.start) ? habit.start : null,
        duration: isTime(habit.start) && Number.isFinite(habit.duration) && habit.duration > 0
          ? Math.min(Math.round(habit.duration), 720)
          : null,
        times: normalizeTimes(habit.times),
        // Active period: from `since` (inclusive) until `until` (inclusive,
        // null = still going). Outside it the habit isn't planned or shown.
        since: parseISODate(habit.since) ? habit.since : null,
        until: parseISODate(habit.until) && (!parseISODate(habit.since) || habit.until >= habit.since) ? habit.until : null,
      }));
  }

  function habitActive(habit, iso) {
    return (!habit?.since || iso >= habit.since) && (!habit?.until || iso <= habit.until);
  }

  // Active in any day between `from` and `to` (ISO dates, inclusive).
  function habitActiveBetween(habit, from, to) {
    return (!habit?.since || habit.since <= to) && (!habit?.until || habit.until >= from);
  }

  function habitScheduled(habit, iso) {
    if (!habitActive(habit, iso)) return false;
    const days = habit?.days || [];
    if (!days.length) return true;
    const date = parseISODate(iso);
    return Boolean(date) && days.includes(date.getDay());
  }

  // The habit's time on a day: that weekday's own time when it has per-day
  // times, otherwise its single time; null when unplanned or untimed.
  function habitTimeOn(habit, iso) {
    if (!habit || !habitScheduled(habit, iso)) return null;
    const times = habit.times || {};
    if (Object.keys(times).length) {
      const date = parseISODate(iso);
      return (date && times[String(date.getDay())]) || null;
    }
    return habit.start ? { start: habit.start, duration: habit.duration || 60 } : null;
  }

  // The editor shows a habit's schedule as rows of { days, start, duration }:
  // one row for "these days at this time", more rows for other times.
  function scheduleRows(habit) {
    const times = habit?.times || {};
    if (!Object.keys(times).length) {
      return [{ days: [...(habit?.days || [])], start: habit?.start || null, duration: habit?.duration || 60 }];
    }
    const planned = habit.days.length ? habit.days : [0, 1, 2, 3, 4, 5, 6];
    const rows = [];
    planned.forEach((day) => {
      const time = times[String(day)] || null;
      const key = time ? `${time.start}|${time.duration}` : "none";
      let row = rows.find((candidate) => candidate.key === key);
      if (!row) rows.push(row = { key, days: [], start: time?.start || null, duration: time?.duration || 60 });
      row.days.push(day);
    });
    return rows.map(({ key, ...row }) => row);
  }

  // Back from rows: one row (or one row with days) keeps a single time;
  // several become per-weekday times. No days picked at all = every day.
  function habitFromRows(rows) {
    const list = Array.isArray(rows) && rows.length ? rows : [{ days: [], start: null, duration: 60 }];
    const used = list.filter((row) => row.days?.length);
    if (used.length <= 1) {
      const row = used[0] || list[0];
      const start = isTime(row.start) ? row.start : null;
      return { days: normalizeDays(row.days), start, duration: start ? row.duration || 60 : null, times: {} };
    }
    const times = {};
    used.forEach((row) => {
      if (isTime(row.start)) row.days.forEach((day) => { times[String(day)] = { start: row.start, duration: row.duration || 60 }; });
    });
    return { days: normalizeDays(used.flatMap((row) => row.days)), start: null, duration: null, times: normalizeTimes(times) };
  }

  const asHabit = (habitOrId) => (typeof habitOrId === "string" ? { id: habitOrId, days: [] } : habitOrId);

  function habitDone(log, iso, id) {
    return Array.isArray(log?.[iso]) && log[iso].includes(id);
  }

  // Returns a new log with the habit flipped for that day.
  function toggleHabit(log, iso, id) {
    const { [iso]: day = [], ...rest } = log || {};
    const next = day.includes(id) ? day.filter((other) => other !== id) : [...day, id];
    return next.length ? { ...rest, [iso]: next } : rest;
  }

  // Drops a removed habit from every day of the log.
  function forgetHabit(log, id) {
    return Object.fromEntries(Object.entries(log || {})
      .map(([iso, ids]) => [iso, (ids || []).filter((other) => other !== id)])
      .filter(([, ids]) => ids.length));
  }

  // Times done in a row, ending today — or yesterday, so an unchecked today
  // doesn't break a streak before the day is over. Only a missed planned day
  // breaks it; an extra day (done when not planned) adds to it.
  function habitStreak(log, habitOrId, todayISO) {
    const habit = asHabit(habitOrId);
    let day = parseISODate(todayISO);
    if (!day) return 0;
    if (!habitDone(log, todayISO, habit.id)) day = addDays(day, -1);
    let streak = 0;
    for (let guard = 0; guard < 3660; guard++) {
      const iso = toISODate(day);
      if (habit.since && iso < habit.since) break;
      if (habitDone(log, iso, habit.id)) streak += 1;
      else if (habitScheduled(habit, iso)) break;
      day = addDays(day, -1);
    }
    return streak;
  }

  // A pattern from the last few weeks (today excluded, it isn't over):
  // { kind: "perfect" } when no planned day was missed, { kind: "best", day,
  // rate } for the weekday done most reliably, or { kind: "none" } when
  // there isn't enough to say (weekdays need two planned days to count).
  function habitInsight(log, habitOrId, todayISO, weeks = 8) {
    const habit = asHabit(habitOrId);
    const end = parseISODate(todayISO);
    if (!end) return { kind: "none" };
    const byDay = Array.from({ length: 7 }, (_, day) => ({ day, planned: 0, done: 0 }));
    for (let back = 1; back <= weeks * 7; back++) {
      const date = addDays(end, -back);
      const iso = toISODate(date);
      if (!habitScheduled(habit, iso)) continue;
      byDay[date.getDay()].planned += 1;
      if (habitDone(log, iso, habit.id)) byDay[date.getDay()].done += 1;
    }
    const counted = byDay.filter((entry) => entry.planned >= 2);
    const done = counted.reduce((sum, entry) => sum + entry.done, 0);
    if (!counted.length || !done) return { kind: "none" };
    if (counted.every((entry) => entry.done === entry.planned)) return { kind: "perfect" };
    const best = counted
      .map((entry) => ({ ...entry, rate: entry.done / entry.planned }))
      .sort((a, b) => b.rate - a.rate || b.planned - a.planned)[0];
    return { kind: "best", day: best.day, rate: best.rate };
  }

  // ---------- Patterns across mood, water, load and habits ----------
  // Observations from the last `days` days (today excluded): days are split
  // in two groups and only clear differences between groups that are big
  // enough are reported, with the counts behind them. They describe what
  // goes together, never what causes what.
  const MOOD_SCORE = { great: 5, good: 4, okay: 3, tiring: 2, stressed: 2, rough: 1 };
  const PATTERN_RULES = {
    mood: { min: 5, diff: 0.5, scale: 4 },
    load: { min: 4, diff: 1, scale: 10 },
  };

  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

  function comparison(a, b, rule) {
    if (a.length < rule.min || b.length < rule.min) return null;
    const diff = mean(a) - mean(b);
    if (Math.abs(diff) < rule.diff) return null;
    return { a: mean(a), b: mean(b), na: a.length, nb: b.length, diff, strength: Math.abs(diff) / rule.scale };
  }

  function patterns({ moods = {}, water = {}, waterTarget = 8, loads = {}, habits = [], habitLog = {}, todayISO, days = 56, limit = 3 } = {}) {
    const today = parseISODate(todayISO);
    if (!today) return { patterns: [], moodDays: 0 };
    const isos = Array.from({ length: days }, (_, index) => toISODate(addDays(today, -(index + 1))));
    const moodOf = (iso) => MOOD_SCORE[moods[iso]];
    const moodIsos = isos.filter((iso) => moodOf(iso));
    const loadOf = (iso) => (Number.isInteger(loads[iso]) ? loads[iso] : null);
    const found = [];

    // Mood on days the water goal was met vs. not (only when water is tracked).
    if (isos.filter((iso) => water[iso] > 0).length >= PATTERN_RULES.mood.min) {
      const met = moodIsos.filter((iso) => (water[iso] || 0) >= waterTarget).map(moodOf);
      const missed = moodIsos.filter((iso) => (water[iso] || 0) < waterTarget).map(moodOf);
      const result = comparison(met, missed, PATTERN_RULES.mood);
      if (result) found.push({ kind: "mood-water", ...result });
    }

    habits.forEach((habit) => {
      // Mood on planned days the habit was done vs. skipped.
      const planned = moodIsos.filter((iso) => habitScheduled(habit, iso));
      const withHabit = comparison(
        planned.filter((iso) => habitDone(habitLog, iso, habit.id)).map(moodOf),
        planned.filter((iso) => !habitDone(habitLog, iso, habit.id)).map(moodOf),
        PATTERN_RULES.mood);
      if (withHabit) found.push({ kind: "mood-habit", habitId: habit.id, ...withHabit });

      // Reported load the day after a planned day, done vs. skipped.
      const after = isos.filter((iso) => habitScheduled(habit, iso))
        .map((iso) => ({ iso, next: toISODate(addDays(parseISODate(iso), 1)) }))
        .filter(({ next }) => next < todayISO && loadOf(next) !== null);
      const nextDay = comparison(
        after.filter(({ iso }) => habitDone(habitLog, iso, habit.id)).map(({ next }) => loadOf(next)),
        after.filter(({ iso }) => !habitDone(habitLog, iso, habit.id)).map(({ next }) => loadOf(next)),
        PATTERN_RULES.load);
      if (nextDay) found.push({ kind: "load-habit", habitId: habit.id, ...nextDay });
    });

    // Mood on days you reported a heavy load (7+) vs. a light one (up to 4).
    const rated = moodIsos.filter((iso) => loadOf(iso) !== null);
    const heavy = comparison(
      rated.filter((iso) => loadOf(iso) >= 7).map(moodOf),
      rated.filter((iso) => loadOf(iso) <= 4).map(moodOf),
      { ...PATTERN_RULES.mood, min: 4 });
    if (heavy) found.push({ kind: "mood-load", ...heavy });

    return {
      patterns: found.sort((a, b) => b.strength - a.strength).slice(0, limit),
      moodDays: moodIsos.length,
    };
  }

  // Planned days done in a month, out of the planned days so far; `extra`
  // counts days done that weren't planned.
  function habitMonth(log, habitOrId, year, month, todayISO) {
    const habit = asHabit(habitOrId);
    const days = new Date(year, month + 1, 0).getDate();
    let total = 0;
    let elapsed = 0;
    let done = 0;
    let extra = 0;
    for (let date = 1; date <= days; date++) {
      const iso = toISODate(new Date(year, month, date));
      const planned = habitScheduled(habit, iso);
      const did = habitDone(log, iso, habit.id);
      if (planned) total += 1;
      if (iso > todayISO) continue;
      if (planned) {
        elapsed += 1;
        if (did) done += 1;
      } else if (did) {
        extra += 1;
      }
    }
    return { done, extra, elapsed, total };
  }

  // ---------- Reminders ----------
  // Everything worth a heads-up today and tomorrow, each with the moment to
  // fire (`at`, ms) and a stable `key` so it's only shown once. The caller
  // decides which are due and builds the words.
  function reminders({ items = [], habits = [], habitLog = {}, events = [], now = new Date(), lead = 10, kinds = {}, morningAt = null } = {}) {
    const today = startOfDay(now);
    const days = [toISODate(today), toISODate(addDays(today, 1))];
    const at = (iso, time) => parseISODate(iso).getTime() + timeToMinutes(time) * 60000;
    const out = [];
    if (kinds.tasks !== false) {
      items.filter((item) => days.includes(item.date) && item.start && !item.done && item.focus !== "later").forEach((item) => {
        out.push({ key: `task:${item.id}:${item.date}T${item.start}`, kind: "task", at: at(item.date, item.start) - lead * 60000, iso: item.date, start: item.start, title: item.title });
      });
    }
    if (kinds.habits !== false) {
      days.forEach((iso) => habits.forEach((habit) => {
        const time = habitTimeOn(habit, iso);
        if (!time || habitDone(habitLog, iso, habit.id)) return;
        out.push({ key: `habit:${habit.id}:${iso}`, kind: "habit", at: at(iso, time.start) - lead * 60000, iso, start: time.start, title: habit.name });
      }));
    }
    if (kinds.meetings !== false) {
      const until = addDays(today, 2).getTime();
      events.filter((event) => !event.allDay).forEach((event) => {
        const start = new Date(event.start);
        if (start.getTime() < today.getTime() || start.getTime() >= until) return;
        out.push({
          key: `event:${event.id}`,
          kind: "meeting",
          at: start.getTime() - lead * 60000,
          iso: toISODate(start),
          start: minutesToTime(start.getHours() * 60 + start.getMinutes()),
          title: event.title,
          event,
        });
      });
    }
    if (isTime(morningAt)) out.push({ key: `morning:${days[0]}`, kind: "morning", at: at(days[0], morningAt), iso: days[0], start: morningAt, title: "" });
    return out.sort((a, b) => a.at - b.at);
  }

  // ---------- Calendar events (read-only, from subscribed calendars) ----------
  // Events come from the desktop app: all-day ones carry ISO dates with an
  // exclusive end, timed ones absolute instants. This splits them for one
  // local day, clipping timed events to that day's minutes.
  function eventsForDay(events, iso) {
    const dayStart = parseISODate(iso);
    if (!dayStart) return { allDay: [], timed: [] };
    const dayEnd = addDays(dayStart, 1);
    const allDay = [];
    const timed = [];
    (events || []).forEach((event) => {
      if (event.allDay) {
        if (event.start <= iso && iso < event.end) allDay.push(event);
        return;
      }
      const start = new Date(event.start);
      const end = new Date(event.end);
      if (!(end > dayStart && start < dayEnd) && !(+start === +end && start >= dayStart && start < dayEnd)) return;
      const startMin = Math.max(0, Math.round((start - dayStart) / 60000));
      const endMin = Math.min(1440, Math.round((end - dayStart) / 60000));
      timed.push({ ...event, startMin, endMin: Math.max(endMin, startMin + 15) });
    });
    timed.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    allDay.sort((a, b) => a.title.localeCompare(b.title));
    return { allDay, timed };
  }

  // Minutes of busy meetings in a day, overlapping ones counted once.
  function busyMinutes(events, iso) {
    const spans = eventsForDay(events, iso).timed.filter((event) => event.busy !== false)
      .map((event) => [event.startMin, Math.min(1440, event.endMin)]);
    let total = 0;
    let reach = -1;
    spans.forEach(([start, end]) => {
      if (end <= reach) return;
      total += end - Math.max(start, reach);
      reach = end;
    });
    return total;
  }

  // ---------- Mental load (perceived, not a stress measure) ----------
  // A rough 0–10 estimate of how full the day feels, from what the planner
  // knows: open must-dos and urgent items, busy hours on the timeline,
  // overdue tasks (today only) and whether the last two days felt heavy.
  // The person can always override it with their own number.
  const HEAVY_MOODS = ["tiring", "stressed", "rough"];

  function mentalLoad(items, iso, { todayISO = iso, moods = {}, events = [] } = {}) {
    const day = items.filter((item) => item.date === iso);
    const open = day.filter((item) => !item.done && item.focus !== "later");
    const must = open.filter((item) => item.focus === "must").length;
    const could = open.filter((item) => item.focus === "could").length;
    const urgent = open.filter((item) => item.priority === "urgent").length;
    const minutes = day
      .filter((item) => item.start && item.focus !== "later")
      .reduce((sum, item) => sum + (item.duration || 60), 0);
    const meetingMinutes = busyMinutes(events, iso);
    const overdue = iso === todayISO ? overdueItems(items, todayISO).length : 0;
    const date = parseISODate(iso);
    const heavyDays = date
      ? [1, 2].filter((back) => HEAVY_MOODS.includes(moods[toISODate(addDays(date, -back))])).length
      : 0;

    const raw = Math.min(must * 1.2, 4)
      + Math.min(could * 0.4, 2)
      + Math.min(urgent * 0.5, 1.5)
      + Math.min(((minutes + meetingMinutes) / 60) * 0.5, 3)
      + Math.min(overdue * 0.5, 2)
      + Math.min(heavyDays * 0.5, 1);
    return {
      score: Math.max(0, Math.min(10, Math.round(raw))),
      factors: {
        must,
        could,
        urgent,
        hours: Math.round((minutes / 60) * 10) / 10,
        meetings: Math.round((meetingMinutes / 60) * 10) / 10,
        overdue,
        heavyDays,
      },
    };
  }

  // 0–2 light, 3–4 calm, 5–6 moderate, 7–8 heavy, 9–10 very heavy.
  function loadLevel(score) {
    if (score <= 2) return "light";
    if (score <= 4) return "calm";
    if (score <= 6) return "moderate";
    if (score <= 8) return "heavy";
    return "veryHeavy";
  }

  // Returns a new { iso: score } map; picking the same score again clears it.
  function setLoad(loads, iso, score) {
    const { [iso]: previous, ...rest } = loads || {};
    const value = Number(score);
    return Number.isInteger(value) && value >= 0 && value <= 10 && value !== previous ? { ...rest, [iso]: value } : rest;
  }

  // The could-do it would hurt least to postpone: open, untimed, last in the day.
  function postponeCandidate(items, iso) {
    const candidates = items
      .filter((item) => item.date === iso && !item.done && item.focus === "could" && !item.start && item.priority !== "urgent")
      .sort(compareInDay);
    return candidates[candidates.length - 1] || null;
  }

  // ---------- Water ----------
  // Glasses, then the most common bottles: 500 ml, 750 ml squeeze, 1 L and
  // 1.2 L (Stanley Quencher size).
  const GLASS_SIZES = [200, 250, 300];
  const BOTTLE_SIZES = [500, 750, 1000, 1200];
  const CONTAINER_SIZES = [...GLASS_SIZES, ...BOTTLE_SIZES];
  const isBottle = (ml) => ml >= 500;
  const WATER_GOAL = { min: 500, max: 5000, step: 250, fallback: 2000 };

  // Snaps a daily goal (ml) to 250 ml steps between 0.5 and 5 L.
  function clampWaterGoal(ml) {
    const value = Number(ml);
    if (!Number.isFinite(value)) return WATER_GOAL.fallback;
    const snapped = Math.round(value / WATER_GOAL.step) * WATER_GOAL.step;
    return Math.max(WATER_GOAL.min, Math.min(WATER_GOAL.max, snapped));
  }
  const MAX_GLASSES = 30;

  // How many glasses reach the daily goal (both in ml).
  function waterTarget(goalMl, glassMl) {
    return Math.max(1, Math.ceil(goalMl / glassMl));
  }

  // Returns a new { iso: glasses } map; zero removes the day.
  function setWater(water, iso, glasses) {
    const { [iso]: _previous, ...rest } = water || {};
    const count = Math.max(0, Math.min(MAX_GLASSES, Math.round(Number(glasses) || 0)));
    return count ? { ...rest, [iso]: count } : rest;
  }

  // 1250 → "1,25 L" (pt) / "1.25 L" (en).
  // Under a liter reads better in ml ("750 ml"); from there on, liters.
  function formatVolume(ml, language = "en") {
    return ml < 1000 ? `${Math.round(ml / 10) * 10} ml` : formatLiters(ml, language);
  }

  function formatLiters(ml, language = "en") {
    const liters = Math.round(ml / 10) / 100;
    return `${liters.toLocaleString(language === "pt" ? "pt-BR" : "en-GB", { maximumFractionDigits: 2 })} L`;
  }

  // Returns a new { iso: mood } map. Picking the day's current mood again
  // (or anything that isn't a mood) clears it.
  function setMood(moods, iso, mood) {
    const { [iso]: previous, ...rest } = moods || {};
    return MOODS.includes(mood) && mood !== previous ? { ...rest, [iso]: mood } : rest;
  }

  function dayOfYear(date) {
    return Math.round((startOfDay(date) - new Date(date.getFullYear(), 0, 1)) / 86400000) + 1;
  }

  function daysInYear(year) {
    return new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
  }

  // Weeks (arrays of 7 dates) needed to show a whole month as a block calendar.
  function monthGrid(year, month, weekStartsOn = 1) {
    const last = new Date(year, month + 1, 0);
    const weeks = [];
    for (let cursor = startOfWeek(new Date(year, month, 1), weekStartsOn); cursor <= last; cursor = addDays(cursor, 7)) {
      weeks.push(Array.from({ length: 7 }, (_, index) => addDays(cursor, index)));
    }
    return weeks;
  }

  // Puts an item on a day at a given time (e.g. dropped on the timeline),
  // keeping its duration or defaulting to one hour.
  function scheduleAt(items, id, { date, start }) {
    if (!parseISODate(date) || !isTime(start)) return items;
    const others = items.filter((item) => item.id !== id);
    return items.map((item) => (item.id !== id ? item : {
      ...item,
      date,
      start,
      duration: item.duration || 60,
      order: item.date === date ? item.order : nextOrder(others, date),
    }));
  }

  // Lays timed items out in side-by-side lanes where they overlap, like a
  // calendar day column. Returns [{ item, start, end, lane, lanes }] in minutes.
  function layoutTimeline(items, defaultDuration = 60) {
    const events = items
      .filter((item) => isTime(item.start))
      .map((item) => {
        const start = timeToMinutes(item.start);
        return { item, start, end: Math.min(1440, start + (item.duration || defaultDuration)) };
      })
      .sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

    const result = [];
    let cluster = [];
    let clusterEnd = -1;
    const flush = () => {
      const laneEnds = [];
      cluster.forEach((event) => {
        let lane = laneEnds.findIndex((end) => end <= event.start);
        if (lane < 0) {
          lane = laneEnds.length;
          laneEnds.push(event.end);
        } else {
          laneEnds[lane] = event.end;
        }
        event.lane = lane;
      });
      cluster.forEach((event) => result.push({ ...event, lanes: laneEnds.length }));
      cluster = [];
    };
    events.forEach((event) => {
      if (cluster.length && event.start >= clusterEnd) flush();
      cluster.push(event);
      clusterEnd = Math.max(clusterEnd, event.end);
    });
    if (cluster.length) flush();
    return result;
  }

  return {
    PALETTE,
    FOCUS,
    QUOTES,
    QUOTE_STYLES,
    MOODS,
    setMood,
    mentalLoad,
    reminders,
    HABIT_ICONS,
    normalizeHabits,
    habitScheduled,
    habitInsight,
    patterns,
    habitActive,
    habitActiveBetween,
    habitTimeOn,
    scheduleRows,
    habitFromRows,
    habitDone,
    toggleHabit,
    forgetHabit,
    habitStreak,
    habitMonth,
    eventsForDay,
    busyMinutes,
    loadLevel,
    setLoad,
    postponeCandidate,
    GLASS_SIZES,
    BOTTLE_SIZES,
    CONTAINER_SIZES,
    isBottle,
    WATER_GOAL,
    clampWaterGoal,
    waterTarget,
    setWater,
    formatLiters,
    formatVolume,
    isoWeekKey,
    moonPhase,
    moonPhaseName,
    moonLitPath,
    easterSunday,
    brazilHolidays,
    holidayName,
    quoteFor,
    dayOfYear,
    daysInYear,
    monthGrid,
    scheduleAt,
    layoutTimeline,
    newId,
    addDays,
    startOfWeek,
    weekDays,
    isoWeekNumber,
    isTime,
    timeToMinutes,
    minutesToTime,
    slug,
    displayName,
    normalizeItem,
    defaultCategories,
    nextColor,
    compareInDay,
    itemsForDay,
    inboxItems,
    overdueItems,
    nextOrder,
    createItem,
    moveItem,
    toggleDone,
    weekStats,
    parseCapture,
    legacyTaskToItem,
    migrateLegacy,
  };
});

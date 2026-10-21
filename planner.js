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
  function moveItem(items, id, { date = null, beforeId = null } = {}) {
    const moving = items.find((item) => item.id === id);
    if (!moving) return items;
    const target = parseISODate(date) ? date : null;
    const moved = { ...moving, date: target };
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

  // ---------- Water ----------
  // Glasses, then the most common bottles: 500 ml, 750 ml squeeze, 1 L and
  // 1.2 L (Stanley Quencher size).
  const GLASS_SIZES = [200, 250, 300];
  const BOTTLE_SIZES = [500, 750, 1000, 1200];
  const CONTAINER_SIZES = [...GLASS_SIZES, ...BOTTLE_SIZES];
  const isBottle = (ml) => ml >= 500;
  const WATER_GOALS = [1500, 2000, 2500, 3000];
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
    QUOTES,
    QUOTE_STYLES,
    MOODS,
    setMood,
    GLASS_SIZES,
    BOTTLE_SIZES,
    CONTAINER_SIZES,
    isBottle,
    WATER_GOALS,
    waterTarget,
    setWater,
    formatLiters,
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

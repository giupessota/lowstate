(function exposeLowstatePlanner(root, factory) {
  const commonJS = typeof module === "object" && module.exports;
  const api = factory(commonJS ? require("./core.js") : root.LowstateCore);
  if (commonJS) module.exports = api;
  else root.LowstatePlanner = api;
})(typeof globalThis !== "undefined" ? globalThis : this, (core) => {
  const { startOfDay, toISODate, parseISODate } = core;

  const PALETTE = ["#5d8fb8", "#d98585", "#5d9d88", "#c79b3f", "#8f75b5", "#6b7480", "#d27c4a", "#4f9aa6"];
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

  return {
    PALETTE,
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

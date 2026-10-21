(() => {
  "use strict";

  const Core = window.LowstateCore;
  const Planner = window.LowstatePlanner;
  const Store = window.LowstateStorage;
  const I18n = window.LowstateI18n;
  const desktop = window.desktopGadget || null;

  const KEYS = {
    items: "type-todo.planner.items.v1",
    categories: "type-todo.planner.categories.v1",
    settings: "type-todo.planner.settings.v1",
    goals: "type-todo.planner.goals.v1",
    notes: "type-todo.planner.notes.v1",
    dayNotes: "type-todo.planner.daynotes.v1",
    moods: "type-todo.planner.moods.v1",
    water: "type-todo.planner.water.v1",
    moodNotes: "type-todo.planner.moodnotes.v1",
    loads: "type-todo.planner.load.v1",
    migrated: "type-todo.planner.migrated.v1",
    theme: "type-todo.theme.v1",
    cover: "type-todo.cover.v1",
    alwaysOnTop: "type-todo.always-on-top.v1",
    shortcuts: "type-todo.shortcuts.v1",
    legacyTodos: "quest-log.todos.v1",
    legacyCategories: "type-todo.categories.v1",
    legacyColors: "type-todo.category-colors.v1",
  };

  const ICON_CHECK = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';
  const ICON_TODAY = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12M13 7l5 5-5 5"/></svg>';
  const SVG_NS = "http://www.w3.org/2000/svg";
  const TAPE_PATTERNS = ["stripes", "dots", "gingham", "waves"];
  const TAPE_COLORS = ["--sakura", "--asagi", "--yamabuki", "--matcha", "--fuji"];
  const TAB_COLORS = ["--indigo", "--vermilion", "--matcha", "--yamabuki", "--fuji", "--asagi"];
  const START_OPTIONS = Array.from({ length: 96 }, (_, index) => Planner.minutesToTime(index * 15));
  const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240];
  const PLACEHOLDER_TEXT = { habits: "comingHabits" };
  const VIEWS = ["day", "week", "month", "habits"];

  const $ = (id) => document.getElementById(id);
  const els = {
    weekGrid: $("weekGrid"),
    washi: $("washi"),
    monthNum: $("monthNum"),
    monthName: $("monthName"),
    yearMark: $("yearMark"),
    proverb: $("proverb"),
    weekLabel: $("weekLabel"),
    weekRange: $("weekRange"),
    goalsList: $("goalsList"),
    goalForm: $("goalForm"),
    goalInput: $("goalInput"),
    weekNotes: $("weekNotes"),
    weekView: $("weekView"),
    dayView: $("dayView"),
    dayWashi: $("dayWashi"),
    dayBig: $("dayBig"),
    dayWeekday: $("dayWeekday"),
    dayMonth: $("dayMonth"),
    dayMoon: $("dayMoon"),
    dayOfYear: $("dayOfYear"),
    dayHoliday: $("dayHoliday"),
    timeline: $("timeline"),
    dayProverb: $("dayProverb"),
    dayProgress: $("dayProgress"),
    dayCaptureForm: $("dayCaptureForm"),
    dayCaptureInput: $("dayCaptureInput"),
    dayTasks: $("dayTasks"),
    dayNotes: $("dayNotes"),
    moodPicker: $("moodPicker"),
    moodReason: $("moodReason"),
    loadMeter: $("loadMeter"),
    waterGoalValue: $("waterGoalValue"),
    waterRow: $("waterRow"),
    waterSum: $("waterSum"),
    monthView: $("monthView"),
    monthWashi: $("monthWashi"),
    mvMonthNum: $("mvMonthNum"),
    mvMonthName: $("mvMonthName"),
    mvYear: $("mvYear"),
    monthWeekdays: $("monthWeekdays"),
    monthGrid: $("monthGrid"),
    placeholderView: $("placeholderView"),
    placeholderIcon: $("placeholderIcon"),
    placeholderText: $("placeholderText"),
    rangeTitle: $("rangeTitle"),
    rangeSub: $("rangeSub"),
    weekProgress: $("weekProgress"),
    progressFill: $("progressFill"),
    progressText: $("progressText"),
    navControls: $("navControls"),
    prevBtn: $("prevBtn"),
    nextBtn: $("nextBtn"),
    todayBtn: $("todayBtn"),
    overdueSection: $("overdueSection"),
    overdueCount: $("overdueCount"),
    overdueList: $("overdueList"),
    moveAllToday: $("moveAllToday"),
    inboxSection: $("inboxSection"),
    inboxForm: $("inboxForm"),
    inboxInput: $("inboxInput"),
    inboxCount: $("inboxCount"),
    inboxList: $("inboxList"),
    inboxEmpty: $("inboxEmpty"),
    settingsBtn: $("settingsBtn"),
    brandYear: $("brandYear"),
    updatePill: $("updatePill"),
    itemDialog: $("itemDialog"),
    itemForm: $("itemForm"),
    itemDone: $("itemDone"),
    itemTitle: $("itemTitle"),
    itemDateLabel: $("itemDateLabel"),
    dateChips: $("dateChips"),
    itemStart: $("itemStart"),
    itemDuration: $("itemDuration"),
    categoryChips: $("categoryChips"),
    newCategoryInput: $("newCategoryInput"),
    newCategoryAdd: $("newCategoryAdd"),
    itemUrgent: $("itemUrgent"),
    itemFocus: $("itemFocus"),
    itemNotes: $("itemNotes"),
    itemDelete: $("itemDelete"),
    itemCancel: $("itemCancel"),
    settingsDialog: $("settingsDialog"),
    settingsClose: $("settingsClose"),
    windowGroup: $("windowGroup"),
    exportData: $("exportData"),
    importData: $("importData"),
    importFile: $("importFile"),
    trashSummary: $("trashSummary"),
    trashRestore: $("trashRestore"),
    trashEmpty: $("trashEmpty"),
    toast: $("toast"),
    toastText: $("toastText"),
    toastAction: $("toastAction"),
  };

  // ---------- helpers ----------
  function t(key, vars = {}) {
    return I18n.t(key).replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
  }

  const locale = () => (I18n.language === "pt" ? "pt-BR" : "en-GB");
  const todayISO = () => Core.toISODate(new Date());
  const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const isTyping = (target) => target instanceof HTMLElement
    && (target.matches("input, textarea, select") || target.isContentEditable);

  function h(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "style") node.style.cssText = value;
      else node.setAttribute(key, value === true ? "" : String(value));
    });
    children.flat().forEach((child) => {
      if (child === null || child === undefined || child === false) return;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  // Only ever called with the constant icon markup above — never user data.
  function icon(markup) {
    const template = document.createElement("template");
    template.innerHTML = markup;
    return template.content.firstElementChild;
  }

  function formatDate(date, options) {
    return new Intl.DateTimeFormat(locale(), options).format(date).replace(/\.(?=\s|$)/g, "");
  }

  function longDate(iso) {
    const date = Core.parseISODate(iso);
    return date ? capitalize(formatDate(date, { weekday: "long", day: "numeric", month: "long" })) : t("noDateOption");
  }

  function shortDate(iso) {
    const date = Core.parseISODate(iso);
    return date ? formatDate(date, { day: "numeric", month: "short" }) : "";
  }

  function formatRange(start, end) {
    const year = end.getFullYear();
    if (start.getFullYear() !== year) {
      return `${formatDate(start, { day: "numeric", month: "short", year: "numeric" })} – ${formatDate(end, { day: "numeric", month: "short", year: "numeric" })}`;
    }
    if (start.getMonth() !== end.getMonth()) {
      return `${formatDate(start, { day: "numeric", month: "short" })} – ${formatDate(end, { day: "numeric", month: "short" })} ${year}`;
    }
    const month = formatDate(start, { month: "long" });
    return I18n.language === "pt"
      ? `${start.getDate()}–${end.getDate()} de ${month} de ${year}`
      : `${start.getDate()}–${end.getDate()} ${capitalize(month)} ${year}`;
  }

  function formatDuration(minutes) {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest}` : `${hours} h`;
  }

  function timeRange(item) {
    if (!item.start) return "";
    if (!item.duration) return item.start;
    return `${item.start}–${Planner.minutesToTime(Planner.timeToMinutes(item.start) + item.duration)}`;
  }

  // ---------- data ----------
  const isCategory = (value) => value && typeof value.id === "string" && typeof value.name === "string"
    && typeof value.color === "string";

  function loadData() {
    let items = Store.loadArray(KEYS.items).map((raw) => Planner.normalizeItem(raw)).filter((item) => item.title);
    let categories = Store.loadArray(KEYS.categories).filter(isCategory);
    let migrated = false;
    let changed = false;

    if (Store.getRaw(KEYS.migrated) === null) {
      const legacy = Planner.migrateLegacy({
        todos: Store.loadArray(KEYS.legacyTodos),
        categories: Store.loadArray(KEYS.legacyCategories),
        categoryColors: Store.loadObject(KEYS.legacyColors),
      });
      const known = new Set(items.map((item) => item.id));
      const fresh = legacy.items.filter((item) => !known.has(item.id));
      legacy.categories.forEach((category) => {
        if (!categories.some((existing) => existing.id === category.id)) categories.push(category);
      });
      items = items.concat(fresh);
      migrated = fresh.length > 0;
      changed = migrated || legacy.categories.length > 0;
      Store.setRaw(KEYS.migrated, "1");
    }
    if (!categories.length) {
      categories = Planner.defaultCategories(I18n.language);
      changed = true;
    }
    return { items, categories, migrated, changed };
  }

  const initial = loadData();
  const savedSettings = Store.loadObject(KEYS.settings);
  const state = {
    // The app always opens on today's page.
    view: "day",
    anchor: Core.startOfDay(new Date()),
    items: initial.items,
    categories: initial.categories,
    settings: {
      weekStart: savedSettings.weekStart === 0 ? 0 : 1,
      holidays: savedSettings.holidays === "off" ? "off" : "br",
      quotes: Planner.QUOTE_STYLES.includes(savedSettings.quotes) ? savedSettings.quotes : "proverbs",
      waterUnit: savedSettings.waterUnit === "liters" ? "liters" : "glasses",
      glassMl: Planner.CONTAINER_SIZES.includes(savedSettings.glassMl) ? savedSettings.glassMl : 250,
      waterGoal: Planner.clampWaterGoal(savedSettings.waterGoal ?? Planner.WATER_GOAL.fallback),
    },
    goals: Store.loadObject(KEYS.goals),
    notes: Store.loadObject(KEYS.notes),
    dayNotes: Store.loadObject(KEYS.dayNotes),
    moods: Store.loadObject(KEYS.moods),
    water: Store.loadObject(KEYS.water),
    moodNotes: Store.loadObject(KEYS.moodNotes),
    loads: Store.loadObject(KEYS.loads),
    editingId: null,
    draft: null,
    dragId: null,
  };

  const persistItems = () => Store.save(KEYS.items, state.items);
  const persistCategories = () => Store.save(KEYS.categories, state.categories);
  const persistSettings = () => Store.save(KEYS.settings, state.settings);
  const persistGoals = () => Store.save(KEYS.goals, state.goals);
  const persistNotes = () => Store.save(KEYS.notes, state.notes);
  const persistDayNotes = () => Store.save(KEYS.dayNotes, state.dayNotes);
  const persistMoods = () => Store.save(KEYS.moods, state.moods);
  const persistWater = () => Store.save(KEYS.water, state.water);
  const persistMoodNotes = () => Store.save(KEYS.moodNotes, state.moodNotes);
  const persistLoads = () => Store.save(KEYS.loads, state.loads);

  if (initial.changed) {
    persistItems();
    persistCategories();
  }

  const findItem = (id) => state.items.find((item) => item.id === id);
  const categoryById = (id) => state.categories.find((category) => category.id === id) || null;

  function commit() {
    persistItems();
    render();
  }

  function updateItem(updated) {
    state.items = state.items.map((item) => (item.id === updated.id ? updated : item));
    commit();
  }

  function addItem(fields) {
    const item = Planner.createItem(state.items, fields);
    state.items = [...state.items, item];
    commit();
    return item;
  }

  function toggleItem(id) {
    const item = findItem(id);
    if (item) updateItem(Planner.toggleDone(item, todayISO()));
  }

  function moveToToday(ids) {
    const today = todayISO();
    state.items = ids.reduce((items, id) => Planner.moveItem(items, id, { date: today }), state.items);
    commit();
  }

  function restoreItem(item, index) {
    const restored = Planner.normalizeItem(item);
    const rest = state.items.filter((existing) => existing.id !== restored.id);
    rest.splice(Math.min(Number.isInteger(index) ? index : rest.length, rest.length), 0, restored);
    state.items = rest;
    commit();
  }

  function deleteItem(id) {
    const index = state.items.findIndex((item) => item.id === id);
    if (index < 0) return;
    const item = state.items[index];
    const [entry] = Store.trash("item", item, index);
    state.items = state.items.filter((existing) => existing.id !== id);
    commit();
    toast(t("itemDeleted"), t("undo"), () => {
      Store.removeTrashEntry(entry.id);
      restoreItem(item, index);
    });
  }

  function resolveCategory(name) {
    if (!name) return null;
    const wanted = Planner.slug(name);
    const existing = state.categories.find((category) => category.id === wanted || Planner.slug(category.name) === wanted);
    if (existing) return existing.id;
    const category = { id: wanted, name: Planner.displayName(name), color: Planner.nextColor(state.categories) };
    state.categories = [...state.categories, category];
    persistCategories();
    return category.id;
  }

  // Shared by the sidebar capture field and the per-day "+ Add" inputs.
  // fallbackStart is used when capturing on a timeline slot; a time typed in
  // the text still wins.
  function capture(text, fallbackDate = null, fallbackStart = null) {
    const parsed = Planner.parseCapture(text);
    if (!parsed.title) return null;
    const start = parsed.start || fallbackStart;
    const date = parsed.date || fallbackDate || (start ? todayISO() : null);
    return addItem({
      title: parsed.title,
      date,
      start: date ? start : null,
      duration: date && start ? 60 : null,
      priority: parsed.priority,
      category: resolveCategory(parsed.category),
    });
  }

  // ---------- rendering ----------
  function checkButton(done, attrs) {
    return h("button", {
      type: "button",
      class: "check",
      "aria-pressed": String(done),
      "aria-label": t(done ? "markOpen" : "markDone"),
      ...attrs,
    }, icon(ICON_CHECK));
  }

  // "line" = written on a day row; "inbox"/"overdue" = loose slip on the cover;
  // "mini" = one-line entry in a month cell.
  function itemEl(item, variant = "line") {
    const category = categoryById(item.category);
    if (variant === "mini") {
      const classes = ["item", "mini"];
      if (item.done) classes.push("is-done");
      if (item.priority === "urgent") classes.push("is-urgent");
      return h("li", {
        class: classes.join(" "),
        "data-id": item.id,
        draggable: "true",
        style: category ? `--cat: ${category.color}` : null,
      },
        h("i", { "aria-hidden": "true" }),
        h("span", { class: "item-body", "data-action": "edit", role: "button", tabindex: "0", title: item.title },
          item.start ? h("span", { class: "mini-time", text: item.start }) : null,
          item.title));
    }
    const classes = ["item", variant === "line" ? "line" : "slip"];
    if (variant === "overdue") classes.push("overdue");
    if (item.done) classes.push("is-done");
    if (item.priority === "urgent") classes.push("is-urgent");
    if (item.focus === "later" && item.date) classes.push("is-later");

    const stamp = category ? h("span", { class: "stamp", text: category.name }) : null;
    // Urgent items get a little "!" seal.
    const seal = item.priority === "urgent"
      ? h("span", { class: "seal", title: t("urgentToggle"), "aria-label": t("urgentToggle"), role: "img" }, "!")
      : null;
    const notesMark = item.notes.trim() ? h("span", { class: "notes-mark", title: item.notes, text: "≡" }) : null;

    let body;
    if (variant === "line") {
      body = h("div", { class: "item-body", "data-action": "edit", role: "button", tabindex: "0" },
        item.start ? h("span", { class: "line-time", text: timeRange(item) }) : null,
        h("span", { class: "line-title", text: item.title }),
        stamp, seal, notesMark);
    } else {
      const meta = [
        variant === "overdue" ? h("span", { class: "slip-date", text: shortDate(item.date) }) : null,
        item.start && variant !== "overdue" ? h("span", { class: "line-time", text: item.start }) : null,
        stamp,
        seal,
      ].filter(Boolean);
      body = h("div", { class: "item-body", "data-action": "edit", role: "button", tabindex: "0" },
        h("div", { class: "slip-title", text: item.title }),
        meta.length ? h("div", { class: "slip-meta" }, meta) : null);
    }
    const action = variant === "overdue"
      ? h("button", { type: "button", class: "item-action", "data-action": "today", title: t("moveToday"), "aria-label": t("moveToday") }, icon(ICON_TODAY))
      : null;

    return h("li", {
      class: classes.join(" "),
      "data-id": item.id,
      draggable: "true",
      style: category ? `--cat: ${category.color}` : null,
    }, checkButton(item.done, { "data-action": "toggle" }), body, action);
  }

  function svgEl(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function moonEl(date) {
    const phase = Planner.moonPhase(date);
    const label = t(`moon-${Planner.moonPhaseName(phase)}`);
    const svg = svgEl("svg", { class: "moon", viewBox: "0 0 12 12", role: "img", "aria-label": label });
    const title = svgEl("title", {});
    title.textContent = label;
    svg.append(
      title,
      svgEl("circle", { class: "shadow", cx: 6, cy: 6, r: 5 }),
      svgEl("path", { class: "lit", d: Planner.moonLitPath(phase) }),
      svgEl("circle", { class: "rim", cx: 6, cy: 6, r: 5 }));
    return svg;
  }

  // Little ink faces for the mood of the day, drawn on a 24×24 grid.
  const MOOD_FACES = {
    great: { eyes: ["M7.5 10.5q1.5-2 3 0", "M13.5 10.5q1.5-2 3 0"], mouth: "M7 13.5c1.2 4.2 8.8 4.2 10 0Z" },
    good: { eyes: "dots", mouth: "M8 14c1.5 2.4 6.5 2.4 8 0" },
    okay: { eyes: "dots", mouth: "M8.5 15h7" },
    tiring: { eyes: ["M7.5 10.5h3", "M13.5 10.5h3"], mouth: "M8.5 15.5q1.75-1.5 3.5 0t3.5 0" },
    stressed: { eyes: "dots", brows: ["M6.8 7.6l3.4 1.4", "M17.2 7.6l-3.4 1.4"], mouth: "M7.8 15.6l1.4-1.2 1.4 1.2 1.4-1.2 1.4 1.2 1.4-1.2 1.4 1.2" },
    rough: { eyes: "dots", mouth: "M8 16.5c1.5-2.4 6.5-2.4 8 0" },
  };

  function moodEl(mood, className = "mood-face", reason = "") {
    const face = MOOD_FACES[mood];
    if (!face) return null;
    const label = reason ? `${t(`mood-${mood}`)} — ${reason}` : t(`mood-${mood}`);
    const svg = svgEl("svg", { class: `${className} mood-${mood}`, viewBox: "0 0 24 24", role: "img", "aria-label": label });
    const title = svgEl("title", {});
    title.textContent = label;
    svg.append(title, svgEl("circle", { class: "face", cx: 12, cy: 12, r: 10 }));
    if (face.eyes === "dots") {
      svg.append(svgEl("circle", { class: "dot", cx: 9, cy: 10, r: 1.2 }), svgEl("circle", { class: "dot", cx: 15, cy: 10, r: 1.2 }));
    } else {
      face.eyes.forEach((d) => svg.append(svgEl("path", { class: "line", d })));
    }
    face.brows?.forEach((d) => svg.append(svgEl("path", { class: "line", d })));
    svg.append(svgEl("path", { class: mood === "great" ? "line fill" : "line", d: face.mouth }));
    return svg;
  }

  function renderMoodPicker(iso) {
    const current = state.moods[iso];
    els.moodReason.hidden = !current;
    if (document.activeElement !== els.moodReason) els.moodReason.value = state.moodNotes[iso] || "";
    els.moodPicker.replaceChildren(...Planner.MOODS.map((mood) => h("button", {
      type: "button",
      class: "mood-btn",
      "data-mood": mood,
      "aria-pressed": String(current === mood),
    }, moodEl(mood), h("span", { text: t(`mood-${mood}`) }))));
  }

  // A glass (or bottle) outline with the water level inside, on an 18×22 grid.
  function glassEl(bottle) {
    const svg = svgEl("svg", { class: "glass-icon", viewBox: "0 0 18 22", "aria-hidden": "true" });
    if (bottle) {
      svg.append(
        svgEl("path", { class: "glass-water", d: "M4.4 10h9.2v9.4a1 1 0 0 1-1 1H5.4a1 1 0 0 1-1-1Z" }),
        svgEl("rect", { class: "glass-rim", x: 6.5, y: 0.8, width: 5, height: 2.6, rx: 0.8 }),
        svgEl("path", { class: "glass-rim", d: "M6.8 3.4h4.4v1.6c0 .9 3.3 1.7 3.3 3.8v11a1.6 1.6 0 0 1-1.6 1.6H5.1a1.6 1.6 0 0 1-1.6-1.6v-11c0-2.1 3.3-2.9 3.3-3.8Z" }));
      return svg;
    }
    svg.append(
      svgEl("path", { class: "glass-water", d: "M3.6 8.5h10.8l-1.1 11H4.7Z" }),
      svgEl("path", { class: "glass-rim", d: "M2.2 2.5h13.6l-1.7 17.6a1.6 1.6 0 0 1-1.6 1.4H5.5a1.6 1.6 0 0 1-1.6-1.4Z" }));
    return svg;
  }

  function renderWater(iso) {
    const { waterUnit, glassMl, waterGoal } = state.settings;
    const target = Planner.waterTarget(waterGoal, glassMl);
    const count = state.water[iso] || 0;
    const slots = Math.max(target, count);
    const bottle = Planner.isBottle(glassMl);
    const word = bottle ? { n: "bottleN", add: "addBottle", remove: "removeBottle", sum: "waterBottles" } : { n: "glassN", add: "addGlass", remove: "removeGlass", sum: "waterGlasses" };
    const glasses = Array.from({ length: slots }, (_, index) => h("button", {
      type: "button",
      class: `glass${index < count ? " is-full" : ""}${index >= target ? " is-extra" : ""}`,
      "data-glass": index + 1,
      "aria-pressed": String(index < count),
      "aria-label": t(word.n, { n: index + 1 }),
      title: t(word.n, { n: index + 1 }),
    }, glassEl(bottle)));
    els.waterRow.replaceChildren(...glasses,
      h("button", { type: "button", class: "water-step", "data-water": "-1", "aria-label": t(word.remove), title: t(word.remove), disabled: count === 0 ? "" : null, text: "−" }),
      h("button", { type: "button", class: "water-step", "data-water": "1", "aria-label": t(word.add), title: t(word.add), text: "+" }));
    els.waterSum.textContent = waterUnit === "liters"
      ? t("waterLiters", { n: Planner.formatLiters(count * glassMl, I18n.language).replace(" L", ""), total: Planner.formatLiters(waterGoal, I18n.language) })
      : t(word.sum, { n: count, total: target });
    els.waterSum.classList.toggle("is-done", count >= target);
  }

  function weekDays() {
    return Planner.weekDays(state.anchor, state.settings.weekStart);
  }

  const currentWeekKey = () => Planner.isoWeekKey(weekDays()[3]);

  function dayClasses(day, base) {
    const iso = Core.toISODate(day);
    const today = todayISO();
    const classes = [base];
    if (iso === today) classes.push("is-today");
    else if (iso < today) classes.push("is-past");
    if (day.getDay() === 6) classes.push("is-sat");
    if (day.getDay() === 0) classes.push("is-sun");
    if (holidayFor(iso)) classes.push("is-holiday");
    return classes.join(" ");
  }

  const holidayFor = (iso) => (state.settings.holidays === "br" ? Planner.holidayName(iso, I18n.language) : null);

  // Fills a page footer with the chosen style's quote, or hides it.
  function showQuote(el, n) {
    const quote = Planner.quoteFor(state.settings.quotes, n);
    el.parentElement.hidden = !quote;
    el.textContent = quote ? quote[I18n.language] || quote.en : "";
  }
  const anchorISO = () => Core.toISODate(state.anchor);

  function renderTopbar() {
    const view = state.view;
    els.navControls.hidden = view === "habits";
    els.rangeSub.textContent = "";
    els.weekProgress.hidden = true;
    const now = new Date();

    if (view === "habits") {
      els.rangeTitle.textContent = t("viewHabits");
    } else if (view === "day") {
      els.rangeTitle.textContent = capitalize(formatDate(state.anchor, { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
      els.todayBtn.disabled = anchorISO() === todayISO();
    } else if (view === "month") {
      els.rangeTitle.textContent = capitalize(formatDate(state.anchor, { month: "long", year: "numeric" }));
      els.todayBtn.disabled = state.anchor.getMonth() === now.getMonth() && state.anchor.getFullYear() === now.getFullYear();
    } else {
      const days = weekDays();
      const today = todayISO();
      els.rangeTitle.textContent = formatRange(days[0], days[6]);
      els.todayBtn.disabled = days.some((day) => Core.toISODate(day) === today);
      const stats = Planner.weekStats(state.items, days);
      els.weekProgress.hidden = stats.total === 0;
      els.progressFill.style.width = `${stats.total ? Math.round((stats.done / stats.total) * 100) : 0}%`;
      els.progressText.textContent = t("weekProgress", stats);
    }
  }

  function renderDays(days) {
    els.weekGrid.replaceChildren(...days.map((day) => {
      const iso = Core.toISODate(day);
      const holiday = holidayFor(iso);

      return h("section", {
        class: dayClasses(day, "day-row"),
        "data-date": iso,
        "aria-label": holiday ? `${longDate(iso)} — ${holiday}` : longDate(iso),
      },
        h("div", { class: "day-stamp", "data-open-day": iso, title: t("openDay", { date: longDate(iso) }) },
          h("span", { class: "date-num", text: String(day.getDate()).padStart(2, "0") }),
          h("span", { class: "dow", text: formatDate(day, { weekday: "short" }) }),
          h("span", { class: "stamp-icons" }, moonEl(day), moodEl(state.moods[iso], "mood-mini", state.moodNotes[iso]))),
        h("div", { class: "day-body" },
          holiday ? h("p", { class: "holiday", text: holiday }) : null,
          h("ul", { class: "day-items", "data-date": iso },
            Planner.itemsForDay(state.items, iso).map((item) => itemEl(item, "line"))),
          h("form", { class: "day-add", "data-date": iso },
            h("input", {
              name: "title",
              autocomplete: "off",
              maxlength: "200",
              placeholder: "+",
              "aria-label": `${t("addInline")} — ${longDate(iso)}`,
            }))));
    }));
  }

  function renderSpread() {
    const days = weekDays();
    const reference = days[3];
    const weekNumber = Planner.isoWeekNumber(reference);
    const sameMonth = days[0].getMonth() === days[6].getMonth();

    els.monthNum.textContent = String(reference.getMonth() + 1).padStart(2, "0");
    els.monthName.textContent = sameMonth
      ? formatDate(reference, { month: "long" })
      : `${formatDate(days[0], { month: "short" })} – ${formatDate(days[6], { month: "short" })}`;
    els.yearMark.textContent = String(reference.getFullYear());
    els.washi.dataset.pattern = TAPE_PATTERNS[weekNumber % TAPE_PATTERNS.length];
    els.washi.style.setProperty("--tape", `var(${TAPE_COLORS[weekNumber % TAPE_COLORS.length]})`);

    renderDays(days);

    showQuote(els.proverb, weekNumber);

    els.weekLabel.textContent = t("weekNumber", { n: weekNumber });
    els.weekRange.textContent = `${formatDate(days[0], { day: "2-digit", month: "2-digit" })} — ${formatDate(days[6], { day: "2-digit", month: "2-digit" })}`;
    renderGoals();
    renderNotes();
    renderMonthTabs(reference);
  }

  function setWashi(element, seed) {
    element.dataset.pattern = TAPE_PATTERNS[seed % TAPE_PATTERNS.length];
    element.style.setProperty("--tape", `var(${TAPE_COLORS[seed % TAPE_COLORS.length]})`);
  }

  // ---------- day page (Hobonichi Techo style) ----------
  const TIMELINE_START = 6;
  let timelineScrolledFor = null;

  function timelineHourHeight() {
    return parseFloat(getComputedStyle(els.timeline).getPropertyValue("--hour")) || 42;
  }

  function timelineRange(events) {
    const earliest = events.length ? Math.floor(Math.min(...events.map((event) => event.start)) / 60) : TIMELINE_START;
    return { first: Math.min(TIMELINE_START, earliest), last: 24 };
  }

  function renderTimeline(iso) {
    const items = Planner.itemsForDay(state.items, iso);
    const events = Planner.layoutTimeline(items);
    const { first, last } = timelineRange(events);
    const hour = timelineHourHeight();
    const inner = h("div", { class: "timeline-inner", "data-first-hour": first, style: `height: ${(last - first) * hour}px` });

    for (let current = first; current < last; current++) {
      const time = Planner.minutesToTime(current * 60);
      inner.append(h("div", { class: "hour-row", style: `top: ${(current - first) * hour}px` },
        h("span", { class: "hour-label", text: String(current).padStart(2, "0") }),
        h("button", { type: "button", class: "hour-slot", "data-slot": time, "aria-label": t("addAtTime", { time }) })));
    }

    events.forEach((event) => {
      const { item } = event;
      const category = categoryById(item.category);
      const top = ((event.start - first * 60) / 60) * hour;
      const height = Math.max(((event.end - event.start) / 60) * hour - 2, 20);
      const classes = ["item", "block"];
      if (item.done) classes.push("is-done");
      if (item.priority === "urgent") classes.push("is-urgent");
      if (height < 34) classes.push("short");
      // Title lines that fit under the time label (6px padding, 13px time,
      // ~16px per title line); the rest ends in an ellipsis.
      const lines = Math.max(1, Math.floor((height - 19) / 16));
      inner.append(h("div", {
        class: classes.join(" "),
        "data-id": item.id,
        draggable: "true",
        style: `top: ${top}px; --h: ${height}px; --lane: ${event.lane}; --lanes: ${event.lanes}; --lines: ${lines};${category ? ` --cat: ${category.color};` : ""}`,
      },
        checkButton(item.done, { "data-action": "toggle" }),
        h("div", { class: "item-body", "data-action": "edit", role: "button", tabindex: "0", title: item.title },
          h("span", { class: "block-time", text: timeRange(item) }),
          h("span", { class: "block-title", text: item.title }))));
    });

    if (iso === todayISO()) inner.append(h("div", { class: "now-line", id: "nowLine", title: t("now") }, h("span", { class: "now-time" })));
    els.timeline.replaceChildren(inner);
    positionNowLine();

    // Scroll once per shown day: to now on today, otherwise to the first
    // timed item or 8 o'clock.
    if (timelineScrolledFor !== iso) {
      timelineScrolledFor = iso;
      const focusMinutes = iso === todayISO()
        ? new Date().getHours() * 60 + new Date().getMinutes() - 60
        : (events[0]?.start ?? 8 * 60) - 30;
      els.timeline.scrollTop = Math.max(0, ((focusMinutes - first * 60) / 60) * hour);
    }
  }

  function positionNowLine() {
    const line = document.getElementById("nowLine");
    const inner = els.timeline.querySelector(".timeline-inner");
    if (!line || !inner) return;
    const now = new Date();
    const first = Number(inner.dataset.firstHour);
    line.style.top = `${((now.getHours() * 60 + now.getMinutes() - first * 60) / 60) * timelineHourHeight()}px`;
    line.firstChild.textContent = Planner.minutesToTime(now.getHours() * 60 + now.getMinutes());
  }

  function minutesAtTimelineY(clientY) {
    const inner = els.timeline.querySelector(".timeline-inner");
    const rect = inner.getBoundingClientRect();
    const first = Number(inner.dataset.firstHour);
    const raw = first * 60 + ((clientY - rect.top) / timelineHourHeight()) * 60;
    return Math.max(0, Math.min(23 * 60 + 45, Math.round(raw / 15) * 15));
  }

  function renderDayView() {
    const day = state.anchor;
    const iso = anchorISO();
    const holiday = holidayFor(iso);
    els.dayView.className = `view ${dayClasses(day, "day-view")}`;

    els.dayBig.textContent = String(day.getDate()).padStart(2, "0");
    els.dayWeekday.textContent = capitalize(formatDate(day, { weekday: "long" }));
    els.dayMonth.textContent = capitalize(formatDate(day, { month: "long", year: "numeric" }));
    const moon = moonEl(day);
    els.dayMoon.replaceChildren(moon, moon.getAttribute("aria-label"));
    els.dayOfYear.textContent = t("dayOfYear", { n: Planner.dayOfYear(day), total: Planner.daysInYear(day.getFullYear()) });
    els.dayHoliday.hidden = !holiday;
    els.dayHoliday.textContent = holiday || "";
    setWashi(els.dayWashi, Planner.dayOfYear(day));

    showQuote(els.dayProverb, Planner.dayOfYear(day));

    renderTimeline(iso);

    const items = Planner.itemsForDay(state.items, iso);
    renderDayTasks(iso, items);
    renderLoad(iso);
    // "Not today" items don't count against the day.
    const counted = items.filter((item) => item.focus !== "later");
    const done = counted.filter((item) => item.done).length;
    els.dayProgress.textContent = counted.length ? t("weekProgress", { done, total: counted.length }) : "";

    renderWater(iso);
    renderMoodPicker(iso);
    renderDayNotes();
    renderMonthTabs(day);
  }

  // Mental load: the app's estimate as a ghost, the person's own rating
  // solid. Clicking a tick sets the rating; clicking it again clears it.
  function renderLoad(iso) {
    const estimate = Planner.mentalLoad(state.items, iso, { todayISO: todayISO(), moods: state.moods });
    const own = state.loads[iso];
    const hasOwn = Number.isInteger(own);
    const score = hasOwn ? own : estimate.score;
    const level = Planner.loadLevel(score);
    const { factors } = estimate;
    const number = new Intl.NumberFormat(I18n.language === "pt" ? "pt-BR" : "en-GB", { maximumFractionDigits: 1 });
    const parts = Object.entries(factors).filter(([, value]) => value > 0).map(([key, value]) => t(`loadF-${key}`, { n: number.format(value) }));
    const why = `${parts.length ? t("loadWhy", { list: parts.join(" · ") }) : t("loadWhyNothing")}\n${t("loadNote")}`;

    const ticks = Array.from({ length: 10 }, (_, index) => {
      const n = index + 1;
      return h("button", {
        type: "button",
        class: `load-tick${n <= score ? " is-on" : ""}${hasOwn && n === estimate.score ? " is-estimate" : ""}`,
        "data-load": n,
        "aria-label": t("loadSet", { n }),
        "aria-pressed": String(hasOwn && n === own),
        title: t("loadSet", { n }),
      });
    });

    const candidate = score >= 7 && iso >= todayISO() ? Planner.postponeCandidate(state.items, iso) : null;
    els.loadMeter.className = `load level-${level}${hasOwn ? " is-own" : ""}`;
    els.loadMeter.replaceChildren(
      h("div", { class: "load-head", title: why },
        h("span", { class: "load-title", text: t("load") }),
        h("span", { class: "load-ticks", role: "group" }, ticks),
        h("strong", { class: "load-score", text: `${score}/10` }),
        h("span", { class: "load-label", text: t(`load-${level}`) }),
        h("span", { class: "load-source", text: hasOwn ? `${t("loadYours")} · ${t("loadEstimateIs", { n: estimate.score })}` : `${t("loadEstimate")} · ${t("loadAdjust")}` })),
      score >= 5 || candidate ? h("p", { class: "load-text" },
        t(`loadText-${level}`),
        candidate ? h("button", { type: "button", class: "load-action", "data-postpone": candidate.id, text: t("loadPostpone", { title: candidate.title }) }) : null) : null);
  }

  const FOCUS_LABELS = { must: "focusMust", could: "focusCould", later: "focusLater" };

  function renderDayTasks(iso, items) {
    els.dayTasks.dataset.date = iso;
    els.dayTasks.replaceChildren(...Planner.FOCUS.map((focus) => {
      const group = items.filter((item) => item.focus === focus);
      const movable = focus === "later" && group.some((item) => !item.done);
      return h("section", { class: `focus-group focus-${focus}`, "data-focus": focus },
        h("h3", { class: "focus-head" },
          h("span", { text: t(FOCUS_LABELS[focus]) }),
          group.length ? h("span", { class: "focus-count", text: String(group.length) }) : null,
          movable ? h("button", { type: "button", class: "focus-action", "data-later-tomorrow": iso, text: t("allToTomorrow") }) : null),
        h("ul", { class: "day-items", "data-date": iso, "data-focus": focus }, group.map((item) => itemEl(item, "line"))),
        group.length ? null : h("p", { class: "focus-hint", text: t(`${FOCUS_LABELS[focus]}Hint`) }));
    }));
  }

  let dayNotesKey = null;
  let dayNotesTimer = null;

  function renderDayNotes() {
    const key = anchorISO();
    if (key === dayNotesKey && document.activeElement === els.dayNotes) return;
    dayNotesKey = key;
    els.dayNotes.value = state.dayNotes[key] || "";
  }

  function saveDayNotes() {
    clearTimeout(dayNotesTimer);
    if (!dayNotesKey) return;
    const text = els.dayNotes.value;
    const { [dayNotesKey]: _previous, ...rest } = state.dayNotes;
    state.dayNotes = text.trim() ? { ...rest, [dayNotesKey]: text } : rest;
    persistDayNotes();
  }

  // Inline field on an empty timeline slot.
  function openSlot(time) {
    els.timeline.querySelector(".slot-add")?.remove();
    const inner = els.timeline.querySelector(".timeline-inner");
    const first = Number(inner.dataset.firstHour);
    const top = ((Planner.timeToMinutes(time) - first * 60) / 60) * timelineHourHeight();
    const input = h("input", { maxlength: "200", autocomplete: "off", placeholder: `${time} — ${t("addAtTime", { time })}`, "aria-label": t("addAtTime", { time }) });
    const form = h("form", { class: "slot-add", style: `top: ${top + 4}px`, "data-slot": time }, input);
    inner.append(form);
    input.focus();
    input.addEventListener("blur", () => setTimeout(() => form.remove(), 120));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") form.remove();
    });
  }

  // ---------- month page ----------
  function renderMonthView() {
    const year = state.anchor.getFullYear();
    const month = state.anchor.getMonth();
    const reference = new Date(year, month, 1);
    els.mvMonthNum.textContent = String(month + 1).padStart(2, "0");
    els.mvMonthName.textContent = formatDate(reference, { month: "long" });
    els.mvYear.textContent = String(year);
    setWashi(els.monthWashi, month + 3);

    const weeks = Planner.monthGrid(year, month, state.settings.weekStart);
    els.monthWeekdays.replaceChildren(...weeks[0].map((day) => h("span", {
      class: day.getDay() === 6 ? "wd-sat" : day.getDay() === 0 ? "wd-sun" : null,
    }, formatDate(day, { weekday: "short" }))));

    const limit = weeks.length > 5 ? 3 : 4;
    els.monthGrid.style.gridTemplateRows = `repeat(${weeks.length}, minmax(0, 1fr))`;
    els.monthGrid.replaceChildren(...weeks.flat().map((day) => {
      const iso = Core.toISODate(day);
      const holiday = holidayFor(iso);
      const items = Planner.itemsForDay(state.items, iso);
      const classes = dayClasses(day, "month-cell") + (day.getMonth() === month ? "" : " is-other");
      return h("div", { class: classes, "data-date": iso, "data-open-day": iso, title: t("openDay", { date: longDate(iso) }) },
        h("div", { class: "cell-head" },
          h("span", { class: "cell-num", text: day.getDate() }),
          holiday ? h("span", { class: "cell-holiday", text: holiday }) : null,
          moodEl(state.moods[iso], "mood-mini", state.moodNotes[iso])),
        h("ul", { class: "month-items", "data-date": iso }, items.slice(0, limit).map((item) => itemEl(item, "mini"))),
        items.length > limit ? h("span", { class: "cell-more", text: t("moreItems", { n: items.length - limit }) }) : null);
    }));
    renderMonthTabs(reference);
  }

  // ---------- weekly goals & notes (right page) ----------
  function weekGoals() {
    const goals = state.goals[currentWeekKey()];
    return Array.isArray(goals) ? goals : [];
  }

  function setWeekGoals(goals) {
    const key = currentWeekKey();
    const { [key]: _previous, ...rest } = state.goals;
    state.goals = goals.length ? { ...rest, [key]: goals } : rest;
    persistGoals();
    renderGoals();
  }

  function renderGoals() {
    els.goalsList.replaceChildren(...weekGoals().map((goal) => h("li", { class: `goal${goal.done ? " is-done" : ""}`, "data-goal": goal.id },
      checkButton(goal.done, { "data-goal-action": "toggle" }),
      h("span", { class: "goal-text", text: goal.text }),
      h("button", {
        type: "button",
        class: "goal-remove",
        "data-goal-action": "remove",
        title: t("removeGoal"),
        "aria-label": t("removeGoal"),
      }, "×"))));
  }

  let notesKey = null;
  let notesTimer = null;

  function renderNotes() {
    const key = currentWeekKey();
    // Never overwrite what someone is typing in the same week.
    if (key === notesKey && document.activeElement === els.weekNotes) return;
    notesKey = key;
    els.weekNotes.value = state.notes[key] || "";
  }

  function saveNotes() {
    clearTimeout(notesTimer);
    if (!notesKey) return;
    const text = els.weekNotes.value;
    const { [notesKey]: _previous, ...rest } = state.notes;
    state.notes = text.trim() ? { ...rest, [notesKey]: text } : rest;
    persistNotes();
  }

  function renderMonthTabs(reference) {
    const year = reference.getFullYear();
    const active = reference.getMonth();
    const container = document.querySelector(".view:not([hidden]) .month-tabs");
    if (!container) return;
    container.replaceChildren(...Array.from({ length: 12 }, (_, month) => {
      const label = capitalize(formatDate(new Date(year, month, 1), { month: "long", year: "numeric" }));
      return h("button", {
        type: "button",
        class: `month-tab${month === active ? " active" : ""}`,
        "data-month": month,
        title: label,
        "aria-label": label,
        "aria-current": month === active ? "true" : null,
        style: `--tab: var(${TAB_COLORS[month % TAB_COLORS.length]})`,
      }, formatDate(new Date(year, month, 1), { month: "short" }).replace(".", "").slice(0, 3));
    }));
  }

  function renderPlaceholder() {
    const navIcon = document.querySelector(`.nav-btn[data-view="${state.view}"] svg`);
    els.placeholderIcon.replaceChildren(navIcon ? navIcon.cloneNode(true) : "");
    els.placeholderText.textContent = t(PLACEHOLDER_TEXT[state.view]);
  }

  function renderSidebar() {
    const overdue = Planner.overdueItems(state.items, todayISO());
    els.overdueSection.hidden = overdue.length === 0;
    els.overdueCount.textContent = overdue.length || "";
    els.overdueList.replaceChildren(...overdue.map((item) => itemEl(item, "overdue")));

    const inbox = Planner.inboxItems(state.items);
    els.inboxCount.textContent = inbox.length || "";
    els.inboxList.replaceChildren(...inbox.map((item) => itemEl(item, "inbox")));
    els.inboxEmpty.hidden = inbox.length > 0;
  }

  function render() {
    els.brandYear.textContent = String(new Date().getFullYear());
    document.querySelectorAll(".nav-btn").forEach((button) => {
      const active = button.dataset.view === state.view;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    els.dayView.hidden = state.view !== "day";
    els.weekView.hidden = state.view !== "week";
    els.monthView.hidden = state.view !== "month";
    els.placeholderView.hidden = state.view !== "habits";
    renderTopbar();
    if (state.view === "day") renderDayView();
    else if (state.view === "week") renderSpread();
    else if (state.view === "month") renderMonthView();
    else renderPlaceholder();
    renderSidebar();
  }

  function setView(view) {
    if (!VIEWS.includes(view)) return;
    state.view = view;
    render();
  }

  function openDay(iso) {
    const date = Core.parseISODate(iso);
    if (!date) return;
    state.anchor = date;
    setView("day");
  }

  // Previous/next by the unit of the current view.
  function shift(direction) {
    if (state.view === "day") state.anchor = Planner.addDays(state.anchor, direction);
    else if (state.view === "week") state.anchor = Planner.addDays(state.anchor, direction * 7);
    else if (state.view === "month") state.anchor = new Date(state.anchor.getFullYear(), state.anchor.getMonth() + direction, 1);
    render();
  }

  function goToday() {
    state.anchor = Core.startOfDay(new Date());
    render();
  }

  // ---------- item editor ----------
  function fillSelect(select, options, emptyLabel, labelFor) {
    select.replaceChildren(
      h("option", { value: "", text: emptyLabel }),
      ...options.map((value) => h("option", { value: String(value), text: labelFor(value) })));
  }

  function renderEditor() {
    const draft = state.draft;
    els.itemDone.setAttribute("aria-pressed", String(draft.done));
    els.itemDone.setAttribute("aria-label", t(draft.done ? "markOpen" : "markDone"));
    els.itemDateLabel.textContent = draft.date ? longDate(draft.date) : t("noDateOption");

    const today = todayISO();
    const quick = {
      today,
      tomorrow: Core.quickDueISO("tomorrow"),
      nextweek: Core.quickDueISO("nextweek"),
      none: null,
    };
    els.dateChips.querySelectorAll("[data-date-quick]").forEach((chip) => {
      chip.classList.toggle("active", quick[chip.dataset.dateQuick] === draft.date);
    });

    fillSelect(els.itemStart, START_OPTIONS, t("noTimeOption"), (value) => value);
    fillSelect(els.itemDuration, DURATION_OPTIONS, "—", formatDuration);
    els.itemStart.value = draft.start || "";
    els.itemDuration.value = draft.duration ? String(draft.duration) : "";
    els.itemStart.disabled = !draft.date;
    els.itemDuration.disabled = !draft.start;

    const noneChip = h("button", {
      type: "button",
      class: `chip${draft.category ? "" : " active"}`,
      "data-category": "",
      text: t("noneCategory"),
    });
    els.categoryChips.replaceChildren(noneChip, ...state.categories.map((category) => h("button", {
      type: "button",
      class: `chip${draft.category === category.id ? " active" : ""}`,
      "data-category": category.id,
      style: `--cat: ${category.color}`,
    }, h("i"), category.name)));

    els.itemUrgent.setAttribute("aria-pressed", String(draft.priority === "urgent"));
    els.itemFocus.querySelectorAll("[data-focus]").forEach((button) => {
      const active = button.dataset.focus === draft.focus;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function openEditor(id) {
    const item = findItem(id);
    if (!item) return;
    state.editingId = id;
    state.draft = { ...item };
    els.itemTitle.value = item.title;
    els.itemNotes.value = item.notes;
    els.newCategoryInput.value = "";
    renderEditor();
    els.itemDialog.showModal();
    els.itemTitle.focus();
    els.itemTitle.setSelectionRange(item.title.length, item.title.length);
  }

  function setDraftDate(date) {
    const draft = state.draft;
    draft.date = date;
    if (!date) Object.assign(draft, { start: null, duration: null });
    renderEditor();
  }

  function saveEditor() {
    const title = els.itemTitle.value.trim();
    if (!title) {
      els.itemTitle.focus();
      return;
    }
    const original = findItem(state.editingId);
    if (!original) {
      els.itemDialog.close();
      return;
    }
    const draft = { ...state.draft, title, notes: els.itemNotes.value };
    if (draft.date !== original.date) {
      draft.order = Planner.nextOrder(state.items.filter((item) => item.id !== original.id), draft.date);
    }
    if (draft.done && !original.done) draft.doneAt = Date.now();
    els.itemDialog.close();
    updateItem(Planner.normalizeItem(draft));
  }

  function addCategoryFromEditor() {
    const name = els.newCategoryInput.value.trim();
    if (!name) return;
    state.draft.category = resolveCategory(name);
    els.newCategoryInput.value = "";
    renderEditor();
  }

  els.itemForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveEditor();
  });
  els.itemCancel.addEventListener("click", () => els.itemDialog.close());
  els.itemDelete.addEventListener("click", () => {
    const id = state.editingId;
    els.itemDialog.close();
    deleteItem(id);
  });
  els.itemDone.addEventListener("click", () => {
    state.draft.done = !state.draft.done;
    if (state.draft.done && !state.draft.date) state.draft.date = todayISO();
    renderEditor();
  });
  els.itemFocus.addEventListener("click", (event) => {
    const button = event.target.closest("[data-focus]");
    if (!button) return;
    state.draft.focus = button.dataset.focus;
    renderEditor();
  });
  els.itemUrgent.addEventListener("click", () => {
    state.draft.priority = state.draft.priority === "urgent" ? "normal" : "urgent";
    renderEditor();
  });
  els.itemDialog.addEventListener("click", (event) => {
    if (event.target === els.itemDialog) {
      els.itemDialog.close();
      return;
    }
    const step = event.target.closest("[data-date-step]");
    if (step) {
      const base = Core.parseISODate(state.draft.date) || new Date();
      setDraftDate(Core.toISODate(Planner.addDays(base, state.draft.date ? Number(step.dataset.dateStep) : 0)));
      return;
    }
    const quick = event.target.closest("[data-date-quick]");
    if (quick) {
      const kind = quick.dataset.dateQuick;
      setDraftDate(kind === "none" ? null : kind === "today" ? todayISO() : Core.quickDueISO(kind));
      return;
    }
    const chip = event.target.closest("[data-category]");
    if (chip) {
      state.draft.category = chip.dataset.category || null;
      renderEditor();
    }
  });
  els.itemStart.addEventListener("change", () => {
    state.draft.start = els.itemStart.value || null;
    if (!state.draft.start) state.draft.duration = null;
    else if (!state.draft.duration) state.draft.duration = 60;
    renderEditor();
  });
  els.itemDuration.addEventListener("change", () => {
    state.draft.duration = Number(els.itemDuration.value) || null;
  });
  els.newCategoryAdd.addEventListener("click", addCategoryFromEditor);
  els.newCategoryInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addCategoryFromEditor();
  });
  els.itemDialog.addEventListener("close", () => {
    state.editingId = null;
    state.draft = null;
  });

  // ---------- settings ----------
  const currentTheme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  const COVERS = ["green", "navy", "wine", "black", "pink", "mustard", "lavender", "teal"];
  const currentCover = () => (COVERS.includes(document.documentElement.dataset.cover) ? document.documentElement.dataset.cover : "green");
  const alwaysOnTop = () => Store.getRaw(KEYS.alwaysOnTop) === "on";

  function entryToItem(entry) {
    if (!entry?.item) return null;
    if (entry.type === "item") return Planner.normalizeItem(entry.item);
    if (entry.type === "task") return Planner.legacyTaskToItem(entry.item);
    if (entry.type === "note") return Planner.normalizeItem({ title: entry.item.text, createdAt: entry.item.createdAt });
    return null;
  }

  function renderSettings() {
    const values = {
      theme: currentTheme(),
      cover: currentCover(),
      language: I18n.language,
      weekStart: String(state.settings.weekStart),
      holidays: state.settings.holidays,
      quotes: state.settings.quotes,
      waterUnit: state.settings.waterUnit,
      glassMl: String(state.settings.glassMl),
      alwaysOnTop: alwaysOnTop() ? "on" : "off",
    };
    els.settingsDialog.querySelectorAll(".seg").forEach((seg) => {
      seg.querySelectorAll("button").forEach((button) => {
        const active = button.dataset.value === values[seg.dataset.setting];
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    });
    els.waterGoalValue.textContent = Planner.formatLiters(state.settings.waterGoal, I18n.language);
    els.settingsDialog.querySelector('[data-step="-250"]').disabled = state.settings.waterGoal <= Planner.WATER_GOAL.min;
    els.settingsDialog.querySelector('[data-step="250"]').disabled = state.settings.waterGoal >= Planner.WATER_GOAL.max;
    const unitButton = els.settingsDialog.querySelector('[data-setting="waterUnit"] [data-value="glasses"]');
    unitButton.textContent = t(Planner.isBottle(state.settings.glassMl) ? "waterUnitBottles" : "waterUnitGlasses");
    els.windowGroup.hidden = !desktop;
    const count = Store.pruneTrash().length;
    els.trashSummary.textContent = t("trashCount", { count });
    els.trashRestore.disabled = count === 0;
    els.trashEmpty.disabled = count === 0;
  }

  function applySetting(setting, value) {
    if (setting === "theme") {
      Store.setRaw(KEYS.theme, value);
      document.documentElement.dataset.theme = value === "dark" ? "dark" : "light";
    } else if (setting === "cover") {
      const cover = COVERS.includes(value) ? value : "green";
      Store.setRaw(KEYS.cover, cover);
      document.documentElement.dataset.cover = cover;
    } else if (setting === "language") {
      I18n.setLanguage(value);
      Store.persist();
      render();
    } else if (setting === "weekStart") {
      state.settings.weekStart = value === "0" ? 0 : 1;
      persistSettings();
      render();
    } else if (setting === "holidays") {
      state.settings.holidays = value === "off" ? "off" : "br";
      persistSettings();
      render();
    } else if (setting === "quotes") {
      state.settings.quotes = Planner.QUOTE_STYLES.includes(value) ? value : "proverbs";
      persistSettings();
      render();
    } else if (setting === "waterUnit" || setting === "glassMl") {
      if (setting === "waterUnit") state.settings.waterUnit = value === "liters" ? "liters" : "glasses";
      if (setting === "glassMl" && Planner.CONTAINER_SIZES.includes(Number(value))) state.settings.glassMl = Number(value);
      persistSettings();
      render();
    } else if (setting === "alwaysOnTop") {
      Store.setRaw(KEYS.alwaysOnTop, value);
      desktop?.setAlwaysOnTop(value === "on");
    }
    renderSettings();
  }

  // Settings are split into tabs so the sheet stays short.
  let settingsTab = "look";
  function showSettingsTab(tab) {
    settingsTab = tab;
    els.settingsDialog.dataset.tab = tab;
    els.settingsDialog.querySelectorAll(".set-tabs [data-tab]").forEach((button) => {
      button.setAttribute("aria-selected", String(button.dataset.tab === tab));
    });
  }

  els.settingsBtn.addEventListener("click", () => {
    showSettingsTab(settingsTab);
    renderSettings();
    els.settingsDialog.showModal();
  });
  els.settingsClose.addEventListener("click", () => els.settingsDialog.close());
  els.settingsDialog.addEventListener("click", (event) => {
    const tab = event.target.closest(".set-tabs [data-tab]");
    if (tab) {
      showSettingsTab(tab.dataset.tab);
      return;
    }
    const step = event.target.closest(".stepper [data-step]");
    if (step) {
      state.settings.waterGoal = Planner.clampWaterGoal(state.settings.waterGoal + Number(step.dataset.step));
      persistSettings();
      render();
      renderSettings();
      return;
    }
    if (event.target === els.settingsDialog) {
      els.settingsDialog.close();
      return;
    }
    const button = event.target.closest(".seg button");
    if (button) applySetting(button.closest(".seg").dataset.setting, button.dataset.value);
  });

  els.trashRestore.addEventListener("click", () => {
    const entry = Store.restoreLast();
    const item = entryToItem(entry);
    if (item) {
      restoreItem(item, entry.index);
      toast(t("itemRestored"));
    }
    renderSettings();
  });
  els.trashEmpty.addEventListener("click", () => {
    if (!window.confirm(t("confirmEmptyTrash"))) return;
    Store.emptyTrash();
    toast(t("trashCleared"));
    renderSettings();
  });

  els.exportData.addEventListener("click", () => {
    const payload = { app: "lowstate", version: 3, exportedAt: new Date().toISOString(), data: Store.collect() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = h("a", { href: url, download: `lowstate-backup-${todayISO()}.json` });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(t("backupSaved"));
  });
  els.importData.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", async () => {
    const file = els.importFile.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const data = parsed && typeof parsed.data === "object" ? parsed.data : parsed;
      const keys = Object.keys(data || {}).filter(Store.isAppKey);
      if (!keys.length) throw new Error("No Lowstate data found");
      if (!window.confirm(t("confirmRestore"))) return;
      Store.replaceAll(Object.fromEntries(keys.map((key) => [key, data[key]])));
      location.reload();
    } catch {
      toast(t("restoreFailed"));
    } finally {
      els.importFile.value = "";
    }
  });

  // ---------- toast ----------
  let toastTimer = null;
  function hideToast() {
    els.toast.hidden = true;
    els.toastAction.onclick = null;
  }
  function toast(message, actionLabel = "", onAction = null) {
    els.toastText.textContent = message;
    els.toastAction.textContent = actionLabel;
    els.toastAction.onclick = onAction ? () => { hideToast(); onAction(); } : null;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, actionLabel ? 6000 : 2600);
  }

  // ---------- interactions ----------
  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  els.prevBtn.addEventListener("click", () => shift(-1));
  els.nextBtn.addEventListener("click", () => shift(1));
  els.todayBtn.addEventListener("click", goToday);
  els.moveAllToday.addEventListener("click", () => {
    moveToToday(Planner.overdueItems(state.items, todayISO()).map((item) => item.id));
  });

  els.goalForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = els.goalInput.value.trim();
    if (!text) return;
    setWeekGoals([...weekGoals(), { id: Planner.newId(), text, done: false }]);
    els.goalInput.value = "";
  });
  els.goalsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-goal-action]");
    const id = button?.closest("[data-goal]")?.dataset.goal;
    if (!id) return;
    if (button.dataset.goalAction === "remove") setWeekGoals(weekGoals().filter((goal) => goal.id !== id));
    else setWeekGoals(weekGoals().map((goal) => (goal.id === id ? { ...goal, done: !goal.done } : goal)));
  });
  els.weekNotes.addEventListener("input", () => {
    clearTimeout(notesTimer);
    notesTimer = setTimeout(saveNotes, 500);
  });
  els.weekNotes.addEventListener("blur", saveNotes);

  els.dayNotes.addEventListener("input", () => {
    clearTimeout(dayNotesTimer);
    dayNotesTimer = setTimeout(saveDayNotes, 500);
  });
  els.dayNotes.addEventListener("blur", saveDayNotes);

  els.waterRow.addEventListener("click", (event) => {
    const iso = anchorISO();
    const count = state.water[iso] || 0;
    const glass = event.target.closest("[data-glass]");
    const step = event.target.closest("[data-water]");
    let next = count;
    // Tapping the last full glass empties it; any other glass fills up to it.
    if (glass) next = Number(glass.dataset.glass) === count ? count - 1 : Number(glass.dataset.glass);
    else if (step) next = count + Number(step.dataset.water);
    else return;
    state.water = Planner.setWater(state.water, iso, next);
    persistWater();
    renderWater(iso);
  });

  let moodReasonTimer = null;
  function saveMoodReason() {
    clearTimeout(moodReasonTimer);
    const iso = anchorISO();
    const text = els.moodReason.value.trim();
    const { [iso]: _previous, ...rest } = state.moodNotes;
    state.moodNotes = text ? { ...rest, [iso]: text } : rest;
    persistMoodNotes();
  }
  els.moodReason.addEventListener("input", () => {
    clearTimeout(moodReasonTimer);
    moodReasonTimer = setTimeout(saveMoodReason, 500);
  });
  els.moodReason.addEventListener("blur", saveMoodReason);
  els.moodReason.addEventListener("keydown", (event) => {
    if (event.key === "Enter") els.moodReason.blur();
  });

  els.loadMeter.addEventListener("click", (event) => {
    const tick = event.target.closest("[data-load]");
    const postpone = event.target.closest("[data-postpone]");
    const iso = anchorISO();
    if (tick) {
      state.loads = Planner.setLoad(state.loads, iso, Number(tick.dataset.load));
      persistLoads();
      renderLoad(iso);
    } else if (postpone) {
      const tomorrow = Core.toISODate(Planner.addDays(Core.parseISODate(iso), 1));
      const id = postpone.dataset.postpone;
      const before = findItem(id);
      state.items = Planner.moveItem(state.items, id, { date: tomorrow, focus: "could" });
      commit();
      toast(t("loadMoved"), t("undo"), () => {
        state.items = Planner.moveItem(state.items, id, { date: before.date, focus: before.focus });
        commit();
      });
    }
  });

  els.dayTasks.addEventListener("click", (event) => {
    const button = event.target.closest("[data-later-tomorrow]");
    if (!button) return;
    const iso = button.dataset.laterTomorrow;
    const tomorrow = Core.toISODate(Planner.addDays(Core.parseISODate(iso), 1));
    // Moved items start fresh on their new day as "could do".
    const ids = Planner.itemsForDay(state.items, iso).filter((item) => item.focus === "later" && !item.done).map((item) => item.id);
    ids.forEach((id) => {
      state.items = Planner.moveItem(state.items, id, { date: tomorrow, focus: "could" });
    });
    commit();
  });

  els.moodPicker.addEventListener("click", (event) => {
    const button = event.target.closest(".mood-btn");
    if (!button) return;
    state.moods = Planner.setMood(state.moods, anchorISO(), button.dataset.mood);
    persistMoods();
    // Clearing the mood clears its reason too.
    if (!state.moods[anchorISO()] && state.moodNotes[anchorISO()]) {
      const { [anchorISO()]: _previous, ...rest } = state.moodNotes;
      state.moodNotes = rest;
      persistMoodNotes();
    }
    renderMoodPicker(anchorISO());
  });

  els.dayCaptureForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (capture(els.dayCaptureInput.value, anchorISO())) els.dayCaptureInput.value = "";
    els.dayCaptureInput.focus();
  });

  // Clicking an empty slot on the timeline writes something at that hour.
  els.timeline.addEventListener("click", (event) => {
    const slot = event.target.closest(".hour-slot");
    if (slot) openSlot(slot.dataset.slot);
  });
  els.timeline.addEventListener("submit", (event) => {
    const form = event.target.closest(".slot-add");
    if (!form) return;
    event.preventDefault();
    const text = form.querySelector("input").value;
    form.remove();
    capture(text, anchorISO(), form.dataset.slot);
  });

  // Month index tabs: in the week view jump to the first week that mostly
  // belongs to that month; in the day view open its first day.
  document.addEventListener("click", (event) => {
    const tab = event.target.closest(".month-tabs [data-month]");
    if (!tab) return;
    const month = Number(tab.dataset.month);
    const year = state.anchor.getFullYear();
    let anchor = new Date(year, month, 1);
    if (state.view === "week" && Planner.weekDays(anchor, state.settings.weekStart)[3].getMonth() !== month) {
      anchor = Planner.addDays(anchor, 7);
    }
    state.anchor = anchor;
    render();
  });

  // Dates in the week and month views open that day's page.
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-action], .month-tabs")) return;
    const opener = event.target.closest("[data-open-day]");
    if (opener) openDay(opener.dataset.openDay);
  });

  els.inboxForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (capture(els.inboxInput.value)) els.inboxInput.value = "";
    els.inboxInput.focus();
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest(".day-add");
    if (!form) return;
    event.preventDefault();
    const date = form.dataset.date;
    if (!capture(form.elements.title.value, date)) return;
    els.weekGrid.querySelector(`.day-add[data-date="${date}"] input`)?.focus();
  });

  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]");
    const card = action?.closest(".item");
    if (!card) return;
    const id = card.dataset.id;
    if (action.dataset.action === "toggle") toggleItem(id);
    else if (action.dataset.action === "edit") openEditor(id);
    else if (action.dataset.action === "today") moveToToday([id]);
  });

  document.addEventListener("keydown", (event) => {
    if (event.target.matches?.(".item-body") && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openEditor(event.target.closest(".item").dataset.id);
      return;
    }
    if (document.querySelector("dialog[open]") || event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTyping(event.target)) {
      if (event.key === "Escape") event.target.blur();
      return;
    }
    const views = { 1: "day", 2: "week", 3: "month", 4: "habits" };
    if (views[event.key]) setView(views[event.key]);
    else if (event.key === "n" || event.key === "N") {
      event.preventDefault();
      (state.view === "day" ? els.dayCaptureInput : els.inboxInput).focus();
    } else if (event.key === "t" || event.key === "T") goToday();
    else if (state.view !== "habits" && event.key === "ArrowLeft") shift(-1);
    else if (state.view !== "habits" && event.key === "ArrowRight") shift(1);
  });

  // ---------- drag & drop ----------
  function dropZoneFrom(target) {
    if (target.closest?.("#timeline")) return { type: "time", container: els.timeline, date: anchorISO() };
    const row = target.closest?.(".day-row, .month-cell");
    if (row) return { container: row, list: row.querySelector(".day-items, .month-items"), date: row.dataset.date };
    if (target.closest?.("#dayView .page-right")) {
      const group = target.closest(".focus-group") || els.dayTasks.querySelector('.focus-group[data-focus="could"]');
      return { container: group, list: group.querySelector(".day-items"), date: anchorISO(), focus: group.dataset.focus };
    }
    if (target.closest?.("#inboxSection")) return { container: els.inboxSection, list: els.inboxList, date: null };
    return null;
  }

  function showDropTime(minutes) {
    const inner = els.timeline.querySelector(".timeline-inner");
    let marker = inner.querySelector(".drop-time");
    if (!marker) {
      marker = h("div", { class: "drop-time" }, h("span"));
      inner.append(marker);
    }
    const first = Number(inner.dataset.firstHour);
    marker.style.top = `${((minutes - first * 60) / 60) * timelineHourHeight()}px`;
    marker.firstChild.textContent = Planner.minutesToTime(minutes);
  }

  function cardBefore(list, y) {
    return [...list.querySelectorAll(".item:not(.dragging)")].find((card) => {
      const rect = card.getBoundingClientRect();
      return y < rect.top + rect.height / 2;
    }) || null;
  }

  function clearDropMarks() {
    document.querySelectorAll(".drop-target, .drop-before, .drop-end").forEach((node) => {
      node.classList.remove("drop-target", "drop-before", "drop-end");
    });
    document.querySelectorAll(".drop-time").forEach((node) => node.remove());
  }

  document.addEventListener("dragstart", (event) => {
    const card = event.target.closest?.(".item");
    if (!card) return;
    state.dragId = card.dataset.id;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", state.dragId);
    requestAnimationFrame(() => card.classList.add("dragging"));
    document.body.classList.add("is-dragging");
  });

  document.addEventListener("dragover", (event) => {
    if (!state.dragId) return;
    const zone = dropZoneFrom(event.target);
    if (!zone) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (zone.type === "time") {
      document.querySelectorAll(".drop-target, .drop-before, .drop-end").forEach((node) => {
        node.classList.remove("drop-target", "drop-before", "drop-end");
      });
      showDropTime(minutesAtTimelineY(event.clientY));
      return;
    }
    clearDropMarks();
    zone.container.classList.add("drop-target");
    const before = cardBefore(zone.list, event.clientY);
    if (before) before.classList.add("drop-before");
    else zone.list.classList.add("drop-end");
  });

  document.addEventListener("drop", (event) => {
    if (!state.dragId) return;
    const zone = dropZoneFrom(event.target);
    if (!zone) return;
    event.preventDefault();
    if (zone.type === "time") {
      const start = Planner.minutesToTime(minutesAtTimelineY(event.clientY));
      state.items = Planner.scheduleAt(state.items, state.dragId, { date: zone.date, start });
      state.dragId = null;
      commit();
      return;
    }
    const before = cardBefore(zone.list, event.clientY);
    state.items = Planner.moveItem(state.items, state.dragId, { date: zone.date, beforeId: before?.dataset.id || null, focus: zone.focus || null });
    state.dragId = null;
    commit();
  });

  document.addEventListener("dragend", () => {
    state.dragId = null;
    clearDropMarks();
    document.querySelectorAll(".dragging").forEach((node) => node.classList.remove("dragging"));
    document.body.classList.remove("is-dragging");
  });

  // ---------- desktop integration ----------
  if (desktop) {
    desktop.setAlwaysOnTop?.(alwaysOnTop());
    const shortcuts = Store.loadObject(KEYS.shortcuts);
    if (Object.keys(shortcuts).length) desktop.setShortcuts?.(shortcuts);
    // The global capture shortcut opens today's page ready to write.
    desktop.onQuickCapture?.(() => {
      document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
      state.anchor = Core.startOfDay(new Date());
      setView("day");
      els.dayCaptureInput.focus();
    });
    desktop.onUpdateAvailable?.((info) => {
      els.updatePill.textContent = t("updateAvailable", { version: info.version });
      els.updatePill.hidden = false;
      els.updatePill.onclick = () => desktop.openExternal?.(info.url);
    });
  }

  // Re-render when the calendar day changes while the app sits open, but never
  // while someone is typing (the next tick will pick it up).
  let lastDay = todayISO();
  setInterval(() => {
    positionNowLine();
    const today = todayISO();
    if (today === lastDay || isTyping(document.activeElement) || document.querySelector("dialog[open]")) return;
    lastDay = today;
    render();
  }, 60_000);

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
  }

  I18n.apply();
  render();
  if (initial.migrated) toast(t("migratedNotice"));
})();

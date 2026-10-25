(() => {
  "use strict";

  const Core = window.LowstateCore;
  const Planner = window.LowstatePlanner;
  const Store = window.LowstateStorage;
  const I18n = window.LowstateI18n;
  const desktop = window.desktopGadget || null;
  const calendarsApi = window.desktopCalendars || null;
  const syncApi = window.desktopSync || null;

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
    habits: "type-todo.planner.habits.v1",
    habitLog: "type-todo.planner.habitlog.v1",
    closures: "type-todo.planner.closures.v1",
    dump: "type-todo.planner.dump.v1",
    shopping: "type-todo.planner.shopping.v1",
    dumpMigrated: "type-todo.planner.dump-migrated.v1",
    legacyBrain: "type-todo.brain-inbox.v1",
    migrated: "type-todo.planner.migrated.v1",
    theme: "type-todo.theme.v1",
    cover: "type-todo.cover.v1",
    coverColor: "type-todo.cover-color.v1",
    alwaysOnTop: "type-todo.always-on-top.v1",
    shortcuts: "type-todo.shortcuts.v1",
    legacyTodos: "quest-log.todos.v1",
    legacyCategories: "type-todo.categories.v1",
    legacyColors: "type-todo.category-colors.v1",
  };

  const ICON_CHECK = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';
  const ICON_TODAY = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12M13 7l5 5-5 5"/></svg>';
  const SVG_NS = "http://www.w3.org/2000/svg";
  const TAB_COLORS = ["--indigo", "--vermilion", "--matcha", "--yamabuki", "--fuji", "--asagi"];
  const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240];
  const VIEWS = ["day", "week", "month", "habits", "dump", "shopping"];

  const $ = (id) => document.getElementById(id);
  const els = {
    weekGrid: $("weekGrid"),
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
    dayAllDay: $("dayAllDay"),
    calWebNote: $("calWebNote"),
    notifyWebNote: $("notifyWebNote"),
    notifyKinds: $("notifyKinds"),
    morningAt: $("morningAt"),
    notifyTest: $("notifyTest"),
    calHead: $("calHead"),
    calSummary: $("calSummary"),
    calRefresh: $("calRefresh"),
    calList: $("calList"),
    calAddForm: $("calAddForm"),
    calName: $("calName"),
    calUrl: $("calUrl"),
    calColors: $("calColors"),
    calAddBtn: $("calAddBtn"),
    calStatus: $("calStatus"),
    waterGoalValue: $("waterGoalValue"),
    waterRow: $("waterRow"),
    waterSum: $("waterSum"),
    monthView: $("monthView"),
    mvMonthNum: $("mvMonthNum"),
    mvMonthName: $("mvMonthName"),
    mvYear: $("mvYear"),
    monthWeekdays: $("monthWeekdays"),
    monthGrid: $("monthGrid"),
    habitsView: $("habitsView"),
    hvMonthNum: $("hvMonthNum"),
    hvMonthName: $("hvMonthName"),
    hvYear: $("hvYear"),
    hvRange: $("hvRange"),
    habitGrid: $("habitGrid"),
    habitEmpty: $("habitEmpty"),
    habitForm: $("habitForm"),
    habitInput: $("habitInput"),
    habitIdeas: $("habitIdeas"),
    sumMood: $("sumMood"),
    sumWater: $("sumWater"),
    sumLoad: $("sumLoad"),
    sumPatterns: $("sumPatterns"),
    todayHabits: $("todayHabits"),
    habitPills: $("habitPills"),
    habitDialog: $("habitDialog"),
    habitDetail: $("habitDetail"),
    closeDayBtn: $("closeDayBtn"),
    dumpView: $("dumpView"),
    shoppingView: $("shoppingView"),
    shopCount: $("shopCount"),
    shopProgress: $("shopProgress"),
    shopClear: $("shopClear"),
    shopForm: $("shopForm"),
    shopInput: $("shopInput"),
    shopGroups: $("shopGroups"),
    shopEmpty: $("shopEmpty"),
    shopAgain: $("shopAgain"),
    shopAgainEmpty: $("shopAgainEmpty"),
    shopCopy: $("shopCopy"),
    shopReminders: $("shopReminders"),
    shopSendHint: $("shopSendHint"),
    dumpCount: $("dumpCount"),
    dumpForm: $("dumpForm"),
    dumpInput: $("dumpInput"),
    dumpSortTitle: $("dumpSortTitle"),
    dumpAllInbox: $("dumpAllInbox"),
    dumpList: $("dumpList"),
    dumpEmpty: $("dumpEmpty"),
    closedLine: $("closedLine"),
    closureDialog: $("closureDialog"),
    syncRow: $("syncRow"),
    syncBox: $("syncBox"),
    syncAlert: $("syncAlert"),
    syncAlertText: $("syncAlertText"),
    syncReload: $("syncReload"),
    dayCapturePreview: $("dayCapturePreview"),
    inboxCapturePreview: $("inboxCapturePreview"),
    focusHelpBtn: $("focusHelpBtn"),
    focusHelp: $("focusHelp"),
    modulesHidden: $("modulesHidden"),
    moodSum: $("moodSum"),
    notesSum: $("notesSum"),
    habitsSum: $("habitsSum"),
    dayModulesChips: $("dayModulesChips"),
    searchDialog: $("searchDialog"),
    searchInput: $("searchInput"),
    searchResults: $("searchResults"),
    searchBtn: $("searchBtn"),
    closureForm: $("closureForm"),
    closureRecap: $("closureRecap"),
    closureGood: $("closureGood"),
    closureLeft: $("closureLeft"),
    closureCount: $("closureCount"),
    closureCancel: $("closureCancel"),
    closureAt: $("closureAt"),
    habitDetailIcon: $("habitDetailIcon"),
    habitDetailTitle: $("habitDetailTitle"),
    habitDetailMeta: $("habitDetailMeta"),
    habitDetailMonth: $("habitDetailMonth"),
    habitDetailStats: $("habitDetailStats"),
    habitDetailDays: $("habitDetailDays"),
    habitDetailInsight: $("habitDetailInsight"),
    habitDetailClose: $("habitDetailClose"),
    habitDetailEdit: $("habitDetailEdit"),
    habitEditForm: $("habitEditForm"),
    habitEditName: $("habitEditName"),
    habitIconPicker: $("habitIconPicker"),
    habitRows: $("habitRows"),
    habitAddRow: $("habitAddRow"),
    habitSince: $("habitSince"),
    habitUntil: $("habitUntil"),
    habitEndToggle: $("habitEndToggle"),
    habitDaysHint: $("habitDaysHint"),
    habitColorPicker: $("habitColorPicker"),
    habitEditDelete: $("habitEditDelete"),
    habitEditCancel: $("habitEditCancel"),
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
    itemRepeat: $("itemRepeat"),
    itemSkip: $("itemSkip"),
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
    saveAlert: $("saveAlert"),
    saveAlertTitle: $("saveAlertTitle"),
    saveAlertBody: $("saveAlertBody"),
    saveRetry: $("saveRetry"),
    saveExport: $("saveExport"),
    restoreDialog: $("restoreDialog"),
    restoreForm: $("restoreForm"),
    restoreFacts: $("restoreFacts"),
    restoreNote: $("restoreNote"),
    restoreError: $("restoreError"),
    restoreCancel: $("restoreCancel"),
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
      notifyOn: savedSettings.notifyOn !== false,
      notifyLead: [5, 10, 15, 30].includes(savedSettings.notifyLead) ? savedSettings.notifyLead : 10,
      notifyKinds: { tasks: true, habits: true, meetings: true, ...(savedSettings.notifyKinds || {}) },
      morningOn: savedSettings.morningOn !== false,
      morningAt: Planner.isTime(savedSettings.morningAt) ? savedSettings.morningAt : "08:00",
      closureOn: savedSettings.closureOn !== false,
      closureAt: Planner.isTime(savedSettings.closureAt) ? savedSettings.closureAt : "21:30",
      dayModules: Planner.normalizeDayModules(savedSettings.dayModules),
    },
    goals: Store.loadObject(KEYS.goals),
    notes: Store.loadObject(KEYS.notes),
    dayNotes: Store.loadObject(KEYS.dayNotes),
    moods: Store.loadObject(KEYS.moods),
    water: Store.loadObject(KEYS.water),
    moodNotes: Store.loadObject(KEYS.moodNotes),
    loads: Store.loadObject(KEYS.loads),
    habits: Planner.normalizeHabits(Store.loadArray(KEYS.habits)),
    habitLog: Planner.normalizeHabitLog(Store.loadObject(KEYS.habitLog)),
    // { iso: { good, closedAt } } — the end-of-day ritual.
    closures: Store.loadObject(KEYS.closures),
    // Brain dump: thoughts waiting to be sorted, [{ id, text, createdAt }].
    dump: Store.loadArray(KEYS.dump).filter((note) => note && typeof note.text === "string" && note.text.trim()),
    shopping: Planner.normalizeShopping(Store.loadObject(KEYS.shopping)),
    // Read-only events from subscribed calendars (desktop only).
    calendars: [],
    events: [],
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
  const persistHabits = () => {
    Store.save(KEYS.habits, state.habits);
    Store.save(KEYS.habitLog, state.habitLog);
  };

  const persistDump = () => Store.save(KEYS.dump, state.dump);
  const persistShopping = () => Store.save(KEYS.shopping, state.shopping);

  // Unsorted notes from the 1.x Brain Inbox come over once (the old key is
  // left untouched).
  if (Store.getRaw(KEYS.dumpMigrated) === null) {
    const known = new Set(state.dump.map((note) => note.id));
    const legacy = Planner.legacyDumpNotes(Store.loadArray(KEYS.legacyBrain)).filter((note) => !known.has(note.id));
    if (legacy.length) {
      state.dump = [...state.dump, ...legacy];
      persistDump();
    }
    Store.setRaw(KEYS.dumpMigrated, "1");
  }

  // Habits from before start dates existed begin on their first logged day
  // (or today), so earlier months don't show them at 0%.
  if (state.habits.some((habit) => !habit.since)) {
    const firstLogged = (id) => Object.keys(state.habitLog).filter((iso) => Planner.habitState(state.habitLog, iso, id)).sort()[0];
    state.habits = state.habits.map((habit) => (habit.since ? habit : { ...habit, since: firstLogged(habit.id) || todayISO() }));
    Store.save(KEYS.habits, state.habits);
  }

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
    if (!findItem(id)) return;
    state.items = Planner.completeItem(state.items, id, todayISO());
    commit();
  }

  // "Every month on the 5th", "Toda semana (terça-feira)"…
  function repeatLabel(rule, iso) {
    const date = Core.parseISODate(iso);
    if (!rule || !date) return "";
    return t(`repeat-${rule}`, {
      day: formatDate(date, { weekday: "long" }),
      n: date.getDate(),
      date: formatDate(date, { day: "numeric", month: "long" }),
    });
  }

  // A future occurrence of a repeating task: shown light, opens its series.
  function ghostEl(ghost, variant) {
    const category = categoryById(ghost.category);
    return h("li", {
      class: `item ${variant} is-ghost`,
      "data-ghost-source": ghost.sourceId,
      title: `${ghost.title} · ${repeatLabel(ghost.repeat, ghost.repeatAnchor)}`,
      style: category ? `--cat: ${category.color}` : null,
    },
      variant === "mini" ? h("i", { "aria-hidden": "true" }) : h("span", { class: "repeat-mark ghost-mark", "aria-hidden": "true", text: "↻" }),
      h("span", { class: variant === "mini" ? "item-body" : "line-title" },
        ghost.start ? h("span", { class: variant === "mini" ? "mini-time" : "line-time", text: ghost.start }) : null,
        ghost.title));
  }

  const ghostsOn = (ghosts, iso) => ghosts.filter((ghost) => ghost.date === iso);

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
  function captureFields(text, fallbackDate = null, fallbackStart = null) {
    const parsed = Planner.parseCapture(text);
    if (!parsed.title) return null;
    const start = parsed.start || fallbackStart;
    const date = parsed.date || fallbackDate || (start ? todayISO() : null);
    return {
      title: parsed.title,
      date,
      start: date ? start : null,
      duration: date && start ? 60 : null,
      priority: parsed.priority,
      category: parsed.category,
    };
  }

  function capture(text, fallbackDate = null, fallbackStart = null) {
    const fields = captureFields(text, fallbackDate, fallbackStart);
    if (!fields) return null;
    return addItem({ ...fields, category: resolveCategory(fields.category) });
  }

  // A quiet line under a capture field: an example while it's empty, then
  // what the typed line will become — read by the same parser capture() uses.
  function renderCapturePreview(input, preview, fallbackDate = null) {
    const text = input.value;
    if (!text.trim()) {
      preview.textContent = document.activeElement === input ? t("captureExample") : "";
      preview.classList.add("is-example");
      return;
    }
    preview.classList.remove("is-example");
    const fields = captureFields(text, fallbackDate);
    if (!fields) {
      preview.textContent = "";
      return;
    }
    const parts = [];
    if (!fields.date) parts.push(t("toSchedule"));
    else {
      const tomorrow = Core.toISODate(Planner.addDays(new Date(), 1));
      parts.push(fields.date === todayISO() ? t("captureToday") : fields.date === tomorrow ? t("captureTomorrow")
        : formatDate(Core.parseISODate(fields.date), { weekday: "short", day: "numeric", month: "short" }));
      // The group comes from the same rule that files a new task (urgent → must).
      parts.push(t(FOCUS_LABELS[Planner.normalizeItem({ title: fields.title, date: fields.date, priority: fields.priority }).focus]));
    }
    if (fields.start) parts.push(timeRange(fields));
    if (fields.category) {
      const wanted = Planner.slug(fields.category);
      const existing = state.categories.find((category) => category.id === wanted || Planner.slug(category.name) === wanted);
      parts.push(existing ? `#${existing.name}` : t("captureNewCategory", { name: `#${Planner.displayName(fields.category)}` }));
    }
    if (fields.priority === "urgent") parts.push(t("captureUrgent"));
    preview.textContent = t("captureGoesTo", { list: parts.join(" · ") });
  }

  function wireCapturePreview(input, preview, fallbackDate) {
    const update = () => renderCapturePreview(input, preview, fallbackDate());
    ["input", "focus", "blur"].forEach((type) => input.addEventListener(type, update));
    input.form?.addEventListener("submit", () => setTimeout(update, 0));
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
          item.repeat ? "↻ " : null,
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
        item.repeat ? h("span", { class: "repeat-mark", title: repeatLabel(item.repeat, item.repeatAnchor), text: "↻" }) : null,
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
      title: `${t(`mood-${mood}`)} — ${t(`moodHint-${mood}`)}`,
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
    const summary = waterUnit === "liters"
      ? t("waterLiters", { n: Planner.formatLiters(count * glassMl, I18n.language).replace(" L", ""), total: Planner.formatLiters(waterGoal, I18n.language) })
      : t(word.sum, { n: count, total: target });
    const over = count * glassMl - waterGoal;
    els.waterSum.replaceChildren(summary, ...(count >= target
      ? [h("span", { class: "water-met", text: over > 0 ? `✓ ${t("waterGoalMet")} · +${Planner.formatVolume(over, I18n.language)}` : `✓ ${t("waterGoalMet")}` })]
      : []));
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
    els.rangeSub.textContent = "";
    els.weekProgress.hidden = true;
    els.navControls.hidden = view === "dump" || view === "shopping";
    const now = new Date();
    if (view === "dump" || view === "shopping") {
      els.rangeTitle.textContent = t(view === "dump" ? "dumpTitle" : "shopTitle");
      return;
    }

    if (view === "habits") {
      els.rangeTitle.textContent = `${t("viewHabits")} · ${capitalize(formatDate(state.anchor, { month: "long", year: "numeric" }))}`;
      els.todayBtn.disabled = state.anchor.getMonth() === now.getMonth() && state.anchor.getFullYear() === now.getFullYear();
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

  function weekEventsEl(iso) {
    const { allDay, timed } = dayEvents(iso);
    const routines = state.habits
      .map((habit) => ({ habit, time: Planner.habitTimeOn(habit, iso) }))
      .filter(({ habit, time }) => time && !eventForHabit(timed, habit, time))
      .sort((a, b) => (a.time.start < b.time.start ? -1 : 1));
    if (!allDay.length && !timed.length && !routines.length) return null;
    const routineLines = routines.map(({ habit, time }) => h("li", {
      class: `event-line routine${stateClass(habit.id, iso)}`,
      style: `--habit: ${habit.color}`,
      title: [habit.name, stateLabel(habit.id, iso)].filter(Boolean).join(" · "),
    },
      habitIconEl(habit.icon) || h("i", { "aria-hidden": "true" }),
      h("span", { class: "line-time", text: time.start }),
      h("span", { class: "event-title", text: habit.name })));
    return h("ul", { class: "day-events" }, routineLines, [...allDay, ...timed].map((event) => h("li", {
      class: `event-line${event.allDay ? " is-allday" : ""}`,
      title: eventTooltip(event),
      tabindex: "0",
      "data-event": event.id,
      "data-event-day": iso,
      style: calendarById(event.calendarId) ? `--cat: ${calendarById(event.calendarId).color}` : null,
    },
      h("i", { "aria-hidden": "true" }),
      event.allDay ? null : h("span", { class: "line-time", text: clockTime(new Date(event.start)) }),
      h("span", { class: "event-title", text: eventTitle(event) }))));
  }

  let weekGhosts = [];

  function renderDays(days) {
    weekGhosts = Planner.upcomingOccurrences(state.items, Core.toISODate(days[0]), Core.toISODate(days[days.length - 1]));
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
          h("span", { class: "stamp-icons" }, moonEl(day), moodEl(state.moods[iso], "mood-mini", state.moodNotes[iso])),
          dayHabitIcons(iso, "stamp-habits")),
        h("div", { class: "day-body" },
          holiday ? h("p", { class: "holiday", text: holiday }) : null,
          weekEventsEl(iso),
          h("ul", { class: "day-items", "data-date": iso },
            Planner.itemsForDay(state.items, iso).map((item) => itemEl(item, "line")),
            ghostsOn(weekGhosts, iso).map((ghost) => ghostEl(ghost, "line"))),
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

    renderDays(days);

    showQuote(els.proverb, weekNumber);

    els.weekLabel.textContent = t("weekNumber", { n: weekNumber });
    els.weekRange.textContent = `${formatDate(days[0], { day: "2-digit", month: "2-digit" })} — ${formatDate(days[6], { day: "2-digit", month: "2-digit" })}`;
    renderGoals();
    renderNotes();
    renderMonthTabs(reference);
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

  // ---------- calendar events ----------
  // A calendar event that is really a timed habit (same name, overlapping
  // time — e.g. "Academia" in Google Calendar and the Academia habit) is
  // shown once: the event, carrying the habit's check.
  const fold = (text) => String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  function eventForHabit(timedEvents, habit, time) {
    const name = fold(habit.name);
    if (name.length < 3) return null;
    const start = Planner.timeToMinutes(time.start);
    const end = start + time.duration;
    return timedEvents.find((event) => {
      const title = fold(event.title);
      const named = title.includes(name) || (title.length >= 3 && name.includes(title));
      return named && event.startMin < end && event.endMin > start;
    }) || null;
  }

  // The small round check used on habit blocks (a span: they're buttons).
  function habitCheck(habitId, iso) {
    const svg = svgEl("svg", { class: "i", viewBox: "0 0 24 24", "aria-hidden": "true" });
    svg.append(svgEl("path", { d: "M5 12.5l4.2 4.2L19 7" }));
    return h("span", { class: `check habit-check${stateClass(habitId, iso)}`, "aria-hidden": "true" }, svg);
  }
  const calendarById = (id) => state.calendars.find((calendar) => calendar.id === id) || null;
  const clockTime = (date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const eventRange = (event) => (event.allDay ? t("allDay") : `${clockTime(new Date(event.start))}–${clockTime(new Date(event.end))}`);
  const eventTitle = (event) => event.title || t("untitledEvent");

  function eventTooltip(event) {
    const calendar = calendarById(event.calendarId);
    return [eventTitle(event), eventRange(event), event.location, calendar?.name].filter(Boolean).join("\n");
  }

  function dayEvents(iso) {
    return Planner.eventsForDay(state.events, iso);
  }

  function renderTimeline(iso) {
    const items = Planner.itemsForDay(state.items, iso);
    // Meetings share the timeline (and its lanes) with tasks, as read-only blocks.
    const meetings = dayEvents(iso).timed.map((event) => ({
      id: event.id,
      kind: "event",
      event,
      start: Planner.minutesToTime(Math.min(event.startMin, 1425)),
      duration: Math.max(15, event.endMin - Math.min(event.startMin, 1425)),
    }));
    // Habits with a time sit on the timeline on their planned days.
    const timedHabits = state.habits
      .map((habit) => ({ habit, time: Planner.habitTimeOn(habit, iso) }))
      .filter(({ time }) => time);
    const routines = [];
    timedHabits.forEach(({ habit, time }) => {
      const twin = eventForHabit(meetings.map((meeting) => meeting.event), habit, time);
      if (twin) meetings.find((meeting) => meeting.event === twin).habit = habit;
      else routines.push({ id: `habit:${habit.id}`, kind: "habit", habit, start: time.start, duration: time.duration });
    });
    const events = Planner.layoutTimeline([...items, ...meetings, ...routines]);
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
      const top = ((event.start - first * 60) / 60) * hour;
      const height = Math.max(((event.end - event.start) / 60) * hour - 2, 20);
      if (item.kind === "habit") {
        const { habit } = item;
        const done = Planner.habitDone(state.habitLog, iso, habit.id);
        const lines = Math.max(1, Math.floor((height - 19) / 16));
        const range = `${item.start}–${Planner.minutesToTime(Math.min(1439, Planner.timeToMinutes(item.start) + item.duration))}`;
        inner.append(h("button", {
          type: "button",
          class: `block routine${stateClass(habit.id, iso)}${height < 34 ? " short" : ""}`,
          "data-habit-cell": habit.id,
          "data-date": iso,
          "aria-pressed": String(done),
          disabled: iso > todayISO() ? "" : null,
          title: `${habit.name} · ${range}`,
          style: `top: ${top}px; --h: ${height}px; --lane: ${event.lane}; --lanes: ${event.lanes}; --lines: ${lines}; --habit: ${habit.color};`,
        },
          habitCheck(habit.id, iso),
          h("span", { class: "item-body" },
            h("span", { class: "block-time", text: range }),
            h("span", { class: "block-title" }, habitIconEl(habit.icon), habit.name))));
        return;
      }
      if (item.kind === "event") {
        const calendar = calendarById(item.event.calendarId);
        const lines = Math.max(1, Math.floor((height - 19) / 16));
        const twin = item.habit || null;
        inner.append(h(twin ? "button" : "div", {
          type: twin ? "button" : null,
          class: `block event${twin ? ` has-habit${stateClass(twin.id, iso)}` : ""}${height < 34 ? " short" : ""}${item.event.busy === false ? " is-free" : ""}`,
          title: eventTooltip(item.event),
          "data-event": twin ? null : item.event.id,
          "data-event-day": twin ? null : iso,
          "data-habit-cell": twin?.id || null,
          "data-date": twin ? iso : null,
          "aria-pressed": twin ? String(Planner.habitDone(state.habitLog, iso, twin.id)) : null,
          disabled: twin && iso > todayISO() ? "" : null,
          style: `top: ${top}px; --h: ${height}px; --lane: ${event.lane}; --lanes: ${event.lanes}; --lines: ${lines};${calendar ? ` --cat: ${calendar.color};` : ""}${twin ? ` --habit: ${twin.color};` : ""}`,
        },
          twin ? habitCheck(twin.id, iso) : null,
          h(twin ? "span" : "div", { class: "item-body", tabindex: twin ? null : "0" },
            h("span", { class: "block-time", text: eventRange(item.event) }),
            h("span", { class: "block-title" }, twin ? habitIconEl(twin.icon) : null, eventTitle(item.event)))));
        return;
      }
      const category = categoryById(item.category);
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
        h("div", {
          class: "item-body", "data-action": "edit", role: "button", tabindex: "0",
          title: `${item.title}\n${t("blockKeys")}`, "aria-keyshortcuts": "Alt+ArrowUp Alt+ArrowDown Alt+Shift+ArrowUp Alt+Shift+ArrowDown",
        },
          h("span", { class: "block-time", text: timeRange(item) }),
          h("span", { class: "block-title", text: item.title })),
        h("span", { class: "block-resize", "aria-hidden": "true", title: t("resizeBlock") })));
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
    const y = ((now.getHours() * 60 + now.getMinutes() - first * 60) / 60) * timelineHourHeight();
    line.style.top = `${y}px`;
    line.firstChild.textContent = Planner.minutesToTime(now.getHours() * 60 + now.getMinutes());
    // The current time takes the place of an hour label it would overlap.
    inner.querySelectorAll(".hour-row").forEach((row) => {
      row.classList.toggle("is-covered", Math.abs(parseFloat(row.style.top) + 9 - y) < 15);
    });
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
    const allDay = dayEvents(iso).allDay;
    els.dayAllDay.hidden = allDay.length === 0;
    els.dayAllDay.replaceChildren(...allDay.map((event) => h("span", {
      class: "allday-chip",
      title: eventTooltip(event),
      tabindex: "0",
      "data-event": event.id,
      "data-event-day": iso,
      style: calendarById(event.calendarId) ? `--cat: ${calendarById(event.calendarId).color}` : null,
    }, eventTitle(event))));

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
    renderTodayHabits(iso);
    renderMoodPicker(iso);
    renderDayNotes();
    renderClosure(iso);
    renderMonthTabs(day);
    applyDayModules();
  }

  // ---------- day page modules ----------
  const MODULE_NAMES = { load: "load", water: "water", habits: "viewHabits", mood: "dayMood", notes: "dayNotes" };
  const moduleEl = (id) => els.dayView.querySelector(`[data-module="${id}"]`);

  function applyDayModules() {
    const modules = state.settings.dayModules;
    Planner.DAY_MODULES.forEach((id) => {
      const el = moduleEl(id);
      if (!el) return;
      el.classList.toggle("is-collapsed", modules[id] === "collapsed");
      el.classList.toggle("is-off", modules[id] === "hidden");
      el.querySelector("[data-module-toggle]")?.setAttribute("aria-expanded", String(modules[id] === "open"));
    });
    const hidden = Planner.DAY_MODULES.filter((id) => modules[id] === "hidden");
    els.modulesHidden.hidden = hidden.length === 0;
    els.modulesHidden.replaceChildren(...(hidden.length ? [
      h("span", { text: t("modulesHiddenLine", { list: hidden.map((id) => t(MODULE_NAMES[id])).join(", ") }) }),
      h("button", { type: "button", class: "link-btn", "data-modules-show": "", text: t("modulesShow") }),
    ] : []));
    // Small summaries for folded modules.
    const iso = anchorISO();
    const mood = state.moods[iso];
    els.moodSum.textContent = mood ? t(`mood-${mood}`) : "";
    const notes = (state.dayNotes[iso] || "").trim().split("\n")[0];
    els.notesSum.textContent = notes.length > 40 ? `${notes.slice(0, 40)}…` : notes;
    const pills = [...els.habitPills.querySelectorAll("[data-habit-cell]")];
    els.habitsSum.textContent = pills.length
      ? t("habitsSum", { done: pills.filter((pill) => pill.getAttribute("aria-pressed") === "true").length, total: pills.length })
      : "";
  }

  function setDayModule(id, value) {
    if (!Planner.DAY_MODULES.includes(id)) return;
    state.settings.dayModules = { ...state.settings.dayModules, [id]: value };
    persistSettings();
    applyDayModules();
    renderDayModuleChips();
  }

  function renderDayModuleChips() {
    els.dayModulesChips.querySelectorAll("[data-day-module]").forEach((chip) => {
      const on = state.settings.dayModules[chip.dataset.dayModule] !== "hidden";
      chip.classList.toggle("active", on);
      chip.setAttribute("aria-pressed", String(on));
    });
  }

  els.dayView.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-module-toggle]");
    const hide = event.target.closest("[data-module-hide]");
    if (toggle) {
      const id = toggle.dataset.moduleToggle;
      setDayModule(id, state.settings.dayModules[id] === "collapsed" ? "open" : "collapsed");
    } else if (hide) {
      const id = hide.dataset.moduleHide;
      setDayModule(id, "hidden");
      toast(t("moduleHidden", { name: t(MODULE_NAMES[id]) }), t("undo"), () => setDayModule(id, "open"));
      els.dayCaptureInput.focus({ preventScroll: true });
    } else if (event.target.closest("[data-modules-show]")) {
      state.settings.dayModules = Object.fromEntries(Object.entries(state.settings.dayModules)
        .map(([id, value]) => [id, value === "hidden" ? "open" : value]));
      persistSettings();
      applyDayModules();
      renderDayModuleChips();
    }
  });
  els.dayModulesChips.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-day-module]");
    if (!chip) return;
    const id = chip.dataset.dayModule;
    setDayModule(id, state.settings.dayModules[id] === "hidden" ? "open" : "hidden");
  });

  // Mental load: the app's estimate as a ghost, the person's own rating
  // solid. Clicking a tick sets the rating; clicking it again clears it.
  function renderLoad(iso) {
    const estimate = Planner.mentalLoad(state.items, iso, { todayISO: todayISO(), moods: state.moods, events: state.events });
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
    // replaceChildren (unlike h) would print a null child as "null".
    els.loadMeter.replaceChildren(...[
      h("div", { class: "load-head", title: why },
        h("button", { type: "button", class: "module-toggle", "data-module-toggle": "load", "aria-expanded": "true" },
          icon('<svg class="i chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>'),
          h("span", { class: "load-title", text: t("load") })),
        h("button", { type: "button", class: "module-hide", "data-module-hide": "load", "aria-label": t("moduleHide-load"), title: t("moduleHide-load"), text: "×" }),
        h("span", { class: "load-reading" },
          h("strong", { class: "load-score", text: String(score) }),
          h("span", { class: "load-of", text: "/10" }),
          h("span", { class: "load-label", text: t(`load-${level}`) }))),
      h("span", { class: "load-ticks", role: "group", title: t("loadAdjust") }, ticks),
      h("span", { class: "load-source", title: why, text: hasOwn ? t("loadSourceOwn", { n: estimate.score }) : t("loadSourceEstimate") }),
      score >= 5 || candidate ? h("p", { class: "load-text" },
        t(`loadText-${level}`),
        candidate ? h("button", { type: "button", class: "load-action", "data-postpone": candidate.id, text: t("loadPostpone", { title: candidate.title }) }) : null) : null,
    ].filter(Boolean));
  }

  const FOCUS_LABELS = { must: "focusMust", could: "focusCould", later: "focusLater" };
  const FOCUS_EXPLAIN = { must: "explainMust", could: "explainCould", later: "explainLater" };

  function renderDayTasks(iso, items) {
    els.dayTasks.dataset.date = iso;
    els.dayTasks.replaceChildren(...Planner.FOCUS.map((focus) => {
      const group = items.filter((item) => item.focus === focus);
      const ghosts = Planner.upcomingOccurrences(state.items, iso, iso).filter((ghost) => ghost.focus === focus);
      const movable = focus === "later" && group.some((item) => !item.done);
      return h("section", { class: `focus-group focus-${focus}`, "data-focus": focus },
        h("h3", { class: "focus-head" },
          h("span", { text: t(FOCUS_LABELS[focus]), title: t(FOCUS_EXPLAIN[focus]) }),
          group.length ? h("span", { class: "focus-count", text: String(group.length) }) : null,
          h("button", { type: "button", class: "focus-add", "data-focus-add": focus, title: t("addToGroup", { group: t(FOCUS_LABELS[focus]) }), "aria-label": t("addToGroup", { group: t(FOCUS_LABELS[focus]) }), text: "+" }),
          movable ? h("button", { type: "button", class: "focus-action", "data-later-tomorrow": iso, text: t("allToTomorrow") }) : null),
        h("ul", { class: "day-items", "data-date": iso, "data-focus": focus }, group.map((item) => {
          const line = itemEl(item, "line");
          // Hover shortcuts to move the task to the other two groups.
          line.append(h("span", { class: "focus-move" }, Planner.FOCUS.filter((other) => other !== focus).map((other) => h("button", {
            type: "button",
            "data-move-focus": other,
            title: t("moveToGroup", { group: t(FOCUS_LABELS[other]) }),
            text: t(`move-${other}`),
          }))));
          return line;
        }), ghosts.map((ghost) => ghostEl(ghost, "line"))),
        group.length || ghosts.length ? null : h("p", { class: "focus-hint", text: t(`${FOCUS_LABELS[focus]}Hint`) }));
    }));
  }

  let dayNotesKey = null;
  let dayNotesTimer = null;

  function renderDayNotes() {
    const key = anchorISO();
    if (key === dayNotesKey && document.activeElement === els.dayNotes) return;
    dayNotesKey = key;
    els.dayNotes.value = state.dayNotes[key] || "";
    fitDayNotes();
  }

  // The notes field grows with its text (the page scrolls if it must).
  function fitDayNotes() {
    els.dayNotes.style.height = "auto";
    els.dayNotes.style.height = `${els.dayNotes.scrollHeight + 4}px`;
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

    const weeks = Planner.monthGrid(year, month, state.settings.weekStart);
    els.monthWeekdays.replaceChildren(...weeks[0].map((day) => h("span", {
      class: day.getDay() === 6 ? "wd-sat" : day.getDay() === 0 ? "wd-sun" : null,
    }, formatDate(day, { weekday: "short" }))));

    const limit = weeks.length > 5 ? 3 : 4;
    els.monthGrid.style.gridTemplateRows = `repeat(${weeks.length}, minmax(0, 1fr))`;
    // Daily and weekday repeats would fill every cell; the month shows the rarer ones.
    const monthGhosts = Planner.upcomingOccurrences(state.items, Core.toISODate(weeks[0][0]), Core.toISODate(weeks[weeks.length - 1][6]))
      .filter((ghost) => ghost.repeat !== "daily" && ghost.repeat !== "weekdays");
    els.monthGrid.replaceChildren(...weeks.flat().map((day) => {
      const iso = Core.toISODate(day);
      const holiday = holidayFor(iso);
      const items = [...Planner.itemsForDay(state.items, iso), ...ghostsOn(monthGhosts, iso)];
      const { allDay: allDayEvents, timed: timedEvents } = dayEvents(iso);
      const meetings = [...allDayEvents, ...timedEvents];
      const classes = dayClasses(day, "month-cell") + (day.getMonth() === month ? "" : " is-other");
      return h("div", { class: classes, "data-date": iso, "data-open-day": iso, title: t("openDay", { date: longDate(iso) }) },
        h("div", { class: "cell-head" },
          h("span", { class: "cell-num", text: day.getDate() }),
          holiday ? h("span", { class: "cell-holiday", text: holiday }) : null,
          dayHabitIcons(iso, "cell-habits"),
          moodEl(state.moods[iso], "mood-mini", state.moodNotes[iso])),
        h("ul", { class: "month-items", "data-date": iso },
          meetings.slice(0, limit).map((event) => h("li", {
            class: "mini event",
            title: eventTooltip(event),
            "data-event": event.id,
            "data-event-day": iso,
            style: calendarById(event.calendarId) ? `--cat: ${calendarById(event.calendarId).color}` : null,
          },
            h("i", { "aria-hidden": "true" }),
            h("span", { class: "item-body" },
              event.allDay ? null : h("span", { class: "mini-time", text: clockTime(new Date(event.start)) }),
              eventTitle(event)))),
          items.slice(0, Math.max(0, limit - meetings.length)).map((item) => (item.ghost ? ghostEl(item, "mini") : itemEl(item, "mini")))),
        items.length + meetings.length > limit
          ? h("span", { class: "cell-more", text: t("moreItems", { n: items.length + meetings.length - limit }) })
          : null);
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

  // ---------- habits & month summary ----------
  // Line icons for habits, drawn on a 24×24 grid like the rest of the app.
  const HABIT_ICON_PATHS = {
    dumbbell: ["M6.5 7.5v9", "M3.5 10v4", "M17.5 7.5v9", "M20.5 10v4", "M6.5 12h11"],
    run: ["M14.5 6.2a1.7 1.7 0 1 0 0-.01", "M10.5 20l2.2-5-2.6-2.4 1.6-4.4 3 2.6 3 .4", "M6 12l2.8-3.6 3.1-.5", "M12.7 15l3.3 1.3 1.2 3.7"],
    bike: ["M2.5 17a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0", "M14.5 17a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0", "M6 17l3.5-7h5l3 7", "M9.5 10l3.5 7", "M13 7h2.5"],
    swim: ["M3 18c2 0 2.2-1.6 4.5-1.6S10 18 12 18s2.2-1.6 4.5-1.6S19 18 21 18", "M16.5 8.2a1.7 1.7 0 1 0 0-.01", "M6.5 14l4.5-4.5 3 2.5 3-1"],
    yoga: ["M12 5.2a1.7 1.7 0 1 0 0-.01", "M12 8v5.5", "M5.5 10.5l6.5 2 6.5-2", "M8 20l4-6.5 4 6.5"],
    book: ["M4 5.5c2.7-1 5.3-1 8 .7 2.7-1.7 5.3-1.7 8-.7v13c-2.7-1-5.3-1-8 .7-2.7-1.7-5.3-1.7-8-.7z", "M12 6.2v13.2"],
    pen: ["M16.5 3.8l3.7 3.7L8 19.7H4.3V16z", "M14 6.3l3.7 3.7"],
    lotus: ["M12 19.5c-4.2 0-7.2-2.6-8-6.2 3.1 0 6.2 1.6 8 4.2 1.8-2.6 4.9-4.2 8-4.2-.8 3.6-3.8 6.2-8 6.2z", "M12 17.5c-1.9-2.6-1.9-7.2 0-11 1.9 3.8 1.9 8.4 0 11z"],
    pill: ["M10.6 20.2a4.9 4.9 0 0 1-6.8-6.8l6.6-6.6a4.9 4.9 0 0 1 6.8 6.8z", "M7.1 10.1l6.8 6.8"],
    moon: ["M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.2 6.2 0 0 0 10.1 10.1z"],
    heart: ["M12 19.8s-7.2-4.4-7.2-10.1A4.1 4.1 0 0 1 12 7.1a4.1 4.1 0 0 1 7.2 2.6c0 5.7-7.2 10.1-7.2 10.1z"],
    leaf: ["M5 19.5C5 11.4 10.6 6 19.5 4.5 18.3 13.6 12.9 19.5 5 19.5z", "M5 19.5l8-8"],
  };

  // Gentle habit states on a day: "done", "little" or "rest" (or none).
  const STATE_LABELS = { done: "stateDone", little: "stateLittle", rest: "stateRest" };
  const habitStateOn = (habitId, iso) => Planner.habitState(state.habitLog, iso, habitId);
  const stateClass = (habitId, iso) => (habitStateOn(habitId, iso) ? ` is-${habitStateOn(habitId, iso)}` : "");
  const stateLabel = (habitId, iso) => (habitStateOn(habitId, iso) ? t(STATE_LABELS[habitStateOn(habitId, iso)]) : "");

  function habitIconEl(icon, className = "habit-icon") {
    const paths = HABIT_ICON_PATHS[icon];
    if (!paths) return null;
    const svg = svgEl("svg", { class: className, viewBox: "0 0 24 24", "aria-hidden": "true" });
    paths.forEach((d) => svg.append(svgEl("path", { d })));
    return svg;
  }

  // The habit's mark: its icon, or a small colored square.
  function habitMark(habit) {
    return habitIconEl(habit.icon) || h("i", { class: "habit-dot", "aria-hidden": "true" });
  }

  // Icon habits planned (or done as an extra) on a day, for week and month.
  function dayHabitIcons(iso, className) {
    const icons = state.habits
      .filter((habit) => habit.icon && (Planner.habitScheduled(habit, iso) || (Planner.habitActive(habit, iso) && Planner.habitDone(state.habitLog, iso, habit.id))))
      .slice(0, 4)
      .map((habit) => {
        const svg = habitIconEl(habit.icon, `habit-icon${stateClass(habit.id, iso)}`);
        svg.style.setProperty("--habit", habit.color);
        const title = svgEl("title", {});
        title.textContent = [habit.name, stateLabel(habit.id, iso)].filter(Boolean).join(" · ");
        svg.prepend(title);
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", title.textContent);
        svg.removeAttribute("aria-hidden");
        return svg;
      });
    return icons.length ? h("span", { class: className }, icons) : null;
  }
  function monthIsos(year, month) {
    const total = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: total }, (_, index) => Core.toISODate(new Date(year, month, index + 1)));
  }

  function renderHabitsView() {
    const year = state.anchor.getFullYear();
    const month = state.anchor.getMonth();
    const reference = new Date(year, month, 1);
    const today = todayISO();
    const isos = monthIsos(year, month);
    els.hvMonthNum.textContent = String(month + 1).padStart(2, "0");
    els.hvMonthName.textContent = capitalize(formatDate(reference, { month: "long" }));
    els.hvYear.textContent = String(year);
    els.hvRange.textContent = capitalize(formatDate(reference, { month: "long", year: "numeric" }));

    // Grid: habit names, one column per day, then month % and streak.
    els.habitGrid.style.setProperty("--days", isos.length);
    const head = [h("span", { class: "hg-corner" }), ...isos.map((iso) => {
      const date = Core.parseISODate(iso);
      const classes = ["hg-day"];
      // Only a few day numbers are shown here, so weekend colors would look
      // random; today is the one that stands out.
      if (iso === today) classes.push("is-today");
      // Sparse day numbers (like the summary axes) so 31 columns stay legible.
      const day = date.getDate();
      const besideToday = Math.abs(day - (isos.indexOf(today) + 1)) === 1 && isos.includes(today);
      const label = iso === today || ((day === 1 || day % 5 === 0) && !besideToday);
      return h("span", { class: classes.join(" "), title: iso === today ? t("goToday") : null, text: label ? String(day) : "" });
    }), h("span", { class: "hg-corner" })];

    const visible = state.habits.filter((habit) => Planner.habitActiveBetween(habit, isos[0], isos[isos.length - 1]));
    const rows = visible.flatMap((habit) => {
      const stats = Planner.habitMonth(state.habitLog, habit, year, month, today);
      const streak = Planner.habitStreak(state.habitLog, habit, today);
      // A little counts half; rest days are left out (see Planner.habitMonth).
      const pct = stats.elapsed ? Math.round((stats.score / stats.elapsed) * 100) : 0;
      return [
        h("div", { class: "hg-name", style: `--habit: ${habit.color}` },
          h("button", { type: "button", class: "hg-edit", "data-habit-edit": habit.id, title: t("habitEdit"), "aria-label": t("habitEdit") }, habitMark(habit)),
          h("button", { type: "button", class: "hg-label", "data-habit-edit": habit.id, title: t("habitEdit") },
            h("span", { class: "hg-title", text: habit.name }),
            h("span", { class: "hg-meta" }, [
              ...habitScheduleParts(habit),
              ...(habit.until ? [t("habitEnded", { date: shortDate(habit.until) })] : []),
            ].map((part) => h("span", { text: part }))))),
        ...isos.map((iso) => {
          if (!Planner.habitActive(habit, iso)) return h("span", { class: "hg-cell is-inactive", "aria-hidden": "true" });
          const done = Planner.habitDone(state.habitLog, iso, habit.id);
          const future = iso > today;
          // Days the habit isn't planned for stay clickable as "extra" days.
          const off = !Planner.habitScheduled(habit, iso);
          const label = [t("habitCell", { habit: habit.name, date: shortDate(iso) }), off ? t("habitExtraDay") : "", stateLabel(habit.id, iso)].filter(Boolean).join(" · ");
          return h("button", {
            type: "button",
            class: `hg-cell${stateClass(habit.id, iso)}${off ? " is-off" : ""}${iso === today ? " is-today" : ""}`,
            style: `--habit: ${habit.color}`,
            "data-habit-cell": habit.id,
            "data-date": iso,
            "aria-pressed": String(done),
            "aria-label": label,
            title: label,
            disabled: future ? "" : null,
          });
        }),
        h("div", { class: "hg-stat", title: t("habitMonthPct", stats) },
          h("strong", { text: stats.elapsed ? `${pct}%` : "—" }),
          streak ? h("span", { title: t("habitStreak", { n: streak }), text: streak === 1 ? t("habitStreakDay") : t("habitStreakDays", { n: streak }) }) : null),
      ];
    });
    els.habitGrid.replaceChildren(...head, ...rows);
    els.habitGrid.hidden = visible.length === 0;
    els.habitEmpty.hidden = visible.length > 0;
    els.habitEmpty.textContent = state.habits.length ? t("habitNoneThisMonth") : t("habitEmpty");

    const names = new Set(state.habits.map((habit) => habit.name.toLowerCase()));
    const ideas = habitIdeas().filter((idea) => !names.has(idea.name.toLowerCase()));
    els.habitIdeas.replaceChildren(...(ideas.length && state.habits.length < 8
      ? [h("span", { class: "habit-ideas-title", text: t("habitIdeasTitle") }),
        ...ideas.map((idea) => h("button", { type: "button", class: "chip habit-idea", "data-habit-idea": idea.name },
          habitIconEl(idea.icon), idea.name))]
      : []));

    renderMonthSummary(isos, today);
    renderMonthTabs(reference);
  }

  // "Name:icon:1,3,5" entries from the translations.
  function habitIdeas() {
    return t("habitIdeas").split("|").map((entry) => {
      const [name, icon = "", days = ""] = entry.split(":");
      return { name, icon: icon || null, days: days ? days.split(",").map(Number) : [] };
    });
  }

  function summaryTitle(key) {
    return h("h2", { class: "section-title" }, h("span", { text: t(key) }));
  }

  // Day numbers under a strip, every few days, aligned to the same columns.
  function summaryAxis(isos) {
    return h("div", { class: "sum-axis", style: `--days: ${isos.length}` }, isos.map((iso, index) => {
      const day = index + 1;
      return h("span", { text: day === 1 || day % 5 === 0 ? String(day) : "" });
    }));
  }

  function renderMonthSummary(isos, today) {
    const past = isos.filter((iso) => iso <= today);

    // Mood: one face per day, then how often each mood came up.
    const counts = new Map();
    const faces = isos.map((iso) => {
      const mood = state.moods[iso];
      if (mood) counts.set(mood, (counts.get(mood) || 0) + 1);
      return h("span", { class: `sum-face${iso > today ? " is-future" : ""}` },
        mood ? moodEl(mood, "mood-mini", state.moodNotes[iso]) : h("i", { "aria-hidden": "true" }));
    });
    els.sumMood.replaceChildren(
      summaryTitle("dayMood"),
      h("div", { class: "sum-strip", style: `--days: ${isos.length}` }, faces),
      summaryAxis(isos),
      counts.size
        ? h("p", { class: "sum-legend" }, Planner.MOODS.filter((mood) => counts.has(mood)).map((mood) => h("span", { class: "sum-count" },
          moodEl(mood, "mood-mini"), counts.get(mood) === 1 ? t(`moodDay-${mood}`) : t(`moodDays-${mood}`, { n: counts.get(mood) }))))
        : h("p", { class: "sum-note", text: t("sumMoodNone") }));

    // Water: a bar per day against the daily goal line.
    const { glassMl, waterGoal, waterUnit } = state.settings;
    const target = Planner.waterTarget(waterGoal, glassMl);
    const logged = past.filter((iso) => state.water[iso]);
    const met = past.filter((iso) => (state.water[iso] || 0) >= target).length;
    const unit = Planner.isBottle(glassMl) ? t("waterUnitBottles").toLowerCase() : t("waterUnitGlasses").toLowerCase();
    const bars = isos.map((iso) => {
      const count = state.water[iso] || 0;
      const ratio = Math.min(count / target, 1.25);
      return h("span", {
        class: `sum-bar water${count >= target ? " is-met" : ""}${iso > today ? " is-future" : ""}`,
        style: `--v: ${ratio / 1.25}`,
        title: t("sumWaterDay", { date: shortDate(iso), n: count, total: target, unit: waterUnit === "liters" ? `(${Planner.formatLiters(count * glassMl, I18n.language)})` : unit }),
      });
    });
    const average = logged.length ? logged.reduce((sum, iso) => sum + state.water[iso], 0) * glassMl / logged.length : 0;
    els.sumWater.replaceChildren(
      summaryTitle("water"),
      h("div", { class: "sum-bars", style: `--days: ${isos.length}; --goal: ${1 / 1.25}` }, bars),
      summaryAxis(isos),
      h("p", { class: "sum-note", text: logged.length
        ? t("sumWater", { met, days: past.length, avg: Planner.formatVolume(average, I18n.language) })
        : t("sumWaterNone") }));

    // Mental load: your rating where you gave one, otherwise the estimate.
    const scores = isos.map((iso) => {
      if (iso > today) return null;
      const own = state.loads[iso];
      const estimate = Planner.mentalLoad(state.items, iso, { todayISO: today, moods: state.moods, events: state.events }).score;
      return Number.isInteger(own) ? { score: own, own: true } : { score: estimate, own: false };
    });
    const known = scores.filter(Boolean);
    const avg = known.length ? known.reduce((sum, entry) => sum + entry.score, 0) / known.length : 0;
    const heavy = known.filter((entry) => entry.score >= 7).length;
    const number = new Intl.NumberFormat(I18n.language === "pt" ? "pt-BR" : "en-GB", { maximumFractionDigits: 1 });
    els.sumLoad.replaceChildren(
      summaryTitle("load"),
      h("div", { class: "sum-bars", style: `--days: ${isos.length}` }, scores.map((entry, index) => h("span", {
        class: `sum-bar load level-${entry ? Planner.loadLevel(entry.score) : "light"}${entry?.own ? " is-own" : ""}${entry ? "" : " is-future"}`,
        style: `--v: ${entry ? entry.score / 10 : 0}`,
        title: entry ? t("sumLoadDay", { date: shortDate(isos[index]), n: entry.score, source: t(entry.own ? "loadYours" : "loadEstimate") }) : null,
      }))),
      summaryAxis(isos),
      h("p", { class: "sum-note" },
        t("sumLoad", { avg: number.format(avg), heavy }),
        h("span", { class: "load-legend" },
          h("i", { class: "is-own", "aria-hidden": "true" }), t("loadLegendOwn"),
          h("i", { "aria-hidden": "true" }), t("loadLegendEstimate"))));

    renderPatterns(today);
  }

  const DROP_ICON = "M12 3.5c3 4 5.5 7 5.5 10.2a5.5 5.5 0 0 1-11 0C6.5 10.5 9 7.5 12 3.5z";
  const LOAD_ICON = ["M6 19v-5", "M12 19V9", "M18 19V5"];

  function patternIcon(pattern) {
    const habit = state.habits.find((candidate) => candidate.id === pattern.habitId);
    if (habit) {
      const icon = habitIconEl(habit.icon, "habit-icon") || h("i", { class: "habit-dot" });
      if (icon.style) icon.style.setProperty("--habit", habit.color);
      return icon;
    }
    const svg = svgEl("svg", { class: "habit-icon pattern-icon", viewBox: "0 0 24 24", "aria-hidden": "true" });
    (pattern.kind === "mood-water" ? [DROP_ICON] : LOAD_ICON).forEach((d) => svg.append(svgEl("path", { d })));
    return svg;
  }

  // Observations across mood, water, reported load and habits — only with
  // enough days behind them, always with the counts.
  function renderPatterns(today) {
    const target = Planner.waterTarget(state.settings.waterGoal, state.settings.glassMl);
    const { patterns, moodDays } = Planner.patterns({
      moods: state.moods,
      water: state.water,
      waterTarget: target,
      loads: state.loads,
      habits: state.habits,
      habitLog: state.habitLog,
      todayISO: today,
    });
    const lines = patterns.map((pattern) => {
      const habit = state.habits.find((candidate) => candidate.id === pattern.habitId);
      const direction = pattern.kind === "load-habit" || pattern.kind === "mood-load"
        ? (pattern.diff < 0 ? "down" : "up")
        : (pattern.diff > 0 ? "up" : "down");
      return h("li", { class: "pattern" },
        patternIcon(pattern),
        h("div", {},
          h("p", { text: t(`pattern-${pattern.kind}-${direction}`, { habit: habit?.name || "" }) }),
          h("span", { class: "pattern-basis", text: t(`basis-${pattern.kind}`, { na: pattern.na, nb: pattern.nb }) })));
    });
    els.sumPatterns.replaceChildren(
      summaryTitle("patternsTitle"),
      lines.length
        ? h("ul", { class: "pattern-list" }, lines)
        : h("p", { class: "sum-note", text: moodDays < 10 ? t("patternsNeedMood", { n: moodDays }) : t("patternsNone") }),
      h("p", { class: "pattern-note", text: t("patternsNote") }));
  }

  // Habits planned for the day (or already done as an extra) as pills.
  function renderTodayHabits(iso) {
    const habits = state.habits
      // Timed habits are checked on their timeline block; pills are for the rest.
      .filter((habit) => !Planner.habitTimeOn(habit, iso))
      .filter((habit) => Planner.habitScheduled(habit, iso) || (Planner.habitActive(habit, iso) && Planner.habitDone(state.habitLog, iso, habit.id)));
    els.todayHabits.hidden = habits.length === 0;
    const future = iso > todayISO();
    els.habitPills.replaceChildren(...habits.map((habit) => {
      const done = Planner.habitDone(state.habitLog, iso, habit.id);
      return h("button", {
        type: "button",
        class: `habit-pill${stateClass(habit.id, iso)}${habit.icon ? " has-icon" : ""}`,
        style: `--habit: ${habit.color}`,
        "data-habit-cell": habit.id,
        "data-date": iso,
        "aria-pressed": String(done),
        disabled: future ? "" : null,
      }, habitIconEl(habit.icon) || h("i", { "aria-hidden": "true" }),
        Planner.habitTimeOn(habit, iso) ? h("span", { class: "pill-time", text: Planner.habitTimeOn(habit, iso).start }) : null,
        habit.name,
        ["little", "rest"].includes(habitStateOn(habit.id, iso)) ? h("span", { class: "pill-state", text: stateLabel(habit.id, iso).toLowerCase() }) : null);
    }));
  }

  // ---------- habit editor ----------
  let habitDraft = null;

  function weekdayOrder() {
    return state.settings.weekStart === 0 ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0];
  }

  function renderHabitEditor() {
    const draft = habitDraft;
    els.habitIconPicker.replaceChildren(
      h("button", { type: "button", class: `icon-choice${draft.icon ? "" : " active"}`, "data-icon": "", "aria-pressed": String(!draft.icon), title: t("habitNoIcon"), "aria-label": t("habitNoIcon") },
        h("i", { class: "habit-dot", "aria-hidden": "true" })),
      ...Planner.HABIT_ICONS.map((icon) => h("button", {
        type: "button",
        class: `icon-choice${draft.icon === icon ? " active" : ""}`,
        "data-icon": icon,
        "aria-pressed": String(draft.icon === icon),
        title: t(`icon-${icon}`),
        "aria-label": t(`icon-${icon}`),
      }, habitIconEl(icon))));
    els.habitIconPicker.style.setProperty("--habit", draft.color);

    renderHabitRows();
    els.habitSince.value = draft.since || "";
    els.habitUntil.value = draft.until || "";
    els.habitUntil.min = draft.since || "";
    els.habitEndToggle.textContent = draft.until ? t("habitReactivate") : t("habitEndToday");

    els.habitColorPicker.replaceChildren(...Planner.PALETTE.map((color) => h("button", {
      type: "button",
      class: `cal-color${color === draft.color ? " active" : ""}`,
      "data-color": color,
      "aria-pressed": String(color === draft.color),
      "aria-label": color,
      style: `--cat: ${color}`,
    })));
  }

  // "When": rows of days + time + duration. A day belongs to one row at most.
  function renderHabitRows() {
    const rows = habitDraft.rows;
    const sunday = new Date(2026, 0, 4); // a Sunday, only for weekday names
    els.habitRows.replaceChildren(...rows.map((row, index) => {
      const duration = h("select", { "data-row-duration": index, "aria-label": t("habitDuration") });
      fillSelect(duration, DURATION_OPTIONS, "—", formatDuration);
      duration.value = row.start ? String(row.duration || 60) : "";
      duration.disabled = !row.start;
      return h("div", { class: "schedule-row" },
        h("div", { class: "day-picker" }, weekdayOrder().map((day) => {
          const on = row.days.includes(day);
          const name = formatDate(Planner.addDays(sunday, day), { weekday: "long" });
          return h("button", {
            type: "button",
            class: `day-choice${on ? " active" : ""}${day === 0 ? " is-sun" : day === 6 ? " is-sat" : ""}`,
            "data-row": index,
            "data-day": day,
            "aria-pressed": String(on),
            "aria-label": name,
            title: capitalize(name),
            text: formatDate(Planner.addDays(sunday, day), { weekday: "narrow" }),
          });
        })),
        h("div", { class: "schedule-time" },
          h("input", { type: "time", step: "900", value: row.start || "", "data-row-start": index, "aria-label": t("habitTime") }),
          duration,
          rows.length > 1
            ? h("button", { type: "button", class: "row-remove", "data-row-remove": index, title: t("habitRemoveTime"), "aria-label": t("habitRemoveTime"), text: "×" })
            : null));
    }));
    const days = new Set(rows.flatMap((row) => row.days));
    els.habitDaysHint.textContent = !days.size ? t("habitNoDaysHint")
      : days.size === 7 ? t("habitEveryDay")
        : days.size === 1 ? t("habitDaysOne") : t("habitDaysCount", { n: days.size });
  }

  // ---------- habit detail ----------
  let detailHabitId = null;

  function renderHabitDetail() {
    const habit = state.habits.find((candidate) => candidate.id === detailHabitId);
    if (!habit) return;
    const today = todayISO();
    // The month being looked at in Habits, otherwise this month.
    const reference = state.view === "habits" ? state.anchor : new Date();
    const year = reference.getFullYear();
    const month = reference.getMonth();
    const stats = Planner.habitMonth(state.habitLog, habit, year, month, today);
    const streak = Planner.habitStreak(state.habitLog, habit, today);

    els.habitDetail.style.setProperty("--habit", habit.color);
    els.habitDetailIcon.replaceChildren(habitMark(habit));
    els.habitDetailTitle.textContent = habit.name;
    els.habitDetailMeta.replaceChildren(...habitScheduleParts(habit).map((part) => h("span", { text: part })));
    els.habitDetailMonth.textContent = capitalize(formatDate(new Date(year, month, 1), { month: "long", year: "numeric" }));

    const stat = (value, label) => h("div", { class: "detail-stat" }, h("strong", { text: value }), h("span", { text: label }));
    els.habitDetailStats.replaceChildren(
      stat(String(stats.done + stats.extra), t("habitDone")),
      stat(String(streak), t("habitStreakLabel")),
      stat(stats.elapsed ? `${Math.round((stats.score / stats.elapsed) * 100)}%` : "—", t("habitConsistency")));

    // Two weeks ending with this one, laid out in weekday columns.
    const weekStart = Planner.startOfWeek(Core.parseISODate(today), state.settings.weekStart);
    const days = Array.from({ length: 14 }, (_, index) => Planner.addDays(weekStart, index - 7));
    els.habitDetailDays.replaceChildren(
      ...days.slice(0, 7).map((day) => h("span", { class: "dd-head", text: formatDate(day, { weekday: "narrow" }) })),
      ...days.map((day) => {
        const iso = Core.toISODate(day);
        const done = Planner.habitDone(state.habitLog, iso, habit.id);
        const planned = Planner.habitScheduled(habit, iso);
        const future = iso > today;
        const label = [t("habitCell", { habit: habit.name, date: shortDate(iso) }), planned ? "" : t("habitExtraDay"), stateLabel(habit.id, iso)].filter(Boolean).join(" · ");
        return h("button", {
          type: "button",
          class: `dd-cell${stateClass(habit.id, iso)}${planned ? "" : " is-off"}${iso === today ? " is-today" : ""}`,
          "data-habit-cell": habit.id,
          "data-date": iso,
          "aria-pressed": String(done),
          "aria-label": label,
          title: label,
          disabled: future || !Planner.habitActive(habit, iso) ? "" : null,
        }, h("span", { class: "dd-num", text: day.getDate() }));
      }));

    const insight = Planner.habitInsight(state.habitLog, habit, today);
    els.habitDetailInsight.textContent = insight.kind === "best"
      ? t("insightBest", { day: t("insightDays").split("|")[insight.day] })
      : insight.kind === "perfect" ? t("insightPerfect") : t("insightNone");
  }

  function openHabitDetail(id) {
    detailHabitId = id;
    renderHabitDetail();
    if (!els.habitDetail.open) els.habitDetail.showModal();
  }

  function openHabitEditor(id) {
    const habit = state.habits.find((candidate) => candidate.id === id);
    if (!habit) return;
    habitDraft = { ...habit, rows: Planner.scheduleRows(habit) };
    els.habitEditName.value = habit.name;
    renderHabitEditor();
    els.habitDialog.showModal();
  }

  function addHabit(name, { icon = null, days = [] } = {}) {
    const clean = String(name || "").trim().slice(0, 60);
    if (!clean || state.habits.some((habit) => habit.name.toLowerCase() === clean.toLowerCase())) return;
    const used = new Set(state.habits.map((habit) => habit.color));
    const color = Planner.PALETTE.find((candidate) => !used.has(candidate)) || Planner.PALETTE[state.habits.length % Planner.PALETTE.length];
    const id = Planner.newId();
    state.habits = Planner.normalizeHabits([...state.habits, { id, name: clean, color, icon, days, since: todayISO() }]);
    persistHabits();
    render();
    // Straight into the editor, so days and a time are set while it's fresh.
    openHabitEditor(id);
  }

  const weekdayShort = (day) => formatDate(Planner.addDays(new Date(2026, 0, 4), day), { weekday: "short" }).replace(".", "").toLowerCase();

  // ["07:00 · mon wed fri"], ["mon wed 07:00", "fri 18:00"], ["Every day"], …
  function habitScheduleParts(habit) {
    const planned = weekdayOrder().filter((day) => !habit.days.length || habit.days.includes(day));
    const times = habit.times || {};
    if (Object.keys(times).length) {
      const groups = [];
      planned.forEach((day) => {
        const start = times[String(day)]?.start || null;
        const group = groups.find((candidate) => candidate.start === start);
        if (group) group.days.push(day);
        else groups.push({ start, days: [day] });
      });
      return groups.map((group) => `${group.days.map(weekdayShort).join(" ")}${group.start ? ` ${group.start}` : ""}`);
    }
    const days = habit.days.length ? planned.map(weekdayShort).join(" ") : t("habitEveryDay");
    return [habit.start ? `${habit.start} · ${days}` : days];
  }

  // Long sidebar lists show their first entries and the rest on request:
  // rebuilding hundreds of overdue tasks on every change made the app slow.
  const SIDE_LIST_LIMIT = 40;
  const sideListOpen = { overdue: false, inbox: false };

  function sideListEls(items, variant) {
    const shown = sideListOpen[variant] ? items : items.slice(0, SIDE_LIST_LIMIT);
    const rest = items.length - shown.length;
    return [
      ...shown.map((item) => itemEl(item, variant)),
      rest > 0 ? h("li", { class: "side-more" },
        h("button", { type: "button", class: "link-btn", "data-side-more": variant, text: t("showMore", { n: rest }) })) : null,
    ].filter(Boolean);
  }

  function renderSidebar() {
    els.dumpCount.textContent = state.dump.length || "";
    els.shopCount.textContent = state.shopping.items.filter((item) => !item.done).length || "";
    const overdue = Planner.overdueItems(state.items, todayISO());
    els.overdueSection.hidden = overdue.length === 0;
    els.overdueCount.textContent = overdue.length || "";
    els.overdueList.replaceChildren(...sideListEls(overdue, "overdue"));

    const inbox = Planner.inboxItems(state.items);
    els.inboxCount.textContent = inbox.length || "";
    els.inboxList.replaceChildren(...sideListEls(inbox, "inbox"));
    els.inboxEmpty.hidden = inbox.length > 0;
  }

  document.addEventListener("click", (event) => {
    const more = event.target.closest("[data-side-more]");
    if (!more) return;
    const list = more.closest(".side-list");
    sideListOpen[more.dataset.sideMore] = true;
    renderSidebar();
    // Keyboard focus moves to the first entry that just appeared.
    list?.querySelectorAll(".item .item-body")[SIDE_LIST_LIMIT]?.focus({ preventScroll: true });
  });

  // Re-rendering replaces lists, which would drop keyboard focus onto the
  // page. This finds the same control again (same task, habit, button) by
  // its data attributes, first inside the same static container.
  const describeNode = (node) => [...node.attributes]
    .filter((attribute) => attribute.name.startsWith("data-") && !attribute.name.startsWith("data-i18n"))
    .map((attribute) => `[${attribute.name}="${CSS.escape(attribute.value)}"]`)
    .join("");

  function focusMemo() {
    const active = document.activeElement;
    if (!active || active === document.body || active.id || active.closest("dialog")) return null;
    const host = active.closest("[data-id], [data-habit-cell], [data-event], [data-dump]");
    const own = `${active.tagName.toLowerCase()}${describeNode(active)}`;
    const selector = host && host !== active ? `${host.tagName.toLowerCase()}${describeNode(host)} ${own}` : own;
    if (selector === active.tagName.toLowerCase()) return null;
    return { zone: active.parentElement?.closest("[id]")?.id || null, selector };
  }

  function restoreFocus(memo) {
    if (!memo || (document.activeElement && document.activeElement !== document.body)) return;
    let target = null;
    try {
      target = (memo.zone && document.getElementById(memo.zone)?.querySelector(memo.selector)) || document.querySelector(memo.selector);
    } catch {
      return;
    }
    if (target && !target.closest("[hidden]")) target.focus({ preventScroll: true });
  }

  function render() {
    const memo = focusMemo();
    renderViews();
    restoreFocus(memo);
  }

  function renderViews() {
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
    els.habitsView.hidden = state.view !== "habits";
    els.dumpView.hidden = state.view !== "dump";
    els.shoppingView.hidden = state.view !== "shopping";
    renderTopbar();
    if (state.view === "day") renderDayView();
    else if (state.view === "week") renderSpread();
    else if (state.view === "month") renderMonthView();
    else if (state.view === "habits") renderHabitsView();
    else if (state.view === "shopping") renderShopping();
    else renderDump();
    renderSidebar();
    renderSaveStatus();
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
    else state.anchor = new Date(state.anchor.getFullYear(), state.anchor.getMonth() + direction, 1);
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

    fillSelect(els.itemRepeat, Planner.REPEATS, draft.date ? t("repeatNone") : t("repeatNeedsDate"), (rule) => repeatLabel(rule, draft.date));
    els.itemRepeat.value = draft.repeat || "";
    els.itemRepeat.disabled = !draft.date;
    const saved = findItem(state.editingId);
    els.itemSkip.hidden = !(saved?.repeat && !saved.done);

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
    // A new date restarts the repeat from it; no date, no repeat.
    if (draft.repeat && draft.date !== original.date) draft.repeatAnchor = draft.date;
    if (!draft.date) draft.repeat = null;
    els.itemDialog.close();
    // Finishing a repeating task from the editor also creates its next one.
    const finishing = draft.done && !original.done && draft.repeat;
    const saved = Planner.normalizeItem(finishing ? { ...draft, done: false, doneAt: null } : draft);
    state.items = state.items.map((item) => (item.id === saved.id ? saved : item));
    if (finishing) state.items = Planner.completeItem(state.items, saved.id, todayISO());
    commit();
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
  els.itemRepeat.addEventListener("change", () => {
    state.draft.repeat = els.itemRepeat.value || null;
    state.draft.repeatAnchor = state.draft.repeat ? state.draft.date : null;
  });
  els.itemSkip.addEventListener("click", () => {
    const id = state.editingId;
    els.itemDialog.close();
    state.items = Planner.skipOccurrence(state.items, id, todayISO());
    commit();
    const moved = findItem(id);
    if (moved) toast(t("repeatSkipped", { date: shortDate(moved.date) }));
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
  const COVERS = ["green", "navy", "wine", "black", "pink", "mustard", "lavender", "teal", "custom"];
  // Blue (navy) is the default cover, also for older values like 1.x's "mono".
  const currentCover = () => (COVERS.includes(document.documentElement.dataset.cover) ? document.documentElement.dataset.cover : "navy");
  // ---------- cover color picker (in the app, not the system one) ----------
  const picker = {
    panel: document.getElementById("colorPanel"),
    sv: document.getElementById("colorSV"),
    handle: document.getElementById("colorHandle"),
    hue: document.getElementById("colorHue"),
    suggest: document.getElementById("colorSuggest"),
    preview: document.getElementById("colorPreview"),
    hex: document.getElementById("colorHex"),
    note: document.getElementById("colorNote"),
  };
  // Tones that suit a cloth cover.
  const COVER_SUGGESTIONS = ["#4a5d7a", "#2f5a46", "#5e3552", "#8a4b2f", "#44505c", "#1f5c73", "#5b6236", "#7a3b5a"];
  let pick = null; // { h, s, v, before: { cover, color } } while the panel is open

  const pickedHex = () => Planner.hsvToHex(pick.h, pick.s, pick.v);

  // Shows the color live on the cover while picking.
  function showPick() {
    const raw = pickedHex();
    const color = Planner.readableCover(raw);
    document.documentElement.style.setProperty("--cover-custom", color);
    document.documentElement.dataset.cover = "custom";
    picker.sv.style.setProperty("--hue", pick.h);
    picker.handle.style.left = `${pick.s * 100}%`;
    picker.handle.style.top = `${(1 - pick.v) * 100}%`;
    picker.handle.style.background = raw;
    picker.hue.value = String(pick.h);
    if (document.activeElement !== picker.hex) picker.hex.value = raw;
    picker.preview.style.background = color;
    picker.note.hidden = color === raw;
  }

  function openColorPicker() {
    const start = Store.getRaw(KEYS.coverColor) || getComputedStyle(document.documentElement).getPropertyValue("--cover").trim();
    const hsv = Planner.hexToHsv(start) || { h: 220, s: 0.55, v: 0.4 };
    pick = { ...hsv, before: { cover: currentCover(), color: Store.getRaw(KEYS.coverColor) } };
    picker.suggest.replaceChildren(...COVER_SUGGESTIONS.map((hex) => h("button", {
      type: "button",
      class: "color-chip",
      "data-hex": hex,
      title: hex,
      "aria-label": hex,
      style: `background: ${hex}`,
    })));
    picker.panel.hidden = false;
    showPick();
    renderSettings(); // the "Any color" swatch shows as the chosen one while picking
    picker.sv.focus();
  }

  function closeColorPicker(keep) {
    if (!pick) return;
    if (keep) {
      const color = Planner.readableCover(pickedHex());
      Store.setRaw(KEYS.coverColor, color);
      Store.setRaw(KEYS.cover, "custom");
    } else {
      const { cover, color } = pick.before;
      if (color) document.documentElement.style.setProperty("--cover-custom", color);
      document.documentElement.dataset.cover = cover;
    }
    pick = null;
    picker.panel.hidden = true;
    renderSettings();
  }

  // Dragging in the square sets saturation (→) and brightness (↑).
  function pickAt(event) {
    const rect = picker.sv.getBoundingClientRect();
    pick.s = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    pick.v = Math.min(1, Math.max(0, 1 - (event.clientY - rect.top) / rect.height));
    showPick();
  }
  picker.sv.addEventListener("pointerdown", (event) => {
    if (!pick) return;
    picker.sv.setPointerCapture(event.pointerId);
    pickAt(event);
  });
  picker.sv.addEventListener("pointermove", (event) => {
    if (pick && picker.sv.hasPointerCapture(event.pointerId)) pickAt(event);
  });
  picker.sv.addEventListener("keydown", (event) => {
    const moves = { ArrowLeft: ["s", -0.02], ArrowRight: ["s", 0.02], ArrowUp: ["v", 0.02], ArrowDown: ["v", -0.02] };
    if (!pick || !moves[event.key]) return;
    event.preventDefault();
    const [key, delta] = moves[event.key];
    pick[key] = Math.min(1, Math.max(0, pick[key] + delta));
    showPick();
  });
  picker.hue.addEventListener("input", () => {
    pick.h = Number(picker.hue.value);
    showPick();
  });
  picker.hex.addEventListener("input", () => {
    const value = picker.hex.value.trim();
    const hsv = Planner.hexToHsv(value.startsWith("#") ? value : `#${value}`);
    if (!hsv) return;
    Object.assign(pick, hsv);
    showPick();
  });
  picker.suggest.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-hex]");
    if (!chip) return;
    Object.assign(pick, Planner.hexToHsv(chip.dataset.hex));
    showPick();
  });
  document.getElementById("colorDone").addEventListener("click", () => closeColorPicker(true));
  document.getElementById("colorCancel").addEventListener("click", () => closeColorPicker(false));
  picker.panel.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    // Esc cancels the color, not the whole settings sheet.
    event.preventDefault();
    event.stopPropagation();
    closeColorPicker(false);
  });
  const alwaysOnTop = () => Store.getRaw(KEYS.alwaysOnTop) === "on";

  function entryToItem(entry) {
    if (!entry?.item) return null;
    if (entry.type === "item") return Planner.normalizeItem(entry.item);
    if (entry.type === "task") return Planner.legacyTaskToItem(entry.item);
    if (entry.type === "note") return Planner.normalizeItem({ title: entry.item.text, createdAt: entry.item.createdAt });
    return null;
  }

  function renderSettings() {
    renderDayModuleChips();
    renderSync();
    const customSwatch = els.settingsDialog.querySelector(".swatch-custom");
    const customColor = Store.getRaw(KEYS.coverColor);
    if (customColor) customSwatch.style.setProperty("--chosen", customColor);
    customSwatch.classList.toggle("has-color", Boolean(customColor));
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
      notifyOn: state.settings.notifyOn ? "on" : "off",
      notifyLead: String(state.settings.notifyLead),
      morningOn: state.settings.morningOn ? "on" : "off",
      closureOn: state.settings.closureOn ? "on" : "off",
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
    renderCalendarSettings();
    renderNotifySettings();
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
      if (value === "custom") {
        if (!pick) openColorPicker();
        return;
      }
      if (pick) closeColorPicker(false);
      const cover = COVERS.includes(value) ? value : "navy";
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
    } else if (setting === "notifyOn" || setting === "morningOn" || setting === "closureOn") {
      state.settings[setting] = value === "on";
      persistSettings();
    } else if (setting === "notifyLead") {
      state.settings.notifyLead = [5, 10, 15, 30].includes(Number(value)) ? Number(value) : 10;
      persistSettings();
    } else if (setting === "alwaysOnTop") {
      Store.setRaw(KEYS.alwaysOnTop, value);
      desktop?.setAlwaysOnTop(value === "on");
    }
    renderSettings();
  }

  // ---------- calendar subscriptions (Settings → Calendars) ----------
  let calendarColor = null;
  let calendarBusy = false;

  function timeAgo(timestamp) {
    const minutes = Math.round((Date.now() - timestamp) / 60000);
    const format = new Intl.RelativeTimeFormat(I18n.language === "pt" ? "pt-BR" : "en-GB", { numeric: "auto" });
    if (minutes < 1) return format.format(0, "minute");
    if (minutes < 60) return format.format(-minutes, "minute");
    if (minutes < 60 * 24) return format.format(-Math.round(minutes / 60), "hour");
    return format.format(-Math.round(minutes / 1440), "day");
  }

  function renderCalendarSettings() {
    els.calWebNote.hidden = Boolean(calendarsApi);
    els.calAddForm.hidden = !calendarsApi;
    els.calHead.hidden = !calendarsApi || state.calendars.length === 0;
    if (!calendarsApi) {
      els.calList.replaceChildren();
      return;
    }
    els.calSummary.textContent = t("calEvents", { n: state.events.length });
    els.calList.replaceChildren(...(state.calendars.length
      ? state.calendars.map((calendar) => {
        const status = calendar.error
          ? t(`calErr-${calendar.error}`)
          : calendar.lastSync ? t("calSynced", { when: timeAgo(calendar.lastSync) }) : t("calSyncing");
        return h("li", { class: `cal-row${calendar.enabled ? "" : " is-hidden"}`, style: `--cat: ${calendar.color}` },
          h("span", { class: "cal-dot", "aria-hidden": "true" }),
          h("div", { class: "cal-info" },
            h("strong", { text: calendar.name }),
            h("span", { class: `cal-meta${calendar.error ? " is-error" : ""}`, text: `${calendar.host} · ${t("calEvents", { n: calendar.count })} · ${status}` })),
          h("button", {
            type: "button",
            class: "cal-toggle",
            "data-cal-toggle": calendar.id,
            "aria-pressed": String(calendar.enabled),
            title: calendar.enabled ? t("calHide") : t("calShow"),
            text: calendar.enabled ? t("calShown") : t("calHidden"),
          }),
          h("button", { type: "button", class: "cal-remove", "data-cal-remove": calendar.id, title: t("calRemove"), "aria-label": t("calRemove"), text: "×" }));
      })
      : [h("li", { class: "cal-empty", text: t("calEmpty") })]));

    const used = new Set(state.calendars.map((calendar) => calendar.color));
    if (!calendarColor) calendarColor = Planner.PALETTE.find((color) => !used.has(color)) || Planner.PALETTE[0];
    els.calColors.replaceChildren(...Planner.PALETTE.map((color) => h("button", {
      type: "button",
      class: `cal-color${color === calendarColor ? " active" : ""}`,
      "data-cal-color": color,
      "aria-pressed": String(color === calendarColor),
      "aria-label": color,
      style: `--cat: ${color}`,
    })));
    els.calAddBtn.disabled = calendarBusy;
  }

  function applyCalendars(payload) {
    state.calendars = Array.isArray(payload?.calendars) ? payload.calendars : [];
    state.events = Array.isArray(payload?.events) ? payload.events : [];
    render();
    if (els.settingsDialog.open) renderCalendarSettings();
  }

  els.calAddForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!calendarsApi || calendarBusy) return;
    calendarBusy = true;
    els.calStatus.className = "cal-status";
    els.calStatus.textContent = t("calAdding");
    renderCalendarSettings();
    const result = await calendarsApi.add({ name: els.calName.value, color: calendarColor, url: els.calUrl.value });
    calendarBusy = false;
    if (result?.ok) {
      els.calName.value = "";
      els.calUrl.value = "";
      calendarColor = null;
      els.calStatus.textContent = t("calAdded", { n: result.calendar.count });
    } else {
      els.calStatus.className = "cal-status is-error";
      els.calStatus.textContent = t(`calErr-${result?.error || "network"}`);
    }
    renderCalendarSettings();
  });

  els.settingsDialog.addEventListener("click", async (event) => {
    const color = event.target.closest("[data-cal-color]");
    const toggle = event.target.closest("[data-cal-toggle]");
    const remove = event.target.closest("[data-cal-remove]");
    if (color) {
      calendarColor = color.dataset.calColor;
      renderCalendarSettings();
    } else if (toggle && calendarsApi) {
      const calendar = calendarById(toggle.dataset.calToggle);
      if (calendar) applyCalendars(await calendarsApi.update(calendar.id, { enabled: !calendar.enabled }));
    } else if (remove && calendarsApi) {
      const calendar = calendarById(remove.dataset.calRemove);
      if (calendar && window.confirm(t("calRemoveConfirm", { name: calendar.name }))) {
        applyCalendars(await calendarsApi.remove(calendar.id));
      }
    } else if (event.target.closest("#calRefresh") && calendarsApi) {
      els.calSummary.textContent = t("calSyncing");
      applyCalendars(await calendarsApi.refresh());
    }
  });

  if (calendarsApi) {
    calendarsApi.get().then(applyCalendars).catch(() => {});
    calendarsApi.onUpdate(applyCalendars);
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

  // Closing the sheet mid-pick keeps the cover as it was.
  els.settingsDialog.addEventListener("close", () => closeColorPicker(false));

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

  // ---------- backup & restore ----------
  function downloadJSON(text, name) {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = h("a", { href: url, download: name });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // The desktop app writes through the system's save dialog and only then
  // says "saved"; the browser can only hand the file to its downloads.
  async function exportBackup() {
    Store.flush();
    const text = JSON.stringify(Store.backupPayload(), null, 2);
    const name = `lowstate-backup-${todayISO()}.json`;
    const storageApi = window.desktopStorage;
    if (storageApi?.saveBackup) {
      const result = await storageApi.saveBackup(text, name).catch(() => ({ ok: false }));
      if (result?.ok) toast(t("backupSaved", { file: result.file }));
      else if (!result?.canceled) toast(t("backupFailed"));
      return;
    }
    downloadJSON(text, name);
    toast(t("backupDownloaded"));
  }

  let restoreCandidate = null;

  function restoreFact(label, value) {
    return [h("dt", { text: label }), h("dd", { text: value })];
  }

  function openRestorePreview(backup) {
    restoreCandidate = backup;
    const { info } = backup;
    const made = info.date
      ? formatDate(new Date(info.date), { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : t("restoreUnknownDate");
    els.restoreFacts.replaceChildren(
      ...restoreFact(t("restoreMade"), made),
      ...restoreFact(t("restoreFrom"), t(info.generation === 1 ? "restoreGen1" : "restoreGen2")),
      ...restoreFact(t("restoreTasks"), String(info.tasks)),
      ...restoreFact(t("restoreHabits"), String(info.habits)),
      ...restoreFact(t("restoreNow"), t("restoreNowValue", { tasks: state.items.length, habits: state.habits.length })));
    els.restoreNote.textContent = t(window.desktopStorage?.saveRestorePoint ? "restoreNoteDesktop" : "restoreNoteWeb");
    els.restoreError.hidden = true;
    els.restoreDialog.showModal();
  }

  function restoreFailed(message) {
    els.restoreError.textContent = message;
    els.restoreError.hidden = false;
  }

  els.exportData.addEventListener("click", exportBackup);
  els.importData.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", async () => {
    const file = els.importFile.files[0];
    els.importFile.value = "";
    if (!file) return;
    let text;
    try {
      text = await file.text();
    } catch {
      toast(t("restoreFailed"));
      return;
    }
    const backup = Store.readBackup(text);
    if (!backup.ok) {
      toast(t(`restoreErr-${backup.error}`, { key: (backup.key || "").replace(/^(type-todo\.(planner\.)?|quest-log\.)/, "").replace(/\.v\d+$/, "") }));
      return;
    }
    openRestorePreview(backup);
  });
  els.restoreCancel.addEventListener("click", () => els.restoreDialog.close());
  els.restoreDialog.addEventListener("close", () => {
    restoreCandidate = null;
  });
  els.restoreForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!restoreCandidate) return;
    Store.flush();
    // A copy of what's here now, before anything is replaced.
    if (window.desktopStorage?.saveRestorePoint) {
      if (!Store.keepRestorePoint().ok) {
        restoreFailed(t("restoreNoCopy"));
        return;
      }
    } else {
      downloadJSON(JSON.stringify(Store.backupPayload(), null, 2), `lowstate-before-restore-${todayISO()}.json`);
    }
    const result = Store.replaceAll(restoreCandidate.data);
    if (!result.ok) {
      restoreFailed(t("restoreNoRoom"));
      return;
    }
    location.reload();
  });

  // ---------- same data on several computers ----------
  let syncInfo = null;
  let syncConnecting = false;
  const SYNC_KINDS = { google: "syncUseGoogle", icloud: "syncUseIcloud", onedrive: "syncUseOnedrive" };
  const platformName = (platform) => (platform === "win32" ? "Windows" : platform === "darwin" ? "Mac" : platform || "");

  function syncWhen(ms) {
    if (!ms) return t("syncNever");
    const date = new Date(ms);
    const day = Core.toISODate(date) === todayISO() ? "" : `${formatDate(date, { day: "numeric", month: "short" })} `;
    return `${day}${clockTime(date)}`;
  }

  function syncFact(label, value) {
    return h("p", { class: "sync-fact" }, h("span", { class: "sync-label", text: label }), h("span", { text: value }));
  }

  let googleWaiting = false;
  const GOOGLE_CONSOLE = "https://console.cloud.google.com/";

  function googleBlock(info) {
    const google = info.google || {};
    if (googleWaiting) {
      return h("div", { class: "sync-google" },
        h("p", { class: "field-hint", text: t("syncGoogleWaiting") }),
        h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn ghost", "data-sync-google-cancel": "", text: t("cancel") })));
    }
    if (google.configured) {
      return h("div", { class: "sync-google" },
        google.builtIn ? h("p", { class: "field-hint", text: t("syncGoogleBuiltIn") }) : null,
        h("div", { class: "btn-row" },
          h("button", { type: "button", class: "btn primary", "data-sync-google-login": "", text: t("syncGoogleLogin") }),
          google.builtIn ? null : h("button", { type: "button", class: "btn ghost", "data-sync-google-client": "", text: t("syncGoogleOtherFile") })));
    }
    return h("div", { class: "sync-google" },
      h("p", { class: "field-hint", text: t("syncGoogleIntro") }),
      h("details", { class: "sync-steps" },
        h("summary", { text: t("syncGoogleHow") }),
        h("ol", {}, ...t("syncGoogleSteps").split("|").map((step) => h("li", { text: step }))),
        h("button", { type: "button", class: "link-btn sync-console", "data-sync-console": "", text: "console.cloud.google.com ↗" })),
      h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn", "data-sync-google-client": "", text: t("syncGoogleFile") })));
  }

  function renderSync() {
    els.syncRow.hidden = !syncApi;
    if (!syncApi || !syncInfo) return;
    const info = syncInfo;
    if (!info.target) {
      const suggestions = info.suggestions || [];
      // replaceChildren (unlike h) would print a null child as "null".
      els.syncBox.replaceChildren(...[
        h("p", { class: "sync-way", text: t("syncWayGoogle") }),
        googleBlock(info),
        h("p", { class: "sync-way", text: t("syncWayFolder") }),
        suggestions.length ? null : h("p", { class: "field-hint", text: t("syncNoDrive") }),
        h("div", { class: "btn-row" },
          ...suggestions.map((entry) => h("button", { type: "button", class: "btn", "data-sync-use": entry.path, title: entry.path, text: t(SYNC_KINDS[entry.kind] || "syncChoose") })),
          h("button", { type: "button", class: "btn", "data-sync-choose": "", text: t(suggestions.length ? "syncChooseOther" : "syncChoose") })),
        h("p", { class: "field-hint", text: t("syncKept") }),
      ].filter(Boolean));
      return;
    }
    const others = info.others || [];
    const google = info.target.kind === "google";
    els.syncBox.replaceChildren(...[
      google
        ? syncFact(t("syncWhere"), `Google Drive${info.google?.account ? ` · ${info.google.account}` : ""}`)
        : syncFact(t("syncFolder"), info.folder),
      info.state === "auth"
        ? h("p", { class: "sync-warn", text: t("syncGoogleSignedOut") })
        : info.state === "unavailable"
          ? h("p", { class: "sync-warn", text: t(google ? "syncGoogleUnavailable" : "syncUnavailable") })
          : syncFact(t("syncLast"), syncWhen(info.lastSync)),
      others.length
        ? syncFact(t("syncOthers"), others.map((other) => `${other.name}${other.platform ? ` (${platformName(other.platform)})` : ""} · ${syncWhen(other.savedAt)}`).join(", "))
        : h("p", { class: "field-hint", text: t(google ? "syncNoOthersGoogle" : "syncNoOthers") }),
      h("div", { class: "btn-row" },
        info.state === "auth" && google
          ? h("button", { type: "button", class: "btn primary", "data-sync-google-login": "", text: t("syncGoogleLogin") })
          : h("button", { type: "button", class: "btn", "data-sync-now": "", text: t("syncNow") }),
        h("button", { type: "button", class: "btn ghost", "data-sync-stop": "", text: t("syncStop") })),
      h("p", { class: "field-hint", text: t("syncKept") }),
    ].filter(Boolean));
  }

  async function syncCall(call) {
    try {
      syncInfo = await call();
    } catch {
      // Keep the last known state.
    }
    renderSync();
    return syncInfo;
  }

  if (syncApi) {
    syncCall(() => syncApi.get());
    syncApi.onStatus((info) => {
      syncInfo = { ...syncInfo, ...info };
      renderSync();
    });
    // Changes from another computer: in the page's store at once; the page
    // reloads to show them — right away when nobody is looking at it,
    // otherwise when the person chooses.
    syncApi.onIncoming((changes, info) => {
      Store.applyIncoming(changes);
      const from = (info?.others || []).slice().sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0]?.name;
      if (syncConnecting || !document.hasFocus()) {
        location.reload();
        return;
      }
      els.syncAlertText.textContent = t("syncIncoming", { device: from || t("syncOtherComputer") });
      els.syncAlert.hidden = false;
    });
    els.syncReload.addEventListener("click", () => location.reload());
    els.syncBox.addEventListener("click", async (event) => {
      const use = event.target.closest("[data-sync-use]");
      if (use || event.target.closest("[data-sync-choose]")) {
        syncConnecting = true;
        await syncCall(() => (use ? syncApi.use(use.dataset.syncUse) : syncApi.choose()));
        syncConnecting = false;
        if (syncInfo?.target) toast(t("syncConnected"));
      } else if (event.target.closest("[data-sync-google-client]")) {
        const info = await syncCall(() => syncApi.googleClient());
        if (info?.error) toast(t(`syncGoogleErr-${info.error}`));
        else if (!info?.canceled) toast(t("syncGoogleFileOk"));
      } else if (event.target.closest("[data-sync-google-login]")) {
        googleWaiting = true;
        renderSync();
        syncConnecting = true;
        const info = await syncCall(() => syncApi.googleLogin({
          doneTitle: t("syncGoogleDoneTitle"), doneText: t("syncGoogleDoneText"),
          failTitle: t("syncGoogleFailTitle"), failText: t("syncGoogleFailText"),
        }));
        syncConnecting = false;
        googleWaiting = false;
        renderSync();
        if (info?.error) toast(t(`syncGoogleErr-${info.error}`));
        else if (info?.target) toast(t("syncConnected"));
      } else if (event.target.closest("[data-sync-google-cancel]")) {
        await syncApi.googleCancel();
      } else if (event.target.closest("[data-sync-console]")) {
        desktop?.openExternal?.(GOOGLE_CONSOLE);
      } else if (event.target.closest("[data-sync-now]")) {
        await syncCall(() => syncApi.now());
      } else if (event.target.closest("[data-sync-stop]")) {
        await syncCall(() => syncApi.stop());
        toast(t("syncStopped"));
      }
    });
  }

  // ---------- save status ----------
  // A calm but persistent note when data isn't being kept, with a retry and
  // a way to take the data out. Local failures matter most: shown first.
  function renderSaveStatus(status = Store.getStatus()) {
    const local = status.local === "failed";
    const disk = status.desktop === "failed";
    els.saveAlert.hidden = !local && !disk;
    if (els.saveAlert.hidden) return;
    els.saveAlert.classList.toggle("is-local", local);
    els.saveAlertTitle.textContent = t(local ? "saveLocalTitle" : "saveDiskTitle");
    els.saveAlertBody.textContent = t(local ? "saveLocalBody" : "saveDiskBody");
  }
  Store.onStatus(renderSaveStatus);
  els.saveRetry.addEventListener("click", () => {
    const status = Store.retry();
    toast(t(status.local === "failed" || status.desktop === "failed" ? "saveStillFailing" : "saveAllGood"));
  });
  els.saveExport.addEventListener("click", exportBackup);
  // The disk copy waits a moment to group writes; leaving writes it now.
  window.addEventListener("pagehide", () => Store.flush());
  window.addEventListener("beforeunload", () => Store.flush());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") Store.flush();
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
    fitDayNotes();
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

  // Habit cells (habits page) and pills (day page) share one handler.
  document.addEventListener("click", (event) => {
    const ghost = event.target.closest("[data-ghost-source]");
    if (ghost) {
      event.stopPropagation();
      openEditor(ghost.dataset.ghostSource);
      return;
    }
    const option = event.target.closest(".state-menu [data-state]");
    if (option) {
      const menu = option.closest(".state-menu");
      setHabitDay(menu.dataset.habit, menu.dataset.date, option.dataset.state || null);
      closeStateMenu();
      return;
    }
    if (!event.target.closest(".state-menu")) closeStateMenu();
    const cell = event.target.closest("[data-habit-cell]");
    if (cell && !cell.disabled) {
      if (Planner.habitState(state.habitLog, cell.dataset.date, cell.dataset.habitCell)) openStateMenu(cell);
      else setHabitDay(cell.dataset.habitCell, cell.dataset.date, "done");
      return;
    }
    const idea = event.target.closest("[data-habit-idea]");
    if (idea) {
      const preset = habitIdeas().find((candidate) => candidate.name === idea.dataset.habitIdea);
      addHabit(idea.dataset.habitIdea, preset || {});
      return;
    }
    const edit = event.target.closest("[data-habit-edit]");
    if (edit) openHabitDetail(edit.dataset.habitEdit);
  });

  els.habitDialog.addEventListener("click", (event) => {
    if (event.target === els.habitDialog) {
      els.habitDialog.close();
      return;
    }
    const icon = event.target.closest("[data-icon]");
    const day = event.target.closest("[data-day]");
    const color = event.target.closest("[data-color]");
    const remove = event.target.closest("[data-row-remove]");
    if (icon) habitDraft.icon = icon.dataset.icon || null;
    else if (color) habitDraft.color = color.dataset.color;
    else if (day) {
      const value = Number(day.dataset.day);
      const row = habitDraft.rows[Number(day.dataset.row)];
      if (row.days.includes(value)) row.days = row.days.filter((other) => other !== value);
      else {
        // A day can only have one time: picking it here takes it from other rows.
        habitDraft.rows.forEach((other) => { other.days = other.days.filter((candidate) => candidate !== value); });
        row.days = [...row.days, value].sort((a, b) => a - b);
      }
      renderHabitRows();
      return;
    } else if (remove) {
      habitDraft.rows.splice(Number(remove.dataset.rowRemove), 1);
      renderHabitRows();
      return;
    } else return;
    renderHabitEditor();
  });

  els.habitEditForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = els.habitEditName.value.trim().slice(0, 60) || habitDraft.name;
    const { rows, ...draft } = habitDraft;
    const saved = { ...draft, ...Planner.habitFromRows(rows) };
    state.habits = Planner.normalizeHabits(state.habits.map((habit) => (habit.id === habitDraft.id ? { ...saved, name } : habit)));
    persistHabits();
    els.habitDialog.close();
    render();
  });
  els.habitEditCancel.addEventListener("click", () => els.habitDialog.close());
  els.habitDetailClose.addEventListener("click", () => els.habitDetail.close());
  els.habitDetailEdit.addEventListener("click", () => {
    els.habitDetail.close();
    openHabitEditor(detailHabitId);
  });
  els.habitDetail.addEventListener("click", (event) => {
    if (event.target === els.habitDetail) els.habitDetail.close();
  });
  // Times are typed or stepped in a time field; the row isn't redrawn while
  // typing, only the duration next to it is switched on or off.
  els.habitRows.addEventListener("input", (event) => {
    const start = event.target.closest("[data-row-start]");
    if (!start) return;
    const row = habitDraft.rows[Number(start.dataset.rowStart)];
    row.start = Planner.isTime(start.value) ? start.value : null;
    const duration = els.habitRows.querySelector(`[data-row-duration="${start.dataset.rowStart}"]`);
    duration.disabled = !row.start;
    if (row.start && !duration.value) duration.value = String(row.duration || 60);
  });
  els.habitRows.addEventListener("change", (event) => {
    const duration = event.target.closest("[data-row-duration]");
    if (duration) habitDraft.rows[Number(duration.dataset.rowDuration)].duration = Number(duration.value) || 60;
  });
  els.habitSince.addEventListener("change", () => {
    habitDraft.since = els.habitSince.value || todayISO();
    if (habitDraft.until && habitDraft.until < habitDraft.since) habitDraft.until = null;
    renderHabitEditor();
  });
  els.habitUntil.addEventListener("change", () => {
    habitDraft.until = els.habitUntil.value || null;
    renderHabitEditor();
  });
  // Ending keeps the history; reactivating just clears the end date.
  els.habitEndToggle.addEventListener("click", () => {
    habitDraft.until = habitDraft.until ? null : todayISO();
    if (habitDraft.since && habitDraft.until && habitDraft.until < habitDraft.since) habitDraft.since = habitDraft.until;
    renderHabitEditor();
  });
  els.habitAddRow.addEventListener("click", () => {
    habitDraft.rows.push({ days: [], start: null, duration: 60 });
    renderHabitRows();
  });
  els.habitEditDelete.addEventListener("click", () => {
    const habit = habitDraft;
    if (!habit || !window.confirm(t("habitRemoveConfirm", { name: habit.name }))) return;
    state.habits = state.habits.filter((candidate) => candidate.id !== habit.id);
    state.habitLog = Planner.forgetHabit(state.habitLog, habit.id);
    persistHabits();
    els.habitDialog.close();
    render();
  });

  // ---------- brain dump ----------
  function renderDump() {
    els.dumpSortTitle.textContent = state.dump.length ? t("dumpSortTitleN", { n: state.dump.length }) : t("dumpSortTitle");
    els.dumpAllInbox.hidden = state.dump.length < 2;
    els.dumpEmpty.hidden = state.dump.length > 0;
    els.dumpList.replaceChildren(...state.dump.map((note) => h("li", { class: "dump-note", "data-dump": note.id },
      h("span", { class: "dump-when", text: shortDate(Core.toISODate(new Date(note.createdAt))) }),
      h("span", { class: "dump-text", text: note.text }),
      h("span", { class: "dump-actions" },
        ...[["today", "dumpToday"], ["tomorrow", "dumpTomorrow"], ["inbox", "dumpInbox"], ["note", "dumpNote"], ["shop", "dumpShop"]].map(([action, key]) => h("button", {
          type: "button",
          class: "dump-action",
          "data-dump-action": action,
          text: t(key),
        })),
        h("button", { type: "button", class: "dump-action discard", "data-dump-action": "discard", title: t("dumpDiscard"), "aria-label": t("dumpDiscard"), text: "×" })))));
  }

  function openDump() {
    document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
    setView("dump");
    els.dumpInput.focus();
  }

  // ---------- shopping list ----------
  function renderShopping() {
    const { items } = state.shopping;
    const done = items.filter((item) => item.done).length;
    els.shopProgress.textContent = items.length ? t("shopInCart", { done, total: items.length }) : "";
    els.shopClear.hidden = done === 0;
    els.shopEmpty.hidden = items.length > 0;
    els.shopGroups.replaceChildren(...Planner.shoppingGroups(state.shopping).map((group) => h("section", { class: "shop-group", "data-section": group.section },
      h("h2", { class: "section-title", text: t(`shop-${group.section}`) }),
      h("ul", { class: "shop-items" }, group.items.map((item) => h("li", { class: `shop-item${item.done ? " is-done" : ""}`, "data-shop": item.id },
        checkButton(item.done, { "data-shop-toggle": item.id }),
        h("span", { class: "shop-name" }, item.qty ? h("span", { class: "shop-qty", text: item.qty }) : null, item.name),
        h("button", { type: "button", class: "shop-section", "data-shop-section": item.id, title: t("shopMove", { name: item.name }), "aria-label": t("shopMove", { name: item.name }), text: t(`shop-${item.section}`) }),
        h("button", { type: "button", class: "module-hide shop-remove", "data-shop-remove": item.id, title: t("shopRemove", { name: item.name }), "aria-label": t("shopRemove", { name: item.name }), text: "×" })))))));

    const again = Planner.frequentShopping(state.shopping);
    els.shopAgainEmpty.hidden = again.length > 0;
    els.shopAgain.replaceChildren(...again.map((entry) => h("span", { class: "shop-chip" },
      h("button", { type: "button", class: "shop-chip-add", "data-shop-again": entry.name, text: `+ ${entry.name}` }),
      h("button", { type: "button", class: "shop-chip-forget", "data-shop-forget": entry.key, title: t("shopForget", { name: entry.name }), "aria-label": t("shopForget", { name: entry.name }), text: "×" }))));

    const reminders = Boolean(desktop?.sendToReminders);
    els.shopReminders.hidden = !reminders;
    els.shopSendHint.textContent = reminders ? t("shopRemindersHint", { list: t("shopRemindersList") }) : "";
  }

  function setShopping(next) {
    state.shopping = next;
    persistShopping();
    renderShopping();
    renderSidebar();
  }

  const pendingShopping = () => state.shopping.items.filter((item) => !item.done);
  const shoppingLine = (item) => (item.qty ? `${item.qty} ${item.name}` : item.name);

  els.shopForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!Planner.parseShoppingText(els.shopInput.value).length) return;
    setShopping(Planner.addShopping(state.shopping, els.shopInput.value));
    els.shopInput.value = "";
    els.shopInput.focus();
  });

  // Aisle choices, in the same small menu as the habit states.
  function openShopSectionMenu(button) {
    closeStateMenu();
    const item = state.shopping.items.find((candidate) => candidate.id === button.dataset.shopSection);
    if (!item) return;
    const menu = h("div", { class: "state-menu shop-menu", role: "menu" },
      ...Planner.SHOPPING_SECTIONS.map((section) => h("button", {
        type: "button",
        role: "menuitemradio",
        "aria-checked": String(item.section === section),
        class: `state-option${item.section === section ? " active" : ""}`,
        "data-shop-move": section,
        "data-shop-id": item.id,
      }, t(`shop-${section}`))));
    document.body.append(menu);
    const rect = button.getBoundingClientRect();
    const below = rect.bottom + 6 + menu.offsetHeight < innerHeight;
    menu.style.left = `${Math.min(Math.max(8, rect.left), innerWidth - menu.offsetWidth - 8)}px`;
    menu.style.top = `${below ? rect.bottom + 6 : Math.max(8, rect.top - menu.offsetHeight - 6)}px`;
    menu.querySelector(".state-option.active, .state-option")?.focus();
  }

  document.addEventListener("click", (event) => {
    const move = event.target.closest("[data-shop-move]");
    if (move) {
      closeStateMenu();
      setShopping(Planner.updateShoppingItem(state.shopping, move.dataset.shopId, { section: move.dataset.shopMove }));
      return;
    }
    if (!event.target.closest("#shoppingView")) return;
    const toggle = event.target.closest("[data-shop-toggle]");
    const section = event.target.closest("[data-shop-section]");
    const remove = event.target.closest("[data-shop-remove]");
    const again = event.target.closest("[data-shop-again]");
    const forget = event.target.closest("[data-shop-forget]");
    if (toggle) setShopping(Planner.toggleShopping(state.shopping, toggle.dataset.shopToggle));
    else if (section) openShopSectionMenu(section);
    else if (remove) {
      const before = state.shopping;
      const item = before.items.find((candidate) => candidate.id === remove.dataset.shopRemove);
      setShopping(Planner.removeShopping(state.shopping, remove.dataset.shopRemove));
      toast(t("shopRemoved", { name: item?.name || "" }), t("undo"), () => setShopping(before));
    } else if (again) setShopping(Planner.addShopping(state.shopping, again.dataset.shopAgain));
    else if (forget) setShopping(Planner.forgetShopping(state.shopping, forget.dataset.shopForget));
  });

  els.shopClear.addEventListener("click", () => {
    const before = state.shopping;
    const n = before.items.filter((item) => item.done).length;
    setShopping(Planner.clearBought(state.shopping));
    toast(t("shopCleared", { n }), t("undo"), () => setShopping(before));
  });

  els.shopCopy.addEventListener("click", async () => {
    if (!pendingShopping().length) {
      toast(t("shopNothingToSend"));
      return;
    }
    try {
      await navigator.clipboard.writeText(Planner.shoppingText(state.shopping, (section) => t(`shop-${section}`)));
      toast(t("shopCopied"));
    } catch {
      toast(t("shopCopyFailed"));
    }
  });

  els.shopReminders.addEventListener("click", async () => {
    const items = pendingShopping();
    if (!items.length) {
      toast(t("shopNothingToSend"));
      return;
    }
    const list = t("shopRemindersList");
    els.shopReminders.disabled = true;
    const result = await desktop.sendToReminders(list, items.map(shoppingLine)).catch(() => ({ ok: false, error: "failed" }));
    els.shopReminders.disabled = false;
    if (result?.ok) toast(result.added ? t("shopRemindersDone", { n: result.added, list }) : t("shopRemindersNone", { list }));
    else toast(t(result?.error === "denied" ? "shopRemindersDenied" : "shopRemindersFailed"));
  });

  // ---------- meeting details ----------
  // Clicking a meeting shows what the calendar knows about it, with a way
  // to join the call and to turn it into a task for the day.
  function closeEventCard() {
    document.querySelectorAll(".event-card").forEach((card) => card.remove());
  }

  function openEventCard(target) {
    closeEventCard();
    const event = state.events.find((candidate) => candidate.id === target.dataset.event);
    const iso = target.dataset.eventDay;
    if (!event || !Core.parseISODate(iso)) return;
    const calendar = calendarById(event.calendarId);
    const day = capitalize(formatDate(Core.parseISODate(iso), { weekday: "long", day: "numeric", month: "long" }));
    const card = h("div", {
      class: "event-card",
      role: "dialog",
      "aria-label": eventTitle(event),
      "data-event-id": event.id,
      "data-event-day": iso,
      style: calendar ? `--cat: ${calendar.color}` : null,
    },
      calendar ? h("span", { class: "event-card-cal" }, h("i", { "aria-hidden": "true" }), calendar.name) : null,
      h("h3", { class: "event-card-title", text: eventTitle(event) }),
      h("p", { class: "event-card-when", text: `${day} · ${eventRange(event)}` }),
      event.location ? h("p", { class: "event-card-where", text: event.location }) : null,
      event.description ? h("p", { class: "event-card-notes", text: event.description }) : null,
      h("div", { class: "event-card-actions" },
        event.link ? h("button", { type: "button", class: "btn", "data-event-join": event.link, text: t("eventJoin") }) : null,
        h("button", { type: "button", class: "btn primary", "data-event-task": "", text: t("eventPrep") })));
    (target.closest("dialog") || document.body).append(card);
    const rect = target.getBoundingClientRect();
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    // Beside a timeline block (it can be tall), under or over anything else.
    const beside = target.classList.contains("block") && rect.right + 10 + width < innerWidth;
    const left = beside ? rect.right + 10 : Math.min(Math.max(8, rect.left), innerWidth - width - 8);
    const top = beside
      ? Math.min(Math.max(8, rect.top), innerHeight - height - 8)
      : rect.bottom + 6 + height < innerHeight ? rect.bottom + 6 : Math.max(8, rect.top - height - 6);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.querySelector("[data-event-task]").focus();
  }

  function openMeeting(url) {
    if (desktop?.openMeeting) desktop.openMeeting(url);
    else window.open(url, "_blank", "noopener");
  }

  // "Prepare: …" as a must-do on the meeting's day, straight into the editor.
  function taskFromEvent(card) {
    const event = state.events.find((candidate) => candidate.id === card.dataset.eventId);
    closeEventCard();
    if (!event) return;
    const item = addItem({ title: t("eventPrepTitle", { title: eventTitle(event) }).slice(0, 200), date: card.dataset.eventDay, focus: "must" });
    openEditor(item.id);
  }

  document.addEventListener("click", (event) => {
    const card = event.target.closest(".event-card");
    if (card) {
      const join = event.target.closest("[data-event-join]");
      if (join) {
        openMeeting(join.dataset.eventJoin);
        closeEventCard();
      } else if (event.target.closest("[data-event-task]")) {
        taskFromEvent(card);
      }
      return;
    }
    const target = event.target.closest("[data-event]");
    if (target) openEventCard(target);
    else closeEventCard();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.querySelector(".event-card")) {
      event.stopPropagation();
      event.preventDefault();
      const opener = document.querySelector(`[data-event="${CSS.escape(document.querySelector(".event-card").dataset.eventId)}"]`);
      closeEventCard();
      opener?.focus();
    }
  }, true);
  document.addEventListener("scroll", (event) => {
    if (!event.target.closest?.(".event-card")) closeEventCard();
  }, true);
  window.addEventListener("resize", closeEventCard);

  // ---------- search ----------
  const SEARCH_LABELS = {
    task: "searchTasks", habit: "searchHabits", shopping: "searchShopping", dump: "viewDump", dayNote: "searchDayNotes",
    closure: "searchClosures", mood: "searchMoods", weekNote: "searchWeekNotes",
  };
  let searchResults = [];
  let searchIndex = 0;

  function searchDate(iso) {
    const date = Core.parseISODate(iso);
    if (!date) return "";
    const options = { day: "numeric", month: "short" };
    if (date.getFullYear() !== new Date().getFullYear()) options.year = "numeric";
    return formatDate(date, options);
  }

  function runSearch() {
    searchResults = Planner.search({
      items: state.items, habits: state.habits, shopping: state.shopping, dump: state.dump, dayNotes: state.dayNotes,
      closures: state.closures, moodNotes: state.moodNotes, weekNotes: state.notes,
    }, els.searchInput.value);
    searchIndex = 0;
    renderSearch();
  }

  function renderSearch() {
    const query = els.searchInput.value.trim();
    if (!query || !searchResults.length) {
      els.searchResults.replaceChildren(h("p", { class: "search-hint", text: query ? t("searchNone", { q: query }) : t("searchHint") }));
      return;
    }
    const nodes = [];
    searchResults.forEach((result, index) => {
      if (result.kind !== searchResults[index - 1]?.kind) nodes.push(h("h3", { class: "search-group", text: t(SEARCH_LABELS[result.kind]) }));
      const meta = result.kind === "weekNote" ? t("searchWeekOf", { date: searchDate(result.date) })
        : result.kind === "task" && !result.date ? t("dumpInbox")
          : result.kind === "habit" || result.kind === "shopping" ? "" : searchDate(result.date);
      const active = index === searchIndex;
      nodes.push(h("button", {
        type: "button", role: "option", "aria-selected": String(active), "data-index": index,
        class: `search-result${active ? " active" : ""}${result.done ? " is-done" : ""}`,
      },
      h("span", { class: "search-text" },
        h("span", { class: "search-title", text: result.title }),
        result.snippet ? h("span", { class: "search-snippet", text: result.snippet }) : null),
      meta ? h("span", { class: "search-meta", text: meta }) : null));
    });
    nodes.push(h("p", { class: "search-keys", text: t("searchKeys") }));
    els.searchResults.replaceChildren(...nodes);
    els.searchResults.querySelector(".active")?.scrollIntoView({ block: "nearest" });
  }

  function openSearch() {
    if (document.querySelector("dialog[open]:not(#searchDialog)")) return;
    els.searchInput.value = "";
    runSearch();
    if (!els.searchDialog.open) els.searchDialog.showModal();
    els.searchInput.focus();
  }

  // Draws the eye to where the result lives.
  function flash(node) {
    if (!node || node.hidden) return;
    node.scrollIntoView({ block: "center", behavior: "smooth" });
    node.classList.remove("search-flash");
    void node.offsetWidth;
    node.classList.add("search-flash");
    node.addEventListener("animationend", () => node.classList.remove("search-flash"), { once: true });
  }

  function pickResult(result) {
    if (!result) return;
    els.searchDialog.close();
    if (result.kind === "task") {
      if (result.date) openDay(result.date);
      openEditor(result.id);
    } else if (result.kind === "habit") {
      setView("habits");
      openHabitDetail(result.id);
    } else if (result.kind === "shopping") {
      setView("shopping");
      flash(els.shopGroups.querySelector(`[data-shop="${CSS.escape(result.id)}"]`));
    } else if (result.kind === "dump") {
      setView("dump");
      flash(els.dumpList.querySelector(`[data-dump="${CSS.escape(result.id)}"]`));
    } else if (result.kind === "weekNote") {
      state.anchor = Core.parseISODate(result.date);
      setView("week");
      flash(els.weekNotes);
    } else {
      openDay(result.date);
      flash({ dayNote: els.dayNotes, mood: els.moodReason, closure: els.closedLine }[result.kind]);
    }
  }

  els.searchBtn.addEventListener("click", openSearch);
  els.searchInput.addEventListener("input", runSearch);
  els.searchInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!searchResults.length) return;
      searchIndex = (searchIndex + (event.key === "ArrowDown" ? 1 : -1) + searchResults.length) % searchResults.length;
      renderSearch();
    } else if (event.key === "Enter") {
      event.preventDefault();
      pickResult(searchResults[searchIndex]);
    }
  });
  els.searchResults.addEventListener("click", (event) => {
    const button = event.target.closest("[data-index]");
    if (button) pickResult(searchResults[Number(button.dataset.index)]);
  });
  els.searchDialog.addEventListener("click", (event) => {
    if (event.target === els.searchDialog) els.searchDialog.close();
  });
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (els.searchDialog.open) els.searchDialog.close();
      else openSearch();
    }
  });

  // Sorting a thought: a task (today / tomorrow / to schedule, with the
  // usual #tag, !urgent and time syntax), a line in today's notes, or gone.
  function sortDumpNote(id, action) {
    const note = state.dump.find((candidate) => candidate.id === id);
    if (!note) return;
    const index = state.dump.indexOf(note);
    state.dump = state.dump.filter((candidate) => candidate.id !== id);
    persistDump();
    const today = todayISO();
    if (action === "today" || action === "tomorrow" || action === "inbox") {
      const date = action === "today" ? today : action === "tomorrow" ? Core.toISODate(Planner.addDays(Core.parseISODate(today), 1)) : null;
      const parsed = Planner.parseCapture(note.text);
      capture(note.text, parsed.date ? null : date);
    } else if (action === "shop") {
      state.shopping = Planner.addShopping(state.shopping, note.text);
      persistShopping();
      render();
    } else if (action === "note") {
      const current = state.dayNotes[today] || "";
      state.dayNotes = { ...state.dayNotes, [today]: `${current}${current && !current.endsWith("\n") ? "\n" : ""}• ${note.text}` };
      persistDayNotes();
      dayNotesKey = null;
      render();
    } else {
      render();
      toast(t("dumpDiscarded"), t("undo"), () => {
        const list = [...state.dump];
        list.splice(Math.min(index, list.length), 0, note);
        state.dump = list;
        persistDump();
        render();
        render();
      });
    }
    renderDump();
  }

  els.dumpList.addEventListener("click", (event) => {
    const action = event.target.closest("[data-dump-action]");
    if (action) sortDumpNote(action.closest("[data-dump]").dataset.dump, action.dataset.dumpAction);
  });
  els.dumpForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const lines = Planner.parseDump(els.dumpInput.value);
    if (!lines.length) return;
    const now = Date.now();
    state.dump = [...state.dump, ...lines.map((text, index) => ({ id: Planner.newId(), text, createdAt: now + index }))];
    persistDump();
    els.dumpInput.value = "";
    render();
    toast(lines.length === 1 ? t("dumpSavedOne") : t("dumpSaved", { n: lines.length }));
    els.dumpInput.focus();
  });
  els.dumpInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      els.dumpForm.requestSubmit();
    }
  });
  els.dumpAllInbox.addEventListener("click", () => {
    [...state.dump].forEach((note) => sortDumpNote(note.id, "inbox"));
  });

  // ---------- closing the day ----------
  // Offered for today and yesterday (closing late counts too).
  function renderClosure(iso) {
    const closed = state.closures[iso];
    const yesterday = Core.toISODate(Planner.addDays(Core.parseISODate(todayISO()), -1));
    els.closeDayBtn.hidden = Boolean(closed) || (iso !== todayISO() && iso !== yesterday);
    els.closedLine.hidden = !closed;
    if (closed) {
      els.closedLine.replaceChildren(
        h("span", { class: "closed-mark", text: `✓ ${t("closedLine")}` }),
        closed.good ? h("span", { class: "closed-good", text: `“${closed.good}”` }) : null,
        h("button", { type: "button", class: "focus-action", id: "reopenClosure", text: t("closedReopen") }));
    }
  }

  function closureRecap(iso) {
    const items = Planner.itemsForDay(state.items, iso).filter((item) => item.focus !== "later");
    const parts = [];
    if (items.length) parts.push(t("closeRecapTasks", { done: items.filter((item) => item.done).length, total: items.length }));
    const habits = state.habits.filter((habit) => Planner.habitDone(state.habitLog, iso, habit.id)).length;
    if (habits) parts.push(habits === 1 ? t("closeRecapHabit") : t("closeRecapHabits", { n: habits }));
    if (state.water[iso]) parts.push(Planner.formatVolume(state.water[iso] * state.settings.glassMl, I18n.language));
    if (state.moods[iso]) parts.push(t("closeRecapMood", { mood: t(`mood-${state.moods[iso]}`).toLowerCase() }));
    return parts.join(" · ");
  }

  let closureISO = null;

  function openClosure(iso = anchorISO()) {
    closureISO = iso;
    const left = state.items.filter((item) => item.date === iso && !item.done).length;
    els.closureRecap.textContent = closureRecap(iso);
    els.closureRecap.hidden = !els.closureRecap.textContent;
    els.closureGood.value = state.closures[iso]?.good || "";
    els.closureLeft.hidden = left === 0;
    els.closureCount.textContent = left ? `· ${t("closeLeftCount", { n: left })}` : "";
    els.closureForm.querySelector('input[value="tomorrow"]').checked = true;
    els.closureDialog.showModal();
    els.closureGood.focus();
  }

  els.closeDayBtn.addEventListener("click", () => openClosure());
  els.closedLine.addEventListener("click", (event) => {
    if (event.target.closest("#reopenClosure")) openClosure();
  });
  els.closureCancel.addEventListener("click", () => els.closureDialog.close());
  els.closureDialog.addEventListener("click", (event) => {
    if (event.target === els.closureDialog) els.closureDialog.close();
  });
  els.closureForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const iso = closureISO || anchorISO();
    const choice = els.closureForm.querySelector('input[name="closureChoice"]:checked')?.value || "stay";
    const tomorrow = Core.toISODate(Planner.addDays(Core.parseISODate(iso), 1));
    if (!els.closureLeft.hidden) state.items = Planner.closeDay(state.items, iso, choice, tomorrow);
    state.closures = { ...state.closures, [iso]: { good: els.closureGood.value.trim().slice(0, 500), closedAt: Date.now() } };
    Store.save(KEYS.closures, state.closures);
    els.closureDialog.close();
    commit();
    toast(t("closeDone"));
  });

  // ---------- gentle habit states ----------
  function setHabitDay(habitId, iso, value) {
    state.habitLog = Planner.setHabitState(state.habitLog, iso, habitId, value);
    persistHabits();
    render();
    if (els.habitDetail.open) renderHabitDetail();
    if (value === "little") toast(t("littleCounts"));
    else if (value === "rest") toast(t("restCounts"));
  }

  // A small menu next to a marked day: done / a little / rest / clear.
  function openStateMenu(cell) {
    closeStateMenu();
    const habitId = cell.dataset.habitCell;
    const iso = cell.dataset.date;
    const current = Planner.habitState(state.habitLog, iso, habitId);
    const habit = state.habits.find((candidate) => candidate.id === habitId);
    const menu = h("div", { class: "state-menu", role: "menu", "data-habit": habitId, "data-date": iso, style: `--habit: ${habit?.color || "var(--ink)"}` },
      ...Planner.HABIT_STATES.map((value) => h("button", {
        type: "button",
        role: "menuitemradio",
        "aria-checked": String(current === value),
        class: `state-option${current === value ? " active" : ""}`,
        "data-state": value,
      }, h("i", { class: `state-dot is-${value}`, "aria-hidden": "true" }),
        h("span", { class: "state-text" }, h("strong", { text: t(STATE_LABELS[value]) }), h("small", { text: t(`${STATE_LABELS[value]}Hint`) })))),
      h("button", { type: "button", role: "menuitem", class: "state-option clear", "data-state": "" }, t("stateClear")));
    // Inside a modal dialog the menu has to live in the dialog to be seen.
    (cell.closest("dialog") || document.body).append(menu);
    const rect = cell.getBoundingClientRect();
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - menu.offsetWidth / 2), innerWidth - menu.offsetWidth - 8);
    const below = rect.bottom + 6 + menu.offsetHeight < innerHeight;
    menu.style.left = `${left}px`;
    menu.style.top = `${below ? rect.bottom + 6 : rect.top - menu.offsetHeight - 6}px`;
    menu.querySelector(".state-option.active, .state-option")?.focus();
  }

  function closeStateMenu() {
    document.querySelectorAll(".state-menu").forEach((menu) => menu.remove());
  }

  // Right-click (or the context-menu key) opens the choices on any day.
  document.addEventListener("contextmenu", (event) => {
    const cell = event.target.closest("[data-habit-cell]");
    if (!cell || cell.disabled) return;
    event.preventDefault();
    openStateMenu(cell);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.querySelector(".state-menu")) {
      event.stopPropagation();
      closeStateMenu();
    }
  }, true);

  els.habitForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addHabit(els.habitInput.value);
    els.habitInput.value = "";
    els.habitInput.focus();
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

  // "+" on a group: a one-line field that adds straight into that group.
  function openFocusCapture(focus) {
    els.dayTasks.querySelector(".focus-capture")?.remove();
    const group = els.dayTasks.querySelector(`.focus-group[data-focus="${focus}"]`);
    if (!group) return;
    const input = h("input", { maxlength: "200", autocomplete: "off", placeholder: t("addToGroup", { group: t(FOCUS_LABELS[focus]) }), "aria-label": t("addToGroup", { group: t(FOCUS_LABELS[focus]) }) });
    const form = h("form", { class: "focus-capture", "data-focus": focus }, input);
    group.querySelector(".day-items").after(form);
    group.querySelector(".focus-hint")?.remove();
    input.focus();
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") form.remove();
    });
    input.addEventListener("blur", () => setTimeout(() => { if (!input.value.trim()) form.remove(); }, 150));
  }

  els.dayTasks.addEventListener("submit", (event) => {
    const form = event.target.closest(".focus-capture");
    if (!form) return;
    event.preventDefault();
    const focus = form.dataset.focus;
    const item = capture(form.querySelector("input").value, anchorISO());
    if (!item) return;
    state.items = state.items.map((other) => (other.id === item.id ? { ...other, focus } : other));
    commit();
    openFocusCapture(focus); // ready for the next one
  });

  els.dayTasks.addEventListener("click", (event) => {
    const add = event.target.closest("[data-focus-add]");
    if (add) {
      openFocusCapture(add.dataset.focusAdd);
      return;
    }
    const move = event.target.closest("[data-move-focus]");
    if (move) {
      const id = move.closest(".item").dataset.id;
      state.items = Planner.moveItem(state.items, id, { date: anchorISO(), focus: move.dataset.moveFocus });
      commit();
      return;
    }
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

  wireCapturePreview(els.dayCaptureInput, els.dayCapturePreview, () => anchorISO());
  wireCapturePreview(els.inboxInput, els.inboxCapturePreview, () => null);
  els.focusHelpBtn.addEventListener("click", () => {
    els.focusHelp.hidden = !els.focusHelp.hidden;
    els.focusHelpBtn.setAttribute("aria-expanded", String(!els.focusHelp.hidden));
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
    if (event.target.closest("[data-action], .month-tabs, [data-ghost-source], [data-event], .event-card")) return;
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
    const eventTarget = event.target.closest?.("[data-event]");
    if (eventTarget && (event.key === "Enter" || event.key === " ") && !event.target.closest(".event-card")) {
      event.preventDefault();
      openEventCard(eventTarget);
      return;
    }
    if (event.target.matches?.(".item-body") && event.target.closest(".item") && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openEditor(event.target.closest(".item").dataset.id);
      return;
    }
    if (document.querySelector("dialog[open]") || event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTyping(event.target)) {
      if (event.key === "Escape") event.target.blur();
      return;
    }
    const views = { 1: "day", 2: "week", 3: "month", 4: "habits", 5: "dump", 6: "shopping" };
    if (views[event.key]) setView(views[event.key]);
    else if (event.key === "n" || event.key === "N") {
      event.preventDefault();
      (state.view === "day" ? els.dayCaptureInput : els.inboxInput).focus();
    } else if (event.key === "t" || event.key === "T") goToday();
    else if (event.key === "b" || event.key === "B") openDump();
    else if (event.key === "/") {
      event.preventDefault();
      openSearch();
    }
    else if (state.view !== "dump" && state.view !== "shopping" && event.key === "ArrowLeft") shift(-1);
    else if (state.view !== "dump" && state.view !== "shopping" && event.key === "ArrowRight") shift(1);
  });

  // ---------- moving a timeline block by keyboard ----------
  // Alt+↑/↓ moves a task 15 minutes; Alt+Shift+↑/↓ changes its duration.
  els.timeline.addEventListener("keydown", (event) => {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    const block = event.target.closest(".block.item[data-id]");
    const item = findItem(block?.dataset.id);
    if (!item?.start) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.key === "ArrowUp" ? -15 : 15;
    const start = Planner.timeToMinutes(item.start);
    const duration = item.duration || 60;
    const next = event.shiftKey
      ? { ...item, duration: Math.min(1440 - start, Math.max(15, duration + step)) }
      : { ...item, start: Planner.minutesToTime(Math.min(1440 - Math.min(duration, 15), Math.max(0, start + step))) };
    if (next.start === item.start && next.duration === item.duration) return;
    updateItem(next);
    toast(`${item.title} · ${timeRange(next)}`);
  });

  // ---------- resizing a timeline block ----------
  // Dragging a task block's bottom edge changes its duration in 15-minute
  // steps; the change is saved when the pointer is released.
  let resizing = null;

  els.timeline.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest(".block-resize");
    if (!handle || event.button !== 0) return;
    const block = handle.closest(".block");
    const item = findItem(block?.dataset.id);
    if (!item?.start) return;
    event.preventDefault();
    block.draggable = false;
    block.classList.add("is-resizing");
    const duration = item.duration || 60;
    resizing = {
      id: item.id, block, duration, next: duration,
      y: event.clientY, hour: timelineHourHeight(), startMin: Planner.timeToMinutes(item.start),
    };
    document.body.classList.add("is-resizing");
  });

  window.addEventListener("pointermove", (event) => {
    if (!resizing) return;
    const { block, duration, hour, startMin } = resizing;
    const delta = ((event.clientY - resizing.y) / hour) * 60;
    const next = Math.min(1440 - startMin, Math.max(15, Math.round((duration + delta) / 15) * 15));
    if (next === resizing.next) return;
    resizing.next = next;
    const height = Math.max((next / 60) * hour - 2, 20);
    block.style.setProperty("--h", `${height}px`);
    block.style.setProperty("--lines", String(Math.max(1, Math.floor((height - 19) / 16))));
    block.classList.toggle("short", height < 34);
    const time = block.querySelector(".block-time");
    if (time) time.textContent = `${Planner.minutesToTime(startMin)}–${Planner.minutesToTime(Math.min(1439, startMin + next))}`;
  });

  function endResize() {
    if (!resizing) return;
    const { id, block, duration, next } = resizing;
    resizing = null;
    document.body.classList.remove("is-resizing");
    block.draggable = true;
    block.classList.remove("is-resizing");
    const item = findItem(id);
    if (item && next !== duration) updateItem({ ...item, duration: next });
  }
  window.addEventListener("pointerup", endResize);
  window.addEventListener("pointercancel", endResize);

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

  // ---------- reminders (desktop notifications) ----------
  // Shown keys live outside the app's data (not backed up) so a restart
  // doesn't repeat a reminder; entries older than two days are dropped.
  const NOTIFIED_KEY = "lowstate.notified";
  let notified = {};
  try {
    notified = JSON.parse(localStorage.getItem(NOTIFIED_KEY) || "{}") || {};
  } catch {
    notified = {};
  }
  const saveNotified = () => {
    const cutoff = Date.now() - 2 * 86400000;
    notified = Object.fromEntries(Object.entries(notified).filter(([, at]) => at > cutoff));
    try {
      localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified));
    } catch {
      // Private mode or full storage: reminders may repeat after a restart.
    }
  };

  function renderNotifySettings() {
    els.notifyWebNote.textContent = t("notifyDesktopOnly");
    els.notifyKinds.querySelectorAll("[data-notify-kind]").forEach((chip) => {
      const on = state.settings.notifyKinds[chip.dataset.notifyKind] !== false;
      chip.classList.toggle("active", on);
      chip.setAttribute("aria-pressed", String(on));
    });
    if (document.activeElement !== els.morningAt) els.morningAt.value = state.settings.morningAt;
    if (document.activeElement !== els.closureAt) els.closureAt.value = state.settings.closureAt;
    els.notifyTest.disabled = !desktop?.notify;
  }

  // "3 meetings (first at 10:00) · Gym at 18:00 · 2 must-do"
  function morningBody(iso) {
    const parts = [];
    const meetings = Planner.eventsForDay(state.events, iso).timed;
    if (meetings.length === 1) parts.push(t("morningMeeting", { time: clockTime(new Date(meetings[0].start)) }));
    else if (meetings.length > 1) parts.push(t("morningMeetings", { n: meetings.length, time: clockTime(new Date(meetings[0].start)) }));
    state.habits.forEach((habit) => {
      const time = Planner.habitTimeOn(habit, iso);
      if (time) parts.push(t("morningHabit", { name: habit.name, time: time.start }));
    });
    const must = Planner.itemsForDay(state.items, iso).filter((item) => item.focus === "must" && !item.done).length;
    if (must) parts.push(t("morningMust", { n: must }));
    const overdue = Planner.overdueItems(state.items, iso).length;
    if (overdue) parts.push(t("morningOverdue", { n: overdue }));
    return parts.length ? parts.join(" · ") : t("morningEmpty");
  }

  // Snoozed reminders come back ten minutes later ({ key: when }), unless
  // the task was done or the habit checked in the meantime.
  const SNOOZE_MS = 10 * 60000;
  const snoozed = {};
  function snoozeReminder(key) {
    snoozed[key] = Date.now() + SNOOZE_MS;
    toast(t("snoozed"));
  }

  function currentReminders(now = Date.now()) {
    return Planner.reminders({
      items: state.items,
      habits: state.habits,
      habitLog: state.habitLog,
      events: state.events,
      now: new Date(now),
      lead: state.settings.notifyLead,
      kinds: state.settings.notifyKinds,
      morningAt: state.settings.morningOn ? state.settings.morningAt : null,
      closureAt: state.settings.closureOn && !state.closures[todayISO()] ? state.settings.closureAt : null,
    });
  }

  // Checked every 30 seconds: anything whose moment has come in the last ten
  // minutes and wasn't shown yet becomes a notification. Older ones (the
  // computer was asleep) are skipped rather than delivered late.
  function checkReminders() {
    if (!desktop?.notify || !state.settings.notifyOn) return;
    const now = Date.now();
    const all = currentReminders(now);
    const due = all.filter((reminder) => reminder.at <= now && now - reminder.at < 10 * 60000 && !notified[reminder.key]);
    Object.entries(snoozed).forEach(([key, at]) => {
      if (at > now) return;
      delete snoozed[key];
      const reminder = all.find((candidate) => candidate.key === key);
      if (reminder && !due.includes(reminder)) due.push(reminder);
    });
    if (!due.length) return;
    due.forEach((reminder) => {
      notified[reminder.key] = now;
      if (reminder.kind === "closure") {
        desktop.notify({ title: t("closeDay"), body: t("closeNotifyBody"), iso: reminder.iso, action: "closure" });
        return;
      }
      if (reminder.kind === "morning") {
        desktop.notify({ title: t("morningTitle"), body: morningBody(reminder.iso), iso: reminder.iso });
        return;
      }
      const minutes = Math.round((reminder.at + state.settings.notifyLead * 60000 - now) / 60000);
      const when = minutes > 0 ? t("remindIn", { time: reminder.start, n: minutes })
        : minutes < 0 ? t("remindStarted", { time: reminder.start }) : t("remindNow", { time: reminder.start });
      const extra = reminder.kind === "meeting"
        ? [reminder.event.location, calendarById(reminder.event.calendarId)?.name].filter(Boolean)
        : [];
      desktop.notify({
        title: reminder.title || t("untitledEvent"),
        body: [when, ...extra].join(" · "),
        iso: reminder.iso,
        snooze: reminder.key,
        snoozeLabel: t("snooze10"),
      });
    });
    saveNotified();
  }

  els.notifyKinds.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-notify-kind]");
    if (!chip) return;
    const kind = chip.dataset.notifyKind;
    state.settings.notifyKinds = { ...state.settings.notifyKinds, [kind]: state.settings.notifyKinds[kind] === false };
    persistSettings();
    renderNotifySettings();
  });
  els.closureAt.addEventListener("change", () => {
    if (!Planner.isTime(els.closureAt.value)) return;
    state.settings.closureAt = els.closureAt.value;
    persistSettings();
  });
  els.morningAt.addEventListener("change", () => {
    if (!Planner.isTime(els.morningAt.value)) return;
    state.settings.morningAt = els.morningAt.value;
    persistSettings();
  });
  els.notifyTest.addEventListener("click", () => {
    desktop?.notify?.({ title: "Lowstate", body: t("notifyTestBody"), iso: todayISO() });
  });

  if (desktop?.notify) {
    setInterval(checkReminders, 30000);
    setTimeout(checkReminders, 5000);
    desktop.onOpenDay?.((iso, action, key) => {
      document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
      openDay(iso);
      if (action === "closure") openClosure(iso);
      // Opened from a reminder: offer the snooze here too (Windows has no
      // button on the notification itself).
      const reminder = key && currentReminders().find((candidate) => candidate.key === key);
      if (reminder) toast(`${reminder.title || t("untitledEvent")} · ${reminder.start}`, t("snooze10"), () => snoozeReminder(key));
    });
    desktop.onSnoozeReminder?.(snoozeReminder);
  }

  // ---------- always back to today ----------
  // Opening the app lands on today's page. The desktop window is only hidden
  // when closed, so it says when it is shown again; and a page left open
  // overnight follows the date when it is seen again (or, if it was showing
  // today, right at midnight).
  let seenDay = todayISO();
  function openToday() {
    seenDay = todayISO();
    state.anchor = Core.startOfDay(new Date());
    setView("day");
  }
  function followNewDay() {
    if (todayISO() !== seenDay) openToday();
  }
  desktop?.onWindowOpened?.(openToday);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") followNewDay();
  });
  window.addEventListener("focus", followNewDay);
  setInterval(() => {
    if (todayISO() !== seenDay && state.view === "day" && anchorISO() === seenDay) openToday();
  }, 60000);

  // ---------- desktop integration ----------
  if (desktop) {
    desktop.setAlwaysOnTop?.(alwaysOnTop());
    const shortcuts = Store.loadObject(KEYS.shortcuts);
    if (Object.keys(shortcuts).length) desktop.setShortcuts?.(shortcuts);
    // The global capture shortcut opens today's page ready to write.
    desktop.onQuickCapture?.((mode) => {
      // Cmd/Ctrl+Shift+B is the brain dump; the other shortcut opens today ready to write.
      if (mode === "brain") {
        openDump();
        return;
      }
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

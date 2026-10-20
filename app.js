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
    migrated: "type-todo.planner.migrated.v1",
    theme: "type-todo.theme.v1",
    alwaysOnTop: "type-todo.always-on-top.v1",
    shortcuts: "type-todo.shortcuts.v1",
    legacyTodos: "quest-log.todos.v1",
    legacyCategories: "type-todo.categories.v1",
    legacyColors: "type-todo.category-colors.v1",
  };

  const ICON_CHECK = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';
  const ICON_TODAY = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12M13 7l5 5-5 5"/></svg>';
  const START_OPTIONS = Array.from({ length: 96 }, (_, index) => Planner.minutesToTime(index * 15));
  const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240];
  const PLACEHOLDER_TEXT = { day: "comingDay", month: "comingMonth", habits: "comingHabits" };

  const $ = (id) => document.getElementById(id);
  const els = {
    weekGrid: $("weekGrid"),
    weekView: $("weekView"),
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
    view: "week",
    anchor: Core.startOfDay(new Date()),
    items: initial.items,
    categories: initial.categories,
    settings: { weekStart: savedSettings.weekStart === 0 ? 0 : 1 },
    editingId: null,
    draft: null,
    dragId: null,
  };

  const persistItems = () => Store.save(KEYS.items, state.items);
  const persistCategories = () => Store.save(KEYS.categories, state.categories);
  const persistSettings = () => Store.save(KEYS.settings, state.settings);

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
  function capture(text, fallbackDate = null) {
    const parsed = Planner.parseCapture(text);
    if (!parsed.title) return null;
    const date = parsed.date || fallbackDate || (parsed.start ? todayISO() : null);
    return addItem({
      title: parsed.title,
      date,
      start: date ? parsed.start : null,
      duration: date && parsed.start ? 60 : null,
      priority: parsed.priority,
      category: resolveCategory(parsed.category),
    });
  }

  // ---------- rendering ----------
  function cardEl(item, context = "day") {
    const category = categoryById(item.category);
    const meta = [];
    if (context === "overdue") meta.push(h("span", { class: "meta-date", text: shortDate(item.date) }));
    if (item.start) meta.push(h("span", { class: "meta-time", text: timeRange(item) }));
    if (category) meta.push(h("span", { class: "meta-cat" }, h("i"), category.name));
    if (item.priority === "urgent") meta.push(h("span", { class: "meta-urgent", text: `! ${t("urgentToggle")}` }));
    if (item.notes.trim()) meta.push(h("span", { class: "meta-notes", title: item.notes, text: "≡" }));

    const classes = ["card"];
    if (context === "overdue") classes.push("has-action");
    if (item.done) classes.push("is-done");
    if (item.priority === "urgent") classes.push("is-urgent");

    const check = h("button", {
      type: "button",
      class: "check",
      "data-action": "toggle",
      "aria-pressed": String(item.done),
      "aria-label": t(item.done ? "markOpen" : "markDone"),
    }, icon(ICON_CHECK));
    const body = h("div", { class: "card-body", "data-action": "edit", role: "button", tabindex: "0" },
      h("div", { class: "card-title", text: item.title }),
      meta.length ? h("div", { class: "card-meta" }, meta) : null);
    const action = context === "overdue"
      ? h("button", { type: "button", class: "card-action", "data-action": "today", title: t("moveToday"), "aria-label": t("moveToday") }, icon(ICON_TODAY))
      : null;

    return h("li", {
      class: classes.join(" "),
      "data-id": item.id,
      draggable: "true",
      style: category ? `--cat: ${category.color}` : null,
    }, check, body, action);
  }

  function weekDays() {
    return Planner.weekDays(state.anchor, state.settings.weekStart);
  }

  function renderTopbar() {
    const isWeek = state.view === "week";
    els.navControls.hidden = !isWeek;
    if (!isWeek) {
      els.weekProgress.hidden = true;
      els.rangeTitle.textContent = t({ day: "viewDay", month: "viewMonth", habits: "viewHabits" }[state.view]);
      els.rangeSub.textContent = "";
      return;
    }
    const days = weekDays();
    const today = todayISO();
    els.rangeTitle.textContent = formatRange(days[0], days[6]);
    els.rangeSub.textContent = t("weekNumber", { n: Planner.isoWeekNumber(days[3]) });
    els.todayBtn.disabled = days.some((day) => Core.toISODate(day) === today);

    const stats = Planner.weekStats(state.items, days);
    els.weekProgress.hidden = stats.total === 0;
    els.progressFill.style.width = `${stats.total ? Math.round((stats.done / stats.total) * 100) : 0}%`;
    els.progressText.textContent = t("weekProgress", stats);
  }

  function renderWeek() {
    const today = todayISO();
    els.weekGrid.replaceChildren(...weekDays().map((day) => {
      const iso = Core.toISODate(day);
      const items = Planner.itemsForDay(state.items, iso);
      const done = items.filter((item) => item.done).length;
      const classes = ["day-col"];
      if (iso === today) classes.push("is-today");
      else if (iso < today) classes.push("is-past");
      if (day.getDay() === 0 || day.getDay() === 6) classes.push("is-weekend");

      return h("section", { class: classes.join(" "), "data-date": iso, "aria-label": longDate(iso) },
        h("header", { class: "day-head" },
          h("span", { class: "day-name", text: formatDate(day, { weekday: "short" }) }),
          h("span", { class: "day-num", text: day.getDate() }),
          items.length ? h("span", { class: "day-count", text: `${done}/${items.length}` }) : null),
        h("ul", { class: "day-list", "data-date": iso, "data-empty": t("dayEmpty") }, items.map((item) => cardEl(item))),
        h("form", { class: "day-add", "data-date": iso },
          h("input", {
            name: "title",
            autocomplete: "off",
            maxlength: "200",
            placeholder: `+ ${t("addInline")}`,
            "aria-label": `${t("addInline")} — ${longDate(iso)}`,
          })));
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
    els.overdueList.replaceChildren(...overdue.map((item) => cardEl(item, "overdue")));

    const inbox = Planner.inboxItems(state.items);
    els.inboxCount.textContent = inbox.length || "";
    els.inboxList.replaceChildren(...inbox.map((item) => cardEl(item, "inbox")));
    els.inboxEmpty.hidden = inbox.length > 0;
  }

  function render() {
    document.querySelectorAll(".nav-btn").forEach((button) => {
      const active = button.dataset.view === state.view;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    const isWeek = state.view === "week";
    els.weekView.hidden = !isWeek;
    els.placeholderView.hidden = isWeek;
    renderTopbar();
    if (isWeek) renderWeek();
    else renderPlaceholder();
    renderSidebar();
  }

  function setView(view) {
    if (!["week", "day", "month", "habits"].includes(view)) return;
    state.view = view;
    render();
  }

  function shiftWeek(direction) {
    state.anchor = Planner.addDays(state.anchor, direction * 7);
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
      language: I18n.language,
      weekStart: String(state.settings.weekStart),
      alwaysOnTop: alwaysOnTop() ? "on" : "off",
    };
    els.settingsDialog.querySelectorAll(".seg").forEach((seg) => {
      seg.querySelectorAll("button").forEach((button) => {
        const active = button.dataset.value === values[seg.dataset.setting];
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    });
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
    } else if (setting === "language") {
      I18n.setLanguage(value);
      Store.persist();
      render();
    } else if (setting === "weekStart") {
      state.settings.weekStart = value === "0" ? 0 : 1;
      persistSettings();
      render();
    } else if (setting === "alwaysOnTop") {
      Store.setRaw(KEYS.alwaysOnTop, value);
      desktop?.setAlwaysOnTop(value === "on");
    }
    renderSettings();
  }

  els.settingsBtn.addEventListener("click", () => {
    renderSettings();
    els.settingsDialog.showModal();
  });
  els.settingsClose.addEventListener("click", () => els.settingsDialog.close());
  els.settingsDialog.addEventListener("click", (event) => {
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
  els.prevBtn.addEventListener("click", () => shiftWeek(-1));
  els.nextBtn.addEventListener("click", () => shiftWeek(1));
  els.todayBtn.addEventListener("click", goToday);
  els.moveAllToday.addEventListener("click", () => {
    moveToToday(Planner.overdueItems(state.items, todayISO()).map((item) => item.id));
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
    const card = action?.closest(".card");
    if (!card) return;
    const id = card.dataset.id;
    if (action.dataset.action === "toggle") toggleItem(id);
    else if (action.dataset.action === "edit") openEditor(id);
    else if (action.dataset.action === "today") moveToToday([id]);
  });

  document.addEventListener("keydown", (event) => {
    if (event.target.matches?.(".card-body") && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openEditor(event.target.closest(".card").dataset.id);
      return;
    }
    if (document.querySelector("dialog[open]") || event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTyping(event.target)) {
      if (event.key === "Escape") event.target.blur();
      return;
    }
    const views = { 1: "week", 2: "day", 3: "month", 4: "habits" };
    if (views[event.key]) setView(views[event.key]);
    else if (event.key === "n" || event.key === "N") {
      event.preventDefault();
      els.inboxInput.focus();
    } else if (event.key === "t" || event.key === "T") goToday();
    else if (state.view === "week" && event.key === "ArrowLeft") shiftWeek(-1);
    else if (state.view === "week" && event.key === "ArrowRight") shiftWeek(1);
  });

  // ---------- drag & drop ----------
  function dropZoneFrom(target) {
    const column = target.closest?.(".day-col");
    if (column) return { container: column, list: column.querySelector(".day-list"), date: column.dataset.date };
    if (target.closest?.("#inboxSection")) return { container: els.inboxSection, list: els.inboxList, date: null };
    return null;
  }

  function cardBefore(list, y) {
    return [...list.querySelectorAll(".card:not(.dragging)")].find((card) => {
      const rect = card.getBoundingClientRect();
      return y < rect.top + rect.height / 2;
    }) || null;
  }

  function clearDropMarks() {
    document.querySelectorAll(".drop-target, .drop-before, .drop-end").forEach((node) => {
      node.classList.remove("drop-target", "drop-before", "drop-end");
    });
  }

  document.addEventListener("dragstart", (event) => {
    const card = event.target.closest?.(".card");
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
    const before = cardBefore(zone.list, event.clientY);
    state.items = Planner.moveItem(state.items, state.dragId, { date: zone.date, beforeId: before?.dataset.id || null });
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
    desktop.onQuickCapture?.(() => {
      document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
      els.inboxInput.focus();
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

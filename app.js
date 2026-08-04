const STORAGE_KEY = "quest-log.todos.v1";
const COVER_KEY = "type-todo.cover.v1";
const COVER_CUSTOM_KEY = "type-todo.cover-custom.v1";
const COVER_MIX_KEY = "type-todo.cover-mix.v1";
const THEME_KEY = "type-todo.theme.v1";
const STYLE_KEY = "type-todo.style.v1";
const FONT_SIZE_KEY = "type-todo.font-size.v1";
const PRE_MINIMAL_COVER_KEY = "type-todo.pre-minimal-cover.v1";
const CATEGORIES_KEY = "type-todo.categories.v1";
const CATEGORY_COLORS_KEY = "type-todo.category-colors.v1";
const NOTEBOOK_TITLE_KEY = "type-todo.notebook-title.v1";
const ALWAYS_ON_TOP_KEY = "type-todo.always-on-top.v1";
const SHORTCUTS_KEY = "type-todo.shortcuts.v1";
const DEFAULT_SHORTCUTS = {
  toggle: "CommandOrControl+Shift+Space",
  capture: "CommandOrControl+Shift+N",
  brain: "CommandOrControl+Shift+B",
};
const BRAIN_KEY = "type-todo.brain-inbox.v1";
const ONBOARDING_KEY = "type-todo.onboarding-dismissed.v1";
const NEW_TASK_DUE_TARGET = "__new_task__";
const { startOfDay, toISODate, parseISODate, dueMeta, quickDueISO, filterAndSortTodos, parseTaskCapture } = window.LowstateCore;
const store = window.LowstateStorage;
const { t } = window.LowstateI18n;

const state = {
  todos: loadTodos(),
  filter: "active",
  category: null,
  newCategory: null,
  categoryMenuTarget: null,
  categoryFormTarget: null,
  categories: loadCategories(),
  categoryColors: loadCategoryColors(),
  urgentOnly: false,
  filterMenuOpen: false,
  priority: "normal",
  newDueDate: null,
  captureOptionsOpen: false,
  editingId: null,
  mode: "tasks",
  brainNotes: loadBrainNotes(),
  brainFilter: "unprocessed",
  brainTag: null,
  dueTarget: null,
  dueView: null,
  settingsOpen: false,
  trash: store.pruneTrash(),
};

// One-time migration: tasks created before due dates existed (no dueDate field)
// remain unscheduled. Tasks explicitly cleared ("NO DATE", dueDate: null) are left as-is.
if (state.todos.some((todo) => !("dueDate" in todo))) {
  state.todos.forEach((todo) => {
    if (!("dueDate" in todo)) todo.dueDate = null;
  });
  saveTodos();
}

// One-time migration: tasks created before manual drag order existed get an
// order derived from createdAt, preserving the old "newest first" look.
if (state.todos.some((todo) => !("order" in todo))) {
  state.todos.forEach((todo) => {
    if (!("order" in todo)) todo.order = -todo.createdAt;
  });
  saveTodos();
}

const els = {
  form: document.querySelector("#todoForm"),
  input: document.querySelector("#todoInput"),
  list: document.querySelector("#todoList"),
  template: document.querySelector("#todoTemplate"),
  empty: document.querySelector("#emptyState"),
  paper: document.querySelector(".paper"),
  activeCount: document.querySelector("#activeCount"),
  progressText: document.querySelector("#progressText"),
  progressBar: document.querySelector("#progressBar"),
  clearDone: document.querySelector("#clearDone"),
  installHint: document.querySelector("#installHint"),
  themePalette: document.querySelector("#themePalette"),
  settingsToggle: document.querySelector("#settingsToggle"),
  settingsBack: document.querySelector("#settingsBack"),
  settingsPage: document.querySelector("#settingsPage"),
  catPickerBtn: document.querySelector("#catPickerBtn"),
  catPickerDot: document.querySelector("#catPickerDot"),
  catPickerLabel: document.querySelector("#catPickerLabel"),
  categoryMenu: document.querySelector("#categoryMenu"),
  activeCategoryChip: document.querySelector("#activeCategoryChip"),
  categoryForm: document.querySelector("#categoryForm"),
  categoryInput: document.querySelector("#categoryInput"),
  urgentToggle: document.querySelector("#urgentToggle"),
  filterMenuToggle: document.querySelector("#filterMenuToggle"),
  filterMenu: document.querySelector("#filterMenu"),
  filterActiveDot: document.querySelector("#filterActiveDot"),
  filterCategoryList: document.querySelector("#filterCategoryList"),
  compactToggle: document.querySelector("#compactToggle"),
  compactExpand: document.querySelector("#compactExpand"),
  exportData: document.querySelector("#exportData"),
  importData: document.querySelector("#importData"),
  importFile: document.querySelector("#importFile"),
  duePicker: document.querySelector("#duePicker"),
  dueMonthLabel: document.querySelector("#dueMonthLabel"),
  dueCalGrid: document.querySelector("#dueCalGrid"),
  duePrev: document.querySelector("#duePrev"),
  dueNext: document.querySelector("#dueNext"),
  coverPickerToggle: document.querySelector("#coverPickerToggle"),
  coverPicker: document.querySelector("#coverPicker"),
  coverHue: document.querySelector("#coverHue"),
  coverDepth: document.querySelector("#coverDepth"),
  coverPreview: document.querySelector("#coverPreview"),
  captureOptionsToggle: document.querySelector("#captureOptionsToggle"),
  captureOptions: document.querySelector("#captureOptions"),
  newDueButton: document.querySelector("#newDueButton"),
  titleButton: document.querySelector("#titleButton"),
  notebookTitle: document.querySelector("#notebookTitle"),
  titleForm: document.querySelector("#titleForm"),
  titleInput: document.querySelector("#titleInput"),
  brainTemplate: document.querySelector("#brainTemplate"),
  taskFilters: document.querySelector("#taskFilters"),
  brainFilters: document.querySelector("#brainFilters"),
  copyBrain: document.querySelector("#copyBrain"),
  exportBrain: document.querySelector("#exportBrain"),
  processBrain: document.querySelector("#processBrain"),
  brainTagToggle: document.querySelector("#brainTagToggle"),
  brainTagMenu: document.querySelector("#brainTagMenu"),
  paperSlot: document.querySelector(".paper-slot span"),
  settingsWindowSection: document.querySelector("#settingsWindowSection"),
  globalShortcuts: document.querySelector("#globalShortcuts"),
  updateDot: document.querySelector("#updateDot"),
  updateBanner: document.querySelector("#updateBanner"),
  updateBannerText: document.querySelector("#updateBannerText"),
  updateBannerButton: document.querySelector("#updateBannerButton"),
  toast: document.querySelector("#toast"),
  toastMessage: document.querySelector("#toastMessage"),
  toastAction: document.querySelector("#toastAction"),
  emptyTitle: document.querySelector("#emptyTitle"),
  emptyHint: document.querySelector("#emptyHint"),
  onboardingTip: document.querySelector("#onboardingTip"),
  dismissOnboarding: document.querySelector("#dismissOnboarding"),
  trashCount: document.querySelector("#trashCount"),
  restoreTrash: document.querySelector("#restoreTrash"),
  emptyTrash: document.querySelector("#emptyTrash"),
};

const savedCover = localStorage.getItem(COVER_KEY) || "forest";
const savedTitle = localStorage.getItem(NOTEBOOK_TITLE_KEY) || "MY DAILY NOTEBOOK";
document.documentElement.dataset.cover = savedCover;
els.notebookTitle.textContent = savedTitle;
const savedMix = (localStorage.getItem(COVER_MIX_KEY) || "210,40").split(",");
els.coverHue.value = savedMix[0];
els.coverDepth.value = savedMix[1];

const savedTheme = localStorage.getItem(THEME_KEY)
  || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  document.querySelectorAll("[data-theme-value]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.themeValue === theme);
  });
}

const savedStyle = localStorage.getItem(STYLE_KEY) || "notebook";

function applyStyle(style) {
  document.documentElement.dataset.style = style;
  localStorage.setItem(STYLE_KEY, style);
  document.querySelectorAll("[data-style-value]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.styleValue === style);
  });
}

const savedFontSize = localStorage.getItem(FONT_SIZE_KEY) || "normal";

function applyFontSize(size) {
  document.documentElement.dataset.fontSize = size;
  localStorage.setItem(FONT_SIZE_KEY, size);
  document.querySelectorAll("[data-font-size-value]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.fontSizeValue === size);
  });
}

let pendingUpdateUrl = null;

function showUpdateAvailable(info) {
  pendingUpdateUrl = info.url;
  els.updateDot.hidden = false;
  els.updateBannerText.textContent = `Update available — v${info.version}`;
  els.updateBanner.hidden = false;
}

const savedAlwaysOnTop = localStorage.getItem(ALWAYS_ON_TOP_KEY) !== "off";

function applyAlwaysOnTop(on) {
  localStorage.setItem(ALWAYS_ON_TOP_KEY, on ? "on" : "off");
  window.desktopGadget?.setAlwaysOnTop(on);
  document.querySelectorAll("[data-aot-value]").forEach((btn) => {
    btn.classList.toggle("active", (btn.dataset.aotValue === "on") === on);
  });
}

// ----- Configurable global shortcuts (desktop app only) -----
function loadShortcuts() {
  try {
    return { ...DEFAULT_SHORTCUTS, ...JSON.parse(localStorage.getItem(SHORTCUTS_KEY) || "{}") };
  } catch {
    return { ...DEFAULT_SHORTCUTS };
  }
}
const shortcuts = loadShortcuts();
let recordingShortcut = null;

const ACCELERATOR_SYMBOLS = { CommandOrControl: "⌘", Shift: "⇧", Alt: "⌥" };
function formatAccelerator(accelerator) {
  return accelerator.split("+").map((part) => ACCELERATOR_SYMBOLS[part] || part).join("");
}

const NAMED_KEYS = {
  ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
  Escape: "Esc", Tab: "Tab", Backspace: "Backspace", Delete: "Delete", Enter: "Enter",
};
function keyToAcceleratorPart(event) {
  if (event.code === "Space") return "Space";
  if (/^[a-zA-Z]$/.test(event.key)) return event.key.toUpperCase();
  if (/^[0-9]$/.test(event.key)) return event.key;
  if (/^F([1-9]|1[0-2])$/.test(event.key)) return event.key;
  return NAMED_KEYS[event.key] || null;
}

function shortcutButton(key) {
  return document.querySelector(`.shortcut-key[data-shortcut="${key}"]`);
}

function renderShortcut(key) {
  const button = shortcutButton(key);
  if (!button) return;
  button.classList.remove("recording", "shortcut-error");
  button.textContent = formatAccelerator(shortcuts[key]);
  const resetButton = document.querySelector(`[data-shortcut-reset="${key}"]`);
  if (resetButton) resetButton.hidden = shortcuts[key] === DEFAULT_SHORTCUTS[key];
}

function stopRecordingShortcut() {
  document.removeEventListener("keydown", onShortcutRecordKeydown, true);
  const key = recordingShortcut;
  recordingShortcut = null;
  if (key) renderShortcut(key);
}

function flashShortcutFeedback(key, message) {
  const button = shortcutButton(key);
  if (!button) return;
  button.classList.remove("recording");
  button.classList.add("shortcut-error");
  button.textContent = message;
  setTimeout(() => renderShortcut(key), 1200);
}

async function commitShortcut(key, accelerator) {
  const button = shortcutButton(key);
  if (button) button.textContent = "SAVING…";
  let result;
  try {
    result = await window.desktopGadget?.setShortcuts({ [key]: accelerator });
  } catch {
    // Most likely cause: main.cjs/preload.cjs changed since the app was last
    // launched, so the IPC handler the renderer is calling doesn't exist yet.
    flashShortcutFeedback(key, "RESTART APP");
    return;
  }
  if (!result || !result.ok) {
    flashShortcutFeedback(key, "IN USE");
    return;
  }
  shortcuts[key] = accelerator;
  localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(shortcuts));
  renderShortcut(key);
}

function onShortcutRecordKeydown(event) {
  event.preventDefault();
  event.stopPropagation();
  const key = recordingShortcut;
  if (event.key === "Escape") { stopRecordingShortcut(); return; }
  if (["Control", "Meta", "Shift", "Alt", "OS"].includes(event.key)) return; // still waiting for a real key
  const parts = [];
  if (event.metaKey || event.ctrlKey) parts.push("CommandOrControl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  const mainKey = keyToAcceleratorPart(event);
  document.removeEventListener("keydown", onShortcutRecordKeydown, true);
  recordingShortcut = null;
  if (!parts.length) { flashShortcutFeedback(key, "USE CTRL/CMD/ALT"); return; }
  if (!mainKey) { flashShortcutFeedback(key, "UNSUPPORTED KEY"); return; }
  parts.push(mainKey);
  const accelerator = parts.join("+");
  const clash = Object.entries(shortcuts).find(([k, v]) => k !== key && v === accelerator);
  if (clash) { flashShortcutFeedback(key, "ALREADY USED"); return; }
  commitShortcut(key, accelerator);
}

function startRecordingShortcut(key) {
  if (recordingShortcut) stopRecordingShortcut();
  recordingShortcut = key;
  const button = shortcutButton(key);
  button.classList.remove("shortcut-error");
  button.classList.add("recording");
  button.textContent = "PRESS KEYS…";
  document.addEventListener("keydown", onShortcutRecordKeydown, true);
}

// Switching to Minimal defaults to a plain black cover; remember whatever
// cover was on the notebook side so switching back restores it.
function setStyle(newStyle) {
  const current = document.documentElement.dataset.style;
  if (newStyle === current) return;
  if (newStyle === "minimal") {
    localStorage.setItem(PRE_MINIMAL_COVER_KEY, document.documentElement.dataset.cover || "forest");
    selectCover("mono");
  } else if (current === "minimal") {
    const restoreCover = localStorage.getItem(PRE_MINIMAL_COVER_KEY) || "forest";
    selectCover(restoreCover, restoreCover === "custom" ? localStorage.getItem(COVER_CUSTOM_KEY) : undefined);
  }
  applyStyle(newStyle);
}

const CUSTOM_COVER_VARS = ["--cover", "--cover-dark", "--cover-ink"];

function coverLuminance(hex) {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function applyCustomCover(hex) {
  const s = document.documentElement.style;
  s.setProperty("--cover", hex);
  s.setProperty("--cover-dark", `color-mix(in srgb, ${hex} 78%, #000)`);
  // Dark ink for light covers, light ink for dark covers, so header text stays readable
  s.setProperty(
    "--cover-ink",
    coverLuminance(hex) > 0.55 ? `color-mix(in srgb, ${hex} 34%, #000)` : `color-mix(in srgb, ${hex} 26%, #fff)`
  );
}

function selectCover(cover, customHex) {
  document.documentElement.dataset.cover = cover;
  localStorage.setItem(COVER_KEY, cover);
  if (cover === "custom") {
    const hex = customHex || localStorage.getItem(COVER_CUSTOM_KEY) || "#d9a5a0";
    localStorage.setItem(COVER_CUSTOM_KEY, hex);
    applyCustomCover(hex);
  } else {
    CUSTOM_COVER_VARS.forEach((v) => document.documentElement.style.removeProperty(v));
  }
  window.desktopTheme?.setCover(cover);
  document.querySelectorAll("[data-cover]").forEach((button) => {
    button.classList.toggle("active", button.dataset.cover === cover);
  });
  els.coverPickerToggle?.classList.toggle("active", cover === "custom");
}

// Build a cover hex from the hue/depth sliders (always a tasteful notebook shade)
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function coverMixHex() {
  const h = Number(els.coverHue.value);
  const depth = Number(els.coverDepth.value);
  return hslToHex(h, 40 + depth * 0.15, 80 - depth * 0.25);
}

function refreshCoverPicker() {
  const h = Number(els.coverHue.value);
  els.coverPreview.style.background = coverMixHex();
  els.coverDepth.style.setProperty(
    "--track",
    `linear-gradient(90deg, ${hslToHex(h, 40, 80)}, ${hslToHex(h, 55, 55)})`
  );
}

function loadTodos() {
  return store.loadArray(STORAGE_KEY);
}

function loadBrainNotes() {
  return store.loadArray(BRAIN_KEY);
}

function saveBrainNotes() {
  store.save(BRAIN_KEY, state.brainNotes);
}

function loadCategories() {
  return store.loadArray(CATEGORIES_KEY);
}

function saveCategories() {
  store.save(CATEGORIES_KEY, state.categories);
}

function loadCategoryColors() {
  return store.loadObject(CATEGORY_COLORS_KEY);
}

function saveCategoryColors() {
  store.save(CATEGORY_COLORS_KEY, state.categoryColors);
}

function saveTodos() {
  store.save(STORAGE_KEY, state.todos);
}

let toastTimer = null;
let toastAction = null;

function hideToast() {
  clearTimeout(toastTimer);
  toastTimer = null;
  toastAction = null;
  els.toast.hidden = true;
}

function showToast(message, options = {}) {
  clearTimeout(toastTimer);
  els.toastMessage.textContent = message;
  toastAction = options.action || null;
  els.toastAction.hidden = !toastAction;
  els.toastAction.textContent = options.actionLabel || t("undo");
  els.toast.hidden = false;
  toastTimer = setTimeout(hideToast, options.duration || 5000);
}

function resetNewTaskOptions(options = {}) {
  state.priority = "normal";
  if (!options.keepCategory) state.newCategory = null;
  state.newDueDate = null;
  state.captureOptionsOpen = false;
  document.querySelectorAll(".priority").forEach((button) => {
    button.classList.toggle("active", button.dataset.priority === "normal");
  });
  updateCategoryPicker();
  updateNewDueButton();
  updateCaptureOptions();
}

function addTodo(title) {
  const parsed = parseTaskCapture(title);
  const cleanTitle = parsed.title;
  if (!cleanTitle) return;
  if (parsed.category && !state.categories.includes(parsed.category)) {
    state.categories.push(parsed.category);
    state.categoryColors[parsed.category] = "#c9dfd5";
    saveCategories();
    saveCategoryColors();
  }
  state.todos.unshift({
    id: crypto.randomUUID(),
    title: cleanTitle,
    priority: parsed.priority || state.priority,
    category: parsed.category || state.newCategory,
    dueDate: parsed.dueDate !== undefined ? parsed.dueDate : state.newDueDate,
    order: -Date.now(),
    done: false,
    createdAt: Date.now(),
  });
  saveTodos();
  els.form.reset();
  if (parsed.category) state.newCategory = parsed.category;
  resetNewTaskOptions({ keepCategory: true });
  render();
}

function addBrainNote(text) {
  const cleanText = text.trim();
  if (!cleanText) return;
  const tags = [...new Set(cleanText.match(/#[\p{L}\p{N}_-]+/gu) || [])];
  state.brainNotes.unshift({
    id: crypto.randomUUID(),
    text: cleanText,
    tags,
    processed: false,
    createdAt: Date.now(),
  });
  saveBrainNotes();
  els.form.reset();
  render();
}

function updateTodo(id, changes) {
  state.todos = state.todos.map((todo) => todo.id === id ? { ...todo, ...changes } : todo);
  saveTodos();
  render();
}

function updateBrainNote(id, text) {
  const tags = [...new Set(text.match(/#[\p{L}\p{N}_-]+/gu) || [])];
  state.brainNotes = state.brainNotes.map((note) => note.id === id ? { ...note, text, tags } : note);
  saveBrainNotes();
  render();
}

function deleteTodo(id) {
  const index = state.todos.findIndex((todo) => todo.id === id);
  if (index < 0) return;
  const [deleted] = state.todos.splice(index, 1);
  state.trash = store.trash("todo", deleted, index);
  const trashId = state.trash[0].id;
  saveTodos();
  render();
  showToast(t("taskDeleted"), {
    actionLabel: t("undo"),
    action: () => {
      store.removeTrashEntry(trashId);
      state.trash = store.pruneTrash();
      state.todos.splice(index, 0, deleted);
      saveTodos();
      render();
    },
  });
}

function setTodoCompleted(id, done) {
  const todo = state.todos.find((entry) => entry.id === id);
  if (!todo) return;
  const previous = todo.done;
  updateTodo(id, { done });
  showToast(done ? t("taskCompleted") : t("taskReopened"), {
    actionLabel: t("undo"),
    action: () => updateTodo(id, { done: previous }),
  });
}

function updateTrashSettings() {
  state.trash = store.pruneTrash();
  els.trashCount.textContent = state.trash.length;
  els.restoreTrash.disabled = state.trash.length === 0;
  els.emptyTrash.disabled = state.trash.length === 0;
}

function visibleTodos() {
  return filterAndSortTodos(state.todos, {
    category: state.category,
    filter: state.filter,
    urgentOnly: state.urgentOnly,
  });
}

// Reorder `dragId` relative to `targetId` within their shared due-date bucket
// (dragging across different days is rejected before this is ever called).
function reorderTodo(dragId, targetId, insertAfter) {
  const dragged = state.todos.find((t) => t.id === dragId);
  const target = state.todos.find((t) => t.id === targetId);
  if (!dragged || !target || dragged.dueDate !== target.dueDate) return;

  const bucket = state.todos
    .filter((t) => t.dueDate === dragged.dueDate)
    .sort((a, b) => (a.order ?? -a.createdAt) - (b.order ?? -b.createdAt));

  bucket.splice(bucket.indexOf(dragged), 1);
  const to = bucket.indexOf(target) + (insertAfter ? 1 : 0);
  bucket.splice(to, 0, dragged);

  bucket.forEach((t, i) => { t.order = i; });
  saveTodos();
  render();
}

function updateNewDueButton() {
  const meta = dueMeta(state.newDueDate);
  const label = meta.label === "TODAY" ? t("today") : (meta.label === "TOMORROW" ? t("tomorrow") : meta.label);
  els.newDueButton.textContent = meta.status === "none" ? `◷ ${t("date")}` : `◷ ${label}`;
  els.newDueButton.dataset.status = meta.status;
}

function updateCaptureOptions() {
  const open = state.captureOptionsOpen && state.mode === "tasks";
  els.captureOptions.hidden = !open;
  els.form.classList.toggle("options-open", open);
  els.captureOptionsToggle.setAttribute("aria-expanded", String(open));
  els.captureOptionsToggle.classList.toggle("active", open || Boolean(state.newCategory || state.newDueDate || state.priority === "boss"));
}

function updateEmptyState(empty, titleKey, hintKey) {
  els.empty.classList.toggle("visible", empty);
  els.emptyTitle.textContent = empty ? t(titleKey) : "";
  els.emptyHint.textContent = empty ? t(hintKey) : "";
}

function render() {
  window.LowstateI18n.apply();
  document.querySelectorAll("[data-language-value]").forEach((button) => {
    button.classList.toggle("active", button.dataset.languageValue === window.LowstateI18n.language);
  });
  updateTrashSettings();
  els.paper.classList.toggle("settings-mode", state.settingsOpen);
  els.settingsPage.hidden = !state.settingsOpen;
  els.settingsBack.hidden = !state.settingsOpen;
  els.paperSlot.textContent = state.settingsOpen
    ? "SETTINGS"
    : (state.mode === "brain" ? "BRAIN INBOX" : "TO-DO LIST");
  const showOnboarding = !localStorage.getItem(ONBOARDING_KEY)
    && state.todos.length === 0
    && state.brainNotes.length === 0
    && !state.settingsOpen;
  els.onboardingTip.hidden = !showOnboarding;
  if (state.settingsOpen) return;

  els.list.replaceChildren();
  const brainMode = state.mode === "brain";
  document.querySelector(".filters").classList.toggle("brain-mode", brainMode);
  els.taskFilters.hidden = brainMode;
  els.brainFilters.hidden = !brainMode;
  els.taskFilters.style.display = brainMode ? "none" : "";
  els.brainFilters.style.display = brainMode ? "" : "none";
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });
  els.captureOptionsToggle.hidden = brainMode;
  if (brainMode) {
    closeCategoryMenu();
    state.captureOptionsOpen = false;
    state.filterMenuOpen = false;
  } else {
    els.brainTagToggle.setAttribute("aria-expanded", "false");
    els.brainTagMenu.hidden = true;
  }
  updateCaptureOptions();
  els.input.placeholder = brainMode ? t("brainPlaceholder") : t("taskPlaceholder");
  els.input.setAttribute("aria-label", brainMode ? t("newBrain") : t("newTask"));
  els.form.querySelector(':scope > button[type="submit"]').setAttribute("aria-label", brainMode ? t("addCapture") : t("addTask"));
  if (brainMode) {
    renderBrainInbox();
    return;
  }
  const todos = visibleTodos();

  todos.forEach((todo, index) => {
    const item = els.template.content.firstElementChild.cloneNode(true);
    item.dataset.id = todo.id;
    item.classList.toggle("done", todo.done);
    item.classList.toggle("boss", todo.priority === "boss");
    item.classList.toggle("editing", state.editingId === todo.id);
    item.querySelector(".quest-title").textContent = todo.title;
    const catTag = item.querySelector(".cat-tag");
    if (todo.category && state.categories.includes(todo.category)) {
      catTag.hidden = false;
      catTag.textContent = todo.category;
      catTag.dataset.category = todo.category;
      catTag.style.setProperty("--category-color", state.categoryColors[todo.category] || "#c9dfd5");
      catTag.title = `Filter by ${todo.category}`;
    }
    const dueChip = item.querySelector(".due-chip");
    const meta = dueMeta(todo.dueDate);
    dueChip.hidden = false;
    dueChip.dataset.status = todo.done ? "done" : meta.status;
    const dueLabel = meta.label === "TODAY" ? t("today") : (meta.label === "TOMORROW" ? t("tomorrow") : meta.label);
    dueChip.textContent = meta.status === "none" ? `◷ ${t("date").toLowerCase()}` : `◷ ${dueLabel}`;
    dueChip.title = "Set due date";
    const editInput = item.querySelector(".edit-input");
    editInput.value = todo.title;
    item.querySelector(".check").setAttribute("aria-label", todo.done ? t("reopenTask") : t("completeTask"));
    els.list.append(item);
    if (state.editingId === todo.id) requestAnimationFrame(() => editInput.focus());
  });

  const active = state.todos.filter((todo) => !todo.done).length;
  const done = state.todos.length - active;
  const percent = state.todos.length ? Math.round((done / state.todos.length) * 100) : 0;
  els.activeCount.textContent = active;
  els.progressText.textContent = `${done} / ${state.todos.length} ${t("done")}`;
  els.progressBar.style.width = `${percent}%`;
  const emptyKey = state.category ? "Category" : ({ active: "Active", today: "Today", done: "Done", overdue: "Late", all: "All" }[state.filter] || "Active");
  updateEmptyState(todos.length === 0, `empty${emptyKey}`, `empty${emptyKey}Hint`);
  els.clearDone.hidden = done === 0;
  els.urgentToggle.setAttribute("aria-pressed", String(state.urgentOnly));

  updateCategoryPicker();
  updateActiveCategoryChip();
  updateNewDueButton();
  updateFilterMenu();
}

function updateCategoryPicker() {
  const selected = state.newCategory && state.categories.includes(state.newCategory)
    ? state.newCategory
    : null;
  state.newCategory = selected;
  els.catPickerLabel.textContent = selected || "TAG";
  els.catPickerDot.style.background = selected
    ? (state.categoryColors[selected] || "#c9dfd5")
    : "transparent";
  els.catPickerBtn.classList.toggle("has-category", Boolean(selected));
}

function updateActiveCategoryChip() {
  const active = state.filter === "category" && state.category;
  els.activeCategoryChip.hidden = !active;
  if (active) {
    els.activeCategoryChip.querySelector(".chip-name").textContent = state.category;
    els.activeCategoryChip.querySelector(".cat-dot").style.background =
      state.categoryColors[state.category] || "#c9dfd5";
  }
}

function updateFilterMenu() {
  els.filterMenu.hidden = !state.filterMenuOpen;
  els.filterMenuToggle.setAttribute("aria-expanded", String(state.filterMenuOpen));
  const advanced = state.urgentOnly || state.filter === "overdue" || state.filter === "all" || Boolean(state.category);
  els.filterActiveDot.hidden = !advanced;
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.classList.toggle("active", !state.category && button.dataset.filter === state.filter);
  });
  els.urgentToggle.setAttribute("aria-pressed", String(state.urgentOnly));
  els.filterCategoryList.replaceChildren();
  if (!state.categories.length) {
    const empty = document.createElement("span");
    empty.className = "filter-menu-empty";
    empty.textContent = t("noCategory");
    els.filterCategoryList.append(empty);
    return;
  }
  state.categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-category-option";
    button.dataset.categoryFilter = category;
    button.classList.toggle("active", state.category === category);
    const dot = document.createElement("span");
    dot.className = "cat-dot";
    dot.style.background = state.categoryColors[category] || "#c9dfd5";
    button.append(dot, document.createTextNode(category));
    els.filterCategoryList.append(button);
  });
}

function currentMenuCategory() {
  if (state.categoryMenuTarget) {
    const todo = state.todos.find((entry) => entry.id === state.categoryMenuTarget);
    return todo ? todo.category : null;
  }
  return state.newCategory;
}

function renderCategoryMenu() {
  const current = currentMenuCategory();
  els.categoryMenu.replaceChildren();
  const none = document.createElement("button");
  none.type = "button";
  none.className = "cat-menu-item" + (current ? "" : " selected");
  none.dataset.cat = "";
  none.innerHTML = `<span class="cat-dot cat-dot-none"></span>${escapeHtml(t("noCategory"))}`;
  els.categoryMenu.append(none);
  state.categories.forEach((category) => {
    const row = document.createElement("div");
    row.className = "cat-menu-row";
    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "cat-menu-item" + (current === category ? " selected" : "");
    pick.dataset.cat = category;
    pick.innerHTML = '<span class="cat-dot"></span>' + escapeHtml(category);
    pick.querySelector(".cat-dot").style.background = state.categoryColors[category] || "#c9dfd5";
    const del = document.createElement("button");
    del.type = "button";
    del.className = "cat-menu-del";
    del.dataset.del = category;
    del.setAttribute("aria-label", `Delete ${category}`);
    del.textContent = "×";
    row.append(pick, del);
    els.categoryMenu.append(row);
  });
  const add = document.createElement("button");
  add.type = "button";
  add.className = "cat-menu-new";
  add.textContent = t("newCategory");
  els.categoryMenu.append(add);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderBrainInbox() {
  let notes = state.brainNotes.filter((note) => (
    state.brainFilter === "processed" ? note.processed : !note.processed
  ));
  if (state.brainTag) notes = notes.filter((note) => note.tags.includes(state.brainTag));
  notes.forEach((note, index) => {
    const item = els.brainTemplate.content.firstElementChild.cloneNode(true);
    item.dataset.id = note.id;
    item.classList.toggle("processed", note.processed);
    item.classList.toggle("editing", state.editingId === note.id);
    item.querySelector(".quest-title").textContent = note.text;
    const tags = item.querySelector(".brain-tags");
    note.tags.forEach((tag) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "brain-tag";
      button.dataset.brainTag = tag;
      button.textContent = tag;
      tags.append(button);
    });
    item.querySelector(".brain-check").setAttribute("aria-label", note.processed ? t("markUnprocessed") : t("markProcessed"));
    const editInput = item.querySelector(".edit-input");
    editInput.value = note.text;
    els.list.append(item);
    if (state.editingId === note.id) requestAnimationFrame(() => editInput.focus());
  });
  const unprocessed = state.brainNotes.filter((note) => !note.processed).length;
  const processed = state.brainNotes.length - unprocessed;
  const percent = state.brainNotes.length ? Math.round((processed / state.brainNotes.length) * 100) : 0;
  els.progressText.textContent = `${unprocessed} INBOX`;
  els.progressBar.style.width = `${percent}%`;
  const emptyKey = state.brainFilter === "processed" ? "emptyBrainProcessed" : "emptyBrain";
  updateEmptyState(notes.length === 0, emptyKey, `${emptyKey}Hint`);
  els.clearDone.hidden = true;
  els.processBrain.hidden = state.brainFilter === "processed";
  els.processBrain.disabled = notes.length === 0;
  els.brainTagToggle.classList.toggle("active", Boolean(state.brainTag));
  els.brainTagToggle.querySelector("span").textContent = state.brainTag || t("tags");
  renderBrainTagMenu();
  document.querySelectorAll("[data-brain-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.brainFilter === state.brainFilter);
  });
}

function renderBrainTagMenu() {
  els.brainTagMenu.replaceChildren();
  const tags = [...new Set(state.brainNotes.flatMap((note) => note.tags))].sort();
  const all = document.createElement("button");
  all.type = "button";
  all.dataset.brainTagFilter = "";
  all.classList.toggle("active", !state.brainTag);
  all.textContent = t("allTags");
  els.brainTagMenu.append(all);
  tags.forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.brainTagFilter = tag;
    button.classList.toggle("active", state.brainTag === tag);
    button.textContent = tag;
    els.brainTagMenu.append(button);
  });
  if (!tags.length) all.textContent = t("noTags");
  els.brainTagMenu.hidden = els.brainTagToggle.getAttribute("aria-expanded") !== "true";
}

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const hadText = els.input.value.trim().length > 0;
  if (state.mode === "brain") addBrainNote(els.input.value);
  else addTodo(els.input.value);
  // Quick capture: after saving in compact mode, tuck the gadget away again
  if (hadText && document.documentElement.hasAttribute("data-compact")) {
    window.desktopGadget?.hide();
  }
});

els.captureOptionsToggle.addEventListener("click", () => {
  state.captureOptionsOpen = !state.captureOptionsOpen;
  updateCaptureOptions();
  if (!state.captureOptionsOpen) {
    closeCategoryMenu();
    closeDuePicker();
  }
});

els.newDueButton.addEventListener("click", (event) => {
  event.stopPropagation();
  if (els.duePicker.hidden || state.dueTarget !== NEW_TASK_DUE_TARGET) {
    openDuePicker(els.newDueButton, NEW_TASK_DUE_TARGET);
  } else {
    closeDuePicker();
  }
});

els.toastAction.addEventListener("click", () => {
  const action = toastAction;
  hideToast();
  if (action) action();
});

// ----- Compact mode (quick capture) -----
function applyCompactUI(on, focus) {
  document.documentElement.toggleAttribute("data-compact", on);
  els.compactExpand.hidden = !on;
  if (on && focus !== false) requestAnimationFrame(() => els.input.focus());
}

function setCompact(on, focus) {
  applyCompactUI(on, focus);
  window.desktopGadget?.setCompact(on);
}

els.compactToggle.addEventListener("click", () => setCompact(true, true));
els.compactExpand.addEventListener("click", () => setCompact(false, false));

// Desktop: global hotkey / show requests from the main process
window.desktopGadget?.onQuickCapture((mode) => {
  const wantBrain = mode === "brain";
  if (wantBrain !== (state.mode === "brain")) {
    state.mode = wantBrain ? "brain" : "tasks";
    render();
  }
  applyCompactUI(true, true);
});
window.desktopGadget?.onSetCompactUI((on) => applyCompactUI(on, on));

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    render();
    els.input.focus();
  });
});

document.querySelectorAll("[data-brain-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.brainFilter = button.dataset.brainFilter;
    render();
  });
});

els.brainTagToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  const open = els.brainTagToggle.getAttribute("aria-expanded") !== "true";
  els.brainTagToggle.setAttribute("aria-expanded", String(open));
  renderBrainTagMenu();
});

els.brainTagMenu.addEventListener("click", (event) => {
  const button = event.target.closest("[data-brain-tag-filter]");
  if (!button) return;
  state.brainTag = button.dataset.brainTagFilter || null;
  els.brainTagToggle.setAttribute("aria-expanded", "false");
  render();
});

document.addEventListener("click", (event) => {
  if (els.brainTagMenu.hidden) return;
  if (els.brainTagMenu.contains(event.target) || els.brainTagToggle.contains(event.target)) return;
  els.brainTagToggle.setAttribute("aria-expanded", "false");
  els.brainTagMenu.hidden = true;
});

els.processBrain.addEventListener("click", () => {
  const matching = state.brainNotes.filter((note) => !note.processed && (!state.brainTag || note.tags.includes(state.brainTag)));
  if (!matching.length) return;
  const ids = new Set(matching.map((note) => note.id));
  state.brainNotes = state.brainNotes.map((note) => ids.has(note.id) ? { ...note, processed: true } : note);
  saveBrainNotes();
  render();
  showToast(t("brainProcessed"), {
    actionLabel: t("undo"),
    action: () => {
      state.brainNotes = state.brainNotes.map((note) => ids.has(note.id) ? { ...note, processed: false } : note);
      saveBrainNotes();
      render();
    },
  });
});

document.querySelectorAll(".priority").forEach((button) => {
  button.addEventListener("click", () => {
    state.priority = button.dataset.priority;
    document.querySelectorAll(".priority").forEach((item) => item.classList.toggle("active", item === button));
    els.input.focus();
  });
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    state.category = null;
    state.filterMenuOpen = false;
    render();
  });
});

function filterByCategory(category) {
  state.category = category;
  state.filter = "category";
  state.filterMenuOpen = false;
  render();
}

function clearCategoryFilter() {
  state.category = null;
  state.filter = "active";
  render();
}

els.filterMenuToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  state.filterMenuOpen = !state.filterMenuOpen;
  updateFilterMenu();
});

els.filterMenu.addEventListener("click", (event) => {
  const categoryButton = event.target.closest("[data-category-filter]");
  if (categoryButton) filterByCategory(categoryButton.dataset.categoryFilter);
});

document.addEventListener("click", (event) => {
  if (!state.filterMenuOpen) return;
  if (els.filterMenu.contains(event.target) || els.filterMenuToggle.contains(event.target)) return;
  state.filterMenuOpen = false;
  updateFilterMenu();
});

function deleteCategory(category) {
  const confirmed = window.confirm(
    `Delete "${category}"? Its tasks will be kept in TO DO without a category.`
  );
  if (!confirmed) return;
  state.categories = state.categories.filter((item) => item !== category);
  delete state.categoryColors[category];
  state.todos = state.todos.map((todo) => (
    todo.category === category ? { ...todo, category: null } : todo
  ));
  if (state.newCategory === category) state.newCategory = null;
  saveCategories();
  saveCategoryColors();
  saveTodos();
  renderCategoryMenu();
  if (state.category === category) clearCategoryFilter();
  else render();
}

function closeCategoryMenu() {
  els.categoryMenu.hidden = true;
  els.catPickerBtn.setAttribute("aria-expanded", "false");
  state.categoryMenuTarget = null;
}

// Open the category menu anchored under a trigger button.
// target = null -> pick the category for NEW tasks; target = todo id -> tag that task.
function openCategoryMenu(anchor, target) {
  closeDuePicker();
  state.categoryMenuTarget = target;
  renderCategoryMenu();
  els.categoryMenu.hidden = false;
  els.catPickerBtn.setAttribute("aria-expanded", String(target === null));
  const rect = anchor.getBoundingClientRect();
  const width = els.categoryMenu.offsetWidth || 172;
  const height = els.categoryMenu.offsetHeight || 0;
  let left = target === null ? rect.right - width : rect.left;
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
  const flipUp = rect.bottom + 4 + height > window.innerHeight - 8;
  const top = flipUp ? Math.max(8, rect.top - height - 4) : rect.bottom + 4;
  els.categoryMenu.style.left = `${left}px`;
  els.categoryMenu.style.top = `${top}px`;
}

// Filter by clicking a task's category tag
els.list.addEventListener("click", (event) => {
  const tag = event.target.closest(".cat-tag");
  if (!tag || state.mode === "brain") return;
  filterByCategory(tag.dataset.category);
});

// ----- Due-date picker (shortcuts + mini calendar) -----
function anchorPopup(popup, anchor) {
  const rect = anchor.getBoundingClientRect();
  const width = popup.offsetWidth;
  const height = popup.offsetHeight;
  let left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const flipUp = rect.bottom + 4 + height > window.innerHeight - 8;
  const top = flipUp ? Math.max(8, rect.top - height - 4) : rect.bottom + 4;
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
}

function renderDueCalendar() {
  const view = state.dueView || startOfDay(new Date());
  const year = view.getFullYear();
  const month = view.getMonth();
  const locale = window.LowstateI18n.language === "pt" ? "pt-BR" : "en-US";
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(year, month, 1));
  els.dueMonthLabel.textContent = `${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)} ${year}`;
  els.dueCalGrid.replaceChildren();
  const startWeekday = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const todayISO = toISODate(new Date());
  const todo = state.dueTarget && state.dueTarget !== NEW_TASK_DUE_TARGET
    ? state.todos.find((t) => t.id === state.dueTarget)
    : null;
  const selectedISO = state.dueTarget === NEW_TASK_DUE_TARGET ? state.newDueDate : (todo ? todo.dueDate : null);
  for (let i = 0; i < startWeekday; i++) {
    const blank = document.createElement("span");
    els.dueCalGrid.append(blank);
  }
  for (let d = 1; d <= days; d++) {
    const iso = toISODate(new Date(year, month, d));
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "due-cal-day";
    btn.dataset.iso = iso;
    btn.textContent = d;
    if (iso === todayISO) btn.classList.add("is-today");
    if (iso === selectedISO) btn.classList.add("is-selected");
    els.dueCalGrid.append(btn);
  }
}

function openDuePicker(anchor, todoId) {
  closeCategoryMenu();
  state.dueTarget = todoId;
  const todo = todoId === NEW_TASK_DUE_TARGET ? null : state.todos.find((t) => t.id === todoId);
  const selectedDate = todoId === NEW_TASK_DUE_TARGET ? state.newDueDate : todo?.dueDate;
  const parsedDate = selectedDate ? parseISODate(selectedDate) : null;
  state.dueView = parsedDate ? startOfDay(parsedDate) : startOfDay(new Date());
  renderDueCalendar();
  els.duePicker.hidden = false;
  anchorPopup(els.duePicker, anchor);
}

function closeDuePicker() {
  els.duePicker.hidden = true;
  state.dueTarget = null;
}

function setDue(iso) {
  if (state.dueTarget === NEW_TASK_DUE_TARGET) {
    state.newDueDate = iso;
    updateNewDueButton();
  } else if (state.dueTarget) {
    updateTodo(state.dueTarget, { dueDate: iso });
  }
  closeDuePicker();
}

els.duePicker.addEventListener("click", (event) => {
  const quick = event.target.closest("[data-due]");
  if (quick) { setDue(quick.dataset.due === "clear" ? null : quickDueISO(quick.dataset.due)); return; }
  const day = event.target.closest(".due-cal-day");
  if (day) { setDue(day.dataset.iso); return; }
  const nav = event.target.closest("[data-cal-nav]");
  if (nav) {
    const view = state.dueView || startOfDay(new Date());
    state.dueView = new Date(view.getFullYear(), view.getMonth() + Number(nav.dataset.calNav), 1);
    renderDueCalendar();
  }
});

document.addEventListener("click", (event) => {
  if (els.duePicker.hidden) return;
  if (els.duePicker.contains(event.target) || event.target.closest(".due-chip") || event.target.closest("#newDueButton")) return;
  closeDuePicker();
});

// Clear the active category filter
els.activeCategoryChip.addEventListener("click", clearCategoryFilter);

// Open/close the category picker for NEW tasks
els.catPickerBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  if (els.categoryMenu.hidden) openCategoryMenu(els.catPickerBtn, null);
  else closeCategoryMenu();
});

els.categoryMenu.addEventListener("click", (event) => {
  const del = event.target.closest(".cat-menu-del");
  if (del) {
    event.stopPropagation();
    deleteCategory(del.dataset.del);
    return;
  }
  const pick = event.target.closest(".cat-menu-item");
  if (pick) {
    const category = pick.dataset.cat || null;
    const target = state.categoryMenuTarget;
    closeCategoryMenu();
    if (target) {
      updateTodo(target, { category });
    } else {
      state.newCategory = category;
      updateCategoryPicker();
      els.input.focus();
    }
    return;
  }
  if (event.target.closest(".cat-menu-new")) {
    state.categoryFormTarget = state.categoryMenuTarget;
    closeCategoryMenu();
    els.categoryForm.hidden = false;
    els.categoryInput.focus();
  }
});

// Close the category menu when clicking outside of it
document.addEventListener("click", (event) => {
  if (els.categoryMenu.hidden) return;
  if (els.categoryMenu.contains(event.target) || els.catPickerBtn.contains(event.target)) return;
  closeCategoryMenu();
});

els.urgentToggle.addEventListener("click", () => {
  state.urgentOnly = !state.urgentOnly;
  state.filterMenuOpen = false;
  render();
});

els.categoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.categoryInput.value.trim().toUpperCase();
  if (!name) return;
  if (!state.categories.includes(name)) {
    state.categories.push(name);
    saveCategories();
  }
  const selectedColor = els.categoryForm.querySelector('input[name="categoryColor"]:checked');
  state.categoryColors[name] = selectedColor ? selectedColor.value : "#c9dfd5";
  saveCategoryColors();
  const target = state.categoryFormTarget;
  state.categoryFormTarget = null;
  els.categoryInput.value = "";
  els.categoryForm.hidden = true;
  if (target) {
    updateTodo(target, { category: name });
  } else {
    state.newCategory = name;
    updateCategoryPicker();
    els.input.focus();
    render();
  }
});

els.list.addEventListener("click", (event) => {
  const item = event.target.closest(".quest-item");
  if (!item) return;
  const id = item.dataset.id;
  if (state.mode === "brain") {
    const note = state.brainNotes.find((entry) => entry.id === id);
    const tagButton = event.target.closest(".brain-tag");
    if (tagButton) {
      state.brainTag = tagButton.dataset.brainTag;
      render();
    } else if (event.target.closest(".brain-check")) {
      note.processed = !note.processed;
      saveBrainNotes();
      render();
    } else if (event.target.closest(".copy-note")) {
      navigator.clipboard.writeText(formatBrainNote(note))
        .then(() => showToast(t("copied")))
        .catch(() => showToast(t("copyFailed")));
    } else if (event.target.closest(".convert-note")) {
      addTodo(note.text);
      state.brainNotes = state.brainNotes.map((entry) => entry.id === id ? { ...entry, processed: true } : entry);
      saveBrainNotes();
      render();
      showToast(t("converted"));
    } else if (event.target.closest(".edit-note")) {
      state.editingId = id;
      render();
    } else if (event.target.closest(".delete-note")) {
      const index = state.brainNotes.findIndex((entry) => entry.id === id);
      const [deleted] = state.brainNotes.splice(index, 1);
      state.trash = store.trash("brain", deleted, index);
      const trashId = state.trash[0].id;
      saveBrainNotes();
      render();
      showToast(t("noteDeleted"), {
        actionLabel: t("undo"),
        action: () => {
          store.removeTrashEntry(trashId);
          state.trash = store.pruneTrash();
          state.brainNotes.splice(index, 0, deleted);
          saveBrainNotes();
          render();
        },
      });
    }
    return;
  }
  const tagBtn = event.target.closest(".tag-btn");
  if (tagBtn) {
    event.stopPropagation();
    if (els.categoryMenu.hidden || state.categoryMenuTarget !== id) openCategoryMenu(tagBtn, id);
    else closeCategoryMenu();
    return;
  }
  const dueBtn = event.target.closest(".due-chip");
  if (dueBtn) {
    event.stopPropagation();
    if (els.duePicker.hidden || state.dueTarget !== id) openDuePicker(dueBtn, id);
    else closeDuePicker();
    return;
  }
  if (event.target.closest(".check")) {
    const todo = state.todos.find((entry) => entry.id === id);
    const nowDone = !todo.done;
    if (nowDone && !prefersReducedMotion()) {
      item.classList.add("just-done");
      setTimeout(() => setTodoCompleted(id, true), 300);
    } else {
      setTodoCompleted(id, nowDone);
    }
  } else if (event.target.closest(".delete")) {
    deleteTodo(id);
  } else if (event.target.closest(".edit")) {
    state.editingId = id;
    render();
  }
});

els.list.addEventListener("keydown", (event) => {
  if (!event.target.matches(".edit-input")) return;
  const id = event.target.closest(".quest-item").dataset.id;
  if (event.key === "Enter") {
    const text = event.target.value.trim();
    if (text) {
      if (state.mode === "brain") updateBrainNote(id, text);
      else updateTodo(id, { title: text });
    }
  }
  if (event.key === "Escape") {
    state.editingId = null;
    render();
  }
});

els.list.addEventListener("focusout", (event) => {
  if (!event.target.matches(".edit-input") || state.editingId === null) return;
  const id = event.target.closest(".quest-item").dataset.id;
  const text = event.target.value.trim();
  state.editingId = null;
  if (text) {
    if (state.mode === "brain") updateBrainNote(id, text);
    else updateTodo(id, { title: text });
  } else {
    render();
  }
});

// ----- Drag to reorder tasks (only among tasks that share the same due date) -----
let dragId = null;

function clearDragIndicators() {
  els.list.querySelectorAll(".dragging, .drag-over-before, .drag-over-after").forEach((el) => {
    el.classList.remove("dragging", "drag-over-before", "drag-over-after");
  });
}

els.list.addEventListener("dragstart", (event) => {
  const handle = event.target.closest(".drag-handle");
  const item = handle?.closest(".quest-item");
  if (!handle || !item || state.mode === "brain") { event.preventDefault(); return; }
  clearDragIndicators(); // self-heal in case a previous drag left stray classes behind
  dragId = item.dataset.id;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", dragId);
  // Deferred one frame so the browser's native drag-ghost snapshot is taken
  // at full opacity; the left-behind row then fades once dragging is underway.
  requestAnimationFrame(() => item.classList.add("dragging"));
});

els.list.addEventListener("dragend", () => {
  clearDragIndicators();
  dragId = null;
});

els.list.addEventListener("dragover", (event) => {
  if (!dragId) return;
  const overItem = event.target.closest(".quest-item");
  if (!overItem || overItem.dataset.id === dragId) return;
  const dragged = state.todos.find((t) => t.id === dragId);
  const target = state.todos.find((t) => t.id === overItem.dataset.id);
  if (!dragged || !target || dragged.dueDate !== target.dueDate) {
    event.dataTransfer.dropEffect = "none";
    return;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  const after = event.clientY - overItem.getBoundingClientRect().top > overItem.offsetHeight / 2;
  els.list.querySelectorAll(".drag-over-before, .drag-over-after").forEach((el) => {
    el.classList.remove("drag-over-before", "drag-over-after");
  });
  overItem.classList.add(after ? "drag-over-after" : "drag-over-before");
});

els.list.addEventListener("drop", (event) => {
  if (!dragId) return;
  event.preventDefault();
  const overItem = event.target.closest(".quest-item");
  const targetId = overItem?.dataset.id;
  if (targetId && targetId !== dragId) {
    const after = event.clientY - overItem.getBoundingClientRect().top > overItem.offsetHeight / 2;
    reorderTodo(dragId, targetId, after);
  }
  clearDragIndicators();
  dragId = null;
});

els.clearDone.addEventListener("click", () => {
  const previousTodos = state.todos.slice();
  const removed = state.todos.map((todo, index) => ({ todo, index })).filter((entry) => entry.todo.done);
  const removedCount = removed.length;
  if (!removedCount) return;
  const trashIds = [];
  removed.forEach(({ todo, index }) => {
    state.trash = store.trash("todo", todo, index);
    trashIds.push(state.trash[0].id);
  });
  state.todos = state.todos.filter((todo) => !todo.done);
  saveTodos();
  render();
  showToast(t("clearedTasks").replace("{count}", removedCount), {
    actionLabel: t("undo"),
    action: () => {
      trashIds.forEach((id) => store.removeTrashEntry(id));
      state.trash = store.pruneTrash();
      state.todos = previousTodos;
      saveTodos();
      render();
    },
  });
});

// ----- Backup / restore (all data lives in localStorage) -----
function isAppKey(key) {
  return key.startsWith("type-todo.") || key.startsWith("quest-log.");
}

els.exportData.addEventListener("click", () => {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (isAppKey(key)) data[key] = localStorage.getItem(key);
  }
  const payload = { app: "lowstate", version: 2, exportedAt: new Date().toISOString(), data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lowstate-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  const previous = els.installHint.textContent;
  els.installHint.textContent = t("backupSaved");
  setTimeout(() => { els.installHint.textContent = previous; }, 1600);
});

els.importData.addEventListener("click", () => els.importFile.click());

els.importFile.addEventListener("change", async () => {
  const file = els.importFile.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const data = parsed && parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
    const keys = Object.keys(data || {}).filter(isAppKey);
    if (keys.length === 0) throw new Error("No Type Todo data found.");
    const ok = window.confirm(
      "Restore this backup? It will replace your current tasks, notes, categories and settings."
    );
    if (!ok) return;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (isAppKey(key)) localStorage.removeItem(key);
    }
    keys.forEach((key) => localStorage.setItem(key, data[key]));
    location.reload();
  } catch (error) {
    window.alert("Couldn't read that file — make sure it's a Type Todo backup (.json).");
  } finally {
    els.importFile.value = "";
  }
});

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function formatBrainNote(note) {
  const date = new Date(note.createdAt).toISOString().slice(0, 10);
  return `- ${note.text}\n  - captured: ${date}\n  - status: ${note.processed ? "processed" : "unprocessed"}`;
}

function brainMarkdown() {
  const title = els.notebookTitle.textContent;
  const notes = state.brainNotes.map(formatBrainNote).join("\n");
  return `# ${title} — Brain Inbox\n\n${notes || "_Inbox empty._"}\n`;
}

els.copyBrain.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(brainMarkdown());
    showToast("Brain Inbox copied");
  } catch {
    showToast("Couldn't copy to clipboard", { duration: 3500 });
  }
});

els.exportBrain.addEventListener("click", () => {
  const blob = new Blob([brainMarkdown()], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "brain-inbox.md";
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelectorAll("[data-style-value]").forEach((btn) => {
  btn.addEventListener("click", () => setStyle(btn.dataset.styleValue));
});

document.querySelectorAll("[data-theme-value]").forEach((btn) => {
  btn.addEventListener("click", () => applyTheme(btn.dataset.themeValue));
});

document.querySelectorAll("[data-font-size-value]").forEach((btn) => {
  btn.addEventListener("click", () => applyFontSize(btn.dataset.fontSizeValue));
});

document.querySelectorAll("[data-language-value]").forEach((btn) => {
  btn.addEventListener("click", () => {
    window.LowstateI18n.setLanguage(btn.dataset.languageValue);
    render();
  });
});

els.dismissOnboarding.addEventListener("click", () => {
  localStorage.setItem(ONBOARDING_KEY, "1");
  els.onboardingTip.hidden = true;
});

els.restoreTrash.addEventListener("click", () => {
  const entry = store.restoreLast();
  if (!entry) {
    showToast(t("trashEmpty"));
    return;
  }
  if (entry.type === "todo") {
    state.todos.splice(Math.min(entry.index ?? 0, state.todos.length), 0, entry.item);
    saveTodos();
  } else if (entry.type === "brain") {
    state.brainNotes.splice(Math.min(entry.index ?? 0, state.brainNotes.length), 0, entry.item);
    saveBrainNotes();
  }
  state.trash = store.pruneTrash();
  render();
  showToast(t("restored"));
});

els.emptyTrash.addEventListener("click", () => {
  if (!state.trash.length) return;
  if (!window.confirm(t("confirmEmptyTrash"))) return;
  store.emptyTrash();
  state.trash = [];
  render();
  showToast(t("trashCleared"));
});

document.querySelectorAll(".shortcut-key").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!window.desktopGadget) return;
    startRecordingShortcut(btn.dataset.shortcut);
  });
});

document.querySelectorAll(".shortcut-reset").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.shortcutReset;
    commitShortcut(key, DEFAULT_SHORTCUTS[key]);
  });
});

els.updateBannerButton.addEventListener("click", () => {
  if (pendingUpdateUrl) window.desktopGadget?.openExternal(pendingUpdateUrl);
});

document.querySelectorAll("[data-aot-value]").forEach((btn) => {
  btn.addEventListener("click", () => applyAlwaysOnTop(btn.dataset.aotValue === "on"));
});

els.settingsToggle.addEventListener("click", () => {
  state.settingsOpen = true;
  render();
});

els.settingsBack.addEventListener("click", () => {
  state.settingsOpen = false;
  render();
});

els.titleButton.addEventListener("click", () => {
  els.titleInput.value = els.notebookTitle.textContent;
  els.titleButton.hidden = true;
  els.titleForm.hidden = false;
  els.titleInput.focus();
  els.titleInput.select();
});

els.titleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = els.titleInput.value.trim().toUpperCase();
  if (title) {
    els.notebookTitle.textContent = title;
    localStorage.setItem(NOTEBOOK_TITLE_KEY, title);
  }
  els.titleForm.hidden = true;
  els.titleButton.hidden = false;
});

els.titleInput.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  els.titleForm.hidden = true;
  els.titleButton.hidden = false;
  els.titleButton.focus();
});

els.themePalette.addEventListener("click", (event) => {
  const button = event.target.closest("[data-cover]");
  if (!button) return;
  selectCover(button.dataset.cover);
});

// Custom cover — in-app hue/depth picker, expands inline within the settings page
function openCoverPicker() {
  refreshCoverPicker();
  els.coverPicker.hidden = false;
  els.coverPickerToggle.setAttribute("aria-expanded", "true");
}

function closeCoverPicker() {
  els.coverPicker.hidden = true;
  els.coverPickerToggle.setAttribute("aria-expanded", "false");
}

els.coverPickerToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  els.coverPicker.hidden ? openCoverPicker() : closeCoverPicker();
});

[els.coverHue, els.coverDepth].forEach((slider) => {
  slider.addEventListener("input", () => {
    refreshCoverPicker();
    selectCover("custom", coverMixHex());
    localStorage.setItem(COVER_MIX_KEY, `${els.coverHue.value},${els.coverDepth.value}`);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.settingsOpen) {
    state.settingsOpen = false;
    render();
    return;
  }
  if (event.key === "Escape" && document.documentElement.hasAttribute("data-compact")) {
    setCompact(false, false);
    return;
  }
  if (event.key.toLowerCase() === "n" && !state.settingsOpen && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    els.input.focus();
  }
});

// Due-date chips (TODAY/TOMORROW/overdue) are computed at render time, so a
// gadget left open across midnight would keep showing yesterday's labels
// until the next interaction. Poll for the calendar day changing and
// re-render then — skipped while typing so it never yanks focus mid-keystroke.
let lastKnownDay = toISODate(new Date());
function checkDayRollover() {
  const today = toISODate(new Date());
  if (today === lastKnownDay) return;
  if (state.mode === "tasks") {
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
    render();
  }
  lastKnownDay = today;
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

window.addEventListener("beforeinstallprompt", () => {
  els.installHint.textContent = "READY TO INSTALL";
});

setInterval(checkDayRollover, 60_000);
applyTheme(savedTheme);
applyStyle(savedStyle);
applyFontSize(savedFontSize);
if (window.desktopGadget) {
  els.settingsWindowSection.hidden = false;
  applyAlwaysOnTop(savedAlwaysOnTop);
  els.globalShortcuts.classList.add("shortcuts-editable");
  Object.keys(shortcuts).forEach(renderShortcut);
  window.desktopGadget.setShortcuts(shortcuts);
  window.desktopGadget.onUpdateAvailable(showUpdateAvailable);
}
selectCover(savedCover);
render();

const STORAGE_KEY = "quest-log.todos.v1";
const COVER_KEY = "type-todo.cover.v1";
const COVER_CUSTOM_KEY = "type-todo.cover-custom.v1";
const COVER_MIX_KEY = "type-todo.cover-mix.v1";
const THEME_KEY = "type-todo.theme.v1";
const STYLE_KEY = "type-todo.style.v1";
const CATEGORIES_KEY = "type-todo.categories.v1";
const CATEGORY_COLORS_KEY = "type-todo.category-colors.v1";
const NOTEBOOK_TITLE_KEY = "type-todo.notebook-title.v1";
const BRAIN_KEY = "type-todo.brain-inbox.v1";

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
  priority: "normal",
  editingId: null,
  mode: "tasks",
  brainNotes: loadBrainNotes(),
  brainFilter: "unprocessed",
  dueTarget: null,
  dueView: null,
};

// ----- Due dates -----
const MONTHS_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function startOfDay(date) {
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
  return clone;
}
function toISODate(date) {
  const d = startOfDay(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseISODate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function dueMeta(dueDate) {
  if (!dueDate) return { status: "none", label: "" };
  const due = startOfDay(parseISODate(dueDate));
  const diff = Math.round((due - startOfDay(new Date())) / 86400000);
  if (diff < 0) return { status: "overdue", label: `${due.getDate()} ${MONTHS_SHORT[due.getMonth()]}` };
  if (diff === 0) return { status: "today", label: "TODAY" };
  if (diff === 1) return { status: "future", label: "TOMORROW" };
  return { status: "future", label: `${due.getDate()} ${MONTHS_SHORT[due.getMonth()]}` };
}
function quickDueISO(kind) {
  const d = startOfDay(new Date());
  const wd = d.getDay();
  if (kind === "tomorrow") d.setDate(d.getDate() + 1);
  else if (kind === "weekend") d.setDate(d.getDate() + ((6 - wd + 7) % 7));
  else if (kind === "nextweek") d.setDate(d.getDate() + (((1 - wd + 7) % 7) || 7));
  return toISODate(d);
}

// One-time migration: tasks created before due dates existed (no dueDate field)
// get today's date. Tasks explicitly cleared ("NO DATE", dueDate: null) are left as-is.
if (state.todos.some((todo) => !("dueDate" in todo))) {
  const today = toISODate(new Date());
  state.todos.forEach((todo) => {
    if (!("dueDate" in todo)) todo.dueDate = today;
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
  activeCount: document.querySelector("#activeCount"),
  progressText: document.querySelector("#progressText"),
  progressBar: document.querySelector("#progressBar"),
  clearDone: document.querySelector("#clearDone"),
  clock: document.querySelector("#clock"),
  installHint: document.querySelector("#installHint"),
  themeToggle: document.querySelector("#themeToggle"),
  themePalette: document.querySelector("#themePalette"),
  catPickerBtn: document.querySelector("#catPickerBtn"),
  catPickerDot: document.querySelector("#catPickerDot"),
  catPickerLabel: document.querySelector("#catPickerLabel"),
  categoryMenu: document.querySelector("#categoryMenu"),
  activeCategoryChip: document.querySelector("#activeCategoryChip"),
  categoryForm: document.querySelector("#categoryForm"),
  categoryInput: document.querySelector("#categoryInput"),
  urgentToggle: document.querySelector("#urgentToggle"),
  nightToggle: document.querySelector("#nightToggle"),
  styleToggle: document.querySelector("#styleToggle"),
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
  titleButton: document.querySelector("#titleButton"),
  notebookTitle: document.querySelector("#notebookTitle"),
  titleForm: document.querySelector("#titleForm"),
  titleInput: document.querySelector("#titleInput"),
  brainTemplate: document.querySelector("#brainTemplate"),
  taskFilters: document.querySelector("#taskFilters"),
  brainFilters: document.querySelector("#brainFilters"),
  copyBrain: document.querySelector("#copyBrain"),
  exportBrain: document.querySelector("#exportBrain"),
  paperSlot: document.querySelector(".paper-slot span"),
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
  els.nightToggle.textContent = theme === "dark" ? "☀" : "☾";
  els.nightToggle.setAttribute("aria-pressed", String(theme === "dark"));
}

const savedStyle = localStorage.getItem(STYLE_KEY) || "notebook";

function applyStyle(style) {
  document.documentElement.dataset.style = style;
  localStorage.setItem(STYLE_KEY, style);
  const isMinimal = style === "minimal";
  els.styleToggle.textContent = isMinimal ? "▤" : "▭";
  els.styleToggle.setAttribute("aria-pressed", String(isMinimal));
  els.styleToggle.setAttribute("aria-label", isMinimal ? "Switch to notebook style" : "Switch to minimal style");
  els.styleToggle.title = isMinimal ? "Minimal style" : "Notebook style";
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
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function loadBrainNotes() {
  try {
    const saved = JSON.parse(localStorage.getItem(BRAIN_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveBrainNotes() {
  localStorage.setItem(BRAIN_KEY, JSON.stringify(state.brainNotes));
}

function loadCategories() {
  try {
    const saved = JSON.parse(localStorage.getItem(CATEGORIES_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveCategories() {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(state.categories));
}

function loadCategoryColors() {
  try {
    const saved = JSON.parse(localStorage.getItem(CATEGORY_COLORS_KEY));
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function saveCategoryColors() {
  localStorage.setItem(CATEGORY_COLORS_KEY, JSON.stringify(state.categoryColors));
}

function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.todos));
}

function addTodo(title) {
  const cleanTitle = title.trim();
  if (!cleanTitle) return;
  state.todos.unshift({
    id: crypto.randomUUID(),
    title: cleanTitle,
    priority: state.priority,
    category: state.newCategory,
    dueDate: toISODate(new Date()),
    order: -Date.now(),
    done: false,
    createdAt: Date.now(),
  });
  saveTodos();
  els.form.reset();
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

function deleteTodo(id) {
  state.todos = state.todos.filter((todo) => todo.id !== id);
  saveTodos();
  render();
}

function visibleTodos() {
  let todos;
  if (state.category) todos = state.todos.filter((todo) => todo.category === state.category);
  else if (state.filter === "active") todos = state.todos.filter((todo) => !todo.done);
  else if (state.filter === "done") todos = state.todos.filter((todo) => todo.done);
  else if (state.filter === "today") todos = state.todos.filter((todo) => !todo.done && dueMeta(todo.dueDate).status === "today");
  else if (state.filter === "overdue") todos = state.todos.filter((todo) => !todo.done && dueMeta(todo.dueDate).status === "overdue");
  else todos = state.todos;
  if (state.urgentOnly) todos = todos.filter((todo) => todo.priority === "boss");
  return todos.slice().sort((a, b) => {
    const ad = a.dueDate ? parseISODate(a.dueDate).getTime() : Infinity;
    const bd = b.dueDate ? parseISODate(b.dueDate).getTime() : Infinity;
    if (ad !== bd) return ad - bd;
    const ao = a.order ?? -a.createdAt;
    const bo = b.order ?? -b.createdAt;
    return ao !== bo ? ao - bo : b.createdAt - a.createdAt;
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

function render() {
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
  document.querySelector(".priority-picker").hidden = brainMode;
  document.querySelector(".priority-picker").style.display = brainMode ? "none" : "";
  document.querySelector(".cat-picker").style.display = brainMode ? "none" : "";
  if (brainMode) closeCategoryMenu();
  els.paperSlot.textContent = brainMode ? "BRAIN INBOX" : "TO-DO LIST";
  els.input.placeholder = brainMode ? "capture an idea, link, or note... #tag" : "type a task...";
  els.input.setAttribute("aria-label", brainMode ? "New brain capture" : "New task");
  els.form.querySelector(':scope > button[type="submit"]').setAttribute("aria-label", brainMode ? "Add capture" : "Add task");
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
    dueChip.textContent = meta.status === "none" ? "◷ date" : `◷ ${meta.label}`;
    dueChip.title = "Set due date";
    const editInput = item.querySelector(".edit-input");
    editInput.value = todo.title;
    item.querySelector(".check").setAttribute("aria-label", todo.done ? "Reopen task" : "Complete task");
    els.list.append(item);
    if (state.editingId === todo.id) requestAnimationFrame(() => editInput.focus());
  });

  const active = state.todos.filter((todo) => !todo.done).length;
  const done = state.todos.length - active;
  const percent = state.todos.length ? Math.round((done / state.todos.length) * 100) : 0;
  els.activeCount.textContent = active;
  els.progressText.textContent = `${done} / ${state.todos.length} DONE`;
  els.progressBar.style.width = `${percent}%`;
  els.empty.querySelector("p").textContent = "all quiet around here.";
  els.empty.classList.toggle("visible", todos.length === 0);
  els.clearDone.hidden = done === 0;
  els.urgentToggle.setAttribute("aria-pressed", String(state.urgentOnly));

  updateCategoryPicker();
  updateActiveCategoryChip();
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
  none.innerHTML = '<span class="cat-dot cat-dot-none"></span>No category';
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
  add.textContent = "＋ New category";
  els.categoryMenu.append(add);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderBrainInbox() {
  const notes = state.brainNotes.filter((note) => (
    state.brainFilter === "processed" ? note.processed : !note.processed
  ));
  notes.forEach((note, index) => {
    const item = els.brainTemplate.content.firstElementChild.cloneNode(true);
    item.dataset.id = note.id;
    item.classList.toggle("processed", note.processed);
    item.querySelector(".quest-title").textContent = note.text;
    item.querySelector(".brain-tags").textContent = note.tags.join(" ");
    item.querySelector(".brain-check").setAttribute("aria-label", note.processed ? "Mark as unprocessed" : "Mark as processed");
    els.list.append(item);
  });
  const unprocessed = state.brainNotes.filter((note) => !note.processed).length;
  const processed = state.brainNotes.length - unprocessed;
  const percent = state.brainNotes.length ? Math.round((processed / state.brainNotes.length) * 100) : 0;
  els.progressText.textContent = `${unprocessed} INBOX`;
  els.progressBar.style.width = `${percent}%`;
  els.empty.classList.toggle("visible", notes.length === 0);
  els.empty.querySelector("p").textContent = notes.length === 0 ? "nothing waiting to be processed." : "";
  els.clearDone.hidden = true;
  document.querySelectorAll("[data-brain-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.brainFilter === state.brainFilter);
  });
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

document.querySelectorAll(".priority").forEach((button) => {
  button.addEventListener("click", () => {
    state.priority = button.dataset.priority;
    document.querySelectorAll(".priority").forEach((item) => item.classList.toggle("active", item === button));
    els.input.focus();
  });
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    state.category = null;
    document.querySelectorAll(".filter").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});

function filterByCategory(category) {
  state.category = category;
  state.filter = "category";
  document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
  render();
}

function clearCategoryFilter() {
  state.category = null;
  state.filter = "active";
  document.querySelectorAll(".filter").forEach((item) => {
    item.classList.toggle("active", item.dataset.filter === "active");
  });
  render();
}

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
  els.dueMonthLabel.textContent = `${MONTHS_LONG[month]} ${year}`;
  els.dueCalGrid.replaceChildren();
  const startWeekday = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const todayISO = toISODate(new Date());
  const todo = state.dueTarget ? state.todos.find((t) => t.id === state.dueTarget) : null;
  const selectedISO = todo ? todo.dueDate : null;
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
  state.dueTarget = todoId;
  const todo = state.todos.find((t) => t.id === todoId);
  state.dueView = todo && todo.dueDate ? startOfDay(parseISODate(todo.dueDate)) : startOfDay(new Date());
  renderDueCalendar();
  els.duePicker.hidden = false;
  anchorPopup(els.duePicker, anchor);
}

function closeDuePicker() {
  els.duePicker.hidden = true;
  state.dueTarget = null;
}

function setDue(iso) {
  if (state.dueTarget) updateTodo(state.dueTarget, { dueDate: iso });
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
  if (els.duePicker.contains(event.target) || event.target.closest(".due-chip")) return;
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
    if (event.target.closest(".brain-check")) {
      note.processed = !note.processed;
      saveBrainNotes();
      render();
    } else if (event.target.closest(".copy-note")) {
      navigator.clipboard.writeText(formatBrainNote(note));
    } else if (event.target.closest(".delete-note")) {
      state.brainNotes = state.brainNotes.filter((entry) => entry.id !== id);
      saveBrainNotes();
      render();
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
      setTimeout(() => updateTodo(id, { done: true }), 300);
    } else {
      updateTodo(id, { done: nowDone });
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
    const title = event.target.value.trim();
    if (title) updateTodo(id, { title });
  }
  if (event.key === "Escape") {
    state.editingId = null;
    render();
  }
});

els.list.addEventListener("focusout", (event) => {
  if (!event.target.matches(".edit-input") || state.editingId === null) return;
  const id = event.target.closest(".quest-item").dataset.id;
  const title = event.target.value.trim();
  state.editingId = null;
  if (title) updateTodo(id, { title });
  else render();
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
  state.todos = state.todos.filter((todo) => !todo.done);
  saveTodos();
  render();
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
  const payload = { app: "type-todo", version: 1, exportedAt: new Date().toISOString(), data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `type-todo-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  const previous = els.installHint.textContent;
  els.installHint.textContent = "BACKUP SAVED";
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

els.copyBrain.addEventListener("click", () => {
  navigator.clipboard.writeText(brainMarkdown());
  els.copyBrain.textContent = "COPIED";
  setTimeout(() => { els.copyBrain.textContent = "COPY ALL"; }, 1200);
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

els.themeToggle.addEventListener("click", () => {
  els.themePalette.hidden = !els.themePalette.hidden;
  els.themeToggle.setAttribute("aria-expanded", String(!els.themePalette.hidden));
});

els.nightToggle.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

els.styleToggle.addEventListener("click", () => {
  applyStyle(document.documentElement.dataset.style === "minimal" ? "notebook" : "minimal");
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
  els.themePalette.hidden = true;
  els.themeToggle.setAttribute("aria-expanded", "false");
});

// Custom cover — in-app hue/depth picker
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

document.addEventListener("click", (event) => {
  if (els.coverPicker.hidden) return;
  if (els.coverPicker.contains(event.target) || els.coverPickerToggle.contains(event.target)) return;
  closeCoverPicker();
});

document.addEventListener("click", (event) => {
  if (els.themePalette.hidden) return;
  if (els.themePalette.contains(event.target) || els.themeToggle.contains(event.target)) return;
  els.themePalette.hidden = true;
  els.themeToggle.setAttribute("aria-expanded", "false");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.documentElement.hasAttribute("data-compact")) {
    setCompact(false, false);
    return;
  }
  if (event.key.toLowerCase() === "n" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    els.input.focus();
  }
});

function updateClock() {
  els.clock.textContent = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

window.addEventListener("beforeinstallprompt", () => {
  els.installHint.textContent = "READY TO INSTALL";
});

updateClock();
setInterval(updateClock, 30_000);
applyTheme(savedTheme);
applyStyle(savedStyle);
selectCover(savedCover);
render();

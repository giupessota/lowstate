const test = require("node:test");
const assert = require("node:assert/strict");
const {
  toISODate,
  parseISODate,
  dueMeta,
  quickDueISO,
  filterAndSortTodos,
  parseTaskCapture,
  formatAccelerator,
} = require("../core.js");

const NOW = new Date(2026, 7, 2, 14, 30);

test("date helpers use local calendar dates and reject invalid input", () => {
  assert.equal(toISODate(NOW), "2026-08-02");
  assert.equal(toISODate(parseISODate("2026-12-09")), "2026-12-09");
  assert.equal(parseISODate("2026-02-30"), null);
  assert.equal(parseISODate("not-a-date"), null);
});

test("due metadata distinguishes no date, overdue, today and tomorrow", () => {
  assert.deepEqual(dueMeta(null, NOW), { status: "none", label: "" });
  assert.deepEqual(dueMeta("2026-08-01", NOW), { status: "overdue", label: "1 AUG" });
  assert.deepEqual(dueMeta("2026-08-02", NOW), { status: "today", label: "TODAY" });
  assert.deepEqual(dueMeta("2026-08-03", NOW), { status: "future", label: "TOMORROW" });
});

test("quick date shortcuts handle tomorrow, weekend and next week", () => {
  assert.equal(quickDueISO("tomorrow", NOW), "2026-08-03");
  assert.equal(quickDueISO("weekend", NOW), "2026-08-08");
  assert.equal(quickDueISO("nextweek", NOW), "2026-08-03");
});

test("task filtering and sorting keep unscheduled tasks after scheduled tasks", () => {
  const todos = [
    { id: "none", done: false, dueDate: null, createdAt: 3, priority: "normal" },
    { id: "today", done: false, dueDate: "2026-08-02", createdAt: 2, priority: "boss" },
    { id: "late", done: false, dueDate: "2026-08-01", createdAt: 1, priority: "normal" },
    { id: "done", done: true, dueDate: "2026-08-01", createdAt: 4, priority: "boss" },
  ];

  assert.deepEqual(
    filterAndSortTodos(todos, { filter: "active" }, NOW).map((todo) => todo.id),
    ["late", "today", "none"]
  );
  assert.deepEqual(
    filterAndSortTodos(todos, { filter: "today" }, NOW).map((todo) => todo.id),
    ["today"]
  );
  assert.deepEqual(
    filterAndSortTodos(todos, { filter: "all", urgentOnly: true }, NOW).map((todo) => todo.id),
    ["done", "today"]
  );
});

test("quick capture syntax extracts category, urgency and relative date", () => {
  assert.deepEqual(parseTaskCapture("Enviar proposta #trabalho !urgente @amanhã", NOW), {
    title: "Enviar proposta",
    priority: "boss",
    dueDate: "2026-08-03",
    category: "TRABALHO",
  });
  assert.deepEqual(parseTaskCapture("Planejar semana @nextweek", NOW), {
    title: "Planejar semana",
    priority: null,
    dueDate: "2026-08-03",
    category: null,
  });
});

test("global shortcuts use native labels on macOS and Windows", () => {
  assert.equal(formatAccelerator("CommandOrControl+Shift+Space", "darwin"), "⌘⇧Space");
  assert.equal(formatAccelerator("CommandOrControl+Shift+Space", "win32"), "Ctrl+Shift+Space");
  assert.equal(formatAccelerator("CommandOrControl+Shift+N", "win32"), "Ctrl+Shift+N");
});

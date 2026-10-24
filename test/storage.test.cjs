const test = require("node:test");
const assert = require("node:assert/strict");
const storage = require("../storage.js");

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
  }

  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test("storage parser returns safe fallbacks for malformed data", () => {
  assert.deepEqual(storage.parse('{"ok":true}', {}), { ok: true });
  assert.deepEqual(storage.parse("broken", []), []);
});

test("Trash pruning keeps only entries from the last 30 days", () => {
  const now = Date.UTC(2026, 7, 2);
  const recent = { id: "recent", deletedAt: now - 2 * 86400000 };
  const expired = { id: "expired", deletedAt: now - 31 * 86400000 };
  assert.deepEqual(storage.pruneTrash([recent, expired], now), [recent]);
});

test("desktop snapshot restores missing local data and preserves newer local values", () => {
  const local = new MemoryStorage({
    "quest-log.todos.v1": '[{"id":"local"}]',
  });
  let saved;
  const bridge = {
    loadSnapshot: () => ({
      data: {
        "quest-log.todos.v1": '[{"id":"disk"}]',
        "type-todo.brain-inbox.v1": '[{"id":"recovered"}]',
      },
    }),
    saveSnapshot: (data) => { saved = data; return { ok: true }; },
  };

  const durable = storage.createStorage(local, bridge);

  assert.deepEqual(durable.loadArray("quest-log.todos.v1"), [{ id: "local" }]);
  assert.deepEqual(durable.loadArray("type-todo.brain-inbox.v1"), [{ id: "recovered" }]);
  assert.equal(saved["quest-log.todos.v1"], '[{"id":"local"}]');
  assert.equal(saved["type-todo.brain-inbox.v1"], '[{"id":"recovered"}]');
});

// A scheduler the test runs by hand instead of real timers.
function manualTimers() {
  const queue = new Map();
  let next = 1;
  return {
    schedule: (callback) => { queue.set(next, callback); return next++; },
    cancel: (id) => queue.delete(id),
    run: () => { const callbacks = [...queue.values()]; queue.clear(); callbacks.forEach((callback) => callback()); },
    get size() { return queue.size; },
  };
}

test("every app write is mirrored to the desktop snapshot, several writes in one", () => {
  const local = new MemoryStorage();
  const snapshots = [];
  const timers = manualTimers();
  const durable = storage.createStorage(local, {
    loadSnapshot: () => ({ data: {} }),
    saveSnapshot: (data) => { snapshots.push({ ...data }); return { ok: true, savedAt: "now" }; },
  }, timers);
  const before = snapshots.length;

  durable.save("quest-log.todos.v1", [{ id: "safe" }]);
  durable.save("type-todo.planner.notes.v1", { a: 1 });

  assert.equal(local.getItem("quest-log.todos.v1"), '[{"id":"safe"}]');
  assert.equal(snapshots.length, before);
  assert.equal(timers.size, 1);
  timers.run();
  assert.equal(snapshots.length, before + 1);
  assert.equal(snapshots.at(-1)["quest-log.todos.v1"], '[{"id":"safe"}]');
  assert.equal(snapshots.at(-1)["type-todo.planner.notes.v1"], '{"a":1}');

  durable.save("quest-log.todos.v1", []);
  assert.equal(durable.flush().ok, true);
  assert.equal(snapshots.at(-1)["quest-log.todos.v1"], "[]");
  assert.equal(timers.size, 0);
});

class FullStorage extends MemoryStorage {
  constructor(entries) {
    super(entries);
    this.full = false;
  }

  setItem(key, value) {
    if (this.full) throw new DOMException("quota", "QuotaExceededError");
    super.setItem(key, value);
  }
}

test("a write the page can't keep is reported, still read back, and can be retried", () => {
  const local = new FullStorage({ "type-todo.planner.items.v1": "[]" });
  const snapshots = [];
  const timers = manualTimers();
  const durable = storage.createStorage(local, {
    loadSnapshot: () => ({ data: {} }),
    saveSnapshot: (data) => { snapshots.push({ ...data }); return { ok: true }; },
  }, timers);
  const seen = [];
  durable.onStatus((status) => seen.push(status.local));

  local.full = true;
  assert.equal(durable.save("type-todo.planner.items.v1", [{ id: "new" }]), false);
  assert.equal(durable.getStatus().local, "failed");
  assert.equal(durable.getStatus().pending, 1);
  assert.deepEqual(seen, ["failed"]);
  // The app keeps working with its own data; exports and the disk copy have it.
  assert.deepEqual(durable.loadArray("type-todo.planner.items.v1"), [{ id: "new" }]);
  assert.equal(durable.collect()["type-todo.planner.items.v1"], '[{"id":"new"}]');
  timers.run();
  assert.equal(snapshots.at(-1)["type-todo.planner.items.v1"], '[{"id":"new"}]');

  assert.equal(durable.retry().local, "failed");
  local.full = false;
  assert.equal(durable.retry().local, "ok");
  assert.equal(local.getItem("type-todo.planner.items.v1"), '[{"id":"new"}]');
  assert.deepEqual(seen, ["failed", "ok"]);
});

test("a failing desktop copy is reported separately and clears on the next good save", () => {
  let fail = false;
  const timers = manualTimers();
  const durable = storage.createStorage(new MemoryStorage(), {
    loadSnapshot: () => ({ data: {} }),
    saveSnapshot: () => (fail ? { ok: false } : { ok: true, savedAt: "t" }),
  }, timers);
  assert.equal(durable.getStatus().desktop, "ok");
  fail = true;
  durable.save("type-todo.theme.v1", "dark");
  timers.run();
  assert.deepEqual([durable.getStatus().local, durable.getStatus().desktop], ["ok", "failed"]);
  fail = false;
  assert.equal(durable.retry().desktop, "ok");

  const browserOnly = storage.createStorage(new MemoryStorage(), null, timers);
  assert.equal(browserOnly.getStatus().desktop, "off");
});

test("backup restore replaces both local and desktop data in one snapshot", () => {
  const local = new MemoryStorage({
    "quest-log.todos.v1": '[{"id":"old"}]',
    "type-todo.theme.v1": "dark",
  });
  let saved;
  const durable = storage.createStorage(local, {
    loadSnapshot: () => ({ data: {} }),
    saveSnapshot: (data) => { saved = data; return { ok: true }; },
  });

  durable.replaceAll({ "quest-log.todos.v1": '[{"id":"imported"}]' });

  assert.equal(local.getItem("quest-log.todos.v1"), '[{"id":"imported"}]');
  assert.equal(local.getItem("type-todo.theme.v1"), null);
  assert.deepEqual(saved, { "quest-log.todos.v1": '[{"id":"imported"}]' });
});

const items = (n) => JSON.stringify(Array.from({ length: n }, (_, index) => ({ id: `t${index}`, title: "t" })));

test("backups: every format Lowstate exported is accepted and summarized", () => {
  const current = storage.readBackup(JSON.stringify({
    app: "lowstate", version: 3, exportedAt: "2026-10-20T12:00:00.000Z",
    data: {
      "type-todo.planner.items.v1": items(3),
      "type-todo.planner.habits.v1": JSON.stringify([{ id: "h" }]),
      "type-todo.theme.v1": "dark",
      foreign: "ignored",
    },
  }));
  assert.equal(current.ok, true);
  assert.deepEqual(current.info, { date: "2026-10-20T12:00:00.000Z", generation: 2, tasks: 3, habits: 1, keys: 3 });
  assert.equal(current.data.foreign, undefined);

  const notebook = storage.readBackup(JSON.stringify({
    app: "type-todo", version: 1, exportedAt: "2026-03-01T09:00:00.000Z", data: { "quest-log.todos.v1": items(5) },
  }));
  assert.deepEqual([notebook.ok, notebook.info.generation, notebook.info.tasks], [true, 1, 5]);

  const snapshotFile = storage.readBackup(JSON.stringify({
    app: "lowstate", version: 1, savedAt: "2026-10-22T07:49:00.000Z", data: { "type-todo.planner.items.v1": items(2) },
  }));
  assert.deepEqual([snapshotFile.ok, snapshotFile.info.date, snapshotFile.info.tasks], [true, "2026-10-22T07:49:00.000Z", 2]);

  const bare = storage.readBackup(JSON.stringify({ "quest-log.todos.v1": items(1) }));
  assert.deepEqual([bare.ok, bare.info.date, bare.info.tasks], [true, null, 1]);
});

test("backups: invalid files are refused before anything changes", () => {
  assert.deepEqual(storage.readBackup("{ not json"), { ok: false, error: "not-json" });
  assert.deepEqual(storage.readBackup("[1,2]"), { ok: false, error: "not-lowstate" });
  assert.deepEqual(storage.readBackup(JSON.stringify({ app: "other", data: { "type-todo.x": "1" } })), { ok: false, error: "not-lowstate" });
  assert.deepEqual(storage.readBackup(JSON.stringify({ app: "lowstate", version: 9, data: { "type-todo.x": "1" } })), { ok: false, error: "newer" });
  assert.deepEqual(storage.readBackup(JSON.stringify({ app: "lowstate", version: 3, data: { foreign: "x" } })), { ok: false, error: "empty" });
  assert.deepEqual(
    storage.readBackup(JSON.stringify({ app: "lowstate", version: 3, data: { "type-todo.planner.items.v1": "{\"not\":\"a list\"}" } })),
    { ok: false, error: "corrupt", key: "type-todo.planner.items.v1" });
  assert.deepEqual(
    storage.readBackup(JSON.stringify({ app: "lowstate", version: 3, data: { "type-todo.planner.notes.v1": "{broken" } })),
    { ok: false, error: "corrupt", key: "type-todo.planner.notes.v1" });
  assert.deepEqual(
    storage.readBackup(JSON.stringify({ app: "lowstate", version: 3, data: { "type-todo.planner.items.v1": [] } })),
    { ok: false, error: "corrupt", key: "type-todo.planner.items.v1" });
});

test("restore: a write that fails half-way puts the previous data back", () => {
  const local = new FullStorage({
    "type-todo.planner.items.v1": items(2),
    "type-todo.theme.v1": "light",
  });
  const snapshots = [];
  const durable = storage.createStorage(local, {
    loadSnapshot: () => ({ data: {} }),
    saveSnapshot: (data) => { snapshots.push({ ...data }); return { ok: true }; },
  }, manualTimers());
  const before = durable.collect();
  // Room for one key only.
  let writes = 0;
  local.setItem = function setItem(key, value) {
    if (++writes === 2) throw new DOMException("quota", "QuotaExceededError");
    MemoryStorage.prototype.setItem.call(this, key, value);
  };

  const result = durable.replaceAll({
    "type-todo.planner.items.v1": items(9),
    "type-todo.planner.habits.v1": "[]",
    "type-todo.theme.v1": "dark",
  });

  assert.deepEqual(result, { ok: false, error: "local" });
  assert.deepEqual(durable.collect(), before);
  assert.deepEqual(snapshots.at(-1), before);
  assert.equal(durable.getStatus().local, "ok");
});

test("restore: success replaces the data, writes the snapshot, and keeps a restore point", () => {
  const points = [];
  const durable = storage.createStorage(new MemoryStorage({ "type-todo.planner.items.v1": items(2) }), {
    loadSnapshot: () => ({ data: {} }),
    saveSnapshot: () => ({ ok: true }),
    saveRestorePoint: (data) => { points.push(data); return { ok: true, file: "before-restore.json" }; },
  }, manualTimers());
  assert.deepEqual(durable.keepRestorePoint(), { ok: true, file: "before-restore.json" });
  assert.equal(points[0]["type-todo.planner.items.v1"], items(2));
  const backup = storage.readBackup(JSON.stringify(durable.backupPayload()));
  assert.equal(backup.info.tasks, 2);
  assert.deepEqual(durable.replaceAll({ "type-todo.planner.items.v1": items(4) }), { ok: true, desktop: true });
  assert.equal(durable.loadArray("type-todo.planner.items.v1").length, 4);
  assert.deepEqual(storage.createStorage(new MemoryStorage(), null).keepRestorePoint(), { ok: false, error: "unsupported" });
});

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

test("every app write is mirrored to the desktop snapshot", () => {
  const local = new MemoryStorage();
  const snapshots = [];
  const durable = storage.createStorage(local, {
    loadSnapshot: () => ({ data: {} }),
    saveSnapshot: (data) => { snapshots.push({ ...data }); return { ok: true }; },
  });

  durable.save("quest-log.todos.v1", [{ id: "safe" }]);

  assert.equal(local.getItem("quest-log.todos.v1"), '[{"id":"safe"}]');
  assert.equal(snapshots.at(-1)["quest-log.todos.v1"], '[{"id":"safe"}]');
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

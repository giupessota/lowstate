const test = require("node:test");
const assert = require("node:assert/strict");
const storage = require("../storage.js");

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

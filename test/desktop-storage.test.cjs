const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  parseSnapshot,
  loadSnapshot,
  saveSnapshot,
  saveRestorePoint,
} = require("../desktop-storage.cjs");

test("desktop snapshot accepts only Lowstate string data", () => {
  const snapshot = parseSnapshot(JSON.stringify({
    app: "lowstate",
    version: 1,
    savedAt: "2026-08-04T12:00:00.000Z",
    data: {
      "quest-log.todos.v1": "[]",
      "type-todo.theme.v1": "light",
      foreign: "ignored",
      "type-todo.invalid": { nested: true },
    },
  }));

  assert.deepEqual(snapshot.data, {
    "quest-log.todos.v1": "[]",
    "type-todo.theme.v1": "light",
  });
  assert.equal(parseSnapshot("broken"), null);
});

test("desktop snapshot writes atomically and keeps the previous valid copy", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lowstate-storage-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const current = path.join(directory, "lowstate-data.json");
  const backup = path.join(directory, "lowstate-data.backup.json");

  saveSnapshot(current, backup, { "quest-log.todos.v1": '[{"id":"first"}]' }, {
    now: new Date("2026-08-04T12:00:00.000Z"),
  });
  saveSnapshot(current, backup, { "quest-log.todos.v1": '[{"id":"second"}]' }, {
    now: new Date("2026-08-04T12:01:00.000Z"),
  });

  assert.equal(loadSnapshot(current, backup).data["quest-log.todos.v1"], '[{"id":"second"}]');
  assert.equal(JSON.parse(fs.readFileSync(backup, "utf8")).data["quest-log.todos.v1"], '[{"id":"first"}]');
});

test("desktop snapshot falls back to the backup when the current file is damaged", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lowstate-recovery-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const current = path.join(directory, "lowstate-data.json");
  const backup = path.join(directory, "lowstate-data.backup.json");
  fs.writeFileSync(current, "damaged");
  fs.writeFileSync(backup, JSON.stringify({
    app: "lowstate",
    version: 1,
    data: { "type-todo.brain-inbox.v1": '[{"id":"safe"}]' },
  }));

  assert.equal(loadSnapshot(current, backup).data["type-todo.brain-inbox.v1"], '[{"id":"safe"}]');

  saveSnapshot(current, backup, { "type-todo.brain-inbox.v1": '[{"id":"new"}]' });
  assert.equal(loadSnapshot(current, backup).data["type-todo.brain-inbox.v1"], '[{"id":"new"}]');
  assert.equal(JSON.parse(fs.readFileSync(backup, "utf8")).data["type-todo.brain-inbox.v1"], '[{"id":"safe"}]');
});

test("restore points are readable snapshots and only the newest five are kept", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lowstate-restore-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (let minute = 0; minute < 7; minute++) {
    saveRestorePoint(directory, { "type-todo.planner.items.v1": `[${minute}]`, foreign: "x" }, {
      now: new Date(Date.UTC(2026, 9, 23, 12, minute)),
    });
  }
  const files = fs.readdirSync(directory).sort();
  assert.equal(files.length, 5);
  assert.equal(files[0], "before-restore-2026-10-23_12-02-00.json");
  const last = loadSnapshot(path.join(directory, files.at(-1)), path.join(directory, "none.json"));
  assert.deepEqual(last.data, { "type-todo.planner.items.v1": "[6]" });
});

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { trackChanges, unionValues, combine, createSync, suggestFolders, isSyncedKey } = require("../desktop-sync.cjs");

const ITEMS = "type-todo.planner.items.v1";
const NOTES = "type-todo.planner.daynotes.v1";
const THEME = "type-todo.theme.v1";
const SHORTCUTS = "type-todo.shortcuts.v1";

test("changes are tracked per key; computer-only settings are left out", () => {
  const meta = trackChanges({ [ITEMS]: "[]", [THEME]: "light" }, { [ITEMS]: "[1]", [THEME]: "light", [NOTES]: "{}", [SHORTCUTS]: "{}" }, {}, "mac", 5);
  assert.deepEqual(meta, { [ITEMS]: { at: 5, by: "mac" }, [NOTES]: { at: 5, by: "mac" } });
  assert.deepEqual(trackChanges({ [THEME]: "dark" }, {}, meta, "mac", 6)[THEME], { at: 6, by: "mac" });
  assert.equal(isSyncedKey(SHORTCUTS), false);
  assert.equal(isSyncedKey("foreign"), false);
});

test("joining adds lists and day maps together instead of picking one side", () => {
  assert.deepEqual(JSON.parse(unionValues('[{"id":"a","t":1},{"id":"b"}]', '[{"id":"a","t":2},{"id":"c"}]')),
    [{ id: "a", t: 2 }, { id: "b" }, { id: "c" }]);
  assert.deepEqual(JSON.parse(unionValues('{"2026-10-01":"x"}', '{"2026-10-02":"y"}')), { "2026-10-01": "x", "2026-10-02": "y" });
  assert.deepEqual(JSON.parse(unionValues('{"items":[{"id":"m"}],"history":{"a":1}}', '{"items":[{"id":"w"}],"history":{"b":1}}')),
    { items: [{ id: "m" }, { id: "w" }], history: { a: 1, b: 1 } });
  assert.equal(unionValues("light", "dark"), "dark");
});

test("after joining, the newest change of each key wins, removals included", () => {
  const local = { data: { [ITEMS]: "[1]", [THEME]: "light", [NOTES]: "{}" }, meta: { [ITEMS]: { at: 10, by: "mac" }, [THEME]: { at: 3, by: "mac" }, [NOTES]: { at: 2, by: "mac" } } };
  const windows = { device: "win", keys: {
    [ITEMS]: { value: "[0]", at: 5, by: "win" },
    [THEME]: { value: "dark", at: 8, by: "win" },
    [NOTES]: { value: null, at: 9, by: "win" },
  } };
  const result = combine(local, [windows], { device: "mac", now: 20 });
  assert.deepEqual(result.incoming, { [THEME]: "dark", [NOTES]: null });
  assert.deepEqual(result.data, { [ITEMS]: "[1]", [THEME]: "dark" });
  assert.equal(result.meta[THEME].by, "win");
});

function computer(folder, name, initial = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `lowstate-${name}-`));
  let data = { ...initial };
  const restorePoints = [];
  let clock = 1000;
  const sync = createSync({
    configFile: path.join(dir, "sync.json"),
    metaFile: path.join(dir, "sync-meta.json"),
    loadData: () => data,
    saveData: (next) => { data = { ...next }; },
    restorePoint: (snapshot) => restorePoints.push({ ...snapshot }),
    hostname: name,
    platform: name === "mac" ? "darwin" : "win32",
    now: () => clock,
  });
  return {
    sync,
    restorePoints,
    get data() { return data; },
    // A save from the page: the snapshot changes, the engine is told.
    // A save the engine isn't told about (syncing was off).
    saveQuietly(changes) {
      data = { ...data, ...changes };
    },
    edit(changes) {
      clock += 10;
      data = { ...data, ...changes };
      Object.keys(changes).forEach((key) => changes[key] === null && delete data[key]);
      sync.noteLocal(data);
    },
    tick(ms = 10) { clock += ms; },
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

test("two computers sharing a folder: first join keeps both sides, then changes travel", async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lowstate-drive-"));
  const win = computer(folder, "win", {
    [ITEMS]: JSON.stringify([{ id: "w1", title: "Relatório" }]),
    [NOTES]: JSON.stringify({ "2026-10-20": "Notas do Windows" }),
    [THEME]: "dark",
    [SHORTCUTS]: '{"capture":"Ctrl+Shift+N"}',
  });
  const mac = computer(folder, "mac", {
    [ITEMS]: JSON.stringify([{ id: "m1", title: "Dentista" }]),
    [NOTES]: JSON.stringify({ "2026-10-21": "Notas do Mac" }),
    [SHORTCUTS]: '{"capture":"Cmd+Shift+N"}',
  });
  t.after(() => { win.cleanup(); mac.cleanup(); fs.rmSync(folder, { recursive: true, force: true }); });

  // Windows connects first: nothing to take in, its file is written.
  assert.deepEqual((await win.sync.connect(folder)).incoming, {});
  assert.equal(win.restorePoints.length, 0);

  // The Mac joins: both computers' tasks and notes are kept, a copy of the
  // Mac's data was saved first, and the shortcuts stay as they were.
  mac.tick(100);
  const joined = await mac.sync.connect(folder);
  assert.equal(mac.restorePoints.length, 1);
  assert.deepEqual(JSON.parse(mac.data[ITEMS]).map((item) => item.id).sort(), ["m1", "w1"]);
  assert.deepEqual(Object.keys(JSON.parse(mac.data[NOTES])).sort(), ["2026-10-20", "2026-10-21"]);
  assert.equal(mac.data[THEME], "dark");
  assert.equal(mac.data[SHORTCUTS], '{"capture":"Cmd+Shift+N"}');
  assert.ok(joined.incoming[ITEMS]);
  assert.deepEqual(mac.sync.info().others.map((other) => other.name), ["win"]);

  // Windows picks up the combined data.
  win.tick(200);
  await win.sync.sync();
  assert.deepEqual(JSON.parse(win.data[ITEMS]).map((item) => item.id).sort(), ["m1", "w1"]);
  assert.equal(win.data[SHORTCUTS], '{"capture":"Ctrl+Shift+N"}');

  // Steady state: a change on the Mac reaches Windows, a later change on
  // Windows reaches the Mac, and removing a key travels too.
  mac.tick(300);
  mac.edit({ [THEME]: "light" });
  await mac.sync.sync();
  win.tick(400);
  assert.deepEqual((await win.sync.sync()).incoming, { [THEME]: "light" });
  win.edit({ [ITEMS]: JSON.stringify([{ id: "w1", title: "Relatório", done: true }]), [NOTES]: null });
  await win.sync.sync();
  mac.tick(500);
  const back = (await mac.sync.sync()).incoming;
  assert.deepEqual(Object.keys(back).sort(), [NOTES, ITEMS].sort());
  assert.equal(mac.data[NOTES], undefined);
  assert.equal(JSON.parse(mac.data[ITEMS])[0].done, true);
  // Nothing new: nothing comes in.
  assert.deepEqual((await mac.sync.sync()).incoming, {});
});

test("an unavailable folder is reported and nothing local changes", async (t) => {
  const mac = computer("/nowhere", "mac", { [THEME]: "dark" });
  t.after(() => mac.cleanup());
  await mac.sync.connect(path.join(os.tmpdir(), "lowstate-missing-folder-xyz"));
  assert.equal(mac.sync.info().state, "unavailable");
  assert.equal(mac.data[THEME], "dark");
  mac.sync.disconnect();
  assert.equal(mac.sync.info().state, "off");
  assert.equal(mac.sync.info().folder, null);
});

test("Google Drive folders are suggested on macOS and Windows", () => {
  const mac = suggestFolders({
    home: "/Users/g",
    platform: "darwin",
    list: () => ["GoogleDrive-g@gmail.com", "Other"],
    exists: (candidate) => candidate === "/Users/g/Library/CloudStorage/GoogleDrive-g@gmail.com/Meu Drive",
  });
  assert.deepEqual(mac, [{ kind: "google", path: "/Users/g/Library/CloudStorage/GoogleDrive-g@gmail.com/Meu Drive" }]);
  const win = suggestFolders({ home: "C:\\Users\\g", platform: "win32", exists: (candidate) => candidate === "G:\\My Drive" });
  assert.deepEqual(win, [{ kind: "google", path: "G:\\My Drive" }]);
});

test("a 2.5 folder setting keeps working after the update", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lowstate-upgrade-"));
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lowstate-upgrade-drive-"));
  t.after(() => { fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(folder, { recursive: true, force: true }); });
  fs.writeFileSync(path.join(dir, "sync.json"), JSON.stringify({ device: "dold", folder, joined: true }));
  const sync = createSync({
    configFile: path.join(dir, "sync.json"),
    metaFile: path.join(dir, "sync-meta.json"),
    loadData: () => ({ [THEME]: "dark" }),
    saveData: () => {},
    hostname: "pc",
    platform: "win32",
  });
  assert.equal(sync.active, true);
  assert.deepEqual(sync.info().target, { kind: "folder", label: folder });
  await sync.sync();
  assert.ok(fs.existsSync(path.join(folder, "Lowstate", "devices", "dold.json")));
});

test("changes made before connecting (while sync was off) are what goes out, not the startup data", async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lowstate-late-"));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const pc = computer(folder, "win", { [ITEMS]: JSON.stringify([{ id: "t1", focus: "later" }]) });
  const mac = computer(folder, "mac", { [ITEMS]: JSON.stringify([{ id: "m1" }]) });
  t.after(() => { pc.cleanup(); mac.cleanup(); });
  // The PC app opened, then the task moved to "must" before signing in:
  // the page saved it, but the engine wasn't told (sync was off).
  pc.saveQuietly({ [ITEMS]: JSON.stringify([{ id: "t1", focus: "must" }]) });
  await pc.sync.connect(folder);
  mac.tick(100);
  await mac.sync.connect(folder);
  assert.equal(JSON.parse(mac.data[ITEMS]).find((item) => item.id === "t1").focus, "must");
  pc.tick(200);
  await pc.sync.sync();
  assert.equal(JSON.parse(pc.data[ITEMS]).find((item) => item.id === "t1").focus, "must");
});

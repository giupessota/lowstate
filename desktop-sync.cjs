// Keeping the same data on several computers through a folder that a sync
// app already keeps in step (Google Drive for desktop, iCloud Drive,
// OneDrive, Dropbox). No account, no server: each computer writes only its
// own file in "<folder>/Lowstate/devices/<device>.json", so two computers
// never write the same file, and reads the others' files.
//
// Every app key carries when it last changed and on which computer. When
// files are combined, the newest change of each key wins (one person using
// one computer at a time is the expected case). The first time a computer
// joins a folder that already has data, lists of things (tasks, habits,
// notes by day…) from both sides are added together instead, and a copy of
// the local data is kept before anything changes.

const fs = require("fs");
const path = require("path");

const SYNC_VERSION = 1;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
// Settings that belong to one computer (keyboard shortcuts differ between
// macOS and Windows; "always on top" is a per-screen choice).
const LOCAL_ONLY = new Set(["type-todo.always-on-top.v1", "type-todo.shortcuts.v1"]);

function isAppKey(key) {
  return typeof key === "string" && (key.startsWith("type-todo.") || key.startsWith("quest-log."));
}

const isSyncedKey = (key) => isAppKey(key) && !LOCAL_ONLY.has(key);

// ---------- change tracking ----------

// Marks the keys whose value changed between two snapshots (null = removed).
function trackChanges(previous, next, meta, device, now = Date.now()) {
  const result = { ...meta };
  const keys = new Set([...Object.keys(previous || {}), ...Object.keys(next || {})]);
  keys.forEach((key) => {
    if (!isSyncedKey(key)) return;
    const before = previous?.[key] ?? null;
    const after = next?.[key] ?? null;
    if (before !== after) result[key] = { at: now, by: device };
  });
  return result;
}

// ---------- combining ----------

function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const isRecordList = (value) => Array.isArray(value) && value.every((entry) => entry && typeof entry === "object" && typeof entry.id === "string");
const isPlainObject = (value) => value && typeof value === "object" && !Array.isArray(value);

// First join only: two versions of the same key are added together when
// they are lists of records (by id) or maps (by key, e.g. notes by day);
// the incoming version wins where both have the same entry.
function unionValues(local, incoming) {
  const a = parseJSON(local);
  const b = parseJSON(incoming);
  if (isRecordList(a) && isRecordList(b)) {
    const byId = new Map(a.map((entry) => [entry.id, entry]));
    b.forEach((entry) => byId.set(entry.id, entry));
    return JSON.stringify([...byId.values()]);
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    // One level down too (the shopping list's { items, history }).
    const merged = { ...a, ...b };
    Object.keys(merged).forEach((key) => {
      if ((isRecordList(a[key]) && isRecordList(b[key])) || (isPlainObject(a[key]) && isPlainObject(b[key]))) {
        merged[key] = JSON.parse(unionValues(JSON.stringify(a[key]), JSON.stringify(b[key])));
      }
    });
    return JSON.stringify(merged);
  }
  return incoming;
}

// Picks, for each key, the newest change among this computer and the
// others. Returns what this computer has to take in (`incoming`: key →
// value or null for removed) and the combined data and change times.
function combine({ data, meta }, others, { join = false, device, now = Date.now() } = {}) {
  const merged = { ...data };
  const mergedMeta = { ...meta };
  const incoming = {};
  const sources = {};
  others.forEach((other) => {
    Object.entries(other.keys || {}).forEach(([key, entry]) => {
      if (!isSyncedKey(key) || !entry || typeof entry.at !== "number") return;
      const best = sources[key];
      if (!best || entry.at > best.at) sources[key] = { ...entry, device: other.device };
    });
  });
  Object.entries(sources).forEach(([key, remote]) => {
    const value = typeof remote.value === "string" ? remote.value : null;
    const mine = data[key] ?? null;
    if (value === mine) {
      if ((mergedMeta[key]?.at || 0) < remote.at) mergedMeta[key] = { at: remote.at, by: remote.by };
      return;
    }
    if (join && mine !== null && value !== null) {
      const union = unionValues(mine, value);
      if (union !== mine) {
        merged[key] = union;
        incoming[key] = union;
      }
      mergedMeta[key] = { at: now, by: device };
      return;
    }
    const localAt = join ? 0 : mergedMeta[key]?.at || 0;
    if (remote.at > localAt) {
      if (value === null) delete merged[key];
      else merged[key] = value;
      incoming[key] = value;
      mergedMeta[key] = { at: remote.at, by: remote.by };
    }
  });
  if (join) {
    // Keys only this computer has now count as changed here, so they spread.
    Object.keys(merged).forEach((key) => {
      if (isSyncedKey(key) && !sources[key]) mergedMeta[key] = { at: now, by: device };
    });
  }
  return { data: merged, meta: mergedMeta, incoming };
}

// ---------- files ----------

function readJSONFile(file) {
  try {
    const stat = fs.statSync(file);
    if (stat.size > MAX_FILE_BYTES) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeJSONFile(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

const syncDir = (folder) => path.join(folder, "Lowstate", "devices");

// The other computers' files (cloud apps' conflict copies such as
// "abc (1).json" are read too: they are still that computer's data).
function readOthers(folder, device) {
  let names = [];
  try {
    names = fs.readdirSync(syncDir(folder));
  } catch {
    return null;
  }
  return names
    .filter((name) => name.endsWith(".json") && !name.startsWith(`${device}.`) && !name.startsWith(`${device} `))
    .map((name) => readJSONFile(path.join(syncDir(folder), name)))
    .filter((file) => file && file.app === "lowstate" && file.version <= SYNC_VERSION && file.device && file.device !== device && isPlainObject(file.keys));
}

function writeOwn(folder, { device, name, platform, data, meta, now = Date.now() }) {
  const keys = {};
  Object.entries(meta).forEach(([key, entry]) => {
    if (!isSyncedKey(key)) return;
    keys[key] = { value: typeof data[key] === "string" ? data[key] : null, at: entry.at, by: entry.by };
  });
  Object.keys(data).forEach((key) => {
    if (isSyncedKey(key) && !keys[key]) keys[key] = { value: data[key], at: 0, by: device };
  });
  writeJSONFile(path.join(syncDir(folder), `${device}.json`), {
    app: "lowstate", version: SYNC_VERSION, device, name, platform, savedAt: now, keys,
  });
}

// Usual places of Google Drive for desktop, to offer as the folder.
function suggestFolders({ home, platform, exists = fs.existsSync, list = (dir) => fs.readdirSync(dir) }) {
  const found = [];
  const drives = ["My Drive", "Meu Drive", "Mi unidad"];
  if (platform === "darwin") {
    const cloud = path.join(home, "Library", "CloudStorage");
    try {
      list(cloud).filter((entry) => entry.startsWith("GoogleDrive-")).forEach((entry) => {
        drives.forEach((drive) => {
          const candidate = path.join(cloud, entry, drive);
          if (exists(candidate)) found.push({ kind: "google", path: candidate });
        });
      });
    } catch {
      // No CloudStorage folder: nothing installed.
    }
    const icloud = path.join(home, "Library", "Mobile Documents", "com~apple~CloudDocs");
    if (exists(icloud)) found.push({ kind: "icloud", path: icloud });
  } else if (platform === "win32") {
    "DEFGHIJ".split("").forEach((letter) => drives.forEach((drive) => {
      const candidate = `${letter}:\\${drive}`;
      if (exists(candidate)) found.push({ kind: "google", path: candidate });
    }));
    const oneDrive = path.join(home, "OneDrive");
    if (exists(oneDrive)) found.push({ kind: "onedrive", path: oneDrive });
  }
  return found;
}

// ---------- the sync engine used by the desktop app ----------
//
// `loadData`/`saveData` read and write the local snapshot's data; config and
// change times live in two small files next to it.
function createSync({ configFile, metaFile, loadData, saveData, restorePoint, hostname, platform, now = () => Date.now() }) {
  let config = readJSONFile(configFile) || {};
  if (!config.device) {
    config = { ...config, device: `d${now().toString(36)}${Math.random().toString(36).slice(2, 8)}` };
    writeJSONFile(configFile, config);
  }
  let meta = readJSONFile(metaFile) || {};
  let last = loadData() || {};
  let status = { state: config.folder ? "idle" : "off", lastSync: config.lastSync || null, error: null, others: [] };

  const saveConfig = () => writeJSONFile(configFile, config);
  const saveMeta = () => writeJSONFile(metaFile, meta);
  const deviceName = () => config.name || hostname;

  function info() {
    return { folder: config.folder || null, device: config.device, name: deviceName(), ...status };
  }

  // Exchanges with the folder: takes in newer changes, writes this computer's
  // file. Returns { incoming } (empty when nothing changed here).
  function sync({ join = false } = {}) {
    if (!config.folder) return { incoming: {} };
    const others = readOthers(config.folder, config.device);
    if (others === null && !fs.existsSync(config.folder)) {
      status = { ...status, state: "unavailable", error: "unavailable" };
      return { incoming: {} };
    }
    const firstTime = join || !config.joined;
    if (firstTime && others?.length && restorePoint) restorePoint(last);
    const result = combine({ data: last, meta }, others || [], { join: firstTime, device: config.device, now: now() });
    if (Object.keys(result.incoming).length) saveData(result.data);
    last = result.data;
    meta = result.meta;
    saveMeta();
    try {
      writeOwn(config.folder, { device: config.device, name: deviceName(), platform, data: last, meta, now: now() });
    } catch {
      status = { ...status, state: "unavailable", error: "write" };
      return { incoming: result.incoming };
    }
    config = { ...config, joined: true, lastSync: now() };
    saveConfig();
    status = {
      state: "idle",
      lastSync: config.lastSync,
      error: null,
      others: (others || []).map((other) => ({ device: other.device, name: other.name || other.device, platform: other.platform || "", savedAt: other.savedAt || null })),
    };
    return { incoming: result.incoming };
  }

  return {
    info,
    get folder() { return config.folder || null; },
    // Called after every local snapshot save.
    noteLocal(data) {
      meta = trackChanges(last, data, meta, config.device, now());
      last = { ...data };
      saveMeta();
    },
    sync,
    connect(folder) {
      config = { ...config, folder, joined: false };
      saveConfig();
      return sync({ join: true });
    },
    disconnect() {
      const { folder: _folder, joined: _joined, ...rest } = config;
      config = rest;
      saveConfig();
      status = { state: "off", lastSync: null, error: null, others: [] };
    },
  };
}

module.exports = {
  SYNC_VERSION,
  LOCAL_ONLY,
  isSyncedKey,
  trackChanges,
  unionValues,
  combine,
  readOthers,
  writeOwn,
  suggestFolders,
  createSync,
};

(function exposeLowstateStorage(root, factory) {
  const commonJS = typeof module === "object" && module.exports;
  const api = factory(commonJS ? null : root.localStorage, commonJS ? null : root.desktopStorage);
  api.createStorage = factory;
  if (commonJS) module.exports = api;
  else root.LowstateStorage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, (storage, desktopStorage, options = {}) => {
  const TRASH_KEY = "type-todo.trash.v1";
  const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
  // Several writes from one action (and bursts while typing) become a single
  // desktop snapshot. localStorage itself is still written right away.
  const DESKTOP_DELAY_MS = 150;
  const schedule = options.schedule || ((callback, ms) => setTimeout(callback, ms));
  const cancel = options.cancel || ((id) => clearTimeout(id));

  function isAppKey(key) {
    return typeof key === "string"
      && (key.startsWith("type-todo.") || key.startsWith("quest-log."));
  }

  function parse(raw, fallback) {
    try {
      const value = JSON.parse(raw);
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  // ---------- save status ----------
  // `local` is the page's own store (localStorage); `desktop` the durable
  // snapshot the desktop app keeps on disk ("off" in the browser). A failed
  // local write is kept in `pending` so the app keeps reading its own data,
  // the snapshot and exports still include it, and it can be retried.
  const pending = new Map();
  const status = { local: "ok", desktop: desktopStorage?.saveSnapshot ? "ok" : "off", savedAt: null };
  const listeners = new Set();
  let timer = null;

  function setStatus(changes) {
    const changed = Object.entries(changes).some(([key, value]) => status[key] !== value);
    Object.assign(status, changes);
    if (changed) listeners.forEach((listener) => listener({ ...status }));
  }

  function onStatus(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  const getStatus = () => ({ ...status, pending: pending.size });

  function writeLocal(key, value) {
    try {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
      pending.delete(key);
      return true;
    } catch {
      pending.set(key, value);
      return false;
    }
  }

  function collect() {
    const data = {};
    if (!storage) return data;
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (isAppKey(key)) data[key] = storage.getItem(key);
    }
    pending.forEach((value, key) => {
      if (value === null) delete data[key];
      else data[key] = value;
    });
    return data;
  }

  // Writes the desktop snapshot now. Returns { ok } like the bridge does.
  function persist() {
    if (timer !== null) cancel(timer);
    timer = null;
    if (!desktopStorage?.saveSnapshot) return { ok: false };
    let result;
    try {
      result = desktopStorage.saveSnapshot(collect()) || { ok: false };
    } catch {
      result = { ok: false };
    }
    setStatus({ desktop: result.ok ? "ok" : "failed", savedAt: result.ok ? result.savedAt || null : status.savedAt });
    return result;
  }

  function schedulePersist() {
    if (!desktopStorage?.saveSnapshot || timer !== null) return;
    timer = schedule(persist, DESKTOP_DELAY_MS);
  }

  // Writes a snapshot that is still waiting (before closing, exporting…).
  function flush() {
    if (timer !== null) return persist();
    return { ok: status.desktop === "ok" };
  }

  // Tries the failed writes again, then the snapshot.
  function retry() {
    [...pending.entries()].forEach(([key, value]) => writeLocal(key, value));
    setStatus({ local: pending.size ? "failed" : "ok" });
    if (desktopStorage?.saveSnapshot) persist();
    return getStatus();
  }

  function hydrate() {
    if (!storage || !desktopStorage?.loadSnapshot) return false;
    try {
      const snapshot = desktopStorage.loadSnapshot();
      const data = snapshot?.data;
      if (!data || typeof data !== "object") return false;
      let restored = false;
      Object.entries(data).forEach(([key, value]) => {
        if (isAppKey(key) && typeof value === "string" && storage.getItem(key) === null) {
          if (writeLocal(key, value)) restored = true;
        }
      });
      setStatus({ local: pending.size ? "failed" : "ok" });
      // This also migrates existing localStorage-only installations on their
      // first launch with the durable desktop storage layer.
      persist();
      return restored;
    } catch {
      return false;
    }
  }

  function getRaw(key) {
    if (pending.has(key)) return pending.get(key);
    if (!storage) return null;
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  }

  // Returns false when the value couldn't be stored (it is kept in memory and
  // the status says so).
  function setRaw(key, value) {
    if (!storage || !isAppKey(key)) return false;
    const ok = writeLocal(key, String(value));
    setStatus({ local: pending.size ? "failed" : "ok" });
    schedulePersist();
    return ok;
  }

  function removeRaw(key) {
    if (!storage || !isAppKey(key)) return false;
    const ok = writeLocal(key, null);
    setStatus({ local: pending.size ? "failed" : "ok" });
    schedulePersist();
    return ok;
  }

  function writeAll(data) {
    for (let index = storage.length - 1; index >= 0; index--) {
      const key = storage.key(index);
      if (isAppKey(key)) storage.removeItem(key);
    }
    Object.entries(data).forEach(([key, value]) => storage.setItem(key, value));
  }

  // Replaces every app key at once (backup restore). If the page can't hold
  // the new data, the previous data is put back and nothing changes.
  function replaceAll(data) {
    if (!storage) return { ok: false, error: "no-storage" };
    flush();
    const previous = collect();
    const next = Object.fromEntries(Object.entries(data || {})
      .filter(([key, value]) => isAppKey(key) && typeof value === "string"));
    try {
      writeAll(next);
    } catch {
      try {
        writeAll(previous);
        pending.clear();
      } catch {
        // Keep what couldn't be written back in memory, still retryable.
        Object.entries(previous).forEach(([key, value]) => {
          if (getRawStored(key) !== value) pending.set(key, value);
        });
      }
      setStatus({ local: pending.size ? "failed" : "ok" });
      if (desktopStorage?.saveSnapshot) persist();
      return { ok: false, error: "local" };
    }
    pending.clear();
    setStatus({ local: "ok" });
    const desktop = desktopStorage?.saveSnapshot ? persist().ok : true;
    return { ok: true, desktop };
  }

  function getRawStored(key) {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  }

  function loadArray(key) {
    const value = parse(getRaw(key), []);
    return Array.isArray(value) ? value : [];
  }

  function loadObject(key) {
    const value = parse(getRaw(key), {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function save(key, value) {
    return setRaw(key, JSON.stringify(value));
  }

  // ---------- backups ----------
  // Every format Lowstate has exported: 1.x ("type-todo", version 1), 2.x
  // ("lowstate", version 3), the desktop snapshot file ("lowstate", version
  // 1, savedAt) and a bare { key: value } map. Anything newer is refused.
  const BACKUP_VERSION = 3;
  const SHAPES = {
    "type-todo.planner.items.v1": "array",
    "type-todo.planner.habits.v1": "array",
    "type-todo.planner.categories.v1": "array",
    "type-todo.planner.dump.v1": "array",
    "type-todo.planner.settings.v1": "object",
    "type-todo.planner.habitlog.v1": "object",
    "type-todo.planner.daynotes.v1": "object",
    "quest-log.todos.v1": "array",
    [TRASH_KEY]: "array",
  };

  function shapeOf(value) {
    if (Array.isArray(value)) return "array";
    return value && typeof value === "object" ? "object" : typeof value;
  }

  function readBackup(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: "not-json" };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, error: "not-lowstate" };
    const wrapped = parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data);
    if (wrapped && parsed.app !== undefined && parsed.app !== "lowstate" && parsed.app !== "type-todo") {
      return { ok: false, error: "not-lowstate" };
    }
    const version = wrapped ? Number(parsed.version) || 1 : 1;
    if (version > BACKUP_VERSION) return { ok: false, error: "newer" };
    const source = wrapped ? parsed.data : parsed;
    const data = {};
    for (const [key, value] of Object.entries(source)) {
      if (!isAppKey(key)) continue;
      if (typeof value !== "string") return { ok: false, error: "corrupt", key };
      const expected = SHAPES[key];
      const looksJSON = /^\s*[[{]/.test(value);
      if (expected || looksJSON) {
        let content;
        try {
          content = JSON.parse(value);
        } catch {
          return { ok: false, error: "corrupt", key };
        }
        if (expected && shapeOf(content) !== expected) return { ok: false, error: "corrupt", key };
      }
      data[key] = value;
    }
    if (!Object.keys(data).length) return { ok: false, error: "empty" };
    const count = (key) => parse(data[key], []).length || 0;
    const items = parse(data["type-todo.planner.items.v1"], null);
    const legacy = !Array.isArray(items);
    const date = typeof parsed.exportedAt === "string" ? parsed.exportedAt : typeof parsed.savedAt === "string" ? parsed.savedAt : null;
    return {
      ok: true,
      data,
      info: {
        date: date && !Number.isNaN(Date.parse(date)) ? date : null,
        generation: parsed.app === "type-todo" || legacy ? 1 : 2,
        tasks: legacy ? count("quest-log.todos.v1") : items.length,
        habits: count("type-todo.planner.habits.v1"),
        keys: Object.keys(data).length,
      },
    };
  }

  function backupPayload(now = new Date()) {
    return { app: "lowstate", version: BACKUP_VERSION, exportedAt: now.toISOString(), data: collect() };
  }

  // A copy of the current data before a restore: a file next to the desktop
  // snapshot. Returns false when there is no desktop app (the page downloads
  // a copy instead) or it couldn't be written.
  function keepRestorePoint() {
    if (!desktopStorage?.saveRestorePoint) return { ok: false, error: "unsupported" };
    try {
      return desktopStorage.saveRestorePoint(collect()) || { ok: false };
    } catch {
      return { ok: false };
    }
  }

  // ---------- trash ----------
  function pruneTrash(items = loadArray(TRASH_KEY), now = Date.now()) {
    const kept = items.filter((entry) => Number(entry.deletedAt) > now - RETENTION_MS);
    if (kept.length !== items.length) save(TRASH_KEY, kept);
    return kept;
  }

  function trash(type, item, index) {
    const items = pruneTrash();
    items.unshift({ id: crypto.randomUUID(), type, item, index, deletedAt: Date.now() });
    save(TRASH_KEY, items);
    return items;
  }

  function restoreLast() {
    const items = pruneTrash();
    const restored = items.shift() || null;
    save(TRASH_KEY, items);
    return restored;
  }

  function removeTrashEntry(id) {
    const items = pruneTrash().filter((entry) => entry.id !== id);
    save(TRASH_KEY, items);
  }

  function emptyTrash() {
    save(TRASH_KEY, []);
  }

  hydrate();

  return {
    TRASH_KEY,
    RETENTION_MS,
    BACKUP_VERSION,
    isAppKey,
    parse,
    collect,
    persist,
    flush,
    retry,
    onStatus,
    getStatus,
    hydrate,
    getRaw,
    setRaw,
    removeRaw,
    replaceAll,
    readBackup,
    backupPayload,
    keepRestorePoint,
    loadArray,
    loadObject,
    save,
    pruneTrash,
    trash,
    restoreLast,
    removeTrashEntry,
    emptyTrash,
  };
});

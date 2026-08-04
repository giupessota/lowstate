(function exposeLowstateStorage(root, factory) {
  const commonJS = typeof module === "object" && module.exports;
  const api = factory(commonJS ? null : root.localStorage, commonJS ? null : root.desktopStorage);
  api.createStorage = factory;
  if (commonJS) module.exports = api;
  else root.LowstateStorage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, (storage, desktopStorage) => {
  const TRASH_KEY = "type-todo.trash.v1";
  const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

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

  function collect() {
    const data = {};
    if (!storage) return data;
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (isAppKey(key)) data[key] = storage.getItem(key);
    }
    return data;
  }

  function persist() {
    if (!desktopStorage?.saveSnapshot) return { ok: false };
    try {
      return desktopStorage.saveSnapshot(collect()) || { ok: false };
    } catch {
      return { ok: false };
    }
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
          storage.setItem(key, value);
          restored = true;
        }
      });
      // This also migrates existing localStorage-only installations on their
      // first launch with the durable desktop storage layer.
      persist();
      return restored;
    } catch {
      return false;
    }
  }

  function getRaw(key) {
    return storage ? storage.getItem(key) : null;
  }

  function setRaw(key, value) {
    if (!storage || !isAppKey(key)) return;
    storage.setItem(key, String(value));
    persist();
  }

  function removeRaw(key) {
    if (!storage || !isAppKey(key)) return;
    storage.removeItem(key);
    persist();
  }

  function replaceAll(data) {
    if (!storage) return;
    for (let index = storage.length - 1; index >= 0; index--) {
      const key = storage.key(index);
      if (isAppKey(key)) storage.removeItem(key);
    }
    Object.entries(data || {}).forEach(([key, value]) => {
      if (isAppKey(key) && typeof value === "string") storage.setItem(key, value);
    });
    persist();
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
    setRaw(key, JSON.stringify(value));
  }

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
    isAppKey,
    parse,
    collect,
    persist,
    hydrate,
    getRaw,
    setRaw,
    removeRaw,
    replaceAll,
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

(function exposeLowstateStorage(root, factory) {
  const commonJS = typeof module === "object" && module.exports;
  const api = factory(commonJS ? null : root.localStorage);
  if (commonJS) module.exports = api;
  else root.LowstateStorage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, (storage) => {
  const TRASH_KEY = "type-todo.trash.v1";
  const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

  function parse(raw, fallback) {
    try {
      const value = JSON.parse(raw);
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function loadArray(key) {
    if (!storage) return [];
    const value = parse(storage.getItem(key), []);
    return Array.isArray(value) ? value : [];
  }

  function loadObject(key) {
    if (!storage) return {};
    const value = parse(storage.getItem(key), {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function save(key, value) {
    if (storage) storage.setItem(key, JSON.stringify(value));
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

  return {
    TRASH_KEY,
    RETENTION_MS,
    parse,
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

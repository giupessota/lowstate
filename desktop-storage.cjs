const fs = require("fs");
const path = require("path");

const SNAPSHOT_VERSION = 1;
const MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024;

function isAppKey(key) {
  return typeof key === "string"
    && (key.startsWith("type-todo.") || key.startsWith("quest-log."));
}

function sanitizeData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  return Object.fromEntries(
    Object.entries(data).filter(([key, value]) => isAppKey(key) && typeof value === "string")
  );
}

function parseSnapshot(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.app !== "lowstate" || typeof parsed.data !== "object") return null;
    return {
      app: "lowstate",
      version: Number(parsed.version) || SNAPSHOT_VERSION,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : null,
      data: sanitizeData(parsed.data),
    };
  } catch {
    return null;
  }
}

function readSnapshotFile(filePath, fileSystem = fs) {
  try {
    return parseSnapshot(fileSystem.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function loadSnapshot(filePath, backupPath, fileSystem = fs) {
  return readSnapshotFile(filePath, fileSystem)
    || readSnapshotFile(backupPath, fileSystem)
    || { app: "lowstate", version: SNAPSHOT_VERSION, savedAt: null, data: {} };
}

function saveSnapshot(filePath, backupPath, data, options = {}) {
  const fileSystem = options.fileSystem || fs;
  const now = options.now || new Date();
  const payload = {
    app: "lowstate",
    version: SNAPSHOT_VERSION,
    savedAt: now.toISOString(),
    data: sanitizeData(data),
  };
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  if (Buffer.byteLength(serialized, "utf8") > MAX_SNAPSHOT_BYTES) {
    throw new Error("Lowstate data snapshot is too large");
  }

  const directory = path.dirname(filePath);
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fileSystem.mkdirSync(directory, { recursive: true });
  fileSystem.writeFileSync(temporaryPath, serialized, { encoding: "utf8", mode: 0o600 });

  try {
    if (readSnapshotFile(filePath, fileSystem)) fileSystem.copyFileSync(filePath, backupPath);
    fileSystem.renameSync(temporaryPath, filePath);
  } catch (error) {
    try { fileSystem.unlinkSync(temporaryPath); } catch {}
    throw error;
  }

  return payload;
}

module.exports = {
  SNAPSHOT_VERSION,
  MAX_SNAPSHOT_BYTES,
  isAppKey,
  sanitizeData,
  parseSnapshot,
  readSnapshotFile,
  loadSnapshot,
  saveSnapshot,
};

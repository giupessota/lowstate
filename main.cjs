const { app, BrowserWindow, dialog, globalShortcut, ipcMain, net, powerMonitor, shell, Menu, Notification, safeStorage, session, Tray } = require("electron");
const { execFile } = require("child_process");
const fs = require("fs");
const https = require("https");
const os = require("os");
const path = require("path");
const { loadSnapshot, saveSnapshot, saveRestorePoint } = require("./desktop-storage.cjs");
const { hideWindowOnClose, isNewerVersion } = require("./desktop-lifecycle.cjs");
const { createCalendarStore, isMeetingUrl } = require("./desktop-calendars.cjs");
const { createSync, folderTransport, suggestFolders } = require("./desktop-sync.cjs");
const {
  GoogleError, readClientFile, pkce, authUrl, waitForCode, exchangeCode, createGoogleAuth, createDriveClient, driveTransport,
} = require("./desktop-google.cjs");
const iconPath = path.join(__dirname, "assets", "icon-512.png");

let window;
let tray;
let isQuitting = false;

// Lets a development/preview run use its own data folder (e.g. a copy of the
// real data) instead of the one shared with the installed app.
const dataDirOverride = process.env.LOWSTATE_DATA_DIR || null;
if (dataDirOverride) app.setPath("userData", path.join(dataDirOverride, "profile"));

// Windows attributes notifications to this ID; it must match the installer's
// appId so reminders show as "Lowstate" with its icon.
if (process.platform === "win32") app.setAppUserModelId("com.lowstate.app");

function createWindow() {
  window = new BrowserWindow({
    width: 1240,
    height: 820,
    useContentSize: true,
    minWidth: 860,
    minHeight: 560,
    resizable: true,
    title: "Lowstate",
    icon: iconPath,
    backgroundColor: "#f4f0e8",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      // Reminders are timed in the page; keep its timers running while the
      // window is hidden in the tray / behind other windows.
      backgroundThrottling: false,
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  window.loadFile(path.join(__dirname, "index.html"));
  window.on("close", (event) => {
    hideWindowOnClose(event, window, isQuitting);
  });
  // Closing only hides the window, so reopening it (dock, tray, shortcut)
  // tells the page to come back to today.
  const opened = () => window?.webContents.send("window-opened");
  window.on("show", opened);
  window.on("restore", opened);
}

const DEFAULT_SHORTCUTS = {
  toggle: "CommandOrControl+Shift+Space",
  capture: "CommandOrControl+Shift+N",
  brain: "CommandOrControl+Shift+B",
};
let shortcuts = { ...DEFAULT_SHORTCUTS };

function desktopStoragePaths() {
  // Keep the durable copy outside Chromium's userData/profile directory. If
  // that profile is reset, this sibling directory is left intact.
  const directory = dataDirOverride || path.join(app.getPath("appData"), "Lowstate Data");
  return {
    current: path.join(directory, "lowstate-data.json"),
    backup: path.join(directory, "lowstate-data.backup.json"),
  };
}

// localStorage remains the web/PWA-compatible working store. The desktop app
// mirrors it into an atomic JSON file outside Electron's Chromium profile so a
// damaged or reset profile can be rebuilt on the next launch.
ipcMain.on("storage-load", (event) => {
  const paths = desktopStoragePaths();
  // Keys that just came from another computer replace what the page has.
  event.returnValue = { ...loadSnapshot(paths.current, paths.backup), overwrite: syncOverwrite };
  syncOverwrite = [];
});

ipcMain.on("storage-restore-point", (event, data) => {
  try {
    const file = saveRestorePoint(path.dirname(desktopStoragePaths().current), data);
    event.returnValue = { ok: true, file };
  } catch (error) {
    console.error("Could not keep a copy before restoring:", error);
    event.returnValue = { ok: false };
  }
});

// Backups go through the system's save dialog, so the page only says
// "saved" once the file is really written.
ipcMain.handle("backup-save", async (_event, text, name) => {
  if (typeof text !== "string" || !window) return { ok: false };
  const fileName = /^[\w.-]{1,80}\.json$/.test(String(name || "")) ? name : "lowstate-backup.json";
  const choice = await dialog.showSaveDialog(window, {
    defaultPath: path.join(app.getPath("downloads"), fileName),
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (choice.canceled || !choice.filePath) return { ok: false, canceled: true };
  try {
    await fs.promises.writeFile(choice.filePath, text, { encoding: "utf8", mode: 0o600 });
    return { ok: true, file: path.basename(choice.filePath) };
  } catch (error) {
    console.error("Could not write the backup:", error);
    return { ok: false };
  }
});

ipcMain.on("storage-save", (event, data) => {
  try {
    const paths = desktopStoragePaths();
    const snapshot = saveSnapshot(paths.current, paths.backup, data);
    event.returnValue = { ok: true, savedAt: snapshot.savedAt };
    if (syncEngine?.active) {
      syncEngine.noteLocal(snapshot.data);
      scheduleSync();
    }
  } catch (error) {
    console.error("Could not persist Lowstate data snapshot:", error);
    event.returnValue = { ok: false };
  }
});

// ---------- same data on several computers ----------
// Either a folder a cloud app keeps in step, or Google Drive through its API
// (for computers where the Drive app can't be installed).
let syncEngine = null;
let syncOverwrite = [];
let syncTimer = null;
let googleTransportCache = null;
let googleLogin = null;
const SYNC_DELAY = 2000;
const SYNC_INTERVAL = 30 * 1000;
const STARTUP_SYNC_WAIT = 4000;

const syncDirectory = () => path.dirname(desktopStoragePaths().current);
const googleFile = () => path.join(syncDirectory(), "sync-google.json");
const netFetch = (url, options) => net.fetch(url, options);

// The app's own Google client, when the build carries one (google-client.json,
// written in CI from a secret); otherwise the person loads their file.
let builtInClient;
function builtInGoogleClient() {
  if (builtInClient !== undefined) return builtInClient;
  try {
    const client = JSON.parse(fs.readFileSync(path.join(__dirname, "google-client.json"), "utf8"));
    builtInClient = client?.clientId && client?.clientSecret ? client : null;
  } catch {
    builtInClient = null;
  }
  return builtInClient;
}

// The OAuth client and refresh token, encrypted like the calendar links.
function readGoogle() {
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(googleFile(), "utf8")) || {};
  } catch {
    raw = {};
  }
  const open = (value, parse) => {
    try {
      return value ? (parse ? JSON.parse(decryptSecret(value)) : decryptSecret(value)) : null;
    } catch {
      return null;
    }
  };
  return { client: open(raw.client, true) || builtInGoogleClient(), refreshToken: open(raw.token, false), account: raw.account || null };
}

function writeGoogle({ client, refreshToken, account }) {
  const value = {
    // The built-in client isn't copied into the file.
    client: client && client !== builtInGoogleClient() ? encryptSecret(JSON.stringify(client)) : undefined,
    token: refreshToken ? encryptSecret(refreshToken) : undefined,
    account: account || undefined,
  };
  fs.mkdirSync(syncDirectory(), { recursive: true });
  fs.writeFileSync(googleFile(), JSON.stringify(value), { mode: 0o600 });
  googleTransportCache = null;
}

function googleTransport() {
  if (googleTransportCache) return googleTransportCache;
  const { client, refreshToken, account } = readGoogle();
  if (!client || !refreshToken) {
    const signedOut = async () => { throw new GoogleError("auth"); };
    return { kind: "google", label: account, readOthers: signedOut, writeOwn: signedOut };
  }
  googleTransportCache = driveTransport({
    drive: createDriveClient({ fetch: netFetch, auth: createGoogleAuth({ fetch: netFetch, client, refreshToken }) }),
    label: account,
  });
  return googleTransportCache;
}

async function initSync() {
  const paths = desktopStoragePaths();
  const directory = path.dirname(paths.current);
  syncEngine = createSync({
    configFile: path.join(directory, "sync.json"),
    metaFile: path.join(directory, "sync-meta.json"),
    loadData: () => loadSnapshot(paths.current, paths.backup).data,
    saveData: (data) => saveSnapshot(paths.current, paths.backup, data),
    restorePoint: (data) => saveRestorePoint(directory, data),
    hostname: os.hostname().replace(/\.local$/, ""),
    platform: process.platform,
    transportFor: (target) => (target.kind === "google" ? googleTransport() : folderTransport(target.folder)),
  });
  if (!syncEngine.active) return;
  // Before the page loads, so it starts with the other computer's changes —
  // but a slow network doesn't hold the window back: what arrives later is
  // handed to the page once it's ready.
  const startup = syncSafely();
  const early = await Promise.race([startup, new Promise((resolve) => setTimeout(() => resolve(null), STARTUP_SYNC_WAIT))]);
  if (early) {
    syncOverwrite = Object.keys(early.incoming);
    return;
  }
  startup.then(({ incoming }) => {
    if (!Object.keys(incoming).length) return;
    const send = () => window?.webContents.send("sync-incoming", incoming, syncEngine.info());
    if (window?.webContents.isLoading()) window.webContents.once("did-finish-load", send);
    else send();
  });
}

async function syncSafely(options) {
  try {
    return await syncEngine.sync(options);
  } catch (error) {
    console.error("Sync failed:", error);
    return { incoming: {} };
  }
}

// Exchanges with the target and hands anything new to the page.
async function runSync() {
  clearTimeout(syncTimer);
  syncTimer = null;
  if (!syncEngine?.active) return;
  const { incoming } = await syncSafely();
  if (!window) return;
  if (Object.keys(incoming).length) window.webContents.send("sync-incoming", incoming, syncEngine.info());
  window.webContents.send("sync-status", syncPayload());
}

function scheduleSync() {
  if (!syncTimer) syncTimer = setTimeout(runSync, SYNC_DELAY);
}

function syncPayload() {
  const { client, refreshToken, account } = readGoogle();
  return {
    ...syncEngine.info(),
    suggestions: suggestFolders({ home: os.homedir(), platform: process.platform }),
    google: { configured: Boolean(client), builtIn: Boolean(builtInGoogleClient()), signedIn: Boolean(refreshToken), account },
  };
}

async function connectSync(target) {
  const { incoming } = await syncEngine.connect(target);
  if (Object.keys(incoming).length) window?.webContents.send("sync-incoming", incoming, syncEngine.info());
  return syncPayload();
}

ipcMain.handle("sync-get", () => syncPayload());
ipcMain.handle("sync-choose", async () => {
  const suggestion = suggestFolders({ home: os.homedir(), platform: process.platform })[0]?.path;
  const choice = await dialog.showOpenDialog(window, {
    properties: ["openDirectory", "createDirectory"],
    defaultPath: suggestion || os.homedir(),
  });
  if (choice.canceled || !choice.filePaths[0]) return syncPayload();
  return connectSync({ kind: "folder", folder: choice.filePaths[0] });
});
ipcMain.handle("sync-use", (_event, folder) => {
  const allowed = suggestFolders({ home: os.homedir(), platform: process.platform }).map((entry) => entry.path);
  return allowed.includes(folder) ? connectSync({ kind: "folder", folder }) : syncPayload();
});

// The "client_secret_….json" downloaded from Google Cloud.
ipcMain.handle("sync-google-client", async () => {
  const choice = await dialog.showOpenDialog(window, {
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }],
    defaultPath: app.getPath("downloads"),
  });
  if (choice.canceled || !choice.filePaths[0]) return { ...syncPayload(), canceled: true };
  try {
    const client = readClientFile(fs.readFileSync(choice.filePaths[0], "utf8"));
    writeGoogle({ ...readGoogle(), client });
    return syncPayload();
  } catch (error) {
    return { ...syncPayload(), error: error.code || "not-client" };
  }
});

// Signs in in the default browser and connects to Drive.
ipcMain.handle("sync-google-login", async (_event, pages) => {
  const current = readGoogle();
  if (!current.client) return { ...syncPayload(), error: "no-client" };
  googleLogin?.cancel();
  const { verifier, challenge, state } = pkce();
  const login = waitForCode({ state, pages: pages && typeof pages === "object" ? pages : {} });
  googleLogin = login;
  try {
    const redirectUri = await login.ready;
    await shell.openExternal(authUrl({ clientId: current.client.clientId, redirectUri, challenge, state }));
    const code = await login.code;
    const tokens = await exchangeCode({ fetch: netFetch, client: current.client, code, verifier, redirectUri });
    let account = null;
    try {
      const auth = createGoogleAuth({ fetch: netFetch, client: current.client, refreshToken: tokens.refreshToken });
      account = await createDriveClient({ fetch: netFetch, auth }).account();
    } catch {
      // The address is only shown; syncing works without it.
    }
    writeGoogle({ client: current.client, refreshToken: tokens.refreshToken, account });
    focusWindow();
    return connectSync({ kind: "google", label: account });
  } catch (error) {
    focusWindow();
    return { ...syncPayload(), error: error.code || "failed" };
  } finally {
    if (googleLogin === login) googleLogin = null;
  }
});
ipcMain.handle("sync-google-cancel", () => {
  googleLogin?.cancel();
  return syncPayload();
});

ipcMain.handle("sync-now", async () => {
  await runSync();
  return syncPayload();
});
ipcMain.handle("sync-stop", () => {
  const wasGoogle = syncEngine.info().target?.kind === "google";
  syncEngine.disconnect();
  // Stopping Google sync signs out here (the client file stays).
  if (wasGoogle) writeGoogle({ client: readGoogle().client });
  return syncPayload();
});

async function migrateLegacyProfile() {
  const paths = desktopStoragePaths();
  if (Object.keys(loadSnapshot(paths.current, paths.backup).data).length) return;

  // The app was originally published as "type-todo-desktop". Electron derives
  // its profile folder from that package name, so notes from installations made
  // before the Lowstate rename can still be present in this sibling profile.
  const legacyProfile = path.join(app.getPath("appData"), "type-todo-desktop");
  if (!fs.existsSync(legacyProfile) || legacyProfile === app.getPath("userData")) return;

  let legacyWindow;
  try {
    const legacySession = session.fromPath(legacyProfile);
    legacySession.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*"] },
      (_details, callback) => callback({ cancel: true })
    );
    legacyWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        session: legacySession,
      },
    });
    await legacyWindow.loadFile(path.join(__dirname, "index.html"));
    const data = await legacyWindow.webContents.executeJavaScript(`(() => {
      const recovered = {};
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (key && (key.startsWith("type-todo.") || key.startsWith("quest-log."))) {
          recovered[key] = localStorage.getItem(key);
        }
      }
      return recovered;
    })()`);
    const contentKeys = ["quest-log.todos.v1", "type-todo.brain-inbox.v1", "type-todo.trash.v1"];
    const hasRecoverableContent = contentKeys.some((key) => {
      try {
        const items = JSON.parse(data?.[key]);
        return Array.isArray(items) && items.length > 0;
      } catch { return false; }
    });
    if (hasRecoverableContent) saveSnapshot(paths.current, paths.backup, data);
  } catch (error) {
    console.error("Could not migrate the legacy Lowstate profile:", error);
  } finally {
    legacyWindow?.destroy();
  }
}

function focusWindow() {
  if (!window) return;
  // A minimized window still reports isVisible() === true on macOS, so
  // isMinimized() has to be checked separately before restoring/showing.
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

const SHORTCUT_HANDLERS = {
  // Show / hide the planner
  toggle: () => {
    if (!window) return;
    if (window.isVisible() && !window.isMinimized()) { window.hide(); return; }
    focusWindow();
  },
  // Quick capture: bring the planner up with the "To schedule" field focused.
  // The old "brain dump" shortcut now lands in the same place.
  capture: () => {
    if (!window) return;
    focusWindow();
    window.webContents.send("quick-capture", "tasks");
  },
  brain: () => {
    if (!window) return;
    focusWindow();
    window.webContents.send("quick-capture", "brain");
  },
};

const showFullWindow = () => focusWindow();

function createTray() {
  if (process.platform === "darwin" || tray) return;
  tray = new Tray(iconPath);
  tray.setToolTip("Lowstate");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Show Lowstate", click: showFullWindow },
    { label: "Quick task", click: SHORTCUT_HANDLERS.capture },
    { label: "Quick note", click: SHORTCUT_HANDLERS.brain },
    { type: "separator" },
    { label: "Quit", click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on("double-click", showFullWindow);
}

// Registers every shortcut in `map`; returns the keys that failed (e.g.
// already claimed by another app). Always unregisters everything first so a
// partial failure can't leave a stale accelerator pointing at an old handler.
function registerShortcuts(map) {
  globalShortcut.unregisterAll();
  const failed = [];
  for (const key of Object.keys(map)) {
    const ok = globalShortcut.register(map[key], SHORTCUT_HANDLERS[key]);
    if (!ok) failed.push(key);
  }
  return failed;
}

// Neither platform lets an unsigned build silently install its own update
// (macOS refuses outright; Windows would still trigger SmartScreen on the
// downloaded installer), so this only checks GitHub for a newer tag and
// lets the renderer show a "download the new version" nudge.
function checkForUpdate() {
  const options = {
    hostname: "api.github.com",
    path: "/repos/giupessota/lowstate/releases/latest",
    headers: { "User-Agent": "Lowstate-App" },
  };
  https.get(options, (res) => {
    let body = "";
    res.on("data", (chunk) => { body += chunk; });
    res.on("end", () => {
      try {
        const release = JSON.parse(body);
        const latest = String(release.tag_name || "").replace(/^v/, "");
        if (latest && isNewerVersion(latest, app.getVersion()) && window) {
          window.webContents.send("update-available", { version: latest, url: release.html_url });
        }
      } catch {
        // Not critical — silently skip if the API shape changes or is unreachable.
      }
    });
  }).on("error", () => {});
}

app.whenReady().then(async () => {
  if (process.platform === "darwin") {
    app.dock.setIcon(iconPath);
  } else {
    // The default File/Edit/View/... menu bar doesn't fit a small always-on-top
    // gadget. On macOS the Edit menu's roles are what make Cmd+C/V/X/A work in
    // text fields, so it stays there; Windows/Linux don't have that dependency.
    Menu.setApplicationMenu(null);
  }
  await migrateLegacyProfile();
  await initSync();
  createWindow();
  setInterval(runSync, SYNC_INTERVAL);
  window.on("focus", runSync);
  // Waking up or unlocking: the other computer may have moved on meanwhile.
  powerMonitor.on("resume", runSync);
  powerMonitor.on("unlock-screen", runSync);
  createTray();
  registerShortcuts(shortcuts);
  setTimeout(checkForUpdate, 2000);
  initCalendars();
});

// ---------- calendar subscriptions (read-only ICS) ----------
const CALENDAR_REFRESH = 15 * 60 * 1000;
let calendarStore = null;
let calendarRefresh = null;
let calendarRefreshedAt = 0;

// The secret links are encrypted with the OS keychain when available
// ("s:"), otherwise only obscured ("p:") in a file readable by this user.
function encryptSecret(text) {
  if (safeStorage.isEncryptionAvailable()) return `s:${safeStorage.encryptString(text).toString("base64")}`;
  return `p:${Buffer.from(text).toString("base64")}`;
}

function decryptSecret(value) {
  if (value.startsWith("s:")) return safeStorage.decryptString(Buffer.from(value.slice(2), "base64"));
  return Buffer.from(value.slice(2), "base64").toString();
}

function calendarPayload() {
  return calendarStore ? { calendars: calendarStore.list(), events: calendarStore.events() } : { calendars: [], events: [] };
}

function sendCalendars() {
  if (window && !window.isDestroyed()) window.webContents.send("calendars-updated", calendarPayload());
}

function refreshCalendars() {
  if (!calendarStore) return Promise.resolve();
  if (!calendarRefresh) {
    calendarRefresh = calendarStore.refresh().finally(() => {
      calendarRefresh = null;
      calendarRefreshedAt = Date.now();
      sendCalendars();
    });
  }
  return calendarRefresh;
}

function initCalendars() {
  const directory = path.dirname(desktopStoragePaths().current);
  calendarStore = createCalendarStore({
    file: path.join(directory, "calendars.json"),
    cacheFile: path.join(directory, "calendar-events.json"),
    encrypt: encryptSecret,
    decrypt: decryptSecret,
  });
  setTimeout(refreshCalendars, 3000);
  setInterval(refreshCalendars, CALENDAR_REFRESH);
  // Coming back to the window after a while picks up new meetings sooner.
  window?.on("focus", () => {
    if (Date.now() - calendarRefreshedAt > 5 * 60 * 1000) refreshCalendars();
  });
}

ipcMain.handle("calendars-get", () => calendarPayload());
ipcMain.handle("calendars-add", async (_event, input) => {
  if (!calendarStore) return { ok: false, error: "network" };
  const { name, color, url } = input || {};
  const result = await calendarStore.add({ name: String(name || ""), color: String(color || ""), url: String(url || "") });
  if (result.ok) sendCalendars();
  return result;
});
ipcMain.handle("calendars-update", (_event, id, changes) => {
  calendarStore?.update(String(id), changes && typeof changes === "object" ? changes : {});
  sendCalendars();
  return calendarPayload();
});
ipcMain.handle("calendars-remove", (_event, id) => {
  calendarStore?.remove(String(id));
  sendCalendars();
  return calendarPayload();
});
ipcMain.handle("calendars-refresh", async () => {
  await refreshCalendars();
  return calendarPayload();
});

// Native notifications for reminders. Clicking one brings the window up on
// that day; reminders carry a key so they can be snoozed (a button on macOS,
// a prompt in the app after the click everywhere). References are kept so
// they aren't garbage-collected (which would drop the click handler).
const liveNotifications = new Set();
ipcMain.on("notify", (_event, payload) => {
  if (!Notification.isSupported() || !payload || typeof payload !== "object") return;
  const title = String(payload.title || "Lowstate").slice(0, 120);
  const body = String(payload.body || "").slice(0, 240);
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.iso || "")) ? payload.iso : null;
  const action = payload.action === "closure" ? "closure" : null;
  const snooze = typeof payload.snooze === "string" && payload.snooze.length <= 200 ? payload.snooze : null;
  const actions = snooze && process.platform === "darwin"
    ? [{ type: "button", text: String(payload.snoozeLabel || "Snooze 10 min").slice(0, 40) }]
    : [];
  const notification = new Notification({ title, body, actions });
  liveNotifications.add(notification);
  const release = () => liveNotifications.delete(notification);
  notification.on("click", () => {
    release();
    focusWindow();
    if (iso && window) window.webContents.send("open-day", iso, action, snooze);
  });
  notification.on("action", () => {
    release();
    if (snooze && window) window.webContents.send("snooze-reminder", snooze);
  });
  notification.on("close", release);
  notification.show();
});

ipcMain.on("hide-window", () => { if (window) window.hide(); });
ipcMain.on("set-always-on-top", (_event, on) => { if (window) window.setAlwaysOnTop(!!on, "floating"); });
// "Send to Reminders" on the shopping list (macOS): adds what's still to buy
// to a list in Apple's Reminders, skipping what is already there. Names are
// passed as arguments, never pasted into the script. macOS asks once for
// permission to control Reminders.
const REMINDERS_SCRIPT = `on run argv
  set listName to item 1 of argv
  tell application "Reminders"
    if not (exists list listName) then make new list with properties {name:listName}
    set target to list listName
    set existing to name of (reminders of target whose completed is false)
    set added to 0
    repeat with index from 2 to count of argv
      set itemName to item index of argv
      if existing does not contain itemName then
        make new reminder at end of target with properties {name:itemName}
        set added to added + 1
      end if
    end repeat
    return added
  end tell
end run`;

ipcMain.handle("reminders-export", (_event, listName, names) => {
  if (process.platform !== "darwin") return { ok: false, error: "unsupported" };
  const items = (Array.isArray(names) ? names : [])
    .filter((name) => typeof name === "string")
    .map((name) => name.trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 200);
  if (!items.length) return { ok: false, error: "empty" };
  const list = String(listName || "").trim().slice(0, 60) || "Lowstate";
  return new Promise((resolve) => {
    execFile("osascript", ["-e", REMINDERS_SCRIPT, list, ...items], { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        const denied = /-1743|not allowed|não tem permissão|not authori[sz]ed/i.test(`${stderr} ${error.message}`);
        if (!denied) console.error("Could not send to Reminders:", stderr || error.message);
        resolve({ ok: false, error: denied ? "denied" : "failed" });
        return;
      }
      resolve({ ok: true, added: Number.parseInt(String(stdout).trim(), 10) || 0, list });
    });
  });
});

// "Join call" in a meeting's details: only known video-call hosts.
ipcMain.on("open-meeting", (_event, url) => {
  if (typeof url === "string" && isMeetingUrl(url)) shell.openExternal(url);
});
ipcMain.on("open-external", (_event, url) => {
  if (typeof url === "string" && (url.startsWith("https://github.com/") || url.startsWith("https://console.cloud.google.com/"))) shell.openExternal(url);
});

// The renderer owns the persisted shortcut preferences (localStorage); this
// re-registers on the main-process side and reports back which ones failed
// (e.g. taken by the OS or another app) so the UI can revert cleanly.
ipcMain.handle("update-shortcuts", (_event, map) => {
  const candidate = { ...shortcuts, ...map };
  const failed = registerShortcuts(candidate);
  if (failed.length) {
    registerShortcuts(shortcuts);
    return { ok: false, failed };
  }
  shortcuts = candidate;
  return { ok: true };
});

ipcMain.on("cover-changed", (_event, cover) => {
  const allowed = new Set(["rose", "blue", "green", "yellow", "purple"]);
  if (!allowed.has(cover)) return;
  const coverIcon = path.join(__dirname, "assets", `icon-${cover}.png`);
  if (process.platform === "darwin") app.dock.setIcon(coverIcon);
  else if (window) window.setIcon(coverIcon);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => { isQuitting = true; });

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) { createWindow(); return; }
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  tray?.destroy();
});

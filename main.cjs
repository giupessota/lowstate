const { app, BrowserWindow, globalShortcut, ipcMain, shell, Menu, session, Tray } = require("electron");
const fs = require("fs");
const https = require("https");
const path = require("path");
const { loadSnapshot, saveSnapshot } = require("./desktop-storage.cjs");
const { hideWindowOnClose, isNewerVersion } = require("./desktop-lifecycle.cjs");
const iconPath = path.join(__dirname, "assets", "icon-512.png");

let window;
let tray;
let isQuitting = false;

// Lets a development/preview run use its own data folder (e.g. a copy of the
// real data) instead of the one shared with the installed app.
const dataDirOverride = process.env.LOWSTATE_DATA_DIR || null;
if (dataDirOverride) app.setPath("userData", path.join(dataDirOverride, "profile"));

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
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  window.loadFile(path.join(__dirname, "index.html"));
  window.on("close", (event) => {
    hideWindowOnClose(event, window, isQuitting);
  });
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
  event.returnValue = loadSnapshot(paths.current, paths.backup);
});

ipcMain.on("storage-save", (event, data) => {
  try {
    const paths = desktopStoragePaths();
    const snapshot = saveSnapshot(paths.current, paths.backup, data);
    event.returnValue = { ok: true, savedAt: snapshot.savedAt };
  } catch (error) {
    console.error("Could not persist Lowstate data snapshot:", error);
    event.returnValue = { ok: false };
  }
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
  createWindow();
  createTray();
  registerShortcuts(shortcuts);
  setTimeout(checkForUpdate, 2000);
});

ipcMain.on("hide-window", () => { if (window) window.hide(); });
ipcMain.on("set-always-on-top", (_event, on) => { if (window) window.setAlwaysOnTop(!!on, "floating"); });
ipcMain.on("open-external", (_event, url) => {
  if (typeof url === "string" && url.startsWith("https://github.com/")) shell.openExternal(url);
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

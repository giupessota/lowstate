const { app, BrowserWindow, globalShortcut, ipcMain } = require("electron");
const path = require("path");
const iconPath = path.join(__dirname, "assets", "icon-512.png");

let window;

const FULL_HEIGHT = 654;
const COMPACT_HEIGHT = 110;

function setCompactWindow(on) {
  if (!window) return;
  const [width] = window.getContentSize();
  window.setContentSize(width, on ? COMPACT_HEIGHT : FULL_HEIGHT, true);
}

function createWindow() {
  window = new BrowserWindow({
    width: 580,
    height: FULL_HEIGHT,
    useContentSize: true,
    minWidth: 460,
    minHeight: 96,
    maxWidth: 720,
    alwaysOnTop: true,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    title: "Lowstate",
    icon: iconPath,
    backgroundColor: "#d8d4cf",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  window.setAlwaysOnTop(true, "floating");
  window.loadFile(path.join(__dirname, "index.html"));
}

const DEFAULT_SHORTCUTS = {
  toggle: "CommandOrControl+Shift+Space",
  capture: "CommandOrControl+Shift+N",
  brain: "CommandOrControl+Shift+B",
};
let shortcuts = { ...DEFAULT_SHORTCUTS };

function focusWindow(compact) {
  if (!window) return;
  setCompactWindow(compact);
  // A minimized window still reports isVisible() === true on macOS, so
  // isMinimized() has to be checked separately before restoring/showing.
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

const SHORTCUT_HANDLERS = {
  // Show / hide the full gadget
  toggle: () => {
    if (!window) return;
    if (window.isVisible() && !window.isMinimized()) { window.hide(); return; }
    window.webContents.send("set-compact-ui", false);
    focusWindow(false);
  },
  // Quick capture (task): pop up the compact input bar from anywhere
  capture: () => {
    if (!window) return;
    focusWindow(true);
    window.webContents.send("quick-capture", "tasks");
  },
  // Brain dump: same, but the note lands in the Brain Inbox
  brain: () => {
    if (!window) return;
    focusWindow(true);
    window.webContents.send("quick-capture", "brain");
  },
};

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

app.whenReady().then(() => {
  if (process.platform === "darwin") app.dock.setIcon(iconPath);
  createWindow();
  registerShortcuts(shortcuts);
});

ipcMain.on("set-compact", (_event, on) => setCompactWindow(on));
ipcMain.on("hide-window", () => { if (window) window.hide(); });
ipcMain.on("set-always-on-top", (_event, on) => { if (window) window.setAlwaysOnTop(!!on, "floating"); });

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

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) { createWindow(); return; }
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
});

app.on("will-quit", () => globalShortcut.unregisterAll());

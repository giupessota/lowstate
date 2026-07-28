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
    title: "Type Todo",
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

app.whenReady().then(() => {
  if (process.platform === "darwin") app.dock.setIcon(iconPath);
  createWindow();
  // Show / hide the full gadget
  globalShortcut.register("CommandOrControl+Shift+Space", () => {
    if (!window) return;
    if (window.isVisible()) { window.hide(); return; }
    setCompactWindow(false);
    window.webContents.send("set-compact-ui", false);
    window.show();
  });
  // Quick capture (task): pop up the compact input bar from anywhere
  globalShortcut.register("CommandOrControl+Shift+N", () => {
    if (!window) return;
    setCompactWindow(true);
    window.show();
    window.webContents.send("quick-capture", "tasks");
  });
  // Brain dump: same, but the note lands in the Brain Inbox
  globalShortcut.register("CommandOrControl+Shift+B", () => {
    if (!window) return;
    setCompactWindow(true);
    window.show();
    window.webContents.send("quick-capture", "brain");
  });
});

ipcMain.on("set-compact", (_event, on) => setCompactWindow(on));
ipcMain.on("hide-window", () => { if (window) window.hide(); });

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
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("will-quit", () => globalShortcut.unregisterAll());

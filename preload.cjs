const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopStorage", {
  loadSnapshot: () => ipcRenderer.sendSync("storage-load"),
  saveSnapshot: (data) => ipcRenderer.sendSync("storage-save", data),
  saveRestorePoint: (data) => ipcRenderer.sendSync("storage-restore-point", data),
  saveBackup: (text, name) => ipcRenderer.invoke("backup-save", text, name),
});

// Same data on several computers through a synced folder (Google Drive…).
contextBridge.exposeInMainWorld("desktopSync", {
  get: () => ipcRenderer.invoke("sync-get"),
  choose: () => ipcRenderer.invoke("sync-choose"),
  use: (folder) => ipcRenderer.invoke("sync-use", folder),
  now: () => ipcRenderer.invoke("sync-now"),
  stop: () => ipcRenderer.invoke("sync-stop"),
  googleClient: () => ipcRenderer.invoke("sync-google-client"),
  googleLogin: (pages) => ipcRenderer.invoke("sync-google-login", pages),
  googleCancel: () => ipcRenderer.invoke("sync-google-cancel"),
  onIncoming: (cb) => ipcRenderer.on("sync-incoming", (_e, changes, info) => cb(changes, info)),
  onStatus: (cb) => ipcRenderer.on("sync-status", (_e, info) => cb(info)),
});

contextBridge.exposeInMainWorld("desktopTheme", {
  setCover: (cover) => ipcRenderer.send("cover-changed", cover)
});

// Read-only calendar subscriptions. The secret links stay in the main
// process; the page only ever sees names, colors, a masked host and events.
contextBridge.exposeInMainWorld("desktopCalendars", {
  get: () => ipcRenderer.invoke("calendars-get"),
  add: (input) => ipcRenderer.invoke("calendars-add", input),
  update: (id, changes) => ipcRenderer.invoke("calendars-update", id, changes),
  remove: (id) => ipcRenderer.invoke("calendars-remove", id),
  refresh: () => ipcRenderer.invoke("calendars-refresh"),
  onUpdate: (cb) => ipcRenderer.on("calendars-updated", (_e, payload) => cb(payload)),
});

contextBridge.exposeInMainWorld("desktopGadget", {
  platform: process.platform,
  hide: () => ipcRenderer.send("hide-window"),
  setAlwaysOnTop: (on) => ipcRenderer.send("set-always-on-top", on),
  setShortcuts: (map) => ipcRenderer.invoke("update-shortcuts", map),
  openExternal: (url) => ipcRenderer.send("open-external", url),
  openMeeting: (url) => ipcRenderer.send("open-meeting", url),
  sendToReminders: process.platform === "darwin"
    ? (list, names) => ipcRenderer.invoke("reminders-export", list, names)
    : undefined,
  onQuickCapture: (cb) => ipcRenderer.on("quick-capture", (_e, mode) => cb(mode)),
  onUpdateAvailable: (cb) => ipcRenderer.on("update-available", (_e, info) => cb(info)),
  notify: (payload) => ipcRenderer.send("notify", payload),
  onOpenDay: (cb) => ipcRenderer.on("open-day", (_e, iso, action, reminder) => cb(iso, action, reminder)),
  onSnoozeReminder: (cb) => ipcRenderer.on("snooze-reminder", (_e, key) => cb(key)),
  onWindowOpened: (cb) => ipcRenderer.on("window-opened", () => cb())
});

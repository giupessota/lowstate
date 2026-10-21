const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopStorage", {
  loadSnapshot: () => ipcRenderer.sendSync("storage-load"),
  saveSnapshot: (data) => ipcRenderer.sendSync("storage-save", data),
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
  onQuickCapture: (cb) => ipcRenderer.on("quick-capture", (_e, mode) => cb(mode)),
  onUpdateAvailable: (cb) => ipcRenderer.on("update-available", (_e, info) => cb(info))
});

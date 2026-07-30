const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopTheme", {
  setCover: (cover) => ipcRenderer.send("cover-changed", cover)
});

contextBridge.exposeInMainWorld("desktopGadget", {
  setCompact: (on) => ipcRenderer.send("set-compact", on),
  hide: () => ipcRenderer.send("hide-window"),
  setAlwaysOnTop: (on) => ipcRenderer.send("set-always-on-top", on),
  setShortcuts: (map) => ipcRenderer.invoke("update-shortcuts", map),
  openExternal: (url) => ipcRenderer.send("open-external", url),
  onQuickCapture: (cb) => ipcRenderer.on("quick-capture", (_e, mode) => cb(mode)),
  onSetCompactUI: (cb) => ipcRenderer.on("set-compact-ui", (_e, on) => cb(on)),
  onUpdateAvailable: (cb) => ipcRenderer.on("update-available", (_e, info) => cb(info))
});

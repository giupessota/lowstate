const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

app.whenReady().then(async () => {
  const sourcePath = path.join(__dirname, "..", "assets", "icon.svg");
  const window = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true }
  });
  await window.loadFile(sourcePath);
  const image = await window.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, "..", "assets", "icon-1024.png"), image.toPNG());
  app.quit();
});

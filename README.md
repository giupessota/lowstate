# Lowstate

**Lower your mental entropy.**

A tiny to-do gadget for Windows and macOS with a retro notebook design. The
desktop edition opens in an always-on-top window and can be shown or hidden
instantly, with global shortcuts for quick capture.

## Download

- **Web app:** [giupessota.github.io/lowstate](https://giupessota.github.io/lowstate/) — open it and click **Install** in the browser's address bar.
- **Windows / macOS installer:** [latest release](https://github.com/giupessota/lowstate/releases/latest)
  - [Lowstate Setup 1.0.5.exe](https://github.com/giupessota/lowstate/releases/download/v1.0.5/Lowstate.Setup.1.0.5.exe) (Windows)
  - [Lowstate-1.0.5-arm64.dmg](https://github.com/giupessota/lowstate/releases/download/v1.0.5/Lowstate-1.0.5-arm64.dmg) (macOS, Apple Silicon)

The installers aren't code-signed, so Windows SmartScreen or macOS Gatekeeper
will warn on first launch.

- **Windows:** choose "More info → Run anyway".
- **macOS:** right-click (or Control-click) the app → "Open" → confirm. On
  newer macOS versions this dialog may only offer "Move to Trash"/"Done"
  with no way to open it — if so:
  - Go to **System Settings → Privacy & Security**, scroll down, and look
    for an **"Open Anyway"** button next to the Lowstate warning (appears
    shortly after the blocked attempt); or
  - Open **Terminal** and run:
    ```bash
    xattr -cr /Applications/Lowstate.app
    ```
  Either way, this only needs to be done once per install.

## Run in a browser

From the `todo-gadget` directory:

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Install as a browser app

Open the app in Chrome or Edge and click the **Install** icon in the address bar.
Lowstate will open in its own window and continue working offline. Tasks are
stored only on the device using `localStorage`.

## Always-on-top desktop edition

From the `todo-gadget` directory:

```bash
npm install
npm start
```

To create installers:

```bash
npm run dist:mac
npm run dist:win
```

## Keyboard shortcuts

**Global (desktop app — work from anywhere, even when the app is hidden):**

- `Ctrl/Cmd + Shift + Space`: show / hide the gadget
- `Ctrl/Cmd + Shift + N`: quick-capture a task
- `Ctrl/Cmd + Shift + B`: brain dump — capture straight into the Brain Inbox

**In-app (while the window is focused):**

- `Enter`: add the task / note
- `N`: jump to the input field
- `Esc`: collapse compact mode / cancel editing

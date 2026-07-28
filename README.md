# Type Todo

A tiny to-do gadget for Windows and macOS with a retro typewriter design. The
desktop edition opens in an approximately 430 × 560 px always-on-top window and
can be shown or hidden instantly.

## Run in a browser

From the `todo-gadget` directory:

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Install as a browser app

Open the app in Chrome or Edge and click the **Install** icon in the address bar.
Type Todo will open in its own window and continue working offline. Tasks are
stored only on the device using `localStorage`.

## Always-on-top desktop edition

From the `todo-gadget` directory:

```bash
npm install
npm start
```

Use `Ctrl/Cmd + Shift + Space` to show or hide the gadget.

To create installers:

```bash
npm run dist:mac
npm run dist:win
```

## Keyboard shortcuts

- `Enter`: add a task
- `N`: focus the new-task field
- `Esc`: cancel editing

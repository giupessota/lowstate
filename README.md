# Lowstate

**Lower your mental entropy.**

[![Build desktop apps](https://github.com/giupessota/lowstate/actions/workflows/build-desktop.yml/badge.svg)](https://github.com/giupessota/lowstate/actions/workflows/build-desktop.yml)

A tiny to-do gadget for Windows and macOS with a retro notebook design. The
desktop edition opens in an always-on-top window and can be shown or hidden
instantly, with global shortcuts for quick capture.

## Features

- Tasks with due dates, categories, urgency, filters, and drag ordering
- Quick syntax such as `#work`, `!urgent`, and `@tomorrow`
- Brain Inbox with hashtags, batch processing, and conversion into tasks
- Undo feedback plus a 30-day Trash for deleted tasks and notes
- Notebook and minimal styles, light/dark themes, and custom colors
- English and Portuguese interface
- Automatic durable desktop snapshots plus manual backup and restore
- Installable offline PWA and always-on-top Electron desktop app

## Download

- **Web app:** [giupessota.github.io/lowstate](https://giupessota.github.io/lowstate/) — open it and click **Install** in the browser's address bar.
- **Windows / macOS installer:** [latest release](https://github.com/giupessota/lowstate/releases/latest)

Every push to `main` also creates downloadable GitHub Actions artifacts for
Windows x64 and a universal macOS build that supports both Intel and Apple
Silicon. Version tags such as `v1.1.3`
publish those installers to the corresponding GitHub Release.

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
    xattr -dr com.apple.quarantine /Applications/Lowstate.app
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
Lowstate will open in its own window and continue working offline. Browser/PWA
data is stored only on the device using `localStorage`.

The desktop app additionally mirrors tasks, Brain Inbox notes, categories, and
settings into `lowstate-data.json` inside a separate per-user data directory. A
previous valid copy is kept as `lowstate-data.backup.json`; if Chromium's local
profile is reset or the current snapshot is damaged, Lowstate restores the
missing data automatically on launch. This remains local-only and is not cloud
sync. On the first launch, the desktop app also checks the legacy
`type-todo-desktop` profile and migrates notes left there by versions from before
the Lowstate rename.

Deleted tasks and Brain Inbox notes stay in the in-app Trash for 30 days. Use
**Settings → Data → Trash** to restore the latest item or empty it permanently.

## Quick capture syntax

Task details can be added without leaving the input field:

- `#work`: category (new categories are created automatically)
- `!urgent` or `!!`: urgent priority
- `@today`, `@tomorrow`, `@weekend`, `@nextweek`: due date

Portuguese aliases such as `!urgente`, `@hoje`, and `@amanhã` also work.

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

Installer filenames include the target architecture, for example
`Lowstate-1.1.3-universal.dmg` and `Lowstate-Setup-1.1.3-x64.exe`.

To run syntax checks and the automated tests:

```bash
npm run check
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

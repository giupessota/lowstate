# Lowstate

**Lower your mental entropy.**

[![Build desktop apps](https://github.com/giupessota/lowstate/actions/workflows/build-desktop.yml/badge.svg)](https://github.com/giupessota/lowstate/actions/workflows/build-desktop.yml)

A calm planner for Windows and macOS, inspired by Japanese paper planners
(Hobonichi): grid paper, washi tape, ink stamps and plenty of white space. It
opens on today's page so you can write down everything the day needs, and
switches to the week or the month when you want the bigger picture.

> **New in 2.0:** Lowstate grew from a to-do notebook into a planner. The
> original notebook is release 1.1.7.

## Features

**Day page** (what the app opens on)

- Hourly timeline: click an empty slot to add something at that time, drag
  tasks onto it to schedule them, overlapping items sit side by side, and a
  line marks the current time
- "For this day" split into **Must do / Could do / Not today**, with "All to
  tomorrow" for what can wait
- **Mental load** meter: the app estimates how full the day feels (0–10) from
  must-dos, urgent items, busy hours, overdue tasks and heavy days before;
  you can override it with your own rating, and on heavy days it offers to
  move one nonessential task to tomorrow. It is a planning aid, not a
  measure of stress
- **Water** tracker in glasses or bottles (200 ml – 1.2 L) with a daily goal
  from 0.5 to 5 L
- **Mood of the day** (six faces) with an optional note on what shaped it
- Day notes, moon phase, day of the year and a quote at the foot of the page

**Week and month**

- Week spread: days as rows on the left page, weekly goals and free notes on
  the right
- Month calendar with Brazilian holidays, mood faces and a preview of each
  day; click a day to open it
- Month index tabs on the page edge

**Everything else**

- "To schedule" list for things without a date, plus an Overdue list
- Quick capture syntax: `#work`, `!urgent`, `@tomorrow`, and times like
  `14:30`, `14h` or `9h30`
- Categories as ink stamps, urgent seal, 30-day Trash with undo
- Settings in tabs: light/dark theme, eight cover colors, English or
  Portuguese, week start, holidays, quote style (Japanese proverbs,
  motivational, ironic or none), water unit, glass size and goal
- Automatic durable desktop snapshots plus manual backup and restore
- Installable offline PWA and Electron desktop app; Windows tray support so
  global shortcuts keep working after the window is closed

## Download

- **Web app:** [giupessota.github.io/lowstate](https://giupessota.github.io/lowstate/) — open it and click **Install** in the browser's address bar.
- **Windows / macOS installer:** [latest release](https://github.com/giupessota/lowstate/releases/latest)

Every push to `main` also creates downloadable GitHub Actions artifacts for
Windows x64 and a universal macOS build that supports both Intel and Apple
Silicon. Version tags such as `v2.0.0`
publish those installers to the corresponding GitHub Release; tags with a
suffix such as `v2.1.0-beta.1` are published as pre-releases, which the
in-app update check ignores.

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

The desktop app additionally mirrors tasks, notes, categories, and
settings into `lowstate-data.json` inside a separate per-user data directory. A
previous valid copy is kept as `lowstate-data.backup.json`; if Chromium's local
profile is reset or the current snapshot is damaged, Lowstate restores the
missing data automatically on launch. This remains local-only and is not cloud
sync. On the first launch, the desktop app also checks the legacy
`type-todo-desktop` profile and migrates notes left there by versions from before
the Lowstate rename.

Upgrading from 1.x: on first launch, 2.0 copies your existing tasks and
categories into the planner (dated tasks land on their day, the rest in "To
schedule"). The 1.x data is left untouched, so going back to 1.x still works.

Deleted tasks stay in the in-app Trash for 30 days. Use **Settings → General
→ Trash** to restore the latest item or empty it permanently.

## Quick capture syntax

Task details can be added without leaving the input field:

- `#work`: category (new categories are created automatically)
- `!urgent` or `!!`: urgent priority
- `@today`, `@tomorrow`, `@weekend`, `@nextweek`: due date
- `14:30`, `14h`, `9h30`: start time on the timeline

Portuguese aliases such as `!urgente`, `@hoje`, and `@amanhã` also work.

## Desktop edition

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
`Lowstate-2.0.0-universal.dmg` and `Lowstate-Setup-2.0.0-x64.exe`.
The Windows installer can also be built on macOS with `npm run dist:win -- --x64`;
the universal macOS build is `npm run dist:mac -- --universal`.

To preview changes without touching your installed app's data, point the
desktop edition at a copy of the data folder:

```bash
LOWSTATE_DATA_DIR=/path/to/copy npm start
```

To run syntax checks and the automated tests:

```bash
npm run check
```

## Keyboard shortcuts

**Global (desktop app — work from anywhere, even when the app is hidden):**

- `Ctrl/Cmd + Shift + Space`: show / hide Lowstate
- `Ctrl/Cmd + Shift + N` or `Ctrl/Cmd + Shift + B`: open today's page ready to
  capture

On Windows, clicking the window's **X** hides Lowstate in the system tray so
these shortcuts remain active. Use the tray menu's **Quit** command to exit it
completely.

**In-app (while the window is focused):**

- `1` `2` `3` `4`: Day, Week, Month, Habits
- `←` `→`: previous / next day, week or month
- `T`: back to today
- `N`: jump to the capture field
- `Enter`: add the task
- `Esc`: leave the field / close a dialog

<p align="center">
  <img src="public/icon.png" width="96" height="96" alt="CyberGo icon" />
</p>

<h1 align="center">CyberGo</h1>

<p align="center">
  A private, local-first agenda for tasks, events, and reminders on Windows.
</p>

<p align="center">
  <a href="https://github.com/CyberGems/CyberGo/releases/tag/v0.1.0-alpha.5"><img src="https://img.shields.io/badge/Download%20pre--release-0.1.0--alpha.5-0891B2?style=for-the-badge" alt="Download CyberGo 0.1.0-alpha.5" /></a>
  <a href="https://github.com/CyberGems/CyberGo/releases"><img src="https://img.shields.io/badge/All%20releases-30363D?style=for-the-badge&logo=github&logoColor=white" alt="All releases" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%2010%2F11-2563EB?style=flat-square" alt="Windows 10 and 11" />
  <img src="https://img.shields.io/badge/Electron-35-334155?style=flat-square&logo=electron&logoColor=white" alt="Electron 35" />
  <img src="https://img.shields.io/badge/Status-alpha-F59E0B?style=flat-square" alt="Alpha status" />
  <img src="https://img.shields.io/badge/License-GPL--3.0-334155?style=flat-square" alt="License: GPL-3.0" />
</p>

CyberGo is a desktop agenda for people who want a focused daily planner without an account, cloud sync, or a web dashboard. Create tasks and events, parse natural quick-add text, receive local reminders, and keep the data on your own Windows device.

The interface is available in **English and Spanish**. The application is currently in alpha, so backups are recommended before testing new versions.

## Highlights

### Planning

- List and calendar views for tasks and events.
- Quick Add understands phrases such as `Pagar el agua cada 30 días` and `Ir al super el 15 de cada mes`.
- The date and the time can be written in any order, in English or Spanish: `Llamar mañana a las 9`, `Dentist 3pm tomorrow` and `Llamar a las 10 mañana` all land on the day and the hour you mean.
- Daily, weekly, monthly, and yearly recurrence, including local date and time parsing.
- Monthly and yearly repetitions keep their calendar day, so a series created on the 31st returns to the 31st.
- Importance, groups, colors, notes, all-day events, and configurable reminders.
- Friendly overdue durations and resizable table columns with persisted widths.

### Notifications

- Dedicated reminder window with snooze, dismiss, open-item, and sound actions.
- Reminders are grouped by day: overdue, today, tomorrow, this week and later.
- A quick filter shows all of them, the overdue ones, the tasks, or the events.
- Every row carries its data in one line, and the color says how late a reminder is.
- Per-row quick actions: snooze ten minutes, mark a task as done, and dismiss.
- Multi-selection with Ctrl+click, by dragging a rectangle over the rows, or with Shift and the arrow keys.
- A "select all" button, and actions that work on the whole selection.
- Full keyboard navigation: arrows to move, Space to mark, Enter to open, Delete to dismiss, Ctrl+A to select all.
- Optional always-on-top behavior.
- Monitor selection, active-monitor mode, position selection, and a demo preview.
- Main window bounds are remembered and restored on the last available monitor.
- The reminder window remembers the size you give it.

### Security and privacy

- Local password or PIN lock screen with recovery code support.
- Access log for successful logins and failed attempts.
- The access log can be disabled and cleared from Security settings.
- Application data is stored locally. CyberGo does not require an account or send agenda data to a server.
- Manual backups and restore workflows are available from Backup and data settings.

### Data and experience

- CSV and ICS import and export with validation feedback.
- A damaged local database no longer stops the app from starting: the newest usable copy is restored, the damaged file is kept aside, and a notice tells you what had to be done.
- The local database records its own version, so a future update can add fields without breaking an existing installation.
- Dark, gray, and light themes, with a lower-contrast dark theme.
- Settings panel organized as a drawer with icon navigation and section headings.
- About dialog with the version, system information, and a one-click diagnostics copy.
- Styled tooltips for explanatory and truncated content.
- English and Spanish context menus for editable fields, usable with the keyboard.
- Dialogs keep the focus while they are open and give it back when they close.
- Keyboard-friendly controls, including resizable table columns.

## Download

Download the Windows installer from the [CyberGo pre-release page](https://github.com/CyberGems/CyberGo/releases/tag/v0.1.0-alpha.5).

The alpha installers are unsigned Windows executables. Windows SmartScreen may display a warning because the file does not yet have code-signing reputation. You can inspect the source, compare the SHA-256 value published with the release, or build the installer yourself.

This alpha targets **Windows 10 and Windows 11, 64-bit**.

## Getting started

1. Download and run the installer.
2. Start CyberGo from the Start menu.
3. Choose English or Spanish and select a theme.
4. Create an item with **New item**, or type a phrase in **Quick Add**.
5. Configure reminders, security, backups, and monitor placement in **Settings**.

For safety, create a backup before importing a large CSV or testing a new alpha build.

## Development

### Requirements

- Windows 10 or Windows 11, 64-bit
- [Node.js](https://nodejs.org/) 20 LTS or newer
- npm

### Install and run

```powershell
git clone https://github.com/CyberGems/CyberGo.git
cd CyberGo
npm install
npm run dev
```

### Available scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run lint` | Type-check the project without emitting files |
| `npm test` | Run the shared, renderer, and Electron tests |
| `npm run build` | Build the production renderer and Electron bundles |
| `npm run build:electron` | Run electron-builder with the default output directory |
| `npm run release:pre` | Run validation and build a versioned Windows NSIS installer |
| `npm run assets` | Regenerate the tray icon and the notification sound |

`npm run release:pre` places artifacts in a unique temporary directory. The command prints the exact path when it finishes.

## Architecture

```text
CyberGo/
├── electron/
│   ├── main.ts             Electron main process, windows, IPC, reminders
│   ├── preload.ts          Narrow context bridge exposed to the renderer
│   ├── db.ts               Local SQL.js database and settings persistence
│   └── window-bounds.ts    Multi-monitor window restoration
├── shared/
│   ├── quick.ts             Natural quick-add parsing
│   ├── schedule.ts          Dates, recurrence, and local time conversion
│   ├── csv.ts               CSV import and export
│   ├── ics.ts               ICS import and export
│   ├── auth.ts              Password and PIN secret validation
│   └── types.ts             Shared item, settings, and IPC types
├── src/
│   ├── components/          React UI, settings, reminders, and shared tooltip
│   ├── lib/                 Formatting, filtering, statistics, and sound
│   ├── themes.ts            Theme variables
│   └── i18n.ts              English and Spanish translations
├── public/                  Icon, tray asset, and sound assets
└── scripts/                 Asset and pre-release build scripts
```

CyberGo uses **Electron 35**, **React 19**, **TypeScript**, **Vite**, **SQL.js**, and **electron-builder**. The renderer communicates with the local Electron process through the preload bridge.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Open the command palette |
| `Alt+Shift+G` | Quick capture from anywhere in Windows |
| `Enter` | Open or confirm the focused action |
| `Escape` | Close the current modal or cancel the current action |
| `Space` | Select the focused row in the item table |
| `←` / `→` on a column handle | Resize the focused table column |
| Double-click on a column handle | Restore that column's default width |

Inside the reminder window:

| Shortcut | Action |
|---|---|
| `↑` / `↓` | Move the selection |
| `Enter` | Open the selected reminder |
| `Delete` / `Backspace` | Dismiss the selected reminder |
| `Ctrl+A` | Select every reminder |
| `Ctrl+click` | Add or remove an item from the selection |

## Alpha notes

- This is an alpha pre-release. Features and data formats may change.
- Keep a recent backup before importing or upgrading.
- The installer is not digitally signed yet.
- The visual identity is not finished yet, so the icon and the colors may still change before the first stable release.
- Bug reports and suggestions are welcome through [GitHub Issues](https://github.com/CyberGems/CyberGo/issues).

## Windows SmartScreen

Windows may show a SmartScreen warning the first time you run the CyberGo installer: this is an unsigned app, so Windows hasn't built reputation for the file yet. This is expected; the source is public so you can inspect exactly what it does.

To continue:

<details>
<summary><strong>See how to run the installer (step by step)</strong></summary>

Windows shows this warning for any installer without a paid code-signing certificate; it does not mean the file is unsafe. Do <strong>not</strong> click "Don't run":

1. Run the `CyberGo-Setup.exe` installer. Windows may show the blue "Windows protected your PC" dialog.
2. Click the small **More info** link. The expanded dialog shows your installer: `CyberGo-Setup.exe`.
3. Click **Run anyway**. The installer starts normally.

You can verify the file independently: compare the SHA with the GitHub release, scan it on VirusTotal, or build from source. More details: [SmartScreen guide on the website](https://cybergems.org/download#smartscreen).

</details>

---

## License

CyberGo is distributed under the terms of the GNU General Public License v3.0. See [LICENSE](LICENSE) for the full license text.

Copyright (C) 2026 CyberGems

## About CyberGems

CyberGo is part of the [CyberGems](https://github.com/CyberGems) collection of privacy-focused Windows tools.

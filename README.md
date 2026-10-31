<p align="center">
  English · <a href="./README.es.md">Español</a>
</p>

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

---

## 📑 Table of Contents

- [What is CyberGo?](#what-is-cybergo)
- [🔒 Why CyberGo?](#-why-cybergo)
- [✨ Key Features](#-key-features)
- [📥 Download](#-download)
- [🚀 Getting Started](#-getting-started)
- [🛠️ Development](#️-development)
- [🏗️ Architecture](#️-architecture)
- [⌨️ Keyboard shortcuts](#️-keyboard-shortcuts)
- [🧪 Alpha notes](#-alpha-notes)
- [🛡️ Windows SmartScreen](#️-windows-smartscreen)
- [❤️ Donate](#️-donate)
- [📄 License](#-license)
- [❓ FAQ](#-faq)
- [🔗 See also](#-see-also)

<details>
<summary><strong>🔗 Related links (outside this README)</strong></summary>

- 🌐 [CyberGo on the web](https://cybergems.org/apps/cybergo/) — overview, download and SmartScreen guide
- 📚 [Documentation & FAQ — Wiki](https://github.com/CyberGems/CyberGo/wiki) — troubleshooting and deep-dives
- 💾 [Releases](https://github.com/CyberGems/CyberGo/releases) — installers, portable builds and changelog
- 🟣 [CyberGems suite](https://github.com/CyberGems) — all open-source apps

</details>

---
## What is CyberGo?

**CyberGo** is a private, local-first agenda for Windows that helps you plan tasks, events, and reminders without an account, cloud sync, or a web dashboard. Add items in plain language with Quick Add, get local reminders, and keep every piece of data on your own device. The interface is available in English and Spanish, and the app is built with Electron + React + TypeScript.

## 🔒 Why CyberGo?

Most planners either lock your agenda behind an account and a cloud, or bury it in features you never use. CyberGo gives you **the best of both worlds**: a focused daily planner that stays entirely on your Windows device — no sign-up, no sync, no web dashboard — while still feeling modern and capable.

| Need | Solution |
|---|---|
| Keep your agenda private | 100% local storage: no account, no cloud, no telemetry |
| Plan without friction | Quick Add understands natural phrases in English or Spanish |
| Never miss what matters | Local reminders with snooze, grouping, and per-row actions |
| Stay in control of your data | CSV/ICS import & export, manual backups and restore |
| A tool that respects you | Free and open source (GPLv3), no ads, no upsells |

---
## ✨ Key Features

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

## 📥 Download

Download the Windows installer from the [CyberGo pre-release page](https://github.com/CyberGems/CyberGo/releases/tag/v0.1.0-alpha.5).

The alpha installers are unsigned Windows executables. Windows SmartScreen may display a warning because the file does not yet have code-signing reputation. You can inspect the source, compare the SHA-256 value published with the release, or build the installer yourself.

This alpha targets **Windows 10 and Windows 11, 64-bit**.

## 🚀 Getting Started

1. Download and run the installer.
2. Start CyberGo from the Start menu.
3. Choose English or Spanish and select a theme.
4. Create an item with **New item**, or type a phrase in **Quick Add**.
5. Configure reminders, security, backups, and monitor placement in **Settings**.

For safety, create a backup before importing a large CSV or testing a new alpha build.

## 🛠️ Development

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

## 🏗️ Architecture

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

## ⌨️ Keyboard shortcuts

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

## 🧪 Alpha notes

- This is an alpha pre-release. Features and data formats may change.
- Keep a recent backup before importing or upgrading.
- The installer is not digitally signed yet.
- The visual identity is not finished yet, so the icon and the colors may still change before the first stable release.
- Bug reports and suggestions are welcome through [GitHub Issues](https://github.com/CyberGems/CyberGo/issues).

## 🛡️ Windows SmartScreen

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

## ❤️ Donate

**CyberGo** is 100% free and open source. If it helps you, please consider [donating](https://cybergems.org/donate) or [starring the repo on GitHub](https://github.com/CyberGems/CyberGo) to support continued development. [Read the full story](https://cybergems.org/about/) behind the project. Thank you! 🙏

<p align="center">
  <a href="https://www.paypal.com/donate/?hosted_button_id=M4PY3UPJA5Y6Q"><img src="https://img.shields.io/badge/Donate-PayPal-0070BA?style=for-the-badge&logo=paypal" alt="Donate via PayPal" /></a>
</p>

<p align="center">
  <a href="https://ko-fi.com/cybergems"><img src="https://img.shields.io/badge/Support_me_on_Ko--fi-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white" alt="Support me on Ko-fi" /></a>
</p>

<p align="center">
  <a href="https://buymeacoffee.com/cybergems"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee" /></a>
</p>

<div align="center">

<details>
<summary><b>Crypto donations (BTC, ETH, USDT, LTC): click to view addresses</b></summary>

| Asset | Address | QR |
|---|---|---|
| **BTC** | <pre><code>bc1q5mxzz05nmvsheqzx7970euswta3fksxzcfzag4</code></pre> | <img src="assets/donate/qr-btc.png" width="90" height="90" alt="BTC QR" /> |
| **ETH** | <pre><code>0x79b703Ec0f77493679Fcd280aF3b983E20c580B8</code></pre> | <img src="assets/donate/qr-eth.png" width="90" height="90" alt="ETH QR" /> |
| **USDT (ERC20 / BEP20)** | <pre><code>0x79b703Ec0f77493679Fcd280aF3b983E20c580B8</code></pre> | <img src="assets/donate/qr-eth.png" width="90" height="90" alt="USDT QR" /> |
| **USDT (TRC20)** | <pre><code>TSVbSk1HSyZ1NprCnAYiw56ECwXgH887mD</code></pre> | <img src="assets/donate/qr-usdt-tron.png" width="90" height="90" alt="USDT TRC20 QR" /> |
| **LTC** | <pre><code>LWGnEHgcFCE2BRkzLnsdPDD8Y8ZeDK577X</code></pre> | <img src="assets/donate/qr-ltc.png" width="90" height="90" alt="LTC QR" /> |

> ⚠️ Send only the selected asset on the indicated network. Using the wrong network will result in permanent loss of funds.

</details>

</div>

---

## 📄 License

CyberGo is distributed under the terms of the GNU General Public License v3.0. See [LICENSE](LICENSE) for the full license text.

Copyright (C) 2026 CyberGems

---

## ❓ FAQ

For frequently asked questions, troubleshooting guides, and detailed configuration instructions, visit the [FAQ](https://github.com/CyberGems/CyberGo/wiki/FAQ) or the [online documentation](https://cybergems.org/docs/cybergo/FAQ).

> Documentation source of truth: the [GitHub Wiki](https://github.com/CyberGems/CyberGo/wiki) is canonical (edited via the `CyberGo.wiki` checkout). The website mirrors it.

---

<div align="center" style="background:#0D0F17; border:1px solid rgba(0,255,255,0.12); border-radius:12px; padding:28px 20px; margin-top:32px;">

### Thanks for using CyberGo! 🎉

Made by [**CyberGems**](https://cybergems.org)

</div>
<p align="center">
  <a href="https://www.reddit.com/submit?url=https%3A%2F%2Fcybergems.org%2Fapps%2Fcybergo%2F&title=CyberGo%3A%20free%20%26%20open-source%20desktop%20tool%20for%20Windows"><img src="https://img.shields.io/badge/Share_on_Reddit-FF4500?style=for-the-badge&logo=reddit&logoColor=white" alt="Share on Reddit" /></a>
  &nbsp;<a href="https://twitter.com/intent/tweet?text=CyberGo%3A%20free%20%26%20open-source%20desktop%20tool%20for%20Windows&url=https%3A%2F%2Fcybergems.org%2Fapps%2Fcybergo%2F"><img src="https://img.shields.io/badge/Share_on_X-1DA1F2?style=for-the-badge&logo=x&logoColor=white" alt="Share on X" /></a>
  &nbsp;<a href="https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fcybergems.org%2Fapps%2Fcybergo%2F"><img src="https://img.shields.io/badge/Share_on_Facebook-1877F2?style=for-the-badge&logo=facebook&logoColor=white" alt="Share on Facebook" /></a>
  &nbsp;<a href="mailto:?subject=CyberGo%3A%20free%20%26%20open-source%20desktop%20tool%20for%20Windows&body=CyberGo%3A%20free%20%26%20open-source%20desktop%20tool%20for%20Windows%20https%3A%2F%2Fcybergems.org%2Fapps%2Fcybergo%2F"><img src="https://img.shields.io/badge/Share_by_Email-EA4335?style=for-the-badge&logo=gmail&logoColor=white" alt="Share by Email" /></a>
  &nbsp;<a href="https://t.me/share/url?url=https%3A%2F%2Fcybergems.org%2Fapps%2Fcybergo%2F&text=CyberGo%3A%20free%20%26%20open-source%20desktop%20tool%20for%20Windows"><img src="https://img.shields.io/badge/Share_on_Telegram-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" alt="Share on Telegram" /></a>
  &nbsp;<a href="https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fcybergems.org%2Fapps%2Fcybergo%2F"><img src="https://img.shields.io/badge/Share_on_LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="Share on LinkedIn" /></a>
</p>

---

## 🔗 See also

More free, open-source, privacy-first apps from [**CyberGems**](https://github.com/CyberGems):

| App | Description |
|:---:|---|
| 🕐&nbsp;[**CyberClock**](https://github.com/CyberGems/CyberClock#readme) | Clock, calendar, timer, stopwatch, relaxation, and compact floating time tools for Windows. |
| 📢&nbsp;[**CyberFeeds**](https://github.com/CyberGems/CyberFeeds#readme) | Follow websites, YouTube and Reddit in one calm, private reading space. |
| 🚀&nbsp;[**CyberLauncher**](https://github.com/CyberGems/CyberLauncher#readme) | Find apps and files, launch favorites and get back to work in seconds. |
| 💻&nbsp;[**CyberManager**](https://github.com/CyberGems/CyberManager#readme) | See what is slowing your PC down and take action without losing your place. |
| 📝&nbsp;[**CyberNotes**](https://github.com/CyberGems/CyberNotes#readme) | Catch ideas, organize your thoughts and keep useful notes close, all on your PC. |
| ⚡&nbsp;[**CyberPaste**](https://github.com/CyberGems/CyberPaste#readme) | Recall anything you have ever copied — text, code, images, files — 100% local. |
| 📸&nbsp;[**CyberSnap**](https://github.com/CyberGems/CyberSnap#readme) | Capture, annotate and share anything — screenshots, recordings, text and color — with speed. |
| ⭐&nbsp;[**CyberTray**](https://github.com/CyberGems/CyberTray#readme) | Your favorite apps, files and links, one gesture away without a crowded taskbar. |
| 💫&nbsp;[**CyberViewer**](https://github.com/CyberGems/CyberViewer#readme) | Open images and videos quickly, explore whole folders and make the edits you need. |
| 🛡️&nbsp;[**CyberWall**](https://github.com/CyberGems/CyberWall#readme) | Choose which apps can connect. Review new connections and keep the rules that work for you. |

➡️ **[Browse all apps at cybergems.org](https://cybergems.org)**

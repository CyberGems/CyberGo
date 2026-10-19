# Changelog

## Unreleased

## 0.1.0-alpha.2 - 2026-10-19

Second public pre-release of CyberGo. The reminder window is now a complete workspace, the settings panel was reworked, and the app finally has an About dialog, a wiki and a public source page.

### Added

- Bilingual About dialog with the application version, system information, and a one-click diagnostics copy.
- Links to the website, repository, wiki, issues, and releases from the About dialog.
- Branded configuration footer in the settings panel, showing the CyberGo icon and version and opening the About dialog.
- Contextual reminder actions in the reminder window, with separate entries for tasks and events.
- Multi-selection of reminders with Ctrl+click, and a count of the selected items.
- Per-row urgency states in the reminder window, with overdue items listed first and due phrases refreshed while the window stays open.
- Inline quick actions on every reminder: snooze ten minutes, mark a task as done, and dismiss.
- Keyboard navigation in the reminder window: arrows to move, Enter to open, Delete to dismiss, and Ctrl+A to select everything.
- Compact inspector that details the selected reminder and groups its open, dismiss, and snooze actions.
- GPL-3.0 license.

### Improved

- Reworked the settings panel into a CyberNotes-inspired drawer with icon navigation, section headings, saved-state feedback, responsive layout, and a dedicated close action.
- Compacted the reminder window to a smaller default size, with clearer header actions for stop sound, dismiss all, and always on top.
- Notification previews now hide after three seconds, so they stay unobtrusive.
- Preview and sound controls in the notification settings now use matching icons.
- Softer default notification sound that plays reliably from the Test button.

### Fixed

- Tray context menus now open at the clicked icon, so a duplicated taskbar on a secondary monitor anchors the menu on the correct screen.
- The initial live-data reload no longer clears the demo reminders shown in the notification preview.

## 0.1.0-alpha.1 - 2026-09-28

First public pre-release of CyberGo.

### Added

- Local events and tasks with Spanish and English interfaces.
- Recurring event parsing for daily, weekly, monthly, and yearly intervals, with monthly day anchors.
- Access log for successful and failed authentication attempts, with an option to disable it.
- Backup and CSV/ICS import and export workflows with visible feedback.
- Monitor-aware main window restoration and configurable reminder placement preview.

### Improved

- Refined dark, gray, and light themes.
- More formal login experience with recovery flow and a provisional app icon.
- Friendly overdue durations in the list and reminder window.
- Resizable table columns with persisted widths and keyboard controls.
- Shared styled tooltips for truncated and explanatory UI text.
- Standardized editable-field context menus with Spanish and English actions.

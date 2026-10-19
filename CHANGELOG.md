# Changelog

## Unreleased

## 0.1.0-alpha.3 - 2026-10-19

Third public pre-release of CyberGo. This round is about trust in the local data: the database records its own version, writes once per burst of changes instead of once per change, and survives a damaged file. Dates, repetitions and imports were reworked, and every dialog now behaves like a real dialog, with the focus and the keyboard under control.

### Added

- The interface recovers from an unexpected error instead of showing a blank window.
- A notice appears when the local data had to be recovered.
- The local database records its own version, so a future update can add fields without breaking an existing installation.
- The item list is indexed, and the settings are read in a single query.
- Every value that crosses the bridge between the interface and the local process is checked before it is used.

### Improved

- The database is written once per burst of changes instead of once per change. Importing a large file and dragging the window are noticeably faster.
- Passwords and PINs are hashed with a native function instead of a slow JavaScript one, so unlocking no longer freezes the interface. Existing codes keep working.
- The interface is no longer able to navigate the application window away from the app, and a content policy is now in force.
- The window cannot be opened over a remote page, and pasting from the context menu now works and reports a failure instead of doing nothing.
- The item editor, the command palette and the confirmation dialog behave like real dialogs: they keep the focus, trap it, and give it back when they close.
- The context menu can be used with the keyboard, including the date fields.
- Controls that only show an icon now announce what they do, and every string still exists in English and Spanish.
- The reminder list and the table rows use valid ARIA, and the table no longer writes to storage on every mouse movement.
- The quick capture no longer repeats its own hint in two places.
- A task without a date no longer says "Sin fecha" twice in the list.
- The calendar closes once you pick a day, and it keeps the time you had chosen.
- The month reads "Octubre de 2026" instead of "Octubre De 2026".
- The version in the settings panel no longer breaks in the middle of the number.

### Fixed

- Escape inside the date picker now closes only the picker. It used to close the whole item editor and discard the draft.
- Enter on a dropdown no longer saves the item. The dropdown opens as expected.
- Monthly repetitions keep the day of the month they were created on. A January 31 event used to settle on the 28th of February and stay there.
- Yearly repetitions keep their calendar month. A February 29 event used to drift to March 1.
- Quick Add understands the date and the time wherever they appear. "Llamar a las 10 mañana" no longer leaves "a las 10" in the title, and the hour is no longer lost.
- Quick Add no longer reads "on Monday" as a weekly repetition. It is a single appointment.
- Quick Add keeps the meaning of "today". "hoy a las 3" no longer jumps to tomorrow at 3 in the morning.
- Quick Add uses the same hour for the same phrase, whether or not a day is mentioned.
- A malformed calendar event no longer cancels the whole import. The rest of the file is imported and the problem is reported.
- A spreadsheet formula typed in a title is no longer executed when the exported CSV is opened.
- A calendar file with a time zone, a duration or a repetition limit is imported with those values.
- A reminder no longer fires twice when two checks overlap.
- A reminder no longer appears while the app is locked in hard mode.
- A database file that is damaged no longer stops the app from starting. The newest usable copy is restored, and the app reports what the recovery had to do.
- Restoring a copy can no longer leave the app unusable. The copy is staged before it replaces anything.
- A failed sign-in attempt no longer clears the lockout when the app restarts.
- A damaged password record no longer unlocks the app with any password.
- The quick capture no longer loses what you wrote when the save fails.
- Importing a file no longer creates the same group twice.
- A monthly repetition now follows the start date when you move it.
- A decimal time such as `3.30pm` is read as a time and no longer swallows the title.
- A reminder that could not be shown is able to fire again instead of staying silent.
- A database from a newer build is left exactly as it is instead of being rewritten.
- The focus returns to the date button when the calendar closes.

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

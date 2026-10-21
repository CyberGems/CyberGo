# Changelog

## Unreleased

### Added

- The reminder window is as tall as the reminders it shows. A size the user gives it by dragging the border is remembered, and from that moment the window never changes it on its own.
- The calendar opens a day in detail, with every item of that day and a way to add one more, when a day has more items than it can show.
- The items of the list and of the calendar have a menu of their own, with the right button of the mouse. It edits the item, marks it as done and deletes it, and when several items are picked it acts on all of them.
- The toolbar of the main window has a button that picks everything at once, the same one the reminder window has, and it turns into the one that takes the selection away.
- A click on the empty room of the list takes the selection away.
- The list can be ordered by any of its columns, the way a file explorer does. Clicking the title of a column orders by it, and clicking it again turns the order around. A chevron says which column is ordering and in which way.

### Improved

- The button "Más" of the quick capture opens a menu with the other ways of creating what is written: the full editor, and an event. It is no longer the same thing as the button "New" of the title bar.
- The calendar is now a panel of the application, the way the list of items is: a month ruled like a paper calendar, the days of the week on a header, the items of each day in the color of their group, and the day that is today marked with a circle.
- A day of the calendar opens with a click on its number, and the month that owns it is the one that is shown when the day is closed.
- The items of the calendar show their hour, and the ones that do not fit are counted next to the number of the day.
- The list of the main window can pick several items by dragging a rectangle over them, the same way the reminder window does. The rows the rectangle touches are marked while the drag lasts, so it is clear what is going to be picked.
- The handle that changes the width of a column is always there, as a thin line at the edge of the header, and it only says something when the pointer rests on it.
- The menu of the right button of the reminder window works on the whole selection, the same way the one of the main window does, and it can mark the picked tasks as done.
- The picked rows say it better. The color of the accent is stronger, and the rows that the rectangle of the drag is touching are painted even stronger, so it is clear at every moment what is going to be picked.
- The rows of the drag and the picked ones carry almost the same color, so nothing changes when the drag is over, and the rectangle of the drag no longer paints over the rows it touches.
- The last column of the list, the one of the kind, has a fixed width and its title sits at the right, in line with the tag of every item.
- The handle that changes the width of a column is now at the right of the title of that column, and the first column, the one of the dot, has no handle, because where it was it did not mean anything.
- The table never grows past the window. When a column is made wider, the subject of the item gives up the room it has, and the list keeps its shape.
- The title of a column is picked anywhere in the cell, and the cell lights up as a whole when the pointer rests on it, the way a file explorer does.
- The column of the subject now has a line that separates it from the last one, so the two do not look like a single block.
- The header of the list has no dead room left. The title of the date covers the column of the dot as well, and the last column reaches the edge, so the whole header can be picked and lights up as a whole.

### Fixed

- The rectangle of the drag in the list of the main window is drawn under the pointer, and not far away from it, and it no longer stays on the screen when the drag is over.
- Dragging the edge of a column no longer leaves a rectangle on the screen nor picks the rows that are under it.
- The selection of the list is no longer taken away the moment a drag ends, when the drag is let go on the empty room of the list.
- The handle of a column no longer paints a bar over it when the pointer rests on it. Only the line on the edge lights up.
- The handle of the last column is gone. Its edge is the edge of the table, and that edge never moves, so it was dragged without anything happening.

## 0.1.0-alpha.5 - 2026-10-20

Fifth public pre-release of CyberGo. The lock screen was rebuilt to match the other apps of the suite, the application has its official icon, and the main window finally behaves like the reminder window: the list fits the space it has, several items can be picked at once, and the editor of an item has the same air as the lock.

### Added

- The lock has a third level, **Visible**, which shows the reminders and their content while the app is locked. The **Soft** level now lets the reminder through with its sound, but not its content, and the reminder window shows the lock so the user can unlock it there.

### Improved

- The list of the main window no longer needs a horizontal scroll, and the last column is no longer cut. The subject takes the room that is left, so the names are whole.
- The state of an item in the list uses the short wording, with the full one in the description.
- The rows of the list are shorter, so three more items fit on the screen.
- The quick capture takes two rows instead of three, and gives back the room it was taking from the list.
- The number of items no longer appears twice, the sidebar already has it.
- The editor of an item has the air of the lock screen: a title with a close button, the captions in small capitals, and the actions on a footer of their own.
- The sidebar of the main window is split in sections, and it can filter by kind, the same way the reminder window does.
- The notes of an item are read when the pointer rests on it, and they are part of what a screen reader says.
- The list of the main window can pick several items, with the mouse, with the keyboard, or by dragging a rectangle over them. The toolbar acts on the whole selection, and deleting several asks how many there are.
- The text of the windows is no longer picked when the pointer drags over it.
- The lock screen was reworked to match the other apps of the suite: the icon with the waves of sound that grow behind it, the name, the greeting with the hour and the date, and the version at the bottom.
- The title bar of the lock screen no longer repeats the name of the app, and it floats over the body so both read as one surface.
- The button that maximizes the window now shows the same arrows as the rest of the suite, and it turns into the restore icon when the window fills the screen.
- The hint of the Enter key is a proper key chip, the way the rest of the suite shows it, and the elements of the button sit in a line.
- Every hint of a key in the application is now that same chip.
- The waves behind the icon go out twice for every ring of the bell, and the whole movement is slower.
- The content of the buttons sits in the middle of them, the way the rest of the suite does.
- The field of the lock screen keeps the focus when the secret is wrong, so it can be corrected without reaching for the mouse.
- The window can be made as small as 840 by 560, the same as the other apps of the suite.
- The application has its official icon, the CyberGems bell. It is the one in the installer, the window, the tray, the About dialog and the lock screen, and the documentation shows it too.

### Fixed

- The content of the reminders no longer reaches the screen while the session is locked, and the native notification no longer writes the title of a reminder there.

## 0.1.0-alpha.4 - 2026-10-20

Fourth public pre-release of CyberGo. The reminder window is the heart of the app, and it was reworked from the ground up: the reminders are grouped by day, every row carries its data in one line, and several of them can be picked at once with the mouse or with the keyboard. Underneath, the local data is harder to lose: the lock is enforced by the process and not only by the window, a damaged database keeps its bytes, and a repeating item no longer jumps back to its first date when only its reminder changes.

### Added

- The reminders are grouped by day: overdue, today, tomorrow, this week and later.
- The reminder window has a quick filter for all of them, the overdue ones, the tasks and the events.
- The header of the reminder window shows how many reminders are overdue.
- The reminder window can snooze or dismiss every reminder, and the dismissal asks before it does it.
- The color of a reminder says how late it is: the longer it waits, the stronger the red.
- The room the list leaves free shows how many reminders there are and which one is the oldest.
- The reminder window has a "select all" button, and several reminders can be selected by dragging a rectangle over them.
- The state column says "En 3 días" instead of a bare "3".
- An event that already happened no longer shows as overdue. A task that is late still does, because it still waits to be done.
- The quick capture no longer keeps an empty row under the presets.
- The number of items is shown once, under the workspace title, instead of twice.
- The date picker and the calendar use the same three-letter weekday names.
- The calendar keeps a single stop in the tab order, and the arrow keys move the focus from there.
- The filter names stay on one line at the narrowest window width.
- A row without a date no longer reads "Buy milk, , ,".
- An item in the trash no longer shows an overdue badge.
- The reminder window reports a failed request instead of losing it.

### Improved

- The reminder window was reworked. Every row carries its data in one line, the actions of the footer work on the whole selection, and the snooze presets live in a menu instead of taking two rows.
- The text of the reminder window is no longer selected when the pointer drags over it.
- The reminder window shows a short wording of the moment, so the name of the item is not cut off.
- The keyboard hints of the reminder window moved into a button, so they no longer take a whole line.
- The reminder window selection can be extended with Shift and the arrow keys, and the focused row can be marked with the space bar.
- The area that moves the window shows a drag cursor, so it is clear that the window can be moved.
- The tooltip and the highlighted button of a window no longer stay when the window is minimized and restored.
- The reminder window remembers the size the user gave it, and opens a little taller than before.

### Fixed

- The command palette and the text context menu no longer disappear behind the settings panel.
- The command palette no longer opens on top of an open dialog, where the two fought over the keyboard and the focus.
- Changing only the reminder of a repeating item no longer sends the series back to its first date, which made it fire for a moment that had already passed.
- A damaged database file is now kept aside even when the data is recovered from a backup. The recovered copy used to replace it, and the original bytes were lost.
- Quick Add keeps the day a monthly or yearly series was created on. "Cada mes" on the 31st used to settle on the 28th of a shorter month, and "cada año" lost the leap day.
- "Esta mañana" is read as this morning instead of tomorrow, and the word no longer stays in the title.
- The lock is now enforced by the local process, not only by the window. A locked app can no longer export the agenda, change the items, or restore a backup behind the lock screen.
- A reminder window that fails to open no longer swallows the reminder. The broken window is discarded, so the alert can fire again.
- The soft lock lets the reminders through again. The alert was consumed and the window stayed empty, so the reminder never came back.
- Restoring a backup now checks that the copy can be opened before it replaces the database. A damaged copy used to leave the app without a usable file.
- A failed automatic backup no longer stops the app from starting.
- A write that could not be serialized is tried again, instead of waiting for the next change and being lost when the app closed.
- A time that is not a time is refused. A minute that was not a number used to be read as midnight.
- An end date that does not exist, such as the 45th of the 13th month, no longer turns a repetition into one that never ends.
- A repetition whose frequency is not one of the four is refused, instead of being read as a yearly one.
- The color of a group is only a plain color, like the color of an item. Anything else could reach out to the network when it was drawn.
- An identifier that is refused is reported, instead of creating a second copy of the item.
- The errors of a calendar import now point at the same event as the errors of the reader.
- The About dialog no longer links to a page that does not exist yet.
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

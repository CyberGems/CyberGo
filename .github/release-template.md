<p align="center">
  <img src="https://raw.githubusercontent.com/CyberGems/CyberGo/main/public/icon.png" width="120" alt="CyberGo">
</p>

## 🗓️ CyberGo {{VERSION}}: Release Notes

### 🚀 What's new in this release

<!-- IMPORTANT FOR AGENTS & MAINTAINERS: Always rewrite this entire section and highlights with the ACTUAL release notes for this specific new version before tagging. NEVER leave or copy previous version notes! Use 25-45 words for the summary, lead with user-facing changes, and do not repeat the app name or version. Keep the Spanish mirror inside the details block in sync: translate the summary and rewrite the highlights. -->
<!-- changelog-summary:start -->
The list now behaves like a file explorer: any column orders it, every item carries its own menu, and the toolbar acts on the whole selection. The calendar opens a day in detail, closing asks what to do, tooltips follow the light theme, and each installer ships with its checksum.
<!-- changelog-summary:end -->

> **New to CyberGo?** A private, local-first agenda for tasks, events and reminders on Windows.

---

### ✨ Key Features & Highlights

- 🗓️ **A list that behaves like a file explorer**: click the title of a column to order by it and click again to turn the order around, a chevron shows the active one, the order and the widths are kept between sessions, and every item has a menu of its own that edits, marks as done and deletes, acting on the whole selection when several are picked.

- 🖱️ **Selection and closing, the way the reminder window does it**: one button picks everything at once, a click on the empty room of the list takes the selection away, and closing the window asks whether to stay in the tray or quit for good, with the answer remembered if wanted.

- 📅 **A calendar with detail and a window that fits**: a day with more items than it can show opens in full with a way to add one more, and the reminder window grows to the height of its reminders and keeps the size the user gives it.

- 🎨 **Themes kept honest**: the tooltips are readable again in the light theme, the selected day of the date picker and the close and destructive buttons keep their words on their colors in the gray one, and no fixed color leaks between themes.

- 🛡️ **Hardening under the hood**: the locked window can no longer change reminders through the channels of the reminder window, the packaged page runs only its own files, the tray menu is sandboxed, settings patches are checked field by field, and a failing start now says why instead of staying silent.

<details>
<summary><b>🇪🇸 Ver notas de la versión en Español</b></summary>

### 🚀 Novedades de esta versión

La lista se comporta como un explorador de archivos: cualquier columna la ordena, cada elemento tiene su propio menú y la barra actúa sobre toda la selección. El calendario abre el día en detalle, al cerrar pregunta qué hacer, las ayudas siguen el tema claro y cada instalador llega con su checksum.

> **¿Nuevo en CyberGo?** Una agenda local y privada para tareas, eventos y avisos en Windows.

---

### ✨ Novedades destacadas

- 🗓️ **Una lista como un explorador de archivos**: el título de una columna la ordena y otra pulsación invierte el orden, una flecha señala la activa, el orden y los anchos se conservan entre sesiones, y cada elemento tiene un menú propio que edita, completa y borra, y actúa sobre toda la selección cuando hay varios.

- 🖱️ **Selección y cierre, como en la ventana de avisos**: un botón lo elige todo de una vez, una pulsación en el espacio vacío de la lista la quita, y al cerrar la ventana pregunta si se queda en la bandeja o se marcha del todo, con la respuesta recordada si se quiere.

- 📅 **Un calendario con detalle y una ventana que encaja**: un día con más avisos de los que caben se abre entero con forma de añadir uno más, y la ventana de avisos crece hasta la altura de sus avisos y conserva el tamaño que le da el usuario.

- 🎨 **Temas honestos**: las ayudas emergentes vuelven a leerse en el tema claro, el día elegido del calendario y los botones de cierre y de peligro conservan su texto sobre su color en el gris, y ningún color fijo se cuela entre temas.

- 🛡️ **Refuerzo bajo la superficie**: la ventana bloqueada ya no cambia avisos por los canales de la ventana de recordatorios, la página empaquetada solo ejecuta sus propios archivos, el menú de la bandeja va en sandbox, los parches de ajustes se revisan campo a campo y un arranque que falla dice por qué en vez de callarse.

### ℹ️ Antes de instalar

- **Windows:** esta alpha aún no está firmada digitalmente. SmartScreen puede avisar antes de ejecutarla: **Más información › Ejecutar de todas formas**. Cuando Smart App Control está activado, Windows rechaza programas sin firmar; consulta la [política de firma de código](https://github.com/CyberGems/.github/blob/main/CODE_SIGNING.md). Las funciones y los formatos de datos pueden seguir cambiando, así que haz una copia reciente antes de actualizar. Verifica la descarga con el checksum SHA-256 que aparece más abajo.

</details>

---

### ℹ️ Before you install

- **Windows:** this alpha is not code-signed yet. SmartScreen may ask before it runs: **More info › Run anyway**. Where Smart App Control is on, Windows refuses unsigned programs; see the [code signing policy](https://github.com/CyberGems/.github/blob/main/CODE_SIGNING.md). Features and data formats may still change, so keep a recent backup before upgrading. Verify the download with the SHA-256 checksum below.

---

### 📦 Downloads & Packages

> ⬇️ **Direct download:** click a file name to download it now. Same files as in **Assets** at the bottom of this page.

| File | Description | Platform |
| :--- | :--- | :--- |
| **[`CyberGo.Setup.{{VERSION_NUM}}.exe`](https://github.com/CyberGems/CyberGo/releases/download/{{VERSION}}/CyberGo.Setup.{{VERSION_NUM}}.exe)** | 🚀 **Alpha installer** (NSIS with Start Menu & Desktop shortcuts; no portable build yet) | Windows 10 / 11 (x64) |
| **[`SHA256SUMS.txt`](https://github.com/CyberGems/CyberGo/releases/download/{{VERSION}}/SHA256SUMS.txt)** | 🔐 SHA-256 checksum of the installer | Any (text) |

---

### 🔐 VirusTotal and SHA256

> 🛡️ The report opens on VirusTotal and does not download anything.

**Installer**: [View VirusTotal report](https://www.virustotal.com/gui/file/{{INSTALLER_HASH}})

```text
{{INSTALLER_HASH}}
```

---

📜 **Full changelog:** browse every version in [CHANGELOG.md](https://github.com/CyberGems/CyberGo/blob/main/CHANGELOG.md).

*Crafted with precision by [CyberGems](https://cybergems.org)*

<p align="center">
  <img src="https://raw.githubusercontent.com/CyberGems/CyberGo/main/public/icon.png" width="120" alt="CyberGo">
</p>

## 🗓️ CyberGo {{VERSION}}: Release Notes

### 🚀 What's new in this release

<!-- IMPORTANT FOR AGENTS & MAINTAINERS: Always rewrite this entire section and highlights with the ACTUAL release notes for this specific new version before tagging. NEVER leave or copy previous version notes! Use 25-45 words for the summary, lead with user-facing changes, and do not repeat the app name or version. Keep the Spanish mirror inside the details block in sync: translate the summary and rewrite the highlights. -->
<!-- changelog-summary:start -->
Upgrades Electron to 42.11.18 to eliminate the white native titlebar glitch on Windows tray popups, fixes tray flicker and cross-monitor jumps with a 4px flyout gap, makes the Avisos button a toggle, and refines calendar, date picker, and About views.
<!-- changelog-summary:end -->

> **New to CyberGo?** A private, local-first agenda for tasks, events and reminders on Windows.

---

### ✨ Key Features & Highlights

- 🪟 **Clean multi-monitor tray on Electron 42**: Upgraded Electron to `42.11.18` and switched the tray menu to a fresh prewarmed window with two-step transparent reveal and a `4px` flyout gap, removing the white titlebar flash, repeated-open flicker, and cross-monitor jumps.

- 🔔 **Toggleable Reminders and clearer dates**: The toolbar `Avisos` button now toggles the reminders window and reflects locked state in its title, `Nuevo` defaults to ten minutes ahead with linked start/end dragging, and tasks can be completed directly from the calendar.

- 🎨 **Themed splash and aligned About dialog**: The startup splash follows the active theme and the About dialog layout matches CyberNotes.

<details>
<summary><b>🇪🇸 Ver notas de la versión en Español</b></summary>

### 🚀 Novedades de esta versión

Actualiza Electron a 42.11.18 para eliminar el fallo de barra blanca en la bandeja de Windows, corrige parpadeos y saltos entre monitores con flyouts a 4px, convierte Avisos en un interruptor y pule calendario, selector de fechas y Acerca de.

> **¿Nuevo en CyberGo?** Una agenda local y privada para tareas, eventos y avisos en Windows.

---

### ✨ Novedades destacadas

- 🪟 **Bandeja limpia en multimonitor con Electron 42**: Se actualizó Electron a `42.11.18` y se pasó el menú de bandeja a ventana precalentada con revelado transparente en dos pasos y espacio de `4px`, eliminando la barra de título blanca, el parpadeo y los saltos entre monitores.

- 🔔 **Avisos alternables y fechas más ágiles**: El botón `Avisos` ahora alterna mostrar/ocultar la ventana e indica el estado bloqueado en el título, `Nuevo` propone 10 minutos adelante arrastrando inicio y fin juntos, y las tareas pueden completarse desde el calendario.

- 🎨 **Splash con tema y diálogo Acerca de alineado**: La pantalla inicial respeta el tema activo y el diálogo Acerca de iguala el diseño de CyberNotes.

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

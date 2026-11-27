<p align="center">
  <img src="https://raw.githubusercontent.com/CyberGems/CyberGo/main/public/icon.png" width="120" alt="CyberGo">
</p>

## 🗓️ CyberGo {{VERSION}}: Release Notes

### 🚀 What's new in this release

<!-- IMPORTANT FOR AGENTS & MAINTAINERS: Always rewrite this entire section and highlights with the ACTUAL release notes for this specific new version before tagging. NEVER leave or copy previous version notes! Use 25-45 words for the summary, lead with user-facing changes, and do not repeat the app name or version. Keep the Spanish mirror inside the details block in sync: translate the summary and rewrite the highlights. -->
<!-- COVERAGE: list every commit since the previous tag before drafting. Give every user-facing change at least one highlight and group related commits into one. Skip internal refactors, CI, tests and dependency bumps with no visible effect; keep small visible fixes such as copy, tooltips, shortcuts, themes, icons, spacing, stability and perceptible performance. Review the draft if 15+ user-facing commits produce fewer than 6 highlights, or 40+ total commits fewer than 8. Patch releases may have 1-3 highlights or a plain maintenance-only note. -->
<!-- changelog-summary:start -->
Adds verified manual updates from About, including download progress and installation when automatic notices are off. The setting is shared between About and Settings. Installer setup now opens the updated app, alongside refinements to the title bar, tray, task list, calendar, and themes.
<!-- changelog-summary:end -->

> **New to CyberGo?** A private, local-first agenda for tasks, events and reminders on Windows.

---

### ✨ Key Features & Highlights

- 🔄 **Verified manual updates:** About can check releases, download the matching installer with progress, verify its SHA-256 checksum, and install it. Manual checks and installs remain available when automatic notices are off.

- 🔔 **One update notice setting:** The same preference is available in About and Settings, stays synchronized, and keeps its state after restarting the app.

- 🪟 **Installer and interface refinements:** In-app updates show the standard Windows setup assistant, whose Finish action opens the new version. The title bar, tray, task list, calendar, and theme-aware controls also received updates.

<details>
<summary><b>🇪🇸 Ver notas de la versión en Español</b></summary>

### 🚀 Novedades de esta versión

Permite buscar, descargar e instalar actualizaciones manualmente desde Acerca de, con progreso y verificación SHA-256, incluso con los avisos automáticos apagados. El interruptor se comparte con Configuración y el asistente abre la nueva versión al finalizar.

> **¿Nuevo en CyberGo?** Una agenda local y privada para tareas, eventos y avisos en Windows.

---

### ✨ Novedades destacadas

- 🔄 **Actualizaciones manuales verificadas:** Acerca de puede buscar versiones, descargar el instalador correspondiente mostrando el progreso, comprobar su checksum SHA-256 e instalarlo. La búsqueda y la instalación manual siguen disponibles con los avisos apagados.

- 🔔 **Una sola preferencia de avisos:** El mismo interruptor aparece en Acerca de y Configuración, sincroniza ambos sitios y conserva su estado al reiniciar la app.

- 🪟 **Instalador e interfaz mejorados:** Las actualizaciones muestran el asistente normal de Windows y, al terminar, abren la nueva versión. También se actualizaron la barra de título, la bandeja, las vistas de tareas y calendario, y los controles adaptados al tema.

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

---

### 🔐 VirusTotal and SHA256

> 🛡️ The report opens on VirusTotal and does not download anything. Sometimes one or two antivirus providers flag a safe file while the rest clear it; that is usually a false alarm. Our software is threat-free and the source code is public, so anyone can check it. Compare the SHA-256 below with your download and use only the links on this page.
> 🛡️ El informe se abre en VirusTotal y no descarga nada. A veces uno o dos proveedores de antivirus marcan un archivo seguro mientras los demás lo dan por limpio; suele ser una falsa alarma. Nuestro software está libre de amenazas y el código es público, cualquiera puede comprobarlo. Compara el SHA-256 de abajo con tu descarga y usa solo los enlaces de esta página.

**Installer**: [View VirusTotal report](https://www.virustotal.com/gui/file/{{INSTALLER_HASH}})

```text
{{INSTALLER_HASH}}
```

The checksums are also available as a downloadable [SHA256SUMS.txt](https://github.com/CyberGems/CyberGo/releases/download/{{VERSION}}/SHA256SUMS.txt).

---

📜 **Full changelog:** browse every version in [CHANGELOG.md](https://github.com/CyberGems/CyberGo/blob/main/CHANGELOG.md).

*Crafted with precision by [CyberGems](https://cybergems.org)*

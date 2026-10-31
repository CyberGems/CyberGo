<p align="center">
  <a href="./README.md">English</a> · Español
</p>

<p align="center">
  <a href="https://cybergems.org/apps/cybergo/">
    <img src="https://cybergems.org/banners/es/cybergo.png" alt="CyberGo: agenda privada y local para Windows" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/CyberGems/CyberGo/releases/tag/v0.1.0-alpha.5"><img src="https://img.shields.io/badge/Descargar%20pre--release-0.1.0--alpha.5-0891B2?style=for-the-badge" alt="Descargar CyberGo 0.1.0-alpha.5" /></a>
  <a href="https://github.com/CyberGems/CyberGo/releases"><img src="https://img.shields.io/badge/Todas_las_versiones-30363D?style=for-the-badge&logo=github&logoColor=white" alt="Todas las versiones" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Plataforma-Windows%2010%2F11-2563EB?style=flat-square" alt="Windows 10 y 11" />
  <img src="https://img.shields.io/badge/Electron-35-334155?style=flat-square&logo=electron&logoColor=white" alt="Electron 35" />
  <img src="https://img.shields.io/badge/Estado-alpha-F59E0B?style=flat-square" alt="Estado: alpha" />
  <img src="https://img.shields.io/badge/Licencia-GPL--3.0-334155?style=flat-square" alt="Licencia: GPL-3.0" />
</p>

CyberGo es una agenda de escritorio para quienes quieren un planificador diario enfocado, sin cuenta, sin sincronización en la nube y sin un panel web. Crea tareas y eventos, analiza texto rápido en lenguaje natural, recibe avisos locales y mantén los datos en tu propio equipo Windows.

La interfaz está disponible en **inglés y español**. La aplicación está actualmente en fase alpha, por lo que se recomiendan copias de seguridad antes de probar nuevas versiones.

---

## 📑 Table of Contents

- [Destacados](#destacados)
- [Descargar](#descargar)
- [Primeros pasos](#primeros-pasos)
- [Desarrollo](#desarrollo)
- [Arquitectura](#arquitectura)
- [Atajos de teclado](#atajos-de-teclado)
- [Notas de la versión alpha](#notas-de-la-versión-alpha)
- [Windows SmartScreen](#windows-smartscreen)
- [❤️ Donar](#️-donar)
- [📄 Licencia](#-licencia)
- [❓ Preguntas frecuentes](#-preguntas-frecuentes)
- [🔗 Ver también](#-ver-también)

<details>
<summary><strong>🔗 Related links (outside this README)</strong></summary>

- 🌐 [CyberGo en la web](https://cybergems.org/apps/cybergo/) — resumen, descarga y guía de SmartScreen
- 📚 [Documentación y FAQ — Wiki](https://github.com/CyberGems/CyberGo/wiki) — solución de problemas y guías detalladas
- 💾 [Releases](https://github.com/CyberGems/CyberGo/releases) — instaladores, versiones portátiles y changelog
- 🟣 [Suite CyberGems](https://github.com/CyberGems) — todas las apps de código abierto

</details>

---

## Destacados

### Planificación

- Vistas de lista y calendario para tareas y eventos.
- Quick Add entiende frases como `Pagar el agua cada 30 días` e `Ir al super el 15 de cada mes`.
- La fecha y la hora se pueden escribir en cualquier orden, en inglés o en español: `Llamar mañana a las 9`, `Dentist 3pm tomorrow` y `Llamar a las 10 mañana` aterrizan en el día y la hora que quieres.
- Recurrencia diaria, semanal, mensual y anual, incluida la interpretación de fecha y hora local.
- Las repeticiones mensuales y anuales conservan su día del calendario, así que una serie creada el día 31 vuelve al 31.
- Importancia, grupos, colores, notas, eventos de todo el día y avisos configurables.
- Duraciones vencidas legibles y columnas de tabla redimensionables con ancho persistido.

### Avisos

- Ventana de aviso dedicada con acciones de posponer, descartar, abrir elemento y sonido.
- Los avisos se agrupan por día: vencidos, hoy, mañana, esta semana y más adelante.
- Un filtro rápido muestra todos, los vencidos, las tareas o los eventos.
- Cada fila muestra sus datos en una línea, y el color indica cuán atrasado está el aviso.
- Acciones rápidas por fila: posponer diez minutos, marcar tarea como hecha y descartar.
- Selección múltiple con Ctrl+clic, arrastrando un rectángulo sobre las filas, o con Shift y las flechas.
- Un botón "seleccionar todo" y acciones que actúan sobre toda la selección.
- Navegación completa por teclado: flechas para mover, Espacio para marcar, Enter para abrir, Supr para descartar, Ctrl+A para seleccionar todo.
- Comportamiento opcional "siempre visible".
- Selección de monitor, modo monitor activo, selección de posición y una vista previa de demostración.
- Los límites de la ventana principal se recuerdan y restauran en el último monitor disponible.
- La ventana de aviso recuerda el tamaño que le des.

### Seguridad y privacidad

- Pantalla de bloqueo local con contraseña o PIN, con código de recuperación.
- Registro de acceso para inicios de sesión correctos e intentos fallidos.
- El registro de acceso se puede desactivar y borrar desde Ajustes de seguridad.
- Los datos de la aplicación se guardan localmente. CyberGo no requiere cuenta ni envía datos de la agenda a un servidor.
- Las copias de seguridad manuales y su restauración están disponibles en Ajustes de copia de datos.

### Datos y experiencia

- Importación y exportación CSV e ICS con validación.
- Una base de datos local dañada ya no impide el arranque: se restaura la copia utilizable más reciente, el archivo dañado se aparta y un aviso te cuenta lo que hubo que hacer.
- La base de datos local registra su propia versión, para que una actualización futura pueda añadir campos sin romper una instalación existente.
- Temas oscuro, gris y claro, con un tema oscuro de menor contraste.
- Panel de ajustes organizado como un cajón con navegación por iconos y encabezados de sección.
- Diálogo Acerca de con la versión, información del sistema y una copia de diagnóstico con un clic.
- Tooltips con estilo para contenido explicativo o truncado.
- Menús contextuales en inglés y español para campos editables, usables con el teclado.
- Los diálogos mantienen el foco mientras están abiertos y lo devuelven al cerrarse.
- Controles amigables con el teclado, incluidas columnas de tabla redimensionables.

## Descargar

Descarga el instalador de Windows desde la [página de pre-release de CyberGo](https://github.com/CyberGems/CyberGo/releases/tag/v0.1.0-alpha.5).

Los instaladores alpha son ejecutables de Windows sin firmar. Es posible que Windows SmartScreen muestre una advertencia porque el archivo aún no tiene reputación de firma de código. Puedes inspeccionar el código fuente, comparar el valor SHA-256 publicado con la release, o construir el instalador tú mismo.

Esta versión alpha está pensada para **Windows 10 y Windows 11 de 64 bits**.

## Primeros pasos

1. Descarga y ejecuta el instalador.
2. Inicia CyberGo desde el menú Inicio.
3. Elige inglés o español y selecciona un tema.
4. Crea un elemento con **Nuevo elemento**, o escribe una frase en **Quick Add**.
5. Configura avisos, seguridad, copias de seguridad y la posición del monitor en **Ajustes**.

Por seguridad, crea una copia de seguridad antes de importar un CSV grande o probar una nueva build alpha.

## Desarrollo

### Requisitos

- Windows 10 o Windows 11, 64 bits
- [Node.js](https://nodejs.org/) 20 LTS o superior
- npm

### Instalar y ejecutar

```powershell
git clone https://github.com/CyberGems/CyberGo.git
cd CyberGo
npm install
npm run dev
```

### Scripts disponibles

| Comando | Propósito |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo de Vite |
| `npm run lint` | Verifica tipos del proyecto sin generar archivos |
| `npm run test` | Ejecuta las pruebas compartidas, del renderer y de Electron |
| `npm run build` | Compila el renderer de producción y los paquetes de Electron |
| `npm run build:electron` | Ejecuta electron-builder con el directorio de salida predeterminado |
| `npm run release:pre` | Ejecuta la validación y construye un instalador NSIS de Windows con versión |
| `npm run assets` | Regenera el icono de la bandeja y el sonido de notificación |

`npm run release:pre` coloca los artefactos en un directorio temporal único. El comando imprime la ruta exacta al terminar.

## Arquitectura

```text
CyberGo/
├── electron/
│   ├── main.ts             Proceso principal de Electron, ventanas, IPC, avisos
│   ├── preload.ts          Puente de contexto estrecho expuesto al renderer
│   ├── db.ts               Base de datos SQL.js local y persistencia de ajustes
│   └── window-bounds.ts    Restauración de ventanas en varios monitores
├── shared/
│   ├── quick.ts            Análisis natural de Quick Add
│   ├── schedule.ts         Fechas, recurrencia y conversión de hora local
│   ├── csv.ts              Importación y exportación CSV
│   ├── ics.ts              Importación y exportación ICS
│   ├── auth.ts             Validación de secreto de contraseña y PIN
│   └── types.ts            Tipos compartidos de elemento, ajustes e IPC
├── src/
│   ├── components/          UI de React, ajustes, avisos y tooltip compartido
│   ├── lib/                 Formato, filtrado, estadísticas y sonido
│   ├── themes.ts            Variables de tema
│   └── i18n.ts              Traducciones en inglés y español
├── public/                  Icono, recurso de bandeja y sonidos
└── scripts/                 Scripts de recursos y de build de pre-release
```

CyberGo usa **Electron 35**, **React 19**, **TypeScript**, **Vite**, **SQL.js** y **electron-builder**. El renderer se comunica con el proceso local de Electron a través del puente de preload.

## Atajos de teclado

| Atajo | Acción |
|---|---|
| `Ctrl+K` | Abre la paleta de comandos |
| `Alt+Shift+G` | Captura rápida desde cualquier parte de Windows |
| `Enter` | Abre o confirma la acción enfocada |
| `Escape` | Cierra el modal actual o cancela la acción actual |
| `Space` | Selecciona la fila enfocada en la tabla de elementos |
| `←` / `→` en el asa de una columna | Redimensiona la columna de tabla enfocada |
| Doble clic en el asa de una columna | Restaura el ancho predeterminado de esa columna |

Dentro de la ventana de avisos:

| Atajo | Acción |
|---|---|
| `↑` / `↓` | Mueve la selección |
| `Enter` | Abre el aviso seleccionado |
| `Delete` / `Backspace` | Descarta el aviso seleccionado |
| `Ctrl+A` | Selecciona todos los avisos |
| `Ctrl+clic` | Añade o quita un elemento de la selección |

## Notas de la versión alpha

- Esta es una pre-release alpha. Las funciones y los formatos de datos pueden cambiar.
- Mantén una copia de seguridad reciente antes de importar o actualizar.
- El instalador aún no está firmado digitalmente.
- La identidad visual aún no está terminada, por lo que el icono y los colores pueden cambiar antes de la primera versión estable.
- Los informes de errores y sugerencias son bienvenidos a través de [GitHub Issues](https://github.com/CyberGems/CyberGo/issues).

## Windows SmartScreen

Es posible que Windows muestre una advertencia de SmartScreen la primera vez que ejecutes el instalador de CyberGo: es una app sin firmar, así que Windows aún no ha ganado reputación para el archivo. Es esperado; el código es público, así que puedes inspeccionar exactamente qué hace.

Para continuar:

<details>
<summary><strong>Ver cómo ejecutar el instalador (paso a paso)</strong></summary>

Windows muestra esta advertencia para cualquier instalador sin un certificado de firma de código de pago; no significa que el archivo sea inseguro. No hagas clic en "Don't run":

1. Ejecuta el instalador `CyberGo-Setup.exe`. Es posible que Windows muestre el cuadro azul "Windows protegió tu PC".
2. Haz clic en el pequeño enlace **Más información**. El cuadro expandido muestra tu instalador: `CyberGo-Setup.exe`.
3. Haz clic en **Ejecutar de todas formas**. El instalador arranca con normalidad.

Puedes verificar el archivo por tu cuenta: compara el SHA con la release de GitHub, escanea en VirusTotal o compílalo desde el código fuente. Más detalles: [guía de SmartScreen en el sitio web](https://cybergems.org/download#smartscreen).

</details>

---

## ❤️ Donar

**CyberGo** es 100% gratis y de código abierto. Si te resulta útil, por favor considera [donar](https://cybergems.org/donate) o [dar una estrella al repo en GitHub](https://github.com/CyberGems/CyberGo) para apoyar el desarrollo continuo. [Lee la historia completa](https://cybergems.org/about/) del proyecto. ¡Gracias! 🙏

<p align="center">
  <a href="https://www.paypal.com/donate/?hosted_button_id=M4PY3UPJA5Y6Q"><img src="https://img.shields.io/badge/Donar-PayPal-0070BA?style=for-the-badge&logo=paypal" alt="Donar con PayPal" /></a>
</p>

<p align="center">
  <a href="https://ko-fi.com/cybergems"><img src="https://img.shields.io/badge/Apóyame_en_Ko--fi-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white" alt="Apóyame en Ko-fi" /></a>
</p>

<p align="center">
  <a href="https://buymeacoffee.com/cybergems"><img src="https://img.shields.io/badge/Invítame_a_un_café-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Invítame a un café" /></a>
</p>

<div align="center">

<details>
<summary><b>Donaciones cripto (BTC, ETH, USDT, LTC): haz clic para ver las direcciones</b></summary>

| Activo | Dirección | QR |
|---|---|---|
| **BTC** | <pre><code>bc1q5mxzz05nmvsheqzx7970euswta3fksxzcfzag4</code></pre> | <img src="assets/donate/qr-btc.png" width="90" height="90" alt="QR de BTC" /> |
| **ETH** | <pre><code>0x79b703Ec0f77493679Fcd280aF3b983E20c580B8</code></pre> | <img src="assets/donate/qr-eth.png" width="90" height="90" alt="QR de ETH" /> |
| **USDT (ERC20 / BEP20)** | <pre><code>0x79b703Ec0f77493679Fcd280aF3b983E20c580B8</code></pre> | <img src="assets/donate/qr-eth.png" width="90" height="90" alt="QR de USDT" /> |
| **USDT (TRC20)** | <pre><code>TSVbSk1HSyZ1NprCnAYiw56ECwXgH887mD</code></pre> | <img src="assets/donate/qr-usdt-tron.png" width="90" height="90" alt="QR de USDT TRC20" /> |
| **LTC** | <pre><code>LWGnEHgcFCE2BRkzLnsdPDD8Y8ZeDK577X</code></pre> | <img src="assets/donate/qr-ltc.png" width="90" height="90" alt="QR de LTC" /> |

> ⚠️ Envía solo el activo seleccionado en la red indicada. Usar la red incorrecta provocará la pérdida permanente de fondos.

</details>

</div>

---

## 📄 Licencia

CyberGo se distribuye bajo los términos de la Licencia Pública General GNU v3.0. Consulta [LICENSE](LICENSE) para el texto completo de la licencia.

Copyright (C) 2026 CyberGems

---

## ❓ Preguntas frecuentes

Para preguntas frecuentes, guías de solución de problemas e instrucciones detalladas de configuración, visita las [Preguntas frecuentes](https://github.com/CyberGems/CyberGo/wiki/FAQ) o la [documentación en línea](https://cybergems.org/docs/cybergo/FAQ).

> Fuente de verdad de la documentación: la [wiki de GitHub](https://github.com/CyberGems/CyberGo/wiki) es la canónica (editada desde el checkout `CyberGo.wiki`). El sitio web la refleja.

---

<div align="center" style="background:#0D0F17; border:1px solid rgba(0,255,255,0.12); border-radius:12px; padding:28px 20px; margin-top:32px;">

### ¡Gracias por usar CyberGo! 🎉

Creado por [**CyberGems**](https://cybergems.org)

</div>
<p align="center">
  <a href="https://www.reddit.com/submit?url=https%3A%2F%2Fcybergems.org%2Fapps%2Fcybergo%2F&title=CyberGo%3A%20herramienta%20de%20escritorio%20gratuita%20y%20de%20c%C3%B3digo%20abierto%20para%20Windows"><img src="https://img.shields.io/badge/Compartir_en_Reddit-FF4500?style=for-the-badge&logo=reddit&logoColor=white" alt="Compartir en Reddit" /></a>
  &nbsp;<a href="https://twitter.com/intent/tweet?text=CyberGo%3A%20herramienta%20de%20escritorio%20gratuita%20y%20de%20c%C3%B3digo%20abierto%20para%20Windows&url=https%3A%2F%2Fcybergems.org%2Fapps%2Fcybergo%2F"><img src="https://img.shields.io/badge/Compartir_en_X-1DA1F2?style=for-the-badge&logo=x&logoColor=white" alt="Compartir en X" /></a>
  &nbsp;<a href="https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fcybergems.org%2Fapps%2Fcybergo%2F"><img src="https://img.shields.io/badge/Compartir_en_Facebook-1877F2?style=for-the-badge&logo=facebook&logoColor=white" alt="Compartir en Facebook" /></a>
  &nbsp;<a href="mailto:?subject=CyberGo%3A%20herramienta%20de%20escritorio%20gratuita%20y%20de%20c%C3%B3digo%20abierto%20para%20Windows&body=CyberGo%3A%20herramienta%20de%20escritorio%20gratuita%20y%20de%20c%C3%B3digo%20abierto%20para%20Windows%20https%3A%2F%2Fcybergems.org%2Fapps%2Fcybergo%2F"><img src="https://img.shields.io/badge/Compartir_por_Email-EA4335?style=for-the-badge&logo=gmail&logoColor=white" alt="Compartir por correo" /></a>
  &nbsp;<a href="https://t.me/share/url?url=https%3A%2F%2Fcybergems.org%2Fapps%2Fcybergo%2F&text=CyberGo%3A%20herramienta%20de%20escritorio%20gratuita%20y%20de%20c%C3%B3digo%20abierto%20para%20Windows"><img src="https://img.shields.io/badge/Compartir_en_Telegram-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" alt="Compartir en Telegram" /></a>
  &nbsp;<a href="https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fcybergems.org%2Fapps%2Fcybergo%2F"><img src="https://img.shields.io/badge/Compartir_en_LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="Compartir en LinkedIn" /></a>
</p>

---

## 🔗 Ver también

Más aplicaciones gratuitas, de código abierto y con la privacidad primero de [**CyberGems**](https://github.com/CyberGems):

| App | Descripción |
|:---:|---|
| 🕐&nbsp;[**CyberClock**](https://github.com/CyberGems/CyberClock#readme) | Reloj, calendario, temporizador, cronómetro, relajación y herramientas flotantes compactas para Windows. |
| 📢&nbsp;[**CyberFeeds**](https://github.com/CyberGems/CyberFeeds#readme) | Sigue sitios web, YouTube y Reddit en un espacio de lectura tranquilo y privado. |
| 🚀&nbsp;[**CyberLauncher**](https://github.com/CyberGems/CyberLauncher#readme) | Encuentra apps y archivos, abre tus favoritos y vuelve a lo tuyo en segundos. |
| 💻&nbsp;[**CyberManager**](https://github.com/CyberGems/CyberManager#readme) | Descubre qué ralentiza tu PC y actúa sin perder de vista lo importante. |
| 📝&nbsp;[**CyberNotes**](https://github.com/CyberGems/CyberNotes#readme) | Captura ideas, ordena tus pensamientos y ten tus notas a mano, todo en tu PC. |
| ⚡&nbsp;[**CyberPaste**](https://github.com/CyberGems/CyberPaste#readme) | Recupera todo lo que hayas copiado — texto, código, imágenes, archivos — 100% local. |
| 📸&nbsp;[**CyberSnap**](https://github.com/CyberGems/CyberSnap#readme) | Captura, anota y comparte cualquier cosa — imágenes, grabaciones, texto y color — con rapidez. |
| ⭐&nbsp;[**CyberTray**](https://github.com/CyberGems/CyberTray#readme) | Tus apps, archivos y enlaces favoritos a un gesto, sin saturar la barra de tareas. |
| 💫&nbsp;[**CyberViewer**](https://github.com/CyberGems/CyberViewer#readme) | Abre imágenes y videos rápido, recorre carpetas y haz los ajustes que necesitas. |
| 🛡️&nbsp;[**CyberWall**](https://github.com/CyberGems/CyberWall#readme) | Decide qué apps pueden conectarse. Revisa las conexiones nuevas y conserva las reglas que te convengan. |

➡️ **[Todas las aplicaciones en cybergems.org](https://cybergems.org)**

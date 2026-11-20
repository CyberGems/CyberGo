# Privacidad — CyberGo

CyberGo funciona en tu PC y guarda tus datos en tu PC. **No tiene cuenta, telemetría, SDK de analítica ni anuncios.** Nunca envía tu citas, ajustes o copias de seguridad a su autor ni a nadie más.

Todo lo que sabe (citas, ajustes o copias de seguridad) se queda en `%APPDATA%\cybergo.db` y la carpeta `backups\`. El instalador conserva los datos (`deleteAppDataOnUninstall: false`). Borra esos archivos manualmente si quieres eliminarlos.

## Cuándo CyberGo se conecta a internet

Estas son todas las conexiones que CyberGo hace por su cuenta. Ninguna envía tu citas, ajustes o copias de seguridad. Como en cualquier petición de internet, el servidor ve tu dirección IP.

| Cuándo | Dónde | Para qué | Cómo desactivarlo |
|---|---|---|---|
| 20 segundos después de iniciar y después cada 6 horas | `api.github.com` (lista de releases) | Consultar una versión nueva | Sin ajuste específico |

Un enlace que pulsas dentro de la app o una página web que abres en tu navegador es una acción tuya, no una conexión que la app haga por su cuenta. CyberGo es una pre-release alpha; los detalles pueden cambiar antes de la primera versión estable.

## Qué lee CyberGo de tu PC

CyberGo lee solo su base de datos local. Esa información se queda en pantalla. Todo lo que cambia el sistema pide confirmación antes y, cuando es posible, guarda una copia para poder deshacerlo.

## Dudas

Abre un issue: https://github.com/CyberGems/CyberGo/issues

Para una pregunta concreta sobre privacidad, usa la [página de contacto](https://cybergems.org/contact). La declaración general de la suite está en [cybergems.org/es/privacy](https://cybergems.org/es/privacy).

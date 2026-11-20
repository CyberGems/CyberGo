# Privacy — CyberGo

CyberGo runs on your PC and keeps your data on your PC. It has **no account, no telemetry, no analytics SDK and no ads**. It never sends your appointments, settings or backups to its author or to anyone else.

Everything it knows (appointments, settings or backups) stays in `%APPDATA%\cybergo.db` and the `backups\` folder. The installer keeps app data (`deleteAppDataOnUninstall: false`). Remove those files manually if you want them gone.

## When CyberGo goes online

These are all the connections CyberGo makes by itself. None of them sends your appointments, settings or backups. Like any request on the internet, the server sees your IP address.

| When | Where | What for | How to turn it off |
|---|---|---|---|
| 20 seconds after launch, then every 6 hours | `api.github.com` (the releases list) | Check for a newer version | No dedicated setting |

A link you click inside the app, or a web page you open in your browser, is your own action and is not a connection the app makes by itself. CyberGo is an alpha pre-release; details may change before the first stable release.

## What CyberGo reads on your PC

CyberGo reads only its local database. That information stays on your screen. Anything that changes the system asks for confirmation first and, where possible, is backed up so it can be undone.

## Questions

Open an issue: https://github.com/CyberGems/CyberGo/issues

For a privacy-specific question, use the [contact page](https://cybergems.org/contact). The suite-wide statement is at [cybergems.org/privacy](https://cybergems.org/privacy).

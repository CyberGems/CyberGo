; CyberGo NSIS customizations (electron-builder include)
;
; Skips the welcome page when the installer runs as an update, so the user
; lands directly on the options that matter for an upgrade.

!macro customWelcomePage
  !insertmacro skipPageIfUpdated
  !insertmacro MUI_PAGE_WELCOME
!macroend

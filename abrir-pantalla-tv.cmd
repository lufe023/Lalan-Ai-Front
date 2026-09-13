@echo off
rem ===================================================================
rem  Abre la pantalla del salon SIN nada del navegador.
rem
rem  Por que hace falta:
rem  Una aplicacion instalada en Windows conserva siempre esa barrita
rem  de titulo con el nombre y los botones de cerrar. El manifiesto pide
rem  "fullscreen", pero Chrome en escritorio no lo concede: solo lo hace
rem  en movil y en television. Desde dentro de la pagina tampoco se
rem  puede forzar, porque la pantalla completa exige un toque reciente.
rem
rem  Lo unico que lo resuelve de verdad es arrancar Chrome ya en modo
rem  quiosco, que es lo que hace este archivo.
rem
rem  COMO USARLO
rem   1. Cambia la linea URL de abajo por la direccion de TU pantalla
rem      (la que copiaste en Ajustes, con su token).
rem   2. Doble clic. Para salir: Alt+F4.
rem   3. Si quieres que arranque sola al encender el televisor, pulsa
rem      Win+R, escribe  shell:startup  y copia aqui un acceso directo.
rem ===================================================================

set "URL=https://CAMBIA-ESTO.devtunnels.ms/#/pantalla/TU-TOKEN"

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

rem --kiosk       pantalla completa de verdad, sin barras ni pestanas
rem --app         sin barra de direcciones aunque se salga del quiosco
rem --autoplay... deja sonar la musica sin que nadie toque la pantalla
start "" "%CHROME%" --kiosk --app="%URL%" --autoplay-policy=no-user-gesture-required --disable-features=TranslateUI --noerrdialogs --disable-session-crashed-bubble

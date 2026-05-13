@echo off
REM Wrapper per executar el backup. Doble-clic o crida des de Tasques Programades.
REM Per canviar la carpeta destí, edita o defineix BACKUP_DIR aqui:
REM   set BACKUP_DIR=C:\Users\Usuario\OneDrive\GESEM-Backups

cd /d "%~dp0"
node scripts\backup.js
if errorlevel 1 (
  echo.
  echo BACKUP FALLAT - revisa el missatge d'error a sobre
  pause
  exit /b 1
)

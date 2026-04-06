@echo off
echo.
echo ══════════════════════════════════════════
echo   GESEM Planner - Instal·lació
echo ══════════════════════════════════════════
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo ERROR: Node.js no trobat.
  echo Descarrega'l a: https://nodejs.org
  pause
  exit /b 1
)

echo Node.js detectat. Instal·lant dependències...
cd /d "%~dp0"
npm install

echo.
echo ══════════════════════════════════════════
echo   Instal·lació completada!
echo   Ara executa "arrancar.bat" per iniciar.
echo ══════════════════════════════════════════
echo.
pause

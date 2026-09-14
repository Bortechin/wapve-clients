@echo off
setlocal
rem Prefer an optional local Node installation, otherwise use Node from PATH.
if exist "%~dp0.tools\node-v24.19.0-win-x64\node.exe" set "PATH=%~dp0.tools\node-v24.19.0-win-x64;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js from .node-version and pnpm 10.34.5 first.
  exit /b 1
)
node -e "const [a,b,c]=process.versions.node.split('.').map(Number);if(a!==24 || b<19 || (b===19 && c<0))process.exit(1)"
if errorlevel 1 (
  echo Wapve requires Node.js ^>=24.19.0 ^<25. See .node-version.
  exit /b 1
)
call pnpm %*

@echo off
setlocal

cd /d "%~dp0"
echo Iniciando servidor de desenvolvimento (Next.js)...
echo.

npm.cmd run dev

if errorlevel 1 (
  echo.
  echo Falha ao iniciar o servidor. Verifique as mensagens acima.
  pause
)

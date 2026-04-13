@echo off
setlocal

set PORT=3000
if not "%1"=="" set PORT=%1

echo Procurando processo na porta %PORT%...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    echo Encerrando PID %%a na porta %PORT%...
    taskkill /PID %%a /F
    echo Pronto!
    goto :fim
)

echo Nenhum processo encontrado na porta %PORT%.

:fim
pause

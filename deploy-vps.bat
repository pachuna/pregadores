@echo off
setlocal

:: ============================================================
:: Configuracao - preencha uma vez e nao mexa mais
:: ============================================================
set VPS_USER=root
set VPS_HOST=SEU_IP_AQUI
:: ============================================================

echo.
echo  [Pregadores] Iniciando deploy na VPS...
echo  Servidor: %VPS_USER%@%VPS_HOST%
echo.

ssh %VPS_USER%@%VPS_HOST% "cd /var/www/pregadores && bash atualizar-vps.sh"

if %errorlevel% neq 0 (
  echo.
  echo  [ERRO] Falha no deploy. Verifique as mensagens acima.
  pause
  exit /b 1
)

echo.
echo  [OK] Deploy concluido com sucesso!
pause

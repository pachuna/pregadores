#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/pregadores}"
BRANCH="${BRANCH:-main}"
PM2_APP="${PM2_APP:-pregadores-web}"
RUN_MIGRATE="${RUN_MIGRATE:-1}"

log() {
  echo "[deploy] $1"
}

fail() {
  echo "[deploy][erro] $1" >&2
  exit 1
}

command -v git >/dev/null 2>&1 || fail "git nao encontrado"
command -v npm >/dev/null 2>&1 || fail "npm nao encontrado"
command -v pm2 >/dev/null 2>&1 || fail "pm2 nao encontrado"

[ -d "$APP_DIR" ] || fail "diretorio da app nao existe: $APP_DIR"
cd "$APP_DIR"

log "Atualizando codigo ($BRANCH)..."
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

log "Instalando dependencias..."
npm ci

if [ "$RUN_MIGRATE" = "1" ]; then
  log "Aplicando migrations..."
  npm run db:migrate:deploy
else
  log "RUN_MIGRATE=0, pulando migrations"
fi

log "Gerando build de producao..."
rm -rf .next
npm run build

if [ ! -f ".next/prerender-manifest.json" ]; then
  fail "build incompleta: .next/prerender-manifest.json nao encontrado"
fi

log "Reiniciando servico no PM2..."
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP" --update-env
else
  pm2 start ecosystem.config.cjs --only "$PM2_APP" --env production --update-env
  pm2 save
fi

log "Status final"
pm2 status "$PM2_APP"

log "Teste HTTP local"
if command -v curl >/dev/null 2>&1; then
  curl -sS -I http://127.0.0.1:3000 | head -n 1
else
  log "curl nao encontrado, pulando teste HTTP"
fi

log "Deploy concluido com sucesso"

#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/pregadores}"
BRANCH="${BRANCH:-main}"
PM2_APP="${PM2_APP:-pregadores-web}"

log() {
  echo "[deploy-producao] $1"
}

fail() {
  echo "[deploy-producao][erro] $1" >&2
  exit 1
}

command -v git >/dev/null 2>&1 || fail "git nao encontrado"
command -v npm >/dev/null 2>&1 || fail "npm nao encontrado"
command -v pm2 >/dev/null 2>&1 || fail "pm2 nao encontrado"
command -v grep >/dev/null 2>&1 || fail "grep nao encontrado"

[ -d "$APP_DIR" ] || fail "diretorio da aplicacao nao existe: $APP_DIR"
cd "$APP_DIR"

log "Atualizando codigo em $BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

[ -f ".env.production" ] || fail ".env.production nao encontrado"

DB_LINE="$(grep '^DATABASE_URL=' .env.production || true)"
[ -n "$DB_LINE" ] || fail "DATABASE_URL nao encontrada em .env.production"

if [[ "$DB_LINE" != DATABASE_URL=postgresql://* && "$DB_LINE" != DATABASE_URL=postgres://* ]]; then
  fail "DATABASE_URL invalida para producao. Deve iniciar com postgresql:// ou postgres://"
fi

log "Instalando dependencias"
npm ci

log "Aplicando migrations"
npm run db:migrate:deploy

log "Gerando build de producao"
npm run build

log "Reiniciando aplicacao no PM2"
pm2 restart "$PM2_APP" --update-env

log "Status PM2"
pm2 status "$PM2_APP"

log "Deploy concluido com sucesso"

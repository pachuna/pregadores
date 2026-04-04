#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/pregadores}"
BRANCH="${BRANCH:-main}"
PM2_APP="${PM2_APP:-pregadores-web}"
RUN_MIGRATE="${RUN_MIGRATE:-1}"

DEPLOY_START=$(date '+%Y-%m-%d %H:%M:%S')

log() {
  echo "[deploy $(date '+%H:%M:%S')] $1"
}

fail() {
  echo "[deploy][ERRO] $1" >&2
  exit 1
}

echo ""
echo "================================================"
echo "  Pregadores — Deploy de Producao"
echo "  Inicio: $DEPLOY_START"
echo "================================================"
echo ""

command -v git >/dev/null 2>&1 || fail "git nao encontrado"
command -v npm >/dev/null 2>&1 || fail "npm nao encontrado"
command -v pm2 >/dev/null 2>&1 || fail "pm2 nao encontrado"

[ -d "$APP_DIR" ] || fail "diretorio da app nao existe: $APP_DIR"
cd "$APP_DIR"

# Validar variaveis obrigatorias
if [ -f ".env.production" ]; then
  log "Validando variaveis em .env.production..."
  for key in DATABASE_URL JWT_SECRET JWT_REFRESH_SECRET; do
    if ! grep -q "^${key}=" .env.production; then
      fail "variavel ${key} ausente em .env.production"
    fi
  done
  log "Variaveis OK"
else
  fail ".env.production nao encontrado em $APP_DIR"
fi

# Atualizar codigo
log "Atualizando codigo (branch: $BRANCH)..."
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
log "Codigo atualizado. Commit atual: $(git rev-parse --short HEAD)"

# Instalar dependencias
log "Instalando dependencias (npm ci)..."
npm ci --silent

# Gerar Prisma Client
log "Gerando Prisma Client..."
npx prisma generate

# Migrations
if [ "$RUN_MIGRATE" = "1" ]; then
  log "Aplicando migrations no banco..."
  npm run db:migrate:deploy
  log "Migrations OK"
else
  log "RUN_MIGRATE=0, migrations ignoradas"
fi

# Build
log "Gerando build de producao..."
rm -rf .next
npm run build

# Validar build (Next.js 15 gera .next/BUILD_ID)
if [ ! -f ".next/BUILD_ID" ]; then
  fail "build incompleta: .next/BUILD_ID nao encontrado"
fi
log "Build OK (BUILD_ID: $(cat .next/BUILD_ID))"

# Reiniciar PM2
log "Reiniciando servico no PM2..."
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP" --update-env
else
  log "App nao encontrada no PM2, iniciando pela primeira vez..."
  pm2 start ecosystem.config.cjs --only "$PM2_APP" --env production --update-env
  pm2 save
fi

# Status
log "Status PM2:"
pm2 status "$PM2_APP"

# Teste HTTP
log "Testando resposta HTTP..."
if command -v curl >/dev/null 2>&1; then
  HTTP_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/auth/login -X POST -H "Content-Type: application/json" -d '{}' || echo "000")
  if [ "$HTTP_STATUS" = "400" ] || [ "$HTTP_STATUS" = "401" ] || [ "$HTTP_STATUS" = "200" ]; then
    log "API respondendo corretamente (HTTP $HTTP_STATUS)"
  else
    log "Aviso: API retornou HTTP $HTTP_STATUS — verifique os logs do PM2"
  fi
else
  log "curl nao encontrado, pulando teste HTTP"
fi

echo ""
echo "================================================"
echo "  Deploy concluido com sucesso!"
echo "  Fim: $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================"
echo ""

#!/usr/bin/env bash
set -euo pipefail

cd /var/www/pregadores

echo ">>> Atualizando codigo..."
git pull origin main

echo ">>> Instalando dependencias..."
npm ci --silent

echo ">>> Gerando Prisma Client..."
npx prisma generate

echo ">>> Build de producao..."
npm run build

echo ">>> Reiniciando servidor..."
pm2 restart pregadores-web --update-env

echo ""
echo "=== Pronto! ==="

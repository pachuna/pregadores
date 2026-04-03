#!/bin/bash
# Backup diário do PostgreSQL — Pregadores
# Mantém os últimos 7 dias. Agendar via cron: 0 3 * * * /var/www/pregadores/backup-db.sh

set -euo pipefail

BACKUP_DIR="/var/backups/pregadores"
DB_NAME="pregadores_db"
DB_USER="pregadores_user"
DB_HOST="127.0.0.1"
DB_PORT="5432"
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"

FILENAME="$BACKUP_DIR/${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql.gz"

PGPASSFILE="$HOME/.pgpass"
if [ ! -f "$PGPASSFILE" ]; then
  echo "Erro: $PGPASSFILE não encontrado. Crie com: echo '$DB_HOST:$DB_PORT:$DB_NAME:$DB_USER:SUA_SENHA' > ~/.pgpass && chmod 600 ~/.pgpass"
  exit 1
fi

pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --no-password | gzip > "$FILENAME"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup criado: $FILENAME ($(du -sh "$FILENAME" | cut -f1))"

# Remove backups mais antigos que KEEP_DAYS dias
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +$KEEP_DAYS -delete
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backups com mais de $KEEP_DAYS dias removidos."

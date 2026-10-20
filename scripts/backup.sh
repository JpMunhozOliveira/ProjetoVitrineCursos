#!/bin/sh
# Backup do banco (pg_dump) e das imagens enviadas (volume de uploads). Rodar no servidor,
# de qualquer pasta. Agendado pelo cron (ver docs/DEPLOY.md):
#   0 3 * * * sh /srv/vitrine/scripts/backup.sh >> /srv/vitrine/backups/backup.log 2>&1
# Variáveis opcionais: BACKUP_DIR (padrão: backups/ na raiz do projeto), BACKUP_KEEP_DAYS (padrão: 14).
set -eu

cd "$(dirname "$0")/.."
DIR="${BACKUP_DIR:-backups}"
KEEP="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M)"

mkdir -p "$DIR"
chmod 700 "$DIR" # os arquivos têm todos os dados do site: só o dono lê
umask 077

# Banco: formato "custom" (-Fc), comprimido e restaurável com pg_restore (scripts/restore.sh).
# Grava em .tmp e só renomeia no fim: um backup interrompido nunca parece completo.
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$DIR/db-$STAMP.dump.tmp"
mv "$DIR/db-$STAMP.dump.tmp" "$DIR/db-$STAMP.dump"

# Imagens: lidas do volume montado no container do app (só leitura), por um container temporário.
docker run --rm --volumes-from vitrine-cursos-app:ro alpine:3.22 tar czf - -C /data uploads > "$DIR/uploads-$STAMP.tar.gz.tmp"
mv "$DIR/uploads-$STAMP.tar.gz.tmp" "$DIR/uploads-$STAMP.tar.gz"

# Apaga backups com mais de KEEP dias (e restos .tmp de execuções interrompidas).
find "$DIR" -maxdepth 1 \( -name 'db-*.dump' -o -name 'uploads-*.tar.gz' -o -name '*.tmp' \) -mtime +"$KEEP" -delete

echo "$(date '+%F %T') backup ok: $DIR/db-$STAMP.dump, $DIR/uploads-$STAMP.tar.gz"

#!/bin/sh
# Restaura um backup feito por scripts/backup.sh. SUBSTITUI os dados atuais do site.
#   sh scripts/restore.sh backups/db-AAAA-MM-DD_HHMM.dump [backups/uploads-AAAA-MM-DD_HHMM.tar.gz]
# O banco (serviço db) precisa estar rodando. O app fica parado durante a restauração.
set -eu

[ $# -ge 1 ] || { echo "Uso: sh scripts/restore.sh <db-....dump> [uploads-....tar.gz]"; exit 1; }
abs() { echo "$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"; }
DB_FILE="$(abs "$1")"
UP_FILE="${2:+$(abs "$2")}"
[ -f "$DB_FILE" ] || { echo "Arquivo não encontrado: $1"; exit 1; }
[ -z "$UP_FILE" ] || [ -f "$UP_FILE" ] || { echo "Arquivo não encontrado: $2"; exit 1; }

cd "$(dirname "$0")/.."
printf "Isto SUBSTITUI o banco%s pelo backup. Digite RESTAURAR para continuar: " "${UP_FILE:+ e as imagens}"
read -r answer
[ "$answer" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }

docker compose stop app
# --clean --if-exists: apaga cada tabela antes de recriá-la a partir do backup.
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < "$DB_FILE"
if [ -n "$UP_FILE" ]; then
  # tar guarda o dono dos arquivos (usuário node): o app continua podendo gravar e apagar imagens.
  docker run --rm -i --volumes-from vitrine-cursos-app alpine:3.22 sh -c 'rm -rf /data/uploads/* && tar xzf - -C /data' < "$UP_FILE"
fi
docker compose start app
echo "Restauração concluída."

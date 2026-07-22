#!/bin/sh
# ---------------------------------------------------------------------------
# Backup de Postgres de Modryva — Fase 1.2 de docs/PLAN-ENDURECIMIENTO-2026-07-20.md
#
# Se ejecuta EN EL NAS. Diseñado para BusyBox, no para GNU coreutils:
# muchos NAS y entornos minimalistas corren BusyBox, donde `sort -h`, `find -delete`, `du --max-depth`
# y `date -d <string>` NO EXISTEN. Verificado empíricamente el 2026-07-20.
#
#   Uso:   sh scripts/backup-postgres.sh
#          sh scripts/backup-postgres.sh --dry-run
#
#   Cron (diario 04:15):
#     15 4 * * * /bin/sh /opt/modryva/scripts/backup-postgres.sh >> /var/backups/modryva/backup.log 2>&1
#
# NUNCA imprime contraseñas: pg_dump se ejecuta DENTRO del contenedor, que ya
# tiene sus credenciales en el entorno. Aquí no viaja ningún secreto.
#
# ⚠️  Un backup que vive en el mismo aparato que la base de datos NO es un backup,
#     es una copia. Configura BACKUP_OFFSITE_CMD (abajo) para sacarlo del NAS.
#     Mientras eso no esté puesto, el script AVISA en cada ejecución. Es deliberado.
# ---------------------------------------------------------------------------

set -u

DOCKER="${DOCKER:-docker}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/modryva}"
KEEP_DAILY_DAYS="${KEEP_DAILY_DAYS:-7}"
KEEP_WEEKLY_DAYS="${KEEP_WEEKLY_DAYS:-28}"

# Comando para copiar el dump FUERA del NAS. Recibe la ruta del fichero como $1.
# Ejemplos:
#   BACKUP_OFFSITE_CMD='rclone copy "$1" r2:modryva-backups/'
#   BACKUP_OFFSITE_CMD='scp "$1" usuario@otro-equipo:/backups/'
BACKUP_OFFSITE_CMD="${BACKUP_OFFSITE_CMD:-}"

# Opcional pero MUY recomendado: cifra el dump ANTES de sacarlo del NAS. El dump
# lleva PII (ids/usuarios de Telegram, edades autodeclaradas, motivos de baneo),
# y la copia offsite lo manda a un tercero (R2/otro equipo). Recibe la ruta del
# dump como $1 y DEBE imprimir la ruta del fichero cifrado que produjo.
#   BACKUP_ENCRYPT_CMD='age -r age1... -o "$1.age" "$1" && echo "$1.age"'
#   BACKUP_ENCRYPT_CMD='gpg --yes -e -r tu@correo -o "$1.gpg" "$1" && echo "$1.gpg"'
BACKUP_ENCRYPT_CMD="${BACKUP_ENCRYPT_CMD:-}"

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

STAMP="$(date -u +%Y%m%d_%H%M%S)"
DAY_OF_WEEK="$(date -u +%u)"   # 1=lunes .. 7=domingo
DAILY_DIR="$BACKUP_ROOT/daily"
WEEKLY_DIR="$BACKUP_ROOT/weekly"
DUMP="$DAILY_DIR/modryva_${STAMP}.dump"

log()  { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }
die()  { log "ERROR: $*"; exit 1; }

log "=== backup-postgres: inicio ==="

# --- 1. Localizar el contenedor -------------------------------------------
[ -x "$DOCKER" ] || die "docker no encontrado en $DOCKER"
PG="$("$DOCKER" ps --format '{{.Names}}' 2>/dev/null | grep -i postgres | head -1)"
[ -n "$PG" ] || die "no hay ningun contenedor de postgres corriendo"
log "contenedor: $PG"

# --- 2. Comprobar que la BD responde --------------------------------------
"$DOCKER" exec "$PG" sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q' </dev/null \
  || die "pg_isready fallo: la base de datos no acepta conexiones"

if [ "$DRY_RUN" = "1" ]; then
  log "--dry-run: hasta aqui llega la comprobacion. No se escribe nada."
  exit 0
fi

mkdir -p "$DAILY_DIR" "$WEEKLY_DIR" || die "no se pudo crear $BACKUP_ROOT"

# --- 3. Volcado (dentro del contenedor) -----------------------------------
# -Fc = formato custom: comprimido y restaurable selectivamente con pg_restore.
#
# Se vuelca a un fichero DENTRO del contenedor, no a un pipe hacia el host. Dos
# razones, y las dos importan:
#   1. El formato custom exige poder hacer seek. `pg_restore --list /dev/stdin`
#      falla sobre un pipe, asi que verificar el stream saliente es imposible.
#   2. Con un pipe, el codigo de salida que sobrevive es el del ultimo comando,
#      no el de pg_dump: un volcado a medias pareceria exitoso.
REMOTE_DUMP="/tmp/modryva_backup_$$.dump"
log "volcando dentro del contenedor ..."
"$DOCKER" exec "$PG" sh -c "pg_dump -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Fc -f $REMOTE_DUMP" </dev/null
DUMP_RC=$?
cleanup_remote() { "$DOCKER" exec "$PG" rm -f "$REMOTE_DUMP" </dev/null >/dev/null 2>&1; }
[ "$DUMP_RC" -eq 0 ] || { cleanup_remote; die "pg_dump salio con codigo $DUMP_RC"; }

# --- 4. Verificacion: que sea REALMENTE restaurable ------------------------
# pg_restore --list falla si el archivo esta truncado o corrupto. Se verifica
# ANTES de sacarlo, para no llenar el disco de dumps invalidos. Un backup que
# no se verifica no es un backup.
OBJECTS="$("$DOCKER" exec "$PG" pg_restore --list "$REMOTE_DUMP" </dev/null 2>/dev/null | grep -c ';')"
if [ "${OBJECTS:-0}" -lt 50 ]; then
  cleanup_remote
  die "verificacion FALLIDA: pg_restore --list devolvio ${OBJECTS:-0} entradas (esperadas >50). El dump no sirve."
fi
log "verificacion OK: $OBJECTS objetos en el archivo"

# --- 4b. Sacarlo del contenedor -------------------------------------------
"$DOCKER" cp "$PG:$REMOTE_DUMP" "$DUMP" || { cleanup_remote; die "docker cp fallo"; }
cleanup_remote
[ -s "$DUMP" ] || die "el dump copiado salio VACIO"
SIZE="$(du -k "$DUMP" | cut -f1)"
log "dump escrito: $DUMP (${SIZE} KB)"

# --- 5. Copia semanal (domingos) ------------------------------------------
if [ "$DAY_OF_WEEK" = "7" ]; then
  cp "$DUMP" "$WEEKLY_DIR/" && log "copia semanal guardada"
fi

# --- 6. Retencion ---------------------------------------------------------
# BusyBox find no tiene -delete: se usa -exec rm. Y no hay `date -d`, asi que
# la antiguedad se calcula con -mtime, que si es POSIX.
PRUNED_D="$(find "$DAILY_DIR"  -name '*.dump' -mtime "+$KEEP_DAILY_DAYS"  -exec rm -f {} \; -print 2>/dev/null | wc -l)"
PRUNED_W="$(find "$WEEKLY_DIR" -name '*.dump' -mtime "+$KEEP_WEEKLY_DAYS" -exec rm -f {} \; -print 2>/dev/null | wc -l)"
log "retencion: $PRUNED_D diarios y $PRUNED_W semanales eliminados"

# --- 7. Fuera del NAS -----------------------------------------------------
if [ -n "$BACKUP_OFFSITE_CMD" ]; then
  SHIP="$DUMP"
  if [ -n "$BACKUP_ENCRYPT_CMD" ]; then
    log "cifrando el dump antes de sacarlo del NAS ..."
    SHIP="$(sh -c "$BACKUP_ENCRYPT_CMD" _ "$DUMP")"
    { [ -n "$SHIP" ] && [ -s "$SHIP" ]; } \
      || die "el cifrado del backup fallo — NO se saca el dump en claro"
    log "cifrado OK: $SHIP"
  else
    log "AVISO: BACKUP_ENCRYPT_CMD no configurado — el dump sale del NAS SIN CIFRAR."
    log "AVISO: contiene PII (ids/usuarios de Telegram, edades, motivos de baneo)."
    log "AVISO: define BACKUP_ENCRYPT_CMD (age/gpg) para cifrarlo antes de la copia."
  fi
  log "copiando fuera del NAS ..."
  sh -c "$BACKUP_OFFSITE_CMD" _ "$SHIP"
  OFFSITE_RC=$?
  [ "$SHIP" != "$DUMP" ] && rm -f "$SHIP"
  [ "$OFFSITE_RC" -eq 0 ] \
    || die "la copia offsite fallo con codigo $OFFSITE_RC — el dump LOCAL existe, pero sigues sin copia fuera del NAS"
  log "copia offsite OK"
else
  log "AVISO: BACKUP_OFFSITE_CMD no esta configurado."
  log "AVISO: este dump vive en el MISMO disco que la base de datos."
  log "AVISO: un fallo del volumen se lleva la BD y el backup a la vez. Esto NO es un backup."
fi

TOTAL="$(find "$DAILY_DIR" "$WEEKLY_DIR" -name '*.dump' 2>/dev/null | wc -l)"
log "=== backup-postgres: OK — $TOTAL dumps conservados ==="

#!/bin/sh
# ---------------------------------------------------------------------------
# Prueba de restauracion REAL — Fase 1.2 de docs/PLAN-ENDURECIMIENTO-2026-07-20.md
#
# `pg_restore --list` solo prueba que el indice del archivo se puede leer.
# Esto prueba lo unico que importa: que el dump se RESTAURA y que los datos
# restaurados coinciden con produccion.
#
# Levanta un Postgres desechable (sin puertos publicados, autenticacion trust,
# datos en tmpfs), restaura el ultimo dump, compara conteos contra produccion
# y se destruye. No toca la base de datos real en ningun momento: solo lee.
#
#   Uso:  sh scripts/verify-restore.sh [ruta-al-dump]
#         (sin argumento usa el dump mas reciente de daily/)
# ---------------------------------------------------------------------------

set -u

DOCKER="${DOCKER:-docker}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/modryva}"
SCRATCH="modryva-restore-test"

# Tablas cuyo conteo se compara contra produccion. Elegidas por cubrir dominios
# distintos: auditoria, cola de updates, verificacion, plataforma y memoria IA.
TABLES="audit_logs update_inbox verification_sessions managed_bots ai_memories chat_settings"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }
die() { log "ERROR: $*"; "$DOCKER" rm -f "$SCRATCH" >/dev/null 2>&1; exit 1; }

DUMP="${1:-$(ls -t "$BACKUP_ROOT"/daily/*.dump 2>/dev/null | head -1)}"
[ -n "$DUMP" ] && [ -f "$DUMP" ] || die "no se encontro ningun dump (¿has corrido backup-postgres.sh?)"
log "=== verify-restore: $DUMP ==="

PG="$("$DOCKER" ps --format '{{.Names}}' 2>/dev/null | grep -i postgres | head -1)"
[ -n "$PG" ] || die "no hay contenedor de postgres corriendo"

# Misma imagen que produccion: restaurar en una version distinta de Postgres
# puede fallar o cambiar comportamiento, y entonces la prueba no probaria nada.
IMAGE="$("$DOCKER" inspect -f '{{.Config.Image}}' "$PG")"
log "imagen: $IMAGE"

# --- 1. Postgres desechable -----------------------------------------------
# Sin -p: no se publica ningun puerto, no es accesible desde la LAN.
# trust: no hace falta manejar ninguna contrasena en este script.
"$DOCKER" rm -f "$SCRATCH" >/dev/null 2>&1
"$DOCKER" run -d --name "$SCRATCH" \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=restoretest \
  "$IMAGE" >/dev/null || die "no se pudo arrancar el contenedor de pruebas"

log "esperando a que el postgres de pruebas acepte conexiones ..."
i=0
while [ "$i" -lt 60 ]; do
  "$DOCKER" exec "$SCRATCH" pg_isready -U postgres -d restoretest -q </dev/null 2>/dev/null && break
  i=$((i + 1))
  sleep 1
done
[ "$i" -lt 60 ] || die "el postgres de pruebas no arranco en 60s"

# --- 2. Restaurar ---------------------------------------------------------
"$DOCKER" cp "$DUMP" "$SCRATCH:/tmp/restore.dump" || die "docker cp fallo"
log "restaurando ..."
# --no-owner/--no-privileges: el rol de produccion no existe aqui y no queremos
# que eso invalide la prueba. Los errores REALES si se capturan mas abajo.
OUT="$("$DOCKER" exec "$SCRATCH" pg_restore -U postgres -d restoretest \
        --no-owner --no-privileges /tmp/restore.dump </dev/null 2>&1)"
RC=$?
ERRS="$(echo "$OUT" | grep -c 'error' 2>/dev/null || true)"
log "pg_restore rc=$RC, lineas con 'error': ${ERRS:-0}"
[ "${ERRS:-0}" -eq 0 ] || { echo "$OUT" | grep 'error' | head -10; die "la restauracion produjo errores"; }

# --- 3. Comparar contra produccion ----------------------------------------
Q_PROD()    { "$DOCKER" exec "$PG"      sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tAc \"$1\"" </dev/null 2>/dev/null; }
Q_SCRATCH() { "$DOCKER" exec "$SCRATCH" psql -U postgres -d restoretest -tAc "$1" </dev/null 2>/dev/null; }

P_TABLES="$(Q_PROD    "SELECT count(*) FROM pg_tables WHERE schemaname='public';")"
R_TABLES="$(Q_SCRATCH "SELECT count(*) FROM pg_tables WHERE schemaname='public';")"

echo ""
echo "  TABLA                     PRODUCCION   RESTAURADO   "
echo "  ------------------------- ------------ ------------ ------"
printf "  %-25s %12s %12s  %s\n" "(numero de tablas)" "$P_TABLES" "$R_TABLES" \
  "$([ "$P_TABLES" = "$R_TABLES" ] && echo OK || echo DIFIERE)"

FAIL=0
[ "$P_TABLES" = "$R_TABLES" ] || FAIL=1
for t in $TABLES; do
  p="$(Q_PROD    "SELECT count(*) FROM $t;")"
  r="$(Q_SCRATCH "SELECT count(*) FROM $t;")"
  p="${p:-n/a}"; r="${r:-n/a}"
  if [ "$p" = "$r" ]; then st="OK"; else st="DIFIERE"; FAIL=1; fi
  printf "  %-25s %12s %12s  %s\n" "$t" "$p" "$r" "$st"
done
echo ""

# --- 4. Limpieza ----------------------------------------------------------
"$DOCKER" rm -f "$SCRATCH" >/dev/null 2>&1

if [ "$FAIL" -eq 0 ]; then
  log "=== VERIFICACION SUPERADA: el dump se restaura y los datos coinciden ==="
  exit 0
fi
log "=== VERIFICACION FALLIDA: hay diferencias entre produccion y el restaurado ==="
log "(una diferencia pequena en tablas muy activas puede ser escritura concurrente"
log " durante el dump; una diferencia grande o en tablas estables es un problema real)"
exit 1

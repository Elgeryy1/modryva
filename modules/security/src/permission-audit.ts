/**
 * Least-privilege audit for group administrators. Given a snapshot of each
 * admin's granted permissions and their last moderation action, this module
 * flags excess privileges: dangerous powers (ban/delete/promote) that have not
 * been used recently, and the ability to promote other admins granted to
 * someone who does not actually moderate. Pure and deterministic: callers pass
 * `nowMs` and the staleness window, so there is no clock or I/O here.
 */

/**
 * Snapshot of one administrator's granted powers. `lastActionMs` is the epoch
 * timestamp (ms) of their most recent moderation action; omit it entirely when
 * the admin has never acted (never assign undefined).
 */
export interface AdminPerms {
  readonly userId: string;
  readonly canBan: boolean;
  readonly canDelete: boolean;
  readonly canPin: boolean;
  readonly canPromote: boolean;
  readonly lastActionMs?: number;
}

/** A single excess-privilege finding tied to one administrator. */
export interface ExcessPermissionFinding {
  readonly userId: string;
  readonly reason: string;
}

/**
 * Stable, user-facing reasons for each excess-privilege category. Accented on
 * purpose: these strings surface in the audit report an admin reads.
 */
export const PERM_AUDIT_REASONS = {
  promoteWithoutModeration: "Puede promover administradores pero no modera",
  staleDangerous: "Permisos peligrosos sin actividad reciente",
} as const;

/**
 * Qué cuenta como "haber moderado", para la pregunta que decide el informe:
 * ¿este admin usa los poderes peligrosos que tiene?
 *
 * La lista está aquí, visible y probada, en vez de dentro de un `WHERE` de SQL
 * a propósito. La trampa es que `audit_logs` guarda muchísimas más cosas que
 * moderación —la acción más frecuente con diferencia es
 * `telegram.update.received`, que es simplemente HABLAR— y tomar "última fila
 * de auditoría" como "última acción de moderación" haría que el informe diera
 * por activo a un admin que lleva meses sin moderar pero escribe a diario. Un
 * informe de privilegios que absuelve por charlar no vale nada.
 *
 * Pura y determinista.
 */
export const isModerationAction = (action: string): boolean =>
  action.startsWith("moderation.") ||
  action.startsWith("appointed_admin.") ||
  action.startsWith("introduction.staff_") ||
  action === "introduction.forgiven" ||
  action === "admin.del";

/** True when the admin holds a moderation power (ban or delete). */
export const adminModerates = (admin: AdminPerms): boolean =>
  admin.canBan || admin.canDelete;

/**
 * True when the admin holds any dangerous power: banning, deleting or
 * promoting other admins. Pinning is not dangerous.
 */
export const adminHasDangerousPermission = (admin: AdminPerms): boolean =>
  admin.canBan || admin.canDelete || admin.canPromote;

/**
 * True when the admin acted within the staleness window, i.e. `lastActionMs`
 * is known and `nowMs - lastActionMs <= staleMs`. An admin who never acted
 * (no `lastActionMs`) is never considered recent. Deterministic.
 */
export const adminActedRecently = (
  admin: AdminPerms,
  nowMs: number,
  staleMs: number,
): boolean => {
  if (admin.lastActionMs === undefined) {
    return false;
  }
  return nowMs - admin.lastActionMs <= staleMs;
};

/**
 * El informe que lee un admin.
 *
 * Dice cuántos admins se han mirado, no solo los señalados: "0 hallazgos" sin
 * denominador es indistinguible de "no se ha mirado nada", y esa ambigüedad es
 * la que convierte un informe de seguridad en un adorno.
 *
 * `nombres` traduce el id a algo legible; quien falte sale con su id, nunca
 * inventado. Pura y determinista.
 */
export const buildPermissionAuditReport = (
  findings: readonly ExcessPermissionFinding[],
  revisados: number,
  nombres: ReadonlyMap<string, string>,
  diasSinUsar: number,
): string => {
  if (revisados === 0) {
    return "No he podido leer la lista de administradores, así que no te puedo decir nada. Vuelve a intentarlo.";
  }
  if (findings.length === 0) {
    return `✅ Revisados ${revisados} administradores: ninguno tiene poderes peligrosos sin usar en los últimos ${diasSinUsar} días.`;
  }
  const lineas = findings.map(
    (finding) =>
      `• ${nombres.get(finding.userId) ?? finding.userId} — ${finding.reason}`,
  );
  return [
    `🔎 Auditoría de permisos (${revisados} administradores revisados)`,
    "",
    ...lineas,
    "",
    `Criterio: "sin actividad reciente" son ${diasSinUsar} días sin banear, silenciar, avisar, borrar ni nombrar admins. Hablar no cuenta.`,
    "",
    "No se ha tocado ningún permiso: esto es solo una lista para que la mires.",
  ].join("\n");
};

/**
 * El informe completo de vigilancia de administradores: poderes sin usar, gente
 * con galones que no puso Modryva, y nombramientos antiquísimos.
 *
 * Las tres preguntas van juntas porque las tres se responden mirando la misma
 * lista y separarlas en tres comandos garantiza que solo se use el primero.
 *
 * Cada bloque se omite si no tiene nada que decir, pero la cabecera SIEMPRE
 * dice cuántos se han revisado: un informe de seguridad que sale vacío tiene
 * que distinguirse de uno que no ha mirado.
 */
export const buildAdminOversightReport = (input: {
  readonly revisados: number;
  readonly excess: readonly ExcessPermissionFinding[];
  readonly externos: readonly string[];
  readonly antiguos: readonly {
    readonly userId: string;
    readonly dias: number;
  }[];
  readonly nombres: ReadonlyMap<string, string>;
  readonly diasSinUsar: number;
}): string => {
  const { revisados, excess, externos, antiguos, nombres, diasSinUsar } = input;
  if (revisados === 0) {
    return "No he podido leer la lista de administradores, así que no te puedo decir nada. Vuelve a intentarlo.";
  }
  const nombre = (id: string): string => nombres.get(id) ?? id;
  const bloques: string[] = [];

  if (excess.length > 0) {
    bloques.push(
      [
        "⚠️ Poderes peligrosos sin usar",
        ...excess.map((f) => `• ${nombre(f.userId)} — ${f.reason}`),
      ].join("\n"),
    );
  }

  if (externos.length > 0) {
    bloques.push(
      [
        "🚩 Admins que no nombró Modryva",
        ...externos.map((id) => `• ${nombre(id)}`),
        "A éstos NO los puedo degradar yo: los ascendió otra persona o otro bot.",
      ].join("\n"),
    );
  }

  if (antiguos.length > 0) {
    bloques.push(
      [
        "🕰️ Nombramientos muy antiguos",
        ...antiguos.map((a) => `• ${nombre(a.userId)} — hace ${a.dias} días`),
      ].join("\n"),
    );
  }

  if (bloques.length === 0) {
    return `✅ Revisados ${revisados} administradores: nada que mirar. Ninguno tiene poderes peligrosos sin usar en ${diasSinUsar} días, todos los nombró Modryva y ninguno lleva demasiado tiempo.`;
  }

  return [
    `🔎 Auditoría de administradores (${revisados} revisados)`,
    "",
    ...bloques.flatMap((bloque) => [bloque, ""]),
    `Criterio: "sin usar" son ${diasSinUsar} días sin banear, silenciar, avisar, borrar ni nombrar admins. Hablar no cuenta.`,
    "",
    "No se ha tocado ningún permiso: esto es solo una lista para que la mires.",
  ].join("\n");
};

/**
 * Returns at most one finding per admin, preserving input order. An admin is
 * flagged when they can promote other admins but do not moderate (structural
 * over-grant, checked first), or when they hold dangerous powers they have not
 * exercised within `staleMs`. Admins with only harmless powers (e.g. pin) or
 * with recently-used dangerous powers produce no finding. Pure and
 * deterministic: identical inputs yield an identical array.
 */
export const findExcessPermissions = (
  admins: readonly AdminPerms[],
  nowMs: number,
  staleMs: number,
): readonly ExcessPermissionFinding[] => {
  const findings: ExcessPermissionFinding[] = [];

  for (const admin of admins) {
    if (admin.canPromote && !adminModerates(admin)) {
      findings.push({
        userId: admin.userId,
        reason: PERM_AUDIT_REASONS.promoteWithoutModeration,
      });
      continue;
    }

    if (
      adminHasDangerousPermission(admin) &&
      !adminActedRecently(admin, nowMs, staleMs)
    ) {
      findings.push({
        userId: admin.userId,
        reason: PERM_AUDIT_REASONS.staleDangerous,
      });
    }
  }

  return findings;
};

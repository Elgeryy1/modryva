import { enteroDelArgumento, siONo, tresEnteros } from "@superbot/shared";

import { buildOwnerChecklist } from "../../owner-checklist.js";
import { suggestOwnerMentorTips } from "../../owner-mentor.js";
import { buildOwnerSummary } from "../../owner-summary.js";

/**
 * Las calculadoras del owner de `/utility_plus`.
 *
 * Las tres pedian varios enteros seguidos, y las tres repetian el mismo
 * `args.map((v) => Number.parseInt(v, 10))` y luego comprobaban `undefined` y
 * `NaN` por separado — las dos cosas, porque `args.map` sobre una lista corta
 * deja huecos. Eso es ahora `enterosDelArgumento`.
 */

/** `/checklist_owner`: que le queda por hacer al owner. */
export const calculadoraDeChecklistDeOwner = (
  args: readonly string[],
): string => {
  const n = tresEnteros(args);
  if (n === null) {
    return "Uso: /checklist_owner <apelaciones_pendientes> <incidencias_abiertas> <dias_desde_revision>";
  }
  const [apelaciones, incidencias, diasDesdeRevision] = n;

  return buildOwnerChecklist({
    pendingAppeals: apelaciones,
    openIncidents: incidencias,
    rulesReviewedDaysAgo: diasDesdeRevision,
  })
    .map((t) => `${t.done ? "✅" : "❌"} ${t.task}`)
    .join("\n");
};

/** `/mentor_owner`: consejos segun el tamaño y lo que ya tiene montado. */
export const calculadoraDeMentorDeOwner = (args: readonly string[]): string => {
  const miembros = enteroDelArgumento(args[0]);
  const conReglas = siONo(args[1]);
  const conStaff = siONo(args[2]);
  if (miembros === null || conReglas === undefined || conStaff === undefined) {
    return "Uso: /mentor_owner <miembros> <reglas si|no> <staff si|no>";
  }

  return suggestOwnerMentorTips({
    members: miembros,
    hasRules: conReglas,
    hasStaff: conStaff,
  }).join("\n");
};

/** `/resumen_owner`: el grupo en tres numeros. */
export const calculadoraDeResumenDeOwner = (
  args: readonly string[],
): string => {
  const n = tresEnteros(args);
  if (n === null) {
    return "Uso: /resumen_owner <apelaciones_pendientes> <incidencias_abiertas> <miembros_nuevos>";
  }
  const [apelaciones, incidencias, nuevos] = n;

  return buildOwnerSummary({
    pendingAppeals: apelaciones,
    openIncidents: incidencias,
    newMembers: nuevos,
  });
};

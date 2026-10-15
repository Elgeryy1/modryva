import { summarizeAcceptedAppeals } from "../../accepted-appeals-report.js";
import { bucketAppealsByIncident } from "../../appeal-grouping.js";
import { summarizeAppealHistory } from "../../appeal-history.js";

/**
 * Los tres informes de apelaciones del staff.
 *
 * Los tres salen de la MISMA consulta —todas las apelaciones del chat— y solo
 * cambian en como la resumen. En el nucleo eran tres casos de un `switch` de
 * 25, cada uno repitiendo la busqueda y con su texto pegado dentro.
 *
 * Aqui reciben las filas ya buscadas y devuelven el texto. El nucleo se queda
 * con buscar una vez y elegir cual.
 *
 * **Lo que se lleva de verdad es el copy**, que es lo que hacia crecer el
 * nucleo: tres formatos con sus emojis, sus separadores y su caso vacio.
 */

/** Una apelacion, con lo poco que estos informes necesitan de ella. */
export interface ApelacionParaInforme {
  /** Si se acepto. */
  readonly aceptada: boolean;
  /** El caso al que pertenece. Hace de "regla" y de "incidente". */
  readonly caso: string;
  /** Quien apelo. */
  readonly deUsuario: number;
}

/** `/informe_apelaciones_aceptadas`: cuantas se aceptaron, y por que regla. */
export const informeDeApelacionesAceptadas = (
  apelaciones: readonly ApelacionParaInforme[],
): string => {
  const informe = summarizeAcceptedAppeals(
    apelaciones.map((a) => ({ accepted: a.aceptada, rule: a.caso })),
  );
  const lineas = informe.byRule.map((e) => `${e.rule}: ${e.count}`);
  return `📋 Apelaciones aceptadas: ${informe.acceptedTotal}\n${lineas.join("\n")}`;
};

/** `/historial_apelaciones`: el balance de aceptadas contra rechazadas. */
export const historialDeApelaciones = (
  apelaciones: readonly ApelacionParaInforme[],
): string => {
  const resumen = summarizeAppealHistory(
    apelaciones.map((a) => ({ accepted: a.aceptada })),
  );
  return `📜 Total: ${resumen.total} · Aceptadas: ${resumen.accepted} · Rechazadas: ${resumen.rejected} · Tasa: ${resumen.acceptRate}`;
};

/** `/apelaciones_por_incidente`: quien apelo cada caso. */
export const apelacionesPorIncidente = (
  apelaciones: readonly ApelacionParaInforme[],
): string => {
  const grupos = bucketAppealsByIncident(
    apelaciones.map((a) => ({ incidentId: a.caso, userId: a.deUsuario })),
  );
  const lineas = grupos.map(
    (g) => `${g.incidentId}: ${g.count} (${g.userIds.join(", ")})`,
  );
  // El caso vacio importa: sin el, el staff ve un mensaje en blanco y no sabe
  // si es que no hay apelaciones o si el informe se rompio.
  return lineas.length > 0 ? lineas.join("\n") : "Sin apelaciones registradas.";
};

/**
 * Control de edits: clasifica el riesgo de una edicion de mensaje. Un mensaje
 * que se edita para colar un enlace pasado un rato, o que cambia de forma
 * masiva tarde, es un patron tipico de spammers que evaden el filtro de
 * entrada. Aqui solo hay logica pura de clasificacion a partir de senales
 * planas ya extraidas por el caller (nada de red, Prisma ni relojes); la
 * accion (borrar, avisar, revisar) vive en el servicio.
 *
 * Ideas del banco: 92, 37, 38.
 */

/** Nivel de riesgo asignado a una edicion. */
export type EditRiskLevel = "bajo" | "medio" | "alto";

/**
 * Foto plana de una edicion: estado del enlace antes/despues, longitudes del
 * texto antes/despues y cuantos segundos pasaron desde que se publico el
 * mensaje original hasta la edicion. `secondsAfterPost` negativo se trata como
 * cero (edicion inmediata).
 */
export interface EditRiskInput {
  readonly oldHasUrl: boolean;
  readonly newHasUrl: boolean;
  readonly oldLen: number;
  readonly newLen: number;
  readonly secondsAfterPost: number;
}

/** Veredicto de la clasificacion: nivel + motivo legible para el moderador. */
export interface EditRiskResult {
  readonly risk: EditRiskLevel;
  readonly reason: string;
}

/**
 * Segundos a partir de los cuales una edicion se considera "tardia": editar
 * justo despues de publicar suele ser corregir una errata; editar mucho mas
 * tarde para meter un enlace o reescribir todo es sospechoso.
 */
export const EDIT_RISK_LATE_SECONDS = 300;

/** Delta minimo de caracteres para que un cambio cuente como "grande". */
export const EDIT_RISK_BIG_CHANGE_MIN_CHARS = 20;

/**
 * Fraccion de cambio (respecto a la longitud original) a partir de la cual el
 * cambio se considera "grande", combinada con EDIT_RISK_BIG_CHANGE_MIN_CHARS.
 */
export const EDIT_RISK_BIG_CHANGE_RATIO = 0.5;

/**
 * Clasifica el riesgo de una edicion de mensaje. Prioridad de mayor a menor:
 *
 *  - alto: se anadio un enlace que no estaba y la edicion es tardia.
 *  - alto: cambio grande de contenido y la edicion es tardia.
 *  - medio: se anadio un enlace pronto (edicion no tardia).
 *  - medio: cambio grande de contenido pronto (edicion no tardia).
 *  - bajo: resto (erratas, cambios menores, quitar un enlace, etc.).
 *
 * "Tardia" = secondsAfterPost >= EDIT_RISK_LATE_SECONDS. "Enlace nuevo" =
 * newHasUrl y no oldHasUrl (quitar un enlace nunca sube el riesgo). "Cambio
 * grande" = el delta absoluto de longitud alcanza EDIT_RISK_BIG_CHANGE_MIN_CHARS
 * y ademas es al menos EDIT_RISK_BIG_CHANGE_RATIO de la longitud original.
 * Pura y determinista: mismas entradas, misma salida.
 */
export const classifyEditRisk = (edit: EditRiskInput): EditRiskResult => {
  const addedUrl = edit.newHasUrl && !edit.oldHasUrl;

  const elapsed = edit.secondsAfterPost > 0 ? edit.secondsAfterPost : 0;
  const late = elapsed >= EDIT_RISK_LATE_SECONDS;

  const lengthDelta = Math.abs(edit.newLen - edit.oldLen);
  const base = Math.max(edit.oldLen, 1);
  const bigChange =
    lengthDelta >= EDIT_RISK_BIG_CHANGE_MIN_CHARS &&
    lengthDelta / base >= EDIT_RISK_BIG_CHANGE_RATIO;

  if (addedUrl && late) {
    return {
      risk: "alto",
      reason: "Enlace nuevo añadido mucho después de publicar",
    };
  }

  if (bigChange && late) {
    return {
      risk: "alto",
      reason: "Cambio grande de contenido mucho después de publicar",
    };
  }

  if (addedUrl) {
    return { risk: "medio", reason: "Enlace nuevo añadido al editar" };
  }

  if (bigChange) {
    return { risk: "medio", reason: "Cambio grande de contenido al editar" };
  }

  return { risk: "bajo", reason: "Edición menor sin señales de riesgo" };
};

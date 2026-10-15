import { enteroDelArgumento, siONo } from "@superbot/shared";

import { categorizeAppeal } from "../../appeal-classification.js";
import { estimateAppealEta } from "../../appeal-eta.js";
import { buildAppealLearning } from "../../appeal-learning.js";
import { summarizeAppealForStaff } from "../../appeal-summary.js";
import { markDelicateAppeal } from "../../delicate-appeal.js";

/**
 * Las cinco calculadoras de apelación de `/utility_plus`.
 *
 * Como las de sanción: parsear, rendirse con el uso si no encaja, calcular y
 * dar formato. Ninguna toca la base ni Telegram.
 *
 * Los parseadores vienen de `@superbot/shared` y no de otro módulo, porque un
 * módulo no puede importar a otro y estos los usan varios.
 */

/** `/clasificar_apelacion`: de que va una apelación. */
export const calculadoraDeCategoriaDeApelacion = (
  args: readonly string[],
): string => {
  const texto = args.join(" ").trim();
  if (!texto) {
    return "Uso: /clasificar_apelacion <texto>";
  }

  return `📂 Categoría: ${categorizeAppeal(texto).category}`;
};

/** `/eta_apelacion`: cuanto va a tardar en revisarse. */
export const calculadoraDeEtaDeApelacion = (
  args: readonly string[],
): string => {
  const enCola = enteroDelArgumento(args[0]);
  const msPorRevision = enteroDelArgumento(args[1]);
  if (enCola === null || msPorRevision === null) {
    return "Uso: /eta_apelacion <en_cola> <ms_promedio_revision>";
  }

  return `⏳ ${estimateAppealEta({ queueLength: enCola, avgReviewMs: msPorRevision }).label}`;
};

/** `/aprendizaje_apelacion`: que se aprende de como acabo. */
export const calculadoraDeAprendizajeDeApelacion = (
  args: readonly string[],
): string => {
  const aceptada = siONo(args[0]);
  const regla = args.slice(1).join(" ").trim();
  if (aceptada === undefined || !regla) {
    return "Uso: /aprendizaje_apelacion <si|no> <regla>";
  }

  return buildAppealLearning({ accepted: aceptada, rule: regla });
};

/** `/resumen_apelacion`: la apelación en corto, para quien la revisa. */
export const calculadoraDeResumenDeApelacion = (
  args: readonly string[],
): string => {
  const [categoria, longitudCruda, evidenciaCruda] = args;
  const longitud = enteroDelArgumento(longitudCruda);
  const conEvidencia = siONo(evidenciaCruda);
  if (!categoria || longitud === null || conEvidencia === undefined) {
    return "Uso: /resumen_apelacion <categoría> <longitud> <si|no evidencia>";
  }

  return summarizeAppealForStaff({
    category: categoria,
    length: longitud,
    hasEvidence: conEvidencia,
  });
};

/**
 * `/apelacion_delicada`: si la apelación toca algo que no se despacha solo.
 *
 * Los tres argumentos son obligatorios y `undefined` NO cuenta como "no": una
 * apelación que menciona a un menor y en la que alguien se dejo el argumento
 * sin poner no puede salir como "sin señales delicadas".
 */
export const calculadoraDeApelacionDelicada = (
  args: readonly string[],
): string => {
  const menciona = {
    menor: siONo(args[0]),
    legal: siONo(args[1]),
    autolesion: siONo(args[2]),
  };
  if (
    menciona.menor === undefined ||
    menciona.legal === undefined ||
    menciona.autolesion === undefined
  ) {
    return "Uso: /apelacion_delicada <menor si|no> <legal si|no> <autolesion si|no>";
  }

  const r = markDelicateAppeal({
    mentionsMinor: menciona.menor,
    mentionsLegal: menciona.legal,
    mentionsSelfHarm: menciona.autolesion,
  });

  return r.delicate
    ? `🚩 Delicada: ${r.reasons.join(", ")}`
    : "Sin señales delicadas.";
};

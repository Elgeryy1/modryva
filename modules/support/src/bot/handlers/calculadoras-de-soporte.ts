import {
  decimalDelArgumento,
  enteroDelArgumento,
  paresClaveValor,
  siONo,
  tresEnteros,
} from "@superbot/shared";

import { detectAngerLevel } from "../../angry-customer.js";
import { shouldUnpinAnnouncement } from "../../announcement-expiry.js";
import { buildAnnouncementPreviews } from "../../announcement-preview.js";
import { detectAnswerBegging } from "../../anti-copy.js";
import { nextMediationStep } from "../../async-mediation.js";
import { shouldEscalateBotError } from "../../bot-error-escalation.js";
import { assessDataQuality } from "../../data-quality.js";
import { decideHumanEscalation } from "../../human-escalation.js";
import { nextIncidentStatus } from "../../incident-status.js";
import { assessQuestionCompleteness } from "../../incomplete-question.js";
import { classifyKnowledgeLevel } from "../../knowledge-level.js";
import { buildKnownIssueNotice } from "../../known-issue.js";
import { buildMaintenanceNotice } from "../../maintenance-notice.js";
import { compareMonths } from "../../month-compare.js";
import { detectOffTopicStudy } from "../../off-topic-study.js";
import { buildPostLaunchReport } from "../../post-launch.js";
import { scoreDoubt } from "../../priority-doubts.js";
import { buildPublishSummary } from "../../publish-summary.js";
import { buildRoleAnnouncements } from "../../role-announcements.js";
import { decideSaveMode } from "../../save-mode.js";
import { detectSensitiveAnnouncement } from "../../sensitive-announcement.js";
import { supportHoursStatus } from "../../support-hours.js";
import { shouldSendTicketFollowup } from "../../ticket-followup.js";
import { applyVipTreatment } from "../../vip-client.js";
import {
  esEstadoDeIncidencia,
  esEstadoDeMediacion,
  esEventoDeIncidencia,
  esEventoDeMediacion,
  esPlanDeCliente,
  opcionesDeIncidencia,
  opcionesDeMediacion,
  opcionesDePlan,
} from "./estados.js";

/**
 * Las veinticuatro calculadoras de soporte de `/utility_plus`.
 *
 * Misma forma que las de juego: parsear, rendirse con el uso si no encaja,
 * calcular y dar formato. Ninguna toca la base ni Telegram.
 *
 * **Los relojes entran por parametro.** Cuatro de ellas llamaban a `Date.now()`
 * o a `new Date().getHours()` por dentro, y con eso no habia forma de probar
 * "el anuncio se fijo hace un rato" contra "lleva dos dias" sin tocar el reloj
 * del proceso.
 */

/** `/horario`: si estamos dentro del horario de atencion. */
export const calculadoraDeHorario = (horaDelDia: number): string =>
  supportHoursStatus(horaDelDia).message;

/** `/enfado`: cuanto enfado se lee en un texto. */
export const calculadoraDeEnfado = (args: readonly string[]): string => {
  const texto = args.join(" ").trim();
  if (!texto) {
    return "Uso: /enfado <texto>";
  }

  const v = detectAngerLevel(texto);

  return `😠 Nivel: ${v.level} (score ${v.score})`;
};

/** `/vista_anuncio`: como se vera un anuncio en el movil y en el escritorio. */
export const calculadoraDeVistaDeAnuncio = (
  args: readonly string[],
): string => {
  const texto = args.join(" ").trim();
  if (!texto) {
    return "Uso: /vista_anuncio <texto>";
  }

  const vistas = buildAnnouncementPreviews(texto);

  return `📱 Notificación: ${vistas.notification}\n\n💻 Completo:\n${vistas.desktop}`;
};

/** `/peticion_copia`: si un mensaje esta pidiendo la respuesta hecha. */
export const calculadoraDePeticionDeCopia = (
  args: readonly string[],
): string => {
  const texto = args.join(" ").trim();
  if (!texto) {
    return "Uso: /peticion_copia <texto>";
  }

  const v = detectAnswerBegging(texto);

  return v.matched
    ? `🚫 Coincide: ${v.phrases.join(", ")}`
    : "✅ No parece pedir respuestas sin esfuerzo.";
};

/** `/error_bot`: si un fallo del bot tiene que verlo una persona. */
export const calculadoraDeErrorDelBot = (args: readonly string[]): string => {
  const confianza = decimalDelArgumento(args[0]);
  const disputa = siONo(args[1]);
  const fueAutomatica = siONo(args[2]);
  if (
    confianza === null ||
    disputa === undefined ||
    fueAutomatica === undefined
  ) {
    return "Uso: /error_bot <confianza 0-1> <disputa si|no> <automática si|no>";
  }

  return shouldEscalateBotError({
    botConfidence: confianza,
    userDisputes: disputa,
    autoActioned: fueAutomatica,
  }).reason;
};

/** `/calidad_datos`: si hay bastante muestra para fiarse de una metrica. */
export const calculadoraDeCalidadDeDatos = (
  args: readonly string[],
): string => {
  const muestras = enteroDelArgumento(args[0]);
  const diasCubiertos = enteroDelArgumento(args[1]);
  if (muestras === null || diasCubiertos === null) {
    return "Uso: /calidad_datos <muestras> <dias_cubiertos>";
  }

  const v = assessDataQuality({
    sampleSize: muestras,
    daysCovered: diasCubiertos,
  });

  return v.reliable
    ? "✅ Datos suficientes para métricas fiables."
    : `⚠️ ${v.reasons.join(" ")}`;
};

/** `/caducidad_anuncio`: si un anuncio fijado ya deberia soltarse. */
export const calculadoraDeCaducidadDeAnuncio = (
  args: readonly string[],
  ahoraMs: number,
): string => {
  const horas = decimalDelArgumento(args[0]);
  if (horas === null) {
    return "Uso: /caducidad_anuncio <horas_desde_fijado>";
  }

  return shouldUnpinAnnouncement(ahoraMs - horas * 3_600_000, ahoraMs)
    ? "📌 Este anuncio ya debería desfijarse."
    : "📌 Este anuncio sigue dentro de su ventana de fijado.";
};

/** `/escalar_humano`: si el caso se le pasa a una persona. */
export const calculadoraDeEscaladaAHumano = (
  args: readonly string[],
): string => {
  const severidad = decimalDelArgumento(args[0]);
  const confianza = decimalDelArgumento(args[1]);
  if (severidad === null || confianza === null) {
    return "Uso: /escalar_humano <severidad> <confianza_bot 0-1>";
  }

  return decideHumanEscalation({
    severity: severidad,
    botConfidence: confianza,
  }).reason;
};

/** `/pregunta_completa`: si a una pregunta le falta contexto. */
export const calculadoraDePreguntaCompleta = (
  args: readonly string[],
): string => {
  const texto = args.join(" ").trim();
  if (!texto) {
    return "Uso: /pregunta_completa <texto>";
  }

  const v = assessQuestionCompleteness(texto);

  return v.complete
    ? "✅ La pregunta tiene suficiente información."
    : v.missing.join("\n");
};

/** `/nivel_conocimiento`: el nivel que refleja un porcentaje de aciertos. */
export const calculadoraDeNivelDeConocimiento = (
  args: readonly string[],
): string => {
  const correctas = enteroDelArgumento(args[0]);
  const total = enteroDelArgumento(args[1]);
  if (correctas === null || total === null) {
    return "Uso: /nivel_conocimiento <correctas> <total>";
  }

  const v = classifyKnowledgeLevel({
    correctAnswers: correctas,
    totalAnswers: total,
  });

  return `📚 Nivel: ${v.level}`;
};

/** `/incidencia_conocida`: si tantas quejas ya son una incidencia. */
export const calculadoraDeIncidenciaConocida = (
  args: readonly string[],
): string => {
  const quejas = enteroDelArgumento(args[0]);
  if (quejas === null) {
    return "Uso: /incidencia_conocida <quejas_en_ventana>";
  }

  return buildKnownIssueNotice(quejas).message;
};

/** `/aviso_mantenimiento`: el aviso de una parada programada. */
export const calculadoraDeAvisoDeMantenimiento = (
  args: readonly string[],
  ahoraMs: number,
): string => {
  const minutosHasta = decimalDelArgumento(args[0]);
  const duracionMin = decimalDelArgumento(args[1]);
  if (minutosHasta === null || duracionMin === null) {
    return "Uso: /aviso_mantenimiento <minutos_hasta_inicio> <duracion_min>";
  }

  return buildMaintenanceNotice({
    startMs: ahoraMs + minutosHasta * 60_000,
    durationMin: duracionMin,
    nowMs: ahoraMs,
  }).message;
};

/** `/mediacion`: el siguiente estado de una mediacion privada. */
export const calculadoraDeMediacion = (args: readonly string[]): string => {
  const [actual, evento] = args;
  if (!esEstadoDeMediacion(actual) || !esEventoDeMediacion(evento)) {
    return `Uso: /mediacion ${opcionesDeMediacion()}`;
  }

  return `➡️ Siguiente estado: ${nextMediationStep(actual, evento).next}`;
};

/** `/estado_incidencia`: el siguiente estado de una incidencia. */
export const calculadoraDeEstadoDeIncidencia = (
  args: readonly string[],
): string => {
  const [actual, evento] = args;
  if (!esEstadoDeIncidencia(actual) || !esEventoDeIncidencia(evento)) {
    return `Uso: /estado_incidencia ${opcionesDeIncidencia()}`;
  }

  return `➡️ Siguiente estado: ${nextIncidentStatus(actual, evento).next}`;
};

/** `/comparar_meses`: que metricas suben y cuales bajan entre dos meses. */
export const calculadoraDeComparacionDeMeses = (
  args: readonly string[],
): string => {
  const actual = paresClaveValor(args[0]);
  const anterior = paresClaveValor(args[1]);
  if (Object.keys(actual).length === 0 || Object.keys(anterior).length === 0) {
    return "Uso: /comparar_meses <k1=v1,k2=v2> <k1=v1,k2=v2>";
  }

  return compareMonths(actual, anterior)
    .map((c) => `${c.metric}: ${c.direction} (${c.delta})`)
    .join("\n");
};

/** `/fuera_tema_estudio`: si a esa hora ese mensaje esta fuera de tema. */
export const calculadoraDeFueraDeTemaDeEstudio = (
  args: readonly string[],
): string => {
  const [horaCruda, ...resto] = args;
  const hora = enteroDelArgumento(horaCruda);
  const texto = resto.join(" ").trim();
  if (hora === null || !texto) {
    return "Uso: /fuera_tema_estudio <hora> <texto>";
  }

  const v = detectOffTopicStudy({ hourOfDay: hora, text: texto });

  return v.flagged
    ? `📚 Fuera de tema: ${v.hits.join(", ")}`
    : "✅ Dentro de tema o fuera de horario de estudio.";
};

/** `/informe_lanzamiento`: como fue un anuncio despues de publicarlo. */
export const calculadoraDeInformeDeLanzamiento = (
  args: readonly string[],
): string => {
  const numeros = tresEnteros(args);
  if (numeros === null) {
    return "Uso: /informe_lanzamiento <alcance> <reacciones> <preguntas>";
  }

  const [alcance, reacciones, preguntas] = numeros;

  return buildPostLaunchReport({
    reach: alcance,
    reactions: reacciones,
    questions: preguntas,
  }).summary;
};

/** `/puntuar_duda`: la prioridad de una duda en la cola. */
export const calculadoraDePuntuacionDeDuda = (
  args: readonly string[],
): string => {
  const urgente = siONo(args[0]);
  const edadMs = decimalDelArgumento(args[1]);
  const votos = enteroDelArgumento(args[2]);
  if (urgente === undefined || edadMs === null || votos === null) {
    return "Uso: /puntuar_duda <urgente si|no> <edad_ms> <votos>";
  }

  return `❓ Prioridad: ${scoreDoubt({ id: "duda", urgent: urgente, ageMs: edadMs, upvotes: votos })}`;
};

/** `/resumen_publicacion`: que va a pasar al publicar en varios grupos. */
export const calculadoraDeResumenDePublicacion = (
  args: readonly string[],
): string => {
  const grupos = enteroDelArgumento(args[0]);
  const fijarEn = enteroDelArgumento(args[1]);
  const silencioso = siONo(args[2]);
  if (grupos === null || fijarEn === null || silencioso === undefined) {
    return "Uso: /resumen_publicacion <grupos> <fijar_en> <silencioso si|no>";
  }

  return buildPublishSummary({
    groups: grupos,
    pinIn: fijarEn,
    silent: silencioso,
  });
};

/** `/anuncios_por_rol`: el mismo anuncio escrito para cada rol. */
export const calculadoraDeAnunciosPorRol = (
  args: readonly string[],
): string => {
  const [base, rolesCrudos] = args.join(" ").split("|");
  const roles = (rolesCrudos ?? "")
    .split(",")
    .map((rol) => rol.trim())
    .filter(Boolean);
  if (!base?.trim() || roles.length === 0) {
    return "Uso: /anuncios_por_rol <texto_base>|<rol1,rol2,...>";
  }

  return buildRoleAnnouncements(base.trim(), roles)
    .map((v) => `[${v.role}] ${v.text}`)
    .join("\n\n");
};

/** `/modo_ahorro`: si toca apretar el gasto de IA. */
export const calculadoraDeModoAhorro = (args: readonly string[]): string => {
  const llamadasHoy = enteroDelArgumento(args[0]);
  const presupuesto = enteroDelArgumento(args[1]);
  if (llamadasHoy === null || presupuesto === null) {
    return "Uso: /modo_ahorro <llamadas_ia_hoy> <presupuesto>";
  }

  return decideSaveMode({
    aiCallsToday: llamadasHoy,
    budget: presupuesto,
  }).advice;
};

/** `/anuncio_sensible`: si un anuncio toca temas delicados. */
export const calculadoraDeAnuncioSensible = (
  args: readonly string[],
): string => {
  const texto = args.join(" ").trim();
  if (!texto) {
    return "Uso: /anuncio_sensible <texto>";
  }

  const v = detectSensitiveAnnouncement(texto);

  return v.sensitive
    ? `⚠️ Temas sensibles: ${v.topics.join(", ")}`
    : "✅ Sin temas sensibles detectados.";
};

/** `/seguimiento_ticket`: si toca preguntar que tal fue la resolucion. */
export const calculadoraDeSeguimientoDeTicket = (
  args: readonly string[],
  ahoraMs: number,
): string => {
  const horas = decimalDelArgumento(args[0]);
  if (horas === null) {
    return "Uso: /seguimiento_ticket <horas_desde_resuelto>";
  }

  const v = shouldSendTicketFollowup(ahoraMs - horas * 3_600_000, ahoraMs);

  return v.send ? v.message : "Todavía no toca hacer seguimiento.";
};

/** `/trato_vip`: el SLA que le toca a cada plan. */
export const calculadoraDeTratoVip = (args: readonly string[]): string => {
  const [plan] = args;
  const minutosBase = decimalDelArgumento(args[1]);
  if (!esPlanDeCliente(plan) || minutosBase === null) {
    return `Uso: /trato_vip ${opcionesDePlan()} <minutos_base>`;
  }

  const v = applyVipTreatment({ plan, baseMinutes: minutosBase });

  return v.vip
    ? `🌟 VIP: SLA ${v.slaMinutes} min`
    : `SLA estándar: ${v.slaMinutes} min`;
};

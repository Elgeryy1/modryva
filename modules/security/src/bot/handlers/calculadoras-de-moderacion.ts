import {
  cuatroEnteros,
  decimalDelArgumento,
  enteroDelArgumento,
  siONo,
  tresEnteros,
} from "@superbot/shared";

import { buildBanChecklist } from "../../ban-checklist.js";
import { groupSimilarReports } from "../../batch-resolve.js";
import { classifyCaseSensitivity } from "../../case-sensitivity.js";
import { buildCoexistenceAgreement } from "../../coexistence-agreement.js";
import { convertSanction } from "../../convertible-sanction.js";
import { scoreDecisionConfidence } from "../../decision-confidence.js";
import { recommendDeescalation } from "../../deescalation.js";
import { grantEmergencyPermission } from "../../emergency-perms.js";
import { buildSanctionRationale } from "../../explain-before-sanction.js";
import { isWithinGrace } from "../../grace-window.js";
import { guardImpulsiveAction } from "../../impulsive-guard.js";
import { decideLastChance } from "../../last-chance.js";
import { buildLearningNotice } from "../../learning-notice.js";
import { decideLinkSandbox } from "../../link-sandbox.js";
import { shieldFromMentions } from "../../mention-shield.js";
import { detectNewDomain } from "../../new-domain.js";
import { buildObservationDiagnosis } from "../../observe-diagnosis.js";
import { detectOperationalBias } from "../../operational-bias.js";
import { decideQuarantine } from "../../quarantine-pattern.js";
import { assessReplyBait } from "../../reply-bait.js";
import { canPerformAction } from "../../role-action-guard.js";
import { predictSanctionEffect } from "../../sanction-effect.js";
import { buildSanctionSignature } from "../../sanction-signature.js";
import { detectSelfDealing } from "../../self-dealing.js";
import { classifyThreadSensitivity } from "../../sensitive-thread.js";
import { detectSilentSpam } from "../../silent-spam.js";
import { detectSpoiler } from "../../spoiler-filter.js";
import { isSeparationActive } from "../../user-separation.js";
import {
  esRolDeAccion,
  esRolDeEmergencia,
  opcionesDeRolDeAccion,
  opcionesDeRolDeEmergencia,
} from "./estados.js";

/**
 * Las veintiocho calculadoras de moderacion de `/utility_plus`.
 *
 * Misma forma que las de juego, soporte y comunidad: parsear, rendirse con el
 * uso si no encaja, calcular y dar formato. Ninguna toca la base ni Telegram.
 *
 * Los dos relojes de pared entran por parametro. Y hay dos guardas de rol que
 * antes eran un `Set` estatico de la clase del nucleo mas un `as`: ahora salen
 * de la union, en `estados.ts`.
 */

/** `/permiso`: si un rol puede hacer una accion. */
export const calculadoraDePermiso = (args: readonly string[]): string => {
  const [rol, ...resto] = args;
  const accion = resto.join(" ").trim();
  if (!esRolDeAccion(rol) || !accion) {
    return `Uso: /permiso <${opcionesDeRolDeAccion()}> <acción>`;
  }

  return canPerformAction(rol, accion).reason;
};

/** `/confianza_decision`: como de firme es una decision de staff. */
export const calculadoraDeConfianzaDeDecision = (
  args: readonly string[],
): string => {
  const pruebas = enteroDelArgumento(args[0]);
  const precedente = siONo(args[1]);
  const acuerdo = decimalDelArgumento(args[2]);
  if (pruebas === null || precedente === undefined || acuerdo === null) {
    return "Uso: /confianza_decision <pruebas 0+> <precedente si|no> <acuerdo_staff 0-1>";
  }

  const v = scoreDecisionConfidence({
    evidenceCount: pruebas,
    precedentMatch: precedente,
    staffAgreement: acuerdo,
  });

  return `🎯 Confianza: ${v.score}/100 (${v.band})`;
};

/** `/checklist_ban`: que falta antes de banear a alguien. */
export const calculadoraDeChecklistDeBan = (
  args: readonly string[],
): string => {
  const hayPruebas = siONo(args[0]);
  const esReincidente = siONo(args[1]);
  const reglaCitada = siONo(args[2]);
  const duracionPuesta = siONo(args[3]);
  if (
    hayPruebas === undefined ||
    esReincidente === undefined ||
    reglaCitada === undefined ||
    duracionPuesta === undefined
  ) {
    return "Uso: /checklist_ban <evidencia si|no> <reincidente si|no> <regla si|no> <duración si|no>";
  }

  const v = buildBanChecklist({
    hasEvidence: hayPruebas,
    isRepeatOffender: esReincidente,
    ruleCited: reglaCitada,
    durationSet: duracionPuesta,
  });
  const lineas = v.items.map(
    (item) => `${item.done ? "✅" : "❌"} ${item.label}`,
  );

  return `${v.ready ? "✅ Listo para banear" : "⏳ Faltan pasos"}\n${lineas.join("\n")}`;
};

/** `/sensibilidad_caso`: como de delicado es un caso. */
export const calculadoraDeSensibilidadDeCaso = (
  args: readonly string[],
): string => {
  const datosPersonales = siONo(args[0]);
  const hayMenor = siONo(args[1]);
  const amenazaLegal = siONo(args[2]);
  if (
    datosPersonales === undefined ||
    hayMenor === undefined ||
    amenazaLegal === undefined
  ) {
    return "Uso: /sensibilidad_caso <datos_personales si|no> <menor si|no> <amenaza_legal si|no>";
  }

  const v = classifyCaseSensitivity({
    hasPersonalData: datosPersonales,
    involvesMinor: hayMenor,
    legalThreat: amenazaLegal,
  });

  return `${v.level} · ${v.reason}`;
};

/** `/acuerdo_convivencia`: las reglas que dos personas aceptan para convivir. */
export const calculadoraDeAcuerdoDeConvivencia = (
  args: readonly string[],
): string => {
  const [personaA, personaB, ...resto] = args;
  const reglas = resto
    .join(" ")
    .split(",")
    .map((regla) => regla.trim())
    .filter(Boolean);
  if (!personaA || !personaB || reglas.length === 0) {
    return "Uso: /acuerdo_convivencia <usuarioA> <usuarioB> <regla1,regla2,...>";
  }

  return buildCoexistenceAgreement({
    userA: personaA,
    userB: personaB,
    rules: reglas,
  });
};

/** `/convertir_sancion`: cambiar un mute por aceptar la regla. */
export const calculadoraDeConversionDeSancion = (
  args: readonly string[],
): string => {
  const minutosDeMute = decimalDelArgumento(args[0]);
  const aceptaLaRegla = siONo(args[1]);
  if (minutosDeMute === null || aceptaLaRegla === undefined) {
    return "Uso: /convertir_sancion <minutos_mute> <acepta_regla si|no>";
  }

  return convertSanction({
    muteMs: minutosDeMute * 60_000,
    acceptsRule: aceptaLaRegla,
  }).message;
};

/** `/desescalar`: como bajar la tension de una discusion. */
export const calculadoraDeDesescalada = (args: readonly string[]): string => {
  const tension = decimalDelArgumento(args[0]);
  const mensajesPorMin = decimalDelArgumento(args[1]);
  if (tension === null || mensajesPorMin === null) {
    return "Uso: /desescalar <tension> <mensajes_por_min>";
  }

  return recommendDeescalation({ tension, messagesPerMin: mensajesPorMin })
    .message;
};

/** `/permiso_emergencia`: que puede hacer cada rol durante un raid. */
export const calculadoraDePermisoDeEmergencia = (
  args: readonly string[],
): string => {
  const [rol] = args;
  const hayRaid = siONo(args[1]);
  if (!esRolDeEmergencia(rol) || hayRaid === undefined) {
    return `Uso: /permiso_emergencia <${opcionesDeRolDeEmergencia()}> <raid_activo si|no>`;
  }

  const v = grantEmergencyPermission({ role: rol, raidActive: hayRaid });

  return v.granted
    ? `✅ Permiso concedido: ${v.scope}`
    : `❌ Sin permiso especial. ${v.scope}`;
};

/** `/razon_sancion`: la sanción explicada con su porqué. */
export const calculadoraDeRazonDeSancion = (
  args: readonly string[],
): string => {
  const [regla, accion, avisosCrudo, confianzaCruda] = args
    .join(" ")
    .split("|");
  const avisosPrevios = enteroDelArgumento(avisosCrudo);
  const confianza = decimalDelArgumento(confianzaCruda);
  if (
    !regla?.trim() ||
    !accion?.trim() ||
    avisosPrevios === null ||
    confianza === null
  ) {
    return "Uso: /razon_sancion <regla>|<acción>|<avisos_previos>|<confianza>";
  }

  return buildSanctionRationale({
    rule: regla.trim(),
    action: accion.trim(),
    priorWarns: avisosPrevios,
    confidence: confianza,
  });
};

/** `/ventana_gracia`: si a un mensaje todavia le queda margen para borrarlo. */
export const calculadoraDeVentanaDeGracia = (
  args: readonly string[],
  ahoraMs: number,
): string => {
  const segundos = decimalDelArgumento(args[0]);
  if (segundos === null) {
    return "Uso: /ventana_gracia <segundos_desde_envio>";
  }

  return isWithinGrace(ahoraMs - segundos * 1000, ahoraMs)
    ? "🟢 Todavía dentro de la ventana de gracia."
    : "🔴 La ventana de gracia ya expiró.";
};

/** `/guardia_impulsivo`: si una accion se tomo demasiado deprisa. */
export const calculadoraDeGuardiaImpulsivo = (
  args: readonly string[],
): string => {
  const [accion] = args;
  const confirmada = siONo(args[1]);
  const esperadoMs = enteroDelArgumento(args[2]);
  if (!accion || confirmada === undefined || esperadoMs === null) {
    return "Uso: /guardia_impulsivo <acción> <confirmado si|no> <ms_esperados>";
  }

  return guardImpulsiveAction({
    action: accion,
    confirmed: confirmada,
    waitedMs: esperadoMs,
  }).reason;
};

/** `/ultima_oportunidad`: si toca dar un ultimo aviso antes del final. */
export const calculadoraDeUltimaOportunidad = (
  args: readonly string[],
): string => {
  const avisos = enteroDelArgumento(args[0]);
  const umbral = enteroDelArgumento(args[1]);
  if (avisos === null || umbral === null) {
    return "Uso: /ultima_oportunidad <avisos> <umbral>";
  }

  return decideLastChance({ warnCount: avisos, threshold: umbral }).message;
};

/** `/aviso_aprendizaje`: la regla con un ejemplo de lo que si vale. */
export const calculadoraDeAvisoDeAprendizaje = (
  args: readonly string[],
): string => {
  const [regla, ejemplo] = args.join(" ").split("|");
  if (!regla?.trim() || !ejemplo?.trim()) {
    return "Uso: /aviso_aprendizaje <regla>|<ejemplo>";
  }

  return buildLearningNotice({ rule: regla.trim(), example: ejemplo.trim() });
};

/** `/sandbox_enlace`: si el primer enlace de alguien nuevo se retiene. */
export const calculadoraDeSandboxDeEnlace = (
  args: readonly string[],
): string => {
  const esNuevo = siONo(args[0]);
  const esPrimerEnlace = siONo(args[1]);
  if (esNuevo === undefined || esPrimerEnlace === undefined) {
    return "Uso: /sandbox_enlace <nuevo si|no> <primer_enlace si|no>";
  }

  return decideLinkSandbox({
    isNewUser: esNuevo,
    isFirstLink: esPrimerEnlace,
  }).reason;
};

/** `/agrupar_reportes`: junta los reportes que van del mismo motivo. */
export const calculadoraDeAgrupacionDeReportes = (
  args: readonly string[],
): string => {
  const reportes = args
    .join(" ")
    .split(",")
    .map((entrada) => entrada.trim())
    .filter(Boolean)
    .map((entrada) => {
      const [id, motivo] = entrada.split(":");
      return id && motivo ? { id, reason: motivo } : null;
    })
    .filter((entrada): entrada is { id: string; reason: string } => !!entrada);
  if (reportes.length === 0) {
    return "Uso: /agrupar_reportes <id1:motivo1,id2:motivo2,...>";
  }

  return groupSimilarReports(reportes)
    .map((grupo) => `${grupo.reason} (${grupo.count}): ${grupo.ids.join(", ")}`)
    .join("\n");
};

/** `/escudo_menciones`: si alguien esta recibiendo demasiadas menciones. */
export const calculadoraDeEscudoDeMenciones = (
  args: readonly string[],
): string => {
  const menciones = enteroDelArgumento(args[0]);
  if (menciones === null) {
    return "Uso: /escudo_menciones <menciones_en_ventana>";
  }

  const v = shieldFromMentions({ mentionsInWindow: menciones });

  return v.limited
    ? `🛡️ Limitado, exceso de ${v.excess} menciones.`
    : "🛡️ Sin límite alcanzado.";
};

/** `/dominio_nuevo`: si un dominio no se habia visto antes por aqui. */
export const calculadoraDeDominioNuevo = (args: readonly string[]): string => {
  const [dominio, conocidosCrudo] = args;
  if (!dominio) {
    return "Uso: /dominio_nuevo <dominio> <conocido1,conocido2,...>";
  }

  const conocidos = (conocidosCrudo ?? "")
    .split(",")
    .map((entrada) => entrada.trim())
    .filter(Boolean);
  const v = detectNewDomain(dominio, conocidos);

  return v.isNew
    ? `🆕 Dominio nuevo: ${v.normalized}`
    : `Dominio ya conocido: ${v.normalized}`;
};

/** `/diagnostico_observacion`: que se ve en un rato de observacion. */
export const calculadoraDeDiagnosticoDeObservacion = (
  args: readonly string[],
): string => {
  const numeros = tresEnteros(args);
  if (numeros === null) {
    return "Uso: /diagnostico_observacion <mensajes> <conflictos> <spam>";
  }

  const [mensajes, conflictos, spam] = numeros;
  const v = buildObservationDiagnosis({
    messages: mensajes,
    conflicts: conflictos,
    spam,
  });

  return `🔎 ${v.verdict}: ${v.summary}`;
};

/** `/sesgo_operativo`: si el staff sanciona mas a los nuevos que a los de siempre. */
export const calculadoraDeSesgoOperativo = (
  args: readonly string[],
): string => {
  const numeros = cuatroEnteros(args);
  if (numeros === null) {
    return "Uso: /sesgo_operativo <sanciones_nuevos> <total_nuevos> <sanciones_veteranos> <total_veteranos>";
  }

  const [sancionesNuevos, totalNuevos, sancionesVeteranos, totalVeteranos] =
    numeros;
  const v = detectOperationalBias({
    newSanctions: sancionesNuevos,
    newMembers: totalNuevos,
    veteranSanctions: sancionesVeteranos,
    veteranMembers: totalVeteranos,
  });

  return v.biased
    ? "⚠️ Sesgo detectado contra nuevos miembros."
    : "✅ Sin sesgo relevante.";
};

/** `/patron_cuarentena`: si un perfil nuevo tiene pinta de cuenta de usar y tirar. */
export const calculadoraDePatronDeCuarentena = (
  args: readonly string[],
): string => {
  const tieneFoto = siONo(args[0]);
  const nombreRaro = siONo(args[1]);
  const enlaceRapido = siONo(args[2]);
  if (
    tieneFoto === undefined ||
    nombreRaro === undefined ||
    enlaceRapido === undefined
  ) {
    return "Uso: /patron_cuarentena <foto si|no> <nombre_raro si|no> <link_rapido si|no>";
  }

  const v = decideQuarantine({
    hasPhoto: tieneFoto,
    oddName: nombreRaro,
    quickLink: enlaceRapido,
  });

  return v.quarantine
    ? `🚧 Cuarentena: ${v.signals.join(", ")}`
    : "Sin señales de cuarentena.";
};

/** `/cebo_respuesta`: si una respuesta esta puesta ahi para pescar clics. */
export const calculadoraDeCeboDeRespuesta = (
  args: readonly string[],
): string => {
  const esRespuesta = siONo(args[0]);
  const reacciones = enteroDelArgumento(args[1]);
  const edadEnHoras = decimalDelArgumento(args[2]);
  const tieneEnlace = siONo(args[3]);
  const tieneMencion = siONo(args[4]);
  if (
    esRespuesta === undefined ||
    reacciones === null ||
    edadEnHoras === null ||
    tieneEnlace === undefined ||
    tieneMencion === undefined
  ) {
    return "Uso: /cebo_respuesta <es_respuesta si|no> <reacciones> <edad_cuenta_horas> <tiene_link si|no> <tiene_mencion si|no>";
  }

  const v = assessReplyBait({
    isReply: esRespuesta,
    repliedMessageReactions: reacciones,
    replierAccountAgeMs: edadEnHoras * 3_600_000,
    textHasLink: tieneEnlace,
    textHasMention: tieneMencion,
  });

  return v.suspicious
    ? `🎣 Sospechoso: ${v.reasons.join(", ")}`
    : "No parece cebo.";
};

/** `/efecto_sancion`: cómo va a sentar una sanción en el grupo. */
export const calculadoraDeEfectoDeSancion = (
  args: readonly string[],
): string => {
  const severidad = decimalDelArgumento(args[0]);
  const antiguedadDias = decimalDelArgumento(args[1]);
  const tieneApoyo = siONo(args[2]);
  if (
    severidad === null ||
    antiguedadDias === null ||
    tieneApoyo === undefined
  ) {
    return "Uso: /efecto_sancion <severidad> <antiguedad_dias> <apoyo si|no>";
  }

  return `🔮 Efecto probable: ${
    predictSanctionEffect({
      severity: severidad,
      userTenureDays: antiguedadDias,
      hasSupporters: tieneApoyo,
    }).effect
  }`;
};

/** `/firma_sancion`: la firma que queda al pie de una sanción. */
export const calculadoraDeFirmaDeSancion = (
  args: readonly string[],
): string => {
  const [staff, motivo, casoId] = args.join(" ").split("|");
  if (!staff?.trim() || !motivo?.trim() || !casoId?.trim()) {
    return "Uso: /firma_sancion <staff>|<motivo>|<caso_id>";
  }

  return buildSanctionSignature({
    staff: staff.trim(),
    reason: motivo.trim(),
    caseId: casoId.trim(),
  });
};

/** `/auto_beneficio`: si quien modera esta metido en el caso que modera. */
export const calculadoraDeAutoBeneficio = (args: readonly string[]): string => {
  const adminId = enteroDelArgumento(args[0]);
  const implicados = (args[1] ?? "")
    .split(",")
    .map((valor) => enteroDelArgumento(valor.trim()))
    .filter((valor): valor is number => valor !== null);
  if (adminId === null || implicados.length === 0) {
    return "Uso: /auto_beneficio <adminId> <id1,id2,...>";
  }

  return detectSelfDealing({ adminId, involvedUserIds: implicados }).reason;
};

/** `/sensibilidad_hilo`: si un hilo se esta poniendo delicado. */
export const calculadoraDeSensibilidadDeHilo = (
  args: readonly string[],
): string => {
  const reportes = enteroDelArgumento(args[0]);
  const conflictos = enteroDelArgumento(args[1]);
  if (reportes === null || conflictos === null) {
    return "Uso: /sensibilidad_hilo <reportes> <conflictos>";
  }

  const v = classifyThreadSensitivity({
    reports: reportes,
    conflicts: conflictos,
  });

  return v.sensitive
    ? `🔍 Hilo sensible (score ${v.score})`
    : `✅ Hilo normal (score ${v.score})`;
};

/** `/spam_silencioso`: el spam que no grita pero llena. */
export const calculadoraDeSpamSilencioso = (
  args: readonly string[],
): string => {
  const numeros = tresEnteros(args);
  if (numeros === null) {
    return "Uso: /spam_silencioso <mensajes> <links> <menciones>";
  }

  const [mensajes, enlaces, menciones] = numeros;
  const v = detectSilentSpam({
    messageCount: mensajes,
    linkCount: enlaces,
    mentionCount: menciones,
  });

  return v.suspicious
    ? `🤫 Sospechoso (ratio ${v.ratio})`
    : "No parece spam silencioso.";
};

/** `/filtro_spoiler`: si un mensaje destripa algo. */
export const calculadoraDeFiltroDeSpoiler = (
  args: readonly string[],
): string => {
  const [texto, palabrasCrudas] = args.join(" ").split("|");
  if (!texto?.trim()) {
    return "Uso: /filtro_spoiler <texto>|<palabra1,palabra2>";
  }

  const palabras = (palabrasCrudas ?? "")
    .split(",")
    .map((valor) => valor.trim())
    .filter(Boolean);
  const v = detectSpoiler(texto.trim(), palabras);

  return v.matched
    ? `🚫 Spoiler: ${v.hits.join(", ")}`
    : "Sin spoilers detectados.";
};

/** `/separacion_activa`: si dos personas siguen separadas tras un choque. */
export const calculadoraDeSeparacionActiva = (
  args: readonly string[],
  ahoraMs: number,
): string => {
  const horas = decimalDelArgumento(args[0]);
  if (horas === null) {
    return "Uso: /separacion_activa <horas_desde_conflicto>";
  }

  return isSeparationActive(ahoraMs - horas * 3_600_000, ahoraMs)
    ? "🚧 Separación todavía activa."
    : "🟢 Separación ya terminó.";
};

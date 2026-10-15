import {
  cuatroEnteros,
  decimalDelArgumento,
  enteroDelArgumento,
  paresClaveValor,
  siONo,
  tresEnteros,
} from "@superbot/shared";

import { detectAbandonedGroup } from "../../abandoned-group.js";
import { routeDiscreetHelp } from "../../discreet-help.js";
import { buildEducationalNotice } from "../../educational-notice.js";
import { computeGamesRetention } from "../../games-retention.js";
import { suggestGrowthTips } from "../../growth-tips.js";
import { humanizeDailyStats } from "../../humanized-stats.js";
import { computeHypeLevel } from "../../hype-meter.js";
import {
  isIcebreakerTopic,
  listIcebreakerTopics,
  pickIcebreaker,
} from "../../icebreakers.js";
import { mapIntentToConfig } from "../../intent-config.js";
import { canUnlockLinks } from "../../link-unlock.js";
import { decideMandatoryReread } from "../../mandatory-reread.js";
import { mapMemberGoalToOnboarding } from "../../member-goal.js";
import { parseNaturalRule } from "../../nl-rule-parser.js";
import { checkOverConfiguration } from "../../over-config-warning.js";
import { explainPermission } from "../../permission-explainer.js";
import { isOnProbation } from "../../probation.js";
import { computeRuleActivityEffect } from "../../rule-activity-effect.js";
import { classifyRuleSeverity } from "../../rule-severity.js";
import { decideCelebrationMode } from "../../silent-celebration.js";
import { recommendBySize } from "../../size-recommendations.js";
import { computeSocialStability } from "../../social-stability.js";
import { softenSanctionMessage } from "../../softer-sanction-message.js";
import { detectTopicMisuse } from "../../topic-misuse.js";
import { compareTwinGroups } from "../../twin-group-compare.js";
import {
  esIntencion,
  esObjetivoDeMiembro,
  esSeveridadDeRegla,
  opcionesDeIntencion,
  opcionesDeObjetivo,
  opcionesDeSeveridad,
} from "./estados.js";

/**
 * Las veinticinco calculadoras de comunidad de `/utility_plus`.
 *
 * Misma forma que las de juego y soporte: parsear, rendirse con el uso si no
 * encaja, calcular y dar formato. Ninguna toca la base ni Telegram.
 *
 * Los relojes y la semilla de aleatoriedad entran por parametro. La semilla
 * importa: `/rompehielo` la usa para elegir pregunta, y el nucleo le pasaba el
 * `updateId` justamente para que un reintento del mismo update devuelva la
 * misma pregunta. Recibirla por parametro deja esa propiedad a la vista en vez
 * de escondida en la llamada.
 */

/** `/regla_natural`: entender una regla escrita en castellano corriente. */
export const calculadoraDeReglaNatural = (args: readonly string[]): string => {
  const parseada = parseNaturalRule(args.join(" "));
  if (!parseada.ok) {
    return "No entendí la regla. Ejemplo: /regla_natural bloquea enlaces de nuevos durante 24 horas";
  }

  const lineas = [
    `Acción: ${parseada.action}`,
    `Objetivo: ${parseada.target}`,
    ...(parseada.scope ? [`Alcance: ${parseada.scope}`] : []),
    ...(parseada.durationMs
      ? [`Duración: ${Math.round(parseada.durationMs / 3_600_000)}h`]
      : []),
  ];

  return `📝 Entendido:\n${lineas.join("\n")}`;
};

/** `/grupo_abandonado`: si un grupo lleva demasiado sin vida. */
export const calculadoraDeGrupoAbandonado = (
  args: readonly string[],
  ahoraMs: number,
): string => {
  const dias = decimalDelArgumento(args[0]);
  const miembros = enteroDelArgumento(args[1]);
  if (dias === null || miembros === null) {
    return "Uso: /grupo_abandonado <dias_inactivo> <miembros>";
  }

  const v = detectAbandonedGroup({
    lastActivityMs: ahoraMs - dias * 86_400_000,
    nowMs: ahoraMs,
    members: miembros,
  });

  return `${v.abandoned ? "⚠️ Grupo abandonado" : "✅ Grupo activo"} · ${v.idleDays} días inactivo${v.empty ? " · vacío" : ""}`;
};

/** `/ayuda_discreta`: si alguien esta pidiendo ayuda sin decirlo. */
export const calculadoraDeAyudaDiscreta = (args: readonly string[]): string => {
  const texto = args.join(" ").trim();
  if (!texto) {
    return "Uso: /ayuda_discreta <texto>";
  }

  return routeDiscreetHelp({ text: texto }).needsHelp
    ? "🤫 Detectada petición de ayuda discreta. Un admin te escribirá en privado."
    : "No he detectado una petición de ayuda.";
};

/** `/aviso_educativo`: la regla explicada con su porque. */
export const calculadoraDeAvisoEducativo = (
  args: readonly string[],
): string => {
  const [regla, motivo] = args.join(" ").split("|");
  if (!regla?.trim() || !motivo?.trim()) {
    return "Uso: /aviso_educativo <regla>|<motivo>";
  }

  return buildEducationalNotice({ rule: regla.trim(), why: motivo.trim() });
};

/** `/retencion_juegos`: si quien juega se queda mas que quien no. */
export const calculadoraDeRetencionDeJuegos = (
  args: readonly string[],
): string => {
  const numeros = cuatroEnteros(args);
  if (numeros === null) {
    return "Uso: /retencion_juegos <jugadores_retenidos> <jugadores_total> <no_jugadores_retenidos> <no_jugadores_total>";
  }

  const [retenidos, total, retenidosNo, totalNo] = numeros;
  const v = computeGamesRetention({
    playersRetained: retenidos,
    playersTotal: total,
    nonPlayersRetained: retenidosNo,
    nonPlayersTotal: totalNo,
  });

  return `🎮 Jugadores: ${Math.round(v.playerRate * 100)}% · No jugadores: ${Math.round(v.nonPlayerRate * 100)}% · ${v.positive ? "positivo" : "negativo"}`;
};

/** `/consejos_crecimiento`: que tocar segun como va el grupo. */
export const calculadoraDeConsejosDeCrecimiento = (
  args: readonly string[],
): string => {
  const numeros = tresEnteros(args);
  if (numeros === null) {
    return "Uso: /consejos_crecimiento <miembros> <conflictos_semana> <altas_semana>";
  }

  const [miembros, conflictos, altas] = numeros;

  return suggestGrowthTips({
    members: miembros,
    weeklyConflicts: conflictos,
    weeklyJoins: altas,
  }).join("\n");
};

/** `/stats_humanizadas`: las cifras del dia contadas como se cuentan. */
export const calculadoraDeStatsHumanizadas = (
  args: readonly string[],
): string => {
  const numeros = cuatroEnteros(args);
  if (numeros === null) {
    return "Uso: /stats_humanizadas <mensajes_hoy> <conflictos_hoy> <mensajes_ayer> <conflictos_ayer>";
  }

  const [mensajesHoy, conflictosHoy, mensajesAyer, conflictosAyer] = numeros;

  return humanizeDailyStats(
    { messages: mensajesHoy, conflicts: conflictosHoy },
    { messages: mensajesAyer, conflicts: conflictosAyer },
  );
};

/** `/medidor_hype`: cuanto se ha disparado el ritmo del grupo. */
export const calculadoraDeMedidorDeHype = (args: readonly string[]): string => {
  const base = decimalDelArgumento(args[0]);
  const actual = decimalDelArgumento(args[1]);
  if (base === null || actual === null) {
    return "Uso: /medidor_hype <base_por_hora> <actual_por_hora>";
  }

  const v = computeHypeLevel({
    baselinePerHour: base,
    currentPerHour: actual,
  });

  return `🔥 Nivel: ${v.level} (ratio ${v.ratio})`;
};

/** `/config_intencion`: los ajustes que encajan con lo que se busca. */
export const calculadoraDeIntencionDeConfig = (
  args: readonly string[],
): string => {
  const intencion = args[0];
  if (!esIntencion(intencion)) {
    return `Uso: /config_intencion <${opcionesDeIntencion()}>`;
  }

  return mapIntentToConfig(intencion).summary;
};

/** `/desbloquear_enlaces`: si a alguien ya se le pueden soltar los enlaces. */
export const calculadoraDeDesbloqueoDeEnlaces = (
  args: readonly string[],
): string => {
  const diasAntiguedad = enteroDelArgumento(args[0]);
  const confianza = decimalDelArgumento(args[1]);
  if (diasAntiguedad === null || confianza === null) {
    return "Uso: /desbloquear_enlaces <dias_antiguedad> <confianza>";
  }

  return canUnlockLinks({
    tenureDays: diasAntiguedad,
    trustScore: confianza,
  }).reason;
};

/** `/relectura_obligatoria`: si los cambios de reglas obligan a releerlas. */
export const calculadoraDeRelecturaObligatoria = (
  args: readonly string[],
): string => {
  const numeros = tresEnteros(args);
  if (numeros === null) {
    return "Uso: /relectura_obligatoria <anadidas> <eliminadas> <cambiadas>";
  }

  const [anadidas, eliminadas, cambiadas] = numeros;
  const v = decideMandatoryReread({
    added: anadidas,
    removed: eliminadas,
    changed: cambiadas,
  });

  return v.required
    ? `📖 Relectura obligatoria (${v.totalChanges} cambios)`
    : "📖 No hace falta relectura obligatoria.";
};

/** `/objetivo_miembro`: la bienvenida que encaja con lo que viene a hacer. */
export const calculadoraDeObjetivoDeMiembro = (
  args: readonly string[],
): string => {
  const objetivo = args[0];
  if (!esObjetivoDeMiembro(objetivo)) {
    return `Uso: /objetivo_miembro <${opcionesDeObjetivo()}>`;
  }

  const v = mapMemberGoalToOnboarding(objetivo);

  return `🎯 ${v.focus}\n${v.tips.join("\n")}`;
};

/** `/exceso_config`: si el grupo tiene mas reglas de las que aguanta. */
export const calculadoraDeExcesoDeConfig = (
  args: readonly string[],
): string => {
  const reglasActivas = enteroDelArgumento(args[0]);
  const miembros = enteroDelArgumento(args[1]);
  if (reglasActivas === null || miembros === null) {
    return "Uso: /exceso_config <reglas_activas> <miembros>";
  }

  return checkOverConfiguration({
    activeRules: reglasActivas,
    memberCount: miembros,
  }).advice;
};

/** `/explicar_permiso`: que hace de verdad un permiso de Telegram. */
export const calculadoraDeExplicacionDePermiso = (
  args: readonly string[],
): string => {
  const permiso = args.join(" ").trim();
  if (!permiso) {
    return "Uso: /explicar_permiso <permiso>";
  }

  const v = explainPermission(permiso);

  return v.known ? `${v.title}: ${v.explanation}` : "Permiso desconocido.";
};

/** `/periodo_prueba`: si alguien sigue en su periodo de prueba. */
export const calculadoraDePeriodoDePrueba = (
  args: readonly string[],
  ahoraMs: number,
): string => {
  const horas = decimalDelArgumento(args[0]);
  if (horas === null) {
    return "Uso: /periodo_prueba <horas_desde_aceptado>";
  }

  return isOnProbation(ahoraMs - horas * 3_600_000, ahoraMs)
    ? "🔶 Todavía en periodo de prueba."
    : "🟢 Periodo de prueba terminado.";
};

/** `/efecto_regla`: cuanto movio la actividad una regla nueva. */
export const calculadoraDeEfectoDeRegla = (args: readonly string[]): string => {
  const antes = decimalDelArgumento(args[0]);
  const despues = decimalDelArgumento(args[1]);
  if (antes === null || despues === null) {
    return "Uso: /efecto_regla <antes> <después>";
  }

  const v = computeRuleActivityEffect({ before: antes, after: despues });

  return `📊 ${v.effect} (${v.pct}%)`;
};

/** `/severidad_regla`: que accion toca para cada nivel de gravedad. */
export const calculadoraDeSeveridadDeRegla = (
  args: readonly string[],
): string => {
  const nivel = args[0];
  if (!esSeveridadDeRegla(nivel)) {
    return `Uso: /severidad_regla <${opcionesDeSeveridad()}>`;
  }

  const v = classifyRuleSeverity(nivel);

  return `${v.emoji} Rango ${v.rank}: ${v.recommendedAction}`;
};

/** `/celebracion_silenciosa`: si toca celebrar en alto o por lo bajo. */
export const calculadoraDeCelebracionSilenciosa = (
  args: readonly string[],
): string => {
  const hito = siONo(args[0]);
  const conflictosRecientes = enteroDelArgumento(args[1]);
  if (hito === undefined || conflictosRecientes === null) {
    return "Uso: /celebracion_silenciosa <hito si|no> <conflictos_recientes>";
  }

  return decideCelebrationMode({
    milestone: hito,
    recentConflicts: conflictosRecientes,
  }).message;
};

/** `/recomendacion_tamano`: que conviene segun cuanta gente hay. */
export const calculadoraDeRecomendacionPorTamano = (
  args: readonly string[],
): string => {
  const miembros = enteroDelArgumento(args[0]);
  if (miembros === null) {
    return "Uso: /recomendacion_tamano <miembros>";
  }

  const v = recommendBySize(miembros);

  return `📏 ${v.tier}\n${v.recommendations.join("\n")}`;
};

/** `/estabilidad_social`: como de estable esta la convivencia. */
export const calculadoraDeEstabilidadSocial = (
  args: readonly string[],
): string => {
  const numeros = tresEnteros(args);
  if (numeros === null) {
    return "Uso: /estabilidad_social <conflictos> <resoluciones> <miembros_activos>";
  }

  const [conflictos, resoluciones, activos] = numeros;
  const v = computeSocialStability({
    conflicts: conflictos,
    resolutions: resoluciones,
    activeMembers: activos,
  });

  return `🌡️ ${v.band} (score ${v.score})`;
};

/** `/suavizar_sancion`: la misma sanción dicha sin humillar. */
export const calculadoraDeSancionSuavizada = (
  args: readonly string[],
): string => {
  const [accion, ...resto] = args;
  const esPublica = siONo(resto.join(" "));
  if (!accion || esPublica === undefined) {
    return "Uso: /suavizar_sancion <acción> <publico si|no>";
  }

  return softenSanctionMessage({ action: accion, public: esPublica }).message;
};

/** `/uso_indebido_topic`: si un mensaje esta fuera del tema de su topic. */
export const calculadoraDeUsoIndebidoDeTopic = (
  args: readonly string[],
): string => {
  const [texto, delTemaCrudo, fueraDeTemaCrudo] = args.join(" ").split("|");
  if (!texto?.trim()) {
    return "Uso: /uso_indebido_topic <texto>|<palabras_tema>|<palabras_fuera_tema>";
  }

  const palabras = (crudo: string | undefined): string[] =>
    (crudo ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

  const v = detectTopicMisuse({
    text: texto.trim(),
    topicKeywords: palabras(delTemaCrudo),
    offTopicKeywords: palabras(fueraDeTemaCrudo),
  });

  return v.misused
    ? `⚠️ Uso indebido: ${v.hits.join(", ")}`
    : "Uso correcto del topic.";
};

/** `/comparar_grupos_gemelos`: dos grupos parecidos, metrica a metrica. */
export const calculadoraDeComparacionDeGemelos = (
  args: readonly string[],
): string => {
  const a = paresClaveValor(args[0]);
  const b = paresClaveValor(args[1]);
  if (Object.keys(a).length === 0 || Object.keys(b).length === 0) {
    return "Uso: /comparar_grupos_gemelos <k1=v1,k2=v2> <k1=v1,k2=v2>";
  }

  return compareTwinGroups(a, b)
    .map((c) => `${c.metric}: ${c.aValue} vs ${c.bValue} (líder: ${c.leader})`)
    .join("\n");
};

/**
 * `/rompehielo`: una pregunta para empezar a hablar.
 *
 * La semilla la pone quien llama —el nucleo pasa el `updateId`— para que un
 * reintento del mismo update devuelva la MISMA pregunta. Con un aleatorio de
 * verdad, reintentar un update daria una pregunta distinta cada vez.
 */
export const calculadoraDeRompehielo = (
  args: readonly string[],
  semilla: number,
): string => {
  const tema = (args[0] ?? "").toLowerCase();
  if (!tema) {
    return `Uso: /rompehielo <tema>. Temas: ${listIcebreakerTopics().join(", ")}`;
  }
  if (!isIcebreakerTopic(tema)) {
    return `Tema desconocido. Usa uno de: ${listIcebreakerTopics().join(", ")}.`;
  }

  return `🧊 ${pickIcebreaker(tema, semilla)}`;
};

import {
  decimalDelArgumento,
  enteroDelArgumento,
  siONo,
  tresEnteros,
} from "@superbot/shared";

import { verifyAntiBotChallenge } from "../../anti-bot-check.js";
import { computeAntiToxicityReward } from "../../anti-toxicity-reward.js";
import { computeBossProgress } from "../../boss-progress.js";
import { computeCollectiveReward } from "../../collective-rewards.js";
import { canPurchaseCosmetic } from "../../cosmetic-shop.js";
import { checkDailyQuota } from "../../daily-quota.js";
import { resolveDebateDuel } from "../../debate-duel.js";
import { applyDoubleRep } from "../../double-rep.js";
import { computeDynamicCooldownMs } from "../../dynamic-cooldown.js";
import { spendEnergy } from "../../energy-system.js";
import { decideGameSanction } from "../../game-sanctions.js";
import { detectImpossiblePattern } from "../../impossible-patterns.js";
import { awardLegendaryItems } from "../../legendary-items.js";
import { buildMemberCard } from "../../member-cards.js";
import { detectNegativeAchievements } from "../../negative-achievements.js";
import { computePrestige } from "../../prestige.js";
import { evaluateSecretAchievements } from "../../secret-achievements.js";
import { evaluateStreakAchievements } from "../../streak-achievements.js";

/**
 * Las dieciocho calculadoras de juego de `/utility_plus`.
 *
 * Todas tienen la misma forma —parsear, rendirse con el uso si no encaja,
 * calcular y dar formato— y ninguna toca la base ni Telegram. El parseo estaba
 * escrito a mano dieciocho veces; aqui viene de `@superbot/shared`, que es
 * donde tiene que estar porque lo usan varios módulos y un módulo no puede
 * importar a otro.
 */

/** `/prueba_antibot`: si quien contesta el reto responde como una persona. */
export const calculadoraDePruebaAntibot = (args: readonly string[]): string => {
  const [respuesta, esperada] = args;
  const ms = enteroDelArgumento(args[2]);
  if (!respuesta || !esperada || ms === null) {
    return "Uso: /prueba_antibot <respuesta> <esperada> <ms>";
  }

  const v = verifyAntiBotChallenge({
    answer: respuesta,
    expected: esperada,
    responseMs: ms,
  });

  return v.human ? `✅ ${v.reason}` : `🤖 ${v.reason}`;
};

/** `/racha_sin_sancion`: el premio por llevar dias sin que te sancionen. */
export const calculadoraDeRachaSinSancion = (
  args: readonly string[],
): string => {
  const dias = enteroDelArgumento(args[0]);
  if (dias === null) {
    return "Uso: /racha_sin_sancion <días>";
  }

  return computeAntiToxicityReward(dias).message;
};

/** `/progreso_boss`: cuanto queda para tumbar al jefe del grupo. */
export const calculadoraDeProgresoDeBoss = (
  args: readonly string[],
): string => {
  const hecho = enteroDelArgumento(args[0]);
  const meta = enteroDelArgumento(args[1]);
  if (hecho === null || meta === null) {
    return "Uso: /progreso_boss <hecho> <meta>";
  }

  const v = computeBossProgress({ done: hecho, goal: meta });

  return `👹 ${v.percent}% · ${v.defeated ? "derrotado" : `faltan ${v.remaining}`}`;
};

/** `/recompensa_colectiva`: el premio de grupo por mejorar entre todos. */
export const calculadoraDeRecompensaColectiva = (
  args: readonly string[],
): string => {
  const mejora = decimalDelArgumento(args[0]);
  if (mejora === null) {
    return "Uso: /recompensa_colectiva <mejora>";
  }

  return computeCollectiveReward({ improvement: mejora }).message;
};

/** `/comprar_cosmetico`: si el saldo llega para el cosmetico. */
export const calculadoraDeCompraDeCosmetico = (
  args: readonly string[],
): string => {
  const saldo = decimalDelArgumento(args[0]);
  const precio = decimalDelArgumento(args[1]);
  if (saldo === null || precio === null) {
    return "Uso: /comprar_cosmetico <saldo> <precio>";
  }

  const v = canPurchaseCosmetic({ balance: saldo, price: precio });

  return v.affordable
    ? `✅ Puedes comprarlo. Saldo restante: ${v.remaining}`
    : `❌ Saldo insuficiente. Te faltan ${precio - saldo}.`;
};

/** `/cupo_diario`: si queda cupo para hoy. */
export const calculadoraDeCupoDiario = (args: readonly string[]): string => {
  const hechoHoy = enteroDelArgumento(args[0]);
  const tope = enteroDelArgumento(args[1]);
  if (hechoHoy === null || tope === null) {
    return "Uso: /cupo_diario <hecho_hoy> <tope>";
  }

  return checkDailyQuota({ doneToday: hechoHoy, cap: tope }).message;
};

/** `/duelo_debate`: quien gana un duelo de argumentos por votos. */
export const calculadoraDeDueloDeDebate = (args: readonly string[]): string => {
  const votosA = enteroDelArgumento(args[0]);
  const votosB = enteroDelArgumento(args[1]);
  if (votosA === null || votosB === null) {
    return "Uso: /duelo_debate <votosA> <votosB>";
  }

  const v = resolveDebateDuel({ votesA: votosA, votesB: votosB });

  return `🎤 Ganador: ${v.winner} (margen ${v.margin})`;
};

/** `/doble_rep`: los puntos de reputación con el evento de doble en marcha. */
export const calculadoraDeDobleReputacion = (
  args: readonly string[],
): string => {
  const puntosBase = enteroDelArgumento(args[0]);
  const esUtil = siONo(args[1]);
  const eventoActivo = siONo(args[2]);
  if (
    puntosBase === null ||
    esUtil === undefined ||
    eventoActivo === undefined
  ) {
    return "Uso: /doble_rep <puntos_base> <útil si|no> <evento_activo si|no>";
  }

  const v = applyDoubleRep({
    basePoints: puntosBase,
    isUsefulAction: esUtil,
    eventActive: eventoActivo,
  });

  return `⭐ ${v.points} puntos${v.doubled ? " (doblados)" : ""}`;
};

/** `/cooldown_dinamico`: cuanto hay que esperar segun cuanto se abuse. */
export const calculadoraDeCooldownDinamico = (
  args: readonly string[],
): string => {
  const abuso = decimalDelArgumento(args[0]);
  if (abuso === null) {
    return "Uso: /cooldown_dinamico <abuso_score>";
  }

  return `⏱️ Cooldown: ${Math.round(computeDynamicCooldownMs({ abuseScore: abuso }) / 1000)}s`;
};

/** `/gastar_energia`: si queda energia para la accion. */
export const calculadoraDeGastoDeEnergia = (
  args: readonly string[],
): string => {
  const actual = decimalDelArgumento(args[0]);
  const coste = decimalDelArgumento(args[1]);
  const maximo = decimalDelArgumento(args[2]);
  if (actual === null || coste === null || maximo === null) {
    return "Uso: /gastar_energia <actual> <coste> <máximo>";
  }

  const v = spendEnergy({ current: actual, cost: coste, max: maximo });

  return v.allowed
    ? `⚡ Energía restante: ${v.remaining}`
    : `❌ Energía insuficiente. Restante: ${v.remaining}`;
};

/** `/sancion_juego`: qué sanción toca por abusar del juego. */
export const calculadoraDeSancionDeJuego = (
  args: readonly string[],
): string => {
  const abuso = decimalDelArgumento(args[0]);
  if (abuso === null) {
    return "Uso: /sancion_juego <abuso_score>";
  }

  return `🎮 Sanción: ${decideGameSanction({ abuseScore: abuso }).sanction}`;
};

/** `/patron_imposible`: si los numeros de alguien no los hace una persona. */
export const calculadoraDePatronImposible = (
  args: readonly string[],
): string => {
  const victorias = enteroDelArgumento(args[0]);
  const partidas = enteroDelArgumento(args[1]);
  const reaccionMs = decimalDelArgumento(args[2]);
  if (victorias === null || partidas === null || reaccionMs === null) {
    return "Uso: /patron_imposible <victorias> <partidas> <reaccion_ms_promedio>";
  }

  const v = detectImpossiblePattern({
    wins: victorias,
    plays: partidas,
    avgReactionMs: reaccionMs,
  });

  return v.suspicious
    ? `🚨 Sospechoso: ${v.reasons.join(", ")}`
    : "✅ Patrón normal.";
};

/** `/items_legendarios`: los premios de los veteranos de verdad. */
export const calculadoraDeItemsLegendarios = (
  args: readonly string[],
): string => {
  const raids = enteroDelArgumento(args[0]);
  const anosActivo = decimalDelArgumento(args[1]);
  const esTopHelper = siONo(args[2]);
  if (raids === null || anosActivo === null || esTopHelper === undefined) {
    return "Uso: /items_legendarios <raids_sobrevividos> <anos_activo> <top_helper si|no>";
  }

  const items = awardLegendaryItems({
    raidsSurvived: raids,
    yearsActive: anosActivo,
    topHelper: esTopHelper,
  });

  return items.length > 0
    ? `🏆 ${items.join(", ")}`
    : "Sin ítems legendarios todavía.";
};

/** `/carta_miembro`: la carta coleccionable de alguien del grupo. */
export const calculadoraDeCartaDeMiembro = (
  args: readonly string[],
): string => {
  const numeros = tresEnteros(args);
  if (numeros === null) {
    return "Uso: /carta_miembro <userId> <logros> <ayudas>";
  }

  const [userId, logros, ayudas] = numeros;
  const carta = buildMemberCard({
    userId,
    achievements: logros,
    helps: ayudas,
  });

  return `🃏 Rango: ${carta.rank} · Poder: ${carta.power}`;
};

/** `/logros_negativos`: las señales de que alguien juega como una maquina. */
export const calculadoraDeLogrosNegativos = (
  args: readonly string[],
): string => {
  const numeros = tresEnteros(args);
  if (numeros === null) {
    return "Uso: /logros_negativos <partidas_rapidas> <acciones_identicas> <grind_nocturno>";
  }

  const [rapidas, identicas, nocturno] = numeros;
  const marcas = detectNegativeAchievements({
    rapidPlays: rapidas,
    identicalActions: identicas,
    nightGrind: nocturno,
  });

  return marcas.length > 0 ? marcas.join(", ") : "Sin señales negativas.";
};

/** `/prestigio`: si toca ascender de prestigio. */
export const calculadoraDePrestigio = (args: readonly string[]): string => {
  const nivel = enteroDelArgumento(args[0]);
  const prestigio = enteroDelArgumento(args[1]);
  if (nivel === null || prestigio === null) {
    return "Uso: /prestigio <nivel> <prestigio_actual>";
  }

  const v = computePrestige({ level: nivel, prestige: prestigio });

  return v.canPrestige
    ? `✨ Puede ascender a prestigio: ${v.title}`
    : `Nivel actual: ${v.title}`;
};

/** `/logros_secretos`: los logros que no estan en ninguna lista. */
export const calculadoraDeLogrosSecretos = (
  args: readonly string[],
): string => {
  const numeros = tresEnteros(args);
  if (numeros === null) {
    return "Uso: /logros_secretos <ayudas> <mensajes_noche> <dias_limpios>";
  }

  const [ayudas, mensajesDeNoche, diasLimpios] = numeros;
  const items = evaluateSecretAchievements({
    helps: ayudas,
    nightMessages: mensajesDeNoche,
    cleanDays: diasLimpios,
  });

  return items.length > 0
    ? items.map((item) => item.title).join(", ")
    : "Sin logros secretos todavía.";
};

/** `/logros_racha`: los logros por dias seguidos. */
export const calculadoraDeLogrosDeRacha = (args: readonly string[]): string => {
  const dias = enteroDelArgumento(args[0]);
  if (dias === null) {
    return "Uso: /logros_racha <días>";
  }

  const items = evaluateStreakAchievements(dias);

  return items.length > 0
    ? items.map((item) => item.title).join(", ")
    : "Sin logros de racha todavía.";
};

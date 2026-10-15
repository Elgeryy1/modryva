import {
  buildActivityHeatmap,
  formatHeatmap,
  peakHour,
} from "../../activity-heatmap.js";
import { detectDogpiling } from "../../dogpiling.js";
import { suggestQuietVoices } from "../../monopoly-balance.js";
import {
  detectMonopoly,
  participationGini,
} from "../../participation-balance.js";
import { detectReactionAbuse } from "../../reaction-abuse.js";

/**
 * Los tres informes de staff sobre la actividad del grupo.
 *
 * Los tres salen de los mismos mensajes recientes. En el nucleo eran tres casos
 * de un `switch` de 25, cada uno con su consulta y su texto pegado dentro.
 *
 * **El nombre de cada persona lo resuelve quien llama.** Se le pasa un
 * `nombreDe` en vez de dejar que el módulo mire la base: traducir un id a un
 * `@usuario` es traduccion, y eso es trabajo del nucleo. Ademas asi estos tres
 * informes se prueban sin inventarse un repositorio.
 */

const UNA_HORA_MS = 60 * 60 * 1000;

/** Un mensaje reciente, con lo que estos tres necesitan. */
export interface ActividadDeMensaje {
  readonly autorId: string | undefined;
  /** A quien respondia, si respondia a alguien. */
  readonly respondeAId: string | undefined;
  readonly texto: string;
  readonly enMs: number;
}

/** Traduce un id a como se le enseña a una persona. */
export type NombreDe = (id: string) => string;

/**
 * `/mapa_calor`: a que horas habla el grupo.
 *
 * El desfase horario entra por parametro porque el grupo no tiene por que
 * vivir en UTC — es el mismo problema que C-24, aqui ya resuelto.
 */
export const informeDeMapaDeCalor = (
  mensajes: readonly ActividadDeMensaje[],
  desfaseMinutos: number,
): string => {
  if (mensajes.length === 0) {
    return "Aún no hay actividad registrada para el mapa de calor.";
  }

  const mapa = buildActivityHeatmap(
    mensajes.map((m) => m.enMs),
    desfaseMinutos,
  );
  const zona =
    desfaseMinutos === 0
      ? "UTC"
      : `UTC${desfaseMinutos > 0 ? "+" : "-"}${Math.abs(desfaseMinutos) / 60}h`;

  return `🕒 Mapa de calor · ${mensajes.length} mensajes · ${zona}\n${formatHeatmap(mapa)}\nHora punta: ${peakHour(mapa)}:00`;
};

/** `/participacion`: quien acapara la charla y quien no habla. */
export const informeDeParticipacion = (
  mensajes: readonly ActividadDeMensaje[],
  nombreDe: NombreDe,
): string => {
  const cuentas = new Map<string, number>();
  for (const m of mensajes) {
    if (m.autorId === undefined) continue;
    cuentas.set(m.autorId, (cuentas.get(m.autorId) ?? 0) + 1);
  }

  if (cuentas.size === 0) {
    return "Aún no hay actividad para medir la participación.";
  }

  const stats = [...cuentas.entries()].map(([userId, messages]) => ({
    userId,
    messages,
  }));

  const lineas = [
    `⚖️ Participación · ${stats.length} personas · ${mensajes.length} mensajes`,
    `Desigualdad (Gini): ${Math.round(participationGini(stats) * 100)}%`,
  ];

  const acapara = detectMonopoly(stats, 0.4);
  if (acapara.monopolized && acapara.userId !== undefined) {
    lineas.push(
      `Acapara la charla: ${nombreDe(acapara.userId)} (${Math.round(acapara.share * 100)}%)`,
    );
  }

  const calladas = suggestQuietVoices(stats, 3);
  if (calladas.length > 0) {
    lineas.push(`Voces más calladas: ${calladas.map(nombreDe).join(", ")}`);
  }

  return lineas.join("\n");
};

/**
 * `/senal_acoso`: varias personas respondiendo a la misma en poco rato.
 *
 * El reloj entra por parametro: la ventana es de una hora y sin inyectarlo no
 * hay forma de probar "hace media hora" contra "hace dos".
 */
export const informeDeSenalDeAcoso = (
  mensajes: readonly ActividadDeMensaje[],
  ahoraMs: number,
  nombreDe: NombreDe,
): string => {
  const respuestas = mensajes
    .filter(
      (m): m is ActividadDeMensaje & { autorId: string; respondeAId: string } =>
        m.autorId !== undefined && m.respondeAId !== undefined,
    )
    .map((m) => ({ fromId: m.autorId, toId: m.respondeAId, ms: m.enMs }));

  if (respuestas.length === 0) {
    return "No hay respuestas recientes para analizar acoso grupal.";
  }

  const senalados: string[] = [];
  for (const contra of new Set(respuestas.map((r) => r.toId))) {
    const r = detectDogpiling(contra, respuestas, UNA_HORA_MS, ahoraMs);
    if (r.piling) {
      senalados.push(`${nombreDe(contra)}: ${r.attackers} usuarios distintos`);
    }
  }

  return senalados.length > 0
    ? `⚠️ Posible acoso grupal (última hora):\n${senalados.join("\n")}`
    : "🕊️ Sin señales de acoso grupal en la última hora.";
};

/** Emojis que cuentan como reaccion negativa. */
const EMOJIS_NEGATIVOS = ["👎", "🤡", "💩", "🤮", "🖕", "😡"];

/**
 * `/reaccion_abuso`: varias reacciones negativas contra la misma persona en
 * poco rato.
 *
 * La lista de emojis vive aqui y no en el nucleo: que cuenta como reaccion
 * negativa es una decision del módulo, y estaba escrita dentro del `case` como
 * una variable local.
 */
export const informeDeAbusoDeReacciones = (
  reacciones: readonly ActividadDeMensaje[],
  ahoraMs: number,
  nombreDe: NombreDe,
): string => {
  const utiles = reacciones
    .filter(
      (r): r is ActividadDeMensaje & { autorId: string } =>
        r.autorId !== undefined && r.texto.length > 0,
    )
    .map((r) => ({
      targetMsgAuthorId: r.autorId,
      emoji: r.texto,
      ms: r.enMs,
    }));

  if (utiles.length === 0) {
    return "No hay reacciones registradas todavía.";
  }

  const r = detectReactionAbuse(utiles, UNA_HORA_MS, ahoraMs, EMOJIS_NEGATIVOS);

  return r.abused && r.targetId !== undefined
    ? `🎭 Oleada de reacciones negativas contra ${nombreDe(r.targetId)}: ${r.count} en la última hora.`
    : "🕊️ Sin oleadas de reacciones negativas en la última hora.";
};

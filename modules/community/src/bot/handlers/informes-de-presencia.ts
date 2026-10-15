import { detectDormantMembers } from "../../dormant-members.js";
import { findGhostMembers } from "../../ghost-members.js";
import { computeSilenceCurve } from "../../silence-curve.js";

/**
 * Los dos informes de staff sobre quien esta y quien no habla.
 *
 * `fantasmas` era el caso mas largo del `switch` de informes: 88 lineas, y de
 * ellas ~60 eran agregacion a mano —tres `Map` construidos a base de bucles con
 * su comprobacion de minimo y de maximo— antes de llegar a la decision.
 *
 * El reloj entra por parametro en los dos: uno mide "hace mas de 24 horas" y el
 * otro "lleva N dias sin aparecer", y sin inyectarlo no hay forma de probarlos.
 */

const UN_DIA_MS = 24 * 60 * 60 * 1000;
const CUANTOS_FANTASMAS_SE_NOMBRAN = 15;
const CUANTOS_INACTIVOS_SE_NOMBRAN = 10;

/** Un evento con autor y momento: una entrada al grupo o un mensaje. */
export interface EventoConAutor {
  readonly autorId: string | undefined;
  readonly enMs: number;
}

/** Traduce un id a como se le enseña a una persona. */
export type NombreDe = (id: string) => string;

/**
 * El primer momento de cada persona.
 *
 * Los dos informes necesitan agregar por autor quedandose con un extremo, y el
 * bucle estaba escrito tres veces con la comparacion cambiada. Aqui va una vez,
 * con el criterio como parametro.
 */
const extremoPorAutor = (
  eventos: readonly EventoConAutor[],
  quedarse: "primero" | "ultimo",
): Map<string, number> => {
  const porAutor = new Map<string, number>();
  for (const evento of eventos) {
    if (evento.autorId === undefined) continue;
    const visto = porAutor.get(evento.autorId);
    const mejora =
      visto === undefined ||
      (quedarse === "primero" ? evento.enMs < visto : evento.enMs > visto);
    if (mejora) porAutor.set(evento.autorId, evento.enMs);
  }
  return porAutor;
};

/**
 * `/fantasmas`: quien entro y nunca escribio.
 *
 * Ademas de la lista, la curva de silencio — cuantos de los que entraron
 * llegaron a hablar y cuanto tardaron. Sin ese segundo dato, "hay 40
 * fantasmas" no dice si es mucho o poco.
 */
export const informeDeFantasmas = (
  entradas: readonly EventoConAutor[],
  mensajes: readonly EventoConAutor[],
  ahoraMs: number,
  nombreDe: NombreDe,
): string => {
  const entroEn = extremoPorAutor(entradas, "primero");
  if (entroEn.size === 0) {
    return "No hay entradas de miembros registradas todavía.";
  }

  const primerMensaje = extremoPorAutor(mensajes, "primero");
  const cuantosMensajes = new Map<string, number>();
  for (const m of mensajes) {
    if (m.autorId === undefined) continue;
    cuantosMensajes.set(m.autorId, (cuantosMensajes.get(m.autorId) ?? 0) + 1);
  }

  const miembros = [...entroEn.entries()].map(([userId, joinedMs]) => {
    const primero = primerMensaje.get(userId);
    return {
      userId,
      joinedMs,
      messages: cuantosMensajes.get(userId) ?? 0,
      ...(primero !== undefined ? { firstMessageMs: primero } : {}),
    };
  });

  const fantasmas = findGhostMembers(miembros, ahoraMs, UN_DIA_MS);
  const curva = computeSilenceCurve(
    miembros.map((m) => ({
      joinMs: m.joinedMs,
      firstMessageMs: m.firstMessageMs,
    })),
  );

  const lineas: string[] = [];
  if (fantasmas.length === 0) {
    lineas.push("👻 Sin miembros fantasma (24h+ sin escribir).");
  } else {
    lineas.push(
      `👻 Fantasmas (entraron hace +24h, 0 mensajes): ${fantasmas.length}`,
    );
    lineas.push(
      fantasmas.slice(0, CUANTOS_FANTASMAS_SE_NOMBRAN).map(nombreDe).join(", "),
    );
  }

  if (curva.participatedCount > 0) {
    const minutos = Math.round(curva.medianDelayMs / 60_000);
    const total = curva.participatedCount + curva.neverSpokeCount;
    lineas.push(
      `🗣️ Hablaron ${curva.participatedCount} de ${total} · mediana hasta el 1er mensaje: ${minutos} min`,
    );
  }

  return lineas.join("\n");
};

/** `/miembros_inactivos`: quien lleva tiempo sin aparecer. */
export const informeDeMiembrosInactivos = (
  mensajes: readonly EventoConAutor[],
  ahoraMs: number,
  nombreDe: NombreDe,
): string => {
  const ultimaVez = extremoPorAutor(mensajes, "ultimo");

  const dormidos = detectDormantMembers(
    [...ultimaVez.entries()].map(([userId, lastActiveMs]) => ({
      userId,
      lastActiveMs,
    })),
    ahoraMs,
  );

  if (dormidos.length === 0) {
    return "Sin miembros inactivos detectados en la ventana reciente.";
  }

  const lineas = dormidos
    .slice(0, CUANTOS_INACTIVOS_SE_NOMBRAN)
    .map(
      (m) =>
        `${nombreDe(m.userId)}: ${Math.floor(m.idleMs / UN_DIA_MS)}d inactivo`,
    );

  return `😴 Miembros inactivos:\n${lineas.join("\n")}`;
};

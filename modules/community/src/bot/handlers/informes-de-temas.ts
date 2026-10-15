import { detectCrossposting } from "../../crossposting.js";
import {
  detectDeadTopics,
  detectEmergingTopics,
} from "../../emerging-topics.js";
import { detectIdleTopics } from "../../idle-topics.js";

/**
 * Los tres informes de staff sobre temas de foro.
 *
 * Los tres salen de los mismos mensajes recientes y los tres empiezan
 * descartando lo que no tiene tema. En el nucleo eran tres casos de un `switch`
 * de 25, cada uno con su consulta, su bucle de agregacion y su texto pegado
 * dentro.
 *
 * **El reloj entra por parametro.** Dos de ellos comparaban con `Date.now()`
 * dentro de la logica, asi que no habia forma de probar "hace 25 horas" contra
 * "hace tres dias" sin tocar el reloj del proceso.
 */

const UN_DIA_MS = 24 * 60 * 60 * 1000;

/** Un mensaje de un tema de foro. */
export interface MensajeConTema {
  readonly temaId: string;
  readonly texto: string;
  readonly enMs: number;
}

/** `/crossposting`: el mismo mensaje repetido en varios temas. */
export const informeDeCrossposting = (
  mensajes: readonly MensajeConTema[],
): string => {
  const conTexto = mensajes.filter((m) => m.texto.length > 0);
  if (conTexto.length === 0) {
    return "No hay mensajes con tema de foro para analizar crossposting.";
  }

  const informe = detectCrossposting(
    conTexto.map((m) => ({ topicId: Number(m.temaId), text: m.texto })),
  );
  if (!informe.matched) {
    return "🧼 Sin crossposting entre temas detectado.";
  }

  const lineas = informe.duplicates.slice(0, 10).map((d) => {
    const muestra =
      d.sample.length > 40 ? `${d.sample.slice(0, 40)}…` : d.sample;
    return `"${muestra}" en ${d.topics.length} temas`;
  });
  return `♻️ Crossposting entre temas:\n${lineas.join("\n")}`;
};

/**
 * `/temas_emergentes`: que temas despegan y cuales se apagan.
 *
 * Compara las ultimas 24 h con las 24 anteriores. Los mensajes del futuro se
 * descartan: un reloj mal puesto en un cliente no puede inventar actividad.
 */
export const informeDeTemasEmergentes = (
  mensajes: readonly MensajeConTema[],
  ahoraMs: number,
): string => {
  const recientes = new Map<string, number>();
  const anteriores = new Map<string, number>();

  for (const m of mensajes) {
    const edad = ahoraMs - m.enMs;
    if (edad < 0) continue;
    if (edad <= UN_DIA_MS) {
      recientes.set(m.temaId, (recientes.get(m.temaId) ?? 0) + 1);
    } else if (edad <= UN_DIA_MS * 2) {
      anteriores.set(m.temaId, (anteriores.get(m.temaId) ?? 0) + 1);
    }
  }

  const temas = new Set([...recientes.keys(), ...anteriores.keys()]);
  if (temas.size === 0) {
    return "No hay actividad por temas en las últimas 48h.";
  }

  const cuentas = [...temas].map((topic) => ({
    topic,
    recent: recientes.get(topic) ?? 0,
    previous: anteriores.get(topic) ?? 0,
  }));

  const lineas: string[] = [];
  const suben = detectEmergingTopics(cuentas, 2);
  const bajan = detectDeadTopics(cuentas);
  if (suben.length > 0) {
    lineas.push(`📈 Emergentes: ${suben.map((t) => `tema ${t}`).join(", ")}`);
  }
  if (bajan.length > 0) {
    lineas.push(`📉 Se apagaron: ${bajan.map((t) => `tema ${t}`).join(", ")}`);
  }

  return lineas.length > 0
    ? lineas.join("\n")
    : "Sin temas emergentes ni apagados en las últimas 48h.";
};

/** `/temas_inactivos`: temas que llevan dias sin nadie. */
export const informeDeTemasInactivos = (
  mensajes: readonly MensajeConTema[],
  ahoraMs: number,
  dias: number,
): string => {
  const ultimaPorTema = new Map<string, number>();
  for (const m of mensajes) {
    const previa = ultimaPorTema.get(m.temaId);
    if (previa === undefined || m.enMs > previa) {
      ultimaPorTema.set(m.temaId, m.enMs);
    }
  }

  if (ultimaPorTema.size === 0) {
    return "No hay actividad por temas registrada (¿el grupo usa temas de foro?).";
  }

  const apagados = detectIdleTopics(
    [...ultimaPorTema.entries()].map(([id, lastActivityMs]) => ({
      id,
      lastActivityMs,
    })),
    ahoraMs,
    { deadAfterMs: dias * UN_DIA_MS },
  );

  if (apagados.length === 0) {
    return `🌿 Ningún tema lleva ${dias}+ días inactivo.`;
  }

  const lineas = apagados
    .slice(0, 15)
    .map((t) => `tema ${t.id}: ${Math.floor(t.idleMs / UN_DIA_MS)}d inactivo`);
  return `🪦 Temas inactivos (${dias}+ días):\n${lineas.join("\n")}`;
};

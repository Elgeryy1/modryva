/**
 * El puente entre los detectores de estafa y una decisión.
 *
 * `scam-signals.ts` tenía siete detectores escritos y probados, y `signals.ts`
 * el motor que suma pesos y los mapea a una acción. Ninguno de los dos lo
 * llamaba nadie: eran dos mitades de una función que no existía. Esto es esa
 * función, y es lo único que hacía falta para que el bot mire los mensajes.
 *
 * Puro y determinista: sin reloj, sin red, sin base de datos.
 */

import { detectScamSignals, type ScamMessage } from "./scam-signals.js";
import { type SignalScoreResult, scoreSignals } from "./signals.js";

/**
 * Dominios que aparecen en un texto.
 *
 * Los detectores necesitan la lista de dominios aparte del texto, y hasta ahora
 * nadie la construía. Se aceptan URLs con y sin esquema porque una estafa rara
 * vez escribe `https://`: escribe `bit.ly/x` a secas.
 */
export const extractDomains = (text: string): string[] => {
  const encontrados: string[] = [];
  const re =
    /(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)/giu;
  for (const m of text.matchAll(re)) {
    const dominio = m[1]?.toLowerCase();
    // Un TLD de una letra no existe; esto descarta "algo.a" y los decimales
    // ("3.5") que si no entrarían como dominio y ensuciarían el recuento de
    // acortadores encadenados.
    if (!dominio || !/\.[a-z]{2,}$/u.test(dominio)) {
      continue;
    }
    if (!encontrados.includes(dominio)) {
      encontrados.push(dominio);
    }
  }
  return encontrados;
};

export interface ScamVerdict extends SignalScoreResult {
  /** Los detalles legibles de lo que disparó, para el aviso al STAFF. */
  readonly detalles: readonly string[];
}

/**
 * Analiza un mensaje y devuelve qué disparó, cuánto pesa y qué acción sugiere.
 *
 * `isFirstMessage` y `bio` existen en `ScamMessage` pero NINGÚN detector los
 * lee — se comprobó uno por uno. Por eso no se inventan aquí: aproximarlos
 * («primer mensaje» desde una caché en memoria que un reinicio vacía) habría
 * metido una fuente de falsos positivos a cambio de exactamente nada.
 */
export const judgeScam = (input: {
  readonly text: string;
  readonly hasUrl: boolean;
  readonly username?: string | undefined;
}): ScamVerdict => {
  const msg: ScamMessage = {
    text: input.text,
    hasUrl: input.hasUrl,
    domains: extractDomains(input.text),
    ...(input.username !== undefined ? { username: input.username } : {}),
    isFirstMessage: false,
  };
  const señales = detectScamSignals(msg);
  const puntuado = scoreSignals(señales);
  return {
    ...puntuado,
    detalles: señales
      .filter((s) => s.present && s.detail !== undefined)
      .map((s) => `${s.key}: ${s.detail}`),
  };
};

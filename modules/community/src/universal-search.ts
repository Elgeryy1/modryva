/**
 * Busqueda universal con comandos humanos. Traduce frases naturales en espanol
 * como "silenciar links una hora" a una intencion estructurada, sin depender de
 * la sintaxis rigida de `/comando`. Logica pura y determinista: no hace I/O,
 * no accede a red ni reloj; recibe el texto plano y devuelve el resultado.
 */

/** Accion inferida a partir del verbo dominante de la frase. */
export type HumanCommandAction = "lock" | "mute" | "unlock" | "unknown";

/**
 * Resultado del parseo heuristico. `target` y `durationMs` solo aparecen cuando
 * la frase los expresa (respetando exactOptionalPropertyTypes).
 */
export interface HumanCommand {
  readonly action: HumanCommandAction;
  readonly target?: string;
  readonly durationMs?: number;
}

const MS_SECOND = 1000;
const MS_MINUTE = 60 * MS_SECOND;
const MS_HOUR = 60 * MS_MINUTE;
const MS_DAY = 24 * MS_HOUR;
const MS_WEEK = 7 * MS_DAY;

/** Verbo -> accion. Se compara por token exacto para que "desbloquear" no
 * colisione con "bloquear" (rule: las frases no se solapan entre si). */
const ACTIONS: ReadonlyMap<string, HumanCommandAction> = new Map([
  ["silenciar", "mute"],
  ["silencia", "mute"],
  ["mutear", "mute"],
  ["muta", "mute"],
  ["callar", "mute"],
  ["bloquear", "lock"],
  ["bloquea", "lock"],
  ["cerrar", "lock"],
  ["prohibir", "lock"],
  ["desbloquear", "unlock"],
  ["desbloquea", "unlock"],
  ["desilenciar", "unlock"],
  ["desmutear", "unlock"],
  ["abrir", "unlock"],
  ["permitir", "unlock"],
]);

/** Tipo de contenido -> destino canonico. "media" se omite a proposito para no
 * chocar con el numeral "media" (= 0.5) de "media hora". */
const TARGETS: ReadonlyMap<string, string> = new Map([
  ["links", "links"],
  ["link", "links"],
  ["enlaces", "links"],
  ["enlace", "links"],
  ["url", "links"],
  ["urls", "links"],
  ["multimedia", "media"],
  ["fotos", "media"],
  ["foto", "media"],
  ["imagenes", "media"],
  ["imagen", "media"],
  ["videos", "media"],
  ["video", "media"],
  ["stickers", "stickers"],
  ["sticker", "stickers"],
  ["pegatinas", "stickers"],
  ["gifs", "gifs"],
  ["gif", "gifs"],
  ["audios", "audio"],
  ["audio", "audio"],
  ["voz", "audio"],
  ["voces", "audio"],
  ["reenvios", "forwards"],
  ["reenvio", "forwards"],
  ["forward", "forwards"],
  ["forwards", "forwards"],
  ["todo", "all"],
  ["chat", "all"],
  ["grupo", "all"],
]);

/** Numerales escritos. "media" vale 0.5 para soportar "media hora". */
const NUMBERS: ReadonlyMap<string, number> = new Map([
  ["un", 1],
  ["una", 1],
  ["uno", 1],
  ["dos", 2],
  ["tres", 3],
  ["cuatro", 4],
  ["cinco", 5],
  ["seis", 6],
  ["siete", 7],
  ["ocho", 8],
  ["nueve", 9],
  ["diez", 10],
  ["quince", 15],
  ["veinte", 20],
  ["treinta", 30],
  ["media", 0.5],
]);

/** Unidad de tiempo -> milisegundos. */
const UNITS: ReadonlyMap<string, number> = new Map([
  ["segundo", MS_SECOND],
  ["segundos", MS_SECOND],
  ["minuto", MS_MINUTE],
  ["minutos", MS_MINUTE],
  ["min", MS_MINUTE],
  ["mins", MS_MINUTE],
  ["hora", MS_HOUR],
  ["horas", MS_HOUR],
  ["dia", MS_DAY],
  ["dias", MS_DAY],
  ["semana", MS_WEEK],
  ["semanas", MS_WEEK],
]);

/**
 * Normaliza y trocea el texto: minusculas, sin acentos, cortando por cualquier
 * caracter que no sea alfanumerico. Determinista.
 */
const tokenize = (text: string): string[] => {
  const normalized = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return normalized.split(/[^a-z0-9]+/).filter((tok) => tok.length > 0);
};

/** Cantidad de un token: digitos tal cual, numeral escrito, o 1 por defecto. */
const parseQuantity = (token: string): number => {
  if (/^\d+$/.test(token)) {
    return Number(token);
  }
  return NUMBERS.get(token) ?? 1;
};

/**
 * Parsea una frase humana a `{ action, target?, durationMs? }`. Toma, por
 * posicion, la primera palabra que casa con cada categoria (verbo, tipo y
 * duracion), de modo que "silenciar y bloquear" es `mute`. Sin verbo conocido
 * la accion es "unknown". Puro y determinista.
 */
export const parseHumanCommand = (text: string): HumanCommand => {
  const tokens = tokenize(text);

  let action: HumanCommandAction = "unknown";
  let target: string | undefined;
  let durationMs: number | undefined;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === undefined) {
      continue;
    }

    if (action === "unknown") {
      const matchedAction = ACTIONS.get(token);
      if (matchedAction !== undefined) {
        action = matchedAction;
      }
    }

    if (target === undefined) {
      const matchedTarget = TARGETS.get(token);
      if (matchedTarget !== undefined) {
        target = matchedTarget;
      }
    }

    if (durationMs === undefined) {
      const unitMs = UNITS.get(token);
      if (unitMs !== undefined) {
        const prev = tokens[i - 1];
        const quantity = prev !== undefined ? parseQuantity(prev) : 1;
        durationMs = Math.round(quantity * unitMs);
      }
    }
  }

  return {
    action,
    ...(target !== undefined ? { target } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
  };
};

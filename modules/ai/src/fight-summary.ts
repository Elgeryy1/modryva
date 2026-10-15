/**
 * Resumen heuristico de una pelea (ideas #11, #212) SIN IA real: a partir de las
 * lineas de una discusion identifica quien la empezo (primer mensaje con
 * insulto/provocacion), quienes participaron y cuantos insultos hubo, y arma un
 * resumen neutral para el staff. Funciona sin claves de proveedor. Logica pura:
 * sin I/O, sin reloj, sin azar.
 */

/** Una linea de chat de la discusion. `ms` es el epoch en que se envio. */
export interface ChatLine {
  readonly userId: string;
  readonly text: string;
  readonly ms: number;
}

/** Resultado del resumen. `starterId` solo aparece si se detecto un iniciador. */
export interface FightSummary {
  readonly participants: readonly string[];
  readonly insultCount: number;
  readonly text: string;
  readonly starterId?: string;
}

/** Palabras/senales (normalizadas) de insulto o provocacion. */
const HOSTILE_MARKERS: readonly string[] = [
  "idiota",
  "imbecil",
  "estupid",
  "gilipollas",
  "cabron",
  "puto",
  "puta",
  "mierda",
  "basura",
  "payaso",
  "callate",
  "callense",
  "eres un",
  "que asco",
  "vete a",
];

const normalize = (text: string): string =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** True si la linea contiene un marcador hostil. */
const isHostile = (text: string): boolean => {
  const haystack = normalize(text);
  return HOSTILE_MARKERS.some((marker) => haystack.includes(marker));
};

/**
 * Resume una discusion: `starterId` es el autor del primer mensaje hostil (por
 * orden de `lines`, que se asume cronologico), `participants` los autores unicos
 * en orden de aparicion, e `insultCount` el numero de lineas hostiles. `text` es
 * un resumen neutral en espanol. Pura y determinista.
 */
export const summarizeFight = (lines: readonly ChatLine[]): FightSummary => {
  const participants: string[] = [];
  const seen = new Set<string>();
  let insultCount = 0;
  let starterId: string | undefined;

  for (const line of lines) {
    if (!seen.has(line.userId)) {
      seen.add(line.userId);
      participants.push(line.userId);
    }
    if (isHostile(line.text)) {
      insultCount += 1;
      if (starterId === undefined) {
        starterId = line.userId;
      }
    }
  }

  const text =
    insultCount === 0
      ? `Sin señales de hostilidad entre ${participants.length} participante(s).`
      : `Discusión con ${insultCount} mensaje(s) hostil(es) entre ${participants.length} participante(s)${
          starterId !== undefined ? `; la inició ${starterId}` : ""
        }.`;

  return {
    participants,
    insultCount,
    text,
    ...(starterId !== undefined ? { starterId } : {}),
  };
};

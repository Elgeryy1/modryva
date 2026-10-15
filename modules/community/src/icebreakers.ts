/**
 * Icebreaker prompts grouped by topic for community engagement. Pure and
 * deterministic: selection derives from a caller-provided seed via an FNV-1a
 * hash, never Math.random. Question strings are user-facing (Spanish, with
 * accents); JSDoc stays accent-free and Spanish-neutral.
 */

/** Supported icebreaker topics. */
export type IcebreakerTopic =
  | "general"
  | "gaming"
  | "tech"
  | "musica"
  | "estudio";

/**
 * Readonly bank of icebreaker questions keyed by topic. Every topic maps to a
 * non-empty tuple of user-facing questions with correct accents.
 */
export const ICEBREAKER_BANK: Readonly<
  Record<IcebreakerTopic, readonly string[]>
> = {
  general: [
    "¿Con qué persona cenarías si pudieras elegir a cualquiera, viva o no?",
    "¿Cuál es la mejor decisión que has tomado este año?",
    "¿Qué habilidad te gustaría dominar si tuvieras tiempo ilimitado?",
    "¿Cuál es tu recuerdo más feliz de la infancia?",
    "Si te tocara la lotería mañana, ¿qué sería lo primero que harías?",
  ],
  gaming: [
    "¿Cuál es el videojuego que más horas te ha robado y no te arrepientes?",
    "¿Prefieres cooperativo o competitivo? ¿Y por qué?",
    "¿Cuál es el jefe final que más rabia te hizo pasar?",
    "¿Qué juego retro volverías a jugar hoy mismo?",
    "PC, consola o móvil: ¿cuál defiendes hasta el final?",
  ],
  tech: [
    "¿Qué aparato usas a diario y ya no sabrías vivir sin él?",
    "¿Cuál fue el primer ordenador o móvil que tuviste?",
    "¿Qué tecnología te da más miedo y cuál más ilusión?",
    "Si pudieras automatizar una tarea aburrida, ¿cuál sería?",
    "Tabuladores o espacios: ¿estás dispuesto a defenderlo?",
  ],
  musica: [
    "¿Cuál es la canción que nunca te cansas de escuchar?",
    "¿Qué concierto darías lo que fuera por haber vivido?",
    "¿Cuál fue el primer disco o canción que compraste?",
    "¿Qué artista te descubrió un género nuevo por completo?",
    "¿Cuál es tu placer culpable musical que nadie sospecha?",
  ],
  estudio: [
    "¿Cuál es la mejor técnica de estudio que has descubierto?",
    "¿Qué asignatura odiabas y hoy agradeces haber cursado?",
    "¿Estudias mejor de noche o de madrugada?",
    "¿Cuál es el mejor consejo académico que te han dado?",
    "¿Qué tema te encantaría aprender aunque no sirva para nada práctico?",
  ],
} as const;

const ICEBREAKER_TOPICS: readonly IcebreakerTopic[] = [
  "general",
  "gaming",
  "tech",
  "musica",
  "estudio",
];

/**
 * Returns the list of supported topics in a stable order. Pure and
 * deterministic.
 */
export const listIcebreakerTopics = (): readonly string[] => ICEBREAKER_TOPICS;

/**
 * Type guard: true when `topic` is one of the supported icebreaker topics.
 * Pure and deterministic.
 */
export const isIcebreakerTopic = (topic: string): topic is IcebreakerTopic =>
  Object.hasOwn(ICEBREAKER_BANK, topic);

/**
 * FNV-1a 32-bit hash of a number seed, folded to an unsigned integer. Keeps
 * selection deterministic without Math.random. Pure.
 */
const hashSeed = (seed: number): number => {
  // Normalize to a non-negative 32-bit integer so negatives and floats hash
  // to a stable bucket.
  let value = Math.trunc(Math.abs(seed)) >>> 0;
  let hash = 0x811c9dc5;
  // Mix each byte of the 32-bit value.
  for (let i = 0; i < 4; i += 1) {
    hash ^= value & 0xff;
    hash = Math.imul(hash, 0x01000193);
    value >>>= 8;
  }
  return hash >>> 0;
};

/**
 * Deterministically picks one question for the given topic using the seed. An
 * unknown topic falls back to "general". Returns "" only when the resolved
 * bucket is empty (which never happens for the built-in bank). Pure.
 */
export const pickIcebreaker = (topic: string, seed: number): string => {
  const key: IcebreakerTopic = isIcebreakerTopic(topic) ? topic : "general";
  const questions = ICEBREAKER_BANK[key];
  if (questions.length === 0) {
    return "";
  }
  const index = hashSeed(seed) % questions.length;
  return questions[index] ?? "";
};

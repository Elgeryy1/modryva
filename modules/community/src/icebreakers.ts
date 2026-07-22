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
    "Si pudieras cenar con cualquier persona, viva o no, quien seria?",
    "Cual es la mejor decision que has tomado este ano?",
    "Que habilidad te gustaria dominar si tuvieras tiempo ilimitado?",
    "Cual es tu recuerdo mas feliz de la infancia?",
    "Si te tocaras la loteria manana, que seria lo primero que harias?",
  ],
  gaming: [
    "Cual es el videojuego que mas horas te ha robado y no te arrepientes?",
    "Prefieres cooperativo o competitivo, y por que?",
    "Cual es el jefe final que mas rabia te hizo pasar?",
    "Que juego retro volverias a jugar hoy mismo?",
    "PC, consola o movil: cual defiendes hasta el final?",
  ],
  tech: [
    "Que gadget usas a diario y ya no sabrias vivir sin el?",
    "Cual fue el primer ordenador o movil que tuviste?",
    "Que tecnologia te da mas miedo y cual mas ilusion?",
    "Si pudieras automatizar una tarea aburrida, cual seria?",
    "Tabs o espacios, y estas dispuesto a defenderlo?",
  ],
  musica: [
    "Cual es la cancion que nunca te cansas de escuchar?",
    "Que concierto darias lo que fuera por haber vivido?",
    "Cual fue el primer disco o cancion que compraste?",
    "Que artista te descubrio un genero nuevo por completo?",
    "Cual es tu placer culpable musical que nadie sospecha?",
  ],
  estudio: [
    "Cual es la mejor tecnica de estudio que has descubierto?",
    "Que asignatura odiabas y hoy agradeces haber cursado?",
    "Estudias mejor de noche o de madrugada?",
    "Cual es el mejor consejo academico que te han dado?",
    "Que tema te encantaria aprender aunque no sirva para nada practico?",
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

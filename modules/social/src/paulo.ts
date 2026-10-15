/**
 * "Paulo": original absurd-motivational parody.
 *
 * Deliberately NOT a quote database. Copying real aphorisms — or a third
 * party's template — is the copyright trap the report calls out (§7.2), and a
 * fixed list of jokes goes stale in a week anyway. Instead this composes:
 *
 *     [solemn opening] + [absurd turn] + [Modryva punchline]
 *
 * which is three short original lists that multiply into thousands of endings
 * nobody has to write. All text here is written for Modryva.
 *
 * No AI on the critical path (report §7.4): the module must work with the AI
 * switched off, which in this repo it frequently is.
 */

import type { RandomSource } from "./ports.js";

export const PAULO_TOPICS = [
  "general",
  "lunes",
  "trabajo",
  "estudios",
  "dinero",
  "amor",
  "pole",
] as const;
export type PauloTopic = (typeof PAULO_TOPICS)[number];

interface Fragment {
  readonly text: string;
  /** Empty = fits any topic. Otherwise the topics it belongs to. */
  readonly topics: readonly PauloTopic[];
}

const OPENINGS: readonly Fragment[] = [
  { text: "No temas al camino", topics: [] },
  { text: "Todo lo que empieza", topics: [] },
  { text: "El universo conspira", topics: [] },
  { text: "Quien busca de verdad", topics: [] },
  { text: "La paciencia es una forma de valentía", topics: [] },
  { text: "Nada de lo que vive se detiene", topics: [] },
  { text: "Lo que se repite acaba siendo carácter", topics: [] },
  { text: "Hay silencios que también son respuestas", topics: [] },
  { text: "El lunes no es un castigo", topics: ["lunes"] },
  { text: "Cada semana empieza dos veces", topics: ["lunes"] },
  { text: "El trabajo verdadero no se ve", topics: ["trabajo"] },
  { text: "Quien construye, también descansa", topics: ["trabajo"] },
  { text: "Estudiar es hablar con los muertos", topics: ["estudios"] },
  { text: "El que aprende, olvida a propósito", topics: ["estudios"] },
  { text: "El dinero es un idioma", topics: ["dinero"] },
  { text: "La abundancia no se persigue", topics: ["dinero"] },
  { text: "Amar es mirar dos veces", topics: ["amor"] },
  { text: "El corazón tiene su propio horario", topics: ["amor"] },
  { text: "Quien madruga encuentra la pole", topics: ["pole"] },
  { text: "El primero del día no siempre gana", topics: ["pole"] },
];

const TURNS: readonly Fragment[] = [
  { text: "porque a veces el destino también pierde el autobús", topics: [] },
  { text: "salvo los martes, que son territorio hostil", topics: [] },
  { text: "aunque nadie ha comprobado nunca esa parte", topics: [] },
  { text: "y sin embargo la nevera sigue vacía", topics: [] },
  { text: "excepto cuando hay wifi, que entonces da igual", topics: [] },
  { text: "pero solo si lo dices en voz alta y con acento", topics: [] },
  {
    text: "lo cual no explica por qué la impresora nunca funciona",
    topics: [],
  },
  { text: "menos si has dormido mal, que entonces todo se cae", topics: [] },
  { text: "y aun así el grupo sigue sin ponerse de acuerdo", topics: [] },
  { text: "y aun así el despertador insiste", topics: ["lunes", "trabajo"] },
  {
    text: "aunque la reunión podría haber sido un correo",
    topics: ["trabajo"],
  },
  {
    text: "salvo la semana de exámenes, que no cuenta como tiempo",
    topics: ["estudios"],
  },
  {
    text: "y aun así el resumen sigue sin escribirse solo",
    topics: ["estudios"],
  },
  { text: "aunque la cuenta corriente opine lo contrario", topics: ["dinero"] },
  { text: "salvo el día 28, que es un abismo", topics: ["dinero"] },
  {
    text: "aunque el otro tenga el visto puesto desde el jueves",
    topics: ["amor"],
  },
  {
    text: "y aun así alguien llega antes por pura cabezonería",
    topics: ["pole"],
  },
];

const PUNCHLINES: readonly Fragment[] = [
  { text: "Modryva no promete nada, pero lo apunta todo.", topics: [] },
  { text: "Piénsalo. O no. Yo solo reparto frases.", topics: [] },
  { text: "Guárdatelo para cuando alguien pregunte algo difícil.", topics: [] },
  { text: "No es un consejo, es una decoración.", topics: [] },
  { text: "Si esto te ha servido, revísate.", topics: [] },
  { text: "Cítame mal, que así parece más profundo.", topics: [] },
  { text: "Y ahora sigue con tu día como si nada.", topics: [] },
  { text: "Feliz lunes, o lo que sea que esto sea.", topics: ["lunes"] },
  { text: "Vuelve al curro, que te veo.", topics: ["trabajo"] },
  { text: "Ve a estudiar, anda.", topics: ["estudios"] },
  { text: "Y no, no te voy a prestar nada.", topics: ["dinero"] },
  { text: "Escríbele. O no. Pero decide.", topics: ["amor"] },
  { text: "Mañana a las 00:00 lo compruebas.", topics: ["pole"] },
];

/** Fragments that fit the topic, plus the universal ones as a floor. */
const forTopic = (
  fragments: readonly Fragment[],
  topic: PauloTopic,
): readonly Fragment[] => {
  const matching = fragments.filter(
    (fragment) =>
      fragment.topics.length === 0 || fragment.topics.includes(topic),
  );
  // `general` and any unmatched topic still leave the universal set, which is
  // never empty — so composition can never fail for lack of material.
  return matching.length > 0 ? matching : fragments;
};

/** Longest sentence we will put in a group. Telegram allows far more. */
export const PAULO_MAX_LENGTH = 280;

export interface PauloResult {
  readonly text: string;
  readonly topic: PauloTopic;
}

/**
 * Normalises free text to a known topic.
 *
 * Anything unrecognised becomes `general` rather than an error: `/paulo
 * berenjenas` should produce a sentence, not a usage message.
 */
export const normalizeTopic = (raw: string | undefined): PauloTopic => {
  const folded = (raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .trim();
  const found = PAULO_TOPICS.find((topic) => topic === folded);
  if (found) {
    return found;
  }
  // A few natural aliases people actually type.
  if (/^(curro|curra|oficina|jefe)$/u.test(folded)) return "trabajo";
  if (/^(examen|examenes|uni|clase|carrera)$/u.test(folded)) return "estudios";
  if (/^(pasta|money|euros|sueldo)$/u.test(folded)) return "dinero";
  if (/^(pareja|novia|novio|crush)$/u.test(folded)) return "amor";
  return "general";
};

/**
 * Composes one sentence.
 *
 * Three independent draws so the same opening can land on a different turn
 * tomorrow. If the assembled sentence somehow exceeds the length budget it
 * falls back to opening + punchline, which always fits — a truncated joke with
 * an ellipsis reads like a bug.
 */
export const composePaulo = (
  topic: PauloTopic,
  random: RandomSource,
): PauloResult => {
  const openings = forTopic(OPENINGS, topic);
  const turns = forTopic(TURNS, topic);
  const punchlines = forTopic(PUNCHLINES, topic);

  const opening = openings[random.int(0, openings.length)] ?? openings[0];
  const turn = turns[random.int(0, turns.length)] ?? turns[0];
  const punchline =
    punchlines[random.int(0, punchlines.length)] ?? punchlines[0];

  const full = `${opening?.text ?? ""}, ${turn?.text ?? ""}. ${punchline?.text ?? ""}`;
  const text =
    full.length <= PAULO_MAX_LENGTH
      ? full
      : `${opening?.text ?? ""}. ${punchline?.text ?? ""}`;

  return { text, topic };
};

/** Total distinct sentences the engine can produce for a topic. */
export const combinationsFor = (topic: PauloTopic): number =>
  forTopic(OPENINGS, topic).length *
  forTopic(TURNS, topic).length *
  forTopic(PUNCHLINES, topic).length;

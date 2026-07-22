import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type RpsChoice = "piedra" | "papel" | "tijera";

export type FunCommand =
  | { readonly kind: "8ball"; readonly question: string }
  | { readonly kind: "coin" }
  | { readonly kind: "roll"; readonly count: number; readonly sides: number }
  | { readonly kind: "rps"; readonly choice: RpsChoice | undefined }
  | { readonly kind: "love"; readonly a: string; readonly b: string }
  | { readonly kind: "rate"; readonly subject: string }
  | { readonly kind: "native"; readonly emoji: string };

export interface FunCommandError {
  readonly code: "format";
  readonly usage: string;
}

export type FunCommandResult =
  | { readonly ok: true; readonly command: FunCommand }
  | { readonly ok: false; readonly error: FunCommandError };

const rollUsage = "Uso: /roll NdM (ej: /roll 2d6; 1<=N<=20, 2<=M<=1000)";
const rpsUsage = "Uso: /rps [piedra|papel|tijera]";
const loveUsage = "Uso: /love nombre1 | nombre2";
const rateUsage = "Uso: /rate <algo>";

/**
 * Native Telegram dice emojis by command name. Sending one of these emojis via
 * sendDice makes Telegram animate the result server-side.
 */
export const NATIVE_DICE: Readonly<Record<string, string>> = {
  dice: "🎲",
  dart: "🎯",
  basket: "🏀",
  soccer: "⚽",
  bowling: "🎳",
  slots: "🎰",
};

const funCommandNames: ReadonlySet<string> = new Set([
  "8ball",
  "bola8",
  "coin",
  "flip",
  "moneda",
  "roll",
  "rps",
  "love",
  "ship",
  "rate",
  "dice",
  "dart",
  "basket",
  "soccer",
  "bowling",
  "slots",
]);

const isRpsChoice = (value: string): value is RpsChoice =>
  value === "piedra" || value === "papel" || value === "tijera";

/**
 * Parses the fun-module commands (/8ball, /coin, /roll, /rps, /love, /rate and
 * the native dice commands) with their aliases. Returns null when the command
 * does not belong to this module and a format error with a Spanish usage
 * string when the args are invalid. Pure: never touches randomness or clocks.
 */
export const parseFunCommand = (
  update: TelegramUpdateEnvelope,
): FunCommandResult | null => {
  const name = update.command?.name;

  if (!name || !funCommandNames.has(name)) {
    return null;
  }

  const text = (update.command?.args ?? []).join(" ").trim();

  if (name === "8ball" || name === "bola8") {
    return { ok: true, command: { kind: "8ball", question: text } };
  }

  if (name === "coin" || name === "flip" || name === "moneda") {
    return { ok: true, command: { kind: "coin" } };
  }

  if (name === "roll") {
    if (text.length === 0) {
      return { ok: true, command: { kind: "roll", count: 1, sides: 6 } };
    }

    const match = /^(\d{1,2})d(\d{1,4})$/.exec(text.toLowerCase());
    const count = Number.parseInt(match?.[1] ?? "", 10);
    const sides = Number.parseInt(match?.[2] ?? "", 10);

    if (
      !match ||
      Number.isNaN(count) ||
      Number.isNaN(sides) ||
      count < 1 ||
      count > 20 ||
      sides < 2 ||
      sides > 1000
    ) {
      return { ok: false, error: { code: "format", usage: rollUsage } };
    }

    return { ok: true, command: { kind: "roll", count, sides } };
  }

  if (name === "rps") {
    if (text.length === 0) {
      return { ok: true, command: { kind: "rps", choice: undefined } };
    }

    const choice = text.toLowerCase();

    if (!isRpsChoice(choice)) {
      return { ok: false, error: { code: "format", usage: rpsUsage } };
    }

    return { ok: true, command: { kind: "rps", choice } };
  }

  if (name === "love" || name === "ship") {
    const parts = text
      .split("|")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    const [a, b] = parts;

    if (!a || !b || parts.length !== 2) {
      return { ok: false, error: { code: "format", usage: loveUsage } };
    }

    return { ok: true, command: { kind: "love", a, b } };
  }

  if (name === "rate") {
    if (text.length === 0) {
      return { ok: false, error: { code: "format", usage: rateUsage } };
    }

    return { ok: true, command: { kind: "rate", subject: text } };
  }

  const emoji = NATIVE_DICE[name];

  if (emoji) {
    return { ok: true, command: { kind: "native", emoji } };
  }

  return null;
};

/**
 * Deterministic 32-bit hash (FNV-1a) of a string. Same input always yields the
 * same output, which keeps every score below reproducible.
 */
const fnv1a = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/**
 * One step of a 32-bit linear congruential generator (Numerical Recipes
 * constants). Deterministic: the same state always produces the same next
 * state.
 */
const nextLcg = (state: number): number =>
  (Math.imul(state >>> 0, 1664525) + 1013904223) >>> 0;

/**
 * Magic 8-ball answers in Spanish (sin acentos). Mix of yes / no / maybe with
 * a playful tone. The list order is part of the deterministic contract of
 * `eightBallAnswer`.
 */
export const EIGHT_BALL_ANSWERS: readonly string[] = [
  "Si, sin duda",
  "Claramente si",
  "Todo apunta a que si",
  "Cuenta con ello",
  "Lo mas probable es que si",
  "Las estrellas dicen que si",
  "Si, pero no se lo digas a nadie",
  "Puede ser, quien sabe",
  "Pregunta de nuevo mas tarde",
  "Mejor no te lo digo ahora",
  "No puedo predecirlo ahora",
  "Concentrate y pregunta otra vez",
  "No cuentes con ello",
  "Mi respuesta es no",
  "Mis fuentes dicen que no",
  "Las perspectivas no son buenas",
  "Muy dudoso",
  "Ni de broma",
];

/**
 * Picks a magic 8-ball answer from `EIGHT_BALL_ANSWERS`. Deterministic: the
 * same seed always returns the same answer.
 */
export const eightBallAnswer = (seed: number): string =>
  EIGHT_BALL_ANSWERS[nextLcg(seed) % EIGHT_BALL_ANSWERS.length] ??
  "Puede ser, quien sabe";

/**
 * Flips a coin from a seed. Deterministic: the same seed always lands on the
 * same side.
 */
export const coinFlip = (seed: number): "cara" | "cruz" =>
  nextLcg(seed) % 2 === 0 ? "cara" : "cruz";

/**
 * Rolls `count` dice of `sides` faces advancing an LCG once per roll, so every
 * die is independent but the whole sequence is reproducible from the seed.
 * Each value is within 1..sides. Deterministic and pure.
 */
export const rollDice = (
  count: number,
  sides: number,
  seed: number,
): number[] => {
  const total = Math.max(0, Math.trunc(count));
  const faces = Math.max(1, Math.trunc(sides));
  const rolls: number[] = [];
  let state = seed >>> 0;

  for (let index = 0; index < total; index += 1) {
    state = nextLcg(state);
    rolls.push((state % faces) + 1);
  }

  return rolls;
};

const RPS_CHOICES: readonly RpsChoice[] = ["piedra", "papel", "tijera"];

/**
 * Bot pick for rock-paper-scissors. Deterministic: the same seed always yields
 * the same choice.
 */
export const botRpsChoice = (seed: number): RpsChoice =>
  RPS_CHOICES[nextLcg(seed) % RPS_CHOICES.length] ?? "piedra";

/**
 * Resolves rock-paper-scissors from the player's perspective:
 * piedra > tijera > papel > piedra. Equal choices are a draw. Pure function.
 */
export const rpsOutcome = (
  player: RpsChoice,
  bot: RpsChoice,
): "win" | "lose" | "draw" => {
  if (player === bot) {
    return "draw";
  }

  const beats: Readonly<Record<RpsChoice, RpsChoice>> = {
    piedra: "tijera",
    papel: "piedra",
    tijera: "papel",
  };

  return beats[player] === bot ? "win" : "lose";
};

/**
 * Parses a rock-paper-scissors callback of the form `rps:<choice>`. Returns
 * null when the callback is missing, not an rps callback, or carries an
 * invalid choice.
 */
export const parseRpsCallback = (
  callbackData: string | undefined,
): { choice: RpsChoice } | null => {
  if (!callbackData?.startsWith("rps:")) {
    return null;
  }

  const raw = callbackData.slice("rps:".length);
  return isRpsChoice(raw) ? { choice: raw } : null;
};

/**
 * Builds the inline keyboard shown when `/rps` arrives without a choice: one
 * row with the three options wired to `rps:<choice>` callbacks. Pure: always
 * returns the same structure.
 */
export const buildRpsKeyboard = (): Record<string, unknown> => ({
  inline_keyboard: [
    [
      { text: "🪨 Piedra", callback_data: "rps:piedra" },
      { text: "📄 Papel", callback_data: "rps:papel" },
      { text: "✂️ Tijera", callback_data: "rps:tijera" },
    ],
  ],
});

/**
 * Love compatibility score in 0..100 from an FNV-1a hash of the two names
 * normalized (lowercase + trim) and sorted, so it is deterministic and
 * symmetric: loveScore(a, b) === loveScore(b, a).
 */
export const loveScore = (a: string, b: string): number => {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  const first = left <= right ? left : right;
  const second = left <= right ? right : left;

  return fnv1a(`${first}|${second}`) % 101;
};

/**
 * Rating score in 0..10 from an FNV-1a hash of the normalized subject
 * (lowercase + trim). Deterministic: the same subject always gets the same
 * score.
 */
export const rateScore = (subject: string): number =>
  fnv1a(subject.trim().toLowerCase()) % 11;

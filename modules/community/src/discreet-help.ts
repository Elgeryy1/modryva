/**
 * Discreet help routing for the community module.
 *
 * Lets members ask staff for help without exposing themselves in public:
 * given a message, decides whether it is a help request and which channel
 * the bot should use to respond ("privado" to move it out of the public
 * chat, "ninguno" when no help is needed).
 */

/** Input for {@link routeDiscreetHelp}: the raw message text. Pure and deterministic. */
export interface DiscreetHelpInput {
  readonly text: string;
}

/**
 * Where the bot should steer a possible help request.
 * "privado" keeps the conversation private; "ninguno" means no action.
 * Pure and deterministic.
 */
export type DiscreetHelpChannel = "privado" | "ninguno";

/** Result of routing a message through the discreet help detector. Pure and deterministic. */
export interface DiscreetHelpRoute {
  readonly needsHelp: boolean;
  readonly channel: DiscreetHelpChannel;
  readonly matched: readonly string[];
}

/**
 * Help trigger phrases, already lowercased and accent-free so they can be
 * compared against normalized input. Order defines the order of `matched`.
 */
const HELP_PHRASES: readonly string[] = [
  "ayuda",
  "socorro",
  "necesito a un admin",
  "reportar en privado",
];

/**
 * Lowercases text and strips common Spanish diacritics so detection is
 * accent-insensitive ("necesíto" matches "necesito"). Internal helper.
 * Pure and deterministic.
 */
const foldText = (text: string): string => {
  const lower = text.toLowerCase();
  const out: string[] = [];
  for (const ch of lower) {
    if (ch === "á" || ch === "à" || ch === "ä" || ch === "â") {
      out.push("a");
    } else if (ch === "é" || ch === "è" || ch === "ë" || ch === "ê") {
      out.push("e");
    } else if (ch === "í" || ch === "ì" || ch === "ï" || ch === "î") {
      out.push("i");
    } else if (ch === "ó" || ch === "ò" || ch === "ö" || ch === "ô") {
      out.push("o");
    } else if (ch === "ú" || ch === "ù" || ch === "ü" || ch === "û") {
      out.push("u");
    } else {
      out.push(ch);
    }
  }
  return out.join("");
};

/**
 * Decides whether a message is a discreet help request and how to route it.
 * Detection is case- and accent-insensitive; `matched` lists the triggered
 * phrases in HELP_PHRASES order. When any phrase matches, `needsHelp` is true
 * and `channel` is "privado"; otherwise `channel` is "ninguno".
 * Empty or whitespace-only text is never a help request.
 * Pure and deterministic.
 */
export const routeDiscreetHelp = (
  input: DiscreetHelpInput,
): DiscreetHelpRoute => {
  const folded = foldText(input.text);
  if (folded.trim().length === 0) {
    return { needsHelp: false, channel: "ninguno", matched: [] };
  }
  const matched: string[] = [];
  for (const phrase of HELP_PHRASES) {
    if (folded.includes(phrase)) {
      matched.push(phrase);
    }
  }
  const needsHelp = matched.length > 0;
  return {
    needsHelp,
    channel: needsHelp ? "privado" : "ninguno",
    matched,
  };
};

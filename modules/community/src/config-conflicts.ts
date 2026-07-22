/**
 * A single detected contradiction: two configuration flags that are both
 * enabled at the same time and therefore cancel each other out. Pure data.
 */
export interface ConfigConflict {
  /** First conflicting configuration key. */
  readonly a: string;
  /** Second conflicting configuration key. */
  readonly b: string;
  /** User-facing Spanish explanation of why the pair is contradictory. */
  readonly explanation: string;
}

/** Internal catalog entry describing a mutually exclusive flag pair. */
interface ConflictRule {
  readonly a: string;
  readonly b: string;
  readonly explanation: string;
}

/**
 * Static catalog of mutually exclusive configuration flag pairs, ordered by
 * priority. Detection scans this list in order so the output is stable.
 */
const CONFLICT_RULES: readonly ConflictRule[] = [
  {
    a: "allowLinks",
    b: "blockLinks",
    explanation:
      "Permites y bloqueas enlaces al mismo tiempo. Deja activa solo una de las dos opciones. 🔗",
  },
  {
    a: "allowMedia",
    b: "blockMedia",
    explanation:
      "Permites y bloqueas archivos multimedia a la vez. Elige una sola política. 🖼️",
  },
  {
    a: "captchaEnabled",
    b: "instantEntry",
    explanation:
      "El captcha pide verificación, pero la entrada instantánea deja pasar a todos sin resolverlo. ⚠️",
  },
  {
    a: "silentMode",
    b: "announceAll",
    explanation:
      "El modo silencioso choca con anunciarlo todo: no se enviará ningún aviso. 🔇",
  },
  {
    a: "autoApproveMembers",
    b: "captchaEnabled",
    explanation:
      "Apruebas a los miembros automáticamente, así que el captcha nunca llegará a mostrarse. 🤖",
  },
];

/**
 * Detects contradictory configuration by scanning a static catalog of mutually
 * exclusive flag pairs and returning one entry per pair whose BOTH flags are
 * enabled (strictly true) in the given config. Results preserve catalog order;
 * unknown, missing or false flags never produce a conflict.
 * Pure and deterministic.
 */
export const detectConfigConflicts = (
  config: Readonly<Record<string, boolean>>,
): readonly ConfigConflict[] => {
  const conflicts: ConfigConflict[] = [];
  for (const rule of CONFLICT_RULES) {
    if (config[rule.a] === true && config[rule.b] === true) {
      conflicts.push({ a: rule.a, b: rule.b, explanation: rule.explanation });
    }
  }
  return conflicts;
};

/**
 * Convenience predicate reporting whether the given config triggers at least
 * one contradiction. Pure and deterministic.
 */
export const hasConfigConflict = (
  config: Readonly<Record<string, boolean>>,
): boolean => detectConfigConflicts(config).length > 0;

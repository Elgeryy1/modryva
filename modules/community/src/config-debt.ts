/**
 * A single configuration-debt finding: a feature flag that is enabled but
 * relies on another flag that is not, so it "works" while being badly set up.
 * Pure and deterministic.
 */
export interface ConfigDebtItem {
  /** The enabled flag whose setup is incomplete. */
  readonly key: string;
  /** User-facing Spanish explanation of the smell. */
  readonly issue: string;
}

/**
 * A curated dependency smell: when `when` is enabled but `requires` is not,
 * emit `issue`. Internal shape, intentionally not exported.
 */
interface ConfigDebtRule {
  readonly when: string;
  readonly requires: string;
  readonly issue: string;
}

/**
 * Curated, ordered catalog of known configuration smells. The output of
 * detectConfigDebt preserves this exact order regardless of the key order in
 * the input config. Comments and identifiers are plain ASCII on purpose.
 */
const CONFIG_DEBT_RULES: readonly ConfigDebtRule[] = [
  {
    when: "welcomeEnabled",
    requires: "rulesSet",
    issue:
      "El mensaje de bienvenida está activo pero no has definido las reglas del grupo. 📋",
  },
  {
    when: "antifloodEnabled",
    requires: "captchaEnabled",
    issue:
      "El antiflood está activo pero el captcha está desactivado; los bots pueden colarse sin filtro. 🤖",
  },
  {
    when: "moderationEnabled",
    requires: "logChannelSet",
    issue:
      "La moderación está activa pero no hay canal de registro para auditar las acciones. 📝",
  },
  {
    when: "silentBanEnabled",
    requires: "moderationEnabled",
    issue:
      "El baneo silencioso está activo pero la moderación general está desactivada. 🔇",
  },
  {
    when: "nightModeEnabled",
    requires: "antifloodEnabled",
    issue:
      "El modo nocturno está activo pero el antiflood está desactivado, así que no frena nada de noche. 🌙",
  },
];

/**
 * Reads a flag from the config treating a missing key as `false`. This keeps
 * noUncheckedIndexedAccess happy without non-null assertions.
 * Pure and deterministic.
 */
const isFlagOn = (
  config: Readonly<Record<string, boolean>>,
  key: string,
): boolean => config[key] === true;

/**
 * Detects configuration debt: feature flags that are enabled while a companion
 * flag they depend on is disabled or missing. Rules are checked in the curated
 * CONFIG_DEBT_RULES order and only triggered rules are returned, so the result
 * is stable and independent of the input key order. Returns an empty array for
 * a clean or empty config.
 * Pure and deterministic.
 */
export const detectConfigDebt = (
  config: Readonly<Record<string, boolean>>,
): readonly ConfigDebtItem[] => {
  const findings: ConfigDebtItem[] = [];
  for (const rule of CONFIG_DEBT_RULES) {
    if (isFlagOn(config, rule.when) && !isFlagOn(config, rule.requires)) {
      findings.push({ key: rule.when, issue: rule.issue });
    }
  }
  return findings;
};

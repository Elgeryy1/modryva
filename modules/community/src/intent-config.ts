/**
 * A high-level community intent an admin picks to auto-configure a group.
 * Pure and deterministic.
 */
export type CommunityIntent = "anti_spam" | "ordenar" | "chill" | "crecer";

/**
 * Resolved configuration for a chosen community intent: the intent echoed back,
 * a boolean settings grid, and a user-facing Spanish summary.
 * Pure and deterministic.
 */
export interface CommunityIntentConfig {
  readonly intent: CommunityIntent;
  readonly settings: Readonly<Record<string, boolean>>;
  readonly summary: string;
}

/**
 * All supported community intents in canonical presentation order.
 * Pure and deterministic.
 */
export const COMMUNITY_INTENTS: readonly CommunityIntent[] = [
  "anti_spam",
  "ordenar",
  "chill",
  "crecer",
];

const CONFIG_BY_INTENT: Readonly<
  Record<CommunityIntent, CommunityIntentConfig>
> = {
  anti_spam: {
    intent: "anti_spam",
    settings: {
      antiSpamFilter: true,
      linkGuard: true,
      captchaOnJoin: true,
      slowMode: true,
      reportQueue: false,
      friendlyWelcome: false,
      growthReferrals: false,
    },
    summary:
      "🛡️ Modo antispam: filtros estrictos, captcha al entrar y modo lento activados para frenar el spam.",
  },
  ordenar: {
    intent: "ordenar",
    settings: {
      antiSpamFilter: true,
      linkGuard: false,
      captchaOnJoin: false,
      slowMode: false,
      reportQueue: true,
      friendlyWelcome: false,
      growthReferrals: false,
    },
    summary:
      "🗂️ Modo orden: cola de reportes activada para revisar las denuncias con calma y sin perder ninguna.",
  },
  chill: {
    intent: "chill",
    settings: {
      antiSpamFilter: false,
      linkGuard: false,
      captchaOnJoin: false,
      slowMode: false,
      reportQueue: false,
      friendlyWelcome: true,
      growthReferrals: false,
    },
    summary:
      "😎 Modo relajado: sin filtros agresivos, bienvenida amistosa y cero fricción para la comunidad.",
  },
  crecer: {
    intent: "crecer",
    settings: {
      antiSpamFilter: true,
      linkGuard: false,
      captchaOnJoin: false,
      slowMode: false,
      reportQueue: false,
      friendlyWelcome: true,
      growthReferrals: true,
    },
    summary:
      "🚀 Modo crecimiento: referidos y bienvenida amistosa activados, con antispam básico para cuidar la calidad.",
  },
};

/**
 * Maps a community intent to its curated settings grid and Spanish summary.
 * The result is a stable reference from an internal table, so repeated calls
 * with the same intent return deeply equal values.
 * Pure and deterministic.
 */
export const mapIntentToConfig = (
  intent: CommunityIntent,
): CommunityIntentConfig => CONFIG_BY_INTENT[intent];

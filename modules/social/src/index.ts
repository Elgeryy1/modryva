/**
 * La API publica de `modules/social`.
 *
 * Se nombra lo que sale, en vez de `export * from`, a proposito.
 *
 * Con `export *` el modulo publicaba sus 128 simbolos; desde fuera se
 * usan 45. El resto era superficie publica sin consumidor: mientras lo
 * fuera, mover o renombrar un detalle interno era un cambio incompatible en
 * potencia, y nadie podia saber cual sin buscar por todo el repo.
 *
 * El test de arquitectura ya prohibe entrar por un subcamino
 * (`@superbot/module-social/src/...`), asi que esta lista **es** la
 * frontera: lo que no este aqui no lo puede tocar nadie de fuera.
 *
 * Los ficheros siguen exportando sus simbolos con `export` normal — los tests
 * del propio modulo los importan por ruta relativa y deben seguir pudiendo. Lo
 * que se recorta es lo que sale por aqui, que es lo que ve el resto.
 *
 * Al anadir algo, la pregunta es quien lo consume desde fuera. Si no hay nadie,
 * no entra.
 */

export { copy, displayName, escapeHtml } from "./copy.js";
export type { FunMediaKind } from "./fun-media.js";
export { kindLabel, pickAsset, rememberSent } from "./fun-media.js";
export { socialManifest } from "./manifest.js";
export type { SocialCommandName } from "./metrics.js";
export { SOCIAL_METRICS, SOCIAL_METRICS_HELP } from "./metrics.js";
export { composePaulo, normalizeTopic } from "./paulo.js";
export { POLE_USAGE, parsePoleArgs, periodLabel } from "./pole-command.js";
export { autoPoleVerdict } from "./pole-eligibility.js";
export { bestStreak, dayPrefixFor, streakFromWinDays } from "./pole-stats.js";
export {
  formatLatency,
  latencyMsFor,
  poleWindowFor,
  windowDayKey,
} from "./pole-window.js";
export type { Clock, ModerationPort, RandomSource } from "./ports.js";
export { fixedClock, sequenceRandom, systemClock } from "./ports.js";
export {
  cooldownVerdict,
  decideRound,
  formatMuteDuration,
  resolveConsequence,
} from "./roulette.js";
export { parseRouletteArgs, ROULETTE_USAGE } from "./roulette-command.js";
export type { SocialScope, SocialSettings } from "./settings.js";
export {
  isValidTimezone,
  normalizeSocialSettings,
  SOCIAL_SETTINGS_KEY,
  scopeFor,
} from "./settings.js";
export type { Check, SocialStatusInputs } from "./status.js";
export { renderSocialStatus } from "./status.js";

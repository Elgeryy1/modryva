/**
 * La API publica de `modules/guardian`.
 *
 * Se nombra lo que sale, en vez de `export * from`, a proposito.
 *
 * Con `export *` el modulo publicaba sus 118 simbolos; desde fuera se
 * usan 51. El resto era superficie publica sin consumidor: mientras lo
 * fuera, mover o renombrar un detalle interno era un cambio incompatible en
 * potencia, y nadie podia saber cual sin buscar por todo el repo.
 *
 * El test de arquitectura ya prohibe entrar por un subcamino
 * (`@superbot/module-guardian/src/...`), asi que esta lista **es** la
 * frontera: lo que no este aqui no lo puede tocar nadie de fuera.
 *
 * Los ficheros siguen exportando sus simbolos con `export` normal — los tests
 * del propio modulo los importan por ruta relativa y deben seguir pudiendo. Lo
 * que se recorta es lo que sale por aqui, que es lo que ve el resto.
 *
 * Al anadir algo, la pregunta es quien lo consume desde fuera. Si no hay nadie,
 * no entra.
 */

export type { ChallengeDefinition, SubmittedStepResult } from "./challenge.js";
export {
  generateChallenge,
  generateGestureChallenge,
  PHOTO_GESTURE_ACTIONS,
  resolveStepAction,
  verifyChallengeSubmission,
} from "./challenge.js";
export type { DecisionInput } from "./decision-engine.js";
export {
  evaluateDecision,
  resolveEffectiveGuardianMode,
} from "./decision-engine.js";
export { findIpMatches } from "./ip-identity.js";
export { checkIpReputation } from "./ip-reputation.js";
export { guardianManifest } from "./manifest.js";
export { sniffMimeType, validateCapturedMedia } from "./media-policy.js";
export type {
  GestureVisionProvider,
  GuardianAiProviders,
  ProvenanceScanner,
} from "./providers.js";
export {
  createDefaultProviders,
  GeminiGroqGestureVisionProvider,
  NotConfiguredGestureVisionProvider,
} from "./providers.js";
export {
  computeSessionIdempotencyKey,
  decryptJoinRequestQueryId,
  encryptJoinRequestQueryId,
  generateChallengeNonce,
  generateSessionToken,
  hashSessionToken,
} from "./session-crypto.js";
export type {
  GuardianModeValue,
  GuardianSettingsForValidation,
} from "./settings.js";
export {
  esArranqueDeAutoVerificacion,
  formatRetryTtl,
  formatTopicIdReply,
  GUARDIAN_RETRY_START_PREFIX,
  GUARDIAN_RETRY_TTL_SECONDS,
  GUARDIAN_SELF_START,
  parseGuardianCommand,
  parseGuardianRetryStart,
  resolveStaffReportDeleteAfter,
  validateGuardianSettings,
} from "./settings.js";
export type { StaffReportInput } from "./staff-report.js";
export {
  buildAutoApprovedKeyboard,
  buildExpelConfirmKeyboard,
  buildManualReviewKeyboard,
  buildMirrorKeyboard,
  buildStaffCallbackData,
  formatStaffReportText,
  isButtonPrivacyError,
  isMirroredStaffCopy,
  parseStaffCallbackData,
  redactForMirror,
  STAFF_MIRROR_CALLBACK,
  stripPrivacyRestrictedButtons,
  verifyStaffCallback,
} from "./staff-report.js";

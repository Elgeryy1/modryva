/**
 * La API publica de `modules/security`.
 *
 * Se nombra lo que sale, en vez de `export * from`, a proposito.
 *
 * Con `export *` el modulo publicaba sus 711 simbolos; desde fuera se
 * usan 197. El resto era superficie publica sin consumidor: mientras lo
 * fuera, mover o renombrar un detalle interno era un cambio incompatible en
 * potencia, y nadie podia saber cual sin buscar por todo el repo.
 *
 * El test de arquitectura ya prohibe entrar por un subcamino
 * (`@superbot/module-security/src/...`), asi que esta lista **es** la
 * frontera: lo que no este aqui no lo puede tocar nadie de fuera.
 *
 * Los ficheros siguen exportando sus simbolos con `export` normal — los tests
 * del propio modulo los importan por ruta relativa y deben seguir pudiendo. Lo
 * que se recorta es lo que sale por aqui, que es lo que ve el resto.
 *
 * Al anadir algo, la pregunta es quien lo consume desde fuera. Si no hay nadie,
 * no entra.
 */

export { classifyActionSafety } from "./action-safety.js";
export type { AdminActionStore } from "./admin-action-store.js";
export {
  adminActionKey,
  InMemoryAdminActionStore,
} from "./admin-action-store.js";
export {
  extractMentionTargetId,
  extractRepliedPhoto,
  extractReplyContext,
  formatAdminList,
  parseAdminToolCommand,
} from "./admin-tools.js";
export type { AdminSanctions } from "./aggressive-admin.js";
export { detectAggressiveAdmins } from "./aggressive-admin.js";
export type { AntifloodAction, AntifloodSettings } from "./antiflood.js";
export {
  defaultAntifloodSettings,
  evaluateFlood,
  parseAntifloodCommand,
} from "./antiflood.js";
export type { AntiraidMode, AntiraidSettings } from "./antiraid.js";
export {
  defaultAntiraidSettings,
  evaluateRaid,
  parseAntiraidCommand,
} from "./antiraid.js";
export type {
  AppointedAdminCommandResult,
  AppointedAdminSettings,
} from "./appointed-admin-guard.js";
export {
  APPOINTED_ADMIN_RIGHTS,
  APPOINTED_ADMIN_SETTINGS_KEY,
  classifyMemberTransition,
  describeAdminGuardReason,
  evaluateAppointedAdmin,
  parseAppointedAdminCommand,
  parseAppointedAdminSettings,
} from "./appointed-admin-guard.js";
export { buildBanChecklist } from "./ban-checklist.js";
export type { Report } from "./batch-resolve.js";
export { groupSimilarReports } from "./batch-resolve.js";
export type { BlocklistEntry, BlocklistMode } from "./blocklists.js";
export {
  matchBlocklist,
  normalizeBlocklistTrigger,
  parseBlocklistCommand,
} from "./blocklists.js";
export {
  accionParaModoDeBlocklist,
  textoBlocklistAplicado,
  textoBlocklistSinAccion,
} from "./bot/handlers/blocklist.js";
export {
  aplicarBloqueoDeContenido,
  senalDeRiesgoPara,
  tiposBloqueadosValidos,
} from "./bot/handlers/bloqueo-de-contenido.js";
export { resolverBloqueoDeContenido } from "./bot/handlers/bloqueos.js";
export {
  calculadoraDeAcuerdoDeConvivencia,
  calculadoraDeAgrupacionDeReportes,
  calculadoraDeAutoBeneficio,
  calculadoraDeAvisoDeAprendizaje,
  calculadoraDeCeboDeRespuesta,
  calculadoraDeChecklistDeBan,
  calculadoraDeConfianzaDeDecision,
  calculadoraDeConversionDeSancion,
  calculadoraDeDesescalada,
  calculadoraDeDiagnosticoDeObservacion,
  calculadoraDeDominioNuevo,
  calculadoraDeEfectoDeSancion,
  calculadoraDeEscudoDeMenciones,
  calculadoraDeFiltroDeSpoiler,
  calculadoraDeFirmaDeSancion,
  calculadoraDeGuardiaImpulsivo,
  calculadoraDePatronDeCuarentena,
  calculadoraDePermiso,
  calculadoraDePermisoDeEmergencia,
  calculadoraDeRazonDeSancion,
  calculadoraDeSandboxDeEnlace,
  calculadoraDeSensibilidadDeCaso,
  calculadoraDeSensibilidadDeHilo,
  calculadoraDeSeparacionActiva,
  calculadoraDeSesgoOperativo,
  calculadoraDeSpamSilencioso,
  calculadoraDeUltimaOportunidad,
  calculadoraDeVentanaDeGracia,
} from "./bot/handlers/calculadoras-de-moderacion.js";
export {
  calculadoraDeAjusteDeSancion,
  calculadoraDeColorDeSeveridad,
  calculadoraDeDuracionDeSancion,
  calculadoraDeProporcionalidad,
  calculadoraDeRangoDeAccion,
} from "./bot/handlers/calculadoras-de-sancion.js";
export {
  calculadoraDeConfianzaDeStaff,
  calculadoraDeOwnerAusente,
  calculadoraDeRevisionEntrePares,
} from "./bot/handlers/calculadoras-de-staff.js";
export {
  clasificarAdjuntoPeligroso,
  detectarFugaDeDatos,
} from "./bot/handlers/contenido-peligroso.js";
export { revisarEdicion } from "./bot/handlers/edicion.js";
export { decidirSobreEstafa } from "./bot/handlers/estafa.js";
export {
  textoDeVetoDeFban,
  vetoParaFbanear,
} from "./bot/handlers/fban-protegidos.js";
export {
  debeBorrarPorCaracteres,
  debeBorrarPorModoNoche,
} from "./bot/handlers/higiene.js";
export {
  informeDeCopiaPega,
  informeDeDiscusionCircular,
  informeDeEscaladaDeBroma,
  informeDeFirmasDeSpam,
  informeDeRitmoHumano,
  informeDeSpamDeSaludo,
} from "./bot/handlers/informes-de-patrones.js";
export { crearReservaDeFlood } from "./bot/handlers/reserva-de-flood.js";
export type { CaptchaMode, CaptchaSettings } from "./captcha.js";
export {
  defaultCaptchaSettings,
  generateCaptchaChallenge,
  hashCaptchaAnswer,
  normalizeAnswer,
  parseCaptchaCommand,
  verifyCaptchaAnswer,
} from "./captcha.js";
export { formatCaseNote, parseCaseNoteCommand } from "./case-notes.js";
export { classifyCaseSensitivity } from "./case-sensitivity.js";
export { parseCharFilterCommand } from "./char-filters.js";
export type { RateLimitStatus } from "./circuit-breaker.js";
export { detectCircularArgument } from "./circular-argument.js";
export type { Conflict } from "./clashing-pairs.js";
export { buildCoexistenceAgreement } from "./coexistence-agreement.js";
export type { AdminDecision } from "./consistency-check.js";
export { detectInconsistency } from "./consistency-check.js";
export type { LockType } from "./content-locks.js";
export {
  isLockType,
  LOCKABLE_TYPES,
  parseLockCommand,
} from "./content-locks.js";
export { convertSanction } from "./convertible-sanction.js";
export { detectCopyPaste } from "./copypaste-detector.js";
export { scoreDecisionConfidence } from "./decision-confidence.js";
export { recommendDeescalation } from "./deescalation.js";
export { classifyEditRisk } from "./edit-risk.js";
export { detectEditSpam, textoDeMotivoDeEdicion } from "./edit-spam.js";
export type { EmergencyPermissionRole } from "./emergency-perms.js";
export { grantEmergencyPermission } from "./emergency-perms.js";
export { buildSanctionRationale } from "./explain-before-sanction.js";
export { detectExternalPromotions } from "./external-admin.js";
export {
  formatFedInfo,
  formatFedStat,
  parseFederationCommand,
  parseFedImport,
  serializeFedBans,
} from "./federations.js";
export type { FloodCounterStore } from "./flood-counter.js";
export { InMemoryFloodCounter } from "./flood-counter.js";
export { isWithinGrace } from "./grace-window.js";
export { detectGreetingSpam } from "./greeting-spam.js";
export type { BotModeResolution } from "./group-hygiene.js";
export {
  isServiceMessage,
  parseHygieneCommand,
  resolveBotMode,
} from "./group-hygiene.js";
export { detectInhumanRhythm } from "./human-rhythm.js";
export type { ImpersonationIdentity } from "./impersonation.js";
export {
  adminIdentitiesFrom,
  buildImpersonationAlert,
  detectImpersonation,
} from "./impersonation.js";
export { guardImpulsiveAction } from "./impulsive-guard.js";
export { esIntocable, textoIntocable } from "./intocables.js";
export {
  buildHumanVerifyButton,
  parseHumanVerifyCallback,
  parseJoinGateCommand,
} from "./join-gate.js";
export { detectJokeEscalation } from "./joke-escalation.js";
export { decideLastChance } from "./last-chance.js";
export { buildLearningNotice } from "./learning-notice.js";
export { decideLinkSandbox } from "./link-sandbox.js";
export { securityManifest } from "./manifest.js";
export type { DestructiveAction } from "./mass-action-guard.js";
export {
  detectMassAction,
  massActionWithinWindow,
} from "./mass-action-guard.js";
export { isActiveChatMember, isJoinTransition } from "./membership-gate.js";
export { shieldFromMentions } from "./mention-shield.js";
export type { ModerationAction } from "./moderation-command.js";
export { parseModerationCommand } from "./moderation-command.js";
export { parseModerationExtraCommand } from "./moderation-extra.js";
export { parseModerationPlusCommand } from "./moderation-plus.js";
export { detectMultiAccountJoin } from "./multi-account-join.js";
export { detectNewDomain } from "./new-domain.js";
export { buildObservationDiagnosis } from "./observe-diagnosis.js";
export { detectOperationalBias } from "./operational-bias.js";
export { rulesForOwnerAbsent } from "./owner-absent.js";
export { detectPassiveAggressive } from "./passive-aggressive.js";
export { requiresPeerReview } from "./peer-admin-review.js";
export type { AdminPerms } from "./permission-audit.js";
export {
  buildAdminOversightReport,
  findExcessPermissions,
  isModerationAction,
} from "./permission-audit.js";
export { classifyPowerChange, describePowerAlert } from "./power-watch.js";
export { assessProportionality } from "./proportionality.js";
export { decideQuarantine } from "./quarantine-pattern.js";
export type { ReactionModerationConfig } from "./reaction-moderation.js";
export {
  classifyReactionModeration,
  isReactionSurge,
  MAX_SURGE_THRESHOLD,
  parseReactionModerationConfig,
  REACTION_MODERATION_SETTING_KEY,
  resolveEnforceOutcome,
  SUGGESTED_ABUSIVE_REACTIONS,
} from "./reaction-moderation.js";
export {
  InMemoryBotPermissionCache,
  InMemoryOncePerWindowGate,
  InMemoryReactionSurgeStore,
} from "./reaction-moderation-store.js";
export { classifyRemorse } from "./remorse-signals.js";
export { assessReplyBait } from "./reply-bait.js";
export type { RoleActionGuardRole } from "./role-action-guard.js";
export { canPerformAction } from "./role-action-guard.js";
export type {
  CargoDelObjetivo,
  DecisionSobreAdmin,
  MotivoDeNegativa,
} from "./sanciones-a-admins.js";
export {
  ACCIONES_QUE_DEGRADAN,
  AVISO_DE_CARGO_DEVUELTO,
  AVISO_DE_CARGO_GUARDADO,
  AVISO_DE_CARGO_PERDIDO,
  cargoDelObjetivo,
  decidirSobreAdmin,
  textoAdminNoSancionable,
} from "./sanciones-a-admins.js";
export type { AdjustDirection, Sanction } from "./sanction-adjust.js";
export { adjustSanction } from "./sanction-adjust.js";
export { computeSanctionDurationMs } from "./sanction-duration.js";
export { predictSanctionEffect } from "./sanction-effect.js";
export {
  formatSanctionReasonList,
  parseSanctionReasonCommand,
  resolveSanctionReason,
} from "./sanction-reasons.js";
export { buildSanctionSignature } from "./sanction-signature.js";
export type {
  SanctionsLogAction,
  SanctionsLogSettings,
} from "./sanctions-log.js";
export {
  buildSanctionsLogEntry,
  formatSanctionsLogState,
  parseSanctionsLogCommand,
  parseSanctionsLogSettings,
  SANCTIONS_LOG_SETTINGS_KEY,
} from "./sanctions-log.js";
export { judgeScam } from "./scam-verdict.js";
export { detectSelfDealing } from "./self-dealing.js";
export { classifyThreadSensitivity } from "./sensitive-thread.js";
export { classifySeverityColor } from "./severity-color.js";
export {
  buildShortenerSignal,
  classifyDomain,
  normalizeDomain,
} from "./shortener-quarantine.js";
export { detectSignatureSpam } from "./signature-spam.js";
export { detectSilentSpam } from "./silent-spam.js";
export { detectSocialManipulation } from "./social-manipulation.js";
export { detectSpoiler } from "./spoiler-filter.js";
export { computeStaffConfidence } from "./staff-confidence.js";
export type { Shift } from "./staff-shift.js";
export {
  buildOnDutyReply,
  onDutyStaff,
  parseShiftCommand,
} from "./staff-shift.js";
export { detectStaleStaffRoles } from "./stale-staff.js";
export {
  formatTolerancePreset,
  parseToleranceCommand,
  resolveTolerancePreset,
} from "./tolerance-presets.js";
export type { TopicScopedConfig } from "./topic-scoping.js";
export { parseTopicScopeCommand, resolveTopicConfig } from "./topic-scoping.js";
export { isSeparationActive } from "./user-separation.js";
export type { WarnMode, WarnPolicy } from "./warn-policy.js";
export {
  buildRemoveWarnButton,
  decideWarnEscalation,
  formatWarnPolicy,
  parseCompactDuration,
  parseRemoveWarnCallback,
  parseWarnConfigCommand,
} from "./warn-policy.js";

/**
 * La API publica de `modules/community`.
 *
 * Se nombra lo que sale, en vez de `export * from`, a proposito.
 *
 * Con `export *` el modulo publicaba sus 812 simbolos; desde fuera se
 * usan 268. El resto era superficie publica sin consumidor: mientras lo
 * fuera, mover o renombrar un detalle interno era un cambio incompatible en
 * potencia, y nadie podia saber cual sin buscar por todo el repo.
 *
 * El test de arquitectura ya prohibe entrar por un subcamino
 * (`@superbot/module-community/src/...`), asi que esta lista **es** la
 * frontera: lo que no este aqui no lo puede tocar nadie de fuera.
 *
 * Los ficheros siguen exportando sus simbolos con `export` normal — los tests
 * del propio modulo los importan por ruta relativa y deben seguir pudiendo. Lo
 * que se recorta es lo que sale por aqui, que es lo que ve el resto.
 *
 * Al anadir algo, la pregunta es quien lo consume desde fuera. Si no hay nadie,
 * no entra.
 */

export { detectAbandonedGroup } from "./abandoned-group.js";
export {
  buildActivityHeatmap,
  formatHeatmap,
  peakHour,
} from "./activity-heatmap.js";
export {
  buildAfkClearReply,
  buildAfkNotice,
  buildAfkSetReply,
  extractMentions,
  formatAfkDuration,
  parseAfkCommand,
} from "./afk.js";
export {
  buildAfkAwayNotice,
  buildAfkReturnNotice,
  detectAfkPhrase,
} from "./afk-phrases.js";
export {
  dayKeyFromMs,
  formatTopPosters,
  parseStatsCommand,
  sumRecentMessages,
} from "./analytics.js";
export { registrarActividadDeChat } from "./bot/handlers/actividad.js";
export { archivarMensaje } from "./bot/handlers/archivo.js";
export { calculadoraDeChecklistDeBienvenida } from "./bot/handlers/calculadora-de-bienvenida.js";
export {
  calculadoraDeAvisoEducativo,
  calculadoraDeAyudaDiscreta,
  calculadoraDeCelebracionSilenciosa,
  calculadoraDeComparacionDeGemelos,
  calculadoraDeConsejosDeCrecimiento,
  calculadoraDeDesbloqueoDeEnlaces,
  calculadoraDeEfectoDeRegla,
  calculadoraDeEstabilidadSocial,
  calculadoraDeExcesoDeConfig,
  calculadoraDeExplicacionDePermiso,
  calculadoraDeGrupoAbandonado,
  calculadoraDeIntencionDeConfig,
  calculadoraDeMedidorDeHype,
  calculadoraDeObjetivoDeMiembro,
  calculadoraDePeriodoDePrueba,
  calculadoraDeRecomendacionPorTamano,
  calculadoraDeReglaNatural,
  calculadoraDeRelecturaObligatoria,
  calculadoraDeRetencionDeJuegos,
  calculadoraDeRompehielo,
  calculadoraDeSancionSuavizada,
  calculadoraDeSeveridadDeRegla,
  calculadoraDeStatsHumanizadas,
  calculadoraDeUsoIndebidoDeTopic,
} from "./bot/handlers/calculadoras-de-comunidad.js";
export {
  calculadoraDeChecklistDeOwner,
  calculadoraDeMentorDeOwner,
  calculadoraDeResumenDeOwner,
} from "./bot/handlers/calculadoras-de-owner.js";
export { aplicarHorarioEstricto } from "./bot/handlers/horario-estricto.js";
export {
  informeDeAbusoDeReacciones,
  informeDeMapaDeCalor,
  informeDeParticipacion,
  informeDeSenalDeAcoso,
} from "./bot/handlers/informes-de-actividad.js";
export {
  informeDeFantasmas,
  informeDeMiembrosInactivos,
} from "./bot/handlers/informes-de-presencia.js";
export {
  informeDeAccionesRevertidas,
  informeDeBusquedaDeRegla,
  informeDeReglasEnMovil,
  informeDeReglasRotas,
  informeDeTableroDeCasos,
  informeDeTiposDeConflicto,
  normasDelTexto,
} from "./bot/handlers/informes-de-reglas.js";
export {
  informeDeCrossposting,
  informeDeTemasEmergentes,
  informeDeTemasInactivos,
} from "./bot/handlers/informes-de-temas.js";
export {
  applyBotVoice,
  BOT_VOICES,
  isBotVoice,
  parseVoiceCommand,
} from "./bot-voice.js";
export { rankBrokenRules } from "./broken-rules-ranking.js";
export type { BoardCase, CasePriority } from "./case-board.js";
export { boardCounts, orderBoard } from "./case-board.js";
export { parseAliasCommand } from "./command-alias.js";
export { expandConfigMode, parseConfigModeCommand } from "./config-presets.js";
export { tallyConflictTypes } from "./conflict-types.js";
export {
  addMissionProgress,
  coopMissionRemaining,
  missionPercent,
} from "./coop-missions.js";
export { detectCrossposting } from "./crossposting.js";
export { parseCustomCommandConfig } from "./custom-commands.js";
export {
  DENSITY_MODES,
  isDensityMode,
  resolveDensity,
} from "./density-mode.js";
export { routeDiscreetHelp } from "./discreet-help.js";
export { DEFAULT_DOCK, resolveDock, toggleFavorite } from "./dock-config.js";
export { detectDogpiling } from "./dogpiling.js";
export { detectDormantMembers } from "./dormant-members.js";
export { detectDramaticExit } from "./dramatic-exit.js";
export { buildEducationalNotice } from "./educational-notice.js";
export { detectDeadTopics, detectEmergingTopics } from "./emerging-topics.js";
export { matchFilter, parseFilterCommand } from "./filters.js";
export type { RpsChoice } from "./fun.js";
export {
  botRpsChoice,
  buildFunReply,
  buildRpsReply,
  parseFunCommand,
  parseRpsCallback,
  rpsOutcome,
} from "./fun.js";
export { computeGamesRetention } from "./games-retention.js";
export { findGhostMembers } from "./ghost-members.js";
export {
  parseGiveawayCommand,
  parseGiveawayJoin,
  pickWinner,
} from "./giveaways.js";
export { parseGlossaryCommand } from "./group-glossary.js";
export { suggestGrowthTips } from "./growth-tips.js";
export { topContributions } from "./hall-of-fame.js";
export { humanizeDailyStats } from "./humanized-stats.js";
export { computeHypeLevel } from "./hype-meter.js";
export {
  langDisplayName,
  normalizeLang,
  parseLangCommand,
  SUPPORTED_LANGS,
  t,
} from "./i18n.js";
export {
  isIcebreakerTopic,
  listIcebreakerTopics,
  pickIcebreaker,
} from "./icebreakers.js";
export { buildIdGroupReply } from "./id-group.js";
export type { VotedIdea } from "./idea-voting.js";
export { rankVotedIdeas } from "./idea-voting.js";
export { detectIdleTopics } from "./idle-topics.js";
export type { InlineResult } from "./inline.js";
export { buildInlineHelpResult, buildInlineResults } from "./inline.js";
export type { CommunityIntent } from "./intent-config.js";
export { mapIntentToConfig } from "./intent-config.js";
export { matchByInterest, parseInterestCommand } from "./interest-tags.js";
export type {
  IntroductionSettings,
  IntroductionWarnCount,
} from "./introduction.js";
export {
  buildIntroductionAccepted,
  buildIntroductionForgiven,
  buildIntroductionKickNotice,
  buildIntroductionMirrorCard,
  buildIntroductionMirrorKeyboard,
  buildIntroductionPrompt,
  buildIntroductionStaffAutoResolved,
  buildIntroductionStaffCard,
  buildIntroductionStaffKeyboard,
  buildIntroductionStaffResolved,
  buildIntroductionWarnNotice,
  buildRepresentNotice,
  checkIntroduction,
  escapeHtml,
  formatIntroductionMirrorState,
  INTRODUCTION_ADMIN_USAGE,
  INTRODUCTION_SETTINGS_KEY,
  INTRODUCTION_STAFF_STALE,
  INTRODUCTION_WARN_REASON,
  mentionHtml,
  parseIntroductionAdminCommand,
  parseIntroductionMirrorCommand,
  parseIntroductionSettings,
  parseIntroductionStaffCallback,
} from "./introduction.js";
export { countInvitedMembers, parseInviteCommand } from "./invites.js";
export { canUnlockLinks } from "./link-unlock.js";
export { decideMandatoryReread } from "./mandatory-reread.js";
export type { MemberGoal } from "./member-goal.js";
export { mapMemberGoalToOnboarding } from "./member-goal.js";
export {
  buildAdminAlertMessages,
  buildMentionAllMessages,
  parseMentionAdmins,
  parseMentionAll,
} from "./mention-all.js";
export { crossedMilestone, formatMilestone } from "./milestones.js";
export {
  DEFAULT_MODULE_NAMES,
  resolveModuleName,
  sanitizeModuleName,
} from "./module-rename.js";
export { suggestQuietVoices } from "./monopoly-balance.js";
export { parseNaturalRule } from "./nl-rule-parser.js";
export {
  detectNoteRecall,
  normalizeNoteName,
  parseNotesCommand,
} from "./notes.js";
export {
  parseNotesImport,
  parseNotesPortCommand,
  serializeNotes,
} from "./notes-extra.js";
export { buildFirstStepsChecklist } from "./onboarding-checklist.js";
export { checkOverConfiguration } from "./over-config-warning.js";
export { buildOwnerChecklist } from "./owner-checklist.js";
export { suggestOwnerMentorTips } from "./owner-mentor.js";
export { buildOwnerSummary } from "./owner-summary.js";
export { detectMonopoly, participationGini } from "./participation-balance.js";
export { explainPermission } from "./permission-explainer.js";
export type { PollVote } from "./polls.js";
export {
  formatPollResults,
  parsePollCommand,
  parsePollVote,
  tallyVotes,
} from "./polls.js";
export { isOnProbation } from "./probation.js";
export { buildProtectionSummaryReply } from "./protection-summary.js";
export {
  formatQuizLeaderboard,
  isQuizCorrect,
  isQuizScoresCommand,
  orderQuizOptions,
  parseQuizAnswer,
  parseQuizCommand,
} from "./quizzes.js";
export {
  buildQuotePayload,
  extractQuoteSource,
  parseQuoteCommand,
} from "./quotes.js";
export {
  buildNoRankReply,
  buildRankAnnouncement,
  buildRankReply,
  isPromotion,
  RANKS,
  rankFor,
} from "./ranks.js";
export { detectReactionAbuse } from "./reaction-abuse.js";
export {
  buildReactionKeyboard,
  parseReactCommand,
  parseReactionCallback,
} from "./reactions.js";
export type {
  ReportMirrorEntry,
  ReportMirrorSettings,
} from "./report-mirror.js";
export {
  buildReportMirrorCard,
  buildReportMirrorKeyboard,
  buildReportResolveCallback,
  buildReportResolved,
  buildReportResolvedKeyboard,
  buildTelegramMessageLink,
  formatReportMirrorState,
  parseReportMirrorCommand,
  parseReportMirrorSettings,
  parseReportResolveCallback,
  REPORT_MIRROR_FORBIDDEN,
  REPORT_MIRROR_SETTINGS_KEY,
} from "./report-mirror.js";
export { levelForXp, parseReputationCommand } from "./reputation.js";
export { rankRevertedActions } from "./reverted-actions-ranking.js";
export { buildTemplateReply } from "./rich-template.js";
export type { Ritual } from "./rituals.js";
export { dueRituals, formatRitual, parseRitualCommand } from "./rituals.js";
export { computeRuleActivityEffect } from "./rule-activity-effect.js";
export type { RuleSeverityLevel } from "./rule-severity.js";
export { classifyRuleSeverity } from "./rule-severity.js";
export { buildRulesClarityReply } from "./rules-clarity.js";
export { summarizeRulesMobile } from "./rules-mobile.js";
export { searchRules } from "./rules-search.js";
export type { HuntState } from "./scavenger-hunt.js";
export { advanceHunt, checkHuntClue, huntProgress } from "./scavenger-hunt.js";
export type { TimeRule } from "./scheduled-rules.js";
export {
  formatTimeRuleWindow,
  isStrictAtHour,
  parseScheduledRuleCommand,
} from "./scheduled-rules.js";
export { computeRunAtMs, parseScheduleCommand } from "./scheduling.js";
export type { SeasonAlbumEntry } from "./season-album.js";
export { buildSeasonAlbum } from "./season-album.js";
export {
  buildMiniAppLink,
  buildSettingsDeepLink,
  CAPTCHA_FAIL_ACTIONS,
  CAPTCHA_MODES,
  clampFloodLimit,
  FLOOD_ACTIONS,
  FLOOD_LIMIT_MAX,
  FLOOD_LIMIT_MIN,
  isLockTypeValue,
  LOCK_TYPES,
  nextCaptchaFailAction,
  nextCaptchaMode,
  nextFloodAction,
  nextRaidMode,
  parseSettingsCallback,
  parseSettingsStart,
  renderCaptchaPanel,
  renderFloodPanel,
  renderLocksPanel,
  renderRaidPanel,
  renderRulesPanel,
  renderSettingsClosed,
  renderSettingsRoot,
  renderWelcomePanel,
} from "./settings.js";
export { computeSilenceCurve } from "./silence-curve.js";
export { decideCelebrationMode } from "./silent-celebration.js";
export { recommendBySize } from "./size-recommendations.js";
export { computeSocialStability } from "./social-stability.js";
export { softenSanctionMessage } from "./softer-sanction-message.js";
export { detectTopicMisuse } from "./topic-misuse.js";
export type { TrustStats } from "./trust-tiers.js";
export {
  computeTrustTier,
  formatTrustTier,
  tierUnlocks,
} from "./trust-tiers.js";
export { compareTwinGroups } from "./twin-group-compare.js";
export type { DossierMembership } from "./user-dossier.js";
export {
  buildUserDossierKeyboard,
  formatUserDossier,
  INFO_USAGE,
  parseDossierCallback,
  parseInfoTarget,
} from "./user-dossier.js";
export {
  evaluateExpression,
  formatCalcResult,
  fromBase64,
  generatePassword,
  parseUtilityCommand,
  pickOption,
  sha256Hex,
  toBase64,
} from "./utilities.js";
export type { WelcomeButton, WelcomeButtonType } from "./welcome.js";
export {
  buildWelcomeInlineKeyboard,
  defaultWelcomeTemplate,
  parseWelcomeButtons,
  parseWelcomeCommand,
  WELCOME_ADMINS_CALLBACK,
  WELCOME_RULES_CALLBACK,
} from "./welcome.js";

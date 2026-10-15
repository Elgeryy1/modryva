import { AsyncLocalStorage } from "node:async_hooks";
import { randomInt, randomUUID } from "node:crypto";
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
  Optional,
} from "@nestjs/common";
import { evaluatePolicy } from "@superbot/auth";
import type {
  AiAccessRepository,
  AiAccessScope,
  AiRepository,
  AnalyticsRepository,
  AntifloodAction,
  AntifloodRepository,
  AntiraidMode,
  AntiraidRepository,
  AutomationAction,
  AutomationEvent,
  AutomationRepository,
  AyudanteSolicitudRepository,
  BotGrantedAdminRepository,
  CaptchaFailAction,
  CaptchaModeValue,
  CaptchaRepository,
  CargoGuardado,
  ChatActivityEntry,
  ChatActivityRepository,
  ChatSettingRepository,
  ChipRepository,
  ContentLockRepository,
  CoopMissionRepository,
  CustomCommandRepository,
  D1Repository,
  EconomyRepository,
  ExchangeRepository,
  FederationRepository,
  FeedbackRepository,
  FeedRepository,
  FileRepository,
  FiltersRepository,
  FoundationContext,
  FoundationRepository,
  GameRepository,
  GamificationMissionKind,
  GamificationRepository,
  GiveawayRepository,
  GratitudeRepository,
  GroupProtectionRepository,
  GuardianRepository,
  GuardianSettingsState,
  IncidentRepository,
  IntroductionRepository,
  InventoryItem,
  InventoryRepository,
  InviteRepository,
  MemberActivityProfileRow,
  MessageLogRepository,
  ModerationExtraRepository,
  ModerationRepository,
  NotesRepository,
  OwnerNetworkRepository,
  OwnerNetworkRiskRepository,
  OwnerNetworkRouteEventKind,
  PaymentRepository,
  PetRepository,
  PlatformRepository,
  PlatformUserBanRecord,
  PollRepository,
  ProductivityRepository,
  ReputationRepository,
  ScheduledPostRepository,
  SocialRepository,
  StaffNoteRepository,
  TicketRepository,
  VerificationSessionRecord,
  WebhookRepository,
  WelcomeRepository,
} from "@superbot/data";
import {
  AI_PACK_SUBSCRIPTION_PERIOD_SECONDS,
  AlwaysAllowAiAccessRepository,
  AyudanteSolicitudRepositoryPrisma,
  encryptManagedBotToken,
  GAMIFICATION_MISSION_KINDS,
  generateWebhookSecret,
  hashWebhookSecret,
  InMemoryAutomationRepository,
  InMemoryBotGrantedAdminRepository,
  InMemoryChatActivityRepository,
  InMemoryChatSettingRepository,
  InMemoryCoopMissionRepository,
  InMemoryD1Repository,
  InMemoryEconomyRepository,
  InMemoryFederationRepository,
  InMemoryFeedbackRepository,
  InMemoryGamificationRepository,
  InMemoryGratitudeRepository,
  InMemoryGuardianRepository,
  InMemoryIncidentRepository,
  InMemoryIntroductionRepository,
  InMemoryInventoryRepository,
  InMemoryMessageLogRepository,
  InMemoryOwnerNetworkRepository,
  InMemoryOwnerNetworkRiskRepository,
  InMemoryPlatformRepository,
  InMemorySocialRepository,
  InMemoryStaffNoteRepository,
  matchAutomation,
  PrismaExchangeRepository,
  PrismaGameMatchPlayerRepository,
  PrismaGameMatchRepository,
  PrismaPetRepository,
  prisma,
  tokenFingerprint,
} from "@superbot/data";
import type {
  ActorRole,
  BotReply,
  NormalizedReaction,
  ReactionContext,
  TelegramUpdateEnvelope,
  UserContext,
} from "@superbot/domain";
import {
  type AiProvider,
  buildAiMemorySystemHint,
  buildAiMessages,
  buildDmSystemHint,
  type DegradedModeDecision,
  type DegradedState,
  decideDegradedMode,
  describeMemory,
  extractAiMemoryFacts,
  extractMentionPrompt,
  formatDegradedNotice,
  memoryKeyForNote,
  parseAiCommand,
  parseRememberCommand,
  renderMemoryList,
  sanitizeAiInput,
  shouldAutoChat,
  truncateDmInput,
} from "@superbot/module-ai";
import {
  buildWebhookBody,
  calculadoraDeCooldownDeRegla,
  checkReviveSilence,
  decideReadOnly,
  type ExplicacionesDeReglaPort,
  type FuentesDeConfianzaPort,
  type ManualEvent,
  parseRssCommand,
  parseWebhookCommand,
  registrarExplicacionDeRegla,
  registrarReputacionDeFuente,
  rulesForDayPhase,
  rulesForExamMode,
  rulesForManualEvent,
  shouldActivateVolumeProtection,
  shouldCloseTopic,
} from "@superbot/module-automation";
import {
  addMissionProgress,
  advanceHunt,
  aplicarHorarioEstricto,
  applyBotVoice,
  archivarMensaje,
  botRpsChoice,
  buildAdminAlertMessages,
  buildAfkAwayNotice,
  buildAfkClearReply,
  buildAfkNotice,
  buildAfkReturnNotice,
  buildAfkSetReply,
  buildFunReply,
  buildIdGroupReply,
  buildInlineHelpResult,
  buildInlineResults,
  buildIntroductionAccepted,
  buildIntroductionForgiven,
  buildIntroductionMirrorCard,
  buildIntroductionMirrorKeyboard,
  buildIntroductionPrompt,
  buildIntroductionStaffCard,
  buildIntroductionStaffResolved,
  buildMentionAllMessages,
  buildMiniAppLink,
  buildNoRankReply,
  buildProtectionSummaryReply,
  buildQuotePayload,
  buildRankAnnouncement,
  buildRankReply,
  buildReactionKeyboard,
  buildReportMirrorCard,
  buildReportMirrorKeyboard,
  buildReportResolveCallback,
  buildReportResolved,
  buildReportResolvedKeyboard,
  buildRepresentNotice,
  buildRpsReply,
  buildRulesClarityReply,
  buildSeasonAlbum,
  buildSettingsDeepLink,
  buildTelegramMessageLink,
  buildTemplateReply,
  buildUserDossierKeyboard,
  buildWelcomeInlineKeyboard,
  calculadoraDeAvisoEducativo,
  calculadoraDeAyudaDiscreta,
  calculadoraDeCelebracionSilenciosa,
  calculadoraDeChecklistDeBienvenida,
  calculadoraDeChecklistDeOwner,
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
  calculadoraDeMentorDeOwner,
  calculadoraDeObjetivoDeMiembro,
  calculadoraDePeriodoDePrueba,
  calculadoraDeRecomendacionPorTamano,
  calculadoraDeReglaNatural,
  calculadoraDeRelecturaObligatoria,
  calculadoraDeResumenDeOwner,
  calculadoraDeRetencionDeJuegos,
  calculadoraDeRompehielo,
  calculadoraDeSancionSuavizada,
  calculadoraDeSeveridadDeRegla,
  calculadoraDeStatsHumanizadas,
  calculadoraDeUsoIndebidoDeTopic,
  checkHuntClue,
  checkIntroduction,
  clampFloodLimit,
  computeRunAtMs,
  computeTrustTier,
  coopMissionRemaining,
  countInvitedMembers,
  crossedMilestone,
  DEFAULT_DOCK,
  DEFAULT_MODULE_NAMES,
  DENSITY_MODES,
  type DossierMembership,
  dayKeyFromMs,
  defaultWelcomeTemplate,
  detectAfkPhrase,
  detectDramaticExit,
  detectNoteRecall,
  dueRituals,
  escapeHtml,
  evaluateExpression,
  expandConfigMode,
  extractMentions,
  extractQuoteSource,
  formatAfkDuration,
  formatCalcResult,
  formatIntroductionMirrorState,
  formatMilestone,
  formatPollResults,
  formatQuizLeaderboard,
  formatReportMirrorState,
  formatRitual,
  formatTimeRuleWindow,
  formatTopPosters,
  formatTrustTier,
  formatUserDossier,
  fromBase64,
  generatePassword,
  type HuntState,
  huntProgress,
  INFO_USAGE,
  INTRODUCTION_ADMIN_USAGE,
  INTRODUCTION_SETTINGS_KEY,
  INTRODUCTION_STAFF_STALE,
  type InlineResult,
  type IntroductionSettings,
  informeDeAbusoDeReacciones,
  informeDeAccionesRevertidas,
  informeDeBusquedaDeRegla,
  informeDeCrossposting,
  informeDeFantasmas,
  informeDeMapaDeCalor,
  informeDeMiembrosInactivos,
  informeDeParticipacion,
  informeDeReglasEnMovil,
  informeDeReglasRotas,
  informeDeSenalDeAcoso,
  informeDeTableroDeCasos,
  informeDeTemasEmergentes,
  informeDeTemasInactivos,
  informeDeTiposDeConflicto,
  isDensityMode,
  isLockTypeValue,
  isPromotion,
  isQuizCorrect,
  isQuizScoresCommand,
  isStrictAtHour,
  langDisplayName,
  levelForXp,
  matchByInterest,
  matchFilter,
  mentionHtml,
  missionPercent,
  nextCaptchaFailAction,
  nextCaptchaMode,
  nextFloodAction,
  nextRaidMode,
  normalizeNoteName,
  normasDelTexto,
  orderQuizOptions,
  parseAfkCommand,
  parseAliasCommand,
  parseConfigModeCommand,
  parseCustomCommandConfig,
  parseDossierCallback,
  parseFilterCommand,
  parseFunCommand,
  parseGiveawayCommand,
  parseGiveawayJoin,
  parseGlossaryCommand,
  parseInfoTarget,
  parseInterestCommand,
  parseIntroductionAdminCommand,
  parseIntroductionMirrorCommand,
  parseIntroductionSettings,
  parseIntroductionStaffCallback,
  parseInviteCommand,
  parseLangCommand,
  parseMentionAdmins,
  parseMentionAll,
  parseNotesCommand,
  parseNotesImport,
  parseNotesPortCommand,
  parsePollCommand,
  parsePollVote,
  parseQuizAnswer,
  parseQuizCommand,
  parseQuoteCommand,
  parseReactCommand,
  parseReactionCallback,
  parseReportMirrorCommand,
  parseReportMirrorSettings,
  parseReportResolveCallback,
  parseReputationCommand,
  parseRitualCommand,
  parseRpsCallback,
  parseScheduleCommand,
  parseScheduledRuleCommand,
  parseSettingsCallback,
  parseSettingsStart,
  parseStatsCommand,
  parseUtilityCommand,
  parseVoiceCommand,
  parseWelcomeButtons,
  parseWelcomeCommand,
  pickOption,
  pickWinner,
  RANKS,
  REPORT_MIRROR_FORBIDDEN,
  REPORT_MIRROR_SETTINGS_KEY,
  type ReportMirrorEntry,
  type ReportMirrorSettings,
  type Ritual,
  type RpsChoice,
  rankFor,
  rankVotedIdeas,
  registrarActividadDeChat,
  renderCaptchaPanel,
  renderFloodPanel,
  renderLocksPanel,
  renderRaidPanel,
  renderRulesPanel,
  renderSettingsClosed,
  renderSettingsRoot,
  renderWelcomePanel,
  resolveDensity,
  resolveDock,
  resolveModuleName,
  rpsOutcome,
  type SeasonAlbumEntry,
  sanitizeModuleName,
  serializeNotes,
  sha256Hex,
  sumRecentMessages,
  type TimeRule,
  type TrustStats,
  t,
  tallyVotes,
  tierUnlocks,
  toBase64,
  toggleFavorite,
  topContributions,
  type VotedIdea,
  WELCOME_ADMINS_CALLBACK,
  WELCOME_RULES_CALLBACK,
} from "@superbot/module-community";
import {
  type PlatformRoleName,
  parsePlatformCommand,
} from "@superbot/module-core";
import {
  defaultFilePolicy,
  parseFilesCommand,
  validateAttachment,
} from "@superbot/module-files";
import {
  applyTemporaryName,
  atenderComandoDeMascotas,
  availableItems,
  CASINO,
  type CasinoCommand,
  CHIP_PACKS,
  calculadoraDeCartaDeMiembro,
  calculadoraDeCompraDeCosmetico,
  calculadoraDeCooldownDinamico,
  calculadoraDeCupoDiario,
  calculadoraDeDobleReputacion,
  calculadoraDeDueloDeDebate,
  calculadoraDeGastoDeEnergia,
  calculadoraDeItemsLegendarios,
  calculadoraDeLogrosDeRacha,
  calculadoraDeLogrosNegativos,
  calculadoraDeLogrosSecretos,
  calculadoraDePatronImposible,
  calculadoraDePrestigio,
  calculadoraDeProgresoDeBoss,
  calculadoraDePruebaAntibot,
  calculadoraDeRachaSinSancion,
  calculadoraDeRecompensaColectiva,
  calculadoraDeSancionDeJuego,
  DOBLON_MULTIPLICADOR,
  describeBullseye,
  describeDuel,
  describeOverUnder,
  describeSlot,
  describirBotin,
  divisionForPoints,
  earnPoints,
  esComandoDeMascotas,
  esJugueteId,
  formatCurrency,
  formatRemaining,
  fusionarModificadores,
  GRATITUDE_PER_THANKS,
  GROUP_CURRENCY_SETTINGS_KEY,
  type GroupCurrencySettings,
  ganadorConMascotas,
  grantGratitude,
  groupThousands,
  isCorrectAnswer,
  isPurgeOpen,
  isShopItemId,
  JUGUETES,
  MUTE_ITEM_IDS,
  MUTE_MINUTES,
  type OwnedItem,
  PETS_SETTINGS_KEY,
  PURGE_SETTINGS_KEY,
  PURGE_STATE_KEY,
  type PurgePlay,
  parsearAjustes,
  parseCasinoCommand,
  parseGroupCurrencySettings,
  parsePurgeSettings,
  parsePurgeState,
  parseShopSettings,
  parseStealSettings,
  parseTriviaAnswer,
  parseTriviaCommand,
  pickQuestionIndex,
  priceOf,
  quotePurchase,
  rankGratitude,
  renderPurgeBoard,
  resolveBullseye,
  resolveDice,
  resolveDuel,
  resolveOverUnder,
  resolveSlot,
  resolveSteal,
  SEGURO_PCT,
  SHOP_BY_ID,
  SHOP_SETTINGS_KEY,
  type ShopItem,
  type ShopItemId,
  type ShopSettings,
  STEAL_SETTINGS_KEY,
  type StealModifiers,
  scoreStatGuess,
  separateRookieRanking,
  spentDefenceOf,
  stealEffectsOf,
  TRIVIA_QUESTIONS,
  topeDeCajaFuerte,
  usableItems,
  VAULT_STEP,
  ventajasDe,
  walletLevel,
} from "@superbot/module-games";
import {
  buildExpelConfirmKeyboard,
  buildManualReviewKeyboard,
  computeSessionIdempotencyKey,
  encryptJoinRequestQueryId,
  esArranqueDeAutoVerificacion,
  formatRetryTtl,
  formatTopicIdReply,
  GUARDIAN_RETRY_START_PREFIX,
  GUARDIAN_RETRY_TTL_SECONDS,
  generateChallengeNonce,
  generateGestureChallenge,
  generateSessionToken,
  hashSessionToken,
  isMirroredStaffCopy,
  parseGuardianCommand,
  parseGuardianRetryStart,
  parseStaffCallbackData,
  resolveEffectiveGuardianMode,
  STAFF_MIRROR_CALLBACK,
  validateGuardianSettings,
  verifyStaffCallback,
} from "@superbot/module-guardian";
import {
  buildInvoicePayload,
  parseInvoicePayload,
  parsePaymentCommand,
} from "@superbot/module-payments";
import {
  type AdminActionStore,
  type AdminPerms,
  type AntifloodSettings,
  type AntiraidSettings,
  APPOINTED_ADMIN_RIGHTS,
  APPOINTED_ADMIN_SETTINGS_KEY,
  type AppointedAdminCommandResult,
  accionParaModoDeBlocklist,
  adminActionKey,
  adminIdentitiesFrom,
  aplicarBloqueoDeContenido,
  type BotModeResolution,
  buildAdminOversightReport,
  buildHumanVerifyButton,
  buildImpersonationAlert,
  buildOnDutyReply,
  buildRemoveWarnButton,
  buildSanctionsLogEntry,
  type CaptchaSettings,
  calculadoraDeAcuerdoDeConvivencia,
  calculadoraDeAgrupacionDeReportes,
  calculadoraDeAjusteDeSancion,
  calculadoraDeAutoBeneficio,
  calculadoraDeAvisoDeAprendizaje,
  calculadoraDeCeboDeRespuesta,
  calculadoraDeChecklistDeBan,
  calculadoraDeColorDeSeveridad,
  calculadoraDeConfianzaDeDecision,
  calculadoraDeConfianzaDeStaff,
  calculadoraDeConversionDeSancion,
  calculadoraDeDesescalada,
  calculadoraDeDiagnosticoDeObservacion,
  calculadoraDeDominioNuevo,
  calculadoraDeDuracionDeSancion,
  calculadoraDeEfectoDeSancion,
  calculadoraDeEscudoDeMenciones,
  calculadoraDeFiltroDeSpoiler,
  calculadoraDeFirmaDeSancion,
  calculadoraDeGuardiaImpulsivo,
  calculadoraDeOwnerAusente,
  calculadoraDePatronDeCuarentena,
  calculadoraDePermiso,
  calculadoraDePermisoDeEmergencia,
  calculadoraDeProporcionalidad,
  calculadoraDeRangoDeAccion,
  calculadoraDeRazonDeSancion,
  calculadoraDeRevisionEntrePares,
  calculadoraDeSandboxDeEnlace,
  calculadoraDeSensibilidadDeCaso,
  calculadoraDeSensibilidadDeHilo,
  calculadoraDeSeparacionActiva,
  calculadoraDeSesgoOperativo,
  calculadoraDeSpamSilencioso,
  calculadoraDeUltimaOportunidad,
  calculadoraDeVentanaDeGracia,
  clasificarAdjuntoPeligroso,
  classifyMemberTransition,
  classifyPowerChange,
  classifyReactionModeration,
  classifyRemorse,
  crearReservaDeFlood,
  type DestructiveAction,
  debeBorrarPorCaracteres,
  debeBorrarPorModoNoche,
  decideWarnEscalation,
  decidirSobreEstafa,
  defaultAntifloodSettings,
  defaultAntiraidSettings,
  defaultCaptchaSettings,
  describeAdminGuardReason,
  describePowerAlert,
  detectarFugaDeDatos,
  detectImpersonation,
  detectMassAction,
  detectMultiAccountJoin,
  detectPassiveAggressive,
  detectSocialManipulation,
  detectStaleStaffRoles,
  esIntocable,
  evaluateAppointedAdmin,
  evaluateFlood,
  evaluateRaid,
  extractMentionTargetId,
  extractRepliedPhoto,
  extractReplyContext,
  type FloodCounterStore,
  findExcessPermissions,
  formatAdminList,
  formatCaseNote,
  formatFedInfo,
  formatFedStat,
  formatSanctionReasonList,
  formatSanctionsLogState,
  formatTolerancePreset,
  formatWarnPolicy,
  generateCaptchaChallenge,
  hashCaptchaAnswer,
  type ImpersonationIdentity,
  InMemoryAdminActionStore,
  InMemoryBotPermissionCache,
  InMemoryOncePerWindowGate,
  InMemoryReactionSurgeStore,
  informeDeCopiaPega,
  informeDeDiscusionCircular,
  informeDeEscaladaDeBroma,
  informeDeFirmasDeSpam,
  informeDeRitmoHumano,
  informeDeSpamDeSaludo,
  isActiveChatMember,
  isJoinTransition,
  isLockType,
  isModerationAction,
  isReactionSurge,
  isServiceMessage,
  judgeScam,
  LOCKABLE_TYPES,
  type LockType,
  MAX_SURGE_THRESHOLD,
  type ModerationAction,
  massActionWithinWindow,
  matchBlocklist,
  normalizeBlocklistTrigger,
  onDutyStaff,
  parseAdminToolCommand,
  parseAntifloodCommand,
  parseAntiraidCommand,
  parseAppointedAdminCommand,
  parseAppointedAdminSettings,
  parseBlocklistCommand,
  parseCaptchaCommand,
  parseCaseNoteCommand,
  parseCharFilterCommand,
  parseCompactDuration,
  parseFederationCommand,
  parseFedImport,
  parseHumanVerifyCallback,
  parseHygieneCommand,
  parseJoinGateCommand,
  parseLockCommand,
  parseModerationCommand,
  parseModerationExtraCommand,
  parseModerationPlusCommand,
  parseReactionModerationConfig,
  parseRemoveWarnCallback,
  parseSanctionReasonCommand,
  parseSanctionsLogCommand,
  parseSanctionsLogSettings,
  parseShiftCommand,
  parseToleranceCommand,
  parseTopicScopeCommand,
  parseWarnConfigCommand,
  REACTION_MODERATION_SETTING_KEY,
  type ReactionModerationConfig,
  resolveBotMode,
  resolveEnforceOutcome,
  resolveSanctionReason,
  resolveTolerancePreset,
  resolveTopicConfig,
  revisarEdicion,
  SANCTIONS_LOG_SETTINGS_KEY,
  type SanctionsLogAction,
  type SanctionsLogSettings,
  type Shift,
  serializeFedBans,
  type TopicScopedConfig,
  textoBlocklistAplicado,
  textoBlocklistSinAccion,
  textoDeVetoDeFban,
  textoIntocable,
  verifyCaptchaAnswer,
  vetoParaFbanear,
  type WarnMode,
  type WarnPolicy,
} from "@superbot/module-security";
import type { ModerationPort } from "@superbot/module-social";
import { systemClock } from "@superbot/module-social";
import {
  analyzeAnnouncement,
  apelacionesPorIncidente,
  aplicarCuarentena,
  automationMatches,
  buildAppealKeyboard,
  buildAppealLog,
  buildDoctorReport,
  buildFeedbackRelay,
  buildMissionCompletedText,
  buildQuarantineKeyboard,
  buildQuarantineLog,
  buildVerticalReply,
  calculadoraDeAnuncioSensible,
  calculadoraDeAnunciosPorRol,
  calculadoraDeApelacionDelicada,
  calculadoraDeAprendizajeDeApelacion,
  calculadoraDeAvisoDeMantenimiento,
  calculadoraDeBurnoutDeStaff,
  calculadoraDeCaducidadDeAnuncio,
  calculadoraDeCalidadDeDatos,
  calculadoraDeCategoriaDeApelacion,
  calculadoraDeComparacionDeMeses,
  calculadoraDeEnfado,
  calculadoraDeErrorDelBot,
  calculadoraDeEscaladaAHumano,
  calculadoraDeEscaladaAlOwner,
  calculadoraDeEstadoDeIncidencia,
  calculadoraDeEtaDeApelacion,
  calculadoraDeFueraDeTemaDeEstudio,
  calculadoraDeHorario,
  calculadoraDeIncidenciaConocida,
  calculadoraDeInformeDeLanzamiento,
  calculadoraDeMediacion,
  calculadoraDeModoAhorro,
  calculadoraDeNivelDeConocimiento,
  calculadoraDePeticionDeCopia,
  calculadoraDePreguntaCompleta,
  calculadoraDePuntuacionDeDuda,
  calculadoraDeResumenDeApelacion,
  calculadoraDeResumenDePublicacion,
  calculadoraDeSeguimientoDeTicket,
  calculadoraDeTratoVip,
  calculadoraDeVistaDeAnuncio,
  decodeConfigRecipe,
  diffConfigRecipe,
  encodeConfigRecipe,
  formatAppeals,
  formatAutomationList,
  formatBadges,
  formatEvents,
  formatMissionProgress,
  formatMissions,
  formatQuarantineList,
  formatReminderTime,
  formatStatusPage,
  historialDeApelaciones,
  informeDeApelacionesAceptadas,
  informeDeHistorialDeCliente,
  isDoctorCommand,
  parseAppealCallback,
  parseAppealCommand,
  parseAutomationCommand,
  parseD1LogCommand,
  parseFeedbackCommand,
  parseFeedbackOrigin,
  parseMissionCommand,
  parseNaturalReminder,
  parseQuarantineCallback,
  parseQuarantineCommand,
  parseReminderCommand,
  parseTaskCommand,
  parseTicketCommand,
  reminderRunAtMs,
} from "@superbot/module-support";
import type { RuntimeEnv } from "@superbot/shared";
import {
  // Aliased: module-community exports a same-named helper that always encodes a
  // `cfg_` payload, whereas this one takes any startapp param.
  buildMiniAppLink as buildNamedMiniAppLink,
  encodeAppointedAdminsStartParam,
  encodeConfigStartParam,
  encodeEconomyStartParam,
  encodePetStartParam,
  encodeRosterStartParam,
  encodeShopStartParam,
  ROSTER_ALL_START_PARAM,
  resolveGuardianMiniAppUrl,
  TELEGRAM_ALLOWED_UPDATES,
} from "@superbot/shared";
import type {
  QuoteRenderer,
  SpamCheckProvider,
  TelegramChatAdminInfo,
  TelegramChatMemberResult,
  TelegramGateway,
  TelegramManagedBotGateway,
  TelegramReactionActor,
} from "@superbot/telegram";
import {
  classifyJoinRequestFailure,
  normalizeUpdate,
} from "@superbot/telegram";
import {
  handleCoreCallback,
  handleCoreCommand,
  type MiniAppLink,
} from "./core-handlers.js";
import { CREADOR_TELEGRAM_ID, CREATOR_TELEGRAM_ID } from "./creador.js";
import {
  deliverBotReply,
  extractCallbackMessageBody,
  extractCallbackMessageId,
  extractChatMemberSubjectLabel,
} from "./delivery.js";
import type {
  NombreDeHandler,
  NombreDePostProcesador,
} from "./handler-names.js";
import { ChatGamesHandlers } from "./handlers/chat-games.js";
import { handleGamesHub } from "./handlers/games-hub.js";
import { SocialHandlers } from "./handlers/social.js";
import { botMetrics } from "./metrics.js";
import { crearAdaptadorDeMascotas } from "./nucleo/adaptador-mascotas.js";
import {
  archivoDeMensajesConRepositorio,
  explicacionesDeReglaConAjustes,
  fuentesDeConfianzaConAjustes,
  originalDeMensajeConRepositorio,
  registroDeActividadConRepositorio,
} from "./nucleo/adaptadores.js";
import { animarPorGratitud } from "./nucleo/animo-por-gratitud.js";
import {
  accionDeEscalada,
  devolverCargo,
  examinarObjetivo,
  notaDeCargo,
} from "./nucleo/cargos-de-admin.js";
import { darJuguete, textoDeJuguete } from "./nucleo/juguetes.js";
import {
  atenderEntradaEnElGrupo,
  atenderMandoDeAyudante,
  CLAVE_DE_AJUSTE as CLAVE_DE_AJUSTE_DE_AYUDANTE,
  type DependenciasDeAyudante,
} from "./nucleo/mandos-de-ayudante.js";
import { atenderMandoDeMascotas } from "./nucleo/mandos-de-mascotas.js";
import {
  modificadoresDeRoboDeLasMascotas,
  salvaElObjetoAlFallar,
} from "./nucleo/mascotas-en-el-robo.js";
import { trasUnRoboConExito } from "./nucleo/tras-el-robo.js";
import type {
  BotGuardDecision,
  BotHandlerInput,
  BotPostProcessor,
  BotPostProcessorInput,
  BotUpdateHandler,
} from "./pipeline.js";
import { readAppUrl } from "./runtime-url.js";
import {
  AI_ACCESS_REPOSITORY,
  AI_PROVIDER,
  AI_REPOSITORY,
  ANALYTICS_REPOSITORY,
  ANTIFLOOD_REPOSITORY,
  ANTIRAID_REPOSITORY,
  AUTOMATION_REPOSITORY,
  AYUDANTE_SOLICITUD_REPOSITORY,
  BOT_GRANTED_ADMIN_REPOSITORY,
  CAPTCHA_REPOSITORY,
  CHAT_ACTIVITY_REPOSITORY,
  CHAT_SETTING_REPOSITORY,
  CHIP_REPOSITORY,
  CONTENT_LOCK_REPOSITORY,
  COOP_MISSION_REPOSITORY,
  CUSTOM_COMMAND_REPOSITORY,
  D1_REPOSITORY,
  ECONOMY_REPOSITORY,
  EXCHANGE_REPOSITORY,
  FEDERATION_REPOSITORY,
  FEED_REPOSITORY,
  FEEDBACK_REPOSITORY,
  FILE_REPOSITORY,
  FILTERS_REPOSITORY,
  FLOOD_COUNTER,
  FOUNDATION_REPOSITORY,
  GAME_REPOSITORY,
  GAMIFICATION_REPOSITORY,
  GIVEAWAY_REPOSITORY,
  GRATITUDE_REPOSITORY,
  GROUP_PROTECTION_REPOSITORY,
  GUARDIAN_REPOSITORY,
  INCIDENT_REPOSITORY,
  INTRODUCTION_REPOSITORY,
  INVENTORY_REPOSITORY,
  INVITE_REPOSITORY,
  MESSAGE_LOG_REPOSITORY,
  MODERATION_EXTRA_REPOSITORY,
  MODERATION_REPOSITORY,
  NOTES_REPOSITORY,
  OWNER_NETWORK_REPOSITORY,
  OWNER_NETWORK_RISK_REPOSITORY,
  PAYMENT_REPOSITORY,
  PLATFORM_REPOSITORY,
  POLL_REPOSITORY,
  PRODUCTIVITY_REPOSITORY,
  QUOTE_RENDERER,
  REPUTATION_REPOSITORY,
  RUNTIME_ENV,
  SCHEDULED_POST_REPOSITORY,
  SOCIAL_REPOSITORY,
  SPAM_CHECK_PROVIDER,
  STAFF_NOTE_REPOSITORY,
  TELEGRAM_GATEWAY,
  TICKET_REPOSITORY,
  WEBHOOK_REPOSITORY,
  WELCOME_REPOSITORY,
} from "./tokens.js";

const configuredPlatformAdminRoles: readonly PlatformRoleName[] = [
  "promo_admin",
  "bot_factory_admin",
  "auditor",
];

/** Emergency-only Telegram account allowed to start a group evacuation. */
const NUKE_OWNER_TELEGRAM_ID = CREADOR_TELEGRAM_ID;

export interface BotWebhookResult {
  readonly ok: true;
  readonly updateId: number;
  readonly duplicate: boolean;
  readonly handled: boolean;
  readonly replyDelivered: boolean;
}

const extractCallbackQueryId = (raw: unknown): string | undefined => {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }

  const callbackQuery = (raw as { callback_query?: unknown }).callback_query;

  if (typeof callbackQuery !== "object" || callbackQuery === null) {
    return undefined;
  }

  const id = (callbackQuery as { id?: unknown }).id;

  return typeof id === "string" ? id : undefined;
};

/**
 * The text of the message being replied to (used to recover the feedback origin
 * marker from a staff reply). Undefined when there is no reply text.
 */
const extractReplyText = (raw: unknown): string | undefined => {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }
  const message = (raw as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) {
    return undefined;
  }
  const reply = (message as { reply_to_message?: unknown }).reply_to_message;
  if (typeof reply !== "object" || reply === null) {
    return undefined;
  }
  const text = (reply as { text?: unknown }).text;
  return typeof text === "string" ? text : undefined;
};

/** A human display name for casino UI: first name, else @username, else a fallback. */
const casinoDisplayName = (update: TelegramUpdateEnvelope): string =>
  update.user.firstName ??
  (update.user.username ? `@${update.user.username}` : "Jugador");

const formatPlatformBanDate = (date: Date | null | undefined): string =>
  date ? `${date.toISOString().replace("T", " ").slice(0, 16)} UTC` : "nunca";

const platformBanNotice = (ban: PlatformUserBanRecord): string =>
  [
    "Acceso bloqueado en Modryva.",
    `Motivo: ${ban.reason}`,
    `Baneado el: ${formatPlatformBanDate(ban.bannedAt)}`,
    `Hasta: ${ban.expiresAt ? formatPlatformBanDate(ban.expiresAt) : "permanente"}`,
    "",
    "No puedes usar comandos, juegos, casino, Mini Apps ni bots hijos mientras dure el ban.",
  ].join("\n");

const platformBanGroupNotice = (ban: PlatformUserBanRecord): string =>
  [
    "Aviso: el administrador que me ha añadido está baneado de la plataforma Modryva.",
    `Motivo: ${ban.reason}`,
    `Baneado el: ${formatPlatformBanDate(ban.bannedAt)}`,
    `Hasta: ${ban.expiresAt ? formatPlatformBanDate(ban.expiresAt) : "permanente"}`,
    "",
    "Ese administrador no podra usar el bot ni la Mini App. El resto del grupo puede usarlo normalmente.",
  ].join("\n");

const parseTelegramUserIdArg = (value: string | undefined): bigint | null =>
  value && /^\d+$/u.test(value) ? BigInt(value) : null;

const PLATFORM_BAN_USAGE =
  "Uso: /banbotuser <telegram_id> [tiempo: 30m|2h|7d|4w] [motivo]";

const isGamificationMissionKind = (
  value: string,
): value is GamificationMissionKind =>
  (GAMIFICATION_MISSION_KINDS as readonly string[]).includes(value);

const TOPIC_LOCK_CONFIG_KEY = "topic_lock_config";

/**
 * The only person /bdani answers to. Everyone else gets silence — see the gate
 * in the roster branch for why refusing out loud would itself leak something.
 *
 * A hardcoded id rather than a setting on purpose: the whole point is that this
 * cannot be widened from inside a group, by an admin, or through the Mini App.
 * Changing it means changing this line.
 */
const ROSTER_COMMAND_OWNER_ID = CREADOR_TELEGRAM_ID;

/**
 * How to name a person in a message everyone will read.
 *
 * Most people have no @username, and falling straight from "no username" to the
 * raw numeric id printed "9000000004 sube al nivel 1!" in a real group — a
 * number nobody recognises, least of all the person it is congratulating. Their
 * first name is always there; the id is a last resort that should now be
 * unreachable in practice.
 */
const describeUser = (user: {
  readonly username?: string | undefined;
  readonly firstName?: string | undefined;
  readonly lastName?: string | undefined;
  readonly userId?: bigint | undefined;
}): string => {
  if (user.username) {
    return `@${user.username}`;
  }
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name.length > 0 ? name : (user.userId?.toString() ?? "alguien");
};

/** Per-chat JSON shape stored under TOPIC_LOCK_CONFIG_KEY via chatSettingRepository. */
type TopicLockConfig = TopicScopedConfig<{
  readonly lockedTypes: readonly string[];
}>;

const EMPTY_TOPIC_LOCK_CONFIG: TopicLockConfig = {
  base: { lockedTypes: [] },
  overrides: {},
};

const isTopicLockConfig = (value: unknown): value is TopicLockConfig => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as { base?: unknown; overrides?: unknown };
  if (typeof candidate.base !== "object" || candidate.base === null) {
    return false;
  }
  if (
    !Array.isArray((candidate.base as { lockedTypes?: unknown }).lockedTypes)
  ) {
    return false;
  }
  return (
    typeof candidate.overrides === "object" && candidate.overrides !== null
  );
};

/** Bot mode used when there is no group context (private chats etc.): run
 * everything — the individual handlers self-noop when they don't apply. */
const ALL_ENABLED_BOT_MODE: BotModeResolution = {
  moderation: true,
  cleanup: true,
  messages: true,
  commands: true,
};

/**
 * Handlers in the botHandlers() chain that the per-group "bot mode" (see
 * resolveBotMode) can switch off. Each name maps to the mode flag that must be
 * TRUE for the handler to run; when it is false the dispatcher skips the handler
 * — behaviourally identical to it returning null, so the chain simply continues.
 *
 * Handlers ABSENT from this map always run — notably games (casino/trivia/quiz/
 * fun/utility), Guardian (join-request/guardian.*), settings/config, economy,
 * rankings, polls, payments, AI and every DM interaction. Explicitly-configured
 * content features (custom commands, keyword filters, note recall) are also left
 * on: passive mode silences autonomous moderation, cleanup and unsolicited
 * social posts, not features an admin deliberately wired up.
 *
 * Mixed handlers that do several of these at once (members.new, join-request,
 * chat-member.update) are NOT listed; they run and gate internally.
 */
/**
 * Los handlers cuyo fallo NO debe abortar el update.
 *
 * Aislar un handler no significa tragarse su error y seguir como si nada: eso
 * convertiria un fallo de moderacion en un update aparentemente correcto. Por
 * eso la regla por defecto es la contraria — **si un handler falla, se aborta
 * el update y se reintenta** — y la tolerancia hay que declararla aqui, una a
 * una y con nombre tipado.
 *
 * Solo entran handlers cuyo trabajo es puramente accesorio: registran o
 * archivan, no deciden nada y no responden a nadie. Si uno de esos revienta,
 * lo caro es dejar sin respuesta a la persona que escribio; el registro que se
 * pierde es un dato de telemetria, no una decision.
 *
 * Todo lo demas —comandos, moderacion, guardian, economia, callbacks— aborta
 * la cadena a proposito.
 */
const HANDLERS_TOLERANTES: ReadonlySet<NombreDeHandler> = new Set([
  "chat-activity.logger",
  "message-log.archive",
]);

/**
 * Un id de Telegram sacado de un argumento, o `undefined` si no lo era.
 *
 * `BigInt("pepe")` **lanza**, y estos comandos no son tolerantes: el error se
 * propaga, el update no se confirma y Telegram lo reentrega tres veces,
 * re-ejecutando todo el pipeline anterior. Acaba como `descartado`, que segun
 * `CLAUDE.md` significa "hay algo roto de verdad" — o sea que ademas ensucia
 * justo la metrica que existe para avisar de fallos reales.
 *
 * Y lo dispara cualquier miembro sin permisos, escribiendo
 * `/historial_cliente pepe`.
 *
 * El patron seguro ya estaba escrito tres veces en este mismo fichero; estos
 * dos sitios se lo saltaban.
 */
const idDeTelegramDelArgumento = (crudo: string | undefined) =>
  // 19 digitos y no 20: el maximo de un int8 de Postgres tiene 19, asi que
  // con 20 el valor entra en la consulta y revienta al escribir. Es el mismo
  // fallo que este ayudante existe para evitar, una cifra mas lejos.
  crudo !== undefined && /^\d{1,19}$/u.test(crudo) ? BigInt(crudo) : undefined;
/**
 * Los comandos de informe de `handleDataReportsCommand`.
 *
 * Existe para poder pedir permisos **una vez**, arriba, en vez de repetir la
 * comprobacion en los 25 `case`. Y para que el conjunto sea una lista y no un
 * `switch`: anadir un informe nuevo sin meterlo aqui hace que el comando no
 * responda, que es ruidoso y se ve enseguida — al reves que olvidarse de la
 * guarda, que no se ve nunca.
 */
const COMANDOS_DE_INFORME: ReadonlySet<string> = new Set([
  "informe_apelaciones_aceptadas",
  "historial_apelaciones",
  "apelaciones_por_incidente",
  "buscar_regla",
  "reglas_movil",
  "historial_cliente",
  "mapa_calor",
  "participacion",
  "senal_acoso",
  "spam_firma",
  "crossposting",
  "temas_emergentes",
  "temas_inactivos",
  "fantasmas",
  "reaccion_abuso",
  "discusion_circular",
  "copia_pega",
  "spam_saludo",
  "ritmo_humano",
  "escalada_broma",
  "tipos_conflicto",
  "reglas_rotas",
  "miembros_inactivos",
  "acciones_revertidas",
  "tablero_casos",
]);
/**
 * Los comandos de `handleUtilityPlusCommand` que CAMBIAN algo y por tanto
 * exigen ser admin.
 *
 * Contexto de por que existe esta lista: ese metodo son 2.095 lineas con 124
 * `case` y **no tenia ni una sola comprobacion de permisos**. Entre esos 124
 * hay 8 que escriben: seis tocan ajustes de moderacion del chat, uno cierra un
 * tema del foro, y `/modo_solo_lectura` llama a `setChatPermissions` dejando el
 * grupo entero mudo. Todos estan publicados en el menu `/` de Telegram, o sea
 * que cualquier miembro los veia y los podia ejecutar. `utility-plus.command`
 * tampoco esta en `GATED_HANDLERS`, asi que el modo pasivo no los frenaba.
 *
 * Los otros 116 `case` son calculadoras: reciben argumentos, devuelven texto y
 * no escriben nada. Se dejan como estaban a proposito — esto es un arreglo de
 * autorizacion, no un rediseno del comando.
 *
 * `apps/bot/src/utility-plus-permisos.test.ts` comprueba contra la fuente que
 * esta lista sigue cubriendo TODOS los `case` con efecto secundario, de modo
 * que anadir un comando que escriba sin meterlo aqui rompe el test.
 */
const COMANDOS_UTILITY_PLUS_CON_EFECTO: ReadonlySet<string> = new Set([
  "fase_dia",
  "reputacion_contenido",
  "modo_evento",
  "modo_examen",
  "modo_solo_lectura",
  "validar_explicacion",
  "cerrar_topic",
  "activar_proteccion_volumen",
]);

const GATED_HANDLERS: Readonly<
  Partial<Record<NombreDeHandler, keyof BotModeResolution>>
> = {
  // THREAD 1 — autonomous sanctions / deletions / gates.
  "edit-guard.ambient": "moderation",
  "scheduled-strict.ambient": "moderation",
  "membership-gate.check": "moderation",
  "content-lock.ambient": "moderation",
  "blocklist.ambient": "moderation",
  "char-filter.ambient": "moderation",
  "dangerous-file.ambient": "moderation",
  "privacy-leak.ambient": "moderation",
  "scam-signals.ambient": "moderation",
  "social-signals.ambient": "moderation",
  "night-mode.ambient": "moderation",
  "automation.ambient": "moderation",
  "quarantine.ambient": "moderation",
  "antiflood.message": "moderation",
  // Autonomous reaction removal (Bot API deleteMessageReaction): a THREAD-1
  // sanction, so passive/GroupHelp-coexistence mode (moderation off) must silence
  // it too — handleReactionModeration has no internal mode gate of its own.
  "reaction.moderate": "moderation",
  // THREAD 2 — Telegram service/join/leave message cleanup.
  "service-message.clean": "cleanup",
  // THREAD 3 — unsolicited social posts.
  "members.left": "messages",
  "afk.ambient": "messages",
  "bot.onboarding": "messages",
  // The automatic pole announces itself without being asked, so a group
  // coexisting with another bot must be able to silence it like the rest.
  // /pole typed by a person is a COMMAND and stays available.
  "social.auto-pole": "messages",
  // Moderation COMMANDS — only the master passive switch removes these
  // (commands === !passiveMode); the category toggles leave them available.
  "moderation.command": "commands",
  "moderation-plus.command": "commands",
  "moderation-extra.command": "commands",
  "antiflood.command": "commands",
  "antiraid.command": "commands",
  "warn-config.command": "commands",
  "blocklist.command": "commands",
  "locks.command": "commands",
  "topic-locks.command": "commands",
  "char-filter.command": "commands",
  "join-gate.command": "commands",
  "federation.command": "commands",
  "admin-tool.command": "commands",
  "d1.quarantine-command": "commands",
  // Putting words in the bot's mouth is an admin action, and a group that has
  // handed moderation to another bot expects Modryva to stay quiet.
  "bot-voice.send-command": "commands",
};

/** Post-processors gated the same way. Automations (ECA) can autonomously
 * sanction, so they follow the moderation flag. */
const GATED_POSTPROCESSORS: Readonly<
  Partial<Record<NombreDePostProcesador, keyof BotModeResolution>>
> = {
  "automation-message": "moderation",
  "automation-new-members": "moderation",
};

/** Where the id of the welcome currently on screen lives, so `cleanWelcome`
 * can remove it when the next one goes out. One small value per chat in the
 * shared settings store — no table of its own. */
const LAST_WELCOME_SETTINGS_KEY = "last_welcome_message";

/** Tri-state permission in words. "no lo sé" is a real answer here: Telegram
 * omits these flags for a plain member, and printing "no" would be a lie. */
const describeMemberFlag = (value: boolean | undefined): string =>
  value === undefined ? "no lo sé" : value ? "sí" : "no";

const DOSSIER_MEMBERSHIPS: readonly DossierMembership[] = [
  "creator",
  "administrator",
  "member",
  "restricted",
  "left",
  "kicked",
];

/**
 * Narrows Telegram's raw member status string. An unrecognised or missing
 * status must NOT collapse into "member": the dossier has an explicit "no lo he
 * podido comprobar" for exactly this case, and guessing would state a fact the
 * bot does not have.
 */
const isDossierMembership = (
  status: string | undefined,
): status is DossierMembership =>
  status !== undefined &&
  (DOSSIER_MEMBERSHIPS as readonly string[]).includes(status);

/**
 * Truncate a welcome-photo caption to Telegram's 1024 UTF-16 code-unit cap with
 * an ellipsis, WITHOUT splitting a surrogate pair. A raw `slice(0, 1023)` whose
 * boundary lands between an emoji's two code units leaves a lone high surrogate
 * that serializes to U+FFFD, corrupting the last visible character. If code unit
 * 1022 is a high surrogate its low half sits at 1023 (excluded by the slice), so
 * back off one unit to keep the pair intact. Result stays within the cap
 * (<=1023 code units + the ellipsis). Exported for direct unit testing.
 */
export const truncateWelcomeCaption = (text: string): string => {
  if (text.length <= 1024) {
    return text;
  }
  const code = text.charCodeAt(1022);
  const cut = code >= 0xd800 && code <= 0xdbff ? 1022 : 1023;
  return `${text.slice(0, cut)}…`;
};

@Injectable()
export class BotUpdateService implements OnModuleInit {
  /**
   * Se niega a arrancar en produccion con un repositorio en memoria.
   *
   * 21 de los 56 parametros del constructor llevan un valor por defecto
   * `new InMemory...Repository()`. Estan para que un test pueda construir el
   * servicio sin montar 56 dobles, pero en produccion son una trampa: si un dia
   * falta un proveedor en `app.module.ts` —porque alguien lo renombro, lo movio
   * o lo borro— **Nest no falla**. Inyecta `undefined`, el valor por defecto
   * entra en su lugar, y el bot arranca aparentemente sano guardando en RAM.
   *
   * Con `ECONOMY_REPOSITORY` eso significa saldos que desaparecen al reiniciar.
   * Con `GUARDIAN_REPOSITORY`, verificaciones. Con `MESSAGE_LOG_REPOSITORY`, el
   * archivo entero. Y sin un solo error en el log.
   *
   * Fallar aqui es ruidoso y ocurre en el arranque, que es exactamente cuando
   * se quiere descubrir. En test y desarrollo no se comprueba: ahi los
   * repositorios en memoria son justo lo que se quiere.
   */
  onModuleInit(): void {
    if (process.env.NODE_ENV !== "production") return;

    const enMemoria = Object.entries(this as unknown as Record<string, unknown>)
      .filter(([clave]) => clave.toLowerCase().includes("repository"))
      .filter(([, valor]) =>
        Boolean(valor?.constructor?.name?.startsWith("InMemory")),
      )
      .map(([clave]) => clave);

    if (enMemoria.length > 0) {
      throw new Error(
        `BotUpdateService: ${enMemoria.length} repositorio(s) resueltos a memoria en produccion (${enMemoria.join(", ")}). ` +
          "Falta su proveedor en app.module.ts. Arrancar asi guardaria los datos en RAM y los perderia al reiniciar, sin avisar.",
      );
    }
  }

  private readonly botTokenScope = new AsyncLocalStorage<string | undefined>();
  private botHandlersCache: readonly BotUpdateHandler[] | undefined;
  private botPostProcessorsCache: readonly BotPostProcessor[] | undefined;
  private readonly logger = new Logger(BotUpdateService.name);

  // --- Reaction-moderation state (Bot API 10.0). All bounded (TTL + FIFO) so a
  // hostile flood can never grow memory; keyed to include the bot id so a parent
  // and its managed children never share a permission verdict. See the pure
  // decision logic in @superbot/module-security (reaction-moderation*.ts).
  /** Distinct suspicious reactors per message, for shadow-only brigading alerts. */
  private readonly reactionSurgeStore = new InMemoryReactionSurgeStore({
    // Must cover the largest per-group window (surgeWindowSeconds tops at 3600s).
    maxTtlMs: 3_600_000,
    maxKeys: 5_000,
    // ≥ the largest threshold a config can request, or a surge is unreachable.
    maxActorsPerKey: MAX_SURGE_THRESHOLD,
  });
  /** Emits at most one staff alert per (chat/message, kind) per window. */
  private readonly reactionAlertGate = new InMemoryOncePerWindowGate({
    windowMs: 300_000,
    maxKeys: 5_000,
  });
  /** Tri-state cache of the BOT's own can_delete_messages, per (botId:chatId). */
  private readonly reactionPermissionCache = new InMemoryBotPermissionCache({
    ttlMs: 300_000,
    maxKeys: 5_000,
  });

  constructor(
    @Inject(FOUNDATION_REPOSITORY)
    private readonly repository: FoundationRepository,
    @Inject(MODERATION_REPOSITORY)
    private readonly moderationRepository: ModerationRepository,
    @Inject(MODERATION_EXTRA_REPOSITORY)
    private readonly moderationExtraRepository: ModerationExtraRepository,
    @Inject(ANTIFLOOD_REPOSITORY)
    private readonly antifloodRepository: AntifloodRepository,
    @Inject(CAPTCHA_REPOSITORY)
    private readonly captchaRepository: CaptchaRepository,
    @Inject(CONTENT_LOCK_REPOSITORY)
    private readonly contentLockRepository: ContentLockRepository,
    @Inject(ANTIRAID_REPOSITORY)
    private readonly antiraidRepository: AntiraidRepository,
    @Inject(NOTES_REPOSITORY)
    private readonly notesRepository: NotesRepository,
    @Inject(FILTERS_REPOSITORY)
    private readonly filtersRepository: FiltersRepository,
    @Inject(WELCOME_REPOSITORY)
    private readonly welcomeRepository: WelcomeRepository,
    @Inject(REPUTATION_REPOSITORY)
    private readonly reputationRepository: ReputationRepository,
    @Inject(INVITE_REPOSITORY)
    private readonly inviteRepository: InviteRepository,
    @Inject(ANALYTICS_REPOSITORY)
    private readonly analyticsRepository: AnalyticsRepository,
    @Inject(POLL_REPOSITORY)
    private readonly pollRepository: PollRepository,
    @Inject(GIVEAWAY_REPOSITORY)
    private readonly giveawayRepository: GiveawayRepository,
    @Inject(SCHEDULED_POST_REPOSITORY)
    private readonly scheduledPostRepository: ScheduledPostRepository,
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepository: TicketRepository,
    @Inject(PRODUCTIVITY_REPOSITORY)
    private readonly productivityRepository: ProductivityRepository,
    @Inject(FEED_REPOSITORY)
    private readonly feedRepository: FeedRepository,
    @Inject(WEBHOOK_REPOSITORY)
    private readonly webhookRepository: WebhookRepository,
    @Inject(CUSTOM_COMMAND_REPOSITORY)
    private readonly customCommandRepository: CustomCommandRepository,
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: FileRepository,
    @Inject(GAME_REPOSITORY)
    private readonly gameRepository: GameRepository,
    @Inject(CHIP_REPOSITORY)
    private readonly chipRepository: ChipRepository,
    @Inject(AI_REPOSITORY)
    private readonly aiRepository: AiRepository,
    @Inject(AI_PROVIDER)
    private readonly aiProvider: AiProvider,
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepository,
    @Inject(FLOOD_COUNTER)
    private readonly floodCounter: FloodCounterStore,
    @Inject(TELEGRAM_GATEWAY) private readonly telegramGateway: TelegramGateway,
    @Inject(GROUP_PROTECTION_REPOSITORY)
    private readonly groupProtectionRepository: GroupProtectionRepository,
    @Inject(RUNTIME_ENV) private readonly env: RuntimeEnv,
    @Inject(QUOTE_RENDERER)
    private readonly quoteRenderer: QuoteRenderer = {
      renderQuote: async () => null,
    },
    @Inject(FEDERATION_REPOSITORY)
    private readonly federationRepository: FederationRepository = new InMemoryFederationRepository(),
    @Inject(FEEDBACK_REPOSITORY)
    private readonly feedbackRepository: FeedbackRepository = new InMemoryFeedbackRepository(),
    @Inject(PLATFORM_REPOSITORY)
    private readonly platformRepository: PlatformRepository = new InMemoryPlatformRepository(),
    @Inject(SPAM_CHECK_PROVIDER)
    private readonly spamCheckProvider: SpamCheckProvider = {
      isKnownSpammer: async () => false,
    },
    @Optional()
    @Inject(D1_REPOSITORY)
    private readonly d1Repository: D1Repository = new InMemoryD1Repository(),
    @Optional()
    @Inject(OWNER_NETWORK_REPOSITORY)
    private readonly ownerNetworkRepository: OwnerNetworkRepository = new InMemoryOwnerNetworkRepository(),
    @Optional()
    @Inject(OWNER_NETWORK_RISK_REPOSITORY)
    private readonly ownerNetworkRiskRepository: OwnerNetworkRiskRepository = new InMemoryOwnerNetworkRiskRepository(),
    @Optional()
    @Inject(GAMIFICATION_REPOSITORY)
    private readonly gamificationRepository: GamificationRepository = new InMemoryGamificationRepository(),
    @Optional()
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automationRepository: AutomationRepository = new InMemoryAutomationRepository(),
    @Optional()
    @Inject(AI_ACCESS_REPOSITORY)
    private readonly aiAccessRepository: AiAccessRepository = new AlwaysAllowAiAccessRepository(),
    @Optional()
    @Inject(STAFF_NOTE_REPOSITORY)
    private readonly staffNoteRepository: StaffNoteRepository = new InMemoryStaffNoteRepository(),
    @Optional()
    @Inject(ECONOMY_REPOSITORY)
    private readonly economyRepository: EconomyRepository = new InMemoryEconomyRepository(),
    @Optional()
    @Inject(INCIDENT_REPOSITORY)
    private readonly incidentRepository: IncidentRepository = new InMemoryIncidentRepository(),
    @Optional()
    @Inject(COOP_MISSION_REPOSITORY)
    private readonly coopMissionRepository: CoopMissionRepository = new InMemoryCoopMissionRepository(),
    @Optional()
    @Inject(GRATITUDE_REPOSITORY)
    private readonly gratitudeRepository: GratitudeRepository = new InMemoryGratitudeRepository(),
    @Optional()
    @Inject(CHAT_ACTIVITY_REPOSITORY)
    private readonly chatActivityRepository: ChatActivityRepository = new InMemoryChatActivityRepository(),
    @Optional()
    @Inject(CHAT_SETTING_REPOSITORY)
    private readonly chatSettingRepository: ChatSettingRepository = new InMemoryChatSettingRepository(),
    @Inject(GUARDIAN_REPOSITORY)
    private readonly guardianRepository: GuardianRepository = new InMemoryGuardianRepository(),
    @Optional()
    @Inject(BOT_GRANTED_ADMIN_REPOSITORY)
    private readonly botGrantedAdminRepository: BotGrantedAdminRepository = new InMemoryBotGrantedAdminRepository(),
    @Optional()
    @Inject(INTRODUCTION_REPOSITORY)
    private readonly introductionRepository: IntroductionRepository = new InMemoryIntroductionRepository(),
    @Optional()
    @Inject(SOCIAL_REPOSITORY)
    private readonly socialRepository: SocialRepository = new InMemorySocialRepository(),
    // AL FINAL a proposito, no junto al de actividad, que es donde
    // conceptualmente le tocaba. Esta lista se construye POSICIONALMENTE en los
    // tests, asi que meter un parametro en medio corre a todos los de detras y
    // rompe decenas de llamadas a la vez. Cualquier repositorio nuevo va aqui.
    @Optional()
    @Inject(MESSAGE_LOG_REPOSITORY)
    private readonly messageLogRepository: MessageLogRepository = new InMemoryMessageLogRepository(),
    // Al FINAL a proposito: este constructor se llama con argumentos
    // posicionales desde las pruebas, asi que meter un parametro en medio
    // desplaza en silencio todo lo que venga detras. Lo que venga nuevo, aqui
    // abajo.
    @Optional()
    @Inject(EXCHANGE_REPOSITORY)
    private readonly exchangeRepository: ExchangeRepository = new PrismaExchangeRepository(),
    @Optional()
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: InventoryRepository = new InMemoryInventoryRepository(),
    @Optional()
    private readonly petRepository: PetRepository = new PrismaPetRepository(),
    @Optional()
    @Inject(AYUDANTE_SOLICITUD_REPOSITORY)
    private readonly ayudanteSolicitudRepository: AyudanteSolicitudRepository = new AyudanteSolicitudRepositoryPrisma(),
  ) {}

  /**
   * Rolling window of what each appointed admin just did. Deliberately a plain
   * field rather than an injected dependency: it holds seconds of volatile
   * counters, so there is nothing to configure and nothing worth persisting —
   * see admin-action-store.ts for why a restart forgetting it is acceptable.
   */
  private readonly adminActionStore: AdminActionStore =
    new InMemoryAdminActionStore();

  private socialHandlersCache: SocialHandlers | null = null;

  private chatGamesHandlersCache: ChatGamesHandlers | null = null;

  /**
   * Las partidas jugadas dentro del chat, construidas una vez por instancia.
   *
   * Solo cuatro cosas de fuera: dos repositorios, el enlace a la Mini App para
   * lo privado, y el dia. Las reglas de cada juego estan en modules/games y
   * este servicio no las conoce.
   */
  private chatGamesHandlers(): ChatGamesHandlers {
    if (this.chatGamesHandlersCache) {
      return this.chatGamesHandlersCache;
    }
    this.chatGamesHandlersCache = new ChatGamesHandlers({
      matches: new PrismaGameMatchRepository(),
      players: new PrismaGameMatchPlayerRepository(),
      miniAppLink: (matchId) =>
        buildNamedMiniAppLink(
          this.env.TELEGRAM_BOT_USERNAME.replace(/^@/u, ""),
          this.env.TELEGRAM_MINIAPP_NAME,
          `m_${matchId}`,
        ),
      // Dias enteros desde la epoca. Ya solo numera el puzle al compartirlo.
      today: () => Math.floor(Date.now() / 86_400_000),
      // Cambia entre partidas, que es todo lo que hace falta para que dos
      // wordles del mismo dia no salgan con la misma palabra. Los milisegundos
      // del reloj valen: la respuesta se guarda en la partida al crearla y no
      // se vuelve a derivar.
      seed: () => Date.now(),
      postBoard: async (chatId, reply) => {
        const sent = await this.telegramGateway.sendMessage({
          chatId,
          reply,
          token: this.telegramToken(),
        });
        return sent.messageId;
      },
      // Ganar una partida paga en la moneda del grupo. La partida guarda el chat
      // de Telegram y la economia va por el chat interno, asi que hay que
      // traducir; se hace aqui y no en el handler para que aquel siga sin saber
      // nada de la base de datos.
      awardMatchWinner: async ({
        tenantId,
        telegramChatId,
        matchId,
        winnerTelegramId,
      }) => {
        const chat = await prisma.chat.findFirst({
          where: { tenantId, telegramChatId },
        });
        if (!chat) {
          return null;
        }
        const settings = await this.groupCurrencySettings(tenantId, chat.id);
        if (!settings.enabled || settings.premioPartida <= 0) {
          return null;
        }
        const res = await this.economyRepository.credit(
          tenantId,
          chat.id,
          winnerTelegramId,
          settings.premioPartida,
          "earn",
          // Una partida paga UNA vez. Sin esto, un callback repetido —que es lo
          // normal cuando alguien pulsa dos veces— pagaria dos premios.
          `match:${matchId}`,
        );
        return res.ok ? settings.premioPartida : null;
      },
    });
    return this.chatGamesHandlersCache;
  }

  /**
   * The social core's wiring, built once per service instance.
   *
   * Everything passed in is an EXISTING capability of this service: the audit
   * writer, the sanction path, the admin cache, the Telegram gateway. The
   * social module owns no second version of any of them — which is the whole
   * point of the ModerationPort below being a facade rather than a copy.
   */
  private socialHandlers(): SocialHandlers {
    if (this.socialHandlersCache) {
      return this.socialHandlersCache;
    }

    const moderation: ModerationPort = {
      canRestrict: async (chatId) => {
        const botId = this.currentBotTelegramId();
        if (!botId) {
          return false;
        }
        const member = await this.telegramGateway.getChatMember({
          chatId,
          userId: botId,
          token: this.telegramToken(),
        });
        // Undefined means "Telegram did not answer", and the roulette must not
        // silence anyone on an unanswered question.
        return member.canRestrictMembers === true;
      },
      isProtected: async (chatId, userId) => {
        if (userId === this.currentBotTelegramId()) {
          return true;
        }
        try {
          const admins = await this.cachedAdminIds(chatId);
          // An empty list is almost always an API hiccup, not a group without a
          // creator. Treat it as "cannot prove they are unprotected".
          if (admins.length === 0) {
            return true;
          }
          return admins.some((adminId) => adminId === userId);
        } catch {
          return true;
        }
      },
      mute: async (request) => {
        const endsAt = new Date(Date.now() + request.seconds * 1000);
        // The SAME path a /mute takes: one sanction record, one Telegram call,
        // one audit row. No second sanctions table, no second restrict call.
        const sanction = await this.moderationRepository.createSanction({
          tenantId: request.tenantId,
          chatId: undefined,
          actorUserId: undefined,
          subjectTelegramUserId: request.targetUserId,
          reason: request.reason,
          kind: "mute",
          endsAt,
          telegramChatId: request.chatId,
        });
        const enforcement = await this.telegramGateway
          .restrictChatMember({
            chatId: request.chatId,
            userId: request.targetUserId,
            token: this.telegramToken(),
            untilDate: endsAt,
          })
          .catch(() => ({ ok: false, skipped: false }));
        return enforcement.ok
          ? { ok: true, caseNumber: sanction.caseNumber ?? null }
          : { ok: false, reason: "failed" };
      },
    };

    this.socialHandlersCache = new SocialHandlers({
      // Apagado por defecto. Gerard lo enciende cuando lo quiera.
      enabled: this.env.SOCIAL_CORE_ENABLED,
      social: this.socialRepository,
      chatSettings: this.chatSettingRepository,
      counters: botMetrics,
      recordAudit: async (input) => {
        await this.repository.recordAudit({
          tenantId: input.tenantId,
          actorType: input.actorId ? "user" : "system",
          action: input.action,
          resourceType: "social",
          ...(input.actorId ? { actorId: input.actorId } : {}),
          ...(input.resourceId ? { resourceId: input.resourceId } : {}),
          ...(input.payload ? { payload: input.payload } : {}),
        });
      },
      moderation,
      clock: systemClock,
      // crypto.randomInt, never Math.random: the draw must not be predictable
      // from previous rounds (report §6.4).
      random: { int: (min, max) => randomInt(min, Math.max(min + 1, max)) },
      media: {
        sendPhotoByFileId: async (input) => {
          const sent = await this.telegramGateway
            .sendPhotoByFileId({
              chatId: input.chatId,
              fileId: input.fileId,
              caption: input.caption,
              token: this.telegramToken(),
              ...(input.messageThreadId !== undefined
                ? { messageThreadId: input.messageThreadId }
                : {}),
            })
            .catch(() => ({ ok: false, skipped: false }));
          return sent.ok === true;
        },
      },
      statusProbe: async (chatId) => {
        const botId = this.currentBotTelegramId();
        const startedAt = Date.now();
        const [member, chat] = await Promise.all([
          botId
            ? this.telegramGateway
                .getChatMember({
                  chatId,
                  userId: botId,
                  token: this.telegramToken(),
                })
                .catch(() => null)
            : Promise.resolve(null),
          this.telegramGateway
            .getChat({ chatId, token: this.telegramToken() })
            .catch(() => null),
        ]);
        const latency = Date.now() - startedAt;
        const tri = (value: boolean | undefined) =>
          value === undefined
            ? ("unknown" as const)
            : value
              ? ("yes" as const)
              : ("no" as const);
        const status = member?.status;
        return {
          botIsAdmin:
            status === undefined
              ? "unknown"
              : status === "administrator" || status === "creator"
                ? "yes"
                : "no",
          canRestrict: tri(member?.canRestrictMembers),
          canDelete: tri(member?.canDeleteMessages),
          // Inferred, and honestly labelled as such: Telegram has no "is
          // privacy mode off" call, so this asks whether the activity log has
          // seen a plain (non-command) message here.
          seesPlainMessages: this.seesPlainMessages(chatId, status),
          isForum: chat?.chat?.type === "supergroup",
          telegramLatencyMs: latency,
        };
      },
      configLink: (chatId) => {
        const appUrl = readAppUrl(this.env.TELEGRAM_APP_URL);
        if (!appUrl.startsWith("https://")) {
          return null;
        }
        return buildNamedMiniAppLink(
          this.env.TELEGRAM_BOT_USERNAME.replace(/^@/u, ""),
          this.env.TELEGRAM_MINIAPP_NAME,
          encodeConfigStartParam(chatId.toString()),
        );
      },
    });
    return this.socialHandlersCache;
  }

  /**
   * Chats where this process has actually seen an ordinary (non-command)
   * message. In memory on purpose: it is evidence about the CURRENT process's
   * update stream, and a restart genuinely does invalidate it.
   */
  private readonly plainMessageSeen = new Set<string>();

  /**
   * Whether automatic pole can work here.
   *
   * Two sources, and neither can honestly say "no" on its own:
   *
   *  - having SEEN a plain message proves messages arrive;
   *  - being an administrator also proves it, because Telegram delivers every
   *    message to admin bots regardless of privacy mode;
   *  - seeing nothing proves nothing at all — the group may simply be quiet.
   *
   * So this returns "unknown" rather than "no" in the last case. Telling an
   * admin their permissions are broken when the truth is "nobody has spoken
   * yet" is the failure mode the tri-state exists to prevent.
   */
  private seesPlainMessages(
    chatId: bigint,
    botStatus: string | undefined,
  ): "yes" | "no" | "unknown" {
    if (this.plainMessageSeen.has(chatId.toString())) {
      return "yes";
    }
    if (botStatus === "administrator" || botStatus === "creator") {
      return "yes";
    }
    return "unknown";
  }

  /**
   * The automatic pole.
   *
   * Reads the three facts the eligibility rules need and that the normalized
   * envelope does not carry — is the sender a bot, is it an anonymous admin,
   * is this an edit — straight off the raw update, then hands everything to
   * the social module to decide.
   */
  private async handleSocialAutoPole(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    rawUpdate: unknown,
  ): Promise<BotReply | null> {
    if (update.kind !== "message" && update.kind !== "edited_message") {
      return null;
    }

    const raw =
      typeof rawUpdate === "object" && rawUpdate !== null
        ? (rawUpdate as {
            message?: { from?: { is_bot?: unknown }; sender_chat?: unknown };
            edited_message?: unknown;
          })
        : {};
    const senderIsBot = raw.message?.from?.is_bot === true;
    const isAnonymousSender = raw.message?.sender_chat != null;
    const isEdit = update.kind === "edited_message";

    // Evidence for the /status diagnosis, recorded before any early return so
    // a group whose pole is switched off still proves messages arrive.
    if (
      !isEdit &&
      !senderIsBot &&
      update.command === undefined &&
      update.isTextMessage &&
      update.chat.chatId
    ) {
      this.plainMessageSeen.add(update.chat.chatId.toString());
    }

    return this.socialHandlers().handleAmbientPole(
      context,
      update,
      isEdit,
      senderIsBot,
      isAnonymousSender,
    );
  }

  private telegramToken(): string | undefined {
    return this.botTokenScope.getStore() ?? this.env.TELEGRAM_BOT_TOKEN;
  }

  /** Telegram's stable numeric bot id, parsed from the current request's own
   * token (never guessed from config) — best-effort backfill onto
   * ManagedBot.telegramBotId so tenant identity can eventually stop depending
   * on the mutable TELEGRAM_BOT_USERNAME env var. undefined for a malformed/
   * missing token, never thrown. */
  private currentBotTelegramId(): bigint | undefined {
    const raw = this.telegramToken()?.split(":")[0];
    return raw && /^\d+$/u.test(raw) ? BigInt(raw) : undefined;
  }

  /** True when `username` is the primary (platform) bot, not a managed child. */
  private isPrimaryBot(username: string): boolean {
    return (
      username.replace(/^@/u, "").toLowerCase() ===
      this.env.TELEGRAM_BOT_USERNAME.replace(/^@/u, "").toLowerCase()
    );
  }

  private async resolveBotToken(
    botUsername: string,
  ): Promise<string | undefined> {
    // The primary bot's own traffic never needs the managed-bot lookup at
    // all: skip it so (a) every webhook/poll update for the primary bot
    // doesn't pay for an extra DB round trip, and (b) a managed-bot
    // resolution failure below can never affect the primary bot's path.
    if (this.isPrimaryBot(botUsername)) {
      return this.env.TELEGRAM_BOT_TOKEN;
    }
    let token: string | undefined;
    try {
      token = await this.platformRepository.getManagedBotToken(botUsername);
    } catch (error) {
      // A real failure resolving a managed bot's token (bad
      // MANAGED_BOT_TOKEN_KEY, corrupted/rotated ciphertext, DB error).
      // Silently falling back to the parent token here would process this
      // chat's traffic under the wrong bot identity — wrong tenant, wrong
      // economy ledger, wrong moderation authority. Log loudly and rethrow so
      // the webhook fails (Telegram retries) instead of masquerading as the
      // parent bot.
      this.logger.error(
        `resolveBotToken: managed-bot token lookup threw for @${botUsername}; refusing to fall back to the parent bot's token`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
    if (!token) {
      // getManagedBotToken resolves to undefined (no throw) when `botUsername`
      // is NOT a currently-active managed bot: never registered, suspended,
      // revoked, pending, or failed. The old `?? this.env.TELEGRAM_BOT_TOKEN`
      // here handed that traffic the PARENT bot's token — the exact wrong-bot
      // masquerade the catch above refuses, just via the quieter code path.
      // (Returning undefined would not help: telegramToken() re-applies the
      // same parent-token fallback.) Reject so the webhook fails instead.
      this.logger.error(
        `resolveBotToken: no active managed-bot token for @${botUsername}; refusing to fall back to the parent bot's token`,
      );
      throw new Error(`no active managed-bot token for @${botUsername}`);
    }
    return token;
  }

  async processWebhook(
    botUsername: string,
    rawUpdate: unknown,
  ): Promise<BotWebhookResult> {
    const botToken = await this.resolveBotToken(botUsername);
    return this.botTokenScope.run(botToken, () =>
      this.processWebhookScoped(botUsername, rawUpdate),
    );
  }

  private async processWebhookScoped(
    botUsername: string,
    rawUpdate: unknown,
  ): Promise<BotWebhookResult> {
    const update = normalizeUpdate(
      rawUpdate as Parameters<typeof normalizeUpdate>[0],
      botUsername,
    );
    const context = await this.repository.ensureContext({
      botUsername,
      update,
      botTelegramId: this.currentBotTelegramId(),
    });
    const claim = await this.repository.claimUpdate({
      tenantId: context.tenantId,
      botKey: botUsername,
      updateId: update.updateId,
      payload: rawUpdate,
    });

    if (claim === "already-processed") {
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "system",
        action: "telegram.update.duplicate",
        resourceType: "update",
        resourceId: String(update.updateId),
        payload: { botUsername, updateId: update.updateId },
      });

      return {
        ok: true,
        updateId: update.updateId,
        duplicate: true,
        handled: false,
        replyDelivered: false,
      };
    }

    // claim is "claimed" (first delivery) or "retry" (claimed by a prior
    // attempt that crashed before markUpdateProcessed — Telegram resent the
    // same update_id after a non-2xx response). Both MUST run the full
    // pipeline below; do not special-case "retry" any further than the audit
    // action name — see ClaimUpdateOutcome in foundation-repository.ts for
    // the accepted side-effect-duplication tradeoff.
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: update.user.userId ? "user" : "system",
      action:
        claim === "retry"
          ? "telegram.update.reprocessed"
          : "telegram.update.received",
      resourceType: "update",
      resourceId: String(update.updateId),
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        botUsername,
        updateId: update.updateId,
        kind: update.kind,
        chatId: update.chat.chatId?.toString(),
        userId: update.user.userId?.toString(),
        command: update.command?.name,
      },
    });

    const replyBotUsername = botUsername.replace(/^@/u, "");
    const chatType = update.chat.chatType;
    const miniAppLink: MiniAppLink = {
      appUrl: readAppUrl(this.env.TELEGRAM_APP_URL),
      botUsername: this.env.TELEGRAM_BOT_USERNAME,
      miniAppName: this.env.TELEGRAM_MINIAPP_NAME,
      isGroup: chatType === "group" || chatType === "supergroup",
    };
    const handlerInput: BotHandlerInput = {
      context,
      update,
      rawUpdate,
      botUsername,
      replyBotUsername,
      miniAppLink,
    };

    const guardDecision = await this.runGuards(handlerInput);
    if (guardDecision.blocked) {
      const delivery = await this.finishBlockedUpdate(
        handlerInput,
        guardDecision,
      );
      await this.repository.markUpdateProcessed(botUsername, update.updateId);
      return {
        ok: true,
        updateId: update.updateId,
        duplicate: false,
        handled: guardDecision.handled,
        replyDelivered: Boolean(delivery?.ok),
      };
    }

    // Inline Mode and Guest Chat Mode are answered directly through their own
    // Telegram methods (answerInlineQuery / answerGuestQuery), not sendMessage.
    // They must stop the pipeline right here: no further handlers, no
    // postprocessors (analytics/reputation/antiflood/automations/...), no
    // regular reply delivery. See modryva_claude_guest_inline_ai_prompt.md.
    if (update.kind === "inline_query") {
      await this.handleInlineQuery(context, update);
      await this.repository.markUpdateProcessed(botUsername, update.updateId);
      return {
        ok: true,
        updateId: update.updateId,
        duplicate: false,
        handled: true,
        replyDelivered: false,
      };
    }
    if (update.kind === "guest_message") {
      await this.handleGuestMessage(context, update);
      await this.repository.markUpdateProcessed(botUsername, update.updateId);
      return {
        ok: true,
        updateId: update.updateId,
        duplicate: false,
        handled: true,
        replyDelivered: false,
      };
    }

    const commandReply = await this.dispatchUpdate(handlerInput);

    await this.runPostProcessors({ ...handlerInput, commandReply });
    await this.ackCallbackQuery(rawUpdate);

    const delivery = commandReply
      ? await this.deliverReply(update, rawUpdate, commandReply)
      : undefined;

    if (commandReply) {
      await this.cleanCommandMessage(context, update);
    }

    await this.repository.markUpdateProcessed(botUsername, update.updateId);

    return {
      ok: true,
      updateId: update.updateId,
      duplicate: false,
      handled: Boolean(commandReply),
      replyDelivered: Boolean(delivery?.ok),
    };
  }

  /**
   * Deletes the `/comando` a member typed, once the bot has answered it, so the
   * chat shows the bot's panel instead of the plumbing that produced it.
   *
   * Only runs for a command the bot ACTUALLY handled. An unrecognised `/foo` is
   * just text the bot happens not to understand, and deleting it would be the
   * bot removing a member's message for no reason — the one thing a cosmetic
   * setting must never do. Off by default, and gated by the cleanup category so
   * a group in passive mode keeps its hands off other people's messages.
   */
  private async cleanCommandMessage(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<void> {
    if (
      !update.command ||
      !context.chatId ||
      !update.chat.chatId ||
      !update.messageId
    ) {
      return;
    }

    // A DM has no clutter to hide and no admin rights to do it with.
    const chatType = update.chat.chatType;
    if (chatType !== "group" && chatType !== "supergroup") {
      return;
    }

    const hygiene = await this.groupProtectionRepository.getHygiene(
      context.chatId,
    );
    if (!hygiene.cleanCommands) {
      return;
    }
    if (!(await this.botMode(context.chatId)).cleanup) {
      return;
    }

    try {
      await this.telegramGateway.deleteMessage({
        chatId: update.chat.chatId,
        messageId: update.messageId,
        token: this.telegramToken(),
      });
    } catch {
      // Cosmetic: without delete rights the command stays visible and the bot's
      // answer is already out. Nothing to recover from.
    }
  }

  private async runGuards(input: BotHandlerInput): Promise<BotGuardDecision> {
    const platformBanBlock = await this.platformBanBlock(
      input.context,
      input.update,
    );
    if (platformBanBlock) {
      return {
        blocked: true,
        handled: Boolean(platformBanBlock.reply),
        reply: platformBanBlock.reply,
        callbackText: "Acceso bloqueado en Modryva.",
      };
    }

    return { blocked: false };
  }

  private async finishBlockedUpdate(
    input: BotHandlerInput,
    decision: Extract<BotGuardDecision, { blocked: true }>,
  ): Promise<{ ok: boolean } | undefined> {
    const delivery = decision.reply
      ? await this.deliverReply(input.update, input.rawUpdate, decision.reply)
      : undefined;

    await this.ackCallbackQuery(input.rawUpdate, decision.callbackText);
    return delivery;
  }

  private async dispatchUpdate(
    input: BotHandlerInput,
  ): Promise<BotReply | null> {
    // Per-group bot mode, resolved lazily on the first gated handler and reused
    // for the whole dispatch: at most one getHygiene per update, and none for
    // updates that never reach a gated handler.
    let mode: BotModeResolution | null = null;
    for (const handler of this.botHandlers()) {
      const gate = GATED_HANDLERS[handler.name];
      if (gate) {
        if (mode === null) {
          mode = input.context.chatId
            ? await this.botMode(input.context.chatId)
            : ALL_ENABLED_BOT_MODE;
        }
        if (!mode[gate]) {
          continue;
        }
      }

      const empezadoEn = Date.now();
      let reply: BotReply | null;
      try {
        reply = await handler.handle(input);
      } catch (error) {
        botMetrics.increment(
          `superbot_bot_handler_error_total{name="${handler.name}"}`,
        );

        if (!HANDLERS_TOLERANTES.has(handler.name)) {
          // Handler critico: se corta la cadena y se propaga. Propagar NO es
          // perder el update — es justo lo contrario. `markUpdateProcessed` no
          // llega a ejecutarse, la fila de `update_inbox` se queda sin
          // `processedAt`, y el poller no confirma el offset por encima de este
          // update, asi que Telegram lo reenvia y se reprocesa entero. Tragarse
          // el error aqui si lo perderia, y ademas en silencio.
          this.logger.error(
            { handler: handler.name, ms: Date.now() - empezadoEn, error },
            "handler critico fallido: se aborta el update para que se reintente",
          );
          throw error;
        }

        // Handler tolerante: su trabajo es accesorio (registro, archivo) y no
        // debe llevarse por delante la respuesta que la persona esta esperando.
        // La lista es explicita y tipada a proposito: la tolerancia se declara,
        // nunca se hereda por descuido.
        this.logger.warn(
          { handler: handler.name, ms: Date.now() - empezadoEn, error },
          "handler tolerante fallido: se continua la cadena",
        );
        reply = null;
      }

      botMetrics.increment(
        `superbot_bot_handler_run_total{name="${handler.name}"}`,
      );

      if (reply) {
        botMetrics.increment(
          `superbot_bot_handler_answered_total{name="${handler.name}"}`,
        );
        return reply;
      }
    }
    return null;
  }

  private botHandlers(): readonly BotUpdateHandler[] {
    if (this.botHandlersCache) {
      return this.botHandlersCache;
    }

    this.botHandlersCache = [
      {
        name: "casino.grant",
        handle: ({ context, update }) => this.handleChipGrant(context, update),
      },
      {
        // Detras de casino.grant a proposito: son los dos comandos de owner que
        // mueven saldo, y leerlos juntos deja claro que van por la misma puerta.
        name: "economy.balance-adjust",
        handle: ({ context, update }) =>
          this.handleBalanceAdjust(context, update),
      },
      {
        // Pegado a `balance-adjust`: son el mismo privilegio con dos formas
        // —sumar/restar y fijar— y separarlos en el orden solo serviria para
        // que alguien tocara uno y se olvidara del otro.
        name: "economy.balance-set",
        handle: ({ context, update }) => this.handleBalanceSet(context, update),
      },
      {
        // El tercero de la misma puerta. Los otros dos mueven una cifra; este
        // cambia la regla por la que la cifra se mueve, y por eso va detras:
        // quien lea los tres seguidos ve el privilegio entero.
        name: "economy.unlimited",
        handle: ({ context, update }) =>
          this.handleUnlimitedBalance(context, update),
      },
      {
        name: "platform.user-ban-command",
        handle: ({ context, update }) =>
          this.handlePlatformUserBanCommand(context, update),
      },
      {
        name: "settings",
        handle: ({ context, update, replyBotUsername }) =>
          this.handleSettings(context, update, replyBotUsername),
      },
      {
        name: "chat-activity.logger",
        handle: ({ context, update }) =>
          this.handleChatActivityLogger(context, update),
      },
      {
        // El registro completo. Va justo detras del de actividad y no dentro:
        // aquel se salta comandos y todo lo que no sea texto, y su tabla caduca
        // a los 90 dias. Este no se salta nada y no caduca.
        name: "message-log.archive",
        handle: ({ context, update }) =>
          this.handleMessageArchive(context, update),
      },
      {
        // Before core.command so `/status social` reaches the diagnostic
        // screen; every other command falls through untouched, including a
        // plain `/status`, which still belongs to core.
        name: "social.command",
        handle: ({ context, update }) =>
          this.socialHandlers().handleCommand(context, update),
      },
      {
        // Antes de core.command: /jugar y /juegos son suyos y core no los
        // conoce. Todo lo demas cae al siguiente sin tocarlo.
        name: "games.command",
        handle: ({ context, update }) =>
          this.chatGamesHandlers().handleCommand(update, context.tenantId),
      },
      {
        /**
         * ANTES de `core.command`, y ese orden ES el arreglo.
         *
         * `handleCoreCommand` atiende `/start` sin mirar nunca su carga, así
         * que el enlace de repetición —`/start grdv_<token>`, el que un admin
         * reenvía cuando el bot no puede escribirle a la persona— chocaba con
         * él y devolvía el menú del bot. El de Guardian está registrado 500
         * líneas más abajo en esta misma cadena y no llegaba a verlo jamás: el
         * deep link no ha funcionado NUNCA desde que existe.
         *
         * Encaja con lo que se ve en producción: solo 5 pulsaciones
         * registradas, y una persona dio cuatro en cuatro minutos —lo que hace
         * quien ve la pantalla equivocada y vuelve a intentarlo—. De 40
         * repeticiones que caducaron, solo 3 personas llegaron a repetir.
         *
         * Solo reclama `/start` en privado con una carga `grdv_` válida;
         * cualquier otro `/start` sale por null y sigue la cadena hasta core.
         */
        name: "guardian.retry-start",
        handle: ({ update }) => this.handleGuardianRetryStartCommand(update),
      },
      {
        name: "core.command",
        handle: ({ update, replyBotUsername, miniAppLink }) =>
          handleCoreCommand(update, replyBotUsername, miniAppLink),
      },
      {
        // Su parser solo reconoce los callbacks que empiezan por "cg:"; el
        // resto sale por null y sigue la cadena.
        name: "games.callback",
        handle: ({ update }) => this.chatGamesHandlers().handleCallback(update),
      },
      {
        name: "core.callback",
        handle: ({ update, replyBotUsername, miniAppLink }) =>
          handleCoreCallback(update, replyBotUsername, miniAppLink),
      },
      {
        // Before the other callback handlers: it answers and stops, so no
        // parser downstream has to learn to ignore "gv:decided".
        name: "guardian.decided-label",
        handle: ({ context, update }) =>
          this.handleDecidedLabelCallback(context, update),
      },
      {
        name: "inline-game.callback",
        handle: ({ context, update }) =>
          this.handleInlineGameCallback(context, update),
      },
      {
        name: "platform.command",
        handle: ({ context, update }) =>
          this.handlePlatformCommand(context, update),
      },
      {
        name: "managed-bot.update",
        handle: ({ context, update, botUsername }) =>
          this.handleManagedBotUpdate(context, update, botUsername),
      },
      {
        name: "moderation.command",
        handle: ({ context, update }) =>
          this.handleModerationCommand(context, update),
      },
      {
        name: "moderation.nuke-command",
        handle: ({ context, update }) =>
          this.handleNukeCommand(context, update),
      },
      {
        name: "moderation.sanctions-log",
        handle: ({ context, update }) =>
          this.handleSanctionsLogCommand(context, update),
      },
      {
        // El hermano del parte de sanciones: mismo comando de tres formas,
        // misma sala, otro tema.
        name: "moderation.report-mirror",
        handle: ({ context, update }) =>
          this.handleReportMirrorCommand(context, update),
      },
      {
        name: "moderation.report-resolve",
        handle: ({ context, update }) =>
          this.handleReportResolveCallback(context, update),
      },
      {
        name: "moderation-plus.command",
        handle: ({ context, update }) =>
          this.handleModerationPlusCommand(context, update),
      },
      {
        name: "moderation-extra.command",
        handle: ({ context, update }) =>
          this.handleModerationExtraCommand(context, update),
      },
      {
        name: "antiflood.command",
        handle: ({ context, update }) =>
          this.handleAntifloodCommand(context, update),
      },
      {
        name: "captcha.command",
        handle: ({ context, update }) =>
          this.handleCaptchaCommand(context, update),
      },
      {
        name: "locks.command",
        handle: ({ context, update }) =>
          this.handleLockCommand(context, update),
      },
      {
        name: "topic-locks.command",
        handle: ({ context, update }) =>
          this.handleTopicScopeCommand(context, update),
      },
      {
        name: "antiraid.command",
        handle: ({ context, update }) =>
          this.handleAntiraidCommand(context, update),
      },
      {
        name: "warn-config.command",
        handle: ({ context, update }) =>
          this.handleWarnConfigCommand(context, update),
      },
      {
        name: "blocklist.command",
        handle: ({ context, update }) =>
          this.handleBlocklistCommand(context, update),
      },
      {
        name: "hygiene.command",
        handle: ({ context, update }) =>
          this.handleHygieneCommand(context, update),
      },
      {
        name: "char-filter.command",
        handle: ({ context, update }) =>
          this.handleCharFilterCommand(context, update),
      },
      {
        name: "sanction-reasons.command",
        handle: ({ context, update }) =>
          this.handleSanctionReasonCommand(context, update),
      },
      {
        name: "tolerance.command",
        handle: ({ context, update }) =>
          this.handleToleranceCommand(context, update),
      },
      {
        name: "protection-summary.command",
        handle: ({ context, update }) =>
          this.handleProtectionSummaryCommand(context, update),
      },
      {
        name: "idgroup.command",
        handle: ({ update }) => this.handleIdGroupCommand(update),
      },
      {
        name: "vertical.command",
        handle: ({ context, update }) =>
          this.handleVerticalCommand(context, update),
      },
      {
        name: "announcement.command",
        handle: ({ context, update }) =>
          this.handleAnnouncementCommand(context, update),
      },
      {
        name: "config-mode.command",
        handle: ({ context, update }) =>
          this.handleConfigModeCommand(context, update),
      },
      {
        name: "rules-clarity.command",
        handle: ({ context, update }) =>
          this.handleRulesClarityCommand(context, update),
      },
      {
        name: "staff-note.command",
        handle: ({ context, update }) =>
          this.handleCaseNoteCommand(context, update),
      },
      {
        // Reacciona a la ENTRADA del ayudante en el grupo, no a un comando.
        // Va aqui arriba, antes de los mandos, porque no compite con ninguno:
        // mira `new_chat_member` y devuelve null para todo lo demas.
        name: "ayudante.entrada",
        handle: ({ context, update }) =>
          this.handleAyudanteEntrada(context, update),
      },
      {
        // `/ayudante` mete la cuenta del Ayudante en el grupo. Solo el
        // propietario, y la comprobacion vive en `mandos-de-ayudante.ts`.
        name: "ayudante.mando",
        handle: ({ context, update }) =>
          this.handleAyudanteMando(context, update),
      },
      {
        // Delante de `pets.command` porque `/pet` es el mando del creador y no
        // uno de los comandos de la gente: si algun dia se llamaran igual, el
        // que manda tiene que ganar.
        name: "pets.mando",
        handle: ({ context, update }) => this.handlePetsMando(context, update),
      },
      {
        // Antes de `economy.command` porque sus nombres son suyos y no chocan
        // con ninguno del casino ni de la moneda: comprobado uno a uno al
        // añadirlo. Si algun dia chocara, el que va antes se lo come.
        name: "pets.command",
        handle: ({ context, update }) =>
          this.handlePetsCommand(context, update),
      },
      {
        name: "economy.command",
        handle: ({ context, update, replyBotUsername }) =>
          this.handleEconomyCommand(context, update, replyBotUsername),
      },
      {
        name: "recipe.command",
        handle: ({ context, update }) =>
          this.handleRecipeCommand(context, update),
      },
      {
        name: "incident.command",
        handle: ({ context, update }) =>
          this.handleIncidentCommand(context, update),
      },
      {
        name: "coop-mission.command",
        handle: ({ context, update }) =>
          this.handleCoopMissionCommand(context, update),
      },
      {
        name: "gratitude.command",
        handle: ({ context, update }) =>
          this.handleGratitudeCommand(context, update),
      },
      {
        name: "language.command",
        handle: ({ context, update }) =>
          this.handleLangCommand(context, update),
      },
      {
        name: "join-gate.command",
        handle: ({ context, update }) =>
          this.handleJoinGateCommand(context, update),
      },
      {
        name: "feedback.command",
        handle: ({ context, update }) =>
          this.handleFeedbackCommand(context, update),
      },
      {
        name: "federation.command",
        handle: ({ context, update }) =>
          this.handleFederationCommand(context, update),
      },
      {
        name: "d1.logs-command",
        handle: ({ context, update }) =>
          this.handleD1LogsCommand(context, update),
      },
      {
        name: "d1.quarantine-command",
        handle: ({ context, update }) =>
          this.handleQuarantineCommand(context, update),
      },
      {
        name: "d1.quarantine-callback",
        handle: ({ context, update }) =>
          this.handleQuarantineCallback(context, update),
      },
      {
        name: "d1.appeal-command",
        handle: ({ context, update }) =>
          this.handleAppealCommand(context, update),
      },
      {
        name: "d1.appeal-callback",
        handle: ({ context, update }) =>
          this.handleAppealCallback(context, update),
      },
      {
        name: "d1.doctor-command",
        handle: ({ context, update }) =>
          this.handleD1DoctorCommand(context, update),
      },
      {
        name: "automation.command",
        handle: ({ context, update }) =>
          this.handleAutomationCommand(context, update),
      },
      {
        name: "mission.command",
        handle: ({ context, update }) =>
          this.handleMissionCommand(context, update),
      },
      {
        name: "notes.command",
        handle: ({ context, update }) =>
          this.handleNotesCommand(context, update),
      },
      {
        name: "filters.command",
        handle: ({ context, update }) =>
          this.handleFiltersCommand(context, update),
      },
      {
        name: "welcome.command",
        handle: ({ context, update }) =>
          this.handleWelcomeCommand(context, update),
      },
      {
        name: "reputation.command",
        handle: ({ context, update }) =>
          this.handleReputationCommand(context, update),
      },
      {
        name: "trust-tier.command",
        handle: ({ context, update }) =>
          this.handleTrustTierCommand(context, update),
      },
      {
        name: "ranks.command",
        handle: ({ context, update }) =>
          this.handleRankCommand(context, update),
      },
      {
        name: "user-dossier.command",
        handle: ({ context, update }) =>
          this.handleInfoCommand(context, update),
      },
      {
        name: "user-dossier.callback",
        handle: ({ context, update, rawUpdate }) =>
          this.handleDossierCallback(context, update, rawUpdate),
      },
      {
        name: "bot-voice.send-command",
        handle: ({ context, update }) =>
          this.handleSendCommand(context, update),
      },
      {
        name: "rookie-ranking.command",
        handle: ({ context, update }) =>
          this.handleRookieRankingCommand(context, update),
      },
      {
        name: "hall-of-fame.command",
        handle: ({ context, update }) =>
          this.handleHallOfFameCommand(context, update),
      },
      {
        name: "invite.command",
        handle: ({ context, update }) =>
          this.handleInviteCommand(context, update),
      },
      {
        name: "stats.command",
        handle: ({ context, update }) =>
          this.handleStatsCommand(context, update),
      },
      {
        name: "poll.command",
        handle: ({ context, update }) =>
          this.handlePollCommand(context, update),
      },
      {
        name: "poll.vote",
        handle: ({ context, update }) => this.handlePollVote(context, update),
      },
      {
        name: "giveaway.command",
        handle: ({ context, update }) =>
          this.handleGiveawayCommand(context, update),
      },
      {
        name: "giveaway.join",
        handle: ({ context, update }) =>
          this.handleGiveawayJoin(context, update),
      },
      {
        name: "schedule.command",
        handle: ({ context, update }) =>
          this.handleScheduleCommand(context, update),
      },
      {
        name: "ticket.command",
        handle: ({ context, update }) =>
          this.handleTicketCommand(context, update),
      },
      {
        name: "reminder.command",
        handle: ({ context, update }) =>
          this.handleReminderCommand(context, update),
      },
      {
        name: "task.command",
        handle: ({ context, update }) =>
          this.handleTaskCommand(context, update),
      },
      {
        name: "rss.command",
        handle: ({ context, update }) => this.handleRssCommand(context, update),
      },
      {
        name: "webhook.command",
        handle: ({ context, update }) =>
          this.handleWebhookCommand(context, update),
      },
      {
        name: "custom-command.config",
        handle: ({ context, update }) =>
          this.handleCustomCommandConfig(context, update),
      },
      {
        name: "command-alias.config",
        handle: ({ context, update }) =>
          this.handleCommandAliasCommand(context, update),
      },
      {
        name: "group-glossary.config",
        handle: ({ context, update }) =>
          this.handleGlossaryCommand(context, update),
      },
      {
        name: "bot-voice.config",
        handle: ({ context, update }) =>
          this.handleBotVoiceCommand(context, update),
      },
      {
        name: "staff-shift.config",
        handle: ({ context, update }) =>
          this.handleShiftCommand(context, update),
      },
      {
        name: "rituals.config",
        handle: ({ context, update }) =>
          this.handleRitualCommand(context, update),
      },
      {
        name: "scheduled-rules.config",
        handle: ({ context, update }) =>
          this.handleScheduledRuleCommand(context, update),
      },
      {
        name: "module-rename.config",
        handle: ({ context, update }) =>
          this.handleModuleRenameCommand(context, update),
      },
      {
        name: "dock.config",
        handle: ({ context, update }) =>
          this.handleDockCommand(context, update),
      },
      {
        name: "density-mode.command",
        handle: ({ context, update }) =>
          this.handleDensityModeCommand(context, update),
      },
      {
        name: "interest-tags.command",
        handle: ({ context, update }) =>
          this.handleInterestTagsCommand(context, update),
      },
      {
        name: "idea-voting.command",
        handle: ({ context, update }) =>
          this.handleIdeaVotingCommand(context, update),
      },
      {
        name: "scavenger-hunt.command",
        handle: ({ context, update }) =>
          this.handleScavengerHuntCommand(context, update),
      },
      {
        name: "season-album.command",
        handle: ({ context, update }) =>
          this.handleSeasonAlbumCommand(context, update),
      },
      {
        name: "notes-port.command",
        handle: ({ context, update }) =>
          this.handleNotesPortCommand(context, update),
      },
      {
        name: "files.command",
        handle: ({ context, update }) =>
          this.handleFilesCommand(context, update),
      },
      {
        name: "attachment",
        handle: ({ context, update }) => this.handleAttachment(context, update),
      },
      {
        name: "games.hub",
        handle: ({ update }) =>
          handleGamesHub(update, {
            appUrl: this.env.TELEGRAM_APP_URL,
            botUsername: this.env.TELEGRAM_BOT_USERNAME,
            miniAppName: this.env.TELEGRAM_MINIAPP_NAME,
          }),
      },
      {
        name: "casino.command",
        handle: ({ context, update }) =>
          this.handleCasinoCommand(context, update),
      },
      {
        name: "casino.duel-callback",
        handle: ({ context, update }) =>
          this.handleDuelCallback(context, update),
      },
      {
        name: "trivia.command",
        handle: ({ context, update }) =>
          this.handleTriviaCommand(context, update),
      },
      {
        name: "trivia.answer",
        handle: ({ context, update }) =>
          this.handleTriviaAnswer(context, update),
      },
      {
        name: "quiz.scores",
        handle: ({ context, update }) => this.handleQuizScores(context, update),
      },
      {
        name: "quiz.command",
        handle: ({ context, update }) =>
          this.handleQuizCommand(context, update),
      },
      {
        name: "quiz.answer",
        handle: ({ context, update }) => this.handleQuizAnswer(context, update),
      },
      {
        name: "admin-tool.command",
        handle: ({ context, update }) =>
          this.handleAdminToolCommand(context, update),
      },
      {
        name: "warn.remove-callback",
        handle: ({ context, update }) =>
          this.handleRemoveWarnCallback(context, update),
      },
      {
        name: "human-verify.callback",
        handle: ({ context, update }) =>
          this.handleHumanVerify(context, update),
      },
      {
        name: "join-request",
        handle: ({ context, update }) =>
          this.handleJoinRequest(context, update),
      },
      {
        name: "guardian.command",
        handle: ({ context, update }) =>
          this.handleGuardianCommand(context, update),
      },
      {
        name: "guardian.staff-callback",
        handle: ({ context, update }) =>
          this.handleGuardianStaffCallback(context, update),
      },
      {
        name: "permission.audit",
        handle: ({ context, update }) =>
          this.handlePermissionAudit(context, update),
      },
      {
        name: "quote.command",
        handle: ({ context, update }) =>
          this.handleQuoteCommand(context, update),
      },
      {
        name: "reaction.command",
        handle: ({ context, update }) =>
          this.handleReactCommand(context, update),
      },
      {
        name: "reaction.callback",
        handle: ({ context, update }) =>
          this.handleReactionCallback(context, update),
      },
      {
        name: "fun.command",
        handle: ({ update }) => this.handleFunCommand(update),
      },
      {
        name: "fun.callback",
        handle: ({ update }) => this.handleFunCallback(update),
      },
      {
        name: "utility.command",
        handle: ({ update }) => this.handleUtilityCommand(update),
      },
      {
        name: "utility-plus.command",
        handle: ({ context, update }) =>
          this.handleUtilityPlusCommand(context, update),
      },
      {
        name: "data-reports.command",
        handle: ({ context, update }) =>
          this.handleDataReportsCommand(context, update),
      },
      {
        name: "afk.command",
        handle: ({ context, update }) => this.handleAfkCommand(context, update),
      },
      {
        name: "ai.command",
        handle: ({ context, update }) => this.handleAiCommand(context, update),
      },
      {
        name: "payment.command",
        handle: ({ context, update }) =>
          this.handlePaymentCommand(context, update),
      },
      {
        name: "payment.pre-checkout",
        handle: ({ context, update }) =>
          this.handlePreCheckout(context, update),
      },
      {
        name: "payment.successful",
        handle: ({ context, update }) =>
          this.handleSuccessfulPayment(context, update),
      },
      {
        name: "welcome.buttons-callback",
        handle: ({ context, update, rawUpdate }) =>
          this.handleWelcomeButtonsCallback(context, update, rawUpdate),
      },
      {
        name: "captcha.callback",
        handle: ({ context, update }) =>
          this.handleCaptchaCallback(context, update),
      },
      {
        name: "captcha.text-answer",
        handle: ({ context, update }) =>
          this.handleCaptchaTextAnswer(context, update),
      },
      {
        name: "bot.onboarding",
        handle: ({ context, update, replyBotUsername }) =>
          this.handleBotOnboarding(context, update, replyBotUsername),
      },
      // First of the chat-member handlers, and unconditional: an attacker's
      // opening move is to strip the bot of its powers, and every guard after
      // this line depends on powers this one reports losing.
      {
        name: "power.watch",
        handle: ({ context, update }) => this.handlePowerWatch(context, update),
      },
      // Before chat-member.update: that one only reacts to people LEAVING, and
      // a rogue admin also promotes and unbans, which leaves the subject active.
      {
        name: "appointed-admin.guard",
        handle: ({ context, update }) =>
          this.handleAppointedAdminAction(context, update),
      },
      {
        name: "chat-member.update",
        handle: ({ context, update }) =>
          this.handleChatMemberUpdate(context, update),
      },
      {
        name: "reaction.perm-invalidate",
        handle: ({ context, update }) =>
          this.handleReactionPermissionInvalidation(context, update),
      },
      {
        name: "members.new",
        handle: ({ context, update }) => this.handleNewMembers(context, update),
      },
      {
        name: "edit-guard.ambient",
        handle: ({ context, update }) =>
          this.handleEditedMessage(context, update),
      },
      {
        name: "reaction.ambient",
        handle: ({ context, update }) =>
          this.handleMessageReaction(context, update),
      },
      {
        name: "reaction.moderate",
        handle: ({ context, update }) =>
          this.handleReactionModeration(context, update),
      },
      {
        name: "scheduled-strict.ambient",
        handle: ({ context, update }) =>
          this.handleScheduledStrictMode(context, update),
      },
      {
        name: "members.left",
        handle: ({ context, update }) => this.handleLeftMember(context, update),
      },
      {
        name: "service-message.clean",
        handle: ({ context, update }) =>
          this.handleServiceMessageClean(context, update),
      },
      {
        name: "membership-gate.check",
        handle: ({ context, update }) =>
          this.handleMembershipGateCheck(context, update),
      },
      {
        name: "content-lock.ambient",
        handle: ({ context, update }) =>
          this.handleContentLock(context, update),
      },
      {
        name: "blocklist.ambient",
        handle: ({ context, update }) =>
          this.handleBlocklistMatch(context, update),
      },
      {
        name: "char-filter.ambient",
        handle: ({ context, update }) =>
          this.handleCharFilterMatch(context, update),
      },
      {
        name: "dangerous-file.ambient",
        handle: ({ context, update }) =>
          this.handleDangerousFileMatch(context, update),
      },
      {
        name: "privacy-leak.ambient",
        handle: ({ context, update }) =>
          this.handlePrivacyLeakAmbient(context, update),
      },
      {
        name: "scam-signals.ambient",
        handle: ({ context, update }) =>
          this.handleScamSignalsAmbient(context, update),
      },
      {
        name: "social-signals.ambient",
        handle: ({ context, update }) =>
          this.handleSocialSignalsAmbient(context, update),
      },
      {
        name: "night-mode.ambient",
        handle: ({ context, update }) => this.handleNightMode(context, update),
      },
      {
        name: "automation.ambient",
        handle: ({ context, update }) =>
          this.handleAutomationAmbient(context, update),
      },
      {
        name: "quarantine.ambient",
        handle: ({ context, update }) =>
          this.handleQuarantineAmbient(context, update),
      },
      {
        name: "afk.ambient",
        handle: ({ context, update }) => this.handleAfkAmbient(context, update),
      },
      {
        // The automatic pole: the first eligible human message of a new
        // window. Registered here, after every moderation and gate handler,
        // because taking the pole must never pre-empt a sanction — and gated
        // as `messages` (see GATED_HANDLERS) because it is an unsolicited
        // social post, exactly what passive mode exists to silence.
        name: "social.auto-pole",
        handle: ({ context, update, rawUpdate }) =>
          this.handleSocialAutoPole(context, update, rawUpdate),
      },
      // After afk.ambient: that one warns when you MENTION someone who is away.
      // This one reacts to what the speaker says about themselves, so the two
      // never compete for the same message.
      {
        // Before everything conversational: a newcomer's first message is
        // their introduction, not a command or an AFK notice.
        name: "introduction.message",
        handle: ({ context, update }) =>
          this.handleIntroductionMessage(context, update),
      },
      {
        name: "introduction.admin",
        handle: ({ context, update }) =>
          this.handleIntroductionAdminCommand(context, update),
      },
      {
        name: "introduction.mirror",
        handle: ({ context, update }) =>
          this.handleIntroductionMirrorCommand(context, update),
      },
      {
        // Los dos botones de la ficha que el barrido publica en la sala de
        // STAFF. Van aqui, con el resto de presentaciones, y no junto a los de
        // Guardian: comparten sala pero no comparten nada mas.
        name: "introduction.staff-callback",
        handle: ({ context, update }) =>
          this.handleIntroductionStaffCallback(context, update),
      },
      {
        name: "introduction.join",
        handle: ({ context, update }) =>
          this.handleIntroductionJoin(context, update),
      },
      {
        // Before afk.phrase: "@all me voy a dormir" is an announcement, not
        // someone going away.
        name: "community.mention-all",
        handle: ({ context, update }) => this.handleMentionAll(context, update),
      },
      {
        name: "community.mention-admins",
        handle: ({ context, update }) =>
          this.handleMentionAdmins(context, update),
      },
      {
        name: "afk.phrase",
        handle: ({ context, update }) => this.handleAfkPhrase(context, update),
      },
      {
        name: "notes.recall",
        handle: ({ context, update }) => this.handleNoteRecall(context, update),
      },
      {
        name: "custom-command.dispatch",
        handle: ({ context, update }) =>
          this.handleCustomCommandDispatch(context, update),
      },
      {
        name: "filter.ambient",
        handle: ({ context, update }) =>
          this.handleFilterMatch(context, update),
      },
      {
        name: "panel.text-input",
        handle: ({ context, update }) =>
          this.handlePanelTextInput(context, update),
      },
      {
        name: "feedback.staff-reply",
        handle: ({ context, update }) => this.handleStaffReply(context, update),
      },
      {
        name: "feedback.dm",
        handle: ({ context, update }) => this.handleFeedbackDM(context, update),
      },
      {
        name: "dm-chat",
        handle: ({ context, update }) => this.handleDmChat(context, update),
      },
      {
        name: "mention-chat",
        handle: ({ context, update }) =>
          this.handleMentionChat(context, update),
      },
      {
        name: "mission.progress",
        handle: ({ context, update }) =>
          this.handleMissionProgress(context, update),
      },
      {
        name: "antiflood.message",
        handle: ({ context, update }) =>
          this.handleAntifloodMessage(context, update),
      },
      {
        name: "scam.watch",
        handle: ({ context, update }) => this.watchForScam(context, update),
      },
      {
        // De los últimos a proposito: mira mensajes SIN comando (una letra del
        // ahorcado, una palabra del wordle), y eso no puede pasar por delante
        // de nada que ya tuviera algo que decir sobre ese mensaje. Se corta en
        // seco si el texto no mide 1 o 5 caracteres, antes de tocar la BD.
        name: "games.text",
        handle: ({ context, update }) =>
          this.chatGamesHandlers().handleText(update, context.tenantId),
      },
    ];
    return this.botHandlersCache;
  }

  private async runPostProcessors(input: BotPostProcessorInput): Promise<void> {
    let mode: BotModeResolution | null = null;
    for (const processor of this.botPostProcessors()) {
      try {
        const gate = GATED_POSTPROCESSORS[processor.name];
        if (gate) {
          if (mode === null) {
            mode = input.context.chatId
              ? await this.botMode(input.context.chatId)
              : ALL_ENABLED_BOT_MODE;
          }
          if (!mode[gate]) {
            continue;
          }
        }
        await processor.run(input);
      } catch (error) {
        // One broken post-processor must never block the ones behind it, the
        // reply delivery, or markUpdateProcessed — these are best-effort side
        // effects (analytics/XP/automations), not the primary reply.
        this.logger.error(
          {
            processor: processor.name,
            updateId: input.update.updateId,
            chatId: input.context.chatId,
            tenantId: input.context.tenantId,
            error,
          },
          "post-processor failed",
        );
      }
    }
  }

  private botPostProcessors(): readonly BotPostProcessor[] {
    if (this.botPostProcessorsCache) {
      return this.botPostProcessorsCache;
    }

    this.botPostProcessorsCache = [
      {
        name: "activity-xp",
        run: async ({ context, update }) => {
          await this.grantActivityXp(context, update);
        },
      },
      {
        name: "activity-currency",
        run: async ({ context, update }) => {
          await this.grantActivityCurrency(context, update);
        },
      },
      {
        name: "activity-record",
        run: async ({ context, update }) => {
          await this.recordActivity(context, update);
        },
      },
      {
        name: "gamification-first-message",
        run: async ({ context, update }) => {
          if (
            update.kind === "message" &&
            !isServiceMessage(update.raw) &&
            update.user.userId
          ) {
            await this.progressGamification(
              context,
              update.user.userId,
              "first_message",
            );
          }
        },
      },
      {
        name: "automation-message",
        run: async ({ context, update }) => {
          await this.runAutomationsForMessage(context, update);
        },
      },
      {
        name: "automation-new-members",
        run: async ({ context, update }) => {
          await this.runAutomationsForNewMembers(context, update);
        },
      },
    ];
    return this.botPostProcessorsCache;
  }

  private async ackCallbackQuery(
    rawUpdate: unknown,
    text?: string,
    showAlert?: boolean,
  ): Promise<void> {
    const callbackQueryId = extractCallbackQueryId(rawUpdate);
    if (!callbackQueryId) {
      return;
    }
    try {
      await this.telegramGateway.answerCallbackQuery({
        callbackQueryId,
        text,
        token: this.telegramToken(),
        ...(showAlert ? { showAlert: true } : {}),
      });
    } catch {
      // The reply still goes out even if the ack fails.
    }
  }

  /**
   * Sends the reply the right way: native dice via sendDice, GroupHelp-style
   * in-place edits via editMessageText (when `edit` is set on a callback), and a
   * fresh message otherwise. If an in-place edit fails (e.g. Telegram's
   * "message is not modified"), it is treated as delivered since the content is
   * already on screen.
   */
  private async deliverReply(
    update: TelegramUpdateEnvelope,
    rawUpdate: unknown,
    reply: BotReply,
  ): Promise<{ ok: boolean }> {
    return deliverBotReply({
      gateway: this.telegramGateway,
      update,
      rawUpdate,
      reply,
      token: this.telegramToken(),
    });
  }

  /**
   * GroupHelp-style group configuration. Three entry points:
   *  - `/settings` (aliases /config, /ajustes) inside a group -> a button that
   *    deep-links to this bot's private chat.
   *  - `/start cfg_<groupId>` in private -> opens the settings root panel.
   *  - `cfg:*` callbacks -> apply a change and re-render the panel in place.
   * Every mutating action re-verifies the user is an admin of the target group.
   */
  private async handleSettings(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    replyBotUsername: string,
  ): Promise<BotReply | null> {
    const commandName = update.command?.name;
    const isPrimary = this.isPrimaryBot(replyBotUsername);

    if (
      commandName === "settings" ||
      commandName === "config" ||
      commandName === "ajustes"
    ) {
      const chatType = update.chat.chatType;

      if (
        (chatType === "group" || chatType === "supergroup") &&
        update.chat.chatId
      ) {
        // Plain url buttons: web_app buttons are rejected by Telegram in groups.
        // Deep-link to THIS bot's private chat (child bots have their own DM).
        const rows: Array<Array<{ text: string; url: string }>> = [
          [
            {
              text: "⚙️ Abrir ajustes",
              url: buildSettingsDeepLink(replyBotUsername, update.chat.chatId),
            },
          ],
        ];
        // The named-app Mini App link (t.me/<bot>/<app>) only resolves for the
        // primary bot, which registered that app in BotFather. Child bots have
        // no named app, so they open the Mini App from their DM panel instead
        // (see openSettingsRoot).
        if (
          isPrimary &&
          readAppUrl(this.env.TELEGRAM_APP_URL).startsWith("https://")
        ) {
          rows.push([
            {
              text: "🚀 Configurar (Mini App)",
              url: buildMiniAppLink(
                replyBotUsername,
                this.env.TELEGRAM_MINIAPP_NAME,
                update.chat.chatId,
              ),
            },
          ]);
          // Atajo directo a la economia. Sin el, encenderla eran tres pasos:
          // abrir ajustes en privado, encontrar la fila y entrar. El panel
          // privado la sigue teniendo; esto solo evita el rodeo desde el grupo.
          rows.push([
            {
              text: "💰 Economía y juegos",
              url: buildNamedMiniAppLink(
                replyBotUsername.replace(/^@/u, ""),
                this.env.TELEGRAM_MINIAPP_NAME,
                encodeEconomyStartParam(update.chat.chatId.toString()),
              ),
            },
          ]);
        }
        return {
          text: "⚙️ Configura este grupo desde mi chat privado (solo administradores). Pulsa el botón:",
          replyMarkup: { inline_keyboard: rows },
        };
      }

      return {
        text: "Usa /settings dentro del grupo que quieras configurar y te daré un botón para abrir el panel aquí.",
      };
    }

    if (commandName === "start") {
      const groupId = parseSettingsStart(update.command?.args?.[0]);

      if (groupId === null) {
        return null;
      }

      return this.openSettingsRoot(
        context,
        update,
        groupId,
        false,
        replyBotUsername,
      );
    }

    const callback = parseSettingsCallback(update.callbackData);

    if (callback) {
      return this.applySettingsCallback(context, update, callback);
    }

    return null;
  }

  /**
   * Admin-list cache (Rose-style "admincache"): getChatAdministrators is rate
   * limited and called on every fed action, so results are cached per group for
   * a short TTL to cut API calls in busy groups.
   *
   * Guarda la entrada ENTERA, no solo el id. Telegram ya manda los permisos en
   * la misma respuesta, y quedarse solo con los ids obligaba a que todo el que
   * necesitara saber *qué* puede hacer un admin —no solo que lo es— pidiera la
   * lista otra vez o, peor, no lo comprobara. Ver `actorCanPromote`.
   */
  private readonly adminCache = new Map<
    string,
    { admins: readonly TelegramChatAdminInfo[]; expiresAt: number }
  >();
  private static readonly ADMIN_CACHE_TTL_MS = 300_000;

  /**
   * Igual que `adminCache` pero guardando NOMBRES, no ids: detectar a quien se
   * hace pasar por un admin necesita contra qué comparar, y un id no se
   * suplanta — se suplanta un nombre. Caché aparte y no un campo más en la otra
   * porque aquélla la leen rutas calientes (cada acción federada) a las que no
   * les hace falta cargar con esto.
   */
  private readonly adminIdentityCache = new Map<
    string,
    { identities: readonly ImpersonationIdentity[]; expiresAt: number }
  >();

  /**
   * Un aviso de suplantación por persona y grupo. Sin esto, alguien que entra y
   * sale repetidamente convierte la sala de STAFF en un despertador — y una
   * alerta que cansa se acaba ignorando el día que es verdad.
   */
  private readonly recentImpersonationAlerts = new Map<string, number>();
  private static readonly IMPERSONATION_ALERT_DEDUP_MS = 86_400_000;

  /**
   * Joins already greeted, keyed `chatId:userId`, so one arrival gets one
   * welcome. A member added by an admin produces BOTH a `new_chat_members`
   * service message and a `chat_member` update, and both are legitimate join
   * signals — without this the group would see the welcome twice.
   *
   * In memory on purpose: the window is a couple of minutes, so a redeploy
   * losing it costs at most one duplicated greeting and does not justify a
   * table on the join path.
   */
  private readonly recentWelcomes = new Map<string, number>();
  private static readonly WELCOME_DEDUP_MS = 120_000;

  /**
   * Last antiflood sanction per `chat:user`, so one burst produces one
   * punishment. See handleAntifloodMessage for the race this closes.
   */
  /**
   * La reja que impide sancionar dos veces el mismo flood.
   *
   * La decision y su ventana se fueron a `modules/security`
   * (`crearReservaDeFlood`), donde tienen tests. Al sacarla aparecio un fallo:
   * purgaba las reservas con un horizonte fijo de 10 minutos mientras el
   * cooldown le llegaba por fuera, y `/antiflood_limit` no pone tope a la
   * ventana. Con una ventana mayor de 10 minutos la reja se desarmaba sola.
   *
   * Aqui solo queda el estado por proceso. Sigue en memoria a proposito: la
   * ventana dura segundos, asi que un redespliegue la vacia sin consecuencias.
   */
  private readonly reservaDeFlood = crearReservaDeFlood();

  /**
   * Ventana en memoria de acciones destructivas por chat, para el freno de
   * borrado masivo. Vive en memoria a proposito: la ventana dura minutos, asi
   * que un redespliegue la vacia sin consecuencias y no justifica una tabla.
   */
  private readonly destructiveActions = new Map<string, DestructiveAction[]>();
  /** Actor que ya fue frenado una vez y cuya repeticion vale por confirmacion. */
  private readonly massActionConfirmations = new Map<string, number>();
  private static readonly MASS_ACTION_WINDOW_MS = 300_000;
  private static readonly MASS_ACTION_THRESHOLD = 200;
  private static readonly MASS_ACTION_CONFIRM_MS = 60_000;

  /** Anota una accion destructiva ya ejecutada y poda la ventana de paso. */
  private recordDestructiveAction(
    telegramChatId: bigint,
    kind: string,
    targetCount: number,
  ): void {
    const key = telegramChatId.toString();
    const now = Date.now();
    const kept = massActionWithinWindow(
      this.destructiveActions.get(key) ?? [],
      BotUpdateService.MASS_ACTION_WINDOW_MS,
      now,
    );
    kept.push({ kind, targetCount, ms: now });
    this.destructiveActions.set(key, kept);
  }

  /**
   * Devuelve el motivo por el que hay que frenar, o null para seguir.
   *
   * Si el mismo actor repite el comando dentro de MASS_ACTION_CONFIRM_MS se
   * toma como confirmacion explicita y pasa. El freno existe para que nadie
   * borre cientos de mensajes por inercia o por prisa, no para dejar a un
   * admin sin poder limpiar su propio grupo: un borrado no se deshace, pero
   * escribir el comando dos veces cuesta dos segundos.
   */
  private massActionBlocked(
    telegramChatId: bigint,
    actorKey: string,
  ): string | null {
    const now = Date.now();
    const confirmKey = `${telegramChatId.toString()}:${actorKey}`;
    const pending = this.massActionConfirmations.get(confirmKey);
    if (
      pending !== undefined &&
      now - pending <= BotUpdateService.MASS_ACTION_CONFIRM_MS
    ) {
      this.massActionConfirmations.delete(confirmKey);
      return null;
    }

    const verdict = detectMassAction(
      this.destructiveActions.get(telegramChatId.toString()) ?? [],
      BotUpdateService.MASS_ACTION_WINDOW_MS,
      now,
      BotUpdateService.MASS_ACTION_THRESHOLD,
    );
    if (!verdict.blocked) {
      return null;
    }

    this.massActionConfirmations.set(confirmKey, now);
    return verdict.reason;
  }

  /**
   * La lista de admins del grupo CON sus permisos, cacheada. `cachedAdminIds`
   * sale de aquí, así que una sola llamada a Telegram sirve para las dos
   * preguntas: quién es admin y qué puede hacer.
   */
  private async cachedAdminInfo(
    groupId: bigint,
  ): Promise<readonly TelegramChatAdminInfo[]> {
    const key = groupId.toString();
    const cached = this.adminCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.admins;
    }

    const result = await this.telegramGateway.getChatAdministrators({
      chatId: groupId,
      token: this.telegramToken(),
    });
    const admins = result.admins ?? [];
    this.adminCache.set(key, {
      admins,
      expiresAt: Date.now() + BotUpdateService.ADMIN_CACHE_TTL_MS,
    });
    return admins;
  }

  private async cachedAdminIds(groupId: bigint): Promise<readonly bigint[]> {
    return (await this.cachedAdminInfo(groupId)).map((admin) => admin.userId);
  }

  /**
   * Nombres y alias de los admins reales del grupo, para comparar contra ellos.
   * Los bots se excluyen: nadie entra a un grupo suplantando a @GroupHelp, y
   * dejarlos dentro solo añade falsos positivos.
   */
  private async cachedAdminIdentities(
    groupId: bigint,
  ): Promise<readonly ImpersonationIdentity[]> {
    const key = groupId.toString();
    const cached = this.adminIdentityCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.identities;
    }

    const result = await this.telegramGateway.getChatAdministrators({
      chatId: groupId,
      token: this.telegramToken(),
    });
    const identities = adminIdentitiesFrom(result.admins ?? []);
    this.adminIdentityCache.set(key, {
      identities,
      expiresAt: Date.now() + BotUpdateService.ADMIN_CACHE_TTL_MS,
    });
    return identities;
  }

  /**
   * Avisa al STAFF cuando alguien entra con el nombre de un admin — la jugada de
   * apertura de casi toda estafa por privado: te escribe "el admin" y te pide
   * algo.
   *
   * **Avisa, nunca actúa.** El módulo marca también a quien lleva "admin" o
   * "soporte" en el nombre, y eso caza igual a un estafador que a alguien que se
   * llame "Adminah": expulsar por eso sacaría a personas reales sin que se
   * enteren de por qué. Un aviso mal puesto cuesta un vistazo; una expulsión mal
   * puesta cuesta una persona.
   *
   * Va colgado de `chat_member` y no de `new_chat_members` a propósito: un grupo
   * que filtra por solicitudes NUNCA emite el mensaje de servicio, así que
   * colgarlo de ahí lo dejaría vigilando exactamente cero entradas en los grupos
   * que más lo necesitan.
   *
   * La sala de STAFF es el interruptor: sin ella configurada, esto no existe.
   */
  private async alertOnImpersonation(
    context: FoundationContext,
    telegramChatId: bigint,
    member: UserContext,
  ): Promise<void> {
    const nombre = member.firstName ?? member.username;
    if (!nombre || !member.userId || !context.chatId) {
      return;
    }

    const clave = `${telegramChatId}:${member.userId}`;
    const ahora = Date.now();
    const ultimo = this.recentImpersonationAlerts.get(clave);
    if (
      ultimo !== undefined &&
      ahora - ultimo < BotUpdateService.IMPERSONATION_ALERT_DEDUP_MS
    ) {
      return;
    }

    try {
      const settings = await this.guardianRepository.getSettings(
        context.tenantId,
        context.chatId,
      );
      const staffChatId = settings?.staffChatId;
      if (!staffChatId) {
        return;
      }

      const admins = await this.cachedAdminIdentities(telegramChatId);
      if (admins.length === 0) {
        return;
      }

      const verdict = detectImpersonation(
        {
          name: nombre,
          ...(member.username !== undefined
            ? { username: member.username }
            : {}),
        },
        admins,
      );
      if (!verdict.isImpersonation) {
        return;
      }

      this.recentImpersonationAlerts.set(clave, ahora);
      for (const [vieja, ms] of this.recentImpersonationAlerts) {
        if (ahora - ms > BotUpdateService.IMPERSONATION_ALERT_DEDUP_MS) {
          this.recentImpersonationAlerts.delete(vieja);
        }
      }

      const etiqueta = member.username
        ? `@${member.username}`
        : `${nombre} (${member.userId})`;
      await this.telegramGateway.sendMessage({
        chatId: staffChatId,
        token: this.telegramToken(),
        ...(settings?.staffThreadId != null
          ? { messageThreadId: settings.staffThreadId }
          : {}),
        reply: { text: buildImpersonationAlert(etiqueta, verdict) },
      });
    } catch {
      // Best-effort de principio a fin: perder el aviso no puede estropear la
      // entrada de la persona, que es lo que de verdad estaba pasando.
    }
  }

  /**
   * `/permisos` — quién puede hacer daño en este grupo y no lo usa.
   *
   * Es el ataque que nadie ve venir: no entra nadie nuevo, simplemente hay
   * cuentas viejas con poder de banear que llevan meses sin tocar el grupo. Si
   * una de ellas se pierde o se vende, el atacante entra ya siendo admin.
   *
   * Solo informa. Quitar permisos a mano es una decisión con consecuencias
   * sociales (degradar a alguien se nota, y ofende) que no le corresponde
   * tomar a un bot.
   */
  private static readonly PERMISSION_AUDIT_STALE_DAYS = 90;
  /** Un nombramiento de mas de medio año merece una revision, no una
   * revocacion: la gente sigue ahi, pero nadie recuerda por que. */
  private static readonly STALE_STAFF_MAX_AGE_MS = 180 * 86_400_000;

  private async handlePermissionAudit(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const name = update.command?.name;
    if (name !== "permisos" && name !== "auditoria_permisos") {
      return null;
    }
    const telegramChatId = update.chat.chatId;
    if (!telegramChatId || !context.chatId) {
      return null;
    }
    if (!(await this.isGroupAdmin(telegramChatId, update.user.userId))) {
      return { text: "Solo un administrador del grupo puede pedir esto." };
    }

    const dias = BotUpdateService.PERMISSION_AUDIT_STALE_DAYS;
    const staleMs = dias * 86_400_000;

    const result = await this.telegramGateway
      .getChatAdministrators({
        chatId: telegramChatId,
        token: this.telegramToken(),
      })
      .catch(() => null);
    const humanos = (result?.admins ?? []).filter((admin) => !admin.isBot);
    if (humanos.length === 0) {
      return {
        text: buildAdminOversightReport({
          revisados: 0,
          excess: [],
          externos: [],
          antiguos: [],
          nombres: new Map(),
          diasSinUsar: dias,
        }),
      };
    }

    // Cuándo moderó por última vez cada uno. Si la consulta falla se sigue con
    // el mapa vacío: eso hace que todos salgan como "sin actividad reciente",
    // que es ruidoso pero NUNCA absuelve a nadie por error — el fallo cae del
    // lado de mirar de más, no del de dar por bueno.
    const ultimas = await this.repository
      .findLastModerationActionByTelegramUserIds(
        context.tenantId,
        humanos.map((admin) => admin.userId),
        isModerationAction,
      )
      .catch(() => new Map<string, number>());

    const perms: AdminPerms[] = humanos.map((admin) => {
      const ultima = ultimas.get(admin.userId.toString());
      return {
        userId: admin.userId.toString(),
        canBan: admin.canRestrict,
        canDelete: admin.canDelete,
        canPin: admin.canPin,
        canPromote: admin.canPromote,
        ...(ultima !== undefined ? { lastActionMs: ultima } : {}),
      };
    });

    const nombres = new Map(
      humanos.map((admin) => [
        admin.userId.toString(),
        admin.username
          ? `@${admin.username}`
          : (admin.firstName ?? admin.userId.toString()),
      ]),
    );

    // Quien nombro Modryva. Es la lista de a quien PUEDE degradar: todo admin
    // vivo que no este aqui lo ascendio otra persona u otro bot, y eso es
    // exactamente la jugada de apertura de una toma de grupo.
    //
    // Si la lectura falla se deja vacia y NO se acusa a nadie de externo: sin
    // saber a quien nombramos, "no lo nombramos nosotros" no se sostiene, y
    // señalar a los diez admins de un grupo por un fallo de base de datos
    // destruye la confianza en el informe entero.
    const nombrados = await this.botGrantedAdminRepository
      .list(context.tenantId, context.chatId)
      .then((rows) => rows.filter((row) => row.status === "active"))
      .catch(() => null);

    const externos =
      nombrados === null
        ? []
        : humanos
            .filter(
              (admin) =>
                !admin.isOwner &&
                !nombrados.some((row) => row.telegramUserId === admin.userId),
            )
            .map((admin) => admin.userId.toString());

    const ahora = Date.now();
    const antiguos = (nombrados ?? [])
      .filter(
        (row) =>
          detectStaleStaffRoles(
            [{ staffId: 0, grantedMs: row.grantedAt.getTime() }],
            ahora,
            { maxAgeMs: BotUpdateService.STALE_STAFF_MAX_AGE_MS },
          ).length > 0,
      )
      .map((row) => ({
        userId: row.telegramUserId.toString(),
        dias: Math.floor((ahora - row.grantedAt.getTime()) / 86_400_000),
      }));

    for (const row of nombrados ?? []) {
      const clave = row.telegramUserId.toString();
      if (!nombres.has(clave)) {
        nombres.set(
          clave,
          row.username ? `@${row.username}` : (row.displayName ?? clave),
        );
      }
    }

    return {
      text: buildAdminOversightReport({
        revisados: humanos.length,
        excess: findExcessPermissions(perms, ahora, staleMs),
        externos,
        antiguos,
        nombres,
        diasSinUsar: dias,
      }),
    };
  }

  /**
   * Entradas coordinadas: varias cuentas con nombres casi iguales entrando casi
   * a la vez ("Ana1", "Ana2", "Ana3"). Es el patron de un raid de titeres, y
   * mirando una sola entrada es invisible — solo se ve en conjunto.
   *
   * La ventana vive en memoria a proposito: son 60 segundos. Una tabla para eso
   * costaria una escritura por cada persona que entra en cualquier grupo, y un
   * reinicio pierde como mucho la deteccion de un raid en curso.
   *
   * Avisa, no actua: expulsar a tres personas porque se llamen parecido es
   * exactamente el error que no se puede deshacer.
   */
  private readonly recentJoinsByChat = new Map<
    string,
    { name: string; joinMs: number }[]
  >();
  private static readonly RAID_WINDOW_MS = 60_000;

  private async alertOnMultiAccountRaid(
    context: FoundationContext,
    telegramChatId: bigint,
    member: UserContext,
  ): Promise<void> {
    const nombre = member.firstName ?? member.username;
    if (!nombre || !context.chatId) {
      return;
    }
    const clave = telegramChatId.toString();
    const ahora = Date.now();
    const recientes = (this.recentJoinsByChat.get(clave) ?? []).filter(
      (join) => ahora - join.joinMs <= BotUpdateService.RAID_WINDOW_MS,
    );
    recientes.push({ name: nombre, joinMs: ahora });
    this.recentJoinsByChat.set(clave, recientes);

    const verdict = detectMultiAccountJoin(recientes, {
      windowMs: BotUpdateService.RAID_WINDOW_MS,
    });
    if (!verdict.suspicious) {
      return;
    }
    // Se limpia la ventana tras avisar: si no, cada entrada posterior del mismo
    // grupo vuelve a disparar la misma alerta.
    this.recentJoinsByChat.set(clave, []);

    try {
      const settings = await this.guardianRepository.getSettings(
        context.tenantId,
        context.chatId,
      );
      if (!settings?.staffChatId) {
        return;
      }
      await this.telegramGateway.sendMessage({
        chatId: settings.staffChatId,
        token: this.telegramToken(),
        ...(settings.staffThreadId != null
          ? { messageThreadId: settings.staffThreadId }
          : {}),
        reply: {
          text: [
            "🚨 Posible entrada coordinada",
            "",
            `${verdict.clusterSize} cuentas con nombres casi iguales (empiezan por "${verdict.clusterPrefix}") han entrado en menos de un minuto.`,
            "",
            "No se ha hecho nada: puede ser un raid de cuentas titeres, o gente de la misma familia. Miralo tu.",
          ].join("\n"),
        },
      });
    } catch {
      // Best-effort: perder el aviso no puede estropear la entrada de nadie.
    }
  }

  /**
   * `/darfichas <id> <cantidad> [motivo]` — conceder fichas a mano.
   *
   * Existia solo como SQL directo contra produccion (dos veces ya: el 29 de
   * julio y el 5 de agosto). Un privilegio que solo se ejerce escribiendo SQL
   * no tiene puerta, ni registro que diga quien lo hizo, ni forma de que salga
   * mal de manera segura.
   *
   * Se anota como `gift`, que es lo que es. La primera vez se anoto como `win`
   * y meses despues, revisando la economia, parecia un exploit: hubo que
   * reconstruir a mano que lo habia puesto el dueno. Una razon que miente
   * cuesta cero al escribirla y una investigacion al leerla.
   *
   * El tope no es un capricho: `balance` es un entero de 32 bits, asi que un
   * saldo cerca del techo desborda en la primera ganancia grande.
   */
  private static readonly CHIP_GRANT_MAX = 100_000_000;

  /**
   * Tope de un ajuste de saldo, en valor absoluto.
   *
   * Mismo motivo que el de las fichas: `balance` es un entero de 32 bits, asi
   * que un saldo cerca del techo desborda en la primera ganancia grande. Y un
   * tope tambien limita el dano de una errata al escribir el comando.
   */
  private static readonly AJUSTE_SALDO_MAX = 100_000_000;
  /**
   * Techo de `/setmonedas`. Mas bajo que el entero de 32 bits a proposito:
   * `balance` y `protectedBalance` son dos columnas `integer` de la misma
   * cartera y la mas grande de produccion ya suma el 44% del techo. Dejar
   * margen es lo que evita que la siguiente ganancia normal reviente con
   * "integer out of range".
   */
  private static readonly SALDO_MAX = 1_000_000_000;

  /**
   * Sube o baja el saldo de alguien. Solo el owner de plataforma.
   *
   * Existe porque no habia ninguna forma de hacerlo: ni comando, ni panel. La
   * unica alternativa era un UPDATE a mano contra la base de produccion, que no
   * deja rastro, no se puede deshacer y no pasa por el libro mayor.
   *
   * Esto si pasa: el movimiento se escribe con su motivo y queda en la
   * auditoria, asi que dentro de seis meses se puede saber quien lo hizo y por
   * que. **Una razon que miente cuesta cero al escribirla y una investigacion
   * al leerla.**
   *
   * Es por grupo, y no puede ser de otra forma: la economia vive por chat, asi
   * que hay que ejecutarlo dentro del grupo cuyo saldo se quiere tocar.
   *
   * Restar mas de lo que hay **no se recorta en silencio**: se rechaza diciendo
   * el saldo real. Dejar a alguien en negativo o "hasta donde llegue" son dos
   * cosas distintas y quien lo escribe tiene que elegir a proposito.
   */
  private async handleBalanceAdjust(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.command?.name !== "ajustarsaldo") {
      return null;
    }
    const actor = update.user.userId;
    if (!actor || !(await this.isPlatformOwner(actor))) {
      // Silencio no: quien lo intenta sin poder merece saber por que no pasa
      // nada. Mismo criterio que `/darfichas`.
      return { text: "Solo un owner de plataforma puede ajustar saldos." };
    }
    if (!context.chatId) {
      return { text: "La economia va por grupo: usalo dentro del grupo." };
    }

    const args = update.command?.args ?? [];
    const destino = args[0];
    const cantidadTexto = args[1];
    if (!destino || !cantidadTexto) {
      return {
        text: "Uso: /ajustarsaldo <telegram_id> <cantidad> [motivo]\nLa cantidad puede ser negativa para restar.",
      };
    }

    const telegramUserId = idDeTelegramDelArgumento(destino);
    if (telegramUserId === undefined) {
      return { text: "El primer argumento tiene que ser un id de Telegram." };
    }

    const cantidad = Number(cantidadTexto);
    if (
      !Number.isInteger(cantidad) ||
      cantidad === 0 ||
      Math.abs(cantidad) > BotUpdateService.AJUSTE_SALDO_MAX
    ) {
      return {
        text: `La cantidad tiene que ser un entero distinto de 0 y como mucho ${BotUpdateService.AJUSTE_SALDO_MAX.toLocaleString("es-ES")} en valor absoluto.`,
      };
    }

    const motivo = args.slice(2).join(" ") || "sin motivo";
    await this.economyRepository.ensureWallet(
      context.tenantId,
      context.chatId,
      telegramUserId,
    );

    // Determinista: si el update se reprocesa —y ahora se reprocesa de verdad,
    // porque el poller reintenta en vez de perder— el indice unico del libro
    // mayor para el segundo intento. Con `Date.now()` dentro no protegeria de
    // nada.
    const refId = this.claveDeterminista(update, `ajuste:${telegramUserId}`);

    if (cantidad > 0) {
      const abono = await this.economyRepository.credit(
        context.tenantId,
        context.chatId,
        telegramUserId,
        cantidad,
        "admin-adjust",
        refId,
      );
      await this.auditarAjusteDeSaldo(context, {
        telegramUserId,
        cantidad,
        motivo,
        actor,
      });
      return {
        text: `Sumadas ${cantidad.toLocaleString("es-ES")} a ${telegramUserId}. Saldo: ${abono.balance.toLocaleString("es-ES")}. Motivo: ${motivo}.`,
      };
    }

    const cobro = await this.economyRepository.debit(
      context.tenantId,
      context.chatId,
      telegramUserId,
      Math.abs(cantidad),
      "admin-adjust",
      refId,
    );
    if (!cobro.ok) {
      return {
        text: `No pude restar ${Math.abs(cantidad).toLocaleString("es-ES")}: solo tiene ${cobro.balance.toLocaleString("es-ES")}. Si quieres dejarlo a cero, pon esa cantidad.`,
      };
    }

    await this.auditarAjusteDeSaldo(context, {
      telegramUserId,
      cantidad,
      motivo,
      actor,
    });
    return {
      text: `Restadas ${Math.abs(cantidad).toLocaleString("es-ES")} a ${telegramUserId}. Saldo: ${cobro.balance.toLocaleString("es-ES")}. Motivo: ${motivo}.`,
    };
  }

  /**
   * `/setmonedas <telegram_id> <cantidad> [motivo]` — FIJA el saldo de alguien.
   *
   * Hermano de `/ajustarsaldo`, no un duplicado: aquel suma o resta, este deja
   * el saldo en un numero exacto. La diferencia importa justo cuando mas falta
   * hace. Para dejar a alguien a cero con `/ajustarsaldo` hay que mirar su
   * saldo, restar esa cifra, y confiar en que no cambie entre las dos cosas —y
   * en un grupo vivo cambia: check-in, robos, mensajes—. Si cambia, o se
   * rechaza por pasarse, o se queda corto y quien lo pidio cree que dejo a
   * alguien a cero cuando le ha dejado 37.
   *
   * `setBalance` lee y escribe dentro de la misma transaccion, asi que no hay
   * hueco donde colarse.
   *
   * Lo demas es identico a `/ajustarsaldo` a proposito: misma guarda de owner,
   * misma clave determinista, mismo motivo en el libro y la misma auditoria. El
   * apunte que queda es la DIFERENCIA, porque el libro cuenta movimientos y no
   * fotos.
   */
  private async handleBalanceSet(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.command?.name !== "setmonedas") {
      return null;
    }
    const actor = update.user.userId;
    if (!actor || !(await this.isPlatformOwner(actor))) {
      return { text: "Solo un owner de plataforma puede fijar saldos." };
    }
    if (!context.chatId) {
      return { text: "La economia va por grupo: usalo dentro del grupo." };
    }

    const args = update.command?.args ?? [];
    const destino = args[0];
    const cantidadTexto = args[1];
    if (!destino || !cantidadTexto) {
      return {
        text: [
          "Uso: /setmonedas <telegram_id> <cantidad> [motivo]",
          "Deja el saldo en esa cifra exacta. Para sumar o restar, /ajustarsaldo.",
        ].join("\n"),
      };
    }

    const telegramUserId = idDeTelegramDelArgumento(destino);
    if (telegramUserId === undefined) {
      return { text: "El primer argumento tiene que ser un id de Telegram." };
    }

    const objetivo = Number(cantidadTexto);
    if (
      !Number.isInteger(objetivo) ||
      objetivo < 0 ||
      objetivo > BotUpdateService.SALDO_MAX
    ) {
      // El tope no es un capricho: `balance` es un entero de 32 bits y ademas
      // convive con `protectedBalance` en la misma cartera. Un saldo cerca del
      // techo desborda en la primera ganancia grande, y Postgres lo rechaza con
      // "integer out of range" — fallo ruidoso, pero fallo.
      return {
        text: `La cantidad tiene que ser un entero entre 0 y ${BotUpdateService.SALDO_MAX.toLocaleString("es-ES")}.`,
      };
    }

    const motivo = args.slice(2).join(" ") || "sin motivo";
    const refId = this.claveDeterminista(update, `fijar:${telegramUserId}`);

    const res = await this.economyRepository.setBalance({
      tenantId: context.tenantId,
      chatId: context.chatId,
      userTelegramId: telegramUserId,
      target: objetivo,
      reason: "admin-adjust",
      refId,
    });
    if (!res.ok) {
      return {
        text: `Eso ya estaba hecho. Saldo: ${res.balance.toLocaleString("es-ES")}.`,
      };
    }
    if (res.delta === 0) {
      return {
        text: `Ya tenia ${objetivo.toLocaleString("es-ES")}. No he tocado nada.`,
      };
    }

    await this.auditarAjusteDeSaldo(context, {
      telegramUserId,
      cantidad: res.delta,
      motivo,
      actor,
    });
    const signo = res.delta > 0 ? "+" : "";
    return {
      text: `Saldo de ${telegramUserId} fijado en ${res.balance.toLocaleString("es-ES")} (${signo}${res.delta.toLocaleString("es-ES")}). Motivo: ${motivo}.`,
    };
  }

  /** El rastro del ajuste. Sin esto, dentro de seis meses nadie sabe que paso. */
  private async auditarAjusteDeSaldo(
    context: FoundationContext,
    datos: {
      telegramUserId: bigint;
      cantidad: number;
      motivo: string;
      actor: bigint;
    },
  ): Promise<void> {
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      ...(context.userId ? { actorId: context.userId } : {}),
      action: "economy.balance_adjusted",
      resourceType: "wallet",
      resourceId: datos.telegramUserId.toString(),
      payload: {
        amount: datos.cantidad,
        reason: datos.motivo,
        adjustedByTelegramId: datos.actor.toString(),
        chatId: context.chatId,
      },
    });
  }

  /**
   * `/ilimitado <telegram_id> on|off [motivo]` — el saldo sin fondo, a mano.
   *
   * Sin argumentos LISTA quien lo tiene en este grupo, y esa mitad no es un
   * extra: un privilegio que solo se puede consultar entrando en Postgres no lo
   * revisa nadie, y entonces sobrevive a la razon por la que se dio.
   *
   * Hermano de `/setmonedas` y `/ajustarsaldo`, con una diferencia que decide
   * medio fichero: esto **no mueve dinero**, asi que no escribe en el libro
   * mayor. El libro cuenta movimientos y aqui no se mueve una moneda; lo que
   * cambia es la regla por la que se mueven. Su rastro es la auditoria, que es
   * donde se pregunta quien concedio que.
   *
   * Y por lo mismo no necesita clave de idempotencia: fijar una bandera dos
   * veces la deja igual. `credit` la necesita porque sumar dos veces no.
   *
   * Existe porque la columna ya estaba y no habia forma de tocarla sin SQL
   * contra produccion —sin guarda, sin registro de quien lo hizo y mas facil
   * de encender que de apagar—, que es exactamente lo que ya costo caro con
   * las fichas.
   */
  private async handleUnlimitedBalance(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.command?.name !== "ilimitado") {
      return null;
    }
    const actor = update.user.userId;
    if (!actor || !(await this.isPlatformOwner(actor))) {
      return {
        text: "Solo un owner de plataforma puede tocar el saldo sin fondo.",
      };
    }
    if (!context.chatId) {
      return { text: "La economia va por grupo: usalo dentro del grupo." };
    }

    const args = update.command?.args ?? [];
    if (args.length === 0) {
      return this.listarSaldosSinFondo(context.tenantId, context.chatId);
    }

    const telegramUserId = idDeTelegramDelArgumento(args[0]);
    if (telegramUserId === undefined) {
      return { text: "El primer argumento tiene que ser un id de Telegram." };
    }
    const estado = (args[1] ?? "").toLowerCase();
    if (estado !== "on" && estado !== "off") {
      return {
        text: [
          "Uso: /ilimitado <telegram_id> on|off [motivo]",
          "Sin argumentos, lista quien lo tiene en este grupo.",
        ].join("\n"),
      };
    }
    const motivo = args.slice(2).join(" ") || "sin motivo";

    const queda = await this.economyRepository.setUnlimited({
      tenantId: context.tenantId,
      chatId: context.chatId,
      userTelegramId: telegramUserId,
      unlimited: estado === "on",
    });
    await this.auditarSaldoSinFondo(context, {
      telegramUserId,
      concedido: queda,
      motivo,
      actor,
    });
    if (queda) {
      return {
        text: [
          `♾️ ${telegramUserId} pasa a tener saldo sin fondo en este grupo.`,
          "Paga siempre y su saldo deja de moverse, asi que la cifra que se le vea ya no significa nada: lo que hace queda en el libro mayor.",
          `Motivo: ${motivo}.`,
        ].join("\n"),
      };
    }
    return {
      text: [
        `${telegramUserId} vuelve a pagar con lo que tiene.`,
        "Se queda con el saldo en el que estaba congelado, ni mas ni menos.",
        `Motivo: ${motivo}.`,
      ].join("\n"),
    };
  }

  /** La mitad de `/ilimitado` que contesta "quien tiene esto". */
  private async listarSaldosSinFondo(
    tenantId: string,
    chatId: string,
  ): Promise<BotReply> {
    const carteras = await this.economyRepository.unlimitedWallets(
      tenantId,
      chatId,
    );
    if (carteras.length === 0) {
      return {
        text: [
          "Nadie tiene saldo sin fondo en este grupo.",
          "Uso: /ilimitado <telegram_id> on|off [motivo]",
        ].join("\n"),
      };
    }
    return {
      text: [
        `♾️ Saldo sin fondo en este grupo (${carteras.length}):`,
        ...carteras.map(
          (cartera) =>
            `· ${cartera.userTelegramId} — congelado en ${cartera.balance.toLocaleString("es-ES")}`,
        ),
        "",
        "Para quitarselo: /ilimitado <telegram_id> off <motivo>",
      ].join("\n"),
    };
  }

  /**
   * El rastro de la bandera. Es el UNICO que queda, porque esto no pasa por el
   * libro mayor: sin esta fila, dentro de seis meses no hay forma de saber
   * quien regalo el privilegio ni con que motivo.
   */
  private async auditarSaldoSinFondo(
    context: FoundationContext,
    datos: {
      telegramUserId: bigint;
      concedido: boolean;
      motivo: string;
      actor: bigint;
    },
  ): Promise<void> {
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      ...(context.userId ? { actorId: context.userId } : {}),
      action: datos.concedido
        ? "economy.unlimited_granted"
        : "economy.unlimited_revoked",
      resourceType: "wallet",
      resourceId: datos.telegramUserId.toString(),
      payload: {
        reason: datos.motivo,
        grantedByTelegramId: datos.actor.toString(),
        chatId: context.chatId,
      },
    });
  }

  private async handleChipGrant(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const name = update.command?.name;
    if (name !== "darfichas") {
      return null;
    }
    const actor = update.user.userId;
    if (!actor || !(await this.isPlatformOwner(actor))) {
      // Silencio no: este comando no es secreto, y quien lo intenta sin poder
      // merece saber por que no pasa nada.
      return { text: "Solo un owner de plataforma puede conceder fichas." };
    }

    const args = update.command?.args ?? [];
    const destino = args[0];
    const cantidadTexto = args[1];
    if (!destino || !cantidadTexto) {
      return {
        text: "Uso: /darfichas <telegram_id> <cantidad> [motivo]",
      };
    }

    let telegramUserId: bigint;
    try {
      telegramUserId = BigInt(destino);
    } catch {
      return { text: "El primer argumento tiene que ser un id de Telegram." };
    }

    const cantidad = Number(cantidadTexto);
    if (
      !Number.isInteger(cantidad) ||
      cantidad <= 0 ||
      cantidad > BotUpdateService.CHIP_GRANT_MAX
    ) {
      return {
        text: `La cantidad tiene que ser un entero entre 1 y ${BotUpdateService.CHIP_GRANT_MAX.toLocaleString("es-ES")}.`,
      };
    }

    const motivo = args.slice(2).join(" ") || "sin motivo";
    // 0 de bienvenida: esta cartera se abre para recibir el regalo, no para
    // colar de paso el saldo inicial de alguien que nunca ha jugado.
    await this.chipRepository.ensureWallet(context.tenantId, telegramUserId, 0);
    const saldo = await this.chipRepository.credit(
      context.tenantId,
      telegramUserId,
      cantidad,
      "gift",
      // La clave tiene que ser DETERMINISTA o no protege de nada: si se
      // reprocesa el mismo update —cosa que ahora ocurre de verdad, porque el
      // poller reintenta en vez de perderlo— una clave con `Date.now()` seria
      // distinta y el regalo se pagaria dos veces. El `updateId` identifica
      // este envio y no cambia entre intentos; `messageId` se mantiene delante
      // por compatibilidad con las claves ya escritas en el libro mayor.
      `owner-grant:${actor}:${update.messageId ?? `u${update.updateId}`}`,
    );

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      ...(context.userId ? { actorId: context.userId } : {}),
      action: "casino.chips_granted",
      resourceType: "chip_wallet",
      resourceId: telegramUserId.toString(),
      payload: {
        amount: cantidad,
        reason: motivo,
        grantedByTelegramId: actor.toString(),
      },
    });

    return {
      text: `Concedidas ${cantidad.toLocaleString("es-ES")} fichas a ${telegramUserId}. Saldo: ${saldo.toLocaleString("es-ES")}. Motivo: ${motivo}.`,
    };
  }

  /**
   * Mira los mensajes buscando la forma de una estafa y avisa al STAFF.
   *
   * Los siete detectores llevaban escritos y probados desde hace meses, y el
   * motor que los puntua tambien; lo que no existia era nadie que los llamara.
   * Eran 300 lineas de seguridad que no miraban ni un mensaje.
   *
   * AVISA, NUNCA ACTUA — y aqui importa mas que en ningun otro sitio: el motor
   * mapea el score a "ban"/"mute", pero esos nombres son una SUGERENCIA, no una
   * orden. Un detector de estafas que borra por su cuenta borra a gente que
   * comparte un enlace, y eso no se deshace con una disculpa.
   *
   * Solo se avisa a partir de `mute` (score >= 3, o sea dos senales fuertes o
   * tres flojas). Con `warn` (una sola senal) la sala de STAFF se convertiria
   * en un despertador y dejaria de mirarse.
   */
  private static readonly SCAM_ALERT_DEDUP_MS = 3_600_000;
  private readonly recentScamAlerts = new Map<string, number>();

  private async watchForScam(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const texto = update.messageText ?? update.messageCaption;
    const userId = update.user.userId;
    if (
      update.kind !== "message" ||
      !texto ||
      !userId ||
      !context.chatId ||
      update.command
    ) {
      return null;
    }
    // Un admin del grupo no es a quien vigila esto.
    if (await this.isGroupAdmin(update.chat.chatId ?? 0n, userId)) {
      return null;
    }

    const verdict = judgeScam({
      text: texto,
      hasUrl: update.content.hasUrl,
      ...(update.user.username !== undefined
        ? { username: update.user.username }
        : {}),
    });
    if (verdict.action !== "mute" && verdict.action !== "ban") {
      return null;
    }

    const clave = `${context.chatId}:${userId}`;
    const ahora = Date.now();
    const ultimo = this.recentScamAlerts.get(clave);
    if (
      ultimo !== undefined &&
      ahora - ultimo < BotUpdateService.SCAM_ALERT_DEDUP_MS
    ) {
      return null;
    }
    this.recentScamAlerts.set(clave, ahora);
    for (const [vieja, ms] of this.recentScamAlerts) {
      if (ahora - ms > BotUpdateService.SCAM_ALERT_DEDUP_MS) {
        this.recentScamAlerts.delete(vieja);
      }
    }

    try {
      const settings = await this.guardianRepository.getSettings(
        context.tenantId,
        context.chatId,
      );
      if (!settings?.staffChatId) {
        return null;
      }
      const quien = update.user.username
        ? `@${update.user.username}`
        : `${update.user.firstName ?? userId.toString()} (${userId})`;
      await this.telegramGateway.sendMessage({
        chatId: settings.staffChatId,
        token: this.telegramToken(),
        ...(settings.staffThreadId != null
          ? { messageThreadId: settings.staffThreadId }
          : {}),
        reply: {
          text: [
            "🎣 Mensaje con forma de estafa",
            "",
            `De ${quien}.`,
            ...verdict.detalles.map((d) => `- ${d}`),
            "",
            "No se ha hecho nada: es solo un aviso. Miradlo antes de que le escriba a alguien por privado.",
          ].join("\n"),
        },
      });
    } catch {
      // Best-effort: perder el aviso no puede estropear el mensaje de nadie.
    }
    return null;
  }

  private async isGroupAdmin(
    groupId: bigint,
    userId: bigint | undefined,
  ): Promise<boolean> {
    if (!userId) {
      return false;
    }

    if (
      this.env.SUPERBOT_OWNER_TELEGRAM_ID &&
      userId === this.env.SUPERBOT_OWNER_TELEGRAM_ID
    ) {
      return true;
    }

    try {
      const admins = await this.cachedAdminIds(groupId);
      return admins.some((adminId) => adminId === userId);
    } catch {
      return false;
    }
  }

  /**
   * True only when we can POSITIVELY confirm the bot is NOT an admin in this
   * chat: a valid numeric bot id (derived from the token) plus a successfully
   * fetched admin list that excludes it. Returns false when the bot IS admin OR
   * when its status can't be determined (opaque token, empty list, API error),
   * so callers must treat "false" as "don't silence — fall through to normal
   * flow".
   *
   * Used to keep a games-only bot (added without admin rights) quiet on
   * moderation commands like /ban, /kick, /warn and /mute instead of nagging the
   * group with a permissions error it can do nothing about.
   */
  private async botConfirmedNotAdmin(
    telegramChatId: bigint | undefined,
  ): Promise<boolean> {
    if (!telegramChatId) {
      return false;
    }
    const rawBotId = this.telegramToken()?.split(":")[0];
    if (!rawBotId || !/^\d+$/u.test(rawBotId)) {
      return false;
    }
    const botId = BigInt(rawBotId);
    try {
      const admins = await this.cachedAdminIds(telegramChatId);
      // A real group always has a creator, so an empty list is almost always an
      // API hiccup — treat it as "unknown", never as "not admin".
      if (admins.length === 0) {
        return false;
      }
      return !admins.some((adminId) => adminId === botId);
    } catch {
      return false;
    }
  }

  private async openSettingsRoot(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    groupId: bigint,
    edit: boolean,
    replyBotUsername: string,
  ): Promise<BotReply> {
    if (!(await this.isGroupAdmin(groupId, update.user.userId))) {
      return {
        text: "Solo los administradores de ese grupo pueden configurarlo.",
      };
    }

    const resolved = await this.repository.findChatByTelegramId(
      context.tenantId,
      groupId,
    );

    if (!resolved) {
      return {
        text: "Aún no conozco ese grupo. Usa /settings una vez dentro del grupo y vuelve a intentarlo.",
      };
    }

    const appUrl = readAppUrl(this.env.TELEGRAM_APP_URL);
    // La economia (moneda, robo y purga) va dentro del panel, no colgada al
    // final: es donde la busca quien quiere encenderla. Mismo camino `sp=` que
    // el botón de abajo, asi que tambien funciona desde un bot hijo.
    const economyButton = appUrl.startsWith("https://")
      ? {
          text: "💰 Economía y juegos",
          web_app: {
            url: `${appUrl}?tgbot=${encodeURIComponent(
              replyBotUsername,
            )}&sp=${encodeEconomyStartParam(groupId.toString())}`,
          },
        }
      : undefined;
    const root = renderSettingsRoot(groupId, resolved.title, economyButton);
    // In a private chat we can offer a web_app button. This is the Mini App
    // entry that works for BOTH the primary bot and managed child bots: the URL
    // carries `?tgbot=<bot>&sp=cfg_<gid>` so the web app tells the API which bot
    // signed initData (→ its token/tenant) and which group to configure. Child
    // bots have no named app, so this is their only Mini App path into config.
    const miniAppRows = appUrl.startsWith("https://")
      ? [
          [
            {
              text: "🚀 Abrir Mini App",
              web_app: {
                url: `${appUrl}?tgbot=${encodeURIComponent(
                  replyBotUsername,
                )}&sp=cfg_${groupId}`,
              },
            },
          ],
        ]
      : [];

    // BotReply.replyMarkup is a loose Record; the settings root's keyboard is an
    // array of button rows. Preserve it and append the Mini App row.
    const existingRows = (root.replyMarkup?.inline_keyboard ?? []) as unknown[];
    return {
      text: root.text,
      replyMarkup: {
        inline_keyboard: [...existingRows, ...miniAppRows],
      },
      parseMode: "Markdown",
      edit,
    };
  }

  private async applySettingsCallback(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    callback: { groupId: bigint; section: string; action: string },
  ): Promise<BotReply> {
    if (!(await this.isGroupAdmin(callback.groupId, update.user.userId))) {
      return {
        text: "Solo los administradores de ese grupo pueden configurarlo.",
      };
    }

    const resolved = await this.repository.findChatByTelegramId(
      context.tenantId,
      callback.groupId,
    );

    if (!resolved) {
      return {
        text: "Aún no conozco ese grupo. Usa /settings una vez dentro del grupo.",
      };
    }

    const tenantId = context.tenantId;
    const chatId = resolved.chatId;
    const groupId = callback.groupId;
    const { section, action } = callback;

    // Navigating to any other panel button abandons a pending "send me the text"
    // edit, so we don't accidentally capture the user's next message.
    if (action !== "settext" && update.user.userId) {
      await this.groupProtectionRepository.clearPendingEdit(
        tenantId,
        update.user.userId,
      );
    }

    const markdown = <T extends { text: string; replyMarkup: unknown }>(
      panel: T,
    ): BotReply => ({
      text: panel.text,
      replyMarkup: panel.replyMarkup as Record<string, unknown>,
      parseMode: "Markdown",
      edit: true,
    });

    await this.repository.recordAudit({
      tenantId,
      actorType: "user",
      action: `settings.${section}.${action}`,
      resourceType: "chat_settings",
      resourceId: groupId.toString(),
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { section, action },
    });

    if (section === "root") {
      if (action === "close") {
        return { ...renderSettingsClosed(), edit: true };
      }
      return markdown(renderSettingsRoot(groupId, resolved.title));
    }

    if (section === "welcome") {
      if (action === "settext" && update.user.userId) {
        return this.beginPanelTextEdit(
          context,
          update.user.userId,
          "welcome",
          groupId,
          "✍️ Envíame ahora el nuevo mensaje de *bienvenida* como un mensaje normal aquí.\nPuede llevar variables `{first_name}` `{chat_title}` y botones `[Texto](buttonurl://url)`.",
        );
      }
      if (action === "toggle") {
        const current = await this.welcomeRepository.getConfig(chatId);
        await this.welcomeRepository.upsertConfig(tenantId, chatId, {
          welcomeText:
            current?.welcomeText != null ? null : defaultWelcomeTemplate,
        });
      }
      const fresh = await this.welcomeRepository.getConfig(chatId);
      return markdown(
        renderWelcomePanel(groupId, {
          welcomeText: fresh?.welcomeText ?? null,
          rulesText: fresh?.rulesText ?? null,
        }),
      );
    }

    if (section === "rules") {
      if (action === "settext" && update.user.userId) {
        return this.beginPanelTextEdit(
          context,
          update.user.userId,
          "rules",
          groupId,
          "✍️ Envíame ahora las *reglas* del grupo como un mensaje normal aquí.",
        );
      }
      if (action === "clear") {
        await this.welcomeRepository.upsertConfig(tenantId, chatId, {
          rulesText: null,
        });
      }
      const fresh = await this.welcomeRepository.getConfig(chatId);
      return markdown(
        renderRulesPanel(groupId, {
          welcomeText: fresh?.welcomeText ?? null,
          rulesText: fresh?.rulesText ?? null,
        }),
      );
    }

    if (section === "flood") {
      const current =
        (await this.antifloodRepository.getConfig(tenantId, chatId)) ??
        defaultAntifloodSettings;

      if (action === "toggle") {
        await this.antifloodRepository.upsertConfig(tenantId, chatId, {
          enabled: !current.enabled,
        });
      } else if (action === "limitup") {
        await this.antifloodRepository.upsertConfig(tenantId, chatId, {
          messageLimit: clampFloodLimit(current.messageLimit + 1),
        });
      } else if (action === "limitdown") {
        await this.antifloodRepository.upsertConfig(tenantId, chatId, {
          messageLimit: clampFloodLimit(current.messageLimit - 1),
        });
      } else if (action === "action") {
        await this.antifloodRepository.upsertConfig(tenantId, chatId, {
          action: nextFloodAction(current.action) as AntifloodAction,
        });
      }

      const fresh =
        (await this.antifloodRepository.getConfig(tenantId, chatId)) ??
        defaultAntifloodSettings;
      return markdown(renderFloodPanel(groupId, fresh));
    }

    if (section === "captcha") {
      const current =
        (await this.captchaRepository.getConfig(tenantId, chatId)) ??
        defaultCaptchaSettings;

      if (action === "toggle") {
        await this.captchaRepository.upsertConfig(tenantId, chatId, {
          enabled: !current.enabled,
        });
      } else if (action === "mode") {
        await this.captchaRepository.upsertConfig(tenantId, chatId, {
          mode: nextCaptchaMode(current.mode) as CaptchaModeValue,
        });
      } else if (action === "failaction") {
        await this.captchaRepository.upsertConfig(tenantId, chatId, {
          failAction: nextCaptchaFailAction(
            current.failAction,
          ) as CaptchaFailAction,
        });
      }

      const fresh =
        (await this.captchaRepository.getConfig(tenantId, chatId)) ??
        defaultCaptchaSettings;
      return markdown(renderCaptchaPanel(groupId, fresh));
    }

    if (section === "raid") {
      const current =
        (await this.antiraidRepository.getConfig(tenantId, chatId)) ??
        defaultAntiraidSettings;

      if (action === "toggle") {
        await this.antiraidRepository.upsertConfig(tenantId, chatId, {
          enabled: !current.enabled,
        });
      } else if (action === "mode") {
        await this.antiraidRepository.upsertConfig(tenantId, chatId, {
          mode: nextRaidMode(current.mode) as AntiraidMode,
        });
      }

      const fresh =
        (await this.antiraidRepository.getConfig(tenantId, chatId)) ??
        defaultAntiraidSettings;
      return markdown(renderRaidPanel(groupId, fresh));
    }

    if (section === "locks" || section === "lock") {
      const locked = await this.contentLockRepository.getLocked(
        tenantId,
        chatId,
      );

      if (section === "lock" && isLockTypeValue(action)) {
        const set = new Set(locked);
        if (set.has(action)) {
          set.delete(action);
        } else {
          set.add(action);
        }
        await this.contentLockRepository.setLocked(tenantId, chatId, [...set]);
      }

      const fresh = await this.contentLockRepository.getLocked(
        tenantId,
        chatId,
      );
      return markdown(renderLocksPanel(groupId, fresh));
    }

    return markdown(renderSettingsRoot(groupId, resolved.title));
  }

  /**
   * Extra moderation verbs: /tban /tmute (temporary, auto-expired), /sban /smute
   * (silent — deletes the command message), /dban (ban + delete the replied
   * message). Reuses the same enforcement + sanction persistence.
   */
  private async handleModerationPlusCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseModerationPlusCommand(
      await this.withReplyTarget(update, context),
    );

    if (!result) {
      return null;
    }

    // Games-only bot (no admin rights) → stay silent instead of a permissions nag.
    if (await this.botConfirmedNotAdmin(update.chat.chatId)) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!(await this.isActorAdmin(context, update))) {
      return { text: "No tienes permisos para moderar." };
    }

    const command = result.command;
    const chatId = update.chat.chatId;
    const target = command.targetTelegramUserId;
    const action = command.action;
    const durationMs =
      command.kind === "temp"
        ? command.durationMs
        : command.kind === "silent"
          ? command.durationMs
          : undefined;
    const endsAt = durationMs ? new Date(Date.now() + durationMs) : undefined;

    // A kick removes the member without a lasting sanction row (mirrors /kick).
    if (action !== "kick") {
      await this.moderationRepository.createSanction({
        // Determinista: un reintento del mismo update no crea otra sanción.
        claveIdempotencia: this.claveDeterminista(update, "moderacion-plus"),
        tenantId: context.tenantId,
        chatId: context.chatId,
        actorUserId: context.userId,
        subjectTelegramUserId: target,
        reason: command.reason,
        kind: action,
        ...(endsAt ? { endsAt } : {}),
        ...(chatId ? { telegramChatId: chatId } : {}),
      });
    }

    const enforcement = await this.applyTelegramEnforcement(
      action,
      update,
      target,
      endsAt,
    );

    // Silent deletes the command; delete-verbs remove the replied message.
    if (chatId) {
      if (command.kind === "silent" && update.messageId) {
        try {
          await this.telegramGateway.deleteMessage({
            chatId,
            messageId: update.messageId,
            token: this.telegramToken(),
          });
        } catch {
          // Non-fatal.
        }
      }
      if (command.kind === "delete") {
        const replied = extractReplyContext(update.raw).messageId;
        if (replied) {
          try {
            await this.telegramGateway.deleteMessage({
              chatId,
              messageId: replied,
              token: this.telegramToken(),
            });
          } catch {
            // Non-fatal.
          }
        }
      }
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: `moderation.${command.kind}.${action}`,
      resourceType: "moderation_case",
      resourceId: target.toString(),
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { durationMs: durationMs ?? null },
    });
    await this.emitOwnerNetworkRoute({
      context,
      sourceChatId: context.chatId,
      eventKind: "moderation_actions",
      fallbackEventKind: "logs",
      title: `Moderación: ${action}`,
      body: [
        `Grupo: ${chatId?.toString() ?? context.chatId}`,
        `Usuario: ${target.toString()}`,
        `Motivo: ${command.reason ?? "sin motivo"}`,
      ].join("\n"),
    });
    await this.recordRiskSignal(context, target, "sanction");

    // Silent commands produce no visible reply, success or failure.
    if (command.kind === "silent") {
      return null;
    }

    const failure = this.enforcementFailure(enforcement);
    if (failure) {
      return {
        text: `⚠️ Registrado, pero Telegram rechazó la sanción: ${failure} — el usuario no está en el grupo o me faltan permisos.`,
      };
    }

    const human = durationMs
      ? ` por ${Math.round(durationMs / 60000)} min`
      : "";
    const verb =
      action === "ban"
        ? "🔨 Baneado"
        : action === "kick"
          ? "👢 Expulsado"
          : "🔇 Silenciado";
    return { text: `${verb} ${target.toString()}${human}.` };
  }

  /**
   * `/jugar` (aliases /games /juegos): the arcade hub. In a group, url buttons
   * jump to each game via the named Mini App with the group's startapp payload so
   * scores attach to the group; in private, a web_app button opens the hub
   * (personal scoreboard). Only when a public https Mini App URL is configured.
   */
  private async handleCasinoCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const parsed = parseCasinoCommand(update);
    if (!parsed) {
      return null;
    }
    const telegramUserId = update.user.userId;
    if (!telegramUserId) {
      return null;
    }
    if (!parsed.ok) {
      return { text: parsed.error.usage };
    }
    const command: CasinoCommand = parsed.command;
    const { tenantId } = context;

    if (command.kind === "help") {
      const appUrl = readAppUrl(this.env.TELEGRAM_APP_URL);
      const isGroup =
        update.chat.chatType === "group" ||
        update.chat.chatType === "supergroup";
      // Button-forward: /casino should open the casino, not dump a wall of text.
      // Lead with a single "open" button and condense the chat commands to one
      // line so the Mini App table (Crash/Minas/Ruleta…) is one tap away.
      const openBtn = appUrl.startsWith("https://")
        ? isGroup
          ? {
              text: "🎰 Abrir casino",
              // Bare "casino" opens the casino lobby (game picker), not a single
              // game. `casino_<game>` would jump straight into that game.
              url: `https://t.me/${this.env.TELEGRAM_BOT_USERNAME}/${this.env.TELEGRAM_MINIAPP_NAME}?startapp=casino`,
            }
          : {
              text: "🎰 Abrir casino",
              web_app: { url: `${appUrl}/casino` },
            }
        : null;
      return {
        parseMode: "Markdown",
        text: "🎰 *Casino Modryva*",
        ...(openBtn ? { replyMarkup: { inline_keyboard: [[openBtn]] } } : {}),
      };
    }

    const wallet = await this.chipRepository.ensureWallet(
      tenantId,
      telegramUserId,
      CASINO.welcomeGrant,
    );

    if (command.kind === "wallet") {
      // Solo el saldo, y legible. Antes esto enseñaba tambien el commit y el
      // nonce: dos datos criptograficos que no le dicen nada a quien solo mira
      // cuanto tiene, y que ya tienen su sitio en /verificar, que existe
      // exactamente para eso. La cifra va con separador de miles porque
      // "99250590" no se lee — se cuenta con el dedo.
      const nivel = walletLevel(
        await this.chipRepository.totalWagered(tenantId, telegramUserId),
      );
      return {
        parseMode: "Markdown",
        text: [
          "🪙 *Tus fichas*",
          `*${groupThousands(wallet.balance)}*`,
          "",
          `${nivel.tier} · nivel ${nivel.level}`,
        ].join("\n"),
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text: "🎰 Jugar",
                url: `https://t.me/${this.env.TELEGRAM_BOT_USERNAME}/${this.env.TELEGRAM_MINIAPP_NAME}?startapp=casino`,
              },
            ],
          ],
        },
      };
    }

    if (command.kind === "verify") {
      return {
        parseMode: "Markdown",
        text: [
          "🔒 *Juego justo (provably-fair)*",
          `commit (sha256 del server seed): \`${wallet.serverSeedHash}\``,
          `client seed: \`${wallet.clientSeed}\``,
          `nonce actual: ${wallet.nonce}`,
          "",
          "Cada resultado = HMAC-SHA256(serverSeed, `clientSeed:nonce`). Al rotar la semilla se revela el serverSeed y puedes recomputar todo.",
        ].join("\n"),
      };
    }

    if (command.kind === "daily") {
      const day = new Date().toISOString().slice(0, 10);
      const claim = await this.chipRepository.claimDaily(
        tenantId,
        telegramUserId,
        day,
        CASINO.dailyBonus,
      );
      return {
        parseMode: "Markdown",
        text: claim.ok
          ? `🎁 *Bono diario:* +${CASINO.dailyBonus} fichas.\nSaldo: *${claim.balance}* 🪙`
          : `⏳ Ya reclamaste tu bono hoy. Saldo: *${claim.balance}* 🪙`,
      };
    }

    if (command.kind === "level") {
      const wagered = await this.chipRepository.totalWagered(
        tenantId,
        telegramUserId,
      );
      const { level, tier, next } = walletLevel(wagered);
      return {
        parseMode: "Markdown",
        text: `${tier} · *Nivel ${level}*\nApostado total: ${wagered} 🪙\nFaltan *${next}* 🪙 para el nivel ${level + 1}.`,
      };
    }

    if (command.kind === "cashback") {
      const week = 7 * 24 * 60 * 60 * 1000;
      const bucket = Math.floor(Date.now() / week);
      const since = new Date(bucket * week);
      const net = await this.chipRepository.netSince(
        tenantId,
        telegramUserId,
        since,
      );
      if (net >= 0) {
        return {
          text: "😎 No tienes pérdidas netas esta semana — ¡así se juega!",
        };
      }
      const amount = Math.floor(Math.abs(net) * 0.1);
      if (amount <= 0) {
        return { text: "Aún no acumulas cashback suficiente esta semana." };
      }
      const res = await this.chipRepository.claimCashback(
        tenantId,
        telegramUserId,
        `cb-${bucket}`,
        amount,
      );
      return {
        parseMode: "Markdown",
        text: res.ok
          ? `💸 *Cashback semanal:* +${amount} 🪙 (10% de tus pérdidas). Saldo: *${res.balance}* 🪙`
          : `⏳ Ya reclamaste tu cashback esta semana. Saldo: *${res.balance}* 🪙`,
      };
    }

    if (command.kind === "rescue") {
      const sixHours = 6 * 60 * 60 * 1000;
      const bucket = Math.floor(Date.now() / sixHours);
      const rescue = await this.chipRepository.claimRescue(
        tenantId,
        telegramUserId,
        `rescue-${bucket}`,
        200,
        CASINO.minBet - 1,
      );
      if (rescue.reason === "not-broke") {
        return {
          parseMode: "Markdown",
          text: `Aún tienes fichas (*${rescue.balance}* 🪙). El rescate es solo si te quedas a cero.`,
        };
      }
      if (rescue.reason === "cooldown") {
        return { text: "🛟 Ya usaste tu rescate hace poco. Espera un rato." };
      }
      return {
        parseMode: "Markdown",
        text: `🛟 *Rescate:* +200 🪙 para seguir jugando. Saldo: *${rescue.balance}* 🪙`,
      };
    }

    if (command.kind === "gift") {
      const raw = update.raw as {
        message?: { reply_to_message?: { from?: { id?: number } } };
      };
      const targetId = raw.message?.reply_to_message?.from?.id;
      if (!targetId) {
        return {
          text: "Responde al mensaje de la persona a la que quieres regalar fichas.",
        };
      }
      const res = await this.chipRepository.transfer(
        tenantId,
        telegramUserId,
        BigInt(targetId),
        command.amount,
        // Clave determinista: un reintento no puede regalar dos veces.
        this.claveDeterminista(update, "chip-transfer"),
      );
      if (res.error === "self") {
        return { text: "No puedes regalarte fichas a ti mismo." };
      }
      if (!res.ok) {
        return {
          parseMode: "Markdown",
          text: `❌ Fichas insuficientes. Saldo: *${res.fromBalance}* 🪙`,
        };
      }
      return {
        parseMode: "Markdown",
        text: `🎁 Regalaste *${command.amount}* 🪙. Tu saldo: *${res.fromBalance}* 🪙`,
      };
    }

    if (command.kind === "buy") {
      const pack = CHIP_PACKS[command.pack];
      if (!pack) {
        const list = Object.entries(CHIP_PACKS)
          .map(([id, p]) => `• \`/comprar ${id}\` — ${p.label} = ${p.stars} ⭐`)
          .join("\n");
        return {
          parseMode: "Markdown",
          text: `🛒 *Tienda de fichas* (pago con Telegram Stars):\n${list}`,
        };
      }
      const buyChatId = update.chat.chatId;
      if (!buyChatId) {
        return { text: "Abre un chat privado conmigo para comprar." };
      }
      try {
        await this.telegramGateway.sendInvoice({
          chatId: buyChatId,
          title: `${pack.label} 🪙`,
          description:
            "Fichas virtuales para el casino (solo diversión, sin dinero real).",
          payload: `chips:${command.pack}:${telegramUserId}`,
          currency: "XTR",
          amount: pack.stars,
          token: this.env.TELEGRAM_BOT_TOKEN,
        });
      } catch {
        return { text: "No pude crear la factura. Inténtalo de nuevo." };
      }
      return null;
    }

    if (command.kind === "slot") {
      return this.settleNativeBet(
        context,
        update,
        command.stake,
        "🎰",
        1,
        (v) => {
          const { multiplier, detail } = resolveSlot(v[0] ?? 1);
          return { multiplier, render: describeSlot(detail) };
        },
      );
    }
    if (command.kind === "overunder") {
      const { stake: st, pick } = command;
      return this.settleNativeBet(context, update, st, "🎲", 2, (v) => {
        const { multiplier, detail } = resolveOverUnder(
          v[0] ?? 1,
          v[1] ?? 1,
          pick,
        );
        return { multiplier, render: describeOverUnder(detail) };
      });
    }
    if (command.kind === "bullseye") {
      const { stake: st, tier } = command;
      return this.settleNativeBet(context, update, st, "🎯", 1, (v) => {
        const { multiplier, detail } = resolveBullseye(v[0] ?? 1, tier);
        return { multiplier, render: describeBullseye(detail) };
      });
    }
    if (command.kind === "duel") {
      const duelChatId = update.chat.chatId;
      if (!duelChatId) {
        return { text: "Los duelos son para grupos." };
      }
      if (command.stake < CASINO.minBet || command.stake > CASINO.maxBet) {
        return {
          text: `La apuesta debe estar entre ${CASINO.minBet} y ${CASINO.maxBet} fichas.`,
        };
      }
      const challengerName = casinoDisplayName(update);
      const opened = await this.chipRepository.openDuel({
        tenantId,
        chatId: duelChatId.toString(),
        challengerId: telegramUserId,
        challengerName,
        stake: command.stake,
      });
      if (!opened.ok || !opened.duelId) {
        return {
          parseMode: "Markdown",
          text: `❌ Fichas insuficientes para el duelo. Saldo: *${opened.balance}* 🪙`,
        };
      }
      return {
        parseMode: "Markdown",
        text: `⚔️ *${challengerName}* reta a un duelo de dados por *${command.stake}* 🪙\n¿Quién acepta? (el dado más alto gana el bote)`,
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text: `⚔️ Aceptar (${command.stake} 🪙)`,
                callback_data: `duel:accept:${opened.duelId}`,
              },
              {
                text: "❌ Cancelar",
                callback_data: `duel:cancel:${opened.duelId}`,
              },
            ],
          ],
        },
      };
    }

    const { stake, side, target } = command;
    if (stake < CASINO.minBet || stake > CASINO.maxBet) {
      return {
        text: `La apuesta debe estar entre ${CASINO.minBet} y ${CASINO.maxBet} fichas.`,
      };
    }
    const outcome = await this.chipRepository.placeBet({
      tenantId,
      telegramUserId,
      stake,
      betId: this.claveDeterminista(update, "bet"),
      resolve: (serverSeed, clientSeed, nonce) =>
        resolveDice(serverSeed, clientSeed, nonce, side, target),
    });
    if (!outcome.ok) {
      return {
        parseMode: "Markdown",
        text: `❌ Fichas insuficientes. Saldo: *${outcome.balance}* 🪙\nReclama tu \`/bono\` diario.`,
      };
    }
    const detail = outcome.detail as { roll: number; win: boolean };
    const header =
      outcome.payout > 0
        ? `🎉 *¡Ganaste!* +${outcome.payout} 🪙 (x${outcome.multiplier})`
        : `💀 Perdiste ${stake} 🪙`;
    return {
      parseMode: "Markdown",
      text: [
        `🎲 Tirada: *${detail.roll.toFixed(2)}* — apostaste ${side} de ${target}`,
        header,
        `Saldo: *${outcome.balance}* 🪙`,
        `_nonce ${outcome.nonce} · commit ${outcome.serverSeedHash.slice(0, 12)}…_`,
      ].join("\n"),
    };
  }

  /**
   * Native-dice bet flow (SlotStorm/Over-Under/Bullseye): atomic debit → send the
   * real Telegram animated dice and read its value → price via the pure resolver →
   * credit the payout. On any dice failure the stake is refunded. The outcome is
   * generated by Telegram itself, so it is provably fair by construction.
   */
  private async settleNativeBet(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    stake: number,
    emoji: string,
    rolls: number,
    play: (values: number[]) => { multiplier: number; render: string },
  ): Promise<BotReply> {
    const telegramUserId = update.user.userId;
    const chatId = update.chat.chatId;
    if (!telegramUserId || !chatId) {
      return { text: "Este juego necesita un chat." };
    }
    const { tenantId } = context;
    if (stake < CASINO.minBet || stake > CASINO.maxBet) {
      return {
        text: `La apuesta debe estar entre ${CASINO.minBet} y ${CASINO.maxBet} fichas.`,
      };
    }
    // El betId es a la vez identificador de la apuesta y clave de
    // idempotencia del cobro, la devolucion y el premio. Aleatorio, un
    // reintento volvia a apostar; determinista, la apuesta es una.
    const betId = this.claveDeterminista(update, "bet");
    const debit = await this.chipRepository.debit(
      tenantId,
      telegramUserId,
      stake,
      betId,
    );
    if (!debit.ok) {
      return {
        parseMode: "Markdown",
        text: `❌ Fichas insuficientes. Saldo: *${debit.balance}* 🪙\nReclama tu \`/bono\`.`,
      };
    }
    const values: number[] = [];
    try {
      for (let index = 0; index < rolls; index += 1) {
        const res = await this.telegramGateway.sendDice({
          chatId,
          emoji,
          token: this.telegramToken(),
        });
        if (!res.ok || typeof res.value !== "number") {
          throw new Error("dice value missing");
        }
        values.push(res.value);
      }
    } catch {
      const refunded = await this.chipRepository.credit(
        tenantId,
        telegramUserId,
        stake,
        "refund",
        betId,
      );
      return {
        parseMode: "Markdown",
        text: `⚠️ No se pudo lanzar la animación. Apuesta reembolsada. Saldo: *${refunded}* 🪙`,
      };
    }
    const { multiplier, render } = play(values);
    const payout = Math.floor(stake * Math.max(0, multiplier));
    let balance = debit.balance;
    if (payout > 0) {
      balance = await this.chipRepository.credit(
        tenantId,
        telegramUserId,
        payout,
        "win",
        betId,
      );
    }
    const header =
      payout > 0
        ? `🎉 *¡Ganaste!* +${payout} 🪙 (x${multiplier})`
        : `💀 Perdiste ${stake} 🪙`;
    // Let Telegram finish the dice animation before the result lands (no spoiler).
    await new Promise((done) => setTimeout(done, 2200));
    return {
      parseMode: "Markdown",
      text: [render, header, `Saldo: *${balance}* 🪙`].join("\n"),
    };
  }

  /** PvP dice duel: accept (claim + roll both + settle) or cancel (refund). */
  private async handleDuelCallback(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const data = update.callbackData;
    if (!data?.startsWith("duel:")) {
      return null;
    }
    const [, action, duelId] = data.split(":");
    const telegramUserId = update.user.userId;
    const chatId = update.chat.chatId;
    if (!duelId || !telegramUserId || !chatId) {
      return { text: "Duelo inválido." };
    }
    const { tenantId } = context;

    if (action === "cancel") {
      const res = await this.chipRepository.cancelDuel(
        tenantId,
        duelId,
        telegramUserId,
      );
      return res.ok
        ? {
            parseMode: "Markdown",
            text: `❌ Duelo cancelado. Fichas devueltas. Saldo: *${res.balance}* 🪙`,
          }
        : {
            text: "Solo quien creó el duelo puede cancelarlo (y solo si nadie ha aceptado).",
          };
    }
    if (action !== "accept") {
      return null;
    }

    await this.chipRepository.ensureWallet(
      tenantId,
      telegramUserId,
      CASINO.welcomeGrant,
    );
    const claim = await this.chipRepository.claimDuel(
      tenantId,
      duelId,
      telegramUserId,
    );
    if (claim.status === "self") {
      return { text: "No puedes aceptar tu propio duelo." };
    }
    if (claim.status === "gone") {
      return { text: "Ese duelo ya no está disponible." };
    }
    if (claim.status === "insufficient") {
      return {
        parseMode: "Markdown",
        text: "❌ No tienes fichas suficientes para aceptar.",
      };
    }

    if (claim.status !== "ok") {
      return { text: "Ese duelo no se pudo aceptar." };
    }

    const rolls: number[] = [];
    try {
      for (let index = 0; index < 2; index += 1) {
        const res = await this.telegramGateway.sendDice({
          chatId,
          emoji: "🎲",
          token: this.telegramToken(),
        });
        if (!res.ok || typeof res.value !== "number") {
          throw new Error("dice value missing");
        }
        rolls.push(res.value);
      }
    } catch {
      await this.chipRepository.settleDuel(
        tenantId,
        duelId,
        0,
        CASINO.duelRake,
      );
      return { text: "⚠️ No se pudieron lanzar los dados. Apuestas devueltas." };
    }
    const rollA = rolls[0] ?? 1;
    const rollB = rolls[1] ?? 1;
    const { winner: porLosDados } = resolveDuel(rollA, rollB);
    // El gato negro se queda con los empates. Solo puede cambiar un EMPATE:
    // si los dados ya dijeron quien gana, ninguna mascota lo toca — las
    // tiradas las hace Telegram y no se puede falsear un dado que la gente ha
    // visto rodar. Ver `pets/en-la-arena.ts`.
    //
    // Por el mejor bicho de cada uno, no por el del grupo: el duelo es del
    // casino, que va por tenant y no tiene chat.
    const [bichoReta, bichoAcepta] = await Promise.all([
      this.petRepository
        .mejorDelUsuario(tenantId, claim.challengerId)
        .catch(() => null),
      this.petRepository
        .mejorDelUsuario(tenantId, telegramUserId)
        .catch(() => null),
    ]);
    const winner = ganadorConMascotas({
      winner: porLosDados,
      deQuienReta: bichoReta?.especie ?? null,
      deQuienAcepta: bichoAcepta?.especie ?? null,
    });
    const settled = await this.chipRepository.settleDuel(
      tenantId,
      duelId,
      winner,
      CASINO.duelRake,
    );
    if (!settled) {
      return { text: "Ese duelo ya se resolvió." };
    }
    const challengerName = claim.challengerName ?? "Retador";
    const opponentName = casinoDisplayName(update);
    // Let both dice animations finish before revealing the winner.
    await new Promise((done) => setTimeout(done, 2200));
    const line = describeDuel(
      challengerName,
      rollA,
      opponentName,
      rollB,
      winner,
    );
    const outcome = settled.tie
      ? "🤝 Empate — apuestas devueltas."
      : `🏆 Gana *${winner === 1 ? challengerName : opponentName}* +${settled.payout} 🪙`;
    return { parseMode: "Markdown", text: [line, outcome].join("\n") };
  }

  private async handleModerationCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseModerationCommand(
      await this.withReplyTarget(update, context),
    );

    if (!result) {
      return null;
    }

    // Games-only bot (no admin rights) → moderation isn't its job. Stay silent
    // on /ban, /kick, /warn, /mute instead of nagging about missing permissions.
    if (await this.botConfirmedNotAdmin(update.chat.chatId)) {
      return null;
    }

    if (!result.ok) {
      return {
        text: result.error.usage,
      };
    }

    const isAdmin = await this.isActorAdmin(context, update);
    const role = isAdmin ? "admin" : this.resolveActorRole(context, update);
    const decision = evaluatePolicy(
      {
        role,
        permissions: [],
        isTelegramAdmin: isAdmin,
        moduleEnabled: true,
      },
      "moderation.write",
      { moduleName: "security" },
    );

    if (!decision.allowed) {
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: update.user.userId ? "user" : "system",
        action: "moderation.command.denied",
        resourceType: "moderation_command",
        resourceId: result.plan.action,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: {
          reason: decision.reason,
          command: result.plan.action,
          targetTelegramUserId: result.plan.targetTelegramUserId.toString(),
        },
      });

      return {
        text: `No tienes permisos para ejecutar esta acción.`,
      };
    }

    if (
      result.plan.action === "unban" ||
      result.plan.action === "unmute" ||
      result.plan.action === "kick"
    ) {
      return this.handleRevertAction(
        context,
        update,
        result.plan.action,
        result.plan.targetTelegramUserId,
        result.plan.reason,
      );
    }

    if (result.plan.action === "warn") {
      return this.applyWarn(
        context,
        update,
        result.plan.targetTelegramUserId,
        result.plan.reason,
      );
    }

    // Antes de escribir el caso: sancionar a un administrador nombrado por el
    // bot lo DEGRADA. Ya no se rechaza por eso —se le guarda el cargo y se le
    // devuelve al levantar el castigo— pero el examen sigue delante porque es
    // quien decide si hay cargo que guardar, y leerlo despues de restringir
    // seria leer el cargo vacio.
    const bloqueo = await this.bloqueoPorObjetivoProtegido(
      context,
      update,
      result.plan.action,
      result.plan.targetTelegramUserId,
    );
    if (bloqueo.negativa) {
      return bloqueo.negativa;
    }

    const endsAt = result.plan.durationMs
      ? new Date(Date.now() + result.plan.durationMs)
      : undefined;
    const moderationResult = await this.moderationRepository.createSanction({
      // Determinista: un reintento del mismo update no crea otra sanción.
      claveIdempotencia: this.claveDeterminista(update, "moderacion"),
      tenantId: context.tenantId,
      chatId: context.chatId,
      actorUserId: context.userId,
      subjectTelegramUserId: result.plan.targetTelegramUserId,
      reason: result.plan.reason,
      kind: result.plan.action === "ban" ? "ban" : "mute",
      ...(endsAt ? { endsAt } : {}),
      ...(update.chat.chatId ? { telegramChatId: update.chat.chatId } : {}),
      // El cargo se guarda CON el castigo y antes de aplicarlo: es lo que hace
      // que levantarla sepa que devolver.
      ...(bloqueo.cargoGuardado
        ? { cargoGuardado: bloqueo.cargoGuardado }
        : {}),
    });
    const enforcement = await this.applyTelegramEnforcement(
      result.plan.action,
      update,
      result.plan.targetTelegramUserId,
      endsAt,
    );

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: `moderation.${result.plan.action}.created`,
      resourceType: "moderation_case",
      resourceId: moderationResult.caseId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        caseNumber: moderationResult.caseNumber,
        recordId: moderationResult.recordId,
        targetTelegramUserId: result.plan.targetTelegramUserId.toString(),
        reason: result.plan.reason,
        enforcement,
      },
    });
    await this.emitOwnerNetworkRoute({
      context,
      sourceChatId: context.chatId,
      eventKind: "moderation_actions",
      fallbackEventKind: "logs",
      title: `Moderación: ${result.plan.action}`,
      body: [
        `Grupo: ${update.chat.chatId?.toString() ?? context.chatId}`,
        `Usuario: ${await this.describeTarget(update, context, result.plan.targetTelegramUserId)}`,
        `Caso: #${moderationResult.caseNumber}`,
        `Motivo: ${result.plan.reason ?? "sin motivo"}`,
      ].join("\n"),
    });
    await this.recordRiskSignal(
      context,
      result.plan.targetTelegramUserId,
      "sanction",
    );

    const failure = this.enforcementFailure(enforcement);
    // El parte va DESPUES de conocer el veredicto de Telegram, no antes: un
    // registro que anuncia "BAN" de un baneo rechazado da el caso por resuelto
    // y solo se descubre cuando la persona vuelve a escribir.
    await this.publicarParteDeSanciones(context, update, {
      action: result.plan.action === "ban" ? "ban" : "mute",
      targetTelegramUserId: result.plan.targetTelegramUserId,
      reason: result.plan.reason,
      caseNumber: moderationResult.caseNumber,
      ...(result.plan.durationMs ? { durationMs: result.plan.durationMs } : {}),
      ...(failure ? { enforcementFailure: failure } : {}),
    });
    if (failure) {
      return {
        text: `⚠️ Caso #${moderationResult.caseNumber} registrado, pero Telegram lo rechazó: ${failure}. ¿No está en el grupo, o me faltan permisos?`,
      };
    }

    return {
      text: `🔨 ${result.plan.action} · ${await this.describeTarget(
        update,
        context,
        result.plan.targetTelegramUserId,
      )} · caso #${moderationResult.caseNumber}`,
    };
  }

  /**
   * Emergency group evacuation. This is intentionally narrow: it can only be
   * started by the fixed platform owner, from the affected group, after an
   * explicit confirmation tied to that group's Telegram id. Telegram cannot
   * enumerate a group's entire membership, so it acts only on members the bot
   * has observed. Administrators are protected because Telegram will reject
   * their removal while they remain administrators.
   */
  private async handleNukeCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.command?.name !== "nuke") {
      return null;
    }

    const telegramChatId = update.chat.chatId;
    if (
      !telegramChatId ||
      (update.chat.chatType !== "group" &&
        update.chat.chatType !== "supergroup")
    ) {
      return { text: "🚨 /nuke solo se puede ejecutar dentro de un grupo." };
    }

    if (update.user.userId !== NUKE_OWNER_TELEGRAM_ID) {
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "moderation.nuke.denied",
        resourceType: "chat",
        ...(context.chatId ? { resourceId: context.chatId } : {}),
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: {
          reason: "not-emergency-owner",
          telegramChatId: telegramChatId.toString(),
        },
      });
      return { text: "⛔ Este comando de emergencia está reservado." };
    }

    const confirmation = update.command.args?.[0];
    if (
      confirmation !== "CONFIRM" ||
      update.command.args?.[1] !== telegramChatId.toString()
    ) {
      return {
        text: `⚠️ Emergencia: esto expulsará a todos los miembros conocidos no administradores. Para confirmar: /nuke CONFIRM ${telegramChatId.toString()}`,
      };
    }

    if (!context.chatId) {
      return { text: "🚨 No se pudo resolver el grupo para la evacuación." };
    }

    const adminIds = new Set(
      await this.cachedAdminIds(telegramChatId).catch(() => []),
    );
    const protectedIds = new Set([NUKE_OWNER_TELEGRAM_ID, ...adminIds]);
    const knownMemberIds =
      await this.repository.listActiveMembershipTelegramUserIds(context.chatId);
    const targets = [...new Set(knownMemberIds)].filter(
      (userId) => !protectedIds.has(userId),
    );
    let expelled = 0;
    let failed = 0;
    for (const userId of targets) {
      try {
        const ban = await this.telegramGateway.banChatMember({
          chatId: telegramChatId,
          userId,
          token: this.telegramToken(),
          untilDate: undefined,
        });
        if (!ban.ok) {
          failed += 1;
          continue;
        }
        const unban = await this.telegramGateway.unbanChatMember({
          chatId: telegramChatId,
          userId,
          token: this.telegramToken(),
          onlyIfBanned: false,
        });
        if (unban.ok) {
          expelled += 1;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "moderation.nuke.executed",
      resourceType: "chat",
      resourceId: context.chatId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        telegramChatId: telegramChatId.toString(),
        knownMembers: knownMemberIds.length,
        protectedAdministrators: adminIds.size,
        targets: targets.length,
        expelled,
        failed,
      },
    });
    return {
      text: `🚨 Evacuación terminada. Expulsados: ${expelled}/${targets.length}. Administradores protegidos: ${adminIds.size}. Fallos: ${failed}.`,
    };
  }

  private async handleRevertAction(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    action: "unban" | "unmute" | "kick",
    targetTelegramUserId: bigint,
    reason: string | undefined,
  ): Promise<BotReply> {
    const chatId = update.chat.chatId;
    // Solo el kick: /unban y /unmute son marchas atras y no degradan a nadie —
    // bloquearlas dejaria sin forma de deshacer un error sobre un admin.
    if (action === "kick") {
      const bloqueo = await this.bloqueoPorObjetivoProtegido(
        context,
        update,
        action,
        targetTelegramUserId,
      );
      if (bloqueo.negativa) {
        return bloqueo.negativa;
      }
    }
    // El cargo se lee ANTES de revertir: `leerCargoGuardado` solo mira las
    // sanciones vivas y `revertSanctions` es justo lo que deja de dejarlas
    // vivas. Al reves devolveria null siempre y el cargo se perderia en
    // silencio, que es el fallo que todo esto viene a evitar.
    const cargo =
      action === "kick"
        ? null
        : await this.moderationRepository.leerCargoGuardado({
            tenantId: context.tenantId,
            subjectTelegramUserId: targetTelegramUserId,
            kind: action === "unban" ? "ban" : "mute",
            // Con el grupo: el cargo de otro chat no vale aqui, y devolverlo
            // seria repartir poder que nadie dio en ESTE grupo.
            ...(chatId ? { telegramChatId: chatId } : {}),
          });
    let reverted = 0;
    let enforcement: unknown = { ok: false, skipped: true };

    if (chatId) {
      try {
        if (action === "unban") {
          enforcement = await this.telegramGateway.unbanChatMember({
            chatId,
            userId: targetTelegramUserId,
            token: this.telegramToken(),
          });
        } else if (action === "unmute") {
          enforcement = await this.telegramGateway.liftRestrictions({
            chatId,
            userId: targetTelegramUserId,
            token: this.telegramToken(),
          });
        } else {
          // Telegram has no kick: ban then immediately unban removes the member
          // without a lingering ban. onlyIfBanned:false is required here — the
          // ban can lag behind this call, and only_if_banned:true would then
          // see "not banned yet" and no-op, leaving the ban permanent.
          await this.telegramGateway.banChatMember({
            chatId,
            userId: targetTelegramUserId,
            token: this.telegramToken(),
            untilDate: undefined,
          });
          enforcement = await this.telegramGateway.unbanChatMember({
            chatId,
            userId: targetTelegramUserId,
            token: this.telegramToken(),
            onlyIfBanned: false,
          });
        }
      } catch (error) {
        enforcement = {
          ok: false,
          skipped: false,
          error: error instanceof Error ? error.message : "unknown-error",
        };
      }
    }

    if (action === "unban") {
      reverted = await this.moderationRepository.revertSanctions({
        tenantId: context.tenantId,
        subjectTelegramUserId: targetTelegramUserId,
        kind: "ban",
      });
    } else if (action === "unmute") {
      reverted = await this.moderationRepository.revertSanctions({
        tenantId: context.tenantId,
        subjectTelegramUserId: targetTelegramUserId,
        kind: "mute",
      });
    }

    // Despues de levantar la restriccion, no antes: promover a alguien que
    // sigue restringido deja el cargo puesto y la mordaza tambien.
    const cargoDevuelto = chatId
      ? await devolverCargo({
          telegram: this.telegramGateway,
          token: this.telegramToken(),
          chatId,
          objetivo: targetTelegramUserId,
          cargo,
        })
      : "nada";

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: `moderation.${action}.applied`,
      resourceType: "moderation_action",
      resourceId: targetTelegramUserId.toString(),
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        targetTelegramUserId: targetTelegramUserId.toString(),
        reason,
        revertedSanctions: reverted,
        enforcement,
      },
    });

    // El parte incluye la marcha atras. Un registro que solo apunta castigos
    // hace parecer implacable a un equipo que perdona la mitad de las veces, y
    // borra justo la prueba de que alguien reviso una decision.
    const fallo = this.enforcementFailure(enforcement);
    await this.publicarParteDeSanciones(context, update, {
      action,
      targetTelegramUserId,
      reason,
      ...(fallo ? { enforcementFailure: fallo } : {}),
    });

    return {
      text: `↩️ ${action} · ${await this.describeTarget(
        update,
        context,
        targetTelegramUserId,
      )}${reverted > 0 ? ` · ${reverted} revertidas` : ""}${notaDeCargo(cargoDevuelto)}`,
    };
  }

  private async handleLockCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseLockCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "Los locks se configuran dentro de un grupo." };
    }

    const command = result.command;
    const current = await this.contentLockRepository.getLocked(
      context.tenantId,
      context.chatId,
    );

    if (command.kind === "list") {
      return {
        text:
          current.length > 0
            ? `Locks activos: ${current.join(", ")}.`
            : "No hay locks activos. Usa /lock <tipo...>.",
      };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "locks.config",
    );

    if (!permission.allowed) {
      return {
        text: `No tienes permisos para configurar locks.`,
      };
    }

    const next =
      command.kind === "lock"
        ? [...new Set([...current, ...command.types])]
        : current.filter((type) => !command.types.includes(type as LockType));

    const saved = await this.contentLockRepository.setLocked(
      context.tenantId,
      context.chatId,
      next,
    );

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "content_lock.updated",
      resourceType: "content_lock_config",
      resourceId: context.chatId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { kind: command.kind, types: command.types },
    });

    return {
      text:
        saved.length > 0
          ? `Locks activos: ${saved.join(", ")}.`
          : "No hay locks activos.",
    };
  }

  /**
   * Re-validates the cross-group membership requirement on activity: Telegram's
   * Bot API has no way to list a chat's members, so a person who leaves the
   * required chat AFTER already being here cannot be swept proactively. Instead,
   * the next message they send re-checks membership and kicks them then — later
   * than the moment they left, but no infra beyond what already runs per message.
   */
  private async handleMembershipGateCheck(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.kind !== "message" ||
      !context.chatId ||
      !update.chat.chatId ||
      !update.user.userId ||
      isServiceMessage(update.raw)
    ) {
      return null;
    }

    if (await this.isActorAdmin(context, update)) {
      return null;
    }

    const gates = await this.groupProtectionRepository.listMembershipGates(
      context.chatId,
    );
    if (gates.length === 0) {
      return null;
    }

    let missingRequiredChatId: bigint | null = null;
    for (const gate of gates) {
      const memberCheck = await this.telegramGateway.getChatMember({
        chatId: gate.requiredTelegramChatId,
        userId: update.user.userId,
        token: this.telegramToken(),
      });
      if (!memberCheck.ok || isActiveChatMember(memberCheck.status as never)) {
        continue;
      }
      missingRequiredChatId = gate.requiredTelegramChatId;
      break;
    }

    // Lenient here: an API error does not prove absence, so never kick on one —
    // only an explicit "left"/"kicked" status does.
    if (missingRequiredChatId === null) {
      await this.progressGamification(
        context,
        update.user.userId,
        "joined_required_group",
      );
      return null;
    }

    await this.applyTelegramEnforcement(
      "kick",
      update,
      update.user.userId,
      undefined,
    );

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "system",
      action: "membershipgate.kick",
      resourceType: "chat_member",
      resourceId: update.user.userId.toString(),
      payload: {
        chatId: context.chatId,
        requiredTelegramChatId: missingRequiredChatId.toString(),
      },
    });

    return {
      text: `${update.user.firstName ?? "Este usuario"} ya no está en el grupo requerido, así que fue expulsado.`,
    };
  }

  private async getTopicLockConfig(
    tenantId: string,
    chatId: string,
  ): Promise<TopicLockConfig> {
    const raw = await this.chatSettingRepository.getValue(
      tenantId,
      chatId,
      TOPIC_LOCK_CONFIG_KEY,
    );
    return isTopicLockConfig(raw) ? raw : EMPTY_TOPIC_LOCK_CONFIG;
  }

  private async handleTopicScopeCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseTopicScopeCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "El ámbito por topic se configura dentro de un grupo." };
    }

    const command = result.command;
    const config = await this.getTopicLockConfig(
      context.tenantId,
      context.chatId,
    );

    if (command.kind === "show") {
      const effective = resolveTopicConfig(config, command.topicId);
      return {
        text:
          effective.lockedTypes.length > 0
            ? `Locks de este topic: ${effective.lockedTypes.join(", ")}.`
            : "Este topic no tiene locks propios (usa los locks generales del grupo).",
      };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "topic-locks.config",
    );

    if (!permission.allowed) {
      return { text: "No tienes permisos para configurar locks por topic." };
    }

    if (command.kind === "reset") {
      const rest = Object.fromEntries(
        Object.entries(config.overrides).filter(
          ([topicKey]) => topicKey !== command.topicId,
        ),
      );
      const nextConfig: TopicLockConfig = {
        base: config.base,
        overrides: rest,
      };

      await this.chatSettingRepository.setValue(
        context.tenantId,
        context.chatId,
        TOPIC_LOCK_CONFIG_KEY,
        nextConfig,
      );

      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "topic_lock.reset",
        resourceType: "topic_lock_config",
        resourceId: `${context.chatId}:${command.topicId}`,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { topicId: command.topicId },
      });

      return {
        text: "Locks propios de este topic reseteados (vuelve a usar los locks generales del grupo).",
      };
    }

    // command.kind is "lock" | "unlock" here.
    if (!isLockType(command.type)) {
      return { text: `Tipo no válido. Tipos: ${LOCKABLE_TYPES.join(", ")}.` };
    }

    const currentTypes = config.overrides[command.topicId]?.lockedTypes ?? [];
    const nextTypes =
      command.kind === "lock"
        ? [...new Set([...currentTypes, command.type])]
        : currentTypes.filter((type) => type !== command.type);

    const nextConfig: TopicLockConfig = {
      base: config.base,
      overrides: {
        ...config.overrides,
        [command.topicId]: { lockedTypes: nextTypes },
      },
    };

    await this.chatSettingRepository.setValue(
      context.tenantId,
      context.chatId,
      TOPIC_LOCK_CONFIG_KEY,
      nextConfig,
    );

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "topic_lock.updated",
      resourceType: "topic_lock_config",
      resourceId: `${context.chatId}:${command.topicId}`,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        kind: command.kind,
        type: command.type,
        topicId: command.topicId,
      },
    });

    return {
      text:
        nextTypes.length > 0
          ? `Locks de este topic: ${nextTypes.join(", ")}.`
          : "No hay locks propios en este topic (usa los locks generales del grupo).",
    };
  }

  /** `content-lock.ambient`: la regla y sus efectos viven en `modules/security`. */
  private async handleContentLock(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const telegramChatId = update.chat.chatId;
    const chatId = context.chatId;
    const messageId = update.messageId;
    if (
      update.kind !== "message" ||
      !chatId ||
      !telegramChatId ||
      messageId === undefined
    ) {
      return null;
    }

    const aviso = await aplicarBloqueoDeContenido(
      {
        contenido: update.content,
        temaId:
          update.chat.topicId === undefined
            ? undefined
            : String(update.chat.topicId),
      },
      {
        esAdministrador: () => this.isActorAdmin(context, update),
        bloqueadosEnElChat: () =>
          this.contentLockRepository.getLocked(context.tenantId, chatId),
        bloqueosPorTema: () =>
          this.getTopicLockConfig(context.tenantId, chatId),
        borrarMensaje: async () => {
          await this.telegramGateway.deleteMessage({
            chatId: telegramChatId,
            messageId,
            token: this.telegramToken(),
          });
        },
        auditar: (tipo) =>
          this.repository.recordAudit({
            tenantId: context.tenantId,
            actorType: "system",
            action: "content_lock.enforced",
            resourceType: "content_lock",
            resourceId: chatId,
            ...(context.userId ? { actorId: context.userId } : {}),
            payload: {
              lockType: tipo,
              telegramUserId: update.user.userId?.toString(),
              messageId,
            },
          }),
        anotarSenalDeRiesgo: async (senal) => {
          await this.recordRiskSignal(context, update.user.userId, senal);
        },
      },
    );

    return aviso === null ? null : { text: aviso };
  }

  private async handleNotesCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseNotesCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId || update.chat.chatType === "private") {
      // Notes belong to a group and only its admins can manage them; in a DM
      // nobody is an "admin", so guide the user instead of showing an empty list
      // (and, for /save, a confusing config.write permission error).
      return {
        text: "🗒️ Las notas pertenecen a un grupo. Usa /save y /notes DENTRO del grupo (como administrador), no en mi chat privado.",
      };
    }

    const command = result.command;

    if (command.kind === "list") {
      const names = await this.notesRepository.listNotes(context.chatId);
      return {
        text:
          names.length > 0
            ? `Notas: ${names.map((name) => `#${name}`).join(", ")}.`
            : "No hay notas guardadas. Usa /save <nombre> <contenido>.",
      };
    }

    if (command.kind === "get") {
      const note = await this.notesRepository.getNote(
        context.chatId,
        command.name,
      );
      return note
        ? buildTemplateReply(
            note.content,
            this.templateVars(update),
            update.updateId,
          )
        : { text: `No existe la nota #${command.name}.` };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "notes.write",
    );

    if (!permission.allowed) {
      return {
        text: `No tienes permisos para gestionar notas.`,
      };
    }

    if (command.kind === "save") {
      await this.notesRepository.saveNote(
        context.tenantId,
        context.chatId,
        command.name,
        command.content,
        context.userId,
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "note.saved",
        resourceType: "note",
        resourceId: command.name,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { name: command.name },
      });
      return { text: `Nota #${command.name} guardada.` };
    }

    const removed = await this.notesRepository.deleteNote(
      context.chatId,
      command.name,
    );
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "note.cleared",
      resourceType: "note",
      resourceId: command.name,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { name: command.name, removed },
    });
    return {
      text: removed
        ? `Nota #${command.name} eliminada.`
        : `No existe la nota #${command.name}.`,
    };
  }

  private async handleNoteRecall(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (!context.chatId || !update.messageText) {
      return null;
    }

    const name = detectNoteRecall(update.messageText);

    if (!name) {
      return null;
    }

    const note = await this.notesRepository.getNote(context.chatId, name);

    return note
      ? buildTemplateReply(
          note.content,
          this.templateVars(update),
          update.updateId,
        )
      : null;
  }

  private async handleFiltersCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseFilterCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "Los filtros se gestionan dentro de un grupo." };
    }

    const command = result.command;

    if (command.kind === "list") {
      const filters = await this.filtersRepository.listFilters(context.chatId);
      return {
        text:
          filters.length > 0
            ? `Filtros: ${filters.map((filter) => filter.trigger).join(", ")}.`
            : "No hay filtros. Usa /filter <palabra> <respuesta>.",
      };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "filters.write",
    );

    if (!permission.allowed) {
      return {
        text: `No tienes permisos para gestionar filtros.`,
      };
    }

    if (command.kind === "add") {
      await this.filtersRepository.saveFilter(
        context.tenantId,
        context.chatId,
        command.trigger,
        command.response,
        context.userId,
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "filter.saved",
        resourceType: "filter",
        resourceId: command.trigger,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { trigger: command.trigger },
      });
      return { text: `Filtro "${command.trigger}" guardado.` };
    }

    const removed = await this.filtersRepository.deleteFilter(
      context.chatId,
      command.trigger,
    );
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "filter.removed",
      resourceType: "filter",
      resourceId: command.trigger,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { trigger: command.trigger, removed },
    });
    return {
      text: removed
        ? `Filtro "${command.trigger}" eliminado.`
        : `No existe el filtro "${command.trigger}".`,
    };
  }

  private async handleFilterMatch(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (!context.chatId || !update.isTextMessage || !update.messageText) {
      return null;
    }

    const filters = await this.filtersRepository.listFilters(context.chatId);

    if (filters.length === 0) {
      return null;
    }

    const matched = matchFilter(
      update.messageText,
      filters.map((filter) => filter.trigger),
    );

    if (!matched) {
      return null;
    }

    // Per-trigger cooldown (30s) so a filter does not spam on every message.
    const FILTER_COOLDOWN_SECONDS = 30;
    const cooldownKey = `filtercd:${context.chatId}:${matched}`;
    const recent = await this.floodCounter.record(
      cooldownKey,
      Date.now(),
      FILTER_COOLDOWN_SECONDS,
    );
    if (recent.length > 1) {
      return null;
    }

    const filter = filters.find((entry) => entry.trigger === matched);

    return filter
      ? buildTemplateReply(
          filter.response,
          this.templateVars(update),
          update.updateId,
        )
      : null;
  }

  private async handleReputationCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseReputationCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "La reputación se gestiona dentro de un grupo." };
    }

    const command = result.command;

    if (command.kind === "top") {
      const top = await this.reputationRepository.top(context.chatId, 10);
      if (top.length === 0) {
        return { text: "Aún no hay reputación en este chat." };
      }
      const lines = top.map((profile, index) => {
        const label = profile.name ?? profile.telegramUserId.toString();
        return `${index + 1}. ${label} — ${profile.points} pts (nivel ${levelForXp(profile.xp)}, división ${divisionForPoints(profile.points)})`;
      });
      return { text: `Ranking de reputación:\n${lines.join("\n")}` };
    }

    if (command.kind === "show-self" || command.kind === "level") {
      if (!update.user.userId) {
        return { text: "No puedo identificarte." };
      }
      const profile = await this.reputationRepository.getProfile(
        context.chatId,
        update.user.userId,
      );
      const points = profile?.points ?? 0;
      const xp = profile?.xp ?? 0;
      return {
        text: `Tu reputación: ${points} pts | XP ${xp} | nivel ${levelForXp(xp)}.`,
      };
    }

    // Give reputation: a member cannot give points to themselves, and a per
    // giver/target cooldown blocks farming.
    if (!update.user.userId) {
      return { text: "No puedo identificarte." };
    }

    if (command.targetTelegramUserId === update.user.userId) {
      return { text: "No puedes darte reputación a ti mismo." };
    }

    const cooldownKey = `rep:${update.user.userId.toString()}:${command.targetTelegramUserId.toString()}`;
    const recent = await this.floodCounter.record(
      cooldownKey,
      Date.now(),
      3600,
    );

    if (recent.length > 1) {
      return { text: "Ya diste reputación a este usuario recientemente." };
    }

    const profile = await this.reputationRepository.addPoints(
      context.tenantId,
      context.chatId,
      command.targetTelegramUserId,
      1,
    );

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "reputation.given",
      resourceType: "reputation_profile",
      resourceId: command.targetTelegramUserId.toString(),
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        targetTelegramUserId: command.targetTelegramUserId.toString(),
        points: profile.points,
      },
    });

    return {
      text: `Reputación +1 para ${await this.describeTarget(update, context, command.targetTelegramUserId)} (total ${profile.points}).`,
    };
  }

  private async handleTrustTierCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.command?.name !== "confianza") {
      return null;
    }

    if (!context.chatId) {
      return { text: "El nivel de confianza se calcula dentro de un grupo." };
    }

    if (!update.user.userId || !context.membershipId) {
      return { text: "No pude identificarte." };
    }

    const telegramUserId = update.user.userId;
    const chatId = context.chatId;
    const membershipId = context.membershipId;

    const [joinedAt, messages, profile, activeWarnings, thanksReceived] =
      await Promise.all([
        this.repository.getMembershipJoinedAt(membershipId),
        this.analyticsRepository.getUserMessages(chatId, telegramUserId),
        this.reputationRepository.getProfile(chatId, telegramUserId),
        this.moderationRepository.countActiveWarnings(
          context.tenantId,
          chatId,
          telegramUserId,
        ),
        this.gratitudeRepository.getPoints(
          context.tenantId,
          chatId,
          telegramUserId,
        ),
      ]);

    const ageDays = joinedAt
      ? Math.max(0, Math.floor((Date.now() - joinedAt.getTime()) / 86_400_000))
      : 0;

    const stats: TrustStats = {
      ageDays,
      messages,
      reputation: profile?.points ?? 0,
      activeWarnings,
      thanksReceived,
    };

    const tier = computeTrustTier(stats);
    const unlocks = tierUnlocks(tier);
    const perms = [
      unlocks.canSendLinks ? "✅ enlaces" : "🚫 enlaces",
      unlocks.canSendMedia ? "✅ media" : "🚫 media",
      unlocks.canUseInline ? "✅ modo inline" : "🚫 modo inline",
    ].join(" · ");

    return {
      text:
        `${formatTrustTier(tier)}\n` +
        `Antigüedad: ${ageDays}d · Mensajes: ${messages} · Reputación: ${stats.reputation} · Gracias recibidas: ${thanksReceived}\n` +
        `Permisos: ${perms}`,
    };
  }

  /**
   * `/info` — everything the bot knows about one member of this group.
   *
   * Targeting anyone but yourself is admin-only. The dossier collects a
   * person's activity, warnings and standing into a single message, which is
   * exactly the sort of thing a stranger should not be able to pull on another
   * member just because they share a group.
   *
   * Every figure is scoped to THIS chat. The bot knows the same person in other
   * groups and deliberately does not say so.
   */
  private async handleInfoCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.command?.name !== "info") {
      return null;
    }

    if (!context.chatId || !update.chat.chatId) {
      return {
        text: "El expediente de un usuario se consulta dentro de un grupo.",
      };
    }

    // Reply-targeting, mention entities and @username→id all resolve here, the
    // same way /ban and /warn pick their target.
    const resolved = await this.withReplyTarget(update, context);
    const parsed = parseInfoTarget(resolved.command?.args ?? []);
    if (!parsed.ok || !parsed.target) {
      return { text: INFO_USAGE };
    }

    const chatId = context.chatId;
    const target = parsed.target;
    let profile: MemberActivityProfileRow | undefined;
    let telegramUserId: bigint | undefined;

    if (target.kind === "self") {
      telegramUserId = update.user.userId;
    } else if (target.kind === "id") {
      telegramUserId = target.telegramUserId;
    } else {
      // Only reached when the global id lookup found nothing: fall back to the
      // handles this bot has seen in THIS chat.
      profile = await this.analyticsRepository.findMemberByUsername?.(
        context.tenantId,
        chatId,
        target.username,
      );
      telegramUserId = profile?.telegramUserId;
      if (!telegramUserId) {
        return {
          text:
            `No tengo fichado a @${target.username} en este grupo.\n\n` +
            "Telegram no deja buscar por alias: solo conozco a quien he visto " +
            "escribir o entrar. Responde a un mensaje suyo con /info, o pásame su ID.",
        };
      }
    }

    if (!telegramUserId) {
      return { text: "No he podido identificar a quién te refieres." };
    }

    const isSelf = telegramUserId === update.user.userId;
    if (!isSelf && !(await this.isActorAdmin(context, update))) {
      return {
        text: "Solo los administradores pueden pedir la ficha de otra persona. Escribe /info a secas para ver la tuya.",
      };
    }

    profile ??= await this.analyticsRepository.getMemberActivityProfile?.(
      context.tenantId,
      chatId,
      telegramUserId,
    );

    const [
      member,
      joinedAt,
      flatMessages,
      reputation,
      warnings,
      thanks,
      verified,
    ] = await Promise.all([
      // Never throws: a failed lookup resolves to { ok: false }, which the
      // dossier renders as "no he podido comprobarlo" rather than as absence.
      this.telegramGateway.getChatMember({
        chatId: update.chat.chatId,
        userId: telegramUserId,
        token: this.telegramToken(),
      }),
      this.repository.getMembershipJoinedAtByTelegramUser(
        chatId,
        telegramUserId,
      ),
      this.analyticsRepository.getUserMessages(chatId, telegramUserId),
      this.reputationRepository.getProfile(chatId, telegramUserId),
      this.moderationRepository.countActiveWarnings(
        context.tenantId,
        chatId,
        telegramUserId,
      ),
      this.gratitudeRepository.getPoints(
        context.tenantId,
        chatId,
        telegramUserId,
      ),
      this.groupProtectionRepository.isVerified(
        context.tenantId,
        telegramUserId,
      ),
    ]);

    const now = Date.now();
    // The profile row counts the imported history too, so it wins whenever it
    // exists; user_activity only ever saw messages sent while the bot watched.
    const messages = profile
      ? profile.historicalMessages + profile.liveMessages
      : flatMessages;
    const lastMessageAt = [
      profile?.historicalLastMessageAt,
      profile?.liveLastMessageAt,
    ]
      .filter((date): date is Date => date !== undefined)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    // Two clocks for "since when": the membership row (set when they asked to
    // join) and the activity profile (set when the bot first saw them). Neither
    // covers everyone, so the earlier of the two is the honest answer.
    const firstSeen = [joinedAt, profile?.membershipObservedAt]
      .filter((date): date is Date => date !== undefined)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    const trust = computeTrustTier({
      ageDays: firstSeen
        ? Math.max(0, Math.floor((now - firstSeen.getTime()) / 86_400_000))
        : 0,
      messages,
      reputation: reputation?.points ?? 0,
      activeWarnings: warnings,
      thanksReceived: thanks,
    });

    return this.buildDossierReply({
      context,
      update,
      telegramUserId,
      isSelf,
      member,
      profile,
      fallbackUsername:
        target.kind === "username" ? target.username : undefined,
      messages,
      lastMessageAt,
      firstSeen,
      warnings,
      reputation: reputation?.points ?? 0,
      thanks,
      trust: formatTrustTier(trust),
      verified,
      nowMs: now,
    });
  }

  /**
   * Turns the gathered facts into the card + its action keyboard. Split out of
   * handleInfoCommand so a button press can redraw the same card without going
   * back through command parsing and target resolution.
   */
  private async buildDossierReply(input: {
    context: FoundationContext;
    update: TelegramUpdateEnvelope;
    telegramUserId: bigint;
    isSelf: boolean;
    member: TelegramChatMemberResult;
    profile: MemberActivityProfileRow | undefined;
    fallbackUsername: string | undefined;
    messages: number;
    lastMessageAt: Date | undefined;
    firstSeen: Date | undefined;
    warnings: number;
    reputation: number;
    thanks: number;
    trust: string;
    verified: boolean;
    nowMs: number;
  }): Promise<BotReply> {
    const { context, update, member, profile, isSelf } = input;
    const status = member.ok ? member.status : undefined;
    const membership = isDossierMembership(status) ? status : "unknown";

    const warnPolicy = context.chatId
      ? await this.moderationExtraRepository
          .getWarnPolicy(context.chatId)
          .catch(() => undefined)
      : undefined;

    // Telegram's own answer wins on identity: it is current, whereas the stored
    // profile is whatever the person was called the last time the bot saw them.
    const username =
      member.username ??
      profile?.username ??
      (isSelf ? update.user.username : undefined) ??
      input.fallbackUsername;

    const sanction =
      member.restrictedUntil && membership === "restricted"
        ? `restringido hasta ${member.restrictedUntil.toISOString().slice(0, 16).replace("T", " ")} UTC`
        : membership === "kicked"
          ? "expulsado / baneado del grupo"
          : undefined;

    const canModerate = !isSelf && (await this.isActorAdmin(context, update));
    const keyboard = buildUserDossierKeyboard(input.telegramUserId, {
      canModerate,
    });

    return {
      ...(keyboard ? { replyMarkup: keyboard } : {}),
      text: formatUserDossier({
        telegramUserId: input.telegramUserId,
        username,
        firstName:
          member.firstName ?? (isSelf ? update.user.firstName : undefined),
        lastName: member.lastName,
        isBot: member.isBot === true,
        membership,
        customTitle: member.customTitle,
        seenForMs: input.firstSeen
          ? input.nowMs - input.firstSeen.getTime()
          : undefined,
        firstSeenAt: input.firstSeen,
        messages: input.messages,
        historicalMessages: profile?.historicalMessages,
        liveMessages: profile?.liveMessages,
        silentForMs: input.lastMessageAt
          ? input.nowMs - input.lastMessageAt.getTime()
          : undefined,
        activeWarnings: input.warnings,
        warnLimit: warnPolicy?.warnLimit,
        reputation: input.reputation,
        thanksReceived: input.thanks,
        trustTier: input.trust,
        languageCode: member.languageCode ?? update.user.languageCode,
        verified: input.verified,
        activeSanction: sanction,
        permissions: {
          canSendMessages: member.canSendMessages,
          canSendMedia: member.canSendMedia,
          canSendLinks: member.canSendLinks,
          canAddWebPagePreviews: member.canAddWebPagePreviews,
        },
        isSelf,
      }),
    };
  }

  /**
   * The buttons under an `/info` card.
   *
   * Callback data is client-supplied and a card outlives the moment it was
   * drawn, so the payload is treated as a HINT about WHO, never as proof of
   * WHAT the presser may do: every press re-checks that this person is still an
   * admin right now. A card drawn while someone was a moderator must not keep
   * working after they are demoted.
   */
  private async handleDossierCallback(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    rawUpdate: unknown,
  ): Promise<BotReply | null> {
    const parsed = parseDossierCallback(update.callbackData);
    if (!parsed) {
      return null;
    }

    if (!context.chatId || !update.chat.chatId) {
      await this.ackCallbackQuery(rawUpdate, "Esto solo funciona en un grupo.");
      return null;
    }

    const target = parsed.telegramUserId;
    const isSelf = target === update.user.userId;
    const isAdmin = await this.isActorAdmin(context, update);

    // Reading is allowed to the person themselves; acting never is.
    const needsAdmin = parsed.action !== "perms" || !isSelf;
    if (needsAdmin && !isAdmin) {
      await this.ackCallbackQuery(
        rawUpdate,
        "Solo los administradores pueden usar esto.",
        true,
      );
      return null;
    }

    if (parsed.action === "warns") {
      const warnings = await this.moderationExtraRepository.listActiveWarnings(
        context.tenantId,
        context.chatId,
        target,
      );
      if (warnings.length === 0) {
        await this.ackCallbackQuery(rawUpdate, "Sin avisos activos.", true);
        return null;
      }
      const lines = warnings
        .slice(0, 8)
        .map(
          (warning, index) => `${index + 1}. ${warning.reason ?? "sin motivo"}`,
        );
      return {
        text: `❗ Avisos activos de ${await this.describeTarget(update, context, target)}:\n${lines.join("\n")}`,
      };
    }

    if (parsed.action === "roles" || parsed.action === "perms") {
      const member = await this.telegramGateway.getChatMember({
        chatId: update.chat.chatId,
        userId: target,
        token: this.telegramToken(),
      });
      if (!member.ok) {
        await this.ackCallbackQuery(
          rawUpdate,
          "Telegram no me ha contestado; no puedo afirmar nada.",
          true,
        );
        return null;
      }
      const detail =
        parsed.action === "roles"
          ? [
              `Estado: ${member.status ?? "desconocido"}`,
              member.customTitle ? `Título: ${member.customTitle}` : "",
              `Puede borrar mensajes: ${member.canDeleteMessages === undefined ? "no lo sé" : member.canDeleteMessages ? "sí" : "no"}`,
              `Puede restringir: ${member.canRestrictMembers === undefined ? "no lo sé" : member.canRestrictMembers ? "sí" : "no"}`,
            ]
          : [
              `Escribir: ${describeMemberFlag(member.canSendMessages)}`,
              `Media: ${describeMemberFlag(member.canSendMedia)}`,
              `Enlaces: ${describeMemberFlag(member.canSendLinks)}`,
              `Previews: ${describeMemberFlag(member.canAddWebPagePreviews)}`,
            ];
      await this.ackCallbackQuery(
        rawUpdate,
        detail.filter(Boolean).join("\n").slice(0, 200),
        true,
      );
      return null;
    }

    // mute / ban: a real sanction, so it goes through the same enforcement path
    // and audit trail as the typed command — the button is a shortcut, not a
    // second, quieter way to punish someone.
    if (isSelf) {
      await this.ackCallbackQuery(
        rawUpdate,
        "No puedes sancionarte a ti mismo.",
        true,
      );
      return null;
    }
    if (await this.isGroupAdmin(update.chat.chatId, target)) {
      await this.ackCallbackQuery(
        rawUpdate,
        "Es administrador: quítale el cargo primero.",
        true,
      );
      return null;
    }

    const action = parsed.action === "ban" ? "ban" : "mute";
    const result = await this.applyTelegramEnforcement(
      action,
      update,
      target,
      undefined,
    );
    const ok = (result as { ok?: boolean })?.ok === true;

    await this.moderationRepository.createSanction({
      // Determinista: un reintento del mismo update no crea otra sanción.
      claveIdempotencia: this.claveDeterminista(update, "dossier"),
      tenantId: context.tenantId,
      chatId: context.chatId,
      actorUserId: context.userId,
      subjectTelegramUserId: target,
      reason: "desde la ficha /info",
      kind: action,
      telegramChatId: update.chat.chatId,
    });
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: `moderation.${action}`,
      resourceType: "telegram_member",
      resourceId: target.toString(),
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        source: "info-card",
        delivered: ok,
        actorTelegramUserId: update.user.userId?.toString(),
      },
    });

    await this.ackCallbackQuery(
      rawUpdate,
      ok
        ? action === "ban"
          ? "Baneado."
          : "Silenciado."
        : "No he podido aplicarlo en Telegram (¿me faltan permisos?).",
      true,
    );
    return null;
  }

  /**
   * `/send <texto>` — the bot says it, verbatim, as itself.
   *
   * Admin-only and audited, because a message from the bot carries the group's
   * authority: anyone able to put words in its mouth could announce a fake rule
   * change or a fake giveaway link and have it read as official. The command
   * message is deleted so the result reads as the bot speaking, not as an admin
   * operating a puppet.
   */
  private async handleSendCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const name = update.command?.name;
    // Telegram NO analiza comandos en los pies de foto: `normalizeCommand` solo
    // mira `message.text`. Asi que mandar una foto con el pie "/send hola" no
    // llega aqui como comando, y por eso /send parecia no funcionar con fotos.
    // Se detecta a mano, y solo para este comando.
    const pie = update.messageCaption?.trim() ?? "";
    const comandoEnPie = /^\/(send|di)(@\S+)?(\s|$)/iu.exec(pie);
    if (name !== "send" && name !== "di" && !comandoEnPie) {
      return null;
    }

    if (!update.chat.chatId) {
      return null;
    }

    const textoDelPie = comandoEnPie
      ? pie.slice(comandoEnPie[0].length).trim()
      : "";
    const text = comandoEnPie
      ? textoDelPie
      : (update.command?.args ?? []).join(" ").trim();

    // Tres formas de darle una foto: la lleva el propio mensaje, o se responde
    // a una que ya esta en el chat.
    const propia =
      update.attachment?.kind === "photo"
        ? update.attachment.fileId
        : undefined;
    const respondida = extractRepliedPhoto(update.raw);
    const fotoId = propia ?? respondida?.fileId;
    // Sin texto propio, se conserva el pie original de la foto respondida.
    const pieFinal = text || (propia ? "" : (respondida?.caption ?? ""));

    if (!fotoId && text.length === 0) {
      return {
        text: "Uso: /send <texto>, o responde a una foto con /send. Lo repito tal cual, como si lo dijera yo.",
      };
    }

    if (!(await this.isActorAdmin(context, update))) {
      return { text: "Solo los administradores pueden hacerme hablar." };
    }

    if (fotoId) {
      await this.telegramGateway.sendPhotoByFileId({
        chatId: update.chat.chatId,
        fileId: fotoId,
        token: this.telegramToken(),
        ...(pieFinal ? { caption: pieFinal } : {}),
      });
    } else {
      await this.telegramGateway.sendMessage({
        chatId: update.chat.chatId,
        reply: { text },
        token: this.telegramToken(),
      });
    }

    // Best-effort: without delete rights the command stays visible, which is
    // cosmetic — the message already went out.
    if (update.messageId) {
      try {
        await this.telegramGateway.deleteMessage({
          chatId: update.chat.chatId,
          messageId: update.messageId,
          token: this.telegramToken(),
        });
      } catch {
        // Cosmetic only.
      }
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "bot.spoke",
      resourceType: "telegram_chat",
      resourceId: update.chat.chatId.toString(),
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        actorTelegramUserId: update.user.userId?.toString(),
        length: pieFinal.length,
        text: pieFinal,
        conFoto: Boolean(fotoId),
      },
    });

    // The bot's own message IS the answer; a reply on top would be noise.
    return null;
  }

  private async handleRookieRankingCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.command?.name !== "novatos") {
      return null;
    }

    if (!context.chatId) {
      return { text: "El ranking de novatos se calcula dentro de un grupo." };
    }

    const chatId = context.chatId;
    const top = await this.reputationRepository.top(chatId, 20);

    if (top.length === 0) {
      return { text: "Aún no hay reputación en este chat." };
    }

    const players = (
      await Promise.all(
        top.map(async (profile) => {
          const joinedAt =
            await this.repository.getMembershipJoinedAtByTelegramUser(
              chatId,
              profile.telegramUserId,
            );
          if (!joinedAt) {
            return undefined;
          }
          const ageDays = Math.max(
            0,
            Math.floor((Date.now() - joinedAt.getTime()) / 86_400_000),
          );
          return {
            // top() already resolves a display name; this listing was printing
            // the raw id anyway, so a real group saw "9000000005 — 0 pts" — a
            // ranking nobody can read, least of all the people in it.
            id: profile.name?.trim() || profile.telegramUserId.toString(),
            score: profile.points,
            ageDays,
          };
        }),
      )
    ).filter(
      (player): player is NonNullable<typeof player> => player !== undefined,
    );

    if (players.length === 0) {
      return { text: "Aún no hay miembros con antigüedad registrada." };
    }

    const { rookies, veterans } = separateRookieRanking(players);

    const formatList = (list: typeof rookies): string =>
      list.length === 0
        ? "  (vacío)"
        : list
            .slice(0, 5)
            .map(
              (entry, index) =>
                `  ${index + 1}. ${entry.id} — ${entry.score} pts`,
            )
            .join("\n");

    return {
      text:
        "🌱 Novatos (≤7 días en el grupo):\n" +
        `${formatList(rookies)}\n\n` +
        "🎖 Veteranos:\n" +
        `${formatList(veterans)}`,
    };
  }

  private async handleHallOfFameCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.command?.name !== "salonfama") {
      return null;
    }

    if (!context.chatId) {
      return { text: "El salón de la fama se calcula dentro de un grupo." };
    }

    const chatId = context.chatId;
    const posters = await this.analyticsRepository.getTopPosters(chatId, 20);

    if (posters.length === 0) {
      return { text: "Aún no hay actividad registrada en este chat." };
    }

    const contribs = await Promise.all(
      posters.map(async (poster) => {
        const thanks = await this.gratitudeRepository.getPoints(
          context.tenantId,
          chatId,
          poster.telegramUserId,
        );
        return {
          userId: poster.username ?? poster.telegramUserId.toString(),
          upvotes: 0,
          thanks,
          messages: poster.messages,
        };
      }),
    );

    const top = topContributions(contribs, 5);

    const lines = top.map(
      (entry, index) => `${index + 1}. ${entry.userId} — ${entry.value} pts`,
    );

    return { text: `🏆 Salón de la fama:\n${lines.join("\n")}` };
  }

  private async handlePlatformCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parsePlatformCommand(update);
    if (!result) {
      return null;
    }
    if (!result.ok) {
      return { text: result.error.usage };
    }
    const actorId = update.user.userId;
    if (!actorId) {
      return { text: "No puedo identificarte." };
    }

    const command = result.command;

    if (command.kind === "platform-panel") {
      if (
        !(await this.hasPlatformAccess(actorId, [
          "promo_admin",
          "bot_factory_admin",
          "auditor",
        ]))
      ) {
        return { text: "No tienes acceso al panel de plataforma." };
      }
      const appUrl = readAppUrl(this.env.TELEGRAM_APP_URL);
      const panelUrl = `${appUrl.replace(/\/$/u, "")}/platform`;
      const namedMiniAppUrl = `https://t.me/${this.env.TELEGRAM_BOT_USERNAME}/${this.env.TELEGRAM_MINIAPP_NAME}?startapp=platform`;
      const button =
        update.chat.chatType === "private"
          ? { text: "Abrir panel", web_app: { url: panelUrl } }
          : { text: "Abrir panel", url: namedMiniAppUrl };
      return {
        text: "Panel de plataforma: promos y bots personalizados.",
        replyMarkup: { inline_keyboard: [[button]] },
      };
    }

    if (command.kind === "redeem") {
      const redeemed = await this.platformRepository.redeemPromo({
        code: command.code,
        redeemedByTelegramId: actorId,
        tenantId: context.tenantId,
      });
      if (!redeemed.ok) {
        const _reason: Record<string, string> = {
          "not-found": "código no existe",
          expired: "código caducado",
          revoked: "código revocado",
          "used-up": "código sin usos disponibles",
          "already-redeemed": "ya habías usado este código",
        };
        return {
          text: `No se pudo aplicar el código.`,
        };
      }
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "platform.promo.redeemed",
        resourceType: "entitlement",
        resourceId: redeemed.entitlement.id,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: {
          telegramUserId: actorId.toString(),
          promoId: redeemed.promo.id,
          template: redeemed.entitlement.template,
        },
      });
      return {
        text: "Código aplicado. Has desbloqueado 1 bot personalizado. Usa /createbot para empezar.",
      };
    }

    if (command.kind === "my-plan") {
      const [entitlements, slots] = await Promise.all([
        this.platformRepository.listEntitlements(actorId),
        this.platformRepository.availableManagedBotSlots(actorId),
      ]);
      if (entitlements.length === 0) {
        return {
          text: "No tienes beneficios activos. Usa /redeem <código> si tienes uno.",
        };
      }
      const lines = entitlements.map(
        (entry) =>
          `${entry.kind} (${entry.template}) ${entry.usedQuantity}/${entry.quantity}` +
          (entry.expiresAt
            ? ` expira ${entry.expiresAt.toISOString().slice(0, 10)}`
            : ""),
      );
      return {
        text: `Tu plan:\n${lines.join("\n")}\nSlots de bot disponibles: ${slots}`,
      };
    }

    if (command.kind === "create-bot") {
      const slots =
        await this.platformRepository.availableManagedBotSlots(actorId);
      if (slots <= 0) {
        return {
          text: "No tienes slots de bot personalizado. Pide un código o usa /redeem <código>.",
        };
      }
      return {
        text:
          "Tienes acceso para crear tu bot personalizado. Abre este enlace y completa el flujo de Telegram:\n" +
          this.buildManagedBotCreateLink(actorId),
        disableWebPagePreview: false,
      };
    }

    if (command.kind === "my-bots") {
      const bots = await this.platformRepository.listManagedBots(actorId);
      if (bots.length === 0) {
        return { text: "Aún no tienes bots personalizados creados." };
      }
      return {
        text: `Tus bots:\n${bots
          .map((bot) => `@${bot.username} - ${bot.status} (${bot.template})`)
          .join("\n")}`,
      };
    }

    if (command.kind === "promo-create") {
      if (!(await this.hasPlatformAccess(actorId, ["promo_admin"]))) {
        return { text: "No tienes acceso a promos." };
      }
      const promo = await this.platformRepository.createPromo({
        tenantId: context.tenantId,
        template: command.template,
        maxUses: command.maxUses,
        expiresAt: command.expiresInDays
          ? new Date(Date.now() + command.expiresInDays * 86_400_000)
          : undefined,
        note: command.note,
        createdByTelegramId: actorId,
      });
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "platform.promo.created",
        resourceType: "promo_code",
        resourceId: promo.id,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { template: promo.template, maxUses: promo.maxUses },
      });
      return {
        text:
          `Promo creada (${promo.template}, ${promo.maxUses} uso(s)).\n` +
          `Código: ${promo.code}`,
      };
    }

    if (command.kind === "promo-list") {
      if (
        !(await this.hasPlatformAccess(actorId, ["promo_admin", "auditor"]))
      ) {
        return { text: "No tienes acceso a promos." };
      }
      const promos = await this.platformRepository.listPromos(20);
      if (promos.length === 0) {
        return {
          text: "No hay promos creadas. Usa /promo para crear una. Usa /promo para crear una.",
        };
      }
      return {
        text: `Promos:\n${promos
          .map(
            (promo) =>
              `${promo.id} ${promo.codePrefix}... ${promo.template} ${promo.usedCount}/${promo.maxUses}` +
              (promo.revokedAt ? " revocada" : ""),
          )
          .join("\n")}`,
      };
    }

    if (command.kind === "promo-revoke") {
      if (!(await this.hasPlatformAccess(actorId, ["promo_admin"]))) {
        return { text: "No tienes acceso a promos." };
      }
      const revoked = await this.platformRepository.revokePromo(
        command.codeOrId,
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "platform.promo.revoked",
        resourceType: "promo_code",
        resourceId: command.codeOrId,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { revoked },
      });
      return {
        text: revoked ? "Promo revocada." : "No encontré esa promo activa.",
      };
    }

    if (command.kind === "grant-custombot") {
      if (!(await this.hasPlatformAccess(actorId, ["bot_factory_admin"]))) {
        return { text: "No tienes acceso para conceder bots." };
      }
      const target = await this.resolveTelegramUserTarget(command.target);
      if (!target) {
        return {
          text: "No pude resolver ese usuario. Usa user_id numerico o un @username conocido.",
        };
      }
      const entitlement = await this.platformRepository.grantManagedBotSlot({
        ownerTelegramId: target,
        template: command.template,
        expiresAt: command.expiresInDays
          ? new Date(Date.now() + command.expiresInDays * 86_400_000)
          : undefined,
        createdByTelegramId: actorId,
      });
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "platform.entitlement.granted",
        resourceType: "entitlement",
        resourceId: entitlement.id,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: {
          targetTelegramUserId: target.toString(),
          template: command.template,
        },
      });
      const notified = await this.tryNotifyCustomBotGrant(target);
      return {
        text:
          `Acceso concedido a ${target.toString()} (${command.template}).` +
          (notified
            ? ""
            : ` No pude abrirle DM; enviale https://t.me/${this.env.TELEGRAM_BOT_USERNAME}?start=custombot`),
      };
    }

    if (command.kind === "revoke-custombot") {
      if (!(await this.hasPlatformAccess(actorId, ["bot_factory_admin"]))) {
        return { text: "No tienes acceso para revocar bots." };
      }
      const target = await this.resolveTelegramUserTarget(command.target);
      if (!target) {
        return { text: "No pude resolver ese usuario." };
      }
      const count = await this.platformRepository.revokeManagedBotSlots(target);
      return { text: `Slots revocados: ${count}.` };
    }

    if (
      command.kind === "platform-admin-add" ||
      command.kind === "platform-admin-remove" ||
      command.kind === "platform-admin-list"
    ) {
      if (!(await this.isPlatformOwner(actorId))) {
        return { text: "Solo el owner de plataforma puede gestionar admins." };
      }
      if (command.kind === "platform-admin-list") {
        const roles = await this.platformRepository.listRoles();
        return {
          text:
            roles.length === 0
              ? "No hay roles de plataforma asignados."
              : `Roles:\n${roles
                  .map(
                    (role) =>
                      `${role.telegramUserId.toString()} - ${role.role}`,
                  )
                  .join("\n")}`,
        };
      }
      const target = await this.resolveTelegramUserTarget(command.target);
      if (!target) {
        return { text: "No pude resolver ese usuario." };
      }
      if (command.kind === "platform-admin-add") {
        await this.platformRepository.grantRole({
          telegramUserId: target,
          role: command.role,
          grantedByTelegramId: actorId,
        });
      } else {
        await this.platformRepository.revokeRole({
          telegramUserId: target,
          role: command.role,
        });
      }
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action:
          command.kind === "platform-admin-add"
            ? "platform.role.granted"
            : "platform.role.revoked",
        resourceType: "platform_role",
        resourceId: command.role,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { targetTelegramUserId: target.toString() },
      });
      return {
        text:
          command.kind === "platform-admin-add"
            ? `Rol ${command.role} concedido a ${target.toString()}.`
            : `Rol ${command.role} revocado a ${target.toString()}.`,
      };
    }

    return null;
  }

  private async handleManagedBotUpdate(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    managerBotUsername: string,
  ): Promise<BotReply | null> {
    const managed = update.managedBot;
    if (!managed) {
      return null;
    }
    if (!managed.ownerUserId || !managed.botUserId || !managed.username) {
      return { text: "Telegram envio un bot gestionado incompleto." };
    }

    const registration = await this.platformRepository.registerManagedBot({
      ownerTelegramId: managed.ownerUserId,
      botTelegramId: managed.botUserId,
      username: managed.username,
      displayName: managed.firstName ?? managed.username,
    });
    if (!registration.ok) {
      await this.tryNotify(
        managed.ownerUserId,
        "El bot se ha creado en Telegram, pero no tienes slots disponibles en Modryva. Canjea un código y vuelve a intentarlo.",
      );
      return null;
    }
    if (!registration.isNew && registration.bot.status === "active") {
      return update.chat.chatId
        ? { text: `Bot @${managed.username} ya estaba activo en Modryva.` }
        : null;
    }

    const tokenKey = this.env.MANAGED_BOT_TOKEN_KEY;
    const managedGateway = this
      .telegramGateway as unknown as TelegramManagedBotGateway;
    if (
      !tokenKey ||
      !managedGateway.getManagedBotToken ||
      !managedGateway.setWebhook
    ) {
      await this.platformRepository.markManagedBotFailed(
        managed.botUserId,
        "missing-managed-bot-token-key-or-gateway",
      );
      await this.tryNotify(
        managed.ownerUserId,
        "Tu bot fue detectado, pero falta configuración de plataforma para activarlo.",
      );
      return null;
    }

    try {
      const childToken = await managedGateway.getManagedBotToken({
        userId: managed.botUserId,
        token: this.env.TELEGRAM_BOT_TOKEN,
      });
      if (!childToken) {
        throw new Error("missing-child-token");
      }
      const secret = generateWebhookSecret();
      const configuredBaseUrl =
        this.env.TELEGRAM_WEBHOOK_BASE_URL ?? this.env.TELEGRAM_APP_URL;
      const baseUrl = readAppUrl(configuredBaseUrl);
      if (!baseUrl.startsWith("https://")) {
        throw new Error("managed-bot-webhook-url-must-be-https");
      }
      const webhookUrl = `${baseUrl.replace(/\/$/u, "")}/telegram/webhook/${managed.username}`;
      await managedGateway.setWebhook({
        token: childToken,
        url: webhookUrl,
        secretToken: secret,
        allowedUpdates: this.managedBotAllowedUpdates(),
      });
      await this.platformRepository.activateManagedBot({
        botTelegramId: managed.botUserId,
        encryptedToken: encryptManagedBotToken(childToken, tokenKey),
        tokenFingerprint: tokenFingerprint(childToken),
        webhookSecretHash: hashWebhookSecret(secret),
      });
      // Best-effort: give the child bot its own Mini App menu button (opened
      // with the child's token). The `?tgbot=` param makes the web app send
      // X-Bot-Username so the API verifies initData against this bot. Never let
      // a menu-button hiccup fail an otherwise successful activation.
      const publicAppUrl = readAppUrl(this.env.TELEGRAM_APP_URL);
      if (publicAppUrl.startsWith("https://")) {
        await this.telegramGateway
          .setChatMenuButton({
            url: `${publicAppUrl.replace(/\/$/u, "")}?tgbot=${encodeURIComponent(
              managed.username,
            )}`,
            text: "Panel",
            token: childToken,
          })
          .catch(() => {});
      }
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "platform.managed_bot.activated",
        resourceType: "managed_bot",
        resourceId: managed.botUserId.toString(),
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: {
          managerBotUsername,
          username: managed.username,
          ownerTelegramUserId: managed.ownerUserId.toString(),
        },
      });
      await this.tryNotify(
        managed.ownerUserId,
        `Tu bot @${managed.username} ya está activo. Añádelo a tu grupo y configúralo desde la Mini App.`,
      );
    } catch (error) {
      await this.platformRepository.markManagedBotFailed(
        managed.botUserId,
        error instanceof Error ? error.message : "unknown-error",
      );
      await this.tryNotify(
        managed.ownerUserId,
        `Tu bot @${managed.username} fue detectado, pero falló la activación. Lo revisaremos.`,
      );
    }

    return update.chat.chatId
      ? { text: `Bot @${managed.username} registrado en Modryva.` }
      : null;
  }

  private async isPlatformOwner(userId: bigint): Promise<boolean> {
    return (
      this.env.SUPERBOT_OWNER_TELEGRAM_ID === userId ||
      (await this.platformRepository.hasRole(userId, "platform_owner"))
    );
  }

  private async hasPlatformAccess(
    userId: bigint,
    roles: readonly PlatformRoleName[],
  ): Promise<boolean> {
    if (await this.isPlatformOwner(userId)) {
      return true;
    }
    if (
      this.env.SUPERBOT_PLATFORM_ADMIN_TELEGRAM_IDS.some(
        (adminId) => adminId === userId,
      ) &&
      roles.some((role) => configuredPlatformAdminRoles.includes(role))
    ) {
      return true;
    }
    for (const role of roles) {
      if (await this.platformRepository.hasRole(userId, role)) {
        return true;
      }
    }
    return false;
  }

  private async platformBanBlock(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<{ reply: BotReply | null } | null> {
    const userId = update.user.userId;
    if (!userId || (await this.isPlatformOwner(userId))) {
      return null;
    }
    const ban = await this.platformRepository.getActivePlatformUserBan(userId);
    if (!ban) {
      return null;
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      ...(context.userId ? { actorId: context.userId } : {}),
      action: "platform.user_ban.blocked",
      resourceType: "platform_user",
      resourceId: userId.toString(),
      payload: {
        command: update.command?.name ?? null,
        kind: update.kind,
        chatId: update.chat.chatId?.toString() ?? null,
      },
    });

    if (update.botMembership?.added) {
      return { reply: { text: platformBanGroupNotice(ban) } };
    }

    const isInteractiveAttempt =
      update.command !== undefined ||
      update.kind === "callback_query" ||
      update.kind === "join_request" ||
      update.kind === "managed_bot" ||
      update.preCheckout !== undefined ||
      update.chat.chatType === "private";

    return {
      reply: isInteractiveAttempt ? { text: platformBanNotice(ban) } : null,
    };
  }

  private async handlePlatformUserBanCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const name = update.command?.name;
    if (
      name !== "banbotuser" &&
      name !== "unbanbotuser" &&
      name !== "botbans" &&
      name !== "checkbotban"
    ) {
      return null;
    }

    const actor = update.user.userId;
    // Antes miraba SOLO `SUPERBOT_OWNER_TELEGRAM_ID`, asi que el rol
    // `platform_owner` —que existe en la base de datos desde el principio y se
    // llama exactamente asi— no servia para lo unico que un owner de plataforma
    // esperaria poder hacer. Un rol que no concede lo que su nombre promete es
    // peor que no tenerlo: se concede creyendo que basta, y no basta.
    if (!actor || !(await this.isPlatformOwner(actor))) {
      return {
        text: "Solo el owner configurado puede gestionar baneos globales.",
      };
    }

    const args = update.command?.args ?? [];
    if (name === "botbans") {
      const bans = await this.platformRepository.listPlatformUserBans(50);
      if (bans.length === 0) {
        return { text: "No hay usuarios baneados de la plataforma." };
      }
      return {
        text: [
          "Usuarios baneados de Modryva:",
          ...bans.map(
            (ban) =>
              `- ${ban.telegramUserId.toString()} | ${ban.reason} | hasta ${ban.expiresAt ? formatPlatformBanDate(ban.expiresAt) : "permanente"}`,
          ),
        ].join("\n"),
      };
    }

    const target = parseTelegramUserIdArg(args[0]);
    if (!target) {
      return {
        text:
          name === "unbanbotuser"
            ? "Uso: /unbanbotuser <telegram_id>"
            : name === "checkbotban"
              ? "Uso: /checkbotban <telegram_id>"
              : PLATFORM_BAN_USAGE,
      };
    }
    if (await this.isPlatformOwner(target)) {
      return { text: "No puedes banear al owner configurado." };
    }

    if (name === "unbanbotuser") {
      const revoked =
        await this.platformRepository.revokePlatformUserBan(target);
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        ...(context.userId ? { actorId: context.userId } : {}),
        action: "platform.user_ban.revoked",
        resourceType: "platform_user",
        resourceId: target.toString(),
        payload: { revoked },
      });
      return {
        text: revoked
          ? `Usuario ${target.toString()} desbloqueado de Modryva.`
          : `Usuario ${target.toString()} no tenia un ban activo.`,
      };
    }

    if (name === "checkbotban") {
      const ban =
        await this.platformRepository.getActivePlatformUserBan(target);
      return {
        text: ban
          ? platformBanNotice(ban)
          : `Usuario ${target.toString()} no tiene ban activo.`,
      };
    }

    const durationMs = parseCompactDuration(args[1]);
    const reasonArgs = durationMs === null ? args.slice(1) : args.slice(2);
    const reason =
      reasonArgs.join(" ").trim().slice(0, 500) || "Sin motivo especificado";
    const expiresAt =
      durationMs === null ? undefined : new Date(Date.now() + durationMs);
    const ban = await this.platformRepository.banPlatformUser({
      telegramUserId: target,
      reason,
      bannedByTelegramId: actor as bigint,
      expiresAt,
    });
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      ...(context.userId ? { actorId: context.userId } : {}),
      action: "platform.user_ban.created",
      resourceType: "platform_user",
      resourceId: target.toString(),
      payload: {
        reason,
        expiresAt: expiresAt?.toISOString() ?? null,
      },
    });
    return {
      text: [
        `Usuario ${target.toString()} baneado de Modryva.`,
        "",
        platformBanNotice(ban),
      ].join("\n"),
    };
  }

  private async resolveTelegramUserTarget(
    target: string,
  ): Promise<bigint | undefined> {
    if (/^\d+$/u.test(target)) {
      return BigInt(target);
    }
    if (target.startsWith("@") && target.length > 1) {
      return this.repository.findTelegramUserIdByUsername(target.slice(1));
    }
    return undefined;
  }

  private buildManagedBotCreateLink(ownerTelegramId: bigint): string {
    const manager = this.env.TELEGRAM_BOT_USERNAME.replace(/^@/u, "");
    const suffix = ownerTelegramId.toString().slice(-8);
    const suggestedUsername = `super_${suffix}_bot`;
    const name = encodeURIComponent("Mi Bot");
    return `https://t.me/newbot/${manager}/${suggestedUsername}?name=${name}`;
  }

  private async tryNotifyCustomBotGrant(userId: bigint): Promise<boolean> {
    return this.tryNotify(
      userId,
      "Te han dado acceso para crear tu bot personalizado. Usa /createbot para empezar.",
    );
  }

  private async tryNotify(userId: bigint, text: string): Promise<boolean> {
    try {
      const result = await this.telegramGateway.sendMessage({
        chatId: userId,
        reply: { text },
        token: this.env.TELEGRAM_BOT_TOKEN,
      });
      return result.ok;
    } catch {
      return false;
    }
  }

  private managedBotAllowedUpdates(): readonly string[] {
    // Single source of truth (@superbot/shared): a managed bot must opt into the
    // exact same updates as the primary poller, message_reaction included — this
    // method previously omitted it, so a freshly activated child bot never
    // received reactions to moderate.
    return TELEGRAM_ALLOWED_UPDATES;
  }

  private async handlePaymentCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parsePaymentCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId || !update.chat.chatId) {
      return { text: "Los pagos se gestionan dentro de un grupo." };
    }

    const command = result.command;

    if (command.kind === "list") {
      const products = await this.paymentRepository.listProducts(
        context.tenantId,
      );
      if (products.length === 0) {
        return {
          text: "No hay productos. Un admin puede crearlos con /addproduct.",
        };
      }
      const lines = products.map(
        (product) =>
          `${product.productId} — ${product.title} (${product.amount} ${product.currency})`,
      );
      return { text: `Productos:\n${lines.join("\n")}` };
    }

    if (command.kind === "add") {
      const permission = await this.ensureConfigPermission(
        context,
        update,
        "payments.config",
      );
      if (!permission.allowed) {
        return {
          text: `No tienes permisos para crear productos.`,
        };
      }
      const product = await this.paymentRepository.upsertProduct(
        context.tenantId,
        context.chatId,
        command.productId,
        command.title,
        command.amount,
        "XTR",
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "payment.product.created",
        resourceType: "product",
        resourceId: product.productId,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { amount: product.amount },
      });
      return {
        text: `Producto "${product.title}" guardado (${product.amount} ${product.currency}).`,
      };
    }

    // Buy: create an invoice and send it through the Telegram Gateway.
    if (!update.user.userId) {
      return { text: "No puedo identificarte." };
    }
    const product = await this.paymentRepository.getProduct(
      context.tenantId,
      command.productId,
    );
    if (!product) {
      return { text: "Producto no encontrado." };
    }

    const payload = buildInvoicePayload(product.productId, update.user.userId);
    await this.paymentRepository.createInvoice({
      tenantId: context.tenantId,
      chatId: context.chatId,
      productId: product.productId,
      telegramUserId: update.user.userId,
      payload,
      amount: product.amount,
      currency: product.currency,
    });

    try {
      await this.telegramGateway.sendInvoice({
        chatId: update.chat.chatId,
        title: product.title,
        description: `Compra de ${product.title}`,
        payload,
        currency: product.currency,
        amount: product.amount,
        token: this.telegramToken(),
      });
    } catch {
      // Invoice delivery failures never lose the invoice record.
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "payment.invoice.created",
      resourceType: "invoice",
      resourceId: product.productId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { amount: product.amount },
    });

    return { text: `Factura enviada para "${product.title}".` };
  }

  private async handlePreCheckout(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const preCheckout = update.preCheckout;

    if (!preCheckout) {
      return null;
    }

    // Casino chip packs: approve when the pack exists and the Star price matches.
    if (preCheckout.payload.startsWith("chips:")) {
      const packId = preCheckout.payload.split(":")[1] ?? "";
      const pack = CHIP_PACKS[packId];
      const ok = Boolean(pack) && pack?.stars === preCheckout.totalAmount;
      try {
        await this.telegramGateway.answerPreCheckoutQuery({
          preCheckoutQueryId: preCheckout.id,
          ok,
          errorMessage: ok ? undefined : "Pack no disponible.",
          token: this.telegramToken(),
        });
      } catch {
        // Answer failures are surfaced through audit only.
      }
      return null;
    }

    const parsed = parseInvoicePayload(preCheckout.payload);
    const product = parsed
      ? await this.paymentRepository.getProduct(
          context.tenantId,
          parsed.productId,
        )
      : null;
    const approve =
      Boolean(product) && product?.amount === preCheckout.totalAmount;

    try {
      await this.telegramGateway.answerPreCheckoutQuery({
        preCheckoutQueryId: preCheckout.id,
        ok: approve,
        errorMessage: approve ? undefined : "Producto no disponible.",
        token: this.telegramToken(),
      });
    } catch {
      // Answer failures are surfaced through audit only.
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "system",
      action: "payment.precheckout.answered",
      resourceType: "pre_checkout",
      resourceId: preCheckout.id,
      payload: { approved: approve },
    });

    // Pre-checkout has no chat to reply to; the gateway call is the response.
    return null;
  }

  private async handleSuccessfulPayment(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const payment = update.successfulPayment;

    if (!payment || !context.chatId || !update.user.userId) {
      return null;
    }

    // AI pack subscription (30 Stars/mo): fires on the initial charge AND on
    // every automatic monthly renewal Telegram sends by itself. The payload
    // encodes the target directly since successful_payment always arrives in
    // the payer's private chat with the bot, not the group being unlocked.
    if (payment.payload.startsWith("ai_pack:")) {
      const [, scopeRaw, targetRaw] = payment.payload.split(":");
      const scope: AiAccessScope | undefined =
        scopeRaw === "chat" || scopeRaw === "user" ? scopeRaw : undefined;
      const targetId = targetRaw ? BigInt(targetRaw) : undefined;
      if (!scope || targetId === undefined) {
        return null;
      }
      const periodEnd =
        payment.subscriptionExpirationDate ??
        new Date(Date.now() + AI_PACK_SUBSCRIPTION_PERIOD_SECONDS * 1000);
      await this.aiAccessRepository.recordSubscriptionPayment({
        scope,
        targetId,
        telegramUserId: update.user.userId,
        chargeId: payment.chargeId,
        periodEnd,
      });
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: payment.isFirstRecurring
          ? "ai_pack.subscribed"
          : "ai_pack.renewed",
        resourceType: "ai_subscription",
        resourceId: `${scope}:${targetId}`,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { scope, targetId: targetId.toString() },
      });
      return {
        text:
          scope === "chat"
            ? `✅ Pack de IA activo para este grupo hasta ${periodEnd.toISOString().slice(0, 10)}.`
            : `✅ Pack de IA personal activo hasta ${periodEnd.toISOString().slice(0, 10)}. Podrás usar la IA en cualquier chat.`,
      };
    }

    // Casino chip packs: credit chips exactly once (idempotent on chargeId).
    if (payment.payload.startsWith("chips:")) {
      const packId = payment.payload.split(":")[1] ?? "";
      const pack = CHIP_PACKS[packId];
      if (!pack) {
        return null;
      }
      const credited = await this.chipRepository.creditPurchase(
        context.tenantId,
        update.user.userId,
        payment.chargeId,
        pack.chips,
      );
      return credited.ok
        ? {
            parseMode: "Markdown",
            text: `✅ *+${pack.chips} fichas* añadidas. ¡Gracias! Saldo: *${credited.balance}* 🪙`,
          }
        : null;
    }

    const parsed = parseInvoicePayload(payment.payload);
    const result = await this.paymentRepository.recordPayment({
      tenantId: context.tenantId,
      chatId: context.chatId,
      telegramUserId: update.user.userId,
      productId: parsed?.productId ?? "unknown",
      chargeId: payment.chargeId,
      amount: payment.totalAmount,
      currency: payment.currency,
    });

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: result.duplicate ? "payment.duplicate" : "payment.recorded",
      resourceType: "payment",
      resourceId: payment.chargeId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        amount: payment.totalAmount,
        currency: payment.currency,
        duplicate: result.duplicate,
      },
    });

    return result.duplicate
      ? null
      : {
          text: `¡Pago recibido! Gracias por tu compra (${payment.totalAmount} ${payment.currency}).`,
        };
  }

  /**
   * Per-chat AI degradation tracker (in-memory, per-process, NOT persisted —
   * reset on redeploy, same as AiRouter's own per-provider breaker). Lives
   * ABOVE AiRouter's global circuit breaker: that one protects a single
   * backend call across ALL chats; this one is per (tenantId, chatId) and
   * purely advisory, so /ai, DM auto-chat and mention-chat can show a
   * friendlier formatDegradedNotice and skip a doomed attempt instead of
   * repeating the same generic error on every message during an outage.
   * `budgetExceeded` is intentionally never set here: the per-chat token
   * budget is a separate, DB-backed, EXACT check that already runs earlier
   * in each handler and returns its own message — duplicating it here with
   * an in-memory approximation would only add risk.
   */
  private readonly aiDegradedState = new Map<string, DegradedState>();

  private aiDegradedKey(tenantId: string, chatId: string): string {
    return `${tenantId}:${chatId}`;
  }

  private getAiDegradedState(tenantId: string, chatId: string): DegradedState {
    return (
      this.aiDegradedState.get(this.aiDegradedKey(tenantId, chatId)) ?? {
        consecutiveFailures: 0,
        lastFailureMs: 0,
        budgetExceeded: false,
      }
    );
  }

  private recordAiSuccess(tenantId: string, chatId: string): void {
    this.aiDegradedState.delete(this.aiDegradedKey(tenantId, chatId));
  }

  private recordAiFailure(
    tenantId: string,
    chatId: string,
    nowMs: number,
  ): DegradedModeDecision {
    const prior = this.getAiDegradedState(tenantId, chatId);
    const next: DegradedState = {
      consecutiveFailures: prior.consecutiveFailures + 1,
      lastFailureMs: nowMs,
      budgetExceeded: false,
    };
    this.aiDegradedState.set(this.aiDegradedKey(tenantId, chatId), next);
    return decideDegradedMode(next, nowMs);
  }

  private async handleAiCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.command?.name === "aistatus" ||
      update.command?.name === "aiproviders"
    ) {
      if (
        !this.env.SUPERBOT_OWNER_TELEGRAM_ID ||
        update.user.userId !== this.env.SUPERBOT_OWNER_TELEGRAM_ID
      ) {
        return { text: "Solo el owner puede consultar el estado de IA." };
      }
      return { text: await this.renderAiStatus() };
    }

    if (update.command?.name === "aitest") {
      if (
        !this.env.SUPERBOT_OWNER_TELEGRAM_ID ||
        update.user.userId !== this.env.SUPERBOT_OWNER_TELEGRAM_ID
      ) {
        return { text: "Solo el owner puede probar proveedores IA." };
      }
      try {
        const completion = await this.aiProvider.complete(
          buildAiMessages({ kind: "chat", prompt: "Responde solo: ok" }),
          {
            task: "fast_chat",
            maxTokens: 32,
            ...(update.user.userId
              ? { userId: update.user.userId.toString() }
              : {}),
            ...(context.chatId ? { chatId: context.chatId } : {}),
            tenantId: context.tenantId,
          },
        );
        return {
          text: `IA OK · ${completion.provider} · ${completion.model ?? "modelo local"}`,
        };
      } catch {
        return { text: "IA no disponible ahora mismo." };
      }
    }

    if (update.command?.name === "aiforget") {
      if (context.chatId && update.user.userId) {
        await this.aiRepository.clearConversation(
          context.chatId,
          update.user.userId,
        );
      }
      return { text: "Memoria de IA borrada para esta conversación." };
    }

    if (update.command?.name === "memoria") {
      return this.handleMemoriaCommand(context, update);
    }

    if (update.command?.name === "olvida") {
      return this.handleOlvidaCommand(context, update);
    }

    if (update.command?.name === "olvidatodo") {
      return this.handleOlvidatodoCommand(context, update);
    }

    if (update.command?.name === "aicode") {
      return this.handleAiCodeRedemption(update);
    }

    if (update.command?.name === "aipack") {
      return this.handleAiPackCommand(context, update);
    }

    const result = parseAiCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId || !update.user.userId) {
      return { text: "La IA se usa dentro de un grupo." };
    }

    if (!this.env.AI_ENABLED) {
      return { text: "La IA está desactivada ahora mismo." };
    }

    const accessBlock = await this.requireAiAccess(update);
    if (accessBlock) {
      return accessBlock;
    }

    // Per-chat token budget; AI never blocks moderation/payments and degrades
    // gracefully when exhausted.
    const AI_TOKEN_BUDGET = 2_000_000;
    const used = await this.aiRepository.usageTokens(
      context.tenantId,
      context.chatId,
    );
    if (used >= AI_TOKEN_BUDGET) {
      return { text: "Se ha agotado el presupuesto de IA de este chat." };
    }

    const aiDegradedCheck = decideDegradedMode(
      this.getAiDegradedState(context.tenantId, context.chatId),
      Date.now(),
    );
    if (aiDegradedCheck.degraded) {
      return { text: formatDegradedNotice(aiDegradedCheck.reason) };
    }

    const command = result.command;
    const rawInput =
      command.kind === "chat"
        ? command.prompt
        : command.kind === "summarize"
          ? command.text
          : command.text;
    const sanitized = sanitizeAiInput(
      rawInput,
      this.env.AI_MAX_INPUT_CHARS,
      this.env.AI_PRIVACY_MODE,
    );

    if (sanitized.flagged) {
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "system",
        action: "ai.input.blocked",
        resourceType: "ai",
        resourceId: context.chatId,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { kind: command.kind },
      });
      return {
        text: "Tu mensaje fue bloqueado por seguridad (posible inyección de prompt).",
      };
    }

    // Use the SANITIZED text (secrets/PII redacted) to build the provider
    // messages, not the raw command — otherwise redaction never reaches the AI.
    const safeCommand =
      command.kind === "chat"
        ? { ...command, prompt: sanitized.text }
        : { ...command, text: sanitized.text };

    const rawHistory =
      command.kind === "chat"
        ? await this.aiRepository.getRecentHistory(
            context.chatId,
            update.user.userId,
          )
        : [];
    const history = rawHistory.map((entry) => ({
      role:
        entry.role === "assistant"
          ? ("assistant" as const)
          : entry.role === "system"
            ? ("system" as const)
            : ("user" as const),
      content: entry.content,
    }));
    const messages = buildAiMessages(safeCommand, history, {
      isCreator: update.user.userId === CREATOR_TELEGRAM_ID,
    });
    this.addAiMemoryHint(
      messages,
      await this.buildAiMemoryHint(context, update),
    );
    const task =
      command.kind === "chat"
        ? "fast_chat"
        : command.kind === "summarize"
          ? "summarize_short"
          : "translate";

    if (this.env.TELEGRAM_AI_USE_SEND_CHAT_ACTION && update.chat.chatId) {
      try {
        await this.telegramGateway.sendChatAction({
          chatId: update.chat.chatId,
          action: "typing",
          token: this.telegramToken(),
        });
      } catch {
        // Chat actions are best-effort only.
      }
    }

    let completion: Awaited<ReturnType<AiProvider["complete"]>>;
    try {
      completion = await this.aiProvider.complete(messages, {
        maxTokens: Math.min(this.env.AI_MAX_TOKENS_PER_REQUEST, 512),
        task,
        userId: update.user.userId.toString(),
        chatId: context.chatId,
        tenantId: context.tenantId,
        // Chat wants variety — at the default 0.3 an 8B model just parrots the
        // most-probable example line from the persona prompt, so similar
        // questions get the identical catchphrase every time. Summaries and
        // translations keep the low-temperature default (fidelity, not flair).
        ...(command.kind === "chat" ? { temperature: 0.85 } : {}),
        ...(command.kind === "translate"
          ? { cacheKeyParts: [command.language] }
          : {}),
      });
      this.recordAiSuccess(context.tenantId, context.chatId);
    } catch {
      const decision = this.recordAiFailure(
        context.tenantId,
        context.chatId,
        Date.now(),
      );
      return {
        text: decision.degraded
          ? formatDegradedNotice(decision.reason)
          : "El servicio de IA no está disponible ahora mismo. Inténtalo más tarde.",
      };
    }

    await this.aiRepository.recordTurn({
      tenantId: context.tenantId,
      chatId: context.chatId,
      telegramUserId: update.user.userId,
      provider: completion.provider,
      userContent: sanitized.text,
      assistantContent: completion.text,
      tokensIn: completion.tokensIn,
      tokensOut: completion.tokensOut,
    });
    if (command.kind === "chat") {
      await this.rememberAiFacts(context, update, sanitized.text);
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "ai.completion",
      resourceType: "ai",
      resourceId: context.chatId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        kind: command.kind,
        provider: completion.provider,
        tokensIn: completion.tokensIn,
        tokensOut: completion.tokensOut,
      },
    });

    return { text: completion.text };
  }

  /**
   * Second, per-chat gate on top of the global AI_ENABLED switch: real AI usage
   * (commands, DM chat, mentions) is blocked in any chat that hasn't redeemed an
   * access code, so leaving AI on doesn't let every chat drain the shared quota.
   * Codes are generated by the owner in /platform and redeemed with /aicode.
   */
  /**
   * Access is granted if EITHER the chat itself has a grant (code or group
   * subscription) OR the specific user speaking has a personal grant (bought
   * from their DM with the bot) — a personal grant follows that user into any
   * chat, even ones without their own code/subscription.
   */
  private async requireAiAccess(
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const chatId = update.chat.chatId;
    if (!chatId) {
      return { text: "La IA se usa dentro de un chat." };
    }
    const [chatAccess, userAccess] = await Promise.all([
      this.aiAccessRepository.hasAccess(chatId),
      update.user.userId
        ? this.aiAccessRepository.hasUserAccess(update.user.userId)
        : Promise.resolve(false),
    ]);
    if (chatAccess || userAccess) {
      return null;
    }
    return {
      text: "Este chat no tiene acceso a la IA todavía. Pide un código al creador del bot, canjéalo con /aicode <código>, o consigue el pack de IA (30 ⭐/mes) desde la Mini App.",
    };
  }

  private async handleAiCodeRedemption(
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply> {
    const chatId = update.chat.chatId;
    if (!chatId) {
      return { text: "Usa /aicode dentro de un chat (grupo o privado)." };
    }
    const code = update.command?.args[0];
    if (!code) {
      return { text: "Uso: /aicode <código>" };
    }

    const result = await this.aiAccessRepository.redeemCode(chatId, code);
    if (!result.ok) {
      const reason =
        result.reason === "already-used"
          ? "ese código ya se usó"
          : "código no válido";
      return { text: `No se pudo canjear el código: ${reason}.` };
    }

    const days = Math.max(
      1,
      Math.round((result.expiresAt.getTime() - Date.now()) / 86_400_000),
    );
    return {
      text: `Código canjeado. Este chat tiene acceso a la IA durante ${days} día(s), hasta ${result.expiresAt.toISOString().slice(0, 10)}.`,
    };
  }

  /**
   * `/aipack` shows the status of the AI pack Stars subscription for this
   * scope (chat if used in a group, personal if used in DM) and, with
   * `/aipack cancelar`, stops future renewals — group cancellation requires an
   * admin. Buying the pack itself only happens from the Mini App.
   */
  private async handleAiPackCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply> {
    const chatId = update.chat.chatId;
    if (!chatId) {
      return { text: "Usa /aipack dentro de un chat." };
    }

    const isGroup =
      update.chat.chatType === "group" || update.chat.chatType === "supergroup";
    const scope: AiAccessScope = isGroup ? "chat" : "user";
    const targetId = isGroup ? chatId : update.user.userId;
    if (!targetId) {
      return { text: "No puedo identificarte." };
    }

    const wantsCancel = update.command?.args[0]?.toLowerCase() === "cancelar";

    if (wantsCancel && isGroup && !(await this.isActorAdmin(context, update))) {
      return { text: "Solo un admin del grupo puede cancelar el pack de IA." };
    }

    const sub = await this.aiAccessRepository.getSubscription(scope, targetId);
    if (!sub) {
      return {
        text: "No hay ninguna suscripción de IA activa aquí. Consíguela desde el apartado de IA en la Mini App.",
      };
    }

    if (!wantsCancel) {
      const until = sub.currentPeriodEnd.toISOString().slice(0, 10);
      return {
        text: sub.canceled
          ? `Pack de IA cancelado, activo hasta ${until} (no se renovará).`
          : `Pack de IA activo, se renueva automáticamente el ${until}. Usa /aipack cancelar para detener la renovación.`,
      };
    }

    if (sub.canceled) {
      return {
        text: `Ya estaba cancelado; seguirá activo hasta ${sub.currentPeriodEnd.toISOString().slice(0, 10)}.`,
      };
    }

    const canceled = await this.aiAccessRepository.cancelSubscription(
      scope,
      targetId,
    );
    if (!canceled.ok) {
      return { text: "No se pudo cancelar el pack de IA." };
    }

    try {
      await this.telegramGateway.editUserStarSubscription({
        userId: canceled.telegramUserId,
        telegramPaymentChargeId: canceled.lastChargeId,
        isCanceled: true,
        token: this.telegramToken(),
      });
    } catch {
      // Our own record is already marked canceled; Telegram's side is best-effort.
    }

    return {
      text: `Pack de IA cancelado. Seguirá activo hasta ${sub.currentPeriodEnd.toISOString().slice(0, 10)}, luego no se renovará.`,
    };
  }

  private async renderAiStatus(): Promise<string> {
    const groqKeys = [
      this.env.AI_GROQ_API_KEY_1,
      this.env.AI_GROQ_API_KEY_2,
      this.env.AI_GROQ_API_KEY_3,
      this.env.AI_GROQ_API_KEY_4,
      this.env.AI_GROQ_API_KEY_5,
      ...(this.env.AI_GROQ_API_KEYS ?? "")
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean),
    ].filter(Boolean).length;
    const geminiKeys = [
      this.env.AI_GEMINI_PROJECT_1_API_KEY,
      this.env.AI_GEMINI_PROJECT_2_API_KEY,
      this.env.AI_GEMINI_PROJECT_3_API_KEY,
      this.env.AI_GEMINI_PROJECT_4_API_KEY,
      this.env.AI_GEMINI_PROJECT_5_API_KEY,
      ...(this.env.AI_GEMINI_API_KEYS ?? "")
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean),
    ].filter(Boolean).length;

    let guestSupportLine = "supports_guest_queries: desconocido (getMe falló)";
    try {
      const me = await this.telegramGateway.getMe({
        token: this.telegramToken(),
      });
      guestSupportLine =
        me.supportsGuestQueries === undefined
          ? "supports_guest_queries: no reportado por Telegram"
          : `supports_guest_queries: ${me.supportsGuestQueries ? "sí" : "no"}`;
    } catch {
      // Best-effort only: /aistatus must never fail because getMe is down.
    }

    return [
      "IA Modryva",
      "",
      `IA: ${this.env.AI_ENABLED ? "ON" : "OFF"}`,
      `Inline expected: ${this.env.TELEGRAM_AI_INLINE_MODE_EXPECTED ? "ON" : "OFF"}`,
      `Inline cache: ${this.env.AI_INLINE_CACHE_TTL_SECONDS}s`,
      `Inline direct AI: ${this.env.AI_INLINE_USE_AI_DIRECTLY ? "ON" : "OFF"}`,
      `Guest expected: ${this.env.TELEGRAM_AI_GUEST_MODE_EXPECTED ? "ON" : "OFF"}`,
      guestSupportLine,
      "",
      `Groq: ${this.env.AI_GROQ_ENABLED ? `${groqKeys} keys` : "off"} · modelo ${this.env.AI_GROQ_MODEL}`,
      `Gemini: ${this.env.AI_GEMINI_ENABLED ? `${geminiKeys} proyectos` : "off"} · modelo ${this.env.AI_GEMINI_MODEL}`,
      `OpenRouter: modelo ${this.env.AI_OPENROUTER_MODEL} (${this.env.AI_OPENROUTER_ENABLED ? "ON" : "off"})`,
      "",
      `Privacy mode: ${this.env.AI_PRIVACY_MODE}`,
      `Cache: ${this.env.AI_CACHE_TTL_SECONDS > 0 ? "ON" : "OFF"}`,
    ].join("\n");
  }

  private async buildAiMemoryHint(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<string | undefined> {
    const memories = await this.aiRepository.getMemories({
      tenantId: context.tenantId,
      ...(context.chatId ? { chatId: context.chatId } : {}),
      ...(update.user.userId ? { telegramUserId: update.user.userId } : {}),
    });

    return buildAiMemorySystemHint({
      ...(update.user.userId ? { userId: update.user.userId.toString() } : {}),
      ...(update.user.username ? { username: update.user.username } : {}),
      ...(update.user.firstName ? { firstName: update.user.firstName } : {}),
      ...(update.user.languageCode
        ? { languageCode: update.user.languageCode }
        : {}),
      ...(context.chatId ? { chatId: context.chatId } : {}),
      ...(update.chat.chatTitle ? { chatTitle: update.chat.chatTitle } : {}),
      ...(update.chat.chatType ? { chatType: update.chat.chatType } : {}),
      facts: memories.map((memory) => ({
        scope: memory.scope,
        key: memory.key,
        value: memory.value,
      })),
    });
  }

  private addAiMemoryHint(
    messages: { role: "system" | "user" | "assistant"; content: string }[],
    hint: string | undefined,
  ): void {
    if (hint) {
      messages.splice(1, 0, { role: "system", content: hint });
    }
  }

  private async rememberAiFacts(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    text: string,
  ): Promise<void> {
    if (!this.env.AI_ENABLED) {
      return;
    }

    const facts = extractAiMemoryFacts(text);
    for (const fact of facts) {
      await this.aiRepository.upsertMemory({
        tenantId: context.tenantId,
        scope: fact.scope,
        key: fact.key,
        value: fact.value,
        source: "user",
        confidence: 0.85,
        ...(context.chatId ? { chatId: context.chatId } : {}),
        ...(update.user.userId ? { telegramUserId: update.user.userId } : {}),
      });
    }
  }

  private async handleQuizCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseQuizCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "Los quizzes se crean dentro de un grupo." };
    }

    const { question, options } = result.command;
    const [correct, ...wrong] = options;
    const seed = update.updateId + (Number(update.user.userId ?? 0n) % 100);
    const ordered = orderQuizOptions(correct ?? "", wrong, seed);

    const session = await this.gameRepository.createSession(
      context.tenantId,
      context.chatId,
      "quiz",
      { question, options: ordered.options },
      ordered.correctIndex,
    );

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "game.quiz.started",
      resourceType: "game_session",
      resourceId: session.id,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { options: ordered.options.length },
    });

    return {
      text: `❓ ${question}`,
      replyMarkup: {
        inline_keyboard: ordered.options.map((option, optionIndex) => [
          { text: option, callback_data: `quiz:${session.id}:${optionIndex}` },
        ]),
      },
    };
  }

  /**
   * QuizBot-style leaderboard: /quizscores (aliases /quiztop, /trivialeaderboard)
   * shows the top game scorers of the chat.
   */
  private async handleQuizScores(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (!isQuizScoresCommand(update.command?.name)) {
      return null;
    }

    if (!context.chatId) {
      return { text: "La clasificación se mide dentro de un grupo." };
    }

    const top = await this.gameRepository.topScores(context.chatId, 10);
    return { text: formatQuizLeaderboard(top), parseMode: "Markdown" };
  }

  private async handleQuizAnswer(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const answer = parseQuizAnswer(update.callbackData);

    if (!answer) {
      return null;
    }

    if (!update.user.userId) {
      return { text: "No puedo identificarte." };
    }

    const session = await this.gameRepository.getSession(answer.sessionId);
    if (session?.status !== "open" || session.kind !== "quiz") {
      return { text: "Este quiz ya no está activo." };
    }

    if (!isQuizCorrect(session.correctIndex, answer.optionIndex)) {
      return { text: "Respuesta incorrecta." };
    }

    const won = await this.gameRepository.closeWithWinner(
      session.id,
      update.user.userId,
    );
    if (!won) {
      return { text: "Alguien respondió correctamente antes que tú." };
    }

    if (context.chatId) {
      await this.gameRepository.addScore(
        context.tenantId,
        context.chatId,
        update.user.userId,
        1,
      );
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "game.quiz.won",
      resourceType: "game_session",
      resourceId: session.id,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { telegramUserId: update.user.userId.toString() },
    });

    return {
      text: `🎯 ¡Correcto! ${describeUser(update.user)} suma un punto.`,
    };
  }

  private async handleTriviaCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseTriviaCommand(update);

    if (!result) {
      return null;
    }

    if (!context.chatId) {
      return { text: "La trivia se juega dentro de un grupo." };
    }

    const index = pickQuestionIndex(
      update.updateId + (Number(update.user.userId ?? 0n) % 100),
      TRIVIA_QUESTIONS.length,
    );
    const question = TRIVIA_QUESTIONS[index];
    if (!question) {
      return { text: "No hay preguntas disponibles." };
    }

    const session = await this.gameRepository.createSession(
      context.tenantId,
      context.chatId,
      "trivia",
      { question: question.question, options: question.options },
      question.correctIndex,
    );

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "game.trivia.started",
      resourceType: "game_session",
      resourceId: session.id,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { questionIndex: index },
    });

    return {
      text: `🧠 Trivia: ${question.question}`,
      replyMarkup: {
        inline_keyboard: question.options.map((option, optionIndex) => [
          {
            text: option,
            callback_data: `trivia:${session.id}:${optionIndex}`,
          },
        ]),
      },
    };
  }

  private async handleTriviaAnswer(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const answer = parseTriviaAnswer(update.callbackData);

    if (!answer) {
      return null;
    }

    if (!update.user.userId) {
      return { text: "No puedo identificarte." };
    }

    const session = await this.gameRepository.getSession(answer.sessionId);
    if (session?.status !== "open") {
      return { text: "Esta trivia ya no está activa." };
    }

    const correct = isCorrectAnswer(
      { question: "", options: [], correctIndex: session.correctIndex },
      answer.optionIndex,
    );

    if (!correct) {
      return { text: "Respuesta incorrecta. ¡Sigue intentando!" };
    }

    // Only the first correct answer closes the session and scores.
    const won = await this.gameRepository.closeWithWinner(
      session.id,
      update.user.userId,
    );

    if (!won) {
      return { text: "Alguien respondió correctamente antes que tú." };
    }

    if (context.chatId) {
      await this.gameRepository.addScore(
        context.tenantId,
        context.chatId,
        update.user.userId,
        1,
      );
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "game.trivia.won",
      resourceType: "game_session",
      resourceId: session.id,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { telegramUserId: update.user.userId.toString() },
    });

    return {
      text: `🏆 ¡Correcto! ${describeUser(update.user)} gana el punto.`,
    };
  }

  private async handleFilesCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseFilesCommand(update);

    if (!result) {
      return null;
    }

    if (!context.chatId) {
      return { text: "Los archivos se gestionan dentro de un grupo." };
    }

    if (result.command.kind === "quota") {
      const used = await this.fileRepository.quotaUsageBytes(
        context.tenantId,
        context.chatId,
      );
      const mb = (used / (1024 * 1024)).toFixed(2);
      return { text: `Uso de almacenamiento del chat: ${mb} MB.` };
    }

    const files = await this.fileRepository.listFiles(
      context.tenantId,
      context.chatId,
    );
    if (files.length === 0) {
      return {
        text: "No hay archivos registrados. Usa /file para subir uno. Usa /file para subir uno.",
      };
    }
    const lines = files.map(
      (file) =>
        `${file.kind} ${file.fileName ?? file.fileUniqueId} (${file.fileSize} B)`,
    );
    return { text: `Archivos recientes:\n${lines.join("\n")}` };
  }

  private async handleAttachment(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const attachment = update.attachment;

    if (!attachment || !context.chatId || !update.user.userId) {
      return null;
    }

    const validation = validateAttachment(attachment, defaultFilePolicy);
    if (!validation.ok) {
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "system",
        action: "file.rejected",
        resourceType: "file_asset",
        resourceId: attachment.fileUniqueId,
        payload: { reason: validation.reason, kind: attachment.kind },
      });
      return {
        text: `Archivo rechazado (${validation.reason}).`,
      };
    }

    const result = await this.fileRepository.recordFile({
      tenantId: context.tenantId,
      chatId: context.chatId,
      telegramUserId: update.user.userId,
      fileUniqueId: attachment.fileUniqueId,
      fileId: attachment.fileId,
      kind: attachment.kind,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      fileName: attachment.fileName,
    });

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: result.deduped ? "file.deduplicated" : "file.recorded",
      resourceType: "file_asset",
      resourceId: result.fileAssetId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { kind: attachment.kind, deduped: result.deduped },
    });

    // Silent on success to avoid noise; dedup is also silent.
    return null;
  }

  private async emitD1Log(input: {
    context: FoundationContext;
    chatId: string | undefined;
    kind: string;
    title: string;
    body: string | undefined;
    replyMarkup?: Record<string, unknown>;
  }): Promise<void> {
    await this.d1Repository.recordEvent({
      tenantId: input.context.tenantId,
      chatId: input.chatId,
      kind: input.kind,
      title: input.title,
      body: input.body,
    });

    if (input.chatId) {
      const routed = await this.emitOwnerNetworkRoute({
        context: input.context,
        sourceChatId: input.chatId,
        eventKind: this.routeEventForD1Kind(input.kind),
        fallbackEventKind: "logs",
        title: input.title,
        body: input.body,
        ...(input.replyMarkup ? { replyMarkup: input.replyMarkup } : {}),
      });
      if (routed) {
        return;
      }
    }

    const configured = input.chatId
      ? await this.d1Repository.getLogConfig(input.chatId)
      : null;
    const target =
      configured?.logTelegramChatId ??
      (await this.d1Repository.findAnyLogChannel(input.context.tenantId));

    if (!target) {
      return;
    }

    try {
      await this.telegramGateway.sendMessage({
        chatId: target,
        token: this.telegramToken(),
        reply: {
          text: input.body ? `${input.title}\n\n${input.body}` : input.title,
          ...(input.replyMarkup ? { replyMarkup: input.replyMarkup } : {}),
        },
      });
    } catch {
      // D1 logs should never block the original user action.
    }
  }

  /** The owner-network a chat belongs to, or null if it isn't in one. */
  private async resolveFedId(
    chatId: string | undefined,
  ): Promise<string | null> {
    if (!chatId) {
      return null;
    }
    try {
      const fed = await this.federationRepository.getFederationForChat(chatId);
      return fed?.fedId ?? null;
    } catch {
      return null;
    }
  }

  /**
   * D5 (anti-spam por red): feeds a signal into the user's cross-network risk
   * profile. Never blocks the original moderation action on failure.
   */
  private async recordRiskSignal(
    context: FoundationContext,
    telegramUserId: bigint | undefined,
    signal: "deleted" | "report" | "quarantine" | "link" | "sanction",
  ): Promise<void> {
    if (!telegramUserId || !context.chatId) {
      return;
    }
    try {
      const fedId = await this.resolveFedId(context.chatId);
      if (!fedId) {
        return;
      }
      await this.ownerNetworkRiskRepository.recordSignal(
        context.tenantId,
        fedId,
        telegramUserId,
        context.chatId,
        signal,
      );
    } catch {
      // Risk tracking is best-effort observability, never a gate.
    }
  }

  /**
   * D7 (onboarding/gamificación): marks a mission complete for the user's
   * network and awards the "network_verified" badge once all three are done.
   * completeMission is idempotent, so calling this on every matching event
   * (e.g. every message for "first_message") never double-counts.
   */
  private async progressGamification(
    context: FoundationContext,
    telegramUserId: bigint | undefined,
    kind: GamificationMissionKind,
  ): Promise<void> {
    if (!telegramUserId || !context.chatId) {
      return;
    }
    try {
      const fedId = await this.resolveFedId(context.chatId);
      if (!fedId) {
        return;
      }
      await this.gamificationRepository.ensureMissions(
        context.tenantId,
        fedId,
        telegramUserId,
      );
      const result = await this.gamificationRepository.completeMission(
        context.tenantId,
        fedId,
        telegramUserId,
        kind,
      );
      if (!result.completed) {
        return;
      }
      const missions = await this.gamificationRepository.listMissions(
        fedId,
        telegramUserId,
      );
      if (
        missions.length > 0 &&
        missions.every((m) => m.completedAt !== null)
      ) {
        await this.gamificationRepository.awardBadge(
          context.tenantId,
          fedId,
          telegramUserId,
          "network_verified",
        );
      }
    } catch {
      // Gamification progress is best-effort, never a gate.
    }
  }

  /**
   * D9 (automatizaciones visuales): evaluates every enabled automation scoped
   * to this chat (or network-wide) against the event and runs the matched
   * action. This is a separate, MiniApp-first system from the existing /auto
   * chat-command automation — both coexist, /auto remains the fallback.
   */
  private async matchAndRunAutomations(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    event: AutomationEvent,
  ): Promise<void> {
    if (!context.chatId) {
      return;
    }
    try {
      const fedId = await this.resolveFedId(context.chatId);
      if (!fedId) {
        return;
      }
      const automations = await this.automationRepository.list(
        fedId,
        context.chatId,
      );
      for (const automation of automations) {
        if (automation.enabled && matchAutomation(automation, event)) {
          await this.executeAutomationAction(
            context,
            update,
            automation.action,
          );
        }
      }
    } catch {
      // Automations are best-effort, never a gate on the original update.
    }
  }

  private async runAutomationsForMessage(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<void> {
    if (
      update.kind !== "message" ||
      !context.chatId ||
      isServiceMessage(update.raw)
    ) {
      return;
    }
    await this.matchAndRunAutomations(context, update, {
      kind: "message",
      ...(update.messageText ? { text: update.messageText } : {}),
      chatId: context.chatId,
    });
  }

  private async runAutomationsForNewMembers(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<void> {
    if (!context.chatId || update.newChatMemberIds.length === 0) {
      return;
    }
    await this.matchAndRunAutomations(context, update, {
      kind: "new_member",
      chatId: context.chatId,
    });
  }

  private async executeAutomationAction(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    action: AutomationAction,
  ): Promise<void> {
    try {
      switch (action.kind) {
        case "delete": {
          if (update.chat.chatId && update.messageId) {
            await this.telegramGateway.deleteMessage({
              chatId: update.chat.chatId,
              messageId: update.messageId,
              token: this.telegramToken(),
            });
          }
          return;
        }
        case "reply": {
          if (update.chat.chatId) {
            await this.telegramGateway.sendMessage({
              chatId: update.chat.chatId,
              token: this.telegramToken(),
              reply: { text: action.text },
            });
          }
          return;
        }
        case "quarantine": {
          if (context.chatId && update.chat.chatId && update.user.userId) {
            await this.d1Repository.createQuarantineItem({
              tenantId: context.tenantId,
              chatId: context.chatId,
              telegramChatId: update.chat.chatId,
              messageId: update.messageId,
              actorTelegramId: update.user.userId,
              username: update.user.username,
              text: update.messageText,
              reason: "automatización visual",
            });
          }
          return;
        }
        case "notify_staff": {
          await this.emitOwnerNetworkRoute({
            context,
            sourceChatId: context.chatId,
            eventKind: "moderation_actions",
            fallbackEventKind: "logs",
            title: "Automatización",
            body: action.text,
          });
          return;
        }
        case "log": {
          await this.emitD1Log({
            context,
            chatId: context.chatId,
            kind: "d1.automation.visual",
            title: "Automatización",
            body: action.text,
          });
          return;
        }
        case "mute": {
          if (update.user.userId) {
            await this.applyTelegramEnforcement(
              "mute",
              update,
              update.user.userId,
              action.durationMs
                ? new Date(Date.now() + action.durationMs)
                : undefined,
            );
          }
          return;
        }
        case "webhook": {
          // Deliberately not fired: executing arbitrary user-configured
          // outbound HTTP calls from automation rules is a real SSRF risk
          // that needs its own allowlist/signing design — out of scope here.
          return;
        }
        case "assign_mission": {
          if (
            update.user.userId &&
            context.chatId &&
            isGamificationMissionKind(action.missionKind)
          ) {
            const fedId = await this.resolveFedId(context.chatId);
            if (fedId) {
              await this.gamificationRepository.ensureMissions(
                context.tenantId,
                fedId,
                update.user.userId,
              );
            }
          }
        }
      }
    } catch {
      // Automation actions are best-effort; a failure here never breaks the
      // original update handling.
    }
  }

  private routeEventForD1Kind(kind: string): OwnerNetworkRouteEventKind {
    if (kind.includes("quarantine")) {
      return "quarantine";
    }
    if (kind.includes("appeal")) {
      return "appeals";
    }
    if (kind.includes("raid")) {
      return "raid_alerts";
    }
    if (kind.includes("spam")) {
      return "spam_alerts";
    }
    if (kind.startsWith("moderation.")) {
      return "moderation_actions";
    }
    return "logs";
  }

  /**
   * Publica una accion de moderacion en el tema de SANCIONES de la sala de STAFF.
   *
   * Lo pidieron los administradores porque ya lo hacian a mano: escribian
   * "Ban -> @fulano - 26 años" en ese tema. Un parte escrito a mano se olvida el
   * dia que hay prisa, y ese es justo el dia en que hace falta saber quien
   * sanciono a quien.
   *
   * Reutiliza la sala de STAFF de Guardian y solo añade el TEMA. Tener dos
   * ajustes de "donde avisa el bot al equipo" garantiza que uno acabe sin
   * configurar — este repo ya tiene esa cicatriz escrita en dos sitios.
   *
   * Best-effort de principio a fin: perder el parte no puede tumbar la sanción,
   * que es lo que de verdad importa. Pero el fallo se audita en vez de tragarse:
   * un registro que deja de publicar en silencio es peor que no tenerlo, porque
   * el equipo sigue creyendo que hay registro.
   */
  private async publicarParteDeSanciones(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    entrada: {
      readonly action: SanctionsLogAction;
      readonly targetTelegramUserId: bigint;
      readonly reason: string | undefined;
      readonly caseNumber?: number | undefined;
      readonly warnCount?: string | undefined;
      readonly durationMs?: number | undefined;
      readonly enforcementFailure?: string | undefined;
    },
  ): Promise<void> {
    if (!context.chatId) {
      return;
    }
    try {
      const settings = parseSanctionsLogSettings(
        await this.chatSettingRepository.getValue(
          context.tenantId,
          context.chatId,
          SANCTIONS_LOG_SETTINGS_KEY,
        ),
      );
      if (!settings.enabled) {
        return;
      }
      const guardian = await this.guardianRepository.getSettings(
        context.tenantId,
        context.chatId,
      );
      const staffChatId = guardian?.staffChatId;
      if (!staffChatId) {
        return;
      }

      const text = buildSanctionsLogEntry({
        action: entrada.action,
        admin: describeUser(update.user),
        target: await this.describeTarget(
          update,
          context,
          entrada.targetTelegramUserId,
        ),
        targetTelegramUserId: entrada.targetTelegramUserId,
        reason: entrada.reason,
        chatTitle: update.chat.chatTitle ?? null,
        caseNumber: entrada.caseNumber,
        warnCount: entrada.warnCount,
        durationMs: entrada.durationMs,
        enforcementFailure: entrada.enforcementFailure,
      });

      const tema = settings.staffThreadId ?? guardian.staffThreadId;
      const enviar = (messageThreadId: number | null) =>
        this.telegramGateway.sendMessage({
          chatId: staffChatId,
          token: this.telegramToken(),
          ...(messageThreadId != null ? { messageThreadId } : {}),
          reply: { text, parseMode: "HTML" },
        });

      try {
        await enviar(tema);
      } catch (error) {
        // Un tema borrado o mal apuntado no puede tragarse el parte entero. Se
        // reintenta en la sala sin tema: llega al sitio equivocado, pero llega,
        // y quien lo lea vera que el tema hay que arreglarlo.
        if (tema == null) {
          throw error;
        }
        await enviar(null);
        await this.repository.recordAudit({
          tenantId: context.tenantId,
          actorType: "system",
          action: "sanctions_log.thread_fallback",
          resourceType: "chat",
          resourceId: context.chatId,
          payload: { staffThreadId: tema },
        });
      }
    } catch (error) {
      await this.repository
        .recordAudit({
          tenantId: context.tenantId,
          actorType: "system",
          action: "sanctions_log.failed",
          resourceType: "chat",
          resourceId: context.chatId,
          payload: {
            action: entrada.action,
            error: error instanceof Error ? error.message : "unknown",
          },
        })
        .catch(() => undefined);
    }
  }

  /**
   * `/sanciones` — enciende, apaga y reubica el parte.
   *
   * El numero del tema se saca con `/topicid` dentro del tema, porque la Bot API
   * no lista los temas de un foro: no hay forma de ofrecer un desplegable.
   */
  private async handleSanctionsLogCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const command = parseSanctionsLogCommand(update);
    if (!command) {
      return null;
    }
    if (!context.chatId) {
      return { text: "El parte de sanciones se configura dentro de un grupo." };
    }

    const guardian = await this.guardianRepository.getSettings(
      context.tenantId,
      context.chatId,
    );
    const staffChatConfigured = Boolean(guardian?.staffChatId);
    const actuales = parseSanctionsLogSettings(
      await this.chatSettingRepository.getValue(
        context.tenantId,
        context.chatId,
        SANCTIONS_LOG_SETTINGS_KEY,
      ),
    );

    if (command.kind === "show") {
      return {
        text: formatSanctionsLogState({
          settings: actuales,
          staffChatConfigured,
        }),
        parseMode: "HTML",
      };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "sanctions-log.config",
    );
    if (!permission.allowed) {
      return {
        text: "Solo los administradores configuran el parte de sanciones.",
      };
    }

    // Encenderlo sin sala a la que mandarlo dejaria un interruptor en "on" que
    // no publica nada: la forma mas fiable de que alguien de por hecho que hay
    // registro cuando no lo hay.
    if (command.kind === "on" && !staffChatConfigured) {
      return {
        text: formatSanctionsLogState({
          settings: actuales,
          staffChatConfigured: false,
        }),
        parseMode: "HTML",
      };
    }

    const siguientes: SanctionsLogSettings =
      command.kind === "off"
        ? { ...actuales, enabled: false }
        : { enabled: true, staffThreadId: command.staffThreadId };

    await this.chatSettingRepository.setValue(
      context.tenantId,
      context.chatId,
      SANCTIONS_LOG_SETTINGS_KEY,
      siguientes,
    );
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "sanctions_log.configured",
      resourceType: "chat",
      resourceId: context.chatId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        enabled: siguientes.enabled,
        staffThreadId: siguientes.staffThreadId,
      },
    });

    return {
      text: formatSanctionsLogState({
        settings: siguientes,
        staffChatConfigured,
      }),
      parseMode: "HTML",
    };
  }

  private async emitOwnerNetworkRoute(input: {
    context: FoundationContext;
    sourceChatId: string | undefined;
    eventKind: OwnerNetworkRouteEventKind;
    fallbackEventKind?: OwnerNetworkRouteEventKind;
    title: string;
    body: string | undefined;
    replyMarkup?: Record<string, unknown>;
  }): Promise<boolean> {
    if (!input.sourceChatId) {
      return false;
    }

    try {
      const route =
        (await this.ownerNetworkRepository.resolveRoute(
          input.sourceChatId,
          input.eventKind,
        )) ??
        (input.fallbackEventKind && input.fallbackEventKind !== input.eventKind
          ? await this.ownerNetworkRepository.resolveRoute(
              input.sourceChatId,
              input.fallbackEventKind,
            )
          : null);

      if (!route) {
        return false;
      }

      await this.telegramGateway.sendMessage({
        chatId: route.targetTelegramChatId,
        token: this.telegramToken(),
        reply: {
          text: input.body ? `${input.title}\n\n${input.body}` : input.title,
          ...(input.replyMarkup ? { replyMarkup: input.replyMarkup } : {}),
        },
      });
      await this.repository.recordAudit({
        tenantId: input.context.tenantId,
        actorType: "system",
        action: "network.route.applied",
        resourceType: "owner_network_route",
        resourceId: route.targetChatId,
        payload: {
          fedId: route.fedId,
          sourceChatId: route.sourceChatId,
          eventKind: route.eventKind,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  private async handleD1LogsCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseD1LogCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "El registro del grupo se configura dentro de un grupo." };
    }

    const command = result.command;

    if (command.kind === "status") {
      const config = await this.d1Repository.getLogConfig(context.chatId);
      return {
        text: config
          ? `Logs D1 activos -> ${config.logTelegramChatId.toString()}`
          : "Logs D1 desactivados. Usa /logs set here o /logs set <chat_id>.",
      };
    }

    if (command.kind === "events") {
      const events = await this.d1Repository.listEvents(
        context.tenantId,
        context.chatId,
      );
      return { text: formatEvents(events) };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "d1.logs",
    );
    if (!permission.allowed) {
      return { text: "No puedes configurar el registro del grupo." };
    }

    if (command.kind === "off") {
      const removed = await this.d1Repository.clearLogChannel(context.chatId);
      await this.emitD1Log({
        context,
        chatId: context.chatId,
        kind: "d1.logs.off",
        title: "Logs D1 desactivados",
        body: `Actor: ${update.user.userId?.toString() ?? "?"}`,
      });
      return {
        text: removed
          ? "Logs D1 desactivados."
          : "Los logs ya estaban desactivados.",
      };
    }

    const target =
      command.logTelegramChatId === "here"
        ? update.chat.chatId
        : command.logTelegramChatId;
    if (!target) {
      return { text: "No pude resolver el chat de logs." };
    }

    await this.d1Repository.setLogChannel(
      context.tenantId,
      context.chatId,
      target,
    );
    await this.emitD1Log({
      context,
      chatId: context.chatId,
      kind: "d1.logs.on",
      title: "Logs D1 configurados",
      body: `Este chat recibirá los eventos del grupo ${context.chatId}.`,
    });
    return { text: `Logs D1 configurados en ${target.toString()}.` };
  }

  private async handleQuarantineCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseQuarantineCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "La cuarentena se gestiona dentro de un grupo." };
    }

    const command = result.command;

    if (command.kind === "status") {
      const config = await this.d1Repository.getQuarantineConfig(
        context.chatId,
      );
      return {
        text: `Cuarentena: ${config.enabled ? "activada" : "desactivada"} (${config.strictness}).`,
      };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "d1.quarantine",
    );
    if (!permission.allowed) {
      return { text: "No tienes permisos para gestionar la cuarentena." };
    }

    if (command.kind === "list") {
      const pending = await this.d1Repository.listPendingQuarantine(
        context.chatId,
      );
      return { text: formatQuarantineList(pending) };
    }

    if (command.kind === "on" || command.kind === "off") {
      const config = await this.d1Repository.setQuarantineConfig(
        context.tenantId,
        context.chatId,
        { enabled: command.kind === "on" },
      );
      await this.emitD1Log({
        context,
        chatId: context.chatId,
        kind: `d1.quarantine.${command.kind}`,
        title: `Cuarentena ${config.enabled ? "activada" : "desactivada"}`,
        body: `Actor: ${update.user.userId?.toString() ?? "?"}`,
      });
      return { text: `Cuarentena ${config.enabled ? "activada" : "apagada"}.` };
    }

    const status = command.kind === "approve" ? "approved" : "rejected";
    const item = await this.d1Repository.resolveQuarantineItem(
      command.itemId,
      status,
      update.user.userId,
      command.kind === "reject" ? command.note : undefined,
    );

    if (!item) {
      return { text: "Ese item no existe o ya fue revisado." };
    }

    if (command.kind === "approve" && item.text) {
      await this.telegramGateway.sendMessage({
        chatId: item.telegramChatId,
        token: this.telegramToken(),
        reply: {
          text: `Mensaje aprobado de ${item.username ? `@${item.username}` : item.actorTelegramId.toString()}:\n${item.text}`,
        },
      });
    }

    await this.emitD1Log({
      context,
      chatId: item.chatId,
      kind: `d1.quarantine.${status}`,
      title: `Cuarentena ${status}`,
      body: `Item ${item.id} revisado por ${update.user.userId?.toString() ?? "?"}.`,
    });

    return {
      text:
        command.kind === "approve"
          ? `Item ${item.id} aprobado.`
          : `Item ${item.id} rechazado.`,
    };
  }

  private async handleQuarantineCallback(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const parsed = parseQuarantineCallback(update.callbackData);

    if (!parsed) {
      return null;
    }

    if (!(await this.isActorAdmin(context, update))) {
      return { text: "Solo admins pueden revisar cuarentena." };
    }

    const item = await this.d1Repository.resolveQuarantineItem(
      parsed.itemId,
      parsed.action === "approve" ? "approved" : "rejected",
      update.user.userId,
      undefined,
    );

    if (!item) {
      return { text: "Ese item ya fue revisado.", edit: true };
    }

    if (parsed.action === "approve" && item.text) {
      await this.telegramGateway.sendMessage({
        chatId: item.telegramChatId,
        token: this.telegramToken(),
        reply: {
          text: `Mensaje aprobado de ${item.username ? `@${item.username}` : item.actorTelegramId.toString()}:\n${item.text}`,
        },
      });
    }

    await this.emitD1Log({
      context,
      chatId: item.chatId,
      kind: `d1.quarantine.${parsed.action}`,
      title: `Cuarentena ${parsed.action}`,
      body: `Item ${item.id} revisado por ${update.user.userId?.toString() ?? "?"}.`,
    });

    return {
      text: `Item ${item.id}: ${parsed.action === "approve" ? "aprobado" : "rechazado"}.`,
      edit: true,
    };
  }

  private async handleAppealCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseAppealCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    const command = result.command;

    if (command.kind === "create") {
      if (!update.user.userId) {
        return { text: "No pude identificarte para crear la apelación." };
      }
      const appealChatId =
        update.chat.chatType === "private" ? undefined : context.chatId;
      const appeal = await this.d1Repository.createAppeal({
        tenantId: context.tenantId,
        chatId: appealChatId,
        caseRef: command.caseRef,
        appellantTelegramId: update.user.userId,
        username: update.user.username,
        message: command.message,
      });
      await this.emitD1Log({
        context,
        chatId: appealChatId,
        kind: "d1.appeal.opened",
        title: "Apelación abierta",
        body: buildAppealLog(appeal),
        replyMarkup: buildAppealKeyboard(appeal.id),
      });
      return { text: "Apelación recibida. Te aviso cuando la revisen." };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "d1.appeals",
    );
    if (!permission.allowed) {
      return { text: "No tienes permisos para gestionar apelaciones." };
    }

    if (command.kind === "list") {
      const appeals = await this.d1Repository.listOpenAppeals(
        context.tenantId,
        context.chatId,
      );
      return { text: formatAppeals(appeals) };
    }

    const appeal = await this.d1Repository.resolveAppeal(
      command.appealId,
      command.kind === "accept" ? "accepted" : "denied",
      update.user.userId,
      command.note,
    );

    if (!appeal) {
      return { text: "No encuentro esa apelación. Míralas con /appeals." };
    }

    await this.emitD1Log({
      context,
      chatId: appeal.chatId,
      kind: `d1.appeal.${command.kind}`,
      title: `Apelación ${command.kind === "accept" ? "aceptada" : "denegada"}`,
      body: `ID ${appeal.id} - caso ${appeal.caseRef}.`,
    });

    return {
      text:
        command.kind === "accept"
          ? `Apelación ${appeal.id} aceptada. Recuerda levantar la sanción con /unban o /unmute.`
          : `Apelación ${appeal.id} denegada.`,
    };
  }

  private async handleAppealCallback(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const parsed = parseAppealCallback(update.callbackData);

    if (!parsed) {
      return null;
    }

    if (!(await this.isActorAdmin(context, update))) {
      return { text: "Solo admins pueden resolver apelaciones." };
    }

    const appeal = await this.d1Repository.resolveAppeal(
      parsed.appealId,
      parsed.action === "accept" ? "accepted" : "denied",
      update.user.userId,
      undefined,
    );

    if (!appeal) {
      return { text: "Esa apelación ya fue resuelta.", edit: true };
    }

    await this.emitD1Log({
      context,
      chatId: appeal.chatId,
      kind: `d1.appeal.${parsed.action}`,
      title: `Apelación ${parsed.action}`,
      body: `ID ${appeal.id} - caso ${appeal.caseRef}.`,
    });

    return {
      text: `Apelación ${appeal.id}: ${parsed.action === "accept" ? "aceptada" : "denegada"}.`,
      edit: true,
    };
  }

  private async handleD1DoctorCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (!isDoctorCommand(update)) {
      return null;
    }

    if (!context.chatId) {
      return { text: "La revisión del grupo se pide desde dentro del grupo." };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "d1.diagnose",
    );
    if (!permission.allowed) {
      return { text: "No tienes permisos para diagnosticar el grupo." };
    }

    const [
      antiflood,
      captcha,
      antiraid,
      hygiene,
      logConfig,
      quarantine,
      stats,
    ] = await Promise.all([
      this.antifloodRepository.getConfig(context.tenantId, context.chatId),
      this.captchaRepository.getConfig(context.tenantId, context.chatId),
      this.antiraidRepository.getConfig(context.tenantId, context.chatId),
      this.groupProtectionRepository.getHygiene(context.chatId),
      this.d1Repository.getLogConfig(context.chatId),
      this.d1Repository.getQuarantineConfig(context.chatId),
      this.d1Repository.getStats(context.tenantId, context.chatId),
    ]);

    const text = buildDoctorReport({
      antifloodEnabled: antiflood?.enabled ?? false,
      captchaEnabled: captcha?.enabled ?? false,
      antiraidEnabled: antiraid?.enabled ?? false,
      welcomeMute: hygiene.welcomeMute,
      logEnabled: Boolean(logConfig?.enabled),
      quarantineEnabled: quarantine.enabled,
      pendingQuarantine: stats.pendingQuarantine,
      openAppeals: stats.openAppeals,
      activeAutomations: stats.activeAutomations,
      activeMissions: stats.activeMissions,
    });

    await this.emitD1Log({
      context,
      chatId: context.chatId,
      kind: "d1.doctor",
      title: "Revisión del grupo",
      body: `Actor: ${update.user.userId?.toString() ?? "?"}`,
    });

    return { text };
  }

  private async handleAutomationCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseAutomationCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "Las automatizaciones se gestionan dentro de un grupo." };
    }

    const command = result.command;

    if (command.kind === "list") {
      const rules = await this.d1Repository.listAutomationRules(context.chatId);
      return { text: formatAutomationList(rules) };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "d1.automation",
    );
    if (!permission.allowed) {
      return { text: "No tienes permisos para gestionar automatizaciones." };
    }

    if (command.kind === "remove") {
      const removed = await this.d1Repository.removeAutomationRule(
        context.chatId,
        command.ruleId,
      );
      await this.emitD1Log({
        context,
        chatId: context.chatId,
        kind: "d1.automation.removed",
        title: "Automatización eliminada",
        body: `Regla: ${command.ruleId}`,
      });
      return {
        text: removed
          ? "Automatización eliminada."
          : "No existe esa regla activa.",
      };
    }

    const rule = await this.d1Repository.addAutomationRule({
      tenantId: context.tenantId,
      chatId: context.chatId,
      name: `contains:${command.triggerValue}`,
      triggerKind: command.triggerKind,
      triggerValue: command.triggerValue,
      actionKind: command.actionKind,
      actionValue: command.actionValue,
      createdBy: context.userId,
    });
    await this.emitD1Log({
      context,
      chatId: context.chatId,
      kind: "d1.automation.added",
      title: "Automatización creada",
      body: `${rule.id}: ${rule.triggerKind} ${rule.triggerValue} -> ${rule.actionKind}`,
    });
    return { text: `Automatización creada: ${rule.id}` };
  }

  private async handleAutomationAmbient(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.kind !== "message" ||
      update.command ||
      !context.chatId ||
      !update.chat.chatId ||
      !update.user.userId ||
      !update.messageText
    ) {
      return null;
    }

    if (await this.isActorAdmin(context, update)) {
      return null;
    }

    const rules = await this.d1Repository.listAutomationRules(
      context.chatId,
      true,
    );
    const rule = rules.find((candidate) =>
      automationMatches(candidate, update.messageText),
    );

    if (!rule) {
      return null;
    }

    await this.emitD1Log({
      context,
      chatId: context.chatId,
      kind: "d1.automation.triggered",
      title: "Automatización ejecutada",
      body: `${rule.id}: ${rule.actionKind}`,
    });

    if (rule.actionKind === "reply") {
      return { text: rule.actionValue ?? "Automatización ejecutada." };
    }

    if (rule.actionKind === "delete") {
      if (update.messageId) {
        await this.telegramGateway.deleteMessage({
          chatId: update.chat.chatId,
          messageId: update.messageId,
          token: this.telegramToken(),
        });
      }
      return { text: "Automatización aplicada: mensaje eliminado." };
    }

    if (rule.actionKind === "log") {
      return { text: rule.actionValue ?? "Automatización registrada." };
    }

    if (update.messageId) {
      await this.telegramGateway.deleteMessage({
        chatId: update.chat.chatId,
        messageId: update.messageId,
        token: this.telegramToken(),
      });
    }
    const item = await this.d1Repository.createQuarantineItem({
      tenantId: context.tenantId,
      chatId: context.chatId,
      telegramChatId: update.chat.chatId,
      messageId: update.messageId,
      actorTelegramId: update.user.userId,
      username: update.user.username,
      text: update.messageText,
      reason: `regla automática ${rule.id}`,
    });
    await this.recordRiskSignal(context, update.user.userId, "quarantine");
    await this.emitD1Log({
      context,
      chatId: context.chatId,
      kind: "d1.quarantine.created",
      title: "Mensaje enviado a cuarentena",
      body: buildQuarantineLog(item),
      replyMarkup: buildQuarantineKeyboard(item.id),
    });
    return { text: "Mensaje enviado a cuarentena por regla automática." };
  }

  /** `quarantine.ambient`: la regla y sus efectos viven en `modules/support`. */
  private async handleQuarantineAmbient(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const telegramChatId = update.chat.chatId;
    const userId = update.user.userId;
    const chatId = context.chatId;
    if (update.kind !== "message" || !chatId || !telegramChatId || !userId) {
      return null;
    }
    const messageId = update.messageId;

    const aviso = await aplicarCuarentena(
      {
        esComando: Boolean(update.command),
        contenido: update.content,
        texto: update.messageText,
        tieneMensajeId: Boolean(messageId),
      },
      {
        esAdministrador: () => this.isActorAdmin(context, update),
        ajustes: () => this.d1Repository.getQuarantineConfig(chatId),
        borrarMensaje: async () => {
          await this.telegramGateway.deleteMessage({
            chatId: telegramChatId,
            // `tieneMensajeId` ya lo comprobo; el estrechamiento no cruza el
            // cierre de la lambda.
            messageId: messageId as number,
            token: this.telegramToken(),
          });
        },
        crearItem: (item) =>
          this.d1Repository.createQuarantineItem({
            tenantId: context.tenantId,
            chatId,
            telegramChatId,
            messageId,
            actorTelegramId: userId,
            username: update.user.username,
            text: item.texto,
            reason: item.motivo,
          }),
        anotarSenalDeRiesgo: async () => {
          await this.recordRiskSignal(context, userId, "quarantine");
        },
        registrarEnBitacora: async (entrada) => {
          await this.emitD1Log({
            context,
            chatId,
            kind: "d1.quarantine.created",
            title: entrada.titulo,
            body: entrada.cuerpo,
            replyMarkup: entrada.teclado,
          });
        },
      },
    );

    return aviso === null ? null : { text: aviso };
  }

  private async handleMissionCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseMissionCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "Las misiones se gestionan dentro de un grupo." };
    }

    const command = result.command;

    if (command.kind === "badges") {
      if (!update.user.userId) {
        return { text: "No pude identificarte." };
      }
      const badges = await this.d1Repository.listUserBadges(
        context.tenantId,
        context.chatId,
        update.user.userId,
      );
      return { text: formatBadges(badges) };
    }

    if (command.kind === "list") {
      if (update.user.userId) {
        const progress = await this.d1Repository.listMissionProgress(
          context.chatId,
          update.user.userId,
        );
        if (progress.length > 0) {
          return { text: formatMissionProgress(progress) };
        }
      }
      const missions = await this.d1Repository.listMissions(
        context.chatId,
        true,
      );
      return { text: formatMissions(missions) };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "d1.missions",
    );
    if (!permission.allowed) {
      return { text: "No tienes permisos para gestionar misiones." };
    }

    if (command.kind === "close") {
      const closed = await this.d1Repository.setMissionActive(
        context.chatId,
        command.missionId,
        false,
      );
      await this.emitD1Log({
        context,
        chatId: context.chatId,
        kind: "d1.mission.closed",
        title: "Misión cerrada",
        body: `Misión: ${command.missionId}`,
      });
      return { text: closed ? "Misión cerrada." : "No existe esa misión." };
    }

    const mission = await this.d1Repository.createMission({
      tenantId: context.tenantId,
      chatId: context.chatId,
      title: command.title,
      goalKind: command.goalKind,
      goalTarget: command.goalTarget,
      rewardBadge: command.rewardBadge,
      createdBy: context.userId,
    });
    await this.emitD1Log({
      context,
      chatId: context.chatId,
      kind: "d1.mission.created",
      title: "Misión creada",
      body: `${mission.id}: ${mission.title}`,
    });
    return {
      text: `Misión creada: ${mission.id} -> badge ${mission.rewardBadge}`,
    };
  }

  private async handleMissionProgress(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.kind !== "message" ||
      update.command ||
      !context.chatId ||
      !update.user.userId ||
      !update.isTextMessage
    ) {
      return null;
    }

    const completed = await this.d1Repository.recordMissionEvent({
      tenantId: context.tenantId,
      chatId: context.chatId,
      telegramUserId: update.user.userId,
      goalKind: "messages",
      amount: 1,
    });

    if (completed.length === 0) {
      return null;
    }

    const first = completed[0];
    if (first) {
      await this.emitD1Log({
        context,
        chatId: context.chatId,
        kind: "d1.mission.completed",
        title: "Misión completada",
        body: `${update.user.userId.toString()} completo ${first.title}.`,
      });
      return {
        text: buildMissionCompletedText(first.title, first.rewardBadge),
      };
    }

    return null;
  }

  private async handleWebhookCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseWebhookCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "Los webhooks se gestionan dentro de un grupo." };
    }

    const command = result.command;

    if (command.kind === "list") {
      const webhooks = await this.webhookRepository.listWebhooks(
        context.chatId,
      );
      if (webhooks.length === 0) {
        return { text: "No hay webhooks. Usa /webhook add <url>." };
      }
      const lines = webhooks.map((webhook) => `${webhook.id}: ${webhook.url}`);
      return { text: `Webhooks:\n${lines.join("\n")}` };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "webhook.config",
    );
    if (!permission.allowed) {
      return {
        text: `No tienes permisos para gestionar webhooks.`,
      };
    }

    if (command.kind === "remove") {
      const removed = await this.webhookRepository.removeWebhook(
        context.chatId,
        command.webhookId,
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "webhook.removed",
        resourceType: "webhook",
        resourceId: command.webhookId,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { removed },
      });
      return {
        text: removed ? "Webhook eliminado." : "No existe ese webhook.",
      };
    }

    // add: register with a generated signing secret and enqueue a ping delivery.
    const secret = randomUUID();
    const webhook = await this.webhookRepository.addWebhook(
      context.tenantId,
      context.chatId,
      command.url,
      secret,
      context.userId,
    );
    const body = buildWebhookBody(
      "webhook.registered",
      { chatId: context.chatId, webhookId: webhook.id },
      Date.now(),
    );
    await this.webhookRepository.enqueueDelivery({
      tenantId: context.tenantId,
      webhookId: webhook.id,
      url: command.url,
      secret,
      event: "webhook.registered",
      body,
    });

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "webhook.added",
      resourceType: "webhook",
      resourceId: webhook.id,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { url: command.url },
    });

    return {
      text: `Webhook añadido (ID ${webhook.id}). Se entregará un ping de verificación firmado.`,
    };
  }

  private async handleRssCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseRssCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId || !update.chat.chatId) {
      return { text: "Los feeds RSS se gestionan dentro de un grupo." };
    }

    const command = result.command;

    if (command.kind === "list") {
      const feeds = await this.feedRepository.listFeeds(context.chatId);
      if (feeds.length === 0) {
        return { text: "No hay feeds RSS. Usa /rss add <url>." };
      }
      const lines = feeds.map((feed) => `${feed.id}: ${feed.url}`);
      return { text: `Feeds RSS:\n${lines.join("\n")}` };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "rss.config",
    );

    if (!permission.allowed) {
      return {
        text: `No tienes permisos para gestionar feeds.`,
      };
    }

    if (command.kind === "remove") {
      const removed = await this.feedRepository.removeFeed(
        context.chatId,
        command.feedId,
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "rss.removed",
        resourceType: "feed",
        resourceId: command.feedId,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { removed },
      });
      return {
        text: removed ? "Feed eliminado." : "No existe ese feed.",
      };
    }

    const feed = await this.feedRepository.addFeed(
      context.tenantId,
      context.chatId,
      update.chat.chatId,
      command.url,
      context.userId,
    );

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "rss.added",
      resourceType: "feed",
      resourceId: feed.id,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { url: command.url },
    });

    return {
      text: `Feed RSS añadido: ${command.url} (ID ${feed.id}). Los items nuevos se publicarán aquí.`,
    };
  }

  private async handleReminderCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseReminderCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      // Skeddy-style natural-language fallback for /remind, e.g.
      // "/remind manana a las 9 llamar" or "/remind en 2 horas ...".
      if (
        update.command?.name === "remind" &&
        context.chatId &&
        update.chat.chatId &&
        update.user.userId
      ) {
        const raw = (update.command?.args ?? []).join(" ").trim();
        const nl = raw ? parseNaturalReminder(raw, Date.now()) : null;
        if (nl) {
          const runAt = new Date(nl.runAtMs);
          const reminder = await this.productivityRepository.createReminder({
            tenantId: context.tenantId,
            chatId: context.chatId,
            telegramChatId: update.chat.chatId,
            telegramUserId: update.user.userId,
            text: nl.message,
            runAt,
          });
          await this.repository.recordAudit({
            tenantId: context.tenantId,
            actorType: "user",
            action: "reminder.created",
            resourceType: "reminder",
            resourceId: reminder.id,
            ...(context.userId ? { actorId: context.userId } : {}),
            payload: { runAt: runAt.toISOString(), natural: true },
          });
          return {
            text: `⏰ Te recordaré "${nl.message}" el *${formatReminderTime(nl.runAtMs)}*.`,
            parseMode: "Markdown",
          };
        }
      }
      return { text: result.error.usage };
    }

    if (!context.chatId || !update.chat.chatId || !update.user.userId) {
      return { text: "Los recordatorios se gestionan dentro de un grupo." };
    }

    const command = result.command;

    if (command.kind === "list") {
      const pending = await this.productivityRepository.listPendingReminders(
        context.chatId,
        update.user.userId,
      );
      if (pending.length === 0) {
        return { text: "No tienes recordatorios pendientes." };
      }
      const lines = pending.map(
        (reminder) =>
          `${reminder.id}: ${reminder.runAt.toISOString()} — ${reminder.text.slice(0, 40)}`,
      );
      return { text: `Recordatorios:\n${lines.join("\n")}` };
    }

    if (command.kind === "cancel") {
      const cancelled = await this.productivityRepository.cancelReminder(
        context.chatId,
        command.reminderId,
      );
      return {
        text: cancelled
          ? "Recordatorio cancelado."
          : "No existe ese recordatorio pendiente.",
      };
    }

    const runAt = new Date(reminderRunAtMs(Date.now(), command.minutes));
    const reminder = await this.productivityRepository.createReminder({
      tenantId: context.tenantId,
      chatId: context.chatId,
      telegramChatId: update.chat.chatId,
      telegramUserId: update.user.userId,
      text: command.text,
      runAt,
    });

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "reminder.created",
      resourceType: "reminder",
      resourceId: reminder.id,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { runAt: runAt.toISOString() },
    });

    return {
      text: `⏰ Te lo recuerdo el ${runAt.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}. (Referencia: ${reminder.id})`,
    };
  }

  private async handleTaskCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseTaskCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId || !update.user.userId) {
      return { text: "Las tareas se gestionan dentro de un grupo." };
    }

    const command = result.command;

    if (command.kind === "create") {
      const task = await this.productivityRepository.createTask(
        context.tenantId,
        context.chatId,
        update.user.userId,
        command.title,
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "task.created",
        resourceType: "task",
        resourceId: task.id,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { number: task.number },
      });
      return { text: `✅ Tarea #${task.number} creada. ID: ${task.id}` };
    }

    if (command.kind === "list") {
      const tasks = await this.productivityRepository.listTasks(
        context.chatId,
        update.user.userId,
      );
      if (tasks.length === 0) {
        return { text: "No tienes tareas pendientes." };
      }
      const lines = tasks.map((task) => `#${task.number} ${task.title}`);
      return { text: `Tus tareas:\n${lines.join("\n")}` };
    }

    const completed = await this.productivityRepository.completeTask(
      context.chatId,
      command.taskId,
    );
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "task.completed",
      resourceType: "task",
      resourceId: command.taskId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { completed },
    });
    return {
      text: completed ? "Tarea completada." : "No existe esa tarea pendiente.",
    };
  }

  private async handleTicketCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseTicketCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "El soporte se gestiona dentro de un grupo." };
    }

    const command = result.command;

    if (command.kind === "create") {
      if (!update.user.userId) {
        return { text: "No puedo identificarte." };
      }
      const ticket = await this.ticketRepository.createTicket({
        tenantId: context.tenantId,
        chatId: context.chatId,
        reporterTelegramId: update.user.userId,
        subject: command.subject,
        priority: command.priority,
      });
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "ticket.created",
        resourceType: "ticket",
        resourceId: ticket.id,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { number: ticket.number, priority: ticket.priority },
      });
      await this.emitOwnerNetworkRoute({
        context,
        sourceChatId: context.chatId,
        eventKind: "tickets",
        fallbackEventKind: "logs",
        title: `Ticket #${ticket.number} creado`,
        body: [
          `Grupo: ${update.chat.chatId?.toString() ?? context.chatId}`,
          `Usuario: ${update.user.userId.toString()}`,
          `Prioridad: ${ticket.priority}`,
          `Asunto: ${ticket.subject}`,
          `ID: ${ticket.id}`,
        ].join("\n"),
      });
      return {
        text: `🎫 Ticket #${ticket.number} creado (${ticket.priority}). ID: ${ticket.id}`,
      };
    }

    if (command.kind === "list") {
      const open = await this.ticketRepository.listOpen(
        context.tenantId,
        context.chatId,
      );
      if (open.length === 0) {
        return { text: "No hay tickets abiertos." };
      }
      const lines = open.map(
        (ticket) =>
          `#${ticket.number} [${ticket.status}/${ticket.priority}] ${ticket.subject}`,
      );
      return { text: `Tickets abiertos:\n${lines.join("\n")}` };
    }

    // close / reopen / assign require support permissions (moderation.write).
    const isAdmin = await this.isActorAdmin(context, update);
    const role = isAdmin ? "admin" : this.resolveActorRole(context, update);
    const decision = evaluatePolicy(
      {
        role,
        permissions: [],
        isTelegramAdmin: isAdmin,
        moduleEnabled: true,
      },
      "moderation.write",
      { moduleName: "support" },
    );

    if (!decision.allowed) {
      return {
        text: `No tienes permisos para gestionar tickets.`,
      };
    }

    const ticket = await this.ticketRepository.getTicket(
      context.tenantId,
      command.ticketId,
    );

    if (!ticket) {
      return { text: "Ticket no encontrado." };
    }

    if (command.kind === "assign") {
      await this.ticketRepository.assign(ticket.id, command.assigneeTelegramId);
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "ticket.assigned",
        resourceType: "ticket",
        resourceId: ticket.id,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { assignee: command.assigneeTelegramId.toString() },
      });
      return {
        text: `Ticket #${ticket.number} asignado a ${command.assigneeTelegramId.toString()}.`,
      };
    }

    const nextStatus = command.kind === "close" ? "closed" : "open";
    await this.ticketRepository.setStatus(ticket.id, nextStatus);
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: command.kind === "close" ? "ticket.closed" : "ticket.reopened",
      resourceType: "ticket",
      resourceId: ticket.id,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { number: ticket.number },
    });
    return {
      text: `Ticket #${ticket.number} ${command.kind === "close" ? "cerrado" : "reabierto"}.`,
    };
  }

  private async handleScheduleCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseScheduleCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId || !update.chat.chatId) {
      return { text: "Las publicaciones se programan dentro de un grupo." };
    }

    const command = result.command;

    if (command.kind === "list") {
      const pending = await this.scheduledPostRepository.listPending(
        context.chatId,
      );
      if (pending.length === 0) {
        return { text: "No hay publicaciones programadas." };
      }
      const lines = pending.map(
        (post) =>
          `${post.id}: ${post.runAt.toISOString()} — ${post.text.slice(0, 40)}`,
      );
      return { text: `Programadas:\n${lines.join("\n")}` };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "schedule.config",
    );

    if (!permission.allowed) {
      return {
        text: `No tienes permisos para programar.`,
      };
    }

    if (command.kind === "cancel") {
      const cancelled = await this.scheduledPostRepository.cancel(
        context.chatId,
        command.postId,
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "post.cancelled",
        resourceType: "scheduled_post",
        resourceId: command.postId,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { cancelled },
      });
      return {
        text: cancelled
          ? "Publicación cancelada."
          : "No existe esa publicación pendiente.",
      };
    }

    const runAt = new Date(computeRunAtMs(Date.now(), command.minutes));
    const post = await this.scheduledPostRepository.create({
      tenantId: context.tenantId,
      chatId: context.chatId,
      telegramChatId: update.chat.chatId,
      text: command.text,
      runAt,
      ...(context.userId ? { createdBy: context.userId } : {}),
    });

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "post.scheduled",
      resourceType: "scheduled_post",
      resourceId: post.id,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { runAt: runAt.toISOString() },
    });

    return {
      text: `Publicación programada para el ${runAt.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}. (Referencia: ${post.id})`,
    };
  }

  private async handleGiveawayCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseGiveawayCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "Los sorteos se gestionan dentro de un grupo." };
    }

    if (result.command.kind === "create") {
      const permission = await this.ensureConfigPermission(
        context,
        update,
        "giveaway.create",
      );
      if (!permission.allowed) {
        return {
          text: `No tienes permisos para crear sorteos.`,
        };
      }

      const giveaway = await this.giveawayRepository.createGiveaway(
        context.tenantId,
        context.chatId,
        result.command.prize,
        context.userId,
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "giveaway.created",
        resourceType: "giveaway",
        resourceId: giveaway.id,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { prize: result.command.prize },
      });
      return {
        text: `🎁 Sorteo: ${giveaway.prize}\nPulsa para participar. ID: ${giveaway.id}`,
        replyMarkup: {
          inline_keyboard: [
            [{ text: "Participar", callback_data: `giveaway:${giveaway.id}` }],
          ],
        },
      };
    }

    // Draw a winner.
    const permission = await this.ensureConfigPermission(
      context,
      update,
      "giveaway.draw",
    );
    if (!permission.allowed) {
      return {
        text: `No tienes permisos para sortear.`,
      };
    }

    const giveaway = await this.giveawayRepository.getGiveaway(
      result.command.giveawayId,
    );
    if (!giveaway) {
      return { text: "Sorteo no encontrado." };
    }
    if (giveaway.status === "closed") {
      return { text: "Este sorteo ya fue resuelto." };
    }

    const entrants = await this.giveawayRepository.listEntrants(giveaway.id);
    if (entrants.length === 0) {
      return { text: "El sorteo no tiene participantes." };
    }

    const seed = randomUUID();
    const winner = pickWinner(entrants, seed);
    if (winner === null) {
      return { text: "No se pudo determinar un ganador." };
    }

    await this.giveawayRepository.closeWithWinner(giveaway.id, seed, winner);
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "giveaway.drawn",
      resourceType: "giveaway",
      resourceId: giveaway.id,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        winner: winner.toString(),
        seed,
        entrants: entrants.length,
      },
    });

    return {
      text: `🏆 Ganador del sorteo "${giveaway.prize}": ${winner.toString()}\nParticipantes: ${entrants.length}\nSemilla verificable: ${seed}`,
    };
  }

  private async handleGiveawayJoin(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const giveawayId = parseGiveawayJoin(update.callbackData);

    if (!giveawayId) {
      return null;
    }

    if (!update.user.userId) {
      return { text: "No puedo identificarte." };
    }

    const giveaway = await this.giveawayRepository.getGiveaway(giveawayId);
    if (!giveaway || giveaway.status === "closed") {
      return { text: "Este sorteo no está disponible." };
    }

    await this.giveawayRepository.addEntry(giveawayId, update.user.userId);
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "giveaway.joined",
      resourceType: "giveaway",
      resourceId: giveawayId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { telegramUserId: update.user.userId.toString() },
    });

    return { text: "Participas en el sorteo. ¡Suerte!" };
  }

  private async handlePollCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parsePollCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "Las encuestas se crean dentro de un grupo." };
    }

    const { question, options } = result.command.draft;
    const poll = await this.pollRepository.createPoll(
      context.tenantId,
      context.chatId,
      question,
      options,
      context.userId,
    );

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "poll.created",
      resourceType: "poll",
      resourceId: poll.id,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { options: options.length },
    });

    return {
      text: `📊 ${question}`,
      replyMarkup: {
        inline_keyboard: poll.options.map((option, index) => [
          { text: option, callback_data: `poll:${poll.id}:${index}` },
        ]),
      },
    };
  }

  private async handlePollVote(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const vote = parsePollVote(update.callbackData);

    if (!vote) {
      return null;
    }

    const poll = await this.pollRepository.getPoll(vote.pollId);

    if (!poll || poll.closed) {
      return { text: "Esta encuesta no está disponible." };
    }

    if (vote.optionIndex >= poll.options.length) {
      return { text: "Opción inválida." };
    }

    if (!update.user.userId) {
      return { text: "No puedo identificarte." };
    }

    await this.pollRepository.recordVote(
      poll.id,
      update.user.userId,
      vote.optionIndex,
    );
    const votes = await this.pollRepository.listVotes(poll.id);
    const tally = tallyVotes(votes, poll.options.length);

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "poll.voted",
      resourceType: "poll",
      resourceId: poll.id,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { optionIndex: vote.optionIndex },
    });

    return { text: formatPollResults(poll.question, poll.options, tally) };
  }

  private async handleStatsCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseStatsCommand(update);

    if (!result) {
      return null;
    }

    if (!context.chatId) {
      return { text: "Las estadísticas se miden dentro de un grupo." };
    }

    const total = await this.analyticsRepository.getTotal(context.chatId);
    const recent = await this.analyticsRepository.getRecentDays(
      context.chatId,
      30,
    );
    const now = Date.now();
    const today = recent.find((row) => row.day === dayKeyFromMs(now));
    const last7 = sumRecentMessages(recent, now, 7);

    if (result.command.kind === "activity") {
      const lines = recent
        .slice(0, 7)
        .map((row) => `${row.day}: ${row.messages}`);
      return {
        text:
          lines.length > 0
            ? `Actividad reciente:\n${lines.join("\n")}`
            : "Aún no hay actividad registrada.",
      };
    }

    if (result.command.kind === "top") {
      const top = await this.analyticsRepository.getTopPosters(
        context.chatId,
        10,
      );
      return { text: formatTopPosters(top), parseMode: "Markdown" };
    }

    const activeUsers = await this.analyticsRepository.getActiveUserCount(
      context.chatId,
    );
    const top = await this.analyticsRepository.getTopPosters(context.chatId, 3);
    const topLine = top.length > 0 ? `\n${formatTopPosters(top)}` : "";

    return {
      text: `📊 *Estadísticas del grupo*\n${total} mensajes totales | hoy ${today?.messages ?? 0} | últimos 7 días ${last7}\n👥 ${activeUsers} usuarios activos${topLine}`,
      parseMode: "Markdown",
    };
  }

  private async recordActivity(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<void> {
    if (!context.chatId || update.kind !== "message") {
      return;
    }

    await this.analyticsRepository.recordMessage(
      context.tenantId,
      context.chatId,
      dayKeyFromMs(update.receivedAt.getTime()),
    );

    if (update.user.userId && update.isTextMessage) {
      await this.analyticsRepository.recordUserMessage({
        tenantId: context.tenantId,
        chatId: context.chatId,
        telegramUserId: update.user.userId,
        username: update.user.username,
      });
    }
  }

  private async handleInviteCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseInviteCommand(update);

    if (!result) {
      return null;
    }

    if (!context.chatId) {
      return { text: "Las invitaciones se miden dentro de un grupo." };
    }

    if (result.command.kind === "top") {
      const top = await this.inviteRepository.topInviters(context.chatId, 10);
      if (top.length === 0) {
        return { text: "Aún no hay invitaciones registradas." };
      }
      const lines = top.map(
        (stat, index) =>
          `${index + 1}. ${stat.inviterTelegramId.toString()} — ${stat.count} invitados`,
      );
      return { text: `Top invitadores:\n${lines.join("\n")}` };
    }

    if (!update.user.userId) {
      return { text: "No puedo identificarte." };
    }

    const count = await this.inviteRepository.getCount(
      context.chatId,
      update.user.userId,
    );
    return { text: `Has invitado a ${count} miembro(s) a este chat.` };
  }

  private async recordInvites(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<void> {
    if (!context.chatId) {
      return;
    }

    const invited = countInvitedMembers(
      update.user.userId,
      update.newChatMemberIds,
    );

    if (invited === 0 || !update.user.userId) {
      return;
    }

    const stat = await this.inviteRepository.addInvites(
      context.tenantId,
      context.chatId,
      update.user.userId,
      invited,
    );

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "system",
      action: "invite.recorded",
      resourceType: "invite_stat",
      resourceId: update.user.userId.toString(),
      payload: { invited, total: stat.count },
    });
  }

  private async grantActivityXp(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<void> {
    if (!context.chatId || !update.isTextMessage || !update.user.userId) {
      return;
    }

    // One XP grant per user per minute to discourage farming via message spam.
    const key = `xp:${context.chatId}:${update.user.userId.toString()}`;
    const recent = await this.floodCounter.record(key, Date.now(), 60);

    if (recent.length > 1) {
      return;
    }

    const before = await this.reputationRepository.getProfile(
      context.chatId,
      update.user.userId,
    );
    const after = await this.reputationRepository.addXp(
      context.tenantId,
      context.chatId,
      update.user.userId,
      5,
    );

    await this.maybePromoteRank(context, update, before?.rank ?? null);

    const beforeLevel = levelForXp(before?.xp ?? 0);
    const afterLevel = levelForXp(after.xp);

    if (afterLevel > beforeLevel && update.chat.chatId) {
      // Quiet mode: the XP is still granted above, but when the admin has
      // silenced the bot we skip the unprompted "sube al nivel" announcement.
      if (await this.isChatQuiet(context.tenantId, context.chatId)) {
        return;
      }
      try {
        await this.telegramGateway.sendMessage({
          chatId: update.chat.chatId,
          reply: {
            text: `${describeUser(update.user)} sube al nivel ${afterLevel}!`,
          },
          token: this.telegramToken(),
        });
      } catch (error) {
        // El XP ya está concedido; el anuncio es cortesía. Sin este catch, un
        // grupo con el tema General cerrado (TOPIC_CLOSED) perdía además la
        // auditoría de abajo — el nivel subía sin dejar rastro.
        this.logger.warn(
          `nivel: no se pudo anunciar el nivel ${afterLevel} de ${update.user.userId} en ${update.chat.chatId} — ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "system",
        action: "reputation.levelup",
        resourceType: "reputation_profile",
        resourceId: update.user.userId.toString(),
        payload: { level: afterLevel, xp: after.xp },
      });
    }
  }

  /**
   * `/robar` respondiendo al mensaje de alguien.
   *
   * El motor (`resolveSteal`) decide; aqui solo se recogen los datos, se sortea
   * el dado y se aplica el resultado. La separacion es lo que permite probar el
   * desenlace sin base de datos y sin repetir tiradas.
   *
   * Las esperas y la progresion salen del libro mayor, no de una tabla de
   * estado: el apunte del robo ES el registro de que hubo un robo, asi que no
   * hay dos sitios que puedan discrepar.
   */
  private async handleStealCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    currency: GroupCurrencySettings,
    nowMs: number,
  ): Promise<BotReply | null> {
    const tenantId = context.tenantId;
    const chatId = context.chatId as string;
    const ladron = update.user.userId as bigint;

    const settings = parseStealSettings(
      await this.chatSettingRepository
        .getValue(tenantId, chatId, STEAL_SETTINGS_KEY)
        .catch(() => undefined),
    );
    // Los objetos van sueltos entre los argumentos: `/robar @quien navaja` y
    // `/robar navaja` (respondiendo) son los dos validos. Para saber a quien se
    // apunta se coge el primer argumento que NO sea un objeto, o el id se leeria
    // como si fuera un nombre de usuario.
    const args = update.command?.args ?? [];
    const elegidos = args.filter(isShopItemId);
    const victima = await this.resolveCommandTarget(
      update,
      args.find((arg) => !isShopItemId(arg)),
    );
    if (victima === undefined) {
      return {
        text: [
          "¿A quién? Responde a un mensaje suyo con /robar, o escribe /robar @persona.",
          "",
          "Si pusiste su @usuario y aun así no lo pillo, es que todavía no ha escrito nada por aquí: Telegram no me deja buscar a nadie por nombre, solo reconozco a quien ya ha hablado.",
        ].join("\n"),
      };
    }
    const enPurga = await this.isPurgeOpenNow(tenantId, chatId, nowMs);

    const [carteraLadron, carteraVictima, ultimoRobo, ultimaVez, exitos] =
      await Promise.all([
        this.economyRepository.ensureWallet(tenantId, chatId, ladron),
        this.economyRepository.ensureWallet(tenantId, chatId, victima),
        this.economyRepository.lastMovementAt(tenantId, chatId, ladron, [
          "steal-win",
          "fine",
        ]),
        this.economyRepository.lastMovementAt(tenantId, chatId, victima, [
          "steal-loss",
        ]),
        this.economyRepository.countByReason(
          tenantId,
          chatId,
          ladron,
          "steal-win",
        ),
      ]);

    // La inmunidad de una cartera sin fondo se mira ANTES de reclamar el
    // objeto. La decision vive en `resolveSteal` y manda ella, pero alla se
    // llega con la navaja ya gastada, y contra alguien que no es robable NUNCA
    // eso es tirar el objeto cada vez. Los otros rechazos si se comen el
    // objeto, y esta bien: son esperas que pasan.
    const victimaSinFondo = carteraVictima.unlimited === true;
    if (victimaSinFondo) {
      return {
        text: this.describeStealRefusal(
          { refusal: "victim-unlimited" },
          settings,
          currency,
        ),
      };
    }

    const armas = await this.claimStealItems({
      tenantId,
      chatId,
      ladron,
      victima,
      elegidos,
      nowMs,
    });
    if (armas.error) {
      return { text: armas.error };
    }

    // Las fichas CAMBIABLES de la victima cuentan como saldo a efectos de robo.
    //
    // `sellableChips` es el excedente sobre lo comprado con Telegram Stars: lo
    // pagado con dinero real no sale de ahi y por tanto no se puede robar. Ver
    // la cabecera de `CHIP_REASONS` en `packages/data` — aflojar ese limite
    // es lo unico que separa esto de un cash-out.
    //
    // Sin esto, meterlo todo en fichas era la forma de esquivar `/robar`: la
    // caja fuerte tiene tope y el casino no tenia ninguno.
    const fichasVictima = await this.chipRepository.sellableChips(
      tenantId,
      victima,
    );

    const outcome = resolveSteal({
      settings,
      nowMs,
      thiefBalance: carteraLadron.balance,
      victimBalance: carteraVictima.balance,
      victimProtected: carteraVictima.protectedBalance ?? 0,
      // Aqui ya no puede ser cierto —la guarda de arriba corto antes—, pero el
      // dato viaja igual: la regla la manda `resolveSteal` y esta llamada tiene
      // que poder contarle la verdad entera. Si algun dia se quita la guarda,
      // esto sigue tapando el agujero sin que nadie se acuerde.
      victimUnlimited: victimaSinFondo,
      victimSellableChips: fichasVictima.sellable,
      successfulSteals: exitos,
      lastStealMs: ultimoRobo?.getTime(),
      victimLastRobbedMs: ultimaVez?.getTime(),
      samePerson: ladron === victima,
      roll: Math.random(),
      purge: enPurga,
      // Los objetos de la tienda Y los bichos de los dos. Se fusionan en vez de
      // elegir uno: llevar navaja y zorro tiene que ser mejor que cualquiera de
      // los dos por separado.
      modifiers: fusionarModificadores(
        armas.modifiers,
        await modificadoresDeRoboDeLasMascotas({
          mascotas: this.petRepository,
          tenantId,
          chatId,
          ladron,
          victima,
        }),
      ),
    });

    if (!outcome.attempted) {
      // El golpe ni se ha llegado a dar, asi que lo gastado vuelve al cajon.
      // Cobrar una navaja por un "espera 20 minutos" seria quedarse con el
      // objeto mas caro del juego a cambio de nada.
      await this.returnStealItems(
        tenantId,
        chatId,
        ladron,
        armas.gastados,
        nowMs,
      );
      // El comodin SI se gasta: ha hecho su trabajo, que es parar el golpe.
      if (outcome.refusal === "immune") {
        await this.spendDefence(tenantId, chatId, victima, armas, nowMs, {
          success: false,
          blocked: true,
        });
      }
      return { text: this.describeStealRefusal(outcome, settings, currency) };
    }

    // Lo defensivo que haya saltado se gasta ahora, con el desenlace ya sabido.
    const defensaGastada = await this.spendDefence(
      tenantId,
      chatId,
      victima,
      armas,
      nowMs,
      { success: outcome.success },
    );

    // La serpiente a veces no gasta el objeto cuando el golpe falla. Va aqui y
    // no dentro de `resolveSteal` porque el motor no toca inventarios: decide
    // el robo y quien tiene el cajon lo aplica.
    if (
      !outcome.success &&
      armas.gastados.length > 0 &&
      (await salvaElObjetoAlFallar({
        mascotas: this.petRepository,
        tenantId,
        chatId,
        ladron,
        tirada: Math.random(),
      }))
    ) {
      await this.returnStealItems(
        tenantId,
        chatId,
        ladron,
        armas.gastados,
        nowMs,
      );
    }

    const refId = this.claveDeterminista(update, "steal");
    // El botin se dice desglosado: monedas y fichas son dos libros distintos y
    // llamarlo todo "monedas" era falso en cuanto la victima tenia el dinero en
    // el casino. Con 0 fichas el texto es exactamente el de antes.
    const botinDe = (total: number, deFichas: number): string =>
      describirBotin({
        total,
        deFichas,
        formatMonedas: (cantidad) => formatCurrency(cantidad, currency),
      });
    if (outcome.success) {
      // El botin puede salir de dos sitios. `amountFromChips` es lo que sale
      // de las fichas y el resto, de las monedas — la decision cobra monedas
      // primero, asi que con una victima normal esto es 0 y no cambia nada.
      // Lo que hacen los bichos con el golpe ya dado: apuntar la deuda para
      // que el caracol la devuelva con los dias, y quiza llevarse un objeto si
      // el ladron tiene mapache. Se traga sus fallos: el botin ya se ha
      // movido, y propagar aqui dejaria a alguien robado y sin mensaje.
      const extraDelBicho = await trasUnRoboConExito({
        mascotas: this.petRepository,
        inventario: this.inventoryRepository,
        tenantId,
        chatId,
        ladron,
        victima,
        botin: outcome.amount,
        tirada: Math.random(),
        nowMs,
      });
      const enMonedas = outcome.amount - outcome.amountFromChips;
      const res =
        enMonedas > 0
          ? await this.economyRepository.move({
              tenantId,
              chatId,
              fromId: victima,
              toId: ladron,
              amount: enMonedas,
              fromReason: "steal-loss",
              toReason: "steal-win",
              refId,
            })
          : { ok: true as const };
      // Las fichas van con SU propio refId: son otro libro mayor, y compartir
      // clave haria que el unique de uno tapara el movimiento del otro.
      if (res.ok && outcome.amountFromChips > 0) {
        const fichas = await this.chipRepository.transfer(
          tenantId,
          victima,
          ladron,
          outcome.amountFromChips,
          `${refId}:fichas`,
        );
        if (!fichas.ok) {
          // Las fichas cambiaron entre la lectura y el movimiento. Si las
          // monedas ya se movieron, ese trozo del golpe vale; lo que no se
          // hace es reintentar, por lo mismo que abajo.
          //
          // Y hay que DECIR lo que si se llevo: el mensaje anterior sonaba a
          // que no se habia llevado nada, y quien lo leia no entendia por que
          // le habia subido el saldo.
          return {
            text:
              enMonedas > 0
                ? `🥷 Le has robado ${botinDe(enMonedas, 0)}, pero las fichas se le han escapado en el último momento.`
                : "Se te ha escapado en el último momento con las fichas.",
          };
        }
      }
      if (!res.ok) {
        // El saldo cambio entre la lectura y el movimiento. No se reintenta: el
        // golpe se da con la foto que habia, y volver a intentarlo saltandose el
        // cooldown seria un premio por llegar tarde.
        return { text: "Se te ha escapado en el último momento." };
      }
      // El seguro se paga acuñando, no quitandoselo al ladron: si saliera de
      // el, seria un castigo por un golpe que le salio bien y estaria pagando
      // dos veces. Cuesta 600 y devuelve como mucho 250, asi que la tienda
      // sigue quemando mas de lo que crea.
      //
      // Y devuelve de CADA libro lo que se llevo de cada libro. Pagar un
      // porcentaje del total SOLO en monedas convertia fichas en monedas a
      // 1:1, que es justo el cambio que `monedasPorFicha` y la comision de
      // venta existen para controlar: 498 fichas robadas devolvian 250 monedas
      // acuñadas. Eso no es un seguro, es una casa de cambio sin comision.
      let devuelto = 0;
      let devueltoEnFichas = 0;
      if (defensaGastada.includes("seguro")) {
        devuelto = Math.floor((enMonedas * SEGURO_PCT) / 100);
        devueltoEnFichas = Math.floor(
          (outcome.amountFromChips * SEGURO_PCT) / 100,
        );
        if (devuelto > 0) {
          await this.economyRepository.credit(
            tenantId,
            chatId,
            victima,
            devuelto,
            "insurance",
            refId,
          );
        }
        if (devueltoEnFichas > 0) {
          // Clave propia, como el movimiento de fichas: son dos libros y
          // compartir clave haria que el unique de uno tapara al otro.
          await this.chipRepository.credit(
            tenantId,
            victima,
            devueltoEnFichas,
            "insurance",
            `${refId}:seguro-fichas`,
          );
        }
      }
      const alMarcador = await this.pushPurgePlay(
        { tenantId, chatId, update, nowMs, currency },
        {
          thiefId: ladron,
          victimId: victima,
          amount: outcome.amount,
          fromChips: outcome.amountFromChips,
          success: true,
        },
      );
      if (alMarcador) {
        return null;
      }
      return {
        text: [
          `🥷 Le has robado ${botinDe(outcome.amount, outcome.amountFromChips)}. (Probabilidad: ${outcome.chancePct}%)`,
          // Si el bicho se ha llevado ademas un objeto hay que decirlo: un
          // objeto que cambia de dueño en silencio se descubre el dia que
          // alguien va a usarlo y no esta.
          ...(extraDelBicho.objeto !== null
            ? [
                `🦝 Tu bicho ha aprovechado y se ha llevado también: ${SHOP_BY_ID.get(extraDelBicho.objeto as ShopItemId)?.nombre ?? extraDelBicho.objeto}.`,
              ]
            : []),
          ...(devuelto > 0 || devueltoEnFichas > 0
            ? [
                `📄 Tenía seguro: recupera ${botinDe(devuelto + devueltoEnFichas, devueltoEnFichas)}.`,
              ]
            : []),
        ].join("\n"),
      };
    }

    if (outcome.amount === 0) {
      // Guante: fallar no ha costado nada, asi que no hay nada que mover ni
      // victima a la que compensar. Llamar a `move` con 0 no romperia nada,
      // pero contestaria "ni para la multa te llega", que es justo lo contrario
      // de lo que ha pasado.
      return {
        text: `🧤 Te han pillado, pero llevabas guante y te has ido de vacío sin pagar. (Probabilidad: ${outcome.chancePct}%)`,
      };
    }

    // Al fallar, la multa va a la victima como compensacion. Es un movimiento
    // entre dos personas, asi que va por `move` y deja las dos patas anotadas.
    const res = await this.economyRepository.move({
      tenantId,
      chatId,
      fromId: ladron,
      toId: victima,
      amount: outcome.amount,
      fromReason: "fine",
      toReason: "fine-payout",
      refId,
    });
    if (res.ok) {
      const alMarcador = await this.pushPurgePlay(
        { tenantId, chatId, update, nowMs, currency },
        {
          thiefId: ladron,
          victimId: victima,
          amount: outcome.amount,
          success: false,
        },
      );
      if (alMarcador) {
        return null;
      }
    }
    return {
      text: [
        res.ok
          ? `🚨 Te han pillado. Pagas ${formatCurrency(outcome.amount, currency)} a tu víctima. (Probabilidad: ${outcome.chancePct}%)`
          : "🚨 Te han pillado, pero ni para la multa te llega.",
        ...(defensaGastada.includes("espejo") && res.ok
          ? ["🪞 Llevaba espejo: la multa te ha salido al doble."]
          : []),
      ].join("\n"),
    };
  }

  /**
   * Gasta lo defensivo que haya saltado en un golpe y dice que se gasto.
   *
   * El escudo no entra nunca: dura 24 h y no se consume por golpe recibido, que
   * es exactamente lo que se compra. Lo decide `spentDefenceOf` en el catalogo,
   * no este metodo.
   */
  private async spendDefence(
    tenantId: string,
    chatId: string,
    victima: bigint,
    armas: { defensaVictima: readonly OwnedItem[] },
    nowMs: number,
    desenlace: { success: boolean; blocked?: boolean },
  ): Promise<readonly ShopItemId[]> {
    const gastar = spentDefenceOf({
      defensaVictima: armas.defensaVictima,
      nowMs,
      success: desenlace.success,
      ...(desenlace.blocked !== undefined
        ? { blocked: desenlace.blocked }
        : {}),
    });
    const gastados: ShopItemId[] = [];
    for (const id of gastar) {
      const res = await this.inventoryRepository
        .consume({
          tenantId,
          chatId,
          userTelegramId: victima,
          itemId: id,
          nowMs,
        })
        .catch(() => ({ ok: false, remaining: 0 }));
      if (res.ok) {
        gastados.push(id);
      }
    }
    return gastados;
  }

  /**
   * El inventario de alguien, ya filtrado a objetos que el catalogo reconoce.
   *
   * Una fila con un `itemId` que ya no existe (un objeto retirado del catalogo)
   * se ignora en vez de reventar: la tabla sobrevive a los cambios de catalogo
   * y no al reves.
   */
  private async ownedShopItems(
    tenantId: string,
    chatId: string,
    userId: bigint,
  ): Promise<OwnedItem[]> {
    const filas = await this.inventoryRepository
      .list(tenantId, chatId, userId)
      .catch(() => [] as readonly InventoryItem[]);
    return filas
      .filter((fila) => isShopItemId(fila.itemId))
      .map((fila) => ({
        itemId: fila.itemId as ShopItemId,
        uses: fila.uses,
        ...(fila.expiresAtMs !== undefined
          ? { expiresAtMs: fila.expiresAtMs }
          : {}),
        ...(fila.payload !== undefined ? { payload: fila.payload } : {}),
      }));
  }

  /**
   * Reserva los objetos de un golpe y traduce a numeros lo que llevan los dos.
   *
   * Se gastan ANTES de tirar el dado y no despues, y esa es la parte que de
   * verdad importa: `consume` es atomico, asi que dos `/robar` a la vez con la
   * misma navaja solo pueden gastarla una vez. Comprobando primero y gastando
   * al final, los dos pasarian la comprobacion y el objeto valdria doble.
   *
   * Lo defensivo de la victima NO se toca aqui: el escudo dura lo que dura y no
   * se gasta por golpe recibido, que es justo lo que se compra.
   */
  private async claimStealItems(input: {
    tenantId: string;
    chatId: string;
    ladron: bigint;
    victima: bigint;
    elegidos: readonly ShopItemId[];
    nowMs: number;
  }): Promise<{
    error?: string;
    modifiers: StealModifiers;
    gastados: readonly ShopItemId[];
    defensaVictima: readonly OwnedItem[];
  }> {
    const { tenantId, chatId, ladron, victima, nowMs } = input;
    const tienda = await this.groupShopSettings(tenantId, chatId);
    // Repetir el mismo objeto no lo aplica dos veces; sin esto, `/robar @x
    // navaja navaja` gastaria dos y sumaria una.
    const pedidos = [...new Set(input.elegidos)];

    if (!tienda.enabled) {
      return {
        modifiers: {},
        gastados: [],
        defensaVictima: [],
        ...(pedidos.length > 0
          ? { error: "En este grupo no hay tienda, así que nada de objetos." }
          : {}),
      };
    }

    const apagados = new Set(tienda.apagados);
    for (const id of pedidos) {
      const item = SHOP_BY_ID.get(id);
      if (!item || apagados.has(id)) {
        return {
          modifiers: {},
          gastados: [],
          defensaVictima: [],
          error: `${item?.nombre ?? "Eso"} no se vende en este grupo.`,
        };
      }
      // Lo defensivo se aplica solo cuando te roban; elegirlo para atacar es un
      // malentendido que conviene contar, no ignorar en silencio.
      if (item.familia !== "ataque") {
        return {
          modifiers: {},
          gastados: [],
          defensaVictima: [],
          error: `${item.nombre} no se usa para robar: eso salta solo cuando te roban a ti.`,
        };
      }
    }

    const enElCajon = new Set(
      usableItems(
        await this.ownedShopItems(tenantId, chatId, ladron),
        nowMs,
      ).map((o) => o.itemId),
    );
    const faltante = pedidos.find((id) => !enElCajon.has(id));
    if (faltante !== undefined) {
      return {
        modifiers: {},
        gastados: [],
        defensaVictima: [],
        error: `No tienes ${SHOP_BY_ID.get(faltante)?.nombre ?? faltante}. Se compra con /comprar ${faltante}.`,
      };
    }

    const gastados: ShopItemId[] = [];
    for (const id of pedidos) {
      const res = await this.inventoryRepository.consume({
        tenantId,
        chatId,
        userTelegramId: ladron,
        itemId: id,
        nowMs,
      });
      if (!res.ok) {
        // Alguien lo gasto entre la lectura y el cobro. Se devuelve lo ya
        // reservado y no se roba: media ventaja no es la que se pidio.
        await this.returnStealItems(tenantId, chatId, ladron, gastados, nowMs);
        return {
          modifiers: {},
          gastados: [],
          defensaVictima: [],
          error: `Se te ha escapado ${SHOP_BY_ID.get(id)?.nombre ?? id}: ya no te quedaba.`,
        };
      }
      gastados.push(id);
    }

    const defensaVictima = await this.ownedShopItems(tenantId, chatId, victima);
    return {
      modifiers: stealEffectsOf({ elegidos: pedidos, defensaVictima, nowMs }),
      gastados,
      defensaVictima,
    };
  }

  /** Devuelve al cajon lo que se reservo para un golpe que no llego a darse. */
  private async returnStealItems(
    tenantId: string,
    chatId: string,
    userId: bigint,
    items: readonly ShopItemId[],
    nowMs: number,
  ): Promise<void> {
    for (const id of items) {
      await this.inventoryRepository
        .grant({
          tenantId,
          chatId,
          userTelegramId: userId,
          itemId: id,
          addUses: 1,
          nowMs,
        })
        .catch(() => undefined);
    }
  }

  /**
   * Manda una jugada al marcador de la purga en vez de responder con un mensaje.
   *
   * Devuelve `true` si la jugada se llevo al marcador, y entonces quien llama NO
   * debe responder nada: ese es el cambio que evita que cinco minutos de purga
   * dejen el chat inservible.
   *
   * Devuelve `false` cuando no hay marcador (fuera de purga, o si el mensaje no
   * se pudo publicar al abrir), y ahi se responde como siempre. Nadie se queda
   * sin saber que paso.
   */
  private async pushPurgePlay(
    ctx: {
      tenantId: string;
      chatId: string;
      update: TelegramUpdateEnvelope;
      nowMs: number;
      currency: GroupCurrencySettings;
    },
    jugada: {
      thiefId: bigint;
      victimId: bigint;
      amount: number;
      /** Cuanto de `amount` salio de las fichas. Ausente al fallar: la multa
       * la paga el ladron de sus monedas. */
      fromChips?: number;
      success: boolean;
    },
  ): Promise<boolean> {
    const telegramChatId = ctx.update.chat.chatId;
    if (!telegramChatId) {
      return false;
    }
    const [ajustes, estado] = await Promise.all([
      this.chatSettingRepository
        .getValue(ctx.tenantId, ctx.chatId, PURGE_SETTINGS_KEY)
        .catch(() => undefined),
      this.chatSettingRepository
        .getValue(ctx.tenantId, ctx.chatId, PURGE_STATE_KEY)
        .catch(() => undefined),
    ]);
    const settings = parsePurgeSettings(ajustes);
    const state = parsePurgeState(estado);
    if (
      state.boardMessageId === undefined ||
      state.openedAtMs === undefined ||
      !isPurgeOpen(state, settings, ctx.nowMs)
    ) {
      return false;
    }

    const nombres = await this.repository
      .findDisplayNamesByTelegramUserIds([jugada.thiefId, jugada.victimId])
      .catch(() => new Map<string, string>());
    const quien = (id: bigint): string =>
      nombres.get(id.toString()) ?? id.toString();

    const previas = this.purgePlays.get(ctx.chatId) ?? [];
    this.purgePlays.set(ctx.chatId, [
      {
        thief: quien(jugada.thiefId),
        victim: quien(jugada.victimId),
        amount: jugada.amount,
        ...(jugada.fromChips !== undefined
          ? { fromChips: jugada.fromChips }
          : {}),
        success: jugada.success,
      },
      // Se guardan unas pocas mas de las que se enseñan, por si un dia el
      // marcador quiere crecer; mas alla de eso es memoria tirada.
      ...previas.slice(0, 9),
    ]);

    // El comando del usuario ocupa tanto como ocupaba la respuesta. Borrarlo es
    // la otra mitad de vaciar el chat.
    if (ctx.update.messageId) {
      await this.telegramGateway
        .deleteMessage({
          chatId: telegramChatId,
          messageId: ctx.update.messageId,
          token: this.telegramToken(),
        })
        .catch(() => undefined);
    }

    await this.refreshPurgeBoard({
      tenantId: ctx.tenantId,
      chatId: ctx.chatId,
      telegramChatId,
      boardMessageId: state.boardMessageId,
      openedAtMs: state.openedAtMs,
      durationMinutes: settings.durationMinutes,
      currency: ctx.currency,
      nowMs: ctx.nowMs,
    });
    return true;
  }

  /**
   * A quien apunta un comando de economia: por respuesta, por mencion pinchada,
   * por `@usuario` escrito o por id.
   *
   * Las dos primeras vias son gratis; el `@usuario` escrito NO lo es. La Bot API
   * no tiene busqueda por nombre, asi que solo se puede resolver contra la gente
   * que ya ha hablado por aqui — de ahi que pueda fallar con alguien real, y que
   * el mensaje de "no se quien es" tenga que explicarlo en vez de sonar a que la
   * persona no existe.
   */
  private async resolveCommandTarget(
    update: TelegramUpdateEnvelope,
    arg: string | undefined,
  ): Promise<bigint | undefined> {
    const directo =
      extractReplyContext(update.raw).userId ??
      extractMentionTargetId(update.raw);
    if (directo !== undefined) {
      return directo;
    }
    if (!arg) {
      return undefined;
    }
    if (/^\d{5,}$/u.test(arg)) {
      return BigInt(arg);
    }
    if (arg.startsWith("@") && arg.length > 1) {
      return (
        (await this.repository
          .findTelegramUserIdByUsername(arg.slice(1))
          .catch(() => undefined)) ?? undefined
      );
    }
    return undefined;
  }

  /**
   * Las ultimas jugadas de la purga en curso, por chat.
   *
   * En memoria a proposito: solo viven los cinco minutos del evento y son
   * puramente decorativas —el dinero ya esta en el libro mayor, que es la
   * verdad—. Perderlas en un redespliegue cuesta que el marcador arranque
   * vacio, y eso no justifica una tabla.
   */
  private readonly purgePlays = new Map<string, PurgePlay[]>();

  /**
   * Cuando se edito por ultima vez el marcador de cada chat.
   *
   * Editar en cada robo era lo natural y es justo lo que no se puede hacer:
   * Telegram devuelve 429 enseguida con varias personas robando a la vez. Se
   * agrupa: como mucho una edicion cada BOARD_MIN_EDIT_MS.
   */
  private readonly purgeBoardLastEdit = new Map<string, number>();
  private static readonly BOARD_MIN_EDIT_MS = 2500;

  /**
   * Refresca el marcador de la purga, como mucho una vez cada 2,5 s por chat.
   *
   * La ultima jugada de una tanda puede quedarse sin pintar si cae dentro de la
   * ventana de agrupado. No se arregla con un temporizador porque el cierre de
   * la purga vuelve a dibujar el marcador con el estado final, asi que lo que
   * se pierde es como mucho un parpadeo intermedio.
   */
  private async refreshPurgeBoard(input: {
    tenantId: string;
    chatId: string;
    telegramChatId: bigint;
    boardMessageId: number;
    openedAtMs: number;
    durationMinutes: number;
    currency: GroupCurrencySettings;
    nowMs: number;
    force?: boolean;
  }): Promise<void> {
    const clave = input.chatId;
    const ultima = this.purgeBoardLastEdit.get(clave) ?? 0;
    if (
      !input.force &&
      input.nowMs - ultima < BotUpdateService.BOARD_MIN_EDIT_MS
    ) {
      return;
    }
    this.purgeBoardLastEdit.set(clave, input.nowMs);

    const desde = new Date(input.openedAtMs);
    const hasta = new Date(input.nowMs);
    const ladrones = await this.economyRepository
      .rankByReasonBetween(
        input.tenantId,
        input.chatId,
        "steal-win",
        desde,
        hasta,
        3,
      )
      .catch(() => []);
    const nombres = await this.repository
      .findDisplayNamesByTelegramUserIds(ladrones.map((f) => f.userTelegramId))
      .catch(() => new Map<string, string>());
    const movido = ladrones.reduce((suma, fila) => suma + fila.balance, 0);
    const finMs = input.openedAtMs + input.durationMinutes * 60_000;

    await this.telegramGateway
      .editMessageText({
        chatId: input.telegramChatId,
        messageId: input.boardMessageId,
        token: this.telegramToken(),
        reply: {
          parseMode: "HTML",
          text: renderPurgeBoard({
            remainingSeconds: Math.max(0, (finMs - input.nowMs) / 1000),
            totalMoved: movido,
            plays: this.purgePlays.get(clave) ?? [],
            top: ladrones.map((fila) => ({
              name:
                nombres.get(fila.userTelegramId.toString()) ??
                fila.userTelegramId.toString(),
              amount: fila.balance,
            })),
            formatAmount: (n) => formatCurrency(n, input.currency),
          }),
        },
      })
      // Un marcador que no se refresca no puede tumbar un robo que ya ocurrio.
      .catch(() => undefined);
  }

  /**
   * Corta una purga abierta: borra `openedAtMs` y deja el marcador cerrado.
   *
   * NO programa la siguiente. Eso es del worker, y meterlo aqui seria el
   * segundo sitio donde olvidarse de hacerlo. Al quedar el chat sin purga
   * abierta y sin siguiente, el worker sortea una nueva en su proximo tick,
   * que es exactamente lo que hace con un chat que acaba de encender la purga.
   */
  private async cerrarPurgaAMano(
    tenantId: string,
    chatId: string,
    update: TelegramUpdateEnvelope,
    ajustes: ReturnType<typeof parsePurgeSettings>,
    nowMs: number,
  ): Promise<BotReply> {
    const estado = parsePurgeState(
      await this.chatSettingRepository
        .getValue(tenantId, chatId, PURGE_STATE_KEY)
        .catch(() => undefined),
    );
    if (estado.openedAtMs === undefined) {
      return { text: "No hay ninguna purga en marcha." };
    }

    // El marcador se cierra ANTES de borrar el estado: despues ya no se sabria
    // que mensaje editar, y quedaria una cuenta atras corriendo para siempre en
    // un chat donde no se puede robar.
    const telegramChatId = update.chat.chatId;
    if (telegramChatId !== undefined && estado.boardMessageId !== undefined) {
      await this.refreshPurgeBoard({
        tenantId,
        chatId,
        telegramChatId,
        boardMessageId: estado.boardMessageId,
        // Con el arranque corrido hacia atras, al marcador le quedan 0 segundos
        // y se pinta solo como terminado.
        openedAtMs: nowMs - ajustes.durationMinutes * 60_000,
        durationMinutes: ajustes.durationMinutes,
        currency: parseGroupCurrencySettings(
          await this.chatSettingRepository
            .getValue(tenantId, chatId, GROUP_CURRENCY_SETTINGS_KEY)
            .catch(() => undefined),
        ),
        nowMs,
        force: true,
      }).catch(() => undefined);
    }

    await this.chatSettingRepository.setValue(
      tenantId,
      chatId,
      PURGE_STATE_KEY,
      {},
    );
    this.purgePlays.delete(chatId);
    return { text: "🔒 Purga cortada. Ya no se puede robar sin esperas." };
  }

  /** Si hay una purga abierta en este chat ahora mismo. */
  private async isPurgeOpenNow(
    tenantId: string,
    chatId: string,
    nowMs: number,
  ): Promise<boolean> {
    const [ajustes, estado] = await Promise.all([
      this.chatSettingRepository
        .getValue(tenantId, chatId, PURGE_SETTINGS_KEY)
        .catch(() => undefined),
      this.chatSettingRepository
        .getValue(tenantId, chatId, PURGE_STATE_KEY)
        .catch(() => undefined),
    ]);
    return isPurgeOpen(
      parsePurgeState(estado),
      parsePurgeSettings(ajustes),
      nowMs,
    );
  }

  /**
   * `/purga` — la abre a mano un admin. `/purga off` la corta.
   *
   * Abrir solo escribe `openedAtMs`, y **programar la siguiente sigue siendo
   * cosa del worker**: dos caminos para programar serian dos sitios donde
   * olvidarse. Cortarla tampoco programa nada — borra `openedAtMs` y ya esta,
   * y el worker se encuentra un chat sin purga abierta ni siguiente y sortea la
   * proxima como hace siempre.
   *
   * El corte existe porque no habia ninguno. Una purga puesta a treinta minutos
   * no se podia parar: ni con el comando, ni apagandola en los ajustes (eso lo
   * arregla `isPurgeOpen`, aparte). La unica via era borrar la fila a mano en
   * produccion, que es justo lo que `/darfichas` y `/ajustarsaldo` existen
   * para no tener que hacer.
   */
  private async handlePurgeCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    nowMs: number,
  ): Promise<BotReply> {
    const tenantId = context.tenantId;
    const chatId = context.chatId as string;
    if (!(await this.isActorAdmin(context, update))) {
      return { text: "Solo un administrador puede lanzar la purga." };
    }
    const ajustes = parsePurgeSettings(
      await this.chatSettingRepository
        .getValue(tenantId, chatId, PURGE_SETTINGS_KEY)
        .catch(() => undefined),
    );

    const accion = (update.command?.args?.[0] ?? "").toLowerCase();
    if (accion === "off" || accion === "fin" || accion === "parar") {
      return await this.cerrarPurgaAMano(
        tenantId,
        chatId,
        update,
        ajustes,
        nowMs,
      );
    }

    // Apagada no se abre. Antes si se abria, y desde que `isPurgeOpen` respeta
    // `enabled` eso produciria una purga inerte: el anuncio saldria, la cuenta
    // atras correria y robar seguiria teniendo esperas y escudos. Un comando
    // que dice que ha empezado algo que no ha empezado es peor que uno que se
    // niega.
    //
    // Comprobado antes de ponerlo: los dos grupos vivos la tienen encendida,
    // asi que esto no le quita el comando a nadie.
    if (!ajustes.enabled) {
      return {
        text: "La purga está apagada en este grupo. Enciéndela en /settings → Economía y juegos.",
      };
    }

    if (await this.isPurgeOpenNow(tenantId, chatId, nowMs)) {
      return { text: "La purga ya está en marcha. Para cortarla: /purga off." };
    }
    await this.chatSettingRepository.setValue(
      tenantId,
      chatId,
      PURGE_STATE_KEY,
      { openedAtMs: nowMs },
    );
    return {
      parseMode: "Markdown",
      text: [
        "🚨 *LA PURGA HA EMPEZADO* 🚨",
        "",
        `Durante ${ajustes.durationMinutes} minutos: sin esperas, sin escudos y con más probabilidad de éxito.`,
        "Responde a alguien con /robar.",
      ].join("\n"),
    };
  }

  /** El "no" del robo, en español y diciendo cuánto falta cuando aplica. */
  private describeStealRefusal(
    outcome: { refusal?: string; retryAfterSeconds?: number },
    settings: { minVictimBalance: number },
    currency: GroupCurrencySettings,
  ): string {
    // En segundos por debajo del minuto. Redondear siempre a minutos venia de
    // cuando la unica espera eran 30 min; con la espera corta de la purga,
    // "espera 1 min" para 10 segundos es sencillamente falso.
    const restante = outcome.retryAfterSeconds ?? 0;
    const espera =
      restante < 60 ? `${restante} s` : `${Math.ceil(restante / 60)} min`;
    switch (outcome.refusal) {
      case "disabled":
        return "Robar está desactivado en este grupo.";
      case "self":
        return "Robarte a ti mismo no te hace más rico.";
      case "cooldown":
        return `Acabas de dar un golpe. Espera ${espera}.`;
      case "shielded":
        return `A esa persona ya le robaron hace poco. Déjala respirar ${espera}.`;
      case "immune":
        return "🃏 Llevaba comodín: hoy es intocable. Se lo has gastado, eso sí.";
      case "victim-unlimited":
        return "Ahí no hay nada que rascar: esa cartera no se mueve, así que no hay nada que llevarse.";
      case "victim-too-poor":
        return `No tiene bastante como para que merezca la pena (hace falta que tenga ${formatCurrency(settings.minVictimBalance, currency)}).`;
      case "thief-broke":
        return "No tienes ni para pagar la multa si te pillan. Gana algo primero.";
      default:
        return "Ahora mismo no puedes robar.";
    }
  }

  /**
   * Los ajustes de la moneda de este chat, con defaults si no hay nada.
   *
   * `nowMs` sirve para el nombre comprado en la tienda, que caduca solo. Es
   * opcional porque hay llamadas que no tienen reloj a mano y a las que el
   * nombre les da igual; ahi se ve el de siempre, que nunca es una mentira.
   */
  private async groupCurrencySettings(
    tenantId: string,
    chatId: string,
    nowMs?: number,
  ): Promise<GroupCurrencySettings> {
    const raw = await this.chatSettingRepository
      .getValue(tenantId, chatId, GROUP_CURRENCY_SETTINGS_KEY)
      .catch(() => undefined);
    const settings = parseGroupCurrencySettings(raw);
    return nowMs === undefined ? settings : applyTemporaryName(settings, nowMs);
  }

  /**
   * Reparte la moneda del grupo por participar.
   *
   * Tres frenos, y cada uno tapa un agujero distinto: la longitud minima deja
   * fuera los "ok", el cooldown impide convertir una rafaga en una nomina, y el
   * cupo diario pone techo a quien se pase el dia dandole. Sin los tres, la
   * moneda la acaba teniendo quien mas escribe, no quien mas participa.
   *
   * Los comandos no cuentan: si contaran, `/saldo` cada minuto seria una fuente
   * de ingresos, y encima la mas aburrida.
   */
  private async grantActivityCurrency(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<void> {
    const texto = update.messageText;
    if (
      !context.chatId ||
      !update.isTextMessage ||
      !update.user.userId ||
      !texto ||
      update.command
    ) {
      return;
    }

    const settings = await this.groupCurrencySettings(
      context.tenantId,
      context.chatId,
    );
    if (!settings.enabled) {
      return;
    }
    if ([...texto.trim()].length < settings.minCaracteres) {
      return;
    }

    const nowMs = update.receivedAt.getTime();
    if (settings.cooldownSegundos > 0) {
      const key = `coin:${context.chatId}:${update.user.userId.toString()}`;
      const recent = await this.floodCounter.record(
        key,
        nowMs,
        settings.cooldownSegundos,
      );
      if (recent.length > 1) {
        return;
      }
    }

    const DAY_MS = 24 * 60 * 60 * 1000;
    const inicioDelDia = new Date(Math.floor(nowMs / DAY_MS) * DAY_MS);
    const ganadoHoy = await this.economyRepository.earnedSince(
      context.tenantId,
      context.chatId,
      update.user.userId,
      inicioDelDia,
    );

    // El doblon multiplica lo que se gana por mensaje, NO el cupo diario. Si
    // subiera el cupo, comprarlo seria imprimir monedas; asi lo unico que hace
    // es que llegues antes al techo del dia, que es lo que se vende: ganar mas
    // rapido, no ganar mas.
    const conDoblon = usableItems(
      await this.ownedShopItems(
        context.tenantId,
        context.chatId,
        update.user.userId,
      ),
      nowMs,
    ).some((o) => o.itemId === "doblon");

    // `earnPoints` es quien sabe cuanto cabe en el cupo. Se le pasa una cartera
    // en blanco a proposito: aqui solo interesa `granted`, porque el saldo de
    // verdad lo mueve `credit` con su apunte en el libro mayor.
    const { granted } = earnPoints(
      { balance: 0, lastEarnedMs: 0 },
      settings.porMensaje * (conDoblon ? DOBLON_MULTIPLICADOR : 1),
      nowMs,
      settings.cupoDiario,
      ganadoHoy,
    );
    if (granted <= 0) {
      return;
    }

    // Reserva por UPDATE, ademas de la clave por minuto de abajo.
    //
    // Las dos hacen falta y protegen de cosas distintas. La clave `m<minuto>`
    // es el limite de tasa —como mucho un apunte por minuto y persona— y por
    // eso no se puede sustituir. Pero como depende del reloj, un reintento que
    // cruce la frontera del minuto genera otra clave y **pagaria dos veces**.
    // El `updateId` no cambia entre intentos y cierra justo ese hueco.
    //
    // Al reves —reservar y que luego falle el abono— se pierde ese punto. Es
    // deliberado: con dinero, no pagar de mas vale mas que no dejar de pagar.
    const primeraVez = await this.repository.reservarEjecucionUnica({
      tenantId: context.tenantId,
      namespace: "economia.mensaje",
      key: `${context.chatId}:${update.updateId}`,
      expiraEn: new Date(nowMs + 24 * 60 * 60 * 1000),
    });
    if (!primeraVez) {
      return;
    }

    await this.economyRepository.credit(
      context.tenantId,
      context.chatId,
      update.user.userId,
      granted,
      "earn",
      // Como mucho un apunte por minuto y persona: si el mismo update se
      // reprocesa, el unique del libro mayor lo para en vez de pagar dos veces.
      `m${Math.floor(nowMs / 60_000)}`,
    );
  }

  private async ensureConfigPermission(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    action: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const isAdmin = await this.isActorAdmin(context, update);
    const role = isAdmin ? "admin" : this.resolveActorRole(context, update);
    const decision = evaluatePolicy(
      {
        role,
        permissions: [],
        isTelegramAdmin: isAdmin,
        moduleEnabled: true,
      },
      "config.write",
      { moduleName: "security" },
    );

    if (!decision.allowed) {
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: update.user.userId ? "user" : "system",
        action: `${action}.denied`,
        resourceType: "config_command",
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { reason: decision.reason },
      });
    }

    return decision.allowed
      ? { allowed: true }
      : {
          allowed: false,
          ...(decision.reason ? { reason: decision.reason } : {}),
        };
  }

  /**
   * Template variables ({fillings}) shared by notes, filters and welcomes.
   * For service messages such as goodbye, callers can pass the affected member
   * instead of the admin/bot that generated the Telegram event.
   */
  private templateVars(
    update: TelegramUpdateEnvelope,
    user = update.user,
  ): Record<string, string> {
    const name = user.firstName ?? user.username ?? "amigo";
    return {
      first_name: name,
      name,
      username: user.username ?? "",
      mention: user.username ? `@${user.username}` : name,
      chat_title: update.chat.chatTitle ?? "el grupo",
      id: user.userId?.toString() ?? "",
    };
  }

  /**
   * Rose-style reply targeting: if a moderation command is sent as a reply and
   * its first argument is not an explicit numeric user id, rewrite the args to
   * prepend the replied-to user's id. This lets `/ban`, `/warn spam`, `/mute 1h`
   * etc. target by replying instead of pasting an id, without changing the pure
   * parsers.
   */
  private async withReplyTarget(
    update: TelegramUpdateEnvelope,
    context?: FoundationContext,
  ): Promise<TelegramUpdateEnvelope> {
    const command = update.command;
    if (!command) {
      return update;
    }

    const args = command.args;
    const firstIsId = Boolean(args[0] && /^-?\d+$/u.test(args[0]));

    // An explicit numeric id always wins.
    if (firstIsId) {
      return update;
    }

    const withTarget = (id: bigint, replaceFirst: boolean) => ({
      ...update,
      command: {
        ...command,
        args: replaceFirst
          ? [id.toString(), ...args.slice(1)]
          : [id.toString(), ...args],
      },
    });

    // 1) Reply targeting: prepend the replied-to user's id.
    const replyUserId = extractReplyContext(update.raw).userId;
    if (replyUserId) {
      return withTarget(replyUserId, false);
    }

    // 2) text_mention entity (picked from the mention autocomplete).
    const mentionId = extractMentionTargetId(update.raw);
    if (mentionId) {
      return withTarget(mentionId, false);
    }

    // 3) A typed @username: resolve it to an id and replace the @username arg.
    //
    // Two stores, because neither alone covers a real group. `users` only holds
    // people who have interacted with the bot directly, so an admin typing
    // `/fban @alguien` about a lurker got "necesita el ID" for someone standing
    // right there. The per-chat activity profile knows everyone the bot has
    // SEEN, which is the population an admin is actually moderating.
    const first = args[0];
    if (first?.startsWith("@") && first.length > 1) {
      const handle = first.slice(1);
      const resolved =
        (await this.repository.findTelegramUserIdByUsername(handle)) ??
        (context?.chatId
          ? (
              await this.analyticsRepository.findMemberByUsername?.(
                context.tenantId,
                context.chatId,
                handle,
              )
            )?.telegramUserId
          : undefined);
      if (resolved !== undefined) {
        return withTarget(resolved, true);
      }
    }

    return update;
  }

  /**
   * Creates a warning, then applies Rose-style escalation: shows a running
   * "X/N" counter with an inline "remove warn" button, and when the configured
   * limit is reached applies the policy action (ban/mute/kick/tban/tmute) and
   * resets the counter.
   */
  private async applyWarn(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    target: bigint,
    reason: string | undefined,
  ): Promise<BotReply> {
    if (!context.chatId) {
      return { text: "El sistema de avisos funciona dentro de un grupo." };
    }
    // Red de seguridad de los avisos, y la única que cubre los automáticos: la
    // guarda de objetivo protegido solo está en el camino del comando escrito
    // a mano, así que un aviso de la blocklist llegaba aquí sin pasar por
    // nadie. Antes de `createWarning` a propósito — un aviso guardado y no
    // notificado seguiría contando para la escalada.
    if (this.intocable(target)) {
      return {
        text: textoIntocable(
          "warn",
          await this.describeTarget(update, context, target),
        ),
      };
    }
    const warning = await this.moderationRepository.createWarning({
      tenantId: context.tenantId,
      chatId: context.chatId,
      actorUserId: context.userId,
      subjectTelegramUserId: target,
      reason,
      // Determinista, y con el destinatario dentro: un update puede avisar a
      // dos personas y son dos avisos, pero el mismo aviso reprocesado es uno.
      // El porque entero esta en `CreateWarningInput.claveIdempotencia`.
      claveIdempotencia: this.claveDeterminista(
        update,
        `aviso:${target.toString()}`,
      ),
    });

    const stored = context.chatId
      ? await this.moderationExtraRepository.getWarnPolicy(context.chatId)
      : {
          warnLimit: 3,
          warnMode: "mute",
          durationMs: undefined,
          expireMs: undefined,
        };
    const policy: WarnPolicy = {
      limit: stored.warnLimit,
      mode: stored.warnMode as WarnMode,
      durationMs: stored.durationMs,
      expireMs: stored.expireMs,
    };
    const count = await this.moderationExtraRepository.countActiveWarnings(
      context.tenantId,
      context.chatId,
      target,
    );
    const escalation = decideWarnEscalation(count, policy);

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "moderation.warn.created",
      resourceType: "warning",
      resourceId: warning.recordId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        targetTelegramUserId: target.toString(),
        count,
        limit: policy.limit,
        escalated: escalation.escalate,
      },
    });
    await this.emitOwnerNetworkRoute({
      context,
      sourceChatId: context.chatId,
      eventKind: "moderation_actions",
      fallbackEventKind: "logs",
      title: "Moderación: warn",
      body: [
        `Grupo: ${update.chat.chatId?.toString() ?? context.chatId}`,
        `Usuario: ${target.toString()}`,
        `Warns: ${count}/${policy.limit}`,
        `Motivo: ${reason ?? "sin motivo"}`,
      ].join("\n"),
    });
    await this.recordRiskSignal(context, target, "sanction");

    await this.publicarParteDeSanciones(context, update, {
      action: "warn",
      targetTelegramUserId: target,
      reason,
      warnCount: `${count}/${policy.limit}`,
    });

    if (!escalation.escalate) {
      return {
        text: `⚠️ Aviso ${count}/${policy.limit} · ${await this.describeTarget(update, context, target)}${reason ? ` · ${reason}` : ""}`,
        parseMode: "Markdown",
        replyMarkup: buildRemoveWarnButton(warning.recordId),
      };
    }

    const escalationFailure = await this.applyWarnEscalation(
      context,
      update,
      target,
      escalation.mode,
      escalation.durationMs,
    );
    await this.moderationExtraRepository.resetWarnings(
      context.tenantId,
      context.chatId,
      target,
    );

    if (escalationFailure) {
      return {
        text: `🚫 ${await this.describeTarget(update, context, target)} · ${policy.limit} avisos → *${escalation.mode}* rechazado por Telegram: ${escalationFailure}. Contador reiniciado.`,
        parseMode: "Markdown",
      };
    }

    return {
      text: `🚫 ${await this.describeTarget(update, context, target)} · ${policy.limit} avisos → *${escalation.mode}*. Contador reiniciado.`,
      parseMode: "Markdown",
    };
  }

  /**
   * Applies the warn-limit escalation. Returns a human error string when Telegram
   * rejected the enforcement (so the caller can report it honestly), else null.
   */
  private async applyWarnEscalation(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    target: bigint,
    mode: WarnMode,
    durationMs: number | undefined,
  ): Promise<string | null> {
    const chatId = update.chat.chatId;
    const endsAt = durationMs ? new Date(Date.now() + durationMs) : undefined;

    // La escalada aplica ban/mute/kick igual que los comandos, asi que degrada
    // igual y pasa por el mismo examen. La diferencia con el camino a mano es
    // que aqui no hay nadie mirando, asi que el texto largo de "quitale el
    // cargo primero" no sirve: se resume en el sitio donde se cuentan los
    // fallos de enforcement.
    let cargoDeEscalada: CargoGuardado | undefined;
    if (chatId) {
      const examen = await examinarObjetivo({
        telegram: this.telegramGateway,
        token: this.telegramToken(),
        chatId,
        objetivo: target,
        accion: accionDeEscalada(mode),
        quien: await this.describeTarget(update, context, target),
      });
      if (!examen.permitir) {
        await this.repository.recordAudit({
          tenantId: context.tenantId,
          actorType: "system",
          action: "moderation.command.blocked_admin_target",
          resourceType: "moderation_command",
          resourceId: `warn-escalation:${mode}`,
          payload: { command: mode, targetTelegramUserId: target.toString() },
        });
        return "le dio el cargo una persona y Telegram no me deja, no se le aplica la escalada";
      }
      cargoDeEscalada = examen.cargoGuardado;
    }

    if (mode === "kick") {
      if (chatId) {
        try {
          await this.telegramGateway.banChatMember({
            chatId,
            userId: target,
            token: this.telegramToken(),
            untilDate: undefined,
          });
          await this.telegramGateway.unbanChatMember({
            chatId,
            userId: target,
            token: this.telegramToken(),
            onlyIfBanned: false,
          });
        } catch (error) {
          // Enforcement is best-effort; the warning reset still stands.
          return error instanceof Error ? error.message : "error desconocido";
        }
      }
      return null;
    }

    const action = mode === "ban" || mode === "tban" ? "ban" : "mute";
    await this.moderationRepository.createSanction({
      // Determinista: un reintento del mismo update no crea otra sanción.
      claveIdempotencia: this.claveDeterminista(update, "escalada-aviso"),
      tenantId: context.tenantId,
      chatId: context.chatId,
      actorUserId: context.userId,
      subjectTelegramUserId: target,
      reason: "límite de warns",
      kind: action,
      ...(endsAt ? { endsAt } : {}),
      ...(chatId ? { telegramChatId: chatId } : {}),
      ...(cargoDeEscalada ? { cargoGuardado: cargoDeEscalada } : {}),
    });
    const enforcement = await this.applyTelegramEnforcement(
      action,
      update,
      target,
      endsAt,
    );
    return this.enforcementFailure(enforcement);
  }

  private async handleRemoveWarnCallback(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const parsed = parseRemoveWarnCallback(update.callbackData);

    if (!parsed) {
      return null;
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "moderation.unwarn",
    );

    if (!permission.allowed) {
      return { text: "Solo los administradores pueden quitar warns." };
    }

    const removed = await this.moderationExtraRepository.expireWarning(
      parsed.warnId,
    );

    return {
      text: removed ? "✅ Warn retirado." : "Ese warn ya no estaba activo.",
      edit: true,
    };
  }

  private async handleWarnConfigCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseWarnConfigCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "La configuración de warns se hace en un grupo." };
    }

    const command = result.command;

    if (command.kind === "show") {
      const stored = await this.moderationExtraRepository.getWarnPolicy(
        context.chatId,
      );
      return {
        text: formatWarnPolicy({
          limit: stored.warnLimit,
          mode: stored.warnMode as WarnMode,
          durationMs: stored.durationMs,
          expireMs: stored.expireMs,
        }),
        parseMode: "Markdown",
      };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "warn.config",
    );

    if (!permission.allowed) {
      return {
        text: `No tienes permisos para configurar los warns.`,
      };
    }

    if (command.kind === "setLimit") {
      await this.moderationExtraRepository.setWarnPolicy(
        context.tenantId,
        context.chatId,
        { warnLimit: command.limit },
      );
      return { text: `✅ Límite de warns fijado en ${command.limit}.` };
    }

    if (command.kind === "setMode") {
      await this.moderationExtraRepository.setWarnPolicy(
        context.tenantId,
        context.chatId,
        {
          warnMode: command.mode,
          durationMs: command.durationMs ?? null,
        },
      );
      return { text: `✅ Al alcanzar el límite: ${command.mode}.` };
    }

    await this.moderationExtraRepository.setWarnPolicy(
      context.tenantId,
      context.chatId,
      { expireMs: command.expireMs },
    );
    return {
      text: command.expireMs
        ? "✅ Los warns caducarán solos tras el tiempo indicado."
        : "✅ Los warns ya no caducan automaticamente.",
    };
  }

  private async handleBlocklistCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseBlocklistCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "La blocklist se gestiona dentro de un grupo." };
    }

    const command = result.command;

    if (command.kind === "list") {
      const entries = await this.groupProtectionRepository.listBlocklist(
        context.chatId,
      );
      const mode = await this.groupProtectionRepository.getBlocklistMode(
        context.chatId,
      );
      if (entries.length === 0) {
        return {
          text: "No hay palabras en la blocklist de este grupo. Usa /blocklist para añadir una. Usa /blocklist para añadir una.",
        };
      }
      const lines = entries
        .map(
          (entry) =>
            `• ${entry.trigger}${entry.reason ? ` — ${entry.reason}` : ""}`,
        )
        .join("\n");
      return {
        text: `🚷 *Blocklist* (acción: ${mode})\n${lines}`,
        parseMode: "Markdown",
      };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "blocklist.config",
    );

    if (!permission.allowed) {
      return {
        text: `No tienes permisos para editar la blocklist.`,
      };
    }

    if (command.kind === "add") {
      await this.groupProtectionRepository.addBlocklist(
        context.tenantId,
        context.chatId,
        normalizeBlocklistTrigger(command.trigger),
        command.reason,
      );
      return { text: `✅ Añadido a la blocklist: "${command.trigger}".` };
    }

    if (command.kind === "remove") {
      const removed = await this.groupProtectionRepository.removeBlocklist(
        context.chatId,
        normalizeBlocklistTrigger(command.trigger),
      );
      return {
        text: removed
          ? `✅ Quitado de la blocklist: "${command.trigger}".`
          : "Esa palabra no estaba en la blocklist.",
      };
    }

    if (command.kind === "removeAll") {
      const count = await this.groupProtectionRepository.removeAllBlocklist(
        context.chatId,
      );
      return { text: `✅ Blocklist vaciada (${count} entradas).` };
    }

    await this.groupProtectionRepository.setBlocklistMode(
      context.tenantId,
      context.chatId,
      command.mode,
    );
    return { text: `✅ Acción de la blocklist: ${command.mode}.` };
  }

  private async handleBlocklistMatch(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.kind !== "message" ||
      update.command ||
      !update.messageText ||
      !context.chatId ||
      !update.chat.chatId
    ) {
      return null;
    }

    if (await this.isActorAdmin(context, update)) {
      return null;
    }

    const entries = await this.groupProtectionRepository.listBlocklist(
      context.chatId,
    );
    if (entries.length === 0) {
      return null;
    }

    const hit = matchBlocklist(update.messageText, entries);
    if (!hit) {
      return null;
    }

    const mode = await this.groupProtectionRepository.getBlocklistMode(
      context.chatId,
    );

    // Always delete the offending message first (best-effort).
    if (update.messageId) {
      try {
        await this.telegramGateway.deleteMessage({
          chatId: update.chat.chatId,
          messageId: update.messageId,
          token: this.telegramToken(),
        });
      } catch {
        // Non-fatal.
      }
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "system",
      action: "blocklist.triggered",
      resourceType: "blocklist",
      resourceId: context.chatId,
      payload: { trigger: hit.trigger, mode },
    });
    await this.recordRiskSignal(context, update.user.userId, "deleted");

    const target = update.user.userId;
    if (!target) {
      return null;
    }

    // La traduccion del modo a acciones vive en `modules/security`. Ojo con
    // `kick`: no existe en la Bot API, es banear y desbanear acto seguido.
    const plan = accionParaModoDeBlocklist(mode);

    if (plan.avisar) {
      return this.applyWarn(
        context,
        update,
        target,
        `blocklist: ${hit.trigger}`,
      );
    }

    if (!plan.accion) {
      return null;
    }

    const enforcement = await this.applyTelegramEnforcement(
      plan.accion,
      update,
      target,
      undefined,
    );

    if (plan.desbanearDespues && update.chat.chatId) {
      try {
        await this.telegramGateway.unbanChatMember({
          chatId: update.chat.chatId,
          userId: target,
          token: this.telegramToken(),
          onlyIfBanned: false,
        });
      } catch {
        // Non-fatal.
      }
    }

    const failure = this.enforcementFailure(enforcement);
    return {
      text: failure
        ? textoBlocklistSinAccion(hit.trigger, mode, failure)
        : textoBlocklistAplicado(hit.trigger, mode),
    };
  }

  private async handleHygieneCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseHygieneCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "Estos ajustes se hacen dentro de un grupo." };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "hygiene.config",
    );

    if (!permission.allowed) {
      return {
        text: `No tienes permisos para esto.`,
      };
    }

    const command = result.command;
    const patch =
      command.kind === "cleanservice"
        ? { cleanService: command.enabled }
        : command.kind === "cleanwelcome"
          ? { cleanWelcome: command.enabled }
          : command.kind === "cleancommands"
            ? { cleanCommands: command.enabled }
            : command.kind === "nightmode"
              ? { nightMode: command.enabled }
              : { nightStart: command.startHour, nightEnd: command.endHour };

    await this.groupProtectionRepository.setHygiene(
      context.tenantId,
      context.chatId,
      patch,
    );

    const label =
      command.kind === "setnight"
        ? `🌙 Modo noche configurado: ${command.startHour}:00 - ${command.endHour}:00.`
        : command.kind === "cleanservice"
          ? `🧹 Limpieza de mensajes de sistema: ${command.enabled ? "ON" : "OFF"}.`
          : command.kind === "cleanwelcome"
            ? `🧹 Auto-borrado de bienvenida anterior: ${command.enabled ? "ON" : "OFF"}.`
            : command.kind === "cleancommands"
              ? `🧹 Borrar el comando tras responderlo: ${command.enabled ? "ON" : "OFF"}.`
              : `🌙 Modo noche: ${command.enabled ? "ON" : "OFF"}.`;

    return { text: label };
  }

  /**
   * Livegram-style feedback config/broadcast. /setfeedback (run in the staff
   * group) routes users' DMs there; /broadcast (owner) messages every user who
   * has written the bot.
   */
  /**
   * ControllerBot-style reaction post: `/react <text>` posts the text with a row
   * of emoji reaction buttons whose counts update live as people tap.
   */
  private async handleReactCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseReactCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "react.post",
    );
    if (!permission.allowed) {
      return {
        text: "Solo los administradores pueden publicar con reacciones.",
      };
    }

    return {
      text: result.command.text,
      replyMarkup: buildReactionKeyboard({}),
    };
  }

  private async handleReactionCallback(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const parsed = parseReactionCallback(update.callbackData);

    if (!parsed) {
      return null;
    }

    const chatId = update.chat.chatId;
    const messageId = extractCallbackMessageId(update.raw);

    if (!chatId || !messageId || !update.user.userId || !context.chatId) {
      return null;
    }

    const counts = await this.scheduledPostRepository.toggleReaction({
      tenantId: context.tenantId,
      chatId: context.chatId,
      messageId,
      telegramUserId: update.user.userId,
      emoji: parsed.emoji,
    });

    try {
      await this.telegramGateway.editMessageReplyMarkup({
        chatId,
        messageId,
        replyMarkup: buildReactionKeyboard(counts),
        token: this.telegramToken(),
      });
    } catch {
      // "message is not modified" or transient errors are non-fatal.
    }

    // The button already updated in place; nothing else to send.
    return null;
  }

  /**
   * Starts a GroupHelp-style "send me the text" flow from the settings panel:
   * records what the user is about to set and for which group, then asks them to
   * just send the text as a message.
   */
  private async beginPanelTextEdit(
    context: FoundationContext,
    userId: bigint,
    field: string,
    groupId: bigint,
    instruction: string,
  ): Promise<BotReply> {
    await this.groupProtectionRepository.setPendingEdit({
      tenantId: context.tenantId,
      telegramUserId: userId,
      field,
      groupTelegramChatId: groupId,
    });

    return {
      text: instruction,
      parseMode: "Markdown",
      replyMarkup: {
        inline_keyboard: [
          [{ text: "✖️ Cancelar", callback_data: `cfg:${groupId}:root:open` }],
        ],
      },
      edit: true,
    };
  }

  /**
   * Captures the next private message as the value for a pending panel edit
   * (welcome/rules/goodbye), so admins can set texts by simply sending them
   * instead of typing /setwelcome in the group.
   */
  private async handlePanelTextInput(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.kind !== "message" ||
      update.chat.chatType !== "private" ||
      update.command ||
      !update.isTextMessage ||
      !update.messageText ||
      !update.user.userId
    ) {
      return null;
    }

    const pending = await this.groupProtectionRepository.getPendingEdit(
      context.tenantId,
      update.user.userId,
    );
    if (!pending) {
      return null;
    }

    await this.groupProtectionRepository.clearPendingEdit(
      context.tenantId,
      update.user.userId,
    );

    if (
      !(await this.isGroupAdmin(
        pending.groupTelegramChatId,
        update.user.userId,
      ))
    ) {
      return { text: "Ya no eres administrador de ese grupo." };
    }

    const resolved = await this.repository.findChatByTelegramId(
      context.tenantId,
      pending.groupTelegramChatId,
    );
    if (!resolved) {
      return { text: "No encuentro ese grupo." };
    }

    const patch =
      pending.field === "welcome"
        ? { welcomeText: update.messageText }
        : pending.field === "rules"
          ? { rulesText: update.messageText }
          : { goodbyeText: update.messageText };
    await this.welcomeRepository.upsertConfig(
      context.tenantId,
      resolved.chatId,
      patch,
    );

    const label =
      pending.field === "welcome"
        ? "Bienvenida"
        : pending.field === "rules"
          ? "Reglas"
          : "Despedida";

    return {
      text: `✅ ${label} actualizada para *${resolved.title ?? "el grupo"}*.`,
      parseMode: "Markdown",
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: "⚙️ Volver al panel",
              callback_data: `cfg:${pending.groupTelegramChatId}:root:open`,
            },
          ],
        ],
      },
    };
  }

  private async handleFeedbackCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseFeedbackCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    const command = result.command;
    const role = this.resolveActorRole(context, update);
    const isAdmin = await this.isActorAdmin(context, update);

    if (command.kind === "set-staff") {
      if (!update.chat.chatId) {
        return { text: "Usa /setfeedback en el grupo de soporte." };
      }
      if (!isAdmin) {
        return { text: "Solo un administrador puede configurar esto." };
      }
      await this.feedbackRepository.setStaffChat(
        context.tenantId,
        update.chat.chatId,
      );
      return {
        text: "✅ Este grupo recibirá los mensajes que la gente escriba al bot. Responde a un mensaje para contestar al usuario.",
      };
    }

    if (command.kind === "unset-staff") {
      if (!isAdmin) {
        return { text: "Solo un administrador puede configurar esto." };
      }
      await this.feedbackRepository.setStaffChat(context.tenantId, 0n);
      return { text: "✅ Buzón de feedback desactivado." };
    }

    // broadcast
    if (role !== "owner") {
      return { text: "Solo el dueño del bot puede hacer difusiones." };
    }
    const users = await this.feedbackRepository.listUsers(context.tenantId);
    let sent = 0;
    for (const userId of users) {
      try {
        await this.telegramGateway.sendMessage({
          chatId: userId,
          reply: { text: `📢 ${command.text}` },
          token: this.telegramToken(),
        });
        sent += 1;
      } catch {
        // A blocked user never stops the broadcast.
      }
    }
    return { text: `📢 Difusion enviada a ${sent}/${users.length} usuarios.` };
  }

  /**
   * A user's DM (private, non-command) is relayed to the configured staff group
   * with a hidden origin marker, and the user is registered for broadcasts.
   * Takes priority over the AI DM chat when a staff group is configured.
   */
  private async handleFeedbackDM(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.kind !== "message" ||
      update.chat.chatType !== "private" ||
      update.command ||
      !update.isTextMessage ||
      !update.messageText ||
      !update.user.userId
    ) {
      return null;
    }

    const staffChatId = await this.feedbackRepository.getStaffChat(
      context.tenantId,
    );

    if (!staffChatId || staffChatId === 0n) {
      return null;
    }

    await this.feedbackRepository.addUser(context.tenantId, update.user.userId);

    const name = update.user.username
      ? `@${update.user.username}`
      : (update.user.userId?.toString() ?? "usuario");

    await this.telegramGateway.sendMessage({
      chatId: staffChatId,
      reply: {
        text: buildFeedbackRelay(name, update.user.userId, update.messageText),
        parseMode: "Markdown",
      },
      token: this.telegramToken(),
    });

    return { text: "✅ Mensaje enviado al equipo. Te responderemos pronto." };
  }

  /**
   * A staff member replying to a relayed feedback message: the origin user id is
   * recovered from the replied-to message text and the reply is delivered to
   * that user.
   */
  private async handleStaffReply(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.kind !== "message" ||
      update.command ||
      !update.isTextMessage ||
      !update.messageText ||
      !update.chat.chatId
    ) {
      return null;
    }

    const staffChatId = await this.feedbackRepository.getStaffChat(
      context.tenantId,
    );

    if (!staffChatId || update.chat.chatId !== staffChatId) {
      return null;
    }

    const repliedText = extractReplyText(update.raw);
    const origin = parseFeedbackOrigin(repliedText);

    if (!origin) {
      return null;
    }

    try {
      await this.telegramGateway.sendMessage({
        chatId: origin,
        reply: { text: `💬 ${update.messageText}` },
        token: this.telegramToken(),
      });
    } catch {
      return {
        text: "No pude entregar la respuesta (el usuario bloqueó el bot).",
      };
    }

    return { text: "✅ Respuesta enviada." };
  }

  private async handleJoinGateCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseJoinGateCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "Estos ajustes se hacen dentro de un grupo." };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "joingate.config",
    );
    if (!permission.allowed) {
      return { text: "No tienes permisos para esto." };
    }

    const command = result.command;
    await this.groupProtectionRepository.setHygiene(
      context.tenantId,
      context.chatId,
      command.kind === "welcomemute"
        ? { welcomeMute: command.enabled }
        : { autoApprove: command.enabled },
    );

    return {
      text:
        command.kind === "welcomemute"
          ? `🔇 Verificación "soy humano" al entrar: ${command.enabled ? "ON" : "OFF"}.`
          : `✅ Auto-aprobar solicitudes de entrada: ${command.enabled ? "ON" : "OFF"}.`,
    };
  }

  /** Quick chat commands for Guardian Verification (/guardian, /guardian_on,
   * /guardian_off, /guardian_mode). Full configuration lives in the Mini App
   * config panel (/config/guardian). */
  private async handleGuardianCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    // El `/start grdv_<token>` NO se mira aquí. Estaba, y era inalcanzable:
    // `core.command` contesta a todo `/start` mucho antes de llegar a este
    // handler. Ahora lo reclama `guardian.retry-start`, registrado delante de
    // core — ver el comentario largo de esa entrada de la cadena.

    // /admin, /desadmin, /adminlist, /adoptaradmins — appointing admins the bot
    // is able to take back.
    //
    // MUST come before parseGuardianCommand's `return null`: these are not
    // Guardian commands, so that guard bails out first and everything after it
    // is unreachable for them. The live test caught exactly this — the bot
    // simply ignored /admin.
    const appointed = parseAppointedAdminCommand(
      update,
      extractReplyContext(update.raw).userId !== undefined,
    );
    if (appointed) {
      return this.handleAppointedAdminCommand(context, update, appointed);
    }

    const result = parseGuardianCommand(update);
    if (!result) {
      return null;
    }
    if (!result.ok) {
      return { text: result.error.usage };
    }

    // /topicid — reports the group id and (inside a forum topic) the topic id
    // so an admin can paste them into the Guardian panel to route STAFF reports
    // to a dedicated verification topic. Handled before the tenant guard below
    // because the STAFF group need not be a configured community itself.
    if (result.command.kind === "topic-id") {
      const chatId = update.chat.chatId;
      if (!chatId) {
        return { text: "Este comando se usa dentro de un grupo." };
      }
      if (!(await this.isActorAdmin(context, update))) {
        return { text: "Solo un administrador del grupo puede usar esto." };
      }
      return {
        text: formatTopicIdReply({
          chatId: chatId.toString(),
          topicId: update.chat.topicId,
        }),
        parseMode: "Markdown",
      };
    }

    // /reenviar — hands someone a fresh verification link when they are stuck.
    //
    // The dead end this rescues: opening the Mini App and closing it leaves a
    // PENDING join request, and Telegram refuses a second request while one is
    // pending. So the "supersede the abandoned session" path — which only runs
    // on a new join request — can never fire, and the person waits out the full
    // TTL with nothing on screen telling them to. Admins saw exactly this and
    // could not even admit them by hand, because the request was already
    // answered with "queued".
    if (result.command.kind === "resend") {
      const here = update.chat.chatId;
      if (!here || !context.chatId) {
        return { text: "Usa /reenviar dentro del grupo." };
      }
      if (!(await this.isActorAdmin(context, update))) {
        return { text: "Solo un administrador del grupo puede usar esto." };
      }
      const reply = extractReplyContext(update.raw);
      const arg = update.command?.args?.[0];
      const targetId =
        reply.userId ??
        extractMentionTargetId(update.raw) ??
        (arg && /^\d{5,}$/u.test(arg) ? BigInt(arg) : undefined) ??
        (arg?.startsWith("@")
          ? ((await this.repository
              .findTelegramUserIdByUsername(arg.slice(1))
              .catch(() => undefined)) ?? undefined)
          : undefined);
      if (targetId === undefined) {
        return {
          text: "Responde con /reenviar a un mensaje de esa persona (o pon su @usuario o su id).",
        };
      }
      const session = await this.guardianRepository.findActiveSession(
        context.chatId,
        targetId,
      );
      if (!session) {
        return {
          text: "Esa persona no tiene ninguna verificación en curso aquí. Que vuelva a pedir entrar al grupo.",
        };
      }
      const settings = await this.guardianRepository.getSettings(
        context.tenantId,
        context.chatId,
      );
      return this.resendVerificationLink(
        session,
        settings?.sessionTtlSeconds,
        update.user.userId,
      );
    }

    // /bdani — opens the verification roster (who verified, from which IP, and
    // who shares a connection). Admin-only, and the screen itself re-checks
    // admin server-side: this button is a convenience, never the access
    // control. A named-app URL button, NOT a web_app one — web_app buttons are
    // only valid in private chats, and this is used inside the group.
    if (result.command.kind === "roster") {
      const here = update.chat.chatId;
      if (!here) {
        return { text: "Usa /bdani dentro del grupo." };
      }
      // Usable from the STAFF room as well as the community group: the team
      // lives in STAFF, and answering there keeps the roster button out of the
      // public group. When this chat is some group's configured staffChatId,
      // the roster shown is that group's — asking for STAFF's own roster would
      // return an empty list, since verifications belong to the community chat.
      const staffOf =
        await this.guardianRepository.findGroupByStaffChatId(here);
      // Same rule as the STAFF decision buttons: membership of the private
      // review room IS the credential, since most of its members hold no
      // Telegram admin badge THERE. Outside it, an admin badge is still
      // required. Either way this only decides who gets a button — the roster
      // endpoint independently re-checks admin of the community group, so a
      // shared or forwarded link grants nothing.
      // Restricted to ONE person, and silently: anyone else gets no reply at
      // all, not even a refusal. A "solo un administrador puede ver esto"
      // confirms the command exists and that there is a database of IPs behind
      // it, which is exactly what should not be advertised to the group. `null`
      // lets the pipeline carry on as though nothing was typed.
      //
      // This is only the command gate. The roster endpoint still re-derives
      // admin rights server-side, so a forwarded link grants nothing either way.
      if (update.user.userId !== ROSTER_COMMAND_OWNER_ID) {
        return null;
      }
      if (!staffOf && !(await this.isActorAdmin(context, update))) {
        return null;
      }
      const chatId = staffOf?.telegramChatId ?? here;
      const botUsername = this.env.TELEGRAM_BOT_USERNAME.replace(/^@/u, "");
      return {
        text: "🗂 Base de datos de verificaciones: quién ha verificado, desde qué IP y quién comparte conexión.",
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text: "🗂 Abrir base de datos",
                url: buildNamedMiniAppLink(
                  botUsername,
                  this.env.TELEGRAM_MINIAPP_NAME,
                  encodeRosterStartParam(chatId.toString()),
                ),
              },
            ],
            [
              // Same screen folded across every group the viewer administers.
              // Safe to offer to anyone who got this far: the endpoint behind
              // it re-derives that list from Telegram, so an admin of one group
              // sees exactly their one group.
              {
                text: "🌐 Todos mis grupos",
                url: buildNamedMiniAppLink(
                  botUsername,
                  this.env.TELEGRAM_MINIAPP_NAME,
                  ROSTER_ALL_START_PARAM,
                ),
              },
            ],
          ],
        },
      };
    }

    if (!context.chatId) {
      return { text: "Estos ajustes se hacen dentro de un grupo." };
    }

    const command = result.command;
    if (command.kind === "help") {
      return {
        text:
          "🛡️ Guardian Verification: verifica solicitudes de entrada con un reto en Mini App antes de admitir.\n" +
          "Comandos: /guardian_status, /guardian_on, /guardian_off, /guardian_mode <off|manual|assisted|auto|strict>.\n" +
          "En el grupo STAFF: envía /topicid dentro de un tema para obtener su ID (enruta las verificaciones a ese tema).\n" +
          "Configuración completa (STAFF, umbrales, retos) en el panel de la Mini App.",
      };
    }

    if (command.kind === "status") {
      const settings = await this.guardianRepository.getSettings(
        context.tenantId,
        context.chatId,
      );
      return {
        text: settings
          ? `Guardian: ${settings.enabled ? "ON" : "OFF"} · modo ${settings.mode} · intentos ${settings.maxAttempts} · STAFF ${settings.staffChatId ? "configurado" : "sin configurar"}.`
          : "Guardian no está configurado en este chat todavía.",
      };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "guardian.config",
    );
    if (!permission.allowed) {
      return { text: "No tienes permisos para esto." };
    }

    const current = await this.guardianRepository.getSettings(
      context.tenantId,
      context.chatId,
    );

    if (command.kind === "enable") {
      if (command.enabled && !current?.staffChatId) {
        return {
          text: "Configura primero un chat STAFF desde el panel de la Mini App (/config/guardian) antes de activar Guardian.",
        };
      }
      await this.guardianRepository.upsertSettings(
        context.tenantId,
        context.chatId,
        { enabled: command.enabled },
      );
      return {
        text: `🛡️ Guardian Verification: ${command.enabled ? "ON" : "OFF"}.`,
      };
    }

    // command.kind === "mode"
    const nextMode = command.mode;
    const issues = validateGuardianSettings({
      mode: nextMode,
      staffChatId: current?.staffChatId ?? null,
      maxAttempts: current?.maxAttempts ?? 3,
      sessionTtlSeconds: current?.sessionTtlSeconds ?? 600,
      mediaRetentionHours: current?.mediaRetentionHours ?? 72,
      autoApproveThreshold: current?.autoApproveThreshold ?? 0.85,
      manualReviewThreshold: current?.manualReviewThreshold ?? 0.55,
      livenessMinimum: current?.livenessMinimum ?? 0.6,
      gestureMinimum: current?.gestureMinimum ?? 0.6,
      replayRiskMaximum: current?.replayRiskMaximum ?? 0.4,
      syntheticRiskMaximum: current?.syntheticRiskMaximum ?? 0.4,
      estimateAge: current?.estimateAge ?? false,
      minimumAge: current?.minimumAge ?? null,
      maximumAge: current?.maximumAge ?? null,
      sendApprovedCasesToStaff: true,
    });
    const blocking = issues.filter((i) => i.severity === "error");
    if (blocking.length > 0) {
      return { text: `No se pudo cambiar el modo: ${blocking[0]?.message}` };
    }
    await this.guardianRepository.upsertSettings(
      context.tenantId,
      context.chatId,
      {
        mode: nextMode,
      },
    );
    return { text: `🛡️ Guardian Verification: modo cambiado a "${nextMode}".` };
  }

  /**
   * Handles STAFF inline-button decisions on a Guardian Verification report
   * (approve/decline/retry/delete media/false positive/expel/report). Every
   * callback is HMAC-verified against the session it claims to act on (see
   * modules/guardian/src/session-crypto.ts) and requires the presser to be an
   * admin/moderator of the chat the button lives in (the STAFF chat).
   */
  /**
   * Answers `/start grdv_<token>` with the Mini App button for the session that
   * token belongs to. Pressing START is the person's first contact with the
   * bot, which is exactly what unblocks DMs, so this is the earliest moment the
   * button can be delivered at all. The token must resolve to an ACTIVE session
   * belonging to the person who pressed it — a forwarded link opened by anyone
   * else, or a session already resolved/expired, gets a plain refusal and never
   * a working button.
   */
  private async handleGuardianRetryStart(
    update: TelegramUpdateEnvelope,
    token: string,
  ): Promise<BotReply> {
    const userId = update.user.userId;
    const session = await this.guardianRepository.findSessionByTokenHash(
      hashSessionToken(token),
    );
    if (!session || !userId || session.telegramUserId !== userId) {
      return {
        text: "Este enlace de verificación no es válido o no es para ti.",
      };
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      // Aquí acaba quien recibió la repetición TARDE, que es el caso normal y
      // no el raro: el bot no puede escribir por privado a quien nunca le ha
      // dado a START —31 de las 35 personas a las que el staff pidió repetir
      // estaban en esa situación—, así que el enlace viaja a mano por un admin
      // y llega cuando llega. De 40 repeticiones caducadas, solo 3 personas
      // llegaron a repetir. Pulsar START es la prueba de que por fin le llegó,
      // y contestarle "pídele a un administrador que te envíe uno nuevo" es
      // mandarle a un botón que ya no existe: la ficha del staff está decidida.
      const settings = await this.guardianRepository.getSettings(
        session.tenantId,
        session.chatId,
      );
      const yaDecidido = (
        await this.guardianRepository.listStaffDecisions(session.id)
      ).some((d) => d.action === "approve" || d.action === "decline");
      // `declineOnExpiry` decide qué se puede aconsejar, porque decide si su
      // solicitud sigue viva en Telegram: con el rechazo activado el barrido ya
      // la retiró y volver a pedir entrar SÍ funciona; sin él la solicitud
      // sigue pendiente y Telegram no acepta una segunda mientras haya una
      // viva, así que ese consejo sería imposible de seguir.
      const puedeVolverAPedir = settings?.declineOnExpiry === true;
      // Solo se revive lo que sigue DENTRO del flujo de repetición. Una sesión
      // `resolved` ya está otra vez en manos del staff y una `cancelled` fue
      // reemplazada por otra más nueva: revivir cualquiera de las dos sería
      // resucitar un caso que ya no es el que esta persona tiene delante.
      const sigueEnRepeticion =
        session.status === "awaiting_retry" || session.status === "expired";
      if (session.status === "cancelled") {
        return {
          text: "Este enlace es el viejo: volviste a solicitar entrar, así que tienes otro más nuevo. Busca mi último mensaje en este chat y pulsa ese botón.",
        };
      }
      if (!yaDecidido && !puedeVolverAPedir && sigueEnRepeticion) {
        // Se revive el enlace que la persona tiene en la mano en vez de rotar a
        // uno nuevo: su solicitud sigue pendiente, el staff ya dijo que
        // repitiera y nadie lo ha decidido. No hay nada que volver a entregar.
        const revivida = await this.guardianRepository.resolveSession(
          session.id,
          session.version,
          {
            status: "awaiting_retry",
            expiresAt: new Date(Date.now() + GUARDIAN_RETRY_TTL_SECONDS * 1000),
          },
        );
        if (revivida) {
          this.logger.log(
            `guardian: sesión ${session.id} (usuario ${userId}) revivida al pulsar START con el enlace de repetición ya caducado`,
          );
          return this.respuestaConBotonDeRepeticion(token);
        }
      }
      return {
        text: puedeVolverAPedir
          ? "Tu verificación caducó. Vuelve al grupo, pulsa «Solicitar unirme» otra vez y te llegará una nueva al momento."
          : "Este enlace de verificación ha caducado. Pídele a un administrador que te envíe uno nuevo.",
      };
    }
    return this.respuestaConBotonDeRepeticion(token);
  }

  /**
   * Reclama `/start grdv_<token>` —y solo eso— antes de que `core.command` le
   * conteste con el menú del bot. Cualquier otro `/start` sale por null y sigue
   * la cadena intacto.
   */
  private async handleGuardianRetryStartCommand(
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.command?.name !== "start" ||
      update.chat.chatType !== "private"
    ) {
      return null;
    }
    const arg = update.command.args?.[0];
    if (esArranqueDeAutoVerificacion(arg)) {
      return await this.handleGuardianSelfStart(update);
    }
    const retryToken = parseGuardianRetryStart(arg);
    return retryToken
      ? await this.handleGuardianRetryStart(update, retryToken)
      : null;
  }

  /**
   * Contesta a `/start verif`: el AUTO-rescate de quien se quedó sin Mini App.
   *
   * Es la única salida que le queda a esa persona. El botón nativo lo escribe
   * Telegram dentro de la solicitud y a veces no aparece; el DM explicativo le
   * falla con `403 bot can't initiate conversation` porque nunca ha abierto un
   * chat con el bot, y `user_chat_id` —que existe justo para saltarse eso— no
   * lo concede en este flujo (27-08-2026: de 19 fallos de DM, 18 eran
   * exactamente esa gente). Hasta ahora dependía de que un admin se enterara y
   * le pasara un `/reenviar` a mano.
   *
   * Pulsar EMPEZAR abre el privado, y con eso ya se puede entregar todo. Aquí,
   * y solo aquí, cabe además el POR QUÉ pedimos una foto — el texto que el 42%
   * que nunca abre la Mini App no ha llegado a leer nunca.
   *
   * Se rota el token igual que en `/reenviar` y por el mismo motivo: del
   * original solo se guarda el hash, así que no hay enlace viejo que reenviar.
   * Y el TTL pasa a ser el de repetición (24 h), no los 10 minutos de una
   * sesión recién nacida: quien llega hasta aquí ya ha perdido un rato.
   */
  private async handleGuardianSelfStart(
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply> {
    const userId = update.user.userId;
    if (!userId) {
      return { text: "No he podido identificarte. Vuelve a intentarlo." };
    }
    // Por id de quien pulsa, NO por el enlace: el enlace es público —tiene que
    // serlo para poder ponerlo en la descripción del grupo— así que no puede
    // llevar dentro a quién pertenece.
    const session =
      await this.guardianRepository.findActiveSessionByUser(userId);
    if (!session) {
      return {
        text: [
          "No tienes ninguna verificación pendiente ahora mismo.",
          "",
          "Ve al grupo, pulsa «Solicitar unirme» y vuelve aquí si no te aparece nada.",
        ].join("\n"),
      };
    }
    const settings = await this.guardianRepository.getSettings(
      session.tenantId,
      session.chatId,
    );
    const nuevoToken = generateSessionToken();
    const ttlSegundos = Math.max(
      settings?.sessionTtlSeconds ?? 600,
      GUARDIAN_RETRY_TTL_SECONDS,
    );
    const guardada = await this.guardianRepository.resolveSession(
      session.id,
      session.version,
      {
        status: "awaiting_retry",
        sessionTokenHash: hashSessionToken(nuevoToken),
        expiresAt: new Date(Date.now() + ttlSegundos * 1000),
      },
    );
    if (!guardada) {
      // El cerrojo optimista: alguien decidió la sesión mientras tanto. No se
      // inventa un botón sobre una sesión que ya no es la que se leyó.
      return {
        text: "Tu verificación acaba de cambiar de estado. Espera un momento y vuelve a pulsar el enlace.",
      };
    }
    this.logger.log(
      `guardian: sesión ${session.id} (usuario ${userId}) rescatada por el enlace de auto-verificación`,
    );
    const diasRetencion = Math.max(
      1,
      Math.round((settings?.mediaRetentionHours ?? 72) / 24),
    );
    const liveAppUrl = readAppUrl(this.env.TELEGRAM_APP_URL);
    const miniAppUrl = `${resolveGuardianMiniAppUrl({ ...this.env, TELEGRAM_APP_URL: liveAppUrl })}?session=${encodeURIComponent(nuevoToken)}`;
    return {
      text: [
        "👋 Has pedido entrar al grupo.",
        "",
        "Antes de abrirte la puerta necesito comprobar que hay una persona real detrás — es lo que mantiene fuera a los bots y a las cuentas falsas.",
        "",
        "Es rápido: te pido una foto haciendo un gesto concreto que te digo en el momento. Menos de un minuto.",
        "",
        `La revisa el equipo del grupo y la foto se borra sola a los ${diasRetencion} días. No pido teléfono, ni DNI, ni ubicación.`,
        "",
        "Toca el botón para empezar 👇",
      ].join("\n"),
      replyMarkup: {
        inline_keyboard: [
          [{ text: "✅ Verificarme", web_app: { url: miniAppUrl } }],
        ],
      },
    };
  }

  /**
   * El botón de repetir, listo para contestar al START. Tiene que ser un botón
   * `web_app` (solo válido en un privado, que es donde siempre se contesta
   * esto): una URL pelada abre el navegador de fuera, donde el initData de
   * Telegram contra el que autentica la API sencillamente no existe.
   */
  private respuestaConBotonDeRepeticion(token: string): BotReply {
    const liveAppUrl = readAppUrl(this.env.TELEGRAM_APP_URL);
    const miniAppUrl = `${resolveGuardianMiniAppUrl({ ...this.env, TELEGRAM_APP_URL: liveAppUrl })}?session=${encodeURIComponent(token)}`;
    return {
      text: "🔁 Un admin te ha pedido repetir tu verificación. Pulsa el botón para hacerla:",
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: "📸 Repetir verificación",
              web_app: { url: miniAppUrl },
            },
          ],
        ],
      },
    };
  }

  /**
   * How a STAFF decision is attributed in the report. Prefers @username, then
   * the Telegram first name, and only falls back to the raw numeric id when the
   * account exposes neither — "Aprobado por 9000000002" tells the rest of the
   * team nothing about who actually made the call, and plenty of accounts have
   * no public username.
   */
  private staffActorLabel(
    update: TelegramUpdateEnvelope,
    moderatorId: bigint,
  ): string {
    if (update.user.username) {
      return `@${update.user.username}`;
    }
    return update.user.firstName?.trim() || moderatorId.toString();
  }

  private async handleGuardianStaffCallback(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const parsed = parseStaffCallbackData(update.callbackData);
    if (!parsed) {
      return null;
    }

    const sessionSecret = this.env.GUARDIAN_SESSION_SECRET;
    if (!sessionSecret || !verifyStaffCallback(parsed, sessionSecret)) {
      return { text: "Este botón ya no es válido." };
    }

    const session = await this.guardianRepository.findSessionById(
      parsed.sessionId,
    );
    if (!session) {
      return {
        text: "Esta verificación ya no existe.",
        edit: true,
        // Never trade the whole report for a one-line notice — every edit that
        // isn't a final verdict keeps the card and its buttons intact.
        preserveCaption: true,
        preserveMarkup: true,
      };
    }

    const settings = await this.guardianRepository.getSettings(
      session.tenantId,
      session.chatId,
    );

    // Being IN the chat the report was routed to IS the credential. A STAFF
    // chat is private and its membership is curated by the community's own
    // admins, so ALSO demanding a Telegram admin badge *there* locked out the
    // very reviewers it was created for — they tapped Aprobar, got a flat
    // refusal, and no decision was ever recorded. Anyone acting from ANOTHER
    // chat still has to be an admin: the report may have been posted elsewhere,
    // or the configured staff chat may have changed since it was sent.
    const staffChatId = settings?.staffChatId ?? null;
    const fromStaffChat =
      staffChatId !== null && update.chat.chatId === staffChatId;
    if (!fromStaffChat && !(await this.isActorAdmin(context, update))) {
      return { text: "Solo el staff puede decidir esto." };
    }

    // A case is decided in ONE room: the one the report was primarily sent to.
    // The mirrors' keyboards say as much, but a keyboard is not a control — and
    // every report mirrored before this rule existed still carries live
    // buttons. This is what actually refuses them.
    //
    // "report" is exempt on purpose: reading the technical detail changes
    // nothing, and the mirror keyboard offers it.
    if (
      parsed.action !== "report" &&
      (await this.tappedCopyIsMirror(session.id, update))
    ) {
      await this.ackCallbackQuery(
        update.raw,
        "Este caso se decide en el grupo principal de staff.",
        true,
      );
      return null;
    }

    const moderatorId = update.user.userId;
    if (!moderatorId) {
      return null;
    }

    // Only a final approve/decline resolves the session — auxiliary staff
    // actions (retry, delete_media, mark_false_positive, expel) must never
    // permanently block a later approve/decline on the same session.
    const alreadyDecided = (
      await this.guardianRepository.listStaffDecisions(session.id)
    ).some(
      (decision) =>
        decision.action === "approve" || decision.action === "decline",
    );

    switch (parsed.action) {
      case "approve":
      case "decline": {
        if (alreadyDecided) {
          return {
            text: "Esta verificación ya fue decidida.",
            edit: true,
            preserveCaption: true,
            preserveMarkup: true,
          };
        }
        let telegramOk = true;
        try {
          if (parsed.action === "approve") {
            await this.telegramGateway.approveChatJoinRequest({
              chatId: session.telegramChatId,
              userId: session.telegramUserId,
              token: this.telegramToken(),
            });
          } else {
            await this.telegramGateway.declineChatJoinRequest({
              chatId: session.telegramChatId,
              userId: session.telegramUserId,
              token: this.telegramToken(),
            });
          }
        } catch (error) {
          // The verdict is still recorded below, but Telegram refused to
          // admit/reject (expired join request, or the bot lost the "add
          // members" right). NEVER show a green "Aprobado" the person can't
          // see — surface it so STAFF can act.
          //
          // Con una excepción, y es literal: si Telegram responde que ya es
          // participante a un Aprobar, la persona está dentro. Eso es
          // exactamente lo que el STAFF acaba de pedir, así que mandarle un
          // "⚠️ Telegram NO admitió al usuario, revísalo a mano" es mandarle a
          // revisar a mano algo que ya está bien. Un aviso que se equivoca es
          // peor que no avisar: enseña a ignorar el aviso.
          if (
            classifyJoinRequestFailure(parsed.action, error) ===
            "already-settled"
          ) {
            this.logger.debug(
              `guardian staff approve: ${session.id} ya era participante, nada que hacer`,
            );
          } else {
            telegramOk = false;
            this.logger.error(
              `guardian staff ${parsed.action} failed to reach Telegram for session ${session.id}`,
              error instanceof Error ? error.stack : String(error),
            );
          }
        }
        await this.guardianRepository.createStaffDecision({
          sessionId: session.id,
          moderatorTelegramId: moderatorId,
          action: parsed.action,
        });
        const who = this.staffActorLabel(update, moderatorId);
        const okText =
          parsed.action === "approve"
            ? `✅ Aprobado manualmente por ${who}.`
            : `❌ Rechazado manualmente por ${who}.`;
        // The report may live in several STAFF rooms. The copy that was tapped
        // is edited by the normal reply path below; the others would otherwise
        // keep live-looking buttons for a case that is already closed.
        await this.markOtherStaffCopiesDecided(
          session.id,
          update,
          parsed.action === "approve"
            ? `✅ Aprobado por ${who}`
            : `❌ Rechazado por ${who}`,
        );
        const failText =
          parsed.action === "approve"
            ? `⚠️ ${who} pulsó Aprobar, pero Telegram NO admitió al usuario (¿solicitud caducada o al bot le falta el permiso "Añadir miembros"?). Revísalo a mano.`
            : `⚠️ ${who} pulsó Rechazar, pero Telegram NO procesó el rechazo (¿solicitud caducada?). Revísalo a mano.`;
        return {
          text: telegramOk ? okText : failText,
          edit: true,
          // Keep the full report caption; add the verdict beneath it.
          preserveCaption: true,
        };
      }
      case "retry": {
        if (alreadyDecided) {
          return {
            text: "Esta verificación ya fue decidida.",
            edit: true,
            preserveCaption: true,
            preserveMarkup: true,
          };
        }
        await this.guardianRepository.createStaffDecision({
          sessionId: session.id,
          moderatorTelegramId: moderatorId,
          action: "retry",
        });

        // The original Mini App token is never persisted in plaintext (only
        // its hash), so a retry can't just resend the old link — rotate to a
        // fresh token + TTL.
        const newToken = generateSessionToken();
        // NOT sessionTtlSeconds: that 10-minute default is sized for someone who
        // just tapped "join" and has the Mini App opening in front of them. A
        // repeat crosses a human relay (bot → admin → person → whenever they
        // next open Telegram), so it expired long before anyone could use it.
        // A chat that deliberately configured a LONGER session TTL keeps it.
        const retryTtlSeconds = Math.max(
          settings?.sessionTtlSeconds ?? 600,
          GUARDIAN_RETRY_TTL_SECONDS,
        );
        const newExpiresAt = new Date(Date.now() + retryTtlSeconds * 1000);
        await this.guardianRepository.resolveSession(
          session.id,
          session.version,
          {
            status: "awaiting_retry",
            sessionTokenHash: hashSessionToken(newToken),
            expiresAt: newExpiresAt,
          },
        );

        const liveAppUrl = readAppUrl(this.env.TELEGRAM_APP_URL);
        const miniAppUrl = `${resolveGuardianMiniAppUrl({ ...this.env, TELEGRAM_APP_URL: liveAppUrl })}?session=${encodeURIComponent(newToken)}`;

        // Best-effort DM — Telegram blocks a bot from messaging someone who has
        // never started a chat with it, which is the NORMAL case here: a join
        // request's `user_chat_id` is only usable for 5 minutes, long gone by
        // the time STAFF reviews. Report the real outcome instead of assuming
        // it worked. The link MUST be a `web_app` inline button (only valid in
        // a private chat, which this always is) — a plain URL opens the
        // external browser, where the Telegram initData the API authenticates
        // against simply does not exist.
        let dmSent = false;
        try {
          await this.telegramGateway.sendMessage({
            chatId: session.telegramUserId,
            token: this.telegramToken(),
            reply: {
              text: "🔁 Un admin te ha pedido repetir tu verificación.",
              replyMarkup: {
                inline_keyboard: [
                  [
                    {
                      text: "📸 Repetir verificación",
                      web_app: { url: miniAppUrl },
                    },
                  ],
                ],
              },
            },
          });
          dmSent = true;
        } catch {
          // Handled below via dmSent=false.
        }

        // Unreachable person → hand the link to the admin who asked for the
        // repeat, so they can pass it on. It is a `?start=` deep link rather
        // than the raw Mini App URL precisely BECAUSE the person never started
        // the bot: tapping it opens the bot chat with a START button, and
        // pressing START is itself the first contact that unblocks DMs — the
        // bot then answers with the Mini App button (see
        // parseGuardianRetryStart / handleGuardianRetryStart). The token is
        // bound to that one person's session, so the link is useless to anyone
        // else who might see it.
        const botUsername = this.env.TELEGRAM_BOT_USERNAME.replace(/^@/u, "");
        const startLink = `https://t.me/${botUsername}?start=${GUARDIAN_RETRY_START_PREFIX}${newToken}`;
        const personLabel = session.username
          ? `@${session.username}`
          : [session.firstName, session.lastName].filter(Boolean).join(" ") ||
            session.telegramUserId.toString();
        const ttlLabel = formatRetryTtl(retryTtlSeconds);
        let adminLinkSent = false;
        if (!dmSent) {
          try {
            await this.telegramGateway.sendMessage({
              chatId: moderatorId,
              token: this.telegramToken(),
              reply: {
                text: [
                  "🔁 Repetición de verificación",
                  "",
                  `No he podido escribir a ${personLabel} por privado (nunca ha iniciado un chat conmigo).`,
                  "",
                  "👇 Reenvíale el mensaje de abajo. Va escrito tal cual: no tienes que redactar nada.",
                  "",
                  `Solo sirve para ${personLabel} y caduca en ${ttlLabel}.`,
                ].join("\n"),
                disableWebPagePreview: true,
              },
            });
            // El enlace va SOLO en este segundo mensaje, y a proposito: antes
            // llegaba dentro de la explicacion dirigida al admin, asi que
            // reenviarlo era imposible sin editar y quien lo recibia leia un
            // texto que hablaba de el en tercera persona. Suelto y ya redactado
            // se reenvia de un toque.
            await this.telegramGateway.sendMessage({
              chatId: moderatorId,
              token: this.telegramToken(),
              reply: {
                text: [
                  "👋 Te falta un paso para entrar al grupo.",
                  "",
                  "Pulsa este enlace y dale a EMPEZAR; te mando la verificación al momento:",
                  "",
                  startLink,
                  "",
                  `Es una foto haciendo un gesto que te digo sobre la marcha, menos de un minuto. No pedimos teléfono, ni DNI, ni ubicación. El enlace es solo tuyo y caduca en ${ttlLabel}.`,
                ].join("\n"),
                disableWebPagePreview: true,
              },
            });
            // Solo despues de los DOS: el enlace viaja en el segundo, asi que
            // si ese falla el admin se ha quedado sin nada que pasar.
            adminLinkSent = true;
          } catch {
            // Handled below via adminLinkSent=false.
          }
        }

        const staffWho = this.staffActorLabel(update, moderatorId);
        return {
          text: dmSent
            ? "🔁 Repetición solicitada y avisada a la persona por privado."
            : adminLinkSent
              ? `🔁 Repetición solicitada. No pude avisar a ${personLabel} por privado (nunca ha hablado conmigo), así que te he mandado el enlace por privado a ti, ${staffWho}, para que se lo pases.`
              : `🔁 Repetición solicitada, pero no pude avisar por privado ni a ${personLabel} ni a ti (${staffWho}: abre un chat conmigo, @${botUsername}). Pásale este enlace a mano: ${startLink}`,
          edit: true,
          // A repeat is NOT a verdict: keep the whole report and add the note
          // beneath it, and put the reviewer's buttons back so the case can
          // still be approved or declined afterwards.
          preserveCaption: true,
          preserveMarkup: true,
        };
      }
      case "delete_media": {
        const media = await this.guardianRepository.listMediaBySession(
          session.id,
        );
        for (const item of media) {
          await this.guardianRepository.markMediaDeleted(item.id);
        }
        await this.guardianRepository.createStaffDecision({
          sessionId: session.id,
          moderatorTelegramId: moderatorId,
          action: "delete_media",
        });
        return { text: "🗑 Medios eliminados." };
      }
      case "mark_false_positive": {
        await this.guardianRepository.createStaffDecision({
          sessionId: session.id,
          moderatorTelegramId: moderatorId,
          action: "mark_false_positive",
        });
        return {
          text: "🚨 Marcado como falso positivo para revisión del modelo/umbrales.",
        };
      }
      case "expel": {
        // First tap never bans by itself — requires a second, distinct
        // confirmation callback (rule: expel needs confirmation). The explicit
        // keyboard deliberately replaces the reviewer's one for this step, so
        // only the caption is preserved.
        return {
          text: "⚠️ ¿Expulsar a este usuario del grupo? Confirma para continuar.",
          replyMarkup: buildExpelConfirmKeyboard(session.id, sessionSecret),
          edit: true,
          preserveCaption: true,
        };
      }
      case "expel_confirm": {
        try {
          await this.telegramGateway.banChatMember({
            chatId: session.telegramChatId,
            userId: session.telegramUserId,
            token: this.telegramToken(),
            untilDate: undefined,
          });
        } catch {
          return {
            text: "No se pudo expulsar (¿el bot tiene permisos?).",
            edit: true,
            // Keep the confirm button so STAFF can retry once permissions are
            // fixed, instead of being left with a dead card.
            preserveCaption: true,
            preserveMarkup: true,
          };
        }
        await this.guardianRepository.createStaffDecision({
          sessionId: session.id,
          moderatorTelegramId: moderatorId,
          action: "expel",
        });
        // Terminal action: the caption is kept, the buttons intentionally are
        // not (there is nothing left to decide once the person is banned).
        return {
          text: "🚪 Usuario expulsado del grupo.",
          edit: true,
          preserveCaption: true,
        };
      }
      case "report": {
        const attempts = await this.guardianRepository.listAttemptsBySession(
          session.id,
        );
        const lastAttempt = attempts[attempts.length - 1];
        const analysis = lastAttempt
          ? await this.guardianRepository.getAnalysisByAttempt(lastAttempt.id)
          : null;
        const json = JSON.stringify(
          analysis ?? { info: "Sin análisis registrado todavía." },
          (_key, value) =>
            typeof value === "bigint" ? value.toString() : value,
          2,
        ).slice(0, 3500);
        return { text: `📄 Informe técnico:\n\n${json}` };
      }
      default:
        return null;
    }
  }

  /**
   * Handles the "I'm human" button from welcome-mute: only the target user can
   * press it; on success their send restrictions are lifted and they are marked
   * verified so no future group re-challenges them (Shieldy-style cross-chat).
   */
  private async handleHumanVerify(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const parsed = parseHumanVerifyCallback(update.callbackData);

    if (!parsed) {
      return null;
    }

    if (update.user.userId !== parsed.telegramUserId) {
      // Someone else tapped the button; ignore silently (no reply).
      return { text: "Este botón no es para ti." };
    }

    if (update.chat.chatId) {
      try {
        await this.telegramGateway.liftRestrictions({
          chatId: update.chat.chatId,
          userId: parsed.telegramUserId,
          token: this.telegramToken(),
        });
      } catch {
        // Best-effort.
      }
    }

    await this.groupProtectionRepository.markVerified(
      context.tenantId,
      parsed.telegramUserId,
    );

    return { text: "✅ Verificado. Bienvenido!", edit: true };
  }

  /**
   * Un approve/decline de solicitud que falla sin que nadie lo vea.
   *
   * Los cuatro sitios de `handleJoinRequest` que deciden entradas tenían un
   * `catch {}` con el comentario "Best-effort", que en la práctica significaba:
   * si Telegram dice que no, el bot sigue como si hubiera dicho que sí. Y las
   * consecuencias no son simétricas — un decline que falla deja a la persona
   * en la cola, molesto; un auto-approve que falla la deja FUERA del grupo
   * para siempre, y sin una sola línea que lo cuente.
   *
   * Sigue sin interrumpir el flujo (por eso los `catch` no desaparecen): lo
   * único que cambia es que ahora queda dicho.
   */
  private notaSolicitudFallida(
    intent: "approve" | "decline",
    motivo: string,
    chatId: bigint,
    userId: bigint,
    error: unknown,
  ): void {
    if (classifyJoinRequestFailure(intent, error) === "already-settled") {
      return;
    }
    this.logger.warn(
      `chat_join_request ${intent} (${motivo}) no surtió efecto para ${userId} en ${chatId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  /**
   * Handles chat join requests: declines fedbanned users, and auto-approves the
   * rest when the group has auto-approve enabled.
   */
  private async handleJoinRequest(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.kind !== "join_request" ||
      !update.chat.chatId ||
      !update.user.userId
    ) {
      return null;
    }

    const userId = update.user.userId;

    // Un intocable entra y ya está: ni fedban, ni CAS, ni grupo requerido, ni
    // Guardian. Va ARRIBA del todo justamente por eso — cada una de las cuatro
    // puertas de abajo declina por su cuenta, así que colgarlo solo de Guardian
    // dejaría tres formas de echarle igual.
    //
    // Y aprueba en vez de dejar caer: sin contestar, la solicitud se queda
    // pendiente para siempre y Telegram no deja pedir entrada otra vez con una
    // viva, que es la trampa que ya sufren las sesiones caducadas.
    if (this.intocable(userId)) {
      try {
        await this.telegramGateway.approveChatJoinRequest({
          chatId: update.chat.chatId,
          userId,
          token: this.telegramToken(),
        });
      } catch (error) {
        this.notaSolicitudFallida(
          "approve",
          "intocable",
          update.chat.chatId,
          userId,
          error,
        );
      }
      return null;
    }

    // Guardian verification (below) is never gated — it is the whole point of
    // passive mode. Only the autonomous decline branches (fedban / CAS /
    // membership-gate) are moderation, so they follow the moderation flag.
    const mode = context.chatId
      ? await this.botMode(context.chatId)
      : ALL_ENABLED_BOT_MODE;

    // Decline anyone fedbanned in this chat's federation.
    if (context.chatId && mode.moderation) {
      const fed = await this.federationRepository.getFederationForChat(
        context.chatId,
      );
      if (fed) {
        const fedIds = [
          fed.fedId,
          ...(fed.subscribedFedId ? [fed.subscribedFedId] : []),
        ];
        for (const fedId of fedIds) {
          if (await this.federationRepository.isFedBanned(fedId, userId)) {
            try {
              await this.telegramGateway.declineChatJoinRequest({
                chatId: update.chat.chatId,
                userId,
                token: this.telegramToken(),
              });
            } catch (error) {
              this.notaSolicitudFallida(
                "decline",
                "fedban",
                update.chat.chatId,
                userId,
                error,
              );
            }
            return null;
          }
        }
      }
    }

    // Decline anyone already listed as a known spammer in CAS, if enabled.
    if (context.chatId && mode.moderation) {
      const hygiene = await this.groupProtectionRepository.getHygiene(
        context.chatId,
      );
      if (
        hygiene.blockKnownSpammers &&
        (await this.spamCheckProvider.isKnownSpammer(userId))
      ) {
        try {
          await this.telegramGateway.declineChatJoinRequest({
            chatId: update.chat.chatId,
            userId,
            token: this.telegramToken(),
          });
        } catch (error) {
          this.notaSolicitudFallida(
            "decline",
            "spammer-conocido",
            update.chat.chatId,
            userId,
            error,
          );
        }
        return null;
      }
    }

    // Cross-group requirement: decline anyone who is not (verifiably) a member
    // of the chat this one requires. Fail-closed on API errors — an unverifiable
    // requirement is treated the same as not meeting it.
    if (context.chatId && mode.moderation) {
      const gates = await this.groupProtectionRepository.listMembershipGates(
        context.chatId,
      );
      for (const gate of gates) {
        const memberCheck = await this.telegramGateway.getChatMember({
          chatId: gate.requiredTelegramChatId,
          userId,
          token: this.telegramToken(),
        });
        if (
          !memberCheck.ok ||
          !isActiveChatMember(memberCheck.status as never)
        ) {
          try {
            await this.telegramGateway.declineChatJoinRequest({
              chatId: update.chat.chatId,
              userId,
              token: this.telegramToken(),
            });
          } catch (error) {
            this.notaSolicitudFallida(
              "decline",
              "no-cumple-el-grupo-requerido",
              update.chat.chatId,
              userId,
              error,
            );
          }
          return null;
        }
      }
    }

    // Guardian Verification: Mini App camera-based check before granting
    // entry. Supersedes the plain autoApprove toggle below when enabled for
    // this chat. Feature-detected: a chat_join_request without query_id means
    // the bot isn't Bot-API-10.1-capable for this request, so this falls
    // through to the existing behavior unchanged.
    if (context.chatId && update.joinRequest?.queryId) {
      const guardianSettings = await this.guardianRepository.getSettings(
        context.tenantId,
        context.chatId,
      );
      if (
        guardianSettings?.enabled &&
        guardianSettings.mode !== "off" &&
        (await this.startGuardianVerification(
          context,
          update,
          guardianSettings,
        ))
      ) {
        return null;
      }
    }

    const hygiene = context.chatId
      ? await this.groupProtectionRepository.getHygiene(context.chatId)
      : null;

    if (hygiene?.autoApprove) {
      try {
        await this.telegramGateway.approveChatJoinRequest({
          chatId: update.chat.chatId,
          userId,
          token: this.telegramToken(),
        });
      } catch (error) {
        // El más caro de los cuatro: si esto falla callado, la persona se queda
        // fuera del grupo y no hay ni rastro de por qué.
        this.notaSolicitudFallida(
          "approve",
          "auto-aprobar",
          update.chat.chatId,
          userId,
          error,
        );
      }
    }

    return null;
  }

  /**
   * Opens the Guardian Verification Mini App for a `chat_join_request` that
   * carries a Bot API 10.1 `query_id`. Returns true when Guardian took over
   * the request (caller must not fall through to plain autoApprove), false to
   * defer to existing behavior — missing prerequisites, or a technical
   * problem that must NOT silently approve (the request just stays pending in
   * Telegram's native UI, where STAFF can still act on it manually).
   */
  private async startGuardianVerification(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    settings: GuardianSettingsState,
  ): Promise<boolean> {
    const queryId = update.joinRequest?.queryId;
    if (
      !context.chatId ||
      !update.chat.chatId ||
      !update.user.userId ||
      !queryId
    ) {
      return false;
    }
    const sessionSecret = this.env.GUARDIAN_SESSION_SECRET;
    if (!sessionSecret) {
      return false;
    }

    // Arranca aquí para poder repartir culpas en el log de abajo: lo que tarde
    // este método es lo único que está en nuestra mano.
    const empezadoEn = Date.now();
    const userId = update.user.userId;
    const nonce = generateChallengeNonce();
    const seed = randomInt(0, 2 ** 31);
    // Photo-mode: one (or, with double verification, two) hand gesture(s) the
    // user performs with their face visible, verified server-side by the
    // vision AI (gesture + real-person + age, + same-person across both
    // photos when requiredPhotos is 2). Difficulty-based multi-step liveness
    // is no longer used.
    // Test-only gesture pin (see GUARDIAN_TEST_FORCED_GESTURE docstring in
    // env.ts/challenge.ts) — GUARDIAN_TEST_MODE is itself hard-blocked from
    // ever being true in production (see env.ts's superRefine), so this can
    // never take effect outside a deliberately-flagged test environment.
    const forcedGesture = this.env.GUARDIAN_TEST_MODE
      ? this.env.GUARDIAN_TEST_FORCED_GESTURE
      : undefined;
    const forcedGesture2 = this.env.GUARDIAN_TEST_MODE
      ? this.env.GUARDIAN_TEST_FORCED_GESTURE_2
      : undefined;
    // Anti-preparation: don't re-issue a gesture this person was already asked
    // for in their last few verifications, so a retry can't land on one they
    // already have a photo staged for. Best-effort — a failed lookup only
    // weakens the rule, it must never block a join request from being verified.
    let recentGestures: string[] = [];
    try {
      recentGestures = await this.guardianRepository.listRecentGestures(
        context.tenantId,
        context.chatId,
        userId,
      );
    } catch {
      // Fall through with an empty list (full gesture pool).
    }
    const challenge = generateGestureChallenge(
      seed,
      nonce,
      settings.requiredPhotos === 2 ? 2 : 1,
      forcedGesture,
      forcedGesture2,
      recentGestures,
    );
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + settings.sessionTtlSeconds * 1000);

    // Auto-approval is a premium capability: a chat can only actually AUTO/
    // STRICT-approve when it holds an active AI pack. Without one, guardian
    // still runs the full camera check, but every case is routed to STAFF for a
    // manual decision. Resolved at runtime (not only in config) so an EXPIRED
    // pack correctly downgrades an already-auto chat on its next join request,
    // and snapshotted into session.mode below so the API decides under the mode
    // that was in force when the person started — matching the session's
    // existing point-in-time capture (a mid-flow config/pack change can't
    // reinterpret an in-flight verification).
    let effectiveMode = settings.mode;
    if (settings.mode === "auto" || settings.mode === "strict") {
      const groupHasAiPack = await this.aiAccessRepository.hasAccess(
        update.chat.chatId,
      );
      effectiveMode = resolveEffectiveGuardianMode(
        settings.mode,
        groupHasAiPack,
      );
    }

    // A fresh chat_join_request means the person is genuinely trying again, so
    // supersede whatever stale session they left behind instead of silently
    // dropping this attempt as a duplicate (idempotencyKey is unique per
    // chat+user, so createSession below would otherwise collide and they would
    // be stuck with no way back in — no Mini App, no error, nothing).
    //
    // Superseded: "awaiting_retry" (a STAFF-requested repeat they never did)
    // and "pending" with no attempt yet — someone who opened the Mini App and
    // closed it half way. That second case was the common one and was NOT
    // handled: they had to wait out the full TTL before a retry did anything,
    // with nothing on screen telling them so, so they re-requested, got
    // silence, and gave up.
    //
    // NEVER superseded: capturing/analyzing, or anything with an attempt
    // already submitted — there is real work in flight and cancelling it would
    // throw away a photo the person already took.
    const existingActive = await this.guardianRepository.findActiveSession(
      context.chatId,
      userId,
    );
    // Telegram REDELIVERS a webhook it thinks went unacknowledged, and that
    // redelivery looks exactly like a re-request. Superseding on one would
    // cancel the live session and open a second Mini App, killing the link the
    // person already has on screen. Time separates them: a redelivery lands in
    // seconds, a human retry takes minutes. Only "pending" needs this guard —
    // "awaiting_retry" is reached by a STAFF action, never by a webhook.
    const RE_REQUEST_GRACE_MS = 90_000;
    const supersedable =
      existingActive !== null &&
      existingActive.attemptCount === 0 &&
      (existingActive.status === "awaiting_retry" ||
        (existingActive.status === "pending" &&
          Date.now() - existingActive.createdAt.getTime() >
            RE_REQUEST_GRACE_MS));
    if (existingActive && supersedable) {
      await this.guardianRepository.resolveSession(
        existingActive.id,
        existingActive.version,
        {
          status: "cancelled",
          resolvedAt: new Date(),
          clearIdempotencyKey: true,
          clearQueryId: true,
        },
      );
    }

    const session = await this.guardianRepository.createSession({
      tenantId: context.tenantId,
      chatId: context.chatId,
      telegramChatId: update.chat.chatId,
      telegramUserId: userId,
      joinRequestQueryIdEncrypted: encryptJoinRequestQueryId(
        queryId,
        sessionSecret,
      ),
      mode: effectiveMode,
      challengeDefinition: challenge as unknown as Record<string, unknown>,
      challengeNonce: nonce,
      sessionTokenHash: hashSessionToken(token),
      expiresAt,
      idempotencyKey: computeSessionIdempotencyKey(context.chatId, userId),
      ...(update.user.username ? { username: update.user.username } : {}),
      ...(update.user.firstName ? { firstName: update.user.firstName } : {}),
      ...(update.joinRequest?.lastName
        ? { lastName: update.joinRequest.lastName }
        : {}),
      ...(update.user.languageCode
        ? { languageCode: update.user.languageCode }
        : {}),
      ...(update.joinRequest?.inviteLinkName
        ? { inviteLinkName: update.joinRequest.inviteLinkName }
        : {}),
      ...(update.joinRequest?.userChatId !== undefined
        ? { userChatId: update.joinRequest.userChatId }
        : {}),
    });

    if (!session) {
      // An active session already exists for this person in this chat (a
      // retried webhook/update) — don't open a second Mini App / resend.
      return true;
    }

    // Guardian's Mini App link must follow tunnel rotation like every other
    // appUrl use in this file — resolveGuardianMiniAppUrl only sees the static
    // env.TELEGRAM_APP_URL, so resolve the live one first (readAppUrl still
    // falls through to the static value when unpinned and the state file is
    // absent). GUARDIAN_MINIAPP_URL, if explicitly set, still wins.
    const liveAppUrl = readAppUrl(this.env.TELEGRAM_APP_URL);
    const miniAppUrl = `${resolveGuardianMiniAppUrl({ ...this.env, TELEGRAM_APP_URL: liveAppUrl })}?session=${encodeURIComponent(token)}`;
    /**
     * El reparto de milisegundos de la ventana: cuánto llevaba viva la
     * solicitud al llegarnos, y cuánto la tuvimos nosotros. Solo el segundo
     * tiene arreglo por nuestra parte.
     *
     * Se calcula al vuelo, en cada fallo, y ya no solo cuando cae el botón
     * nativo. El DM por `user_chat_id` tiene su PROPIA ventana —5 minutos, y
     * solo mientras la solicitud siga sin procesar— y cuando fallaba se
     * anotaba el 403 pelado, sin una sola cifra. Con eso no había forma de
     * distinguir las dos únicas causas posibles: que el update nos llegara
     * tarde, o que se la cerráramos nosotros al responder al `query_id`. La
     * primera no la arregla nadie desde aquí; la segunda se arregla mandando
     * el DM antes que el botón. Sin este dato, elegir entre las dos era
     * adivinar.
     */
    const repartoDeMilisegundos = (): string => {
      const nuestrosMs = Date.now() - empezadoEn;
      const pedidaEn = update.joinRequest?.requestedAt;
      return pedidaEn !== undefined
        ? `antes de llegarnos: ${
            Date.now() - pedidaEn.getTime() - nuestrosMs
          } ms; en nuestras manos: ${nuestrosMs} ms`
        : `antes de llegarnos: desconocido (Telegram no mandó fecha); en nuestras manos: ${nuestrosMs} ms`;
    };
    /** El reparto del botón nativo, para el veredicto conjunto de más abajo. */
    let diagnosticoEntrega = "";

    const enviarBotonNativo = async (): Promise<boolean> => {
      try {
        await this.telegramGateway.sendChatJoinRequestWebApp({
          chatJoinRequestQueryId: queryId,
          webAppUrl: miniAppUrl,
          token: this.telegramToken(),
        });
        return true;
      } catch (error) {
        // Still best-effort — the request stays pending in Telegram's native UI
        // and the session is already stored, so there is nothing to roll back.
        //
        // Esto NO afirma ya que la persona se quedara sin enlace, porque en este
        // punto todavía no se sabe: el DM de abajo va por `user_chat_id`, que
        // tiene su propia ventana (más larga que la del query_id) y lleva el
        // mismo enlace dentro. El mensaje viejo daba por perdida a la persona
        // ANTES de intentar rescatarla, y de ahí salió el recuento de "12 que no
        // recibieron nada" que motivó todo esto. La misma mentira que los 27:
        // afirmar un desenlace que aún no ha ocurrido.
        //
        // El veredicto de verdad se emite después, cuando han fallado los dos.
        //
        // Los dos números reparten la culpa de la ventana agotada. Ver
        // `repartoDeMilisegundos`.
        diagnosticoEntrega = repartoDeMilisegundos();
        this.logger.warn(
          `guardian: no se pudo entregar el botón nativo de la sesión ${session.id} (usuario ${userId}) — queda el DM por user_chat_id [${diagnosticoEntrega}]: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return false;
      }
    };

    // Telegram writes the prompt for sendChatJoinRequestWebApp itself — we
    // control not one word of it — and the funnel says 48% of people reach that
    // prompt and never tap through, with the button now proven to arrive. They
    // are not failing to receive it; they are declining a bare request for a
    // selfie from a bot that has not said why.
    //
    // user_chat_id is the one channel where we can answer that, and it has been
    // stored on every session and never used. Telegram allows a message here
    // while the join request is pending, which is exactly the window that
    // matters. Best-effort in every sense: the person still has the native
    // button, so a failure here costs an explanation, never the way in.
    const userChatId = update.joinRequest?.userChatId;
    const enviarDm = async (): Promise<boolean> => {
      if (userChatId === undefined) {
        return false;
      }
      const retentionDays = Math.max(
        1,
        Math.round(settings.mediaRetentionHours / 24),
      );
      try {
        await this.telegramGateway.sendMessage({
          chatId: userChatId,
          token: this.telegramToken(),
          reply: {
            text: [
              "👋 Has pedido entrar al grupo.",
              "",
              "Antes de abrirte la puerta necesitamos comprobar que hay una persona real detrás — es lo que mantiene fuera a los bots y a las cuentas falsas.",
              "",
              "Es rápido: te pedimos una foto haciendo un gesto concreto que te decimos en el momento. Menos de un minuto.",
              "",
              `La revisa el equipo del grupo y la foto se borra sola a los ${retentionDays} días. No pedimos teléfono, ni DNI, ni ubicación.`,
              "",
              "Toca el botón para empezar 👇",
            ].join("\n"),
            replyMarkup: {
              inline_keyboard: [
                [{ text: "✅ Verificarme", web_app: { url: miniAppUrl } }],
              ],
            },
          },
        });
        return true;
      } catch (error) {
        // Muy comun y NO es culpa nuestra: Telegram lo rechaza siempre que la
        // persona nunca ha abierto un chat con el bot.
        //
        // Estaba en `debug`, que este proceso NO emite — server.ts arranca con
        // logger: ["error","warn","log"]. Es decir: el resultado de la unica
        // via que llega a explicar POR QUE pedimos una foto no se registraba en
        // ningun sitio. El 8-ago-2026, de 61 solicitudes de un grupo, 48 no
        // pulsaron nada, y no habia forma de saber cuantas de esas se habian
        // quedado ademas sin esta explicacion.
        //
        // A `warn`: sigue sin ser un error —la persona conserva el botón
        // nativo— pero es el dato que faltaba para poder medirlo. Su AUSENCIA
        // tambien informa: el DM se intenta siempre que hay userChatId, asi que
        // una sesion sin este aviso es una sesion que si recibio la explicacion.
        //
        // Con el reparto de milisegundos dentro, que es lo que convierte este
        // aviso en un diagnostico. Un `403 bot can't initiate conversation`
        // con "antes de llegarnos: 400000 ms" dice que la ventana ya estaba
        // muerta y aqui no hay nada que arreglar; el mismo 403 con "antes de
        // llegarnos: 3000 ms" dice que llego de sobra a tiempo y que la
        // cerramos nosotros al responder al query_id. Son arreglos opuestos y
        // hasta ahora el log no permitia elegir.
        this.logger.warn(
          `guardian: sin DM explicativo en la sesion ${session.id} (usuario ${userId}) [${repartoDeMilisegundos()}] — ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return false;
      }
    };

    // El DM primero. Es el orden correcto, y NO arregla el 403 — las dos cosas
    // a la vez, y conviene leerlas juntas antes de tocar nada aquí.
    //
    // El orden sale de la documentación, literal:
    //
    //   ChatJoinRequest.user_chat_id — "The bot can use this identifier for 5
    //   minutes to send messages UNTIL THE JOIN REQUEST IS PROCESSED, assuming
    //   no other administrator contacted the user."
    //
    //   sendChatJoinRequestWebApp — "Use this method to PROCESS a received chat
    //   join request query by showing a Mini App to the user before deciding
    //   the outcome."
    //
    // Misma palabra en los dos sitios, asi que responder al `query_id` no puede
    // ir antes del DM. Por eso esto ya no es un `Promise.all`.
    //
    // LO QUE NO ARREGLA, Y ESTA MEDIDO. La hipotesis era que ese orden bastaba.
    // Es falsa. Prueba en vivo del 2026-08-27 a las 14:26:39, cuenta nueva, ya
    // con este código desplegado:
    //
    //   sin DM explicativo ... [antes de llegarnos: -493 ms; en nuestras manos:
    //   117 ms] — 403: Forbidden: bot can't initiate conversation with a user
    //
    // Retraso de entrega cero (el negativo es desfase de reloj), DM intentado a
    // los 117 ms y ANTES de responder al query_id. Y 403 igual. O sea que el
    // permiso de `user_chat_id` no se cierra por lo que hagamos: **no llega a
    // existir**. El sospechoso es el propio flujo de guard bot —este chat tiene
    // `guard_bot` puesto y la solicitud nos llega como query—, pero Telegram no
    // documenta esa interaccion, asi que queda como observacion, no como causa
    // demostrada.
    //
    // Consecuencia practica: la explicacion de POR QUE pedimos una foto no
    // puede viajar por aqui. Los sitios donde si cabe son la descripcion del
    // grupo (que Telegram enseña ANTES de pulsar "solicitar unirse") y la
    // primera pantalla de la Mini App. Este DM se queda porque no cuesta nada y
    // si funciona para quien ya tiene chat abierto con el bot.
    //
    // El coste del orden: el botón espera lo que tarde el DM, unos cientos de
    // ms de su propia ventana. Hoy el botón acierta el 100%, asi que tiene
    // holgura; el aviso `no se pudo entregar el botón nativo` no ha aparecido
    // nunca, y en cuanto aparezca hay que volver aqui.
    const dmDelivered = await enviarDm();
    const webAppDelivered = await enviarBotonNativo();

    // AQUÍ, y solo aquí, se sabe cómo acabó. Un botón nativo caducado no deja a
    // nadie fuera si el DM salió: lleva el mismo enlace y su ventana es otra.
    // Por eso el nivel de log se decide después de los dos intentos y no
    // durante el primero.
    if (!webAppDelivered) {
      if (dmDelivered) {
        this.logger.log(
          `guardian: sesión ${session.id} (usuario ${userId}) rescatada por DM tras caducar el botón nativo [${diagnosticoEntrega}]`,
        );
      } else {
        this.logger.error(
          `guardian: la sesión ${session.id} (usuario ${userId}) no recibió NADA — ni botón nativo ni DM; esta persona sí se ha quedado fuera [${diagnosticoEntrega}]`,
        );
      }
    }

    // The person got NOTHING — neither the native button nor the DM. The usual
    // cause is a join request Telegram delivered already (near-)expired.
    //
    // Se decía aquí que el DM por user_chat_id "comparte esa misma ventana, así
    // que mueren los dos juntos". No es exactamente así —son ventanas distintas,
    // y por eso el DM rescata muchos casos que el botón nativo pierde—, pero
    // ambas cuentan desde que la persona pidió entrar, de modo que una solicitud
    // lo bastante vieja sí se lleva las dos por delante.
    //
    // They then see Telegram's "can't process the request"
    // and their join request sits pending with nobody aware it happened. Tell
    // STAFF, with real approve/decline buttons: approveChatJoinRequest works by
    // chatId+userId, NOT the dead query, so the pending request is still
    // rescuable by hand. Best-effort — losing this alert must never fail the
    // join handling itself.
    // sessionSecret is declared and guaranteed non-empty above (the method
    // returns early without it), so the callback signatures are always valid.
    if (!webAppDelivered && !dmDelivered && settings.staffChatId) {
      const label = update.user.username
        ? `@${update.user.username}`
        : (update.user.firstName ?? userId.toString());
      try {
        await this.telegramGateway.sendMessage({
          chatId: settings.staffChatId,
          token: this.telegramToken(),
          ...(settings.staffThreadId != null
            ? { messageThreadId: settings.staffThreadId }
            : {}),
          reply: {
            text: [
              "⚠️ Enlace de verificación NO entregado",
              "",
              `${label} pidió entrar, pero Telegram entregó su solicitud ya caducada y no se le pudo mostrar el enlace. No es culpa suya — es un retraso de Telegram.`,
              "",
              "Su solicitud SIGUE PENDIENTE en el grupo. Puedes:",
              "• Aprobar aquí → entra SIN pasar la cámara (salta la verificación).",
              "• Contactar y pedirle que vuelva a darle a «unirse» → así se verifica.",
            ].join("\n"),
            replyMarkup: buildManualReviewKeyboard(session.id, sessionSecret, {
              telegramUserId: userId,
              username: update.user.username ?? null,
            }),
          },
        });
      } catch {
        // Best-effort — losing the alert must not fail the join handling.
      }
    }

    return true;
  }

  /**
   * Rose-style federations: shared ban lists across many groups. A federation
   * groups several chats; an /fban propagates to all of them and any fedbanned
   * user is auto-banned on join. Owners manage admins/log/subfed; fed admins can
   * fban/unfban.
   */
  private async handleFederationCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseFederationCommand(
      await this.withReplyTarget(update, context),
    );

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    const command = result.command;
    const userId = update.user.userId;

    // Create a federation: anyone can own one.
    if (command.kind === "new") {
      if (!userId) {
        return { text: "No pude identificarte." };
      }
      const fedId = randomUUID();
      await this.federationRepository.createFederation({
        tenantId: context.tenantId,
        fedId,
        name: command.name,
        ownerTelegramId: userId,
      });
      return {
        text: `✅ Federación *${command.name}* creada.\nFedID: \`${fedId}\`\n\nEn cada grupo usa /joinfed ${fedId} para vincularlo.`,
        parseMode: "Markdown",
      };
    }

    // Commands that operate on the federation this chat belongs to.
    const chatFed = context.chatId
      ? await this.federationRepository.getFederationForChat(context.chatId)
      : null;

    if (command.kind === "join") {
      if (!context.chatId || !update.chat.chatId) {
        return { text: "Vincula el grupo con /joinfed dentro del grupo." };
      }
      const permission = await this.ensureConfigPermission(
        context,
        update,
        "fed.join",
      );
      if (!permission.allowed) {
        return {
          text: "Solo los administradores del grupo pueden vincularlo.",
        };
      }
      const fed = await this.federationRepository.getFederation(command.fedId);
      if (!fed) {
        return { text: "No existe una federación con ese FedID." };
      }
      await this.federationRepository.joinFederation(
        command.fedId,
        context.chatId,
        update.chat.chatId,
      );
      return {
        text: `✅ Este grupo se unió a la federación *${fed.name}*.`,
        parseMode: "Markdown",
      };
    }

    if (command.kind === "leave") {
      if (!context.chatId) {
        return { text: "Usa /leavefed dentro del grupo." };
      }
      const permission = await this.ensureConfigPermission(
        context,
        update,
        "fed.leave",
      );
      if (!permission.allowed) {
        return {
          text: "Solo los administradores del grupo pueden desvincularlo.",
        };
      }
      const left = await this.federationRepository.leaveFederation(
        context.chatId,
      );
      return {
        text: left
          ? "✅ Grupo desvinculado de su federación."
          : "Este grupo no estaba en ninguna federación.",
      };
    }

    if (command.kind === "chatfed") {
      return {
        text: chatFed
          ? `Este grupo pertenece a la federación *${chatFed.name}* (\`${chatFed.fedId}\`).`
          : "Este grupo no está en ninguna federación.",
        parseMode: "Markdown",
      };
    }

    if (command.kind === "info") {
      const fed = command.fedId
        ? await this.federationRepository.getFederation(command.fedId)
        : chatFed;
      if (!fed) {
        return { text: "No encontré esa federación." };
      }
      const [chatCount, banCount, adminCount] = await Promise.all([
        this.federationRepository.countFedChats(fed.fedId),
        this.federationRepository.countFedBans(fed.fedId),
        this.federationRepository.countFedAdmins(fed.fedId),
      ]);
      return {
        text: formatFedInfo({
          name: fed.name,
          fedId: fed.fedId,
          ownerTelegramId: fed.ownerTelegramId,
          chatCount,
          banCount,
          adminCount,
          subscribedFedId: fed.subscribedFedId,
        }),
        parseMode: "Markdown",
      };
    }

    if (command.kind === "stat") {
      // Scope to THIS chat's federation (and the fed it is subscribed to) so we
      // never leak other federations' private ban data to arbitrary members.
      if (!chatFed) {
        return {
          text: "Usa /fedstat dentro de un grupo que pertenezca a una federación.",
        };
      }
      const fedIds = [
        chatFed.fedId,
        ...(chatFed.subscribedFedId ? [chatFed.subscribedFedId] : []),
      ];
      const detailed: {
        name: string;
        fedId: string;
        reason: string | undefined;
      }[] = [];
      for (const fedId of fedIds) {
        const ban = await this.federationRepository.isFedBanned(
          fedId,
          command.targetTelegramUserId,
        );
        if (ban) {
          const fed = await this.federationRepository.getFederation(fedId);
          detailed.push({
            name: fed?.name ?? fedId,
            fedId,
            reason: ban.reason,
          });
        }
      }
      return { text: formatFedStat(detailed), parseMode: "Markdown" };
    }

    // The remaining commands act on the chat's federation and need fed rights.
    if (!chatFed) {
      return {
        text: "Este grupo no está en ninguna federación. Usa /joinfed <FedID> primero.",
      };
    }

    const isOwner = userId !== undefined && userId === chatFed.ownerTelegramId;
    const isFedAdmin =
      isOwner ||
      (userId !== undefined &&
        (await this.federationRepository.isFedAdmin(chatFed.fedId, userId)));

    if (command.kind === "fban" || command.kind === "unfban") {
      if (!isFedAdmin) {
        return { text: "Solo los admins de la federación pueden hacer esto." };
      }

      const target = command.targetTelegramUserId;

      // A quien NO se puede fbanear vive en `modules/security`
      // (`vetoParaFbanear`), con sus tests: un fban echa a alguien de todos
      // los grupos de la federación a la vez, asi que esas cuatro guardas son
      // lo unico que impide usarlo hacia dentro.
      const botId = this.telegramToken()?.split(":")[0];
      const veto = await vetoParaFbanear({
        objetivo: target,
        quienPide: userId,
        duenoDeLaFederacion: chatFed.ownerTelegramId,
        idDelBot: botId && /^\d+$/u.test(botId) ? BigInt(botId) : undefined,
        // Funcion y no booleano: es una consulta a la base de datos y solo
        // se hace si quien pide no es el dueño.
        objetivoEsAdmin: () =>
          this.federationRepository.isFedAdmin(chatFed.fedId, target),
      });
      if (veto) {
        return { text: textoDeVetoDeFban(veto) };
      }

      return this.applyFederationBan(context, update, chatFed.fedId, command);
    }

    if (command.kind === "fedadmins") {
      const admins = await this.federationRepository.listFedAdmins(
        chatFed.fedId,
      );
      const lines = [
        `👑 Owner: \`${chatFed.ownerTelegramId.toString()}\``,
        ...admins.map((id) => `• \`${id.toString()}\``),
      ].join("\n");
      return {
        text: `Admins de *${chatFed.name}*:\n${lines}`,
        parseMode: "Markdown",
      };
    }

    // Owner-only commands from here on.
    if (!isOwner) {
      return { text: "Solo el dueño de la federación puede hacer esto." };
    }

    if (command.kind === "fpromote") {
      await this.federationRepository.addFedAdmin(
        chatFed.fedId,
        command.targetTelegramUserId,
      );
      return {
        text: `✅ ${command.targetTelegramUserId.toString()} ahora es admin de la federación.`,
      };
    }

    if (command.kind === "fdemote") {
      const removed = await this.federationRepository.removeFedAdmin(
        chatFed.fedId,
        command.targetTelegramUserId,
      );
      return {
        text: removed
          ? `✅ ${command.targetTelegramUserId.toString()} ya no es admin de la federación.`
          : "Ese usuario no era admin de la federación.",
      };
    }

    if (command.kind === "setfedlog") {
      if (!update.chat.chatId) {
        return { text: "Usa /setfedlog en el chat/canal de logs." };
      }
      await this.federationRepository.setFedLog(
        chatFed.fedId,
        update.chat.chatId,
      );
      return { text: "✅ Este chat es ahora el registro de la federación." };
    }

    if (command.kind === "subfed") {
      const parent = await this.federationRepository.getFederation(
        command.fedId,
      );
      if (!parent) {
        return {
          text: "No existe la federación a la que quieres suscribirte.",
        };
      }
      await this.federationRepository.setSubscribedFed(
        chatFed.fedId,
        command.fedId,
      );
      return {
        text: `✅ *${chatFed.name}* ahora hereda los bans de *${parent.name}*.`,
        parseMode: "Markdown",
      };
    }

    if (command.kind === "export") {
      const bans = await this.federationRepository.listFedBans(chatFed.fedId);
      return {
        text: `\`\`\`\n${serializeFedBans(bans)}\n\`\`\``,
        parseMode: "Markdown",
      };
    }

    // import
    const parsed = parseFedImport(command.data);
    if (!parsed) {
      return { text: "El JSON de importacion no es valido." };
    }
    for (const entry of parsed) {
      await this.federationRepository.addFedBan({
        fedId: chatFed.fedId,
        subjectTelegramId: entry.subjectTelegramId,
        reason: entry.reason,
        actorTelegramId: userId,
      });
    }
    return { text: `✅ Importados ${parsed.length} bans a la federación.` };
  }

  /**
   * Records the fed ban/unban and propagates it to every chat of the federation
   * via banChatMember/unbanChatMember.
   */
  private async applyFederationBan(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    fedId: string,
    command:
      | {
          kind: "fban";
          targetTelegramUserId: bigint;
          reason: string | undefined;
        }
      | { kind: "unfban"; targetTelegramUserId: bigint },
  ): Promise<BotReply> {
    const chats = await this.federationRepository.listFederationChats(fedId);
    const banning = command.kind === "fban";

    if (banning) {
      await this.federationRepository.addFedBan({
        fedId,
        subjectTelegramId: command.targetTelegramUserId,
        reason: command.reason,
        actorTelegramId: update.user.userId,
      });
    } else {
      await this.federationRepository.removeFedBan(
        fedId,
        command.targetTelegramUserId,
      );
    }

    let applied = 0;
    for (const chat of chats) {
      try {
        if (banning) {
          await this.telegramGateway.banChatMember({
            chatId: chat.telegramChatId,
            userId: command.targetTelegramUserId,
            token: this.telegramToken(),
            untilDate: undefined,
          });
        } else {
          await this.telegramGateway.unbanChatMember({
            chatId: chat.telegramChatId,
            userId: command.targetTelegramUserId,
            token: this.telegramToken(),
          });
        }
        applied += 1;
      } catch {
        // A failure in one chat never stops propagation to the rest.
      }
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: banning ? "federation.fban" : "federation.unfban",
      resourceType: "federation",
      resourceId: fedId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        targetTelegramUserId: command.targetTelegramUserId.toString(),
        chatsAffected: applied,
      },
    });

    return {
      text: banning
        ? `🔨 Fedban aplicado a ${command.targetTelegramUserId.toString()} en ${applied} grupo(s) de la federación.`
        : `✅ Fedban retirado de ${command.targetTelegramUserId.toString()} en ${applied} grupo(s).`,
    };
  }

  /**
   * On join, ban any member who is fedbanned in the federation this chat belongs
   * to (or in the federation it is subscribed to). Returns null so the normal
   * welcome/captcha flow still runs for legitimate members.
   */
  private async enforceFederationBans(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<void> {
    if (!context.chatId || !update.chat.chatId) {
      return;
    }

    const fed = await this.federationRepository.getFederationForChat(
      context.chatId,
    );
    if (!fed) {
      return;
    }

    const fedIds = [
      fed.fedId,
      ...(fed.subscribedFedId ? [fed.subscribedFedId] : []),
    ];

    for (const memberId of update.newChatMemberIds) {
      for (const fedId of fedIds) {
        const ban = await this.federationRepository.isFedBanned(
          fedId,
          memberId,
        );
        if (!ban) {
          continue;
        }
        try {
          await this.telegramGateway.banChatMember({
            chatId: update.chat.chatId,
            userId: memberId,
            token: this.telegramToken(),
            untilDate: undefined,
          });
        } catch {
          // Best-effort.
        }
        break;
      }
    }
  }

  /**
   * On join (direct add, no join request), kick any new member who is not a
   * verifiable member of this chat's required chat. Covers groups that do not
   * use join requests, where {@link handleJoinRequest}'s decline never fires —
   * the person is already in by the time this runs, so the enforcement is a
   * kick (ban+unban) rather than a decline. Fail-closed on API errors, same as
   * the join-request path.
   */
  private async enforceMembershipGate(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<void> {
    if (!context.chatId || !update.chat.chatId) {
      return;
    }

    const gates = await this.groupProtectionRepository.listMembershipGates(
      context.chatId,
    );
    if (gates.length === 0) {
      return;
    }

    for (const memberId of update.newChatMemberIds) {
      let passesAllRequirements = true;
      for (const gate of gates) {
        const memberCheck = await this.telegramGateway.getChatMember({
          chatId: gate.requiredTelegramChatId,
          userId: memberId,
          token: this.telegramToken(),
        });
        if (memberCheck.ok && isActiveChatMember(memberCheck.status as never)) {
          continue;
        }
        passesAllRequirements = false;
        break;
      }
      if (passesAllRequirements) {
        continue;
      }
      await this.applyTelegramEnforcement("kick", update, memberId, undefined);
    }
  }

  /**
   * Rose/Combot-style global ban list: on join, checks each new member against
   * CAS (a public, free, shared database of known spammers) and bans anyone
   * already listed there. Opt-in per chat via hygiene.blockKnownSpammers.
   * CAS failures never block a join (see {@link HttpSpamCheckProvider}) — this
   * only ever adds bans, never rejections due to our own unavailability.
   */
  private async enforceSpamCheck(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<void> {
    if (!context.chatId || !update.chat.chatId) {
      return;
    }

    const hygiene = await this.groupProtectionRepository.getHygiene(
      context.chatId,
    );
    if (!hygiene.blockKnownSpammers) {
      return;
    }

    for (const memberId of update.newChatMemberIds) {
      if (await this.spamCheckProvider.isKnownSpammer(memberId)) {
        await this.applyTelegramEnforcement("ban", update, memberId, undefined);
        await this.repository.recordAudit({
          tenantId: context.tenantId,
          actorType: "system",
          action: "spamcheck.autoban",
          resourceType: "chat_member",
          resourceId: memberId.toString(),
          payload: { chatId: context.chatId, source: "cas" },
        });
        await this.emitOwnerNetworkRoute({
          context,
          sourceChatId: context.chatId,
          eventKind: "spam_alerts",
          fallbackEventKind: "logs",
          title: "Spammer conocido baneado",
          body: [
            `Grupo: ${update.chat.chatId?.toString() ?? context.chatId}`,
            `Usuario: ${memberId.toString()}`,
            `Fuente: CAS`,
          ].join("\n"),
        });
      }
    }
  }

  /**
   * Proactive counterpart to {@link handleMembershipGateCheck}: reacts to a
   * Telegram `chat_member` update (the bot must be an admin of the chat where
   * it fires, and it must be requesting the update type — see
   * {@link managedBotAllowedUpdates} and `apps/bot/src/poller.ts`). The moment
   * someone leaves/is removed from a chat, this looks up every OTHER chat that
   * requires membership in it and kicks them from those immediately, instead
   * of waiting for their next message. This is the closest thing to "seeing
   * every member": Telegram has no endpoint to list a chat's members, but it
   * WILL push every status change in a chat the bot administers.
   */
  /**
   * Watches what the admins THIS BOT appointed do to other members, and pulls
   * the badge when one of them crosses a line.
   *
   * Runs before handleChatMemberUpdate's own filtering because that method only
   * cares about people LEAVING a chat, while a rogue admin also promotes and
   * unbans — status changes that leave the subject perfectly active.
   *
   * Everything here is best-effort and swallows its own errors: a failure to
   * police an admin must never stop the membership-gate work that follows.
   */
  /**
   * Appointing, revoking and listing the admins the bot can take back.
   *
   * Admin-gated: handing out moderation powers is itself a moderation power.
   * Returns null only when the command was not for us after all, so the caller
   * can fall through to the rest of the pipeline.
   */
  /**
   * Stamps the verdict on every OTHER room the STAFF report reached.
   *
   * Only the tapped copy is edited by the normal reply path, so without this the
   * mirrors keep buttons that look live for a case that is already closed. The
   * session's optimistic lock means pressing them is harmless — it answers
   * "ya fue decidida" — but a button that cannot do anything should not look
   * like one that can.
   *
   * Replaces the KEYBOARD rather than the text, deliberately: the Bot API has no
   * way to read another message's current caption back, so editing the text
   * would mean overwriting the whole report with just a verdict line. Swapping
   * the buttons for a single inert label keeps the full report and still says,
   * visibly, how it ended.
   *
   * Best-effort throughout: a room that refuses must not break the decision that
   * already succeeded.
   */
  /**
   * Rotates a pending session onto a fresh token and gets the link back to the
   * person — by DM if they have ever spoken to the bot, otherwise by handing
   * the admin a `?start=` deep link to forward.
   *
   * The old token is unrecoverable by design (only its hash is stored), so a
   * "resend" is always a rotation, never a re-send of the same URL.
   */
  private async resendVerificationLink(
    session: VerificationSessionRecord,
    configuredTtlSeconds: number | undefined,
    adminId: bigint | undefined,
  ): Promise<BotReply> {
    const newToken = generateSessionToken();
    // Same reasoning as the STAFF repeat: the 10-minute default is sized for
    // someone with the Mini App already opening. This link crosses a human
    // relay, so it needs to outlive that.
    const ttlSeconds = Math.max(
      configuredTtlSeconds ?? 600,
      GUARDIAN_RETRY_TTL_SECONDS,
    );
    const updated = await this.guardianRepository.resolveSession(
      session.id,
      session.version,
      {
        status: "awaiting_retry",
        sessionTokenHash: hashSessionToken(newToken),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      },
    );
    if (!updated) {
      // The optimistic lock lost: something else resolved this session between
      // the lookup and here. Saying so beats sending a link that is already dead.
      return {
        text: "Esa verificación acaba de cambiar de estado. Vuelve a intentarlo.",
      };
    }

    const liveAppUrl = readAppUrl(this.env.TELEGRAM_APP_URL);
    const miniAppUrl = `${resolveGuardianMiniAppUrl({ ...this.env, TELEGRAM_APP_URL: liveAppUrl })}?session=${encodeURIComponent(newToken)}`;
    const personLabel = session.username
      ? `@${session.username}`
      : [session.firstName, session.lastName].filter(Boolean).join(" ") ||
        session.telegramUserId.toString();

    let dmSent = false;
    try {
      await this.telegramGateway.sendMessage({
        chatId: session.telegramUserId,
        token: this.telegramToken(),
        reply: {
          text: "📸 Aquí tienes tu verificación otra vez. Ábrela y termínala sin cerrar la ventana.",
          replyMarkup: {
            inline_keyboard: [
              [{ text: "📸 Verificarme", web_app: { url: miniAppUrl } }],
            ],
          },
        },
      });
      dmSent = true;
    } catch {
      // Normal, not exceptional: Telegram blocks DMs to anyone who has never
      // started a chat with the bot, which is most people in this situation.
    }
    if (dmSent) {
      return {
        text: `✅ Le he mandado a ${personLabel} un enlace nuevo por privado. Le vale ${formatRetryTtl(ttlSeconds)}.`,
      };
    }

    // A `?start=` deep link rather than the Mini App URL precisely BECAUSE the
    // person never started the bot: tapping it opens the bot chat with a START
    // button, and pressing START is itself the first contact that unblocks DMs.
    // The token is bound to this one session, so it is useless to anyone else.
    const botUsername = this.env.TELEGRAM_BOT_USERNAME.replace(/^@/u, "");
    const startLink = `https://t.me/${botUsername}?start=${GUARDIAN_RETRY_START_PREFIX}${newToken}`;
    if (adminId !== undefined) {
      // Dos mensajes, no uno: la explicacion para el admin, y aparte el texto
      // ya redactado que puede REENVIAR de un toque. Metido todo junto, el
      // admin tenia que escribir el mensaje a mano, y el enlace iba dentro de
      // un texto que hablaba de esa persona en tercera persona.
      await this.telegramGateway
        .sendMessage({
          chatId: adminId,
          token: this.telegramToken(),
          reply: {
            text: [
              `No he podido escribir a ${personLabel} por privado (nunca ha hablado conmigo).`,
              "",
              "👇 Reenvíale el mensaje de abajo. Va escrito tal cual: no tienes que redactar nada.",
            ].join("\n"),
          },
        })
        .catch(() => undefined);
      await this.telegramGateway
        .sendMessage({
          chatId: adminId,
          token: this.telegramToken(),
          reply: {
            text: [
              "👋 Te falta un paso para entrar al grupo.",
              "",
              "Pulsa este enlace y dale a EMPEZAR; te mando la verificación al momento:",
              "",
              startLink,
              "",
              `Es una foto haciendo un gesto que te digo sobre la marcha, menos de un minuto. No pedimos teléfono, ni DNI, ni ubicación. El enlace es solo tuyo y caduca en ${formatRetryTtl(ttlSeconds)}.`,
            ].join("\n"),
            disableWebPagePreview: true,
          },
        })
        .catch(() => undefined);
    }
    return {
      text: `No puedo escribir a ${personLabel} por privado (nunca ha hablado conmigo), así que te he mandado el enlace a ti por privado para que se lo pases. Le vale ${formatRetryTtl(ttlSeconds)}.`,
    };
  }

  /** Fetches the delivered copies and applies isMirroredStaffCopy, which owns
   * the rule and is tested on its own. */
  private async tappedCopyIsMirror(
    sessionId: string,
    update: TelegramUpdateEnvelope,
  ): Promise<boolean> {
    const copies = await this.guardianRepository
      .listStaffReportCopies(sessionId)
      .catch((error: unknown) => {
        // Failing open matches the rule's own bias, but it must not be silent:
        // this is the branch where a database problem quietly widens who gets
        // to decide a case.
        this.logger.warn(
          `guardian: could not read staff report copies for session ${sessionId}, allowing the action — ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return [];
      });
    return isMirroredStaffCopy(copies, {
      chatId: update.chat.chatId,
      messageId: extractCallbackMessageId(update.raw),
    });
  }

  private async markOtherStaffCopiesDecided(
    sessionId: string,
    update: TelegramUpdateEnvelope,
    verdictLabel: string,
  ): Promise<void> {
    const copies = await this.guardianRepository
      .listStaffReportCopies(sessionId)
      .catch(() => []);
    if (copies.length < 2) {
      return;
    }
    const tappedChatId = update.chat.chatId;
    const tappedMessageId = extractCallbackMessageId(update.raw);
    const token = this.telegramToken();

    for (const copy of copies) {
      if (
        copy.telegramChatId === tappedChatId &&
        copy.messageId === tappedMessageId
      ) {
        continue;
      }
      await this.telegramGateway
        .editMessageReplyMarkup({
          chatId: copy.telegramChatId,
          messageId: copy.messageId,
          token,
          // Telegram requires callback_data on every inline button, so the
          // label is a real button that answers "already decided" if pressed.
          replyMarkup: {
            inline_keyboard: [
              [{ text: verdictLabel, callback_data: "gv:decided" }],
            ],
          },
        })
        .catch(() => undefined);
    }
  }

  private async handleAppointedAdminCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    parsed: AppointedAdminCommandResult,
  ): Promise<BotReply | null> {
    if (!parsed.ok) {
      return { text: parsed.error.usage };
    }
    const telegramChatId = update.chat.chatId;
    if (!telegramChatId || !context.chatId) {
      return { text: "Estos comandos se usan dentro de un grupo." };
    }
    if (!(await this.isActorAdmin(context, update))) {
      return { text: "Solo un administrador del grupo puede usar esto." };
    }
    const command = parsed.command;
    // Ser admin basta para MIRAR la lista (/adminlist, /adoptaradmins), pero no
    // para tocarla: eso pide el permiso de nombrar admins. Ver `actorCanPromote`
    // — sin esta línea el comando regalaba un poder que el grupo había negado.
    if (
      (command.kind === "appoint" || command.kind === "revoke") &&
      !(await this.actorCanPromote(update))
    ) {
      return { text: BotUpdateService.PROMOTE_DENIED_TEXT };
    }
    const token = this.telegramToken();

    if (command.kind === "list") {
      const rows = await this.botGrantedAdminRepository.list(
        context.tenantId,
        context.chatId,
      );
      const active = rows.filter((row) => row.status === "active");
      // The live list is what actually holds power; ours is only what we can
      // take back. Showing the gap is the whole point of this command.
      const live = await this.telegramGateway.getChatAdministrators({
        chatId: telegramChatId,
        token,
      });
      // No saber quien es admin NO es lo mismo que no haya ninguno fuera.
      //
      // Sin esta guarda, con un token ausente o con un 2xx de cuerpo
      // ilegible —que el gateway degrada a `{ok:true}` sin `result`— la
      // lista sale vacia y el bot imprime "Admins que NO nombre yo: 0": un
      // todo-en-orden rotundo sobre justo lo que este comando vigila. Quien
      // venia a comprobar si alguien se colo se va tranquilo.
      //
      // La rama `adopt`, cincuenta lineas mas abajo, ya lo comprobaba.
      if (!live.ok) {
        return {
          text: "No he podido preguntarle a Telegram quien es administrador ahora mismo. Vuelve a intentarlo: prefiero no decirte que esta todo en orden sin haberlo mirado.",
        };
      }
      const ours = new Set(active.map((row) => row.telegramUserId.toString()));
      const botId = this.currentBotTelegramId();
      const outside = (live.admins ?? [])
        // The owner can be demoted by nobody, bot or human, and the bot itself
        // is not a threat to guard against. Listing either as "beyond reach"
        // turns a normal group into one that always looks compromised.
        .filter((admin) => !admin.isOwner && admin.userId !== botId)
        .map((admin) => admin.userId.toString())
        .filter((id) => !ours.has(id));

      return {
        // Named-app URL button, not web_app: the latter only works in private
        // chats and this is used inside the group. The screen re-checks admin
        // server-side, so the button is a shortcut, never the access control.
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text: "⚙️ Ajustes de vigilancia",
                url: buildNamedMiniAppLink(
                  this.env.TELEGRAM_BOT_USERNAME.replace(/^@/u, ""),
                  this.env.TELEGRAM_MINIAPP_NAME,
                  encodeAppointedAdminsStartParam(telegramChatId.toString()),
                ),
              },
            ],
          ],
        },
        text: [
          `🛡 Nombrados por mí (puedo revocarlos): ${active.length}`,
          ...active.map(
            (row) =>
              `· ${row.username ? `@${row.username}` : row.telegramUserId.toString()}${
                row.adoptedExisting ? " (adoptado)" : ""
              }`,
          ),
          "",
          `⚠️ Admins que NO nombré yo: ${outside.length}`,
          ...(outside.length > 0
            ? [
                ...outside.map((id) => `· ${id}`),
                "",
                "Telegram no me deja degradar a estos. Usa /adoptaradmins para ponerlos bajo vigilancia.",
              ]
            : []),
        ].join("\n"),
      };
    }

    if (command.kind === "adopt") {
      const live = await this.telegramGateway.getChatAdministrators({
        chatId: telegramChatId,
        token,
      });
      if (!live.ok) {
        return { text: "No he podido leer la lista de administradores." };
      }
      const rows = await this.botGrantedAdminRepository.list(
        context.tenantId,
        context.chatId,
        "active",
      );
      const ours = new Set(rows.map((row) => row.telegramUserId.toString()));
      const botId = this.currentBotTelegramId();
      const candidates = (live.admins ?? []).filter(
        (admin) =>
          !ours.has(admin.userId.toString()) &&
          admin.userId !== botId &&
          // The owner cannot be demoted by anyone, bot or not. Offering to
          // "adopt" them would promise a revocation that can never happen.
          !admin.isOwner,
      );
      if (candidates.length === 0) {
        return { text: "Todos los administradores ya están bajo vigilancia." };
      }
      return {
        text: [
          `Voy a re-nombrar a ${candidates.length} administrador(es) para poder revocarlos si hace falta.`,
          "",
          "⚠️ Esto les cambia los permisos al set fijo de Modryva: se quedan solo con la insignia de administrador y moderan por comandos míos (/ban, /kick, /mute, /del, /pin…). Pierden los botones nativos de Telegram, y con ellos la posibilidad de sancionar sin dejar rastro.",
          "",
          "Confirma uno a uno con /admin respondiendo a un mensaje suyo, o pulsa el botón.",
          ...candidates.map((admin) => `· ${admin.userId.toString()}`),
        ].join("\n"),
      };
    }

    // appoint / revoke both need a concrete target.
    const reply = extractReplyContext(update.raw);
    const mentioned = extractMentionTargetId(update.raw);
    let targetId = reply.userId ?? mentioned ?? command.targetUserId;
    const targetUsername = reply.username ?? command.targetUsername ?? null;
    if (targetId === undefined && command.targetUsername) {
      // Bot API has no username lookup; ours does, for anyone who has spoken.
      targetId =
        (await this.repository
          .findTelegramUserIdByUsername(command.targetUsername)
          .catch(() => null)) ?? undefined;
    }
    if (targetId === undefined) {
      return {
        text: [
          "No sé quién es esa persona.",
          "Telegram no me deja buscar por @usuario si nunca ha escrito aquí.",
          "Responde a un mensaje suyo con el comando y ya está.",
        ].join("\n"),
      };
    }

    if (command.kind === "revoke") {
      const revoked = await this.botGrantedAdminRepository.revoke({
        tenantId: context.tenantId,
        chatId: context.chatId,
        telegramUserId: targetId,
        reason: "manual",
      });
      if (!revoked) {
        return {
          text: "Esa persona no está en mi lista, así que Telegram no me deja quitarle nada.",
        };
      }
      // El `.catch` no es cosmetico, y las otras dos llamadas a
      // `demoteChatMember` de este fichero ya lo llevan — una con un
      // comentario diciendo que un error escapado se llevo por delante el
      // update entero en pruebas. Esta era la unica sin el.
      //
      // Sin el, la secuencia deja el estado exacto que este comando existe
      // para impedir: la fila del libro mayor ya se marco revocada, el demote
      // lanza, el grupo no recibe respuesta, el poller reentrega y en el
      // segundo intento `revoke()` devuelve null —ya no esta activa— asi que
      // se contesta "esa persona no esta en mi lista" **sin volver a
      // intentar la degradacion**. La insignia se queda puesta y fuera del
      // libro: un administrador que ya no se puede quitar.
      const demoted = await this.telegramGateway
        .demoteChatMember({
          chatId: telegramChatId,
          userId: targetId,
          token,
        })
        .catch(() => ({ ok: false }) as const);
      return {
        text: demoted.ok
          ? `Hecho: ${targetUsername ? `@${targetUsername}` : targetId.toString()} ya no es administrador.`
          : "Lo he quitado de mi lista, pero Telegram rechazó la degradación. Compruébalo a mano.",
      };
    }

    // Telegram refuses to let one bot change another bot's admin rights
    // (BOT_CHANNELS_NA — verified live). Appointing a bot would therefore
    // create precisely what this feature exists to prevent: an administrator
    // the guard can detect abusing the group and can never take the badge from.
    // Refuse up front rather than discover it at the worst possible moment.
    const member = await this.telegramGateway.getChatMember({
      chatId: telegramChatId,
      userId: targetId,
      token,
    });
    // `!== false` y no `=== true`: la duda cuenta como bot.
    //
    // `getChatMember` no lanza a proposito — ante 400, 403 o timeout devuelve
    // `{ok:false}` sin `isBot`—, asi que con `=== true` un "no lo se" pasaba
    // por "no es un bot" y la promocion seguia adelante. Y promover a un bot
    // crea un administrador que **no se puede degradar nunca**: Telegram no
    // deja que un bot toque los permisos de otro.
    //
    // `actorCanPromote`, en este mismo fichero, ya deniega ante fallo de
    // consulta con ese razonamiento escrito. La asimetria estaba dentro del
    // mismo metodo.
    if (member.isBot !== false) {
      return {
        text: [
          "No puedo nombrar administrador a un bot.",
          "Telegram no deja que un bot le quite los permisos a otro, así que si se pasara no podría revocarle: justo lo que este sistema existe para evitar.",
          "Si de verdad lo quieres de admin, ponlo tú a mano desde los ajustes del grupo — pero quedará fuera de mi vigilancia.",
        ].join("\n"),
      };
    }

    const promoted = await this.telegramGateway.promoteChatMember({
      chatId: telegramChatId,
      userId: targetId,
      customTitle: command.customTitle ?? undefined,
      token,
      rights: APPOINTED_ADMIN_RIGHTS,
    });
    if (!promoted.ok) {
      return {
        text: "No he podido nombrarle. ¿Tengo yo permiso para añadir administradores?",
      };
    }

    // Recorded only AFTER Telegram accepted: a row claiming an appointment that
    // never happened would make the guard promise a revocation it cannot do.
    //
    // But the reverse is worse, and it happened for real: the promotion landed,
    // this write never ran, and the result was a live administrator the bot had
    // no record of — exactly the "cannot be revoked" state the feature exists
    // to prevent. So if the ledger cannot be written, undo the promotion rather
    // than leave Telegram and our records disagreeing.
    try {
      await this.botGrantedAdminRepository.grant({
        tenantId: context.tenantId,
        chatId: context.chatId,
        telegramChatId,
        telegramUserId: targetId,
        username: targetUsername,
        customTitle: command.customTitle,
        grantedByTelegramId: update.user.userId ?? 0n,
      });
    } catch {
      const undone = await this.telegramGateway
        .demoteChatMember({ chatId: telegramChatId, userId: targetId, token })
        .catch(() => ({ ok: false }));
      return {
        text: undone.ok
          ? "No he podido guardar el nombramiento, así que lo he deshecho. Vuelve a intentarlo."
          : "⚠️ Le he dado admin pero no he podido registrarlo, y tampoco deshacerlo. Quítaselo a mano: no podría revocarle yo.",
      };
    }
    // Audit is bookkeeping; losing it must not turn a completed appointment
    // into an error message.
    await this.repository
      .recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "appointed_admin.granted",
        resourceType: "bot_granted_admin",
        resourceId: targetId.toString(),
        payload: { grantedBy: update.user.userId?.toString() },
      })
      .catch(() => undefined);

    return {
      text: [
        `✅ ${targetUsername ? `@${targetUsername}` : targetId.toString()} ya es administrador.`,
        "",
        "Modera conmigo, no desde el menú de Telegram: /ban /kick /mute /warn /del /purge /pin /settitle. Todo eso sigue pudiéndolo hacer.",
        "Lo que no tiene son los botones nativos, y es a propósito: una expulsión hecha desde el menú no deja caso, ni motivo, ni forma de apelarla. Hecha con /ban, sí.",
        "",
        "Tampoco puede añadir gente ni nombrar administradores: de eso me encargo yo, para que nadie entre sin verificarse.",
        "Como le he nombrado yo, puedo quitarle los permisos si se pasa.",
      ].join("\n"),
    };
  }

  /**
   * Announces changes to WHO HOLDS POWER that nobody asked for — above all, the
   * bot losing its own badge.
   *
   * Runs before handleAppointedAdminAction and shares nothing with it. That one
   * is opt-in per chat and only ever looks at admins the bot appointed; this one
   * is always on and matters most precisely where that one is blind. There is no
   * setting to disable it on purpose: "the bot was silently stripped of its
   * powers" is not a preference, and a group that had switched this off would
   * discover the loss only once the damage was done.
   *
   * Reports into the affected chat itself. When the bot has just been REMOVED
   * the message cannot arrive — nothing can be done about that from outside —
   * so the audit row is written first and unconditionally, and is the record
   * that survives.
   */
  private async handlePowerWatch(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const change = update.chatMemberUpdate;
    if (update.kind !== "chat_member" || !change?.chatId) {
      return null;
    }
    const subjectId = change.telegramUserId;
    if (subjectId === undefined) {
      return null;
    }

    // Only consulted for a transition that already looks like a power change,
    // so an ordinary join never costs a database round trip.
    const looksLikePower =
      change.oldStatus === "administrator" ||
      change.newStatus === "administrator" ||
      change.oldStatus === "creator" ||
      change.newStatus === "creator" ||
      subjectId === this.currentBotTelegramId();
    if (!looksLikePower) {
      return null;
    }

    const appointed = await this.botGrantedAdminRepository
      .findActiveByTelegramChat(change.chatId, subjectId)
      .catch(() => null);

    const alert = classifyPowerChange({
      actorId: change.byUserId,
      subjectId,
      oldStatus: change.oldStatus,
      newStatus: change.newStatus,
      botId: this.currentBotTelegramId(),
      subjectIsAppointedByUs: appointed !== null,
    });
    if (!alert) {
      return null;
    }

    // Written BEFORE the announcement, and never swallowed into silence: when
    // the bot has been removed this row is the only thing that will exist.
    await this.repository
      .recordAudit({
        tenantId: context.tenantId,
        actorType: "system",
        action: `power_watch.${alert.kind}`,
        resourceType: "chat_power",
        resourceId: change.chatId.toString(),
        payload: {
          actorTelegramId: alert.actorId.toString(),
          subjectTelegramId: alert.subjectId.toString(),
          oldStatus: change.oldStatus ?? null,
          newStatus: change.newStatus ?? null,
          weakensDefence: alert.weakensDefence,
        },
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `power_watch: could not audit ${alert.kind} in chat ${change.chatId} — ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });

    // If an appointed admin was demoted by someone else, our ledger now claims
    // powers they no longer hold — and a stale ledger would make the bot
    // promise a revocation it cannot perform.
    if (alert.kind === "ours_demoted" && context.chatId) {
      await this.botGrantedAdminRepository
        .revoke({
          tenantId: context.tenantId,
          chatId: context.chatId,
          telegramUserId: subjectId,
          reason: "demoted_externally",
        })
        .catch(() => null);
    }

    const text = describePowerAlert(alert, {
      actor: this.staffActorLabel(update, alert.actorId),
      subject:
        extractChatMemberSubjectLabel(update.raw) ??
        (appointed?.username ? `@${appointed.username}` : null) ??
        alert.subjectId.toString(),
    });

    // The STAFF room is a DIFFERENT chat, so it is the one place the bot can
    // still speak after being demoted or thrown out — which is precisely when
    // the alert matters most. Without this the gravest alert is the one
    // guaranteed not to arrive: a removed bot cannot post where it was removed
    // from, and a demoted one may not be allowed to either.
    if (alert.weakensDefence && context.chatId) {
      const staffChatId = await this.guardianRepository
        .getSettings(context.tenantId, context.chatId)
        .then((settings) => settings?.staffChatId ?? null)
        .catch(() => null);
      // Never to the affected chat twice — the returned reply already goes there.
      if (staffChatId !== null && staffChatId !== change.chatId) {
        await this.telegramGateway
          .sendMessage({
            chatId: staffChatId,
            token: this.telegramToken(),
            reply: { text: `${text}\n\n(Grupo afectado: ${change.chatId})` },
          })
          .catch((error: unknown) => {
            this.logger.warn(
              `power_watch: could not reach the STAFF room about ${alert.kind} — ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          });
      }
    }

    return { text };
  }

  private async handleAppointedAdminAction(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const change = update.chatMemberUpdate;
    if (update.kind !== "chat_member" || !change?.chatId) {
      return null;
    }

    const kind = classifyMemberTransition({
      actorId: change.byUserId,
      subjectId: change.telegramUserId,
      oldStatus: change.oldStatus,
      newStatus: change.newStatus,
    });
    const actorId = change.byUserId;
    if (!kind || actorId === undefined) {
      return null;
    }

    // Only admins the bot appointed are in scope — Telegram would refuse to
    // demote anyone else, so watching them would be theatre.
    const appointment = await this.botGrantedAdminRepository
      .findActiveByTelegramChat(change.chatId, actorId)
      .catch(() => null);
    if (!appointment) {
      return null;
    }

    const chat = await this.repository.findChatByTelegramId(
      context.tenantId,
      change.chatId,
    );
    if (!chat) {
      return null;
    }

    const settings = parseAppointedAdminSettings(
      await this.chatSettingRepository
        .getValue(context.tenantId, chat.chatId, APPOINTED_ADMIN_SETTINGS_KEY)
        .catch(() => undefined),
    );
    if (!settings.enabled) {
      return null;
    }

    const actions = await this.adminActionStore.record(
      adminActionKey(change.chatId, actorId),
      kind,
      Date.now(),
      settings.windowSeconds,
    );
    const decision = evaluateAppointedAdmin(actions, Date.now(), settings);
    if (!decision.triggered || decision.reason === null) {
      return null;
    }

    const who = appointment.username
      ? `@${appointment.username}`
      : (appointment.displayName ?? actorId.toString());
    const what = describeAdminGuardReason(
      decision.reason,
      decision.counts,
      settings.windowSeconds,
    );

    if (decision.mode === "observe") {
      // Observe must not clear the window: the whole point is that the same
      // admin keeps tripping it visibly until someone decides to enforce.
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "system",
        action: "appointed_admin.observed",
        resourceType: "bot_granted_admin",
        resourceId: appointment.id,
        payload: { reason: decision.reason, counts: decision.counts },
      });
      return {
        text: `👁 ${who} ${what}. Modo observación: no he tocado sus permisos.`,
      };
    }

    const token = this.telegramToken();
    // Order matters and is not interchangeable: Telegram refuses to restrict an
    // administrator, so the badge has to come off BEFORE the silence goes on.
    //
    // The gateway THROWS on a 4xx rather than returning ok:false, and this
    // handler runs inside the update pipeline — an escaping error killed the
    // whole update in testing, so the group heard nothing at all about an admin
    // that had just gone rogue. Silence is the one unacceptable outcome here.
    const demoted = await this.telegramGateway
      .demoteChatMember({ chatId: change.chatId, userId: actorId, token })
      .catch(() => ({ ok: false }));
    if (!demoted.ok) {
      return {
        text: `⚠️ ${who} ${what}, pero no he podido quitarle los permisos. Hazlo a mano.`,
      };
    }

    await this.botGrantedAdminRepository
      .revoke({
        tenantId: context.tenantId,
        chatId: chat.chatId,
        telegramUserId: actorId,
        reason: decision.reason,
      })
      .catch(() => null);
    // Reset only after a successful revocation: if the demotion failed we want
    // the counter intact so the next action trips again immediately.
    await this.adminActionStore.reset(adminActionKey(change.chatId, actorId));

    // Indefinite: an automatic silence that expired on its own would hand the
    // group back to someone nobody has reviewed yet. Best-effort like the
    // demotion above — the badge is already off, and a failed mute must still
    // be reported rather than swallowing the whole alert.
    const muted = await this.telegramGateway
      .restrictChatMember({
        chatId: change.chatId,
        userId: actorId,
        token,
        untilDate: undefined,
      })
      .catch(() => ({ ok: false }));

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "system",
      action: "appointed_admin.revoked",
      resourceType: "bot_granted_admin",
      resourceId: appointment.id,
      payload: {
        reason: decision.reason,
        counts: decision.counts,
        telegramUserId: actorId.toString(),
        muted: muted.ok,
        grantedBy: appointment.grantedByTelegramId.toString(),
      },
    });

    return {
      text: [
        `🚨 He quitado los permisos a ${who}: ${what}.`,
        muted.ok
          ? "Está en cuarentena y no puede escribir."
          : "⚠️ No he podido silenciarle: hazlo a mano.",
        `Lo nombró: ${appointment.grantedByTelegramId.toString()}.`,
        "Para devolverle el acceso: /desadmin no hace falta, usa los ajustes del grupo.",
      ].join("\n"),
    };
  }

  private async handleChatMemberUpdate(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.kind !== "chat_member" || !update.chatMemberUpdate) {
      return null;
    }

    const { chatId, telegramUserId, oldStatus, newStatus } =
      update.chatMemberUpdate;
    if (!chatId || !telegramUserId) {
      return null;
    }

    if (isJoinTransition(oldStatus as never, newStatus as never)) {
      await this.handleJoinViaChatMember(
        context,
        update,
        chatId,
        telegramUserId,
      );
      return null;
    }

    if (isActiveChatMember(newStatus as never)) {
      return null;
    }

    const gates =
      await this.groupProtectionRepository.getGatesRequiring(chatId);

    for (const gate of gates) {
      // This kick targets the *gated* chat, not the chat the member left, so it
      // respects the gated chat's own bot mode: passive / moderation-off there
      // means Modryva does not enforce the departure.
      if (!(await this.botMode(gate.chatId)).moderation) {
        continue;
      }
      const memberCheck = await this.telegramGateway.getChatMember({
        chatId: gate.telegramChatId,
        userId: telegramUserId,
        token: this.telegramToken(),
      });
      if (!memberCheck.ok || !isActiveChatMember(memberCheck.status as never)) {
        continue; // not there (or unverifiable) — nothing to enforce
      }
      if (await this.isGroupAdmin(gate.telegramChatId, telegramUserId)) {
        continue;
      }

      try {
        await this.telegramGateway.banChatMember({
          chatId: gate.telegramChatId,
          userId: telegramUserId,
          token: this.telegramToken(),
          untilDate: undefined,
        });
        await this.telegramGateway.unbanChatMember({
          chatId: gate.telegramChatId,
          userId: telegramUserId,
          token: this.telegramToken(),
          onlyIfBanned: false,
        });
        await this.telegramGateway.sendMessage({
          chatId: gate.telegramChatId,
          reply: {
            text: "Un miembro fue expulsado por salir del grupo requerido.",
          },
          token: this.telegramToken(),
        });
      } catch {
        // Best-effort — a failed kick here does not affect the source chat.
      }

      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "system",
        action: "membershipgate.kick",
        resourceType: "chat_member",
        resourceId: telegramUserId.toString(),
        payload: {
          gatedChatId: gate.chatId,
          requiredTelegramChatId: chatId.toString(),
          via: "chat_member_update",
        },
      });
    }

    return null;
  }

  /**
   * Quotly-style quote stickers: `/q` in reply to a message renders it as a
   * Telegram-styled quote image and sends it back as a sticker (or a photo for
   * `/q png`). Anyone can use it; there is no reply because the sticker itself
   * is the response.
   */
  private async handleQuoteCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const parsed = parseQuoteCommand(update);

    if (!parsed) {
      return null;
    }

    const chatId = update.chat.chatId;
    if (!chatId) {
      return null;
    }

    const source = extractQuoteSource(update.raw);
    if (!source) {
      return {
        text: "Responde a un mensaje con /q para convertirlo en una cita.",
      };
    }

    const payload = buildQuotePayload({
      source,
      format: parsed.command.format,
      color: parsed.command.color,
    });

    let rendered: Awaited<ReturnType<QuoteRenderer["renderQuote"]>>;
    try {
      rendered = await this.quoteRenderer.renderQuote(
        payload as unknown as Record<string, unknown>,
      );
    } catch {
      rendered = null;
    }

    if (!rendered) {
      return {
        text: "No pude generar la cita ahora mismo. Inténtalo más tarde.",
      };
    }

    const media = {
      chatId,
      imageBase64: rendered.imageBase64,
      type: rendered.type,
      token: this.telegramToken(),
    };

    try {
      if (parsed.command.format === "png") {
        await this.telegramGateway.sendPhoto(media);
      } else {
        await this.telegramGateway.sendSticker(media);
      }
    } catch {
      return { text: "No pude enviar la cita." };
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "quote.generated",
      resourceType: "quote",
      resourceId: chatId.toString(),
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { format: parsed.command.format },
    });

    // The sticker/photo is the response; nothing else to send.
    return null;
  }

  /**
   * Per-group language: /lang es|en. Stored in the hygiene config and used by
   * the `t()` string table for user-facing messages (starting with welcomes).
   */
  private async handleLangCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseLangCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "El idioma se configura dentro de un grupo." };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "lang.config",
    );
    if (!permission.allowed) {
      return { text: `No tienes permisos para esto.` };
    }

    await this.groupProtectionRepository.setHygiene(
      context.tenantId,
      context.chatId,
      { language: result.command.lang },
    );

    return {
      text: t("lang.set", result.command.lang, {
        lang: langDisplayName(result.command.lang),
      }),
    };
  }

  private async handleCharFilterCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseCharFilterCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "Este filtro se configura dentro de un grupo." };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "charfilter.config",
    );
    if (!permission.allowed) {
      return { text: `No tienes permisos para esto.` };
    }

    const command = result.command;
    await this.groupProtectionRepository.setHygiene(
      context.tenantId,
      context.chatId,
      command.kind === "rtl"
        ? { rtlFilter: command.enabled }
        : { cjkFilter: command.enabled },
    );

    return {
      text: `🔤 Filtro de ${command.kind === "rtl" ? "escritura RTL (árabe/hebreo)" : "caracteres CJK (chino/japonés/coreano)"}: ${command.enabled ? "ON" : "OFF"}.`,
    };
  }

  private async handleSanctionReasonCommand(
    _context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseSanctionReasonCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: `${result.error.usage}\n${formatSanctionReasonList()}` };
    }

    if (result.command.kind === "list") {
      return { text: `📋 Motivos de sanción:\n${formatSanctionReasonList()}` };
    }

    const reason = resolveSanctionReason(result.command.reasonKey);
    if (!reason) {
      return { text: formatSanctionReasonList() };
    }

    return {
      text: `📝 ${reason.label} — acción sugerida: ${reason.suggestedAction}.`,
    };
  }

  private async handleToleranceCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseToleranceCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "La tolerancia se configura dentro de un grupo." };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "tolerance.config",
    );
    if (!permission.allowed) {
      return { text: "No tienes permisos para cambiar la tolerancia." };
    }

    const preset = resolveTolerancePreset(result.command.level);

    await this.antifloodRepository.upsertConfig(
      context.tenantId,
      context.chatId,
      {
        enabled: true,
        messageLimit: preset.antiflood.messageLimit,
        windowSeconds: preset.antiflood.windowSeconds,
        action: preset.antiflood.action,
      },
    );

    await this.antiraidRepository.upsertConfig(
      context.tenantId,
      context.chatId,
      {
        enabled: true,
        joinLimit: preset.antiraid.joinLimit,
        windowSeconds: preset.antiraid.windowSeconds,
        mode: preset.antiraid.mode,
      },
    );

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "tolerance.preset.applied",
      resourceType: "tolerance",
      resourceId: context.chatId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { level: result.command.level },
    });

    return {
      text: `🎚️ Tolerancia aplicada.\n${formatTolerancePreset(result.command.level)}`,
    };
  }

  private async handleProtectionSummaryCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const name = update.command?.name;
    if (name !== "protejo" && name !== "protecciones") {
      return null;
    }

    if (!context.chatId) {
      return { text: "Esta vista se consulta dentro de un grupo." };
    }

    const [antiflood, captcha, antiraid, hygiene] = await Promise.all([
      this.antifloodRepository.getConfig(context.tenantId, context.chatId),
      this.captchaRepository.getConfig(context.tenantId, context.chatId),
      this.antiraidRepository.getConfig(context.tenantId, context.chatId),
      this.groupProtectionRepository.getHygiene(context.chatId),
    ]);

    return buildProtectionSummaryReply({
      antiflood: antiflood?.enabled ?? false,
      captcha: captcha?.enabled ?? false,
      antiraid: antiraid?.enabled ?? false,
      nightMode: hygiene.nightMode,
      welcomeMute: hygiene.welcomeMute,
    });
  }

  private handleIdGroupCommand(
    update: TelegramUpdateEnvelope,
  ): BotReply | null {
    return buildIdGroupReply(update);
  }

  private handleVerticalCommand(
    _context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): BotReply | null {
    return buildVerticalReply(update);
  }

  private async handleAnnouncementCommand(
    _context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.command?.name !== "anuncio") {
      return null;
    }

    const text = (update.command?.args ?? []).join(" ").trim();
    if (text.length === 0) {
      return { text: "Uso: /anuncio <texto del anuncio a analizar>" };
    }

    const analysis = analyzeAnnouncement(text);
    const issues =
      analysis.clarityIssues.length > 0
        ? analysis.clarityIssues.map((issue) => `• ${issue}`).join("\n")
        : "• Sin problemas de claridad";
    const sensitive =
      analysis.sensitiveFlags.length > 0
        ? `\n⚠️ Temas sensibles: ${analysis.sensitiveFlags.join(", ")}`
        : "";

    return {
      text: `📣 Análisis del anuncio\nTono: ${analysis.tone}\nLongitud: ${analysis.lengthOk ? "adecuada" : "revisar"}\n${issues}${sensitive}`,
    };
  }

  private async handleConfigModeCommand(
    _context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseConfigModeCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    const overrides = expandConfigMode(result.command.mode);
    const lines = Object.entries(overrides).map(
      ([key, value]) => `• ${key}: ${String(value)}`,
    );

    return {
      text: `⚙️ El modo "${result.command.mode}" representa estos ajustes:\n${lines.join("\n")}`,
    };
  }

  private async handleRulesClarityCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const name = update.command?.name;
    if (name !== "reglas_score" && name !== "reglasscore") {
      return null;
    }

    if (!context.chatId) {
      return { text: "Esta vista se consulta dentro de un grupo." };
    }

    const config = await this.welcomeRepository.getConfig(context.chatId);
    return buildRulesClarityReply(config?.rulesText ?? "");
  }

  private async handleCaseNoteCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseCaseNoteCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "Las notas de staff se usan dentro de un grupo." };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "staffnote.write",
    );
    if (!permission.allowed) {
      return { text: "No tienes permisos para las notas de staff." };
    }

    if (result.command.kind === "add") {
      await this.staffNoteRepository.addNote({
        tenantId: context.tenantId,
        chatId: context.chatId,
        authorTelegramId: update.user.userId ?? null,
        authorName: update.user.username ?? null,
        text: result.command.text,
      });
      return { text: "📝 Nota de staff guardada." };
    }

    const notes = await this.staffNoteRepository.listNotes(
      context.tenantId,
      context.chatId,
      10,
    );
    if (notes.length === 0) {
      return { text: "No hay notas de staff en este grupo todavía." };
    }

    const nowMs = update.receivedAt.getTime();
    const lines = notes.map((note) =>
      formatCaseNote(
        {
          authorName: note.authorName ?? "staff",
          ms: note.createdAtMs,
          text: note.text,
        },
        nowMs,
      ),
    );
    return { text: `🗒️ Notas de staff:\n${lines.join("\n")}` };
  }

  /** Los ajustes de la tienda de este chat, con defaults si no hay nada. */
  private async groupShopSettings(
    tenantId: string,
    chatId: string,
  ): Promise<ShopSettings> {
    const raw = await this.chatSettingRepository
      .getValue(tenantId, chatId, SHOP_SETTINGS_KEY)
      .catch(() => undefined);
    return parseShopSettings(raw);
  }

  /** Titulo de cada bloque de la tienda. */
  private static readonly SHOP_FAMILY_TITLES: Readonly<
    Record<ShopItem["familia"], string>
  > = {
    ataque: "🔪 Para robar",
    defensa: "🛡️ Para defenderte",
    economia: "💰 Economía",
    castigo: "🤐 Castigo",
    vanidad: "🏷️ Vanidad",
    mascotas: "🐾 Para tu bicho",
  };

  /**
   * El escaparate.
   *
   * Enseña el saldo arriba porque la pregunta real de quien escribe /comprar no
   * es "que hay" sino "que me puedo permitir", y sin el saldo delante hay que
   * escribir otro comando para saberlo.
   */
  private async handleShopListCommand(
    tenantId: string,
    chatId: string,
    userId: bigint,
    currency: GroupCurrencySettings,
    telegramChatId: bigint | undefined,
    botUsername: string | undefined,
  ): Promise<BotReply> {
    const tienda = await this.groupShopSettings(tenantId, chatId);
    const cartera = await this.economyRepository.ensureWallet(
      tenantId,
      chatId,
      userId,
    );
    const items = availableItems(tienda);
    if (items.length === 0) {
      return { text: "La tienda está abierta pero no hay nada a la venta." };
    }
    const lineas: string[] = [
      `🛒 *Tienda* — tienes ${formatCurrency(cartera.balance, currency)}`,
    ];
    for (const familia of Object.keys(
      BotUpdateService.SHOP_FAMILY_TITLES,
    ) as ShopItem["familia"][]) {
      const delBloque = items.filter((item) => item.familia === familia);
      if (delBloque.length === 0) {
        continue;
      }
      lineas.push("", BotUpdateService.SHOP_FAMILY_TITLES[familia]);
      for (const item of delBloque) {
        const precio = item.precioDinamico
          ? "según el caso"
          : groupThousands(priceOf(item, tienda));
        // El id va a la vista y no solo el nombre porque no siempre se puede
        // adivinar uno del otro: "Mordaza de 1 minuto" se compra con `mute1`.
        lineas.push(
          `${item.icono} *${item.nombre}* — ${precio} · \`/comprar ${item.id}\``,
          `_${item.resumen}_`,
        );
      }
    }
    lineas.push(
      "",
      "_Lo tuyo, en /inventario. Las fichas del casino se compran aparte, en privado._",
    );
    // El enlace solo se pone si se sabe el chat de Telegram: la pantalla resuelve
    // el grupo del `start_param`, y sin grupo no hay tienda que abrir.
    const botonera =
      telegramChatId !== undefined && botUsername
        ? {
            replyMarkup: {
              inline_keyboard: [
                [
                  {
                    text: "🛒 Abrir la tienda",
                    url: buildNamedMiniAppLink(
                      botUsername.replace(/^@/u, ""),
                      this.env.TELEGRAM_MINIAPP_NAME,
                      encodeShopStartParam(telegramChatId.toString()),
                    ),
                  },
                ],
              ],
            },
          }
        : {};
    return { parseMode: "Markdown", text: lineas.join("\n"), ...botonera };
  }

  /** Lo que alguien tiene comprado y le sigue sirviendo. */
  private async handleInventoryCommand(
    tenantId: string,
    chatId: string,
    userId: bigint,
    nowMs: number,
  ): Promise<BotReply> {
    const guardado = await this.inventoryRepository.list(
      tenantId,
      chatId,
      userId,
    );
    // El catalogo es quien sabe que significa cada fila: `usableItems` descarta
    // lo agotado y lo caducado, que en la tabla siguen estando.
    const utiles = usableItems(
      guardado.filter((fila): fila is InventoryItem & { itemId: ShopItemId } =>
        isShopItemId(fila.itemId),
      ),
      nowMs,
    );
    if (utiles.length === 0) {
      return {
        text: "No tienes nada. Mira qué se vende con /comprar.",
      };
    }
    const lineas = utiles.map((fila) => {
      const item = SHOP_BY_ID.get(fila.itemId);
      const nombre = item ? `${item.icono} ${item.nombre}` : fila.itemId;
      if (fila.expiresAtMs !== undefined) {
        return `${nombre} — te dura ${formatRemaining(
          Math.max(0, fila.expiresAtMs - nowMs),
        )}`;
      }
      return `${nombre} — ${fila.uses} ${fila.uses === 1 ? "uso" : "usos"}`;
    });
    return { text: ["🎒 Lo que tienes:", ...lineas].join("\n") };
  }

  /**
   * Comprar.
   *
   * El orden es: decidir (puro), cobrar (atomico) y luego entregar. Cobrar
   * antes de entregar y no al reves es lo que impide que dos compras a la vez
   * se lleven dos objetos con saldo para uno; y si la entrega fallara despues
   * del cobro, se devuelve el dinero — un objeto que no llega y un saldo que si
   * se va es la unica combinacion que no se puede dejar pasar.
   */
  private async handleBuyCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    currency: GroupCurrencySettings,
    nowMs: number,
  ): Promise<BotReply | null> {
    const { tenantId, chatId } = context;
    const userId = update.user.userId;
    if (!chatId || !userId) {
      return null;
    }
    const tienda = await this.groupShopSettings(tenantId, chatId);
    const args = update.command?.args ?? [];
    const itemId = args[0] ?? "";
    const objetivo = SHOP_BY_ID.get(itemId as ShopItemId)?.contraAlguien
      ? await this.resolveCommandTarget(update, args[1])
      : undefined;
    // Lo que va detras del id es el texto de los que lo piden (el mote, el
    // nombre nuevo de la moneda). Se junta entero: un mote de dos palabras
    // llega partido en dos argumentos.
    const payload = args.slice(1).join(" ").trim();
    const cartera = await this.economyRepository.ensureWallet(
      tenantId,
      chatId,
      userId,
    );
    const presupuesto = quotePurchase({
      settings: tienda,
      itemId,
      balance: cartera.balance,
      tieneObjetivo: objetivo !== undefined,
      payload,
    });
    if (!presupuesto.ok || !presupuesto.item) {
      return {
        parseMode: "Markdown",
        text: this.describeShopRefusal(presupuesto, currency, cartera.balance),
      };
    }
    const item = presupuesto.item;

    // Lo que se le hace a OTRA persona se comprueba antes de tocar el saldo.
    // Se podria cobrar y devolver, pero "te he cobrado 12.000 y te los he
    // devuelto" es un mensaje que asusta, y estos rechazos —es del staff, le
    // acaban de silenciar, acaba de salir— son los normales, no la excepcion.
    if (item.familia === "castigo" && objetivo !== undefined) {
      const veto = await this.checkMuteTarget({
        tenantId,
        chatId,
        tienda,
        comprador: userId,
        objetivo,
        nowMs,
      });
      if (veto) {
        return { text: veto };
      }
    }

    const refId = this.claveDeterminista(update, "buy");
    const cobro = await this.economyRepository.debit(
      tenantId,
      chatId,
      userId,
      presupuesto.precio,
      "shop-buy",
      refId,
    );
    if (!cobro.ok) {
      // Alguien se gasto el saldo entre la consulta y el cobro. El precio ya
      // esta calculado, asi que se puede decir cuanto falta.
      return {
        text: `No te llega: cuesta ${formatCurrency(presupuesto.precio, currency)} y tienes ${formatCurrency(cobro.balance, currency)}.`,
      };
    }
    await this.inventoryRepository.recordPurchase({
      tenantId,
      chatId,
      userTelegramId: userId,
      itemId: item.id,
      price: presupuesto.precio,
      ...(objetivo !== undefined ? { targetTelegramId: objetivo } : {}),
    });

    // Lo instantaneo no entra al inventario: su efecto ES la compra. Si el
    // efecto no llega a ocurrir se devuelve el dinero — cobrar por algo que no
    // ha pasado es la unica combinacion que no se puede dejar pasar.
    if (item.hold.kind === "instantaneo") {
      const devolver = async (motivo: string): Promise<BotReply> => {
        await this.economyRepository.credit(
          tenantId,
          chatId,
          userId,
          presupuesto.precio,
          "shop-refund",
          refId,
        );
        return { text: `${motivo} No te he cobrado nada.` };
      };

      if (item.id === "mute1" || item.id === "mute5" || item.id === "mute10") {
        if (objetivo === undefined) {
          return devolver("No sé a quién silenciar.");
        }
        // El `?? 1` no deberia hacer falta —los tres ids estan en la tabla— pero
        // un silencio de `NaN` minutos seria un silencio PERMANENTE: Telegram
        // trata un `until_date` invalido como "para siempre". Es el unico
        // default de este fichero que protege de algo irreversible.
        const minutos = MUTE_MINUTES[item.id] ?? 1;
        const silenciado = await this.telegramGateway
          .restrictChatMember({
            chatId: update.chat.chatId as bigint,
            userId: objetivo,
            token: this.telegramToken(),
            untilDate: new Date(nowMs + minutos * 60_000),
          })
          .catch(() => ({ ok: false }));
        if (!silenciado.ok) {
          // El caso normal: Telegram no deja restringir a un administrador, y
          // tampoco puede el bot sin permiso de restringir.
          return devolver(
            "No he podido silenciarle: o es admin, o no tengo permiso para restringir.",
          );
        }
        const quien = await this.displayNameOf(objetivo);
        const comprador = await this.displayNameOf(userId);
        // El anuncio es publico a proposito. Comprar el silencio de otro es lo
        // unico de la tienda que le cae encima a quien no ha comprado nada; que
        // se sepa quien ha pagado es lo que lo mantiene siendo un juego y no un
        // maton anonimo con saldo.
        return {
          parseMode: "Markdown",
          text: [
            `🤐 *${comprador}* ha pagado ${formatCurrency(presupuesto.precio, currency)} para silenciar a *${quien}* ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`,
            "",
            `_${quien}: puedes salir antes pagando el doble con /fianza._`,
          ].join("\n"),
        };
      }

      if (item.id === "caja") {
        const ampliado = await this.economyRepository.raiseVaultLimit(
          tenantId,
          chatId,
          userId,
          VAULT_STEP,
        );
        return {
          parseMode: "Markdown",
          text: [
            `🔐 Caja fuerte ampliada: ahora puedes poner a salvo hasta ${formatCurrency(ampliado, currency)}.`,
            "_Se guarda con /guardar y se saca con /sacar._",
          ].join("\n"),
        };
      }

      // Los juguetes: la decision y el texto viven fuera, en
      // `nucleo/juguetes.ts`. Los tres motivos de fallo devuelven el dinero,
      // porque en ninguno de ellos la mascota recibe nada.
      if (esJugueteId(item.id)) {
        const juguete = JUGUETES[item.id];
        const hecho = await darJuguete({
          mascotas: this.petRepository,
          juguete,
          tenantId,
          chatId,
          usuario: userId,
          ahora: new Date(nowMs),
        });
        const texto = textoDeJuguete(juguete, hecho);
        return hecho.ok ? { text: texto } : devolver(texto);
      }

      return devolver(`${item.icono} ${item.nombre} todavía no está listo.`);
    }

    const fila = await this.inventoryRepository.grant({
      tenantId,
      chatId,
      userTelegramId: userId,
      itemId: item.id,
      ...(item.hold.kind === "consumible" ? { addUses: item.hold.usos } : {}),
      ...(item.hold.kind === "temporal"
        ? { extendMs: item.hold.segundos * 1000 }
        : {}),
      ...(item.pidePayload ? { payload } : {}),
      nowMs,
    });
    const vigencia =
      fila.expiresAtMs !== undefined
        ? `Te dura ${formatRemaining(Math.max(0, fila.expiresAtMs - nowMs))}.`
        : `Te quedan ${fila.uses} ${fila.uses === 1 ? "uso" : "usos"}.`;

    // Rebautizar la moneda no es cosa de quien la compra sino del grupo entero,
    // asi que ademas de entrar en su inventario se escribe en los ajustes del
    // chat. La fecha va con el nombre a proposito: al leer se comprueba, y asi
    // vuelve solo el nombre de siempre sin depender de ningun trabajo que
    // pueda no llegar a ejecutarse.
    if (item.id === "renombrar" && fila.expiresAtMs !== undefined) {
      const guardado = await this.chatSettingRepository
        .getValue(tenantId, chatId, GROUP_CURRENCY_SETTINGS_KEY)
        .catch(() => undefined);
      const base =
        typeof guardado === "object" && guardado !== null ? guardado : {};
      await this.chatSettingRepository
        .setValue(tenantId, chatId, GROUP_CURRENCY_SETTINGS_KEY, {
          ...base,
          nombreTemporal: payload,
          nombreTemporalHastaMs: fila.expiresAtMs,
        })
        .catch(() => undefined);
      const quien = await this.displayNameOf(userId);
      return {
        parseMode: "Markdown",
        text: [
          `🪧 *${quien}* ha pagado ${formatCurrency(presupuesto.precio, currency)} y la moneda del grupo pasa a llamarse *${payload}*.`,
          `_Vuelve a ser ${currency.nombre} en ${formatRemaining(Math.max(0, fila.expiresAtMs - nowMs))}._`,
        ].join("\n"),
      };
    }

    return {
      parseMode: "Markdown",
      text: [
        `${item.icono} Has comprado *${item.nombre}* por ${formatCurrency(presupuesto.precio, currency)}.`,
        ...(item.id === "mote" ? [`Te sale en /ricos como _${payload}_.`] : []),
        vigencia,
        `Te quedan ${formatCurrency(cobro.balance, currency)}.`,
      ].join("\n"),
    };
  }

  /**
   * El nombre de alguien tal y como se le enseña al grupo.
   *
   * Cae al id si no se sabe, que es feo pero sigue informando. Un anuncio de
   * mordaza con un numero de nueve cifras no lo entiende nadie, y es justo el
   * mensaje que mas gente va a leer de todos los de la tienda.
   */
  private async displayNameOf(userId: bigint): Promise<string> {
    const nombres = await this.repository
      .findDisplayNamesByTelegramUserIds([userId])
      .catch(() => new Map<string, string>());
    return nombres.get(userId.toString()) ?? userId.toString();
  }

  /**
   * Si se le puede comprar una mordaza a esa persona, y si no, por que.
   *
   * Tres frenos y cada uno tapa un agujero distinto. Los exentos evitan que se
   * pueda pagar por callar a quien modera. La espera por victima evita el
   * acoso a una sola persona a base de saldo. La gracia al salir evita la
   * guerra de mordazas: sin ella, dos personas con dinero se turnan y una
   * tercera no vuelve a hablar en toda la tarde.
   *
   * Devuelve el motivo como texto, o undefined si adelante.
   */
  private async checkMuteTarget(input: {
    tenantId: string;
    chatId: string;
    tienda: ShopSettings;
    comprador: bigint;
    objetivo: bigint;
    nowMs: number;
  }): Promise<string | undefined> {
    const { tienda, objetivo, nowMs } = input;
    if (objetivo === input.comprador) {
      return "Silenciarte a ti mismo sale gratis: no escribas.";
    }
    if (tienda.exentosMute.includes(objetivo.toString())) {
      return "A esa persona no se le puede comprar una mordaza.";
    }

    const ultima = await this.inventoryRepository
      .lastPurchaseAgainst(
        input.tenantId,
        input.chatId,
        objetivo,
        MUTE_ITEM_IDS,
      )
      .catch(() => null);
    if (!ultima) {
      return undefined;
    }
    const desdeMs = nowMs - ultima.createdAt.getTime();
    const duroMs = (MUTE_MINUTES[ultima.itemId] ?? 0) * 60_000;

    // La gracia se cuenta desde que SALIO, no desde que le silenciaron: lo que
    // se protege es el rato de poder hablar, no el rato de estar callado.
    const desdeQueSalioMs = desdeMs - duroMs;
    if (
      desdeQueSalioMs >= 0 &&
      desdeQueSalioMs < tienda.muteGraceSeconds * 1000
    ) {
      const queda = tienda.muteGraceSeconds * 1000 - desdeQueSalioMs;
      return `Acaba de salir de una. Déjale hablar ${formatRemaining(queda)}.`;
    }
    if (desdeMs < tienda.muteVictimCooldownSeconds * 1000) {
      const queda = tienda.muteVictimCooldownSeconds * 1000 - desdeMs;
      return `A esa persona ya le compraron una hace poco. Espera ${formatRemaining(queda)}.`;
    }
    return undefined;
  }

  /**
   * Salir de una mordaza comprada pagando el doble.
   *
   * El dinero se QUEMA, no va a quien la compro. Pagarle convertiria silenciar
   * en un negocio —comprar mordazas a quien tiene saldo para la fianza saldria
   * a cuenta— y el juego pasaria de ser una gracia a ser una extorsion con
   * tarifa.
   */
  private async handleBailCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    currency: GroupCurrencySettings,
    nowMs: number,
  ): Promise<BotReply | null> {
    const { tenantId, chatId } = context;
    const userId = update.user.userId;
    if (!chatId || !userId) {
      return null;
    }
    const tienda = await this.groupShopSettings(tenantId, chatId);
    if (!tienda.enabled) {
      return { text: "La tienda de este grupo está cerrada." };
    }
    const ultima = await this.inventoryRepository
      .lastPurchaseAgainst(tenantId, chatId, userId, MUTE_ITEM_IDS)
      .catch(() => null);
    if (!ultima) {
      return { text: "No te ha silenciado nadie." };
    }
    const duroMs = (MUTE_MINUTES[ultima.itemId] ?? 0) * 60_000;
    const finMs = ultima.createdAt.getTime() + duroMs;
    if (finMs <= nowMs) {
      // Sin esto, cualquiera podria pagar por salir de una mordaza que ya se le
      // habia pasado: pagar por nada, y encima creyendo que sirvio de algo.
      return { text: "Ya puedes hablar. No hace falta que pagues nada." };
    }
    const precio = ultima.price * 2;
    const cobro = await this.economyRepository.debit(
      tenantId,
      chatId,
      userId,
      precio,
      "bail",
      this.claveDeterminista(update, "bail-cobro"),
    );
    if (!cobro.ok) {
      return {
        text: `La fianza son ${formatCurrency(precio, currency)} —el doble de lo que costó callarte— y tienes ${formatCurrency(cobro.balance, currency)}.`,
      };
    }
    const soltado = await this.telegramGateway
      .liftRestrictions({
        chatId: update.chat.chatId as bigint,
        userId,
        token: this.telegramToken(),
      })
      .catch(() => ({ ok: false }));
    if (!soltado.ok) {
      await this.economyRepository.credit(
        tenantId,
        chatId,
        userId,
        precio,
        "shop-refund",
        // Sufijo distinto del cobro: son dos apuntes del mismo update.
        this.claveDeterminista(update, "bail-devolucion"),
      );
      return { text: "No he podido devolverte la voz. No te he cobrado." };
    }
    const quien = await this.displayNameOf(userId);
    return {
      parseMode: "Markdown",
      text: `⚖️ *${quien}* ha pagado ${formatCurrency(precio, currency)} de fianza y vuelve a hablar.`,
    };
  }

  /**
   * Meter y sacar de la caja fuerte.
   *
   * Es la puerta que faltaba: `protectedBalance` existia y el robo lo respetaba,
   * pero no habia forma de poner nada dentro salvo un UPDATE a mano.
   *
   * No pasa por el libro mayor porque no hay movimiento de dinero: el total no
   * cambia, solo cambia que parte puede tocar `/robar`.
   */
  private async handleVaultCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    currency: GroupCurrencySettings,
    guardar: boolean,
  ): Promise<BotReply | null> {
    const { tenantId, chatId } = context;
    const userId = update.user.userId;
    if (!chatId || !userId) {
      return null;
    }
    const tienda = await this.groupShopSettings(tenantId, chatId);
    const cartera = await this.economyRepository.ensureWallet(
      tenantId,
      chatId,
      userId,
    );
    // La caja sin tope de quien este en `ECONOMIA_CAJA_ILIMITADA_IDS`.
    //
    // Solo levanta el limite de lo que CABE dentro: no crea monedas, no toca
    // el saldo y no cambia nada para nadie mas. El efecto es que a esas
    // personas no se les puede robar lo que guarden.
    //
    // Va por entorno y no en el código porque los ids de Telegram son datos
    // personales y la regla del repo dice que no entran en git — y asi se
    // anade o se quita a alguien sin desplegar.
    const cajaSinTope = this.env.ECONOMIA_CAJA_ILIMITADA_IDS.some(
      (id) => id === userId,
    );
    // El cerdito agranda la caja. Su extra se suma a lo COMPRADO y no al tope
    // final, que es lo que hace que siga respetando la excepcion sin tope y
    // que comprar mas caja siga sumando encima.
    const bicho = await this.petRepository
      .obtener(tenantId, chatId, userId)
      .catch(() => null);
    const extraDelBicho = ventajasDe(bicho?.especie).extraDeCaja;
    const tope = topeDeCajaFuerte(
      tienda,
      (cartera.vaultLimit ?? 0) + extraDelBicho,
      cajaSinTope,
    );
    const guardado = cartera.protectedBalance ?? 0;

    const crudo = update.command?.args?.[0];
    if (crudo === undefined) {
      return {
        parseMode: "Markdown",
        text: [
          `🔐 En la caja fuerte tienes ${formatCurrency(guardado, currency)} de un tope de ${formatCurrency(tope, currency)}.`,
          "",
          `Uso: \`/${guardar ? "guardar" : "sacar"} <cuánto>\`. Lo que hay dentro no te lo puede robar nadie.`,
        ].join("\n"),
      };
    }
    // "todo" existe porque el caso normal es querer proteger lo que se tenga
    // suelto, y obligar a calcularlo a mano es obligar a equivocarse.
    const cantidad =
      crudo === "todo"
        ? guardar
          ? Math.min(tope - guardado, cartera.balance - guardado)
          : guardado
        : Number.parseInt(crudo, 10);
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      return {
        text: `Uso: /${guardar ? "guardar" : "sacar"} <cuánto>, o /${guardar ? "guardar" : "sacar"} todo.`,
      };
    }
    const res = await this.economyRepository.moveToVault({
      tenantId,
      chatId,
      userTelegramId: userId,
      amount: guardar ? cantidad : -cantidad,
      limit: tope,
    });
    if (!res.ok) {
      switch (res.error) {
        case "full":
          return {
            parseMode: "Markdown",
            text: [
              `No cabe: el tope son ${formatCurrency(tope, currency)} y ya tienes dentro ${formatCurrency(res.protectedBalance, currency)}.`,
              "_Se amplía con `/comprar caja`._",
            ].join("\n"),
          };
        case "empty":
          return {
            text: `Dentro solo tienes ${formatCurrency(res.protectedBalance, currency)}.`,
          };
        case "insufficient":
          return {
            text: `No tienes tanto: tu saldo entero son ${formatCurrency(res.balance, currency)}.`,
          };
      }
      // Sin `default`, pero con red.
      //
      // Quitar el `default` a secas seria PEOR que dejarlo: un motivo nuevo se
      // saldria del switch, caeria al camino de exito de abajo y le diria a la
      // persona que su dinero se movio cuando no se movio.
      //
      // Con los tres casos cubiertos, `res.error` aqui es `never`. Anadir un
      // cuarto motivo rompe esta asignacion y hay que venir a traducirlo. Y si
      // aun asi llegara algo en ejecucion, se dice que fallo sin inventar el
      // porque, que es lo unico honesto — pero nunca se sigue hacia abajo.
      const motivoDesconocido: never = res.error;
      void motivoDesconocido;
      return { text: "No he podido mover el saldo. Inténtalo otra vez." };
    }
    const libre = res.balance - res.protectedBalance;
    return {
      text: [
        guardar
          ? `🔐 A salvo. Dentro tienes ${formatCurrency(res.protectedBalance, currency)}.`
          : `🔓 Fuera. Dentro te quedan ${formatCurrency(res.protectedBalance, currency)}.`,
        `Expuesto a robos: ${formatCurrency(libre, currency)}.`,
      ].join("\n"),
    };
  }

  /** Por que no se ha podido comprar, en cristiano. */
  private describeShopRefusal(
    presupuesto: ReturnType<typeof quotePurchase>,
    currency: GroupCurrencySettings,
    balance: number,
  ): string {
    const item = presupuesto.item;
    switch (presupuesto.refusal) {
      case "disabled":
        return "La tienda de este grupo está cerrada.";
      case "unknown-item":
        return "Eso no se vende aquí. Escribe /comprar a secas para ver la tienda.";
      case "item-off":
        return `${item?.nombre ?? "Eso"} no se vende en este grupo.`;
      case "insufficient":
        return `No te llega: cuesta ${formatCurrency(presupuesto.precio, currency)} y tienes ${formatCurrency(balance, currency)}.`;
      case "needs-target":
        return `Contra quién. Responde a su mensaje o escribe \`/comprar ${item?.id ?? ""} @persona\`.`;
      case "needs-payload":
        return `Falta el texto: \`/comprar ${item?.id ?? ""} <lo que quieras poner>\`.`;
      case "dynamic-price":
        return "La fianza no se compra desde la tienda: se paga con /fianza cuando te han silenciado.";
      default:
        return "Ahora mismo no puedes comprar eso.";
    }
  }

  /**
   * La moneda del grupo desde el chat: saldo, check-in, donar y ranking.
   *
   * Todo pasa por `credit`/`move`, nunca por `setWallet`. Es la diferencia entre
   * un saldo y un saldo explicable: sin apunte en el libro mayor no se puede
   * responder a "quien me ha quitado esto", y ademas el cupo diario de la
   * ganancia por actividad se calcula sumando el libro — un movimiento que no
   * pasa por ahi es un movimiento que el cupo no ve.
   */
  /**
   * `/pet`, el mando del creador sobre las mascotas.
   *
   * Extraccion profunda: aqui solo queda la traduccion —quien escribe, a quien
   * se responde, que ajustes tiene el grupo— y la llamada. Todo lo demas vive
   * en `apps/bot/src/nucleo/mandos-de-mascotas.ts`.
   */
  /**
   * Las dependencias de `/ayudante`, atadas a ESTE chat.
   *
   * Se construyen aqui y no en el fichero de mandos porque son justo lo que un
   * módulo no puede saber: quien es el propietario, que token toca y donde se
   * anota el ajuste.
   */
  private dependenciasDeAyudante(
    context: FoundationContext,
    token: string | undefined,
  ): DependenciasDeAyudante {
    const tenantId = context.tenantId;
    // OJO: dos identificadores distintos y no intercambiables. `context.chatId`
    // es el cuid de NUESTRA tabla y es lo que indexa `chat_settings`; el id de
    // Telegram —el que empieza por -100 y va a la Bot API— llega aparte, en
    // `update.chat.chatId`. Convertir el cuid a BigInt revienta con
    // "Cannot convert chat_1 to a BigInt", que es como se cazo esto.
    const claveDeChat = context.chatId ?? "";
    const clave = CLAVE_DE_AJUSTE_DE_AYUDANTE;
    return {
      esPropietario: (quien) =>
        this.env.SUPERBOT_OWNER_TELEGRAM_ID !== undefined &&
        quien === this.env.SUPERBOT_OWNER_TELEGRAM_ID,
      idDelAyudante: this.env.AYUDANTE_TELEGRAM_ID ?? null,
      crearEnlace: async ({ chatId: chat, usos, caducaEn }) => {
        const salida = await this.telegramGateway.createChatInviteLink({
          chatId: chat,
          token,
          memberLimit: usos,
          expireDate: caducaEn,
        });
        return { ok: salida.ok, enlace: salida.inviteLink ?? null };
      },
      encolar: async ({ tipo, payload }) => {
        await this.ayudanteSolicitudRepository.crear({
          tenantId,
          tipo,
          payload,
        });
      },
      promover: async ({ chatId: chat, userId, permisos }) => {
        const salida = await this.telegramGateway.promoteChatMember({
          chatId: chat,
          userId,
          customTitle: undefined,
          token,
          rights: permisos,
        });
        return { ok: salida.ok };
      },
      estadoEnElGrupo: async (chat, userId) => {
        const salida = await this.telegramGateway.getChatMember({
          chatId: chat,
          userId,
          token,
        });
        return salida.ok ? (salida.status ?? null) : null;
      },
      guardarNivel: async (nivel) => {
        await this.chatSettingRepository.setValue(
          tenantId,
          claveDeChat,
          clave,
          nivel === null ? null : { nivel, pedidoEn: new Date().toISOString() },
        );
      },
      leerNivel: async () => {
        const crudo = await this.chatSettingRepository.getValue(
          tenantId,
          claveDeChat,
          clave,
        );
        if (typeof crudo !== "object" || crudo === null) return null;
        const nivel = (crudo as { nivel?: unknown }).nivel;
        return nivel === "miembro" || nivel === "auditoria" ? nivel : null;
      },
      ahora: () => new Date(),
    };
  }

  private async handleAyudanteMando(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const texto = (update.raw as { message?: { text?: string } }).message?.text;
    if (!texto?.trimStart().startsWith("/ayudante")) return null;
    if (!context.chatId || !update.user.userId) {
      return { text: "Esto se usa dentro de un grupo." };
    }

    const chatId = update.chat.chatId;
    if (chatId === undefined) return null;
    const respuesta = await atenderMandoDeAyudante({
      texto,
      autor: update.user.userId,
      chatId,
      deps: this.dependenciasDeAyudante(context, this.telegramToken()),
    });
    // HTML explicito: sin `parseMode` el gateway manda `parse_mode: undefined`
    // y Telegram enseña las etiquetas en crudo. El texto lleva <b> y <code>.
    return respuesta === null
      ? null
      : { text: respuesta.texto, parseMode: "HTML" };
  }

  private async handleAyudanteEntrada(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    // Cuelga de `chat_member` y NO de `new_chat_members`, por el mismo motivo
    // que `alertOnImpersonation`: un grupo que filtra por solicitudes de union
    // -que es justo como esta Grupo Central- NUNCA emite el mensaje de servicio.
    // Colgarlo de ahi habria dejado la promocion sin ocurrir precisamente en
    // los grupos para los que se hizo, y sin un solo error en el log.
    if (update.kind !== "chat_member" || !update.chatMemberUpdate) return null;
    if (!context.chatId) return null;

    const { chatId, telegramUserId, oldStatus, newStatus } =
      update.chatMemberUpdate;
    if (!chatId || !telegramUserId) return null;
    if (!isJoinTransition(oldStatus as never, newStatus as never)) return null;

    const respuesta = await atenderEntradaEnElGrupo({
      quienEntro: telegramUserId,
      chatId,
      deps: this.dependenciasDeAyudante(context, this.telegramToken()),
    });
    return respuesta === null
      ? null
      : { text: respuesta.texto, parseMode: "HTML" };
  }

  private async handlePetsMando(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.command?.name !== "pet") {
      return null;
    }
    if (!context.chatId || !update.user.userId) {
      return { text: "Esto se usa dentro de un grupo." };
    }
    const ajustes = parsearAjustes(
      await this.chatSettingRepository.getValue(
        context.tenantId,
        context.chatId,
        PETS_SETTINGS_KEY,
      ),
    );
    const tenantId = context.tenantId;
    const chatId = context.chatId;
    const actor = update.user.userId;
    // A quien va dirigido: a quien se responde. Igual que en `pets.command`,
    // lo resuelve el nucleo porque es forma de update de Telegram.
    const objetivo = extractReplyContext(update.raw).userId;
    const nombres =
      objetivo === undefined
        ? new Map<string, string>()
        : await this.repository
            .findDisplayNamesByTelegramUserIds([objetivo])
            .catch(() => new Map<string, string>());
    const texto = await atenderMandoDeMascotas({
      partes: update.command?.args ?? [],
      objetivo,
      // El creador, o quien sea dueño de este despliegue. Los dos, porque son
      // dos cosas distintas y en produccion no coinciden.
      esPropietario:
        actor === CREADOR_TELEGRAM_ID ||
        this.env.SUPERBOT_OWNER_TELEGRAM_ID === actor,
      dependencias: {
        buscar: (a) => this.petRepository.obtener(tenantId, chatId, a),
        enfermar: (i) => this.petRepository.enfermar(i),
        sanar: (id) => this.petRepository.sanar(id),
        revivir: (id, cuando) => this.petRepository.revivir(id, cuando),
        saldoDe: async (a) =>
          (await this.economyRepository.getWallet(tenantId, chatId, a))
            ?.balance ?? 0,
        anotar: async (accion, resumen) => {
          await this.repository.recordAudit({
            tenantId,
            actorType: "user",
            actorId: actor.toString(),
            action: accion,
            resourceType: "pet",
            resourceId: objetivo?.toString() ?? "",
            payload: { resumen, chatId },
          });
        },
        nombreDe: (u) => nombres.get(u.toString()) ?? `id ${u}`,
        ajustes,
        ahora: update.receivedAt,
      },
    });
    return texto === null ? null : { text: texto, parseMode: "HTML" };
  }

  /**
   * Los comandos de mascotas. Extraccion profunda: aqui solo queda la
   * traduccion —quien escribe, a quien pregunta, que ajustes tiene el grupo— y
   * la llamada. La decision y todo el texto viven en
   * `modules/games/src/pets/bot/mascotas.ts`.
   */
  private async handlePetsCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const comando = update.command?.name;
    if (!esComandoDeMascotas(comando)) {
      return null;
    }
    if (!context.chatId || !update.user.userId) {
      return { text: "Esto se usa dentro de un grupo." };
    }

    const ajustes = parsearAjustes(
      await this.chatSettingRepository.getValue(
        context.tenantId,
        context.chatId,
        PETS_SETTINGS_KEY,
      ),
    );
    if (!ajustes.activo) {
      return null;
    }

    const puerto = crearAdaptadorDeMascotas({
      mascotas: this.petRepository,
      economia: this.economyRepository,
      tenantId: context.tenantId,
      chatId: context.chatId,
      usuario: update.user.userId,
      ajustes,
      ahora: update.receivedAt,
    });

    // A quien se pregunta: a quien se responde. Lo resuelve el nucleo y no el
    // módulo por dos motivos: es forma de update de Telegram, y
    // `extractReplyContext` vive en `modules/security` — un módulo no importa
    // otro, asi que el nucleo lo llama y pasa el resultado ya calculado.
    const objetivo = extractReplyContext(update.raw).userId;

    // Los nombres de quienes salen. Un corral de ids no es un corral: nadie se
    // reconoce en "1000000001", que es justo lo que se veia al desplegarlo.
    //
    // Solo se piden cuando hacen falta —el corral y preguntar por otro—, y de
    // golpe en vez de uno a uno. `/alimentar` y `/huevo` no leen ningun nombre,
    // asi que no pagan la consulta. Si falla, se cae al id: feo, pero informa.
    const aQuienesNombrar = [
      ...(comando === "corral"
        ? (await puerto.corral(10)).map((entrada) => entrada.usuario)
        : []),
      ...(objetivo === undefined ? [] : [objetivo]),
    ];
    const duenos =
      aQuienesNombrar.length === 0
        ? new Map<string, string>()
        : await this.repository
            .findDisplayNamesByTelegramUserIds(aQuienesNombrar)
            .catch(() => new Map<string, string>());

    const texto = await atenderComandoDeMascotas({
      comando,
      ...(objetivo === undefined ? {} : { objetivo }),
      puerto,
      nombreDe: (usuario) => duenos.get(usuario.toString()) ?? `id ${usuario}`,
      // En bruto y sin validar: quien decide qué es un nombre válido es el
      // módulo, junto al código que compone el HTML donde acaba.
      texto: (update.command?.args ?? []).join(" "),
    });
    if (texto === null) {
      return null;
    }

    // El botón que abre la Mini App. Un enlace de app con nombre, NO un
    // `web_app`: Telegram rechaza los botones `web_app` en grupos, y aqui
    // siempre estamos en uno.
    const telegramChatId = update.chat.chatId;
    const botUsername =
      update.managedBot?.username ?? this.env.TELEGRAM_BOT_USERNAME;
    const botonera =
      telegramChatId !== undefined && botUsername
        ? {
            replyMarkup: {
              inline_keyboard: [
                [
                  {
                    text: "🐾 Abrir",
                    url: buildNamedMiniAppLink(
                      botUsername.replace(/^@/u, ""),
                      this.env.TELEGRAM_MINIAPP_NAME,
                      encodePetStartParam(telegramChatId.toString()),
                    ),
                  },
                ],
              ],
            },
          }
        : {};

    return { text: texto, parseMode: "HTML", ...botonera };
  }

  private async handleEconomyCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    replyBotUsername?: string,
  ): Promise<BotReply | null> {
    const name = update.command?.name;
    // Ojo al elegir nombres: este handler se despacha ANTES que el del casino,
    // asi que registrar aqui "saldo", "cartera" o "fichas" no crearia un alias
    // — secuestraria el saldo de fichas del casino, que ya usa esos tres. Y
    // "top" es de reputación y "ranking" de las poles.
    const CONSULTA = new Set(["puntos", "monedas", "billetera"]);
    const RANKING = new Set(["ricos"]);
    const TIENDA = new Set(["bazar", "objetos"]);
    const INVENTARIO = new Set(["inventario", "mochila"]);
    if (
      !name ||
      (!CONSULTA.has(name) &&
        !RANKING.has(name) &&
        !TIENDA.has(name) &&
        !INVENTARIO.has(name) &&
        name !== "checkin" &&
        name !== "donar" &&
        name !== "robar" &&
        name !== "purga" &&
        name !== "comprarfichas" &&
        name !== "venderfichas" &&
        name !== "movimientos" &&
        name !== "fianza" &&
        name !== "guardar" &&
        name !== "sacar" &&
        // Del casino, y sigue siendolo salvo cuando de verdad le toca a la
        // tienda del grupo (ver `reclamaLaTienda`). `tienda` NO esta en la
        // lista: ese se queda entero para el casino.
        name !== "comprar")
    ) {
      return null;
    }

    // `/comprar` YA existe: es del casino y compra fichas con Telegram Stars.
    // Como este handler va antes, quedarselo sin mirar dejaria al grupo sin la
    // unica via de pago real del bot.
    //
    // El reparto no es un apaño: comprar fichas con Stars exige chat privado
    // (Telegram no manda facturas a un grupo) y la moneda del grupo solo existe
    // dentro de un grupo, asi que cada uno manda donde el otro no puede estar.
    // Lo que no encaje se devuelve como null y sigue su camino al casino.
    const enGrupo =
      Boolean(context.chatId) && update.chat.chatType !== "private";
    const reclamaLaTienda = async (): Promise<boolean> => {
      if (!enGrupo || !context.chatId) {
        return false;
      }
      const tienda = await this.groupShopSettings(
        context.tenantId,
        context.chatId,
      );
      if (!tienda.enabled) {
        return false;
      }
      // A secas abre la tienda del grupo; con un objeto suyo, lo compra.
      // `/comprar mega` sigue siendo un paquete de fichas del casino.
      const pedido = update.command?.args?.[0];
      return pedido === undefined || isShopItemId(pedido);
    };
    if (name === "comprar" && !(await reclamaLaTienda())) {
      return null;
    }

    if (!context.chatId || !update.user.userId) {
      return { text: "Esto se usa dentro de un grupo." };
    }
    const { tenantId, chatId } = context;
    const userId = update.user.userId;
    const nowMs = update.receivedAt.getTime();
    const settings = await this.groupCurrencySettings(tenantId, chatId, nowMs);
    const DAY_MS = 24 * 60 * 60 * 1000;

    if (RANKING.has(name)) {
      const top = await this.economyRepository.top(tenantId, chatId, 10);
      if (top.length === 0) {
        return { text: "Todavía no hay nadie con saldo por aquí." };
      }
      // Un ranking de ids no es un ranking: nadie se reconoce en "1000000001".
      // Si la consulta falla se cae al id, que es feo pero sigue informando.
      const nombres = await this.repository
        .findDisplayNamesByTelegramUserIds(top.map((r) => r.userTelegramId))
        .catch(() => new Map<string, string>());
      // Los motes comprados. Son diez consultas como mucho y solo en /ricos,
      // que es un comando que se escribe a mano: el sitio donde el mote se
      // luce es este, y por eso se paga por el.
      const motes = new Map(
        await Promise.all(
          top.map(async (row) => {
            const suyo = usableItems(
              await this.ownedShopItems(tenantId, chatId, row.userTelegramId),
              nowMs,
            ).find((o) => o.itemId === "mote");
            return [row.userTelegramId.toString(), suyo?.payload] as const;
          }),
        ),
      );
      const medalla = ["🥇", "🥈", "🥉"];
      return {
        text: [
          `🏆 Los más ricos en ${settings.nombre}:`,
          ...top.map((row, i) => {
            const clave = row.userTelegramId.toString();
            const mote = motes.get(clave);
            const quien = nombres.get(clave) ?? clave;
            return `${medalla[i] ?? `${i + 1}.`} ${quien}${
              mote ? ` «${mote}»` : ""
            } — ${formatCurrency(row.balance, settings)}`;
          }),
        ].join("\n"),
      };
    }

    if (name === "movimientos") {
      const movimientos = await this.economyRepository.history(
        tenantId,
        chatId,
        userId,
        10,
      );
      if (movimientos.length === 0) {
        return { text: "No tienes movimientos todavía." };
      }
      const ETIQUETA: Record<string, string> = {
        earn: "hablando",
        "donate-out": "donaste",
        "donate-in": "te donaron",
        "steal-win": "robaste",
        "steal-loss": "te robaron",
        fine: "multa",
        "fine-payout": "compensación",
        // Estos cuatro llevaban desde el principio cayendo al `?? m.reason` de
        // abajo, así que /movimientos enseñaba "bet" y "exchange-out" en crudo.
        bet: "apuesta",
        win: "premio",
        "exchange-out": "compraste fichas",
        "exchange-in": "vendiste fichas",
        "shop-buy": "compra en la tienda",
        "shop-refund": "devolución de la tienda",
        bail: "fianza",
        admin: "ajuste de un admin",
      };
      return {
        text: [
          "🧾 Tus últimos movimientos:",
          ...movimientos.map(
            (m) =>
              `${m.delta > 0 ? "+" : ""}${m.delta} — ${ETIQUETA[m.reason] ?? m.reason}`,
          ),
        ].join("\n"),
      };
    }

    // `/comprar` a secas es el escaparate: la lista y el enlace que abre la
    // pantalla. Con un objeto detras, la compra. Se junta con `/bazar` porque es
    // la misma pregunta —"que hay"— hecha de dos formas.
    if (
      TIENDA.has(name) ||
      (name === "comprar" && !update.command?.args?.[0])
    ) {
      return this.handleShopListCommand(
        tenantId,
        chatId,
        userId,
        settings,
        update.chat.chatId,
        replyBotUsername,
      );
    }

    if (INVENTARIO.has(name)) {
      return this.handleInventoryCommand(tenantId, chatId, userId, nowMs);
    }

    if (name === "comprar") {
      return this.handleBuyCommand(context, update, settings, nowMs);
    }

    if (name === "fianza") {
      return this.handleBailCommand(context, update, settings, nowMs);
    }

    if (name === "guardar" || name === "sacar") {
      return this.handleVaultCommand(
        context,
        update,
        settings,
        name === "guardar",
      );
    }

    if (name === "robar") {
      return this.handleStealCommand(context, update, settings, nowMs);
    }

    if (name === "purga") {
      return this.handlePurgeCommand(context, update, nowMs);
    }

    if (name === "venderfichas") {
      if (settings.monedasPorFicha <= 0) {
        return {
          text: "En este grupo no se pueden cambiar fichas por monedas. Un admin puede activarlo desde /settings → Economía y juegos.",
        };
      }
      const cantidad = Number.parseInt(update.command?.args?.[0] ?? "", 10);
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        const estado = await this.chipRepository.sellableChips(
          tenantId,
          userId,
        );
        return {
          parseMode: "Markdown",
          text: [
            "Uso: /venderfichas <cuántas>.",
            "",
            `Puedes cambiar *${groupThousands(estado.sellable)}* de tus ${groupThousands(estado.balance)} fichas.`,
            ...(estado.locked > 0
              ? [
                  `Las otras ${groupThousands(estado.locked)} las compraste con Stars y esas no se cambian: es lo que impide que te las roben.`,
                ]
              : []),
          ].join("\n"),
        };
      }
      const res = await this.exchangeRepository.sellChipsForCoins({
        tenantId,
        chatId,
        telegramUserId: userId,
        chips: cantidad,
        coinsPerChip: settings.monedasPorFicha,
        feePct: settings.comisionVentaPct,
        refId: this.claveDeterminista(update, "vender-fichas"),
      });
      if (!res.ok) {
        // Cada motivo dice lo suyo. Antes eran dos ramas: `locked` y
        // "No tienes tantas", que era falso para los otros tres — y encima
        // se contradecia en la misma frase, porque seguia diciendo cuantas
        // fichas cambiables tiene.
        switch (res.error) {
          case "locked":
            return {
              parseMode: "Markdown",
              text: [
                `Tienes fichas de sobra, pero solo *${groupThousands(res.sellable)}* son cambiables.`,
                "",
                "El resto las compraste con Stars, y ésas no salen del casino: es justo lo que impide que alguien te robe lo que pagaste con dinero.",
              ].join("\n"),
            };
          case "insufficient":
            return {
              parseMode: "Markdown",
              text: `No tienes tantas. Puedes cambiar *${groupThousands(res.sellable)}* fichas.`,
            };
          case "disabled":
            return { text: "El cambio de fichas está apagado en este grupo." };
          case "invalid-amount":
            return {
              text: "Esa cantidad no da ni para una moneda con la comisión de venta del grupo. Prueba con más fichas.",
            };
        }
        // Sin `default`, pero con red: el switch esta dentro de un `if`, asi
        // que quitarlo a secas dejaria caer un motivo nuevo al camino de
        // exito de abajo — diria que el cambio se hizo cuando no se hizo.
        const motivoDesconocido: never = res.error;
        void motivoDesconocido;
        return { text: "No he podido hacer el cambio. Inténtalo otra vez." };
      }
      return {
        parseMode: "Markdown",
        text: [
          `💱 Has cambiado *${groupThousands(res.chips)}* fichas por ${formatCurrency(res.coins, settings)}.`,
          ...(settings.comisionVentaPct > 0
            ? [`_Comisión de venta: ${settings.comisionVentaPct}%._`]
            : []),
          "",
          `Te quedan *${groupThousands(res.chipBalance)}* fichas y ${formatCurrency(res.coinBalance, settings)}.`,
        ].join("\n"),
      };
    }

    if (name === "comprarfichas") {
      if (settings.monedasPorFicha <= 0) {
        return {
          text: "En este grupo no se pueden cambiar monedas por fichas. Un admin puede activarlo desde /settings → Economía y juegos.",
        };
      }
      const cantidad = Number.parseInt(update.command?.args?.[0] ?? "", 10);
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        return {
          text: `Uso: /comprarfichas <cuántas>. Cada ficha cuesta ${formatCurrency(settings.monedasPorFicha, settings)}.`,
        };
      }
      const res = await this.exchangeRepository.buyChipsWithCoins({
        tenantId,
        chatId,
        telegramUserId: userId,
        chips: cantidad,
        costPerChip: settings.monedasPorFicha,
        refId: this.claveDeterminista(update, "comprar-fichas"),
      });
      if (!res.ok) {
        return {
          text:
            res.error === "insufficient"
              ? `No te llega: ${cantidad} fichas cuestan ${formatCurrency(res.cost, settings)} y tienes ${formatCurrency(res.coinBalance, settings)}.`
              : "No he podido hacer el cambio.",
        };
      }
      return {
        parseMode: "Markdown",
        text: [
          `🪙 Has cambiado ${formatCurrency(res.cost, settings)} por *${groupThousands(res.chips)}* fichas.`,
          "",
          `Te quedan ${formatCurrency(res.coinBalance, settings)} y tienes *${groupThousands(res.chipBalance)}* fichas.`,
        ].join("\n"),
      };
    }

    if (name === "donar") {
      const cantidad = Number.parseInt(update.command?.args?.[0] ?? "", 10);
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        return {
          text: "Uso: /donar <cantidad> @persona — o responde a un mensaje suyo con /donar <cantidad>. Ej: /donar 50 @gerard",
        };
      }
      // La cantidad va primero, asi que el objetivo escrito es el segundo
      // argumento: `/donar 50 @persona`.
      const destino = await this.resolveCommandTarget(
        update,
        update.command?.args?.[1],
      );
      if (destino === undefined) {
        return {
          text: [
            "¿A quién? Responde a un mensaje suyo con /donar <cantidad>, o escribe /donar <cantidad> @persona.",
            "",
            "Si pusiste su @usuario y aun así no lo pillo, es que todavía no ha escrito nada por aquí: Telegram no me deja buscar a nadie por nombre.",
          ].join("\n"),
        };
      }
      const res = await this.economyRepository.move({
        tenantId,
        chatId,
        fromId: userId,
        toId: destino,
        amount: cantidad,
        fromReason: "donate-out",
        toReason: "donate-in",
        refId: this.claveDeterminista(update, "donar"),
      });
      if (res.error === "self") {
        return { text: "Donarte a ti mismo no te hace más rico." };
      }
      if (!res.ok) {
        return {
          text: `No te llega. Tienes ${formatCurrency(res.fromBalance, settings)}.`,
        };
      }
      return {
        text: `🎁 Has donado ${formatCurrency(cantidad, settings)}. Te quedan ${formatCurrency(res.fromBalance, settings)}.`,
      };
    }

    if (name === "checkin") {
      const dia = new Date(nowMs).toISOString().slice(0, 10);
      const DIARIO = 10;
      // La idempotencia la da el libro mayor con `refId` = el dia. Antes esto se
      // deducia de `lastEarnedMs`, que obligaba a comparar dias a mano y no
      // dejaba rastro de la entrega.
      const res = await this.economyRepository.credit(
        tenantId,
        chatId,
        userId,
        DIARIO,
        "earn",
        `checkin:${dia}`,
      );
      return {
        text: res.ok
          ? `🎁 Check-in diario: +${formatCurrency(DIARIO, settings)}. Saldo: ${formatCurrency(res.balance, settings)}.`
          : `Ya hiciste el check-in de hoy. Saldo: ${formatCurrency(res.balance, settings)}.`,
      };
    }

    const cartera = await this.economyRepository.ensureWallet(
      tenantId,
      chatId,
      userId,
    );
    const ganadoHoy = await this.economyRepository.earnedSince(
      tenantId,
      chatId,
      userId,
      new Date(Math.floor(nowMs / DAY_MS) * DAY_MS),
    );
    return {
      text: [
        `💰 Tienes ${formatCurrency(cartera.balance, settings)}.`,
        settings.enabled
          ? `Hoy llevas ${ganadoHoy} de ${settings.cupoDiario} ganados hablando.`
          : "La moneda de este grupo está apagada; un admin puede encenderla desde el panel.",
      ].join("\n"),
    };
  }

  private async handleRecipeCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.command?.name !== "receta") {
      return null;
    }

    if (!context.chatId) {
      return {
        text: "Las recetas de configuración se usan dentro de un grupo.",
      };
    }

    const [antiflood, captcha, antiraid, hygiene] = await Promise.all([
      this.antifloodRepository.getConfig(context.tenantId, context.chatId),
      this.captchaRepository.getConfig(context.tenantId, context.chatId),
      this.antiraidRepository.getConfig(context.tenantId, context.chatId),
      this.groupProtectionRepository.getHygiene(context.chatId),
    ]);

    const current: Record<string, unknown> = {
      antiflood: antiflood?.enabled ?? false,
      captcha: captcha?.enabled ?? false,
      antiraid: antiraid?.enabled ?? false,
      nightMode: hygiene.nightMode,
      welcomeMute: hygiene.welcomeMute,
      cleanService: hygiene.cleanService,
      rtlFilter: hygiene.rtlFilter,
      cjkFilter: hygiene.cjkFilter,
    };

    const args = update.command?.args ?? [];

    if (args[0]?.toLowerCase() === "import") {
      const code = args[1];
      if (!code) {
        return { text: "Uso: /receta import <código>" };
      }
      const decoded = decodeConfigRecipe(code);
      if (!decoded.ok) {
        return { text: `Receta inválida: ${decoded.error}.` };
      }
      const changes = diffConfigRecipe(current, decoded.config);
      if (changes.length === 0) {
        return {
          text: "✅ La receta coincide con tu configuración actual; no hay cambios.",
        };
      }
      const lines = changes.map(
        (change) =>
          `• ${change.key}: ${String(change.from)} → ${String(change.to)}`,
      );
      return {
        text: `🧾 Esta receta cambiaría:\n${lines.join("\n")}\n(vista previa; no se ha aplicado)`,
      };
    }

    const code = encodeConfigRecipe(current);
    return {
      text: `🧾 Receta de configuración de este grupo:\n\`${code}\`\nEn otro grupo usa /receta import <código> para ver los cambios.`,
    };
  }

  private async handleIncidentCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.command?.name !== "estado") {
      return null;
    }

    if (!context.chatId) {
      return { text: "La página de estado se usa dentro de un grupo." };
    }

    const args = update.command?.args ?? [];
    const sub = args[0]?.toLowerCase();

    if (sub === "nueva" || sub === "cerrar") {
      const permission = await this.ensureConfigPermission(
        context,
        update,
        "incident.write",
      );
      if (!permission.allowed) {
        return { text: "No tienes permisos para gestionar incidencias." };
      }

      if (sub === "nueva") {
        const title = args.slice(1).join(" ").trim();
        if (title.length === 0) {
          return { text: "Uso: /estado nueva <título de la incidencia>" };
        }
        await this.incidentRepository.createIncident(
          context.tenantId,
          context.chatId,
          title,
        );
        return { text: `🔴 Incidencia abierta: ${title}` };
      }

      const resolved = await this.incidentRepository.resolveLatestOpen(
        context.tenantId,
        context.chatId,
      );
      return {
        text: resolved
          ? "🟢 Incidencia marcada como resuelta."
          : "No hay incidencias abiertas.",
      };
    }

    const records = await this.incidentRepository.listIncidents(
      context.tenantId,
      context.chatId,
      10,
    );
    const incidents = records.map((record) => ({
      id: record.id,
      title: record.title,
      status: (record.status === "identificado"
        ? "identificado"
        : record.status === "resuelto"
          ? "resuelto"
          : "investigando") as "investigando" | "identificado" | "resuelto",
      ms: record.updatedAtMs,
    }));
    return { text: formatStatusPage(incidents, update.receivedAt.getTime()) };
  }

  private async handleCoopMissionCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.command?.name !== "mision") {
      return null;
    }

    if (!context.chatId) {
      return {
        text: "Las misiones cooperativas se gestionan dentro de un grupo.",
      };
    }

    const args = update.command?.args ?? [];
    const sub = args[0]?.toLowerCase();

    if (sub === "set" || sub === "add") {
      const permission = await this.ensureConfigPermission(
        context,
        update,
        "coopmission.write",
      );
      if (!permission.allowed) {
        return { text: "No tienes permisos para gestionar misiones." };
      }

      if (sub === "set") {
        const goal = Number.parseInt(args[1] ?? "", 10);
        if (!Number.isFinite(goal) || goal <= 0) {
          return { text: "Uso: /mision set <objetivo> <descripción>" };
        }
        const description = args.slice(2).join(" ").trim();
        await this.coopMissionRepository.setMission(
          context.tenantId,
          context.chatId,
          { goal, progress: 0, description },
        );
        return {
          text: `🎯 Nueva misión: ${description || "objetivo del grupo"} (0/${goal}).`,
        };
      }

      const rawDelta = Number.parseInt(args[1] ?? "1", 10);
      const delta = Number.isFinite(rawDelta) ? rawDelta : 1;
      const stored = await this.coopMissionRepository.getMission(
        context.tenantId,
        context.chatId,
      );
      if (!stored) {
        return {
          text: "No hay misión activa. Crea una con /mision set <objetivo> <descripción>.",
        };
      }
      const { mission, completed } = addMissionProgress(
        { goal: stored.goal, progress: stored.progress },
        delta,
      );
      await this.coopMissionRepository.setMission(
        context.tenantId,
        context.chatId,
        {
          goal: mission.goal,
          progress: mission.progress,
          description: stored.description,
        },
      );
      if (completed) {
        return {
          text: `🏆 ¡Misión completada! ${stored.description || "objetivo del grupo"} (${mission.progress}/${mission.goal}).`,
        };
      }
      return {
        text: `➕ Progreso: ${mission.progress}/${mission.goal} (${missionPercent(mission)}%).`,
      };
    }

    const stored = await this.coopMissionRepository.getMission(
      context.tenantId,
      context.chatId,
    );
    if (!stored) {
      return {
        text: "No hay misión activa en este grupo. Crea una con /mision set <objetivo> <descripción>.",
      };
    }
    const mission = { goal: stored.goal, progress: stored.progress };
    return {
      text: `🎯 Misión: ${stored.description || "objetivo del grupo"}\nProgreso: ${mission.progress}/${mission.goal} (${missionPercent(mission)}%). Faltan ${coopMissionRemaining(mission)}.`,
    };
  }

  private async handleGratitudeCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const name = update.command?.name;
    if (name !== "gracias" && name !== "topgracias") {
      return null;
    }

    if (!context.chatId) {
      return { text: "La gratitud se usa dentro de un grupo." };
    }

    const args = update.command?.args ?? [];

    if (name === "topgracias" || args[0]?.toLowerCase() === "top") {
      const top = await this.gratitudeRepository.top(
        context.tenantId,
        context.chatId,
        10,
      );
      const ranked = rankGratitude(
        top.map((entry) => ({
          userId: entry.userTelegramId.toString(),
          points: entry.points,
        })),
      );
      if (ranked.length === 0) {
        return { text: "Todavía no hay gracias en este grupo." };
      }
      const medals = ["🥇", "🥈", "🥉"];
      const lines = ranked.map(
        (entry, index) =>
          `${medals[index] ?? "•"} ${entry.userId}: ${entry.points}`,
      );
      return { text: `🙏 Ranking de gratitud:\n${lines.join("\n")}` };
    }

    const replyUserId = extractReplyContext(update.raw).userId;
    if (replyUserId) {
      const target = BigInt(replyUserId);
      if (update.user.userId !== undefined && target === update.user.userId) {
        return { text: "No puedes darte las gracias a ti mismo." };
      }
      const current = await this.gratitudeRepository.getPoints(
        context.tenantId,
        context.chatId,
        target,
      );
      const next = grantGratitude(current, GRATITUDE_PER_THANKS);
      await this.gratitudeRepository.setPoints(
        context.tenantId,
        context.chatId,
        target,
        next,
      );
      // Al perro le alegra que le den las gracias a su dueño. Se traga sus
      // propios fallos: lo que se pidio fue agradecer, y eso ya esta hecho.
      await animarPorGratitud({
        mascotas: this.petRepository,
        tenantId: context.tenantId,
        chatId: context.chatId,
        usuario: target,
        ahora: new Date(),
      });
      return {
        text: `🙏 ¡Gracias registradas! Ese usuario acumula ${next} puntos de gratitud.`,
      };
    }

    if (update.user.userId === undefined) {
      return {
        text: "Responde a alguien con /gracias para agradecerle, o usa /topgracias.",
      };
    }
    const own = await this.gratitudeRepository.getPoints(
      context.tenantId,
      context.chatId,
      update.user.userId,
    );
    return {
      text: `🙏 Tienes ${own} puntos de gratitud. Responde a alguien con /gracias para agradecerle.`,
    };
  }

  /**
   * Reads the "chat_quiet" ChatSetting (mirror of @superbot/shared CHAT_QUIET_KEY).
   * When an admin turns on quiet mode the bot must not speak unprompted — level-up
   * announcements and the watchdog's warnings both defer to this.
   */
  private async isChatQuiet(
    tenantId: string,
    chatId: string,
  ): Promise<boolean> {
    const raw = await this.chatSettingRepository.getValue(
      tenantId,
      chatId,
      "chat_quiet",
    );
    return (
      typeof raw === "object" &&
      raw !== null &&
      (raw as { enabled?: unknown }).enabled === true
    );
  }

  /**
   * Resolves this group's effective bot mode (see {@link resolveBotMode}):
   * whether autonomous moderation, cleanup, unsolicited messages and manual
   * moderation commands are enabled. The master "passive mode" makes Modryva do
   * ONLY Guardian verification + games — those are never gated here.
   *
   * Reads hygiene from the DB. When the caller already holds a HygieneState,
   * prefer `resolveBotMode(hygiene)` directly to avoid a second read.
   */
  private async botMode(chatId: string): Promise<BotModeResolution> {
    const hygiene = await this.groupProtectionRepository.getHygiene(chatId);
    return resolveBotMode(hygiene);
  }

  /**
   * Ambient protective moderation with a "watchdog" fallback for when the bot is a
   * plain member, not an admin. It tries to delete the offending message and then
   * answers HONESTLY about what actually happened:
   *  - delete succeeded          → confirm the removal (`deletedText`)
   *  - delete failed / no rights → warn the group instead (`warnText`) so the
   *    community is still protected even though the bot can't act.
   *
   * Telegram rejects deleteMessage with HTTP 400/403 when the bot lacks delete
   * rights (i.e. it isn't admin); the gateway surfaces that as a throw, which we
   * treat as "couldn't delete". The warning is an unprompted message, so it defers
   * to quiet mode: if the admin silenced the bot, it stays quiet (returns null).
   *
   * Callers must have already checked `context.chatId`, `telegramChatId` and
   * `messageId` are present (all three ambient guards do).
   */
  private async deleteOrWatch(
    context: FoundationContext,
    telegramChatId: bigint,
    messageId: number,
    deletedText: string,
    warnText: string,
  ): Promise<BotReply | null> {
    let deleted = false;
    try {
      const result = await this.telegramGateway.deleteMessage({
        chatId: telegramChatId,
        messageId,
        token: this.telegramToken(),
      });
      deleted = result.ok;
    } catch {
      deleted = false;
    }

    if (deleted) {
      return { text: deletedText };
    }

    // Watchdog: couldn't remove it. Warn the group — unless the bot is silenced.
    if (
      !context.chatId ||
      (await this.isChatQuiet(context.tenantId, context.chatId))
    ) {
      return null;
    }
    return { text: warnText, parseMode: "Markdown" };
  }

  /**
   * `dangerous-file.ambient`, con la decision ya en `modules/security`.
   *
   * El orden importa y se conserva: se clasifica el fichero ANTES de preguntar
   * si quien lo mando es administrador. Al reves costaria una consulta por cada
   * mensaje con adjunto del grupo, tambien los inofensivos.
   */
  private async handleDangerousFileMatch(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const attachment = update.attachment;
    if (
      update.kind !== "message" ||
      !attachment ||
      !context.chatId ||
      !update.chat.chatId ||
      !update.messageId
    ) {
      return null;
    }

    const decision = clasificarAdjuntoPeligroso(attachment.fileName ?? "");
    if (!decision) {
      return null;
    }

    if (await this.isActorAdmin(context, update)) {
      return null;
    }

    return this.deleteOrWatch(
      context,
      update.chat.chatId,
      update.messageId,
      decision.textoBorrado,
      decision.textoAviso,
    );
  }

  private async handlePrivacyLeakAmbient(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.kind !== "message" ||
      update.command ||
      !update.messageText ||
      !context.chatId ||
      !update.chat.chatId ||
      !update.messageId
    ) {
      return null;
    }

    // Aqui el orden es el contrario que en el adjunto, y tambien se conserva:
    // primero el administrador, despues el analisis. El detector corre sobre
    // CADA mensaje de texto del grupo, asi que salir pronto ahorra mas de lo que
    // cuesta la comprobacion.
    if (await this.isActorAdmin(context, update)) {
      return null;
    }

    const decision = detectarFugaDeDatos(update.messageText);
    if (!decision) {
      return null;
    }

    return this.deleteOrWatch(
      context,
      update.chat.chatId,
      update.messageId,
      decision.textoBorrado,
      decision.textoAviso,
    );
  }

  private async handleScamSignalsAmbient(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.kind !== "message" ||
      update.command ||
      !update.messageText ||
      !context.chatId ||
      !update.chat.chatId ||
      !update.messageId
    ) {
      return null;
    }

    const antiflood = await this.antifloodRepository.getConfig(
      context.tenantId,
      context.chatId,
    );
    if (!antiflood?.enabled) {
      return null;
    }

    if (await this.isActorAdmin(context, update)) {
      return null;
    }

    // La politica —nueve senales, dos para actuar— vive en `modules/security`.
    // El umbral decide cuanta gente inocente ve su mensaje borrado, asi que
    // tiene nombre y tests propios en vez de ser un `< 2` suelto aqui.
    const decision = decidirSobreEstafa({
      texto: update.messageText,
      usuario: update.user.username,
    });
    if (!decision) {
      return null;
    }

    return this.deleteOrWatch(
      context,
      update.chat.chatId,
      update.messageId,
      decision.textoBorrado,
      decision.textoAviso,
    );
  }

  /**
   * `chat-activity.logger`, ya EXTRAIDO a `modules/community`.
   *
   * Lo que queda aqui es lo unico que le toca al nucleo: normalizar el update
   * a la forma que el módulo entiende y entregarle su puerto. La decision de
   * que cuenta como actividad y la traduccion a fila viven en el módulo.
   *
   * `extractReplyContext` se resuelve AQUI a proposito: navega el update crudo
   * de Telegram y vive en `modules/security`. Que lo llamara el módulo seria un
   * import de módulo a módulo, que hoy es cero y el test de arquitectura no
   * deja subir.
   */
  private async handleChatActivityLogger(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const replyUserId = extractReplyContext(update.raw).userId;

    return registrarActividadDeChat(
      {
        tipo: update.kind,
        esComando: Boolean(update.command),
        texto: update.messageText,
        tenantId: context.tenantId,
        chatId: context.chatId,
        tieneEnlace: update.content.hasUrl,
        tieneMencion: update.content.hasMention,
        usuarioTelegramId: update.user.userId,
        usuario: update.user.username,
        respondeAUsuarioId:
          replyUserId === undefined ? undefined : BigInt(replyUserId),
        tema:
          update.chat.topicId === undefined
            ? undefined
            : String(update.chat.topicId),
        mensajeId:
          update.messageId === undefined ? undefined : BigInt(update.messageId),
      },
      registroDeActividadConRepositorio((entrada) =>
        this.chatActivityRepository.record(entrada),
      ),
    );
  }

  /**
   * El registro completo: todo lo que ve el bot, sin caducidad.
   *
   * Decision explicita del propietario (2026-08-09), y por eso la politica
   * publicada lo dice ahora en vez de prometer lo contrario.
   *
   * A diferencia de `handleChatActivityLogger`, este NO se salta nada: guarda
   * comandos, mensajes solo con foto y mensajes sin texto ninguno. Un archivo
   * con agujeros es peor que no tenerlo, porque quien lo consulta cree que ve
   * la conversacion entera.
   *
   * De la media solo se apunta el `file_id`; los bytes los baja despues el
   * worker. Descargarlos aqui pondria una peticion a Telegram de ida y vuelta
   * en el camino de cada mensaje del grupo, que es lo que convierte un webhook
   * en un cuello de botella.
   *
   * Best-effort como el de actividad: un fallo archivando nunca puede impedir
   * que el bot modere.
   */
  /**
   * `message-log.archive`, ya EXTRAIDO a `modules/community`.
   *
   * El nucleo normaliza el update —incluido `extractReplyContext`, que vive en
   * `modules/security` y por tanto no puede llamar community— y le entrega el
   * puerto. La decision de que se archiva y la traduccion a fila viven ya en el
   * módulo.
   */
  private async handleMessageArchive(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const respuesta = extractReplyContext(update.raw);

    return archivarMensaje(
      {
        tipo: update.kind,
        tenantId: context.tenantId,
        chatId: context.chatId,
        telegramChatId: update.chat.chatId,
        telegramUserId: update.user.userId,
        mensajeId: update.messageId,
        texto: update.messageText ?? update.messageCaption,
        recibidoEn: update.receivedAt,
        hiloId: update.chat.topicId,
        usuario: update.user.username,
        nombreVisible: update.user.firstName,
        respondeAMensajeId: respuesta.messageId,
        respondeAUsuarioId: respuesta.userId,
        adjunto: update.attachment
          ? {
              tipo: update.attachment.kind,
              ficheroId: update.attachment.fileId,
              ficheroUnicoId: update.attachment.fileUniqueId,
              ...(update.attachment.mimeType !== undefined
                ? { mimeType: update.attachment.mimeType }
                : {}),
              ...(update.attachment.fileSize !== undefined
                ? { tamanoBytes: update.attachment.fileSize }
                : {}),
            }
          : undefined,
      },
      archivoDeMensajesConRepositorio(
        (entrada) => this.messageLogRepository.record(entrada),
        (entrada) => this.messageLogRepository.recordEdit(entrada),
      ),
    );
  }

  /**
   * Edit-risk / edit-spam ambient guard: when a message is edited, compare it
   * against the stored original (looked up by telegram message id) and warn on
   * edits that sneak in a link/mention or rewrite the message late — a classic
   * "clean on entry, spam after edit" evasion. Only warns on strong signals;
   * never deletes. Best-effort: a missing original (outside the log window)
   * just skips.
   */
  /**
   * `edit-guard.ambient`. La revision entera vive en `modules/security`
   * (`revisarEdicion`); aqui solo queda traducir el update y darle por donde
   * mirar el original.
   */
  private async handleEditedMessage(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.kind !== "edited_message" || !context.chatId) {
      return null;
    }

    const aviso = await revisarEdicion(
      {
        mensajeId:
          update.messageId === undefined ? undefined : BigInt(update.messageId),
        textoNuevo: update.messageText,
        tieneEnlace: update.content.hasUrl,
        tieneMencion: update.content.hasMention,
      },
      originalDeMensajeConRepositorio((mensajeId) =>
        this.chatActivityRepository.findOriginalMessage(
          context.tenantId,
          // `chatId` esta comprobado arriba; el estrechamiento no cruza el
          // cierre de la lambda.
          context.chatId as string,
          mensajeId,
        ),
      ),
      Date.now(),
    );

    return aviso === null ? null : { text: aviso };
  }

  /**
   * Records native message reactions (Telegram `message_reaction`) into the
   * activity log as kind "reaction", keyed to the reacted-to message's author
   * (looked up by message id). Feeds the /reaccion_abuso report; recording
   * only, never replies. Best-effort: an original outside the log window is
   * skipped, so it cannot attribute the reaction and does nothing.
   */
  private async handleMessageReaction(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const reaction = update.reaction;
    if (
      update.kind !== "message_reaction" ||
      !context.chatId ||
      reaction === undefined ||
      reaction.messageId === undefined ||
      reaction.emojisAdded.length === 0
    ) {
      return null;
    }

    const original = await this.chatActivityRepository.findOriginalMessage(
      context.tenantId,
      context.chatId,
      BigInt(reaction.messageId),
    );
    if (!original || original.telegramUserId === undefined) {
      return null;
    }

    const authorId = original.telegramUserId;
    const authorUsername = original.username;
    try {
      for (const emoji of reaction.emojisAdded) {
        await this.chatActivityRepository.record({
          tenantId: context.tenantId,
          chatId: context.chatId,
          kind: "reaction",
          telegramUserId: authorId,
          ...(authorUsername !== undefined ? { username: authorUsername } : {}),
          text: emoji,
          messageId: BigInt(reaction.messageId),
        });
      }
    } catch {
      // Non-fatal: the activity log is best-effort.
    }

    return null;
  }

  /**
   * Native reaction moderation (Bot API 10.0). Two-phase, fail-closed, opt-in
   * (default `off`), and it NEVER replies to the group — staff heads-ups go to
   * the configured STAFF chat only.
   *
   *  Phase 1 (pure, no I/O): load the per-chat config and classify what was just
   *  added. `off` or nothing-blocked ends here — we never spend a getMe /
   *  getChatMember on the overwhelmingly common innocent reaction.
   *
   *  Phase 2 (enforce mode + a blocked reaction only): resolve the BOT's own
   *  `can_delete_messages` — tri-state, cached, single-flight — and act:
   *    • can-delete (true)      → deleteMessageReaction (removes by ACTOR, not
   *                               emoji) + audit; a 400/403 invalidates the cache.
   *    • confirmed-absent(false)→ audit + ONE staff alert per window (never spam).
   *    • unknown (undefined)    → transient failure: audit only, never cry
   *                               "missing permission" on a timeout/429.
   *
   *  `shadow` mode audits the block but touches nothing. Independently, a brigade
   *  of DISTINCT suspicious reactors on one message raises a shadow-only surge
   *  alert; we never auto-fire the heavy global deleteAllMessageReactions.
   *
   * Every side effect is wrapped so a moderation failure can't break the update
   * pipeline (the activity-log handler still runs).
   */
  private async handleReactionModeration(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const reaction = update.reaction;
    if (
      update.kind !== "message_reaction" ||
      !context.chatId ||
      reaction === undefined ||
      reaction.chatId === undefined ||
      reaction.messageId === undefined ||
      reaction.reactionsAdded.length === 0
    ) {
      return null;
    }
    // Narrow the Telegram ids before any await so control-flow narrowing holds.
    const telegramChatId = reaction.chatId;
    const messageId = reaction.messageId;
    // Consistency guard: only ever act on the chat this update belongs to.
    if (
      update.chat.chatId !== undefined &&
      update.chat.chatId !== telegramChatId
    ) {
      return null;
    }

    const config = parseReactionModerationConfig(
      await this.chatSettingRepository.getValue(
        context.tenantId,
        context.chatId,
        REACTION_MODERATION_SETTING_KEY,
      ),
    );

    const classification = classifyReactionModeration(
      reaction.reactionsAdded,
      config,
    );
    if (classification.kind === "none") {
      return null;
    }

    // Runtime actor validation: Telegram delivers exactly one of user /
    // actor_chat. Both-or-neither is malformed — audit it, never fire a removal.
    const actor = this.resolveReactionActor(reaction);
    if (actor === undefined) {
      await this.auditReaction(
        context,
        reaction,
        config,
        "malformed_actor",
        classification.blocked,
      );
      return null;
    }

    // Brigading signal (both shadow + enforce feed it; dedup by actor).
    const surging = this.trackReactionSurge(
      context,
      config,
      telegramChatId,
      messageId,
      actor,
    );

    if (classification.kind === "observe") {
      await this.auditReaction(
        context,
        reaction,
        config,
        "observed",
        classification.blocked,
      );
    } else {
      const botId = await this.resolveBotTelegramId();
      const canDelete = await this.resolveBotReactionPermission(
        botId,
        telegramChatId,
      );
      const outcome = resolveEnforceOutcome(classification.blocked, canDelete);
      if (outcome.kind === "remove") {
        await this.removeReaction(
          context,
          reaction,
          config,
          actor,
          outcome.blocked,
          botId,
          telegramChatId,
          messageId,
        );
      } else if (outcome.kind === "missing_permission") {
        await this.auditReaction(
          context,
          reaction,
          config,
          "missing_permission",
          outcome.blocked,
        );
        await this.alertReactionMissingPermission(context, telegramChatId);
      } else {
        // permission_unknown → transient; audit only, never alert "missing".
        await this.auditReaction(
          context,
          reaction,
          config,
          "permission_unknown",
          outcome.blocked,
        );
      }
    }

    if (surging) {
      await this.alertReactionSurge(context, telegramChatId, messageId);
    }
    return null;
  }

  /** Human-readable label for a reaction, for audit payloads. */
  private reactionLabel(reaction: NormalizedReaction): string {
    return reaction.type === "emoji"
      ? reaction.emoji
      : `custom:${reaction.customEmojiId}`;
  }

  /**
   * The reacting ACTOR as the gateway wants it — exactly one of user /
   * actor_chat. Returns undefined when neither or both are present (malformed),
   * so the caller can refuse to fire a destructive, actor-targeted removal.
   */
  private resolveReactionActor(
    reaction: ReactionContext,
  ): TelegramReactionActor | undefined {
    const hasUser = reaction.userId !== undefined;
    const hasChat = reaction.actorChatId !== undefined;
    if (hasUser === hasChat) {
      return undefined;
    }
    if (reaction.userId !== undefined) {
      return { userId: reaction.userId };
    }
    return reaction.actorChatId !== undefined
      ? { actorChatId: reaction.actorChatId }
      : undefined;
  }

  /**
   * The bot's own stable Telegram id: parsed from the current request's token
   * (no network) with a getMe fallback for a malformed/absent token. undefined
   * when even getMe can't tell us — the caller then treats permission as unknown.
   */
  private async resolveBotTelegramId(): Promise<bigint | undefined> {
    const fromToken = this.currentBotTelegramId();
    if (fromToken !== undefined) {
      return fromToken;
    }
    try {
      const me = await this.telegramGateway.getMe({
        token: this.telegramToken(),
      });
      return me.ok ? me.botUserId : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Tri-state `can_delete_messages` for the bot in `telegramChatId`, cached per
   * (botId:chat) with TTL + single-flight so a reaction burst shares one
   * getChatMember. A transient failure resolves to undefined (unknown) and is
   * never cached, so the next reaction re-checks instead of pinning a stale "no".
   */
  private async resolveBotReactionPermission(
    botId: bigint | undefined,
    telegramChatId: bigint,
  ): Promise<boolean | undefined> {
    if (botId === undefined) {
      return undefined;
    }
    return this.reactionPermissionCache.get(
      `${botId}:${telegramChatId}`,
      Date.now(),
      async () => {
        try {
          const member = await this.telegramGateway.getChatMember({
            chatId: telegramChatId,
            userId: botId,
            token: this.telegramToken(),
          });
          return member.ok ? member.canDeleteMessages : undefined;
        } catch {
          // Network/timeout/429-exhausted → unknown, retried next time.
          return undefined;
        }
      },
    );
  }

  /**
   * Records a distinct suspicious reactor on one message and reports whether the
   * count now meets the group's surge threshold within its window. Dedups by
   * actor, so organic popularity never trips it; `off` never records. Pure
   * in-memory, bounded.
   */
  private trackReactionSurge(
    context: FoundationContext,
    config: ReactionModerationConfig,
    telegramChatId: bigint,
    messageId: number,
    actor: TelegramReactionActor,
  ): boolean {
    if (config.mode === "off") {
      return false;
    }
    const key = `${context.tenantId}:${telegramChatId}:${messageId}`;
    const actorKey =
      actor.userId !== undefined
        ? `u:${actor.userId}`
        : `c:${actor.actorChatId}`;
    const now = Date.now();
    this.reactionSurgeStore.record(key, actorKey, now);
    const distinct = this.reactionSurgeStore.distinctSince(
      key,
      now - config.surgeWindowSeconds * 1000,
    );
    return isReactionSurge(distinct, config);
  }

  /**
   * Removes the actor's reaction(s) from the message and audits the result. A
   * 400/403 means our cached permission is stale (rights changed under us): drop
   * the cache entry so the next reaction re-resolves. Any failure is swallowed —
   * moderation must never break the pipeline.
   */
  private async removeReaction(
    context: FoundationContext,
    reaction: ReactionContext,
    config: ReactionModerationConfig,
    actor: TelegramReactionActor,
    blocked: readonly NormalizedReaction[],
    botId: bigint | undefined,
    telegramChatId: bigint,
    messageId: number,
  ): Promise<void> {
    try {
      await this.telegramGateway.deleteMessageReaction({
        chatId: telegramChatId,
        messageId,
        actor,
        token: this.telegramToken(),
      });
      await this.auditReaction(context, reaction, config, "removed", blocked);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const rejected =
        message.includes("status 400") || message.includes("status 403");
      if (rejected && botId !== undefined) {
        this.reactionPermissionCache.invalidate(`${botId}:${telegramChatId}`);
      }
      await this.auditReaction(
        context,
        reaction,
        config,
        rejected ? "remove_rejected" : "remove_failed",
        blocked,
      );
    }
  }

  /**
   * Persists a reaction-moderation decision to the audit log: mode, result,
   * the reacting actor, and the blocked reactions. Best-effort — a logging
   * failure never propagates. No bot token is ever recorded.
   */
  private async auditReaction(
    context: FoundationContext,
    reaction: ReactionContext,
    config: ReactionModerationConfig,
    result: string,
    blocked: readonly NormalizedReaction[],
  ): Promise<void> {
    try {
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "system",
        action: "reaction.moderation",
        resourceType: "message_reaction",
        resourceId: reaction.messageId?.toString() ?? "unknown",
        payload: {
          result,
          mode: config.mode,
          chatId: reaction.chatId?.toString() ?? null,
          actorType:
            reaction.userId !== undefined
              ? "user"
              : reaction.actorChatId !== undefined
                ? "chat"
                : "none",
          actorId:
            (reaction.userId ?? reaction.actorChatId)?.toString() ?? null,
          blocked: blocked.map((entry) => this.reactionLabel(entry)),
        },
      });
    } catch {
      // Auditing is best-effort; never break the pipeline on a log failure.
    }
  }

  /**
   * The bot-identity segment of an alert-gate key. Token-derived (no network),
   * so a parent and a child bot moderating the same chat never share an alert
   * window. "self" only when the token is malformed (dev/tests).
   */
  private botKeyPart(): string {
    return this.currentBotTelegramId()?.toString() ?? "self";
  }

  /**
   * Sends a STAFF alert at most once per window, keyed by tenant+bot+chat, and
   * consumes the gate ONLY on a successful send: if the send throws, the gate is
   * rolled back so a later reaction can retry instead of being silenced for the
   * whole window. Silent (and gate untouched) when no STAFF chat is configured.
   */
  private async sendGatedStaffAlert(
    tenantId: string,
    key: string,
    text: string,
  ): Promise<void> {
    const staffChatId = await this.feedbackRepository.getStaffChat(tenantId);
    if (!staffChatId || staffChatId === 0n) {
      return;
    }
    if (!this.reactionAlertGate.shouldFire(key, Date.now())) {
      return;
    }
    try {
      await this.telegramGateway.sendMessage({
        chatId: staffChatId,
        reply: { text },
        token: this.telegramToken(),
      });
    } catch {
      // The alert never went out — free the gate so a later reaction can retry.
      this.reactionAlertGate.rollback(key);
    }
  }

  /**
   * Warns STAFF that a vetoed reaction couldn't be removed for lack of the
   * delete-messages right (once per window per tenant+bot+chat).
   */
  private async alertReactionMissingPermission(
    context: FoundationContext,
    telegramChatId: bigint,
  ): Promise<void> {
    await this.sendGatedStaffAlert(
      context.tenantId,
      `perm:${context.tenantId}:${this.botKeyPart()}:${telegramChatId}`,
      "⚠️ No pude retirar una reacción vetada: me falta el permiso «Eliminar mensajes» en el grupo. Dámelo, o deja la moderación de reacciones en modo observación.",
    );
  }

  /**
   * Warns STAFF about a suspected reaction brigade on one message (once per
   * window per tenant+bot+chat+message). Advisory only: we never auto-purge —
   * clearing a brigade is the admin-confirmed deleteAllMessageReactions tool.
   */
  private async alertReactionSurge(
    context: FoundationContext,
    telegramChatId: bigint,
    messageId: number,
  ): Promise<void> {
    await this.sendGatedStaffAlert(
      context.tenantId,
      `surge:${context.tenantId}:${this.botKeyPart()}:${telegramChatId}:${messageId}`,
      "🚨 Posible brigada de reacciones: muchas cuentas distintas están reaccionando con emojis vetados sobre un mismo mensaje. Revisadlo; no retiro nada en masa de forma automática.",
    );
  }

  /**
   * The bot's own rights in a chat just changed (`my_chat_member`): drop any
   * cached can_delete_messages verdict for (botId:chat) so the very next
   * reaction re-resolves the real permission instead of trusting a stale one for
   * up to the cache TTL. Side-effect only; never replies.
   */
  private async handleReactionPermissionInvalidation(
    _context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const membership = update.botMembership;
    if (membership?.chatId === undefined) {
      return null;
    }
    const botId = this.currentBotTelegramId();
    if (botId !== undefined) {
      this.reactionPermissionCache.invalidate(`${botId}:${membership.chatId}`);
    }
    return null;
  }

  /**
   * `/schedulerule <inicio> <fin> on|off | list | clear`: opt-in time windows
   * stored per-chat in ChatSetting ("schedule_rules"). A window marked strict
   * turns on the scheduled-strict guard (links from non-admins removed during
   * that window). `list`/no-args shows the windows; set/clear need config
   * permission.
   */
  private async handleScheduledRuleCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.command?.name !== "schedulerule") {
      return null;
    }
    if (!context.chatId) {
      return { text: "Las reglas por horario se configuran en un grupo." };
    }
    const args = update.command?.args ?? [];
    const sub = (args[0] ?? "").toLowerCase();
    const raw = await this.chatSettingRepository.getValue(
      context.tenantId,
      context.chatId,
      "schedule_rules",
    );
    const rules: TimeRule[] = Array.isArray(raw) ? (raw as TimeRule[]) : [];

    if (sub === "" || sub === "list") {
      if (rules.length === 0) {
        return { text: "No hay reglas por horario configuradas." };
      }
      const strictNow = isStrictAtHour(rules, new Date().getUTCHours());
      const lines = rules.map(
        (rule) =>
          `${formatTimeRuleWindow(rule)} · ${rule.strict ? "estricto 🌙" : "normal"}`,
      );
      return {
        text: `🕘 Reglas por horario (UTC):\n${lines.join("\n")}\nAhora mismo: ${strictNow ? "ESTRICTO 🌙" : "normal"}`,
      };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "scheduled-rules.config",
    );
    if (!permission.allowed) {
      return {
        text: "No tienes permisos para configurar reglas por horario.",
      };
    }

    if (sub === "clear") {
      await this.chatSettingRepository.setValue(
        context.tenantId,
        context.chatId,
        "schedule_rules",
        [],
      );
      return { text: "🕘 Reglas por horario borradas." };
    }

    const result = parseScheduledRuleCommand(update);
    if (!result) {
      return null;
    }
    if (!result.ok) {
      return { text: result.error.message };
    }
    const rule: TimeRule = {
      startHour: result.command.startHour,
      endHour: result.command.endHour,
      strict: result.command.strict,
    };
    const next = rules.filter(
      (existing) =>
        existing.startHour !== rule.startHour ||
        existing.endHour !== rule.endHour,
    );
    next.push(rule);
    await this.chatSettingRepository.setValue(
      context.tenantId,
      context.chatId,
      "schedule_rules",
      next,
    );
    return {
      text: `🕘 Ventana ${formatTimeRuleWindow(rule)} → ${rule.strict ? "modo estricto (sin enlaces de no-admins)" : "normal"}.`,
    };
  }

  /**
   * Scheduled strict-mode enforcement (opt-in): during a configured strict
   * window, deletes links posted by non-admins. No-op when no strict window is
   * active, the sender is an admin, or the message has no link — conservative
   * on purpose (only links, nothing else).
   */
  /**
   * `scheduled-strict.ambient`. La regla entera vive en
   * `modules/community` (`aplicarHorarioEstricto`); aqui solo queda traducir
   * el update y darle los puertos.
   *
   * La hora sigue siendo UTC, igual que antes: ver C-24 en
   * `docs/SANEAMIENTO-PROGRESS.md`. Ahora entra por parametro, asi que el dia
   * que se decida respetar la zona del grupo se cambia aqui y en un sitio mas.
   */
  private async handleScheduledStrictMode(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const telegramChatId = update.chat.chatId;
    if (
      update.kind !== "message" ||
      !context.chatId ||
      !telegramChatId ||
      update.messageId === undefined
    ) {
      return null;
    }
    const messageId = update.messageId;

    const aviso = await aplicarHorarioEstricto(
      {
        esComando: Boolean(update.command),
        tieneEnlace: update.content.hasUrl,
      },
      new Date().getUTCHours(),
      {
        reglasDelChat: () =>
          this.chatSettingRepository.getValue(
            context.tenantId,
            context.chatId as string,
            "schedule_rules",
          ),
        esAdministrador: () => this.isActorAdmin(context, update),
        borrarMensaje: async () => {
          await this.telegramGateway.deleteMessage({
            chatId: telegramChatId,
            messageId,
            token: this.telegramToken(),
          });
        },
      },
    );

    return aviso === null ? null : { text: aviso };
  }

  /**
   * Logs soft social-tone signals (passive-aggressive phrasing, manipulation
   * patterns, dramatic exits, remorse level after a warn) for staff visibility
   * without ever deleting or replying: these are ambiguous enough that acting
   * on them automatically would over-moderate real conversations.
   */
  private async handleSocialSignalsAmbient(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.kind !== "message" ||
      update.command ||
      !update.messageText ||
      !context.chatId
    ) {
      return null;
    }

    const text = update.messageText;
    const hits: string[] = [];
    if (detectPassiveAggressive(text).matched) {
      hits.push("pasivo_agresivo");
    }
    if (detectSocialManipulation(text).matched) {
      hits.push("manipulacion_social");
    }
    if (detectDramaticExit(text).matched) {
      hits.push("salida_dramatica");
    }
    const remorse = classifyRemorse(text);
    if (remorse.signal !== "neutro") {
      hits.push(`remordimiento_${remorse.signal}`);
    }

    if (hits.length === 0) {
      return null;
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "system",
      ...(update.user.userId !== undefined
        ? { actorId: update.user.userId.toString() }
        : {}),
      action: "social_signal.detected",
      resourceType: "chat",
      resourceId: context.chatId,
      payload: { hits },
    });

    return null;
  }

  private async handleCharFilterMatch(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.kind !== "message" ||
      update.command ||
      !update.messageText ||
      !context.chatId ||
      !update.chat.chatId ||
      !update.messageId
    ) {
      return null;
    }

    if (await this.isActorAdmin(context, update)) {
      return null;
    }

    const hygiene = await this.groupProtectionRepository.getHygiene(
      context.chatId,
    );

    // El cortocircuito de "los dos filtros apagados" vive dentro de la decision,
    // en `modules/security`: este handler corre sobre cada mensaje del grupo.
    if (
      !debeBorrarPorCaracteres({
        texto: update.messageText,
        filtroRtl: hygiene.rtlFilter,
        filtroCjk: hygiene.cjkFilter,
      })
    ) {
      return null;
    }

    try {
      await this.telegramGateway.deleteMessage({
        chatId: update.chat.chatId,
        messageId: update.messageId,
        token: this.telegramToken(),
      });
    } catch {
      // Non-fatal.
    }

    return null;
  }

  private async handleServiceMessageClean(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (!context.chatId || !update.chat.chatId || !update.messageId) {
      return null;
    }

    if (!isServiceMessage(update.raw)) {
      return null;
    }

    const hygiene = await this.groupProtectionRepository.getHygiene(
      context.chatId,
    );
    if (!hygiene.cleanService) {
      return null;
    }

    try {
      await this.telegramGateway.deleteMessage({
        chatId: update.chat.chatId,
        messageId: update.messageId,
        token: this.telegramToken(),
      });
    } catch {
      // Non-fatal.
    }

    return null;
  }

  private async handleNightMode(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.kind !== "message" ||
      !context.chatId ||
      !update.chat.chatId ||
      !update.messageId
    ) {
      return null;
    }

    if (await this.isActorAdmin(context, update)) {
      return null;
    }

    const hygiene = await this.groupProtectionRepository.getHygiene(
      context.chatId,
    );

    // La hora se lee aqui y se le pasa a la decision, que asi queda pura: la
    // franja que cruza la medianoche se prueba sin esperar a las once.
    if (
      !debeBorrarPorModoNoche({
        modoNocheActivo: hygiene.nightMode,
        hora: new Date().getUTCHours(),
        horaInicio: hygiene.nightStart,
        horaFin: hygiene.nightEnd,
      })
    ) {
      return null;
    }

    try {
      await this.telegramGateway.deleteMessage({
        chatId: update.chat.chatId,
        messageId: update.messageId,
        token: this.telegramToken(),
      });
    } catch {
      // Non-fatal.
    }

    return null;
  }

  private async loadAntifloodSettings(
    context: FoundationContext,
  ): Promise<AntifloodSettings> {
    if (!context.chatId) {
      return defaultAntifloodSettings;
    }

    const stored = await this.antifloodRepository.getConfig(
      context.tenantId,
      context.chatId,
    );

    return stored
      ? { ...defaultAntifloodSettings, ...stored }
      : defaultAntifloodSettings;
  }

  private inlineMiniAppLink(target: string): string {
    if (target === "casino") {
      return `https://t.me/${this.env.TELEGRAM_BOT_USERNAME}/${this.env.TELEGRAM_MINIAPP_NAME}?startapp=casino_inline`;
    }
    if (target === "games") {
      return `https://t.me/${this.env.TELEGRAM_BOT_USERNAME}/${this.env.TELEGRAM_MINIAPP_NAME}?startapp=games`;
    }
    return `https://t.me/${this.env.TELEGRAM_BOT_USERNAME}/${this.env.TELEGRAM_MINIAPP_NAME}?startapp=inline_${target}`;
  }

  private buildPortableGamesMarkup(): Record<string, unknown> {
    // A single button that opens the games Mini App (casino + add-to-group live
    // inside it). URL buttons to a Direct-Link Mini App work in ANY chat (unlike
    // private-only web_app buttons). Kept to one line so the posted inline card
    // never reads as spam.
    return {
      inline_keyboard: [
        [{ text: "🎮 Jugar", url: this.inlineMiniAppLink("games") }],
      ],
    };
  }

  private buildPortableBackMarkup(): Record<string, unknown> {
    return {
      inline_keyboard: [[{ text: "Volver", callback_data: "ig:hub" }]],
    };
  }

  private buildPortableGamesReply(): BotReply {
    // One plain line (inline result content has no parse mode) + one button.
    return {
      text: "🎮 Juega con Modryva — mini-juegos, trivia y casino en la Mini App.",
      replyMarkup: this.buildPortableGamesMarkup(),
      edit: true,
    };
  }

  private buildPortableInstallResult(query: string): InlineResult {
    return {
      id: `install:${query || "empty"}`,
      title: "Instalar Modryva en este grupo",
      description:
        "Moderación, antispam, welcomes y configuración necesitan instalar el bot.",
      content: [
        "Para usar moderación, antispam, warns, bienvenidas o configuración, instala Modryva en el grupo.",
        "",
        "El modo inline sirve para juegos, IA, notas y utilidades portables.",
      ].join("\n"),
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: "Añadir Modryva",
              url: `https://t.me/${this.env.TELEGRAM_BOT_USERNAME}?startgroup=true`,
            },
          ],
          [{ text: "Juegos portable", callback_data: "ig:hub" }],
        ],
      },
    };
  }

  private buildPortableHelpResult(): InlineResult {
    return {
      id: "portable:help",
      title: "Modryva Portable",
      description: "IA, notas, juegos y utilidades sin instalar el bot.",
      content: [
        "Modryva Portable",
        "",
        "Usa @ModryvaBot /jugar para juegos.",
        "Usa @ModryvaBot /ai pregunta para IA.",
        "Para moderación y automatizaciones, instala el bot en el grupo.",
      ].join("\n"),
      replyMarkup: {
        inline_keyboard: [
          [{ text: "Jugar", callback_data: "ig:hub" }],
          [
            {
              text: "Instalar en grupo",
              url: `https://t.me/${this.env.TELEGRAM_BOT_USERNAME}?startgroup=true`,
            },
          ],
        ],
      },
    };
  }

  private buildPortableGamesResult(): InlineResult {
    return {
      id: "portable:games",
      title: "Jugar con Modryva",
      description:
        "Trivia, RPS, dado, casino y Mini App desde cualquier grupo.",
      content: this.buildPortableGamesReply().text,
      replyMarkup: this.buildPortableGamesMarkup(),
    };
  }

  private routePortableInlineQuery(query: string): InlineResult | null {
    const normalized = query.trim().toLowerCase().replace(/^\/+/u, "");
    const command = normalized.split(/\s+/u)[0] ?? "";

    if (
      command === "jugar" ||
      command === "juegos" ||
      command === "games" ||
      command === "casino"
    ) {
      return this.buildPortableGamesResult();
    }

    if (command === "help" || command === "start" || command === "menu") {
      return this.buildPortableHelpResult();
    }

    if (
      command === "config" ||
      command === "settings" ||
      command === "ajustes" ||
      command === "moderacion" ||
      command === "moderation" ||
      command === "warn" ||
      command === "antispam" ||
      command === "welcome" ||
      command === "bienvenida"
    ) {
      return this.buildPortableInstallResult(command);
    }

    return null;
  }

  /**
   * The inert labels on mirrored STAFF reports: the lock carried while a case
   * is open (buildMirrorKeyboard) and the verdict stamped once it closes
   * (markOtherStaffCopiesDecided). Telegram requires callback_data on every
   * inline button, so these exist purely to answer the tap — without it the
   * client spins until the query times out, which reads as a broken button.
   */
  private async handleDecidedLabelCallback(
    _context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const notice =
      update.callbackData === "gv:decided"
        ? "Este caso ya está resuelto."
        : update.callbackData === STAFF_MIRROR_CALLBACK
          ? "Este caso se decide en el grupo principal de staff."
          : null;
    if (notice === null) {
      return null;
    }
    // Answer the query and nothing else: a BotReply would post or edit a
    // message, and neither a closed case nor a mirrored one needs a second
    // announcement in every room the report reached.
    await this.ackCallbackQuery(update.raw, notice);
    return null;
  }

  private async handleInlineGameCallback(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const data = update.callbackData;
    if (!data?.startsWith("ig:")) {
      return null;
    }

    if (data === "ig:hub") {
      return this.buildPortableGamesReply();
    }

    if (data === "ig:rps") {
      return {
        text: "Elige tu jugada:",
        replyMarkup: {
          inline_keyboard: [
            [
              { text: "Piedra", callback_data: "ig:rps:piedra" },
              { text: "Papel", callback_data: "ig:rps:papel" },
              { text: "Tijera", callback_data: "ig:rps:tijera" },
            ],
            [{ text: "Volver", callback_data: "ig:hub" }],
          ],
        },
        edit: true,
      };
    }

    if (data.startsWith("ig:rps:")) {
      const choice = data.slice("ig:rps:".length) as RpsChoice;
      if (choice !== "piedra" && choice !== "papel" && choice !== "tijera") {
        return { text: "Jugada no valida.", edit: true };
      }
      // Unpredictable seed: this inline RPS awards a leaderboard point on a win,
      // and botRpsChoice is a pure LCG of its seed. Seeding from update.updateId +
      // userId (as the stakeless /rps fun command intentionally does for retry
      // idempotency) let a player derive the bot's move from their own inputs and
      // farm the "inline:global" ranking. crypto randomInt removes that.
      const bot = botRpsChoice(randomInt(0x7fff_ffff));
      const outcome = rpsOutcome(choice, bot);
      if (outcome === "win" && update.user.userId) {
        await this.gameRepository.addScore(
          context.tenantId,
          "inline:global",
          update.user.userId,
          1,
        );
      }
      const line =
        outcome === "win"
          ? "Ganaste y sumas 1 punto."
          : outcome === "draw"
            ? "Empate."
            : "Gano Modryva.";
      return {
        text: [
          "RPS portable",
          "",
          `Tu: ${choice}`,
          `Modryva: ${bot}`,
          line,
        ].join("\n"),
        replyMarkup: this.buildPortableBackMarkup(),
        edit: true,
      };
    }

    if (data === "ig:dice") {
      const value = randomInt(1, 7);
      if (value === 6 && update.user.userId) {
        await this.gameRepository.addScore(
          context.tenantId,
          "inline:global",
          update.user.userId,
          1,
        );
      }
      return {
        text: [
          "Dado portable",
          "",
          `Has sacado ${value}.`,
          value === 6 ? "Perfecto: sumas 1 punto." : "Saca 6 para puntuar.",
        ].join("\n"),
        replyMarkup: {
          inline_keyboard: [
            [{ text: "Tirar otra vez", callback_data: "ig:dice" }],
            [{ text: "Volver", callback_data: "ig:hub" }],
          ],
        },
        edit: true,
      };
    }

    if (data === "ig:trivia:start") {
      const index = pickQuestionIndex(
        update.updateId + Number(update.user.userId ?? 0n),
        TRIVIA_QUESTIONS.length,
      );
      const question = TRIVIA_QUESTIONS[index];
      if (!question) {
        return { text: "No hay preguntas disponibles.", edit: true };
      }
      const session = await this.gameRepository.createSession(
        context.tenantId,
        "inline:global",
        "inline_trivia",
        {
          mode: "inline",
          game: "trivia",
          question: question.question,
          options: question.options,
          initiatorUserId: update.user.userId?.toString(),
          inlineMessageId: update.callbackInlineMessageId,
        },
        question.correctIndex,
      );
      return {
        text: `Trivia portable\n\n${question.question}`,
        replyMarkup: {
          inline_keyboard: [
            ...question.options.map((option, optionIndex) => [
              {
                text: option,
                callback_data: `ig:trivia:${session.id}:${optionIndex}`,
              },
            ]),
            [{ text: "Volver", callback_data: "ig:hub" }],
          ],
        },
        edit: true,
      };
    }

    if (data.startsWith("ig:trivia:")) {
      const [, , sessionId, rawIndex] = data.split(":");
      const optionIndex = Number.parseInt(rawIndex ?? "", 10);
      if (!sessionId || !Number.isInteger(optionIndex)) {
        return { text: "Respuesta no valida.", edit: true };
      }
      const session = await this.gameRepository.getSession(sessionId);
      if (session?.status !== "open") {
        return {
          text: "Esta trivia ya no está activa.",
          replyMarkup: this.buildPortableBackMarkup(),
          edit: true,
        };
      }
      if (optionIndex !== session.correctIndex) {
        return {
          text: "Respuesta incorrecta. Sigue intentando.",
          replyMarkup: this.buildPortableBackMarkup(),
          edit: true,
        };
      }
      const won = update.user.userId
        ? await this.gameRepository.closeWithWinner(
            session.id,
            update.user.userId,
          )
        : false;
      if (!won) {
        return {
          text: "Alguien respondio correctamente antes.",
          replyMarkup: this.buildPortableBackMarkup(),
          edit: true,
        };
      }
      if (update.user.userId) {
        await this.gameRepository.addScore(
          context.tenantId,
          "inline:global",
          update.user.userId,
          1,
        );
      }
      return {
        text: [
          "Correcto.",
          "",
          `${update.user.username ? `@${update.user.username}` : "Jugador"} suma 1 punto portable.`,
        ].join("\n"),
        replyMarkup: this.buildPortableBackMarkup(),
        edit: true,
      };
    }

    if (data === "ig:top") {
      const top = await this.gameRepository.topScores("inline:global", 10);
      return {
        text:
          top.length === 0
            ? "Ranking portable global\n\nAún no hay puntos."
            : [
                "Ranking portable global",
                "",
                ...top.map((entry, index) => {
                  const name =
                    entry.name ?? `Usuario ${entry.telegramUserId.toString()}`;
                  return `${index + 1}. ${name} - ${entry.points}`;
                }),
              ].join("\n"),
        replyMarkup: this.buildPortableBackMarkup(),
        edit: true,
      };
    }

    return {
      text: "Acción portable no disponible.",
      replyMarkup: this.buildPortableBackMarkup(),
      edit: true,
    };
  }

  /**
   * Inline Mode (`@bot ...`) is how users can ask from chats where Modryva is
   * not a member. Empty/too-short queries stay free; real questions get one AI
   * answer as a selectable inline article.
   */
  private async handleInlineQuery(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<void> {
    const inline = update.inlineQuery;

    if (!inline) {
      return;
    }

    const query = inline.query.trim();
    const minChars = this.env.AI_INLINE_MIN_QUERY_CHARS;
    let results: InlineResult[] = [];
    let answeredBy = "help";
    const portableResult = this.routePortableInlineQuery(query);
    const aiCommandMatch = /^\/?ai(?:\s+(.+))?$/iu.exec(query);
    const forcedAiQuery = aiCommandMatch?.[1]?.trim();

    if (portableResult) {
      results = [portableResult];
      answeredBy = "portable";
    }

    if (results.length === 0 && query.length >= minChars && !aiCommandMatch) {
      results = buildInlineResults(
        await this.notesRepository.searchNotes(context.tenantId, query),
        query,
      );
      answeredBy = results.length > 0 ? "notes" : answeredBy;
    }

    // Real AI via inline is a paid perk (AI pack): requires a longer query so
    // it doesn't fire on every single keystroke, AND the chat/user must
    // already have AI access (code, group subscription, or personal pack).
    const MIN_AI_INLINE_CHARS = 12;
    const aiQuery = forcedAiQuery ?? query;
    const inlineAiEligible =
      results.length === 0 &&
      aiQuery.length >= MIN_AI_INLINE_CHARS &&
      this.env.AI_ENABLED &&
      ((update.chat.chatId &&
        (await this.aiAccessRepository.hasAccess(update.chat.chatId))) ||
        (update.user.userId &&
          (await this.aiAccessRepository.hasUserAccess(update.user.userId))));

    if (inlineAiEligible) {
      const sanitized = sanitizeAiInput(
        truncateDmInput(aiQuery, this.env.AI_MAX_INPUT_CHARS),
        this.env.AI_MAX_INPUT_CHARS,
        this.env.AI_PRIVACY_MODE,
      );
      if (!sanitized.flagged) {
        try {
          const messages = buildAiMessages(
            { kind: "chat", prompt: sanitized.text },
            [],
            { isCreator: update.user.userId === CREATOR_TELEGRAM_ID },
          );
          this.addAiMemoryHint(
            messages,
            await this.buildAiMemoryHint(context, update),
          );
          const completion = await this.aiProvider.complete(messages, {
            task: "fast_chat",
            // Variety over determinism — see the other fast_chat calls.
            temperature: 0.85,
            maxTokens: Math.min(this.env.AI_MAX_TOKENS_PER_REQUEST, 512),
            ...(update.user.userId
              ? { userId: update.user.userId.toString() }
              : {}),
            tenantId: context.tenantId,
          });
          results = [
            {
              id: `ai:${inline.id}`,
              title: `Modryva IA: ${aiQuery}`,
              content: completion.text,
            },
          ];
          answeredBy = "ai";
          await this.rememberAiFacts(context, update, sanitized.text);
        } catch {
          results = [buildInlineHelpResult(query)];
        }
      }
    }

    if (results.length === 0) {
      results = [buildInlineHelpResult(query)];
    }

    try {
      await this.telegramGateway.answerInlineQuery({
        inlineQueryId: inline.id,
        results,
        cacheTime:
          answeredBy === "ai" ? 0 : this.env.AI_INLINE_CACHE_TTL_SECONDS,
        token: this.telegramToken(),
      });
    } catch {
      // Inline answer failures are surfaced via audit only.
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: update.user.userId ? "user" : "system",
      action: "inline.answered",
      resourceType: "inline_query",
      resourceId: inline.id,
      payload: { query: inline.query, results: results.length, answeredBy },
    });
  }

  /**
   * Guest Chat Mode delivers a message the user already sent in full, so unlike
   * Inline Mode it MAY call the AI provider. Always answers through
   * answerGuestQuery (never sendMessage) and never returns a reply, so the
   * caller (processWebhookScoped) stops the pipeline right after this runs.
   */
  private async handleGuestMessage(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<void> {
    if (!update.guestMessage || !update.messageText?.trim()) {
      return;
    }

    if (!this.env.AI_ENABLED) {
      await this.telegramGateway.answerGuestQuery({
        guestQueryId: update.guestMessage.queryId,
        text: "La IA está desactivada ahora mismo.",
        token: this.telegramToken(),
      });
      return;
    }

    const guestChatId = update.chat.chatId;
    const [guestChatAccess, guestUserAccess] = await Promise.all([
      guestChatId ? this.aiAccessRepository.hasAccess(guestChatId) : false,
      update.user.userId
        ? this.aiAccessRepository.hasUserAccess(update.user.userId)
        : false,
    ]);
    if (!guestChatId || !(guestChatAccess || guestUserAccess)) {
      await this.telegramGateway.answerGuestQuery({
        guestQueryId: update.guestMessage.queryId,
        text: "Este chat no tiene acceso a la IA todavía. Pide un código al creador del bot.",
        token: this.telegramToken(),
      });
      return;
    }

    const sanitized = sanitizeAiInput(
      truncateDmInput(update.messageText, this.env.AI_MAX_INPUT_CHARS),
      this.env.AI_MAX_INPUT_CHARS,
      this.env.AI_PRIVACY_MODE,
    );

    if (sanitized.flagged) {
      await this.telegramGateway.answerGuestQuery({
        guestQueryId: update.guestMessage.queryId,
        text: "No puedo ayudar a revelar prompts, claves o secretos.",
        token: this.telegramToken(),
      });
      return;
    }

    let text = "";
    try {
      const messages = buildAiMessages(
        { kind: "chat", prompt: sanitized.text },
        [],
        { isCreator: update.user.userId === CREATOR_TELEGRAM_ID },
      );
      this.addAiMemoryHint(
        messages,
        await this.buildAiMemoryHint(context, update),
      );
      const completion = await this.aiProvider.complete(messages, {
        task: "fast_chat",
        // Conversational replies want variety, not the deterministic 0.3
        // default — at low temp the 8b model parrots its own prompt examples
        // verbatim (same defense line every time). Matches the /ai command.
        temperature: 0.85,
        maxTokens: Math.min(this.env.AI_MAX_TOKENS_PER_REQUEST, 512),
        ...(update.user.userId
          ? { userId: update.user.userId.toString() }
          : {}),
        ...(context.chatId ? { chatId: context.chatId } : {}),
        tenantId: context.tenantId,
      });
      text = completion.text;
      await this.rememberAiFacts(context, update, sanitized.text);
    } catch {
      text = "La IA no está disponible ahora mismo. Prueba otra vez más tarde.";
    }

    await this.telegramGateway.answerGuestQuery({
      guestQueryId: update.guestMessage.queryId,
      text,
      token: this.telegramToken(),
    });

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: update.user.userId ? "user" : "system",
      action: "ai.guest_answered",
      resourceType: "ai",
      resourceId: update.guestMessage.queryId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { provider: "guest_message" },
    });
  }

  private async handleCustomCommandConfig(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseCustomCommandConfig(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "Los comandos personalizados se gestionan en un grupo." };
    }

    const command = result.command;

    if (command.kind === "list") {
      const commands = await this.customCommandRepository.list(context.chatId);
      if (commands.length === 0) {
        return {
          text: "No hay comandos personalizados. Usa /addcmd <nombre> <respuesta>.",
        };
      }
      const lines = commands.map((entry) => `/${entry.name}`);
      return { text: `Comandos personalizados:\n${lines.join(", ")}` };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "customcmd.config",
    );
    if (!permission.allowed) {
      return {
        text: `No tienes permisos para gestionar comandos.`,
      };
    }

    if (command.kind === "remove") {
      const removed = await this.customCommandRepository.remove(
        context.chatId,
        command.name,
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "customcmd.removed",
        resourceType: "custom_command",
        resourceId: command.name,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { removed },
      });
      return {
        text: removed
          ? `Comando /${command.name} eliminado.`
          : `No existe /${command.name}.`,
      };
    }

    await this.customCommandRepository.upsert(
      context.tenantId,
      context.chatId,
      command.name,
      command.response,
      context.userId,
    );
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "customcmd.saved",
      resourceType: "custom_command",
      resourceId: command.name,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { name: command.name },
    });
    return { text: `Comando /${command.name} guardado.` };
  }

  private async handleCustomCommandDispatch(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const name = update.command?.name;

    if (!name || !context.chatId) {
      return null;
    }

    const command = await this.customCommandRepository.get(
      context.chatId,
      name,
    );

    if (!command) {
      return null;
    }

    return { text: command.response };
  }

  private async handleCommandAliasCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseAliasCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.message };
    }

    if (!context.chatId) {
      return { text: "Los alias de comandos se gestionan en un grupo." };
    }

    const command = result.command;
    const raw = await this.chatSettingRepository.getValue(
      context.tenantId,
      context.chatId,
      "command_alias",
    );
    const aliases: Record<string, string> =
      raw && typeof raw === "object" ? (raw as Record<string, string>) : {};

    if (command.kind === "list") {
      const entries = Object.entries(aliases);
      if (entries.length === 0) {
        return {
          text: "No hay alias configurados. Usa /alias set <alias> <comando>.",
        };
      }
      const lines = entries.map(([alias, target]) => `${alias} -> /${target}`);
      return { text: `Alias configurados:\n${lines.join("\n")}` };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "alias.config",
    );
    if (!permission.allowed) {
      return { text: "No tienes permisos para gestionar alias." };
    }

    if (command.kind === "remove") {
      const existed = command.alias in aliases;
      if (existed) {
        const next = { ...aliases };
        delete next[command.alias];
        await this.chatSettingRepository.setValue(
          context.tenantId,
          context.chatId,
          "command_alias",
          next,
        );
      }
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "command_alias.removed",
        resourceType: "chat_setting",
        resourceId: command.alias,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { removed: existed },
      });
      return {
        text: existed
          ? `Alias "${command.alias}" eliminado.`
          : `No existe el alias "${command.alias}".`,
      };
    }

    const next = { ...aliases, [command.alias]: command.command };
    await this.chatSettingRepository.setValue(
      context.tenantId,
      context.chatId,
      "command_alias",
      next,
    );
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "command_alias.saved",
      resourceType: "chat_setting",
      resourceId: command.alias,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { alias: command.alias, command: command.command },
    });
    return {
      text: `Alias "${command.alias}" -> /${command.command} guardado.`,
    };
  }

  private async handleGlossaryCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseGlossaryCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "El glosario se gestiona en un grupo." };
    }

    const command = result.command;
    const raw = await this.chatSettingRepository.getValue(
      context.tenantId,
      context.chatId,
      "group_glossary",
    );
    const glossary: Record<string, string> =
      raw && typeof raw === "object" ? (raw as Record<string, string>) : {};

    if (command.kind === "list") {
      const entries = Object.entries(glossary);
      if (entries.length === 0) {
        return {
          text: "El glosario está vacío. Usa /glosario set <término> <significado>.",
        };
      }
      const lines = entries.map(([term, meaning]) => `${term}: ${meaning}`);
      return { text: `Glosario del grupo:\n${lines.join("\n")}` };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "glossary.config",
    );
    if (!permission.allowed) {
      return { text: "No tienes permisos para gestionar el glosario." };
    }

    if (command.kind === "remove") {
      const existed = command.term in glossary;
      if (existed) {
        const next = { ...glossary };
        delete next[command.term];
        await this.chatSettingRepository.setValue(
          context.tenantId,
          context.chatId,
          "group_glossary",
          next,
        );
      }
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "group_glossary.removed",
        resourceType: "chat_setting",
        resourceId: command.term,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { removed: existed },
      });
      return {
        text: existed
          ? `Término "${command.term}" eliminado del glosario.`
          : `No existe el término "${command.term}".`,
      };
    }

    const next = { ...glossary, [command.term]: command.meaning };
    await this.chatSettingRepository.setValue(
      context.tenantId,
      context.chatId,
      "group_glossary",
      next,
    );
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "group_glossary.saved",
      resourceType: "chat_setting",
      resourceId: command.term,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { term: command.term },
    });
    return { text: `Término "${command.term}" guardado en el glosario.` };
  }

  private async handleBotVoiceCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseVoiceCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "El tono del bot se configura en un grupo." };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "bot-voice.config",
    );
    if (!permission.allowed) {
      return { text: "No tienes permisos para cambiar el tono del bot." };
    }

    const voice = result.command.voice;
    await this.chatSettingRepository.setValue(
      context.tenantId,
      context.chatId,
      "bot_voice",
      voice,
    );
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "bot_voice.saved",
      resourceType: "chat_setting",
      resourceId: context.chatId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { voice },
    });
    return {
      text: applyBotVoice(`Tono del bot ajustado a "${voice}".`, voice),
    };
  }

  /**
   * `/turno set|clear|list`: staff guard shifts stored per-chat in the generic
   * ChatSetting store (key "staff_shifts"). `list` also reports who is on duty
   * at the current UTC hour. `set`/`clear` require config permission.
   */
  private async handleShiftCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseShiftCommand(update);
    if (!result) {
      return null;
    }
    if (!result.ok) {
      return { text: result.error.usage };
    }
    if (!context.chatId) {
      return { text: "Los turnos de guardia se configuran en un grupo." };
    }

    const raw = await this.chatSettingRepository.getValue(
      context.tenantId,
      context.chatId,
      "staff_shifts",
    );
    const shifts: Shift[] = Array.isArray(raw) ? (raw as Shift[]) : [];
    const command = result.command;
    const fmtHour = (hour: number): string =>
      `${String(hour).padStart(2, "0")}:00`;

    if (command.kind === "list") {
      const hour = new Date().getUTCHours();
      const configured =
        shifts.length === 0
          ? "No hay turnos de guardia configurados."
          : shifts
              .map(
                (shift) =>
                  `${shift.staffId}: ${fmtHour(shift.startHour)}-${fmtHour(shift.endHour)}`,
              )
              .join("\n");
      const onDuty = buildOnDutyReply(onDutyStaff(shifts, hour), hour);
      return { text: `${configured}\n${onDuty} (UTC)` };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "staff-shift.config",
    );
    if (!permission.allowed) {
      return { text: "No tienes permisos para configurar turnos de guardia." };
    }

    const others = shifts.filter((shift) => shift.staffId !== command.staffId);

    if (command.kind === "set") {
      others.push({
        staffId: command.staffId,
        startHour: command.startHour,
        endHour: command.endHour,
      });
      await this.chatSettingRepository.setValue(
        context.tenantId,
        context.chatId,
        "staff_shifts",
        others,
      );
      return {
        text: `🛡️ Turno de ${command.staffId} guardado: ${fmtHour(command.startHour)}-${fmtHour(command.endHour)}.`,
      };
    }

    await this.chatSettingRepository.setValue(
      context.tenantId,
      context.chatId,
      "staff_shifts",
      others,
    );
    return {
      text:
        others.length === shifts.length
          ? `No había ningún turno de ${command.staffId}.`
          : `🛡️ Turno de ${command.staffId} eliminado.`,
    };
  }

  /**
   * `/ritual add|list|remove`: recurring weekly rituals (weekday + hour +
   * message) stored per-chat in the generic ChatSetting store (key "rituals").
   * `list` also flags which rituals fall on the current UTC weekday/hour.
   * `add`/`remove` require config permission.
   */
  private async handleRitualCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseRitualCommand(update);
    if (!result) {
      return null;
    }
    if (!result.ok) {
      return { text: result.error.usage };
    }
    if (!context.chatId) {
      return { text: "Los rituales se configuran en un grupo." };
    }

    const raw = await this.chatSettingRepository.getValue(
      context.tenantId,
      context.chatId,
      "rituals",
    );
    const rituals: Ritual[] = Array.isArray(raw) ? (raw as Ritual[]) : [];
    const command = result.command;

    if (command.kind === "list") {
      if (rituals.length === 0) {
        return { text: "No hay rituales configurados." };
      }
      const now = new Date();
      const due = dueRituals(rituals, now.getUTCDay(), now.getUTCHours());
      const lines = rituals.map((ritual) => formatRitual(ritual));
      const footer =
        due.length > 0
          ? `\n⏰ Ahora toca: ${due.map((ritual) => ritual.message).join(", ")}`
          : "";
      return { text: `🔁 Rituales:\n${lines.join("\n")}${footer}` };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "rituals.config",
    );
    if (!permission.allowed) {
      return { text: "No tienes permisos para configurar rituales." };
    }

    if (command.kind === "add") {
      const next = rituals.filter(
        (ritual) =>
          ritual.weekday !== command.ritual.weekday ||
          ritual.hour !== command.ritual.hour,
      );
      next.push(command.ritual);
      await this.chatSettingRepository.setValue(
        context.tenantId,
        context.chatId,
        "rituals",
        next,
      );
      return { text: `🔁 Ritual guardado: ${formatRitual(command.ritual)}` };
    }

    const next = rituals.filter(
      (ritual) =>
        ritual.weekday !== command.weekday || ritual.hour !== command.hour,
    );
    await this.chatSettingRepository.setValue(
      context.tenantId,
      context.chatId,
      "rituals",
      next,
    );
    return {
      text:
        next.length === rituals.length
          ? "No había ningún ritual a esa hora."
          : "🔁 Ritual eliminado.",
    };
  }

  private async handleModuleRenameCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.command?.name !== "nombres") {
      return null;
    }

    if (!context.chatId) {
      return { text: "Los nombres de los módulos se configuran en un grupo." };
    }

    const args = update.command?.args ?? [];
    const sub = (args[0] ?? "").toLowerCase();

    const raw = await this.chatSettingRepository.getValue(
      context.tenantId,
      context.chatId,
      "module_names",
    );
    const overrides: Record<string, string> =
      raw && typeof raw === "object" ? (raw as Record<string, string>) : {};

    if (sub === "" || sub === "list") {
      const lines = Object.keys(DEFAULT_MODULE_NAMES).map(
        (key) => `${key}: ${resolveModuleName(key, overrides)}`,
      );
      return { text: `Nombres de módulos:\n${lines.join("\n")}` };
    }

    if (sub !== "set" && sub !== "reset") {
      return {
        text: "Uso: /nombres list | set <módulo> <nombre> | reset <módulo>",
      };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "module-rename.config",
    );
    if (!permission.allowed) {
      return { text: "No tienes permisos para renombrar módulos." };
    }

    const key = (args[1] ?? "").toLowerCase();
    if (!key || !(key in DEFAULT_MODULE_NAMES)) {
      return {
        text: `Módulo desconocido. Usa uno de: ${Object.keys(DEFAULT_MODULE_NAMES).join(", ")}.`,
      };
    }

    if (sub === "reset") {
      const next = { ...overrides };
      delete next[key];
      await this.chatSettingRepository.setValue(
        context.tenantId,
        context.chatId,
        "module_names",
        next,
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "module_rename.reset",
        resourceType: "chat_setting",
        resourceId: key,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { key },
      });
      return {
        text: `"${key}" vuelve a llamarse "${resolveModuleName(key, next)}".`,
      };
    }

    const desired = sanitizeModuleName(args.slice(2).join(" "));
    if (!desired) {
      return {
        text: "Indica un nombre válido, p. ej. /nombres set inbox Mesa de staff",
      };
    }

    const next = { ...overrides, [key]: desired };
    await this.chatSettingRepository.setValue(
      context.tenantId,
      context.chatId,
      "module_names",
      next,
    );
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "module_rename.saved",
      resourceType: "chat_setting",
      resourceId: key,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { key, name: desired },
    });
    return {
      text: `"${key}" ahora se llama "${resolveModuleName(key, next)}".`,
    };
  }

  private async handleDockCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.command?.name !== "dock") {
      return null;
    }

    if (!context.chatId) {
      return { text: "El dock se configura dentro de un grupo." };
    }

    const args = update.command?.args ?? [];
    const sub = (args[0] ?? "").toLowerCase();

    const raw = await this.chatSettingRepository.getValue(
      context.tenantId,
      context.chatId,
      "dock_order",
    );
    const overrides = Array.isArray(raw)
      ? raw.filter((id): id is string => typeof id === "string")
      : [];
    const current = resolveDock(overrides, DEFAULT_DOCK);

    if (sub === "" || sub === "list") {
      return { text: `Dock actual: ${current.join(" -> ")}` };
    }

    if (sub !== "toggle" && sub !== "reset") {
      return { text: "Uso: /dock list | toggle <acceso> | reset" };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "dock.config",
    );
    if (!permission.allowed) {
      return { text: "No tienes permisos para configurar el dock." };
    }

    if (sub === "reset") {
      await this.chatSettingRepository.setValue(
        context.tenantId,
        context.chatId,
        "dock_order",
        [],
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "dock.reset",
        resourceType: "chat_setting",
        resourceId: context.chatId,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: {},
      });
      return { text: `Dock restablecido: ${DEFAULT_DOCK.join(" -> ")}` };
    }

    const id = (args[1] ?? "").toLowerCase();
    if (!DEFAULT_DOCK.includes(id)) {
      return {
        text: `Acceso desconocido. Usa uno de: ${DEFAULT_DOCK.join(", ")}.`,
      };
    }

    const next = toggleFavorite(current, id, DEFAULT_DOCK.length);
    await this.chatSettingRepository.setValue(
      context.tenantId,
      context.chatId,
      "dock_order",
      next,
    );
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "dock.toggled",
      resourceType: "chat_setting",
      resourceId: id,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { id, dock: next },
    });
    return {
      text: `Dock actualizado: ${next.length > 0 ? next.join(" -> ") : "(vacío)"}`,
    };
  }

  private async handleDensityModeCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.command?.name !== "densidad") {
      return null;
    }

    if (!context.chatId) {
      return { text: "El modo de densidad se ajusta dentro de un grupo." };
    }

    const telegramUserId = update.user.userId;
    if (!telegramUserId) {
      return { text: "No se pudo identificar al usuario." };
    }
    const userKey = telegramUserId.toString();

    const raw = await this.chatSettingRepository.getValue(
      context.tenantId,
      context.chatId,
      "density_mode",
    );
    const modesByUser: Record<string, string> =
      raw && typeof raw === "object" ? (raw as Record<string, string>) : {};

    const requested = (update.command?.args?.[0] ?? "").toLowerCase();

    if (!requested) {
      const currentMode = modesByUser[userKey] ?? "normal";
      const settings = resolveDensity(currentMode);
      return {
        text: `Tu modo de densidad: ${currentMode} (filas: ${settings.rowsPerScreen}, blur: ${settings.blur ? "sí" : "no"}, animaciones: ${settings.animations ? "sí" : "no"}, imágenes: ${settings.images ? "sí" : "no"}). Usa /densidad <${DENSITY_MODES.join("|")}> para cambiarlo.`,
      };
    }

    if (!isDensityMode(requested)) {
      return {
        text: `Modo inválido. Usa uno de: ${DENSITY_MODES.join(", ")}.`,
      };
    }

    const next = { ...modesByUser, [userKey]: requested };
    await this.chatSettingRepository.setValue(
      context.tenantId,
      context.chatId,
      "density_mode",
      next,
    );
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "density_mode.saved",
      resourceType: "chat_setting",
      resourceId: userKey,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { mode: requested },
    });
    const settings = resolveDensity(requested);
    return {
      text: `Modo de densidad ajustado a "${requested}" (filas: ${settings.rowsPerScreen}).`,
    };
  }

  private async handleInterestTagsCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseInterestCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.message };
    }

    if (!context.chatId) {
      return { text: "Los intereses se gestionan dentro de un grupo." };
    }

    const telegramUserId = update.user.userId;
    if (!telegramUserId) {
      return { text: "No se pudo identificar al usuario." };
    }
    const userKey = telegramUserId.toString();

    const raw = await this.chatSettingRepository.getValue(
      context.tenantId,
      context.chatId,
      "interest_tags",
    );
    const tagsByUser: Record<string, readonly string[]> =
      raw && typeof raw === "object"
        ? (raw as Record<string, readonly string[]>)
        : {};

    const command = result.command;

    if (command.kind === "list") {
      const mine = tagsByUser[userKey] ?? [];
      if (mine.length === 0) {
        return {
          text: "No tienes intereses guardados. Usa /intereses add <interes>.",
        };
      }

      const others = Object.entries(tagsByUser)
        .filter(([id]) => id !== userKey)
        .map(([otherId, tags]) => ({ userId: otherId, tags: [...tags] }));
      const matches = matchByInterest(mine, others).slice(0, 3);

      const lines = [`Tus intereses: ${mine.join(", ")}`];
      if (matches.length > 0) {
        const ids = matches.map((match) => BigInt(match.userId));
        const names =
          await this.repository.findDisplayNamesByTelegramUserIds(ids);
        const matchLines = matches.map((match) => {
          const label = names.get(match.userId) ?? `usuario ${match.userId}`;
          return `${label} (${match.shared} en común)`;
        });
        lines.push("Con intereses en común:", ...matchLines);
      }
      return { text: lines.join("\n") };
    }

    const current = tagsByUser[userKey] ?? [];

    if (command.kind === "remove") {
      const existed = current.includes(command.tag);
      const nextMap = {
        ...tagsByUser,
        [userKey]: current.filter((tag) => tag !== command.tag),
      };
      await this.chatSettingRepository.setValue(
        context.tenantId,
        context.chatId,
        "interest_tags",
        nextMap,
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "interest_tags.removed",
        resourceType: "chat_setting",
        resourceId: command.tag,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { removed: existed },
      });
      return {
        text: existed
          ? `Interés "${command.tag}" eliminado.`
          : `No tenías el interés "${command.tag}".`,
      };
    }

    if (current.includes(command.tag)) {
      return { text: `Ya tienes el interés "${command.tag}".` };
    }

    const nextMap = { ...tagsByUser, [userKey]: [...current, command.tag] };
    await this.chatSettingRepository.setValue(
      context.tenantId,
      context.chatId,
      "interest_tags",
      nextMap,
    );
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "interest_tags.added",
      resourceType: "chat_setting",
      resourceId: command.tag,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { tag: command.tag },
    });
    return { text: `Interés "${command.tag}" guardado.` };
  }

  /**
   * Lets group owners propose and vote on which module should be built next.
   * Storage: a `VotedIdea[]` array under the `idea_bank` chat setting key.
   * `list` is open to everyone; `add`/`vote`/`reset` require config
   * permission since this is a roadmap tool, not a public poll.
   */
  private async handleIdeaVotingCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.command?.name !== "ideas") {
      return null;
    }

    if (!context.chatId) {
      return { text: "Las ideas se votan dentro de un grupo." };
    }

    const args = update.command?.args ?? [];
    const sub = (args[0] ?? "list").toLowerCase();

    const raw = await this.chatSettingRepository.getValue(
      context.tenantId,
      context.chatId,
      "idea_bank",
    );
    const ideas: VotedIdea[] = Array.isArray(raw) ? (raw as VotedIdea[]) : [];

    if (sub === "list" || sub === "") {
      if (ideas.length === 0) {
        return {
          text: "Todavía no hay ideas propuestas. Usa /ideas add <título>.",
        };
      }
      const ranked = rankVotedIdeas(ideas);
      const lines = ranked.map(
        (idea) =>
          `${idea.rank}. [${idea.id}] ${idea.title} (${idea.votes} votos)`,
      );
      return { text: `Ideas votadas:\n${lines.join("\n")}` };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "idea-voting.config",
    );
    if (!permission.allowed) {
      return { text: "No tienes permisos para gestionar las ideas." };
    }

    if (sub === "add") {
      const title = args.slice(1).join(" ").trim();
      if (!title) {
        return { text: "Uso: /ideas add <título>" };
      }
      const id = String(ideas.length + 1);
      const next = [...ideas, { id, title, votes: 0 }];
      await this.chatSettingRepository.setValue(
        context.tenantId,
        context.chatId,
        "idea_bank",
        next,
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "idea_voting.added",
        resourceType: "chat_setting",
        resourceId: id,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { title },
      });
      return { text: `Idea "${title}" añadida con id ${id}.` };
    }

    if (sub === "vote") {
      const id = args[1];
      const idea = ideas.find((candidate) => candidate.id === id);
      if (!id || !idea) {
        return {
          text: "Uso: /ideas vote <id> (usa /ideas list para ver los ids)",
        };
      }
      const next = ideas.map((candidate) =>
        candidate.id === id
          ? { ...candidate, votes: candidate.votes + 1 }
          : candidate,
      );
      await this.chatSettingRepository.setValue(
        context.tenantId,
        context.chatId,
        "idea_bank",
        next,
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "idea_voting.voted",
        resourceType: "chat_setting",
        resourceId: id,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { id },
      });
      return { text: `Voto registrado para "${idea.title}".` };
    }

    if (sub === "reset") {
      await this.chatSettingRepository.setValue(
        context.tenantId,
        context.chatId,
        "idea_bank",
        [],
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "idea_voting.reset",
        resourceType: "chat_setting",
        resourceId: context.chatId,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: {},
      });
      return { text: "Banco de ideas reiniciado." };
    }

    return { text: "Uso: /ideas [list|add <título>|vote <id>|reset]" };
  }

  /**
   * Treasure-hunt clue game. Storage: `{ answers, stepIndex }` under the
   * `scavenger_hunt` chat setting key. Anyone can check status or answer;
   * starting/resetting the hunt requires config permission.
   */
  private async handleScavengerHuntCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.command?.name !== "caza") {
      return null;
    }

    if (!context.chatId) {
      return { text: "La caza del tesoro se juega dentro de un grupo." };
    }

    const args = update.command?.args ?? [];
    const sub = (args[0] ?? "estado").toLowerCase();

    const raw = await this.chatSettingRepository.getValue(
      context.tenantId,
      context.chatId,
      "scavenger_hunt",
    );
    const store: { answers: readonly string[]; stepIndex: number } =
      raw && typeof raw === "object"
        ? (raw as { answers: readonly string[]; stepIndex: number })
        : { answers: [], stepIndex: 0 };

    if (sub === "estado" || sub === "") {
      if (store.answers.length === 0) {
        return {
          text: "No hay ninguna caza en curso. Usa /caza start <pista1>|<pista2>|...",
        };
      }
      const state: HuntState = {
        stepIndex: store.stepIndex,
        total: store.answers.length,
      };
      const progress = huntProgress(state);
      const finished = store.stepIndex >= store.answers.length;
      return {
        text: finished
          ? `🏁 Caza terminada (${store.answers.length}/${store.answers.length}).`
          : `🔎 Paso ${store.stepIndex + 1}/${store.answers.length} (${Math.round(progress * 100)}%). Usa /caza responder <texto>.`,
      };
    }

    if (sub === "responder") {
      const answer = args.slice(1).join(" ").trim();
      if (!answer) {
        return { text: "Uso: /caza responder <texto>" };
      }
      if (store.answers.length === 0) {
        return { text: "No hay ninguna caza en curso." };
      }
      if (store.stepIndex >= store.answers.length) {
        return { text: "🏁 La caza ya terminó." };
      }
      const expected = store.answers[store.stepIndex] ?? "";
      if (!checkHuntClue(answer, expected)) {
        return { text: "❌ Respuesta incorrecta." };
      }
      const { state: nextState, finished } = advanceHunt({
        stepIndex: store.stepIndex,
        total: store.answers.length,
      });
      await this.chatSettingRepository.setValue(
        context.tenantId,
        context.chatId,
        "scavenger_hunt",
        { answers: store.answers, stepIndex: nextState.stepIndex },
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "scavenger_hunt.advanced",
        resourceType: "chat_setting",
        resourceId: context.chatId,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { stepIndex: nextState.stepIndex },
      });
      return {
        text: finished
          ? "🏁 ¡Correcto! Caza completada."
          : `✅ Correcto. Paso ${nextState.stepIndex + 1}/${store.answers.length}.`,
      };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "scavenger-hunt.config",
    );
    if (!permission.allowed) {
      return { text: "No tienes permisos para configurar la caza." };
    }

    if (sub === "start") {
      const clues = args
        .slice(1)
        .join(" ")
        .split("|")
        .map((clue) => clue.trim())
        .filter(Boolean);
      if (clues.length === 0) {
        return { text: "Uso: /caza start <pista1>|<pista2>|..." };
      }
      await this.chatSettingRepository.setValue(
        context.tenantId,
        context.chatId,
        "scavenger_hunt",
        { answers: clues, stepIndex: 0 },
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "scavenger_hunt.started",
        resourceType: "chat_setting",
        resourceId: context.chatId,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { total: clues.length },
      });
      return { text: `🗺️ Caza iniciada con ${clues.length} pistas.` };
    }

    if (sub === "reset") {
      await this.chatSettingRepository.setValue(
        context.tenantId,
        context.chatId,
        "scavenger_hunt",
        { answers: [], stepIndex: 0 },
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "scavenger_hunt.reset",
        resourceType: "chat_setting",
        resourceId: context.chatId,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: {},
      });
      return { text: "Caza reiniciada." };
    }

    return {
      text: "Uso: /caza [estado|start <pistas>|responder <texto>|reset]",
    };
  }

  /**
   * Season scrapbook of achievements/events/moments. Storage: a bounded
   * `SeasonAlbumEntry[]` array (last 500) under the `season_album` chat
   * setting key. `list` is open; `add`/`reset` require config permission so
   * the album stays curated.
   */
  private async handleSeasonAlbumCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.command?.name !== "album") {
      return null;
    }

    if (!context.chatId) {
      return { text: "El álbum de temporada vive dentro de un grupo." };
    }

    const args = update.command?.args ?? [];
    const sub = (args[0] ?? "list").toLowerCase();

    const raw = await this.chatSettingRepository.getValue(
      context.tenantId,
      context.chatId,
      "season_album",
    );
    const entries: SeasonAlbumEntry[] = Array.isArray(raw)
      ? (raw as SeasonAlbumEntry[])
      : [];

    if (sub === "list" || sub === "") {
      const summary = buildSeasonAlbum(entries);
      if (summary.total === 0) {
        return {
          text: "El álbum de temporada está vacío. Usa /album add <tipo> <título>.",
        };
      }
      const lines = summary.byKind.map(
        (tally) => `${tally.kind}: ${tally.count}`,
      );
      return {
        text: `📔 Álbum: ${summary.total} entradas\n${lines.join("\n")}`,
      };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "season-album.config",
    );
    if (!permission.allowed) {
      return { text: "No tienes permisos para editar el álbum." };
    }

    if (sub === "add") {
      const kind = args[1];
      const title = args.slice(2).join(" ").trim();
      if (!kind || !title) {
        return { text: "Uso: /album add <tipo> <título>" };
      }
      const next = [...entries, { kind, title, atMs: Date.now() }].slice(-500);
      await this.chatSettingRepository.setValue(
        context.tenantId,
        context.chatId,
        "season_album",
        next,
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "season_album.added",
        resourceType: "chat_setting",
        resourceId: context.chatId,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { kind, title },
      });
      return { text: `📔 "${title}" añadido al álbum (${kind}).` };
    }

    if (sub === "reset") {
      await this.chatSettingRepository.setValue(
        context.tenantId,
        context.chatId,
        "season_album",
        [],
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "season_album.reset",
        resourceType: "chat_setting",
        resourceId: context.chatId,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: {},
      });
      return { text: "Álbum de temporada reiniciado." };
    }

    return { text: "Uso: /album [list|add <tipo> <título>|reset]" };
  }

  private async handleNotesPortCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseNotesPortCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId || update.chat.chatType === "private") {
      return {
        text: "🗒️ La exportación/importación de notas se hace DENTRO del grupo (como administrador).",
      };
    }

    if (result.command.kind === "export") {
      const notes = await this.notesRepository.listNotesDetailed(
        context.chatId,
      );
      return { text: serializeNotes(notes) };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "notes.import",
    );
    if (!permission.allowed) {
      return {
        text: `No tienes permisos para importar notas.`,
      };
    }

    const parsed = parseNotesImport(result.command.raw);
    if (!parsed) {
      return { text: "El JSON de importación no es válido." };
    }

    for (const note of parsed) {
      await this.notesRepository.saveNote(
        context.tenantId,
        context.chatId,
        normalizeNoteName(note.name),
        note.content,
        context.userId,
      );
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "notes.imported",
      resourceType: "note",
      resourceId: context.chatId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { count: parsed.length },
    });

    return { text: `Importadas ${parsed.length} nota(s).` };
  }

  private async handleModerationExtraCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseModerationExtraCommand(
      await this.withReplyTarget(update, context),
    );

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    // /report can be used by any member; the rest require moderation rights.
    const command = result.command;
    if (command.kind === "report") {
      const reportId = await this.moderationExtraRepository.createReport({
        tenantId: context.tenantId,
        chatId: context.chatId,
        reporterUserId: context.userId,
        subjectTelegramId: command.targetTelegramUserId,
        reason: command.reason,
      });
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "moderation.report.created",
        resourceType: "report",
        resourceId: reportId,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: {
          targetTelegramUserId: command.targetTelegramUserId.toString(),
          reason: command.reason,
        },
      });
      await this.emitOwnerNetworkRoute({
        context,
        sourceChatId: context.chatId,
        eventKind: "reports",
        fallbackEventKind: "logs",
        title: "Reporte nuevo",
        body: [
          `Grupo: ${update.chat.chatId?.toString() ?? context.chatId ?? "?"}`,
          `Reporta: ${update.user.userId?.toString() ?? context.userId ?? "?"}`,
          `Usuario: ${command.targetTelegramUserId.toString()}`,
          `Motivo: ${command.reason ?? "sin motivo"}`,
          `ID: ${reportId}`,
        ].join("\n"),
      });
      await this.recordRiskSignal(
        context,
        command.targetTelegramUserId,
        "report",
      );
      if (context.chatId) {
        await this.matchAndRunAutomations(context, update, {
          kind: "report",
          chatId: context.chatId,
        });
      }
      // Hasta aquí `/report` solo escribía una fila que nadie miraba, y la
      // respuesta prometía un moderador que no se enteraba de nada. Va al mismo
      // tema que los `@admin` porque es el mismo encargo: alguien pide que
      // miréis algo.
      const reportado = extractReplyContext(update.raw);
      await this.publicarReporteEnStaff(context, update, {
        source: "command",
        text: command.reason,
        reportedTelegramUserId: command.targetTelegramUserId,
        ...(reportado.messageId !== undefined
          ? { targetMessageId: reportado.messageId }
          : {}),
        ...(reportado.username ? { reportedUsername: reportado.username } : {}),
      });
      return { text: "Reporte registrado. Un moderador lo revisará." };
    }

    // /report above is fine for a member-only bot; the remaining actions need
    // admin rights. Games-only bot (no admin) → stay silent on those instead of
    // nagging about permissions.
    if (await this.botConfirmedNotAdmin(update.chat.chatId)) {
      return null;
    }

    const isAdmin = await this.isActorAdmin(context, update);
    const role = isAdmin ? "admin" : this.resolveActorRole(context, update);
    const decision = evaluatePolicy(
      {
        role,
        permissions: [],
        isTelegramAdmin: isAdmin,
        moduleEnabled: true,
      },
      "moderation.write",
      { moduleName: "security" },
    );

    if (!decision.allowed) {
      return {
        text: `No tienes permisos para esta acción.`,
      };
    }

    if (command.kind === "purge") {
      if (!update.chat.chatId || update.messageId === undefined) {
        return { text: "No puedo purgar mensajes en este contexto." };
      }
      // Freno de borrado masivo. /purge esta topado a 100 por llamada, pero
      // nada impedia encadenarlas: diez seguidas son mil mensajes en un
      // minuto. Un borrado no se deshace, asi que pasado el umbral se pide
      // confirmacion, y confirmar es repetir el comando.
      const brake = this.massActionBlocked(
        update.chat.chatId,
        context.userId ?? "anon",
      );
      if (brake) {
        return { text: brake };
      }
      let deleted = 0;
      for (let offset = 0; offset < command.count; offset += 1) {
        const targetMessageId = update.messageId - offset;
        if (targetMessageId <= 0) {
          break;
        }
        try {
          const result = await this.telegramGateway.deleteMessage({
            chatId: update.chat.chatId,
            messageId: targetMessageId,
            token: this.telegramToken(),
          });
          if (result.ok) {
            deleted += 1;
          }
        } catch {
          // Messages older than 48h or already gone fail individually; skip.
        }
      }
      this.recordDestructiveAction(update.chat.chatId, "purge", deleted);
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "moderation.purge",
        resourceType: "chat",
        resourceId: context.chatId ?? "",
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { requested: command.count, deleted },
      });
      return { text: `Purga: ${deleted} mensaje(s) eliminados.` };
    }

    if (command.kind === "list") {
      if (!context.chatId) {
        return { text: "Los avisos se gestionan dentro de un grupo." };
      }
      const warnings = await this.moderationExtraRepository.listActiveWarnings(
        context.tenantId,
        context.chatId,
        command.targetTelegramUserId,
      );
      if (warnings.length === 0) {
        return {
          text: `El usuario ${await this.describeTarget(update, context, command.targetTelegramUserId)} no tiene avisos activos.`,
        };
      }
      const lines = warnings.map(
        (warning, index) =>
          `${index + 1}. ${warning.reason ?? "(sin motivo)"} — ${warning.createdAt.toISOString()}`,
      );
      return {
        text: `Avisos de ${await this.describeTarget(update, context, command.targetTelegramUserId)}:\n${lines.join("\n")}`,
      };
    }

    if (command.kind === "unwarn") {
      if (!context.chatId) {
        return { text: "Los avisos se gestionan dentro de un grupo." };
      }
      const remaining = await this.moderationExtraRepository.unwarn(
        context.tenantId,
        context.chatId,
        command.targetTelegramUserId,
      );
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "moderation.unwarn",
        resourceType: "warning",
        resourceId: command.targetTelegramUserId.toString(),
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { remaining },
      });
      return {
        text: `Aviso retirado a ${await this.describeTarget(update, context, command.targetTelegramUserId)} (activos: ${remaining}).`,
      };
    }

    // reset
    if (!context.chatId) {
      return { text: "Los avisos se gestionan dentro de un grupo." };
    }
    const cleared = await this.moderationExtraRepository.resetWarnings(
      context.tenantId,
      context.chatId,
      command.targetTelegramUserId,
    );
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "moderation.resetwarn",
      resourceType: "warning",
      resourceId: command.targetTelegramUserId.toString(),
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { cleared },
    });
    return {
      text: `Avisos reiniciados para ${await this.describeTarget(update, context, command.targetTelegramUserId)} (${cleared} retirados).`,
    };
  }

  private async handleAntifloodCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseAntifloodCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "El antiflood se configura dentro de un grupo." };
    }

    const command = result.command;

    if (command.kind === "help") {
      return {
        text: "Antiflood: /antiflood_on, /antiflood_off, /antiflood_status, /antiflood_limit <n> [seg], /antiflood_action <ignore|delete|warn|mute|ban>, /antiflood_test.",
      };
    }

    if (command.kind === "status") {
      const settings = await this.loadAntifloodSettings(context);
      return {
        text: `Antiflood ${settings.enabled ? "activo" : "inactivo"} | límite ${settings.messageLimit} msg / ${settings.windowSeconds}s | acción ${settings.action}.`,
      };
    }

    if (command.kind === "test") {
      const settings = await this.loadAntifloodSettings(context);
      const now = Date.now();
      const timestamps = Array.from(
        { length: settings.messageLimit + 1 },
        (_value, index) => now - index * 100,
      );
      const decision = evaluateFlood(timestamps, now, {
        ...settings,
        enabled: true,
      });
      return {
        text: `Simulación antiflood: ${settings.messageLimit + 1} mensajes -> ${decision.triggered ? `acción ${decision.action}` : "sin acción"}.`,
      };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "antiflood.config",
    );

    if (!permission.allowed) {
      return {
        text: `No tienes permisos para configurar antiflood.`,
      };
    }

    const patch =
      command.kind === "enable"
        ? { enabled: command.enabled }
        : command.kind === "limit"
          ? {
              messageLimit: command.messageLimit,
              ...(command.windowSeconds !== undefined
                ? { windowSeconds: command.windowSeconds }
                : {}),
            }
          : { action: command.action };

    const settings = await this.antifloodRepository.upsertConfig(
      context.tenantId,
      context.chatId,
      patch,
    );

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "antiflood.config.updated",
      resourceType: "antiflood_config",
      resourceId: context.chatId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { patch },
    });

    return {
      text: `Antiflood actualizado: ${settings.enabled ? "activo" : "inactivo"}, límite ${settings.messageLimit}/${settings.windowSeconds}s, acción ${settings.action}.`,
    };
  }

  private async handleAntifloodMessage(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      !update.isTextMessage ||
      !context.chatId ||
      !update.chat.chatId ||
      !update.user.userId
    ) {
      return null;
    }

    const settings = await this.loadAntifloodSettings(context);

    if (!settings.enabled) {
      return null;
    }

    // Admins, moderators and the configured owner are exempt from antiflood.
    if (await this.isActorAdmin(context, update)) {
      return null;
    }

    const key = `${context.chatId}:${update.user.userId.toString()}`;
    const now = Date.now();
    const timestamps = await this.floodCounter.record(
      key,
      now,
      settings.windowSeconds,
    );
    const decision = evaluateFlood(timestamps, now, settings);

    if (!decision.triggered || decision.action === "ignore") {
      return null;
    }

    // A burst arrives as several webhook deliveries at once, and every one of
    // them runs this pipeline concurrently. Between `record` above and `reset`
    // below there are awaits, so without this gate each of those deliveries
    // reads the same over-limit count and sanctions the person again: in
    // production one person was muted three times inside two seconds, each with
    // count 5. The claim is synchronous on purpose — no await between the read
    // and the write, so only the first delivery can win.
    if (
      !this.reservaDeFlood.reservar(key, now, settings.windowSeconds * 1000)
    ) {
      return null;
    }

    await this.floodCounter.reset(key);
    await this.antifloodRepository.recordEvent({
      tenantId: context.tenantId,
      chatId: context.chatId,
      telegramUserId: update.user.userId,
      messageCount: decision.count,
      windowSeconds: settings.windowSeconds,
      action: decision.action,
    });

    const endsAt =
      decision.action === "mute"
        ? new Date(now + settings.muteSeconds * 1000)
        : undefined;

    if (decision.action === "mute" || decision.action === "ban") {
      await this.moderationRepository.createSanction({
        // Determinista: un reintento del mismo update no crea otra sanción.
        claveIdempotencia: this.claveDeterminista(update, "antiflood"),
        tenantId: context.tenantId,
        chatId: context.chatId,
        actorUserId: undefined,
        subjectTelegramUserId: update.user.userId,
        reason: "antiflood",
        kind: decision.action === "ban" ? "ban" : "mute",
        ...(endsAt ? { endsAt } : {}),
        telegramChatId: update.chat.chatId,
      });

      try {
        if (decision.action === "ban") {
          await this.telegramGateway.banChatMember({
            chatId: update.chat.chatId,
            userId: update.user.userId,
            token: this.telegramToken(),
            untilDate: undefined,
          });
        } else {
          await this.telegramGateway.restrictChatMember({
            chatId: update.chat.chatId,
            userId: update.user.userId,
            token: this.telegramToken(),
            untilDate: endsAt,
          });
        }
      } catch {
        // Enforcement failures never block persistence/audit.
      }
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "system",
      action: "antiflood.triggered",
      resourceType: "antiflood_event",
      resourceId: context.chatId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        action: decision.action,
        count: decision.count,
        telegramUserId: update.user.userId.toString(),
      },
    });

    return {
      text: `Antiflood: límite superado (${decision.count} mensajes). Acción aplicada: ${decision.action}.`,
    };
  }

  private async loadCaptchaSettings(
    context: FoundationContext,
  ): Promise<CaptchaSettings> {
    if (!context.chatId) {
      return defaultCaptchaSettings;
    }

    const stored = await this.captchaRepository.getConfig(
      context.tenantId,
      context.chatId,
    );

    return stored
      ? { ...defaultCaptchaSettings, ...stored }
      : defaultCaptchaSettings;
  }

  private async handleCaptchaCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseCaptchaCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "El captcha se configura dentro de un grupo." };
    }

    const command = result.command;

    if (command.kind === "help") {
      return {
        text: "Captcha: /captcha_on, /captcha_off, /captcha_status, /captcha_mode <button|math|text>, /captcha_timeout <seg>, /captcha_attempts <n>, /captcha_action <ban|mute|restrict>, /captcha_test.",
      };
    }

    if (command.kind === "status") {
      const settings = await this.loadCaptchaSettings(context);
      return {
        text: `Captcha ${settings.enabled ? "activo" : "inactivo"} | modo ${settings.mode} | timeout ${settings.timeoutSeconds}s | intentos ${settings.maxAttempts} | fallo ${settings.failAction}.`,
      };
    }

    if (command.kind === "test") {
      const settings = await this.loadCaptchaSettings(context);
      const challenge = generateCaptchaChallenge(
        settings.mode,
        update.updateId + 1,
      );
      return {
        text: `Simulación captcha (${settings.mode}): ${challenge.prompt}`,
      };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "captcha.config",
    );

    if (!permission.allowed) {
      return {
        text: `No tienes permisos para configurar captcha.`,
      };
    }

    const patch =
      command.kind === "enable"
        ? { enabled: command.enabled }
        : command.kind === "mode"
          ? { mode: command.mode }
          : command.kind === "timeout"
            ? { timeoutSeconds: command.timeoutSeconds }
            : command.kind === "attempts"
              ? { maxAttempts: command.maxAttempts }
              : { failAction: command.action };

    const settings = await this.captchaRepository.upsertConfig(
      context.tenantId,
      context.chatId,
      patch,
    );

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "captcha.config.updated",
      resourceType: "captcha_config",
      resourceId: context.chatId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { patch },
    });

    return {
      text: `Captcha actualizado: ${settings.enabled ? "activo" : "inactivo"}, modo ${settings.mode}, timeout ${settings.timeoutSeconds}s.`,
    };
  }

  private async loadAntiraidSettings(
    context: FoundationContext,
  ): Promise<AntiraidSettings> {
    if (!context.chatId) {
      return defaultAntiraidSettings;
    }

    const stored = await this.antiraidRepository.getConfig(
      context.tenantId,
      context.chatId,
    );

    return stored
      ? { ...defaultAntiraidSettings, ...stored }
      : defaultAntiraidSettings;
  }

  private async handleAntiraidCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseAntiraidCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "El antiraid se configura dentro de un grupo." };
    }

    const command = result.command;

    if (command.kind === "help") {
      return {
        text: "Antiraid: /antiraid_on, /antiraid_off, /antiraid_status, /antiraid_limit <entradas> [seg], /antiraid_mode <observe|enforce>, /antiraid_test.",
      };
    }

    if (command.kind === "status") {
      const settings = await this.loadAntiraidSettings(context);
      return {
        text: `Antiraid ${settings.enabled ? "activo" : "inactivo"} | umbral ${settings.joinLimit} entradas / ${settings.windowSeconds}s | modo ${settings.mode}.`,
      };
    }

    if (command.kind === "test") {
      const settings = await this.loadAntiraidSettings(context);
      const now = Date.now();
      const joins = Array.from(
        { length: settings.joinLimit + 1 },
        (_value, index) => now - index * 100,
      );
      const decision = evaluateRaid(joins, now, { ...settings, enabled: true });
      return {
        text: `Simulación antiraid: ${settings.joinLimit + 1} entradas -> ${decision.triggered ? `raid detectado (modo ${decision.mode})` : "sin raid"}.`,
      };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "antiraid.config",
    );

    if (!permission.allowed) {
      return {
        text: `No tienes permisos para configurar antiraid.`,
      };
    }

    const patch =
      command.kind === "enable"
        ? { enabled: command.enabled }
        : command.kind === "limit"
          ? {
              joinLimit: command.joinLimit,
              ...(command.windowSeconds !== undefined
                ? { windowSeconds: command.windowSeconds }
                : {}),
            }
          : { mode: command.mode };

    const settings = await this.antiraidRepository.upsertConfig(
      context.tenantId,
      context.chatId,
      patch,
    );

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "antiraid.config.updated",
      resourceType: "antiraid_config",
      resourceId: context.chatId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { patch },
    });

    return {
      text: `Antiraid actualizado: ${settings.enabled ? "activo" : "inactivo"}, umbral ${settings.joinLimit}/${settings.windowSeconds}s, modo ${settings.mode}.`,
    };
  }

  private async handleWelcomeCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseWelcomeCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    if (!context.chatId) {
      return { text: "La bienvenida y las reglas se gestionan en un grupo." };
    }

    const command = result.command;
    const config = await this.welcomeRepository.getConfig(context.chatId);

    if (command.kind === "show-welcome") {
      return {
        text:
          config?.welcomeText ??
          "No hay mensaje de bienvenida configurado. Usa /setwelcome <texto> para configurar uno.",
      };
    }

    if (command.kind === "show-rules") {
      await this.progressGamification(
        context,
        update.user.userId,
        "read_rules",
      );
      return {
        text:
          config?.rulesText ??
          "No hay reglas configuradas. Usa /setrules <texto> para configurar las reglas.",
      };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "welcome.config",
    );

    if (!permission.allowed) {
      return {
        text: `No tienes permisos para configurar esto.`,
      };
    }

    const patch =
      command.kind === "set-welcome"
        ? { welcomeText: command.text }
        : command.kind === "reset-welcome"
          ? { welcomeText: null }
          : command.kind === "set-rules"
            ? { rulesText: command.text }
            : { goodbyeText: command.text };

    await this.welcomeRepository.upsertConfig(
      context.tenantId,
      context.chatId,
      patch,
    );

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "welcome.config.updated",
      resourceType: "welcome_config",
      resourceId: context.chatId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { kind: command.kind },
    });

    return { text: "Configuración de bienvenida/reglas actualizada." };
  }

  /**
   * When the bot itself is added to a chat (Telegram `my_chat_member`), greet the
   * group with a GroupHelp-style card: a "make me admin" nudge and a deep-link to
   * the settings panel in PM.
   */
  private async handleBotOnboarding(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    replyBotUsername: string,
  ): Promise<BotReply | null> {
    const membership = update.botMembership;
    if (!membership?.added || membership.chatId === undefined) {
      return null;
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "system",
      action: "bot.added",
      resourceType: "chat",
      resourceId: membership.chatId.toString(),
      payload: { promotedToAdmin: membership.promotedToAdmin },
    });

    // Two very different cards. When promoted, the classic "make me admin is
    // done, pick a purpose" flow. When NOT admin, lead with what the bot can
    // already do as a plain member (games, AI, polls, reminders, scam warnings)
    // so it reads as a helpful companion, then one calm nudge toward admin — and
    // only advertise features that actually ship today.
    const body = membership.promotedToAdmin
      ? "Ya soy administrador: listo para moderar, dar la bienvenida y activar el captcha. 🛡\n\n" +
        "Ábreme y elige para qué me usarás: *administrar*, *jugar* o *las dos*. Lo dejo todo listo según lo que elijas."
      : "Aunque no sea administrador, ya puedo echar una mano:\n" +
        "• 🎮 Juegos y trivia — /jugar, /trivia\n" +
        "• 🤖 Preguntas con IA — /ai\n" +
        "• 📊 Encuestas y sorteos — /poll, /giveaway\n" +
        "• ⏰ Recordatorios — /remind\n" +
        "• 🗓️ Resumen semanal del grupo (si lo activas)\n" +
        "• 🛡 Y te aviso si veo un mensaje con pinta de estafa\n\n" +
        "Para moderar y proteger el grupo de verdad, hazme *administrador*: sin eso, aviso pero no puedo borrar.\n\n" +
        "Ábreme y elige para qué me usarás: *jugar*, *administrar* o *las dos*.";

    // Land the admin on the onboarding purpose question ("¿para qué usarás el
    // bot?"). The primary bot has a named Mini App, so a t.me app link opens it
    // straight from the group; child bots (no named app) fall back to the PM
    // deep-link, where the Mini App reaches onboarding from the config menu.
    const gid = membership.chatId;
    const appHttps = readAppUrl(this.env.TELEGRAM_APP_URL).startsWith(
      "https://",
    );
    const configButton =
      this.isPrimaryBot(replyBotUsername) && appHttps
        ? {
            text: "🚀 Configurar (Mini App)",
            // onb_<gid> = onboarding start param (see packages/shared/startapp).
            url: `https://t.me/${replyBotUsername}/${this.env.TELEGRAM_MINIAPP_NAME}?startapp=onb_${gid.toString()}`,
          }
        : {
            text: "⚙️ Configurar",
            url: buildSettingsDeepLink(replyBotUsername, gid),
          };

    return {
      text: `👋 *¡Gracias por añadirme!*\n\n${body}`,
      parseMode: "Markdown",
      replyMarkup: { inline_keyboard: [[configButton]] },
    };
  }

  /**
   * Delivers the configured goodbye message when a member leaves. The goodbye text
   * is stored by /setgoodbye but was never sent before. Sends directly (returns
   * null) so a following clean-service pass can still remove the service message.
   */
  private async handleLeftMember(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.leftChatMemberId === undefined ||
      !context.chatId ||
      !update.chat.chatId
    ) {
      return null;
    }

    const config = await this.welcomeRepository.getConfig(context.chatId);
    if (!config?.goodbyeText) {
      return null;
    }

    const reply = buildTemplateReply(
      config.goodbyeText,
      this.templateVars(update, update.leftChatMember ?? update.user),
      update.updateId,
    );

    try {
      await this.telegramGateway.sendMessage({
        chatId: update.chat.chatId,
        reply,
        token: this.telegramToken(),
      });
    } catch {
      // Best-effort: a delivery failure must not break the update pipeline.
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "system",
      action: "goodbye.sent",
      resourceType: "welcome_config",
      resourceId: context.chatId,
      payload: {},
    });

    return null;
  }

  /**
   * A human name for someone a moderation command targeted.
   *
   * The command only ever carries a numeric id — by design, since that is the
   * one identifier that cannot go stale — so every confirmation read
   * "Moderación aplicada: ban a 9000000006", which tells the admin who acted
   * nothing about who they hit. Worse, it is unverifiable at a glance: a
   * mistyped digit looks exactly like a correct one.
   *
   * Asks Telegram first (current, and the only source for someone the bot has
   * never seen speak), then falls back to what the bot recorded itself, then to
   * the raw id. Never throws and never blocks the sanction: the punishment has
   * already been applied by the time this runs, and a lookup failure must not
   * turn a successful ban into an error message.
   */
  private async describeTarget(
    update: TelegramUpdateEnvelope,
    context: FoundationContext,
    targetTelegramUserId: bigint,
  ): Promise<string> {
    const fallback = targetTelegramUserId.toString();

    if (update.chat.chatId) {
      const member = await this.telegramGateway
        .getChatMember({
          chatId: update.chat.chatId,
          userId: targetTelegramUserId,
          token: this.telegramToken(),
        })
        .catch(() => undefined);
      if (member?.ok) {
        const described = describeUser({
          username: member.username,
          firstName: member.firstName,
          lastName: member.lastName,
          userId: targetTelegramUserId,
        });
        if (described !== fallback) {
          return `${described} (${fallback})`;
        }
      }
    }

    // Telegram refuses to describe a user it cannot resolve for this bot —
    // common for someone banned before they ever spoke. The bot's own record of
    // having seen them is the next best thing.
    if (context.chatId) {
      const profile = await this.analyticsRepository
        .getMemberActivityProfile?.(
          context.tenantId,
          context.chatId,
          targetTelegramUserId,
        )
        .catch(() => undefined);
      if (profile?.username) {
        return `@${profile.username} (${fallback})`;
      }
    }

    return fallback;
  }

  /**
   * Best-effort: log an arrival into the shared activity table (kind
   * "new_member") so newcomer reports (/fantasmas) can correlate joins with the
   * message log, and seed the insights profile. Never blocks the join pipeline.
   */
  private async recordMemberArrival(
    context: FoundationContext,
    telegramUserId: bigint,
  ): Promise<void> {
    if (!context.chatId) {
      return;
    }

    try {
      await this.chatActivityRepository.record({
        tenantId: context.tenantId,
        chatId: context.chatId,
        kind: "new_member",
        telegramUserId,
      });
    } catch {
      // Non-fatal: the activity log is best-effort.
    }

    if (this.analyticsRepository.observeMember) {
      try {
        await this.analyticsRepository.observeMember({
          tenantId: context.tenantId,
          chatId: context.chatId,
          telegramUserId,
        });
      } catch {
        // The insights profile is also best-effort and must not block joins.
      }
    }
  }

  /**
   * Reserves the welcome for one arrival, returning false when this member was
   * already greeted in this chat moments ago. See `recentWelcomes` for why one
   * join can legitimately reach us twice.
   */
  private claimWelcome(
    telegramChatId: bigint,
    telegramUserId: bigint,
  ): boolean {
    const now = Date.now();
    for (const [seenKey, ms] of this.recentWelcomes) {
      if (now - ms > BotUpdateService.WELCOME_DEDUP_MS) {
        this.recentWelcomes.delete(seenKey);
      }
    }

    const key = `${telegramChatId.toString()}:${telegramUserId.toString()}`;
    if (this.recentWelcomes.has(key)) {
      return false;
    }

    this.recentWelcomes.set(key, now);
    return true;
  }

  /**
   * A join Telegram reports ONLY as a `chat_member` status change — the shape
   * every approved join request takes, and therefore the only join signal a
   * group that vets newcomers ever produces.
   *
   * Captcha and welcome-mute deliberately stay on the service-message route:
   * a member admitted through a request has already been vetted by Guardian or
   * by a human, so challenging them again would be asking twice.
   */
  private async handleJoinViaChatMember(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    telegramChatId: bigint,
    telegramUserId: bigint,
  ): Promise<void> {
    if (!context.chatId) {
      return;
    }

    await this.recordMemberArrival(context, telegramUserId);

    const subject = update.chatMemberUpdate;
    const member: UserContext = {
      userId: telegramUserId,
      username: subject?.username,
      languageCode: undefined,
      ...(subject?.firstName !== undefined
        ? { firstName: subject.firstName }
        : {}),
    };

    // Antes que las puertas de la bienvenida, y a propósito. `claimWelcome`
    // existe para no saludar dos veces, y el modo pasivo para no hablar en el
    // grupo — ninguna de las dos cosas describe un aviso al STAFF sobre alguien
    // que acaba de entrar con el nombre de un admin. Silenciarlo ahí sería
    // apagar la alarma por no molestar.
    await this.alertOnImpersonation(context, telegramChatId, member);
    await this.alertOnMultiAccountRaid(context, telegramChatId, member);

    if (!this.claimWelcome(telegramChatId, telegramUserId)) {
      return;
    }
    if (!(await this.botMode(context.chatId)).messages) {
      return;
    }

    await this.sendWelcome(context, update, { member, via: "chat_member" });

    // Start their introduction clock too. Same reason as the welcome: the
    // service-message path never fires for a group that vets by request, so
    // without this the gate is enabled and watching nobody.
    const prompt = await this.startIntroductionClock(context, update, [
      {
        id: telegramUserId,
        ...(subject?.username ? { username: subject.username } : {}),
        ...(subject?.firstName ? { firstName: subject.firstName } : {}),
      },
    ]);
    if (prompt) {
      await this.telegramGateway.sendMessage({
        chatId: telegramChatId,
        reply: prompt,
        token: this.telegramToken(),
      });
    }
  }

  /**
   * Posts the group's configured welcome.
   *
   * `options.member` exists because a join can reach us two ways. On a
   * `new_chat_members` service message the envelope's user IS the newcomer, but
   * on a `chat_member` update (the only signal for an approved join request)
   * `from` is whoever approved it — greeting them would name the wrong person.
   */
  private async sendWelcome(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    options?: { readonly member?: UserContext; readonly via?: string },
  ): Promise<void> {
    if (!context.chatId || !update.chat.chatId) {
      return;
    }

    const config = await this.welcomeRepository.getConfig(context.chatId);

    if (!config) {
      return;
    }

    // A welcome fires when a group has configured either a text OR a photo
    // (GroupHelp-style photo-only welcomes are allowed). `welcomeMediaType` is
    // the stored sendPhoto type and doubles as the "has photo" signal.
    const welcomeText = config.welcomeText;
    const mediaType =
      config.welcomeMediaType === "png" ||
      config.welcomeMediaType === "webp" ||
      config.welcomeMediaType === "jpg"
        ? config.welcomeMediaType
        : undefined;
    if (welcomeText == null && !mediaType) {
      return;
    }

    // Caption/message body: a default welcome respects the group language, a
    // custom text is used as-is, and a photo-only welcome has no caption.
    let template = "";
    if (welcomeText != null) {
      const isDefault =
        welcomeText === "" || welcomeText === defaultWelcomeTemplate;
      const lang = isDefault
        ? (await this.groupProtectionRepository.getHygiene(context.chatId))
            .language
        : "es";
      template = isDefault ? t("welcome.default", lang) : welcomeText;
    }
    const built = buildTemplateReply(
      template,
      this.templateVars(update, options?.member ?? update.user),
      update.updateId,
    );

    // Aquí ya no se pega ningún aviso sobre la presentación obligatoria: con la
    // puerta encendida, el propio guardián publica el suyo justo detrás — más
    // completo, con el plazo y las instrucciones — y con la puerta apagada no
    // hay nada que anunciar. Decirlo en los dos sitios convertía cada entrada
    // en una ráfaga de mensajes repitiéndose.
    const body = built.text;

    // Merge the URL buttons parsed from the text ([Text](buttonurl://…)) with
    // the structured buttons configured in the Mini App (rules / contact /
    // mini-app / extra URL buttons).
    const templateRows =
      (built.replyMarkup?.inline_keyboard as
        | Record<string, unknown>[][]
        | undefined) ?? [];
    const structured = buildWelcomeInlineKeyboard(
      parseWelcomeButtons(config.welcomeButtons),
      {
        botUsername: this.env.TELEGRAM_BOT_USERNAME,
        miniAppName: this.env.TELEGRAM_MINIAPP_NAME,
      },
    );
    const inlineKeyboard = [
      ...templateRows,
      ...(structured?.inline_keyboard ?? []),
    ];
    const replyMarkup =
      inlineKeyboard.length > 0
        ? { inline_keyboard: inlineKeyboard }
        : undefined;

    // "Deja solo el último saludo": remove the previous one BEFORE posting the
    // new one, so the group never briefly shows two. Read first because the
    // pointer is overwritten below either way.
    const hygiene = await this.groupProtectionRepository.getHygiene(
      context.chatId,
    );
    const previousWelcomeId = hygiene.cleanWelcome
      ? await this.lastWelcomeMessageId(context.tenantId, context.chatId)
      : undefined;

    let sent = false;
    let newWelcomeId: number | undefined;
    if (mediaType) {
      const media = await this.welcomeRepository.getMedia(context.chatId);
      if (media) {
        // Telegram caps photo captions at 1024 chars — pre-truncate here without
        // splitting a surrogate pair (see truncateWelcomeCaption).
        const caption = truncateWelcomeCaption(body);
        const result = await this.telegramGateway.sendPhoto({
          chatId: update.chat.chatId,
          imageBase64: media.data,
          type: mediaType,
          token: this.telegramToken(),
          ...(caption ? { caption } : {}),
          ...(replyMarkup ? { replyMarkup } : {}),
        });
        newWelcomeId = result.messageId;
        sent = true;
      }
    }

    if (!sent) {
      // Photo-only welcome whose bytes went missing → nothing sendable. The
      // introduction notice alone is not a welcome, so it does not count.
      if (!built.text) {
        return;
      }
      const reply: BotReply = replyMarkup
        ? { ...built, text: body, replyMarkup }
        : { ...built, text: body };
      const result = await this.telegramGateway.sendMessage({
        chatId: update.chat.chatId,
        reply,
        token: this.telegramToken(),
      });
      newWelcomeId = result.messageId;
    }

    if (hygiene.cleanWelcome) {
      await this.rememberWelcomeMessage(
        context.tenantId,
        context.chatId,
        newWelcomeId,
      );
      if (previousWelcomeId !== undefined) {
        try {
          await this.telegramGateway.deleteMessage({
            chatId: update.chat.chatId,
            messageId: previousWelcomeId,
            token: this.telegramToken(),
          });
        } catch {
          // Already gone, too old to delete, or no rights. Cosmetic either way,
          // and the pointer has already moved on to the new one.
        }
      }
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "system",
      action: "welcome.sent",
      resourceType: "welcome_config",
      resourceId: context.chatId,
      payload: {
        members: Math.max(1, update.newChatMemberIds.length),
        via: options?.via ?? "service_message",
      },
    });
  }

  /**
   * Pointer to the welcome currently on screen, for `cleanWelcome` ("leave only
   * the last greeting"). Kept in the shared chat-settings store rather than in
   * memory so a redeploy does not strand the message it was about to remove.
   */
  private async lastWelcomeMessageId(
    tenantId: string,
    chatId: string,
  ): Promise<number | undefined> {
    const raw = await this.chatSettingRepository
      .getValue(tenantId, chatId, LAST_WELCOME_SETTINGS_KEY)
      .catch(() => undefined);
    const value = (raw as { messageId?: unknown } | undefined)?.messageId;
    return typeof value === "number" && Number.isInteger(value)
      ? value
      : undefined;
  }

  private async rememberWelcomeMessage(
    tenantId: string,
    chatId: string,
    messageId: number | undefined,
  ): Promise<void> {
    await this.chatSettingRepository
      .setValue(tenantId, chatId, LAST_WELCOME_SETTINGS_KEY, {
        // null, not "leave the old one": if Telegram did not hand back an id
        // there is nothing to delete next time, and keeping the stale pointer
        // would eventually delete the wrong message.
        messageId: messageId ?? null,
      })
      .catch(() => undefined);
  }

  /**
   * Handles taps on the built-in welcome buttons: the rules button pops the
   * group rules (as a modal alert, or a message when they're too long for a
   * popup), and the contact-admins button pops the list of group admins.
   * Popups are answered directly here and the handler returns null; the long
   * rules fallback returns a BotReply that the pipeline delivers as a message.
   */
  private async handleWelcomeButtonsCallback(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    rawUpdate: unknown,
  ): Promise<BotReply | null> {
    const data = update.callbackData;
    if (data !== WELCOME_RULES_CALLBACK && data !== WELCOME_ADMINS_CALLBACK) {
      return null;
    }
    if (!context.chatId || !update.chat.chatId) {
      return null;
    }

    if (data === WELCOME_RULES_CALLBACK) {
      const config = await this.welcomeRepository.getConfig(context.chatId);
      const rules = config?.rulesText?.trim();
      if (!rules) {
        await this.ackCallbackQuery(
          rawUpdate,
          "Este grupo todavía no tiene reglas configuradas.",
          true,
        );
        return null;
      }
      // A callback popup (show_alert) is capped near 200 chars; longer rules go
      // out as a normal message instead.
      if (rules.length <= 200) {
        await this.ackCallbackQuery(rawUpdate, rules, true);
        return null;
      }
      await this.ackCallbackQuery(rawUpdate, "Te envío las reglas 👇");
      return { text: rules };
    }

    const admins = await this.telegramGateway.getChatAdministrators({
      chatId: update.chat.chatId,
      token: this.telegramToken(),
    });
    await this.ackCallbackQuery(
      rawUpdate,
      this.formatWelcomeAdminsPopup(admins.admins),
      true,
    );
    return null;
  }

  private formatWelcomeAdminsPopup(
    admins: readonly TelegramChatAdminInfo[] | undefined,
  ): string {
    if (!admins || admins.length === 0) {
      return "No pude obtener la lista de administradores.";
    }
    const named = admins.filter((admin) => admin.username);
    if (named.length === 0) {
      return "Los administradores no tienen @usuario público; menciónalos en el chat.";
    }
    const list = named
      .slice(0, 8)
      .map((admin) => `${admin.isOwner ? "👑 " : ""}@${admin.username}`)
      .join("\n");
    const text = `Administradores del grupo:\n${list}`;
    return text.length <= 200 ? text : `${text.slice(0, 199)}…`;
  }

  /**
   * Celebrates real member-count milestones (100, 500, 1000, ...). No new
   * storage: `after` comes from the live active-membership count, and
   * `before` is approximated as `after` minus the joiners in this update
   * (ensureContext already created/reactivated their memberships upstream).
   */
  private async celebrateMilestone(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<void> {
    if (!context.chatId || !update.chat.chatId) {
      return;
    }

    const after = await this.repository.countActiveMemberships(context.chatId);
    const before = after - update.newChatMemberIds.length;
    const crossed = crossedMilestone(before, after);

    if (crossed === null) {
      return;
    }

    try {
      await this.telegramGateway.sendMessage({
        chatId: update.chat.chatId,
        reply: { text: formatMilestone(crossed) },
        token: this.telegramToken(),
      });
    } catch {
      // Best-effort: a delivery failure must not break the join pipeline.
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "system",
      action: "milestone.celebrated",
      resourceType: "membership",
      resourceId: context.chatId,
      payload: { milestone: crossed, memberCount: after },
    });
  }

  private async detectRaid(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<void> {
    if (!context.chatId || !update.chat.chatId) {
      return;
    }

    const settings = await this.loadAntiraidSettings(context);

    if (!settings.enabled) {
      return;
    }

    const now = Date.now();
    const key = `raid:${context.chatId}`;
    let timestamps: readonly number[] = [];
    for (let index = 0; index < update.newChatMemberIds.length; index += 1) {
      timestamps = await this.floodCounter.record(
        key,
        now,
        settings.windowSeconds,
      );
    }

    const decision = evaluateRaid([...timestamps], now, settings);

    if (!decision.triggered) {
      return;
    }

    await this.antiraidRepository.recordEvent({
      tenantId: context.tenantId,
      chatId: context.chatId,
      joinCount: decision.joinCount,
      windowSeconds: settings.windowSeconds,
      mode: decision.mode,
    });
    await this.antiraidRepository.setUnderAttack(
      context.chatId,
      new Date(now + settings.windowSeconds * 1000),
    );

    if (decision.mode === "enforce") {
      for (const memberId of update.newChatMemberIds) {
        try {
          await this.telegramGateway.restrictChatMember({
            chatId: update.chat.chatId,
            userId: memberId,
            token: this.telegramToken(),
            untilDate: undefined,
          });
        } catch {
          // Enforcement failures never block alerting/audit.
        }
      }
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "system",
      action: "antiraid.triggered",
      resourceType: "antiraid_event",
      resourceId: context.chatId,
      payload: {
        joinCount: decision.joinCount,
        mode: decision.mode,
        windowSeconds: settings.windowSeconds,
      },
    });

    await this.emitOwnerNetworkRoute({
      context,
      sourceChatId: context.chatId,
      eventKind: "raid_alerts",
      fallbackEventKind: "logs",
      title: "Alerta de raid",
      body: [
        `Grupo: ${update.chat.chatId?.toString() ?? context.chatId}`,
        `Entradas: ${decision.joinCount} en ${settings.windowSeconds}s`,
        `Modo: ${decision.mode}`,
      ].join("\n"),
    });
  }

  /**
   * Welcome-mute: restrict each new member and post a one-button "I'm human"
   * check. Used when full captcha is off. Verified users are skipped.
   */
  private async applyWelcomeMute(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<void> {
    if (!context.chatId || !update.chat.chatId) {
      return;
    }

    const hygiene = await this.groupProtectionRepository.getHygiene(
      context.chatId,
    );
    if (!hygiene.welcomeMute) {
      return;
    }

    for (const memberId of update.newChatMemberIds) {
      if (
        await this.groupProtectionRepository.isVerified(
          context.tenantId,
          memberId,
        )
      ) {
        continue;
      }

      try {
        await this.telegramGateway.restrictChatMember({
          chatId: update.chat.chatId,
          userId: memberId,
          token: this.telegramToken(),
          untilDate: undefined,
        });
      } catch {
        // Best-effort.
      }

      await this.telegramGateway.sendMessage({
        chatId: update.chat.chatId,
        reply: {
          text: "👋 Pulsa el botón para confirmar que eres humano.",
          replyMarkup: buildHumanVerifyButton(memberId),
        },
        token: this.telegramToken(),
      });
    }
  }

  private async handleNewMembers(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.newChatMemberIds.length === 0 ||
      !context.chatId ||
      !update.chat.chatId
    ) {
      return null;
    }

    for (const memberId of update.newChatMemberIds) {
      await this.recordMemberArrival(context, memberId);
    }

    const mode = await this.botMode(context.chatId);

    if (mode.moderation) {
      await this.enforceFederationBans(context, update);
      await this.enforceMembershipGate(context, update);
      await this.enforceSpamCheck(context, update);
      await this.detectRaid(context, update);
    }
    await this.recordInvites(context, update);
    if (mode.messages) {
      // Claim every arrival in this batch, not just the one being greeted: the
      // same people also arrive as individual `chat_member` updates, and each
      // of those would otherwise greet them a second time.
      const claimed = update.newChatMemberIds.filter((memberId) =>
        this.claimWelcome(update.chat.chatId as bigint, memberId),
      );
      if (claimed.length > 0) {
        await this.sendWelcome(context, update);
      }
      await this.celebrateMilestone(context, update);
    }

    // The captcha challenge + welcome-mute below are autonomous moderation; when
    // it is off (passive mode, or the moderation category toggle) the newcomer
    // is left alone. Guardian, if configured, still runs via handleJoinRequest.
    if (!mode.moderation) {
      return null;
    }

    const settings = await this.loadCaptchaSettings(context);

    if (!settings.enabled) {
      // Captcha off: fall back to welcome-mute (one-button verify) if enabled.
      await this.applyWelcomeMute(context, update);
      return null;
    }

    for (const memberId of update.newChatMemberIds) {
      // Shieldy-style cross-chat skip: members who already passed verification
      // in any chat of this tenant are not challenged again.
      if (
        await this.groupProtectionRepository.isVerified(
          context.tenantId,
          memberId,
        )
      ) {
        continue;
      }

      const salt = randomUUID();
      const seed = Number(
        (BigInt(update.updateId) * 2654435761n + memberId) % 2147483647n,
      );
      const challenge = generateCaptchaChallenge(settings.mode, seed);
      const session = await this.captchaRepository.createSession({
        tenantId: context.tenantId,
        chatId: context.chatId,
        telegramUserId: memberId,
        mode: settings.mode,
        challenge: challenge.prompt,
        answerHash: hashCaptchaAnswer(challenge.answer, salt),
        answerSalt: salt,
        maxAttempts: settings.maxAttempts,
        failAction: settings.failAction,
        expiresAt: new Date(Date.now() + settings.timeoutSeconds * 1000),
      });

      // Only pre-mute when the challenge can be answered WHILE muted. Button and
      // math render inline buttons (a tap is a callback_query, which does not
      // need send-messages permission). A text challenge requires typing, so
      // muting first is a catch-22 — leave the member unrestricted and let the
      // timeout sweep apply the fail action if they never answer.
      const tappable = settings.mode !== "text";

      if (tappable) {
        try {
          await this.telegramGateway.restrictChatMember({
            chatId: update.chat.chatId,
            userId: memberId,
            token: this.telegramToken(),
            untilDate: undefined,
          });
        } catch {
          // Restriction failures never block challenge persistence.
        }
      }

      const replyMarkup = tappable
        ? {
            inline_keyboard: challenge.buttons.map((button) => [
              {
                text: button.label,
                callback_data: `captcha:${session.id}:${button.token}`,
              },
            ]),
          }
        : undefined;

      await this.telegramGateway.sendMessage({
        chatId: update.chat.chatId,
        reply: {
          text: `Bienvenido. ${challenge.prompt}`,
          ...(replyMarkup ? { replyMarkup } : {}),
        },
        token: this.telegramToken(),
      });

      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "system",
        action: "captcha.challenge.created",
        resourceType: "captcha_session",
        resourceId: session.id,
        payload: {
          telegramUserId: memberId.toString(),
          mode: settings.mode,
        },
      });
    }

    return null;
  }

  private async handleCaptchaCallback(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (!update.callbackData?.startsWith("captcha:")) {
      return null;
    }

    const [, sessionId, token] = update.callbackData.split(":");

    if (!sessionId || !token) {
      return { text: "Captcha inválido." };
    }

    return this.resolveCaptchaAttempt(context, update, sessionId, token);
  }

  private async handleCaptchaTextAnswer(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      !update.isTextMessage ||
      !context.chatId ||
      !update.user.userId ||
      !update.messageText
    ) {
      return null;
    }

    const session = await this.captchaRepository.findPendingSession(
      context.tenantId,
      context.chatId,
      update.user.userId,
    );

    if (!session) {
      return null;
    }

    return this.resolveCaptchaAttempt(
      context,
      update,
      session.id,
      update.messageText.trim(),
    );
  }

  private async resolveCaptchaAttempt(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    sessionId: string,
    candidate: string,
  ): Promise<BotReply | null> {
    const session = await this.captchaRepository.findPendingSession(
      context.tenantId,
      context.chatId ?? "",
      update.user.userId ?? 0n,
    );

    if (
      !session ||
      session.id !== sessionId ||
      !session.answerHash ||
      !session.answerSalt
    ) {
      return { text: "No hay un captcha pendiente para ti." };
    }

    const correct = verifyCaptchaAnswer(
      candidate,
      session.answerHash,
      session.answerSalt,
    );

    if (correct) {
      await this.captchaRepository.recordAttempt(session.id, "solved");

      if (update.user.userId) {
        // Remember cross-chat so verified users skip captcha in other groups.
        await this.groupProtectionRepository.markVerified(
          context.tenantId,
          update.user.userId,
        );
      }

      if (update.chat.chatId && update.user.userId) {
        try {
          await this.telegramGateway.liftRestrictions({
            chatId: update.chat.chatId,
            userId: update.user.userId,
            token: this.telegramToken(),
          });
        } catch {
          // Lifting failures never block the solved transition.
        }
      }

      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "captcha.solved",
        resourceType: "captcha_session",
        resourceId: session.id,
        payload: { telegramUserId: update.user.userId?.toString() },
      });

      return { text: "Captcha resuelto. Bienvenido al grupo." };
    }

    const attempts = session.attempts + 1;
    const exhausted = attempts >= session.maxAttempts;
    await this.captchaRepository.recordAttempt(
      session.id,
      exhausted ? "failed" : "pending",
    );

    if (exhausted && update.chat.chatId && update.user.userId) {
      try {
        if (session.failAction === "ban") {
          await this.telegramGateway.banChatMember({
            chatId: update.chat.chatId,
            userId: update.user.userId,
            token: this.telegramToken(),
            untilDate: undefined,
          });
        } else {
          await this.telegramGateway.restrictChatMember({
            chatId: update.chat.chatId,
            userId: update.user.userId,
            token: this.telegramToken(),
            untilDate: undefined,
          });
        }
      } catch {
        // Enforcement failures never block the failed transition.
      }
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: exhausted ? "captcha.failed" : "captcha.retry",
      resourceType: "captcha_session",
      resourceId: session.id,
      payload: {
        attempts,
        telegramUserId: update.user.userId?.toString(),
      },
    });

    return {
      text: exhausted
        ? `Captcha fallido. Acción aplicada: ${session.failAction}.`
        : `Respuesta incorrecta. Intentos restantes: ${session.maxAttempts - attempts}.`,
    };
  }

  private async handleAdminToolCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseAdminToolCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    const isAdmin = await this.isActorAdmin(context, update);
    const role = isAdmin ? "admin" : this.resolveActorRole(context, update);
    const decision = evaluatePolicy(
      {
        role,
        permissions: [],
        isTelegramAdmin: isAdmin,
        moduleEnabled: true,
      },
      "moderation.write",
      { moduleName: "security" },
    );

    if (!decision.allowed) {
      return {
        text: `Solo los administradores pueden usar este comando.`,
      };
    }

    const chatId = update.chat.chatId;

    if (!chatId) {
      return { text: "Este comando se usa dentro de un grupo." };
    }

    const command = result.command;
    // `moderation.write` cubre moderar, no repartir poder. /promote y /demote
    // acaban en el mismo promoteChatMember que /admin, así que dejarlos con el
    // guarda de arriba mantenía abierta la misma escalada por la puerta de al
    // lado — y estos dos ni siquiera dejan fila en `bot_granted_admin`.
    if (
      (command.kind === "promote" || command.kind === "demote") &&
      !(await this.actorCanPromote(update))
    ) {
      return { text: BotUpdateService.PROMOTE_DENIED_TEXT };
    }
    const token = this.telegramToken();
    let text: string;

    try {
      switch (command.kind) {
        case "pin": {
          const outcome = await this.telegramGateway.pinChatMessage({
            chatId,
            messageId: command.messageId,
            token,
          });
          text = outcome.ok
            ? "📌 Mensaje fijado."
            : "No pude fijar el mensaje.";
          break;
        }
        case "unpin": {
          const outcome = await this.telegramGateway.unpinChatMessage({
            chatId,
            token,
          });
          text = outcome.ok
            ? "📌 Último mensaje fijado liberado."
            : "No pude quitar el pin.";
          break;
        }
        case "del": {
          const outcome = await this.telegramGateway.deleteMessage({
            chatId,
            messageId: command.messageId,
            token,
          });

          if (outcome.ok && update.messageId) {
            // Also remove the /del command itself to keep the chat clean.
            try {
              await this.telegramGateway.deleteMessage({
                chatId,
                messageId: update.messageId,
                token,
              });
            } catch {
              // Best-effort cleanup only.
            }
          }

          text = outcome.ok
            ? "🗑 Mensaje borrado."
            : "No pude borrar el mensaje.";
          break;
        }
        case "settitle": {
          const outcome = await this.telegramGateway.setChatTitle({
            chatId,
            text: command.title,
            token,
          });
          text = outcome.ok
            ? `✏️ Título cambiado a "${command.title}".`
            : "No pude cambiar el título.";
          break;
        }
        case "setdesc": {
          const outcome = await this.telegramGateway.setChatDescription({
            chatId,
            text: command.description,
            token,
          });
          text = outcome.ok
            ? "✏️ Descripción actualizada."
            : "No pude cambiar la descripción.";
          break;
        }
        case "promote": {
          const outcome = await this.telegramGateway.promoteChatMember({
            chatId,
            userId: command.userId,
            customTitle: command.title,
            token,
          });
          text = outcome.ok
            ? `⭐ Usuario ${command.userId.toString()} promovido a admin${command.title ? ` con título "${command.title}"` : ""}.`
            : "No pude promover al usuario.";
          break;
        }
        case "demote": {
          const outcome = await this.telegramGateway.demoteChatMember({
            chatId,
            userId: command.userId,
            token,
          });
          text = outcome.ok
            ? `⬇️ Usuario ${command.userId.toString()} degradado a miembro.`
            : "No pude degradar al usuario.";
          break;
        }
        case "invitelink": {
          const outcome = await this.telegramGateway.createChatInviteLink({
            chatId,
            token,
          });
          text = outcome.inviteLink
            ? `🔗 Enlace de invitación:\n${outcome.inviteLink}`
            : "No pude generar el enlace de invitación.";
          break;
        }
        case "admins": {
          const outcome = await this.telegramGateway.getChatAdministrators({
            chatId,
            token,
          });
          text = formatAdminList(outcome.admins ?? []);
          break;
        }
      }
    } catch {
      return {
        text: "Telegram rechazó la operación. Comprueba que soy admin con permisos suficientes.",
      };
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: `admin.${command.kind}`,
      resourceType: "admin_tool",
      resourceId: chatId.toString(),
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { command: command.kind },
    });

    return { text };
  }

  private handleFunCommand(update: TelegramUpdateEnvelope): BotReply | null {
    const result = parseFunCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    // updateId as seed keeps outcomes deterministic per update (idempotent retries).
    return buildFunReply(result.command, update.updateId);
  }

  private handleFunCallback(update: TelegramUpdateEnvelope): BotReply | null {
    const parsed = parseRpsCallback(update.callbackData);

    if (!parsed) {
      return null;
    }

    return buildRpsReply(parsed.choice, update.updateId);
  }

  private handleUtilityCommand(
    update: TelegramUpdateEnvelope,
  ): BotReply | null {
    const result = parseUtilityCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    const command = result.command;

    switch (command.kind) {
      case "calc": {
        const outcome = evaluateExpression(command.expression);

        if (!outcome.ok) {
          return {
            text:
              outcome.reason === "division-by-zero"
                ? "🧮 División entre cero: ni yo puedo con eso."
                : "🧮 Expresión inválida. Ejemplo: /calc (2+3)*4",
          };
        }

        // Plain text: the expression is user input and routinely contains `*`
        // (multiplication) which would break Markdown parsing.
        return {
          text: `🧮 ${command.expression} = ${formatCalcResult(outcome.value)}`,
        };
      }
      case "id": {
        const lines = [
          "🪪 *Identificadores*",
          `Usuario: \`${update.user.userId?.toString() ?? "?"}\``,
          ...(update.user.username
            ? [`Username: @${update.user.username}`]
            : []),
          `Chat: \`${update.chat.chatId?.toString() ?? "?"}\``,
          ...(update.messageId ? [`Mensaje: \`${update.messageId}\``] : []),
        ];
        return { text: lines.join("\n"), parseMode: "Markdown" };
      }
      case "pick":
        return {
          text: `🎯 Elijo: ${pickOption(command.options, update.updateId) ?? "nada"}`,
        };
      case "b64":
        return { text: toBase64(command.text) };
      case "unb64": {
        const decoded = fromBase64(command.text);
        return { text: decoded.ok ? decoded.text : "No es base64 válido." };
      }
      case "hash":
        return {
          text: `sha256: \`${sha256Hex(command.text)}\``,
          parseMode: "Markdown",
        };
      case "reverse":
        return { text: [...command.text].reverse().join("") };
      case "len":
        return { text: `${[...command.text].length} caracteres` };
      case "upper":
        return { text: command.text.toUpperCase() };
      case "lower":
        return { text: command.text.toLowerCase() };
      case "password":
        return {
          text: `🔐 \`${generatePassword(command.length, randomInt(1, 2147483647))}\`\nBorra este mensaje después de copiarla.`,
          parseMode: "Markdown",
        };
    }
  }

  /**
   * El mapa de fuentes de confianza de este chat, atado ya a su tenant.
   *
   * Fuera de un grupo devuelve `undefined` y el módulo calcula sin guardar,
   * que es lo que hacia el `if (context.chatId)` del caso antes de salir.
   */
  // El prefijo `puertoDe` no es decoracion: `utility-plus-permisos.test.ts`
  // lo usa para saber que un `case` escribe aunque la escritura ya no este a
  // la vista dentro del case. Ver el comentario de ESCRITURA alli.
  private puertoDeFuentesDeConfianza(
    context: FoundationContext,
  ): FuentesDeConfianzaPort | undefined {
    const chatId = context.chatId;
    if (!chatId) {
      return undefined;
    }
    return fuentesDeConfianzaConAjustes(
      () =>
        this.chatSettingRepository.getValue(
          context.tenantId,
          chatId,
          "trusted_sources",
        ),
      async (valor: unknown) => {
        await this.chatSettingRepository.setValue(
          context.tenantId,
          chatId,
          "trusted_sources",
          valor,
        );
      },
    );
  }

  /** Las explicaciones oficiales de las reglas de este chat. */
  private puertoDeExplicacionesDeRegla(
    context: FoundationContext,
  ): ExplicacionesDeReglaPort | undefined {
    const chatId = context.chatId;
    if (!chatId) {
      return undefined;
    }
    return explicacionesDeReglaConAjustes(
      () =>
        this.chatSettingRepository.getValue(
          context.tenantId,
          chatId,
          "rule_explanation",
        ),
      async (valor: unknown) => {
        await this.chatSettingRepository.setValue(
          context.tenantId,
          chatId,
          "rule_explanation",
          valor,
        );
      },
    );
  }

  private async handleUtilityPlusCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const name = update.command?.name;
    if (!name) {
      return null;
    }
    const args = update.command?.args ?? [];

    // Puerta de autorizacion para los comandos que escriben. Ver
    // COMANDOS_UTILITY_PLUS_CON_EFECTO: hasta ahora este metodo no comprobaba
    // permisos en ninguno de sus 124 casos, y ocho de ellos cambian ajustes de
    // moderacion, cierran temas del foro o dejan el grupo entero en solo
    // lectura. El mensaje de rechazo es el mismo que usa el resto del servicio.
    if (
      COMANDOS_UTILITY_PLUS_CON_EFECTO.has(name) &&
      !(await this.isActorAdmin(context, update))
    ) {
      return { text: "No tienes permisos para moderar." };
    }

    switch (name) {
      case "rango_accion":
        return { text: calculadoraDeRangoDeAccion(args) };
      case "fase_dia": {
        const rules = rulesForDayPhase(new Date().getHours());
        if (context.chatId) {
          await this.chatSettingRepository.setValue(
            context.tenantId,
            context.chatId,
            "day_phase",
            { phase: rules.phase, strictness: rules.strictness },
          );
        }
        return {
          text: `🕐 Fase: ${rules.phase} · Rigor: ${rules.strictness}`,
        };
      }
      case "horario":
        return { text: calculadoraDeHorario(new Date().getHours()) };
      case "permiso":
        return { text: calculadoraDePermiso(args) };
      case "regla_natural":
        return { text: calculadoraDeReglaNatural(args) };
      case "sancion_duracion":
        return {
          text: calculadoraDeDuracionDeSancion(args, new Date().getHours()),
        };
      case "sancion_ajustar":
        return { text: calculadoraDeAjusteDeSancion(args) };
      case "proporcionalidad":
        return { text: calculadoraDeProporcionalidad(args) };
      case "confianza_decision":
        return { text: calculadoraDeConfianzaDeDecision(args) };
      case "grupo_abandonado":
        return { text: calculadoraDeGrupoAbandonado(args, Date.now()) };
      case "enfado":
        return { text: calculadoraDeEnfado(args) };
      case "vista_anuncio":
        return { text: calculadoraDeVistaDeAnuncio(args) };
      case "prueba_antibot":
        return { text: calculadoraDePruebaAntibot(args) };
      case "peticion_copia":
        return { text: calculadoraDePeticionDeCopia(args) };
      case "racha_sin_sancion":
        return { text: calculadoraDeRachaSinSancion(args) };
      case "clasificar_apelacion":
        return { text: calculadoraDeCategoriaDeApelacion(args) };
      case "eta_apelacion":
        return { text: calculadoraDeEtaDeApelacion(args) };
      case "aprendizaje_apelacion":
        return { text: calculadoraDeAprendizajeDeApelacion(args) };
      case "resumen_apelacion":
        return { text: calculadoraDeResumenDeApelacion(args) };
      case "mediacion":
        return { text: calculadoraDeMediacion(args) };
      case "checklist_ban":
        return { text: calculadoraDeChecklistDeBan(args) };
      case "progreso_boss":
        return { text: calculadoraDeProgresoDeBoss(args) };
      case "error_bot":
        return { text: calculadoraDeErrorDelBot(args) };
      case "sensibilidad_caso":
        return { text: calculadoraDeSensibilidadDeCaso(args) };
      case "acuerdo_convivencia":
        return { text: calculadoraDeAcuerdoDeConvivencia(args) };
      case "recompensa_colectiva":
        return { text: calculadoraDeRecompensaColectiva(args) };
      case "convertir_sancion":
        return { text: calculadoraDeConversionDeSancion(args) };
      case "comprar_cosmetico":
        return { text: calculadoraDeCompraDeCosmetico(args) };
      case "cupo_diario":
        return { text: calculadoraDeCupoDiario(args) };
      case "calidad_datos":
        return { text: calculadoraDeCalidadDeDatos(args) };
      case "duelo_debate":
        return { text: calculadoraDeDueloDeDebate(args) };
      case "desescalar":
        return { text: calculadoraDeDesescalada(args) };
      case "apelacion_delicada":
        return { text: calculadoraDeApelacionDelicada(args) };
      case "ayuda_discreta":
        return { text: calculadoraDeAyudaDiscreta(args) };
      case "caducidad_anuncio":
        return { text: calculadoraDeCaducidadDeAnuncio(args, Date.now()) };
      case "reputacion_contenido":
        return {
          text: await registrarReputacionDeFuente(
            args,
            this.puertoDeFuentesDeConfianza(context),
          ),
        };
      case "doble_rep":
        return { text: calculadoraDeDobleReputacion(args) };
      case "cooldown_dinamico":
        return { text: calculadoraDeCooldownDinamico(args) };
      case "aviso_educativo":
        return { text: calculadoraDeAvisoEducativo(args) };
      case "permiso_emergencia":
        return { text: calculadoraDePermisoDeEmergencia(args) };
      case "gastar_energia":
        return { text: calculadoraDeGastoDeEnergia(args) };
      case "modo_evento": {
        const event = args[0];
        const validEvents = new Set([
          "directo",
          "sorteo",
          "raid",
          "clase",
          "normal",
        ]);
        if (!event || !validEvents.has(event)) {
          return {
            text: "Uso: /modo_evento <directo|sorteo|raid|clase|normal>",
          };
        }
        const rules = rulesForManualEvent(event as ManualEvent);
        if (context.chatId) {
          await this.chatSettingRepository.setValue(
            context.tenantId,
            context.chatId,
            "manual_event",
            { event, strict: rules.strict },
          );
        }
        return {
          text: `🎬 ${rules.event}: ${rules.strict ? "estricto" : "normal"} · ${rules.note}`,
        };
      }
      case "modo_examen": {
        const hourOfDay = args[0]
          ? Number.parseInt(args[0], 10)
          : new Date().getHours();
        if (Number.isNaN(hourOfDay)) {
          return { text: "Uso: /modo_examen [hora 0-23]" };
        }
        const rules = rulesForExamMode(hourOfDay);
        if (context.chatId) {
          await this.chatSettingRepository.setValue(
            context.tenantId,
            context.chatId,
            "exam_mode",
            { active: rules.active, blocked: rules.blocked },
          );
        }
        return {
          text: rules.active
            ? `📝 Modo examen activo. Bloqueado: ${rules.blocked.join(", ")}`
            : "📝 Modo examen inactivo a esta hora.",
        };
      }
      case "razon_sancion":
        return { text: calculadoraDeRazonDeSancion(args) };
      case "sancion_juego":
        return { text: calculadoraDeSancionDeJuego(args) };
      case "retencion_juegos":
        return { text: calculadoraDeRetencionDeJuegos(args) };
      case "ventana_gracia":
        return { text: calculadoraDeVentanaDeGracia(args, Date.now()) };
      case "consejos_crecimiento":
        return { text: calculadoraDeConsejosDeCrecimiento(args) };
      case "escalar_humano":
        return { text: calculadoraDeEscaladaAHumano(args) };
      case "stats_humanizadas":
        return { text: calculadoraDeStatsHumanizadas(args) };
      case "medidor_hype":
        return { text: calculadoraDeMedidorDeHype(args) };
      case "patron_imposible":
        return { text: calculadoraDePatronImposible(args) };
      case "guardia_impulsivo":
        return { text: calculadoraDeGuardiaImpulsivo(args) };
      case "escalar_owner":
        return { text: calculadoraDeEscaladaAlOwner(args, Date.now()) };
      case "estado_incidencia":
        return { text: calculadoraDeEstadoDeIncidencia(args) };
      case "pregunta_completa":
        return { text: calculadoraDePreguntaCompleta(args) };
      case "config_intencion":
        return { text: calculadoraDeIntencionDeConfig(args) };
      case "nivel_conocimiento":
        return { text: calculadoraDeNivelDeConocimiento(args) };
      case "incidencia_conocida":
        return { text: calculadoraDeIncidenciaConocida(args) };
      case "ultima_oportunidad":
        return { text: calculadoraDeUltimaOportunidad(args) };
      case "aviso_aprendizaje":
        return { text: calculadoraDeAvisoDeAprendizaje(args) };
      case "items_legendarios":
        return { text: calculadoraDeItemsLegendarios(args) };
      case "sandbox_enlace":
        return { text: calculadoraDeSandboxDeEnlace(args) };
      case "desbloquear_enlaces":
        return { text: calculadoraDeDesbloqueoDeEnlaces(args) };
      case "agrupar_reportes":
        return { text: calculadoraDeAgrupacionDeReportes(args) };
      case "adivina_stat": {
        const guess = Number.parseFloat(args[0] ?? "");
        if (Number.isNaN(guess)) {
          return { text: "Uso: /adivina_stat <adivinado>" };
        }
        if (!context.chatId) {
          return { text: "Las estadísticas se miden dentro de un grupo." };
        }
        const now = Date.now();
        const yesterdayKey = dayKeyFromMs(now - 86_400_000);
        const recentDays = await this.analyticsRepository.getRecentDays(
          context.chatId,
          3,
        );
        const actual =
          recentDays.find((row) => row.day === yesterdayKey)?.messages ?? 0;
        const result = scoreStatGuess({ guess, actual });
        return {
          text: result.correct
            ? `✅ Correcto (${result.points} puntos). Ayer se enviaron ${actual} mensajes en el grupo.`
            : `❌ Fallado por ${result.offBy}. Ayer se enviaron ${actual} mensajes en el grupo.`,
        };
      }
      case "aviso_mantenimiento":
        return { text: calculadoraDeAvisoDeMantenimiento(args, Date.now()) };
      case "relectura_obligatoria":
        return { text: calculadoraDeRelecturaObligatoria(args) };
      case "carta_miembro":
        return { text: calculadoraDeCartaDeMiembro(args) };
      case "objetivo_miembro":
        return { text: calculadoraDeObjetivoDeMiembro(args) };
      case "escudo_menciones":
        return { text: calculadoraDeEscudoDeMenciones(args) };
      case "comparar_meses":
        return { text: calculadoraDeComparacionDeMeses(args) };
      case "logros_negativos":
        return { text: calculadoraDeLogrosNegativos(args) };
      case "dominio_nuevo":
        return { text: calculadoraDeDominioNuevo(args) };
      case "diagnostico_observacion":
        return { text: calculadoraDeDiagnosticoDeObservacion(args) };
      case "fuera_tema_estudio":
        return { text: calculadoraDeFueraDeTemaDeEstudio(args) };
      case "checklist_bienvenida":
        return { text: calculadoraDeChecklistDeBienvenida(args) };
      case "sesgo_operativo":
        return { text: calculadoraDeSesgoOperativo(args) };
      case "exceso_config":
        return { text: calculadoraDeExcesoDeConfig(args) };
      case "owner_ausente":
        return { text: calculadoraDeOwnerAusente(args) };
      case "checklist_owner":
        return { text: calculadoraDeChecklistDeOwner(args) };
      case "mentor_owner":
        return { text: calculadoraDeMentorDeOwner(args) };
      case "resumen_owner":
        return { text: calculadoraDeResumenDeOwner(args) };
      case "revision_entre_pares":
        return { text: calculadoraDeRevisionEntrePares(args) };
      case "explicar_permiso":
        return { text: calculadoraDeExplicacionDePermiso(args) };
      case "informe_lanzamiento":
        return { text: calculadoraDeInformeDeLanzamiento(args) };
      case "prestigio":
        return { text: calculadoraDePrestigio(args) };
      case "puntuar_duda":
        return { text: calculadoraDePuntuacionDeDuda(args) };
      case "periodo_prueba":
        return { text: calculadoraDePeriodoDePrueba(args, Date.now()) };
      case "resumen_publicacion":
        return { text: calculadoraDeResumenDePublicacion(args) };
      case "patron_cuarentena":
        return { text: calculadoraDePatronDeCuarentena(args) };
      case "modo_solo_lectura": {
        const apiErrorRate = Number.parseFloat(args[0] ?? "");
        if (Number.isNaN(apiErrorRate)) {
          return { text: "Uso: /modo_solo_lectura <tasa_error_api 0-1>" };
        }
        const decision = decideReadOnly({ apiErrorRate });
        if (decision.readOnly && context.chatId && update.chat.chatId) {
          await this.telegramGateway.setChatPermissions({
            chatId: update.chat.chatId,
            permissions: {
              can_send_messages: false,
              can_send_audios: false,
              can_send_documents: false,
              can_send_photos: false,
              can_send_videos: false,
              can_send_video_notes: false,
              can_send_voice_notes: false,
              can_send_polls: false,
              can_send_other_messages: false,
              can_add_web_page_previews: false,
            },
            token: this.telegramToken(),
          });
          await this.chatSettingRepository.setValue(
            context.tenantId,
            context.chatId,
            "read_only_mode",
            { active: true, reason: decision.reason },
          );
        }
        return { text: decision.reason };
      }
      case "cebo_respuesta":
        return { text: calculadoraDeCeboDeRespuesta(args) };
      case "revivir_silencio": {
        if (!context.chatId) {
          return { text: "Este comando solo funciona dentro de un grupo." };
        }
        const recent = await this.chatActivityRepository.listRecent(
          context.tenantId,
          context.chatId,
          "message",
          1,
        );
        // checkReviveSilence treats a non-finite input as "unknown, don't
        // revive" — a chat with literally no recorded activity is the
        // opposite case (maximally silent), so it must be a large FINITE
        // number, not Infinity.
        const minutesSinceLastMessage = recent[0]
          ? (Date.now() - recent[0].createdAt.getTime()) / 60_000
          : 999_999;
        const decision = checkReviveSilence({ minutesSinceLastMessage });
        return {
          text: decision.revive
            ? decision.prompt
            : "Todavía no hace falta reactivar el grupo.",
        };
      }
      case "anuncios_por_rol":
        return { text: calculadoraDeAnunciosPorRol(args) };
      case "efecto_regla":
        return { text: calculadoraDeEfectoDeRegla(args) };
      case "cooldown_regla":
        return { text: calculadoraDeCooldownDeRegla(args, Date.now()) };
      case "validar_explicacion":
        return {
          text: await registrarExplicacionDeRegla(
            args,
            this.puertoDeExplicacionesDeRegla(context),
          ),
        };
      case "severidad_regla":
        return { text: calculadoraDeSeveridadDeRegla(args) };
      case "efecto_sancion":
        return { text: calculadoraDeEfectoDeSancion(args) };
      case "firma_sancion":
        return { text: calculadoraDeFirmaDeSancion(args) };
      case "modo_ahorro":
        return { text: calculadoraDeModoAhorro(args) };
      case "logros_secretos":
        return { text: calculadoraDeLogrosSecretos(args) };
      case "auto_beneficio":
        return { text: calculadoraDeAutoBeneficio(args) };
      case "anuncio_sensible":
        return { text: calculadoraDeAnuncioSensible(args) };
      case "sensibilidad_hilo":
        return { text: calculadoraDeSensibilidadDeHilo(args) };
      case "color_severidad":
        return { text: calculadoraDeColorDeSeveridad(args) };
      case "celebracion_silenciosa":
        return { text: calculadoraDeCelebracionSilenciosa(args) };
      case "spam_silencioso":
        return { text: calculadoraDeSpamSilencioso(args) };
      case "recomendacion_tamano":
        return { text: calculadoraDeRecomendacionPorTamano(args) };
      case "estabilidad_social":
        return { text: calculadoraDeEstabilidadSocial(args) };
      case "suavizar_sancion":
        return { text: calculadoraDeSancionSuavizada(args) };
      case "filtro_spoiler":
        return { text: calculadoraDeFiltroDeSpoiler(args) };
      case "burnout_staff":
        return { text: calculadoraDeBurnoutDeStaff(args) };
      case "confianza_staff":
        return { text: calculadoraDeConfianzaDeStaff(args) };
      case "logros_racha":
        return { text: calculadoraDeLogrosDeRacha(args) };
      case "seguimiento_ticket":
        return { text: calculadoraDeSeguimientoDeTicket(args, Date.now()) };
      case "cerrar_topic": {
        const heat = Number.parseFloat(args[0] ?? "");
        const messagesPerMin = Number.parseFloat(args[1] ?? "");
        if (Number.isNaN(heat) || Number.isNaN(messagesPerMin)) {
          return { text: "Uso: /cerrar_topic <calor> <mensajes_por_min>" };
        }
        const decision = shouldCloseTopic({ heat, messagesPerMin });
        if (
          decision.close &&
          update.chat.chatId &&
          update.chat.topicId !== undefined
        ) {
          await this.telegramGateway.closeForumTopic({
            chatId: update.chat.chatId,
            messageThreadId: update.chat.topicId,
            token: this.telegramToken(),
          });
        }
        return { text: decision.reason };
      }
      case "uso_indebido_topic":
        return { text: calculadoraDeUsoIndebidoDeTopic(args) };
      case "comparar_grupos_gemelos":
        return { text: calculadoraDeComparacionDeGemelos(args) };
      case "separacion_activa":
        return { text: calculadoraDeSeparacionActiva(args, Date.now()) };
      case "trato_vip":
        return { text: calculadoraDeTratoVip(args) };
      case "activar_proteccion_volumen": {
        const baseline = Number.parseFloat(args[0] ?? "");
        const current = Number.parseFloat(args[1] ?? "");
        if (Number.isNaN(baseline) || Number.isNaN(current)) {
          return {
            text: "Uso: /activar_proteccion_volumen <base> <actual>",
          };
        }
        const result = shouldActivateVolumeProtection({ baseline, current });
        if (result.activate && context.chatId) {
          const currentFlood =
            (await this.antifloodRepository.getConfig(
              context.tenantId,
              context.chatId,
            )) ?? defaultAntifloodSettings;
          await this.antifloodRepository.upsertConfig(
            context.tenantId,
            context.chatId,
            {
              enabled: true,
              messageLimit: clampFloodLimit(
                Math.round(currentFlood.messageLimit / 2),
              ),
            },
          );
        }
        return {
          text: result.activate
            ? `🚨 Protección extra activada (ratio ${result.ratio})`
            : `🟢 Volumen normal (ratio ${result.ratio})`,
        };
      }
      case "rompehielo":
        return { text: calculadoraDeRompehielo(args, update.updateId) };
      default:
        return null;
    }
  }

  /**
   * Most-recent username seen per telegram user id across a chat-activity
   * window, so reports can render "@handle" instead of a raw numeric id.
   * Entries arrive newest-first, so the first username seen per user wins.
   */
  private activityUsernames(
    entries: readonly ChatActivityEntry[],
  ): Map<string, string> {
    const names = new Map<string, string>();
    for (const entry of entries) {
      if (entry.telegramUserId === undefined || !entry.username) {
        continue;
      }
      const id = entry.telegramUserId.toString();
      if (!names.has(id)) {
        names.set(id, entry.username);
      }
    }
    return names;
  }

  /** Renders a telegram user id as "@handle" when known, else "usuario <id>". */
  private renderActivityUser(
    id: string,
    names: ReadonlyMap<string, string>,
  ): string {
    const username = names.get(id);
    return username ? `@${username}` : `usuario ${id}`;
  }

  /**
   * Reports backed by data the bot already persists (real stored appeals and
   * the group's own rules text), as opposed to handleUtilityPlusCommand's
   * calculators which only need the command's own arguments.
   */
  /**
   * Los informes de staff: apelaciones, casos, sanciones, tickets y analitica
   * de conversacion.
   *
   * **Los 25 comandos piden ser admin**, y hasta ahora ninguno pedia nada.
   *
   * El mismo dato ya estaba detras de la puerta fuerte por el otro camino:
   * `/apelacion list` pasa por `ensureConfigPermission(..., "d1.appeals")` y
   * el callback de resolverlas exige `isActorAdmin`. Desde aqui se leia lo
   * mismo sin nada.
   *
   * Y no se quedaba en el grupo: `listAppeals` devuelve tambien las filas con
   * `chatId: null`, que son las apelaciones abiertas **en privado**, y hay un
   * solo tenant por bot. Asi que cualquiera que abriera un DM con el bot y
   * escribiera `/apelaciones_por_incidente` recibia todas las apelaciones
   * privadas del despliegue entero, con referencia de caso y el id de Telegram
   * de quien apelo. Sin estar en ningun grupo.
   *
   * Es la cuarta puerta de la misma familia, despues de `backup/import`,
   * `clone` y `leave`: el mismo estado protegido por una via y abierto por
   * otra.
   */
  private async handleDataReportsCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const name = update.command?.name;
    if (!name || !context.chatId) {
      return null;
    }

    if (!COMANDOS_DE_INFORME.has(name)) {
      return null;
    }

    // La guarda va DESPUES de comprobar que el comando es de los nuestros: si
    // no, cada mensaje con cualquier otro comando pagaria una consulta de
    // permisos por pasar por aqui.
    if (!(await this.isActorAdmin(context, update))) {
      return { text: "Estos informes son para el staff del grupo." };
    }

    const args = update.command?.args ?? [];

    switch (name) {
      // Los tres informes de apelaciones salen de la MISMA consulta y solo
      // cambian en como la resumen, asi que se busca una vez. Antes cada
      // caso repetia `listAppeals` y llevaba su texto pegado dentro.
      //
      // Los tres formatos viven en `modules/support`.
      case "informe_apelaciones_aceptadas":
      case "historial_apelaciones":
      case "apelaciones_por_incidente": {
        const apelaciones = (
          await this.d1Repository.listAppeals(context.tenantId, context.chatId)
        ).map((a) => ({
          aceptada: a.status === "accepted",
          caso: a.caseRef,
          deUsuario: Number(a.appellantTelegramId),
        }));

        if (name === "informe_apelaciones_aceptadas") {
          return { text: informeDeApelacionesAceptadas(apelaciones) };
        }
        if (name === "historial_apelaciones") {
          return { text: historialDeApelaciones(apelaciones) };
        }
        return { text: apelacionesPorIncidente(apelaciones) };
      }
      // Las dos leen el mismo texto de normas y lo troceaban igual: una
      // linea es una norma y las vacias no cuentan. Esa decision vive ahora
      // en `modules/community` y no copiada aqui dos veces.
      case "buscar_regla":
      case "reglas_movil": {
        const normas = normasDelTexto(
          (await this.welcomeRepository.getConfig(context.chatId))?.rulesText,
        );
        return name === "buscar_regla"
          ? {
              text: informeDeBusquedaDeRegla(normas, args.join(" ").trim()),
            }
          : { text: informeDeReglasEnMovil(normas) };
      }
      case "historial_cliente": {
        const respondidoA = extractReplyContext(update.raw).userId;
        const deQuien = respondidoA
          ? BigInt(respondidoA)
          : idDeTelegramDelArgumento(args[0]);
        if (deQuien === undefined) {
          return {
            text: "Uso: /historial_cliente <telegram_id> (o responde a un usuario)",
          };
        }
        const tickets = await this.ticketRepository.listByReporter(
          context.tenantId,
          deQuien,
        );
        return {
          text: informeDeHistorialDeCliente(
            tickets.map((ticket) => ({ estado: ticket.status })),
          ),
        };
      }
      // Los tres informes de actividad miran LOS MISMOS mensajes. Antes cada
      // caso hacia su consulta y llevaba su texto pegado dentro.
      //
      // El nombre de cada persona lo resuelve el nucleo y se pasa como
      // funcion: traducir un id a un `@usuario` es traduccion, no decision.
      case "mapa_calor":
      case "participacion":
      case "senal_acoso": {
        const filas = await this.chatActivityRepository.listRecent(
          context.tenantId,
          context.chatId,
          "message",
          500,
        );
        const nombres = this.activityUsernames(filas);
        const nombreDe = (id: string): string =>
          this.renderActivityUser(id, nombres);
        const actividad = filas.map((fila) => ({
          autorId:
            fila.telegramUserId === undefined
              ? undefined
              : fila.telegramUserId.toString(),
          respondeAId:
            fila.repliedToUserId === undefined
              ? undefined
              : fila.repliedToUserId.toString(),
          texto: fila.text ?? "",
          enMs: fila.createdAt.getTime(),
        }));

        if (name === "mapa_calor") {
          const zonaArg = args[0];
          const desfase =
            zonaArg !== undefined && /^-?\d{1,4}$/u.test(zonaArg)
              ? Number(zonaArg)
              : 0;
          return { text: informeDeMapaDeCalor(actividad, desfase) };
        }
        if (name === "participacion") {
          return { text: informeDeParticipacion(actividad, nombreDe) };
        }
        return {
          text: informeDeSenalDeAcoso(actividad, Date.now(), nombreDe),
        };
      }
      case "spam_firma": {
        const vistos = await this.chatActivityRepository.listRecent(
          context.tenantId,
          context.chatId,
          "message",
          500,
        );
        const nombres = this.activityUsernames(vistos);
        return {
          text: informeDeFirmasDeSpam(
            vistos.map((f) => ({
              autorId:
                f.telegramUserId === undefined
                  ? undefined
                  : Number(f.telegramUserId),
              texto: f.text ?? "",
              tieneEnlace: f.hasLink ?? false,
              enMs: f.createdAt.getTime(),
            })),
            (id) => this.renderActivityUser(id, nombres),
          ),
        };
      }
      // Los tres informes de temas de foro miran LOS MISMOS mensajes y los
      // tres empiezan descartando lo que no tiene tema. Antes cada caso
      // hacia su consulta, su bucle de agregacion y llevaba su texto dentro.
      case "crossposting":
      case "temas_emergentes":
      case "temas_inactivos": {
        const conTema = (
          await this.chatActivityRepository.listRecent(
            context.tenantId,
            context.chatId,
            "message",
            500,
          )
        )
          .filter((fila) => fila.topic !== undefined)
          .map((fila) => ({
            temaId: String(fila.topic),
            texto: fila.text ?? "",
            enMs: fila.createdAt.getTime(),
          }));

        if (name === "crossposting") {
          return { text: informeDeCrossposting(conTema) };
        }
        if (name === "temas_emergentes") {
          return { text: informeDeTemasEmergentes(conTema, Date.now()) };
        }

        const diasArg = args[0];
        const dias =
          diasArg !== undefined && /^\d{1,3}$/u.test(diasArg)
            ? Number(diasArg)
            : 7;
        return {
          text: informeDeTemasInactivos(conTema, Date.now(), dias),
        };
      }
      case "fantasmas": {
        const [entradas, mensajes] = await Promise.all([
          this.chatActivityRepository.listRecent(
            context.tenantId,
            context.chatId,
            "new_member",
            500,
          ),
          this.chatActivityRepository.listRecent(
            context.tenantId,
            context.chatId,
            "message",
            500,
          ),
        ]);
        const nombres = this.activityUsernames(mensajes);
        return {
          text: informeDeFantasmas(
            entradas.map((f) => ({
              autorId: f.telegramUserId?.toString(),
              enMs: f.createdAt.getTime(),
            })),
            mensajes.map((f) => ({
              autorId: f.telegramUserId?.toString(),
              enMs: f.createdAt.getTime(),
            })),
            Date.now(),
            (id) => this.renderActivityUser(id, nombres),
          ),
        };
      }
      case "reaccion_abuso": {
        const reacciones = await this.chatActivityRepository.listRecent(
          context.tenantId,
          context.chatId,
          "reaction",
          500,
        );
        const nombres = this.activityUsernames(reacciones);
        return {
          text: informeDeAbusoDeReacciones(
            reacciones.map((f) => ({
              autorId: f.telegramUserId?.toString(),
              respondeAId: undefined,
              texto: f.text ?? "",
              enMs: f.createdAt.getTime(),
            })),
            Date.now(),
            (id) => this.renderActivityUser(id, nombres),
          ),
        };
      }
      // Los cinco informes de patron miran LOS MISMOS mensajes recientes.
      // Antes cada caso hacia su propia consulta y repetia el mismo
      // `.filter().reverse().map()` palabra por palabra: cinco viajes a la
      // base para leer las mismas filas.
      //
      // El `.reverse()` no es cosmetico: el repositorio devuelve del mas
      // nuevo al mas viejo y los detectores esperan lo contrario.
      case "discusion_circular":
      case "copia_pega":
      case "spam_saludo":
      case "ritmo_humano":
      case "escalada_broma": {
        const recientes = (
          await this.chatActivityRepository.listRecent(
            context.tenantId,
            context.chatId,
            "message",
          )
        )
          .reverse()
          .map((fila) => ({
            autorId:
              fila.telegramUserId === undefined
                ? undefined
                : Number(fila.telegramUserId),
            texto: fila.text ?? "",
            tieneEnlace: fila.hasLink,
            enMs: fila.createdAt.getTime(),
          }));

        if (name === "discusion_circular") {
          return { text: informeDeDiscusionCircular(recientes) };
        }
        if (name === "copia_pega") {
          return { text: informeDeCopiaPega(recientes) };
        }
        if (name === "spam_saludo") {
          return { text: informeDeSpamDeSaludo(recientes) };
        }
        if (name === "escalada_broma") {
          return { text: informeDeEscaladaDeBroma(recientes) };
        }

        // `ritmo_humano` es el unico que apunta a alguien concreto.
        const aQuien = idDeTelegramDelArgumento(args[0]);
        if (aQuien === undefined) {
          return { text: "Uso: /ritmo_humano <telegram_id>" };
        }
        return {
          text: informeDeRitmoHumano(recientes, Number(aQuien)),
        };
      }
      // Las dos salen de la misma consulta y las dos descartan los casos sin
      // motivo. Antes cada una repetia la consulta y el filtro.
      case "tipos_conflicto":
      case "reglas_rotas": {
        const conMotivo = (
          await this.moderationRepository.listRecentCases(
            context.tenantId,
            context.chatId,
          )
        )
          .filter((caso) => Boolean(caso.reason))
          .map((caso) => ({ motivo: caso.reason ?? "sin_motivo" }));

        return name === "tipos_conflicto"
          ? { text: informeDeTiposDeConflicto(conMotivo) }
          : { text: informeDeReglasRotas(conMotivo) };
      }
      case "miembros_inactivos": {
        const vistos = await this.chatActivityRepository.listRecent(
          context.tenantId,
          context.chatId,
          "message",
          500,
        );
        const nombres = this.activityUsernames(vistos);
        return {
          text: informeDeMiembrosInactivos(
            vistos.map((f) => ({
              autorId: f.telegramUserId?.toString(),
              enMs: f.createdAt.getTime(),
            })),
            Date.now(),
            (id) => this.renderActivityUser(id, nombres),
          ),
        };
      }
      case "acciones_revertidas": {
        const sanciones =
          await this.moderationRepository.listRecentSanctionsForChat(
            context.tenantId,
            context.chatId,
          );
        return {
          text: informeDeAccionesRevertidas(
            sanciones.map((s) => ({
              tipo: s.kind,
              revertida: s.status === "reverted",
            })),
          ),
        };
      }
      case "tablero_casos": {
        const tickets = await this.ticketRepository.listRecent(
          context.tenantId,
          context.chatId,
        );
        return {
          text: informeDeTableroDeCasos(
            tickets.map((ticket) => ({
              numero: ticket.number.toString(),
              estado: ticket.status,
              prioridad: ticket.priority,
              abiertoEnMs: ticket.createdAt.getTime(),
            })),
            Date.now(),
          ),
        };
      }
      default:
        return null;
    }
  }

  /**
   * AFK without anyone having to know a command exists: saying "brb" or "me voy
   * a dormir" marks you away, and your next message announces you are back.
   *
   * Runs on ordinary messages, so it is deliberately quiet about failure and
   * strict about matching — see detectAfkPhrase for why a false positive (the
   * group told someone left while they are still typing) is the thing to avoid.
   */
  /**
   * `@all <mensaje>` — one announcement that actually notifies people.
   *
   * Admin-only, and not negotiable: a working "ping everyone" in the hands of
   * any member is a spam button.
   *
   * Honest about its reach. Telegram has no endpoint to list a chat's members,
   * so this can only mention people the bot has seen — everyone whose update
   * passed through ensureContext. Silent lurkers are invisible to it, and the
   * reply says how many were actually pinged rather than implying "everyone".
   */
  /** Per-chat introduction settings, in the shared chat_settings store — one
   * small object per chat, no table of its own. */
  private async introductionSettings(
    tenantId: string,
    chatId: string,
  ): Promise<IntroductionSettings> {
    const raw = await this.chatSettingRepository
      .getValue(tenantId, chatId, INTRODUCTION_SETTINGS_KEY)
      .catch(() => undefined);
    return parseIntroductionSettings(raw);
  }

  /**
   * Starts a newcomer's introduction clock and tells them what to send.
   *
   * The message states the consequence AND that it is reversible — being
   * removed for missing a deadline reads as a ban unless you say otherwise,
   * and someone who thinks they were banned does not come back.
   */
  private async handleIntroductionJoin(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    // On a service message the envelope's user IS the newcomer, so their
    // handle is the right one to store.
    return this.startIntroductionClock(
      context,
      update,
      update.newChatMemberIds.map((id) => ({
        id,
        ...(update.user.username ? { username: update.user.username } : {}),
        ...(update.user.firstName ? { firstName: update.user.firstName } : {}),
      })),
    );
  }

  /**
   * Puts newcomers on the introduction clock.
   *
   * Takes the arrivals explicitly rather than reading `newChatMemberIds`,
   * because that field is only ever filled by the `new_chat_members` service
   * message — and a group that admits people through approved join requests
   * never gets one. Hanging this off it meant the gate was enabled, shown in
   * the Mini App, and starting the clock for precisely nobody: on 2 Aug 2026
   * `introduction_pending` was empty in a group with the gate on.
   */
  private async startIntroductionClock(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    arrivals: readonly {
      readonly id: bigint;
      readonly username?: string;
      readonly firstName?: string;
    }[],
  ): Promise<BotReply | null> {
    const telegramChatId = update.chat.chatId;
    if (!telegramChatId || !context.chatId || arrivals.length === 0) {
      return null;
    }
    const settings = await this.introductionSettings(
      context.tenantId,
      context.chatId,
    );
    if (!settings.enabled) {
      return null;
    }
    const dueAt = new Date(Date.now() + settings.deadlineHours * 3_600_000);
    const names: string[] = [];
    for (const arrival of arrivals) {
      // Never put the bot itself on the clock.
      if (arrival.id === this.currentBotTelegramId()) {
        continue;
      }
      // Una misma llegada puede entrar por los DOS caminos (el mensaje de
      // servicio y el `chat_member`), y Telegram ademas reenvia updates que
      // cree no confirmados. La bienvenida ya tenia freno; esto no, y por eso
      // el aviso salia cuatro y cinco veces seguidas en Grupo Central.
      //
      // Si ya tiene el reloj puesto, no se vuelve a anunciar ni se le reinicia
      // el plazo: reiniciarlo le regalaria 12 horas nuevas en cada reenvio.
      const yaPendiente = await this.introductionRepository
        .find(context.tenantId, context.chatId, arrival.id)
        .catch(() => null);
      if (yaPendiente) {
        continue;
      }
      await this.introductionRepository
        .start({
          tenantId: context.tenantId,
          chatId: context.chatId,
          telegramChatId,
          telegramUserId: arrival.id,
          ...(arrival.username ? { username: arrival.username } : {}),
          dueAt,
        })
        .catch(() => undefined);
      // Con su nombre. "nuevo/a" a secas obligaba a adivinar a quien va
      // dirigido cuando entran dos personas seguidas.
      names.push(
        mentionHtml(
          arrival.id,
          arrival.firstName ??
            (arrival.username ? `@${arrival.username}` : "nuevo/a"),
        ),
      );
    }
    if (names.length === 0) {
      return null;
    }
    return {
      text: buildIntroductionPrompt(names.join(", "), settings),
      parseMode: "HTML",
    };
  }

  /**
   * Watches a pending newcomer's messages and closes their clock the moment
   * they say enough.
   *
   * Only ever runs for someone with an open row, so it costs one indexed lookup
   * per message from a brand-new member and nothing at all for everyone else.
   */
  private async handleIntroductionMessage(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const userId = update.user.userId;
    if (
      !userId ||
      !context.chatId ||
      update.kind !== "message" ||
      // "X se unió al grupo" es un mensaje sin texto y sin foto, asi que se
      // juzgaba como una presentación fallida: al recién llegado le saltaba
      // "te falta todo" en el mismo segundo de entrar, antes de escribir nada.
      isServiceMessage(update.raw)
    ) {
      return null;
    }
    const pending = await this.introductionRepository
      .find(context.tenantId, context.chatId, userId)
      .catch(() => null);
    if (!pending) {
      return null;
    }
    const settings = await this.introductionSettings(
      context.tenantId,
      context.chatId,
    );
    const result = checkIntroduction({
      text: [update.messageText, update.messageCaption]
        .filter(Boolean)
        .join(" "),
      // El mensaje que se les enseña dice "foto o vídeo", asi que un vídeo
      // TIENE que contar. Aceptar solo la foto convertia esa frase en una
      // trampa: quien hacia exactamente lo que se le pedia era expulsado.
      hasPhoto: update.content.hasPhoto || update.content.hasVideo,
      settings,
      nowYear: new Date().getFullYear(),
    });
    if (result.complete) {
      await this.introductionRepository
        .clear(context.tenantId, context.chatId, userId)
        .catch(() => undefined);
      await this.espejarPresentacion(context, update, settings, result.age);
      return {
        text: buildIntroductionAccepted(this.mentionFor(update.user)),
        parseMode: "HTML",
      };
    }
    // Nada mas. Antes se le corregia ("te falta la edad") en cada intento, y
    // Gerard lo corto: el aviso de entrada ya dice que hace falta, repetirlo
    // convierte cada conversacion en una regañina. Si no acierta, se queda con
    // su plazo y ya esta.
    return null;
  }

  /**
   * Copia al tema de presentaciones de STAFF la presentación que se acaba de
   * dar por buena.
   *
   * El tema donde caen las fichas de "no se ha presentado" contaba solo la
   * mitad de la historia: una lista de fallos, y ni rastro de las doscientas
   * presentaciones que sí salieron bien. Esto es lo que lo convierte en el
   * registro de quién ha entrado.
   *
   * Dos mensajes y no uno: primero el mensaje de la persona tal cual (foto y
   * pie sin tocar) y debajo la ficha que dice de quién era. `copyMessage`
   * acepta sustituir el pie, y hacerlo tiraría la mitad de la presentación.
   *
   * Best-effort de principio a fin: perder la copia no puede tumbar la
   * presentación, que es lo que de verdad importa. Pero el fallo se audita en
   * vez de tragarse — un espejo que deja de copiar en silencio es peor que no
   * tenerlo, porque el equipo sigue creyendo que está mirando todo lo que
   * entra.
   */
  private async espejarPresentacion(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    settings: IntroductionSettings,
    age: number | null,
  ): Promise<void> {
    const telegramUserId = update.user.userId;
    if (
      !settings.mirrorToStaff ||
      !context.chatId ||
      !update.chat.chatId ||
      !telegramUserId
    ) {
      return;
    }
    try {
      const guardian = await this.guardianRepository.getSettings(
        context.tenantId,
        context.chatId,
      );
      const staffChatId = guardian?.staffChatId;
      if (!staffChatId) {
        return;
      }
      // El tema propio de las presentaciones si el grupo lo ha puesto; si no,
      // el de Guardian, que es donde han ido siempre. `??` y no `||`: el 0 no
      // es un tema válido, pero tampoco puede colarse como "no configurado".
      const tema = settings.staffThreadId ?? guardian.staffThreadId;
      const token = this.telegramToken();
      const hilo = tema != null ? { messageThreadId: tema } : {};

      // La copia primero, la ficha debajo: al revés, en un tema con varias
      // presentaciones seguidas, cada foto queda pegada a la ficha de la
      // persona ANTERIOR.
      let copiado = false;
      if (update.messageId !== undefined) {
        copiado = await this.telegramGateway
          .copyMessage({
            chatId: staffChatId,
            fromChatId: update.chat.chatId,
            messageId: update.messageId,
            token,
            ...hilo,
          })
          .then((resultado) => resultado.ok)
          .catch(() => false);
      }

      await this.telegramGateway.sendMessage({
        chatId: staffChatId,
        token,
        ...hilo,
        reply: {
          text: buildIntroductionMirrorCard({
            telegramUserId,
            displayName: describeUser(update.user),
            username: update.user.username ?? null,
            age,
            chatTitle: update.chat.chatTitle ?? null,
            copied: copiado,
          }),
          parseMode: "HTML",
          replyMarkup: buildIntroductionMirrorKeyboard(
            update.messageId === undefined
              ? null
              : buildTelegramMessageLink({
                  chatId: update.chat.chatId,
                  messageId: update.messageId,
                  topicId: update.chat.topicId,
                }),
          ),
        },
      });
    } catch (error) {
      await this.repository
        .recordAudit({
          tenantId: context.tenantId,
          actorType: "system",
          action: "introduction.mirror_failed",
          resourceType: "chat",
          resourceId: context.chatId,
          payload: {
            telegramUserId: update.user.userId?.toString(),
            error: error instanceof Error ? error.message : "unknown",
          },
        })
        .catch(() => undefined);
    }
  }

  /**
   * `/presentaciones` — enciende, apaga y reubica el espejo de presentaciones.
   *
   * El número del tema se saca con `/topicid` dentro del tema, porque la Bot
   * API no lista los temas de un foro: no hay forma de ofrecer un desplegable.
   *
   * Mueve el tema de las DOS cosas — las copias y las fichas de "no se ha
   * presentado" — a propósito: son las dos caras del mismo registro y quien
   * abre ese tema viene a leerlas juntas.
   */
  private async handleIntroductionMirrorCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const command = parseIntroductionMirrorCommand(
      update.command?.name,
      update.command?.args ?? [],
    );
    if (!command) {
      return null;
    }
    if (!context.chatId) {
      return { text: "Esto se configura dentro de un grupo." };
    }

    const guardian = await this.guardianRepository.getSettings(
      context.tenantId,
      context.chatId,
    );
    const staffChatConfigured = Boolean(guardian?.staffChatId);
    const actuales = await this.introductionSettings(
      context.tenantId,
      context.chatId,
    );

    if (command.kind === "show") {
      return {
        text: formatIntroductionMirrorState({
          settings: actuales,
          staffChatConfigured,
        }),
        parseMode: "HTML",
      };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "introduction.config",
    );
    if (!permission.allowed) {
      return {
        text: "Solo los administradores configuran esto.",
      };
    }

    // Encenderlo sin sala a la que mandar las copias dejaría un interruptor en
    // "on" que no publica nada: la forma más fiable de que alguien dé por hecho
    // que hay registro cuando no lo hay.
    if (command.kind === "on" && !staffChatConfigured) {
      return {
        text: formatIntroductionMirrorState({
          settings: actuales,
          staffChatConfigured: false,
        }),
        parseMode: "HTML",
      };
    }

    const siguientes: IntroductionSettings =
      command.kind === "off"
        ? { ...actuales, mirrorToStaff: false }
        : {
            ...actuales,
            mirrorToStaff: true,
            staffThreadId: command.staffThreadId,
          };

    await this.chatSettingRepository.setValue(
      context.tenantId,
      context.chatId,
      INTRODUCTION_SETTINGS_KEY,
      siguientes,
    );
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "introduction.mirror_configured",
      resourceType: "chat",
      resourceId: context.chatId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        mirrorToStaff: siguientes.mirrorToStaff,
        staffThreadId: siguientes.staffThreadId,
      },
    });

    return {
      text: formatIntroductionMirrorState({
        settings: siguientes,
        staffChatConfigured,
      }),
      parseMode: "HTML",
    };
  }

  /**
   * `/presentado` y `/nopresentado` — la salida manual cuando el automatismo
   * se equivoca en cualquiera de los dos sentidos.
   */
  private async handleIntroductionAdminCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const command = parseIntroductionAdminCommand(update.command?.name);
    if (!command) {
      return null;
    }

    if (!context.chatId || !update.chat.chatId) {
      return { text: "Esto se usa dentro de un grupo." };
    }
    if (!(await this.isActorAdmin(context, update))) {
      return { text: "Solo los administradores." };
    }

    const resolved = await this.withReplyTarget(update, context);
    const raw = resolved.command?.args?.[0];
    if (!raw || !/^\d+$/u.test(raw)) {
      return { text: INTRODUCTION_ADMIN_USAGE };
    }
    const targetId = BigInt(raw);

    const settings = await this.introductionSettings(
      context.tenantId,
      context.chatId,
    );
    if (!settings.enabled) {
      return { text: "La presentación obligatoria está apagada aquí." };
    }

    const who = mentionHtml(
      targetId,
      await this.describeTarget(update, context, targetId),
    );

    if (command.kind === "presented") {
      await this.introductionRepository
        .clear(context.tenantId, context.chatId, targetId)
        .catch(() => undefined);
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "introduction.forgiven",
        resourceType: "introduction_pending",
        resourceId: targetId.toString(),
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { actorTelegramUserId: update.user.userId?.toString() },
      });
      return { text: buildIntroductionForgiven(who), parseMode: "HTML" };
    }

    await this.introductionRepository
      .start({
        tenantId: context.tenantId,
        chatId: context.chatId,
        telegramChatId: update.chat.chatId,
        telegramUserId: targetId,
        dueAt: new Date(Date.now() + settings.deadlineHours * 3_600_000),
      })
      .catch(() => undefined);
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "introduction.reopened",
      resourceType: "introduction_pending",
      resourceId: targetId.toString(),
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: { actorTelegramUserId: update.user.userId?.toString() },
    });
    return { text: buildRepresentNotice(who, settings), parseMode: "HTML" };
  }

  /**
   * Los botones de la ficha "no se ha presentado".
   *
   * Quien decide es una persona: el barrido solo abre el caso. Expulsar es un
   * ban de dos minutos seguido de un unban — la misma expulsión de siempre, que
   * deja volver a entrar — y "que se quede" simplemente cierra el caso.
   *
   * La fila se borra en los dos caminos: decidido es decidido, y dejarla viva
   * haría que el barrido la volviera a mirar.
   */
  private async handleIntroductionStaffCallback(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const parsed = parseIntroductionStaffCallback(update.callbackData);
    if (!parsed) {
      return null;
    }

    const row = await this.introductionRepository
      .findById(parsed.pendingId)
      .catch(() => null);
    if (!row) {
      await this.ackCallbackQuery(update.raw, INTRODUCTION_STAFF_STALE, true);
      return null;
    }

    // Estar EN la sala de STAFF a la que se mandó la ficha es la credencial —
    // el mismo criterio que Guardian, y por el mismo motivo: esa sala es
    // privada y quien la compone son los admins del grupo. Desde cualquier
    // otro sitio sí hace falta ser admin.
    const settings = await this.guardianRepository
      .getSettings(row.tenantId, row.chatId)
      .catch(() => null);
    const desdeStaff =
      settings?.staffChatId != null &&
      update.chat.chatId === settings.staffChatId;
    if (!desdeStaff && !(await this.isActorAdmin(context, update))) {
      await this.ackCallbackQuery(
        update.raw,
        "Solo el staff puede decidir esto.",
        true,
      );
      return null;
    }

    // Se rehace la ficha desde la fila en vez de leer el texto del mensaje:
    // así el veredicto se pega a los mismos datos que vio el barrido, no a lo
    // que Telegram nos devuelva del mensaje editado.
    const chat = await this.repository
      .findChatByTelegramId(row.tenantId, row.telegramChatId)
      .catch(() => null);
    const card = buildIntroductionStaffCard({
      pendingId: row.id,
      telegramUserId: row.telegramUserId,
      username: row.username,
      displayName: null,
      joinedAt: row.joinedAt,
      dueAt: row.dueAt,
      now: new Date(),
      chatTitle: chat?.title ?? null,
    });

    let telegramOk = true;
    if (parsed.action === "kick") {
      try {
        await this.telegramGateway.banChatMember({
          chatId: row.telegramChatId,
          userId: row.telegramUserId,
          token: this.telegramToken(),
          // Ban finito y corto: si el unban de abajo no llega, quedan libres
          // en dos minutos en vez de vetados para siempre. Telegram trata
          // menos de 30s como permanente, así que 120s es el mínimo real.
          untilDate: new Date(Date.now() + 120_000),
        });
        await this.telegramGateway.unbanChatMember({
          chatId: row.telegramChatId,
          userId: row.telegramUserId,
          token: this.telegramToken(),
          onlyIfBanned: false,
        });
      } catch (error) {
        // Nunca enseñar "Expulsado" si Telegram dijo que no. El staff tiene
        // que poder ver que le toca hacerlo a mano.
        telegramOk = false;
        this.logger.error(
          `introduction staff kick failed for ${row.telegramUserId.toString()}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    await this.introductionRepository
      .clear(row.tenantId, row.chatId, row.telegramUserId)
      .catch(() => undefined);

    await this.repository.recordAudit({
      tenantId: row.tenantId,
      actorType: "user",
      action:
        parsed.action === "kick"
          ? "introduction.staff_kicked"
          : "introduction.staff_kept",
      resourceType: "chat_member",
      resourceId: row.telegramUserId.toString(),
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        chatId: row.chatId,
        pendingId: row.id,
        telegramOk,
        joinedAt: row.joinedAt.toISOString(),
        dueAt: row.dueAt.toISOString(),
        decidedByTelegramUserId: update.user.userId?.toString(),
      },
    });

    return {
      text: buildIntroductionStaffResolved({
        card,
        action: parsed.action,
        decidedBy: this.mentionFor(update.user),
        telegramOk,
      }),
      parseMode: "HTML",
      edit: true,
      // Sin teclado: la ficha ya está decidida y unos botones que no hacen
      // nada invitan a pulsarlos.
      replyMarkup: { inline_keyboard: [] },
    };
  }

  /**
   * Sube de rango a quien lo haya ganado: VIP → Titán → Veterano → Leyenda.
   *
   * Cuelga del gancho de XP, que ya viene limitado a un mensaje por ventana,
   * en vez de correr en cada mensaje. Y sale antes de consultar nada cuando la
   * persona ya está arriba del todo, que es el caso de los habituales.
   *
   * Moderador NO se reparte solo: implica confianza, no mérito acumulado.
   */
  private async maybePromoteRank(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    actual: string | null,
  ): Promise<void> {
    const userId = update.user.userId;
    if (!userId || !context.chatId || !update.chat.chatId) {
      return;
    }
    if (actual === "leyenda") {
      return;
    }

    const [mensajes, desde] = await Promise.all([
      this.analyticsRepository
        .getUserMessages(context.chatId, userId)
        .catch(() => 0),
      this.repository
        .getMembershipJoinedAtByTelegramUser(context.chatId, userId)
        .catch(() => undefined),
    ]);
    const ageDays = desde
      ? Math.floor((Date.now() - desde.getTime()) / 86_400_000)
      : 0;

    const nuevo = rankFor({ messages: mensajes, ageDays });
    if (!isPromotion(actual as never, nuevo) || !nuevo) {
      return;
    }

    await this.reputationRepository
      .setRank?.(context.tenantId, context.chatId, userId, nuevo.key)
      .catch(() => undefined);

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "system",
      action: "rank.promoted",
      resourceType: "reputation_profile",
      resourceId: userId.toString(),
      payload: { rank: nuevo.key, mensajes, ageDays },
    });

    // El mismo interruptor que silencia el "sube al nivel": un grupo que ha
    // pedido silencio no quiere confeti automático.
    if (await this.isChatQuiet(context.tenantId, context.chatId)) {
      return;
    }
    try {
      await this.telegramGateway.sendMessage({
        chatId: update.chat.chatId,
        reply: {
          text: buildRankAnnouncement(this.mentionFor(update.user), nuevo),
          parseMode: "HTML",
        },
        token: this.telegramToken(),
      });
    } catch (error) {
      // El rango y su auditoría ya están guardados; lo único que puede morir
      // aquí es el confeti. Y moría mal: este era el ÚNICO paso del método sin
      // proteger, así que un foro con el General cerrado (TOPIC_CLOSED, visto
      // en producción el 2026-08-13) tiraba también el anuncio de nivel de
      // quien nos llamó. A warn y no silencio: "este grupo tiene el General
      // cerrado" es el dato que explica por qué no hay anuncios.
      this.logger.warn(
        `rango: no se pudo anunciar el ascenso de ${userId} en ${update.chat.chatId} — ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * `/rango` — qué rango tiene alguien y qué le falta para el siguiente.
   */
  private async handleRankCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const name = update.command?.name;
    if (name !== "rango" && name !== "rangos") {
      return null;
    }
    if (!context.chatId || !update.user.userId) {
      return { text: "Los rangos se consultan dentro de un grupo." };
    }

    if (name === "rangos") {
      return {
        text: [
          "🏅 <b>Rangos del grupo</b>",
          "",
          ...RANKS.map(
            (r) => `${r.label} — ${r.minMessages} mensajes y ${r.minDays} días`,
          ),
          "",
          "⭐ Moderador se nombra a mano.",
        ].join("\n"),
        parseMode: "HTML",
      };
    }

    const userId = update.user.userId;
    const [mensajes, desde, perfil] = await Promise.all([
      this.analyticsRepository
        .getUserMessages(context.chatId, userId)
        .catch(() => 0),
      this.repository
        .getMembershipJoinedAtByTelegramUser(context.chatId, userId)
        .catch(() => undefined),
      this.reputationRepository
        .getProfile(context.chatId, userId)
        .catch(() => null),
    ]);
    const stats = {
      messages: mensajes,
      ageDays: desde
        ? Math.floor((Date.now() - desde.getTime()) / 86_400_000)
        : 0,
    };
    // El rango guardado manda sobre el calculado: nadie baja por dejar de
    // escribir, y recalcular a secas haría justo eso.
    const guardado = RANKS.find((r) => r.key === perfil?.rank);
    const rank = guardado ?? rankFor(stats);

    return {
      text: rank ? buildRankReply(rank, stats) : buildNoRankReply(stats),
      parseMode: "HTML",
    };
  }

  /** Enlace pulsable a quien manda el mensaje, con su nombre ya escapado. */
  private mentionFor(user: UserContext): string {
    return user.userId
      ? mentionHtml(user.userId, describeUser(user))
      : escapeHtml(describeUser(user));
  }

  /**
   * `@admin <mensaje>` — avisa al equipo del grupo, mencionándolos.
   *
   * Al revés que `@all`, lo puede usar cualquiera: es la forma de pedir ayuda
   * cuando pasa algo, y exigir ser admin para avisar a los admins no tendría
   * sentido. El precio es el freno de abajo — sin él es un botón de molestar
   * al equipo, y el equipo acabaría silenciando el grupo.
   */
  private async handleMentionAdmins(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const parsed = parseMentionAdmins(update.messageText ?? "");
    if (!parsed || !update.chat.chatId || !update.user.userId) {
      return null;
    }

    const key = `${update.chat.chatId.toString()}:${update.user.userId.toString()}`;
    if (!this.claimAdminAlert(key, Date.now())) {
      // Silencio, no regañina: contestar "espera un poco" es otro mensaje mas
      // en el grupo, que es justo lo que se intenta evitar.
      return null;
    }

    // La ficha para el tema de REPORTES se prepara antes de tocar Telegram,
    // porque hay un camino (no poder listar los admins) que se va del método sin
    // llegar al final — y es justo el camino donde MÁS falta hace la ficha: si
    // la mención no notifica a nadie, el tema de staff es lo único que queda.
    const reply = extractReplyContext(update.raw);
    const espejo = () =>
      this.publicarReporteEnStaff(context, update, {
        source: "mention",
        text: parsed.text,
        ...(reply.userId
          ? {
              reportedTelegramUserId: reply.userId,
              ...(reply.username ? { reportedUsername: reply.username } : {}),
            }
          : {}),
        ...(reply.messageId !== undefined
          ? { targetMessageId: reply.messageId }
          : {}),
      });

    const admins = await this.telegramGateway
      .getChatAdministrators({
        chatId: update.chat.chatId,
        token: this.telegramToken(),
      })
      .catch(() => ({ ok: false, admins: undefined }));

    // Sin bots: mencionar al propio Modryva no avisa a nadie.
    const objetivos = (admins.admins ?? [])
      .filter((a) => !a.isBot)
      .map((a) => ({
        telegramUserId: a.userId,
        name: a.username ? `@${a.username}` : (a.firstName ?? "admin"),
      }));

    if (objetivos.length === 0) {
      await espejo();
      return { text: "No he podido obtener la lista de administradores." };
    }

    const quien = {
      telegramUserId: update.user.userId,
      name: describeUser(update.user),
    };
    const token = this.telegramToken();
    for (const message of buildAdminAlertMessages(
      parsed.text,
      quien,
      objetivos,
    )) {
      await this.telegramGateway
        .sendMessage({
          chatId: update.chat.chatId,
          token,
          ...(update.chat.topicId !== undefined
            ? { messageThreadId: update.chat.topicId }
            : {}),
          reply: { text: message, parseMode: "HTML" },
        })
        .catch(() => undefined);
    }

    // Se publica DESPUES de mencionar en el grupo: lo que hace que alguien
    // acuda es la mención, y un fallo publicando la ficha no puede quedarse con
    // ella por delante.
    await espejo();

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "admins.alerted",
      resourceType: "telegram_chat",
      resourceId: update.chat.chatId.toString(),
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        actorTelegramUserId: update.user.userId.toString(),
        admins: objetivos.length,
        text: parsed.text,
      },
    });

    return null;
  }

  /**
   * Publica un aviso al equipo en el tema de REPORTES de la sala de STAFF.
   *
   * `@admin` ya menciona al equipo dentro del grupo, y eso no cambia: es lo que
   * hace que alguien acuda en el momento. Pero esa mención vive en el grupo,
   * donde se la come el siguiente mensaje, y nadie puede saber después si se
   * atendió. Aquí queda una fila con dos estados — abierto o resuelto — que se
   * mira de un vistazo un rato más tarde.
   *
   * Best-effort de principio a fin: perder la ficha no puede tumbar el aviso.
   * Pero el fallo se audita en vez de tragarse — un registro que deja de
   * publicar en silencio es peor que no tenerlo.
   */
  private async publicarReporteEnStaff(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    entrada: {
      readonly source: ReportMirrorEntry["source"];
      readonly text: string | undefined;
      readonly reportedTelegramUserId?: bigint;
      readonly reportedUsername?: string;
      /**
       * A qué mensaje lleva el botón. El del reportado cuando lo hay — que es
       * lo que el staff necesita leer — y si no, el del propio aviso.
       */
      readonly targetMessageId?: number;
    },
  ): Promise<void> {
    if (!context.chatId || !update.chat.chatId) {
      return;
    }
    try {
      const settings = parseReportMirrorSettings(
        await this.chatSettingRepository.getValue(
          context.tenantId,
          context.chatId,
          REPORT_MIRROR_SETTINGS_KEY,
        ),
      );
      if (!settings.enabled) {
        return;
      }
      const guardian = await this.guardianRepository.getSettings(
        context.tenantId,
        context.chatId,
      );
      const staffChatId = guardian?.staffChatId;
      if (!staffChatId) {
        return;
      }

      const reportado = entrada.reportedTelegramUserId;
      const nombreReportado = reportado
        ? entrada.reportedUsername
          ? `@${entrada.reportedUsername}`
          : // describeTarget mete el id entre paréntesis al final, y la ficha
            // ya lo pone en su propia línea. Verlo dos veces seguidas es ruido
            // justo donde menos sobra.
            (await this.describeTarget(update, context, reportado))
              .replace(/\s*\(\d+\)\s*$/u, "")
              .trim()
        : null;

      const card = buildReportMirrorCard({
        source: entrada.source,
        reporter: describeUser(update.user),
        reporterTelegramUserId: update.user.userId,
        text: entrada.text,
        chatTitle: update.chat.chatTitle ?? null,
        ...(reportado && nombreReportado
          ? {
              reported: { name: nombreReportado, telegramUserId: reportado },
            }
          : { reported: undefined }),
      });

      const messageId = entrada.targetMessageId ?? update.messageId;
      const link =
        messageId === undefined
          ? null
          : buildTelegramMessageLink({
              chatId: update.chat.chatId,
              messageId,
              topicId: update.chat.topicId,
            });

      // El tema propio de los reportes si el grupo lo ha puesto; si no, el de
      // Guardian, que es donde han ido siempre. `??` y no `||`: el 0 no es un
      // tema válido, pero tampoco puede colarse como "no configurado".
      const tema = settings.staffThreadId ?? guardian.staffThreadId;

      await this.telegramGateway.sendMessage({
        chatId: staffChatId,
        token: this.telegramToken(),
        ...(tema != null ? { messageThreadId: tema } : {}),
        reply: {
          text: card,
          parseMode: "HTML",
          replyMarkup: buildReportMirrorKeyboard({
            link,
            resolveData: buildReportResolveCallback({
              telegramChatId: update.chat.chatId,
              messageId: messageId ?? 0,
            }),
          }),
        },
      });
    } catch (error) {
      await this.repository
        .recordAudit({
          tenantId: context.tenantId,
          actorType: "system",
          action: "report_mirror.failed",
          resourceType: "chat",
          resourceId: context.chatId,
          payload: {
            source: entrada.source,
            error: error instanceof Error ? error.message : "unknown",
          },
        })
        .catch(() => undefined);
    }
  }

  /**
   * El botón "✅ Resuelto" de una ficha de REPORTES.
   *
   * No hay fila que cerrar: resolver un aviso es editar la ficha que tienes
   * delante. Lo que sí viaja en el botón es el chat y el mensaje a los que
   * apunta, para poder REHACER el enlace al editar — Telegram tira el teclado
   * entero en cualquier edición que no lo mande, y el camino de vuelta al
   * mensaje es justo lo que hace útil el historial.
   */
  private async handleReportResolveCallback(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const parsed = parseReportResolveCallback(update.callbackData);
    if (!parsed) {
      return null;
    }

    // Estar EN la sala de STAFF a la que se mandó la ficha es la credencial —
    // el mismo criterio que Guardian y que las fichas de presentaciones, y por
    // el mismo motivo: esa sala es privada y quien la compone son los admins
    // del grupo. Desde cualquier otro sitio sí hace falta ser admin.
    const origen = await this.repository
      .findChatByTelegramId(context.tenantId, parsed.telegramChatId)
      .catch(() => null);
    const guardian = origen
      ? await this.guardianRepository
          .getSettings(context.tenantId, origen.chatId)
          .catch(() => null)
      : null;
    const desdeStaff =
      guardian?.staffChatId != null &&
      update.chat.chatId === guardian.staffChatId;
    if (!desdeStaff && !(await this.isActorAdmin(context, update))) {
      await this.ackCallbackQuery(update.raw, REPORT_MIRROR_FORBIDDEN, true);
      return null;
    }

    await this.ackCallbackQuery(update.raw, "Marcado como resuelto.");
    await this.repository
      .recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "report_mirror.resolved",
        resourceType: "telegram_chat",
        resourceId: parsed.telegramChatId.toString(),
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: {
          messageId: parsed.messageId,
          resolvedByTelegramUserId: update.user.userId?.toString(),
        },
      })
      .catch(() => undefined);

    // Se reaprovecha el texto que ya está en pantalla en vez de rehacerlo: el
    // botón no lleva encima los datos con los que se compuso la ficha.
    //
    // Y se ESCAPA antes de reenviarlo, aunque venga de un mensaje nuestro.
    // Telegram devuelve el texto ya renderizado: el `&lt;` que escribimos vuelve
    // como `<`, así que un aviso citando "mira <esto>" se reenviaría como HTML
    // roto, Telegram lo rechazaría con un 400 y el botón "resuelto" se quedaría
    // sin hacer nada visible. El precio es que la ficha resuelta pierde las
    // negritas — barato al lado de un botón que no funciona.
    const actual = extractCallbackMessageBody(update.raw);
    return {
      text: buildReportResolved({
        card: actual ? escapeHtml(actual) : "🚨 AVISO AL EQUIPO",
        resolvedBy: this.mentionFor(update.user),
      }),
      parseMode: "HTML",
      edit: true,
      replyMarkup: buildReportResolvedKeyboard(
        parsed.messageId > 0
          ? buildTelegramMessageLink({
              chatId: parsed.telegramChatId,
              messageId: parsed.messageId,
            })
          : null,
      ),
    };
  }

  /**
   * `/reportes` — enciende, apaga y reubica la copia de avisos al equipo.
   *
   * El número del tema se saca con `/topicid` dentro del tema, porque la Bot
   * API no lista los temas de un foro: no hay forma de ofrecer un desplegable.
   */
  private async handleReportMirrorCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const command = parseReportMirrorCommand(
      update.command?.name,
      update.command?.args ?? [],
    );
    if (!command) {
      return null;
    }
    if (!context.chatId) {
      return { text: "Los avisos al equipo se configuran dentro de un grupo." };
    }

    const guardian = await this.guardianRepository.getSettings(
      context.tenantId,
      context.chatId,
    );
    const staffChatConfigured = Boolean(guardian?.staffChatId);
    const actuales = parseReportMirrorSettings(
      await this.chatSettingRepository.getValue(
        context.tenantId,
        context.chatId,
        REPORT_MIRROR_SETTINGS_KEY,
      ),
    );

    if (command.kind === "show") {
      return {
        text: formatReportMirrorState({
          settings: actuales,
          staffChatConfigured,
        }),
        parseMode: "HTML",
      };
    }

    const permission = await this.ensureConfigPermission(
      context,
      update,
      "report-mirror.config",
    );
    if (!permission.allowed) {
      return {
        text: "Solo los administradores configuran los avisos al equipo.",
      };
    }

    // Encenderlo sin sala a la que mandarlo dejaría un interruptor en "on" que
    // no publica nada: la forma más fiable de que alguien dé por hecho que hay
    // registro cuando no lo hay.
    if (command.kind === "on" && !staffChatConfigured) {
      return {
        text: formatReportMirrorState({
          settings: actuales,
          staffChatConfigured: false,
        }),
        parseMode: "HTML",
      };
    }

    const siguientes: ReportMirrorSettings =
      command.kind === "off"
        ? { ...actuales, enabled: false }
        : { enabled: true, staffThreadId: command.staffThreadId };

    await this.chatSettingRepository.setValue(
      context.tenantId,
      context.chatId,
      REPORT_MIRROR_SETTINGS_KEY,
      siguientes,
    );
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "report_mirror.configured",
      resourceType: "chat",
      resourceId: context.chatId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        enabled: siguientes.enabled,
        staffThreadId: siguientes.staffThreadId,
      },
    });

    return {
      text: formatReportMirrorState({
        settings: siguientes,
        staffChatConfigured,
      }),
      parseMode: "HTML",
    };
  }

  /**
   * Un aviso al equipo por persona y grupo cada 10 minutos.
   *
   * En memoria a propósito: la ventana son minutos, así que un redespliegue la
   * vacía sin consecuencias y no justifica una tabla en el camino de cada
   * mensaje.
   */
  private readonly recentAdminAlerts = new Map<string, number>();
  private static readonly ADMIN_ALERT_COOLDOWN_MS = 600_000;

  private claimAdminAlert(key: string, nowMs: number): boolean {
    const last = this.recentAdminAlerts.get(key);
    if (
      last !== undefined &&
      nowMs - last <= BotUpdateService.ADMIN_ALERT_COOLDOWN_MS
    ) {
      return false;
    }
    this.recentAdminAlerts.set(key, nowMs);
    for (const [seen, ms] of this.recentAdminAlerts) {
      if (nowMs - ms > BotUpdateService.ADMIN_ALERT_COOLDOWN_MS * 3) {
        this.recentAdminAlerts.delete(seen);
      }
    }
    return true;
  }

  private async handleMentionAll(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const parsed = parseMentionAll(update.messageText ?? "");
    if (!parsed || !update.chat.chatId || !context.chatId) {
      return null;
    }
    if (!(await this.isActorAdmin(context, update))) {
      // Silence, not a refusal: telling every member the command exists turns
      // it into something they will try, repeatedly.
      return null;
    }

    const members = await this.repository
      .listActiveMembersWithNames(context.chatId)
      .catch(() => []);
    if (members.length === 0) {
      return {
        text: "Todavía no conozco a nadie de este grupo, así que no puedo avisar. Telegram no me deja listar miembros: solo veo a quien ha escrito alguna vez.",
      };
    }

    const messages = buildMentionAllMessages(parsed.text, members);
    const token = this.telegramToken();
    let delivered = 0;
    for (const message of messages) {
      const sent = await this.telegramGateway
        .sendMessage({
          chatId: update.chat.chatId,
          token,
          ...(update.chat.topicId !== undefined
            ? { messageThreadId: update.chat.topicId }
            : {}),
          reply: { text: message, parseMode: "HTML" },
        })
        .catch(() => ({ ok: false }));
      if (sent.ok) {
        delivered += 1;
      }
    }
    if (delivered === 0) {
      return { text: "No he podido enviar el aviso." };
    }
    await this.repository
      .recordAudit({
        tenantId: context.tenantId,
        actorType: "user",
        action: "community.mention_all",
        resourceType: "chat",
        resourceId: context.chatId,
        payload: {
          mentioned: members.length,
          by: update.user.userId?.toString(),
        },
      })
      .catch(() => undefined);
    // Returning null: the announcement IS the output, and a summary underneath
    // it would just be more noise in a message everyone was already pinged for.
    return null;
  }

  private async handleAfkPhrase(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const userId = update.user.userId;
    if (!update.isTextMessage || !userId || !update.chat.chatId) {
      return null;
    }
    // Unprompted message: the same silence rule as every other one.
    if (await this.isChatQuiet(context.tenantId, context.chatId ?? "")) {
      return null;
    }
    const who = describeUser(update.user);

    // Back first: someone who was away and now types is back, whatever they
    // typed — including another "brb", which should re-mark them, not be
    // swallowed as a return.
    const existing = await this.productivityRepository
      .findAfk(context.tenantId, userId)
      .catch(() => null);

    const phrase = detectAfkPhrase(update.messageText ?? "", {
      isReply: extractReplyContext(update.raw).userId !== undefined,
    });

    if (phrase) {
      await this.productivityRepository.setAfk({
        tenantId: context.tenantId,
        telegramUserId: userId,
        username: update.user.username,
        reason: phrase.reason,
      });
      return { text: buildAfkAwayNotice(who, phrase.reason) };
    }

    if (existing) {
      await this.productivityRepository.clearAfk(context.tenantId, userId);
      return {
        text: buildAfkReturnNotice(
          who,
          formatAfkDuration(Date.now() - existing.since.getTime()),
        ),
      };
    }
    return null;
  }

  private async handleAfkCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseAfkCommand(update);

    if (!result) {
      return null;
    }

    if (!update.user.userId) {
      return { text: "No pude identificarte." };
    }

    const command = result.command;

    if (command.kind === "set") {
      await this.productivityRepository.setAfk({
        tenantId: context.tenantId,
        telegramUserId: update.user.userId,
        username: update.user.username,
        reason: command.reason,
      });

      return { text: buildAfkSetReply(command.reason) };
    }

    const cleared = await this.productivityRepository.clearAfk(
      context.tenantId,
      update.user.userId,
    );

    if (!cleared) {
      return { text: "No estabas AFK." };
    }

    return { text: buildAfkClearReply(cleared.since.getTime(), Date.now()) };
  }

  /**
   * Ambient AFK behavior for plain messages: the author automatically returns
   * from AFK by talking, and anyone mentioning (or replying to) an AFK user
   * gets notified.
   */
  private async handleAfkAmbient(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.kind !== "message" ||
      update.command ||
      !update.user.userId ||
      !update.isTextMessage
    ) {
      return null;
    }

    const returned = await this.productivityRepository.clearAfk(
      context.tenantId,
      update.user.userId,
    );

    if (returned) {
      return {
        text: buildAfkClearReply(returned.since.getTime(), Date.now()),
      };
    }

    const now = Date.now();
    const notices: string[] = [];
    const seen = new Set<string>();

    const mentions = extractMentions(update.messageText);
    const mentionedAfk =
      mentions.length > 0
        ? await this.productivityRepository.findAfkByUsernames(
            context.tenantId,
            mentions,
          )
        : [];

    for (const record of mentionedAfk) {
      const key = record.telegramUserId.toString();

      if (!seen.has(key)) {
        seen.add(key);
        notices.push(
          buildAfkNotice(
            {
              telegramUserId: record.telegramUserId,
              username: record.username,
              reason: record.reason,
              sinceMs: record.since.getTime(),
            },
            now,
          ),
        );
      }
    }

    const replyTarget = extractReplyContext(update.raw);

    if (replyTarget.userId && !seen.has(replyTarget.userId.toString())) {
      const record = await this.productivityRepository.findAfk(
        context.tenantId,
        replyTarget.userId,
      );

      if (record) {
        notices.push(
          buildAfkNotice(
            {
              telegramUserId: record.telegramUserId,
              username: record.username,
              reason: record.reason,
              sinceMs: record.since.getTime(),
            },
            now,
          ),
        );
      }
    }

    return notices.length > 0 ? { text: notices.join("\n") } : null;
  }

  /**
   * Persistent "Saved Info" memory (like ChatGPT/Gemini): the user tells Modryva
   * a durable fact in natural language and it is stored verbatim under their own
   * user scope, injected into every future reply by buildAiMemorySystemHint.
   * Only consulted from addressed-to-the-bot paths so it can't capture chatter.
   */
  private async handleMemorySave(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    text: string,
  ): Promise<BotReply | null> {
    const remember = parseRememberCommand(text);
    if (!remember || !update.user.userId) {
      return null;
    }
    await this.aiRepository.upsertMemory({
      tenantId: context.tenantId,
      scope: "user",
      telegramUserId: update.user.userId,
      key: memoryKeyForNote(remember.value),
      value: remember.value,
      source: "explicit",
      confidence: 1,
    });
    return { text: "🧠 Hecho, lo recordaré. Mira /memoria cuando quieras." };
  }

  /** /memoria — the manage-memory view: everything Modryva remembers about you. */
  private async handleMemoriaCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply> {
    if (!update.user.userId) {
      return { text: "Necesito identificarte para tener memoria tuya." };
    }
    const memories = await this.aiRepository.listUserMemories({
      tenantId: context.tenantId,
      telegramUserId: update.user.userId,
    });
    return { text: renderMemoryList(memories) };
  }

  /** /olvida <n> — forget one entry by its position in /memoria. */
  private async handleOlvidaCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply> {
    if (!update.user.userId) {
      return { text: "Necesito identificarte para tener memoria tuya." };
    }
    const position = Number.parseInt(update.command?.args?.[0] ?? "", 10);
    if (!Number.isInteger(position) || position < 1) {
      return { text: "Dime cuál olvidar: /olvida <número> (mira /memoria)." };
    }
    const memories = await this.aiRepository.listUserMemories({
      tenantId: context.tenantId,
      telegramUserId: update.user.userId,
    });
    const target = memories[position - 1];
    if (!target) {
      return {
        text: `No tengo una memoria número ${position}. Mira /memoria.`,
      };
    }
    await this.aiRepository.deleteMemory({
      tenantId: context.tenantId,
      id: target.id,
    });
    return { text: `Olvidado ✅: ${describeMemory(target)}` };
  }

  /** /olvidatodo — wipe all of the caller's personal memories. */
  private async handleOlvidatodoCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply> {
    if (!update.user.userId) {
      return { text: "Necesito identificarte para tener memoria tuya." };
    }
    const removed = await this.aiRepository.clearUserMemories({
      tenantId: context.tenantId,
      telegramUserId: update.user.userId,
    });
    return {
      text:
        removed > 0
          ? `Borré todo lo que recordaba de ti (${removed}). 🧹`
          : "No tenía nada guardado de ti.",
    };
  }

  /**
   * Conversational AI in private chats: any plain text DM (no command, no note
   * recall) is answered through the same budgeted/sanitized AI pipeline as /ai.
   */
  private async handleDmChat(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (!shouldAutoChat(update)) {
      return null;
    }

    if (!context.chatId || !update.user.userId || !update.messageText) {
      return null;
    }

    if (!this.env.AI_ENABLED) {
      return { text: "La IA está desactivada ahora mismo." };
    }

    const accessBlock = await this.requireAiAccess(update);
    if (accessBlock) {
      return accessBlock;
    }

    const AI_TOKEN_BUDGET = 2_000_000;
    const used = await this.aiRepository.usageTokens(
      context.tenantId,
      context.chatId,
    );

    if (used >= AI_TOKEN_BUDGET) {
      return {
        text: "Se ha agotado el presupuesto de IA de este chat. Usa /help para ver todo lo que puedo hacer.",
      };
    }

    const aiDegradedCheck = decideDegradedMode(
      this.getAiDegradedState(context.tenantId, context.chatId),
      Date.now(),
    );
    if (aiDegradedCheck.degraded) {
      return { text: formatDegradedNotice(aiDegradedCheck.reason) };
    }

    const sanitized = sanitizeAiInput(
      truncateDmInput(update.messageText, this.env.AI_MAX_INPUT_CHARS),
      this.env.AI_MAX_INPUT_CHARS,
      this.env.AI_PRIVACY_MODE,
    );

    if (sanitized.flagged) {
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "system",
        action: "ai.input.blocked",
        resourceType: "ai",
        resourceId: context.chatId,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { kind: "dm-chat" },
      });

      return {
        text: "Tu mensaje fue bloqueado por seguridad (posible inyección de prompt).",
      };
    }

    const memorySave = await this.handleMemorySave(
      context,
      update,
      sanitized.text,
    );
    if (memorySave) {
      return memorySave;
    }

    const rawHistory = await this.aiRepository.getRecentHistory(
      context.chatId,
      update.user.userId,
    );
    const history = rawHistory.map((entry) => ({
      role:
        entry.role === "assistant"
          ? ("assistant" as const)
          : entry.role === "system"
            ? ("system" as const)
            : ("user" as const),
      content: entry.content,
    }));
    const messages = buildAiMessages(
      { kind: "chat", prompt: sanitized.text },
      history,
      { isCreator: update.user.userId === CREATOR_TELEGRAM_ID },
    );
    this.addAiMemoryHint(
      messages,
      await this.buildAiMemoryHint(context, update),
    );
    messages.splice(1, 0, { role: "system", content: buildDmSystemHint() });

    let completion: Awaited<ReturnType<AiProvider["complete"]>>;
    try {
      completion = await this.aiProvider.complete(messages, {
        task: "fast_chat",
        // Conversational replies want variety, not the deterministic 0.3
        // default — at low temp the 8b model parrots its own prompt examples
        // verbatim (same defense line every time). Matches the /ai command.
        temperature: 0.85,
        maxTokens: Math.min(this.env.AI_MAX_TOKENS_PER_REQUEST, 512),
        userId: update.user.userId.toString(),
        chatId: context.chatId,
        tenantId: context.tenantId,
      });
      this.recordAiSuccess(context.tenantId, context.chatId);
    } catch {
      const decision = this.recordAiFailure(
        context.tenantId,
        context.chatId,
        Date.now(),
      );
      return {
        text: decision.degraded
          ? formatDegradedNotice(decision.reason)
          : "El servicio de IA no está disponible ahora mismo. Prueba /help para ver todo lo que puedo hacer.",
      };
    }

    await this.aiRepository.recordTurn({
      tenantId: context.tenantId,
      chatId: context.chatId,
      telegramUserId: update.user.userId,
      provider: completion.provider,
      userContent: sanitized.text,
      assistantContent: completion.text,
      tokensIn: completion.tokensIn,
      tokensOut: completion.tokensOut,
    });
    await this.rememberAiFacts(context, update, sanitized.text);

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "ai.dm.completion",
      resourceType: "ai",
      resourceId: context.chatId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        kind: "dm-chat",
        provider: completion.provider,
        tokensIn: completion.tokensIn,
        tokensOut: completion.tokensOut,
      },
    });

    return { text: completion.text };
  }

  /**
   * Lets groups where the bot is ALREADY a member talk to the AI just by
   * mentioning it (e.g. "@modryvabot que tal"), without needing /ai. This is
   * unrelated to Guest Chat Mode: it only fires for a normal `message` update,
   * which Telegram only delivers for chats the bot has joined.
   */
  private async handleMentionChat(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const prompt = extractMentionPrompt(update, this.env.TELEGRAM_BOT_USERNAME);
    if (!prompt) {
      return null;
    }

    if (!context.chatId || !update.user.userId) {
      return null;
    }

    if (!this.env.AI_ENABLED) {
      return { text: "La IA está desactivada ahora mismo." };
    }

    const accessBlock = await this.requireAiAccess(update);
    if (accessBlock) {
      return accessBlock;
    }

    const AI_TOKEN_BUDGET = 2_000_000;
    const used = await this.aiRepository.usageTokens(
      context.tenantId,
      context.chatId,
    );
    if (used >= AI_TOKEN_BUDGET) {
      return { text: "Se ha agotado el presupuesto de IA de este chat." };
    }

    const aiDegradedCheck = decideDegradedMode(
      this.getAiDegradedState(context.tenantId, context.chatId),
      Date.now(),
    );
    if (aiDegradedCheck.degraded) {
      return { text: formatDegradedNotice(aiDegradedCheck.reason) };
    }

    const sanitized = sanitizeAiInput(
      truncateDmInput(prompt, this.env.AI_MAX_INPUT_CHARS),
      this.env.AI_MAX_INPUT_CHARS,
      this.env.AI_PRIVACY_MODE,
    );

    if (sanitized.flagged) {
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: "system",
        action: "ai.input.blocked",
        resourceType: "ai",
        resourceId: context.chatId,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: { kind: "mention-chat" },
      });
      return {
        text: "Tu mensaje fue bloqueado por seguridad (posible inyección de prompt).",
      };
    }

    const memorySave = await this.handleMemorySave(
      context,
      update,
      sanitized.text,
    );
    if (memorySave) {
      return memorySave;
    }

    const rawHistory = await this.aiRepository.getRecentHistory(
      context.chatId,
      update.user.userId,
    );
    const history = rawHistory.map((entry) => ({
      role:
        entry.role === "assistant"
          ? ("assistant" as const)
          : entry.role === "system"
            ? ("system" as const)
            : ("user" as const),
      content: entry.content,
    }));
    const messages = buildAiMessages(
      { kind: "chat", prompt: sanitized.text },
      history,
      { isCreator: update.user.userId === CREATOR_TELEGRAM_ID },
    );
    this.addAiMemoryHint(
      messages,
      await this.buildAiMemoryHint(context, update),
    );

    let completion: Awaited<ReturnType<AiProvider["complete"]>>;
    try {
      completion = await this.aiProvider.complete(messages, {
        task: "fast_chat",
        // Conversational replies want variety, not the deterministic 0.3
        // default — at low temp the 8b model parrots its own prompt examples
        // verbatim (same defense line every time). Matches the /ai command.
        temperature: 0.85,
        maxTokens: Math.min(this.env.AI_MAX_TOKENS_PER_REQUEST, 512),
        userId: update.user.userId.toString(),
        chatId: context.chatId,
        tenantId: context.tenantId,
      });
      this.recordAiSuccess(context.tenantId, context.chatId);
    } catch {
      const decision = this.recordAiFailure(
        context.tenantId,
        context.chatId,
        Date.now(),
      );
      return {
        text: decision.degraded
          ? formatDegradedNotice(decision.reason)
          : "El servicio de IA no está disponible ahora mismo. Inténtalo más tarde.",
      };
    }

    await this.aiRepository.recordTurn({
      tenantId: context.tenantId,
      chatId: context.chatId,
      telegramUserId: update.user.userId,
      provider: completion.provider,
      userContent: sanitized.text,
      assistantContent: completion.text,
      tokensIn: completion.tokensIn,
      tokensOut: completion.tokensOut,
    });
    await this.rememberAiFacts(context, update, sanitized.text);

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "user",
      action: "ai.mention.completion",
      resourceType: "ai",
      resourceId: context.chatId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        kind: "mention-chat",
        provider: completion.provider,
        tokensIn: completion.tokensIn,
        tokensOut: completion.tokensOut,
      },
    });

    return { text: completion.text };
  }

  /**
   * Interprets an {@link applyTelegramEnforcement} result. Returns a human error
   * string only when Telegram genuinely REJECTED the action ({ok:false,
   * skipped:false}) so callers can reply honestly instead of claiming success;
   * returns null when it succeeded or was intentionally skipped (warning-only,
   * missing chat id, etc.).
   */
  private enforcementFailure(result: unknown): string | null {
    if (result && typeof result === "object") {
      const r = result as { ok?: unknown; skipped?: unknown; error?: unknown };
      if (r.ok === false && r.skipped === false) {
        return typeof r.error === "string" && r.error
          ? r.error
          : "error desconocido";
      }
    }
    return null;
  }

  private async applyTelegramEnforcement(
    action: "warn" | "ban" | "mute" | "kick",
    update: TelegramUpdateEnvelope,
    targetTelegramUserId: bigint,
    untilDate: Date | undefined,
  ): Promise<unknown> {
    if (action === "warn") {
      return { ok: true, skipped: true, reason: "warning-only" };
    }

    // El embudo único de ban/mute/kick: diez sitios llaman aquí, y ninguno
    // vuelve a preguntar. Por eso la red de seguridad va en este punto y no en
    // cada uno de los diez — el que se olvidara sería el agujero.
    //
    // `skipped: true` para que `enforcementFailure` no lo lea como un rechazo
    // de Telegram: no ha fallado nada, es que no se ha intentado.
    if (this.intocable(targetTelegramUserId)) {
      return { ok: true, skipped: true, reason: "intocable" };
    }

    if (!update.chat.chatId) {
      return { ok: false, skipped: true, reason: "missing-chat-id" };
    }

    try {
      if (action === "kick") {
        // Telegram has no native kick: ban then immediately unban removes the
        // member without leaving a lingering ban. onlyIfBanned:false is
        // required — the ban can lag behind this call, and the default
        // only_if_banned:true would then see "not banned yet" and no-op,
        // leaving the ban permanent instead of a kick.
        await this.telegramGateway.banChatMember({
          chatId: update.chat.chatId,
          userId: targetTelegramUserId,
          token: this.telegramToken(),
          untilDate: undefined,
        });
        return await this.telegramGateway.unbanChatMember({
          chatId: update.chat.chatId,
          userId: targetTelegramUserId,
          token: this.telegramToken(),
          onlyIfBanned: false,
        });
      }

      const result =
        action === "ban"
          ? await this.telegramGateway.banChatMember({
              chatId: update.chat.chatId,
              userId: targetTelegramUserId,
              token: this.telegramToken(),
              untilDate,
            })
          : await this.telegramGateway.restrictChatMember({
              chatId: update.chat.chatId,
              userId: targetTelegramUserId,
              token: this.telegramToken(),
              untilDate,
            });

      return result;
    } catch (error) {
      return {
        ok: false,
        skipped: false,
        error: error instanceof Error ? error.message : "unknown-error",
      };
    }
  }

  private resolveActorRole(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): ActorRole {
    if (
      this.env.SUPERBOT_OWNER_TELEGRAM_ID &&
      update.user.userId === this.env.SUPERBOT_OWNER_TELEGRAM_ID
    ) {
      return "owner";
    }

    if (
      context.membershipRole === "owner" ||
      context.membershipRole === "admin" ||
      context.membershipRole === "moderator" ||
      context.membershipRole === "member" ||
      context.membershipRole === "guest"
    ) {
      return context.membershipRole;
    }

    return "member";
  }

  /**
   * Si el bot no puede tocar a esta persona pase lo que pase.
   *
   * La lista sale de `SUPERBOT_INTOCABLES_TELEGRAM_IDS` y la regla vive en
   * `modules/security`. Aquí solo se ata al entorno de este proceso, en un
   * único sitio, para que los cuatro puntos que la consultan no puedan
   * discrepar sobre de dónde sale.
   */
  private intocable(userId: bigint | undefined): boolean {
    return esIntocable(userId, this.env.SUPERBOT_INTOCABLES_TELEGRAM_IDS);
  }

  /**
   * El aviso a devolver cuando la sanción va contra alguien a quien no se puede
   * sancionar, o null cuando se puede seguir. Deja rastro: un "no" sin registro
   * es indistinguible de un bot que se ha quedado callado.
   *
   * Son dos motivos distintos y se responden distinto. El de intocable va
   * PRIMERO y a propósito: no cuesta una llamada a Telegram, y sobre todo no
   * depende del cargo, así que sigue valiendo cuando la persona no es admin —
   * que es justamente el hueco que la otra comprobación no cubre.
   */
  private async bloqueoPorObjetivoProtegido(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
    action: ModerationAction,
    targetTelegramUserId: bigint,
  ): Promise<{
    readonly negativa?: BotReply;
    readonly cargoGuardado?: CargoGuardado;
  }> {
    if (this.intocable(targetTelegramUserId)) {
      await this.repository.recordAudit({
        tenantId: context.tenantId,
        actorType: update.user.userId ? "user" : "system",
        action: "moderation.command.blocked_untouchable_target",
        resourceType: "moderation_command",
        resourceId: action,
        ...(context.userId ? { actorId: context.userId } : {}),
        payload: {
          command: action,
          targetTelegramUserId: targetTelegramUserId.toString(),
        },
      });
      return {
        negativa: {
          text: textoIntocable(
            action,
            await this.describeTarget(update, context, targetTelegramUserId),
          ),
          parseMode: "HTML",
        },
      };
    }
    const chatId = update.chat.chatId;
    if (!chatId) {
      return {};
    }
    const veredicto = await examinarObjetivo({
      telegram: this.telegramGateway,
      token: this.telegramToken(),
      chatId,
      objetivo: targetTelegramUserId,
      accion: action,
      quien: await this.describeTarget(update, context, targetTelegramUserId),
    });
    if (veredicto.permitir) {
      return veredicto.cargoGuardado
        ? { cargoGuardado: veredicto.cargoGuardado }
        : {};
    }
    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: update.user.userId ? "user" : "system",
      action: "moderation.command.blocked_admin_target",
      resourceType: "moderation_command",
      resourceId: action,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        command: action,
        targetTelegramUserId: targetTelegramUserId.toString(),
      },
    });
    return { negativa: { text: veredicto.texto, parseMode: "HTML" } };
  }

  /**
   * Una clave de idempotencia que sobrevive a un reintento.
   *
   * `randomUUID()` NO sirve para esto, y se estaba usando en siete sitios que
   * mueven fichas o saldo. La clave existe para que el mismo efecto, ejecutado
   * dos veces, cuente como uno; si cambia en cada intento, el indice unico del
   * libro mayor ve dos apuntes distintos y **paga las dos veces**. Antes casi
   * no se notaba porque un update que fallaba se perdia; desde que el poller
   * reintenta, se nota.
   *
   * El `updateId` es lo unico que Telegram garantiza igual entre entregas del
   * mismo update. El sufijo separa varios efectos dentro de un mismo update
   * (cobrar y luego devolver, por ejemplo) para que no colisionen entre si.
   */
  private claveDeterminista(
    update: TelegramUpdateEnvelope,
    sufijo: string,
  ): string {
    return `u${update.updateId}:${sufijo}`;
  }

  private async isActorAdmin(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<boolean> {
    const role = this.resolveActorRole(context, update);
    if (role === "owner" || role === "admin" || role === "moderator") {
      return true;
    }

    const chatId = update.chat.chatId;
    const userId = update.user.userId;
    if (!chatId || !userId) {
      return false;
    }

    try {
      const admins = await this.cachedAdminIds(chatId);
      return admins.some((adminId) => adminId === userId);
    } catch {
      return false;
    }
  }

  /**
   * Si quien escribe puede REPARTIR la insignia de administrador — que no es lo
   * mismo que tenerla.
   *
   * Existe porque sin esto los comandos de nombrar admins eran una escalada de
   * privilegios: la promoción la hace el bot con SUS permisos, así que a un
   * admin al que el grupo le negó «añadir administradores» le bastaba con
   * pedírselo al bot. Pasó de verdad. Y el caso peor es circular: un admin
   * nombrado con `/admin` lleva `can_promote_members: false` a propósito
   * (`APPOINTED_ADMIN_RIGHTS`), y aun así podía nombrar a otros — saltándose
   * además al vigilante, que ignora lo que hace el bot y solo ve las
   * promociones nativas (`tripOnPromote`).
   *
   * Mira SOLO la lista viva de Telegram, nunca `membershipRole`: aquí se
   * reparte poder de Telegram, y un rol de nuestra base de datos no dice nada
   * de los poderes reales dentro del grupo. Al dueño le sale true solo — el
   * gateway le da todos los flags por ser `creator`.
   *
   * Ante un fallo de la consulta NIEGA, al revés que `isActorAdmin`. Es
   * deliberado: equivocarse hacia el «sí» aquí crea un administrador de verdad,
   * y puede que uno que después no se pueda quitar.
   */
  private async actorCanPromote(
    update: TelegramUpdateEnvelope,
  ): Promise<boolean> {
    const chatId = update.chat.chatId;
    const userId = update.user.userId;
    if (!chatId || !userId) {
      return false;
    }
    if (
      this.env.SUPERBOT_OWNER_TELEGRAM_ID &&
      userId === this.env.SUPERBOT_OWNER_TELEGRAM_ID
    ) {
      return true;
    }
    try {
      const admins = await this.cachedAdminInfo(chatId);
      return admins.some(
        (admin) => admin.userId === userId && admin.canPromote,
      );
    } catch {
      return false;
    }
  }

  /** El mismo texto para los cuatro comandos que reparten o retiran la
   * insignia, porque la razón para negarlos es exactamente la misma. */
  private static readonly PROMOTE_DENIED_TEXT = [
    "⛔ Para nombrar o quitar administradores necesitas el permiso «Añadir nuevos administradores», y no lo tienes.",
    "",
    "La promoción la haría yo con mis permisos, no con los tuyos: si te dejara, este comando sería una puerta trasera para repartir un poder que el grupo no te ha dado.",
    "Pídele al dueño del grupo que te lo dé, o que lo haga él.",
  ].join("\n");

  async simulate(botUsername: string, rawUpdate: unknown) {
    const update = normalizeUpdate(
      rawUpdate as Parameters<typeof normalizeUpdate>[0],
      botUsername,
    );

    return {
      ok: true,
      normalized: {
        ...update,
        receivedAt: update.receivedAt.toISOString(),
        chat: {
          ...update.chat,
          chatId: update.chat.chatId?.toString(),
        },
        user: {
          ...update.user,
          userId: update.user.userId?.toString(),
        },
        newChatMemberIds: update.newChatMemberIds.map((id) => id.toString()),
      },
      reply: handleCoreCommand(update, botUsername.replace(/^@/u, "")),
    };
  }
}

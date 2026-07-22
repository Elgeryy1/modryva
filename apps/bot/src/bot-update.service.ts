import { AsyncLocalStorage } from "node:async_hooks";
import { randomInt, randomUUID } from "node:crypto";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
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
  CaptchaFailAction,
  CaptchaModeValue,
  CaptchaRepository,
  ChatActivityEntry,
  ChatActivityRepository,
  ChatSettingRepository,
  ChipRepository,
  ContentLockRepository,
  CoopMissionRepository,
  CustomCommandRepository,
  D1Repository,
  EconomyRepository,
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
  InviteRepository,
  ModerationExtraRepository,
  ModerationRepository,
  NotesRepository,
  OwnerNetworkRepository,
  OwnerNetworkRiskRepository,
  OwnerNetworkRouteEventKind,
  PaymentRepository,
  PlatformRepository,
  PlatformUserBanRecord,
  PollRepository,
  ProductivityRepository,
  ReputationRepository,
  ScheduledPostRepository,
  StaffNoteRepository,
  TicketRepository,
  WebhookRepository,
  WelcomeRepository,
} from "@superbot/data";
import {
  AI_PACK_SUBSCRIPTION_PERIOD_SECONDS,
  AlwaysAllowAiAccessRepository,
  encryptManagedBotToken,
  GAMIFICATION_MISSION_KINDS,
  generateWebhookSecret,
  hashWebhookSecret,
  InMemoryAutomationRepository,
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
  InMemoryOwnerNetworkRepository,
  InMemoryOwnerNetworkRiskRepository,
  InMemoryPlatformRepository,
  InMemoryStaffNoteRepository,
  matchAutomation,
  tokenFingerprint,
} from "@superbot/data";
import type {
  ActorRole,
  BotReply,
  NormalizedReaction,
  ReactionContext,
  TelegramUpdateEnvelope,
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
  checkReviveSilence,
  checkRuleCooldown,
  decideContentReputation,
  decideReadOnly,
  type ManualEvent,
  parseRssCommand,
  parseWebhookCommand,
  rulesForDayPhase,
  rulesForExamMode,
  rulesForManualEvent,
  shouldActivateVolumeProtection,
  shouldCloseTopic,
  validateRuleExplanation,
} from "@superbot/module-automation";
import {
  addMissionProgress,
  advanceHunt,
  applyBotVoice,
  type BoardCase,
  boardCounts,
  botRpsChoice,
  buildActivityHeatmap,
  buildAfkClearReply,
  buildAfkNotice,
  buildAfkSetReply,
  buildEducationalNotice,
  buildFirstStepsChecklist,
  buildInlineHelpResult,
  buildInlineResults,
  buildMiniAppLink,
  buildOwnerChecklist,
  buildOwnerSummary,
  buildProtectionSummary,
  buildQuotePayload,
  buildReactionKeyboard,
  buildRpsKeyboard,
  buildSeasonAlbum,
  buildSettingsDeepLink,
  buildTemplateReply,
  buildWelcomeInlineKeyboard,
  type CasePriority,
  type CommunityIntent,
  canUnlockLinks,
  checkHuntClue,
  checkOverConfiguration,
  clampFloodLimit,
  classifyRuleSeverity,
  coinFlip,
  compareTwinGroups,
  computeGamesRetention,
  computeHypeLevel,
  computeRuleActivityEffect,
  computeRunAtMs,
  computeSilenceCurve,
  computeSocialStability,
  computeTrustTier,
  coopMissionRemaining,
  countInvitedMembers,
  crossedMilestone,
  DEFAULT_DOCK,
  DEFAULT_MODULE_NAMES,
  DENSITY_MODES,
  dayKeyFromMs,
  decideCelebrationMode,
  decideMandatoryReread,
  defaultWelcomeTemplate,
  detectAbandonedGroup,
  detectCrossposting,
  detectDeadTopics,
  detectDogpiling,
  detectDormantMembers,
  detectDramaticExit,
  detectEmergingTopics,
  detectIdleTopics,
  detectMonopoly,
  detectNoteRecall,
  detectReactionAbuse,
  detectTopicMisuse,
  dueRituals,
  eightBallAnswer,
  evaluateExpression,
  expandConfigMode,
  explainPermission,
  extractMentions,
  extractQuoteSource,
  findGhostMembers,
  formatCalcResult,
  formatHeatmap,
  formatMilestone,
  formatPollResults,
  formatQuizLeaderboard,
  formatRitual,
  formatTimeRuleWindow,
  formatTopPosters,
  formatTrustTier,
  fromBase64,
  generatePassword,
  type HuntState,
  humanizeDailyStats,
  huntProgress,
  type InlineResult,
  isDensityMode,
  isIcebreakerTopic,
  isLockTypeValue,
  isOnProbation,
  isQuizCorrect,
  isQuizScoresCommand,
  isStrictAtHour,
  langDisplayName,
  levelForXp,
  listIcebreakerTopics,
  loveScore,
  type MemberGoal,
  mapIntentToConfig,
  mapMemberGoalToOnboarding,
  matchByInterest,
  matchFilter,
  missionPercent,
  nextCaptchaFailAction,
  nextCaptchaMode,
  nextFloodAction,
  nextRaidMode,
  normalizeNoteName,
  orderBoard,
  orderQuizOptions,
  parseAfkCommand,
  parseAliasCommand,
  parseConfigModeCommand,
  parseCustomCommandConfig,
  parseFilterCommand,
  parseFunCommand,
  parseGiveawayCommand,
  parseGiveawayJoin,
  parseGlossaryCommand,
  parseInterestCommand,
  parseInviteCommand,
  parseLangCommand,
  parseNaturalRule,
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
  participationGini,
  peakHour,
  pickIcebreaker,
  pickOption,
  pickWinner,
  type Ritual,
  type RpsChoice,
  type RuleSeverityLevel,
  rankBrokenRules,
  rankRevertedActions,
  rankVotedIdeas,
  rateScore,
  recommendBySize,
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
  rollDice,
  routeDiscreetHelp,
  rpsOutcome,
  type SeasonAlbumEntry,
  sanitizeModuleName,
  scoreRulesClarity,
  searchRules,
  serializeNotes,
  sha256Hex,
  softenSanctionMessage,
  suggestGrowthTips,
  suggestOwnerMentorTips,
  suggestQuietVoices,
  summarizeRulesMobile,
  sumRecentMessages,
  type TimeRule,
  type TrustStats,
  t,
  tallyConflictTypes,
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
  applyDoubleRep,
  awardLegendaryItems,
  buildMemberCard,
  CASINO,
  type CasinoCommand,
  CHIP_PACKS,
  canPurchaseCosmetic,
  checkDailyQuota,
  computeAntiToxicityReward,
  computeBossProgress,
  computeCollectiveReward,
  computeDynamicCooldownMs,
  computePrestige,
  decideGameSanction,
  describeBullseye,
  describeDuel,
  describeOverUnder,
  describeSlot,
  detectImpossiblePattern,
  detectNegativeAchievements,
  divisionForPoints,
  earnPoints,
  evaluateSecretAchievements,
  evaluateStreakAchievements,
  GRATITUDE_PER_THANKS,
  grantGratitude,
  isCorrectAnswer,
  parseCasinoCommand,
  parseTriviaAnswer,
  parseTriviaCommand,
  pickQuestionIndex,
  rankGratitude,
  resolveBullseye,
  resolveDebateDuel,
  resolveDice,
  resolveDuel,
  resolveOverUnder,
  resolveSlot,
  scoreStatGuess,
  separateRookieRanking,
  spendEnergy,
  TRIVIA_QUESTIONS,
  verifyAntiBotChallenge,
  walletLevel,
} from "@superbot/module-games";
import {
  buildExpelConfirmKeyboard,
  computeSessionIdempotencyKey,
  encryptJoinRequestQueryId,
  generateChallengeNonce,
  generateGestureChallenge,
  generateSessionToken,
  hashSessionToken,
  parseGuardianCommand,
  parseStaffCallbackData,
  resolveEffectiveGuardianMode,
  validateGuardianSettings,
  verifyStaffCallback,
} from "@superbot/module-guardian";
import {
  buildInvoicePayload,
  parseInvoicePayload,
  parsePaymentCommand,
} from "@superbot/module-payments";
import {
  type AdjustDirection,
  type AntifloodSettings,
  type AntiraidSettings,
  adjustSanction,
  assessProportionality,
  assessReplyBait,
  type BotModeResolution,
  buildBanChecklist,
  buildCoexistenceAgreement,
  buildHumanVerifyButton,
  buildLearningNotice,
  buildObservationDiagnosis,
  buildOnDutyReply,
  buildRemoveWarnButton,
  buildSanctionRationale,
  buildSanctionSignature,
  type CaptchaSettings,
  canPerformAction,
  classifyActionSafety,
  classifyAttachment,
  classifyCaseSensitivity,
  classifyEditRisk,
  classifyReactionModeration,
  classifyRemorse,
  classifySeverityColor,
  classifyThreadSensitivity,
  computeSanctionDurationMs,
  computeStaffConfidence,
  convertSanction,
  decideLastChance,
  decideLinkSandbox,
  decideQuarantine,
  decideWarnEscalation,
  defaultAntifloodSettings,
  defaultAntiraidSettings,
  defaultCaptchaSettings,
  detectCamouflagedLink,
  detectCircularArgument,
  detectCommercialUsername,
  detectCopyPaste,
  detectCovertInvite,
  detectDmBait,
  detectDoxxing,
  detectEditSpam,
  detectFakeAirdrop,
  detectFakeScreenshotClaim,
  detectFakeSocialProof,
  detectGreetingSpam,
  detectInhumanRhythm,
  detectJokeEscalation,
  detectNewDomain,
  detectOperationalBias,
  detectPassiveAggressive,
  detectSelfDealing,
  detectSignatureSpam,
  detectSilentSpam,
  detectSocialManipulation,
  detectSpoiler,
  detectUnrealPromises,
  detectUsernameLink,
  type EmergencyPermissionRole,
  evaluateFlood,
  evaluateLocks,
  evaluateRaid,
  extractMentionTargetId,
  extractReplyContext,
  type FloodCounterStore,
  formatAdminList,
  formatCaseNote,
  formatFedInfo,
  formatFedStat,
  formatSanctionReasonList,
  formatTolerancePreset,
  formatWarnPolicy,
  generateCaptchaChallenge,
  grantEmergencyPermission,
  groupSimilarReports,
  guardImpulsiveAction,
  hashCaptchaAnswer,
  InMemoryBotPermissionCache,
  InMemoryOncePerWindowGate,
  InMemoryReactionSurgeStore,
  isActiveChatMember,
  isLockType,
  isNightTime,
  isReactionSurge,
  isSeparationActive,
  isServiceMessage,
  isTypeLockedInTopic,
  isWithinGrace,
  LOCKABLE_TYPES,
  type LockType,
  MAX_SURGE_THRESHOLD,
  matchBlocklist,
  normalizeBlocklistTrigger,
  onDutyStaff,
  parseAdminToolCommand,
  parseAntifloodCommand,
  parseAntiraidCommand,
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
  parseShiftCommand,
  parseToleranceCommand,
  parseTopicScopeCommand,
  parseWarnConfigCommand,
  predictSanctionEffect,
  REACTION_MODERATION_SETTING_KEY,
  type ReactionModerationConfig,
  type RoleActionGuardRole,
  recommendDeescalation,
  requiresPeerReview,
  resolveBotMode,
  resolveEnforceOutcome,
  resolveSanctionReason,
  resolveTolerancePreset,
  resolveTopicConfig,
  rulesForOwnerAbsent,
  type Sanction,
  type Shift,
  scoreDecisionConfidence,
  serializeFedBans,
  shieldFromMentions,
  shouldFilterByChars,
  type TopicScopedConfig,
  verifyCaptchaAnswer,
  type WarnMode,
  type WarnPolicy,
} from "@superbot/module-security";
import {
  analyzeAnnouncement,
  applyVipTreatment,
  assessDataQuality,
  assessQuestionCompleteness,
  automationMatches,
  bucketAppealsByIncident,
  buildAnnouncementPreviews,
  buildAppealKeyboard,
  buildAppealLearning,
  buildAppealLog,
  buildDoctorReport,
  buildFeedbackRelay,
  buildKnownIssueNotice,
  buildMaintenanceNotice,
  buildMissionCompletedText,
  buildPostLaunchReport,
  buildPublishSummary,
  buildQuarantineKeyboard,
  buildQuarantineLog,
  buildRoleAnnouncements,
  categorizeAppeal,
  classifyKnowledgeLevel,
  compareMonths,
  decideHumanEscalation,
  decideSaveMode,
  decodeConfigRecipe,
  detectAngerLevel,
  detectAnswerBegging,
  detectBurnout,
  detectOffTopicStudy,
  detectSensitiveAnnouncement,
  diffConfigRecipe,
  encodeConfigRecipe,
  estimateAppealEta,
  evaluateQuarantineCandidate,
  formatAppeals,
  formatAutomationList,
  formatBadges,
  formatEvents,
  formatMissionProgress,
  formatMissions,
  formatQuarantineList,
  formatReminderTime,
  formatStatusPage,
  formatVerticalPreset,
  type IncidentEvent,
  type IncidentStatus,
  isDoctorCommand,
  type MediationEvent,
  type MediationState,
  markDelicateAppeal,
  nextIncidentStatus,
  nextMediationStep,
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
  parseVerticalCommand,
  reminderRunAtMs,
  scoreDoubt,
  shouldEscalateBotError,
  shouldEscalateToOwner,
  shouldSendTicketFollowup,
  shouldUnpinAnnouncement,
  summarizeAcceptedAppeals,
  summarizeAppealForStaff,
  summarizeAppealHistory,
  summarizeClientHistory,
  supportHoursStatus,
  type VipClientPlan,
} from "@superbot/module-support";
import type { RuntimeEnv } from "@superbot/shared";
import {
  resolveGuardianMiniAppUrl,
  TELEGRAM_ALLOWED_UPDATES,
} from "@superbot/shared";
import type {
  QuoteRenderer,
  SpamCheckProvider,
  TelegramChatAdminInfo,
  TelegramGateway,
  TelegramManagedBotGateway,
  TelegramReactionActor,
} from "@superbot/telegram";
import { normalizeUpdate } from "@superbot/telegram";
import {
  handleCoreCallback,
  handleCoreCommand,
  type MiniAppLink,
} from "./core-handlers.js";
import { deliverBotReply, extractCallbackMessageId } from "./delivery.js";
import { handleGamesHub } from "./handlers/games-hub.js";
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
  CAPTCHA_REPOSITORY,
  CHAT_ACTIVITY_REPOSITORY,
  CHAT_SETTING_REPOSITORY,
  CHIP_REPOSITORY,
  CONTENT_LOCK_REPOSITORY,
  COOP_MISSION_REPOSITORY,
  CUSTOM_COMMAND_REPOSITORY,
  D1_REPOSITORY,
  ECONOMY_REPOSITORY,
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
  INVITE_REPOSITORY,
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

const RPS_EMOJI: Record<RpsChoice, string> = {
  piedra: "🪨",
  papel: "📄",
  tijera: "✂️",
};

const loveVerdict = (score: number): string =>
  score >= 80
    ? "Boda a la vista! 💍"
    : score >= 60
      ? "Hay quimica de la buena. 🔥"
      : score >= 40
        ? "Con esfuerzo, todo se puede. 🤔"
        : score >= 20
          ? "Mejor como amigos... 🫠"
          : "Huye mientras puedas. 🏃";

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
    "Aviso: el administrador que me ha anadido esta baneado de la plataforma Modryva.",
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
const GATED_HANDLERS: Readonly<Record<string, keyof BotModeResolution>> = {
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
};

/** Post-processors gated the same way. Automations (ECA) can autonomously
 * sanction, so they follow the moderation flag. */
const GATED_POSTPROCESSORS: Readonly<Record<string, keyof BotModeResolution>> =
  {
    "automation-message": "moderation",
    "automation-new-members": "moderation",
  };

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
export class BotUpdateService {
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
  ) {}

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

    await this.repository.markUpdateProcessed(botUsername, update.updateId);

    return {
      ok: true,
      updateId: update.updateId,
      duplicate: false,
      handled: Boolean(commandReply),
      replyDelivered: Boolean(delivery?.ok),
    };
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
      const reply = await handler.handle(input);
      if (reply) {
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
        name: "core.command",
        handle: ({ update, replyBotUsername, miniAppLink }) =>
          handleCoreCommand(update, replyBotUsername, miniAppLink),
      },
      {
        name: "core.callback",
        handle: ({ update, replyBotUsername, miniAppLink }) =>
          handleCoreCallback(update, replyBotUsername, miniAppLink),
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
        name: "economy.command",
        handle: ({ context, update }) =>
          this.handleEconomyCommand(context, update),
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
   */
  private readonly adminCache = new Map<
    string,
    { admins: readonly bigint[]; expiresAt: number }
  >();
  private static readonly ADMIN_CACHE_TTL_MS = 300_000;

  private async cachedAdminIds(groupId: bigint): Promise<readonly bigint[]> {
    const key = groupId.toString();
    const cached = this.adminCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.admins;
    }

    const result = await this.telegramGateway.getChatAdministrators({
      chatId: groupId,
      token: this.telegramToken(),
    });
    const admins = (result.admins ?? []).map((admin) => admin.userId);
    this.adminCache.set(key, {
      admins,
      expiresAt: Date.now() + BotUpdateService.ADMIN_CACHE_TTL_MS,
    });
    return admins;
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

    const root = renderSettingsRoot(groupId, resolved.title);
    // In a private chat we can offer a web_app button. This is the Mini App
    // entry that works for BOTH the primary bot and managed child bots: the URL
    // carries `?tgbot=<bot>&sp=cfg_<gid>` so the web app tells the API which bot
    // signed initData (→ its token/tenant) and which group to configure. Child
    // bots have no named app, so this is their only Mini App path into config.
    const appUrl = readAppUrl(this.env.TELEGRAM_APP_URL);
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
          "✍️ Enviame ahora el nuevo mensaje de *bienvenida* como un mensaje normal aqui.\nPuede llevar variables `{first_name}` `{chat_title}` y botones `[Texto](buttonurl://url)`.",
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
          "✍️ Envíame ahora las *reglas* del grupo como un mensaje normal aqui.",
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
      await this.withReplyTarget(update),
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
      return {
        parseMode: "Markdown",
        text: `🪙 *Tus fichas:* ${wallet.balance}\n_commit:_ \`${wallet.serverSeedHash.slice(0, 16)}…\` · nonce ${wallet.nonce}`,
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
        randomUUID(),
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
      betId: randomUUID(),
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
    const betId = randomUUID();
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
    const { winner } = resolveDuel(rollA, rollB);
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
    const result = parseModerationCommand(await this.withReplyTarget(update));

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

    const endsAt = result.plan.durationMs
      ? new Date(Date.now() + result.plan.durationMs)
      : undefined;
    const moderationResult = await this.moderationRepository.createSanction({
      tenantId: context.tenantId,
      chatId: context.chatId,
      actorUserId: context.userId,
      subjectTelegramUserId: result.plan.targetTelegramUserId,
      reason: result.plan.reason,
      kind: result.plan.action === "ban" ? "ban" : "mute",
      ...(endsAt ? { endsAt } : {}),
      ...(update.chat.chatId ? { telegramChatId: update.chat.chatId } : {}),
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
        `Usuario: ${result.plan.targetTelegramUserId.toString()}`,
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
    if (failure) {
      return {
        text: `⚠️ Caso #${moderationResult.caseNumber} registrado, pero Telegram rechazó la sanción: ${failure} — el usuario no está en el grupo o me faltan permisos.`,
      };
    }

    return {
      text: `Moderación aplicada: ${result.plan.action} a ${result.plan.targetTelegramUserId.toString()} (caso #${moderationResult.caseNumber}).`,
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

    return {
      text: `Moderación aplicada: ${action} a ${targetTelegramUserId.toString()}${
        reverted > 0 ? ` (sanciones revertidas: ${reverted})` : ""
      }.`,
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

  private async handleContentLock(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.kind !== "message" ||
      !context.chatId ||
      !update.chat.chatId ||
      update.messageId === undefined
    ) {
      return null;
    }

    // Admins, moderators and the configured owner bypass content locks.
    if (await this.isActorAdmin(context, update)) {
      return null;
    }

    const locked = await this.contentLockRepository.getLocked(
      context.tenantId,
      context.chatId,
    );

    let violation =
      locked.length > 0
        ? evaluateLocks(update.content, locked as LockType[])
        : null;

    if (!violation) {
      // Topic-scoped locks set via /topicconfig can lock additional content
      // types inside one specific topic, without touching the chat-wide
      // /lock list (which stays authoritative for every other topic).
      const topicScope = await this.getTopicLockConfig(
        context.tenantId,
        context.chatId,
      );
      const topicKey =
        update.chat.topicId === undefined
          ? undefined
          : String(update.chat.topicId);
      const topicLockedTypes = LOCKABLE_TYPES.filter((type) =>
        isTypeLockedInTopic(topicScope, topicKey, type),
      );
      violation =
        topicLockedTypes.length > 0
          ? evaluateLocks(update.content, topicLockedTypes)
          : null;
    }

    if (!violation) {
      return null;
    }

    try {
      await this.telegramGateway.deleteMessage({
        chatId: update.chat.chatId,
        messageId: update.messageId,
        token: this.telegramToken(),
      });
    } catch {
      // Deletion failures never block the audit trail.
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "system",
      action: "content_lock.enforced",
      resourceType: "content_lock",
      resourceId: context.chatId,
      ...(context.userId ? { actorId: context.userId } : {}),
      payload: {
        lockType: violation,
        telegramUserId: update.user.userId?.toString(),
        messageId: update.messageId,
      },
    });
    await this.recordRiskSignal(
      context,
      update.user.userId,
      violation === "url" || violation === "forward" ? "link" : "deleted",
    );

    return { text: `Contenido bloqueado (${violation}) y eliminado.` };
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
      text: `Reputación +1 para ${command.targetTelegramUserId.toString()} (total ${profile.points}).`,
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
            id: profile.telegramUserId.toString(),
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
        text: "Codigo aplicado. Has desbloqueado 1 bot personalizado. Usa /createbot para empezar.",
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
          `Codigo: ${promo.code}`,
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

  private isConfiguredOwner(userId: bigint | undefined): boolean {
    return (
      userId !== undefined && this.env.SUPERBOT_OWNER_TELEGRAM_ID === userId
    );
  }

  private async platformBanBlock(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<{ reply: BotReply | null } | null> {
    const userId = update.user.userId;
    if (!userId || this.isConfiguredOwner(userId)) {
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
    if (!this.isConfiguredOwner(actor)) {
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
    if (this.isConfiguredOwner(target)) {
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
      return { text: "Memoria de IA borrada para esta conversacion." };
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
    const messages = buildAiMessages(safeCommand, history);
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
          : "El servicio de IA no esta disponible ahora mismo. Intentalo mas tarde.",
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
      return { text: "La clasificacion se mide dentro de un grupo." };
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
      text: `🎯 ¡Correcto! ${update.user.username ?? update.user.userId.toString()} suma un punto.`,
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
      text: `🏆 ¡Correcto! ${update.user.username ?? update.user.userId.toString()} gana el punto.`,
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
      return { text: "Los logs D1 se configuran dentro de un grupo." };
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
      return { text: "No tienes permisos para configurar logs D1." };
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
      body: `Este chat recibira eventos D1 de ${context.chatId}.`,
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
        text: `Cuarentena D1: ${config.enabled ? "ON" : "OFF"} (${config.strictness}).`,
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
      return { text: `Cuarentena D1: ${config.enabled ? "ON" : "OFF"}.` };
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
        return { text: "No pude identificarte para crear la apelacion." };
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
        title: "Apelacion D1 abierta",
        body: buildAppealLog(appeal),
        replyMarkup: buildAppealKeyboard(appeal.id),
      });
      return { text: `Apelacion recibida. ID: ${appeal.id}` };
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
      return { text: "Esa apelacion no existe o ya fue resuelta." };
    }

    await this.emitD1Log({
      context,
      chatId: appeal.chatId,
      kind: `d1.appeal.${command.kind}`,
      title: `Apelacion ${command.kind === "accept" ? "aceptada" : "denegada"}`,
      body: `ID ${appeal.id} - caso ${appeal.caseRef}.`,
    });

    return {
      text:
        command.kind === "accept"
          ? `Apelacion ${appeal.id} aceptada. Revisa si procede /unban o /unmute.`
          : `Apelacion ${appeal.id} denegada.`,
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
      return { text: "Esa apelacion ya fue resuelta.", edit: true };
    }

    await this.emitD1Log({
      context,
      chatId: appeal.chatId,
      kind: `d1.appeal.${parsed.action}`,
      title: `Apelacion ${parsed.action}`,
      body: `ID ${appeal.id} - caso ${appeal.caseRef}.`,
    });

    return {
      text: `Apelacion ${appeal.id}: ${parsed.action === "accept" ? "aceptada" : "denegada"}.`,
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
      return { text: "El diagnostico D1 se ejecuta dentro de un grupo." };
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
      title: "Diagnostico D1 ejecutado",
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
        title: "Automatizacion eliminada",
        body: `Regla: ${command.ruleId}`,
      });
      return {
        text: removed
          ? "Automatizacion eliminada."
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
      title: "Automatizacion creada",
      body: `${rule.id}: ${rule.triggerKind} ${rule.triggerValue} -> ${rule.actionKind}`,
    });
    return { text: `Automatizacion creada: ${rule.id}` };
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
      title: "Automatizacion ejecutada",
      body: `${rule.id}: ${rule.actionKind}`,
    });

    if (rule.actionKind === "reply") {
      return { text: rule.actionValue ?? "Automatizacion ejecutada." };
    }

    if (rule.actionKind === "delete") {
      if (update.messageId) {
        await this.telegramGateway.deleteMessage({
          chatId: update.chat.chatId,
          messageId: update.messageId,
          token: this.telegramToken(),
        });
      }
      return { text: "Automatizacion aplicada: mensaje eliminado." };
    }

    if (rule.actionKind === "log") {
      return { text: rule.actionValue ?? "Automatizacion registrada." };
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
      reason: `regla automatica ${rule.id}`,
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
    return { text: "Mensaje enviado a cuarentena por regla automatica." };
  }

  private async handleQuarantineAmbient(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.kind !== "message" ||
      update.command ||
      !context.chatId ||
      !update.chat.chatId ||
      !update.user.userId
    ) {
      return null;
    }

    if (await this.isActorAdmin(context, update)) {
      return null;
    }

    const config = await this.d1Repository.getQuarantineConfig(context.chatId);
    if (!config.enabled) {
      return null;
    }

    const decision = evaluateQuarantineCandidate(
      update.content,
      update.messageText,
      config.strictness,
    );
    if (!decision?.quarantine) {
      return null;
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
      reason: decision.reason,
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

    return { text: "Mensaje enviado a cuarentena para revision." };
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
        title: "Mision cerrada",
        body: `Mision: ${command.missionId}`,
      });
      return { text: closed ? "Mision cerrada." : "No existe esa mision." };
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
      title: "Mision creada",
      body: `${mission.id}: ${mission.title}`,
    });
    return {
      text: `Mision creada: ${mission.id} -> badge ${mission.rewardBadge}`,
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
        title: "Mision completada",
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
      text: `⏰ Recordatorio programado para ${runAt.toISOString()} (ID ${reminder.id}).`,
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
      text: `Publicación programada para ${runAt.toISOString()} (ID ${post.id}).`,
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
      return { text: "Este sorteo no esta disponible." };
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
      return { text: "Esta encuesta no esta disponible." };
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

    const beforeLevel = levelForXp(before?.xp ?? 0);
    const afterLevel = levelForXp(after.xp);

    if (afterLevel > beforeLevel && update.chat.chatId) {
      // Quiet mode: the XP is still granted above, but when the admin has
      // silenced the bot we skip the unprompted "sube al nivel" announcement.
      if (await this.isChatQuiet(context.tenantId, context.chatId)) {
        return;
      }
      await this.telegramGateway.sendMessage({
        chatId: update.chat.chatId,
        reply: {
          text: `${update.user.username ?? update.user.userId.toString()} sube al nivel ${afterLevel}!`,
        },
        token: this.telegramToken(),
      });
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
    const first = args[0];
    if (first?.startsWith("@") && first.length > 1) {
      const resolved = await this.repository.findTelegramUserIdByUsername(
        first.slice(1),
      );
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
    const warning = await this.moderationRepository.createWarning({
      tenantId: context.tenantId,
      chatId: context.chatId,
      actorUserId: context.userId,
      subjectTelegramUserId: target,
      reason,
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

    if (!escalation.escalate) {
      return {
        text: `⚠️ Aviso a ${target.toString()}. Warns: *${count}/${policy.limit}*.${reason ? `\nMotivo: ${reason}` : ""}`,
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
        text: `🚫 ${target.toString()} alcanzó el límite de ${policy.limit} warns, pero Telegram rechazó *${escalation.mode}*: ${escalationFailure} — el usuario no está en el grupo o me faltan permisos. Contador reiniciado.`,
        parseMode: "Markdown",
      };
    }

    return {
      text: `🚫 ${target.toString()} alcanzó el límite de ${policy.limit} warns. Sanción aplicada: *${escalation.mode}*. Contador reiniciado.`,
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
      tenantId: context.tenantId,
      chatId: context.chatId,
      actorUserId: context.userId,
      subjectTelegramUserId: target,
      reason: "límite de warns",
      kind: action,
      ...(endsAt ? { endsAt } : {}),
      ...(chatId ? { telegramChatId: chatId } : {}),
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
    if (!target || mode === "delete") {
      return null;
    }

    if (mode === "warn") {
      return this.applyWarn(
        context,
        update,
        target,
        `blocklist: ${hit.trigger}`,
      );
    }

    const action = mode === "ban" ? "ban" : mode === "kick" ? "ban" : "mute";
    const enforcement = await this.applyTelegramEnforcement(
      action,
      update,
      target,
      undefined,
    );
    if (mode === "kick" && update.chat.chatId) {
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
    if (failure) {
      return {
        text: `🚷 Mensaje bloqueado (${hit.trigger}), pero no pude aplicar "${mode}": ${failure}.`,
      };
    }

    return {
      text: `🚷 Mensaje bloqueado (${hit.trigger}). Acción: ${mode}.`,
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
    const result = parseGuardianCommand(update);
    if (!result) {
      return null;
    }
    if (!result.ok) {
      return { text: result.error.usage };
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

    if (!(await this.isActorAdmin(context, update))) {
      return { text: "Solo el staff puede decidir esto." };
    }

    const session = await this.guardianRepository.findSessionById(
      parsed.sessionId,
    );
    if (!session) {
      return { text: "Esta verificación ya no existe.", edit: true };
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
          return { text: "Esta verificación ya fue decidida.", edit: true };
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
          telegramOk = false;
          this.logger.error(
            `guardian staff ${parsed.action} failed to reach Telegram for session ${session.id}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
        await this.guardianRepository.createStaffDecision({
          sessionId: session.id,
          moderatorTelegramId: moderatorId,
          action: parsed.action,
        });
        const who = update.user.username
          ? `@${update.user.username}`
          : moderatorId.toString();
        const okText =
          parsed.action === "approve"
            ? `✅ Aprobado manualmente por ${who}.`
            : `❌ Rechazado manualmente por ${who}.`;
        const failText =
          parsed.action === "approve"
            ? `⚠️ ${who} pulsó Aprobar, pero Telegram NO admitió al usuario (¿solicitud caducada o al bot le falta el permiso "Añadir miembros"?). Revísalo a mano.`
            : `⚠️ ${who} pulsó Rechazar, pero Telegram NO procesó el rechazo (¿solicitud caducada?). Revísalo a mano.`;
        return {
          text: telegramOk ? okText : failText,
          edit: true,
        };
      }
      case "retry": {
        if (alreadyDecided) {
          return { text: "Esta verificación ya fue decidida.", edit: true };
        }
        await this.guardianRepository.createStaffDecision({
          sessionId: session.id,
          moderatorTelegramId: moderatorId,
          action: "retry",
        });

        // The original Mini App token is never persisted in plaintext (only
        // its hash), so a retry can't just resend the old link — rotate to a
        // fresh token + TTL, matching how a brand-new session is opened.
        const settings = await this.guardianRepository.getSettings(
          session.tenantId,
          session.chatId,
        );
        const newToken = generateSessionToken();
        const newExpiresAt = new Date(
          Date.now() + (settings?.sessionTtlSeconds ?? 600) * 1000,
        );
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

        // Best-effort DM — Telegram blocks a bot from messaging someone who
        // has never started a chat with it, which is common for someone who
        // only ever interacted via the join-request Mini App prompt. Report
        // the real outcome to STAFF instead of assuming it worked. The link
        // MUST be a `web_app` inline button (only valid in a private chat,
        // which this always is) — a plain URL in the text opens the external
        // browser instead of the in-app Mini App WebView.
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

        return {
          text: dmSent
            ? "🔁 Repetición solicitada y avisada a la persona por privado."
            : "🔁 Repetición solicitada, pero no se pudo avisar por privado (la persona nunca ha hablado con el bot). Pídele que le escriba primero, o que reabra la Mini App si la sigue teniendo abierta.",
          edit: true,
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
        // confirmation callback (rule: expel needs confirmation).
        return {
          text: "⚠️ ¿Expulsar a este usuario del grupo? Confirma para continuar.",
          replyMarkup: buildExpelConfirmKeyboard(session.id, sessionSecret),
          edit: true,
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
          };
        }
        await this.guardianRepository.createStaffDecision({
          sessionId: session.id,
          moderatorTelegramId: moderatorId,
          action: "expel",
        });
        return { text: "🚪 Usuario expulsado del grupo.", edit: true };
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
            } catch {
              // Best-effort.
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
        } catch {
          // Best-effort.
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
          } catch {
            // Best-effort.
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
      } catch {
        // Best-effort.
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
    const challenge = generateGestureChallenge(
      seed,
      nonce,
      settings.requiredPhotos === 2 ? 2 : 1,
      forcedGesture,
      forcedGesture2,
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

    // A fresh chat_join_request for someone whose ONLY active session is
    // "awaiting_retry" means they're genuinely trying again (re-requested to
    // join, or reopened the invite) — supersede the stale one instead of
    // silently dropping this new attempt as a duplicate (idempotencyKey is
    // unique per chat+user, so createSession below would otherwise collide
    // and this person would be stuck forever with no way back in). A session
    // still actively in progress (pending/capturing/analyzing) is left
    // alone — only a STAFF-requested retry gets superseded here.
    const existingActive = await this.guardianRepository.findActiveSession(
      context.chatId,
      userId,
    );
    if (existingActive && existingActive.status === "awaiting_retry") {
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
    try {
      await this.telegramGateway.sendChatJoinRequestWebApp({
        chatJoinRequestQueryId: queryId,
        webAppUrl: miniAppUrl,
        token: this.telegramToken(),
      });
    } catch {
      // Best-effort — the request stays pending in Telegram's native UI.
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
    const result = parseFederationCommand(await this.withReplyTarget(update));

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

      // Target protection: a fed admin must never be able to fban the owner, a
      // fellow fed admin (only the owner may), themselves, or the bot.
      if (target === chatFed.ownerTelegramId) {
        return { text: "No puedes fbanear al dueño de la federación." };
      }
      if (userId !== undefined && target === userId) {
        return { text: "No puedes fbanearte a ti mismo." };
      }
      const botId = this.telegramToken()?.split(":")[0];
      if (botId && /^\d+$/u.test(botId) && target === BigInt(botId)) {
        return { text: "No puedo fbanearme a mi mismo." };
      }
      if (
        !isOwner &&
        (await this.federationRepository.isFedAdmin(chatFed.fedId, target))
      ) {
        return {
          text: "Solo el dueño de la federación puede sancionar a otros admins.",
        };
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
  private async handleChatMemberUpdate(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.kind !== "chat_member" || !update.chatMemberUpdate) {
      return null;
    }

    const { chatId, telegramUserId, newStatus } = update.chatMemberUpdate;
    if (!chatId || !telegramUserId || isActiveChatMember(newStatus as never)) {
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
        text: "No pude generar la cita ahora mismo. Intentalo mas tarde.",
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

    return {
      text: buildProtectionSummary({
        antiflood: antiflood?.enabled ?? false,
        captcha: captcha?.enabled ?? false,
        antiraid: antiraid?.enabled ?? false,
        lockedTypes: [],
        blocklistCount: 0,
        nightMode: hygiene.nightMode,
        welcomeMute: hygiene.welcomeMute,
      }),
    };
  }

  private async handleIdGroupCommand(
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (update.command?.name !== "idgroup") {
      return null;
    }

    const chatId = update.chat.chatId;
    if (!chatId) {
      return { text: "No he podido leer el ID de este chat." };
    }

    const kind =
      update.chat.chatType === "private"
        ? "chat privado"
        : (update.chat.chatType ?? "chat");
    return {
      text: `🆔 ID de este ${kind}: ${chatId.toString()}`,
    };
  }

  private async handleVerticalCommand(
    _context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const result = parseVerticalCommand(update);

    if (!result) {
      return null;
    }

    if (!result.ok) {
      return { text: result.error.usage };
    }

    return { text: formatVerticalPreset(result.command.kind) };
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
    const result = scoreRulesClarity(config?.rulesText ?? "");
    const issues =
      result.issues.length > 0
        ? result.issues.map((issue) => `• ${issue}`).join("\n")
        : "• Sin problemas de claridad detectados";

    return {
      text: `📏 Claridad de las reglas: ${result.score}/100\n${issues}`,
    };
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

  private async handleEconomyCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const name = update.command?.name;
    if (name !== "puntos" && name !== "checkin") {
      return null;
    }

    if (!context.chatId || !update.user.userId) {
      return { text: "Los puntos se consultan dentro de un grupo." };
    }

    const nowMs = update.receivedAt.getTime();
    const stored = (await this.economyRepository.getWallet(
      context.tenantId,
      context.chatId,
      update.user.userId,
    )) ?? { balance: 0, lastEarnedMs: 0 };

    const DAILY_POINTS = 10;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const claimedToday =
      stored.lastEarnedMs > 0 &&
      Math.floor(stored.lastEarnedMs / DAY_MS) === Math.floor(nowMs / DAY_MS);

    const { wallet, granted } = earnPoints(
      stored,
      DAILY_POINTS,
      nowMs,
      DAILY_POINTS,
      claimedToday ? DAILY_POINTS : 0,
    );

    if (granted > 0) {
      await this.economyRepository.setWallet(
        context.tenantId,
        context.chatId,
        update.user.userId,
        wallet,
      );
      return {
        text: `🎁 Check-in diario: +${granted} puntos. Saldo: ${wallet.balance}.`,
      };
    }

    return {
      text: `💰 Tu saldo: ${stored.balance} puntos. Ya hiciste el check-in de hoy; vuelve mañana.`,
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

    const verdict = classifyAttachment(attachment.fileName ?? "");
    if (!verdict.dangerous) {
      return null;
    }

    if (await this.isActorAdmin(context, update)) {
      return null;
    }

    return this.deleteOrWatch(
      context,
      update.chat.chatId,
      update.messageId,
      `🚫 Archivo bloqueado por seguridad (${verdict.reason ?? "tipo de archivo peligroso"}).`,
      "⚠️ *Ojo con el archivo de arriba* — parece peligroso (podría ser malware). No lo abras ni lo descargues. No puedo borrarlo porque no soy administrador del grupo.",
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

    if (await this.isActorAdmin(context, update)) {
      return null;
    }

    if (!detectDoxxing(update.messageText).matched) {
      return null;
    }

    return this.deleteOrWatch(
      context,
      update.chat.chatId,
      update.messageId,
      "🔒 Mensaje eliminado: parecía contener datos personales (telefono, DNI o similar).",
      "⚠️ *Cuidado* — el mensaje de arriba parece contener datos personales (teléfono, DNI o similar). No lo reenvíes. No puedo borrarlo porque no soy administrador del grupo.",
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

    const text = update.messageText;
    const score = [
      detectCamouflagedLink(text).matched,
      detectCovertInvite(text).matched,
      detectDmBait(text).matched,
      detectFakeAirdrop(text).matched,
      detectFakeScreenshotClaim(text).matched,
      detectFakeSocialProof(text).matched,
      detectUnrealPromises(text).matched,
      detectCommercialUsername(update.user.username).matched,
      detectUsernameLink(update.user.username).matched,
    ].filter(Boolean).length;

    if (score < 2) {
      return null;
    }

    return this.deleteOrWatch(
      context,
      update.chat.chatId,
      update.messageId,
      "🚫 Mensaje eliminado: coincide con varias señales típicas de estafa.",
      "⚠️ *Cuidado, posible estafa* — el mensaje de arriba tiene varias señales típicas de fraude (enlaces camuflados, promesas irreales, MD no solicitados…). No hagas clic ni compartas datos. No puedo borrarlo porque no soy administrador del grupo.",
    );
  }

  /**
   * Records every non-command text message into the rolling chat-activity
   * log (kind="message"), regardless of what later handlers do with it (even
   * a message that gets deleted for spam is worth keeping in the window for
   * pattern detectors like tone-shift or hot-users). Always returns null and
   * never throws: a logging hiccup must never block message processing.
   */
  private async handleChatActivityLogger(
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

    try {
      const replyUserId = extractReplyContext(update.raw).userId;
      await this.chatActivityRepository.record({
        tenantId: context.tenantId,
        chatId: context.chatId,
        kind: "message",
        ...(update.user.userId !== undefined
          ? { telegramUserId: update.user.userId }
          : {}),
        ...(update.user.username !== undefined
          ? { username: update.user.username }
          : {}),
        text: update.messageText,
        hasLink: update.content.hasUrl,
        hasMention: update.content.hasMention,
        isReply: replyUserId !== undefined,
        ...(replyUserId !== undefined
          ? { repliedToUserId: BigInt(replyUserId) }
          : {}),
        ...(update.chat.topicId !== undefined
          ? { topic: String(update.chat.topicId) }
          : {}),
        ...(update.messageId !== undefined
          ? { messageId: BigInt(update.messageId) }
          : {}),
      });
    } catch {
      // Non-fatal: the activity log is best-effort, never blocks the pipeline.
    }

    return null;
  }

  /**
   * Edit-risk / edit-spam ambient guard: when a message is edited, compare it
   * against the stored original (looked up by telegram message id) and warn on
   * edits that sneak in a link/mention or rewrite the message late — a classic
   * "clean on entry, spam after edit" evasion. Only warns on strong signals;
   * never deletes. Best-effort: a missing original (outside the log window)
   * just skips.
   */
  private async handleEditedMessage(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.kind !== "edited_message" ||
      update.messageId === undefined ||
      !context.chatId ||
      update.messageText === undefined
    ) {
      return null;
    }

    const original = await this.chatActivityRepository.findOriginalMessage(
      context.tenantId,
      context.chatId,
      BigInt(update.messageId),
    );
    if (!original || original.text === undefined) {
      return null;
    }

    const spam = detectEditSpam(
      {
        hasUrl: original.hasLink,
        hasMention: original.hasMention,
        text: original.text,
      },
      {
        hasUrl: update.content.hasUrl,
        hasMention: update.content.hasMention,
        text: update.messageText,
      },
    );
    const secondsAfterPost = Math.max(
      0,
      Math.round((Date.now() - original.createdAt.getTime()) / 1000),
    );
    const risk = classifyEditRisk({
      oldHasUrl: original.hasLink,
      newHasUrl: update.content.hasUrl,
      oldLen: original.text.length,
      newLen: update.messageText.length,
      secondsAfterPost,
    });

    if (!spam.suspicious && risk.risk !== "alto") {
      return null;
    }

    let reason: string;
    if (spam.suspicious) {
      reason =
        spam.reason === "added-url"
          ? "añadió un enlace al editar"
          : spam.reason === "added-mention"
            ? "añadió una mención al editar"
            : "infló el texto al editar";
    } else {
      reason = risk.reason;
    }
    return { text: `✏️ Edición sospechosa: ${reason}.` };
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
  private async handleScheduledStrictMode(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    if (
      update.kind !== "message" ||
      update.command ||
      !context.chatId ||
      !update.chat.chatId ||
      update.messageId === undefined ||
      !update.content.hasUrl
    ) {
      return null;
    }

    const raw = await this.chatSettingRepository.getValue(
      context.tenantId,
      context.chatId,
      "schedule_rules",
    );
    const rules: TimeRule[] = Array.isArray(raw) ? (raw as TimeRule[]) : [];
    if (
      rules.length === 0 ||
      !isStrictAtHour(rules, new Date().getUTCHours())
    ) {
      return null;
    }

    if (await this.isActorAdmin(context, update)) {
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

    return {
      text: "🌙 Modo estricto por horario: no se permiten enlaces a esta hora.",
    };
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
    if (!hygiene.rtlFilter && !hygiene.cjkFilter) {
      return null;
    }

    if (
      !shouldFilterByChars(update.messageText, {
        rtlFilter: hygiene.rtlFilter,
        cjkFilter: hygiene.cjkFilter,
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
    if (!hygiene.nightMode) {
      return null;
    }

    const hour = new Date().getUTCHours();
    if (
      !isNightTime(hour, {
        startHour: hygiene.nightStart,
        endHour: hygiene.nightEnd,
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
              text: "Anadir Modryva",
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
        "Para moderacion y automatizaciones, instala el bot en el grupo.",
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
          text: "Esta trivia ya no esta activa.",
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
      text: "Accion portable no disponible.",
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
          const messages = buildAiMessages({
            kind: "chat",
            prompt: sanitized.text,
          });
          this.addAiMemoryHint(
            messages,
            await this.buildAiMemoryHint(context, update),
          );
          const completion = await this.aiProvider.complete(messages, {
            task: "fast_chat",
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
      const messages = buildAiMessages({
        kind: "chat",
        prompt: sanitized.text,
      });
      this.addAiMemoryHint(
        messages,
        await this.buildAiMemoryHint(context, update),
      );
      const completion = await this.aiProvider.complete(messages, {
        task: "fast_chat",
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
      text = "La IA no esta disponible ahora mismo. Prueba otra vez mas tarde.";
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
      await this.withReplyTarget(update),
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
          text: `El usuario ${command.targetTelegramUserId.toString()} no tiene avisos activos.`,
        };
      }
      const lines = warnings.map(
        (warning, index) =>
          `${index + 1}. ${warning.reason ?? "(sin motivo)"} — ${warning.createdAt.toISOString()}`,
      );
      return {
        text: `Avisos de ${command.targetTelegramUserId.toString()}:\n${lines.join("\n")}`,
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
        text: `Aviso retirado a ${command.targetTelegramUserId.toString()} (activos: ${remaining}).`,
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
      text: `Avisos reiniciados para ${command.targetTelegramUserId.toString()} (${cleared} retirados).`,
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

  private async sendWelcome(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
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
      this.templateVars(update),
      update.updateId,
    );

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

    let sent = false;
    if (mediaType) {
      const media = await this.welcomeRepository.getMedia(context.chatId);
      if (media) {
        // Telegram caps photo captions at 1024 chars — pre-truncate here without
        // splitting a surrogate pair (see truncateWelcomeCaption).
        const caption = truncateWelcomeCaption(built.text);
        await this.telegramGateway.sendPhoto({
          chatId: update.chat.chatId,
          imageBase64: media.data,
          type: mediaType,
          token: this.telegramToken(),
          ...(caption ? { caption } : {}),
          ...(replyMarkup ? { replyMarkup } : {}),
        });
        sent = true;
      }
    }

    if (!sent) {
      // Photo-only welcome whose bytes went missing → nothing sendable.
      if (!built.text) {
        return;
      }
      const reply: BotReply = replyMarkup ? { ...built, replyMarkup } : built;
      await this.telegramGateway.sendMessage({
        chatId: update.chat.chatId,
        reply,
        token: this.telegramToken(),
      });
    }

    await this.repository.recordAudit({
      tenantId: context.tenantId,
      actorType: "system",
      action: "welcome.sent",
      resourceType: "welcome_config",
      resourceId: context.chatId,
      payload: { members: update.newChatMemberIds.length },
    });
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

    // Best-effort: log each join into the shared activity table (kind
    // "new_member") so newcomer reports (/fantasmas) can correlate joins with
    // the message log. Never blocks the join pipeline.
    for (const memberId of update.newChatMemberIds) {
      try {
        await this.chatActivityRepository.record({
          tenantId: context.tenantId,
          chatId: context.chatId,
          kind: "new_member",
          telegramUserId: memberId,
        });
      } catch {
        // Non-fatal: the activity log is best-effort.
      }
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
      await this.sendWelcome(context, update);
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

    const command = result.command;
    // updateId as seed keeps outcomes deterministic per update (idempotent retries).
    const seed = update.updateId;

    switch (command.kind) {
      case "8ball":
        return {
          text: `🎱 ${eightBallAnswer(seed + command.question.length)}`,
        };
      case "coin":
        return {
          text:
            coinFlip(seed) === "cara"
              ? "🪙 Ha salido *cara*!"
              : "🪙 Ha salido *cruz*!",
          parseMode: "Markdown",
        };
      case "roll": {
        const rolls = rollDice(command.count, command.sides, seed);
        const total = rolls.reduce((sum, value) => sum + value, 0);
        const detail = rolls.length > 1 ? `${rolls.join(" + ")} = ` : "";
        return {
          text: `🎲 ${command.count}d${command.sides}: ${detail}*${total}*`,
          parseMode: "Markdown",
        };
      }
      case "rps": {
        if (!command.choice) {
          return {
            text: "✊ Piedra, papel o tijera... elige!",
            replyMarkup: buildRpsKeyboard(),
          };
        }

        return this.playRps(command.choice, seed);
      }
      case "love": {
        const score = loveScore(command.a, command.b);
        // Plain text: names/subjects are user input and could contain Markdown
        // characters that would make Telegram reject the message.
        return {
          text: `💘 ${command.a} + ${command.b} = ${score}%\n${loveVerdict(score)}`,
        };
      }
      case "rate":
        return {
          text: `⭐ Le doy un ${rateScore(command.subject)}/10 a "${command.subject}".`,
        };
      case "native":
        return { text: command.emoji, dice: command.emoji };
    }
  }

  private handleFunCallback(update: TelegramUpdateEnvelope): BotReply | null {
    const parsed = parseRpsCallback(update.callbackData);

    if (!parsed) {
      return null;
    }

    return this.playRps(parsed.choice, update.updateId);
  }

  private playRps(choice: RpsChoice, seed: number): BotReply {
    const bot = botRpsChoice(seed);
    const outcome = rpsOutcome(choice, bot);
    const verdict =
      outcome === "win"
        ? "Ganaste! 🏆"
        : outcome === "lose"
          ? "Gane yo! 😎"
          : "Empate! 🤝";

    return {
      text: `Tu: ${RPS_EMOJI[choice]} ${choice}\nYo: ${RPS_EMOJI[bot]} ${bot}\n\n${verdict}`,
    };
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

  private static readonly ROLE_ACTION_GUARD_ROLES: ReadonlySet<string> =
    new Set(["junior", "mod", "senior", "owner"]);

  private static readonly SANCTION_LADDER_VALUES: ReadonlySet<string> = new Set(
    ["aviso", "silencio", "expulsion", "ban"],
  );

  /** Parses a "si"/"no" command argument into a boolean, or undefined when invalid. */
  private static parseSiNo(value: string | undefined): boolean | undefined {
    const normalized = (value ?? "").toLowerCase();
    if (normalized === "si") {
      return true;
    }
    if (normalized === "no") {
      return false;
    }
    return undefined;
  }

  /** Parses a "k1=v1,k2=v2" command argument into a numeric record. */
  private static parseKeyValuePairs(
    value: string | undefined,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    for (const pair of (value ?? "").split(",")) {
      const [key, raw] = pair.split("=");
      const parsed = Number.parseFloat(raw ?? "");
      if (key?.trim() && !Number.isNaN(parsed)) {
        result[key.trim()] = parsed;
      }
    }
    return result;
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

    switch (name) {
      case "rango_accion": {
        const action = args.join(" ").trim();
        if (!action) {
          return { text: "Uso: /rango_accion <accion> (ej. ban, mute, warn)" };
        }
        const verdict = classifyActionSafety(action);
        const emoji =
          verdict.level === "rojo"
            ? "🔴"
            : verdict.level === "amarillo"
              ? "🟡"
              : "🟢";
        return {
          text: `${emoji} ${verdict.level} · ${verdict.reversible ? "reversible" : "irreversible"}`,
        };
      }
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
      case "horario": {
        const status = supportHoursStatus(new Date().getHours());
        return { text: status.message };
      }
      case "permiso": {
        const [role, ...actionParts] = args;
        const action = actionParts.join(" ").trim();
        if (
          !role ||
          !action ||
          !BotUpdateService.ROLE_ACTION_GUARD_ROLES.has(role)
        ) {
          return {
            text: "Uso: /permiso <junior|mod|senior|owner> <accion>",
          };
        }
        const decision = canPerformAction(role as RoleActionGuardRole, action);
        return { text: decision.reason };
      }
      case "regla_natural": {
        const text = args.join(" ");
        const parsed = parseNaturalRule(text);
        if (!parsed.ok) {
          return {
            text: "No entendí la regla. Ejemplo: /regla_natural bloquea enlaces de nuevos durante 24 horas",
          };
        }
        const lines = [
          `Acción: ${parsed.action}`,
          `Objetivo: ${parsed.target}`,
          ...(parsed.scope ? [`Alcance: ${parsed.scope}`] : []),
          ...(parsed.durationMs
            ? [`Duración: ${Math.round(parsed.durationMs / 3_600_000)}h`]
            : []),
        ];
        return { text: `📝 Entendido:\n${lines.join("\n")}` };
      }
      case "sancion_duracion": {
        const gravity = Number.parseInt(args[0] ?? "", 10);
        const recidivism = Number.parseInt(args[1] ?? "", 10);
        if (Number.isNaN(gravity) || Number.isNaN(recidivism)) {
          return {
            text: "Uso: /sancion_duracion <gravedad 1-5> <reincidencia 0+>",
          };
        }
        const duration = computeSanctionDurationMs({
          gravity,
          recidivism,
          hourOfDay: new Date().getHours(),
        });
        return { text: `⏱️ ${duration.label}` };
      }
      case "sancion_ajustar": {
        const [current, direction] = args;
        if (
          !current ||
          !BotUpdateService.SANCTION_LADDER_VALUES.has(current) ||
          (direction !== "suavizar" && direction !== "endurecer")
        ) {
          return {
            text: "Uso: /sancion_ajustar <aviso|silencio|expulsion|ban> <suavizar|endurecer>",
          };
        }
        const adjustment = adjustSanction(
          current as Sanction,
          direction as AdjustDirection,
        );
        return { text: adjustment.message };
      }
      case "proporcionalidad": {
        const sanctionLevel = Number.parseInt(args[0] ?? "", 10);
        const gravity = Number.parseInt(args[1] ?? "", 10);
        const recidivism = Number.parseInt(args[2] ?? "", 10);
        if (
          Number.isNaN(sanctionLevel) ||
          Number.isNaN(gravity) ||
          Number.isNaN(recidivism)
        ) {
          return {
            text: "Uso: /proporcionalidad <sanción 0-5> <gravedad 0-5> <reincidencia 0+>",
          };
        }
        const assessment = assessProportionality({
          sanctionLevel,
          gravity,
          recidivism,
        });
        return { text: `⚖️ ${assessment.summary}` };
      }
      case "confianza_decision": {
        const evidenceCount = Number.parseInt(args[0] ?? "", 10);
        const precedentArg = (args[1] ?? "").toLowerCase();
        const staffAgreement = Number.parseFloat(args[2] ?? "");
        if (
          Number.isNaN(evidenceCount) ||
          (precedentArg !== "si" && precedentArg !== "no") ||
          Number.isNaN(staffAgreement)
        ) {
          return {
            text: "Uso: /confianza_decision <pruebas 0+> <precedente si|no> <acuerdo_staff 0-1>",
          };
        }
        const result = scoreDecisionConfidence({
          evidenceCount,
          precedentMatch: precedentArg === "si",
          staffAgreement,
        });
        return {
          text: `🎯 Confianza: ${result.score}/100 (${result.band})`,
        };
      }
      case "grupo_abandonado": {
        const days = Number.parseFloat(args[0] ?? "");
        const members = Number.parseInt(args[1] ?? "", 10);
        if (Number.isNaN(days) || Number.isNaN(members)) {
          return { text: "Uso: /grupo_abandonado <dias_inactivo> <miembros>" };
        }
        const nowMs = Date.now();
        const verdict = detectAbandonedGroup({
          lastActivityMs: nowMs - days * 86_400_000,
          nowMs,
          members,
        });
        return {
          text: `${verdict.abandoned ? "⚠️ Grupo abandonado" : "✅ Grupo activo"} · ${verdict.idleDays} días inactivo${verdict.empty ? " · vacío" : ""}`,
        };
      }
      case "enfado": {
        const text = args.join(" ").trim();
        if (!text) {
          return { text: "Uso: /enfado <texto>" };
        }
        const result = detectAngerLevel(text);
        return { text: `😠 Nivel: ${result.level} (score ${result.score})` };
      }
      case "vista_anuncio": {
        const text = args.join(" ").trim();
        if (!text) {
          return { text: "Uso: /vista_anuncio <texto>" };
        }
        const previews = buildAnnouncementPreviews(text);
        return {
          text: `📱 Notificación: ${previews.notification}\n\n💻 Completo:\n${previews.desktop}`,
        };
      }
      case "prueba_antibot": {
        const [answer, expected, msRaw] = args;
        const responseMs = Number.parseInt(msRaw ?? "", 10);
        if (!answer || !expected || Number.isNaN(responseMs)) {
          return { text: "Uso: /prueba_antibot <respuesta> <esperada> <ms>" };
        }
        const result = verifyAntiBotChallenge({ answer, expected, responseMs });
        return {
          text: result.human ? `✅ ${result.reason}` : `🤖 ${result.reason}`,
        };
      }
      case "peticion_copia": {
        const text = args.join(" ").trim();
        if (!text) {
          return { text: "Uso: /peticion_copia <texto>" };
        }
        const result = detectAnswerBegging(text);
        return {
          text: result.matched
            ? `🚫 Coincide: ${result.phrases.join(", ")}`
            : "✅ No parece pedir respuestas sin esfuerzo.",
        };
      }
      case "racha_sin_sancion": {
        const days = Number.parseInt(args[0] ?? "", 10);
        if (Number.isNaN(days)) {
          return { text: "Uso: /racha_sin_sancion <dias>" };
        }
        const outcome = computeAntiToxicityReward(days);
        return { text: outcome.message };
      }
      case "clasificar_apelacion": {
        const text = args.join(" ").trim();
        if (!text) {
          return { text: "Uso: /clasificar_apelacion <texto>" };
        }
        const result = categorizeAppeal(text);
        return { text: `📂 Categoría: ${result.category}` };
      }
      case "eta_apelacion": {
        const queueLength = Number.parseInt(args[0] ?? "", 10);
        const avgReviewMs = Number.parseInt(args[1] ?? "", 10);
        if (Number.isNaN(queueLength) || Number.isNaN(avgReviewMs)) {
          return {
            text: "Uso: /eta_apelacion <en_cola> <ms_promedio_revision>",
          };
        }
        const eta = estimateAppealEta({ queueLength, avgReviewMs });
        return { text: `⏳ ${eta.label}` };
      }
      case "aprendizaje_apelacion": {
        const accepted = BotUpdateService.parseSiNo(args[0]);
        const rule = args.slice(1).join(" ").trim();
        if (accepted === undefined || !rule) {
          return { text: "Uso: /aprendizaje_apelacion <si|no> <regla>" };
        }
        return { text: buildAppealLearning({ accepted, rule }) };
      }
      case "resumen_apelacion": {
        const [category, lengthRaw, evidenceRaw] = args;
        const length = Number.parseInt(lengthRaw ?? "", 10);
        const hasEvidence = BotUpdateService.parseSiNo(evidenceRaw);
        if (!category || Number.isNaN(length) || hasEvidence === undefined) {
          return {
            text: "Uso: /resumen_apelacion <categoria> <longitud> <si|no evidencia>",
          };
        }
        return {
          text: summarizeAppealForStaff({ category, length, hasEvidence }),
        };
      }
      case "mediacion": {
        const [current, event] = args;
        const validStates = new Set([
          "abierta",
          "esperando_a",
          "esperando_b",
          "lista_revision",
          "cerrada",
        ]);
        const validEvents = new Set([
          "version_a",
          "version_b",
          "revisar",
          "cerrar",
        ]);
        if (
          !current ||
          !event ||
          !validStates.has(current) ||
          !validEvents.has(event)
        ) {
          return {
            text: "Uso: /mediacion <abierta|esperando_a|esperando_b|lista_revision|cerrada> <version_a|version_b|revisar|cerrar>",
          };
        }
        const result = nextMediationStep(
          current as MediationState,
          event as MediationEvent,
        );
        return { text: `➡️ Siguiente estado: ${result.next}` };
      }
      case "checklist_ban": {
        const hasEvidence = BotUpdateService.parseSiNo(args[0]);
        const isRepeatOffender = BotUpdateService.parseSiNo(args[1]);
        const ruleCited = BotUpdateService.parseSiNo(args[2]);
        const durationSet = BotUpdateService.parseSiNo(args[3]);
        if (
          hasEvidence === undefined ||
          isRepeatOffender === undefined ||
          ruleCited === undefined ||
          durationSet === undefined
        ) {
          return {
            text: "Uso: /checklist_ban <evidencia si|no> <reincidente si|no> <regla si|no> <duración si|no>",
          };
        }
        const checklist = buildBanChecklist({
          hasEvidence,
          isRepeatOffender,
          ruleCited,
          durationSet,
        });
        const lines = checklist.items.map(
          (item) => `${item.done ? "✅" : "❌"} ${item.label}`,
        );
        return {
          text: `${checklist.ready ? "✅ Listo para banear" : "⏳ Faltan pasos"}\n${lines.join("\n")}`,
        };
      }
      case "progreso_boss": {
        const done = Number.parseInt(args[0] ?? "", 10);
        const goal = Number.parseInt(args[1] ?? "", 10);
        if (Number.isNaN(done) || Number.isNaN(goal)) {
          return { text: "Uso: /progreso_boss <hecho> <meta>" };
        }
        const progress = computeBossProgress({ done, goal });
        return {
          text: `👹 ${progress.percent}% · ${progress.defeated ? "derrotado" : `faltan ${progress.remaining}`}`,
        };
      }
      case "error_bot": {
        const botConfidence = Number.parseFloat(args[0] ?? "");
        const userDisputes = BotUpdateService.parseSiNo(args[1]);
        const autoActioned = BotUpdateService.parseSiNo(args[2]);
        if (
          Number.isNaN(botConfidence) ||
          userDisputes === undefined ||
          autoActioned === undefined
        ) {
          return {
            text: "Uso: /error_bot <confianza 0-1> <disputa si|no> <automatica si|no>",
          };
        }
        const result = shouldEscalateBotError({
          botConfidence,
          userDisputes,
          autoActioned,
        });
        return { text: result.reason };
      }
      case "sensibilidad_caso": {
        const hasPersonalData = BotUpdateService.parseSiNo(args[0]);
        const involvesMinor = BotUpdateService.parseSiNo(args[1]);
        const legalThreat = BotUpdateService.parseSiNo(args[2]);
        if (
          hasPersonalData === undefined ||
          involvesMinor === undefined ||
          legalThreat === undefined
        ) {
          return {
            text: "Uso: /sensibilidad_caso <datos_personales si|no> <menor si|no> <amenaza_legal si|no>",
          };
        }
        const result = classifyCaseSensitivity({
          hasPersonalData,
          involvesMinor,
          legalThreat,
        });
        return { text: `${result.level} · ${result.reason}` };
      }
      case "acuerdo_convivencia": {
        const [userA, userB, ...ruleParts] = args;
        const rules = ruleParts
          .join(" ")
          .split(",")
          .map((rule) => rule.trim())
          .filter(Boolean);
        if (!userA || !userB || rules.length === 0) {
          return {
            text: "Uso: /acuerdo_convivencia <usuarioA> <usuarioB> <regla1,regla2,...>",
          };
        }
        return { text: buildCoexistenceAgreement({ userA, userB, rules }) };
      }
      case "recompensa_colectiva": {
        const improvement = Number.parseFloat(args[0] ?? "");
        if (Number.isNaN(improvement)) {
          return { text: "Uso: /recompensa_colectiva <mejora>" };
        }
        const outcome = computeCollectiveReward({ improvement });
        return { text: outcome.message };
      }
      case "convertir_sancion": {
        const muteMin = Number.parseFloat(args[0] ?? "");
        const acceptsRule = BotUpdateService.parseSiNo(args[1]);
        if (Number.isNaN(muteMin) || acceptsRule === undefined) {
          return {
            text: "Uso: /convertir_sancion <minutos_mute> <acepta_regla si|no>",
          };
        }
        const outcome = convertSanction({
          muteMs: muteMin * 60_000,
          acceptsRule,
        });
        return { text: outcome.message };
      }
      case "comprar_cosmetico": {
        const balance = Number.parseFloat(args[0] ?? "");
        const price = Number.parseFloat(args[1] ?? "");
        if (Number.isNaN(balance) || Number.isNaN(price)) {
          return { text: "Uso: /comprar_cosmetico <saldo> <precio>" };
        }
        const result = canPurchaseCosmetic({ balance, price });
        return {
          text: result.affordable
            ? `✅ Puedes comprarlo. Saldo restante: ${result.remaining}`
            : `❌ Saldo insuficiente. Te faltan ${price - balance}.`,
        };
      }
      case "cupo_diario": {
        const doneToday = Number.parseInt(args[0] ?? "", 10);
        const cap = Number.parseInt(args[1] ?? "", 10);
        if (Number.isNaN(doneToday) || Number.isNaN(cap)) {
          return { text: "Uso: /cupo_diario <hecho_hoy> <tope>" };
        }
        const result = checkDailyQuota({ doneToday, cap });
        return { text: result.message };
      }
      case "calidad_datos": {
        const sampleSize = Number.parseInt(args[0] ?? "", 10);
        const daysCovered = Number.parseInt(args[1] ?? "", 10);
        if (Number.isNaN(sampleSize) || Number.isNaN(daysCovered)) {
          return { text: "Uso: /calidad_datos <muestras> <dias_cubiertos>" };
        }
        const result = assessDataQuality({ sampleSize, daysCovered });
        return {
          text: result.reliable
            ? "✅ Datos suficientes para métricas fiables."
            : `⚠️ ${result.reasons.join(" ")}`,
        };
      }
      case "duelo_debate": {
        const votesA = Number.parseInt(args[0] ?? "", 10);
        const votesB = Number.parseInt(args[1] ?? "", 10);
        if (Number.isNaN(votesA) || Number.isNaN(votesB)) {
          return { text: "Uso: /duelo_debate <votosA> <votosB>" };
        }
        const result = resolveDebateDuel({ votesA, votesB });
        return {
          text: `🎤 Ganador: ${result.winner} (margen ${result.margin})`,
        };
      }
      case "desescalar": {
        const tension = Number.parseFloat(args[0] ?? "");
        const messagesPerMin = Number.parseFloat(args[1] ?? "");
        if (Number.isNaN(tension) || Number.isNaN(messagesPerMin)) {
          return { text: "Uso: /desescalar <tension> <mensajes_por_min>" };
        }
        const advice = recommendDeescalation({ tension, messagesPerMin });
        return { text: advice.message };
      }
      case "apelacion_delicada": {
        const mentionsMinor = BotUpdateService.parseSiNo(args[0]);
        const mentionsLegal = BotUpdateService.parseSiNo(args[1]);
        const mentionsSelfHarm = BotUpdateService.parseSiNo(args[2]);
        if (
          mentionsMinor === undefined ||
          mentionsLegal === undefined ||
          mentionsSelfHarm === undefined
        ) {
          return {
            text: "Uso: /apelacion_delicada <menor si|no> <legal si|no> <autolesion si|no>",
          };
        }
        const result = markDelicateAppeal({
          mentionsMinor,
          mentionsLegal,
          mentionsSelfHarm,
        });
        return {
          text: result.delicate
            ? `🚩 Delicada: ${result.reasons.join(", ")}`
            : "Sin señales delicadas.",
        };
      }
      case "ayuda_discreta": {
        const text = args.join(" ").trim();
        if (!text) {
          return { text: "Uso: /ayuda_discreta <texto>" };
        }
        const route = routeDiscreetHelp({ text });
        return {
          text: route.needsHelp
            ? "🤫 Detectada petición de ayuda discreta. Un admin te escribirá en privado."
            : "No he detectado una petición de ayuda.",
        };
      }
      case "caducidad_anuncio": {
        const hoursAgo = Number.parseFloat(args[0] ?? "");
        if (Number.isNaN(hoursAgo)) {
          return { text: "Uso: /caducidad_anuncio <horas_desde_fijado>" };
        }
        const nowMs = Date.now();
        const shouldUnpin = shouldUnpinAnnouncement(
          nowMs - hoursAgo * 3_600_000,
          nowMs,
        );
        return {
          text: shouldUnpin
            ? "📌 Este anuncio ya debería desfijarse."
            : "📌 Este anuncio sigue dentro de su ventana de fijado.",
        };
      }
      case "reputacion_contenido": {
        const source = args[0]?.trim();
        const approvals = Number.parseInt(args[1] ?? "", 10);
        const rejections = Number.parseInt(args[2] ?? "", 10);
        if (!source || Number.isNaN(approvals) || Number.isNaN(rejections)) {
          return {
            text: "Uso: /reputacion_contenido <fuente> <aprobaciones> <rechazos>",
          };
        }
        const result = decideContentReputation({ approvals, rejections });
        if (context.chatId) {
          const raw = await this.chatSettingRepository.getValue(
            context.tenantId,
            context.chatId,
            "trusted_sources",
          );
          const sources: Record<string, { trusted: boolean; score: number }> =
            raw && typeof raw === "object"
              ? (raw as Record<string, { trusted: boolean; score: number }>)
              : {};
          sources[source] = { trusted: result.trusted, score: result.score };
          await this.chatSettingRepository.setValue(
            context.tenantId,
            context.chatId,
            "trusted_sources",
            sources,
          );
        }
        return {
          text: result.trusted
            ? `✅ "${source}" confiable (score ${result.score}) — añadida a la lista de confianza`
            : `⚠️ "${source}" no confiable (score ${result.score})`,
        };
      }
      case "doble_rep": {
        const basePoints = Number.parseInt(args[0] ?? "", 10);
        const isUsefulAction = BotUpdateService.parseSiNo(args[1]);
        const eventActive = BotUpdateService.parseSiNo(args[2]);
        if (
          Number.isNaN(basePoints) ||
          isUsefulAction === undefined ||
          eventActive === undefined
        ) {
          return {
            text: "Uso: /doble_rep <puntos_base> <util si|no> <evento_activo si|no>",
          };
        }
        const result = applyDoubleRep({
          basePoints,
          isUsefulAction,
          eventActive,
        });
        return {
          text: `⭐ ${result.points} puntos${result.doubled ? " (doblados)" : ""}`,
        };
      }
      case "cooldown_dinamico": {
        const abuseScore = Number.parseFloat(args[0] ?? "");
        if (Number.isNaN(abuseScore)) {
          return { text: "Uso: /cooldown_dinamico <abuso_score>" };
        }
        const ms = computeDynamicCooldownMs({ abuseScore });
        return { text: `⏱️ Cooldown: ${Math.round(ms / 1000)}s` };
      }
      case "aviso_educativo": {
        const [rule, why] = args.join(" ").split("|");
        if (!rule?.trim() || !why?.trim()) {
          return { text: "Uso: /aviso_educativo <regla>|<motivo>" };
        }
        return {
          text: buildEducationalNotice({
            rule: rule.trim(),
            why: why.trim(),
          }),
        };
      }
      case "permiso_emergencia": {
        const [role, raidRaw] = args;
        const raidActive = BotUpdateService.parseSiNo(raidRaw);
        if (
          !role ||
          !["helper", "mod", "admin"].includes(role) ||
          raidActive === undefined
        ) {
          return {
            text: "Uso: /permiso_emergencia <helper|mod|admin> <raid_activo si|no>",
          };
        }
        const grant = grantEmergencyPermission({
          role: role as EmergencyPermissionRole,
          raidActive,
        });
        return {
          text: grant.granted
            ? `✅ Permiso concedido: ${grant.scope}`
            : `❌ Sin permiso especial. ${grant.scope}`,
        };
      }
      case "gastar_energia": {
        const current = Number.parseFloat(args[0] ?? "");
        const cost = Number.parseFloat(args[1] ?? "");
        const max = Number.parseFloat(args[2] ?? "");
        if (Number.isNaN(current) || Number.isNaN(cost) || Number.isNaN(max)) {
          return { text: "Uso: /gastar_energia <actual> <coste> <maximo>" };
        }
        const result = spendEnergy({ current, cost, max });
        return {
          text: result.allowed
            ? `⚡ Energía restante: ${result.remaining}`
            : `❌ Energía insuficiente. Restante: ${result.remaining}`,
        };
      }
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
      case "razon_sancion": {
        const parts = args.join(" ").split("|");
        const [rule, action, priorWarnsRaw, confidenceRaw] = parts;
        const priorWarns = Number.parseInt(priorWarnsRaw ?? "", 10);
        const confidence = Number.parseFloat(confidenceRaw ?? "");
        if (
          !rule?.trim() ||
          !action?.trim() ||
          Number.isNaN(priorWarns) ||
          Number.isNaN(confidence)
        ) {
          return {
            text: "Uso: /razon_sancion <regla>|<accion>|<avisos_previos>|<confianza>",
          };
        }
        return {
          text: buildSanctionRationale({
            rule: rule.trim(),
            action: action.trim(),
            priorWarns,
            confidence,
          }),
        };
      }
      case "sancion_juego": {
        const abuseScore = Number.parseFloat(args[0] ?? "");
        if (Number.isNaN(abuseScore)) {
          return { text: "Uso: /sancion_juego <abuso_score>" };
        }
        const decision = decideGameSanction({ abuseScore });
        return { text: `🎮 Sanción: ${decision.sanction}` };
      }
      case "retencion_juegos": {
        const [pr, pt, npr, npt] = args.map((value) =>
          Number.parseInt(value, 10),
        );
        if (
          pr === undefined ||
          pt === undefined ||
          npr === undefined ||
          npt === undefined ||
          [pr, pt, npr, npt].some(Number.isNaN)
        ) {
          return {
            text: "Uso: /retencion_juegos <jugadores_retenidos> <jugadores_total> <no_jugadores_retenidos> <no_jugadores_total>",
          };
        }
        const result = computeGamesRetention({
          playersRetained: pr,
          playersTotal: pt,
          nonPlayersRetained: npr,
          nonPlayersTotal: npt,
        });
        return {
          text: `🎮 Jugadores: ${Math.round(result.playerRate * 100)}% · No jugadores: ${Math.round(result.nonPlayerRate * 100)}% · ${result.positive ? "positivo" : "negativo"}`,
        };
      }
      case "ventana_gracia": {
        const secondsAgo = Number.parseFloat(args[0] ?? "");
        if (Number.isNaN(secondsAgo)) {
          return { text: "Uso: /ventana_gracia <segundos_desde_envio>" };
        }
        const nowMs = Date.now();
        const within = isWithinGrace(nowMs - secondsAgo * 1000, nowMs);
        return {
          text: within
            ? "🟢 Todavía dentro de la ventana de gracia."
            : "🔴 La ventana de gracia ya expiró.",
        };
      }
      case "consejos_crecimiento": {
        const [members, weeklyConflicts, weeklyJoins] = args.map((value) =>
          Number.parseInt(value, 10),
        );
        if (
          members === undefined ||
          weeklyConflicts === undefined ||
          weeklyJoins === undefined ||
          [members, weeklyConflicts, weeklyJoins].some(Number.isNaN)
        ) {
          return {
            text: "Uso: /consejos_crecimiento <miembros> <conflictos_semana> <altas_semana>",
          };
        }
        const tips = suggestGrowthTips({
          members,
          weeklyConflicts,
          weeklyJoins,
        });
        return { text: tips.join("\n") };
      }
      case "escalar_humano": {
        const severity = Number.parseFloat(args[0] ?? "");
        const botConfidence = Number.parseFloat(args[1] ?? "");
        if (Number.isNaN(severity) || Number.isNaN(botConfidence)) {
          return {
            text: "Uso: /escalar_humano <severidad> <confianza_bot 0-1>",
          };
        }
        const result = decideHumanEscalation({ severity, botConfidence });
        return { text: result.reason };
      }
      case "stats_humanizadas": {
        const [
          messagesToday,
          conflictsToday,
          messagesYesterday,
          conflictsYesterday,
        ] = args.map((value) => Number.parseInt(value, 10));
        if (
          messagesToday === undefined ||
          conflictsToday === undefined ||
          messagesYesterday === undefined ||
          conflictsYesterday === undefined ||
          [
            messagesToday,
            conflictsToday,
            messagesYesterday,
            conflictsYesterday,
          ].some(Number.isNaN)
        ) {
          return {
            text: "Uso: /stats_humanizadas <mensajes_hoy> <conflictos_hoy> <mensajes_ayer> <conflictos_ayer>",
          };
        }
        return {
          text: humanizeDailyStats(
            { messages: messagesToday, conflicts: conflictsToday },
            { messages: messagesYesterday, conflicts: conflictsYesterday },
          ),
        };
      }
      case "medidor_hype": {
        const baselinePerHour = Number.parseFloat(args[0] ?? "");
        const currentPerHour = Number.parseFloat(args[1] ?? "");
        if (Number.isNaN(baselinePerHour) || Number.isNaN(currentPerHour)) {
          return {
            text: "Uso: /medidor_hype <base_por_hora> <actual_por_hora>",
          };
        }
        const reading = computeHypeLevel({ baselinePerHour, currentPerHour });
        return { text: `🔥 Nivel: ${reading.level} (ratio ${reading.ratio})` };
      }
      case "patron_imposible": {
        const wins = Number.parseInt(args[0] ?? "", 10);
        const plays = Number.parseInt(args[1] ?? "", 10);
        const avgReactionMs = Number.parseFloat(args[2] ?? "");
        if (
          Number.isNaN(wins) ||
          Number.isNaN(plays) ||
          Number.isNaN(avgReactionMs)
        ) {
          return {
            text: "Uso: /patron_imposible <victorias> <partidas> <reaccion_ms_promedio>",
          };
        }
        const result = detectImpossiblePattern({ wins, plays, avgReactionMs });
        return {
          text: result.suspicious
            ? `🚨 Sospechoso: ${result.reasons.join(", ")}`
            : "✅ Patrón normal.",
        };
      }
      case "guardia_impulsivo": {
        const [action, confirmedRaw, waitedRaw] = args;
        const confirmed = BotUpdateService.parseSiNo(confirmedRaw);
        const waitedMs = Number.parseInt(waitedRaw ?? "", 10);
        if (!action || confirmed === undefined || Number.isNaN(waitedMs)) {
          return {
            text: "Uso: /guardia_impulsivo <accion> <confirmado si|no> <ms_esperados>",
          };
        }
        const result = guardImpulsiveAction({ action, confirmed, waitedMs });
        return { text: result.reason };
      }
      case "escalar_owner": {
        const minutesSinceAlert = Number.parseFloat(args[0] ?? "");
        if (Number.isNaN(minutesSinceAlert)) {
          return {
            text: "Uso: /escalar_owner <min_desde_alerta> [min_desde_respuesta]",
          };
        }
        const nowMs = Date.now();
        const responseMinutesRaw = args[1]
          ? Number.parseFloat(args[1])
          : undefined;
        const lastAdminResponseMs =
          responseMinutesRaw !== undefined && !Number.isNaN(responseMinutesRaw)
            ? nowMs - responseMinutesRaw * 60_000
            : undefined;
        const result = shouldEscalateToOwner({
          alertMs: nowMs - minutesSinceAlert * 60_000,
          nowMs,
          lastAdminResponseMs,
        });
        return {
          text: result.escalate
            ? "🚨 Escalar al owner: nadie respondió a tiempo."
            : "🟢 Todavía dentro del margen de respuesta.",
        };
      }
      case "estado_incidencia": {
        const [current, event] = args;
        const validStates = new Set([
          "abierto",
          "esperando",
          "resuelto",
          "cerrado",
        ]);
        const validEvents = new Set([
          "responder",
          "pedir_info",
          "resolver",
          "cerrar",
          "reabrir",
        ]);
        if (
          !current ||
          !event ||
          !validStates.has(current) ||
          !validEvents.has(event)
        ) {
          return {
            text: "Uso: /estado_incidencia <abierto|esperando|resuelto|cerrado> <responder|pedir_info|resolver|cerrar|reabrir>",
          };
        }
        const result = nextIncidentStatus(
          current as IncidentStatus,
          event as IncidentEvent,
        );
        return { text: `➡️ Siguiente estado: ${result.next}` };
      }
      case "pregunta_completa": {
        const text = args.join(" ").trim();
        if (!text) {
          return { text: "Uso: /pregunta_completa <texto>" };
        }
        const result = assessQuestionCompleteness(text);
        return {
          text: result.complete
            ? "✅ La pregunta tiene suficiente información."
            : result.missing.join("\n"),
        };
      }
      case "config_intencion": {
        const intent = args[0];
        const validIntents = new Set([
          "anti_spam",
          "ordenar",
          "chill",
          "crecer",
        ]);
        if (!intent || !validIntents.has(intent)) {
          return {
            text: "Uso: /config_intencion <anti_spam|ordenar|chill|crecer>",
          };
        }
        const config = mapIntentToConfig(intent as CommunityIntent);
        return { text: config.summary };
      }
      case "nivel_conocimiento": {
        const correctAnswers = Number.parseInt(args[0] ?? "", 10);
        const totalAnswers = Number.parseInt(args[1] ?? "", 10);
        if (Number.isNaN(correctAnswers) || Number.isNaN(totalAnswers)) {
          return {
            text: "Uso: /nivel_conocimiento <correctas> <total>",
          };
        }
        const result = classifyKnowledgeLevel({
          correctAnswers,
          totalAnswers,
        });
        return { text: `📚 Nivel: ${result.level}` };
      }
      case "incidencia_conocida": {
        const complaints = Number.parseInt(args[0] ?? "", 10);
        if (Number.isNaN(complaints)) {
          return { text: "Uso: /incidencia_conocida <quejas_en_ventana>" };
        }
        const notice = buildKnownIssueNotice(complaints);
        return { text: notice.message };
      }
      case "ultima_oportunidad": {
        const warnCount = Number.parseInt(args[0] ?? "", 10);
        const threshold = Number.parseInt(args[1] ?? "", 10);
        if (Number.isNaN(warnCount) || Number.isNaN(threshold)) {
          return { text: "Uso: /ultima_oportunidad <avisos> <umbral>" };
        }
        const decision = decideLastChance({ warnCount, threshold });
        return { text: decision.message };
      }
      case "aviso_aprendizaje": {
        const [rule, example] = args.join(" ").split("|");
        if (!rule?.trim() || !example?.trim()) {
          return { text: "Uso: /aviso_aprendizaje <regla>|<ejemplo>" };
        }
        return {
          text: buildLearningNotice({
            rule: rule.trim(),
            example: example.trim(),
          }),
        };
      }
      case "items_legendarios": {
        const raidsSurvived = Number.parseInt(args[0] ?? "", 10);
        const yearsActive = Number.parseFloat(args[1] ?? "");
        const topHelper = BotUpdateService.parseSiNo(args[2]);
        if (
          Number.isNaN(raidsSurvived) ||
          Number.isNaN(yearsActive) ||
          topHelper === undefined
        ) {
          return {
            text: "Uso: /items_legendarios <raids_sobrevividos> <anos_activo> <top_helper si|no>",
          };
        }
        const items = awardLegendaryItems({
          raidsSurvived,
          yearsActive,
          topHelper,
        });
        return {
          text:
            items.length > 0
              ? `🏆 ${items.join(", ")}`
              : "Sin ítems legendarios todavía.",
        };
      }
      case "sandbox_enlace": {
        const isNewUser = BotUpdateService.parseSiNo(args[0]);
        const isFirstLink = BotUpdateService.parseSiNo(args[1]);
        if (isNewUser === undefined || isFirstLink === undefined) {
          return {
            text: "Uso: /sandbox_enlace <nuevo si|no> <primer_enlace si|no>",
          };
        }
        const decision = decideLinkSandbox({ isNewUser, isFirstLink });
        return { text: decision.reason };
      }
      case "desbloquear_enlaces": {
        const tenureDays = Number.parseInt(args[0] ?? "", 10);
        const trustScore = Number.parseFloat(args[1] ?? "");
        if (Number.isNaN(tenureDays) || Number.isNaN(trustScore)) {
          return {
            text: "Uso: /desbloquear_enlaces <dias_antiguedad> <confianza>",
          };
        }
        const result = canUnlockLinks({ tenureDays, trustScore });
        return { text: result.reason };
      }
      case "agrupar_reportes": {
        const pairs = args
          .join(" ")
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean);
        const reports = pairs
          .map((entry) => {
            const [id, reason] = entry.split(":");
            return id && reason ? { id, reason } : null;
          })
          .filter((entry): entry is { id: string; reason: string } => !!entry);
        if (reports.length === 0) {
          return {
            text: "Uso: /agrupar_reportes <id1:motivo1,id2:motivo2,...>",
          };
        }
        const groups = groupSimilarReports(reports);
        const lines = groups.map(
          (group) =>
            `${group.reason} (${group.count}): ${group.ids.join(", ")}`,
        );
        return { text: lines.join("\n") };
      }
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
      case "aviso_mantenimiento": {
        const minutesUntil = Number.parseFloat(args[0] ?? "");
        const durationMin = Number.parseFloat(args[1] ?? "");
        if (Number.isNaN(minutesUntil) || Number.isNaN(durationMin)) {
          return {
            text: "Uso: /aviso_mantenimiento <minutos_hasta_inicio> <duracion_min>",
          };
        }
        const nowMs = Date.now();
        const notice = buildMaintenanceNotice({
          startMs: nowMs + minutesUntil * 60_000,
          durationMin,
          nowMs,
        });
        return { text: notice.message };
      }
      case "relectura_obligatoria": {
        const [added, removed, changed] = args.map((value) =>
          Number.parseInt(value, 10),
        );
        if (
          added === undefined ||
          removed === undefined ||
          changed === undefined ||
          [added, removed, changed].some(Number.isNaN)
        ) {
          return {
            text: "Uso: /relectura_obligatoria <anadidas> <eliminadas> <cambiadas>",
          };
        }
        const decision = decideMandatoryReread({ added, removed, changed });
        return {
          text: decision.required
            ? `📖 Relectura obligatoria (${decision.totalChanges} cambios)`
            : "📖 No hace falta relectura obligatoria.",
        };
      }
      case "carta_miembro": {
        const [userId, achievements, helps] = args.map((value) =>
          Number.parseInt(value, 10),
        );
        if (
          userId === undefined ||
          achievements === undefined ||
          helps === undefined ||
          [userId, achievements, helps].some(Number.isNaN)
        ) {
          return { text: "Uso: /carta_miembro <userId> <logros> <ayudas>" };
        }
        const card = buildMemberCard({ userId, achievements, helps });
        return { text: `🃏 Rango: ${card.rank} · Poder: ${card.power}` };
      }
      case "objetivo_miembro": {
        const goal = args[0];
        const validGoals = new Set([
          "aprender",
          "socializar",
          "vender",
          "soporte",
          "otro",
        ]);
        if (!goal || !validGoals.has(goal)) {
          return {
            text: "Uso: /objetivo_miembro <aprender|socializar|vender|soporte|otro>",
          };
        }
        const onboarding = mapMemberGoalToOnboarding(goal as MemberGoal);
        return {
          text: `🎯 ${onboarding.focus}\n${onboarding.tips.join("\n")}`,
        };
      }
      case "escudo_menciones": {
        const mentionsInWindow = Number.parseInt(args[0] ?? "", 10);
        if (Number.isNaN(mentionsInWindow)) {
          return { text: "Uso: /escudo_menciones <menciones_en_ventana>" };
        }
        const result = shieldFromMentions({ mentionsInWindow });
        return {
          text: result.limited
            ? `🛡️ Limitado, exceso de ${result.excess} menciones.`
            : "🛡️ Sin límite alcanzado.",
        };
      }
      case "comparar_meses": {
        const current = BotUpdateService.parseKeyValuePairs(args[0]);
        const previous = BotUpdateService.parseKeyValuePairs(args[1]);
        if (
          Object.keys(current).length === 0 ||
          Object.keys(previous).length === 0
        ) {
          return {
            text: "Uso: /comparar_meses <k1=v1,k2=v2> <k1=v1,k2=v2>",
          };
        }
        const changes = compareMonths(current, previous);
        const lines = changes.map(
          (change) => `${change.metric}: ${change.direction} (${change.delta})`,
        );
        return { text: lines.join("\n") };
      }
      case "logros_negativos": {
        const [rapidPlays, identicalActions, nightGrind] = args.map((value) =>
          Number.parseInt(value, 10),
        );
        if (
          rapidPlays === undefined ||
          identicalActions === undefined ||
          nightGrind === undefined ||
          [rapidPlays, identicalActions, nightGrind].some(Number.isNaN)
        ) {
          return {
            text: "Uso: /logros_negativos <partidas_rapidas> <acciones_identicas> <grind_nocturno>",
          };
        }
        const flags = detectNegativeAchievements({
          rapidPlays,
          identicalActions,
          nightGrind,
        });
        return {
          text: flags.length > 0 ? flags.join(", ") : "Sin señales negativas.",
        };
      }
      case "dominio_nuevo": {
        const [domain, seenRaw] = args;
        const seenDomains = (seenRaw ?? "")
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean);
        if (!domain) {
          return {
            text: "Uso: /dominio_nuevo <dominio> <conocido1,conocido2,...>",
          };
        }
        const signal = detectNewDomain(domain, seenDomains);
        return {
          text: signal.isNew
            ? `🆕 Dominio nuevo: ${signal.normalized}`
            : `Dominio ya conocido: ${signal.normalized}`,
        };
      }
      case "diagnostico_observacion": {
        const [messages, conflicts, spam] = args.map((value) =>
          Number.parseInt(value, 10),
        );
        if (
          messages === undefined ||
          conflicts === undefined ||
          spam === undefined ||
          [messages, conflicts, spam].some(Number.isNaN)
        ) {
          return {
            text: "Uso: /diagnostico_observacion <mensajes> <conflictos> <spam>",
          };
        }
        const diagnosis = buildObservationDiagnosis({
          messages,
          conflicts,
          spam,
        });
        return { text: `🔎 ${diagnosis.verdict}: ${diagnosis.summary}` };
      }
      case "fuera_tema_estudio": {
        const [hourRaw, ...textParts] = args;
        const hourOfDay = Number.parseInt(hourRaw ?? "", 10);
        const text = textParts.join(" ").trim();
        if (Number.isNaN(hourOfDay) || !text) {
          return { text: "Uso: /fuera_tema_estudio <hora> <texto>" };
        }
        const result = detectOffTopicStudy({ hourOfDay, text });
        return {
          text: result.flagged
            ? `📚 Fuera de tema: ${result.hits.join(", ")}`
            : "✅ Dentro de tema o fuera de horario de estudio.",
        };
      }
      case "checklist_bienvenida": {
        const readRules = BotUpdateService.parseSiNo(args[0]);
        const introduced = BotUpdateService.parseSiNo(args[1]);
        const pickedInterests = BotUpdateService.parseSiNo(args[2]);
        if (
          readRules === undefined ||
          introduced === undefined ||
          pickedInterests === undefined
        ) {
          return {
            text: "Uso: /checklist_bienvenida <reglas si|no> <presentado si|no> <intereses si|no>",
          };
        }
        const checklist = buildFirstStepsChecklist({
          readRules,
          introduced,
          pickedInterests,
        });
        const lines = checklist.items.map(
          (item) => `${item.done ? "✅" : "❌"} ${item.label}`,
        );
        return {
          text: `${checklist.complete ? "✅ Completo" : "⏳ Incompleto"}\n${lines.join("\n")}`,
        };
      }
      case "sesgo_operativo": {
        const [newSanctions, newMembers, veteranSanctions, veteranMembers] =
          args.map((value) => Number.parseInt(value, 10));
        if (
          newSanctions === undefined ||
          newMembers === undefined ||
          veteranSanctions === undefined ||
          veteranMembers === undefined ||
          [newSanctions, newMembers, veteranSanctions, veteranMembers].some(
            Number.isNaN,
          )
        ) {
          return {
            text: "Uso: /sesgo_operativo <sanciones_nuevos> <total_nuevos> <sanciones_veteranos> <total_veteranos>",
          };
        }
        const result = detectOperationalBias({
          newSanctions,
          newMembers,
          veteranSanctions,
          veteranMembers,
        });
        return {
          text: result.biased
            ? "⚠️ Sesgo detectado contra nuevos miembros."
            : "✅ Sin sesgo relevante.",
        };
      }
      case "exceso_config": {
        const activeRules = Number.parseInt(args[0] ?? "", 10);
        const memberCount = Number.parseInt(args[1] ?? "", 10);
        if (Number.isNaN(activeRules) || Number.isNaN(memberCount)) {
          return { text: "Uso: /exceso_config <reglas_activas> <miembros>" };
        }
        const result = checkOverConfiguration({ activeRules, memberCount });
        return { text: result.advice };
      }
      case "owner_ausente": {
        const ownerAbsent = BotUpdateService.parseSiNo(args[0]);
        if (ownerAbsent === undefined) {
          return { text: "Uso: /owner_ausente <si|no>" };
        }
        const rules = rulesForOwnerAbsent(ownerAbsent);
        return { text: rules.note };
      }
      case "checklist_owner": {
        const [pendingAppeals, openIncidents, rulesReviewedDaysAgo] = args.map(
          (value) => Number.parseInt(value, 10),
        );
        if (
          pendingAppeals === undefined ||
          openIncidents === undefined ||
          rulesReviewedDaysAgo === undefined ||
          [pendingAppeals, openIncidents, rulesReviewedDaysAgo].some(
            Number.isNaN,
          )
        ) {
          return {
            text: "Uso: /checklist_owner <apelaciones_pendientes> <incidencias_abiertas> <dias_desde_revision>",
          };
        }
        const tasks = buildOwnerChecklist({
          pendingAppeals,
          openIncidents,
          rulesReviewedDaysAgo,
        });
        const lines = tasks.map(
          (task) => `${task.done ? "✅" : "❌"} ${task.task}`,
        );
        return { text: lines.join("\n") };
      }
      case "mentor_owner": {
        const members = Number.parseInt(args[0] ?? "", 10);
        const hasRules = BotUpdateService.parseSiNo(args[1]);
        const hasStaff = BotUpdateService.parseSiNo(args[2]);
        if (
          Number.isNaN(members) ||
          hasRules === undefined ||
          hasStaff === undefined
        ) {
          return {
            text: "Uso: /mentor_owner <miembros> <reglas si|no> <staff si|no>",
          };
        }
        const tips = suggestOwnerMentorTips({ members, hasRules, hasStaff });
        return { text: tips.join("\n") };
      }
      case "resumen_owner": {
        const [pendingAppeals, openIncidents, newMembers] = args.map((value) =>
          Number.parseInt(value, 10),
        );
        if (
          pendingAppeals === undefined ||
          openIncidents === undefined ||
          newMembers === undefined ||
          [pendingAppeals, openIncidents, newMembers].some(Number.isNaN)
        ) {
          return {
            text: "Uso: /resumen_owner <apelaciones_pendientes> <incidencias_abiertas> <miembros_nuevos>",
          };
        }
        return {
          text: buildOwnerSummary({
            pendingAppeals,
            openIncidents,
            newMembers,
          }),
        };
      }
      case "revision_entre_pares": {
        const actorIsAdmin = BotUpdateService.parseSiNo(args[0]);
        const targetIsAdmin = BotUpdateService.parseSiNo(args[1]);
        if (actorIsAdmin === undefined || targetIsAdmin === undefined) {
          return {
            text: "Uso: /revision_entre_pares <autor_admin si|no> <objetivo_admin si|no>",
          };
        }
        const outcome = requiresPeerReview({ actorIsAdmin, targetIsAdmin });
        return { text: outcome.reason };
      }
      case "explicar_permiso": {
        const permission = args.join(" ").trim();
        if (!permission) {
          return { text: "Uso: /explicar_permiso <permiso>" };
        }
        const explanation = explainPermission(permission);
        return {
          text: explanation.known
            ? `${explanation.title}: ${explanation.explanation}`
            : "Permiso desconocido.",
        };
      }
      case "informe_lanzamiento": {
        const [reach, reactions, questions] = args.map((value) =>
          Number.parseInt(value, 10),
        );
        if (
          reach === undefined ||
          reactions === undefined ||
          questions === undefined ||
          [reach, reactions, questions].some(Number.isNaN)
        ) {
          return {
            text: "Uso: /informe_lanzamiento <alcance> <reacciones> <preguntas>",
          };
        }
        const report = buildPostLaunchReport({ reach, reactions, questions });
        return { text: report.summary };
      }
      case "prestigio": {
        const level = Number.parseInt(args[0] ?? "", 10);
        const prestige = Number.parseInt(args[1] ?? "", 10);
        if (Number.isNaN(level) || Number.isNaN(prestige)) {
          return { text: "Uso: /prestigio <nivel> <prestigio_actual>" };
        }
        const result = computePrestige({ level, prestige });
        return {
          text: result.canPrestige
            ? `✨ Puede ascender a prestigio: ${result.title}`
            : `Nivel actual: ${result.title}`,
        };
      }
      case "puntuar_duda": {
        const urgent = BotUpdateService.parseSiNo(args[0]);
        const ageMs = Number.parseFloat(args[1] ?? "");
        const upvotes = Number.parseInt(args[2] ?? "", 10);
        if (
          urgent === undefined ||
          Number.isNaN(ageMs) ||
          Number.isNaN(upvotes)
        ) {
          return {
            text: "Uso: /puntuar_duda <urgente si|no> <edad_ms> <votos>",
          };
        }
        const priority = scoreDoubt({ id: "duda", urgent, ageMs, upvotes });
        return { text: `❓ Prioridad: ${priority}` };
      }
      case "periodo_prueba": {
        const hoursAgo = Number.parseFloat(args[0] ?? "");
        if (Number.isNaN(hoursAgo)) {
          return { text: "Uso: /periodo_prueba <horas_desde_aceptado>" };
        }
        const nowMs = Date.now();
        const active = isOnProbation(nowMs - hoursAgo * 3_600_000, nowMs);
        return {
          text: active
            ? "🔶 Todavía en periodo de prueba."
            : "🟢 Periodo de prueba terminado.",
        };
      }
      case "resumen_publicacion": {
        const groups = Number.parseInt(args[0] ?? "", 10);
        const pinIn = Number.parseInt(args[1] ?? "", 10);
        const silent = BotUpdateService.parseSiNo(args[2]);
        if (
          Number.isNaN(groups) ||
          Number.isNaN(pinIn) ||
          silent === undefined
        ) {
          return {
            text: "Uso: /resumen_publicacion <grupos> <fijar_en> <silencioso si|no>",
          };
        }
        return { text: buildPublishSummary({ groups, pinIn, silent }) };
      }
      case "patron_cuarentena": {
        const hasPhoto = BotUpdateService.parseSiNo(args[0]);
        const oddName = BotUpdateService.parseSiNo(args[1]);
        const quickLink = BotUpdateService.parseSiNo(args[2]);
        if (
          hasPhoto === undefined ||
          oddName === undefined ||
          quickLink === undefined
        ) {
          return {
            text: "Uso: /patron_cuarentena <foto si|no> <nombre_raro si|no> <link_rapido si|no>",
          };
        }
        const decision = decideQuarantine({ hasPhoto, oddName, quickLink });
        return {
          text: decision.quarantine
            ? `🚧 Cuarentena: ${decision.signals.join(", ")}`
            : "Sin señales de cuarentena.",
        };
      }
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
      case "cebo_respuesta": {
        const [
          isReplyRaw,
          reactionsRaw,
          ageHoursRaw,
          hasLinkRaw,
          hasMentionRaw,
        ] = args;
        const isReply = BotUpdateService.parseSiNo(isReplyRaw);
        const repliedMessageReactions = Number.parseInt(reactionsRaw ?? "", 10);
        const ageHours = Number.parseFloat(ageHoursRaw ?? "");
        const textHasLink = BotUpdateService.parseSiNo(hasLinkRaw);
        const textHasMention = BotUpdateService.parseSiNo(hasMentionRaw);
        if (
          isReply === undefined ||
          Number.isNaN(repliedMessageReactions) ||
          Number.isNaN(ageHours) ||
          textHasLink === undefined ||
          textHasMention === undefined
        ) {
          return {
            text: "Uso: /cebo_respuesta <es_respuesta si|no> <reacciones> <edad_cuenta_horas> <tiene_link si|no> <tiene_mencion si|no>",
          };
        }
        const result = assessReplyBait({
          isReply,
          repliedMessageReactions,
          replierAccountAgeMs: ageHours * 3_600_000,
          textHasLink,
          textHasMention,
        });
        return {
          text: result.suspicious
            ? `🎣 Sospechoso: ${result.reasons.join(", ")}`
            : "No parece cebo.",
        };
      }
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
      case "anuncios_por_rol": {
        const [base, rolesRaw] = args.join(" ").split("|");
        const roles = (rolesRaw ?? "")
          .split(",")
          .map((role) => role.trim())
          .filter(Boolean);
        if (!base?.trim() || roles.length === 0) {
          return {
            text: "Uso: /anuncios_por_rol <texto_base>|<rol1,rol2,...>",
          };
        }
        const variants = buildRoleAnnouncements(base.trim(), roles);
        return {
          text: variants.map((v) => `[${v.role}] ${v.text}`).join("\n\n"),
        };
      }
      case "efecto_regla": {
        const before = Number.parseFloat(args[0] ?? "");
        const after = Number.parseFloat(args[1] ?? "");
        if (Number.isNaN(before) || Number.isNaN(after)) {
          return { text: "Uso: /efecto_regla <antes> <despues>" };
        }
        const effect = computeRuleActivityEffect({ before, after });
        return { text: `📊 ${effect.effect} (${effect.pct}%)` };
      }
      case "cooldown_regla": {
        const secondsAgo = Number.parseFloat(args[0] ?? "");
        if (Number.isNaN(secondsAgo)) {
          return {
            text: "Uso: /cooldown_regla <segundos_desde_ultimo_disparo>",
          };
        }
        const nowMs = Date.now();
        const result = checkRuleCooldown(nowMs - secondsAgo * 1000, nowMs);
        return {
          text: result.allowed
            ? "🟢 Puede dispararse de nuevo."
            : `🔴 Cooldown activo, faltan ${Math.round(result.remainingMs / 1000)}s.`,
        };
      }
      case "validar_explicacion": {
        const [name, explanation] = args.join(" ").split("|");
        if (!name?.trim() || !explanation?.trim()) {
          return { text: "Uso: /validar_explicacion <nombre>|<explicacion>" };
        }
        const check = validateRuleExplanation({
          name: name.trim(),
          explanation: explanation.trim(),
        });
        if (check.valid && context.chatId) {
          const raw = await this.chatSettingRepository.getValue(
            context.tenantId,
            context.chatId,
            "rule_explanation",
          );
          const explanations: Record<string, string> =
            raw && typeof raw === "object"
              ? (raw as Record<string, string>)
              : {};
          explanations[name.trim()] = explanation.trim();
          await this.chatSettingRepository.setValue(
            context.tenantId,
            context.chatId,
            "rule_explanation",
            explanations,
          );
        }
        return {
          text: check.valid
            ? "✅ Explicación suficiente y guardada como la explicación oficial de la regla."
            : `⚠️ ${check.issue ?? "Explicación insuficiente."}`,
        };
      }
      case "severidad_regla": {
        const level = args[0];
        const validLevels = new Set(["leve", "media", "grave", "expulsion"]);
        if (!level || !validLevels.has(level)) {
          return {
            text: "Uso: /severidad_regla <leve|media|grave|expulsion>",
          };
        }
        const severity = classifyRuleSeverity(level as RuleSeverityLevel);
        return {
          text: `${severity.emoji} Rango ${severity.rank}: ${severity.recommendedAction}`,
        };
      }
      case "efecto_sancion": {
        const severity = Number.parseFloat(args[0] ?? "");
        const userTenureDays = Number.parseFloat(args[1] ?? "");
        const hasSupporters = BotUpdateService.parseSiNo(args[2]);
        if (
          Number.isNaN(severity) ||
          Number.isNaN(userTenureDays) ||
          hasSupporters === undefined
        ) {
          return {
            text: "Uso: /efecto_sancion <severidad> <antiguedad_dias> <apoyo si|no>",
          };
        }
        const prediction = predictSanctionEffect({
          severity,
          userTenureDays,
          hasSupporters,
        });
        return { text: `🔮 Efecto probable: ${prediction.effect}` };
      }
      case "firma_sancion": {
        const [staff, reason, caseId] = args.join(" ").split("|");
        if (!staff?.trim() || !reason?.trim() || !caseId?.trim()) {
          return {
            text: "Uso: /firma_sancion <staff>|<motivo>|<caso_id>",
          };
        }
        return {
          text: buildSanctionSignature({
            staff: staff.trim(),
            reason: reason.trim(),
            caseId: caseId.trim(),
          }),
        };
      }
      case "modo_ahorro": {
        const aiCallsToday = Number.parseInt(args[0] ?? "", 10);
        const budget = Number.parseInt(args[1] ?? "", 10);
        if (Number.isNaN(aiCallsToday) || Number.isNaN(budget)) {
          return { text: "Uso: /modo_ahorro <llamadas_ia_hoy> <presupuesto>" };
        }
        const decision = decideSaveMode({ aiCallsToday, budget });
        return { text: decision.advice };
      }
      case "logros_secretos": {
        const [helps, nightMessages, cleanDays] = args.map((value) =>
          Number.parseInt(value, 10),
        );
        if (
          helps === undefined ||
          nightMessages === undefined ||
          cleanDays === undefined ||
          [helps, nightMessages, cleanDays].some(Number.isNaN)
        ) {
          return {
            text: "Uso: /logros_secretos <ayudas> <mensajes_noche> <dias_limpios>",
          };
        }
        const items = evaluateSecretAchievements({
          helps,
          nightMessages,
          cleanDays,
        });
        return {
          text:
            items.length > 0
              ? items.map((item) => item.title).join(", ")
              : "Sin logros secretos todavía.",
        };
      }
      case "auto_beneficio": {
        const [adminIdRaw, idsRaw] = args;
        const adminId = Number.parseInt(adminIdRaw ?? "", 10);
        const involvedUserIds = (idsRaw ?? "")
          .split(",")
          .map((value) => Number.parseInt(value.trim(), 10))
          .filter((value) => !Number.isNaN(value));
        if (Number.isNaN(adminId) || involvedUserIds.length === 0) {
          return {
            text: "Uso: /auto_beneficio <adminId> <id1,id2,...>",
          };
        }
        const check = detectSelfDealing({ adminId, involvedUserIds });
        return { text: check.reason };
      }
      case "anuncio_sensible": {
        const text = args.join(" ").trim();
        if (!text) {
          return { text: "Uso: /anuncio_sensible <texto>" };
        }
        const result = detectSensitiveAnnouncement(text);
        return {
          text: result.sensitive
            ? `⚠️ Temas sensibles: ${result.topics.join(", ")}`
            : "✅ Sin temas sensibles detectados.",
        };
      }
      case "sensibilidad_hilo": {
        const reports = Number.parseInt(args[0] ?? "", 10);
        const conflicts = Number.parseInt(args[1] ?? "", 10);
        if (Number.isNaN(reports) || Number.isNaN(conflicts)) {
          return { text: "Uso: /sensibilidad_hilo <reportes> <conflictos>" };
        }
        const verdict = classifyThreadSensitivity({ reports, conflicts });
        return {
          text: verdict.sensitive
            ? `🔍 Hilo sensible (score ${verdict.score})`
            : `✅ Hilo normal (score ${verdict.score})`,
        };
      }
      case "color_severidad": {
        const score = Number.parseFloat(args[0] ?? "");
        if (Number.isNaN(score)) {
          return { text: "Uso: /color_severidad <score>" };
        }
        const classification = classifySeverityColor(score);
        return {
          text: `${classification.color}: ${classification.action}`,
        };
      }
      case "celebracion_silenciosa": {
        const milestone = BotUpdateService.parseSiNo(args[0]);
        const recentConflicts = Number.parseInt(args[1] ?? "", 10);
        if (milestone === undefined || Number.isNaN(recentConflicts)) {
          return {
            text: "Uso: /celebracion_silenciosa <hito si|no> <conflictos_recientes>",
          };
        }
        const decision = decideCelebrationMode({
          milestone,
          recentConflicts,
        });
        return { text: decision.message };
      }
      case "spam_silencioso": {
        const [messageCount, linkCount, mentionCount] = args.map((value) =>
          Number.parseInt(value, 10),
        );
        if (
          messageCount === undefined ||
          linkCount === undefined ||
          mentionCount === undefined ||
          [messageCount, linkCount, mentionCount].some(Number.isNaN)
        ) {
          return {
            text: "Uso: /spam_silencioso <mensajes> <links> <menciones>",
          };
        }
        const result = detectSilentSpam({
          messageCount,
          linkCount,
          mentionCount,
        });
        return {
          text: result.suspicious
            ? `🤫 Sospechoso (ratio ${result.ratio})`
            : "No parece spam silencioso.",
        };
      }
      case "recomendacion_tamano": {
        const memberCount = Number.parseInt(args[0] ?? "", 10);
        if (Number.isNaN(memberCount)) {
          return { text: "Uso: /recomendacion_tamano <miembros>" };
        }
        const recommendation = recommendBySize(memberCount);
        return {
          text: `📏 ${recommendation.tier}\n${recommendation.recommendations.join("\n")}`,
        };
      }
      case "estabilidad_social": {
        const [conflicts, resolutions, activeMembers] = args.map((value) =>
          Number.parseInt(value, 10),
        );
        if (
          conflicts === undefined ||
          resolutions === undefined ||
          activeMembers === undefined ||
          [conflicts, resolutions, activeMembers].some(Number.isNaN)
        ) {
          return {
            text: "Uso: /estabilidad_social <conflictos> <resoluciones> <miembros_activos>",
          };
        }
        const result = computeSocialStability({
          conflicts,
          resolutions,
          activeMembers,
        });
        return { text: `🌡️ ${result.band} (score ${result.score})` };
      }
      case "suavizar_sancion": {
        const [action, ...publicParts] = args;
        const isPublic = BotUpdateService.parseSiNo(publicParts.join(" "));
        if (!action || isPublic === undefined) {
          return {
            text: "Uso: /suavizar_sancion <accion> <publico si|no>",
          };
        }
        const message = softenSanctionMessage({
          action,
          public: isPublic,
        });
        return { text: message.message };
      }
      case "filtro_spoiler": {
        const [text, keywordsRaw] = args.join(" ").split("|");
        const keywords = (keywordsRaw ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        if (!text?.trim()) {
          return { text: "Uso: /filtro_spoiler <texto>|<palabra1,palabra2>" };
        }
        const signal = detectSpoiler(text.trim(), keywords);
        return {
          text: signal.matched
            ? `🚫 Spoiler: ${signal.hits.join(", ")}`
            : "Sin spoilers detectados.",
        };
      }
      case "burnout_staff": {
        const conflictsResolved = Number.parseInt(args[0] ?? "", 10);
        const hoursActive = Number.parseFloat(args[1] ?? "");
        if (Number.isNaN(conflictsResolved) || Number.isNaN(hoursActive)) {
          return {
            text: "Uso: /burnout_staff <conflictos_resueltos> <horas_activo>",
          };
        }
        const result = detectBurnout({ conflictsResolved, hoursActive });
        return { text: result.advice };
      }
      case "confianza_staff": {
        const confirmed = Number.parseInt(args[0] ?? "", 10);
        const reverted = Number.parseInt(args[1] ?? "", 10);
        if (Number.isNaN(confirmed) || Number.isNaN(reverted)) {
          return { text: "Uso: /confianza_staff <confirmadas> <revertidas>" };
        }
        const result = computeStaffConfidence({ confirmed, reverted });
        return { text: `🎖️ ${result.band} (${result.score}/100)` };
      }
      case "logros_racha": {
        const streakDays = Number.parseInt(args[0] ?? "", 10);
        if (Number.isNaN(streakDays)) {
          return { text: "Uso: /logros_racha <dias>" };
        }
        const items = evaluateStreakAchievements(streakDays);
        return {
          text:
            items.length > 0
              ? items.map((item) => item.title).join(", ")
              : "Sin logros de racha todavía.",
        };
      }
      case "seguimiento_ticket": {
        const hoursAgo = Number.parseFloat(args[0] ?? "");
        if (Number.isNaN(hoursAgo)) {
          return { text: "Uso: /seguimiento_ticket <horas_desde_resuelto>" };
        }
        const nowMs = Date.now();
        const decision = shouldSendTicketFollowup(
          nowMs - hoursAgo * 3_600_000,
          nowMs,
        );
        return {
          text: decision.send
            ? decision.message
            : "Todavía no toca hacer seguimiento.",
        };
      }
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
      case "uso_indebido_topic": {
        const parts = args.join(" ").split("|");
        const [text, topicKeywordsRaw, offTopicKeywordsRaw] = parts;
        const topicKeywords = (topicKeywordsRaw ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        const offTopicKeywords = (offTopicKeywordsRaw ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        if (!text?.trim()) {
          return {
            text: "Uso: /uso_indebido_topic <texto>|<palabras_tema>|<palabras_fuera_tema>",
          };
        }
        const result = detectTopicMisuse({
          text: text.trim(),
          topicKeywords,
          offTopicKeywords,
        });
        return {
          text: result.misused
            ? `⚠️ Uso indebido: ${result.hits.join(", ")}`
            : "Uso correcto del topic.",
        };
      }
      case "comparar_grupos_gemelos": {
        const a = BotUpdateService.parseKeyValuePairs(args[0]);
        const b = BotUpdateService.parseKeyValuePairs(args[1]);
        if (Object.keys(a).length === 0 || Object.keys(b).length === 0) {
          return {
            text: "Uso: /comparar_grupos_gemelos <k1=v1,k2=v2> <k1=v1,k2=v2>",
          };
        }
        const comparisons = compareTwinGroups(a, b);
        const lines = comparisons.map(
          (c) => `${c.metric}: ${c.aValue} vs ${c.bValue} (líder: ${c.leader})`,
        );
        return { text: lines.join("\n") };
      }
      case "separacion_activa": {
        const hoursAgo = Number.parseFloat(args[0] ?? "");
        if (Number.isNaN(hoursAgo)) {
          return { text: "Uso: /separacion_activa <horas_desde_conflicto>" };
        }
        const nowMs = Date.now();
        const active = isSeparationActive(nowMs - hoursAgo * 3_600_000, nowMs);
        return {
          text: active
            ? "🚧 Separación todavía activa."
            : "🟢 Separación ya terminó.",
        };
      }
      case "trato_vip": {
        const [plan, baseMinutesRaw] = args;
        const baseMinutes = Number.parseFloat(baseMinutesRaw ?? "");
        if (
          !plan ||
          !["free", "pro", "vip"].includes(plan) ||
          Number.isNaN(baseMinutes)
        ) {
          return { text: "Uso: /trato_vip <free|pro|vip> <minutos_base>" };
        }
        const result = applyVipTreatment({
          plan: plan as VipClientPlan,
          baseMinutes,
        });
        return {
          text: result.vip
            ? `🌟 VIP: SLA ${result.slaMinutes} min`
            : `SLA estándar: ${result.slaMinutes} min`,
        };
      }
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
            ? `🚨 Proteccion extra activada (ratio ${result.ratio})`
            : `🟢 Volumen normal (ratio ${result.ratio})`,
        };
      }
      case "rompehielo": {
        const topic = (args[0] ?? "").toLowerCase();
        if (!topic) {
          return {
            text: `Uso: /rompehielo <tema>. Temas: ${listIcebreakerTopics().join(", ")}`,
          };
        }
        if (!isIcebreakerTopic(topic)) {
          return {
            text: `Tema desconocido. Usa uno de: ${listIcebreakerTopics().join(", ")}.`,
          };
        }
        // updateId as seed keeps the pick deterministic per update (idempotent retries).
        const question = pickIcebreaker(topic, update.updateId);
        return { text: `🧊 ${question}` };
      }
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
  private async handleDataReportsCommand(
    context: FoundationContext,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const name = update.command?.name;
    if (!name || !context.chatId) {
      return null;
    }
    const args = update.command?.args ?? [];

    switch (name) {
      case "informe_apelaciones_aceptadas": {
        const appeals = await this.d1Repository.listAppeals(
          context.tenantId,
          context.chatId,
        );
        const report = summarizeAcceptedAppeals(
          appeals.map((appeal) => ({
            accepted: appeal.status === "accepted",
            rule: appeal.caseRef,
          })),
        );
        const lines = report.byRule.map(
          (entry) => `${entry.rule}: ${entry.count}`,
        );
        return {
          text: `📋 Apelaciones aceptadas: ${report.acceptedTotal}\n${lines.join("\n")}`,
        };
      }
      case "historial_apelaciones": {
        const appeals = await this.d1Repository.listAppeals(
          context.tenantId,
          context.chatId,
        );
        const summary = summarizeAppealHistory(
          appeals.map((appeal) => ({
            accepted: appeal.status === "accepted",
          })),
        );
        return {
          text: `📜 Total: ${summary.total} · Aceptadas: ${summary.accepted} · Rechazadas: ${summary.rejected} · Tasa: ${summary.acceptRate}`,
        };
      }
      case "apelaciones_por_incidente": {
        const appeals = await this.d1Repository.listAppeals(
          context.tenantId,
          context.chatId,
        );
        const groups = bucketAppealsByIncident(
          appeals.map((appeal) => ({
            incidentId: appeal.caseRef,
            userId: Number(appeal.appellantTelegramId),
          })),
        );
        const lines = groups.map(
          (group) =>
            `${group.incidentId}: ${group.count} (${group.userIds.join(", ")})`,
        );
        return {
          text:
            lines.length > 0
              ? lines.join("\n")
              : "Sin apelaciones registradas.",
        };
      }
      case "buscar_regla": {
        const query = args.join(" ").trim();
        if (!query) {
          return { text: "Uso: /buscar_regla <texto>" };
        }
        const config = await this.welcomeRepository.getConfig(context.chatId);
        const rules = (config?.rulesText ?? "")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        if (rules.length === 0) {
          return { text: "Este grupo todavía no tiene reglas configuradas." };
        }
        const matches = searchRules(rules, query);
        return {
          text:
            matches.length > 0
              ? matches
                  .map((match) => `${match.index + 1}. ${match.text}`)
                  .join("\n")
              : "Ninguna regla coincide con esa búsqueda.",
        };
      }
      case "reglas_movil": {
        const config = await this.welcomeRepository.getConfig(context.chatId);
        const rules = (config?.rulesText ?? "")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        if (rules.length === 0) {
          return { text: "Este grupo todavía no tiene reglas configuradas." };
        }
        const summary = summarizeRulesMobile(rules);
        return { text: summary.short.join("\n") };
      }
      case "historial_cliente": {
        const replyUserId = extractReplyContext(update.raw).userId;
        const argUserId = args[0] ? BigInt(args[0]) : undefined;
        const reporterTelegramId = replyUserId
          ? BigInt(replyUserId)
          : argUserId;
        if (reporterTelegramId === undefined) {
          return {
            text: "Uso: /historial_cliente <telegram_id> (o responde a un usuario)",
          };
        }
        const tickets = await this.ticketRepository.listByReporter(
          context.tenantId,
          reporterTelegramId,
        );
        const STATUS_MAP: Record<string, "abierto" | "resuelto" | "cerrado"> = {
          open: "abierto",
          assigned: "abierto",
          closed: "cerrado",
        };
        const summary = summarizeClientHistory(
          tickets.map((ticket) => ({
            status: STATUS_MAP[ticket.status] ?? "abierto",
          })),
        );
        return {
          text: `🎫 Total: ${summary.total} · Abiertos: ${summary.open} · Resueltos: ${summary.resolved} · Cerrados: ${summary.closed}`,
        };
      }
      case "mapa_calor": {
        const tzArg = args[0];
        const tzOffsetMin =
          tzArg !== undefined && /^-?\d{1,4}$/.test(tzArg) ? Number(tzArg) : 0;
        const recent = await this.chatActivityRepository.listRecent(
          context.tenantId,
          context.chatId,
          "message",
          500,
        );
        if (recent.length === 0) {
          return {
            text: "Aún no hay actividad registrada para el mapa de calor.",
          };
        }
        const heatmap = buildActivityHeatmap(
          recent.map((entry) => entry.createdAt.getTime()),
          tzOffsetMin,
        );
        const tzLabel =
          tzOffsetMin === 0
            ? "UTC"
            : `UTC${tzOffsetMin > 0 ? "+" : "-"}${Math.abs(tzOffsetMin) / 60}h`;
        return {
          text: `🕒 Mapa de calor · ${recent.length} mensajes · ${tzLabel}\n${formatHeatmap(heatmap)}\nHora punta: ${peakHour(heatmap)}:00`,
        };
      }
      case "participacion": {
        const recent = await this.chatActivityRepository.listRecent(
          context.tenantId,
          context.chatId,
          "message",
          500,
        );
        const counts = new Map<string, number>();
        for (const entry of recent) {
          if (entry.telegramUserId === undefined) {
            continue;
          }
          const id = entry.telegramUserId.toString();
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
        if (counts.size === 0) {
          return { text: "Aún no hay actividad para medir la participación." };
        }
        const stats = [...counts.entries()].map(([userId, messages]) => ({
          userId,
          messages,
        }));
        const names = this.activityUsernames(recent);
        const monopoly = detectMonopoly(stats, 0.4);
        const quiet = suggestQuietVoices(stats, 3);
        const lines = [
          `⚖️ Participación · ${stats.length} personas · ${recent.length} mensajes`,
          `Desigualdad (Gini): ${Math.round(participationGini(stats) * 100)}%`,
        ];
        if (monopoly.monopolized && monopoly.userId !== undefined) {
          lines.push(
            `Acapara la charla: ${this.renderActivityUser(monopoly.userId, names)} (${Math.round(monopoly.share * 100)}%)`,
          );
        }
        if (quiet.length > 0) {
          lines.push(
            `Voces más calladas: ${quiet
              .map((id) => this.renderActivityUser(id, names))
              .join(", ")}`,
          );
        }
        return { text: lines.join("\n") };
      }
      case "senal_acoso": {
        const recent = await this.chatActivityRepository.listRecent(
          context.tenantId,
          context.chatId,
          "message",
          500,
        );
        const events: { fromId: string; toId: string; ms: number }[] = [];
        for (const entry of recent) {
          const from = entry.telegramUserId;
          const to = entry.repliedToUserId;
          if (from === undefined || to === undefined) {
            continue;
          }
          events.push({
            fromId: from.toString(),
            toId: to.toString(),
            ms: entry.createdAt.getTime(),
          });
        }
        if (events.length === 0) {
          return {
            text: "No hay respuestas recientes para analizar acoso grupal.",
          };
        }
        const names = this.activityUsernames(recent);
        const nowMs = Date.now();
        const windowMs = 60 * 60 * 1000;
        const flagged: string[] = [];
        for (const target of new Set(events.map((event) => event.toId))) {
          const result = detectDogpiling(target, events, windowMs, nowMs);
          if (result.piling) {
            flagged.push(
              `${this.renderActivityUser(target, names)}: ${result.attackers} usuarios distintos`,
            );
          }
        }
        return {
          text:
            flagged.length > 0
              ? `⚠️ Posible acoso grupal (última hora):\n${flagged.join("\n")}`
              : "🕊️ Sin señales de acoso grupal en la última hora.",
        };
      }
      case "spam_firma": {
        const recent = await this.chatActivityRepository.listRecent(
          context.tenantId,
          context.chatId,
          "message",
          500,
        );
        const byUser = new Map<string, string[]>();
        for (const entry of recent) {
          if (entry.telegramUserId === undefined || !entry.text) {
            continue;
          }
          const id = entry.telegramUserId.toString();
          const list = byUser.get(id) ?? [];
          list.push(entry.text);
          byUser.set(id, list);
        }
        if (byUser.size === 0) {
          return { text: "Aún no hay mensajes para analizar firmas de spam." };
        }
        const names = this.activityUsernames(recent);
        const flagged: string[] = [];
        for (const [id, messages] of byUser) {
          const result = detectSignatureSpam(messages);
          if (result.matched && result.signature !== undefined) {
            flagged.push(
              `${this.renderActivityUser(id, names)}: "${result.signature}" (${result.occurrences} veces)`,
            );
          }
        }
        return {
          text:
            flagged.length > 0
              ? `📛 Firmas de spam repetidas:\n${flagged.join("\n")}`
              : "🧼 Sin firmas de spam repetidas detectadas.",
        };
      }
      case "crossposting": {
        const recent = await this.chatActivityRepository.listRecent(
          context.tenantId,
          context.chatId,
          "message",
          500,
        );
        const messages: { topicId: number; text: string }[] = [];
        for (const entry of recent) {
          if (entry.topic === undefined || !entry.text) {
            continue;
          }
          messages.push({ topicId: Number(entry.topic), text: entry.text });
        }
        if (messages.length === 0) {
          return {
            text: "No hay mensajes con tema de foro para analizar crossposting.",
          };
        }
        const report = detectCrossposting(messages);
        if (!report.matched) {
          return { text: "🧼 Sin crossposting entre temas detectado." };
        }
        const lines = report.duplicates.slice(0, 10).map((dup) => {
          const sample =
            dup.sample.length > 40 ? `${dup.sample.slice(0, 40)}…` : dup.sample;
          return `"${sample}" en ${dup.topics.length} temas`;
        });
        return { text: `♻️ Crossposting entre temas:\n${lines.join("\n")}` };
      }
      case "temas_emergentes": {
        const recent = await this.chatActivityRepository.listRecent(
          context.tenantId,
          context.chatId,
          "message",
          500,
        );
        const nowMs = Date.now();
        const windowMs = 24 * 60 * 60 * 1000;
        const recentByTopic = new Map<string, number>();
        const previousByTopic = new Map<string, number>();
        for (const entry of recent) {
          if (entry.topic === undefined) {
            continue;
          }
          const age = nowMs - entry.createdAt.getTime();
          if (age < 0) {
            continue;
          }
          if (age <= windowMs) {
            recentByTopic.set(
              entry.topic,
              (recentByTopic.get(entry.topic) ?? 0) + 1,
            );
          } else if (age <= windowMs * 2) {
            previousByTopic.set(
              entry.topic,
              (previousByTopic.get(entry.topic) ?? 0) + 1,
            );
          }
        }
        const topicIds = new Set<string>([
          ...recentByTopic.keys(),
          ...previousByTopic.keys(),
        ]);
        if (topicIds.size === 0) {
          return { text: "No hay actividad por temas en las últimas 48h." };
        }
        const counts = [...topicIds].map((topic) => ({
          topic,
          recent: recentByTopic.get(topic) ?? 0,
          previous: previousByTopic.get(topic) ?? 0,
        }));
        const emerging = detectEmergingTopics(counts, 2);
        const dead = detectDeadTopics(counts);
        const lines: string[] = [];
        if (emerging.length > 0) {
          lines.push(
            `📈 Emergentes: ${emerging.map((topic) => `tema ${topic}`).join(", ")}`,
          );
        }
        if (dead.length > 0) {
          lines.push(
            `📉 Se apagaron: ${dead.map((topic) => `tema ${topic}`).join(", ")}`,
          );
        }
        if (lines.length === 0) {
          return {
            text: "Sin temas emergentes ni apagados en las últimas 48h.",
          };
        }
        return { text: lines.join("\n") };
      }
      case "temas_inactivos": {
        const daysArg = args[0];
        const days =
          daysArg !== undefined && /^\d{1,3}$/.test(daysArg)
            ? Number(daysArg)
            : 7;
        const recent = await this.chatActivityRepository.listRecent(
          context.tenantId,
          context.chatId,
          "message",
          500,
        );
        const lastActivityByTopic = new Map<string, number>();
        for (const entry of recent) {
          if (entry.topic === undefined) {
            continue;
          }
          const ms = entry.createdAt.getTime();
          const prev = lastActivityByTopic.get(entry.topic);
          if (prev === undefined || ms > prev) {
            lastActivityByTopic.set(entry.topic, ms);
          }
        }
        if (lastActivityByTopic.size === 0) {
          return {
            text: "No hay actividad por temas registrada (¿el grupo usa temas de foro?).",
          };
        }
        const topics = [...lastActivityByTopic.entries()].map(
          ([id, lastActivityMs]) => ({ id, lastActivityMs }),
        );
        const dead = detectIdleTopics(topics, Date.now(), {
          deadAfterMs: days * 24 * 60 * 60 * 1000,
        });
        if (dead.length === 0) {
          return { text: `🌿 Ningún tema lleva ${days}+ días inactivo.` };
        }
        const lines = dead
          .slice(0, 15)
          .map(
            (topic) =>
              `tema ${topic.id}: ${Math.floor(topic.idleMs / 86_400_000)}d inactivo`,
          );
        return {
          text: `🪦 Temas inactivos (${days}+ días):\n${lines.join("\n")}`,
        };
      }
      case "fantasmas": {
        const [joins, messages] = await Promise.all([
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
        const joinedMs = new Map<string, number>();
        for (const entry of joins) {
          if (entry.telegramUserId === undefined) {
            continue;
          }
          const id = entry.telegramUserId.toString();
          const ms = entry.createdAt.getTime();
          const prev = joinedMs.get(id);
          if (prev === undefined || ms < prev) {
            joinedMs.set(id, ms);
          }
        }
        if (joinedMs.size === 0) {
          return {
            text: "No hay entradas de miembros registradas todavía.",
          };
        }
        const messageCount = new Map<string, number>();
        const firstMessageMs = new Map<string, number>();
        for (const entry of messages) {
          if (entry.telegramUserId === undefined) {
            continue;
          }
          const id = entry.telegramUserId.toString();
          messageCount.set(id, (messageCount.get(id) ?? 0) + 1);
          const ms = entry.createdAt.getTime();
          const prev = firstMessageMs.get(id);
          if (prev === undefined || ms < prev) {
            firstMessageMs.set(id, ms);
          }
        }
        const members = [...joinedMs.entries()].map(([userId, joined]) => {
          const first = firstMessageMs.get(userId);
          return {
            userId,
            joinedMs: joined,
            messages: messageCount.get(userId) ?? 0,
            ...(first !== undefined ? { firstMessageMs: first } : {}),
          };
        });
        const graceMs = 24 * 60 * 60 * 1000;
        const ghosts = findGhostMembers(members, Date.now(), graceMs);
        const curve = computeSilenceCurve(
          members.map((member) => ({
            joinMs: member.joinedMs,
            firstMessageMs: member.firstMessageMs,
          })),
        );
        const names = this.activityUsernames(messages);
        const lines: string[] = [];
        if (ghosts.length === 0) {
          lines.push("👻 Sin miembros fantasma (24h+ sin escribir).");
        } else {
          lines.push(
            `👻 Fantasmas (entraron hace +24h, 0 mensajes): ${ghosts.length}`,
          );
          lines.push(
            ghosts
              .slice(0, 15)
              .map((id) => this.renderActivityUser(id, names))
              .join(", "),
          );
        }
        if (curve.participatedCount > 0) {
          const minutes = Math.round(curve.medianDelayMs / 60_000);
          const total = curve.participatedCount + curve.neverSpokeCount;
          lines.push(
            `🗣️ Hablaron ${curve.participatedCount} de ${total} · mediana hasta el 1er mensaje: ${minutes} min`,
          );
        }
        return { text: lines.join("\n") };
      }
      case "reaccion_abuso": {
        const recent = await this.chatActivityRepository.listRecent(
          context.tenantId,
          context.chatId,
          "reaction",
          500,
        );
        const reactions: {
          targetMsgAuthorId: string;
          emoji: string;
          ms: number;
        }[] = [];
        for (const entry of recent) {
          if (entry.telegramUserId === undefined || !entry.text) {
            continue;
          }
          reactions.push({
            targetMsgAuthorId: entry.telegramUserId.toString(),
            emoji: entry.text,
            ms: entry.createdAt.getTime(),
          });
        }
        if (reactions.length === 0) {
          return { text: "No hay reacciones registradas todavía." };
        }
        const negativeEmojis = ["👎", "🤡", "💩", "🤮", "🖕", "😡"];
        const result = detectReactionAbuse(
          reactions,
          60 * 60 * 1000,
          Date.now(),
          negativeEmojis,
        );
        if (!result.abused || result.targetId === undefined) {
          return {
            text: "🕊️ Sin oleadas de reacciones negativas en la última hora.",
          };
        }
        const names = this.activityUsernames(recent);
        return {
          text: `🎭 Oleada de reacciones negativas contra ${this.renderActivityUser(result.targetId, names)}: ${result.count} en la última hora.`,
        };
      }
      case "discusion_circular": {
        const recent = await this.chatActivityRepository.listRecent(
          context.tenantId,
          context.chatId,
          "message",
        );
        const messages = recent
          .filter((entry) => entry.telegramUserId !== undefined && entry.text)
          .reverse()
          .map((entry) => ({
            authorId: Number(entry.telegramUserId),
            text: entry.text ?? "",
          }));
        const result = detectCircularArgument(messages);
        return {
          text: result.circular
            ? `🔁 Discusión circular entre ${result.authors.join(" y ")} (${result.repeats} vueltas)`
            : "No hay discusión circular reciente.",
        };
      }
      case "copia_pega": {
        const recent = await this.chatActivityRepository.listRecent(
          context.tenantId,
          context.chatId,
          "message",
        );
        const messages = recent
          .filter((entry) => entry.telegramUserId !== undefined && entry.text)
          .reverse()
          .map((entry) => ({
            authorId: Number(entry.telegramUserId),
            text: entry.text ?? "",
          }));
        const report = detectCopyPaste(messages);
        return {
          text: report.matched
            ? report.clusters
                .map(
                  (cluster) =>
                    `"${cluster.sample}" (${cluster.authors.length} cuentas)`,
                )
                .join("\n")
            : "Sin mensajes copipasteados detectados.",
        };
      }
      case "spam_saludo": {
        const recent = await this.chatActivityRepository.listRecent(
          context.tenantId,
          context.chatId,
          "message",
        );
        const messages = recent
          .filter((entry) => entry.text)
          .reverse()
          .map((entry) => ({
            text: entry.text ?? "",
            hasLink: entry.hasLink,
          }));
        const signal = detectGreetingSpam(messages);
        return {
          text: signal.matched
            ? `👋 Patrón de saludo+enlace detectado (mensaje ${signal.greetingIndex + 1})`
            : "Sin patrón de saludo+enlace reciente.",
        };
      }
      case "ritmo_humano": {
        const userIdArg = args[0];
        if (!userIdArg) {
          return { text: "Uso: /ritmo_humano <telegram_id>" };
        }
        const targetId = BigInt(userIdArg);
        const recent = await this.chatActivityRepository.listRecent(
          context.tenantId,
          context.chatId,
          "message",
        );
        const timestampsMs = recent
          .filter((entry) => entry.telegramUserId === targetId)
          .map((entry) => entry.createdAt.getTime())
          .sort((a, b) => a - b);
        const verdict = detectInhumanRhythm(timestampsMs);
        return {
          text: verdict.suspicious
            ? `🤖 Ritmo sospechoso (desviación ${verdict.stdDevMs}ms en ${verdict.intervalCount} intervalos)`
            : "Ritmo de escritura normal.",
        };
      }
      case "escalada_broma": {
        const recent = await this.chatActivityRepository.listRecent(
          context.tenantId,
          context.chatId,
          "message",
        );
        const messages = recent
          .filter((entry) => entry.text)
          .reverse()
          .map((entry) => ({ text: entry.text ?? "" }));
        const result = detectJokeEscalation(messages);
        return {
          text: result.escalating
            ? "😬 Una broma reciente parece haber escalado a insulto."
            : "Sin escalada de bromas detectada.",
        };
      }
      case "tipos_conflicto": {
        const cases = await this.moderationRepository.listRecentCases(
          context.tenantId,
          context.chatId,
        );
        const tally = tallyConflictTypes(
          cases
            .filter((c) => c.reason)
            .map((c) => ({ type: c.reason ?? "sin_motivo" })),
        );
        return {
          text:
            tally.length > 0
              ? tally
                  .map((t) => `${t.type}: ${t.count} (${t.percent}%)`)
                  .join("\n")
              : "Sin casos recientes con motivo registrado.",
        };
      }
      case "reglas_rotas": {
        const cases = await this.moderationRepository.listRecentCases(
          context.tenantId,
          context.chatId,
        );
        const violations = cases
          .filter((c) => c.reason)
          .map((c) => ({ ruleId: c.reason ?? "?", ruleName: c.reason ?? "?" }));
        const ranking = rankBrokenRules(violations);
        return {
          text:
            ranking.length > 0
              ? ranking.map((r) => `${r.ruleName}: ${r.count}`).join("\n")
              : "Sin normas rotas registradas recientemente.",
        };
      }
      case "miembros_inactivos": {
        const recent = await this.chatActivityRepository.listRecent(
          context.tenantId,
          context.chatId,
          "message",
          500,
        );
        const lastActiveByUser = new Map<number, number>();
        for (const entry of recent) {
          if (entry.telegramUserId === undefined) {
            continue;
          }
          const userId = Number(entry.telegramUserId);
          const seenMs = entry.createdAt.getTime();
          const known = lastActiveByUser.get(userId);
          if (known === undefined || seenMs > known) {
            lastActiveByUser.set(userId, seenMs);
          }
        }
        const members = [...lastActiveByUser.entries()].map(
          ([userId, lastActiveMs]) => ({ userId, lastActiveMs }),
        );
        const dormant = detectDormantMembers(members, Date.now());
        if (dormant.length === 0) {
          return {
            text: "Sin miembros inactivos detectados en la ventana reciente.",
          };
        }
        const lines = dormant
          .slice(0, 10)
          .map(
            (member) =>
              `${member.userId}: ${Math.floor(member.idleMs / 86_400_000)}d inactivo`,
          );
        return { text: `😴 Miembros inactivos:\n${lines.join("\n")}` };
      }
      case "acciones_revertidas": {
        const sanctions =
          await this.moderationRepository.listRecentSanctionsForChat(
            context.tenantId,
            context.chatId,
          );
        const ranking = rankRevertedActions(
          sanctions.map((sanction) => ({
            type: sanction.kind,
            reverted: sanction.status === "reverted",
          })),
        );
        return {
          text:
            ranking.length > 0
              ? ranking
                  .map((r) => `${r.type}: ${r.reverted}/${r.total} (${r.rate})`)
                  .join("\n")
              : "Sin acciones registradas recientemente.",
        };
      }
      case "tablero_casos": {
        const tickets = await this.ticketRepository.listRecent(
          context.tenantId,
          context.chatId,
        );
        const now = Date.now();
        const clampPriority = (priority: string): CasePriority =>
          priority === "low" || priority === "high" ? priority : "normal";
        const cases: BoardCase[] = tickets.map((ticket) => ({
          id: ticket.number.toString(),
          status: ticket.status,
          priority: clampPriority(ticket.priority),
          ageMs: now - ticket.createdAt.getTime(),
        }));
        if (cases.length === 0) {
          return { text: "Sin casos registrados todavía." };
        }
        const counts = boardCounts(cases);
        const board = orderBoard(cases);
        const lines = Object.entries(counts).map(([column, count]) => {
          const top = board[column as keyof typeof board][0];
          return top
            ? `${column}: ${count} (caso #${top.id} primero)`
            : `${column}: ${count}`;
        });
        return { text: `🗂️ Tablero de casos:\n${lines.join("\n")}` };
      }
      default:
        return null;
    }
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
          : "El servicio de IA no esta disponible ahora mismo. Prueba /help para ver todo lo que puedo hacer.",
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
    );
    this.addAiMemoryHint(
      messages,
      await this.buildAiMemoryHint(context, update),
    );

    let completion: Awaited<ReturnType<AiProvider["complete"]>>;
    try {
      completion = await this.aiProvider.complete(messages, {
        task: "fast_chat",
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
          : "El servicio de IA no esta disponible ahora mismo. Intentalo mas tarde.",
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
   * Whether the actor is an admin for permission purposes. Beyond the bot owner
   * and any DB membership role, this consults the LIVE Telegram admin list
   * (cached), so real group admins are recognized even when the bot has never
   * recorded their role in its own database.
   */
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

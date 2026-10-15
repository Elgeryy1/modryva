import { z } from "zod";

// Per-section config contracts for the Mini App, shared by the api (validation)
// and the web (form rendering). The constant lists MIRROR
// modules/community/src/settings.ts but are inlined here on purpose: packages/
// shared is imported by the Next.js web bundle (transpilePackages), and pulling
// @superbot/module-community transitively into the browser build would drag in
// server TS. Keep these in sync with settings.ts.

export const FLOOD_ACTIONS = ["warn", "mute", "ban", "delete"] as const;
export const CAPTCHA_MODES = ["button", "math", "text"] as const;
export const CAPTCHA_FAIL_ACTIONS = ["mute", "ban", "restrict"] as const;
export const WARN_MODES = ["ban", "kick", "mute", "tban", "tmute"] as const;
export const ANTIRAID_MODES = ["observe", "enforce"] as const;

export const WARN_LIMIT_MIN = 1;
export const WARN_LIMIT_MAX = 20;
export const LOCK_TYPES = [
  "text",
  "url",
  "mention",
  "forward",
  "via_bot",
  "photo",
  "video",
  "gif",
  "sticker",
  "audio",
  "voice",
  "document",
  "contact",
  "location",
  "poll",
] as const;

export const FLOOD_LIMIT_MIN = 3;
export const FLOOD_LIMIT_MAX = 20;

const nullableText = z.string().max(4096).nullable();
const clampedFloodLimit = z
  .number()
  .int()
  .transform((value) =>
    Math.min(FLOOD_LIMIT_MAX, Math.max(FLOOD_LIMIT_MIN, value)),
  );

// One GroupHelp-style welcome button. `url` is only required (and only used) for
// the "url" type; the rest are built-in behaviours (rules/contact/mini-app).
export const welcomeButtonSchema = z
  .object({
    type: z.enum(["rules", "url", "contact_admins", "miniapp"]),
    text: z.string().trim().min(1).max(64),
    url: z.string().trim().max(512).optional(),
  })
  .refine(
    (button) =>
      button.type !== "url" ||
      /^(https?:\/\/|tg:\/\/)/iu.test(button.url ?? ""),
    {
      message: "Los botones de enlace necesitan una URL http(s) válida.",
      path: ["url"],
    },
  );

export const welcomeConfigSchema = z.object({
  welcomeText: nullableText,
  goodbyeText: nullableText,
  welcomeButtons: z.array(welcomeButtonSchema).max(6).optional(),
});

export const rulesConfigSchema = z.object({
  rulesText: nullableText,
});

export const floodConfigSchema = z.object({
  enabled: z.boolean(),
  messageLimit: clampedFloodLimit,
  windowSeconds: z.number().int().positive().max(3600),
  action: z.enum(FLOOD_ACTIONS),
});

export const captchaConfigSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(CAPTCHA_MODES),
  failAction: z.enum(CAPTCHA_FAIL_ACTIONS),
  timeoutSeconds: z.number().int().positive().max(3600),
  maxAttempts: z.number().int().positive().max(10),
});

export const locksConfigSchema = z.object({
  locked: z.array(z.enum(LOCK_TYPES)),
});

const clampedWarnLimit = z
  .number()
  .int()
  .transform((value) =>
    Math.min(WARN_LIMIT_MAX, Math.max(WARN_LIMIT_MIN, value)),
  );

// Sanction/expiry windows are stored as BigInt milliseconds; null clears the
// field (temporal mode without a duration, or warns that never expire).
const nullableMs = z.number().int().positive().max(31_536_000_000).nullable();

export const warnsConfigSchema = z
  .object({
    warnLimit: clampedWarnLimit,
    warnMode: z.enum(WARN_MODES),
    durationMs: nullableMs,
    expireMs: nullableMs,
  })
  .superRefine((value, ctx) => {
    // tban/tmute are temporal and require a duration to be meaningful.
    if (
      (value.warnMode === "tban" || value.warnMode === "tmute") &&
      value.durationMs == null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["durationMs"],
        message: "duration-required",
      });
    }
  });

// Telegram chat ids are signed 64-bit integers; kept as a string end-to-end
// (JSON cannot safely round-trip a bigint) and parsed with BigInt at the DB
// boundary. null clears the requirement.
export const membershipGateConfigSchema = z.object({
  requiredTelegramChatId: z
    .string()
    .regex(/^-?\d+$/u)
    .nullable(),
});

export const hygieneConfigSchema = z.object({
  cleanService: z.boolean(),
  cleanWelcome: z.boolean(),
  cleanCommands: z.boolean(),
  nightMode: z.boolean(),
  nightStart: z.number().int().min(0).max(23),
  nightEnd: z.number().int().min(0).max(23),
  welcomeMute: z.boolean(),
  autoApprove: z.boolean(),
  rtlFilter: z.boolean(),
  cjkFilter: z.boolean(),
  language: z.string().min(2).max(8),
  blockKnownSpammers: z.boolean(),
});

// Antiraid: join-surge detection. `observe` only logs; `enforce` acts. Bounds
// mirror the command parser (joinLimit > 0, positive window). newAccountAgeDays
// 0 disables the young-account check.
export const antiraidConfigSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(ANTIRAID_MODES),
  joinLimit: z.number().int().min(2).max(100),
  windowSeconds: z.number().int().min(5).max(3600),
  newAccountAgeDays: z.number().int().min(0).max(365),
});

// Bot behaviour / "passive mode": the master switch + per-category toggles that
// decide which of Modryva's autonomous behaviours run (see resolveBotMode in
// @superbot/module-security). Stored on GroupHygieneConfig. `passiveMode` makes
// the bot do ONLY Guardian verification + games (so it can coexist with a
// dedicated moderation bot like GroupHelp); the categories give granular control
// when it is off. They default true so a group behaves as before until changed.
export const botBehaviorConfigSchema = z.object({
  passiveMode: z.boolean(),
  autoModeration: z.boolean(),
  autoCleanup: z.boolean(),
  autoMessages: z.boolean(),
});

export const SECTION_SCHEMAS = {
  behavior: botBehaviorConfigSchema,
  welcome: welcomeConfigSchema,
  rules: rulesConfigSchema,
  flood: floodConfigSchema,
  captcha: captchaConfigSchema,
  locks: locksConfigSchema,
  warns: warnsConfigSchema,
  hygiene: hygieneConfigSchema,
  membershipGate: membershipGateConfigSchema,
  raid: antiraidConfigSchema,
} as const;

export const SECTION_NAMES = [
  "behavior",
  "welcome",
  "rules",
  "flood",
  "captcha",
  "locks",
  "warns",
  "hygiene",
  "membershipGate",
  "raid",
] as const;

export type SectionName = (typeof SECTION_NAMES)[number];

export const isSectionName = (value: string): value is SectionName =>
  (SECTION_NAMES as readonly string[]).includes(value);

export type BotBehaviorConfigInput = z.infer<typeof botBehaviorConfigSchema>;
export type WelcomeConfigInput = z.infer<typeof welcomeConfigSchema>;
export type RulesConfigInput = z.infer<typeof rulesConfigSchema>;
export type FloodConfigInput = z.infer<typeof floodConfigSchema>;
export type CaptchaConfigInput = z.infer<typeof captchaConfigSchema>;
export type LocksConfigInput = z.infer<typeof locksConfigSchema>;
export type WarnsConfigInput = z.infer<typeof warnsConfigSchema>;
export type HygieneConfigInput = z.infer<typeof hygieneConfigSchema>;
export type MembershipGateConfigInput = z.infer<
  typeof membershipGateConfigSchema
>;
export type AntiraidConfigInput = z.infer<typeof antiraidConfigSchema>;

// --- List-shaped per-chat configs stored in the generic ChatSetting store ---
// These are NOT config "sections" (they are arrays edited whole), so they live
// outside SECTION_SCHEMAS. Keys + shapes MUST match how the bot reads them in
// apps/bot/src/bot-update.service.ts (schedule_rules / rituals).

export const SCHEDULE_RULES_KEY = "schedule_rules";
export const RITUALS_KEY = "rituals";
export const CHAT_QUIET_KEY = "chat_quiet";
export const WEEKLY_RECAP_KEY = "weekly_recap";
/** MUST equal SOCIAL_SETTINGS_KEY in modules/social; pinned by a parity test. */
export const SOCIAL_KEY = "social";

// --- Social core (pole, roulette, Paulo, cats and dogs) ---------------------
//
// This is the browser-facing mirror of modules/social/src/settings.ts. The
// duplication is deliberate and follows the note above: packages/shared ships
// to the browser bundle, and modules/social must not. The bot NORMALISES what
// it reads (an out-of-range value falls back to its default rather than
// throwing); this schema REJECTS, because the Mini App is a place where a bad
// value can still be refused to the person typing it.
//
// A parity test keeps the two in step — they have drifted before.

export const POLE_CLAIM_MODE_VALUES = [
  "COMMAND_CLAIM",
  "AUTO_FIRST_MESSAGE",
] as const;
export const THREAD_SCOPE_VALUES = ["shared", "per-topic"] as const;
export const ROULETTE_CONSEQUENCE_VALUES = [
  "FUN_ONLY",
  "TEMPORARY_MUTE",
] as const;

/**
 * Below 60 s Telegram reads a restriction as PERMANENT, so the Mini App must
 * not let an admin type 5 and believe it.
 */
export const SOCIAL_MIN_MUTE_SECONDS = 60;
export const SOCIAL_MAX_MUTE_SECONDS = 24 * 60 * 60;

export const socialSettingsSchema = z.object({
  pole: z.object({
    enabled: z.boolean(),
    mode: z.enum(POLE_CLAIM_MODE_VALUES),
    // Validated as a real IANA zone on the server, where Intl can answer.
    timezone: z.string().min(1).max(64),
    resetMinutes: z
      .number()
      .int()
      .min(0)
      .max(24 * 60 - 1),
    positions: z.number().int().min(1).max(10),
    threadScope: z.enum(THREAD_SCOPE_VALUES),
    allowMedia: z.boolean(),
    summaryEnabled: z.boolean(),
  }),
  roulette: z
    .object({
      enabled: z.boolean(),
      consequence: z.enum(ROULETTE_CONSEQUENCE_VALUES),
      numerator: z.number().int().min(1).max(99),
      denominator: z.number().int().min(2).max(100),
      muteSeconds: z
        .number()
        .int()
        .min(SOCIAL_MIN_MUTE_SECONDS)
        .max(SOCIAL_MAX_MUTE_SECONDS),
      userCooldownSeconds: z.number().int().min(0).max(3600),
      chatCooldownSeconds: z.number().int().min(0).max(3600),
    })
    // Each field can be in range while the PAIR means "every round loses",
    // which is never what an admin intends to configure.
    .refine((value) => value.numerator < value.denominator, {
      message: "La probabilidad no puede ser 1 o mayor",
      path: ["numerator"],
    }),
  fun: z.object({
    pauloEnabled: z.boolean(),
    catsEnabled: z.boolean(),
    dogsEnabled: z.boolean(),
  }),
  // Empty means "no support method configured"; anything else must be a plain
  // https link, because every member of the group can tap it.
  supportUrl: z
    .string()
    .max(300)
    .refine(
      (value) => value === "" || /^https:\/\/[^\s/@]+\.[^\s/@]+/u.test(value),
      { message: "Debe ser un enlace https" },
    ),
});
export type SocialSettingsInput = z.infer<typeof socialSettingsSchema>;

// Quiet mode: when enabled the bot stops posting unprompted celebratory chatter
// (level-ups, etc.) in the group. It still moderates and answers commands.
export const chatQuietSchema = z.object({ enabled: z.boolean() });
export type ChatQuietInput = z.infer<typeof chatQuietSchema>;

// Weekly recap: opt-in (default off). When enabled, the worker posts one short
// summary of the group's week (message count, top members, busiest day). Only
// aggregated stats from ChatActivityEvent are used — never raw message text, and
// only the compact stats (not the chat) are ever sent to the AI narrator. Like
// every unprompted post it also defers to quiet mode.
export const weeklyRecapSchema = z.object({ enabled: z.boolean() });
export type WeeklyRecapInput = z.infer<typeof weeklyRecapSchema>;

// A time-of-day moderation window [startHour, endHour) on a 24h clock; `strict`
// tightens moderation while active. Mirrors modules/community TimeRule.
export const scheduleRuleSchema = z.object({
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(0).max(23),
  strict: z.boolean(),
});
export const scheduleRulesSchema = z.array(scheduleRuleSchema).max(24);
export type ScheduleRuleInput = z.infer<typeof scheduleRuleSchema>;

// A weekly recurring ritual: fires when weekday (0=Sun..6=Sat) + hour match.
// Mirrors modules/community Ritual.
export const ritualSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  hour: z.number().int().min(0).max(23),
  message: z.string().min(1).max(1024),
});
export const ritualsSchema = z.array(ritualSchema).max(50);
export type RitualInput = z.infer<typeof ritualSchema>;

// --- Guardian Verification (join-request Mini App camera verification) ---
// Mirrors modules/guardian/src/settings.ts's GuardianSettingsForValidation —
// inlined here for the same reason as the constants above (packages/shared
// ships to the browser bundle).

export const GUARDIAN_MODES = [
  "off",
  "manual",
  "assisted",
  "auto",
  "strict",
] as const;
export const GUARDIAN_CAPTURE_MODES = [
  "photo",
  "video",
  "video_with_fallback",
] as const;
export const GUARDIAN_CHALLENGE_DIFFICULTIES = [
  "basic",
  "normal",
  "strict",
] as const;

const unitInterval = z.number().min(0).max(1);

export const guardianConfigSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(GUARDIAN_MODES),
  // Telegram chat id of the STAFF chat, as a string (BigInt is not JSON-safe).
  staffChatId: z
    .string()
    .regex(/^-?\d+$/u)
    .nullable(),
  staffThreadId: z.number().int().positive().nullable(),
  /**
   * Extra STAFF rooms the report is mirrored to. Every copy carries the
   * decision buttons; the session's optimistic lock decides who wins.
   *
   * Capped at 5 deliberately: each room is another Telegram call on the hot
   * path of a resolution, and another copy of a face photo to delete on time.
   * Defaults to [] so an older client that omits the field clears nothing by
   * accident — it simply sends what it always sent.
   */
  extraStaffChats: z
    .array(
      z.object({
        chatId: z.string().regex(/^-?\d+$/u),
        threadId: z.number().int().positive().nullable(),
      }),
    )
    .max(5)
    .default([]),
  captureMode: z.enum(GUARDIAN_CAPTURE_MODES),
  challengeDifficulty: z.enum(GUARDIAN_CHALLENGE_DIFFICULTIES),
  maxAttempts: z.number().int().min(1).max(10),
  sessionTtlSeconds: z.number().int().min(60).max(3600),
  mediaRetentionHours: z.number().int().min(1).max(720),
  autoApproveThreshold: unitInterval,
  manualReviewThreshold: unitInterval,
  livenessMinimum: unitInterval,
  gestureMinimum: unitInterval,
  replayRiskMaximum: unitInterval,
  syntheticRiskMaximum: unitInterval,
  requireSingleFace: z.boolean(),
  estimateAge: z.boolean(),
  minimumAge: z.number().int().min(13).max(99).nullable(),
  maximumAge: z.number().int().min(13).max(99).nullable(),
  // 1 = single photo. 2 = double verification (second photo, different
  // gesture, AI confirms same person before it can ever auto-approve).
  requiredPhotos: z.union([z.literal(1), z.literal(2)]),
  // ISO 3166-1 alpha-2 codes, e.g. ["ES","PT"]. Empty = no restriction.
  allowedCountries: z.array(z.string().regex(/^[A-Z]{2}$/u)).max(50),
  allowAutomaticDecline: z.boolean(),
  sendApprovedCasesToStaff: z.literal(true),
  protectStaffContent: z.boolean(),
  keepStaffPhotos: z.boolean(),
  /** Decline a join request whose verification ran out without being finished.
   * Not the same as allowAutomaticDecline: this acts on non-completion, never
   * on a judgement about the person, and a decline lets them request again. */
  declineOnExpiry: z.boolean().default(false),
  locale: z.string().min(2).max(10),
});
export type GuardianConfigInput = z.infer<typeof guardianConfigSchema>;

export interface GuardianConfigIssue {
  readonly field: string;
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
}

export interface GuardianDiagnosticsResult {
  readonly botIsAdmin: boolean;
  readonly supportsJoinRequestQueries: boolean | null;
  readonly guardBotAssigned: boolean | null;
  readonly staffChatConfigured: boolean;
  readonly staffChatReachable: boolean | null;
  readonly storageReachable: boolean;
  readonly miniAppUrlConfigured: boolean;
  readonly sessionSecretConfigured: boolean;
  /** Whether GUARDIAN_VISION_JUDGE_ENABLED is on. */
  readonly gestureVisionJudgeFlagEnabled: boolean;
  /** Whether at least one Gemini/Groq key is configured. */
  readonly gestureVisionJudgeKeysConfigured: boolean;
  /** The REAL signal for whether Guardian can auto-judge a photo (face/age/
   * gesture) — both the flag AND a key. AUTO/STRICT can only ever
   * auto-approve when this is true — see decision-engine.ts. Do not confuse
   * with visualAnalyzerConfigured/Reachable below, a separate optional CV
   * microservice that isn't what decides an auto-approve. */
  readonly gestureVisionJudgeConfigured: boolean;
  /** Whether AI_SERVICE_URL (the OPTIONAL supplementary visual/liveness
   * analyzer — services/guardian-vision-analyzer) is configured at all. This
   * is NOT the gesture/face/age judge — see gestureVisionJudgeConfigured. */
  readonly visualAnalyzerConfigured: boolean;
  /** Whether its /healthz endpoint actually responded healthy just now.
   * `null` when not configured (nothing to reach). Purely informational for
   * this optional analyzer — does not gate AUTO/STRICT auto-approval. */
  readonly visualAnalyzerReachable: boolean | null;
}

/** One PERSON in the verification roster (the "/bdani" screen), not one
 * session — repeat verifications by the same person collapse into a single row
 * carrying their latest connection and a count. */
export interface GuardianRosterEntry {
  readonly telegramUserId: string;
  readonly displayName: string;
  readonly username: string | null;
  readonly ip: string;
  readonly countryCode: string | null;
  readonly firstSeen: string;
  readonly lastSeen: string;
  readonly verifications: number;
  /** What this person last did, in plain Spanish: "verificación", "juegos", …
   * A row that stops at the verification is misleading once the same person has
   * been playing daily since, and their newer connection is the one the
   * multi-account check should be comparing. */
  readonly lastActivity: string;
  readonly lastStatus: string;
  readonly lastDecision: string | null;
  /** True when the person opened the Mini App but never submitted a photo, and
   * the session then timed out. Those end up with the same `manual_review`
   * decision as a real case awaiting a human, so without this the roster would
   * show "revisión manual" for someone who never verified at all. */
  readonly abandoned: boolean;
  /** Other people seen on the same connection. Non-empty is a SIGNAL for a
   * human, never a verdict — shared WiFi and mobile CGNAT both produce it. */
  readonly sharesConnectionWith: readonly {
    readonly telegramUserId: string;
    readonly displayName: string;
    /** "exact" = identical address; "network" = same IPv6 /64 only. */
    readonly strength: string;
  }[];
  /** Which of the caller's groups this person was seen in. Always exactly one
   * on the per-group screen; the point of the cross-group view is that it can
   * be several — someone in four of your communities is worth spotting. */
  readonly groups: readonly GuardianRosterGroup[];
}

/** One administrator the bot appointed, or an appointment it has since ended. */
export interface AppointedAdminEntry {
  readonly telegramUserId: string;
  readonly username: string | null;
  readonly displayName: string | null;
  readonly customTitle: string | null;
  readonly grantedByTelegramId: string;
  readonly grantedAt: string;
  /** active | revoked. */
  readonly status: string;
  readonly revokedAt: string | null;
  /** "manual", or the guard rule that fired ("guard:ban_burst", …). */
  readonly revokedReason: string | null;
  readonly adoptedExisting: boolean;
}

/** An administrator the bot did NOT appoint, and therefore cannot ever demote. */
export interface UnreachableAdmin {
  readonly telegramUserId: string;
  readonly username: string | null;
  readonly displayName: string | null;
}

export interface AppointedAdminPanel {
  readonly settings: {
    readonly enabled: boolean;
    readonly mode: string;
    readonly windowSeconds: number;
    readonly banBurstLimit: number;
    readonly unbanBurstLimit: number;
    readonly chatInfoLimit: number;
    readonly tripOnPromote: boolean;
  };
  readonly appointed: readonly AppointedAdminEntry[];
  /** Admins beyond the bot's reach. Non-empty is not a fault — it is the honest
   * limit of what this feature can protect, and the screen must say so. */
  readonly beyondReach: readonly UnreachableAdmin[];
  /** False when Telegram could not be reached, so `beyondReach` is unknown
   * rather than empty. An empty list shown as fact would read as "everyone is
   * covered", which is the one wrong thing to say here. */
  readonly liveListAvailable: boolean;
}

/** A group folded into a roster view. */
export interface GuardianRosterGroup {
  readonly telegramChatId: string;
  readonly title: string;
}

export interface GuardianRosterResult {
  readonly entries: readonly GuardianRosterEntry[];
  /** True when there were more verification sessions than the screen read, so
   * this is the newest slice rather than everything. A partial view of fraud
   * signals must never be shown as if it were complete: a shared connection
   * that fell off the end looks exactly like no shared connection at all. */
  readonly truncated?: boolean;
  /** Every group aggregated into this response — one for the per-group screen,
   * all the caller administers for the cross-group one. Lets the UI say what it
   * is actually showing instead of implying it covers everything. */
  readonly groups: readonly GuardianRosterGroup[];
}

export interface GuardianSessionSummary {
  readonly id: string;
  readonly shortId: string;
  readonly telegramUserId: string;
  readonly displayName: string;
  readonly status: string;
  readonly decision: string | null;
  readonly createdAt: string;
  readonly resolvedAt: string | null;
}

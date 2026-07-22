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

import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type HygieneCommand =
  | { readonly kind: "cleanservice"; readonly enabled: boolean }
  | { readonly kind: "cleanwelcome"; readonly enabled: boolean }
  | { readonly kind: "nightmode"; readonly enabled: boolean }
  | {
      readonly kind: "setnight";
      readonly startHour: number;
      readonly endHour: number;
    };

export interface HygieneCommandError {
  readonly code: "invalid-toggle" | "invalid-hours";
  readonly usage: string;
}

export type HygieneCommandResult =
  | { readonly ok: true; readonly command: HygieneCommand }
  | { readonly ok: false; readonly error: HygieneCommandError };

const toggleCommandNames: ReadonlySet<string> = new Set([
  "cleanservice",
  "cleanwelcome",
  "nightmode",
]);

const truthyToggles: ReadonlySet<string> = new Set(["on", "si", "true"]);
const falsyToggles: ReadonlySet<string> = new Set(["off", "no", "false"]);

const toggleUsage = (name: string): string => `Uso: /${name} on|off`;
const setnightUsage = "Uso: /setnight <inicio 0..23> <fin 0..23>";

/**
 * Parses an on/off toggle argument. Accepts on/off/si/no/true/false (case
 * insensitive). Returns null when the value is not a recognized toggle.
 */
const parseToggle = (value: string | undefined): boolean | null => {
  const normalized = (value ?? "").toLowerCase();

  if (truthyToggles.has(normalized)) {
    return true;
  }

  if (falsyToggles.has(normalized)) {
    return false;
  }

  return null;
};

/**
 * Returns true when the value is an integer hour of the day (0..23).
 */
const isValidHour = (value: number): boolean =>
  Number.isInteger(value) && value >= 0 && value <= 23;

/**
 * Parses the group-hygiene commands: `cleanservice`, `cleanwelcome`,
 * `nightmode` (all `on|off`) and `setnight <inicio> <fin>` (hours 0..23).
 *
 * Returns null when the command is not one of the hygiene commands. Returns
 * `{ ok: false }` with a usage message when the toggle is invalid or when
 * `setnight` is missing an hour or receives an out-of-range hour.
 */
export const parseHygieneCommand = (
  update: TelegramUpdateEnvelope,
): HygieneCommandResult | null => {
  const name = update.command?.name;

  if (!name) {
    return null;
  }

  const args = update.command?.args ?? [];

  if (toggleCommandNames.has(name)) {
    const enabled = parseToggle(args[0]);

    if (enabled === null) {
      return {
        ok: false,
        error: { code: "invalid-toggle", usage: toggleUsage(name) },
      };
    }

    if (name === "cleanservice") {
      return { ok: true, command: { kind: "cleanservice", enabled } };
    }

    if (name === "cleanwelcome") {
      return { ok: true, command: { kind: "cleanwelcome", enabled } };
    }

    return { ok: true, command: { kind: "nightmode", enabled } };
  }

  if (name === "setnight") {
    const startHour = Number.parseInt(args[0] ?? "", 10);
    const endHour = Number.parseInt(args[1] ?? "", 10);

    if (!isValidHour(startHour) || !isValidHour(endHour)) {
      return {
        ok: false,
        error: { code: "invalid-hours", usage: setnightUsage },
      };
    }

    return { ok: true, command: { kind: "setnight", startHour, endHour } };
  }

  return null;
};

const serviceMessageKeys = [
  "new_chat_members",
  "new_chat_member",
  "left_chat_member",
  "new_chat_title",
  "new_chat_photo",
  "delete_chat_photo",
  "group_chat_created",
  "supergroup_chat_created",
  "channel_chat_created",
  "pinned_message",
  "message_auto_delete_timer_changed",
  "migrate_to_chat_id",
  "migrate_from_chat_id",
] as const;

/**
 * Returns true when the raw Telegram update wraps a `message` that carries a
 * service field such as `new_chat_members`, `left_chat_member`,
 * `new_chat_title`, `new_chat_photo`, `delete_chat_photo`,
 * `group_chat_created`, `pinned_message`, etc.
 *
 * Navigation is done with explicit `typeof` checks; a null/undefined or
 * non-object `raw`, or a raw without a `message` object, yields false.
 */
export const isServiceMessage = (raw: unknown): boolean => {
  if (typeof raw !== "object" || raw === null) {
    return false;
  }

  const message = (raw as { message?: unknown }).message;

  if (typeof message !== "object" || message === null) {
    return false;
  }

  const record = message as Record<string, unknown>;

  return serviceMessageKeys.some((key) => record[key] !== undefined);
};

export interface NightWindow {
  readonly startHour: number;
  readonly endHour: number;
}

/**
 * Returns true when `hourOfDay` falls within the half-open window
 * `[startHour, endHour)`. Supports windows that cross midnight: with
 * `startHour = 23` and `endHour = 7`, the hours 23, 0, 1..6 are night while 7
 * is not. When `startHour === endHour` the window is empty (never night).
 * `hourOfDay` is expected in the range 0..23.
 */
export const isNightTime = (
  hourOfDay: number,
  window: NightWindow,
): boolean => {
  const { startHour, endHour } = window;

  if (startHour === endHour) {
    return false;
  }

  if (startHour < endHour) {
    return hourOfDay >= startHour && hourOfDay < endHour;
  }

  return hourOfDay >= startHour || hourOfDay < endHour;
};

/**
 * The subset of per-group hygiene flags that decide *which* of Modryva's
 * autonomous behaviours run. `passiveMode` is the master "hands-off" switch:
 * when on, Modryva does ONLY Guardian verification + games (so it can coexist
 * with a dedicated moderation bot such as GroupHelp). The three category flags
 * give granular control when NOT fully passive, and default to `true` so an
 * un-configured group behaves exactly as before this feature existed.
 *
 * `HygieneState` is a structural superset of this, so it can be passed directly.
 */
export interface BotBehaviorFlags {
  readonly passiveMode: boolean;
  readonly autoModeration: boolean;
  readonly autoCleanup: boolean;
  readonly autoMessages: boolean;
}

/**
 * What Modryva is allowed to do autonomously in a group, after resolving the
 * master passive switch against the per-category toggles. Every enforcement
 * point reads one boolean from here instead of re-deriving the semantics.
 */
export interface BotModeResolution {
  /**
   * Autonomous sanctions: kick/ban/mute/warn escalation, antiflood, antiraid,
   * blocklist deletes, content locks, CAS, federation bans, night mode,
   * character filters, welcome-mute, scheduled strict mode, ECA/automation.
   */
  readonly moderation: boolean;
  /** Deletion of Telegram service/join/leave messages (cleanService/cleanWelcome). */
  readonly cleanup: boolean;
  /** Unsolicited posts: welcome, goodbye, milestones, onboarding, AFK ambient. */
  readonly messages: boolean;
  /**
   * Manual moderation *commands* (/ban, /warn, /antiflood, /blocklist, /fed…).
   * Only the master passive switch removes these; the category toggles leave
   * them available so an admin can still act by hand.
   */
  readonly commands: boolean;
}

/**
 * Resolves the effective bot mode for a group. Pure: the master `passiveMode`
 * forces everything (including commands) off; otherwise each category follows
 * its own flag and commands stay enabled. Guardian verification and games are
 * NOT represented here — they are never gated by this resolution.
 */
export const resolveBotMode = (flags: BotBehaviorFlags): BotModeResolution => {
  if (flags.passiveMode) {
    return {
      moderation: false,
      cleanup: false,
      messages: false,
      commands: false,
    };
  }

  return {
    moderation: flags.autoModeration,
    cleanup: flags.autoCleanup,
    messages: flags.autoMessages,
    commands: true,
  };
};

const HOURS_PER_DAY = 24;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

/**
 * Computes the hour of the day (0..23) for a `nowMs` timestamp in milliseconds
 * after applying a timezone `utcOffsetMinutes` offset. Pure: uses only integer
 * arithmetic and never reads the wall clock.
 */
export const hourFromMs = (nowMs: number, utcOffsetMinutes: number): number => {
  const shiftedMs = nowMs + utcOffsetMinutes * MS_PER_MINUTE;
  const hour = Math.floor(shiftedMs / MS_PER_HOUR) % HOURS_PER_DAY;

  return ((hour % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
};

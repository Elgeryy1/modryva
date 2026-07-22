import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type AntifloodAction = "ignore" | "delete" | "warn" | "mute" | "ban";

const antifloodActions: ReadonlySet<string> = new Set([
  "ignore",
  "delete",
  "warn",
  "mute",
  "ban",
]);

export interface AntifloodSettings {
  readonly enabled: boolean;
  readonly windowSeconds: number;
  readonly messageLimit: number;
  readonly action: AntifloodAction;
  readonly muteSeconds: number;
  readonly cooldownSeconds: number;
}

export const defaultAntifloodSettings: AntifloodSettings = {
  enabled: false,
  windowSeconds: 10,
  messageLimit: 5,
  action: "mute",
  muteSeconds: 300,
  cooldownSeconds: 30,
};

export interface FloodDecision {
  readonly triggered: boolean;
  readonly count: number;
  readonly action: AntifloodAction;
}

/**
 * Pure flood evaluator. `recentTimestampsMs` must already include the current
 * message timestamp. A flood is triggered when the number of messages inside the
 * rolling window strictly exceeds the configured limit.
 */
export const evaluateFlood = (
  recentTimestampsMs: readonly number[],
  nowMs: number,
  settings: AntifloodSettings,
): FloodDecision => {
  if (!settings.enabled) {
    return { triggered: false, count: 0, action: "ignore" };
  }

  const windowStart = nowMs - settings.windowSeconds * 1000;
  const count = recentTimestampsMs.filter(
    (value) => value >= windowStart,
  ).length;
  const triggered = count > settings.messageLimit;

  return {
    triggered,
    count,
    action: triggered ? settings.action : "ignore",
  };
};

export type AntifloodCommand =
  | { readonly kind: "help" }
  | { readonly kind: "status" }
  | { readonly kind: "enable"; readonly enabled: boolean }
  | {
      readonly kind: "limit";
      readonly messageLimit: number;
      readonly windowSeconds: number | undefined;
    }
  | { readonly kind: "action"; readonly action: AntifloodAction }
  | { readonly kind: "test" };

export interface AntifloodCommandError {
  readonly code: "invalid-limit" | "invalid-action";
  readonly usage: string;
}

export type AntifloodCommandResult =
  | { readonly ok: true; readonly command: AntifloodCommand }
  | { readonly ok: false; readonly error: AntifloodCommandError };

const antifloodCommandNames: ReadonlySet<string> = new Set([
  "antiflood",
  "antiflood_on",
  "antiflood_off",
  "antiflood_status",
  "antiflood_limit",
  "antiflood_action",
  "antiflood_test",
]);

export const parseAntifloodCommand = (
  update: TelegramUpdateEnvelope,
): AntifloodCommandResult | null => {
  const name = update.command?.name;

  if (!name || !antifloodCommandNames.has(name)) {
    return null;
  }

  const args = update.command?.args ?? [];

  switch (name) {
    case "antiflood":
      return { ok: true, command: { kind: "help" } };
    case "antiflood_status":
      return { ok: true, command: { kind: "status" } };
    case "antiflood_on":
      return { ok: true, command: { kind: "enable", enabled: true } };
    case "antiflood_off":
      return { ok: true, command: { kind: "enable", enabled: false } };
    case "antiflood_test":
      return { ok: true, command: { kind: "test" } };
    case "antiflood_limit": {
      const limit = Number.parseInt(args[0] ?? "", 10);
      const windowSeconds = args[1] ? Number.parseInt(args[1], 10) : undefined;

      if (!Number.isInteger(limit) || limit <= 0) {
        return {
          ok: false,
          error: {
            code: "invalid-limit",
            usage: "Uso: /antiflood_limit <mensajes> [ventana_segundos]",
          },
        };
      }

      if (
        windowSeconds !== undefined &&
        (!Number.isInteger(windowSeconds) || windowSeconds <= 0)
      ) {
        return {
          ok: false,
          error: {
            code: "invalid-limit",
            usage: "Uso: /antiflood_limit <mensajes> [ventana_segundos]",
          },
        };
      }

      return {
        ok: true,
        command: { kind: "limit", messageLimit: limit, windowSeconds },
      };
    }
    case "antiflood_action": {
      const action = (args[0] ?? "").toLowerCase();

      if (!antifloodActions.has(action)) {
        return {
          ok: false,
          error: {
            code: "invalid-action",
            usage: "Uso: /antiflood_action <ignore|delete|warn|mute|ban>",
          },
        };
      }

      return {
        ok: true,
        command: { kind: "action", action: action as AntifloodAction },
      };
    }
    default:
      return null;
  }
};

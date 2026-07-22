import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type AntiraidMode = "observe" | "enforce";

const antiraidModes: ReadonlySet<string> = new Set(["observe", "enforce"]);

export interface AntiraidSettings {
  readonly enabled: boolean;
  readonly windowSeconds: number;
  readonly joinLimit: number;
  readonly mode: AntiraidMode;
  readonly newAccountAgeDays: number;
}

export const defaultAntiraidSettings: AntiraidSettings = {
  enabled: false,
  windowSeconds: 30,
  joinLimit: 5,
  mode: "observe",
  newAccountAgeDays: 0,
};

export interface RaidDecision {
  readonly triggered: boolean;
  readonly joinCount: number;
  readonly mode: AntiraidMode;
}

/**
 * Pure raid evaluator over a rolling window of join timestamps. A raid is
 * triggered when the number of joins inside the window strictly exceeds the
 * configured limit. `recentJoinTimestampsMs` must already include the current
 * join(s).
 */
export const evaluateRaid = (
  recentJoinTimestampsMs: readonly number[],
  nowMs: number,
  settings: AntiraidSettings,
): RaidDecision => {
  if (!settings.enabled) {
    return { triggered: false, joinCount: 0, mode: settings.mode };
  }

  const windowStart = nowMs - settings.windowSeconds * 1000;
  const joinCount = recentJoinTimestampsMs.filter(
    (value) => value >= windowStart,
  ).length;

  return {
    triggered: joinCount > settings.joinLimit,
    joinCount,
    mode: settings.mode,
  };
};

export type AntiraidCommand =
  | { readonly kind: "help" }
  | { readonly kind: "status" }
  | { readonly kind: "enable"; readonly enabled: boolean }
  | {
      readonly kind: "limit";
      readonly joinLimit: number;
      readonly windowSeconds: number | undefined;
    }
  | { readonly kind: "mode"; readonly mode: AntiraidMode }
  | { readonly kind: "test" };

export interface AntiraidCommandError {
  readonly code: "invalid-limit" | "invalid-mode";
  readonly usage: string;
}

export type AntiraidCommandResult =
  | { readonly ok: true; readonly command: AntiraidCommand }
  | { readonly ok: false; readonly error: AntiraidCommandError };

const antiraidCommandNames: ReadonlySet<string> = new Set([
  "antiraid",
  "antiraid_on",
  "antiraid_off",
  "antiraid_status",
  "antiraid_limit",
  "antiraid_mode",
  "antiraid_test",
]);

export const parseAntiraidCommand = (
  update: TelegramUpdateEnvelope,
): AntiraidCommandResult | null => {
  const name = update.command?.name;

  if (!name || !antiraidCommandNames.has(name)) {
    return null;
  }

  const args = update.command?.args ?? [];

  switch (name) {
    case "antiraid":
      return { ok: true, command: { kind: "help" } };
    case "antiraid_status":
      return { ok: true, command: { kind: "status" } };
    case "antiraid_on":
      return { ok: true, command: { kind: "enable", enabled: true } };
    case "antiraid_off":
      return { ok: true, command: { kind: "enable", enabled: false } };
    case "antiraid_test":
      return { ok: true, command: { kind: "test" } };
    case "antiraid_limit": {
      const joinLimit = Number.parseInt(args[0] ?? "", 10);
      const windowSeconds = args[1] ? Number.parseInt(args[1], 10) : undefined;

      if (!Number.isInteger(joinLimit) || joinLimit <= 0) {
        return {
          ok: false,
          error: {
            code: "invalid-limit",
            usage: "Uso: /antiraid_limit <entradas> [ventana_segundos]",
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
            usage: "Uso: /antiraid_limit <entradas> [ventana_segundos]",
          },
        };
      }

      return {
        ok: true,
        command: { kind: "limit", joinLimit, windowSeconds },
      };
    }
    case "antiraid_mode": {
      const mode = (args[0] ?? "").toLowerCase();

      if (!antiraidModes.has(mode)) {
        return {
          ok: false,
          error: {
            code: "invalid-mode",
            usage: "Uso: /antiraid_mode <observe|enforce>",
          },
        };
      }

      return {
        ok: true,
        command: { kind: "mode", mode: mode as AntiraidMode },
      };
    }
    default:
      return null;
  }
};

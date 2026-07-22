import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { parseCompactDuration } from "./warn-policy.js";

/**
 * Extra moderation verbs that round out the Rose-style toolkit. The full
 * prefix matrix:
 *  - `t` (temporary, auto-expired by the worker): `/tban` `/tmute`.
 *  - `s` (silent — deletes the command so the chat stays clean): `/sban`
 *    `/smute` `/skick`.
 *  - `d` (delete — ban/mute/kick and remove the replied message): `/dban`
 *    `/dmute` `/dkick`.
 * `kick` is a ban+unban (Telegram has no native kick). The target id is provided
 * by args[0] (the service prepends it for replies).
 */

export type ModerationPlusAction = "ban" | "mute" | "kick";

export type ModerationPlusCommand =
  | {
      readonly kind: "temp";
      readonly action: "ban" | "mute";
      readonly targetTelegramUserId: bigint;
      readonly durationMs: number;
      readonly reason: string | undefined;
    }
  | {
      readonly kind: "silent";
      readonly action: ModerationPlusAction;
      readonly targetTelegramUserId: bigint;
      readonly durationMs: number | undefined;
      readonly reason: string | undefined;
    }
  | {
      readonly kind: "delete";
      readonly action: ModerationPlusAction;
      readonly targetTelegramUserId: bigint;
      readonly reason: string | undefined;
    };

export interface ModerationPlusError {
  readonly code: "target-required" | "duration-required";
  readonly usage: string;
}

export type ModerationPlusResult =
  | { readonly ok: true; readonly command: ModerationPlusCommand }
  | { readonly ok: false; readonly error: ModerationPlusError };

const names: ReadonlySet<string> = new Set([
  "tban",
  "tmute",
  "sban",
  "smute",
  "skick",
  "dban",
  "dmute",
  "dkick",
]);

const targetIdPattern = /^-?\d+$/u;

const parseTarget = (raw: string | undefined): bigint | null =>
  raw && targetIdPattern.test(raw) ? BigInt(raw) : null;

const err = (
  code: ModerationPlusError["code"],
  usage: string,
): ModerationPlusResult => ({ ok: false, error: { code, usage } });

export const parseModerationPlusCommand = (
  update: TelegramUpdateEnvelope,
): ModerationPlusResult | null => {
  const name = update.command?.name;

  if (!name || !names.has(name)) {
    return null;
  }

  const args = update.command?.args ?? [];
  const target = parseTarget(args[0]);

  if (target === null) {
    return err("target-required", `Uso: /${name} <id> ...`);
  }

  if (name === "tban" || name === "tmute") {
    const durationMs = parseCompactDuration(args[1]);
    if (durationMs === null) {
      return err(
        "duration-required",
        `Uso: /${name} <id> <duracion: 30m|2h|7d|4w> [motivo]`,
      );
    }
    const reason = args.slice(2).join(" ").trim() || undefined;
    return {
      ok: true,
      command: {
        kind: "temp",
        action: name === "tban" ? "ban" : "mute",
        targetTelegramUserId: target,
        durationMs,
        ...(reason ? { reason } : { reason: undefined }),
      },
    };
  }

  const silentAction: ModerationPlusAction | null =
    name === "sban"
      ? "ban"
      : name === "smute"
        ? "mute"
        : name === "skick"
          ? "kick"
          : null;

  if (silentAction !== null) {
    let durationMs: number | undefined;
    let reasonStart = 1;
    if (silentAction === "mute") {
      // /smute keeps a required duration; /sban and /skick are indefinite.
      const parsed = parseCompactDuration(args[1]);
      if (parsed === null) {
        return err(
          "duration-required",
          "Uso: /smute <id> <duracion: 30m|2h|7d|4w> [motivo]",
        );
      }
      durationMs = parsed;
      reasonStart = 2;
    }
    const reason = args.slice(reasonStart).join(" ").trim() || undefined;
    return {
      ok: true,
      command: {
        kind: "silent",
        action: silentAction,
        targetTelegramUserId: target,
        durationMs,
        ...(reason ? { reason } : { reason: undefined }),
      },
    };
  }

  // dban / dmute / dkick: delete the replied message and apply the action.
  const deleteAction: ModerationPlusAction =
    name === "dmute" ? "mute" : name === "dkick" ? "kick" : "ban";
  const reason = args.slice(1).join(" ").trim() || undefined;
  return {
    ok: true,
    command: {
      kind: "delete",
      action: deleteAction,
      targetTelegramUserId: target,
      ...(reason ? { reason } : { reason: undefined }),
    },
  };
};

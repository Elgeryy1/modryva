import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type ScheduleCommand =
  | {
      readonly kind: "create";
      readonly minutes: number;
      readonly text: string;
    }
  | { readonly kind: "list" }
  | { readonly kind: "cancel"; readonly postId: string };

export interface ScheduleCommandError {
  readonly code: "format" | "id-required";
  readonly usage: string;
}

export type ScheduleCommandResult =
  | { readonly ok: true; readonly command: ScheduleCommand }
  | { readonly ok: false; readonly error: ScheduleCommandError };

const scheduleCommandNames: ReadonlySet<string> = new Set([
  "schedule",
  "schedules",
  "unschedule",
]);

const scheduleUsage =
  "Uso: /schedule <minutos> <mensaje> (minutos entre 1 y 43200)";

export const parseScheduleCommand = (
  update: TelegramUpdateEnvelope,
): ScheduleCommandResult | null => {
  const name = update.command?.name;

  if (!name || !scheduleCommandNames.has(name)) {
    return null;
  }

  const args = update.command?.args ?? [];

  if (name === "schedules") {
    return { ok: true, command: { kind: "list" } };
  }

  if (name === "unschedule") {
    const postId = args[0];
    return postId
      ? { ok: true, command: { kind: "cancel", postId } }
      : {
          ok: false,
          error: { code: "id-required", usage: "Uso: /unschedule <id>" },
        };
  }

  const minutes = Number.parseInt(args[0] ?? "", 10);
  const text = args.slice(1).join(" ").trim();

  if (
    !Number.isInteger(minutes) ||
    minutes < 1 ||
    minutes > 43_200 ||
    text.length === 0
  ) {
    return { ok: false, error: { code: "format", usage: scheduleUsage } };
  }

  return { ok: true, command: { kind: "create", minutes, text } };
};

export const computeRunAtMs = (nowMs: number, minutes: number): number =>
  nowMs + minutes * 60_000;

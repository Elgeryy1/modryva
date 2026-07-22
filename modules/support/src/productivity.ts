import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type ReminderCommand =
  | { readonly kind: "create"; readonly minutes: number; readonly text: string }
  | { readonly kind: "list" }
  | { readonly kind: "cancel"; readonly reminderId: string };

export interface ReminderCommandError {
  readonly code: "format" | "id-required";
  readonly usage: string;
}

export type ReminderCommandResult =
  | { readonly ok: true; readonly command: ReminderCommand }
  | { readonly ok: false; readonly error: ReminderCommandError };

const reminderCommandNames: ReadonlySet<string> = new Set([
  "remind",
  "reminders",
  "unremind",
]);

export const parseReminderCommand = (
  update: TelegramUpdateEnvelope,
): ReminderCommandResult | null => {
  const name = update.command?.name;

  if (!name || !reminderCommandNames.has(name)) {
    return null;
  }

  const args = update.command?.args ?? [];

  if (name === "reminders") {
    return { ok: true, command: { kind: "list" } };
  }

  if (name === "unremind") {
    const reminderId = args[0];
    return reminderId
      ? { ok: true, command: { kind: "cancel", reminderId } }
      : {
          ok: false,
          error: { code: "id-required", usage: "Uso: /unremind <id>" },
        };
  }

  const minutes = Number.parseInt(args[0] ?? "", 10);
  const text = args.slice(1).join(" ").trim();

  if (
    !Number.isInteger(minutes) ||
    minutes < 1 ||
    minutes > 525_600 ||
    text.length === 0
  ) {
    return {
      ok: false,
      error: {
        code: "format",
        usage: "Uso: /remind <minutos> <texto>",
      },
    };
  }

  return { ok: true, command: { kind: "create", minutes, text } };
};

export type TaskCommand =
  | { readonly kind: "create"; readonly title: string }
  | { readonly kind: "list" }
  | { readonly kind: "done"; readonly taskId: string };

export interface TaskCommandError {
  readonly code: "title-required" | "id-required";
  readonly usage: string;
}

export type TaskCommandResult =
  | { readonly ok: true; readonly command: TaskCommand }
  | { readonly ok: false; readonly error: TaskCommandError };

const taskCommandNames: ReadonlySet<string> = new Set([
  "task",
  "tasks",
  "taskdone",
]);

export const parseTaskCommand = (
  update: TelegramUpdateEnvelope,
): TaskCommandResult | null => {
  const name = update.command?.name;

  if (!name || !taskCommandNames.has(name)) {
    return null;
  }

  const args = update.command?.args ?? [];

  if (name === "tasks") {
    return { ok: true, command: { kind: "list" } };
  }

  if (name === "taskdone") {
    const taskId = args[0];
    return taskId
      ? { ok: true, command: { kind: "done", taskId } }
      : {
          ok: false,
          error: { code: "id-required", usage: "Uso: /taskdone <id>" },
        };
  }

  const title = args.join(" ").trim();
  return title
    ? { ok: true, command: { kind: "create", title } }
    : {
        ok: false,
        error: { code: "title-required", usage: "Uso: /task <titulo>" },
      };
};

export const reminderRunAtMs = (nowMs: number, minutes: number): number =>
  nowMs + minutes * 60_000;

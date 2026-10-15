import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type TicketPriority = "low" | "normal" | "high" | "urgent";

export const ticketPriorities: readonly TicketPriority[] = [
  "low",
  "normal",
  "high",
  "urgent",
];

export type TicketCommand =
  | {
      readonly kind: "create";
      readonly subject: string;
      readonly priority: TicketPriority;
    }
  | { readonly kind: "list" }
  | { readonly kind: "close"; readonly ticketId: string }
  | { readonly kind: "reopen"; readonly ticketId: string }
  | {
      readonly kind: "assign";
      readonly ticketId: string;
      readonly assigneeTelegramId: bigint;
    };

export interface TicketCommandError {
  readonly code: "subject-required" | "id-required" | "assignee-required";
  readonly usage: string;
}

export type TicketCommandResult =
  | { readonly ok: true; readonly command: TicketCommand }
  | { readonly ok: false; readonly error: TicketCommandError };

const ticketCommandNames: ReadonlySet<string> = new Set([
  "ticket",
  "tickets",
  "ticketclose",
  "ticketreopen",
  "ticketassign",
]);

const priorityFromToken = (value: string | undefined): TicketPriority => {
  const lower = (value ?? "").toLowerCase();
  return ticketPriorities.includes(lower as TicketPriority)
    ? (lower as TicketPriority)
    : "normal";
};

const parseId = (value: string | undefined): bigint | undefined => {
  if (!value || !/^-?\d+$/u.test(value)) {
    return undefined;
  }
  return BigInt(value);
};

export const parseTicketCommand = (
  update: TelegramUpdateEnvelope,
): TicketCommandResult | null => {
  const name = update.command?.name;

  if (!name || !ticketCommandNames.has(name)) {
    return null;
  }

  const args = update.command?.args ?? [];

  if (name === "tickets") {
    return { ok: true, command: { kind: "list" } };
  }

  if (name === "ticketclose" || name === "ticketreopen") {
    const ticketId = args[0];
    if (!ticketId) {
      return {
        ok: false,
        error: {
          code: "id-required",
          usage: `Uso: /${name} <ticket_id>`,
        },
      };
    }
    return {
      ok: true,
      command:
        name === "ticketclose"
          ? { kind: "close", ticketId }
          : { kind: "reopen", ticketId },
    };
  }

  if (name === "ticketassign") {
    const ticketId = args[0];
    const assigneeTelegramId = parseId(args[1]);
    if (!ticketId) {
      return {
        ok: false,
        error: {
          code: "id-required",
          usage: "Uso: /ticketassign <ticket_id> <telegram_user_id>",
        },
      };
    }
    if (!assigneeTelegramId) {
      return {
        ok: false,
        error: {
          code: "assignee-required",
          usage: "Uso: /ticketassign <ticket_id> <telegram_user_id>",
        },
      };
    }
    return {
      ok: true,
      command: { kind: "assign", ticketId, assigneeTelegramId },
    };
  }

  // /ticket [priority] subject... — an optional leading priority token.
  const [maybePriority, ...rest] = args;
  const hasPriority =
    maybePriority !== undefined &&
    ticketPriorities.includes(maybePriority.toLowerCase() as TicketPriority);
  const priority = hasPriority ? priorityFromToken(maybePriority) : "normal";
  const subject = (hasPriority ? rest : args).join(" ").trim();

  if (!subject) {
    return {
      ok: false,
      error: {
        code: "subject-required",
        usage: "Uso: /ticket [low|normal|high|urgent] <asunto>",
      },
    };
  }

  return { ok: true, command: { kind: "create", subject, priority } };
};

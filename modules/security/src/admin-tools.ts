import type { TelegramUpdateEnvelope } from "@superbot/domain";

export interface ReplyContext {
  readonly messageId: number | undefined;
  readonly userId: bigint | undefined;
  readonly username: string | undefined;
}

export type AdminToolCommand =
  | { readonly kind: "pin"; readonly messageId: number }
  | { readonly kind: "unpin" }
  | { readonly kind: "del"; readonly messageId: number }
  | { readonly kind: "settitle"; readonly title: string }
  | { readonly kind: "setdesc"; readonly description: string }
  | {
      readonly kind: "promote";
      readonly userId: bigint;
      readonly title: string | undefined;
    }
  | { readonly kind: "demote"; readonly userId: bigint }
  | { readonly kind: "invitelink" }
  | { readonly kind: "admins" };

export interface AdminToolCommandError {
  readonly code: "format";
  readonly usage: string;
}

export type AdminToolCommandResult =
  | { readonly ok: true; readonly command: AdminToolCommand }
  | { readonly ok: false; readonly error: AdminToolCommandError };

export interface ChatAdmin {
  readonly userId: bigint;
  readonly username: string | undefined;
  readonly firstName: string | undefined;
  readonly isOwner: boolean;
  readonly customTitle: string | undefined;
}

const adminToolCommandNames: ReadonlySet<string> = new Set([
  "pin",
  "unpin",
  "del",
  "settitle",
  "setdesc",
  "promote",
  "demote",
  "invitelink",
  "admins",
]);

const digitsPattern = /^\d+$/;

const emptyReplyContext: ReplyContext = {
  messageId: undefined,
  userId: undefined,
  username: undefined,
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;

const formatError = (usage: string): AdminToolCommandResult => ({
  ok: false,
  error: { code: "format", usage },
});

/**
 * Extracts the reply target from a raw Telegram update, navigating
 * `raw.message.reply_to_message.{message_id, from.{id, username}}` with
 * explicit type checks. Any missing or malformed level yields `undefined`
 * fields instead of throwing. Pure and deterministic.
 */
export const extractReplyContext = (raw: unknown): ReplyContext => {
  const message = asRecord(asRecord(raw)?.message);
  const reply = asRecord(message?.reply_to_message);

  if (!reply) {
    return emptyReplyContext;
  }

  const rawMessageId = reply.message_id;
  const messageId =
    typeof rawMessageId === "number" && Number.isInteger(rawMessageId)
      ? rawMessageId
      : undefined;

  const from = asRecord(reply.from);
  const rawUserId = from?.id;
  const userId =
    typeof rawUserId === "bigint"
      ? rawUserId
      : typeof rawUserId === "number" && Number.isInteger(rawUserId)
        ? BigInt(rawUserId)
        : undefined;

  const rawUsername = from?.username;
  const username =
    typeof rawUsername === "string" && rawUsername.length > 0
      ? rawUsername
      : undefined;

  return { messageId, userId, username };
};

/**
 * Extracts a `text_mention` target: when an admin picks a user from the mention
 * autocomplete, Telegram embeds the user id in a `text_mention` entity (used for
 * users without a public @username). Returns the first such id, or undefined.
 * A plain typed `@username` is a `mention` entity with no id — resolved elsewhere.
 */
export const extractMentionTargetId = (raw: unknown): bigint | undefined => {
  const message = asRecord(asRecord(raw)?.message);
  const entities = message?.entities;
  if (!Array.isArray(entities)) {
    return undefined;
  }
  for (const entity of entities) {
    const parsed = asRecord(entity);
    if (parsed?.type !== "text_mention") {
      continue;
    }
    const id = asRecord(parsed.user)?.id;
    if (typeof id === "bigint") {
      return id;
    }
    if (typeof id === "number" && Number.isInteger(id)) {
      return BigInt(id);
    }
  }
  return undefined;
};

const resolveTargetUserId = (
  reply: ReplyContext,
  firstArg: string | undefined,
): { userId: bigint; titleArgsOffset: number } | undefined => {
  if (reply.userId !== undefined) {
    return { userId: reply.userId, titleArgsOffset: 0 };
  }

  if (firstArg !== undefined && digitsPattern.test(firstArg)) {
    return { userId: BigInt(firstArg), titleArgsOffset: 1 };
  }

  return undefined;
};

/**
 * Parses group admin tool commands: /pin, /unpin, /del, /settitle, /setdesc,
 * /promote, /demote, /invitelink and /admins. Returns null when the update
 * carries none of these commands, a format error with usage text when the
 * arguments are invalid, and a discriminated `AdminToolCommand` otherwise.
 * Reply-based targets (/pin, /del, /promote, /demote) are resolved with
 * `extractReplyContext(update.raw)`. Pure and deterministic.
 */
export const parseAdminToolCommand = (
  update: TelegramUpdateEnvelope,
): AdminToolCommandResult | null => {
  const name = update.command?.name;

  if (!name || !adminToolCommandNames.has(name)) {
    return null;
  }

  const args = update.command?.args ?? [];
  const reply = extractReplyContext(update.raw);

  switch (name) {
    case "pin": {
      if (reply.messageId === undefined) {
        return formatError("Responde a un mensaje con /pin");
      }
      return { ok: true, command: { kind: "pin", messageId: reply.messageId } };
    }
    case "unpin":
      return { ok: true, command: { kind: "unpin" } };
    case "del": {
      if (reply.messageId === undefined) {
        return formatError("Responde a un mensaje con /del");
      }
      return { ok: true, command: { kind: "del", messageId: reply.messageId } };
    }
    case "settitle": {
      const title = args.join(" ").trim();
      if (title.length < 1 || title.length > 128) {
        return formatError("Uso: /settitle <titulo de 1 a 128 caracteres>");
      }
      return { ok: true, command: { kind: "settitle", title } };
    }
    case "setdesc": {
      const description = args.join(" ").trim();
      if (description.length < 1 || description.length > 255) {
        return formatError("Uso: /setdesc <descripcion de 1 a 255 caracteres>");
      }
      return { ok: true, command: { kind: "setdesc", description } };
    }
    case "promote": {
      const target = resolveTargetUserId(reply, args[0]);
      if (!target) {
        return formatError(
          "Uso: /promote <user_id> [titulo] o responde a un mensaje con /promote [titulo]",
        );
      }
      const rawTitle = args.slice(target.titleArgsOffset).join(" ").trim();
      const title = rawTitle.length > 0 ? rawTitle.slice(0, 16) : undefined;
      return {
        ok: true,
        command: { kind: "promote", userId: target.userId, title },
      };
    }
    case "demote": {
      const target = resolveTargetUserId(reply, args[0]);
      if (!target) {
        return formatError(
          "Uso: /demote <user_id> o responde a un mensaje con /demote",
        );
      }
      return { ok: true, command: { kind: "demote", userId: target.userId } };
    }
    case "invitelink":
      return { ok: true, command: { kind: "invitelink" } };
    case "admins":
      return { ok: true, command: { kind: "admins" } };
    default:
      return null;
  }
};

/**
 * Formats the group admin list as user-facing Spanish text. Header plus one
 * bullet per admin: crown for the owner only, `(@username)` when available and
 * `— titulo` when a custom title is set. Empty input yields a fallback
 * message. Pure and deterministic.
 */
export const formatAdminList = (admins: readonly ChatAdmin[]): string => {
  if (admins.length === 0) {
    return "No pude obtener la lista de administradores.";
  }

  const lines = admins.map((admin): string => {
    const crown = admin.isOwner ? "\u{1F451} " : "";
    const name = admin.firstName ?? admin.username ?? `Usuario ${admin.userId}`;
    const usernamePart = admin.username ? ` (@${admin.username})` : "";
    const titlePart = admin.customTitle ? ` — ${admin.customTitle}` : "";
    return `• ${crown}${name}${usernamePart}${titlePart}`;
  });

  return ["\u{1F46E} Administradores del grupo:", ...lines].join("\n");
};

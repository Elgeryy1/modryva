import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";

export const LOCKABLE_TYPES = [
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

export type LockType = (typeof LOCKABLE_TYPES)[number];

const lockableSet: ReadonlySet<string> = new Set(LOCKABLE_TYPES);

export const isLockType = (value: string): value is LockType =>
  lockableSet.has(value);

const flagForLock = (type: LockType, content: MessageContentFlags): boolean => {
  switch (type) {
    case "text":
      return content.hasText;
    case "url":
      return content.hasUrl;
    case "mention":
      return content.hasMention;
    case "forward":
      return content.isForward;
    case "via_bot":
      return content.viaBot;
    case "photo":
      return content.hasPhoto;
    case "video":
      return content.hasVideo;
    case "gif":
      return content.hasAnimation;
    case "sticker":
      return content.hasSticker;
    case "audio":
      return content.hasAudio;
    case "voice":
      return content.hasVoice;
    case "document":
      return content.hasDocument;
    case "contact":
      return content.hasContact;
    case "location":
      return content.hasLocation;
    case "poll":
      return content.hasPoll;
    default:
      return false;
  }
};

/**
 * Returns the first locked content type present in the message, or null when no
 * locked type matches. Order follows {@link LOCKABLE_TYPES} for determinism.
 */
export const evaluateLocks = (
  content: MessageContentFlags,
  locked: readonly LockType[],
): LockType | null => {
  const lockedSet = new Set(locked);

  for (const type of LOCKABLE_TYPES) {
    if (lockedSet.has(type) && flagForLock(type, content)) {
      return type;
    }
  }

  return null;
};

export type LockCommand =
  | { readonly kind: "list" }
  | { readonly kind: "lock"; readonly types: readonly LockType[] }
  | { readonly kind: "unlock"; readonly types: readonly LockType[] };

export interface LockCommandError {
  readonly code: "invalid-type" | "type-required";
  readonly usage: string;
}

export type LockCommandResult =
  | { readonly ok: true; readonly command: LockCommand }
  | { readonly ok: false; readonly error: LockCommandError };

const lockCommandNames: ReadonlySet<string> = new Set([
  "lock",
  "unlock",
  "locks",
]);

const usage = `Tipos: ${LOCKABLE_TYPES.join(", ")}. Uso: /lock <tipo...>, /unlock <tipo...>, /locks`;

export const parseLockCommand = (
  update: TelegramUpdateEnvelope,
): LockCommandResult | null => {
  const name = update.command?.name;

  if (!name || !lockCommandNames.has(name)) {
    return null;
  }

  if (name === "locks") {
    return { ok: true, command: { kind: "list" } };
  }

  const rawTypes = (update.command?.args ?? []).map((value) =>
    value.toLowerCase(),
  );

  if (rawTypes.length === 0) {
    return { ok: false, error: { code: "type-required", usage } };
  }

  const invalid = rawTypes.find((value) => !isLockType(value));

  if (invalid) {
    return { ok: false, error: { code: "invalid-type", usage } };
  }

  const types = rawTypes.filter(isLockType);

  return {
    ok: true,
    command: { kind: name === "lock" ? "lock" : "unlock", types },
  };
};

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
} from "node:crypto";

/**
 * Session-token, nonce and query_id-encryption helpers for Guardian
 * Verification. Kept as pure functions (no I/O) so they are trivially unit
 * testable without a database or network access.
 */

/** Opaque, cryptographically-random bearer token embedded in the Mini App URL
 * (`/guardian/verify?session=<token>`). Never persisted in raw form. */
export const generateSessionToken = (): string =>
  randomBytes(32).toString("base64url");

/** SHA-256 hash of a session token — this is what gets persisted/looked up,
 * so a database read (or leaked log line) never reveals a usable token. */
export const hashSessionToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

/** Single-use nonce embedded in a challenge definition. */
export const generateChallengeNonce = (): string => randomUUID();

/** Deterministic key for "one active session per (chat, user)". Postgres
 * allows unlimited NULLs in a unique column, so this key is cleared to null
 * on resolution/expiry rather than needing a synthetic "still active" flag. */
export const computeSessionIdempotencyKey = (
  chatId: string,
  telegramUserId: bigint,
): string =>
  createHash("sha256")
    .update(`${chatId}:${telegramUserId.toString()}`)
    .digest("hex");

const AES_ALGORITHM = "aes-256-gcm";

const deriveKey = (secret: string): Buffer =>
  createHash("sha256").update(secret).digest();

/**
 * Encrypts the Bot API `chat_join_request.query_id` at rest (AES-256-GCM).
 * Packed as `iv:tag:ciphertext`, all base64url, so it survives a plain TEXT
 * column. `secret` should be GUARDIAN_SESSION_SECRET (or a dedicated key) —
 * never the Telegram bot token itself.
 */
export const encryptJoinRequestQueryId = (
  queryId: string,
  secret: string,
): string => {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv(AES_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(queryId, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
};

export type DecryptResult =
  | { readonly ok: true; readonly queryId: string }
  | { readonly ok: false; readonly error: "malformed" | "auth-failed" };

const decryptWithKey = (packed: string, secret: string): DecryptResult => {
  const parts = packed.split(":");
  if (parts.length !== 3) {
    return { ok: false, error: "malformed" };
  }
  const [ivPart, tagPart, ciphertextPart] = parts;
  if (!ivPart || !tagPart || !ciphertextPart) {
    return { ok: false, error: "malformed" };
  }
  try {
    const key = deriveKey(secret);
    const iv = Buffer.from(ivPart, "base64url");
    const tag = Buffer.from(tagPart, "base64url");
    const ciphertext = Buffer.from(ciphertextPart, "base64url");
    const decipher = createDecipheriv(AES_ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return { ok: true, queryId: plaintext.toString("utf8") };
  } catch {
    return { ok: false, error: "auth-failed" };
  }
};

/**
 * Decrypts a stored `chat_join_request.query_id`. `secret` is the primary
 * GUARDIAN_SESSION_SECRET. `previousSecret`, when supplied, is a decrypt-only
 * fallback for a rotation window: a value encrypted before the secret was
 * rotated still authenticates under the old key, so an in-flight join request
 * is never left undecryptable mid-rotation. It is tried ONLY on a cryptographic
 * auth failure (a malformed string is malformed under any key). The primary
 * result — including its error variant — is what surfaces when both fail, so
 * the fallback never becomes an oracle for which key matched. Once the previous
 * secret is removed, values encrypted with it stop decrypting (fail closed).
 */
export const decryptJoinRequestQueryId = (
  packed: string,
  secret: string,
  previousSecret?: string,
): DecryptResult => {
  const primary = decryptWithKey(packed, secret);
  if (primary.ok) {
    return primary;
  }
  if (primary.error === "auth-failed" && previousSecret !== undefined) {
    const previous = decryptWithKey(packed, previousSecret);
    if (previous.ok) {
      return previous;
    }
  }
  return primary;
};

/** HMAC-signed short-lived callback token for STAFF inline buttons, so
 * callback_data stays short + opaque while still being unforgeable without
 * GUARDIAN_SESSION_SECRET. Distinct from the session bearer token. */
export const signStaffCallbackId = (
  sessionId: string,
  action: string,
  secret: string,
): string => {
  const mac = createHmac("sha256", secret)
    .update(`${sessionId}:${action}`)
    .digest("base64url")
    .slice(0, 16);
  return mac;
};

export const verifyStaffCallbackId = (
  sessionId: string,
  action: string,
  candidate: string,
  secret: string,
): boolean => {
  const expected = signStaffCallbackId(sessionId, action, secret);
  if (expected.length !== candidate.length) {
    return false;
  }
  // Constant-time comparison over short opaque tokens.
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ candidate.charCodeAt(i);
  }
  return diff === 0;
};

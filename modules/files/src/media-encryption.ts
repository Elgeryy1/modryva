import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { ObjectStorageDriver, PutObjectInput } from "./object-storage.js";

/**
 * At-rest encryption for Guardian's captured media (AES-256-GCM), wrapping
 * ANY ObjectStorageDriver — local filesystem or S3 — so a copy of the disk/
 * bucket alone is never enough to view a capture (rule: "nunca almacenar
 * capturas sin proteger"). Same algorithm/packing convention as
 * session-crypto.ts's query_id encryption, just packed as raw bytes instead
 * of a `:`-joined base64url string since this wraps binary media, not text.
 *
 * Format on disk/bucket: `iv (12 bytes) || authTag (16 bytes) || ciphertext`.
 */

const AES_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const deriveKey = (secret: string): Buffer =>
  createHash("sha256").update(secret).digest();

export const encryptMediaBuffer = (data: Buffer, secret: string): Buffer => {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(AES_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]);
};

export type DecryptMediaResult =
  | { readonly ok: true; readonly data: Buffer }
  | { readonly ok: false; readonly error: "malformed" | "auth-failed" };

export const decryptMediaBuffer = (
  packed: Buffer,
  secret: string,
): DecryptMediaResult => {
  if (packed.length < IV_LENGTH + TAG_LENGTH) {
    return { ok: false, error: "malformed" };
  }
  const iv = packed.subarray(0, IV_LENGTH);
  const tag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH);
  try {
    const key = deriveKey(secret);
    const decipher = createDecipheriv(AES_ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return { ok: true, data: plaintext };
  } catch {
    return { ok: false, error: "auth-failed" };
  }
};

/**
 * Transparent encrypting decorator around any ObjectStorageDriver — callers
 * (upload endpoint, STAFF media download, retention cleanup) don't need to
 * know encryption is happening; `put` encrypts, `get` decrypts, `delete`/
 * `exists` pass straight through since they never touch plaintext.
 */
export class EncryptingObjectStorageDriver implements ObjectStorageDriver {
  /**
   * @param primary  Key for ALL new writes and the first read attempt.
   * @param previous Optional decrypt-only fallback, present ONLY during a key
   *   rotation window. A read that fails AUTHENTICATION under `primary` is
   *   retried under `previous`, so objects written before the switch keep
   *   decrypting; once `previous` is removed those objects fail closed. Never
   *   used for writes. See docs/INCIDENT-ROTATION-AND-DEPLOY-2026-07-17.md.
   */
  constructor(
    private readonly inner: ObjectStorageDriver,
    private readonly primary: string,
    private readonly previous?: string,
  ) {}

  get kind(): ObjectStorageDriver["kind"] {
    return this.inner.kind;
  }

  async put(input: PutObjectInput): Promise<void> {
    // Writes ALWAYS use the primary key — never the rotation fallback.
    await this.inner.put({
      ...input,
      data: encryptMediaBuffer(input.data, this.primary),
    });
  }

  async get(key: string): Promise<Buffer | null> {
    const encrypted = await this.inner.get(key);
    if (!encrypted) {
      return null;
    }
    const primary = decryptMediaBuffer(encrypted, this.primary);
    if (primary.ok) {
      return primary.data;
    }
    // Retry with the previous key ONLY on a cryptographic auth failure — a
    // structurally malformed object is malformed under every key, so there is
    // nothing a second key can fix. During a rotation `previous` still decrypts
    // objects written before the switch; once it is removed those objects fail
    // closed. Both branches return null, so the fallback is never observable to
    // the caller (no decryption oracle).
    if (primary.error === "auth-failed" && this.previous !== undefined) {
      const previous = decryptMediaBuffer(encrypted, this.previous);
      if (previous.ok) {
        return previous.data;
      }
    }
    // Never surface ciphertext or throw a decoding crash to the caller — treat
    // an undecryptable object the same as "not found" so a wrong/rotated key
    // fails closed rather than leaking garbage bytes.
    return null;
  }

  async delete(key: string): Promise<void> {
    await this.inner.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.inner.exists(key);
  }
}

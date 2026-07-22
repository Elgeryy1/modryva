import {
  decryptManagedBotToken,
  encryptManagedBotToken,
} from "./platform-repository.js";

/**
 * Transactional, resumable re-encryption of `managed_bots.encryptedToken` from
 * an old MANAGED_BOT_TOKEN_KEY to a new one, for a supervised key rotation.
 *
 * Safety contract (see docs/INCIDENT-ROTATION-AND-DEPLOY-2026-07-17.md):
 * - Resumable / idempotent: a row already decryptable under the NEW key is left
 *   untouched, so re-running after a partial failure only finishes the rest and
 *   a completed migration is a pure no-op.
 * - All-or-nothing: any undecryptable row, or any failed liveness check, throws
 *   so the caller's surrounding transaction rolls the whole batch back — a run
 *   never leaves the table half-migrated.
 * - Secret-safe: it never returns, logs or embeds a decrypted token in its
 *   summary or its error messages (errors carry a row id, never a token).
 * - The pure core here decides NOTHING about which database it runs against —
 *   the CLI wrapper owns that, so this stays trivially unit-testable.
 */

export interface ManagedTokenRow {
  readonly id: string;
  readonly encryptedToken: string;
}

/** Minimal transactional surface the re-encryption needs — satisfied by a
 * Prisma `$transaction` client in the CLI and by an in-memory fake in tests. */
export interface ManagedTokenReencryptTx {
  listEncryptedTokenRows(): Promise<readonly ManagedTokenRow[]>;
  updateEncryptedToken(id: string, encryptedToken: string): Promise<void>;
}

export interface ManagedTokenReencryptOptions {
  readonly oldKey: string;
  readonly newKey: string;
  /** When true, decrypt and plan only — no `updateEncryptedToken` calls. */
  readonly dryRun: boolean;
  /** Optional liveness check (e.g. Telegram getMe). Receives the PLAINTEXT
   * token and MUST NOT log it; a false result aborts the whole batch. */
  readonly verifyToken?: (token: string) => Promise<boolean>;
}

export interface ManagedTokenReencryptSummary {
  readonly total: number;
  /** Rows already decryptable with the new key (skipped — idempotent re-run). */
  readonly alreadyMigrated: number;
  /** Rows actually re-encrypted to the new key (0 in a dry run). */
  readonly reencrypted: number;
  /** Rows that WOULD be re-encrypted (dry-run preview; 0 in a real run). */
  readonly pending: number;
  /** Rows whose plaintext passed `verifyToken` (0 when no verifier supplied). */
  readonly verified: number;
}

const tryDecrypt = (ciphertext: string, key: string): string | null => {
  try {
    return decryptManagedBotToken(ciphertext, key);
  } catch {
    return null;
  }
};

export const reencryptManagedBotTokens = async (
  tx: ManagedTokenReencryptTx,
  options: ManagedTokenReencryptOptions,
): Promise<ManagedTokenReencryptSummary> => {
  if (!options.oldKey || !options.newKey) {
    throw new Error("reencrypt-missing-key");
  }
  if (options.oldKey === options.newKey) {
    throw new Error("reencrypt-old-equals-new-key");
  }

  const rows = await tx.listEncryptedTokenRows();
  let alreadyMigrated = 0;
  let reencrypted = 0;
  let pending = 0;
  let verified = 0;

  for (const row of rows) {
    // Try the NEW key first: a row already on the new key must never be
    // touched (idempotent resume) and must not require the old key at all.
    const underNew = tryDecrypt(row.encryptedToken, options.newKey);
    const plaintext =
      underNew ?? tryDecrypt(row.encryptedToken, options.oldKey);
    if (plaintext === null) {
      // Decryptable under neither key — abort so nothing is half-migrated.
      // The row id is safe to surface; the token is not, and never is.
      throw new Error(`reencrypt-undecryptable-row:${row.id}`);
    }

    if (options.verifyToken) {
      const ok = await options.verifyToken(plaintext);
      if (!ok) {
        throw new Error(`reencrypt-verify-failed-row:${row.id}`);
      }
      verified += 1;
    }

    if (underNew !== null) {
      alreadyMigrated += 1;
      continue;
    }
    if (options.dryRun) {
      pending += 1;
      continue;
    }
    await tx.updateEncryptedToken(
      row.id,
      encryptManagedBotToken(plaintext, options.newKey),
    );
    reencrypted += 1;
  }

  return {
    total: rows.length,
    alreadyMigrated,
    reencrypted,
    pending,
    verified,
  };
};

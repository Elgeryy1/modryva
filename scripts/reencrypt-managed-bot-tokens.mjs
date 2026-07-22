import { PrismaClient } from "@prisma/client";
import { reencryptManagedBotTokens } from "@superbot/data";
import { config as loadDotenv } from "dotenv";

loadDotenv();

/**
 * Supervised re-encryption of managed_bots.encryptedToken for a
 * MANAGED_BOT_TOKEN_KEY rotation. See docs/INCIDENT-ROTATION-AND-DEPLOY-2026-07-17.md.
 *
 * Keys come ONLY from the environment (never CLI args / shell history / logs):
 *   MANAGED_BOT_TOKEN_KEY       — the CURRENT (old) key, still active in .env.
 *   MANAGED_BOT_TOKEN_KEY_NEW   — the new key to migrate to.
 *
 * Flags:
 *   (default)  DRY RUN — decrypt + plan only, writes nothing.
 *   --apply    perform the re-encryption inside a single transaction.
 *   --verify   liveness-check each token with Telegram getMe (the token rides
 *              the HTTPS request path per Telegram's API contract; it is never
 *              logged, printed, or placed in a shell argument). A failed check
 *              aborts and rolls back the whole batch.
 *
 * Prints COUNTS only — never a token, plaintext, ciphertext, or key value.
 * Idempotent + resumable: a re-run after a partial failure only finishes the
 * rest; a completed migration is a no-op. Point DATABASE_URL at the target DB.
 */

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const verify = args.includes("--verify");

const oldKey = process.env.MANAGED_BOT_TOKEN_KEY?.trim() ?? "";
const newKey = process.env.MANAGED_BOT_TOKEN_KEY_NEW?.trim() ?? "";

const die = (msg) => {
  // Never echoes key values — only the reason.
  console.error(`reencrypt: ${msg}`);
  process.exit(1);
};

if (!oldKey) die("MANAGED_BOT_TOKEN_KEY (current/old key) is not set");
if (!newKey) die("MANAGED_BOT_TOKEN_KEY_NEW (new key) is not set");
if (oldKey === newKey)
  die("MANAGED_BOT_TOKEN_KEY_NEW must differ from MANAGED_BOT_TOKEN_KEY");

const verifyToken = verify
  ? async (token) => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        if (!res.ok) return false;
        const body = await res.json();
        return body?.ok === true;
      } catch {
        return false;
      }
    }
  : undefined;

const prisma = new PrismaClient();

try {
  console.log(
    `reencrypt: mode=${apply ? "APPLY" : "DRY-RUN"} verify=${verify ? "on" : "off"}`,
  );
  const summary = await prisma.$transaction(
    async (tx) =>
      reencryptManagedBotTokens(
        {
          listEncryptedTokenRows: async () => {
            const rows = await tx.managedBot.findMany({
              where: { encryptedToken: { not: null } },
              select: { id: true, encryptedToken: true },
            });
            return rows.map((r) => ({
              id: r.id,
              encryptedToken: r.encryptedToken,
            }));
          },
          updateEncryptedToken: async (id, encryptedToken) => {
            await tx.managedBot.update({
              where: { id },
              data: { encryptedToken },
            });
          },
        },
        { oldKey, newKey, dryRun: !apply, verifyToken },
      ),
    { timeout: 60_000 },
  );

  // COUNTS ONLY — no token/plaintext/ciphertext/key ever printed.
  console.log(
    `reencrypt: total=${summary.total} alreadyMigrated=${summary.alreadyMigrated} ` +
      `reencrypted=${summary.reencrypted} pending=${summary.pending} verified=${summary.verified}`,
  );
  if (!apply && summary.pending > 0) {
    console.log(
      `reencrypt: DRY-RUN — re-run with --apply to migrate ${summary.pending} row(s).`,
    );
  }
} catch (err) {
  // Error messages carry a row id at most — never a token value.
  die(err instanceof Error ? err.message : String(err));
} finally {
  await prisma.$disconnect();
}

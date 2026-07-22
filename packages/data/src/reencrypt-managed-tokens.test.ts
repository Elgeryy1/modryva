import { describe, expect, it } from "vitest";
import {
  decryptManagedBotToken,
  encryptManagedBotToken,
} from "./platform-repository.js";
import {
  type ManagedTokenReencryptOptions,
  reencryptManagedBotTokens,
} from "./reencrypt-managed-tokens.js";

const OLD_KEY = "old-managed-bot-token-key-1234567890";
const NEW_KEY = "new-managed-bot-token-key-0987654321";
const THIRD_KEY = "unrelated-third-key-abcdefabcdefabcd";

// Fake store that models a Prisma $transaction: staged writes are committed
// only if the callback resolves; a throw discards them (rollback).
const makeStore = (initial: Record<string, string>) => {
  let committed = new Map(Object.entries(initial));
  return {
    snapshot: (): Record<string, string> => Object.fromEntries(committed),
    async run(
      options: ManagedTokenReencryptOptions,
    ): ReturnType<typeof reencryptManagedBotTokens> {
      const staged = new Map(committed);
      const summary = await reencryptManagedBotTokens(
        {
          listEncryptedTokenRows: async () =>
            [...staged].map(([id, encryptedToken]) => ({ id, encryptedToken })),
          updateEncryptedToken: async (id, ct) => {
            staged.set(id, ct);
          },
        },
        options,
      );
      committed = staged; // commit only on success
      return summary;
    },
  };
};

describe("reencryptManagedBotTokens", () => {
  it("re-encrypts old-key rows to the new key (success)", async () => {
    const store = makeStore({
      a: encryptManagedBotToken("111:token-a", OLD_KEY),
      b: encryptManagedBotToken("222:token-b", OLD_KEY),
    });

    const summary = await store.run({
      oldKey: OLD_KEY,
      newKey: NEW_KEY,
      dryRun: false,
    });

    expect(summary).toMatchObject({
      total: 2,
      reencrypted: 2,
      alreadyMigrated: 0,
      pending: 0,
    });
    const snap = store.snapshot();
    // Now decrypt with the NEW key, and NOT with the old one.
    expect(decryptManagedBotToken(snap.a!, NEW_KEY)).toBe("111:token-a");
    expect(() => decryptManagedBotToken(snap.a!, OLD_KEY)).toThrow();
  });

  it("is a no-op for rows already on the new key", async () => {
    const store = makeStore({
      a: encryptManagedBotToken("111:token-a", NEW_KEY),
    });
    const before = store.snapshot();

    const summary = await store.run({
      oldKey: OLD_KEY,
      newKey: NEW_KEY,
      dryRun: false,
    });

    expect(summary).toMatchObject({ alreadyMigrated: 1, reencrypted: 0 });
    expect(store.snapshot()).toEqual(before); // untouched
  });

  it("plans without writing in dry-run", async () => {
    const store = makeStore({
      a: encryptManagedBotToken("111:token-a", OLD_KEY),
    });
    const before = store.snapshot();

    const summary = await store.run({
      oldKey: OLD_KEY,
      newKey: NEW_KEY,
      dryRun: true,
    });

    expect(summary).toMatchObject({ pending: 1, reencrypted: 0 });
    expect(store.snapshot()).toEqual(before); // nothing written
  });

  it("is idempotent across repeated runs", async () => {
    const store = makeStore({
      a: encryptManagedBotToken("111:token-a", OLD_KEY),
      b: encryptManagedBotToken("222:token-b", OLD_KEY),
    });

    const first = await store.run({
      oldKey: OLD_KEY,
      newKey: NEW_KEY,
      dryRun: false,
    });
    const afterFirst = store.snapshot();
    const second = await store.run({
      oldKey: OLD_KEY,
      newKey: NEW_KEY,
      dryRun: false,
    });

    expect(first).toMatchObject({ reencrypted: 2 });
    expect(second).toMatchObject({ alreadyMigrated: 2, reencrypted: 0 });
    expect(store.snapshot()).toEqual(afterFirst); // stable
  });

  it("aborts and rolls back when a row decrypts under neither key", async () => {
    const store = makeStore({
      a: encryptManagedBotToken("111:token-a", OLD_KEY),
      bad: encryptManagedBotToken("333:token-bad", THIRD_KEY),
    });
    const before = store.snapshot();

    await expect(
      store.run({ oldKey: OLD_KEY, newKey: NEW_KEY, dryRun: false }),
    ).rejects.toThrow(/reencrypt-undecryptable-row/);
    // Whole batch rolled back — row "a" was NOT migrated either.
    expect(store.snapshot()).toEqual(before);
  });

  it("rolls back every row when a liveness check fails", async () => {
    const store = makeStore({
      a: encryptManagedBotToken("111:token-a", OLD_KEY),
      b: encryptManagedBotToken("222:token-b", OLD_KEY),
    });
    const before = store.snapshot();
    let calls = 0;

    await expect(
      store.run({
        oldKey: OLD_KEY,
        newKey: NEW_KEY,
        dryRun: false,
        // Passes the first row, fails the second → aborts the whole batch.
        verifyToken: async () => {
          calls += 1;
          return calls === 1;
        },
      }),
    ).rejects.toThrow(/reencrypt-verify-failed-row/);
    expect(store.snapshot()).toEqual(before); // including row "a"
  });

  it("refuses an old key equal to the new key", async () => {
    const store = makeStore({
      a: encryptManagedBotToken("111:token-a", OLD_KEY),
    });
    await expect(
      store.run({ oldKey: NEW_KEY, newKey: NEW_KEY, dryRun: false }),
    ).rejects.toThrow(/reencrypt-old-equals-new-key/);
  });

  it("never leaks a plaintext token in the summary or error messages", async () => {
    const token = "999:super-secret-plaintext-token-value";
    const store = makeStore({
      good: encryptManagedBotToken(token, OLD_KEY),
      bad: encryptManagedBotToken("000:another", THIRD_KEY),
    });

    const err = await store
      .run({ oldKey: OLD_KEY, newKey: NEW_KEY, dryRun: false })
      .then(() => null)
      .catch((e: unknown) => e as Error);

    expect(err).toBeInstanceOf(Error);
    expect(err?.message).not.toContain(token);
    expect(err?.message).not.toContain("super-secret");
  });
});

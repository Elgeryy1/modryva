import { InMemoryGuardianRepository } from "@superbot/data";
import { hashSessionToken } from "@superbot/module-guardian";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type GuardianRequest,
  GuardianSessionGuard,
} from "./guardian-session.guard.js";

const RAW_SESSION_TOKEN = "raw-token";

/**
 * Covers ONLY the dev-only test bypass (GUARDIAN_TEST_MODE) — the real
 * initData path needs a live bot-token/HMAC chain this suite doesn't stand
 * up. The bypass is the newer, safety-critical piece: it must be
 * unreachable unless THREE independent things are all true at once.
 */

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.GUARDIAN_TEST_MODE = "1";
  process.env.NODE_ENV = "test";
});

afterEach(() => {
  process.env = { ...originalEnv };
});

/** NestJS HttpExceptions built with an object body (as this guard does) keep
 * that body in `.getResponse()`, not `.message` — asserting against
 * `.message` would only ever see the generic HTTP status text. */
const expectRejectsWithError = async (
  promise: Promise<unknown>,
  expectedError: string,
): Promise<void> => {
  let caught: { getResponse: () => { error?: string } } | undefined;
  try {
    await promise;
  } catch (err) {
    caught = err as { getResponse: () => { error?: string } };
  }
  expect(caught).toBeDefined();
  expect(caught?.getResponse().error).toBe(expectedError);
};

const fakeExecutionContext = (
  headers: Record<string, string>,
): { switchToHttp: () => { getRequest: () => GuardianRequest } } => {
  const request: GuardianRequest = { headers };
  return { switchToHttp: () => ({ getRequest: () => request }) };
};

const buildGuardWithSession = async (telegramUserId: bigint) => {
  const repo = new InMemoryGuardianRepository();
  const session = await repo.createSession({
    tenantId: "t1",
    chatId: "c1",
    telegramChatId: -100123n,
    telegramUserId,
    mode: "auto",
    challengeDefinition: { steps: [], nonce: "n", difficulty: "normal" },
    challengeNonce: "n",
    sessionTokenHash: hashSessionToken(RAW_SESSION_TOKEN),
    expiresAt: new Date(Date.now() + 60_000),
    idempotencyKey: "idem-1",
  });
  const guard = new GuardianSessionGuard();
  // The guard self-constructs a real PrismaGuardianRepository — swap it for
  // the in-memory test double, mirroring how other test suites in this repo
  // exploit constructor-time instantiation for test-friendliness.
  // biome-ignore lint/suspicious/noExplicitAny: overriding a private field for testing has no public API
  (guard as any).guardian = repo;
  return { guard, session };
};

describe("GuardianSessionGuard — dev test bypass", () => {
  it("authenticates via X-Guardian-Test-User when all three gates are satisfied", async () => {
    const { guard, session } = await buildGuardWithSession(555n);
    expect(session).not.toBeNull();

    const context = fakeExecutionContext({
      "x-guardian-session": "raw-token",
      "x-guardian-test-bypass": "1",
      "x-guardian-test-user": "555",
    });
    // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
    const allowed = await guard.canActivate(context as any);
    expect(allowed).toBe(true);
  });

  it("rejects when the test-user header doesn't match the session's real user", async () => {
    const { guard } = await buildGuardWithSession(555n);
    const context = fakeExecutionContext({
      "x-guardian-session": "raw-token",
      "x-guardian-test-bypass": "1",
      "x-guardian-test-user": "999",
    });
    // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
    await expect(guard.canActivate(context as any)).rejects.toThrow();
  });

  it("never activates the bypass without the explicit X-Guardian-Test-Bypass header, even in test mode", async () => {
    const { guard } = await buildGuardWithSession(555n);
    const context = fakeExecutionContext({
      "x-guardian-session": "raw-token",
      "x-guardian-test-user": "555",
      // no x-guardian-test-bypass header at all
    });
    // Falls through to requiring real initData, which is absent here.
    await expectRejectsWithError(
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      guard.canActivate(context as any),
      "missing-auth",
    );
  });

  it("never activates the bypass when GUARDIAN_TEST_MODE is off, even with the header set", async () => {
    process.env.GUARDIAN_TEST_MODE = "0";
    const { guard } = await buildGuardWithSession(555n);
    const context = fakeExecutionContext({
      "x-guardian-session": "raw-token",
      "x-guardian-test-bypass": "1",
      "x-guardian-test-user": "555",
    });
    await expectRejectsWithError(
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      guard.canActivate(context as any),
      "missing-auth",
    );
  });

  it("never activates the bypass when NODE_ENV is production, even with GUARDIAN_TEST_MODE=1", async () => {
    process.env.NODE_ENV = "production";
    const { guard } = await buildGuardWithSession(555n);
    const context = fakeExecutionContext({
      "x-guardian-session": "raw-token",
      "x-guardian-test-bypass": "1",
      "x-guardian-test-user": "555",
    });
    await expectRejectsWithError(
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      guard.canActivate(context as any),
      "missing-auth",
    );
  });

  it("still enforces session-not-found even when test mode is on", async () => {
    const repo = new InMemoryGuardianRepository();
    const guard = new GuardianSessionGuard();
    // biome-ignore lint/suspicious/noExplicitAny: overriding a private field for testing has no public API
    (guard as any).guardian = repo;
    const context = fakeExecutionContext({
      "x-guardian-session": "no-such-token",
      "x-guardian-test-bypass": "1",
      "x-guardian-test-user": "555",
    });
    await expectRejectsWithError(
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      guard.canActivate(context as any),
      "session-not-found",
    );
  });
});

describe("GuardianSessionGuard — per-user rate limit", () => {
  it("throttles a user after their burst, without affecting a different user on the same guard", async () => {
    const repo = new InMemoryGuardianRepository();
    const sessionA = await repo.createSession({
      tenantId: "t1",
      chatId: "c1",
      telegramChatId: -100123n,
      telegramUserId: 555n,
      mode: "auto",
      challengeDefinition: { steps: [], nonce: "n", difficulty: "normal" },
      challengeNonce: "n",
      sessionTokenHash: hashSessionToken("token-a"),
      expiresAt: new Date(Date.now() + 60_000),
      idempotencyKey: "idem-a",
    });
    const sessionB = await repo.createSession({
      tenantId: "t1",
      chatId: "c1",
      telegramChatId: -100124n,
      telegramUserId: 777n,
      mode: "auto",
      challengeDefinition: { steps: [], nonce: "n", difficulty: "normal" },
      challengeNonce: "n",
      sessionTokenHash: hashSessionToken("token-b"),
      expiresAt: new Date(Date.now() + 60_000),
      idempotencyKey: "idem-b",
    });
    expect(sessionA).not.toBeNull();
    expect(sessionB).not.toBeNull();
    const guard = new GuardianSessionGuard();
    // biome-ignore lint/suspicious/noExplicitAny: overriding a private field for testing has no public API
    (guard as any).guardian = repo;

    const contextA = fakeExecutionContext({
      "x-guardian-session": "token-a",
      "x-guardian-test-bypass": "1",
      "x-guardian-test-user": "555",
    });
    for (let i = 0; i < 20; i += 1) {
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      expect(await guard.canActivate(contextA as any)).toBe(true);
    }
    await expectRejectsWithError(
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      guard.canActivate(contextA as any),
      "rate-limited",
    );

    // Same guard instance, different user's session: independent budget.
    const contextB = fakeExecutionContext({
      "x-guardian-session": "token-b",
      "x-guardian-test-bypass": "1",
      "x-guardian-test-user": "777",
    });
    // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
    expect(await guard.canActivate(contextB as any)).toBe(true);
  });

  it("still enforces session-not-found before the rate limiter ever runs", async () => {
    const repo = new InMemoryGuardianRepository();
    const guard = new GuardianSessionGuard();
    // biome-ignore lint/suspicious/noExplicitAny: overriding a private field for testing has no public API
    (guard as any).guardian = repo;
    const context = fakeExecutionContext({
      "x-guardian-session": "no-such-token",
      "x-guardian-test-bypass": "1",
      "x-guardian-test-user": "555",
    });
    await expectRejectsWithError(
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      guard.canActivate(context as any),
      "session-not-found",
    );
  });
});

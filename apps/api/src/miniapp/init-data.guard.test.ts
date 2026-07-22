import crypto from "node:crypto";
import { InMemoryPlatformRepository } from "@superbot/data";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InitDataGuard, type MiniappRequest } from "./init-data.guard.js";

const BOT_TOKEN = "123456:test-token";

const signInitData = (raw: Record<string, string>, botToken: string) => {
  const dataCheckString = Object.entries(raw)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const hash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return new URLSearchParams({ ...raw, hash }).toString();
};

const initDataFor = (userId: number): string =>
  signInitData(
    {
      auth_date: String(Math.floor(Date.now() / 1000)),
      query_id: "query-1",
      user: JSON.stringify({ id: userId, username: `user${userId}` }),
    },
    BOT_TOKEN,
  );

const fakeExecutionContext = (
  headers: Record<string, string>,
): { switchToHttp: () => { getRequest: () => MiniappRequest } } => {
  const request: MiniappRequest = { headers };
  return { switchToHttp: () => ({ getRequest: () => request }) };
};

const buildGuard = () => {
  const guard = new InitDataGuard();
  const platform = new InMemoryPlatformRepository();
  // The guard lazily constructs a real PrismaPlatformRepository — swap it for
  // the in-memory test double before it's ever touched.
  // biome-ignore lint/suspicious/noExplicitAny: overriding a private field for testing has no public API
  (guard as any).platformRepo = platform;
  return { guard, platform };
};

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
  process.env.TELEGRAM_BOT_USERNAME = "testbot";
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("InitDataGuard — per-user rate limit", () => {
  it("allows a user's requests up to the burst, then 429s", async () => {
    const { guard } = buildGuard();
    const context = fakeExecutionContext({
      authorization: `tma ${initDataFor(42)}`,
    });

    for (let i = 0; i < 40; i += 1) {
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      expect(await guard.canActivate(context as any)).toBe(true);
    }

    let caught: { getResponse: () => { error?: string } } | undefined;
    try {
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      await guard.canActivate(context as any);
    } catch (err) {
      caught = err as { getResponse: () => { error?: string } };
    }
    expect(caught).toBeDefined();
    expect(caught?.getResponse().error).toBe("rate-limited");
  });

  it("keys are per-user, not shared", async () => {
    const { guard } = buildGuard();
    const contextA = fakeExecutionContext({
      authorization: `tma ${initDataFor(42)}`,
    });
    for (let i = 0; i < 40; i += 1) {
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      expect(await guard.canActivate(contextA as any)).toBe(true);
    }

    const contextB = fakeExecutionContext({
      authorization: `tma ${initDataFor(43)}`,
    });
    // A different user's bucket is untouched by user 42 exhausting theirs.
    // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
    expect(await guard.canActivate(contextB as any)).toBe(true);
  });

  it("short-circuits before the platform-ban check once the budget is spent", async () => {
    const { guard, platform } = buildGuard();
    const banSpy = vi.spyOn(platform, "getActivePlatformUserBan");
    const context = fakeExecutionContext({
      authorization: `tma ${initDataFor(42)}`,
    });

    for (let i = 0; i < 40; i += 1) {
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      await guard.canActivate(context as any);
    }
    banSpy.mockClear();

    let caught: { getResponse: () => { error?: string } } | undefined;
    try {
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      await guard.canActivate(context as any);
    } catch (err) {
      caught = err as { getResponse: () => { error?: string } };
    }
    expect(caught?.getResponse().error).toBe("rate-limited");
    expect(banSpy).not.toHaveBeenCalled();
  });
});

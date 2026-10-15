import { describe, expect, it, vi } from "vitest";
import { MiniappVisitInterceptor } from "./visit-tracker.interceptor.js";

/** The interceptor builds its own repository, so swap it for a spy — the same
 * constructor-time instantiation other suites in this repo exploit. */
const build = () => {
  const interceptor = new MiniappVisitInterceptor();
  const record = vi.fn(async (_input: Record<string, unknown>) => {});
  // biome-ignore lint/suspicious/noExplicitAny: overriding a private field for testing has no public API
  (interceptor as any).visits = { record };
  return { interceptor, record };
};

const request = (url: string, ip = "10.0.0.1", userId = "42") => ({
  url,
  headers: { "x-modryva-ip": ip },
  miniapp: {
    userId,
    user: { username: "dylansito2", first_name: "Dylan" },
    startParam: null,
    botUsername: "modryvabot",
    botToken: "t",
  },
});

const run = async (
  interceptor: MiniappVisitInterceptor,
  req: ReturnType<typeof request>,
) => {
  const context = {
    switchToHttp: () => ({ getRequest: () => req }),
    // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
  } as any;
  interceptor.intercept(context, { handle: () => ({}) as never });
  // record() is fired without awaiting so it never delays the response.
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("MiniappVisitInterceptor", () => {
  it("records a games request — the endpoint the app actually calls on open", async () => {
    // The original bug: only /v1/games/profile was hooked, and the games app
    // opens straight onto /v1/games/leaderboard, so nothing was ever recorded.
    const { interceptor, record } = build();
    await run(interceptor, request("/v1/games/leaderboard"));
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0]?.[0]).toMatchObject({
      surface: "games",
      ip: "10.0.0.1",
      username: "dylansito2",
    });
  });

  it("labels casino requests as their own surface", async () => {
    const { interceptor, record } = build();
    await run(interceptor, request("/v1/casino/state"));
    expect(record.mock.calls[0]?.[0]).toMatchObject({ surface: "casino" });
  });

  it("writes once per app session, not once per request", async () => {
    const { interceptor, record } = build();
    for (const path of ["leaderboard", "daily", "profile", "start"]) {
      await run(interceptor, request(`/v1/games/${path}`));
    }
    expect(record).toHaveBeenCalledTimes(1);
  });

  it("records a NEW connection immediately — that is the whole signal", async () => {
    const { interceptor, record } = build();
    await run(interceptor, request("/v1/games/leaderboard", "10.0.0.1"));
    await run(interceptor, request("/v1/games/leaderboard", "10.0.0.2"));
    expect(record).toHaveBeenCalledTimes(2);
  });

  it("tracks each person separately", async () => {
    const { interceptor, record } = build();
    await run(interceptor, request("/v1/games/leaderboard", "10.0.0.1", "42"));
    await run(interceptor, request("/v1/games/leaderboard", "10.0.0.1", "77"));
    expect(record).toHaveBeenCalledTimes(2);
  });

  it("skips silently when no client IP could be resolved", async () => {
    const { interceptor, record } = build();
    const req = {
      url: "/v1/games/leaderboard",
      headers: {},
      miniapp: request("/x").miniapp,
    };
    // biome-ignore lint/suspicious/noExplicitAny: minimal fake request
    await run(interceptor, req as any);
    expect(record).not.toHaveBeenCalled();
  });

  it("never lets a failed write break the request", async () => {
    const { interceptor, record } = build();
    record.mockRejectedValueOnce(new Error("db down"));
    await expect(
      run(interceptor, request("/v1/games/leaderboard")),
    ).resolves.toBeUndefined();
  });
});

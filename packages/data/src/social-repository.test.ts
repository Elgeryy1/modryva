import { describe, expect, it } from "vitest";
import {
  type ClaimOutcome,
  InMemorySocialRepository,
} from "./social-repository.js";

/**
 * The report's hard requirement (§5.7, §15.3): a hundred simultaneous claims
 * must produce exactly one pole, at most one second and one third place, and
 * nobody holding two positions.
 *
 * This runs against the in-memory double, which enforces both unique indexes
 * and yields between reading the taken positions and inserting. That yield is
 * the whole point: without it, a single-threaded runtime would serialise the
 * hundred calls and the test would prove nothing.
 */

const WINDOW = {
  tenantId: "tenant-1",
  chatId: -1001n,
  threadId: null,
  windowType: "daily",
  startsAt: new Date("2026-07-30T00:00:00Z"),
  endsAt: new Date("2026-07-31T00:00:00Z"),
  timezone: "Europe/Madrid",
  resetMinutes: 0,
  dayKey: "2026-07-30",
};

const awarded = (outcomes: readonly ClaimOutcome[]) =>
  outcomes.filter((outcome) => outcome.ok);

describe("claimPosition under contention", () => {
  it("gives exactly one pole to 100 people claiming at once", async () => {
    const repo = new InMemorySocialRepository();
    const window = await repo.ensureWindow(WINDOW);

    const outcomes = await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        repo.claimPosition({
          windowId: window.id,
          userId: BigInt(1000 + i),
          userName: `u${i}`,
          messageId: i,
          latencyMs: i,
          positions: 3,
        }),
      ),
    );

    const winners = awarded(outcomes);
    expect(winners).toHaveLength(3);

    const positions = winners.map((o) => (o.ok ? o.claim.position : 0)).sort();
    expect(positions).toEqual([1, 2, 3]);

    // Everybody else was told the podium is full — not given a silent failure.
    const full = outcomes.filter((o) => !o.ok && o.reason === "window-full");
    expect(full).toHaveLength(97);
  });

  it("never lets one person hold two positions, even racing themselves", async () => {
    // The realistic version: one person's client retries and both requests land.
    const repo = new InMemorySocialRepository();
    const window = await repo.ensureWindow(WINDOW);

    const outcomes = await Promise.all(
      Array.from({ length: 20 }, () =>
        repo.claimPosition({
          windowId: window.id,
          userId: 777n,
          userName: "Ana",
          messageId: 1,
          latencyMs: 10,
          positions: 3,
        }),
      ),
    );

    expect(awarded(outcomes)).toHaveLength(1);
    const claims = await repo.listWindowClaims(window.id);
    expect(claims).toHaveLength(1);
    expect(claims[0]?.position).toBe(1);
  });

  it("tells a repeat claimer which position they already hold", async () => {
    const repo = new InMemorySocialRepository();
    const window = await repo.ensureWindow(WINDOW);
    const base = {
      windowId: window.id,
      userName: "Ana",
      messageId: 1,
      latencyMs: 10,
      positions: 3,
    };
    await repo.claimPosition({ ...base, userId: 111n });
    await repo.claimPosition({ ...base, userId: 222n, userName: "Luis" });
    const again = await repo.claimPosition({ ...base, userId: 222n });

    expect(again).toEqual({
      ok: false,
      reason: "already-claimed",
      position: 2,
    });
  });

  it("awards only ONE place when the group configured top-1", async () => {
    const repo = new InMemorySocialRepository();
    const window = await repo.ensureWindow(WINDOW);

    const outcomes = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        repo.claimPosition({
          windowId: window.id,
          userId: BigInt(2000 + i),
          userName: `u${i}`,
          messageId: i,
          latencyMs: i,
          positions: 1,
        }),
      ),
    );
    expect(awarded(outcomes)).toHaveLength(1);
  });

  it("survives 20 repeated rounds without ever double-awarding", async () => {
    // Once is luck; the report asks for it repeated (§15.3).
    for (let round = 0; round < 20; round += 1) {
      const repo = new InMemorySocialRepository();
      const window = await repo.ensureWindow(WINDOW);
      const outcomes = await Promise.all(
        Array.from({ length: 40 }, (_, i) =>
          repo.claimPosition({
            windowId: window.id,
            userId: BigInt(i),
            userName: `u${i}`,
            messageId: i,
            latencyMs: i,
            positions: 3,
          }),
        ),
      );
      const positions = awarded(outcomes).map((o) =>
        o.ok ? o.claim.position : 0,
      );
      expect(new Set(positions).size).toBe(positions.length);
      expect(positions).toHaveLength(3);
    }
  });
});

describe("a window that is not there", () => {
  it("answers instead of throwing, exactly as real Postgres does", async () => {
    // Parity with the FK in pole_claims. The real database rejects this; a
    // double that allowed it hid a crash until the integration suite ran.
    const repo = new InMemorySocialRepository();
    const outcome = await repo.claimPosition({
      windowId: "no-existe",
      userId: 1n,
      userName: "Ana",
      messageId: 1,
      latencyMs: 1,
      positions: 3,
    });
    expect(outcome).toEqual({ ok: false, reason: "window-gone" });
  });
});

describe("ensureWindow under contention", () => {
  it("collapses concurrent creations into one window", async () => {
    // Two replicas computing the same window from the same inputs must not end
    // up running two competitions.
    const repo = new InMemorySocialRepository();
    const windows = await Promise.all(
      Array.from({ length: 25 }, () => repo.ensureWindow(WINDOW)),
    );
    expect(new Set(windows.map((w) => w.id)).size).toBe(1);
  });

  it("keeps separate windows for separate topics", async () => {
    const repo = new InMemorySocialRepository();
    const shared = await repo.ensureWindow(WINDOW);
    const topic = await repo.ensureWindow({ ...WINDOW, threadId: 7 });
    expect(topic.id).not.toBe(shared.id);
  });

  it("keeps separate windows for separate bots on the same chat", async () => {
    // Multi-bot isolation: two child bots in one group each have their own
    // competition, and neither can see the other's claims.
    const repo = new InMemorySocialRepository();
    const a = await repo.ensureWindow(WINDOW);
    const b = await repo.ensureWindow({ ...WINDOW, tenantId: "tenant-2" });
    expect(a.id).not.toBe(b.id);

    await repo.claimPosition({
      windowId: a.id,
      userId: 1n,
      userName: "Ana",
      messageId: 1,
      latencyMs: 1,
      positions: 3,
    });
    const seenByB = await repo.listScopeClaims(
      { tenantId: "tenant-2", chatId: -1001n, threadId: null },
      null,
      50,
    );
    expect(seenByB).toHaveLength(0);
  });
});

describe("roulette rounds", () => {
  const round = {
    tenantId: "tenant-1",
    chatId: -1001n,
    threadId: null,
    userId: 555n,
    messageId: 42,
    numerator: 1,
    denominator: 6,
    outcome: "adverse" as const,
    consequence: "muted" as const,
    muteSeconds: 60,
    degradedWhy: null,
    rngVersion: 1,
  };

  it("refuses to replay the same message", async () => {
    // A redelivered update carries the same message id. Recording it twice
    // would mean silencing the same person twice for one command.
    const repo = new InMemorySocialRepository();
    expect(await repo.recordRouletteRound(round)).toEqual({ ok: true });
    expect(await repo.recordRouletteRound(round)).toEqual({
      ok: false,
      reason: "duplicate",
    });
  });

  it("separates the per-person cooldown from the per-chat one", async () => {
    const repo = new InMemorySocialRepository();
    await repo.recordRouletteRound({ ...round, messageId: 1, userId: 111n });
    const spins = await repo.lastSpins(
      { tenantId: "tenant-1", chatId: -1001n, threadId: null },
      999n,
    );
    expect(spins.lastUserSpinAt).toBeNull();
    expect(spins.lastChatSpinAt).not.toBeNull();
  });

  it("does not leak a spin across bots", async () => {
    const repo = new InMemorySocialRepository();
    await repo.recordRouletteRound(round);
    const spins = await repo.lastSpins(
      { tenantId: "tenant-2", chatId: -1001n, threadId: null },
      555n,
    );
    expect(spins.lastChatSpinAt).toBeNull();
  });
});

describe("media library", () => {
  const asset = (id: string, tenantId: string | null, over = {}) => ({
    id,
    tenantId,
    kind: "cat",
    source: "propia",
    licence: "CC0",
    attribution: null,
    storageKey: null,
    safetyStatus: "approved",
    active: true,
    ...over,
  });

  it("serves the shared library plus this bot's own", async () => {
    const repo = new InMemorySocialRepository();
    repo.addAsset(asset("shared", null));
    repo.addAsset(asset("mine", "tenant-1"));
    repo.addAsset(asset("theirs", "tenant-2"));
    const rows = await repo.listMediaAssets("tenant-1", "cat");
    expect(rows.map((row) => row.id).sort()).toEqual(["mine", "shared"]);
  });

  it("never serves something unreviewed or switched off", async () => {
    const repo = new InMemorySocialRepository();
    repo.addAsset(asset("pending", null, { safetyStatus: "pending" }));
    repo.addAsset(asset("off", null, { active: false }));
    expect(await repo.listMediaAssets("tenant-1", "cat")).toHaveLength(0);
  });

  it("keeps a file_id per bot, because Telegram binds it to the token", async () => {
    const repo = new InMemorySocialRepository();
    await repo.rememberMediaFileId("a1", "tenant-1", "FILE-A", null);
    expect(await repo.findMediaFileId("a1", "tenant-1")).toBe("FILE-A");
    // A child bot must not reuse the parent's file_id: Telegram rejects it.
    expect(await repo.findMediaFileId("a1", "tenant-2")).toBeNull();
  });
});

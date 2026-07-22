import type { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { CasinoService } from "./casino.service.js";

// blackjackStart reshuffles from a fresh random newServerSeed() on every call, so
// ~5% of opening deals landed on a natural 21. That auto-settle-on-open path then
// read whatever getCasinoBet returned at that instant (the fixtures' placeholder
// crash bet, which has no `shoe`) and threw inside dealerPlays — and, on the runs
// where it did not throw, emitted an extra settleCasinoBet that tripped the "no
// auto-settle" assertions. That call-time randomness — not env contamination — is
// the real cause of this file's historical flakiness. Pinning buildShoe to a fixed
// non-blackjack opening (player 17 vs dealer 16) removes it so every blackjack test
// is deterministic. Only buildShoe is overridden; all other game math stays real.
vi.mock("@superbot/module-games", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@superbot/module-games")>();
  return {
    ...actual,
    buildShoe: () => [10, 10, 7, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  };
});

const expectError = async (p: Promise<unknown>, code: string) => {
  try {
    await p;
  } catch (e) {
    expect((e as HttpException).getResponse()).toMatchObject({ error: code });
    return;
  }
  throw new Error(`expected HttpException error=${code}`);
};

/** Records the tenantId every ChipRepository call actually received — the
 * direct regression check for tenant-scope threading, mirroring the
 * approach the design plan recommended. */
class FakeChipRepository {
  calls: Array<{ method: string; tenantId: string }> = [];

  async ensureWallet(tenantId: string) {
    this.calls.push({ method: "ensureWallet", tenantId });
    return { balance: 100, serverSeedHash: "h", clientSeed: "s", nonce: 0 };
  }
  async placeBet(input: { tenantId: string }) {
    this.calls.push({ method: "placeBet", tenantId: input.tenantId });
    return {
      ok: true,
      payout: 0,
      multiplier: 0,
      balance: 100,
      detail: {},
      serverSeedHash: "h",
      clientSeed: "s",
      nonce: 0,
    };
  }
  async getJackpot(tenantId: string) {
    this.calls.push({ method: "getJackpot", tenantId });
    return 0;
  }
  async leaderboard(tenantId: string) {
    this.calls.push({ method: "leaderboard", tenantId });
    return [];
  }
  async tournamentState(tenantId: string) {
    this.calls.push({ method: "tournamentState", tenantId });
    return { standings: [] };
  }
  async startCasinoBet(input: { tenantId: string }) {
    this.calls.push({ method: "startCasinoBet", tenantId: input.tenantId });
    return { ok: true, betId: "b1", balance: 100 };
  }
  // Set by a test to simulate a previously-abandoned open blackjack hand.
  staleBlackjackBet: {
    id: string;
    tenantId: string;
    stake: number;
    serverSeed: string;
    state: unknown;
  } | null = null;
  // Set by a test to replace the default crash-shaped bet getCasinoBet
  // returns — e.g. to exercise a mines/blackjack branch.
  betOverride: {
    game: string;
    stake: number;
    serverSeed: string;
    state: unknown;
  } | null = null;
  // Set by a test to simulate settleCasinoBet losing the open->settled race
  // (another concurrent request already settled this exact bet).
  settleOk = true;

  async getCasinoBet(tenantId: string, betId: string) {
    this.calls.push({ method: "getCasinoBet", tenantId });
    if (this.staleBlackjackBet && betId === this.staleBlackjackBet.id) {
      return {
        ...this.staleBlackjackBet,
        game: "blackjack",
        status: "open" as const,
      };
    }
    if (this.betOverride) {
      return { tenantId, ...this.betOverride, status: "open" as const };
    }
    return {
      tenantId,
      game: "crash",
      stake: 10,
      serverSeed: "seed",
      state: { crash: 2 },
      status: "open" as const,
    };
  }
  async settleCasinoBet(tenantId: string) {
    this.calls.push({ method: "settleCasinoBet", tenantId });
    return { ok: this.settleOk, balance: 100 };
  }
  async findOpenCasinoBet(tenantId: string) {
    this.calls.push({ method: "findOpenCasinoBet", tenantId });
    return this.staleBlackjackBet
      ? {
          ...this.staleBlackjackBet,
          game: "blackjack",
          status: "open" as const,
        }
      : null;
  }
  async updateCasinoBetState(tenantId: string) {
    this.calls.push({ method: "updateCasinoBetState", tenantId });
  }
}

const fakeClient = {
  tenant: {
    // The child bot resolves to its own tenant; every other slug resolves to the
    // parent. Anchoring only on the child slug keeps tenant resolution independent
    // of the ambient TELEGRAM_BOT_USERNAME (which CasinoService.tenantId reads at
    // call time), so nothing here depends on process-wide env another suite set —
    // defensive robustness, not the cause of the flake (see the buildShoe mock).
    findUnique: async ({ where }: { where: { slug: string } }) => {
      if (where.slug === "telegram-childbot") return { id: "t-child" };
      return { id: "t-parent" };
    },
  },
  appUser: {
    findMany: async () => [],
  },
};

const makeService = () => {
  const svc = new CasinoService();
  const chips = new FakeChipRepository();
  Object.assign(svc, { chips, client: fakeClient });
  return { svc, chips };
};

describe("CasinoService tenant scoping", () => {
  it("resolves the parent tenant when no bot scope is given (current prod behavior)", async () => {
    const { svc, chips } = makeService();
    await svc.balance("42");
    expect(chips.calls).toContainEqual({
      method: "ensureWallet",
      tenantId: "t-parent",
    });
  });

  it("resolves a DIFFERENT tenant for a managed child bot's request", async () => {
    const { svc, chips } = makeService();
    await svc.balance("42", { username: "childbot", token: "x" });
    expect(chips.calls).toContainEqual({
      method: "ensureWallet",
      tenantId: "t-child",
    });
    expect(chips.calls).not.toContainEqual({
      method: "ensureWallet",
      tenantId: "t-parent",
    });
  });

  it("threads the bot scope through instantBet", async () => {
    const { svc, chips } = makeService();
    await svc.instantBet(
      "42",
      "plinko",
      10,
      {},
      { username: "childbot", token: "x" },
    );
    expect(chips.calls).toContainEqual({
      method: "placeBet",
      tenantId: "t-child",
    });
  });

  it("threads the bot scope through a multi-step crash bet (start + cashout)", async () => {
    const { svc, chips } = makeService();
    await svc.crashStart("42", 10, { username: "childbot", token: "x" });
    await svc.crashCashout("42", "b1", 1.5, {
      username: "childbot",
      token: "x",
    });
    expect(chips.calls).toContainEqual({
      method: "startCasinoBet",
      tenantId: "t-child",
    });
    expect(chips.calls).toContainEqual({
      method: "getCasinoBet",
      tenantId: "t-child",
    });
    expect(chips.calls).toContainEqual({
      method: "settleCasinoBet",
      tenantId: "t-child",
    });
    // None of this session's chip calls ever touched the parent tenant.
    expect(chips.calls.every((c) => c.tenantId === "t-child")).toBe(true);
  });
});

describe("CasinoService.blackjackStart abandoned-hand reconciliation", () => {
  it("settles a stale open blackjack bet before opening a new one", async () => {
    const { svc, chips } = makeService();
    chips.staleBlackjackBet = {
      id: "stale-1",
      tenantId: "t-parent",
      stake: 20,
      serverSeed: "old-seed",
      state: {
        shoe: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
        cursor: 4,
        player: [10, 9],
        dealer: [10, 6],
      },
    };

    await svc.blackjackStart("42", 10);

    const methods = chips.calls.map((c) => c.method);
    expect(methods).toContain("findOpenCasinoBet");
    expect(methods).toContain("settleCasinoBet");
    // The reconcile (for the OLD bet) must happen before the new bet opens.
    expect(methods.indexOf("settleCasinoBet")).toBeLessThan(
      methods.indexOf("startCasinoBet"),
    );
  });

  it("opens a fresh hand normally when there is no stale bet", async () => {
    const { svc, chips } = makeService();

    await svc.blackjackStart("42", 10);

    const methods = chips.calls.map((c) => c.method);
    expect(methods).toContain("findOpenCasinoBet");
    expect(methods).not.toContain("settleCasinoBet");
    expect(methods).toContain("startCasinoBet");
  });
});

describe("CasinoService.crashCashout validation", () => {
  it("rejects cashoutAt === 1 as invalid-params (would be a guaranteed win)", async () => {
    const { svc } = makeService();
    await svc.crashStart("42", 10);

    await expect(svc.crashCashout("42", "b1", 1)).rejects.toThrow();
  });

  it("rejects cashoutAt below 1 as invalid-params", async () => {
    const { svc } = makeService();
    await svc.crashStart("42", 10);

    await expect(svc.crashCashout("42", "b1", 0.5)).rejects.toThrow();
  });

  it("accepts a cashoutAt just above 1", async () => {
    const { svc } = makeService();
    await svc.crashStart("42", 10);

    await expect(svc.crashCashout("42", "b1", 1.01)).resolves.toBeDefined();
  });
});

describe("CasinoService settle endpoints honor settleCasinoBet's ok flag", () => {
  it("crashCashout rejects with bet-closed instead of returning a fabricated result", async () => {
    const { svc, chips } = makeService();
    await svc.crashStart("42", 10);
    chips.settleOk = false;

    await expectError(svc.crashCashout("42", "b1", 1.5), "bet-closed");
  });

  it("minesReveal (hit-a-mine branch) rejects with bet-closed", async () => {
    const { svc, chips } = makeService();
    await svc.minesStart("42", 10, 1);
    chips.betOverride = {
      game: "mines",
      stake: 10,
      serverSeed: "seed",
      state: { layout: [3], mineCount: 1, revealed: [] },
    };
    chips.settleOk = false;

    await expectError(svc.minesReveal("42", "b1", 3), "bet-closed");
  });

  it("minesReveal (board-cleared auto-cashout branch) rejects with bet-closed", async () => {
    const { svc, chips } = makeService();
    await svc.minesStart("42", 10, 24);
    chips.betOverride = {
      game: "mines",
      stake: 10,
      serverSeed: "seed",
      state: {
        layout: Array.from({ length: 24 }, (_, i) => i + 1), // tiles 1..24
        mineCount: 24,
        revealed: [],
      },
    };
    chips.settleOk = false;

    // Tile 0 is the lone safe tile — revealing it clears the board.
    await expectError(svc.minesReveal("42", "b1", 0), "bet-closed");
  });

  it("minesCashout rejects with bet-closed", async () => {
    const { svc, chips } = makeService();
    await svc.minesStart("42", 10, 1);
    chips.betOverride = {
      game: "mines",
      stake: 10,
      serverSeed: "seed",
      state: { layout: [3], mineCount: 1, revealed: [5] },
    };
    chips.settleOk = false;

    await expectError(svc.minesCashout("42", "b1"), "bet-closed");
  });

  it("blackjackAction (bust branch) rejects with bet-closed", async () => {
    const { svc, chips } = makeService();
    await svc.blackjackStart("42", 10);
    chips.betOverride = {
      game: "blackjack",
      stake: 10,
      serverSeed: "seed",
      state: { shoe: [10], cursor: 0, player: [10, 9], dealer: [2, 2] },
    };
    chips.settleOk = false;

    // Drawing shoe[0]=10 makes the player's hand 10+9+10=29 — a bust.
    await expectError(svc.blackjackAction("42", "b1", "hit"), "bet-closed");
  });

  it("blackjackAction (stand branch, via blackjackSettle) rejects with bet-closed", async () => {
    const { svc, chips } = makeService();
    await svc.blackjackStart("42", 10);
    chips.betOverride = {
      game: "blackjack",
      stake: 10,
      serverSeed: "seed",
      state: { shoe: [], cursor: 0, player: [10, 9], dealer: [10, 10] },
    };
    chips.settleOk = false;

    await expectError(svc.blackjackAction("42", "b1", "stand"), "bet-closed");
  });

  // Regression guard for the file's historical flakiness. The real cause was NOT
  // env contamination but blackjackStart's random opening deal: ~5% of opens were
  // a natural 21, whose auto-settle-on-open path read the placeholder bet (no
  // shoe) and threw in dealerPlays, and otherwise emitted an unexpected
  // settleCasinoBet. With buildShoe pinned above to a non-blackjack opening, every
  // open must be a plain deal — betId returned, no settle, no throw — on every one
  // of many calls (before the mock, this loop threw within a handful of iterations).
  it("opens blackjack deterministically with no auto-settle (natural-21 flake guard)", async () => {
    for (let i = 0; i < 50; i++) {
      const { svc, chips } = makeService();
      const res = await svc.blackjackStart("42", 10);
      expect(res).toMatchObject({ betId: "b1" });
      expect(chips.calls.map((c) => c.method)).not.toContain("settleCasinoBet");
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  canTrade,
  TRADE_DEFAULT_MIN_AGE_DAYS,
  TRADE_DEFAULT_MIN_REP,
  type TradeGateOptions,
  type TradeUser,
} from "./trade-gate.js";

const user = (overrides: Partial<TradeUser> = {}): TradeUser => ({
  ageDays: 30,
  reputation: 50,
  trades: 0,
  ...overrides,
});

const opts = (overrides: Partial<TradeGateOptions> = {}): TradeGateOptions => {
  const { minAgeDays, minReputation } = overrides;
  return {
    ...(minAgeDays !== undefined ? { minAgeDays } : {}),
    ...(minReputation !== undefined ? { minReputation } : {}),
  };
};

describe("constants", () => {
  it("exposes the default minimum age in days", () => {
    expect(TRADE_DEFAULT_MIN_AGE_DAYS).toBe(7);
  });

  it("exposes the default minimum reputation", () => {
    expect(TRADE_DEFAULT_MIN_REP).toBe(10);
  });
});

describe("canTrade with defaults", () => {
  it("allows a seasoned, reputable account with no prior trades", () => {
    const result = canTrade(user({ ageDays: 30, reputation: 50, trades: 0 }));
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("Cumples los requisitos para tradear.");
  });

  it("blocks a brand-new account by age first", () => {
    const result = canTrade(user({ ageDays: 0, reputation: 999, trades: 0 }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(
      "Tu cuenta debe tener al menos 7 días para tradear.",
    );
  });

  it("blocks an old but low-reputation account by reputation", () => {
    const result = canTrade(user({ ageDays: 365, reputation: 9, trades: 0 }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(
      "Necesitas al menos 10 de reputación para tradear.",
    );
  });

  it("prefers the age reason when both age and reputation fail", () => {
    const result = canTrade(user({ ageDays: 1, reputation: 0, trades: 0 }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(
      "Tu cuenta debe tener al menos 7 días para tradear.",
    );
  });

  it("treats the exact minimum age as sufficient", () => {
    const result = canTrade(
      user({ ageDays: TRADE_DEFAULT_MIN_AGE_DAYS, reputation: 50, trades: 0 }),
    );
    expect(result.allowed).toBe(true);
  });

  it("treats the exact minimum reputation as sufficient", () => {
    const result = canTrade(
      user({ ageDays: 30, reputation: TRADE_DEFAULT_MIN_REP, trades: 0 }),
    );
    expect(result.allowed).toBe(true);
  });

  it("blocks one day below the minimum age", () => {
    const result = canTrade(
      user({ ageDays: TRADE_DEFAULT_MIN_AGE_DAYS - 1, reputation: 50 }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("días");
  });

  it("blocks one point below the minimum reputation", () => {
    const result = canTrade(
      user({ ageDays: 30, reputation: TRADE_DEFAULT_MIN_REP - 1 }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("reputación");
  });
});

describe("canTrade with prior trades (trust bypass)", () => {
  it("allows any user with at least one prior trade regardless of age/rep", () => {
    const result = canTrade(user({ ageDays: 0, reputation: 0, trades: 1 }));
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("Trader con historial verificado.");
  });

  it("does not bypass on zero prior trades", () => {
    const result = canTrade(user({ ageDays: 0, reputation: 0, trades: 0 }));
    expect(result.allowed).toBe(false);
  });

  it("bypasses even when a strict custom gate would otherwise block", () => {
    const result = canTrade(
      user({ ageDays: 0, reputation: 0, trades: 5 }),
      opts({ minAgeDays: 90, minReputation: 500 }),
    );
    expect(result.allowed).toBe(true);
  });
});

describe("canTrade with custom options", () => {
  it("uses a custom minimum age", () => {
    const result = canTrade(
      user({ ageDays: 10, reputation: 50, trades: 0 }),
      opts({ minAgeDays: 14 }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(
      "Tu cuenta debe tener al menos 14 días para tradear.",
    );
  });

  it("uses a custom minimum reputation", () => {
    const result = canTrade(
      user({ ageDays: 30, reputation: 40, trades: 0 }),
      opts({ minReputation: 100 }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(
      "Necesitas al menos 100 de reputación para tradear.",
    );
  });

  it("falls back to the default reputation when only age is overridden", () => {
    const result = canTrade(
      user({ ageDays: 20, reputation: 5, trades: 0 }),
      opts({ minAgeDays: 3 }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(
      "Necesitas al menos 10 de reputación para tradear.",
    );
  });

  it("falls back to the default age when only reputation is overridden", () => {
    const result = canTrade(
      user({ ageDays: 2, reputation: 1000, trades: 0 }),
      opts({ minReputation: 1 }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(
      "Tu cuenta debe tener al menos 7 días para tradear.",
    );
  });

  it("allows when custom thresholds are met exactly", () => {
    const result = canTrade(
      user({ ageDays: 14, reputation: 100, trades: 0 }),
      opts({ minAgeDays: 14, minReputation: 100 }),
    );
    expect(result.allowed).toBe(true);
  });

  it("treats an empty options object like no options", () => {
    const withEmpty = canTrade(user({ ageDays: 3, reputation: 50 }), opts());
    const withNone = canTrade(user({ ageDays: 3, reputation: 50 }));
    expect(withEmpty).toEqual(withNone);
  });
});

describe("determinism and purity", () => {
  it("returns identical results for identical inputs", () => {
    const u = user({ ageDays: 5, reputation: 8, trades: 0 });
    expect(canTrade(u)).toEqual(canTrade(u));
  });

  it("does not mutate the input user", () => {
    const u = user({ ageDays: 5, reputation: 8, trades: 0 });
    const snapshot = { ...u };
    canTrade(u);
    expect(u).toEqual(snapshot);
  });
});

import { describe, expect, it } from "vitest";
import {
  computeExpiredCurrency,
  DEFAULT_CURRENCY_TTL_MS,
} from "./currency-expiry.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("computeExpiredCurrency", () => {
  it("splits grants into expired and active using the default 30-day TTL", () => {
    const now = 40 * DAY_MS;
    const grants = [
      { amount: 100, grantedMs: 0 }, // 40 days old -> expired
      { amount: 50, grantedMs: 20 * DAY_MS }, // 20 days old -> active
    ];
    expect(computeExpiredCurrency(grants, now)).toEqual({
      expired: 100,
      active: 50,
    });
  });

  it("treats a grant exactly at the TTL boundary as expired", () => {
    const grants = [{ amount: 30, grantedMs: 0 }];
    expect(computeExpiredCurrency(grants, DEFAULT_CURRENCY_TTL_MS)).toEqual({
      expired: 30,
      active: 0,
    });
  });

  it("keeps a grant one millisecond before the boundary active", () => {
    const grants = [{ amount: 30, grantedMs: 0 }];
    expect(computeExpiredCurrency(grants, DEFAULT_CURRENCY_TTL_MS - 1)).toEqual(
      { expired: 0, active: 30 },
    );
  });

  it("honors a custom ttlMs override", () => {
    const grants = [
      { amount: 10, grantedMs: 0 },
      { amount: 5, grantedMs: 5 * DAY_MS },
    ];
    expect(
      computeExpiredCurrency(grants, 6 * DAY_MS, { ttlMs: 2 * DAY_MS }),
    ).toEqual({ expired: 10, active: 5 });
  });

  it("returns zero totals for an empty grant list", () => {
    expect(computeExpiredCurrency([], 123456)).toEqual({
      expired: 0,
      active: 0,
    });
  });

  it("sums multiple grants within each bucket", () => {
    const now = 100 * DAY_MS;
    const grants = [
      { amount: 100, grantedMs: 0 },
      { amount: 200, grantedMs: 10 * DAY_MS },
      { amount: 7, grantedMs: 90 * DAY_MS },
      { amount: 3, grantedMs: 99 * DAY_MS },
    ];
    // First two are >30 days old (expired), last two are within 30 days (active).
    expect(computeExpiredCurrency(grants, now)).toEqual({
      expired: 300,
      active: 10,
    });
  });

  it("counts everything expired when ttlMs is zero", () => {
    const grants = [
      { amount: 1, grantedMs: 500 },
      { amount: 2, grantedMs: 1000 },
    ];
    expect(computeExpiredCurrency(grants, 1000, { ttlMs: 0 })).toEqual({
      expired: 3,
      active: 0,
    });
  });

  it("normalizes a negative ttlMs to zero", () => {
    const grants = [{ amount: 9, grantedMs: 42 }];
    expect(computeExpiredCurrency(grants, 42, { ttlMs: -1000 })).toEqual({
      expired: 9,
      active: 0,
    });
  });

  it("treats future-dated grants as active", () => {
    const grants = [{ amount: 25, grantedMs: 5000 }];
    expect(computeExpiredCurrency(grants, 1000)).toEqual({
      expired: 0,
      active: 25,
    });
  });

  it("is order-independent for the same set of grants", () => {
    const now = 50 * DAY_MS;
    const a = { amount: 100, grantedMs: 0 };
    const b = { amount: 40, grantedMs: 45 * DAY_MS };
    const c = { amount: 8, grantedMs: 49 * DAY_MS };
    const forward = computeExpiredCurrency([a, b, c], now);
    const reversed = computeExpiredCurrency([c, b, a], now);
    expect(forward).toEqual(reversed);
    expect(forward).toEqual({ expired: 100, active: 48 });
  });
});

import { describe, expect, it } from "vitest";
import {
  BREAKER_DEFAULT_FAILURE_THRESHOLD,
  BREAKER_DEFAULT_OPEN_MS,
  type BreakerState,
  detectRateLimitApproaching,
  evaluateCircuitBreaker,
  RATE_LIMIT_APPROACH_RATIO,
  recordBreakerResult,
} from "./circuit-breaker.js";

const closed: BreakerState = { failures: 0, lastFailureMs: 0 };

describe("evaluateCircuitBreaker", () => {
  it("is closed and allows when there are no failures", () => {
    expect(evaluateCircuitBreaker(closed, 1_000)).toEqual({
      state: "closed",
      allow: true,
      reason: "circuit-closed",
    });
  });

  it("blocks while openUntilMs is in the future", () => {
    const state: BreakerState = {
      failures: 5,
      lastFailureMs: 1_000,
      openUntilMs: 5_000,
    };
    expect(evaluateCircuitBreaker(state, 4_999)).toEqual({
      state: "open",
      allow: false,
      reason: "circuit-open",
    });
  });

  it("moves to half-open exactly when the open window expires", () => {
    const state: BreakerState = {
      failures: 5,
      lastFailureMs: 1_000,
      openUntilMs: 5_000,
    };
    expect(evaluateCircuitBreaker(state, 5_000)).toEqual({
      state: "half-open",
      allow: true,
      reason: "probe-after-open",
    });
    expect(evaluateCircuitBreaker(state, 9_000).allow).toBe(true);
  });

  it("treats a threshold reached without openUntilMs as a probe", () => {
    const state: BreakerState = { failures: 5, lastFailureMs: 1_000 };
    expect(evaluateCircuitBreaker(state, 2_000)).toEqual({
      state: "half-open",
      allow: true,
      reason: "probe-threshold",
    });
  });

  it("stays closed below a custom threshold", () => {
    const state: BreakerState = { failures: 2, lastFailureMs: 1_000 };
    expect(
      evaluateCircuitBreaker(state, 2_000, { failureThreshold: 3 }).state,
    ).toBe("closed");
    expect(
      evaluateCircuitBreaker(state, 2_000, { failureThreshold: 2 }).state,
    ).toBe("half-open");
  });

  it("is deterministic for identical inputs", () => {
    const state: BreakerState = {
      failures: 3,
      lastFailureMs: 10,
      openUntilMs: 100,
    };
    expect(evaluateCircuitBreaker(state, 50)).toEqual(
      evaluateCircuitBreaker(state, 50),
    );
  });
});

describe("recordBreakerResult", () => {
  it("resets failures and clears openUntilMs on success", () => {
    const state: BreakerState = {
      failures: 4,
      lastFailureMs: 1_000,
      openUntilMs: 9_000,
    };
    const next = recordBreakerResult(state, true, 2_000);
    expect(next).toEqual({ failures: 0, lastFailureMs: 1_000 });
    expect(next.openUntilMs).toBeUndefined();
  });

  it("increments failures without opening below the threshold", () => {
    const next = recordBreakerResult(closed, false, 3_000);
    expect(next).toEqual({ failures: 1, lastFailureMs: 3_000 });
    expect(next.openUntilMs).toBeUndefined();
  });

  it("opens the circuit when the failure count reaches the threshold", () => {
    const state: BreakerState = { failures: 4, lastFailureMs: 1_000 };
    const next = recordBreakerResult(state, false, 5_000);
    expect(next).toEqual({
      failures: 5,
      lastFailureMs: 5_000,
      openUntilMs: 5_000 + BREAKER_DEFAULT_OPEN_MS,
    });
  });

  it("honours a custom threshold and openMs", () => {
    const state: BreakerState = { failures: 1, lastFailureMs: 1_000 };
    const next = recordBreakerResult(state, false, 5_000, {
      failureThreshold: 2,
      openMs: 1_000,
    });
    expect(next).toEqual({
      failures: 2,
      lastFailureMs: 5_000,
      openUntilMs: 6_000,
    });
  });

  it("does not mutate the input state", () => {
    const state: BreakerState = { failures: 4, lastFailureMs: 1_000 };
    recordBreakerResult(state, false, 5_000);
    expect(state).toEqual({ failures: 4, lastFailureMs: 1_000 });
  });

  it("uses default threshold and open duration as documented", () => {
    let state: BreakerState = closed;
    for (let i = 0; i < BREAKER_DEFAULT_FAILURE_THRESHOLD; i += 1) {
      state = recordBreakerResult(state, false, 1_000 + i);
    }
    expect(state.failures).toBe(BREAKER_DEFAULT_FAILURE_THRESHOLD);
    expect(state.openUntilMs).toBe(1_004 + BREAKER_DEFAULT_OPEN_MS);
  });
});

describe("detectRateLimitApproaching", () => {
  it("counts only calls inside the sliding window", () => {
    const calls = [100, 500, 900, 1_000];
    const status = detectRateLimitApproaching(calls, 10, 600, 1_000);
    expect(status.used).toBe(3);
  });

  it("excludes the exact window start and includes nowMs", () => {
    const calls = [400, 1_000];
    const status = detectRateLimitApproaching(calls, 10, 600, 1_000);
    expect(status.used).toBe(1);
  });

  it("flags approaching at the 80% ratio boundary", () => {
    const calls = [1, 2, 3, 4];
    const status = detectRateLimitApproaching(calls, 5, 1_000, 10);
    expect(status).toEqual({ approaching: true, used: 4, headroom: 1 });
  });

  it("is not approaching well below the ratio", () => {
    const calls = [1, 2];
    const status = detectRateLimitApproaching(calls, 10, 1_000, 10);
    expect(status).toEqual({ approaching: false, used: 2, headroom: 8 });
  });

  it("keeps headroom at zero when the limit is exceeded", () => {
    const calls = [1, 2, 3, 4, 5, 6];
    const status = detectRateLimitApproaching(calls, 5, 1_000, 10);
    expect(status.approaching).toBe(true);
    expect(status.headroom).toBe(0);
  });

  it("treats a non-positive limit as always approaching", () => {
    expect(detectRateLimitApproaching([1, 2], 0, 1_000, 10)).toEqual({
      approaching: true,
      used: 2,
      headroom: 0,
    });
    expect(detectRateLimitApproaching([], -3, 1_000, 10)).toEqual({
      approaching: true,
      used: 0,
      headroom: 0,
    });
  });

  it("returns zero usage for an empty call list", () => {
    expect(detectRateLimitApproaching([], 10, 1_000, 10)).toEqual({
      approaching: false,
      used: 0,
      headroom: 10,
    });
  });

  it("exposes the approach ratio constant", () => {
    expect(RATE_LIMIT_APPROACH_RATIO).toBeGreaterThan(0);
    expect(RATE_LIMIT_APPROACH_RATIO).toBeLessThan(1);
  });
});

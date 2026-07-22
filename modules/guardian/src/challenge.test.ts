import { describe, expect, it } from "vitest";
import {
  generateChallenge,
  generateGestureChallenge,
  resolveStepAction,
  verifyChallengeSubmission,
} from "./challenge.js";

describe("generateChallenge", () => {
  it("is deterministic for a fixed seed", () => {
    const a = generateChallenge("normal", 12345, "nonce-1");
    const b = generateChallenge("normal", 12345, "nonce-1");
    expect(a).toEqual(b);
  });

  it("scales the step count with difficulty", () => {
    expect(generateChallenge("basic", 1, "n").steps).toHaveLength(1);
    expect(generateChallenge("normal", 1, "n").steps).toHaveLength(2);
    expect(generateChallenge("strict", 1, "n").steps).toHaveLength(3);
  });

  it("only reveals the full sequence ahead of time below strict", () => {
    expect(generateChallenge("basic", 1, "n").revealStepsAhead).toBe(true);
    expect(generateChallenge("normal", 1, "n").revealStepsAhead).toBe(true);
    expect(generateChallenge("strict", 1, "n").revealStepsAhead).toBe(false);
  });

  it("always starts with a face step (a face must be in frame first)", () => {
    for (let seed = 0; seed < 25; seed += 1) {
      const challenge = generateChallenge("strict", seed, "n");
      expect(challenge.steps[0]?.kind).toBe("face");
    }
  });

  it("gives every step an accessible face alternative distinct from itself", () => {
    for (let seed = 0; seed < 25; seed += 1) {
      const challenge = generateChallenge("strict", seed, "n");
      for (const step of challenge.steps) {
        expect(step.accessibleAlternative).not.toBe(step.action);
      }
    }
  });

  it("embeds the caller-supplied nonce verbatim", () => {
    expect(generateChallenge("basic", 1, "abc-123").nonce).toBe("abc-123");
  });
});

describe("generateGestureChallenge", () => {
  it("defaults to a single hand-gesture step", () => {
    const challenge = generateGestureChallenge(1, "n");
    expect(challenge.steps).toHaveLength(1);
    expect(challenge.steps[0]?.kind).toBe("hand");
  });

  it("photoCount 2 adds a second step with a DIFFERENT gesture than the first", () => {
    // Different on purpose (see challenge.ts docstring): a single recycled
    // photo or looping video must not be able to satisfy both steps at once.
    for (let seed = 0; seed < 25; seed += 1) {
      const challenge = generateGestureChallenge(seed, "n", 2);
      expect(challenge.steps).toHaveLength(2);
      expect(challenge.steps[1]?.kind).toBe("hand");
      expect(challenge.steps[1]?.action).not.toBe(challenge.steps[0]?.action);
    }
  });

  it("doubles the total time limit when a second photo is required", () => {
    const one = generateGestureChallenge(1, "n", 1);
    const two = generateGestureChallenge(1, "n", 2);
    expect(two.totalTimeLimitMs).toBe(one.totalTimeLimitMs * 2);
  });

  it("is deterministic for a fixed seed", () => {
    const a = generateGestureChallenge(42, "nonce-1", 2);
    const b = generateGestureChallenge(42, "nonce-1", 2);
    expect(a).toEqual(b);
  });

  it("test-only: pins the first gesture when forcedFirstGesture is given", () => {
    for (let seed = 0; seed < 10; seed += 1) {
      const challenge = generateGestureChallenge(seed, "n", 1, "open_palm");
      expect(challenge.steps[0]?.action).toBe("open_palm");
    }
  });

  it("the forced gesture still yields a different, real second gesture in double-verification mode", () => {
    const challenge = generateGestureChallenge(1, "n", 2, "open_palm");
    expect(challenge.steps[0]?.action).toBe("open_palm");
    expect(challenge.steps[1]?.action).not.toBe("open_palm");
  });

  it("ignores an invalid forcedFirstGesture instead of throwing", () => {
    const challenge = generateGestureChallenge(
      1,
      "n",
      1,
      // biome-ignore lint/suspicious/noExplicitAny: deliberately invalid input
      "not-a-real-gesture" as any,
    );
    expect(challenge.steps[0]?.action).not.toBe("not-a-real-gesture");
  });

  it("test-only: pins BOTH gestures when forcedFirstGesture and forcedSecondGesture are given", () => {
    const challenge = generateGestureChallenge(
      1,
      "n",
      2,
      "open_palm",
      "victory",
    );
    expect(challenge.steps[0]?.action).toBe("open_palm");
    expect(challenge.steps[1]?.action).toBe("victory");
  });

  it("falls back to a random (different) second gesture if forcedSecondGesture equals the first", () => {
    const challenge = generateGestureChallenge(
      1,
      "n",
      2,
      "open_palm",
      "open_palm",
    );
    expect(challenge.steps[0]?.action).toBe("open_palm");
    expect(challenge.steps[1]?.action).not.toBe("open_palm");
  });
});

describe("verifyChallengeSubmission", () => {
  const definition = generateChallenge("normal", 7, "nonce-x");
  const start = 1_000_000;

  const honestResults = () => {
    let t = start;
    return definition.steps.map((step) => {
      t += 1000;
      return { action: step.action, detectedAt: t };
    });
  };

  it("accepts a correctly ordered, on-time, matching submission", () => {
    const result = verifyChallengeSubmission(
      definition,
      "nonce-x",
      honestResults(),
      start,
    );
    expect(result).toEqual({ ok: true });
  });

  it("accepts an accessible-alternative substitution", () => {
    const results = honestResults();
    const first = results[0];
    if (first) {
      const step = definition.steps[0];
      if (step) {
        results[0] = {
          action: step.accessibleAlternative,
          detectedAt: first.detectedAt,
        };
      }
    }
    const result = verifyChallengeSubmission(
      definition,
      "nonce-x",
      results,
      start,
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects a mismatched nonce", () => {
    const result = verifyChallengeSubmission(
      definition,
      "wrong-nonce",
      honestResults(),
      start,
    );
    expect(result).toEqual({ ok: false, reason: "nonce-mismatch" });
  });

  it("rejects a wrong number of steps", () => {
    const result = verifyChallengeSubmission(
      definition,
      "nonce-x",
      honestResults().slice(0, 1),
      start,
    );
    expect(result).toEqual({ ok: false, reason: "step-count-mismatch" });
  });

  it("rejects out-of-order actions", () => {
    const results = [...honestResults()].reverse();
    const result = verifyChallengeSubmission(
      definition,
      "nonce-x",
      results,
      start,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a step that exceeds its own time budget", () => {
    const results = honestResults();
    const last = results[results.length - 1];
    if (last) {
      results[results.length - 1] = {
        ...last,
        detectedAt: last.detectedAt + 100_000,
      };
    }
    const result = verifyChallengeSubmission(
      definition,
      "nonce-x",
      results,
      start,
    );
    expect(result).toEqual({ ok: false, reason: "step-timeout" });
  });

  it("rejects a detection timestamp before the session started", () => {
    const results = honestResults();
    if (results[0]) {
      results[0] = { ...results[0], detectedAt: start - 10 };
    }
    const result = verifyChallengeSubmission(
      definition,
      "nonce-x",
      results,
      start,
    );
    expect(result).toEqual({ ok: false, reason: "wrong-order" });
  });
});

describe("resolveStepAction", () => {
  const step = {
    kind: "hand" as const,
    action: "thumbs_up" as const,
    timeLimitMs: 1000,
    accessibleAlternative: "smile" as const,
  };

  it("returns the accessible alternative when the submission matches it", () => {
    expect(resolveStepAction(step, "smile")).toBe("smile");
  });

  it("returns the original action when the submission matches it", () => {
    expect(resolveStepAction(step, "thumbs_up")).toBe("thumbs_up");
  });

  it("falls back to the original action for a missing step result", () => {
    expect(resolveStepAction(step, undefined)).toBe("thumbs_up");
  });

  it("falls back to the original action for an unrelated/tampered value", () => {
    expect(resolveStepAction(step, "not-a-real-gesture")).toBe("thumbs_up");
  });
});

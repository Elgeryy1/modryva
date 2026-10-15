import { describe, expect, it } from "vitest";
import {
  commit,
  fairFloat,
  fairInt,
  fairShuffle,
  newServerSeed,
  verifyCommit,
} from "./fairness.js";

describe("provably-fair commit-reveal", () => {
  it("commit is verifiable and reveal-checkable", () => {
    const seed = "a".repeat(64);
    const c = commit(seed);
    expect(c).toHaveLength(64); // sha256 hex
    expect(verifyCommit(seed, c)).toBe(true);
    expect(verifyCommit("b".repeat(64), c)).toBe(false);
  });

  it("generates distinct random server seeds", () => {
    expect(newServerSeed()).not.toBe(newServerSeed());
    expect(newServerSeed()).toHaveLength(64);
  });

  it("fairFloat is deterministic and in [0,1)", () => {
    const a = fairFloat("server", "client", 1);
    const b = fairFloat("server", "client", 1);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
    // Different nonce → different outcome.
    expect(fairFloat("server", "client", 2)).not.toBe(a);
  });

  it("fairInt stays in range and is roughly uniform", () => {
    const counts = new Array(6).fill(0);
    for (let nonce = 0; nonce < 6000; nonce += 1) {
      const roll = fairInt("s", "c", nonce, 1, 6);
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(6);
      counts[roll - 1] += 1;
    }
    // Each face should land near 1000/6000; allow generous slack.
    for (const count of counts) {
      expect(count).toBeGreaterThan(750);
      expect(count).toBeLessThan(1250);
    }
  });

  it("fairShuffle is a deterministic permutation", () => {
    const a = fairShuffle("s", "c", 1, 52);
    const b = fairShuffle("s", "c", 1, 52);
    expect(a).toEqual(b);
    // Same multiset 0..51, no dupes, no drops.
    expect([...a].sort((x, y) => x - y)).toEqual(
      Array.from({ length: 52 }, (_, i) => i),
    );
    // A different nonce reshuffles.
    expect(fairShuffle("s", "c", 2, 52)).not.toEqual(a);
  });
});

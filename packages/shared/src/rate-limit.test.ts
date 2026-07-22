import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit.js";

describe("createRateLimiter", () => {
  it("allows up to capacity then blocks", () => {
    const t = 1_000;
    const rl = createRateLimiter({
      capacity: 3,
      refillPerSec: 1,
      now: () => t,
    });
    expect(rl.tryConsume("a")).toBe(true);
    expect(rl.tryConsume("a")).toBe(true);
    expect(rl.tryConsume("a")).toBe(true);
    expect(rl.tryConsume("a")).toBe(false); // bucket empty
  });

  it("refills over time", () => {
    let t = 0;
    const rl = createRateLimiter({
      capacity: 2,
      refillPerSec: 2,
      now: () => t,
    });
    expect(rl.tryConsume("a")).toBe(true);
    expect(rl.tryConsume("a")).toBe(true);
    expect(rl.tryConsume("a")).toBe(false);
    t = 1_000; // +1s => +2 tokens
    expect(rl.tryConsume("a")).toBe(true);
    expect(rl.tryConsume("a")).toBe(true);
    expect(rl.tryConsume("a")).toBe(false);
  });

  it("keeps buckets independent per key", () => {
    const t = 0;
    const rl = createRateLimiter({
      capacity: 1,
      refillPerSec: 1,
      now: () => t,
    });
    expect(rl.tryConsume("a")).toBe(true);
    expect(rl.tryConsume("b")).toBe(true); // different key, own bucket
    expect(rl.tryConsume("a")).toBe(false);
  });

  it("FIFO-evicts the oldest key past maxKeys (bounded memory)", () => {
    const t = 0;
    const rl = createRateLimiter({
      capacity: 1,
      refillPerSec: 1,
      maxKeys: 2,
      now: () => t,
    });
    expect(rl.tryConsume("a")).toBe(true); // a exhausted
    expect(rl.tryConsume("b")).toBe(true);
    expect(rl.tryConsume("c")).toBe(true); // evicts "a" (oldest)
    // "a" is gone, so it starts fresh (capacity available again)
    expect(rl.tryConsume("a")).toBe(true);
  });
});

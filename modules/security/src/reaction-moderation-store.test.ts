import { describe, expect, it } from "vitest";
import {
  InMemoryBotPermissionCache,
  InMemoryOncePerWindowGate,
  InMemoryReactionSurgeStore,
} from "./reaction-moderation-store.js";

const surgeStore = () =>
  new InMemoryReactionSurgeStore({
    maxTtlMs: 3_600_000,
    maxKeys: 3,
    maxActorsPerKey: 1000,
  });

describe("InMemoryReactionSurgeStore", () => {
  it("counts distinct actors seen at/after the caller's window start", () => {
    const store = surgeStore();
    store.record("k", "u1", 1000);
    store.record("k", "u2", 1500);
    // Same actor again → still 2 distinct (dedup by actor).
    store.record("k", "u1", 1600);
    expect(store.distinctSince("k", 0)).toBe(2);
  });

  it("lets the caller pick the counting window (per-group surgeWindowSeconds)", () => {
    const store = surgeStore();
    store.record("k", "u1", 0);
    store.record("k", "u2", 10_000);
    store.record("k", "u3", 40_000);
    // A 30s window ending at 40_000 only sees u2 and u3.
    expect(store.distinctSince("k", 40_000 - 30_000)).toBe(2);
    // A wide window sees all three.
    expect(store.distinctSince("k", 0)).toBe(3);
  });

  it("returns 0 for an unknown key", () => {
    expect(surgeStore().distinctSince("missing", 0)).toBe(0);
  });

  it("caps the number of tracked keys (FIFO memory bound)", () => {
    const store = surgeStore(); // maxKeys: 3
    store.record("a", "u", 1000);
    store.record("b", "u", 1000);
    store.record("c", "u", 1000);
    store.record("d", "u", 1000); // evicts "a"
    expect(store.size()).toBe(3);
    // "a" was evicted → its history is gone.
    expect(store.distinctSince("a", 0)).toBe(0);
  });

  it("caps distinct actors per key (FIFO) so a hostile flood cannot grow memory", () => {
    const store = new InMemoryReactionSurgeStore({
      maxTtlMs: 3_600_000,
      maxKeys: 10,
      maxActorsPerKey: 2,
    });
    store.record("k", "u1", 1000);
    store.record("k", "u2", 1001);
    store.record("k", "u3", 1002); // evicts the oldest actor (u1)
    expect(store.distinctSince("k", 0)).toBe(2);
  });

  it("prunes actors older than maxTtlMs on the next touch of the key", () => {
    const store = new InMemoryReactionSurgeStore({
      maxTtlMs: 30_000,
      maxKeys: 10,
      maxActorsPerKey: 1000,
    });
    store.record("k", "u1", 0);
    store.record("k", "u2", 1000);
    // Touching the key at 40_000 prunes u1/u2 (both older than the 30s TTL).
    store.record("k", "u3", 40_000);
    expect(store.distinctSince("k", 0)).toBe(1);
  });

  it("reset() clears a single key", () => {
    const store = surgeStore();
    store.record("k", "u1", 1000);
    store.reset("k");
    expect(store.distinctSince("k", 0)).toBe(0);
  });
});

describe("InMemoryOncePerWindowGate", () => {
  it("fires once per window per key", () => {
    const gate = new InMemoryOncePerWindowGate({
      windowMs: 60_000,
      maxKeys: 100,
    });
    expect(gate.shouldFire("chat:1", 0)).toBe(true);
    expect(gate.shouldFire("chat:1", 30_000)).toBe(false);
    // A different key is independent.
    expect(gate.shouldFire("chat:2", 30_000)).toBe(true);
    // After the window elapses, it fires again.
    expect(gate.shouldFire("chat:1", 70_000)).toBe(true);
  });

  it("bounds memory with a FIFO key cap", () => {
    const gate = new InMemoryOncePerWindowGate({
      windowMs: 60_000,
      maxKeys: 2,
    });
    gate.shouldFire("a", 0);
    gate.shouldFire("b", 0);
    gate.shouldFire("c", 0); // evicts "a"
    // "a" was evicted → it fires again immediately.
    expect(gate.shouldFire("a", 1000)).toBe(true);
  });

  it("rollback frees a reserved key so the next attempt fires again in the same window", () => {
    const gate = new InMemoryOncePerWindowGate({
      windowMs: 60_000,
      maxKeys: 100,
    });
    // Reserve the slot (as the wiring does BEFORE attempting the staff send).
    expect(gate.shouldFire("chat:1", 0)).toBe(true);
    // The send failed → roll the reservation back.
    gate.rollback("chat:1");
    // A retry in the SAME window must fire — the failed attempt did not consume
    // the gate. Without rollback this would be suppressed until the window ends.
    expect(gate.shouldFire("chat:1", 1000)).toBe(true);
    // And having now fired successfully, it is once-per-window again.
    expect(gate.shouldFire("chat:1", 2000)).toBe(false);
  });

  it("rollback of an unknown key is a harmless no-op", () => {
    const gate = new InMemoryOncePerWindowGate({
      windowMs: 60_000,
      maxKeys: 100,
    });
    gate.rollback("never-seen");
    expect(gate.shouldFire("never-seen", 0)).toBe(true);
  });
});

describe("InMemoryBotPermissionCache", () => {
  const cache = () =>
    new InMemoryBotPermissionCache({ ttlMs: 60_000, maxKeys: 3 });

  it("caches a confirmed permission and serves it without re-resolving", async () => {
    const store = cache();
    let calls = 0;
    const resolve = async () => {
      calls += 1;
      return true;
    };
    expect(await store.get("k", 0, resolve)).toBe(true);
    expect(await store.get("k", 1000, resolve)).toBe(true);
    expect(calls).toBe(1);
  });

  it("re-resolves after the TTL expires", async () => {
    const store = cache();
    let calls = 0;
    const resolve = async () => {
      calls += 1;
      return calls === 1;
    };
    expect(await store.get("k", 0, resolve)).toBe(true);
    // Past the 60s TTL → resolve runs again.
    expect(await store.get("k", 70_000, resolve)).toBe(false);
    expect(calls).toBe(2);
  });

  it("never caches an unknown (undefined) result — it retries next time", async () => {
    const store = cache();
    let calls = 0;
    const resolve = async () => {
      calls += 1;
      return calls === 1 ? undefined : true;
    };
    expect(await store.get("k", 0, resolve)).toBeUndefined();
    // The transient failure was NOT pinned as "no"; the next call re-resolves.
    expect(await store.get("k", 1000, resolve)).toBe(true);
    expect(calls).toBe(2);
  });

  it("single-flights concurrent resolves for the same key", async () => {
    const store = cache();
    let calls = 0;
    let release: (() => void) | undefined;
    const resolve = () =>
      new Promise<boolean>((resolveInner) => {
        calls += 1;
        release = () => resolveInner(true);
      });
    const first = store.get("k", 0, resolve);
    const second = store.get("k", 0, resolve);
    release?.();
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    // Only ONE getChatMember despite two concurrent callers.
    expect(calls).toBe(1);
  });

  it("invalidate() forces a re-resolve (my_chat_member / 400 / 403)", async () => {
    const store = cache();
    let calls = 0;
    const resolve = async () => {
      calls += 1;
      return calls === 1;
    };
    expect(await store.get("k", 0, resolve)).toBe(true);
    store.invalidate("k");
    expect(await store.get("k", 1000, resolve)).toBe(false);
    expect(calls).toBe(2);
  });

  it("bounds memory with a FIFO key cap", async () => {
    const store = cache(); // maxKeys: 3
    const yes = async () => true;
    await store.get("a", 0, yes);
    await store.get("b", 0, yes);
    await store.get("c", 0, yes);
    await store.get("d", 0, yes); // evicts "a"
    expect(store.size()).toBe(3);
  });
});

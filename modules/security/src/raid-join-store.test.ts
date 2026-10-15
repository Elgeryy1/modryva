import { describe, expect, it } from "vitest";
import { InMemoryRaidJoinNameStore } from "./raid-join-store.js";

describe("InMemoryRaidJoinNameStore", () => {
  it("returns every join still inside the window, in insertion order", async () => {
    const store = new InMemoryRaidJoinNameStore();
    const key = "raid:1";

    await store.record(key, "alice", 0, 10);
    await store.record(key, "alice2", 4_000, 10);
    const result = await store.record(key, "alice3", 9_000, 10);

    expect(result).toEqual([
      { name: "alice", ms: 0 },
      { name: "alice2", ms: 4_000 },
      { name: "alice3", ms: 9_000 },
    ]);
  });

  it("drops joins that fall outside the rolling window", async () => {
    const store = new InMemoryRaidJoinNameStore();
    const key = "raid:2";

    await store.record(key, "bob", 0, 10);
    const result = await store.record(key, "carol", 11_000, 10);

    expect(result).toEqual([{ name: "carol", ms: 11_000 }]);
  });

  it("keeps separate buckets per key", async () => {
    const store = new InMemoryRaidJoinNameStore();

    await store.record("chatA", "dave", 0, 10);
    const resultB = await store.record("chatB", "erin", 0, 10);

    expect(resultB).toEqual([{ name: "erin", ms: 0 }]);
  });

  it("reset clears the bucket for a key", async () => {
    const store = new InMemoryRaidJoinNameStore();
    const key = "raid:3";

    await store.record(key, "frank", 0, 10);
    await store.reset(key);
    const result = await store.record(key, "gina", 1_000, 10);

    expect(result).toEqual([{ name: "gina", ms: 1_000 }]);
  });

  it("keeps the window boundary inclusive, matching FloodCounterStore semantics", async () => {
    const store = new InMemoryRaidJoinNameStore();
    const key = "raid:4";

    await store.record(key, "henry", 0, 10);
    const result = await store.record(key, "iris", 10_000, 10);

    expect(result).toEqual([
      { name: "henry", ms: 0 },
      { name: "iris", ms: 10_000 },
    ]);
  });
});

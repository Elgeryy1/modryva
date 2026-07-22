import { describe, expect, it } from "vitest";
import { InMemoryJobOutboxRepository } from "./job-outbox-repository.js";

describe("InMemoryJobOutboxRepository", () => {
  it("enqueues a job in pending state with zero attempts", async () => {
    const repo = new InMemoryJobOutboxRepository();
    const job = await repo.enqueue("t1", "guardian.staff-report", {
      sessionId: "s1",
    });
    expect(job.state).toBe("pending");
    expect(job.attempts).toBe(0);
    expect(job.payload).toEqual({ sessionId: "s1" });
  });

  it("claim only returns pending jobs whose runAfter has elapsed", async () => {
    const repo = new InMemoryJobOutboxRepository();
    const now = new Date("2026-01-01T00:00:00Z");
    const ready = await repo.enqueue("t1", "topic", { n: 1 });
    const notYet = await repo.enqueue(
      "t1",
      "topic",
      { n: 2 },
      new Date(now.getTime() + 60_000),
    );

    const claimed = await repo.claim("topic", now, 30_000);
    expect(claimed.map((j) => j.id)).toEqual([ready.id]);
    expect(claimed[0]?.state).toBe("processing");

    // notYet is still pending and untouched.
    const secondClaim = await repo.claim("topic", now, 30_000);
    expect(secondClaim).toHaveLength(0);
    void notYet;
  });

  it("claim reclaims stuck processing jobs past staleAfterMs", async () => {
    const repo = new InMemoryJobOutboxRepository();
    const t0 = new Date("2026-01-01T00:00:00Z");
    const job = await repo.enqueue("t1", "topic", { n: 1 });
    await repo.claim("topic", t0, 30_000);

    const soon = new Date(t0.getTime() + 10_000);
    expect(await repo.claim("topic", soon, 30_000)).toHaveLength(0);

    const later = new Date(t0.getTime() + 40_000);
    const reclaimed = await repo.claim("topic", later, 30_000);
    expect(reclaimed.map((j) => j.id)).toEqual([job.id]);
  });

  it("claim respects topic and limit", async () => {
    const repo = new InMemoryJobOutboxRepository();
    const now = new Date();
    await repo.enqueue("t1", "topic-a", { n: 1 });
    await repo.enqueue("t1", "topic-b", { n: 2 });
    await repo.enqueue("t1", "topic-a", { n: 3 });

    const claimed = await repo.claim("topic-a", now, 30_000, 1);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.payload).toEqual({ n: 1 });
  });

  it("complete marks a job done", async () => {
    const repo = new InMemoryJobOutboxRepository();
    const job = await repo.enqueue("t1", "topic", { n: 1 });
    expect(await repo.complete(job.id)).toBe(true);
    const claimed = await repo.claim("topic", new Date(), 30_000);
    expect(claimed).toHaveLength(0);
  });

  it("complete returns false for a non-existent job", async () => {
    const repo = new InMemoryJobOutboxRepository();
    expect(await repo.complete("nope")).toBe(false);
  });

  it("fail with retryAt bumps attempts and reschedules as pending", async () => {
    const repo = new InMemoryJobOutboxRepository();
    const job = await repo.enqueue("t1", "topic", { n: 1 });
    const retryAt = new Date(Date.now() + 5_000);
    expect(
      await repo.fail(job.id, { retryAt, error: "timeout" }),
    ).toBe(true);

    const now = new Date();
    expect(await repo.claim("topic", now, 30_000)).toHaveLength(0);
    const claimed = await repo.claim("topic", retryAt, 30_000);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.attempts).toBe(1);
    expect(claimed[0]?.lastError).toBe("timeout");
    expect(claimed[0]?.state).toBe("processing");
  });

  it("fail without retryAt marks the job permanently failed", async () => {
    const repo = new InMemoryJobOutboxRepository();
    const job = await repo.enqueue("t1", "topic", { n: 1 });
    expect(await repo.fail(job.id, { error: "gave up" })).toBe(true);
    const claimed = await repo.claim("topic", new Date(), 30_000);
    expect(claimed).toHaveLength(0);
  });

  it("fail returns false for a non-existent job", async () => {
    const repo = new InMemoryJobOutboxRepository();
    expect(await repo.fail("nope")).toBe(false);
  });
});

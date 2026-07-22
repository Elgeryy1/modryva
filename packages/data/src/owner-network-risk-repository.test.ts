import { describe, expect, it } from "vitest";
import {
  classifyRisk,
  InMemoryOwnerNetworkRiskRepository,
  RISK_THRESHOLDS,
} from "./owner-network-risk-repository.js";

describe("classifyRisk", () => {
  it("classifies score below low threshold as none", () => {
    expect(classifyRisk(0)).toBe("none");
    expect(classifyRisk(RISK_THRESHOLDS.low - 1)).toBe("none");
  });

  it("classifies score at low threshold as low", () => {
    expect(classifyRisk(RISK_THRESHOLDS.low)).toBe("low");
  });

  it("classifies score just below medium threshold as low", () => {
    expect(classifyRisk(RISK_THRESHOLDS.medium - 1)).toBe("low");
  });

  it("classifies score at medium threshold as medium", () => {
    expect(classifyRisk(RISK_THRESHOLDS.medium)).toBe("medium");
  });

  it("classifies score just below high threshold as medium", () => {
    expect(classifyRisk(RISK_THRESHOLDS.high - 1)).toBe("medium");
  });

  it("classifies score at high threshold as high", () => {
    expect(classifyRisk(RISK_THRESHOLDS.high)).toBe("high");
  });

  it("classifies exact boundary values 4,5,11,12,19,20", () => {
    expect(classifyRisk(4)).toBe("none");
    expect(classifyRisk(5)).toBe("low");
    expect(classifyRisk(11)).toBe("low");
    expect(classifyRisk(12)).toBe("medium");
    expect(classifyRisk(19)).toBe("medium");
    expect(classifyRisk(20)).toBe("high");
  });
});

describe("InMemoryOwnerNetworkRiskRepository", () => {
  it("weights a single deleted signal as +2", async () => {
    const repo = new InMemoryOwnerNetworkRiskRepository();
    const profile = await repo.recordSignal("t1", "f1", 1n, "c1", "deleted");
    expect(profile.score).toBe(2);
    expect(profile.deletedCount).toBe(1);
  });

  it("weights a single report signal as +3", async () => {
    const repo = new InMemoryOwnerNetworkRiskRepository();
    const profile = await repo.recordSignal("t1", "f1", 1n, "c1", "report");
    expect(profile.score).toBe(3);
    expect(profile.reportCount).toBe(1);
  });

  it("weights a single quarantine signal as +5", async () => {
    const repo = new InMemoryOwnerNetworkRiskRepository();
    const profile = await repo.recordSignal("t1", "f1", 1n, "c1", "quarantine");
    expect(profile.score).toBe(5);
    expect(profile.quarantineCount).toBe(1);
  });

  it("weights a single link signal as +1", async () => {
    const repo = new InMemoryOwnerNetworkRiskRepository();
    const profile = await repo.recordSignal("t1", "f1", 1n, "c1", "link");
    expect(profile.score).toBe(1);
    expect(profile.linkCount).toBe(1);
  });

  it("weights a single sanction signal as +8", async () => {
    const repo = new InMemoryOwnerNetworkRiskRepository();
    const profile = await repo.recordSignal("t1", "f1", 1n, "c1", "sanction");
    expect(profile.score).toBe(8);
    expect(profile.sanctionCount).toBe(1);
  });

  it("accumulates and recalculates score across mixed signals", async () => {
    const repo = new InMemoryOwnerNetworkRiskRepository();
    await repo.recordSignal("t1", "f1", 1n, "c1", "deleted");
    await repo.recordSignal("t1", "f1", 1n, "c1", "deleted");
    await repo.recordSignal("t1", "f1", 1n, "c1", "report");
    const profile = await repo.recordSignal("t1", "f1", 1n, "c1", "sanction");
    // 2 deleted*2 + 1 report*3 + 1 sanction*8 = 4 + 3 + 8 = 15
    expect(profile.score).toBe(15);
    expect(profile.deletedCount).toBe(2);
    expect(profile.reportCount).toBe(1);
    expect(profile.sanctionCount).toBe(1);
  });

  it("adds chatIds without duplicating an already-seen chat", async () => {
    const repo = new InMemoryOwnerNetworkRiskRepository();
    await repo.recordSignal("t1", "f1", 1n, "c1", "deleted");
    await repo.recordSignal("t1", "f1", 1n, "c1", "deleted");
    const profile = await repo.recordSignal("t1", "f1", 1n, "c2", "report");
    expect(profile.chatIds).toEqual(["c1", "c2"]);
  });

  it("getProfile returns null for an unknown user", async () => {
    const repo = new InMemoryOwnerNetworkRiskRepository();
    const profile = await repo.getProfile("f1", 999n);
    expect(profile).toBeNull();
  });

  it("getProfile returns the stored profile", async () => {
    const repo = new InMemoryOwnerNetworkRiskRepository();
    await repo.recordSignal("t1", "f1", 1n, "c1", "report");
    const profile = await repo.getProfile("f1", 1n);
    expect(profile).not.toBeNull();
    expect(profile?.score).toBe(3);
  });

  it("listTopRisk orders profiles by score descending", async () => {
    const repo = new InMemoryOwnerNetworkRiskRepository();
    await repo.recordSignal("t1", "f1", 1n, "c1", "link"); // score 1
    await repo.recordSignal("t1", "f1", 2n, "c1", "sanction"); // score 8
    await repo.recordSignal("t1", "f1", 3n, "c1", "report"); // score 3

    const top = await repo.listTopRisk("f1");
    expect(top.map((p) => p.telegramUserId)).toEqual([2n, 3n, 1n]);
  });

  it("listTopRisk respects the limit", async () => {
    const repo = new InMemoryOwnerNetworkRiskRepository();
    await repo.recordSignal("t1", "f1", 1n, "c1", "sanction");
    await repo.recordSignal("t1", "f1", 2n, "c1", "report");
    await repo.recordSignal("t1", "f1", 3n, "c1", "link");

    const top = await repo.listTopRisk("f1", 2);
    expect(top).toHaveLength(2);
    expect(top.map((p) => p.telegramUserId)).toEqual([1n, 2n]);
  });

  it("listTopRisk only returns profiles for the given fedId", async () => {
    const repo = new InMemoryOwnerNetworkRiskRepository();
    await repo.recordSignal("t1", "f1", 1n, "c1", "sanction");
    await repo.recordSignal("t1", "f2", 2n, "c1", "sanction");

    const top = await repo.listTopRisk("f1");
    expect(top.map((p) => p.telegramUserId)).toEqual([1n]);
  });

  it("resetProfile clears the stored profile", async () => {
    const repo = new InMemoryOwnerNetworkRiskRepository();
    await repo.recordSignal("t1", "f1", 1n, "c1", "sanction");
    await repo.resetProfile("f1", 1n);
    const profile = await repo.getProfile("f1", 1n);
    expect(profile).toBeNull();
  });

  it("resetProfile does not affect other users", async () => {
    const repo = new InMemoryOwnerNetworkRiskRepository();
    await repo.recordSignal("t1", "f1", 1n, "c1", "sanction");
    await repo.recordSignal("t1", "f1", 2n, "c1", "report");
    await repo.resetProfile("f1", 1n);
    const remaining = await repo.getProfile("f1", 2n);
    expect(remaining).not.toBeNull();
  });
});

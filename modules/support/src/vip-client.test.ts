import { describe, expect, it } from "vitest";
import { applyVipTreatment } from "./vip-client.js";

describe("applyVipTreatment", () => {
  it("marks vip plan and halves the base SLA", () => {
    expect(applyVipTreatment({ plan: "vip", baseMinutes: 30 })).toEqual({
      vip: true,
      slaMinutes: 15,
    });
  });

  it("keeps the base SLA unchanged for pro plan", () => {
    expect(applyVipTreatment({ plan: "pro", baseMinutes: 30 })).toEqual({
      vip: false,
      slaMinutes: 30,
    });
  });

  it("keeps the base SLA unchanged for free plan", () => {
    expect(applyVipTreatment({ plan: "free", baseMinutes: 45 })).toEqual({
      vip: false,
      slaMinutes: 45,
    });
  });

  it("rounds the halved SLA for odd base minutes", () => {
    expect(applyVipTreatment({ plan: "vip", baseMinutes: 15 })).toEqual({
      vip: true,
      slaMinutes: 8,
    });
  });

  it("returns zero SLA for a vip plan with zero base minutes", () => {
    expect(applyVipTreatment({ plan: "vip", baseMinutes: 0 })).toEqual({
      vip: true,
      slaMinutes: 0,
    });
  });

  it("sanitizes negative base minutes to zero", () => {
    expect(applyVipTreatment({ plan: "pro", baseMinutes: -10 })).toEqual({
      vip: false,
      slaMinutes: 0,
    });
  });

  it("sanitizes non-finite base minutes to zero", () => {
    expect(
      applyVipTreatment({ plan: "vip", baseMinutes: Number.POSITIVE_INFINITY }),
    ).toEqual({ vip: true, slaMinutes: 0 });
  });

  it("rounds fractional base minutes before applying treatment", () => {
    expect(applyVipTreatment({ plan: "free", baseMinutes: 12.6 })).toEqual({
      vip: false,
      slaMinutes: 13,
    });
  });

  it("is deterministic across repeated calls with the same input", () => {
    const input = { plan: "vip", baseMinutes: 40 } as const;
    const first = applyVipTreatment(input);
    const second = applyVipTreatment(input);
    expect(first).toEqual(second);
    expect(first).toEqual({ vip: true, slaMinutes: 20 });
  });
});

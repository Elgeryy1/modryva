import { describe, expect, it } from "vitest";
import { checkDailyQuota } from "./daily-quota.js";

describe("checkDailyQuota", () => {
  it("reports remaining missions when the quota is not reached", () => {
    expect(checkDailyQuota({ doneToday: 0, cap: 3 })).toEqual({
      allowed: true,
      remaining: 3,
      message: "✅ Aún puedes completar 3 misiones hoy.",
    });
  });

  it("uses the singular noun when exactly one mission remains", () => {
    expect(checkDailyQuota({ doneToday: 2, cap: 3 })).toEqual({
      allowed: true,
      remaining: 1,
      message: "✅ Aún puedes completar 1 misión hoy.",
    });
  });

  it("blocks and reports the cap when it is reached exactly", () => {
    expect(checkDailyQuota({ doneToday: 3, cap: 3 })).toEqual({
      allowed: false,
      remaining: 0,
      message:
        "🎯 Ya completaste tu cupo diario de 3 misiones. ¡Vuelve mañana!",
    });
  });

  it("clamps overshoot so remaining stays at zero", () => {
    expect(checkDailyQuota({ doneToday: 5, cap: 3 })).toEqual({
      allowed: false,
      remaining: 0,
      message:
        "🎯 Ya completaste tu cupo diario de 3 misiones. ¡Vuelve mañana!",
    });
  });

  it("treats a zero cap as no missions available today", () => {
    expect(checkDailyQuota({ doneToday: 0, cap: 0 })).toEqual({
      allowed: false,
      remaining: 0,
      message: "🚫 No hay misiones disponibles hoy.",
    });
  });

  it("uses the singular noun in the cap-reached message", () => {
    expect(checkDailyQuota({ doneToday: 1, cap: 1 })).toEqual({
      allowed: false,
      remaining: 0,
      message: "🎯 Ya completaste tu cupo diario de 1 misión. ¡Vuelve mañana!",
    });
  });

  it("clamps a negative doneToday to zero", () => {
    expect(checkDailyQuota({ doneToday: -5, cap: 3 })).toEqual({
      allowed: true,
      remaining: 3,
      message: "✅ Aún puedes completar 3 misiones hoy.",
    });
  });

  it("floors fractional counts before computing", () => {
    expect(checkDailyQuota({ doneToday: 1.9, cap: 3.5 })).toEqual({
      allowed: true,
      remaining: 2,
      message: "✅ Aún puedes completar 2 misiones hoy.",
    });
  });

  it("treats a negative cap as no missions available today", () => {
    expect(checkDailyQuota({ doneToday: 0, cap: -2 })).toEqual({
      allowed: false,
      remaining: 0,
      message: "🚫 No hay misiones disponibles hoy.",
    });
  });

  it("is deterministic for the same input", () => {
    const input = { doneToday: 2, cap: 5 } as const;
    expect(checkDailyQuota(input)).toEqual(checkDailyQuota(input));
  });

  it("never increases remaining as doneToday grows", () => {
    const cap = 4;
    const sequence = [0, 1, 2, 3, 4, 5].map(
      (done) => checkDailyQuota({ doneToday: done, cap }).remaining,
    );
    expect(sequence).toEqual([4, 3, 2, 1, 0, 0]);
  });
});

import { describe, expect, it } from "vitest";
import { computeAntiToxicityReward } from "./anti-toxicity-reward.js";

describe("computeAntiToxicityReward", () => {
  it("grants the default reward at exactly the target streak", () => {
    expect(computeAntiToxicityReward(7)).toEqual({
      earned: true,
      reward: 100,
      daysRemaining: 0,
      message:
        "🎉 ¡Reto anti-toxicidad superado! 7 días sin sanciones: recompensa global de 100 fichas. 🛡️",
    });
  });

  it("reports a single remaining day with singular wording", () => {
    expect(computeAntiToxicityReward(6)).toEqual({
      earned: false,
      reward: 0,
      daysRemaining: 1,
      message:
        "💪 Reto anti-toxicidad en curso: falta 1 día sin sanciones para la recompensa global.",
    });
  });

  it("uses plural wording for multiple remaining days from a zero streak", () => {
    expect(computeAntiToxicityReward(0)).toEqual({
      earned: false,
      reward: 0,
      daysRemaining: 7,
      message:
        "💪 Reto anti-toxicidad en curso: faltan 7 días sin sanciones para la recompensa global.",
    });
  });

  it("honors custom targetDays and reward when earned", () => {
    expect(
      computeAntiToxicityReward(5, { targetDays: 5, reward: 250 }),
    ).toEqual({
      earned: true,
      reward: 250,
      daysRemaining: 0,
      message:
        "🎉 ¡Reto anti-toxicidad superado! 5 días sin sanciones: recompensa global de 250 fichas. 🛡️",
    });
  });

  it("computes the gap against a custom target when not yet earned", () => {
    expect(
      computeAntiToxicityReward(3, { targetDays: 5, reward: 250 }),
    ).toEqual({
      earned: false,
      reward: 0,
      daysRemaining: 2,
      message:
        "💪 Reto anti-toxicidad en curso: faltan 2 días sin sanciones para la recompensa global.",
    });
  });

  it("clamps negative day counts to zero", () => {
    expect(computeAntiToxicityReward(-3)).toEqual({
      earned: false,
      reward: 0,
      daysRemaining: 7,
      message:
        "💪 Reto anti-toxicidad en curso: faltan 7 días sin sanciones para la recompensa global.",
    });
  });

  it("floors fractional day counts before comparing", () => {
    expect(computeAntiToxicityReward(7.9)).toEqual({
      earned: true,
      reward: 100,
      daysRemaining: 0,
      message:
        "🎉 ¡Reto anti-toxicidad superado! 7 días sin sanciones: recompensa global de 100 fichas. 🛡️",
    });
  });

  it("falls back to the default target when an invalid target is given", () => {
    expect(computeAntiToxicityReward(2, { targetDays: 0 })).toEqual({
      earned: false,
      reward: 0,
      daysRemaining: 5,
      message:
        "💪 Reto anti-toxicidad en curso: faltan 5 días sin sanciones para la recompensa global.",
    });
  });

  it("allows a zero reward to be configured", () => {
    expect(computeAntiToxicityReward(7, { reward: 0 })).toEqual({
      earned: true,
      reward: 0,
      daysRemaining: 0,
      message:
        "🎉 ¡Reto anti-toxicidad superado! 7 días sin sanciones: recompensa global de 0 fichas. 🛡️",
    });
  });

  it("treats non-finite day counts as a zero streak", () => {
    expect(computeAntiToxicityReward(Number.NaN)).toEqual({
      earned: false,
      reward: 0,
      daysRemaining: 7,
      message:
        "💪 Reto anti-toxicidad en curso: faltan 7 días sin sanciones para la recompensa global.",
    });
  });

  it("is deterministic across repeated identical calls", () => {
    const first = computeAntiToxicityReward(4, { targetDays: 10, reward: 500 });
    const second = computeAntiToxicityReward(4, {
      targetDays: 10,
      reward: 500,
    });
    expect(first).toEqual(second);
    expect(first).toEqual({
      earned: false,
      reward: 0,
      daysRemaining: 6,
      message:
        "💪 Reto anti-toxicidad en curso: faltan 6 días sin sanciones para la recompensa global.",
    });
  });
});

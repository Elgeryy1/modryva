import { describe, expect, it } from "vitest";
import { predictSanctionEffect } from "./sanction-effect.js";

describe("predictSanctionEffect", () => {
  it("predicts calma for a light sanction on a brand-new user", () => {
    expect(
      predictSanctionEffect({
        severity: 1,
        userTenureDays: 0,
        hasSupporters: false,
      }),
    ).toEqual({ effect: "calma", score: -27 });
  });

  it("predicts empeora for a harsh sanction on a supported veteran", () => {
    expect(
      predictSanctionEffect({
        severity: 9,
        userTenureDays: 365,
        hasSupporters: true,
      }),
    ).toEqual({ effect: "empeora", score: 117 });
  });

  it("predicts neutral for a mid-severity sanction on a new user", () => {
    expect(
      predictSanctionEffect({
        severity: 5,
        userTenureDays: 0,
        hasSupporters: false,
      }),
    ).toEqual({ effect: "neutral", score: 40 });
  });

  it("clamps severity above 10", () => {
    expect(
      predictSanctionEffect({
        severity: 15,
        userTenureDays: 1000,
        hasSupporters: true,
      }),
    ).toEqual({ effect: "empeora", score: 125 });
  });

  it("clamps negative severity to zero and calms", () => {
    expect(
      predictSanctionEffect({
        severity: -5,
        userTenureDays: 0,
        hasSupporters: false,
      }),
    ).toEqual({ effect: "calma", score: -35 });
  });

  it("supporters can flip a neutral sanction into empeora", () => {
    expect(
      predictSanctionEffect({
        severity: 6,
        userTenureDays: 0,
        hasSupporters: false,
      }),
    ).toEqual({ effect: "neutral", score: 48 });
    expect(
      predictSanctionEffect({
        severity: 6,
        userTenureDays: 0,
        hasSupporters: true,
      }),
    ).toEqual({ effect: "empeora", score: 73 });
  });

  it("high tenure escalates the same sanction", () => {
    expect(
      predictSanctionEffect({
        severity: 6,
        userTenureDays: 365,
        hasSupporters: false,
      }),
    ).toEqual({ effect: "empeora", score: 68 });
  });

  it("applies the light-sanction calming bonus at the severity 3 boundary", () => {
    expect(
      predictSanctionEffect({
        severity: 3,
        userTenureDays: 0,
        hasSupporters: false,
      }),
    ).toEqual({ effect: "calma", score: -11 });
    expect(
      predictSanctionEffect({
        severity: 4,
        userTenureDays: 0,
        hasSupporters: false,
      }),
    ).toEqual({ effect: "neutral", score: 32 });
  });

  it("rounds the score to an integer for partial tenure", () => {
    expect(
      predictSanctionEffect({
        severity: 5,
        userTenureDays: 182,
        hasSupporters: false,
      }),
    ).toEqual({ effect: "neutral", score: 50 });
  });

  it("is deterministic for identical inputs", () => {
    const input = {
      severity: 7,
      userTenureDays: 100,
      hasSupporters: true,
    } as const;
    expect(predictSanctionEffect(input)).toEqual(predictSanctionEffect(input));
  });
});

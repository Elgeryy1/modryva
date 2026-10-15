import { describe, expect, it } from "vitest";
import { parsePoleArgs, periodLabel } from "./pole-command.js";
import { autoPoleVerdict, describeVerdict } from "./pole-eligibility.js";
import { parseRouletteArgs } from "./roulette-command.js";

describe("parsePoleArgs", () => {
  it("treats a bare /pole as the claim", () => {
    expect(parsePoleArgs([])).toEqual({ kind: "claim" });
    expect(parsePoleArgs([""])).toEqual({ kind: "claim" });
  });

  it("does NOT spend the day's claim on a typo", () => {
    // `/pole raking` must show help, not silently take the pole.
    expect(parsePoleArgs(["raking"])).toEqual({ kind: "help" });
  });

  it("reads the reports", () => {
    expect(parsePoleArgs(["hoy"])).toEqual({ kind: "today" });
    expect(parsePoleArgs(["racha"])).toEqual({ kind: "streak" });
    expect(parsePoleArgs(["records"])).toEqual({ kind: "records" });
    expect(parsePoleArgs(["config"])).toEqual({ kind: "config" });
  });

  it("survives accents and capitals, because phones do that", () => {
    expect(parsePoleArgs(["RÉCORDS"])).toEqual({ kind: "records" });
    expect(parsePoleArgs(["Récords"])).toEqual({ kind: "records" });
    expect(parsePoleArgs(["ranking", "AÑO"])).toEqual({
      kind: "ranking",
      period: "year",
    });
    expect(parsePoleArgs(["ranking", "ano"])).toEqual({
      kind: "ranking",
      period: "year",
    });
  });

  it("defaults a ranking with no period to the whole history", () => {
    expect(parsePoleArgs(["ranking"])).toEqual({
      kind: "ranking",
      period: "all",
    });
    expect(parsePoleArgs(["ranking", "basura"])).toEqual({
      kind: "ranking",
      period: "all",
    });
  });

  it("labels the periods in Spanish", () => {
    expect(periodLabel("day")).toBe("hoy");
    expect(periodLabel("month")).toBe("este mes");
    expect(periodLabel("year")).toBe("este año");
    expect(periodLabel("all")).toBe("histórico");
  });
});

describe("parseRouletteArgs", () => {
  it("spins on a bare command", () => {
    expect(parseRouletteArgs([])).toEqual({ kind: "spin" });
  });

  it("offers no way to name a target", () => {
    // The report requires the default to act on the caller (§6.2). A parser
    // that cannot express "someone else" is a rule nobody can forget.
    expect(parseRouletteArgs(["@otro"])).toEqual({ kind: "help" });
    expect(parseRouletteArgs(["123456789"])).toEqual({ kind: "help" });
  });

  it("reads estado and config", () => {
    expect(parseRouletteArgs(["estado"])).toEqual({ kind: "status" });
    expect(parseRouletteArgs(["config"])).toEqual({ kind: "config" });
  });
});

describe("autoPoleVerdict", () => {
  const base = {
    isTextMessage: true,
    hasCommand: false,
    senderIsBot: false,
    senderUserId: 111n,
    isAnonymousSender: false,
    isServiceMessage: false,
    hasMedia: false,
    isEdit: false,
  };

  it("lets a plain human message win the day", () => {
    expect(autoPoleVerdict(base, false)).toEqual({ eligible: true });
  });

  it("keeps bots out of the competition", () => {
    expect(autoPoleVerdict({ ...base, senderIsBot: true }, false)).toEqual({
      eligible: false,
      reason: "bot",
    });
  });

  it("refuses an anonymous admin, who is not a person to award", () => {
    expect(
      autoPoleVerdict({ ...base, isAnonymousSender: true }, false),
    ).toEqual({ eligible: false, reason: "anonymous" });
  });

  it("ignores join/leave notices", () => {
    expect(autoPoleVerdict({ ...base, isServiceMessage: true }, false)).toEqual(
      { eligible: false, reason: "service" },
    );
  });

  it("does not let an edit count as an arrival", () => {
    expect(autoPoleVerdict({ ...base, isEdit: true }, false)).toEqual({
      eligible: false,
      reason: "edit",
    });
  });

  it("does not let a command double as an accidental pole", () => {
    expect(autoPoleVerdict({ ...base, hasCommand: true }, false)).toEqual({
      eligible: false,
      reason: "command",
    });
  });

  it("honours the group's choice about media", () => {
    const sticker = { ...base, isTextMessage: false, hasMedia: true };
    expect(autoPoleVerdict(sticker, false)).toEqual({
      eligible: false,
      reason: "media-not-allowed",
    });
    expect(autoPoleVerdict(sticker, true)).toEqual({ eligible: true });
  });

  it("checks the cheap disqualifiers before the expensive ones", () => {
    // A service message from a bot reports as a service message: the order of
    // the checks is part of the contract, since only one reason is shown.
    expect(
      autoPoleVerdict(
        { ...base, isServiceMessage: true, senderIsBot: true },
        false,
      ).eligible,
    ).toBe(false);
  });

  it("always has something to say about a refusal", () => {
    const refusals = [
      { ...base, senderIsBot: true },
      { ...base, isAnonymousSender: true },
      { ...base, isServiceMessage: true },
      { ...base, isEdit: true },
      { ...base, hasCommand: true },
      { ...base, isTextMessage: false, hasMedia: true },
      { ...base, isTextMessage: false, hasMedia: false },
      { ...base, senderUserId: undefined },
    ];
    for (const candidate of refusals) {
      const verdict = autoPoleVerdict(candidate, false);
      expect(verdict.eligible).toBe(false);
      expect(describeVerdict(verdict)).toBeTruthy();
    }
    expect(describeVerdict({ eligible: true })).toBeNull();
  });
});

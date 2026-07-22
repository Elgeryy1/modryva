import { describe, expect, it } from "vitest";
import { guardImpulsiveAction } from "./impulsive-guard.js";

describe("guardImpulsiveAction", () => {
  it("allows non-destructive actions immediately", () => {
    expect(
      guardImpulsiveAction({ action: "warn", confirmed: false, waitedMs: 0 })
        .allowed,
    ).toBe(true);
  });

  it("blocks an unconfirmed destructive action", () => {
    expect(
      guardImpulsiveAction({
        action: "global_ban",
        confirmed: false,
        waitedMs: 20000,
      }).allowed,
    ).toBe(false);
  });

  it("blocks a confirmed destructive action without enough wait", () => {
    expect(
      guardImpulsiveAction({
        action: "purge",
        confirmed: true,
        waitedMs: 1000,
      }).allowed,
    ).toBe(false);
  });

  it("allows a confirmed destructive action after the wait", () => {
    expect(
      guardImpulsiveAction({
        action: "mass_ban",
        confirmed: true,
        waitedMs: 15000,
      }).allowed,
    ).toBe(true);
  });

  it("is case and whitespace insensitive on the action", () => {
    expect(
      guardImpulsiveAction({
        action: "  GLOBAL_BAN ",
        confirmed: false,
        waitedMs: 0,
      }).allowed,
    ).toBe(false);
  });
});

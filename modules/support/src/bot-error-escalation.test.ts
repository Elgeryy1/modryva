import { describe, expect, it } from "vitest";
import { shouldEscalateBotError } from "./bot-error-escalation.js";

describe("shouldEscalateBotError", () => {
  it("escalates a disputed low-confidence auto-action", () => {
    expect(
      shouldEscalateBotError({
        botConfidence: 0.5,
        userDisputes: true,
        autoActioned: true,
      }).escalate,
    ).toBe(true);
  });

  it("does not escalate when confidence is high", () => {
    expect(
      shouldEscalateBotError({
        botConfidence: 0.9,
        userDisputes: true,
        autoActioned: true,
      }).escalate,
    ).toBe(false);
  });

  it("does not escalate when the user does not dispute", () => {
    expect(
      shouldEscalateBotError({
        botConfidence: 0.1,
        userDisputes: false,
        autoActioned: true,
      }).escalate,
    ).toBe(false);
  });

  it("does not escalate a manual action", () => {
    expect(
      shouldEscalateBotError({
        botConfidence: 0.1,
        userDisputes: true,
        autoActioned: false,
      }).escalate,
    ).toBe(false);
  });

  it("honors a custom minConfidence", () => {
    expect(
      shouldEscalateBotError(
        { botConfidence: 0.8, userDisputes: true, autoActioned: true },
        { minConfidence: 0.9 },
      ).escalate,
    ).toBe(true);
  });

  it("always returns a reason string", () => {
    expect(
      shouldEscalateBotError({
        botConfidence: 1,
        userDisputes: false,
        autoActioned: false,
      }).reason.length,
    ).toBeGreaterThan(0);
  });
});

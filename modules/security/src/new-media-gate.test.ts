import { describe, expect, it } from "vitest";
import {
  NEW_MEDIA_GATE_DEFAULT_MAX_AGE_DAYS,
  NEW_MEDIA_GATE_DEFAULT_MAX_MESSAGES,
  type NewMediaGateOptions,
  type NewMediaGateUser,
  shouldGateFirstMedia,
} from "./new-media-gate.js";

const user = (overrides: Partial<NewMediaGateUser> = {}): NewMediaGateUser => ({
  messageCount: 0,
  ageDays: 0,
  ...overrides,
});

describe("shouldGateFirstMedia", () => {
  it("gates a brand-new user posting media", () => {
    const result = shouldGateFirstMedia(user(), true);
    expect(result.gate).toBe(true);
    expect(result.reason).toBe(
      "Primer envío con media de un usuario nuevo: en revisión.",
    );
  });

  it("never gates when there is no media", () => {
    const result = shouldGateFirstMedia(user(), false);
    expect(result.gate).toBe(false);
    expect(result.reason).toBe("El mensaje no contiene media.");
  });

  it("does not gate a media message from a fully settled account", () => {
    const result = shouldGateFirstMedia(
      user({ messageCount: 500, ageDays: 90 }),
      true,
    );
    expect(result.gate).toBe(false);
    expect(result.reason).toBe("Usuario asentado: media permitida.");
  });

  it("does not gate when only the message count is high", () => {
    const result = shouldGateFirstMedia(
      user({ messageCount: 200, ageDays: 0 }),
      true,
    );
    expect(result.gate).toBe(false);
    expect(result.reason).toBe(
      "El usuario ya tiene mensajes suficientes: media permitida.",
    );
  });

  it("does not gate when only the account age is high", () => {
    const result = shouldGateFirstMedia(
      user({ messageCount: 0, ageDays: 30 }),
      true,
    );
    expect(result.gate).toBe(false);
    expect(result.reason).toBe(
      "La cuenta ya tiene antigüedad suficiente: media permitida.",
    );
  });

  it("gates at the exact default thresholds (inclusive)", () => {
    const result = shouldGateFirstMedia(
      user({
        messageCount: NEW_MEDIA_GATE_DEFAULT_MAX_MESSAGES,
        ageDays: NEW_MEDIA_GATE_DEFAULT_MAX_AGE_DAYS,
      }),
      true,
    );
    expect(result.gate).toBe(true);
  });

  it("stops gating one message over the default message threshold", () => {
    const result = shouldGateFirstMedia(
      user({
        messageCount: NEW_MEDIA_GATE_DEFAULT_MAX_MESSAGES + 1,
        ageDays: 0,
      }),
      true,
    );
    expect(result.gate).toBe(false);
  });

  it("stops gating one day over the default age threshold", () => {
    const result = shouldGateFirstMedia(
      user({
        messageCount: 0,
        ageDays: NEW_MEDIA_GATE_DEFAULT_MAX_AGE_DAYS + 1,
      }),
      true,
    );
    expect(result.gate).toBe(false);
  });

  it("honors a custom higher message threshold", () => {
    const opts: NewMediaGateOptions = { newMaxMessages: 10 };
    expect(
      shouldGateFirstMedia(user({ messageCount: 8 }), true, opts).gate,
    ).toBe(true);
    expect(
      shouldGateFirstMedia(user({ messageCount: 11 }), true, opts).gate,
    ).toBe(false);
  });

  it("honors a custom higher age threshold", () => {
    const opts: NewMediaGateOptions = { newMaxAgeDays: 7 };
    expect(shouldGateFirstMedia(user({ ageDays: 7 }), true, opts).gate).toBe(
      true,
    );
    expect(shouldGateFirstMedia(user({ ageDays: 8 }), true, opts).gate).toBe(
      false,
    );
  });

  it("honors both custom thresholds together", () => {
    const opts: NewMediaGateOptions = { newMaxMessages: 5, newMaxAgeDays: 3 };
    expect(
      shouldGateFirstMedia(user({ messageCount: 5, ageDays: 3 }), true, opts)
        .gate,
    ).toBe(true);
    expect(
      shouldGateFirstMedia(user({ messageCount: 6, ageDays: 3 }), true, opts)
        .gate,
    ).toBe(false);
  });

  it("treats a zero custom threshold as strict (only zero passes)", () => {
    const opts: NewMediaGateOptions = { newMaxMessages: 0 };
    expect(
      shouldGateFirstMedia(user({ messageCount: 0 }), true, opts).gate,
    ).toBe(true);
    expect(
      shouldGateFirstMedia(user({ messageCount: 1 }), true, opts).gate,
    ).toBe(false);
  });

  it("clamps negative message counts to zero", () => {
    const result = shouldGateFirstMedia(user({ messageCount: -5 }), true);
    expect(result.gate).toBe(true);
  });

  it("clamps negative age to zero", () => {
    const result = shouldGateFirstMedia(user({ ageDays: -10 }), true);
    expect(result.gate).toBe(true);
  });

  it("ignores non-finite option values and falls back to defaults", () => {
    const opts: NewMediaGateOptions = { newMaxMessages: Number.NaN };
    // NaN -> clamped to 0, so only messageCount 0 gates.
    expect(
      shouldGateFirstMedia(user({ messageCount: 0 }), true, opts).gate,
    ).toBe(true);
    expect(
      shouldGateFirstMedia(user({ messageCount: 2 }), true, opts).gate,
    ).toBe(false);
  });

  it("does not gate without media even for a brand-new user", () => {
    expect(shouldGateFirstMedia(user(), false).gate).toBe(false);
  });

  it("is deterministic for identical inputs", () => {
    const u = user({ messageCount: 1, ageDays: 0 });
    expect(shouldGateFirstMedia(u, true)).toEqual(
      shouldGateFirstMedia(u, true),
    );
  });

  it("exposes sane default thresholds", () => {
    expect(NEW_MEDIA_GATE_DEFAULT_MAX_MESSAGES).toBe(3);
    expect(NEW_MEDIA_GATE_DEFAULT_MAX_AGE_DAYS).toBe(1);
  });
});

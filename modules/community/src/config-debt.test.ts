import { describe, expect, it } from "vitest";
import { detectConfigDebt } from "./config-debt.js";

const WELCOME_ISSUE =
  "El mensaje de bienvenida está activo pero no has definido las reglas del grupo. 📋";
const ANTIFLOOD_ISSUE =
  "El antiflood está activo pero el captcha está desactivado; los bots pueden colarse sin filtro. 🤖";
const MODERATION_ISSUE =
  "La moderación está activa pero no hay canal de registro para auditar las acciones. 📝";
const SILENTBAN_ISSUE =
  "El baneo silencioso está activo pero la moderación general está desactivada. 🔇";
const NIGHT_ISSUE =
  "El modo nocturno está activo pero el antiflood está desactivado, así que no frena nada de noche. 🌙";

describe("detectConfigDebt", () => {
  it("flags welcome without rules and antiflood without captcha in curated order", () => {
    const config = {
      welcomeEnabled: true,
      rulesSet: false,
      antifloodEnabled: true,
      captchaEnabled: false,
    };
    expect(detectConfigDebt(config)).toEqual([
      { key: "welcomeEnabled", issue: WELCOME_ISSUE },
      { key: "antifloodEnabled", issue: ANTIFLOOD_ISSUE },
    ]);
  });

  it("returns empty array when every dependency is satisfied", () => {
    const config = {
      welcomeEnabled: true,
      rulesSet: true,
      antifloodEnabled: true,
      captchaEnabled: true,
    };
    expect(detectConfigDebt(config)).toEqual([]);
  });

  it("returns empty array for an empty config", () => {
    expect(detectConfigDebt({})).toEqual([]);
  });

  it("treats a missing required key the same as a disabled one", () => {
    // moderationEnabled is on but logChannelSet is absent entirely.
    expect(detectConfigDebt({ moderationEnabled: true })).toEqual([
      { key: "moderationEnabled", issue: MODERATION_ISSUE },
    ]);
  });

  it("does not flag a rule whose 'when' flag is off", () => {
    // welcomeEnabled is off, so the missing rulesSet is irrelevant.
    expect(
      detectConfigDebt({ welcomeEnabled: false, rulesSet: false }),
    ).toEqual([]);
  });

  it("flags silent ban depending on general moderation", () => {
    expect(detectConfigDebt({ silentBanEnabled: true })).toEqual([
      { key: "silentBanEnabled", issue: SILENTBAN_ISSUE },
    ]);
  });

  it("does not flag silent ban when moderation is enabled", () => {
    const config = {
      silentBanEnabled: true,
      moderationEnabled: true,
      logChannelSet: true,
    };
    expect(detectConfigDebt(config)).toEqual([]);
  });

  it("preserves curated order regardless of input key order", () => {
    // nightMode is listed after welcome in the catalog even though it appears
    // first in the input object.
    const config = {
      nightModeEnabled: true,
      welcomeEnabled: true,
    };
    expect(detectConfigDebt(config)).toEqual([
      { key: "welcomeEnabled", issue: WELCOME_ISSUE },
      { key: "nightModeEnabled", issue: NIGHT_ISSUE },
    ]);
  });

  it("can report multiple independent findings at once", () => {
    const config = {
      welcomeEnabled: true,
      antifloodEnabled: true,
      moderationEnabled: true,
      silentBanEnabled: true,
      nightModeEnabled: true,
    };
    expect(detectConfigDebt(config)).toEqual([
      { key: "welcomeEnabled", issue: WELCOME_ISSUE },
      { key: "antifloodEnabled", issue: ANTIFLOOD_ISSUE },
      { key: "moderationEnabled", issue: MODERATION_ISSUE },
    ]);
  });

  it("is deterministic across repeated calls", () => {
    const config = { antifloodEnabled: true, moderationEnabled: true };
    const first = detectConfigDebt(config);
    const second = detectConfigDebt(config);
    expect(first).toEqual(second);
    expect(first).toEqual([
      { key: "antifloodEnabled", issue: ANTIFLOOD_ISSUE },
      { key: "moderationEnabled", issue: MODERATION_ISSUE },
    ]);
  });
});

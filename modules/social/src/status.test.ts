import { describe, expect, it } from "vitest";
import { DEFAULT_SOCIAL_SETTINGS } from "./settings.js";
import {
  autoPoleDiagnosis,
  renderSocialStatus,
  type SocialStatusInputs,
} from "./status.js";

const inputs = (
  overrides: Partial<SocialStatusInputs> = {},
): SocialStatusInputs => ({
  settings: DEFAULT_SOCIAL_SETTINGS,
  botIsAdmin: "yes",
  canRestrict: "yes",
  canDelete: "yes",
  seesPlainMessages: "yes",
  isForum: false,
  catCount: 0,
  dogCount: 0,
  telegramLatencyMs: null,
  ...overrides,
});

const withPole = (
  pole: Partial<SocialStatusInputs["settings"]["pole"]>,
): SocialStatusInputs["settings"] => ({
  ...DEFAULT_SOCIAL_SETTINGS,
  pole: { ...DEFAULT_SOCIAL_SETTINGS.pole, ...pole },
});

describe("autoPoleDiagnosis", () => {
  it("says nothing when the group is not using automatic mode", () => {
    expect(
      autoPoleDiagnosis(
        inputs({
          settings: withPole({ enabled: true, mode: "COMMAND_CLAIM" }),
        }),
      ),
    ).toBeNull();
  });

  it("says nothing when the pole is off entirely", () => {
    expect(autoPoleDiagnosis(inputs())).toBeNull();
  });

  it("explains EXACTLY why automatic pole is not firing", () => {
    // This is the failure the report singles out as unacceptable: the admin
    // must not be left with "it just doesn't work" (§5.11).
    const diagnosis = autoPoleDiagnosis(
      inputs({
        settings: withPole({ enabled: true, mode: "AUTO_FIRST_MESSAGE" }),
        seesPlainMessages: "no",
        botIsAdmin: "yes",
      }),
    );
    expect(diagnosis?.mark).toBe("no");
    expect(diagnosis?.line).toMatch(/privacidad/iu);
    expect(diagnosis?.line).toMatch(/por comando/iu);
  });

  it("gives different advice when the bot is not even an admin", () => {
    const diagnosis = autoPoleDiagnosis(
      inputs({
        settings: withPole({ enabled: true, mode: "AUTO_FIRST_MESSAGE" }),
        seesPlainMessages: "no",
        botIsAdmin: "no",
      }),
    );
    expect(diagnosis?.line).toMatch(/administrador/iu);
  });

  it("does NOT claim a problem it has not confirmed", () => {
    // "I have not seen enough traffic yet" is a third state, and collapsing it
    // into a warning sends admins to fix a permission that was never wrong.
    const diagnosis = autoPoleDiagnosis(
      inputs({
        settings: withPole({ enabled: true, mode: "AUTO_FIRST_MESSAGE" }),
        seesPlainMessages: "unknown",
      }),
    );
    expect(diagnosis?.mark).toBe("unknown");
  });
});

describe("renderSocialStatus", () => {
  it("is a diagnostic, not a greeting", () => {
    const text = renderSocialStatus(inputs());
    expect(text).toContain("Permisos:");
    expect(text).toContain("Pole:");
    expect(text).toContain("Ruleta:");
  });

  it("distinguishes 'missing' from 'could not check'", () => {
    const text = renderSocialStatus(
      inputs({ canRestrict: "no", canDelete: "unknown" }),
    );
    expect(text).toContain("⚠️ Restringir miembros");
    expect(text).toContain("❔ Borrar mensajes");
  });

  it("warns when the roulette is configured to do something it cannot", () => {
    const text = renderSocialStatus(
      inputs({
        settings: {
          ...DEFAULT_SOCIAL_SETTINGS,
          roulette: {
            ...DEFAULT_SOCIAL_SETTINGS.roulette,
            enabled: true,
            consequence: "TEMPORARY_MUTE",
          },
        },
        canRestrict: "no",
      }),
    );
    expect(text).toMatch(/no podré aplicarlo/u);
  });

  it("points out a per-topic ranking in a group with no topics", () => {
    const text = renderSocialStatus(
      inputs({
        settings: withPole({ enabled: true, threadScope: "per-topic" }),
        isForum: false,
      }),
    );
    expect(text).toMatch(/no usa temas/u);
  });

  it("shows the reset time as a clock, not as minutes", () => {
    const text = renderSocialStatus(
      inputs({ settings: withPole({ enabled: true, resetMinutes: 390 }) }),
    );
    expect(text).toContain("Reinicio: 06:30");
  });

  it("leaks nothing an admin of any group should not see", () => {
    const text = renderSocialStatus(inputs({ telegramLatencyMs: 182 }));
    expect(text).not.toMatch(/token|bot\d{6,}:|sha|process\.env|\/app\//iu);
  });
});

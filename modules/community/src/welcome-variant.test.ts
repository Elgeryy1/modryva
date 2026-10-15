import { describe, expect, it } from "vitest";
import {
  chooseWelcomeVariant,
  WELCOME_RETURNING_VARIANTS,
  WELCOME_RULES_REMINDER,
  WELCOME_VARIANTS,
  type WelcomeContext,
  type WelcomeRisk,
  welcomeSourceNote,
} from "./welcome-variant.js";

const ctx = (overrides: Partial<WelcomeContext> = {}): WelcomeContext => ({
  isNew: true,
  risk: "bajo",
  ...overrides,
});

const RISKS: readonly WelcomeRisk[] = ["bajo", "medio", "alto"];

describe("WELCOME_VARIANTS", () => {
  it("has a distinct base greeting for every risk level", () => {
    const values = RISKS.map((r) => WELCOME_VARIANTS[r]);
    expect(new Set(values).size).toBe(RISKS.length);
  });

  it("no base variant embeds the rules reminder", () => {
    for (const r of RISKS) {
      expect(WELCOME_VARIANTS[r].includes(WELCOME_RULES_REMINDER)).toBe(false);
    }
  });

  it("uses proper Spanish accents in user-facing text", () => {
    expect(WELCOME_VARIANTS.bajo).toContain("cómodo");
    expect(WELCOME_VARIANTS.medio).toContain("pregúntanos");
  });
});

describe("WELCOME_RETURNING_VARIANTS", () => {
  it("has an entry for every risk level", () => {
    for (const r of RISKS) {
      expect(WELCOME_RETURNING_VARIANTS[r].length).toBeGreaterThan(0);
    }
  });

  it("differs from the new-member greetings", () => {
    for (const r of RISKS) {
      expect(WELCOME_RETURNING_VARIANTS[r]).not.toBe(WELCOME_VARIANTS[r]);
    }
  });
});

describe("welcomeSourceNote", () => {
  it("returns empty string for undefined source", () => {
    expect(welcomeSourceNote(undefined)).toBe("");
  });

  it("returns empty string for whitespace-only source", () => {
    expect(welcomeSourceNote("   ")).toBe("");
  });

  it("includes the trimmed source when present", () => {
    expect(welcomeSourceNote("  campaña-verano  ")).toBe(
      "Vemos que llegas desde campaña-verano, ¡esperamos que te sientas como en casa!",
    );
  });

  it("is deterministic for identical input", () => {
    expect(welcomeSourceNote("enlace")).toBe(welcomeSourceNote("enlace"));
  });
});

describe("chooseWelcomeVariant", () => {
  it("returns the new-member base for a low-risk newcomer without source", () => {
    expect(chooseWelcomeVariant(ctx({ isNew: true, risk: "bajo" }))).toBe(
      WELCOME_VARIANTS.bajo,
    );
  });

  it("returns the returning base when isNew is false", () => {
    expect(chooseWelcomeVariant(ctx({ isNew: false, risk: "medio" }))).toBe(
      WELCOME_RETURNING_VARIANTS.medio,
    );
  });

  it("appends the rules reminder for high risk newcomers", () => {
    const out = chooseWelcomeVariant(ctx({ isNew: true, risk: "alto" }));
    expect(out.startsWith(WELCOME_VARIANTS.alto)).toBe(true);
    expect(out.endsWith(WELCOME_RULES_REMINDER)).toBe(true);
  });

  it("appends the rules reminder for high risk returning members too", () => {
    const out = chooseWelcomeVariant(ctx({ isNew: false, risk: "alto" }));
    expect(out.startsWith(WELCOME_RETURNING_VARIANTS.alto)).toBe(true);
    expect(out.endsWith(WELCOME_RULES_REMINDER)).toBe(true);
  });

  it("never appends the reminder for non-high risk", () => {
    for (const risk of ["bajo", "medio"] as const) {
      const out = chooseWelcomeVariant(ctx({ risk }));
      expect(out.includes(WELCOME_RULES_REMINDER)).toBe(false);
    }
  });

  it("inserts the source note between greeting and reminder", () => {
    const out = chooseWelcomeVariant(
      ctx({ isNew: true, risk: "alto", source: "invitacion" }),
    );
    expect(out).toBe(
      `${WELCOME_VARIANTS.alto} ${welcomeSourceNote("invitacion")} ${WELCOME_RULES_REMINDER}`,
    );
  });

  it("includes the source note for non-high risk without a reminder", () => {
    const out = chooseWelcomeVariant(
      ctx({ isNew: true, risk: "bajo", source: "twitter" }),
    );
    expect(out).toBe(
      `${WELCOME_VARIANTS.bajo} ${welcomeSourceNote("twitter")}`,
    );
    expect(out.includes(WELCOME_RULES_REMINDER)).toBe(false);
  });

  it("ignores a whitespace-only source", () => {
    const out = chooseWelcomeVariant(
      ctx({ isNew: true, risk: "bajo", source: "   " }),
    );
    expect(out).toBe(WELCOME_VARIANTS.bajo);
  });

  it("is deterministic across repeated calls", () => {
    const context = ctx({ isNew: false, risk: "alto", source: "ads" });
    expect(chooseWelcomeVariant(context)).toBe(chooseWelcomeVariant(context));
  });

  it("produces a non-empty string for every risk and isNew combination", () => {
    for (const risk of RISKS) {
      for (const isNew of [true, false]) {
        expect(
          chooseWelcomeVariant(ctx({ risk, isNew })).length,
        ).toBeGreaterThan(0);
      }
    }
  });
});

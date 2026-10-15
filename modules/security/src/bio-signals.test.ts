import { describe, expect, it } from "vitest";
import {
  BIO_SIGNAL_KEYS,
  type BioProfile,
  type BioSignal,
  detectBioAdult,
  detectBioCommercialUsername,
  detectBioInvestment,
  detectBioScam,
  detectBioSignals,
} from "./bio-signals.js";

const profile = (overrides: Partial<BioProfile> = {}): BioProfile => ({
  ...overrides,
});

const byKey = (signals: readonly BioSignal[], key: string): BioSignal => {
  const found = signals.find((s) => s.key === key);
  if (!found) {
    throw new Error(`missing signal ${key}`);
  }
  return found;
};

describe("detectBioInvestment", () => {
  it("marks investment/crypto phrases in the bio", () => {
    const signal = detectBioInvestment(
      profile({ bio: "Experto en inversion y forex" }),
    );
    expect(signal.present).toBe(true);
    expect(signal.detail).toBe("inversion");
  });

  it("is accent-insensitive", () => {
    expect(
      detectBioInvestment(profile({ bio: "señales de trading" })).present,
    ).toBe(true);
  });

  it("is not present for a clean bio", () => {
    const signal = detectBioInvestment(profile({ bio: "amante de los gatos" }));
    expect(signal.present).toBe(false);
    expect(signal.detail).toBeUndefined();
  });

  it("is not present when bio is undefined", () => {
    expect(detectBioInvestment(profile()).present).toBe(false);
  });
});

describe("detectBioAdult", () => {
  it("marks adult phrases in the bio", () => {
    const signal = detectBioAdult(
      profile({ bio: "Contenido +18 en mi canal" }),
    );
    expect(signal.present).toBe(true);
    expect(signal.detail).toBe("+18");
  });

  it("detects onlyfans mentions", () => {
    expect(
      detectBioAdult(profile({ bio: "sigueme en OnlyFans" })).present,
    ).toBe(true);
  });

  it("is not present for a clean bio", () => {
    expect(
      detectBioAdult(profile({ bio: "fotografo de paisajes" })).present,
    ).toBe(false);
  });
});

describe("detectBioScam", () => {
  it("marks scam phrases in the bio", () => {
    const signal = detectBioScam(
      profile({ bio: "Gana dinero facil desde casa" }),
    );
    expect(signal.present).toBe(true);
    expect(signal.detail).toBe("dinero facil");
  });

  it("detects loans and betting", () => {
    expect(detectBioScam(profile({ bio: "prestamos rapidos" })).present).toBe(
      true,
    );
    expect(
      detectBioScam(profile({ bio: "las mejores apuestas" })).present,
    ).toBe(true);
  });

  it("is not present for a clean bio", () => {
    expect(
      detectBioScam(profile({ bio: "profesor de matematicas" })).present,
    ).toBe(false);
  });
});

describe("detectBioCommercialUsername", () => {
  it("marks commercial keywords in the username", () => {
    const signal = detectBioCommercialUsername(
      profile({ username: "promo_deals" }),
    );
    expect(signal.present).toBe(true);
    expect(signal.detail).toBe("promo");
  });

  it("detects support-impersonation handles", () => {
    const signal = detectBioCommercialUsername(
      profile({ username: "official_support" }),
    );
    expect(signal.present).toBe(true);
    expect(signal.detail).toBe("support");
  });

  it("strips a leading @ from the handle", () => {
    expect(
      detectBioCommercialUsername(profile({ username: "@cashking" })).present,
    ).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(
      detectBioCommercialUsername(profile({ username: "CryptoWhale" })).present,
    ).toBe(true);
  });

  it("uses the earliest keyword by position as detail", () => {
    const signal = detectBioCommercialUsername(
      profile({ username: "x_cash_promo" }),
    );
    expect(signal.detail).toBe("cash");
  });

  it("is not present for a plain username", () => {
    const signal = detectBioCommercialUsername(
      profile({ username: "juan_perez" }),
    );
    expect(signal.present).toBe(false);
    expect(signal.detail).toBeUndefined();
  });

  it("is not present when username is undefined", () => {
    expect(detectBioCommercialUsername(profile()).present).toBe(false);
  });
});

describe("detectBioSignals", () => {
  it("emits one signal per key in stable order", () => {
    const signals = detectBioSignals(profile());
    expect(signals.map((s) => s.key)).toEqual([...BIO_SIGNAL_KEYS]);
  });

  it("every signal is absent for an empty profile", () => {
    const signals = detectBioSignals(profile());
    expect(signals.every((s) => !s.present)).toBe(true);
    expect(signals.every((s) => s.detail === undefined)).toBe(true);
  });

  it("fires the matching signals for a loaded profile", () => {
    const signals = detectBioSignals(
      profile({ bio: "inversion en cripto, +18", username: "promo_bot" }),
    );
    expect(byKey(signals, "bio.investment").present).toBe(true);
    expect(byKey(signals, "bio.adult").present).toBe(true);
    expect(byKey(signals, "bio.commercial-username").present).toBe(true);
    expect(byKey(signals, "bio.scam").present).toBe(false);
  });

  it("assigns weight 2 to every signal", () => {
    const signals = detectBioSignals(
      profile({ bio: "casino", username: "cash" }),
    );
    expect(signals.every((s) => s.weight === 2)).toBe(true);
  });

  it("is deterministic for identical inputs", () => {
    const input = profile({ bio: "gana dinero", username: "deals_shop" });
    expect(detectBioSignals(input)).toEqual(detectBioSignals(input));
  });
});

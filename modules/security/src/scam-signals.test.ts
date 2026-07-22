import { describe, expect, it } from "vitest";
import {
  detectScamCommercialUsername,
  detectScamConfusableUnicode,
  detectScamDisguisedLink,
  detectScamDmBait,
  detectScamFakeSocialProof,
  detectScamHelloPlusLink,
  detectScamSignals,
  detectScamUnrealisticPromise,
  SCAM_SIGNAL_KEYS,
  type ScamMessage,
  type ScamSignal,
} from "./scam-signals.js";

const msg = (overrides: Partial<ScamMessage> = {}): ScamMessage => ({
  text: "",
  hasUrl: false,
  domains: [],
  isFirstMessage: false,
  ...overrides,
});

const byKey = (signals: readonly ScamSignal[], key: string): ScamSignal => {
  const found = signals.find((signal) => signal.key === key);
  if (!found) {
    throw new Error(`missing signal ${key}`);
  }
  return found;
};

describe("detectScamDisguisedLink", () => {
  it("flags a dot with surrounding spaces plus a known TLD", () => {
    const signal = detectScamDisguisedLink(
      msg({ text: "entra a premio . com ya" }),
    );
    expect(signal.present).toBe(true);
    expect(signal.detail).toBe("punto-camuflado");
    expect(signal.weight).toBe(3);
  });

  it("flags a fullwidth unicode dot", () => {
    expect(
      detectScamDisguisedLink(msg({ text: "visita scamsite．com" })).present,
    ).toBe(true);
  });

  it("flags the (dot) obfuscation", () => {
    expect(
      detectScamDisguisedLink(msg({ text: "google(dot)com free" })).present,
    ).toBe(true);
  });

  it("flags two or more chained shorteners", () => {
    const signal = detectScamDisguisedLink(
      msg({ text: "mira", domains: ["bit.ly", "tinyurl.com"] }),
    );
    expect(signal.present).toBe(true);
    expect(signal.detail).toBe("acortadores-encadenados");
  });

  it("does not flag a single shortener", () => {
    expect(
      detectScamDisguisedLink(msg({ text: "mira", domains: ["bit.ly"] }))
        .present,
    ).toBe(false);
  });

  it("does not flag an ordinary sentence with a period", () => {
    expect(
      detectScamDisguisedLink(msg({ text: "me gusta esto. Realmente mucho" }))
        .present,
    ).toBe(false);
  });
});

describe("detectScamConfusableUnicode", () => {
  it("flags cyrillic homoglyphs mixed with latin", () => {
    const signal = detectScamConfusableUnicode(msg({ text: "paуpal login" }));
    expect(signal.present).toBe(true);
    expect(signal.detail).toBe("у");
  });

  it("does not flag plain latin text", () => {
    expect(
      detectScamConfusableUnicode(msg({ text: "paypal login" })).present,
    ).toBe(false);
  });

  it("does not flag purely non-latin text", () => {
    expect(detectScamConfusableUnicode(msg({ text: "привет" })).present).toBe(
      false,
    );
  });
});

describe("detectScamDmBait", () => {
  it("flags DM bait ignoring case and accents", () => {
    const signal = detectScamDmBait(msg({ text: "Mándame DM y te cuento" }));
    expect(signal.present).toBe(true);
    expect(signal.detail).toBe("mandame dm");
  });

  it("flags 'te escribo por privado'", () => {
    expect(
      detectScamDmBait(msg({ text: "te escribo por privado ahora" })).present,
    ).toBe(true);
  });

  it("does not flag a neutral message", () => {
    expect(detectScamDmBait(msg({ text: "buenos dias a todos" })).present).toBe(
      false,
    );
  });
});

describe("detectScamUnrealisticPromise", () => {
  it("flags a fast-money promise", () => {
    const signal = detectScamUnrealisticPromise(
      msg({ text: "gana dinero rapido desde casa" }),
    );
    expect(signal.present).toBe(true);
    expect(signal.detail).toBe("dinero rapido");
  });

  it("flags an investment pitch", () => {
    expect(
      detectScamUnrealisticPromise(msg({ text: "inversion segura al 30%" }))
        .present,
    ).toBe(true);
  });

  it("does not flag a normal chat line", () => {
    expect(
      detectScamUnrealisticPromise(msg({ text: "hoy hace buen tiempo" }))
        .present,
    ).toBe(false);
  });
});

describe("detectScamCommercialUsername", () => {
  it("flags a commercial keyword in the username", () => {
    const signal = detectScamCommercialUsername(
      msg({ username: "CryptoDealsBot" }),
    );
    expect(signal.present).toBe(true);
    expect(signal.detail).toBe("crypto");
  });

  it("does not flag a normal username", () => {
    expect(
      detectScamCommercialUsername(msg({ username: "juanperez" })).present,
    ).toBe(false);
  });

  it("does not flag when username is absent", () => {
    expect(detectScamCommercialUsername(msg()).present).toBe(false);
  });
});

describe("detectScamHelloPlusLink", () => {
  it("flags a bare greeting followed by a link", () => {
    const signal = detectScamHelloPlusLink(
      msg({ text: "hola mira esto", hasUrl: true }),
    );
    expect(signal.present).toBe(true);
    expect(signal.detail).toBe("saludo+enlace");
  });

  it("flags greeting plus domains even without hasUrl", () => {
    expect(
      detectScamHelloPlusLink(msg({ text: "buenas!", domains: ["site.io"] }))
        .present,
    ).toBe(true);
  });

  it("does not flag a greeting without any link", () => {
    expect(detectScamHelloPlusLink(msg({ text: "hola que tal" })).present).toBe(
      false,
    );
  });

  it("does not flag a link without a greeting", () => {
    expect(
      detectScamHelloPlusLink(msg({ text: "aqui el informe", hasUrl: true }))
        .present,
    ).toBe(false);
  });
});

describe("detectScamFakeSocialProof", () => {
  it("flags a fake social-proof claim", () => {
    const signal = detectScamFakeSocialProof(
      msg({ text: "es 100% real, ya gane 500" }),
    );
    expect(signal.present).toBe(true);
    expect(signal.detail).toBe("100% real");
  });

  it("does not flag an ordinary statement", () => {
    expect(
      detectScamFakeSocialProof(msg({ text: "el partido fue real" })).present,
    ).toBe(false);
  });
});

describe("detectScamSignals", () => {
  it("emits one signal per key in stable order", () => {
    const signals = detectScamSignals(msg({ text: "hola" }));
    expect(signals.map((s) => s.key)).toEqual([...SCAM_SIGNAL_KEYS]);
  });

  it("marks every signal absent for a clean message", () => {
    const signals = detectScamSignals(msg({ text: "buenos dias equipo" }));
    expect(signals.every((s) => s.present === false)).toBe(true);
    expect(signals.every((s) => s.detail === undefined)).toBe(true);
  });

  it("lights up several signals for a scammy first message", () => {
    const signals = detectScamSignals(
      msg({
        text: "hola! gana dinero rapido, es 100% real, mandame dm",
        hasUrl: true,
        domains: ["bit.ly", "cutt.ly"],
        username: "PromoCashKing",
        isFirstMessage: true,
      }),
    );
    expect(byKey(signals, "scam.disguised-link").present).toBe(true);
    expect(byKey(signals, "scam.dm-bait").present).toBe(true);
    expect(byKey(signals, "scam.unrealistic-promise").present).toBe(true);
    expect(byKey(signals, "scam.commercial-username").present).toBe(true);
    expect(byKey(signals, "scam.hello-plus-link").present).toBe(true);
    expect(byKey(signals, "scam.fake-social-proof").present).toBe(true);
  });

  it("is deterministic across identical calls", () => {
    const input = msg({ text: "hola mira bit.ly/x", hasUrl: true });
    expect(detectScamSignals(input)).toEqual(detectScamSignals(input));
  });
});

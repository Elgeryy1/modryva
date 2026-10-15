import { describe, expect, it } from "vitest";
import {
  buildProtectionSummary,
  buildProtectionSummaryReply,
  countActiveDefenses,
  type ProtectionState,
  type ProtectionSummarySource,
} from "./protection-summary.js";

const state = (overrides: Partial<ProtectionState> = {}): ProtectionState => ({
  antiflood: false,
  captcha: false,
  antiraid: false,
  lockedTypes: [],
  blocklistCount: 0,
  nightMode: false,
  welcomeMute: false,
  ...overrides,
});

describe("countActiveDefenses", () => {
  it("returns 0 for a fully disabled state", () => {
    expect(countActiveDefenses(state())).toBe(0);
  });

  it("counts each boolean defense once", () => {
    expect(countActiveDefenses(state({ antiflood: true }))).toBe(1);
    expect(countActiveDefenses(state({ captcha: true }))).toBe(1);
    expect(countActiveDefenses(state({ antiraid: true }))).toBe(1);
    expect(countActiveDefenses(state({ nightMode: true }))).toBe(1);
    expect(countActiveDefenses(state({ welcomeMute: true }))).toBe(1);
  });

  it("counts lockedTypes as one defense only when non-empty", () => {
    expect(countActiveDefenses(state({ lockedTypes: [] }))).toBe(0);
    expect(countActiveDefenses(state({ lockedTypes: ["urls"] }))).toBe(1);
    expect(
      countActiveDefenses(
        state({ lockedTypes: ["urls", "stickers", "media"] }),
      ),
    ).toBe(1);
  });

  it("counts blocklistCount only when strictly positive", () => {
    expect(countActiveDefenses(state({ blocklistCount: 0 }))).toBe(0);
    expect(countActiveDefenses(state({ blocklistCount: -3 }))).toBe(0);
    expect(countActiveDefenses(state({ blocklistCount: 1 }))).toBe(1);
    expect(countActiveDefenses(state({ blocklistCount: 42 }))).toBe(1);
  });

  it("sums all defenses when everything is active", () => {
    expect(
      countActiveDefenses(
        state({
          antiflood: true,
          captcha: true,
          antiraid: true,
          lockedTypes: ["urls"],
          blocklistCount: 5,
          nightMode: true,
          welcomeMute: true,
        }),
      ),
    ).toBe(7);
  });

  it("is deterministic for identical inputs", () => {
    const s = state({ captcha: true, blocklistCount: 2 });
    expect(countActiveDefenses(s)).toBe(countActiveDefenses(s));
  });
});

describe("buildProtectionSummary", () => {
  it("warns about being undefended when nothing is active", () => {
    const text = buildProtectionSummary(state());
    expect(text).toContain("Ninguna protección activa");
    expect(text).toContain("desprotegido");
    expect(text).not.toContain("\n");
  });

  it("treats empty lockedTypes and zero blocklist as no defense", () => {
    expect(
      buildProtectionSummary(state({ lockedTypes: [], blocklistCount: 0 })),
    ).toContain("Ninguna protección activa");
  });

  it("shows a header and one line for a single defense", () => {
    const text = buildProtectionSummary(state({ antiflood: true }));
    const lines = text.split("\n");
    expect(lines[0]).toBe("🛡️ Protecciones activas:");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("Antiflood");
  });

  it("explains captcha and antiraid when active", () => {
    const text = buildProtectionSummary(
      state({ captcha: true, antiraid: true }),
    );
    expect(text).toContain("🔐 Captcha");
    expect(text).toContain("🚨 Antiraid");
  });

  it("lists the locked content types joined by commas", () => {
    const text = buildProtectionSummary(
      state({ lockedTypes: ["urls", "stickers"] }),
    );
    expect(text).toContain("🔒 Bloqueo de contenido: urls, stickers.");
  });

  it("uses the singular word for a blocklist of one", () => {
    const text = buildProtectionSummary(state({ blocklistCount: 1 }));
    expect(text).toContain("🚫 Lista negra");
    expect(text).toContain("1 palabra prohibidas");
    expect(text).not.toContain("1 palabras");
  });

  it("uses the plural word for a blocklist of many", () => {
    const text = buildProtectionSummary(state({ blocklistCount: 7 }));
    expect(text).toContain("7 palabras");
  });

  it("does not show a blocklist line for negative counts", () => {
    const text = buildProtectionSummary(state({ blocklistCount: -1 }));
    expect(text).toContain("Ninguna protección activa");
    expect(text).not.toContain("Lista negra");
  });

  it("keeps the defenses in a stable order", () => {
    const text = buildProtectionSummary(
      state({
        antiflood: true,
        captcha: true,
        antiraid: true,
        lockedTypes: ["urls"],
        blocklistCount: 3,
        nightMode: true,
        welcomeMute: true,
      }),
    );
    const lines = text.split("\n");
    expect(lines[0]).toBe("🛡️ Protecciones activas:");
    expect(lines[1]).toContain("Antiflood");
    expect(lines[2]).toContain("Captcha");
    expect(lines[3]).toContain("Antiraid");
    expect(lines[4]).toContain("Bloqueo de contenido");
    expect(lines[5]).toContain("Lista negra");
    expect(lines[6]).toContain("Modo noche");
    expect(lines[7]).toContain("Silencio de bienvenida");
    expect(lines).toHaveLength(8);
  });

  it("emits one line per active defense", () => {
    const s = state({ nightMode: true, welcomeMute: true });
    const lines = buildProtectionSummary(s).split("\n");
    expect(lines).toHaveLength(1 + countActiveDefenses(s));
  });

  it("is deterministic for identical inputs", () => {
    const s = state({
      antiflood: true,
      lockedTypes: ["media"],
      blocklistCount: 2,
    });
    expect(buildProtectionSummary(s)).toBe(buildProtectionSummary(s));
  });
});

describe("buildProtectionSummaryReply", () => {
  const source = (
    overrides: Partial<ProtectionSummarySource> = {},
  ): ProtectionSummarySource => ({
    antiflood: false,
    captcha: false,
    antiraid: false,
    nightMode: false,
    welcomeMute: false,
    ...overrides,
  });

  it("warns about being undefended when nothing is active", () => {
    expect(buildProtectionSummaryReply(source())).toEqual({
      text: buildProtectionSummary({
        antiflood: false,
        captcha: false,
        antiraid: false,
        lockedTypes: [],
        blocklistCount: 0,
        nightMode: false,
        welcomeMute: false,
      }),
    });
    expect(buildProtectionSummaryReply(source()).text).toContain(
      "Ninguna protección activa",
    );
  });

  it("maps the active defenses into the summary text", () => {
    const reply = buildProtectionSummaryReply(
      source({ antiflood: true, captcha: true, nightMode: true }),
    );
    expect(reply.text).toContain("🛡️ Protecciones activas:");
    expect(reply.text).toContain("Antiflood");
    expect(reply.text).toContain("Captcha");
    expect(reply.text).toContain("Modo noche");
  });

  it("never reports content locks or blocklist for these commands", () => {
    const reply = buildProtectionSummaryReply(
      source({ antiraid: true, welcomeMute: true }),
    );
    expect(reply.text).not.toContain("Bloqueo de contenido");
    expect(reply.text).not.toContain("Lista negra");
    expect(reply.text).toContain("Antiraid");
    expect(reply.text).toContain("Silencio de bienvenida");
  });
});

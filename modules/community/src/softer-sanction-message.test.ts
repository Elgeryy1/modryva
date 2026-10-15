import { describe, expect, it } from "vitest";
import { softenSanctionMessage } from "./softer-sanction-message.js";

describe("softenSanctionMessage", () => {
  it("keeps warns private even when public was requested", () => {
    expect(softenSanctionMessage({ action: "warn", public: true })).toEqual({
      channel: "privado",
      message:
        "Te dejamos un aviso discreto para cuidar la convivencia. Revisa las normas cuando puedas. 🙏",
    });
  });

  it("keeps mutes private when not public", () => {
    expect(softenSanctionMessage({ action: "mute", public: false })).toEqual({
      channel: "privado",
      message:
        "Aplicamos un silencio temporal. Te lo explicamos en privado para no exponerte. 🤫",
    });
  });

  it("respects public flag for bans", () => {
    expect(softenSanctionMessage({ action: "ban", public: true })).toEqual({
      channel: "publico",
      message:
        "Se ha retirado el acceso al grupo. Si crees que es un error, escríbenos y lo revisamos. 🤝",
    });
  });

  it("uses private channel for bans when not public", () => {
    expect(softenSanctionMessage({ action: "ban", public: false })).toEqual({
      channel: "privado",
      message:
        "Se ha retirado el acceso al grupo. Si crees que es un error, escríbenos y lo revisamos. 🤝",
    });
  });

  it("respects public flag for kicks", () => {
    const result = softenSanctionMessage({ action: "kick", public: true });
    expect(result.channel).toBe("publico");
    expect(result.message).toContain("Puedes volver cuando quieras");
  });

  it("falls back to a neutral generic message for unknown public actions", () => {
    expect(
      softenSanctionMessage({ action: "shadowban", public: true }),
    ).toEqual({
      channel: "publico",
      message:
        "Hemos aplicado una medida de moderación con el menor ruido posible. Te damos los detalles en privado. 🤝",
    });
  });

  it("falls back to a neutral generic message for unknown private actions", () => {
    expect(
      softenSanctionMessage({ action: "shadowban", public: false }),
    ).toEqual({
      channel: "privado",
      message:
        "Hemos aplicado una medida de moderación con el menor ruido posible. Te damos los detalles en privado. 🤝",
    });
  });

  it("matches actions case-insensitively", () => {
    expect(
      softenSanctionMessage({ action: "WARN", public: true }).channel,
    ).toBe("privado");
  });

  it("trims surrounding whitespace before matching", () => {
    expect(softenSanctionMessage({ action: "  mute  ", public: true })).toEqual(
      {
        channel: "privado",
        message:
          "Aplicamos un silencio temporal. Te lo explicamos en privado para no exponerte. 🤫",
      },
    );
  });

  it("treats an empty action as unknown and honors the public flag", () => {
    expect(softenSanctionMessage({ action: "", public: false })).toEqual({
      channel: "privado",
      message:
        "Hemos aplicado una medida de moderación con el menor ruido posible. Te damos los detalles en privado. 🤝",
    });
  });

  it("is deterministic for repeated calls with the same input", () => {
    const input = { action: "ban", public: true } as const;
    expect(softenSanctionMessage(input)).toEqual(softenSanctionMessage(input));
  });
});

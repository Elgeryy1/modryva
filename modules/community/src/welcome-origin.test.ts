import { describe, expect, it } from "vitest";
import { welcomeByOrigin } from "./welcome-origin.js";

const RULES = [
  { link: "https://t.me/+vipABC", message: "¡Hola VIP! 🌟" },
  {
    link: "https://t.me/+freeXYZ",
    message: "¡Bienvenido/a, prueba gratis! 🎁",
  },
];

describe("welcomeByOrigin", () => {
  it("returns the message for a matching invite link", () => {
    expect(welcomeByOrigin("https://t.me/+vipABC", RULES)).toBe(
      "¡Hola VIP! 🌟",
    );
  });

  it("matches later rules preserving mapping order", () => {
    expect(welcomeByOrigin("https://t.me/+freeXYZ", RULES)).toBe(
      "¡Bienvenido/a, prueba gratis! 🎁",
    );
  });

  it("uses the default Spanish welcome when no rule matches", () => {
    expect(welcomeByOrigin("https://t.me/+unknown", RULES)).toBe(
      "¡Te damos la bienvenida al grupo! 👋",
    );
  });

  it("uses the default welcome for undefined link", () => {
    expect(welcomeByOrigin(undefined, RULES)).toBe(
      "¡Te damos la bienvenida al grupo! 👋",
    );
  });

  it("uses the default welcome for an empty link", () => {
    expect(welcomeByOrigin("", RULES)).toBe(
      "¡Te damos la bienvenida al grupo! 👋",
    );
  });

  it("treats whitespace-only link as no origin", () => {
    expect(welcomeByOrigin("   ", RULES)).toBe(
      "¡Te damos la bienvenida al grupo! 👋",
    );
  });

  it("honors a custom fallback from options", () => {
    expect(welcomeByOrigin(undefined, RULES, { fallback: "¡Hola! 👋" })).toBe(
      "¡Hola! 👋",
    );
  });

  it("trims the invite link before comparing", () => {
    expect(welcomeByOrigin("  https://t.me/+vipABC  ", RULES)).toBe(
      "¡Hola VIP! 🌟",
    );
  });

  it("returns the first matching rule when links are duplicated", () => {
    const dupes = [
      { link: "dup", message: "primero" },
      { link: "dup", message: "segundo" },
    ];
    expect(welcomeByOrigin("dup", dupes)).toBe("primero");
  });

  it("uses the default welcome for an empty mapping", () => {
    expect(welcomeByOrigin("https://t.me/+vipABC", [])).toBe(
      "¡Te damos la bienvenida al grupo! 👋",
    );
  });

  it("is deterministic across repeated calls", () => {
    const first = welcomeByOrigin("https://t.me/+vipABC", RULES);
    const second = welcomeByOrigin("https://t.me/+vipABC", RULES);
    expect(first).toBe(second);
  });
});

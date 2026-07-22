import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  formatVerticalPreset,
  isVerticalKind,
  parseVerticalCommand,
  resolveVerticalPreset,
  VERTICAL_KINDS,
  type VerticalKind,
} from "./vertical-presets.js";

const baseUpdate = (
  overrides: Partial<TelegramUpdateEnvelope> = {},
): TelegramUpdateEnvelope => ({
  updateId: 1,
  kind: "message",
  receivedAt: new Date("2026-01-01T00:00:00Z"),
  chat: { chatId: 100n, chatType: "supergroup", topicId: undefined },
  user: { userId: 7n, username: "tester", languageCode: "es" },
  command: undefined,
  callbackData: undefined,
  messageText: undefined,
  content: {
    hasText: true,
    hasUrl: false,
    hasMention: false,
    isForward: false,
    viaBot: false,
    hasPhoto: false,
    hasVideo: false,
    hasAnimation: false,
    hasSticker: false,
    hasAudio: false,
    hasVoice: false,
    hasDocument: false,
    hasContact: false,
    hasLocation: false,
    hasPoll: false,
  },
  attachment: undefined,
  preCheckout: undefined,
  successfulPayment: undefined,
  inlineQuery: undefined,
  messageId: 555,
  newChatMemberIds: [],
  isTextMessage: true,
  raw: {},
  ...overrides,
});

const cmd = (
  name: string,
  args: readonly string[] = [],
): TelegramUpdateEnvelope["command"] => ({
  name,
  raw: args.length > 0 ? `/${name} ${args.join(" ")}` : `/${name}`,
  args,
});

describe("VERTICAL_KINDS", () => {
  it("expone las tres verticales en orden estable", () => {
    expect(VERTICAL_KINDS).toEqual(["aula", "soporte", "creadores"]);
  });
});

describe("isVerticalKind", () => {
  it("acepta las claves conocidas", () => {
    for (const kind of VERTICAL_KINDS) {
      expect(isVerticalKind(kind)).toBe(true);
    }
  });

  it("rechaza claves desconocidas y vacias", () => {
    expect(isVerticalKind("otra")).toBe(false);
    expect(isVerticalKind("")).toBe(false);
    expect(isVerticalKind("AULA")).toBe(false);
  });
});

describe("resolveVerticalPreset", () => {
  it("reusa nombres de modulos reales del repo por vertical", () => {
    expect(resolveVerticalPreset("aula").modulesOn).toEqual([
      "quizzes",
      "reminders",
      "misiones",
      "scheduling",
    ]);
    expect(resolveVerticalPreset("soporte").modulesOn).toEqual([
      "tickets",
      "reminders",
      "scheduling",
    ]);
    expect(resolveVerticalPreset("creadores").modulesOn).toEqual([
      "misiones",
      "scheduling",
      "reminders",
    ]);
  });

  it("devuelve bienvenida, reglas y comandos no vacios", () => {
    for (const kind of VERTICAL_KINDS) {
      const preset = resolveVerticalPreset(kind);
      expect(preset.welcome.length).toBeGreaterThan(0);
      expect(preset.rules.length).toBeGreaterThan(0);
      expect(preset.commands.length).toBeGreaterThan(0);
    }
  });

  it("es determinista para la misma clave", () => {
    expect(resolveVerticalPreset("soporte")).toEqual(
      resolveVerticalPreset("soporte"),
    );
  });

  it("devuelve copias que no afectan al preset interno al mutarlas", () => {
    const first = resolveVerticalPreset("aula");
    (first.modulesOn as string[]).push("hackeado");
    const second = resolveVerticalPreset("aula");
    expect(second.modulesOn).not.toContain("hackeado");
  });

  it("soporte activa tickets pero aula no", () => {
    expect(resolveVerticalPreset("soporte").modulesOn).toContain("tickets");
    expect(resolveVerticalPreset("aula").modulesOn).not.toContain("tickets");
  });
});

describe("parseVerticalCommand", () => {
  it("parsea /vertical aula", () => {
    expect(
      parseVerticalCommand(baseUpdate({ command: cmd("vertical", ["aula"]) })),
    ).toEqual({ ok: true, command: { kind: "aula" } });
  });

  it("normaliza la clave a minusculas", () => {
    expect(
      parseVerticalCommand(
        baseUpdate({ command: cmd("vertical", ["Soporte"]) }),
      ),
    ).toEqual({ ok: true, command: { kind: "soporte" } });
  });

  it("devuelve error missing-kind sin argumento", () => {
    const result = parseVerticalCommand(
      baseUpdate({ command: cmd("vertical") }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "missing-kind",
        usage: "Uso: /vertical aula|soporte|creadores",
      },
    });
  });

  it("devuelve error unknown-kind con clave desconocida", () => {
    const result = parseVerticalCommand(
      baseUpdate({ command: cmd("vertical", ["gaming"]) }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "unknown-kind",
        usage: "Uso: /vertical aula|soporte|creadores",
      },
    });
  });

  it("devuelve null para otros comandos o sin comando", () => {
    expect(
      parseVerticalCommand(baseUpdate({ command: cmd("ban") })),
    ).toBeNull();
    expect(parseVerticalCommand(baseUpdate())).toBeNull();
  });
});

describe("formatVerticalPreset", () => {
  it("incluye titulo, modulos, reglas numeradas y comandos", () => {
    const text = formatVerticalPreset("soporte");
    expect(text).toContain("Vertical: Soporte");
    expect(text).toContain("Modulos: tickets, reminders, scheduling");
    expect(text).toContain("1. Un ticket por incidencia para poder seguirla");
    expect(text).toContain("Comandos: /ticket /cerrar /reminder /agenda");
  });

  it("numera las reglas de forma consecutiva", () => {
    const preset = resolveVerticalPreset("aula");
    const text = formatVerticalPreset("aula");
    preset.rules.forEach((rule, index) => {
      expect(text).toContain(`${index + 1}. ${rule}`);
    });
  });

  it("renderiza una linea por comando prefijado con barra", () => {
    for (const kind of VERTICAL_KINDS as readonly VerticalKind[]) {
      const preset = resolveVerticalPreset(kind);
      const text = formatVerticalPreset(kind);
      expect(text).toContain(
        `Comandos: ${preset.commands.map((c) => `/${c}`).join(" ")}`,
      );
    }
  });

  it("es determinista", () => {
    expect(formatVerticalPreset("creadores")).toBe(
      formatVerticalPreset("creadores"),
    );
  });
});

import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  formatSanctionReasonList,
  parseSanctionReasonCommand,
  resolveSanctionReason,
  SANCTION_REASON_PRESETS,
} from "./sanction-reasons.js";

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

describe("SANCTION_REASON_PRESETS", () => {
  it("contains the eight expected keys in stable order", () => {
    expect(SANCTION_REASON_PRESETS.map((p) => p.key)).toEqual([
      "spam-comercial",
      "insulto-leve",
      "acoso",
      "flood",
      "off-topic",
      "scam",
      "nsfw",
      "raid",
    ]);
  });

  it("has unique keys and only valid suggested actions", () => {
    const keys = SANCTION_REASON_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const preset of SANCTION_REASON_PRESETS) {
      expect(["warn", "mute", "ban"]).toContain(preset.suggestedAction);
    }
  });
});

describe("resolveSanctionReason", () => {
  it("matches by exact key", () => {
    expect(resolveSanctionReason("flood")).toEqual({
      key: "flood",
      label: "Flood",
      suggestedAction: "mute",
    });
  });

  it("matches by key ignoring case and surrounding whitespace", () => {
    expect(resolveSanctionReason("  SCAM  ")?.key).toBe("scam");
  });

  it("matches by contained label text", () => {
    expect(resolveSanctionReason("estafa")?.key).toBe("scam");
  });

  it("matches when the input contains the key", () => {
    expect(resolveSanctionReason("esto es raid masivo")?.key).toBe("raid");
  });

  it("matches by partial key substring", () => {
    expect(resolveSanctionReason("spam")?.key).toBe("spam-comercial");
  });

  it("returns null for empty or whitespace input", () => {
    expect(resolveSanctionReason("")).toBeNull();
    expect(resolveSanctionReason("   ")).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(resolveSanctionReason("xyzzy")).toBeNull();
  });

  it("is deterministic for the same input", () => {
    expect(resolveSanctionReason("acoso")).toEqual(
      resolveSanctionReason("acoso"),
    );
  });
});

describe("formatSanctionReasonList", () => {
  it("renders one line per preset with key, label and action", () => {
    const lines = formatSanctionReasonList().split("\n");
    expect(lines).toHaveLength(SANCTION_REASON_PRESETS.length);
    expect(lines[0]).toBe("- spam-comercial: Spam comercial (expulsar)");
    expect(lines[3]).toBe("- flood: Flood (silenciar)");
    expect(lines[1]).toBe("- insulto-leve: Insulto leve (aviso)");
  });

  it("has no trailing newline", () => {
    expect(formatSanctionReasonList().endsWith("\n")).toBe(false);
  });
});

describe("parseSanctionReasonCommand", () => {
  it("returns null when the command is not /reasons", () => {
    expect(
      parseSanctionReasonCommand(baseUpdate({ command: cmd("ban") })),
    ).toBeNull();
    expect(parseSanctionReasonCommand(baseUpdate())).toBeNull();
  });

  it("parses bare /reasons as a list command", () => {
    expect(
      parseSanctionReasonCommand(baseUpdate({ command: cmd("reasons") })),
    ).toEqual({ ok: true, command: { kind: "list" } });
  });

  it("treats whitespace-only argument as list", () => {
    expect(
      parseSanctionReasonCommand(
        baseUpdate({ command: cmd("reasons", ["   "]) }),
      ),
    ).toEqual({ ok: true, command: { kind: "list" } });
  });

  it("parses /reasons <motivo> resolving to the key", () => {
    expect(
      parseSanctionReasonCommand(
        baseUpdate({ command: cmd("reasons", ["scam"]) }),
      ),
    ).toEqual({ ok: true, command: { kind: "use", reasonKey: "scam" } });
  });

  it("resolves a motivo given as label words", () => {
    expect(
      parseSanctionReasonCommand(
        baseUpdate({ command: cmd("reasons", ["Contenido", "NSFW"]) }),
      ),
    ).toEqual({ ok: true, command: { kind: "use", reasonKey: "nsfw" } });
  });

  it("returns an error result for an unknown motivo", () => {
    expect(
      parseSanctionReasonCommand(
        baseUpdate({ command: cmd("reasons", ["desconocido"]) }),
      ),
    ).toEqual({ ok: false, error: { usage: "Uso: /reasons [motivo]" } });
  });
});

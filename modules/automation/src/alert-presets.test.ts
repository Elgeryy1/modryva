import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  ALERT_PRESET_TARGETS,
  ALERT_SEVERITY_COLORS,
  ALERT_SEVERITY_EMOJIS,
  type AlertEvent,
  alertSeverityColor,
  buildAlertTitle,
  buildDiscordAlertPayload,
  buildSlackAlertPayload,
  isAlertSeverity,
  parseAlertPresetCommand,
} from "./alert-presets.js";

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

const event = (overrides: Partial<AlertEvent> = {}): AlertEvent => ({
  kind: "antiflood",
  groupTitle: "Sala Modryva",
  text: "Se detectaron 30 mensajes en 5 segundos",
  severity: "warn",
  ...overrides,
});

describe("ALERT_PRESET_TARGETS", () => {
  it("contains exactly discord, slack and generic in order", () => {
    expect(ALERT_PRESET_TARGETS).toEqual(["discord", "slack", "generic"]);
  });
});

describe("isAlertSeverity", () => {
  it("accepts the three valid severities", () => {
    expect(isAlertSeverity("info")).toBe(true);
    expect(isAlertSeverity("warn")).toBe(true);
    expect(isAlertSeverity("critical")).toBe(true);
  });

  it("rejects unknown or wrongly-cased values", () => {
    expect(isAlertSeverity("error")).toBe(false);
    expect(isAlertSeverity("INFO")).toBe(false);
    expect(isAlertSeverity("")).toBe(false);
  });
});

describe("alertSeverityColor", () => {
  it("maps each severity to its Discord color", () => {
    expect(alertSeverityColor("info")).toBe(ALERT_SEVERITY_COLORS.info);
    expect(alertSeverityColor("warn")).toBe(ALERT_SEVERITY_COLORS.warn);
    expect(alertSeverityColor("critical")).toBe(ALERT_SEVERITY_COLORS.critical);
  });

  it("uses distinct colors per severity", () => {
    const colors = new Set([
      alertSeverityColor("info"),
      alertSeverityColor("warn"),
      alertSeverityColor("critical"),
    ]);
    expect(colors.size).toBe(3);
  });
});

describe("buildAlertTitle", () => {
  it("prefixes the emoji, severity and kind", () => {
    expect(buildAlertTitle(event({ severity: "critical", kind: "raid" }))).toBe(
      `${ALERT_SEVERITY_EMOJIS.critical} [critical] raid`,
    );
  });
});

describe("buildDiscordAlertPayload", () => {
  it("builds a single embed with severity color and text", () => {
    const payload = buildDiscordAlertPayload(
      event({ severity: "critical" }),
    ) as {
      embeds: {
        title: string;
        description: string;
        color: number;
        fields: { name: string; value: string; inline: boolean }[];
        url?: string;
      }[];
    };
    expect(payload.embeds).toHaveLength(1);
    expect(payload.embeds[0]?.color).toBe(ALERT_SEVERITY_COLORS.critical);
    expect(payload.embeds[0]?.description).toBe(
      "Se detectaron 30 mensajes en 5 segundos",
    );
    expect(payload.embeds[0]?.fields[0]).toEqual({
      name: "Grupo",
      value: "Sala Modryva",
      inline: true,
    });
  });

  it("omits the url when the event has none", () => {
    const payload = buildDiscordAlertPayload(event()) as {
      embeds: { url?: string }[];
    };
    expect(payload.embeds[0]).not.toHaveProperty("url");
  });

  it("includes the url as an embed property when present", () => {
    const payload = buildDiscordAlertPayload(
      event({ url: "https://modryva.example/log/1" }),
    ) as { embeds: { url?: string }[] };
    expect(payload.embeds[0]?.url).toBe("https://modryva.example/log/1");
  });

  it("is deterministic for identical input", () => {
    const e = event({ url: "https://x.example" });
    expect(buildDiscordAlertPayload(e)).toEqual(buildDiscordAlertPayload(e));
  });
});

describe("buildSlackAlertPayload", () => {
  it("builds header and section blocks", () => {
    const payload = buildSlackAlertPayload(event()) as {
      blocks: { type: string; text?: { text: string } }[];
    };
    expect(payload.blocks).toHaveLength(2);
    expect(payload.blocks[0]?.type).toBe("header");
    expect(payload.blocks[0]?.text?.text).toBe(buildAlertTitle(event()));
    expect(payload.blocks[1]?.type).toBe("section");
    expect(payload.blocks[1]?.text?.text).toBe(
      "*Sala Modryva*\nSe detectaron 30 mensajes en 5 segundos",
    );
  });

  it("omits the context block when there is no url", () => {
    const payload = buildSlackAlertPayload(event()) as {
      blocks: { type: string }[];
    };
    expect(payload.blocks.some((b) => b.type === "context")).toBe(false);
  });

  it("appends a context block with the url when present", () => {
    const payload = buildSlackAlertPayload(
      event({ url: "https://modryva.example/log/9" }),
    ) as {
      blocks: {
        type: string;
        elements?: { text: string }[];
      }[];
    };
    expect(payload.blocks).toHaveLength(3);
    const context = payload.blocks[2];
    expect(context?.type).toBe("context");
    expect(context?.elements?.[0]?.text).toBe(
      "<https://modryva.example/log/9|Ver detalle>",
    );
  });

  it("is deterministic for identical input", () => {
    const e = event({ severity: "info" });
    expect(buildSlackAlertPayload(e)).toEqual(buildSlackAlertPayload(e));
  });
});

describe("parseAlertPresetCommand", () => {
  it("parses a valid discord target", () => {
    expect(
      parseAlertPresetCommand(
        baseUpdate({ command: cmd("alertpreset", ["discord"]) }),
      ),
    ).toEqual({ ok: true, command: { target: "discord" } });
  });

  it("parses slack and generic targets", () => {
    expect(
      parseAlertPresetCommand(
        baseUpdate({ command: cmd("alertpreset", ["slack"]) }),
      ),
    ).toEqual({ ok: true, command: { target: "slack" } });
    expect(
      parseAlertPresetCommand(
        baseUpdate({ command: cmd("alertpreset", ["generic"]) }),
      ),
    ).toEqual({ ok: true, command: { target: "generic" } });
  });

  it("lowercases the target before matching", () => {
    expect(
      parseAlertPresetCommand(
        baseUpdate({ command: cmd("alertpreset", ["Discord"]) }),
      ),
    ).toEqual({ ok: true, command: { target: "discord" } });
  });

  it("returns a missing-target error without arguments", () => {
    const result = parseAlertPresetCommand(
      baseUpdate({ command: cmd("alertpreset") }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "missing-target",
        usage: "Uso: /alertpreset discord|slack|generic",
      },
    });
  });

  it("returns an invalid-target error for unknown destinations", () => {
    const result = parseAlertPresetCommand(
      baseUpdate({ command: cmd("alertpreset", ["telegram"]) }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid-target",
        usage: "Uso: /alertpreset discord|slack|generic",
      },
    });
  });

  it("returns null for other commands or no command", () => {
    expect(
      parseAlertPresetCommand(baseUpdate({ command: cmd("ban") })),
    ).toBeNull();
    expect(parseAlertPresetCommand(baseUpdate())).toBeNull();
  });
});

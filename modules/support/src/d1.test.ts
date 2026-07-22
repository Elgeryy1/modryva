import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  automationMatches,
  buildDoctorReport,
  evaluateQuarantineCandidate,
  parseAppealCallback,
  parseAppealCommand,
  parseAutomationCommand,
  parseD1LogCommand,
  parseMissionCommand,
  parseQuarantineCallback,
  parseQuarantineCommand,
} from "./d1.js";

const emptyContent: MessageContentFlags = {
  hasText: false,
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
};

const buildCommandUpdate = (
  name: string,
  args: readonly string[] = [],
): TelegramUpdateEnvelope => ({
  updateId: 1,
  kind: "message",
  receivedAt: new Date(0),
  chat: { chatId: -100n, chatType: "supergroup", topicId: undefined },
  user: { userId: 1n, username: "tester", languageCode: "es" },
  command: { name, raw: `/${name}`, args },
  callbackData: undefined,
  messageText: undefined,
  content: emptyContent,
  attachment: undefined,
  preCheckout: undefined,
  successfulPayment: undefined,
  inlineQuery: undefined,
  messageId: 1,
  newChatMemberIds: [],
  isTextMessage: false,
  raw: {},
});

describe("D1 support helpers", () => {
  it("parses log channel commands", () => {
    expect(parseD1LogCommand(buildCommandUpdate("logs"))).toEqual({
      ok: true,
      command: { kind: "status" },
    });
    expect(
      parseD1LogCommand(buildCommandUpdate("logs", ["set", "-10099"])),
    ).toEqual({
      ok: true,
      command: { kind: "set", logTelegramChatId: -10099n },
    });
  });

  it("parses quarantine commands and callbacks", () => {
    expect(
      parseQuarantineCommand(buildCommandUpdate("quarantine", ["on"])),
    ).toEqual({
      ok: true,
      command: { kind: "on" },
    });
    expect(
      parseQuarantineCommand(buildCommandUpdate("qreject", ["q1", "spam"])),
    ).toEqual({
      ok: true,
      command: { kind: "reject", itemId: "q1", note: "spam" },
    });
    expect(parseQuarantineCallback("d1:q:approve:q1")).toEqual({
      action: "approve",
      itemId: "q1",
    });
  });

  it("parses appeals and callbacks", () => {
    expect(
      parseAppealCommand(buildCommandUpdate("appeal", ["42", "perdon"])),
    ).toEqual({
      ok: true,
      command: { kind: "create", caseRef: "42", message: "perdon" },
    });
    expect(parseAppealCallback("d1:a:deny:a1")).toEqual({
      action: "deny",
      appealId: "a1",
    });
  });

  it("parses automation rules and matches text", () => {
    const parsed = parseAutomationCommand(
      buildCommandUpdate("auto", [
        "add",
        "contains",
        "promo",
        "->",
        "reply",
        "No",
        "spam",
      ]),
    );
    expect(parsed).toMatchObject({
      ok: true,
      command: {
        kind: "add",
        triggerKind: "contains",
        triggerValue: "promo",
        actionKind: "reply",
        actionValue: "No spam",
      },
    });
    expect(
      automationMatches(
        {
          id: "r1",
          name: "test",
          triggerKind: "contains",
          triggerValue: "promo",
          actionKind: "reply",
          active: true,
        },
        "Gran promo hoy",
      ),
    ).toBe(true);
  });

  it("parses missions", () => {
    expect(
      parseMissionCommand(
        buildCommandUpdate("mission", [
          "add",
          "messages",
          "10",
          "Primer",
          "dia",
        ]),
      ),
    ).toEqual({
      ok: true,
      command: {
        kind: "add",
        goalKind: "messages",
        goalTarget: 10,
        title: "Primer dia",
        rewardBadge: "primer_dia",
      },
    });
  });

  it("quarantines suspicious links conservatively", () => {
    const decision = evaluateQuarantineCandidate(
      { ...emptyContent, hasText: true, hasUrl: true },
      "free crypto airdrop https://x.test",
      "balanced",
    );
    expect(decision).toMatchObject({ quarantine: true });
    expect(
      evaluateQuarantineCandidate(
        { ...emptyContent, hasText: true, hasUrl: true },
        "https://example.com/docs",
        "balanced",
      ),
    ).toBeNull();
  });

  it("builds a doctor report with concrete recommendations", () => {
    const report = buildDoctorReport({
      antifloodEnabled: false,
      captchaEnabled: false,
      antiraidEnabled: false,
      welcomeMute: false,
      logEnabled: false,
      quarantineEnabled: false,
      pendingQuarantine: 0,
      openAppeals: 1,
      activeAutomations: 0,
      activeMissions: 0,
    });
    expect(report).toContain("D1 Doctor del grupo");
    expect(report).toContain("Activa /antiflood_on");
    expect(report).toContain("1 apelaciones abiertas");
  });
});

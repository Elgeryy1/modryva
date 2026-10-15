import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  parseGiveawayCommand,
  parseGiveawayJoin,
  pickWinner,
} from "./giveaways.js";

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

describe("parseGiveawayCommand", () => {
  it("parses a create command with a prize", () => {
    expect(
      parseGiveawayCommand(buildCommandUpdate("giveaway", ["Una", "camiseta"])),
    ).toEqual({ ok: true, command: { kind: "create", prize: "Una camiseta" } });
  });

  it("requires a prize", () => {
    expect(parseGiveawayCommand(buildCommandUpdate("giveaway"))).toMatchObject({
      ok: false,
      error: { code: "prize-required" },
    });
  });

  it("parses a draw command with an id", () => {
    expect(parseGiveawayCommand(buildCommandUpdate("gdraw", ["gw_1"]))).toEqual(
      {
        ok: true,
        command: { kind: "draw", giveawayId: "gw_1" },
      },
    );
  });
});

describe("parseGiveawayJoin", () => {
  it("parses a join callback", () => {
    expect(parseGiveawayJoin("giveaway:gw_1")).toBe("gw_1");
  });
  it("returns null for unrelated callbacks", () => {
    expect(parseGiveawayJoin("poll:x:1")).toBeNull();
  });
});

describe("pickWinner", () => {
  it("is deterministic for the same seed and participants", () => {
    const participants = [10n, 20n, 30n, 40n];
    expect(pickWinner(participants, "seed-abc")).toBe(
      pickWinner(participants, "seed-abc"),
    );
  });

  it("is order-independent (sorts participants)", () => {
    expect(pickWinner([30n, 10n, 20n], "s")).toBe(
      pickWinner([10n, 20n, 30n], "s"),
    );
  });

  it("returns a participant from the list", () => {
    const participants = [10n, 20n, 30n];
    expect(participants).toContain(pickWinner(participants, "x"));
  });

  it("returns null with no participants", () => {
    expect(pickWinner([], "s")).toBeNull();
  });
});

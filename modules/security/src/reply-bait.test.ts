import { describe, expect, it } from "vitest";
import { assessReplyBait } from "./reply-bait.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_ACCOUNT_MAX_AGE_MS = 7 * DAY_MS;

const POPULAR = "🔥 Respondió a un mensaje popular";
const NEW_ACCOUNT = "🆕 Cuenta nueva";
const LINK = "🔗 Incluye un enlace";
const MENTION = "📣 Incluye una mención";

describe("assessReplyBait", () => {
  it("fires every signal for a full-house reply", () => {
    expect(
      assessReplyBait({
        isReply: true,
        repliedMessageReactions: 50,
        replierAccountAgeMs: 1000,
        textHasLink: true,
        textHasMention: true,
      }),
    ).toEqual({
      suspicious: true,
      score: 4,
      reasons: [POPULAR, NEW_ACCOUNT, LINK, MENTION],
    });
  });

  it("returns a clean, non-suspicious result when nothing fires", () => {
    expect(
      assessReplyBait({
        isReply: false,
        repliedMessageReactions: 0,
        replierAccountAgeMs: 100 * DAY_MS,
        textHasLink: false,
        textHasMention: false,
      }),
    ).toEqual({ suspicious: false, score: 0, reasons: [] });
  });

  it("scores a lone popular reply without flagging it suspicious", () => {
    expect(
      assessReplyBait({
        isReply: true,
        repliedMessageReactions: 30,
        replierAccountAgeMs: 30 * DAY_MS,
        textHasLink: false,
        textHasMention: false,
      }),
    ).toEqual({ suspicious: false, score: 1, reasons: [POPULAR] });
  });

  it("flags a new account replying to a popular message", () => {
    expect(
      assessReplyBait({
        isReply: true,
        repliedMessageReactions: 25,
        replierAccountAgeMs: 2 * DAY_MS,
        textHasLink: false,
        textHasMention: false,
      }),
    ).toEqual({ suspicious: true, score: 2, reasons: [POPULAR, NEW_ACCOUNT] });
  });

  it("does not count reactions exactly at the threshold as popular", () => {
    expect(
      assessReplyBait({
        isReply: true,
        repliedMessageReactions: 20,
        replierAccountAgeMs: 1000,
        textHasLink: false,
        textHasMention: false,
      }),
    ).toEqual({ suspicious: false, score: 1, reasons: [NEW_ACCOUNT] });
  });

  it("counts reactions one above the threshold as popular", () => {
    expect(
      assessReplyBait({
        isReply: true,
        repliedMessageReactions: 21,
        replierAccountAgeMs: 30 * DAY_MS,
        textHasLink: false,
        textHasMention: false,
      }),
    ).toEqual({ suspicious: false, score: 1, reasons: [POPULAR] });
  });

  it("does not count an account exactly at the age threshold as new", () => {
    expect(
      assessReplyBait({
        isReply: false,
        repliedMessageReactions: 0,
        replierAccountAgeMs: NEW_ACCOUNT_MAX_AGE_MS,
        textHasLink: true,
        textHasMention: true,
      }),
    ).toEqual({ suspicious: true, score: 2, reasons: [LINK, MENTION] });
  });

  it("ignores reactions when the message is not a reply", () => {
    expect(
      assessReplyBait({
        isReply: false,
        repliedMessageReactions: 999,
        replierAccountAgeMs: 100 * DAY_MS,
        textHasLink: false,
        textHasMention: false,
      }),
    ).toEqual({ suspicious: false, score: 0, reasons: [] });
  });

  it("keeps reasons in fixed order regardless of which signals fire", () => {
    expect(
      assessReplyBait({
        isReply: false,
        repliedMessageReactions: 0,
        replierAccountAgeMs: 1000,
        textHasLink: true,
        textHasMention: true,
      }),
    ).toEqual({
      suspicious: true,
      score: 3,
      reasons: [NEW_ACCOUNT, LINK, MENTION],
    });
  });

  it("scores a lone link without flagging it suspicious", () => {
    expect(
      assessReplyBait({
        isReply: false,
        repliedMessageReactions: 0,
        replierAccountAgeMs: 100 * DAY_MS,
        textHasLink: true,
        textHasMention: false,
      }),
    ).toEqual({ suspicious: false, score: 1, reasons: [LINK] });
  });

  it("is deterministic across repeated calls with the same input", () => {
    const input = {
      isReply: true,
      repliedMessageReactions: 25,
      replierAccountAgeMs: 2 * DAY_MS,
      textHasLink: false,
      textHasMention: false,
    } as const;
    expect(assessReplyBait(input)).toEqual(assessReplyBait(input));
  });
});

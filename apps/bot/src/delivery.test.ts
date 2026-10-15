import type { TelegramGateway } from "@superbot/telegram";
import { describe, expect, it, vi } from "vitest";
import { deliverBotReply, extractChatMemberSubjectLabel } from "./delivery.js";

const makeGateway = () => {
  const sendMessage = vi.fn(async (_input: { messageThreadId?: number }) => ({
    ok: true,
    skipped: false,
  }));
  const editMessageText = vi.fn(async (_input: { messageId?: number }) => ({
    ok: true,
    skipped: false,
  }));
  const editMessageCaption = vi.fn(
    async (_input: {
      messageId?: number;
      reply?: { text?: string; replyMarkup?: Record<string, unknown> };
    }) => ({
      ok: true,
      skipped: false,
    }),
  );
  return {
    gateway: {
      sendMessage,
      editMessageText,
      editMessageCaption,
    } as unknown as TelegramGateway,
    sendMessage,
    editMessageText,
    editMessageCaption,
  };
};

const messageUpdate = (topicId: number | undefined) =>
  ({
    kind: "message",
    chat: { chatId: -100n, chatType: "supergroup", topicId },
  }) as never;

const callbackUpdate = () =>
  ({
    kind: "callback_query",
    chat: { chatId: -100n, chatType: "supergroup" },
  }) as never;

describe("deliverBotReply — forum topic routing", () => {
  it("routes the reply back to the topic the command came from", async () => {
    const { gateway, sendMessage } = makeGateway();

    await deliverBotReply({
      gateway,
      update: messageUpdate(42),
      rawUpdate: {},
      reply: { text: "hola" },
      token: "secret",
    });

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ messageThreadId: 42 }),
    );
  });

  it("omits the thread in General / non-forum chats (no regression)", async () => {
    const { gateway, sendMessage } = makeGateway();

    await deliverBotReply({
      gateway,
      update: messageUpdate(undefined),
      rawUpdate: {},
      reply: { text: "hola" },
      token: "secret",
    });

    expect(sendMessage.mock.calls[0]?.[0]?.messageThreadId).toBeUndefined();
  });
});

describe("deliverBotReply — editing a callback's message", () => {
  it("edits the CAPTION when the message is a photo (Guardian STAFF report)", async () => {
    const { gateway, editMessageText, editMessageCaption } = makeGateway();

    await deliverBotReply({
      gateway,
      update: callbackUpdate(),
      rawUpdate: {
        callback_query: {
          message: { message_id: 7, photo: [{ file_id: "x" }] },
        },
      },
      reply: { text: "✅ Aprobado", edit: true },
      token: "secret",
    });

    expect(editMessageCaption).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: 7 }),
    );
    expect(editMessageText).not.toHaveBeenCalled();
  });

  it("edits the TEXT when the message has no media", async () => {
    const { gateway, editMessageText, editMessageCaption } = makeGateway();

    await deliverBotReply({
      gateway,
      update: callbackUpdate(),
      rawUpdate: {
        callback_query: { message: { message_id: 9, text: "informe" } },
      },
      reply: { text: "✅ Aprobado", edit: true },
      token: "secret",
    });

    expect(editMessageText).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: 9 }),
    );
    expect(editMessageCaption).not.toHaveBeenCalled();
  });

  it("preserveCaption keeps the original report and appends the verdict", async () => {
    const { gateway, editMessageCaption } = makeGateway();

    await deliverBotReply({
      gateway,
      update: callbackUpdate(),
      rawUpdate: {
        callback_query: {
          message: {
            message_id: 7,
            photo: [{ file_id: "x" }],
            caption: "VER-ABC · Nombre · motivo · edad 16-25 · IP 1.2.3.4",
          },
        },
      },
      reply: {
        text: "✅ Aprobado por @staff",
        edit: true,
        preserveCaption: true,
      },
      token: "secret",
    });

    const text = editMessageCaption.mock.calls[0]?.[0]?.reply?.text ?? "";
    expect(text).toContain("IP 1.2.3.4"); // original report kept
    expect(text).toContain("✅ Aprobado por @staff"); // verdict appended
    expect(text.indexOf("✅")).toBeGreaterThan(text.indexOf("VER-ABC"));
  });

  const reportKeyboard = {
    inline_keyboard: [[{ text: "✅ Aprobar", callback_data: "grd:ap:x:sig" }]],
  };

  const reportCallback = (): unknown => ({
    callback_query: {
      message: {
        message_id: 7,
        photo: [{ file_id: "x" }],
        caption: "VER-ABC · informe completo",
        reply_markup: reportKeyboard,
      },
    },
  });

  it("preserveMarkup hands the original keyboard back so an interim note doesn't strip the buttons", async () => {
    const { gateway, editMessageCaption } = makeGateway();

    await deliverBotReply({
      gateway,
      update: callbackUpdate(),
      rawUpdate: reportCallback(),
      reply: {
        text: "🔁 Repetición solicitada.",
        edit: true,
        preserveCaption: true,
        preserveMarkup: true,
      },
      token: "secret",
    });

    const sent = editMessageCaption.mock.calls[0]?.[0]?.reply;
    expect(sent?.replyMarkup).toEqual(reportKeyboard);
    expect(sent?.text).toContain("VER-ABC · informe completo");
    expect(sent?.text).toContain("🔁 Repetición solicitada.");
  });

  it("without preserveMarkup the keyboard is dropped (a final verdict closes the case)", async () => {
    const { gateway, editMessageCaption } = makeGateway();

    await deliverBotReply({
      gateway,
      update: callbackUpdate(),
      rawUpdate: reportCallback(),
      reply: { text: "✅ Aprobado", edit: true, preserveCaption: true },
      token: "secret",
    });

    expect(
      editMessageCaption.mock.calls[0]?.[0]?.reply?.replyMarkup,
    ).toBeUndefined();
  });

  it("an explicit replyMarkup wins over preserveMarkup (e.g. the expel confirmation)", async () => {
    const { gateway, editMessageCaption } = makeGateway();
    const confirm = {
      inline_keyboard: [[{ text: "⚠️ Confirmar", callback_data: "grd:ec:x:s" }]],
    };

    await deliverBotReply({
      gateway,
      update: callbackUpdate(),
      rawUpdate: reportCallback(),
      reply: {
        text: "⚠️ ¿Expulsar?",
        edit: true,
        preserveCaption: true,
        preserveMarkup: true,
        replyMarkup: confirm,
      },
      token: "secret",
    });

    expect(editMessageCaption.mock.calls[0]?.[0]?.reply?.replyMarkup).toEqual(
      confirm,
    );
  });
});

describe("extractChatMemberSubjectLabel", () => {
  const raw = (user: unknown) => ({
    chat_member: { new_chat_member: { user } },
  });

  it("prefers the username, so an alert never prints a bare id", () => {
    expect(extractChatMemberSubjectLabel(raw({ id: 7, username: "ana" }))).toBe(
      "@ana",
    );
  });

  it("falls back to the first name when there is no username", () => {
    // Plenty of real accounts have none, and those are exactly the ones an
    // admin cannot look up quickly.
    expect(
      extractChatMemberSubjectLabel(raw({ id: 7, first_name: "  Ana  " })),
    ).toBe("Ana");
  });

  it("returns undefined rather than inventing a label", () => {
    expect(extractChatMemberSubjectLabel(raw({ id: 7 }))).toBeUndefined();
    expect(
      extractChatMemberSubjectLabel(raw({ username: "" })),
    ).toBeUndefined();
    expect(extractChatMemberSubjectLabel({})).toBeUndefined();
    expect(extractChatMemberSubjectLabel(null)).toBeUndefined();
    expect(
      extractChatMemberSubjectLabel({ chat_member: { new_chat_member: null } }),
    ).toBeUndefined();
  });
});

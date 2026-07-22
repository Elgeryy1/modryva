import { describe, expect, it } from "vitest";
import { normalizeUpdate } from "./normalize.js";

describe("normalizeUpdate", () => {
  it("degrades a non-object body to kind:'unknown' instead of throwing", () => {
    // The webhook body arrives as `unknown` from @Body(); a literal null / array /
    // primitive must not crash the property access with a TypeError (a 500 on the
    // Telegram-facing surface) — it should classify as unknown like any other
    // unrecognized shape.
    for (const hostile of [
      null,
      undefined,
      42,
      "not-an-object",
      [] as unknown,
    ]) {
      const envelope = normalizeUpdate(
        hostile as unknown as Parameters<typeof normalizeUpdate>[0],
      );
      expect(envelope.kind).toBe("unknown");
    }
  });

  it("extracts the chat title and the sender first name", () => {
    const envelope = normalizeUpdate({
      update_id: 1,
      message: {
        message_id: 10,
        date: 0,
        text: "hola",
        chat: { id: -100, type: "supergroup", title: "Prueba Superbot" },
        from: { id: 42, username: "demouser", first_name: "Alex" },
      },
    });

    // chat_title must be the real title, never the chat type ("supergroup").
    expect(envelope.chat.chatTitle).toBe("Prueba Superbot");
    expect(envelope.chat.chatType).toBe("supergroup");
    expect(envelope.user.firstName).toBe("Alex");
    expect(envelope.user.username).toBe("demouser");
  });

  it("leaves title/first name absent when Telegram omits them", () => {
    const envelope = normalizeUpdate({
      update_id: 2,
      message: {
        message_id: 11,
        date: 0,
        text: "hi",
        chat: { id: 7, type: "private" },
        from: { id: 7 },
      },
    });

    expect(envelope.chat.chatTitle).toBeUndefined();
    expect(envelope.user.firstName).toBeUndefined();
  });

  it("reads the first name from a new member join event", () => {
    const envelope = normalizeUpdate({
      update_id: 3,
      message: {
        message_id: 12,
        date: 0,
        chat: { id: -100, type: "supergroup", title: "Prueba Superbot" },
        from: { id: 1, first_name: "Admin" },
        new_chat_members: [{ id: 555, is_bot: false }],
      },
    });

    expect(envelope.chat.chatTitle).toBe("Prueba Superbot");
    expect(envelope.newChatMemberIds).toEqual([555n]);
  });

  it("parses a chat_member update (someone else's status change)", () => {
    const envelope = normalizeUpdate({
      update_id: 4,
      chat_member: {
        chat: { id: -100, type: "supergroup" },
        from: { id: 1, first_name: "Admin" },
        old_chat_member: { status: "member" },
        new_chat_member: { status: "left", user: { id: 999 } },
      },
    });

    expect(envelope.kind).toBe("chat_member");
    expect(envelope.chat.chatId).toBe(-100n);
    expect(envelope.chatMemberUpdate).toEqual({
      chatId: -100n,
      telegramUserId: 999n,
      oldStatus: "member",
      newStatus: "left",
    });
  });

  it("keeps the left member separate from the actor that removed them", () => {
    const envelope = normalizeUpdate(
      {
        update_id: 5,
        message: {
          message_id: 13,
          date: 0,
          chat: { id: -100, type: "supergroup" },
          from: { id: 999, username: "ModryvaBot" },
          left_chat_member: {
            id: 55,
            username: "leaver",
            first_name: "Ada",
            is_bot: false,
          },
        },
      },
      "ModryvaBot",
    );

    expect(envelope.leftChatMemberId).toBe(55n);
    expect(envelope.leftChatMember).toMatchObject({
      userId: 55n,
      username: "leaver",
      firstName: "Ada",
    });
  });

  it("does not treat the bot leaving as a human goodbye event", () => {
    const envelope = normalizeUpdate(
      {
        update_id: 6,
        message: {
          message_id: 14,
          date: 0,
          chat: { id: -100, type: "supergroup" },
          from: { id: 42, username: "admin" },
          left_chat_member: { id: 999, username: "ModryvaBot" },
        },
      },
      "ModryvaBot",
    );

    expect(envelope.leftChatMemberId).toBeUndefined();
    expect(envelope.leftChatMember).toBeUndefined();
  });

  it("normalizes guest_message with guest_query_id", () => {
    const envelope = normalizeUpdate({
      update_id: 7,
      guest_message: {
        message_id: 15,
        date: 0,
        text: "ayuda rapida",
        guest_query_id: "guest-1",
        chat: { id: -100, type: "supergroup", title: "Grupo" },
        from: { id: 42, first_name: "Ada" },
      },
    });

    expect(envelope.kind).toBe("guest_message");
    expect(envelope.messageText).toBe("ayuda rapida");
    expect(envelope.guestMessage).toEqual({ queryId: "guest-1" });
  });

  it("treats a guest_query_id carried on `update.message` (not `update.guest_message`) as a guest message too", () => {
    // Bot API 10.0 documents guest_query_id as a field of the Message object
    // itself — Telegram may deliver it inside a populated `update.message`
    // instead of the separate `update.guest_message` envelope key.
    const envelope = normalizeUpdate({
      update_id: 8,
      message: {
        message_id: 16,
        date: 0,
        text: "que tal",
        guest_query_id: "guest-2",
        chat: { id: -200, type: "supergroup", title: "Grupo" },
        from: { id: 42, first_name: "Ada" },
      },
    });

    expect(envelope.kind).toBe("guest_message");
    expect(envelope.messageText).toBe("que tal");
    expect(envelope.guestMessage).toEqual({ queryId: "guest-2" });
  });

  it("extracts the sender identity from inline_query.from (needed to check personal AI access)", () => {
    const envelope = normalizeUpdate({
      update_id: 9,
      inline_query: {
        id: "iq-1",
        query: "hola",
        from: {
          id: 55,
          username: "demouser",
          first_name: "Alex",
          language_code: "es",
        },
      },
    });

    expect(envelope.kind).toBe("inline_query");
    expect(envelope.user.userId).toBe(55n);
    expect(envelope.user.username).toBe("demouser");
    expect(envelope.user.firstName).toBe("Alex");
    expect(envelope.user.languageCode).toBe("es");
  });

  it("extracts inline message metadata from callback queries", () => {
    const envelope = normalizeUpdate({
      update_id: 10,
      callback_query: {
        id: "cb-inline",
        data: "ig:rps",
        inline_message_id: "inline-msg-1",
        chat_instance: "portable-chat",
        from: { id: 55, username: "demouser" },
      },
    });

    expect(envelope.kind).toBe("callback_query");
    expect(envelope.chat.chatId).toBeUndefined();
    expect(envelope.callbackData).toBe("ig:rps");
    expect(envelope.callbackInlineMessageId).toBe("inline-msg-1");
    expect(envelope.callbackChatInstance).toBe("portable-chat");
  });

  it("extracts the Bot API 10.1 query_id from a chat_join_request", () => {
    const envelope = normalizeUpdate({
      update_id: 20,
      chat_join_request: {
        chat: { id: -200, type: "supergroup", title: "Grupo Guardian" },
        from: {
          id: 99,
          username: "nuevo",
          first_name: "Nueva",
          last_name: "Persona",
        },
        user_chat_id: 99,
        query_id: "jrq-abc123",
        invite_link: { name: "Enlace verificado" },
      },
    });

    expect(envelope.kind).toBe("join_request");
    expect(envelope.chat.chatId).toBe(-200n);
    expect(envelope.user.userId).toBe(99n);
    expect(envelope.joinRequest?.queryId).toBe("jrq-abc123");
    expect(envelope.joinRequest?.userChatId).toBe(99n);
    expect(envelope.joinRequest?.lastName).toBe("Persona");
    expect(envelope.joinRequest?.inviteLinkName).toBe("Enlace verificado");
  });

  it("leaves joinRequest absent for a chat_join_request without query_id (pre-10.1)", () => {
    const envelope = normalizeUpdate({
      update_id: 21,
      chat_join_request: {
        chat: { id: -201, type: "supergroup" },
        from: { id: 100 },
      },
    });

    expect(envelope.kind).toBe("join_request");
    expect(envelope.joinRequest?.queryId).toBeUndefined();
  });

  it("leaves joinRequest undefined for updates that are not a join request", () => {
    const envelope = normalizeUpdate({
      update_id: 22,
      message: {
        message_id: 1,
        date: 0,
        text: "hola",
        chat: { id: 1, type: "private" },
        from: { id: 1 },
      },
    });

    expect(envelope.joinRequest).toBeUndefined();
  });

  describe("message_reaction", () => {
    it("keeps the reactor, the actor_chat, and only newly-added reactions", () => {
      const envelope = normalizeUpdate({
        update_id: 90,
        message_reaction: {
          chat: { id: -100, type: "supergroup" },
          message_id: 555,
          user: { id: 42 },
          actor_chat: { id: -100777 },
          old_reaction: [{ type: "emoji", emoji: "👍" }],
          new_reaction: [
            { type: "emoji", emoji: "👍" },
            { type: "emoji", emoji: "🖕" },
          ],
        },
      });

      expect(envelope.kind).toBe("message_reaction");
      expect(envelope.reaction?.userId).toBe(42n);
      expect(envelope.reaction?.actorChatId).toBe(-100777n);
      expect(envelope.reaction?.messageId).toBe(555);
      // 👍 was already there → only 🖕 is newly added.
      expect(envelope.reaction?.emojisAdded).toEqual(["🖕"]);
      expect(envelope.reaction?.reactionsAdded).toEqual([
        { type: "emoji", emoji: "🖕" },
      ]);
    });

    it("preserves custom_emoji reactions and keeps them out of emojisAdded", () => {
      const envelope = normalizeUpdate({
        update_id: 91,
        message_reaction: {
          chat: { id: -100, type: "supergroup" },
          message_id: 556,
          user: { id: 7 },
          old_reaction: [],
          new_reaction: [
            { type: "emoji", emoji: "😀" },
            { type: "custom_emoji", custom_emoji_id: "abc123" },
          ],
        },
      });

      expect(envelope.reaction?.actorChatId).toBeUndefined();
      expect(envelope.reaction?.emojisAdded).toEqual(["😀"]);
      expect(envelope.reaction?.reactionsAdded).toEqual([
        { type: "emoji", emoji: "😀" },
        { type: "custom_emoji", customEmojiId: "abc123" },
      ]);
    });

    it("adds nothing when the reaction set is unchanged", () => {
      const envelope = normalizeUpdate({
        update_id: 92,
        message_reaction: {
          chat: { id: -100, type: "supergroup" },
          message_id: 557,
          user: { id: 7 },
          old_reaction: [{ type: "emoji", emoji: "❤️" }],
          new_reaction: [{ type: "emoji", emoji: "❤️" }],
        },
      });

      expect(envelope.reaction?.emojisAdded).toEqual([]);
      expect(envelope.reaction?.reactionsAdded).toEqual([]);
    });
  });
});

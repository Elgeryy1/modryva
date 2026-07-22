import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpTelegramGateway } from "./gateway.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("HttpTelegramGateway", () => {
  it("skips delivery when there is no bot token", async () => {
    const gateway = new HttpTelegramGateway();

    await expect(
      gateway.sendMessage({
        chatId: 1n,
        token: undefined,
        reply: { text: "hola" },
      }),
    ).resolves.toEqual({ ok: false, skipped: true, reason: "missing-token" });
  });

  it("sends messages through Telegram sendMessage", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    await expect(
      gateway.sendMessage({
        chatId: 1n,
        token: "secret",
        reply: { text: "hola", replyMarkup: { inline_keyboard: [] } },
      }),
    ).resolves.toEqual({ ok: true, skipped: false });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/botsecret/sendMessage",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("extracts the real message_id from Telegram's response, when present", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ ok: true, result: { message_id: 4242 } }),
          {
            status: 200,
          },
        ),
    );
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    await expect(
      gateway.sendMessage({
        chatId: 1n,
        token: "secret",
        reply: { text: "hola" },
      }),
    ).resolves.toEqual({ ok: true, skipped: false, messageId: 4242 });
  });

  it("still reports success without a messageId when the response body isn't parseable JSON", async () => {
    const fetchMock = vi.fn(
      async () => new Response("not json", { status: 200 }),
    );
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    await expect(
      gateway.sendMessage({
        chatId: 1n,
        token: "secret",
        reply: { text: "hola" },
      }),
    ).resolves.toEqual({ ok: true, skipped: false });
  });

  it("sendDice reports success (no value) on an unparseable 200 body instead of throwing", async () => {
    // callTelegramMethodForResult used to let response.json() throw on a 2xx with
    // a garbled/empty body. That throw was caught by sendDice's caller as a hard
    // failure, so a dice roll Telegram actually launched got refunded and the user
    // was told it "could not be launched". Now it degrades like sendMessage.
    const fetchMock = vi.fn(
      async () => new Response("not json", { status: 200 }),
    );
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    await expect(
      gateway.sendDice({ chatId: 1n, emoji: "🎲", token: "secret" }),
    ).resolves.toEqual({ ok: true, skipped: false });
  });

  it("sends chat actions", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    await expect(
      gateway.sendChatAction({
        chatId: 1n,
        action: "typing",
        token: "secret",
      }),
    ).resolves.toEqual({ ok: true, skipped: false });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/botsecret/sendChatAction",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("answers guest queries", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    await expect(
      gateway.answerGuestQuery({
        guestQueryId: "guest-1",
        text: "hola",
        token: "secret",
      }),
    ).resolves.toEqual({ ok: true, skipped: false });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/botsecret/answerGuestQuery",
      expect.objectContaining({ method: "POST" }),
    );
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(call[1].body as string) as {
      result?: { input_message_content?: { message_text?: string } };
      text?: string;
    };
    expect(body.text).toBeUndefined();
    expect(body.result?.input_message_content?.message_text).toBe("hola");
  });

  it("answers inline queries with a configurable cache time", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    await expect(
      gateway.answerInlineQuery({
        inlineQueryId: "iq-1",
        results: [{ id: "help", title: "Modryva", content: "hola" }],
        cacheTime: 300,
        token: "secret",
      }),
    ).resolves.toEqual({ ok: true, skipped: false });

    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(call[1].body as string) as { cache_time?: number };
    expect(body.cache_time).toBe(300);
  });

  it("serializes inline result reply markup", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    await gateway.answerInlineQuery({
      inlineQueryId: "iq-markup",
      results: [
        {
          id: "games",
          title: "Jugar",
          content: "Hub",
          description: "Juegos",
          replyMarkup: {
            inline_keyboard: [[{ text: "RPS", callback_data: "ig:rps" }]],
          },
        },
      ],
      token: "secret",
    });

    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(call[1].body as string) as {
      results?: Array<{ reply_markup?: unknown; description?: string }>;
    };
    expect(body.results?.[0]?.description).toBe("Juegos");
    expect(body.results?.[0]?.reply_markup).toEqual({
      inline_keyboard: [[{ text: "RPS", callback_data: "ig:rps" }]],
    });
  });

  it("edits inline messages by inline_message_id", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    await gateway.editMessageText({
      inlineMessageId: "inline-1",
      reply: { text: "editado", edit: true },
      token: "secret",
    });

    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(call[1].body as string) as {
      inline_message_id?: string;
      chat_id?: string;
      message_id?: number;
    };
    expect(body.inline_message_id).toBe("inline-1");
    expect(body.chat_id).toBeUndefined();
    expect(body.message_id).toBeUndefined();
  });

  it("defaults the inline cache time to 5 seconds when unset", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    await gateway.answerInlineQuery({
      inlineQueryId: "iq-2",
      results: [{ id: "help", title: "Modryva", content: "hola" }],
      token: "secret",
    });

    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(call[1].body as string) as { cache_time?: number };
    expect(body.cache_time).toBe(5);
  });

  it("enforces bans through Telegram banChatMember", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    await expect(
      gateway.banChatMember({
        chatId: -100n,
        userId: 42n,
        token: "secret",
        untilDate: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).resolves.toEqual({ ok: true, skipped: false });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/botsecret/banChatMember",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("unbanChatMember defaults to only_if_banned:true (never kicks a non-banned member)", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    await gateway.unbanChatMember({
      chatId: -100n,
      userId: 42n,
      token: "secret",
    });

    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(call[1].body as string) as {
      only_if_banned?: boolean;
    };
    expect(body.only_if_banned).toBe(true);
  });

  it("unbanChatMember passes only_if_banned:false for the kick pattern", async () => {
    // A kick is ban-then-immediately-unban; Telegram's ban can lag behind the
    // call that issued it, so only_if_banned:true would see "not banned yet"
    // and no-op, leaving the ban permanent instead of a kick.
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    await gateway.unbanChatMember({
      chatId: -100n,
      userId: 42n,
      token: "secret",
      onlyIfBanned: false,
    });

    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(call[1].body as string) as {
      only_if_banned?: boolean;
    };
    expect(body.only_if_banned).toBe(false);
  });

  it("enforces mutes through Telegram restrictChatMember", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    await expect(
      gateway.restrictChatMember({
        chatId: -100n,
        userId: 42n,
        token: "secret",
        untilDate: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).resolves.toEqual({ ok: true, skipped: false });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/botsecret/restrictChatMember",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("reads group metadata through Telegram getChat", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            result: {
              id: -1008571420320,
              type: "supergroup",
              title: "Grupo STAFF",
              username: "staff_modryva",
            },
          }),
          { status: 200 },
        ),
    );
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    await expect(
      gateway.getChat({ chatId: -1008571420320n, token: "secret" }),
    ).resolves.toEqual({
      ok: true,
      skipped: false,
      chat: {
        chatId: -1008571420320n,
        type: "supergroup",
        title: "Grupo STAFF",
        username: "staff_modryva",
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/botsecret/getChat",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("reports guard_bot from getChat (Bot API 10.1 ChatFullInfo)", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            result: {
              id: -1008571420320,
              type: "supergroup",
              title: "Grupo STAFF",
              username: "staff_modryva",
              guard_bot: true,
            },
          }),
          { status: 200 },
        ),
    );
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    const result = await gateway.getChat({
      chatId: -1008571420320n,
      token: "secret",
    });

    expect(result.chat?.guardBot).toBe(true);
  });

  it("omits guard_bot when Telegram does not report it", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ ok: true, result: { id: 1, type: "private" } }),
          { status: 200 },
        ),
    );
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    const result = await gateway.getChat({ chatId: 1n, token: "secret" });

    expect(result.chat?.guardBot).toBeUndefined();
  });

  it("reports supportsJoinRequestQueries from getMe (Bot API 10.1)", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            result: {
              first_name: "Modryva",
              username: "TestVerifierBot",
              supports_join_request_queries: true,
            },
          }),
          { status: 200 },
        ),
    );
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    await expect(gateway.getMe({ token: "secret" })).resolves.toEqual({
      ok: true,
      skipped: false,
      name: "Modryva",
      username: "TestVerifierBot",
      supportsGuestQueries: undefined,
      supportsJoinRequestQueries: true,
    });
  });

  it("opens the Guardian Mini App via sendChatJoinRequestWebApp", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    await expect(
      gateway.sendChatJoinRequestWebApp({
        chatJoinRequestQueryId: "jrq-1",
        webAppUrl: "https://modryva.example/guardian/verify?session=tok",
        token: "secret",
      }),
    ).resolves.toEqual({ ok: true, skipped: false });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/botsecret/sendChatJoinRequestWebApp",
      expect.objectContaining({ method: "POST" }),
    );
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(call[1].body as string) as {
      chat_join_request_query_id?: string;
      web_app_url?: string;
      web_app?: unknown;
    };
    expect(body.chat_join_request_query_id).toBe("jrq-1");
    // Bot API 10.1 requires a flat `web_app_url` string; live Telegram rejects
    // the `web_app: { url }` object shape with 400. Guard against regressing to
    // the object form, which silently breaks Guardian join-request verification.
    expect(body.web_app_url).toBe(
      "https://modryva.example/guardian/verify?session=tok",
    );
    expect(body.web_app).toBeUndefined();
  });

  it("resolves a join request query via answerChatJoinRequestQuery", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    await expect(
      gateway.answerChatJoinRequestQuery({
        chatJoinRequestQueryId: "jrq-1",
        result: "approve",
        token: "secret",
      }),
    ).resolves.toEqual({ ok: true, skipped: false });

    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(call[1].body as string) as {
      chat_join_request_query_id?: string;
      result?: string;
    };
    expect(body.chat_join_request_query_id).toBe("jrq-1");
    expect(body.result).toBe("approve");
  });

  it("skips sendChatJoinRequestWebApp and answerChatJoinRequestQuery without a token", async () => {
    const gateway = new HttpTelegramGateway();

    await expect(
      gateway.sendChatJoinRequestWebApp({
        chatJoinRequestQueryId: "jrq-1",
        webAppUrl: "https://modryva.example/guardian/verify",
        token: undefined,
      }),
    ).resolves.toEqual({ ok: false, skipped: true, reason: "missing-token" });

    await expect(
      gateway.answerChatJoinRequestQuery({
        chatJoinRequestQueryId: "jrq-1",
        result: "queue",
        token: undefined,
      }),
    ).resolves.toEqual({ ok: false, skipped: true, reason: "missing-token" });
  });

  it("sends protect_content when the caller asks for it", async () => {
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response("{}", { status: 200 }),
    );
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    await gateway.sendPhoto({
      chatId: 1n,
      token: "secret",
      imageBase64: Buffer.from("x").toString("base64"),
      type: "jpg",
      protectContent: true,
    });

    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get("protect_content")).toBe("true");
  });

  it("omits protect_content when not requested", async () => {
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response("{}", { status: 200 }),
    );
    globalThis.fetch = fetchMock;
    const gateway = new HttpTelegramGateway();

    await gateway.sendPhoto({
      chatId: 1n,
      token: "secret",
      imageBase64: Buffer.from("x").toString("base64"),
      type: "jpg",
    });

    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get("protect_content")).toBeNull();
  });

  describe("429 retry (high-volume policy)", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    const rateLimited = (retryAfter: number) =>
      new Response(
        JSON.stringify({ ok: false, parameters: { retry_after: retryAfter } }),
        { status: 429 },
      );

    it("sendMessage succeeds after a single 429-then-200 retry", async () => {
      vi.useFakeTimers();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(rateLimited(1))
        .mockResolvedValueOnce(new Response("{}", { status: 200 }));
      globalThis.fetch = fetchMock;
      const gateway = new HttpTelegramGateway();

      const resultPromise = gateway.sendMessage({
        chatId: 1n,
        token: "secret",
        reply: { text: "hola" },
      });
      await vi.advanceTimersByTimeAsync(1000);

      await expect(resultPromise).resolves.toEqual({
        ok: true,
        skipped: false,
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("gives up after exactly 2 attempts (not the 4-attempt provisioning policy)", async () => {
      vi.useFakeTimers();
      const fetchMock = vi.fn().mockResolvedValue(rateLimited(1));
      globalThis.fetch = fetchMock;
      const gateway = new HttpTelegramGateway();

      const resultPromise = gateway.sendMessage({
        chatId: 1n,
        token: "secret",
        reply: { text: "hola" },
      });
      // Attach the rejection assertion BEFORE advancing timers, so the
      // rejection (which fires mid-advance) is never briefly unhandled.
      const assertion = expect(resultPromise).rejects.toThrow();
      await vi.advanceTimersByTimeAsync(1000);

      // The final (2nd) attempt's raw 429 Response is returned unread, and
      // sendMessage's own !response.ok handling throws on it — same as any
      // other non-ok status, proving no further retries happened.
      await assertion;
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("clamps a retry_after above the 3s cap", async () => {
      vi.useFakeTimers();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(rateLimited(30))
        .mockResolvedValueOnce(new Response("{}", { status: 200 }));
      globalThis.fetch = fetchMock;
      const gateway = new HttpTelegramGateway();

      const resultPromise = gateway.sendMessage({
        chatId: 1n,
        token: "secret",
        reply: { text: "hola" },
      });
      // Only the capped 3s elapses, NOT the full 30s Telegram asked for.
      await vi.advanceTimersByTimeAsync(3000);

      await expect(resultPromise).resolves.toEqual({
        ok: true,
        skipped: false,
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not retry or add delay on a non-429 error", async () => {
      const fetchMock = vi.fn(async () => new Response("{}", { status: 400 }));
      globalThis.fetch = fetchMock;
      const gateway = new HttpTelegramGateway();

      await expect(
        gateway.sendMessage({
          chatId: 1n,
          token: "secret",
          reply: { text: "hola" },
        }),
      ).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("resends sendPhoto's FormData body correctly on a retried attempt", async () => {
      vi.useFakeTimers();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(rateLimited(1))
        .mockResolvedValueOnce(new Response("{}", { status: 200 }));
      globalThis.fetch = fetchMock;
      const gateway = new HttpTelegramGateway();

      const resultPromise = gateway.sendPhoto({
        chatId: 1n,
        token: "secret",
        imageBase64: Buffer.from("x").toString("base64"),
        type: "jpg",
        caption: "una foto",
      });
      await vi.advanceTimersByTimeAsync(1000);
      await resultPromise;

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const secondCallBody = fetchMock.mock.calls[1]?.[1]?.body as FormData;
      expect(secondCallBody.get("chat_id")).toBe("1");
      expect(secondCallBody.get("caption")).toBe("una foto");
      expect(secondCallBody.get("photo")).toBeInstanceOf(Blob);
    });
  });

  describe("getChatMember rights", () => {
    const memberResponse = (result: Record<string, unknown>) =>
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: true, result }), { status: 200 }),
      );

    it("surfaces can_delete_messages for an administrator", async () => {
      globalThis.fetch = memberResponse({
        status: "administrator",
        can_delete_messages: true,
      });
      const res = await new HttpTelegramGateway().getChatMember({
        chatId: 1n,
        userId: 2n,
        token: "secret",
      });
      expect(res).toMatchObject({
        ok: true,
        status: "administrator",
        canDeleteMessages: true,
      });
    });

    it("treats a creator as able to delete", async () => {
      globalThis.fetch = memberResponse({ status: "creator" });
      const res = await new HttpTelegramGateway().getChatMember({
        chatId: 1n,
        userId: 2n,
        token: "secret",
      });
      expect(res.canDeleteMessages).toBe(true);
    });

    it("returns false for an administrator whose delete flag is off", async () => {
      globalThis.fetch = memberResponse({
        status: "administrator",
        can_delete_messages: false,
      });
      const res = await new HttpTelegramGateway().getChatMember({
        chatId: 1n,
        userId: 2n,
        token: "secret",
      });
      expect(res.canDeleteMessages).toBe(false);
    });

    it("is unknown (undefined) for an administrator with no delete flag (incomplete response)", async () => {
      globalThis.fetch = memberResponse({ status: "administrator" });
      const res = await new HttpTelegramGateway().getChatMember({
        chatId: 1n,
        userId: 2n,
        token: "secret",
      });
      expect(res.canDeleteMessages).toBeUndefined();
    });

    it.each([
      "member",
      "restricted",
      "left",
      "kicked",
    ])("reports false (definitively cannot delete) for status %s", async (status) => {
      globalThis.fetch = memberResponse({ status });
      const res = await new HttpTelegramGateway().getChatMember({
        chatId: 1n,
        userId: 2n,
        token: "secret",
      });
      expect(res.canDeleteMessages).toBe(false);
    });

    it("is unknown (undefined) for a missing/garbage status", async () => {
      globalThis.fetch = memberResponse({ status: 42 });
      const res = await new HttpTelegramGateway().getChatMember({
        chatId: 1n,
        userId: 2n,
        token: "secret",
      });
      expect(res.canDeleteMessages).toBeUndefined();
    });

    it("is unknown (undefined) when the lookup itself fails", async () => {
      globalThis.fetch = vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: false, description: "boom" }), {
            status: 400,
          }),
      );
      const res = await new HttpTelegramGateway().getChatMember({
        chatId: 1n,
        userId: 2n,
        token: "secret",
      });
      expect(res.ok).toBe(false);
      expect(res.canDeleteMessages).toBeUndefined();
    });
  });

  describe("setWebhook / getWebhookInfo", () => {
    const okResult = (result: unknown) =>
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ ok: true, result }), { status: 200 }),
        );

    it("drops pending updates by default on a fresh registration", async () => {
      const fetchMock = okResult(true);
      globalThis.fetch = fetchMock;
      await new HttpTelegramGateway().setWebhook({
        url: "https://x/hook",
        secretToken: "s",
        allowedUpdates: ["message"],
        token: "t",
      });
      const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
      expect(body.drop_pending_updates).toBe(true);
      expect(body.allowed_updates).toEqual(["message"]);
    });

    it("preserves pending updates when dropPendingUpdates is false (refresh)", async () => {
      const fetchMock = okResult(true);
      globalThis.fetch = fetchMock;
      await new HttpTelegramGateway().setWebhook({
        url: "https://x/hook",
        secretToken: "s",
        allowedUpdates: ["message", "message_reaction"],
        token: "t",
        dropPendingUpdates: false,
      });
      const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
      expect(body.drop_pending_updates).toBe(false);
    });

    it("getWebhookInfo surfaces allowed_updates and pending count", async () => {
      globalThis.fetch = okResult({
        url: "https://x/hook",
        allowed_updates: ["message", "message_reaction"],
        pending_update_count: 3,
      });
      const info = await new HttpTelegramGateway().getWebhookInfo({
        token: "t",
      });
      expect(info.ok).toBe(true);
      expect(info.allowedUpdates).toContain("message_reaction");
      expect(info.pendingUpdateCount).toBe(3);
    });

    it("getWebhookInfo returns ok:false on failure instead of throwing", async () => {
      globalThis.fetch = vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: false, description: "boom" }), {
            status: 400,
          }),
      );
      const info = await new HttpTelegramGateway().getWebhookInfo({
        token: "t",
      });
      expect(info.ok).toBe(false);
    });
  });

  describe("reaction moderation (Bot API 10.0)", () => {
    it("removes a user's reactions from one message (deleteMessageReaction)", async () => {
      const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
      globalThis.fetch = fetchMock;
      const gateway = new HttpTelegramGateway();

      await expect(
        gateway.deleteMessageReaction({
          chatId: 42n,
          messageId: 7,
          actor: { userId: 99n },
          token: "secret",
        }),
      ).resolves.toEqual({ ok: true, skipped: false });

      const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(call[0]).toBe(
        "https://api.telegram.org/botsecret/deleteMessageReaction",
      );
      // No `reaction` field: Telegram targets the actor, not the emoji.
      expect(JSON.parse(call[1].body as string)).toEqual({
        chat_id: "42",
        message_id: 7,
        user_id: "99",
      });
    });

    it("supports a channel-as-actor via actor_chat_id", async () => {
      const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
      globalThis.fetch = fetchMock;
      const gateway = new HttpTelegramGateway();

      await gateway.deleteMessageReaction({
        chatId: 1n,
        messageId: 2,
        actor: { actorChatId: -100500n },
        token: "secret",
      });

      const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(JSON.parse(call[1].body as string)).toEqual({
        chat_id: "1",
        message_id: 2,
        actor_chat_id: "-100500",
      });
    });

    it("purges an actor's recent reactions (deleteAllMessageReactions, no message_id)", async () => {
      const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
      globalThis.fetch = fetchMock;
      const gateway = new HttpTelegramGateway();

      await expect(
        gateway.deleteAllMessageReactions({
          chatId: 42n,
          actor: { userId: 99n },
          token: "secret",
        }),
      ).resolves.toEqual({ ok: true, skipped: false });

      const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(call[0]).toBe(
        "https://api.telegram.org/botsecret/deleteAllMessageReactions",
      );
      // Global over the chat: carries the actor but NOT a message_id.
      expect(JSON.parse(call[1].body as string)).toEqual({
        chat_id: "42",
        user_id: "99",
      });
    });

    it("skips reaction removal when there is no bot token", async () => {
      const gateway = new HttpTelegramGateway();
      await expect(
        gateway.deleteMessageReaction({
          chatId: 1n,
          messageId: 1,
          actor: { userId: 5n },
          token: undefined,
        }),
      ).resolves.toEqual({ ok: false, skipped: true, reason: "missing-token" });
    });
  });
});

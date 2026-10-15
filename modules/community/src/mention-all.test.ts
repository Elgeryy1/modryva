import { describe, expect, it } from "vitest";
import {
  buildMentionAllMessages,
  mentionLink,
  parseMentionAll,
} from "./mention-all.js";

const targets = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    telegramUserId: BigInt(1000 + i),
    name: `Persona ${i}`,
  }));

describe("parseMentionAll", () => {
  it("takes the message after the trigger", () => {
    expect(parseMentionAll("@all reunión a las 8")).toEqual({
      text: "reunión a las 8",
    });
    expect(parseMentionAll("/all hola")).toEqual({ text: "hola" });
    expect(parseMentionAll("@todos hola")).toEqual({ text: "hola" });
  });

  it("accepts the trigger with no message", () => {
    expect(parseMentionAll("@all")).toEqual({ text: "" });
  });

  it("ignores it mid-sentence", () => {
    // Someone TALKING about the feature must not ping the entire group.
    expect(parseMentionAll("le puse @all y no iba")).toBeNull();
    expect(parseMentionAll("prueba con /all luego")).toBeNull();
  });

  it("does not match a longer word starting with the trigger", () => {
    expect(parseMentionAll("@allison mira esto")).toBeNull();
  });
});

describe("mentionLink", () => {
  it("escapes a name that would otherwise break the HTML", () => {
    // A member called "<b>" would make Telegram reject the whole message —
    // one badly-named person silently killing every announcement.
    expect(
      mentionLink({ telegramUserId: 7n, name: "<b>Ana & Co</b>" }),
    ).toContain("&lt;b&gt;Ana &amp; Co&lt;/b&gt;");
  });

  it("trims an absurdly long name instead of dropping the person", () => {
    const link = mentionLink({ telegramUserId: 7n, name: "x".repeat(200) });
    expect(link).toContain("…");
    expect(link).toContain("tg://user?id=7");
  });

  it("never produces an empty label", () => {
    expect(mentionLink({ telegramUserId: 7n, name: "   " })).toContain(
      "alguien",
    );
  });
});

describe("buildMentionAllMessages", () => {
  it("sends the announcement first, then the mentions", () => {
    const messages = buildMentionAllMessages("hola", targets(3));
    expect(messages[0]).toBe("hola");
    expect(messages[1]).toContain("tg://user?id=1000");
  });

  it("splits mentions into batches", () => {
    const messages = buildMentionAllMessages("hola", targets(60), 25);
    // 1 announcement + 3 batches (25 + 25 + 10)
    expect(messages).toHaveLength(4);
  });

  it("keeps the announcement in its OWN message", () => {
    // Otherwise a long text pushes mentions past the 4096-char limit and the
    // people at the end of the list are silently never pinged.
    const long = "x".repeat(4000);
    const messages = buildMentionAllMessages(long, targets(30), 25);
    expect(messages[0]).not.toContain("tg://user");
    expect(messages.slice(1).join(" ")).toContain("tg://user?id=1029");
  });

  it("truncates an over-long announcement rather than being rejected", () => {
    const messages = buildMentionAllMessages("y".repeat(5000), []);
    expect((messages[0] ?? "").length).toBeLessThanOrEqual(4096);
  });

  it("works with no announcement text at all", () => {
    const messages = buildMentionAllMessages("", targets(2));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("tg://user?id=1000");
  });

  it("mentions everyone given, across batches", () => {
    const messages = buildMentionAllMessages("", targets(53), 25);
    const joined = messages.join(" ");
    for (const t of targets(53)) {
      expect(joined).toContain(`id=${t.telegramUserId.toString()}`);
    }
  });
});

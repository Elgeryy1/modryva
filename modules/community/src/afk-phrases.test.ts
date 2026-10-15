import { describe, expect, it } from "vitest";
import {
  buildAfkAwayNotice,
  buildAfkReturnNotice,
  detectAfkPhrase,
} from "./afk-phrases.js";

describe("detectAfkPhrase — what it catches", () => {
  it("catches a bare brb, with no reason", () => {
    expect(detectAfkPhrase("brb")).toEqual({ reason: undefined });
    expect(detectAfkPhrase("BRB")).toEqual({ reason: undefined });
  });

  it("takes the reason from what follows", () => {
    expect(detectAfkPhrase("me voy a dormir")).toEqual({ reason: "dormir" });
    expect(detectAfkPhrase("brb a cenar")).toEqual({ reason: "cenar" });
    expect(detectAfkPhrase("me voy a la ducha")).toEqual({
      reason: "la ducha",
    });
  });

  it("keeps the accents and capitals of the original", () => {
    // The reason is shown back to the group, so it must not come out
    // lowercased and stripped by the matching step.
    expect(detectAfkPhrase("me voy a clase de Música")).toEqual({
      reason: "clase de Música",
    });
  });

  it("catches the other common openers", () => {
    for (const text of [
      "ahora vuelvo",
      "me piro un rato",
      "me marcho",
      "hasta luego",
      "me desconecto",
      "buenas noches",
    ]) {
      expect(detectAfkPhrase(text), text).not.toBeNull();
    }
  });
});

describe("detectAfkPhrase — what it must NOT catch", () => {
  // A false positive tells the group somebody left while they are still
  // talking, which is worse than missing a real departure.
  it("ignores questions", () => {
    expect(detectAfkPhrase("¿te vas a dormir?")).toBeNull();
    expect(detectAfkPhrase("me voy a dormir?")).toBeNull();
  });

  it("ignores talk about someone else", () => {
    expect(detectAfkPhrase("se va a dormir ya")).toBeNull();
    expect(detectAfkPhrase("el va a dormir")).toBeNull();
  });

  it("ignores negations and future plans", () => {
    expect(detectAfkPhrase("no me voy todavia")).toBeNull();
    expect(detectAfkPhrase("luego me voy a dormir")).toBeNull();
    expect(detectAfkPhrase("si me voy te aviso")).toBeNull();
  });

  it("ignores quotes", () => {
    expect(detectAfkPhrase('"me voy a dormir" dijo')).toBeNull();
  });

  it("ignores a long message that merely starts that way", () => {
    // A story, not a status. Real departures are short.
    expect(
      detectAfkPhrase(
        "me voy a explayar un poco porque creo que el tema de ayer no quedó claro y quiero que lo hablemos con calma entre todos",
      ),
    ).toBeNull();
  });

  it("ignores mid-sentence matches", () => {
    expect(
      detectAfkPhrase("cuando dijo que se iba a dormir me reí"),
    ).toBeNull();
  });

  it("is stricter inside a reply", () => {
    // Replying "me voy a dormir" to someone is usually a comment on THEIR
    // message; "brb" never is.
    expect(detectAfkPhrase("me voy a dormir", { isReply: true })).toBeNull();
    expect(detectAfkPhrase("brb", { isReply: true })).not.toBeNull();
  });

  it("ignores an empty message", () => {
    expect(detectAfkPhrase("   ")).toBeNull();
  });
});

describe("notices", () => {
  it("names the person and the reason", () => {
    expect(buildAfkAwayNotice("@ana", "dormir")).toBe(
      "💤 @ana se ha ido a dormir",
    );
  });

  it("drops the reason cleanly when there is none", () => {
    expect(buildAfkAwayNotice("@ana", undefined)).toBe("💤 @ana se ha ido");
  });

  it("reports how long they were gone", () => {
    expect(buildAfkReturnNotice("@ana", "2h 3m")).toBe(
      "👋 @ana ha vuelto después de 2h 3m",
    );
  });
});

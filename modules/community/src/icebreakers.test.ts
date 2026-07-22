import { describe, expect, it } from "vitest";
import {
  ICEBREAKER_BANK,
  type IcebreakerTopic,
  isIcebreakerTopic,
  listIcebreakerTopics,
  pickIcebreaker,
} from "./icebreakers.js";

const TOPICS: readonly IcebreakerTopic[] = [
  "general",
  "gaming",
  "tech",
  "musica",
  "estudio",
];

describe("ICEBREAKER_BANK", () => {
  it("exposes exactly the five expected topics", () => {
    expect(Object.keys(ICEBREAKER_BANK).sort()).toEqual([...TOPICS].sort());
  });

  it("has a non-empty question list for every topic", () => {
    for (const topic of TOPICS) {
      const questions = ICEBREAKER_BANK[topic];
      expect(questions.length).toBeGreaterThan(0);
    }
  });

  it("keeps every question a non-empty trimmed string", () => {
    for (const topic of TOPICS) {
      for (const question of ICEBREAKER_BANK[topic]) {
        expect(question.length).toBeGreaterThan(0);
        expect(question).toBe(question.trim());
      }
    }
  });

  it("has no duplicate questions within a topic", () => {
    for (const topic of TOPICS) {
      const questions = ICEBREAKER_BANK[topic];
      expect(new Set(questions).size).toBe(questions.length);
    }
  });

  it("uses correct accents in user-facing questions", () => {
    expect(ICEBREAKER_BANK.tech).toContain(
      "Que tecnologia te da mas miedo y cual mas ilusion?",
    );
    const musica = ICEBREAKER_BANK.musica[0] ?? "";
    expect(musica).toContain("cancion");
  });
});

describe("listIcebreakerTopics", () => {
  it("returns the five topics in a stable order", () => {
    expect(listIcebreakerTopics()).toEqual([
      "general",
      "gaming",
      "tech",
      "musica",
      "estudio",
    ]);
  });

  it("returns the same reference/content on repeated calls", () => {
    expect(listIcebreakerTopics()).toEqual(listIcebreakerTopics());
  });

  it("lists exactly the keys present in the bank", () => {
    expect([...listIcebreakerTopics()].sort()).toEqual(
      Object.keys(ICEBREAKER_BANK).sort(),
    );
  });
});

describe("isIcebreakerTopic", () => {
  it("accepts every supported topic", () => {
    for (const topic of TOPICS) {
      expect(isIcebreakerTopic(topic)).toBe(true);
    }
  });

  it("rejects unknown or malformed topics", () => {
    expect(isIcebreakerTopic("deportes")).toBe(false);
    expect(isIcebreakerTopic("")).toBe(false);
    expect(isIcebreakerTopic("GENERAL")).toBe(false);
    expect(isIcebreakerTopic("toString")).toBe(false);
  });
});

describe("pickIcebreaker", () => {
  it("returns a question that belongs to the requested topic", () => {
    for (const topic of TOPICS) {
      const question = pickIcebreaker(topic, 42);
      expect(ICEBREAKER_BANK[topic]).toContain(question);
    }
  });

  it("is deterministic for identical topic and seed", () => {
    expect(pickIcebreaker("gaming", 12_345)).toBe(
      pickIcebreaker("gaming", 12_345),
    );
    expect(pickIcebreaker("estudio", 0)).toBe(pickIcebreaker("estudio", 0));
  });

  it("falls back to the general bank for unknown topics", () => {
    const question = pickIcebreaker("desconocido", 7);
    expect(ICEBREAKER_BANK.general).toContain(question);
  });

  it("handles negative and fractional seeds deterministically", () => {
    expect(pickIcebreaker("tech", -99)).toBe(pickIcebreaker("tech", -99));
    expect(pickIcebreaker("tech", 3.7)).toBe(pickIcebreaker("tech", 3.7));
    const negative = pickIcebreaker("tech", -1);
    expect(ICEBREAKER_BANK.tech).toContain(negative);
  });

  it("covers different questions across a range of seeds", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) {
      seen.add(pickIcebreaker("general", seed));
    }
    // The hash should reach more than a single bucket.
    expect(seen.size).toBeGreaterThan(1);
  });

  it("never returns an empty string for the built-in bank", () => {
    for (const topic of TOPICS) {
      for (let seed = 0; seed < 50; seed += 1) {
        expect(pickIcebreaker(topic, seed).length).toBeGreaterThan(0);
      }
    }
  });

  it("treats zero as a valid seed", () => {
    const question = pickIcebreaker("musica", 0);
    expect(ICEBREAKER_BANK.musica).toContain(question);
  });
});

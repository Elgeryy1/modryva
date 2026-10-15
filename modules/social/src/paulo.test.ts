import { describe, expect, it } from "vitest";
import {
  combinationsFor,
  composePaulo,
  normalizeTopic,
  PAULO_MAX_LENGTH,
  PAULO_TOPICS,
} from "./paulo.js";
import { sequenceRandom } from "./ports.js";

describe("normalizeTopic", () => {
  it("accepts the topics as written, accents and case included", () => {
    expect(normalizeTopic("LUNES")).toBe("lunes");
    expect(normalizeTopic("Trabajo")).toBe("trabajo");
  });

  it("understands what people actually type", () => {
    expect(normalizeTopic("curro")).toBe("trabajo");
    expect(normalizeTopic("examenes")).toBe("estudios");
    expect(normalizeTopic("exámenes")).toBe("estudios");
    expect(normalizeTopic("pasta")).toBe("dinero");
    expect(normalizeTopic("crush")).toBe("amor");
  });

  it("falls back to general instead of refusing", () => {
    // `/paulo berenjenas` should produce a sentence, not a usage message.
    expect(normalizeTopic("berenjenas")).toBe("general");
    expect(normalizeTopic(undefined)).toBe("general");
    expect(normalizeTopic("")).toBe("general");
  });
});

describe("composePaulo", () => {
  it("is deterministic for a given draw", () => {
    const a = composePaulo("general", sequenceRandom([0, 0, 0]));
    const b = composePaulo("general", sequenceRandom([0, 0, 0]));
    expect(a.text).toBe(b.text);
  });

  it("produces a different sentence for a different draw", () => {
    const a = composePaulo("general", sequenceRandom([0, 0, 0]));
    const b = composePaulo("general", sequenceRandom([1, 1, 1]));
    expect(a.text).not.toBe(b.text);
  });

  it("always produces one readable sentence, whatever the draw", () => {
    for (const topic of PAULO_TOPICS) {
      for (let i = 0; i < 40; i += 1) {
        const result = composePaulo(topic, sequenceRandom([i, i * 3, i * 7]));
        expect(result.text.length).toBeGreaterThan(10);
        expect(result.text.length).toBeLessThanOrEqual(PAULO_MAX_LENGTH);
        expect(result.text.endsWith(".")).toBe(true);
        // No empty fragment slipped in as ", ." or a double space.
        expect(result.text).not.toMatch(/,\s*\.|\s{2,}/u);
        expect(result.topic).toBe(topic);
      }
    }
  });

  it("has enough material that a group will not see repeats all week", () => {
    for (const topic of PAULO_TOPICS) {
      expect(combinationsFor(topic)).toBeGreaterThan(500);
    }
  });

  it("uses the topic's own material when it has some", () => {
    // The pole topic must be able to say something about the pole.
    const seen = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      seen.add(composePaulo("pole", sequenceRandom([i, i, i])).text);
    }
    expect([...seen].some((text) => /pole/iu.test(text))).toBe(true);
  });

  it("needs no AI, no network and no clock", () => {
    // Composition is a pure function of (topic, draws) — this is the whole
    // reason it keeps working when the AI is switched off, which it often is.
    const out = composePaulo("trabajo", sequenceRandom([2, 5, 1]));
    expect(typeof out.text).toBe("string");
  });
});

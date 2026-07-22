import { describe, expect, it } from "vitest";
import {
  type ConversationStat,
  scoreWikiCandidate,
  WIKI_CANDIDATE_THRESHOLD,
  WIKI_MIN_MESSAGES,
  WIKI_MIN_PARTICIPANTS,
  WIKI_MIN_QUESTIONS,
  wikiCandidateScore,
} from "./wiki-candidate.js";

const MINUTE = 60_000;

const stat = (overrides: Partial<ConversationStat> = {}): ConversationStat => ({
  messages: 12,
  participants: 4,
  questions: 3,
  links: 2,
  durationMs: 20 * MINUTE,
  ...overrides,
});

describe("wikiCandidateScore", () => {
  it("returns 0 for an empty conversation", () => {
    expect(
      wikiCandidateScore({
        messages: 0,
        participants: 0,
        questions: 0,
        links: 0,
        durationMs: 0,
      }),
    ).toBe(0);
  });

  it("returns 100 when every factor is saturated", () => {
    expect(
      wikiCandidateScore({
        messages: 20,
        participants: 5,
        questions: 4,
        links: 3,
        durationMs: 30 * MINUTE,
      }),
    ).toBe(100);
  });

  it("does not exceed 100 when factors overflow their caps", () => {
    expect(
      wikiCandidateScore({
        messages: 1000,
        participants: 500,
        questions: 999,
        links: 100,
        durationMs: 10 * 60 * MINUTE,
      }),
    ).toBe(100);
  });

  it("never returns below 0 for negative inputs", () => {
    expect(
      wikiCandidateScore({
        messages: -5,
        participants: -2,
        questions: -1,
        links: -3,
        durationMs: -10 * MINUTE,
      }),
    ).toBe(0);
  });

  it("is monotonic: more questions never lowers the score", () => {
    const few = wikiCandidateScore(stat({ questions: 1 }));
    const many = wikiCandidateScore(stat({ questions: 4 }));
    expect(many).toBeGreaterThanOrEqual(few);
  });

  it("is deterministic for identical inputs", () => {
    const s = stat();
    expect(wikiCandidateScore(s)).toBe(wikiCandidateScore(s));
  });
});

describe("scoreWikiCandidate gating", () => {
  it("rejects a hilo shorter than the minimum message count", () => {
    const result = scoreWikiCandidate(
      stat({ messages: WIKI_MIN_MESSAGES - 1 }),
    );
    expect(result.worthSaving).toBe(false);
    expect(result.reason).toBe("Hilo demasiado corto para guardar en la wiki.");
  });

  it("rejects a monologue with a single participant", () => {
    const result = scoreWikiCandidate(
      stat({ participants: WIKI_MIN_PARTICIPANTS - 1 }),
    );
    expect(result.worthSaving).toBe(false);
    expect(result.reason).toBe(
      "Solo participa una persona; no aporta a la wiki.",
    );
  });

  it("rejects a hilo without questions", () => {
    const result = scoreWikiCandidate(
      stat({ questions: WIKI_MIN_QUESTIONS - 1 }),
    );
    expect(result.worthSaving).toBe(false);
    expect(result.reason).toBe(
      "Sin preguntas planteadas; no parece material de FAQ.",
    );
  });

  it("prioritizes the message gate over the participant gate", () => {
    const result = scoreWikiCandidate(
      stat({ messages: 1, participants: 1, questions: 0 }),
    );
    expect(result.reason).toBe("Hilo demasiado corto para guardar en la wiki.");
  });
});

describe("scoreWikiCandidate decision", () => {
  it("marks a dense, multi-participant, question-rich hilo as worth saving", () => {
    const result = scoreWikiCandidate(stat());
    expect(result.worthSaving).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(WIKI_CANDIDATE_THRESHOLD);
    expect(result.reason).toContain("Vale para la wiki.");
  });

  it("mentions the concrete counts in the positive reason", () => {
    const result = scoreWikiCandidate(
      stat({ messages: 15, participants: 5, questions: 4 }),
    );
    expect(result.reason).toBe(
      "Hilo denso: 15 mensajes, 5 participantes y 4 preguntas. Vale para la wiki.",
    );
  });

  it("rejects a hilo that passes the gates but is not dense enough", () => {
    const result = scoreWikiCandidate({
      messages: WIKI_MIN_MESSAGES,
      participants: WIKI_MIN_PARTICIPANTS,
      questions: WIKI_MIN_QUESTIONS,
      links: 0,
      durationMs: 0,
    });
    expect(result.worthSaving).toBe(false);
    expect(result.score).toBeLessThan(WIKI_CANDIDATE_THRESHOLD);
    expect(result.reason).toBe(
      "Hilo poco denso; no vale la pena guardarlo aun.",
    );
  });

  it("still exposes the computed score on rejected hilos", () => {
    const result = scoreWikiCandidate(stat({ messages: 2 }));
    expect(result.score).toBeGreaterThan(0);
  });

  it("is deterministic for identical inputs", () => {
    const s = stat();
    expect(scoreWikiCandidate(s)).toEqual(scoreWikiCandidate(s));
  });

  it("does not treat links alone as enough to save", () => {
    const result = scoreWikiCandidate({
      messages: WIKI_MIN_MESSAGES,
      participants: WIKI_MIN_PARTICIPANTS,
      questions: 0,
      links: 3,
      durationMs: 30 * MINUTE,
    });
    expect(result.worthSaving).toBe(false);
    expect(result.reason).toBe(
      "Sin preguntas planteadas; no parece material de FAQ.",
    );
  });
});

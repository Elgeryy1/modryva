import { describe, expect, it } from "vitest";
import { detectJokeEscalation } from "./joke-escalation.js";

describe("detectJokeEscalation", () => {
  it("detects a joke that later turns into insults", () => {
    expect(
      detectJokeEscalation([
        { text: "jaja que bueno" },
        { text: "en serio" },
        { text: "eres un idiota" },
      ]),
    ).toEqual({ escalating: true, jokeIndex: 0, insultIndex: 2 });
  });

  it("does not escalate when there is no insult", () => {
    expect(
      detectJokeEscalation([{ text: "jaja broma" }, { text: "todo bien" }]),
    ).toEqual({ escalating: false, jokeIndex: 0, insultIndex: -1 });
  });

  it("does not escalate when the insult precedes the joke", () => {
    expect(
      detectJokeEscalation([{ text: "idiota" }, { text: "jaja" }]),
    ).toEqual({ escalating: false, jokeIndex: 1, insultIndex: -1 });
  });

  it("is accent insensitive", () => {
    expect(
      detectJokeEscalation([{ text: "es coña" }, { text: "imbécil" }])
        .escalating,
    ).toBe(true);
  });

  it("returns -1 indices for a clean thread", () => {
    expect(detectJokeEscalation([{ text: "hola" }])).toEqual({
      escalating: false,
      jokeIndex: -1,
      insultIndex: -1,
    });
  });

  it("handles an empty thread", () => {
    expect(detectJokeEscalation([])).toEqual({
      escalating: false,
      jokeIndex: -1,
      insultIndex: -1,
    });
  });
});

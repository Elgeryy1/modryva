import { describe, expect, it } from "vitest";
import {
  type Learner,
  matchTutor,
  type Tutor,
  tutoringIsEligible,
  tutoringOverlapScore,
} from "./tutoring-match.js";

const learner = (overrides: Partial<Learner> = {}): Learner => ({
  userId: "L1",
  topics: ["math"],
  level: 1,
  ...overrides,
});

const tutor = (overrides: Partial<Tutor> = {}): Tutor => ({
  userId: "T1",
  topics: ["math"],
  level: 1,
  load: 0,
  ...overrides,
});

describe("tutoringOverlapScore", () => {
  it("counts shared topics", () => {
    expect(
      tutoringOverlapScore(
        learner({ topics: ["math", "physics", "chem"] }),
        tutor({ topics: ["physics", "math"] }),
      ),
    ).toBe(2);
  });

  it("is zero without any shared topic", () => {
    expect(
      tutoringOverlapScore(
        learner({ topics: ["math"] }),
        tutor({ topics: ["history"] }),
      ),
    ).toBe(0);
  });

  it("counts a shared topic once despite duplicate learner topics", () => {
    expect(
      tutoringOverlapScore(
        learner({ topics: ["math", "math", "physics"] }),
        tutor({ topics: ["math", "physics"] }),
      ),
    ).toBe(2);
  });

  it("is zero when either topic list is empty", () => {
    expect(
      tutoringOverlapScore(
        learner({ topics: [] }),
        tutor({ topics: ["math"] }),
      ),
    ).toBe(0);
    expect(
      tutoringOverlapScore(
        learner({ topics: ["math"] }),
        tutor({ topics: [] }),
      ),
    ).toBe(0);
  });
});

describe("tutoringIsEligible", () => {
  it("is true when level suffices and topics overlap", () => {
    expect(tutoringIsEligible(learner({ level: 2 }), tutor({ level: 2 }))).toBe(
      true,
    );
  });

  it("is false when the tutor level is below the learner", () => {
    expect(tutoringIsEligible(learner({ level: 3 }), tutor({ level: 2 }))).toBe(
      false,
    );
  });

  it("is false without topic overlap even at a high level", () => {
    expect(
      tutoringIsEligible(
        learner({ topics: ["math"], level: 1 }),
        tutor({ topics: ["art"], level: 9 }),
      ),
    ).toBe(false);
  });
});

describe("matchTutor", () => {
  it("returns null when there are no tutors", () => {
    expect(matchTutor(learner(), [])).toBeNull();
  });

  it("returns null when no tutor shares a topic", () => {
    expect(
      matchTutor(learner({ topics: ["math"] }), [
        tutor({ userId: "T1", topics: ["art"] }),
        tutor({ userId: "T2", topics: ["music"] }),
      ]),
    ).toBeNull();
  });

  it("returns null when every candidate is under-leveled", () => {
    expect(
      matchTutor(learner({ level: 5 }), [
        tutor({ userId: "T1", level: 4 }),
        tutor({ userId: "T2", level: 1 }),
      ]),
    ).toBeNull();
  });

  it("picks the single eligible tutor with its overlap score", () => {
    expect(
      matchTutor(learner({ topics: ["math", "physics"], level: 2 }), [
        tutor({ userId: "T1", topics: ["math", "physics"], level: 3, load: 5 }),
      ]),
    ).toEqual({ tutorId: "T1", score: 2 });
  });

  it("prefers greater topic overlap over lower load", () => {
    expect(
      matchTutor(learner({ topics: ["math", "physics", "chem"] }), [
        tutor({ userId: "T1", topics: ["math"], load: 0 }),
        tutor({ userId: "T2", topics: ["math", "physics", "chem"], load: 9 }),
      ]),
    ).toEqual({ tutorId: "T2", score: 3 });
  });

  it("breaks an overlap tie by lower load", () => {
    expect(
      matchTutor(learner({ topics: ["math", "physics"] }), [
        tutor({ userId: "T1", topics: ["math", "physics"], load: 4 }),
        tutor({ userId: "T2", topics: ["math", "physics"], load: 1 }),
      ]),
    ).toEqual({ tutorId: "T2", score: 2 });
  });

  it("breaks an overlap+load tie by lower level", () => {
    expect(
      matchTutor(learner({ topics: ["math"], level: 1 }), [
        tutor({ userId: "T1", topics: ["math"], level: 5, load: 2 }),
        tutor({ userId: "T2", topics: ["math"], level: 2, load: 2 }),
      ]),
    ).toEqual({ tutorId: "T2", score: 1 });
  });

  it("breaks a full tie by smallest userId lexicographically", () => {
    expect(
      matchTutor(learner({ topics: ["math"] }), [
        tutor({ userId: "Tb", topics: ["math"], level: 1, load: 0 }),
        tutor({ userId: "Ta", topics: ["math"], level: 1, load: 0 }),
      ]),
    ).toEqual({ tutorId: "Ta", score: 1 });
  });

  it("ignores under-leveled tutors even with a bigger overlap", () => {
    expect(
      matchTutor(learner({ topics: ["math", "physics"], level: 5 }), [
        tutor({ userId: "T1", topics: ["math", "physics"], level: 4, load: 0 }),
        tutor({ userId: "T2", topics: ["math"], level: 5, load: 0 }),
      ]),
    ).toEqual({ tutorId: "T2", score: 1 });
  });

  it("accepts a tutor whose level exactly equals the learner", () => {
    expect(
      matchTutor(learner({ level: 3 }), [tutor({ userId: "T1", level: 3 })]),
    ).toEqual({ tutorId: "T1", score: 1 });
  });

  it("is deterministic across input order for the same pool", () => {
    const pool: readonly Tutor[] = [
      tutor({ userId: "T1", topics: ["math"], level: 2, load: 3 }),
      tutor({ userId: "T2", topics: ["math", "physics"], level: 2, load: 3 }),
      tutor({ userId: "T3", topics: ["math", "physics"], level: 2, load: 1 }),
    ];
    const l = learner({ topics: ["math", "physics"], level: 1 });
    const forward = matchTutor(l, pool);
    const reversed = matchTutor(l, [...pool].reverse());
    expect(forward).toEqual({ tutorId: "T3", score: 2 });
    expect(reversed).toEqual(forward);
  });

  it("does not mutate the inputs", () => {
    const l = learner({ topics: ["math", "physics"] });
    const pool: readonly Tutor[] = [
      tutor({ userId: "T1", topics: ["math"] }),
      tutor({ userId: "T2", topics: ["physics"] }),
    ];
    matchTutor(l, pool);
    expect(l.topics).toEqual(["math", "physics"]);
    expect(pool[0]?.topics).toEqual(["math"]);
    expect(pool[1]?.topics).toEqual(["physics"]);
  });
});

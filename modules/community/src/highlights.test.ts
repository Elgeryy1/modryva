import { describe, expect, it } from "vitest";
import { pickHighlights } from "./highlights.js";

describe("pickHighlights", () => {
  it("sorts qualifying messages by score descending", () => {
    expect(
      pickHighlights([
        { id: "a", score: 3 },
        { id: "b", score: 1 },
        { id: "c", score: 5 },
      ]),
    ).toEqual([
      { id: "c", score: 5 },
      { id: "a", score: 3 },
      { id: "b", score: 1 },
    ]);
  });

  it("breaks score ties by id ascending", () => {
    expect(
      pickHighlights([
        { id: "b", score: 2 },
        { id: "a", score: 2 },
      ]),
    ).toEqual([
      { id: "a", score: 2 },
      { id: "b", score: 2 },
    ]);
  });

  it("filters out messages below the default minScore of 1", () => {
    expect(
      pickHighlights([
        { id: "a", score: 0 },
        { id: "b", score: 2 },
      ]),
    ).toEqual([{ id: "b", score: 2 }]);
  });

  it("respects a custom minScore boundary inclusively", () => {
    expect(
      pickHighlights(
        [
          { id: "a", score: 4 },
          { id: "b", score: 5 },
          { id: "c", score: 6 },
        ],
        { minScore: 5 },
      ),
    ).toEqual([
      { id: "c", score: 6 },
      { id: "b", score: 5 },
    ]);
  });

  it("caps the result at the given limit", () => {
    expect(
      pickHighlights(
        [
          { id: "a", score: 3 },
          { id: "b", score: 4 },
          { id: "c", score: 5 },
        ],
        { limit: 2 },
      ),
    ).toEqual([
      { id: "c", score: 5 },
      { id: "b", score: 4 },
    ]);
  });

  it("returns an empty array for a limit of zero", () => {
    expect(pickHighlights([{ id: "a", score: 9 }], { limit: 0 })).toEqual([]);
  });

  it("returns an empty array for a negative limit", () => {
    expect(pickHighlights([{ id: "a", score: 9 }], { limit: -3 })).toEqual([]);
  });

  it("returns an empty array for empty input", () => {
    expect(pickHighlights([])).toEqual([]);
  });

  it("is deterministic and does not mutate the input", () => {
    const input: readonly Highlight[] = [
      { id: "b", score: 2 },
      { id: "a", score: 2 },
      { id: "c", score: 8 },
    ];
    const first = pickHighlights(input);
    const second = pickHighlights(input);
    expect(first).toEqual(second);
    expect(input).toEqual([
      { id: "b", score: 2 },
      { id: "a", score: 2 },
      { id: "c", score: 8 },
    ]);
  });
});

import type { Highlight } from "./highlights.js";

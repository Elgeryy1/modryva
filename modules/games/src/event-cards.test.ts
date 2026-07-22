import { describe, expect, it } from "vitest";
import { drawEventCard } from "./event-cards.js";

const deck = ["doble puntos", "mision sorpresa", "descanso"];

describe("drawEventCard", () => {
  it("draws the card at the seeded index", () => {
    expect(drawEventCard(deck, 1)).toEqual({
      card: "mision sorpresa",
      index: 1,
    });
  });

  it("wraps seeds beyond the deck size", () => {
    expect(drawEventCard(deck, 3)).toEqual({ card: "doble puntos", index: 0 });
  });

  it("wraps negative seeds", () => {
    expect(drawEventCard(deck, -1)).toEqual({ card: "descanso", index: 2 });
  });

  it("returns an empty draw for an empty deck", () => {
    expect(drawEventCard([], 5)).toEqual({ card: "", index: -1 });
  });

  it("is deterministic for the same seed", () => {
    expect(drawEventCard(deck, 7)).toEqual(drawEventCard(deck, 7));
  });
});

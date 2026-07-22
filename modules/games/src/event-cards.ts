/**
 * A drawn event card and the index it came from. index is -1 (card "") when the
 * deck is empty. Pure and deterministic.
 */
export interface EventCardDraw {
  readonly card: string;
  readonly index: number;
}

/**
 * Draws a random-feeling but deterministic event card from the deck using an
 * externally supplied seed index (so the module stays pure). The seed is
 * floored and wrapped into the deck range. An empty deck yields index -1 and an
 * empty card. Pure and deterministic.
 */
export const drawEventCard = (
  cards: readonly string[],
  seedIndex: number,
): EventCardDraw => {
  if (cards.length === 0) {
    return { card: "", index: -1 };
  }
  const index =
    ((Math.floor(seedIndex) % cards.length) + cards.length) % cards.length;
  return { card: cards[index] ?? "", index };
};

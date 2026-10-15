import { describe, expect, it } from "vitest";
import { flagSuspiciousPrizes } from "./suspicious-prizes.js";

describe("flagSuspiciousPrizes", () => {
  it("flags prizes far above the median", () => {
    expect(
      flagSuspiciousPrizes([
        { userId: 1, prize: 10 },
        { userId: 2, prize: 10 },
        { userId: 3, prize: 10 },
        { userId: 4, prize: 10 },
        { userId: 5, prize: 5000 },
      ]),
    ).toEqual([{ userId: 5, prize: 5000 }]);
  });

  it("returns empty when nothing exceeds the threshold", () => {
    expect(
      flagSuspiciousPrizes([
        { userId: 1, prize: 10 },
        { userId: 2, prize: 12 },
        { userId: 3, prize: 11 },
      ]),
    ).toEqual([]);
  });

  it("sorts flagged prizes by prize desc then userId asc", () => {
    const result = flagSuspiciousPrizes([
      { userId: 1, prize: 1 },
      { userId: 2, prize: 1 },
      { userId: 3, prize: 1 },
      { userId: 5, prize: 100 },
      { userId: 4, prize: 100 },
    ]);
    expect(result).toEqual([
      { userId: 4, prize: 100 },
      { userId: 5, prize: 100 },
    ]);
  });

  it("honors a custom multiple", () => {
    expect(
      flagSuspiciousPrizes(
        [
          { userId: 1, prize: 10 },
          { userId: 2, prize: 10 },
          { userId: 3, prize: 50 },
        ],
        { multipleOfMedian: 2 },
      ),
    ).toEqual([{ userId: 3, prize: 50 }]);
  });

  it("returns empty for no wins", () => {
    expect(flagSuspiciousPrizes([])).toEqual([]);
  });
});

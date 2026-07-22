import { describe, expect, it } from "vitest";
import { levelForPoints } from "./player-level.js";

describe("levelForPoints", () => {
  it("starts everyone at level 1", () => {
    expect(levelForPoints(0)).toEqual({
      level: 1,
      points: 0,
      floor: 0,
      ceil: 50,
    });
    expect(levelForPoints(49).level).toBe(1);
  });

  it("crosses to level 2 at exactly 50 points", () => {
    expect(levelForPoints(50)).toEqual({
      level: 2,
      points: 50,
      floor: 50,
      ceil: 150,
    });
  });

  it("computes the documented curve (0,50,150,300,500,750,1050,1400)", () => {
    expect(levelForPoints(150).level).toBe(3);
    expect(levelForPoints(300).level).toBe(4);
    expect(levelForPoints(1240)).toMatchObject({
      level: 7,
      floor: 1050,
      ceil: 1400,
    });
  });

  it("floors fractional points and clamps negatives / non-finite to 0", () => {
    expect(levelForPoints(60.9).points).toBe(60);
    expect(levelForPoints(-100)).toEqual({
      level: 1,
      points: 0,
      floor: 0,
      ceil: 50,
    });
    expect(levelForPoints(Number.NaN).points).toBe(0);
  });

  it("never regresses: more points is never a lower level", () => {
    let last = 0;
    for (let p = 0; p < 3000; p += 37) {
      const lvl = levelForPoints(p).level;
      expect(lvl).toBeGreaterThanOrEqual(last);
      last = lvl;
    }
  });
});

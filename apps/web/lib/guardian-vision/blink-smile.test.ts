import { describe, expect, it } from "vitest";
import {
  type Blendshape,
  eyesClosedFromBlendshapes,
  smilingFromBlendshapes,
} from "./blink-smile.js";

const shapes = (partial: Record<string, number>): Blendshape[] =>
  Object.entries(partial).map(([categoryName, score]) => ({
    categoryName,
    score,
  }));

describe("eyesClosedFromBlendshapes", () => {
  it("is false with no blendshapes at all", () => {
    expect(eyesClosedFromBlendshapes([])).toBe(false);
  });

  it("is false when only one eye is closed", () => {
    expect(
      eyesClosedFromBlendshapes(
        shapes({ eyeBlinkLeft: 0.9, eyeBlinkRight: 0.1 }),
      ),
    ).toBe(false);
  });

  it("is true when both eyes cross the threshold", () => {
    expect(
      eyesClosedFromBlendshapes(
        shapes({ eyeBlinkLeft: 0.8, eyeBlinkRight: 0.75 }),
      ),
    ).toBe(true);
  });

  it("is false when both eyes are just below the threshold", () => {
    expect(
      eyesClosedFromBlendshapes(
        shapes({ eyeBlinkLeft: 0.49, eyeBlinkRight: 0.49 }),
      ),
    ).toBe(false);
  });
});

describe("smilingFromBlendshapes", () => {
  it("is false with a neutral expression", () => {
    expect(
      smilingFromBlendshapes(
        shapes({ mouthSmileLeft: 0.05, mouthSmileRight: 0.05 }),
      ),
    ).toBe(false);
  });

  it("is true when both mouth-corner shapes cross the threshold", () => {
    expect(
      smilingFromBlendshapes(
        shapes({ mouthSmileLeft: 0.6, mouthSmileRight: 0.55 }),
      ),
    ).toBe(true);
  });
});

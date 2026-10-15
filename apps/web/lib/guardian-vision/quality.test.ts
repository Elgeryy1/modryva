import { describe, expect, it } from "vitest";
import { estimateFrameQuality, qualityScoreFrom } from "./quality.js";

/** Builds a flat WxH RGBA buffer of a single gray level. */
const flatBuffer = (width: number, height: number, gray: number) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
    data[i + 3] = 255;
  }
  return data;
};

/** Builds a WxH RGBA buffer alternating black/white columns every
 * `SAMPLE_STEP` (4) pixels so the quality module's subsampling actually
 * lands on alternating values, producing high measured sharpness. */
const checkerboardBuffer = (width: number, height: number) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const gray = Math.floor(x / 4) % 2 === 0 ? 0 : 255;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
      data[i + 3] = 255;
    }
  }
  return data;
};

describe("estimateFrameQuality", () => {
  it("reports zero brightness and sharpness for an all-black frame", () => {
    const q = estimateFrameQuality(flatBuffer(16, 16, 0), 16, 16);
    expect(q.brightness).toBeCloseTo(0, 5);
    expect(q.sharpness).toBeCloseTo(0, 5);
  });

  it("reports full brightness and zero sharpness for an all-white frame", () => {
    const q = estimateFrameQuality(flatBuffer(16, 16, 255), 16, 16);
    expect(q.brightness).toBeCloseTo(1, 5);
    expect(q.sharpness).toBeCloseTo(0, 5);
  });

  it("reports mid brightness for a mid-gray frame", () => {
    const q = estimateFrameQuality(flatBuffer(16, 16, 128), 16, 16);
    expect(q.brightness).toBeGreaterThan(0.45);
    expect(q.brightness).toBeLessThan(0.55);
  });

  it("reports higher sharpness for a high-contrast checkerboard than a flat frame", () => {
    const flat = estimateFrameQuality(flatBuffer(32, 32, 128), 32, 32);
    const checker = estimateFrameQuality(checkerboardBuffer(32, 32), 32, 32);
    expect(checker.sharpness).toBeGreaterThan(flat.sharpness);
  });

  it("handles a degenerate zero-size frame without throwing", () => {
    const q = estimateFrameQuality(new Uint8ClampedArray(0), 0, 0);
    expect(q).toEqual({ brightness: 0, sharpness: 0 });
  });
});

describe("qualityScoreFrom", () => {
  it("scores a well-lit, sharp frame highly", () => {
    expect(qualityScoreFrom({ brightness: 0.5, sharpness: 1 })).toBeCloseTo(
      1,
      5,
    );
  });

  it("penalizes a near-black frame", () => {
    expect(qualityScoreFrom({ brightness: 0.02, sharpness: 1 })).toBeLessThan(
      0.7,
    );
  });

  it("penalizes a blurry (low-sharpness) frame", () => {
    const sharp = qualityScoreFrom({ brightness: 0.5, sharpness: 1 });
    const blurry = qualityScoreFrom({ brightness: 0.5, sharpness: 0 });
    expect(blurry).toBeLessThan(sharp);
  });

  it("never goes outside the 0..1 range", () => {
    expect(
      qualityScoreFrom({ brightness: 0, sharpness: 0 }),
    ).toBeGreaterThanOrEqual(0);
    expect(
      qualityScoreFrom({ brightness: 1, sharpness: 1 }),
    ).toBeLessThanOrEqual(1);
  });
});

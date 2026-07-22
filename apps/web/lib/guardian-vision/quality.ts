import type { FrameQuality } from "./types";

/**
 * Cheap, dependency-free per-frame quality estimate from raw RGBA pixels —
 * mean luminance (0..1) and a Laplacian-like sharpness proxy (mean absolute
 * difference between horizontally adjacent luma samples, normalized). Not a
 * publication-grade metric, just enough to reject "too dark"/"too blurry"
 * captures without shipping a second ML model for it. Computed directly from
 * real pixels — never a placeholder value.
 */

const SAMPLE_STEP = 4;
const RGBA_STRIDE = 4;

export const estimateFrameQuality = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
): FrameQuality => {
  if (width <= 0 || height <= 0) {
    return { brightness: 0, sharpness: 0 };
  }
  const rowWidth = Math.ceil(width / SAMPLE_STEP);
  const luma: number[] = [];
  let sum = 0;

  for (let y = 0; y < height; y += SAMPLE_STEP) {
    for (let x = 0; x < width; x += SAMPLE_STEP) {
      const i = (y * width + x) * RGBA_STRIDE;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      luma.push(l);
      sum += l;
    }
  }

  const brightness = luma.length > 0 ? sum / luma.length / 255 : 0;

  let diffSum = 0;
  let diffCount = 0;
  for (let i = 0; i < luma.length; i += 1) {
    if (i % rowWidth === rowWidth - 1) continue; // skip row boundaries
    const a = luma[i] as number;
    const b = luma[i + 1];
    if (b === undefined) continue;
    diffSum += Math.abs(a - b);
    diffCount += 1;
  }
  const sharpness = diffCount > 0 ? Math.min(1, diffSum / diffCount / 40) : 0;

  return { brightness, sharpness };
};

/** Combines brightness + sharpness into the single 0..1 qualityScore the
 * decision engine's `qualityScore` signal expects. Penalizes both
 * under/over-exposure and low sharpness (blur/motion/out of focus). */
export const qualityScoreFrom = (q: FrameQuality): number => {
  const brightnessScore =
    q.brightness < 0.15 || q.brightness > 0.95
      ? 0.2
      : 1 - Math.abs(q.brightness - 0.5) * 0.6;
  return Math.min(1, Math.max(0, brightnessScore * 0.5 + q.sharpness * 0.5));
};

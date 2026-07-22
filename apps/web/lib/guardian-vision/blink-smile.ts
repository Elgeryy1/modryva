/**
 * Blink/smile detection from MediaPipe FaceLandmarker blendshapes
 * (`outputFaceBlendshapes: true`). Blendshapes are ARKit-style per-frame
 * expression coefficients (0..1) the model itself computes — reading two of
 * them past a threshold is a real per-frame classification, not a mock. The
 * blink EDGE-counting (open->closed->open = one blink) needed for
 * blink_once/blink_twice lives in challenge-gate.ts, which is stateful
 * across frames; this module only classifies a single frame.
 */

export interface Blendshape {
  readonly categoryName: string;
  readonly score: number;
}

const BLINK_THRESHOLD = 0.5;
const SMILE_THRESHOLD = 0.4;

const scoreFor = (blendshapes: readonly Blendshape[], name: string): number =>
  blendshapes.find((b) => b.categoryName === name)?.score ?? 0;

/** Both eyes must cross the threshold together — a wink alone doesn't count
 * as the "blink" Guardian's challenge asks for. */
export const eyesClosedFromBlendshapes = (
  blendshapes: readonly Blendshape[],
): boolean =>
  scoreFor(blendshapes, "eyeBlinkLeft") > BLINK_THRESHOLD &&
  scoreFor(blendshapes, "eyeBlinkRight") > BLINK_THRESHOLD;

export const smilingFromBlendshapes = (
  blendshapes: readonly Blendshape[],
): boolean =>
  scoreFor(blendshapes, "mouthSmileLeft") > SMILE_THRESHOLD &&
  scoreFor(blendshapes, "mouthSmileRight") > SMILE_THRESHOLD;

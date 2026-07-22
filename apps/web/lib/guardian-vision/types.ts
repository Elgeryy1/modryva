// Shared shapes for Guardian Verification's real client-side visual
// detection (MediaPipe Tasks Vision). Kept separate from the MediaPipe
// wiring itself so the pure classification/gating logic below is testable
// without a browser, WASM runtime, or camera.

export type FaceOrientation = "center" | "left" | "right" | "up";

export type HandGesture =
  | "thumbs_up"
  | "victory"
  | "open_palm"
  | "closed_fist"
  | "show_one_finger"
  | "show_two_fingers"
  | "show_three_fingers";

export interface HeadPoseDeg {
  readonly yawDeg: number;
  readonly pitchDeg: number;
  readonly rollDeg: number;
}

export interface FrameQuality {
  readonly brightness: number;
  readonly sharpness: number;
}

/** One frame's worth of already-classified visual signals — the output of
 * detector.ts, and the input the challenge gate and step-matching logic
 * consume. `null` fields mean "not evaluable this frame" (no face, no
 * blendshapes, no hand), never a fabricated guess. */
export interface FrameSignals {
  readonly timestampMs: number;
  readonly faceCount: number;
  readonly orientation: FaceOrientation | null;
  readonly eyesClosed: boolean | null;
  readonly smiling: boolean | null;
  readonly handCount: number;
  readonly gesture: HandGesture | null;
  readonly quality: FrameQuality;
}

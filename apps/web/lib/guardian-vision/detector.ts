import {
  FaceLandmarker,
  FilesetResolver,
  GestureRecognizer,
} from "@mediapipe/tasks-vision";
import {
  eyesClosedFromBlendshapes,
  smilingFromBlendshapes,
} from "./blink-smile";
import {
  classifyFingerCountGesture,
  type HandLandmarkPoint,
  mapGestureCategory,
} from "./hand-gesture";
import { classifyOrientation, decomposeRotationMatrix } from "./head-pose";
import { estimateFrameQuality } from "./quality";
import type { FrameSignals, HandGesture } from "./types";

/**
 * Real MediaPipe Tasks Vision wiring: loads the actual FaceLandmarker +
 * GestureRecognizer models and runs per-frame inference. This file is the
 * only place in Guardian's client-side detection that touches the WASM
 * runtime directly — everything it computes from a raw model result is
 * delegated to the pure, unit-tested modules in this same directory
 * (head-pose.ts, blink-smile.ts, hand-gesture.ts, quality.ts).
 *
 * Not unit-testable in Vitest/jsdom: MediaPipe Tasks Vision needs a real
 * WASM+WebAssembly runtime and (for GPU) a WebGL context, neither of which
 * jsdom provides. It IS exercised by a real browser in Playwright E2E (see
 * apps/web/e2e/guardian) and must be validated against a live camera during
 * the real-bot test pass — see docs/GUARDIAN_TELEGRAM_TEST.md.
 *
 * Model/wasm assets load from Google's/jsDelivr's public CDN, matching
 * MediaPipe's own documented quickstart — not vendored into this repo to
 * avoid committing ~30MB of binaries. Self-hosting them under /public is a
 * reasonable follow-up for reliability/offline-in-webview if the CDN proves
 * unreliable in production; see the final report.
 */

const WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const GESTURE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

export interface DetectorHandles {
  readonly faceLandmarker: FaceLandmarker;
  readonly gestureRecognizer: GestureRecognizer;
}

/** CPU delegate deliberately: the GPU delegate requires binding an
 * OffscreenCanvas/WebGL context per model, which adds real risk (context
 * creation quirks inside older in-app WebViews) that can't be validated
 * without a live device from this sandbox. CPU is slower but unconditionally
 * correct; revisit after the real-bot test pass confirms perf headroom. */
export const createDetectors = async (): Promise<DetectorHandles> => {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
  const faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "CPU" },
    runningMode: "VIDEO",
    numFaces: 2,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
  const gestureRecognizer = await GestureRecognizer.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: GESTURE_MODEL_URL, delegate: "CPU" },
    runningMode: "VIDEO",
    numHands: 2,
  });
  return { faceLandmarker, gestureRecognizer };
};

export const releaseDetectors = (handles: DetectorHandles): void => {
  handles.faceLandmarker.close();
  handles.gestureRecognizer.close();
};

export interface RawFrameData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

/** Runs both real models on one frame and reduces their raw output to the
 * small FrameSignals shape the challenge gate consumes. `source` must be the
 * exact same frame `frameData` (if provided) was read from. */
export const analyzeFrame = (
  handles: DetectorHandles,
  source: TexImageSource,
  timestampMs: number,
  frameData: RawFrameData | null,
): FrameSignals => {
  const faceResult = handles.faceLandmarker.detectForVideo(source, timestampMs);
  const gestureResult = handles.gestureRecognizer.recognizeForVideo(
    source,
    timestampMs,
  );

  const faceCount = faceResult.faceLandmarks.length;
  let orientation: FrameSignals["orientation"] = null;
  let eyesClosed: FrameSignals["eyesClosed"] = null;
  let smiling: FrameSignals["smiling"] = null;

  if (faceCount === 1) {
    const matrix = faceResult.facialTransformationMatrixes[0];
    if (matrix) {
      orientation = classifyOrientation(decomposeRotationMatrix(matrix.data));
    }
    const blendshapes = faceResult.faceBlendshapes[0]?.categories;
    if (blendshapes) {
      eyesClosed = eyesClosedFromBlendshapes(blendshapes);
      smiling = smilingFromBlendshapes(blendshapes);
    }
  }

  const handCount = gestureResult.landmarks.length;
  let gesture: HandGesture | null = null;
  if (handCount >= 1) {
    const topCategory = gestureResult.gestures[0]?.[0];
    gesture = topCategory ? mapGestureCategory(topCategory.categoryName) : null;
    if (!gesture) {
      const landmarks = gestureResult.landmarks[0] as
        | readonly HandLandmarkPoint[]
        | undefined;
      if (landmarks) {
        gesture = classifyFingerCountGesture(landmarks);
      }
    }
  }

  const quality = frameData
    ? estimateFrameQuality(frameData.data, frameData.width, frameData.height)
    : { brightness: 0, sharpness: 0 };

  return {
    timestampMs,
    faceCount,
    orientation,
    eyesClosed,
    smiling,
    handCount,
    gesture,
    quality,
  };
};

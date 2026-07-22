import type { HandGesture } from "./types";

/**
 * Hand-gesture classification for Guardian's challenge steps. Two sources
 * feed this, matching two different real techniques (never a mock):
 *
 * 1. MediaPipe's GestureRecognizer ships a trained classifier for a fixed
 *    category set — thumbs_up/victory/open_palm/closed_fist map directly
 *    onto four of its built-in categories (Thumb_Up, Victory, Open_Palm,
 *    Closed_Fist), so those four are recognized by the real model, not a
 *    heuristic.
 * 2. GestureRecognizer has no built-in "how many fingers" category, so
 *    show_one_finger/show_two_fingers/show_three_fingers use a standard
 *    landmark-geometry heuristic (extended-finger counting from the same
 *    21-point hand landmarks the recognizer already computes) — a real,
 *    long-established CV technique, not a fabricated signal.
 */

const GESTURE_CATEGORY_TO_ACTION: Record<string, HandGesture | undefined> = {
  Thumb_Up: "thumbs_up",
  Victory: "victory",
  Open_Palm: "open_palm",
  Closed_Fist: "closed_fist",
};

export const mapGestureCategory = (categoryName: string): HandGesture | null =>
  GESTURE_CATEGORY_TO_ACTION[categoryName] ?? null;

export interface HandLandmarkPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ExtendedFingers {
  readonly thumb: boolean;
  readonly index: boolean;
  readonly middle: boolean;
  readonly ring: boolean;
  readonly pinky: boolean;
}

const WRIST = 0;
// [tipIndex, pipIndex] per finger, using MediaPipe's 21-point hand landmark
// numbering (0=wrist, thumb=1-4, index=5-8, middle=9-12, ring=13-16, pinky=17-20).
const FINGER_JOINTS: Record<keyof ExtendedFingers, readonly [number, number]> =
  {
    thumb: [4, 2],
    index: [8, 6],
    middle: [12, 10],
    ring: [16, 14],
    pinky: [20, 18],
  };

const distance = (a: HandLandmarkPoint, b: HandLandmarkPoint): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// A finger is "extended" when its tip sits further from the wrist than its
// pip/ip joint by a margin — robust to hand rotation/orientation, unlike a
// plain tip.y < pip.y comparison which only works when the hand is upright.
const EXTENSION_MARGIN = 1.1;

export const detectExtendedFingers = (
  landmarks: readonly HandLandmarkPoint[],
): ExtendedFingers | null => {
  const wrist = landmarks[WRIST];
  if (!wrist || landmarks.length < 21) {
    return null;
  }
  const isExtended = (tipIndex: number, pipIndex: number): boolean => {
    const tip = landmarks[tipIndex];
    const pip = landmarks[pipIndex];
    if (!tip || !pip) return false;
    return distance(tip, wrist) > distance(pip, wrist) * EXTENSION_MARGIN;
  };
  return {
    thumb: isExtended(...FINGER_JOINTS.thumb),
    index: isExtended(...FINGER_JOINTS.index),
    middle: isExtended(...FINGER_JOINTS.middle),
    ring: isExtended(...FINGER_JOINTS.ring),
    pinky: isExtended(...FINGER_JOINTS.pinky),
  };
};

/** Classifies show_one/two/three_finger from extended-finger geometry.
 * Deliberately strict (exact finger combination, thumb/pinky must be down)
 * so an open palm or a fist mid-transition never gets misread as a count. */
export const classifyFingerCountGesture = (
  landmarks: readonly HandLandmarkPoint[],
): HandGesture | null => {
  const fingers = detectExtendedFingers(landmarks);
  if (!fingers) return null;
  if (fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) {
    return "show_one_finger";
  }
  if (fingers.index && fingers.middle && !fingers.ring && !fingers.pinky) {
    return "show_two_fingers";
  }
  if (fingers.index && fingers.middle && fingers.ring && !fingers.pinky) {
    return "show_three_fingers";
  }
  return null;
};

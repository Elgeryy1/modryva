import type { FaceOrientation, HeadPoseDeg } from "./types";

/**
 * Pure math: decomposes a MediaPipe FaceLandmarker facial transformation
 * matrix (a 16-element column-major 4x4, model-space -> camera-space) into
 * yaw/pitch/roll degrees using the standard XYZ Euler extraction (same
 * convention as three.js's `Euler.setFromRotationMatrix(m, "XYZ")`). This
 * makes it fully testable against hand-built rotation matrices — no WASM
 * runtime, camera, or real face required.
 *
 * Sign convention caveat: the MATH here is verified (see head-pose.test.ts
 * round-trips pure X/Y/Z rotations back to the exact input angle), but which
 * physical head movement (turning toward the phone's left vs right) produces
 * a positive vs negative yaw has NOT been empirically confirmed against a
 * live camera in this sandbox (no camera available here). Verify
 * turn_left/turn_right map to the correct physical side during the real-bot
 * test pass (docs/GUARDIAN_TELEGRAM_TEST.md) and flip FACE_YAW_SIGN if
 * they're swapped — do not assume this is correct without that check.
 */
const FACE_YAW_SIGN = 1;

export const decomposeRotationMatrix = (m: ArrayLike<number>): HeadPoseDeg => {
  const m11 = m[0] ?? 0;
  const m12 = m[4] ?? 0;
  const m13 = m[8] ?? 0;
  const m22 = m[5] ?? 0;
  const m23 = m[9] ?? 0;
  const m32 = m[6] ?? 0;
  const m33 = m[10] ?? 0;

  const clamped = Math.min(1, Math.max(-1, m13));
  const yaw = Math.asin(clamped);
  let pitch: number;
  let roll: number;
  if (Math.abs(m13) < 0.9999999) {
    pitch = Math.atan2(-m23, m33);
    roll = Math.atan2(-m12, m11);
  } else {
    // Gimbal lock (looking almost straight up/down): roll and yaw become
    // coupled, so roll is conventionally pinned to 0.
    pitch = Math.atan2(m32, m22);
    roll = 0;
  }

  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  return {
    yawDeg: toDeg(yaw) * FACE_YAW_SIGN,
    pitchDeg: toDeg(pitch),
    rollDeg: toDeg(roll),
  };
};

const YAW_THRESHOLD_DEG = 15;
const PITCH_UP_THRESHOLD_DEG = -12;

/** Buckets a decomposed head pose into the coarse orientations Guardian's
 * challenge steps ask for. "up" takes priority over left/right so a step
 * asking to look up isn't accidentally satisfied by a diagonal turn. */
export const classifyOrientation = (pose: HeadPoseDeg): FaceOrientation => {
  if (pose.pitchDeg < PITCH_UP_THRESHOLD_DEG) {
    return "up";
  }
  if (pose.yawDeg > YAW_THRESHOLD_DEG) {
    return "right";
  }
  if (pose.yawDeg < -YAW_THRESHOLD_DEG) {
    return "left";
  }
  return "center";
};

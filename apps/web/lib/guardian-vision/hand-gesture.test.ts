import { describe, expect, it } from "vitest";
import {
  classifyFingerCountGesture,
  detectExtendedFingers,
  type HandLandmarkPoint,
  mapGestureCategory,
} from "./hand-gesture.js";

const P = (x: number, y: number, z = 0): HandLandmarkPoint => ({ x, y, z });

/** Builds a 21-point landmark set with the wrist at the origin and each
 * finger's tip/pip explicitly placed — near (folded) or far (extended) from
 * the wrist — so every other landmark is irrelevant filler at a fixed
 * "resting" distance. */
const buildHand = (
  extended: Partial<
    Record<"thumb" | "index" | "middle" | "ring" | "pinky", boolean>
  >,
): HandLandmarkPoint[] => {
  const points: HandLandmarkPoint[] = new Array(21)
    .fill(null)
    .map(() => P(0.05, 0.05));
  points[0] = P(0, 0); // wrist
  const set = (tip: number, pip: number, isExtended: boolean) => {
    points[pip] = P(0.05, 0.05);
    points[tip] = isExtended ? P(1, 1) : P(0.03, 0.03);
  };
  set(4, 2, extended.thumb ?? false);
  set(8, 6, extended.index ?? false);
  set(12, 10, extended.middle ?? false);
  set(16, 14, extended.ring ?? false);
  set(20, 18, extended.pinky ?? false);
  return points;
};

describe("detectExtendedFingers", () => {
  it("returns null for too few landmarks", () => {
    expect(detectExtendedFingers([P(0, 0)])).toBeNull();
  });

  it("detects all fingers folded (fist)", () => {
    const fingers = detectExtendedFingers(buildHand({}));
    expect(fingers).toEqual({
      thumb: false,
      index: false,
      middle: false,
      ring: false,
      pinky: false,
    });
  });

  it("detects a single extended index finger", () => {
    const fingers = detectExtendedFingers(buildHand({ index: true }));
    expect(fingers?.index).toBe(true);
    expect(fingers?.middle).toBe(false);
  });

  it("detects all fingers extended (open palm)", () => {
    const fingers = detectExtendedFingers(
      buildHand({
        thumb: true,
        index: true,
        middle: true,
        ring: true,
        pinky: true,
      }),
    );
    expect(fingers).toEqual({
      thumb: true,
      index: true,
      middle: true,
      ring: true,
      pinky: true,
    });
  });
});

describe("classifyFingerCountGesture", () => {
  it("classifies exactly index extended as show_one_finger", () => {
    expect(classifyFingerCountGesture(buildHand({ index: true }))).toBe(
      "show_one_finger",
    );
  });

  it("classifies index+middle extended as show_two_fingers", () => {
    expect(
      classifyFingerCountGesture(buildHand({ index: true, middle: true })),
    ).toBe("show_two_fingers");
  });

  it("classifies index+middle+ring extended as show_three_fingers", () => {
    expect(
      classifyFingerCountGesture(
        buildHand({ index: true, middle: true, ring: true }),
      ),
    ).toBe("show_three_fingers");
  });

  it("returns null for a closed fist", () => {
    expect(classifyFingerCountGesture(buildHand({}))).toBeNull();
  });

  it("returns null for an open palm (not a counting gesture)", () => {
    expect(
      classifyFingerCountGesture(
        buildHand({
          thumb: true,
          index: true,
          middle: true,
          ring: true,
          pinky: true,
        }),
      ),
    ).toBeNull();
  });

  it("returns null when pinky is also extended alongside index+middle+ring", () => {
    expect(
      classifyFingerCountGesture(
        buildHand({ index: true, middle: true, ring: true, pinky: true }),
      ),
    ).toBeNull();
  });
});

describe("mapGestureCategory", () => {
  it("maps the four MediaPipe built-in categories Guardian uses", () => {
    expect(mapGestureCategory("Thumb_Up")).toBe("thumbs_up");
    expect(mapGestureCategory("Victory")).toBe("victory");
    expect(mapGestureCategory("Open_Palm")).toBe("open_palm");
    expect(mapGestureCategory("Closed_Fist")).toBe("closed_fist");
  });

  it("returns null for categories Guardian doesn't use", () => {
    expect(mapGestureCategory("Pointing_Up")).toBeNull();
    expect(mapGestureCategory("Thumb_Down")).toBeNull();
    expect(mapGestureCategory("ILoveYou")).toBeNull();
    expect(mapGestureCategory("None")).toBeNull();
  });
});

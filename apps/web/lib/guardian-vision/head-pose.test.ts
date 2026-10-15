import { describe, expect, it } from "vitest";
import { classifyOrientation, decomposeRotationMatrix } from "./head-pose.js";

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Builds a column-major 4x4 identity-plus-rotation matrix (translation
 * column left at 0) for a pure rotation about one axis, matching the
 * standard right-hand-rule rotation matrices — used to verify the Euler
 * extraction against a known-correct input, independent of any MediaPipe
 * output. */
const yawMatrix = (deg: number): number[] => {
  const t = toRad(deg);
  const c = Math.cos(t);
  const s = Math.sin(t);
  // Ry: col0=[c,0,-s] col1=[0,1,0] col2=[s,0,c]
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
};

const pitchMatrix = (deg: number): number[] => {
  const t = toRad(deg);
  const c = Math.cos(t);
  const s = Math.sin(t);
  // Rx: col0=[1,0,0] col1=[0,c,s] col2=[0,-s,c]
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
};

const rollMatrix = (deg: number): number[] => {
  const t = toRad(deg);
  const c = Math.cos(t);
  const s = Math.sin(t);
  // Rz: col0=[c,s,0] col1=[-s,c,0] col2=[0,0,1]
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
};

describe("decomposeRotationMatrix", () => {
  it("recovers a pure yaw rotation exactly", () => {
    const pose = decomposeRotationMatrix(yawMatrix(25));
    expect(pose.yawDeg).toBeCloseTo(25, 5);
    expect(pose.pitchDeg).toBeCloseTo(0, 5);
    expect(pose.rollDeg).toBeCloseTo(0, 5);
  });

  it("recovers a pure negative yaw rotation exactly", () => {
    const pose = decomposeRotationMatrix(yawMatrix(-30));
    expect(pose.yawDeg).toBeCloseTo(-30, 5);
  });

  it("recovers a pure pitch rotation exactly", () => {
    const pose = decomposeRotationMatrix(pitchMatrix(18));
    expect(pose.pitchDeg).toBeCloseTo(18, 5);
    expect(pose.yawDeg).toBeCloseTo(0, 5);
    expect(pose.rollDeg).toBeCloseTo(0, 5);
  });

  it("recovers a pure roll rotation exactly", () => {
    const pose = decomposeRotationMatrix(rollMatrix(10));
    expect(pose.rollDeg).toBeCloseTo(10, 5);
    expect(pose.yawDeg).toBeCloseTo(0, 5);
    expect(pose.pitchDeg).toBeCloseTo(0, 5);
  });

  it("handles the identity matrix as dead center", () => {
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const pose = decomposeRotationMatrix(identity);
    expect(pose.yawDeg).toBeCloseTo(0, 5);
    expect(pose.pitchDeg).toBeCloseTo(0, 5);
    expect(pose.rollDeg).toBeCloseTo(0, 5);
  });

  it("handles gimbal lock (near +/-90 deg pitch) without throwing", () => {
    const pose = decomposeRotationMatrix(pitchMatrix(89.9999999));
    expect(Number.isFinite(pose.yawDeg)).toBe(true);
    expect(Number.isFinite(pose.pitchDeg)).toBe(true);
    expect(Number.isFinite(pose.rollDeg)).toBe(true);
  });
});

describe("classifyOrientation", () => {
  it("classifies near-zero pose as center", () => {
    expect(classifyOrientation({ yawDeg: 0, pitchDeg: 0, rollDeg: 0 })).toBe(
      "center",
    );
  });

  it("classifies a small yaw within tolerance as center", () => {
    expect(classifyOrientation({ yawDeg: 8, pitchDeg: 0, rollDeg: 0 })).toBe(
      "center",
    );
  });

  it("classifies a large positive yaw as right", () => {
    expect(classifyOrientation({ yawDeg: 25, pitchDeg: 0, rollDeg: 0 })).toBe(
      "right",
    );
  });

  it("classifies a large negative yaw as left", () => {
    expect(classifyOrientation({ yawDeg: -25, pitchDeg: 0, rollDeg: 0 })).toBe(
      "left",
    );
  });

  it("classifies a strongly negative pitch as up regardless of yaw", () => {
    expect(classifyOrientation({ yawDeg: 20, pitchDeg: -20, rollDeg: 0 })).toBe(
      "up",
    );
  });
});

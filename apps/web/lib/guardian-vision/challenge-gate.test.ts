import { describe, expect, it } from "vitest";
import { ChallengeGate, type GateStep } from "./challenge-gate.js";
import type { FrameSignals } from "./types.js";

const baseSignal = (overrides: Partial<FrameSignals> = {}): FrameSignals => ({
  timestampMs: 0,
  faceCount: 1,
  orientation: "center",
  eyesClosed: null,
  smiling: null,
  handCount: 0,
  gesture: null,
  quality: { brightness: 0.5, sharpness: 0.8 },
  ...overrides,
});

/** Fake clock: a mutable box the test advances explicitly, so hold-timing
 * assertions are deterministic instead of racing the real wall clock. */
const fakeClock = (start = 0) => {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
};

describe("ChallengeGate — hold-based steps", () => {
  it("does not advance on a single matching frame below the hold duration", () => {
    const clock = fakeClock();
    const steps: GateStep[] = [
      { kind: "face", action: "look_center", timeLimitMs: 6000 },
    ];
    const gate = new ChallengeGate({
      steps,
      holdDurationMs: 500,
      now: clock.now,
    });

    const events = gate.pushSignal(baseSignal({ timestampMs: clock.now() }));
    expect(events).toEqual([]);
    expect(gate.isComplete()).toBe(false);
  });

  it("advances once the match holds continuously for the full hold duration", () => {
    const clock = fakeClock();
    const steps: GateStep[] = [
      { kind: "face", action: "look_center", timeLimitMs: 6000 },
    ];
    const gate = new ChallengeGate({
      steps,
      holdDurationMs: 500,
      now: clock.now,
    });

    gate.pushSignal(baseSignal({ timestampMs: clock.now() }));
    clock.advance(300);
    let events = gate.pushSignal(baseSignal({ timestampMs: clock.now() }));
    expect(events).toEqual([]);

    clock.advance(250); // total held: 550ms >= 500ms
    events = gate.pushSignal(baseSignal({ timestampMs: clock.now() }));
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: "step-advanced", stepIndex: 0 });
    expect(events[1]).toMatchObject({ type: "challenge-complete" });
    expect(gate.isComplete()).toBe(true);
    expect(gate.stepResults()).toEqual([
      { action: "look_center", detectedAt: 500 },
    ]);
  });

  it("resets the hold timer when the match is interrupted", () => {
    const clock = fakeClock();
    const steps: GateStep[] = [
      { kind: "face", action: "turn_left", timeLimitMs: 6000 },
    ];
    const gate = new ChallengeGate({
      steps,
      holdDurationMs: 500,
      now: clock.now,
    });

    gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), orientation: "left" }),
    );
    clock.advance(400);
    gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), orientation: "left" }),
    );
    // Interruption: user glances center briefly.
    clock.advance(50);
    gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), orientation: "center" }),
    );
    // Re-establish the match — should need a FRESH 500ms, not just the 400ms
    // that had already accumulated before the interruption.
    clock.advance(400);
    let events = gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), orientation: "left" }),
    );
    expect(events).toEqual([]); // only ~0ms held on this second attempt so far

    clock.advance(550);
    events = gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), orientation: "left" }),
    );
    expect(events.some((e) => e.type === "step-advanced")).toBe(true);
  });

  it("accepts the accessible alternative action for a hand step", () => {
    const clock = fakeClock();
    const steps: GateStep[] = [
      {
        kind: "hand",
        action: "thumbs_up",
        timeLimitMs: 6000,
        accessibleAlternative: "smile",
      },
    ];
    const gate = new ChallengeGate({
      steps,
      holdDurationMs: 300,
      now: clock.now,
    });

    gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), smiling: true, gesture: null }),
    );
    clock.advance(350);
    const events = gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), smiling: true, gesture: null }),
    );
    expect(events.some((e) => e.type === "step-advanced")).toBe(true);
  });

  it("does not match a wrong gesture", () => {
    const clock = fakeClock();
    const steps: GateStep[] = [
      { kind: "hand", action: "victory", timeLimitMs: 6000 },
    ];
    const gate = new ChallengeGate({
      steps,
      holdDurationMs: 300,
      now: clock.now,
    });

    gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), gesture: "thumbs_up" }),
    );
    clock.advance(500);
    const events = gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), gesture: "thumbs_up" }),
    );
    expect(events).toEqual([]);
  });

  it("times out a step that never matches within its time limit", () => {
    const clock = fakeClock();
    const steps: GateStep[] = [
      { kind: "face", action: "look_up", timeLimitMs: 1000 },
    ];
    const gate = new ChallengeGate({
      steps,
      holdDurationMs: 300,
      now: clock.now,
    });

    gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), orientation: "center" }),
    );
    clock.advance(1200);
    const events = gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), orientation: "center" }),
    );
    expect(events).toEqual([
      { type: "step-timeout", stepIndex: 0, action: "look_up" },
    ]);
    expect(gate.isComplete()).toBe(true);
  });
});

describe("ChallengeGate — blink steps", () => {
  it("advances blink_once after exactly one closed->open transition", () => {
    const clock = fakeClock();
    const steps: GateStep[] = [
      { kind: "face", action: "blink_once", timeLimitMs: 6000 },
    ];
    const gate = new ChallengeGate({ steps, now: clock.now });

    gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), eyesClosed: false }),
    );
    clock.advance(100);
    let events = gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), eyesClosed: true }),
    );
    expect(events).toEqual([]); // closing alone isn't a completed blink yet

    clock.advance(100);
    events = gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), eyesClosed: false }),
    );
    expect(events.some((e) => e.type === "step-advanced")).toBe(true);
  });

  it("does not advance blink_twice after only one blink", () => {
    const clock = fakeClock();
    const steps: GateStep[] = [
      { kind: "face", action: "blink_twice", timeLimitMs: 6000 },
    ];
    const gate = new ChallengeGate({ steps, now: clock.now });

    gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), eyesClosed: false }),
    );
    clock.advance(100);
    gate.pushSignal(baseSignal({ timestampMs: clock.now(), eyesClosed: true }));
    clock.advance(100);
    const events = gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), eyesClosed: false }),
    );
    expect(events).toEqual([]);
  });

  it("advances blink_twice after two blinks within the blink window", () => {
    const clock = fakeClock();
    const steps: GateStep[] = [
      { kind: "face", action: "blink_twice", timeLimitMs: 6000 },
    ];
    const gate = new ChallengeGate({
      steps,
      blinkWindowMs: 1500,
      now: clock.now,
    });

    gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), eyesClosed: false }),
    );
    clock.advance(100);
    gate.pushSignal(baseSignal({ timestampMs: clock.now(), eyesClosed: true }));
    clock.advance(100);
    gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), eyesClosed: false }),
    ); // blink 1
    clock.advance(300);
    gate.pushSignal(baseSignal({ timestampMs: clock.now(), eyesClosed: true }));
    clock.advance(100);
    const events = gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), eyesClosed: false }), // blink 2
    );
    expect(events.some((e) => e.type === "step-advanced")).toBe(true);
  });

  it("drops a stale first blink when the second arrives outside the blink window", () => {
    const clock = fakeClock();
    const steps: GateStep[] = [
      { kind: "face", action: "blink_twice", timeLimitMs: 10_000 },
    ];
    const gate = new ChallengeGate({
      steps,
      blinkWindowMs: 500,
      now: clock.now,
    });

    gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), eyesClosed: false }),
    );
    clock.advance(50);
    gate.pushSignal(baseSignal({ timestampMs: clock.now(), eyesClosed: true }));
    clock.advance(50);
    gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), eyesClosed: false }),
    ); // blink 1

    clock.advance(2000); // way outside the 500ms blink window
    gate.pushSignal(baseSignal({ timestampMs: clock.now(), eyesClosed: true }));
    clock.advance(50);
    let events = gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), eyesClosed: false }), // blink 2 (too late)
    );
    expect(events).toEqual([]);

    // A THIRD blink shortly after should now complete it (2nd+3rd within window).
    clock.advance(100);
    gate.pushSignal(baseSignal({ timestampMs: clock.now(), eyesClosed: true }));
    clock.advance(50);
    events = gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), eyesClosed: false }),
    );
    expect(events.some((e) => e.type === "step-advanced")).toBe(true);
  });
});

describe("ChallengeGate — multi-step sequences and logging", () => {
  it("completes a full multi-step challenge in order and logs each transition", () => {
    const clock = fakeClock();
    const steps: GateStep[] = [
      { kind: "face", action: "look_center", timeLimitMs: 6000 },
      { kind: "hand", action: "open_palm", timeLimitMs: 6000 },
    ];
    const gate = new ChallengeGate({
      steps,
      holdDurationMs: 200,
      now: clock.now,
    });

    gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), orientation: "center" }),
    );
    clock.advance(250);
    let events = gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), orientation: "center" }),
    );
    expect(events.some((e) => e.type === "step-advanced")).toBe(true);
    expect(gate.isComplete()).toBe(false);

    gate.pushSignal(
      baseSignal({
        timestampMs: clock.now(),
        orientation: "center",
        gesture: "open_palm",
      }),
    );
    clock.advance(250);
    events = gate.pushSignal(
      baseSignal({
        timestampMs: clock.now(),
        orientation: "center",
        gesture: "open_palm",
      }),
    );
    expect(events.some((e) => e.type === "challenge-complete")).toBe(true);
    expect(gate.stepResults().map((r) => r.action)).toEqual([
      "look_center",
      "open_palm",
    ]);

    const log = gate.log();
    // Both steps advance (the final one advances AND completes the
    // challenge in the same frame), plus one challenge-complete entry.
    expect(log.filter((e) => e.event === "step-advanced")).toHaveLength(2);
    expect(log.filter((e) => e.event === "challenge-complete")).toHaveLength(1);
  });

  it("reports progress toward the current step's hold requirement", () => {
    const clock = fakeClock();
    const steps: GateStep[] = [
      { kind: "face", action: "look_center", timeLimitMs: 6000 },
    ];
    const gate = new ChallengeGate({
      steps,
      holdDurationMs: 500,
      now: clock.now,
    });

    gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), orientation: "center" }),
    );
    clock.advance(200);
    gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), orientation: "center" }),
    );

    const progress = gate.progress();
    expect(progress.stepIndex).toBe(0);
    expect(progress.holdMs).toBeCloseTo(200, 0);
    expect(progress.requiredMs).toBe(500);
  });

  it("ignores signals pushed after the challenge is already complete", () => {
    const clock = fakeClock();
    const steps: GateStep[] = [
      { kind: "face", action: "look_center", timeLimitMs: 6000 },
    ];
    const gate = new ChallengeGate({
      steps,
      holdDurationMs: 100,
      now: clock.now,
    });

    gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), orientation: "center" }),
    );
    clock.advance(150);
    gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), orientation: "center" }),
    );
    expect(gate.isComplete()).toBe(true);

    const events = gate.pushSignal(
      baseSignal({ timestampMs: clock.now(), orientation: "center" }),
    );
    expect(events).toEqual([]);
    expect(gate.stepResults()).toHaveLength(1);
  });
});

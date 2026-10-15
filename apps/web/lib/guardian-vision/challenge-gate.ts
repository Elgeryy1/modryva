import type { FaceOrientation, FrameSignals, HandGesture } from "./types";

/**
 * The real challenge state machine: advances a step ONLY when the live
 * MediaPipe-derived signal for that step's action actually holds true for a
 * configured minimum duration (`holdDurationMs`) — replacing the previous
 * self-reported "Listo, siguiente" button, which trusted the client's claim
 * with no visual confirmation at all. Every `pushSignal` call is a real
 * frame's classified output; nothing here is faked or assumed.
 *
 * Blink steps (blink_once/blink_twice) are handled differently from
 * hold-based steps: a blink is a transition (open -> closed -> open), not a
 * state that holds, so they're satisfied by counting edges instead.
 */

export interface GateStep {
  readonly kind: "face" | "hand";
  readonly action: string;
  readonly timeLimitMs: number;
  readonly accessibleAlternative?: string;
}

export interface ChallengeGateOptions {
  readonly steps: readonly GateStep[];
  /** How long a matching signal must hold continuously before the step is
   * considered satisfied. Guards against a single lucky frame (e.g. a blink
   * mid-turn briefly looking "centered") counting as a deliberate action. */
  readonly holdDurationMs?: number;
  /** Max gap between the two blinks of blink_twice. */
  readonly blinkWindowMs?: number;
  readonly now?: () => number;
}

export interface StepResult {
  readonly action: string;
  readonly detectedAt: number;
}

export type GateEvent =
  | {
      readonly type: "step-advanced";
      readonly stepIndex: number;
      readonly action: string;
      readonly detectedAtMs: number;
    }
  | {
      readonly type: "step-timeout";
      readonly stepIndex: number;
      readonly action: string;
    }
  | {
      readonly type: "challenge-complete";
      readonly results: readonly StepResult[];
    }
  | { readonly type: "challenge-timeout" };

export interface GateLogEntry {
  readonly stepIndex: number;
  readonly action: string;
  readonly event: string;
  readonly atMs: number;
}

export interface GateProgress {
  readonly stepIndex: number;
  readonly holdMs: number;
  readonly requiredMs: number;
  readonly blinkCount: number;
  readonly requiredBlinks: number;
}

const DEFAULT_HOLD_MS = 500;
const DEFAULT_BLINK_WINDOW_MS = 1800;

const BLINK_ACTIONS = new Set(["blink_once", "blink_twice"]);

const orientationActions: Record<string, FaceOrientation> = {
  look_center: "center",
  turn_left: "left",
  turn_right: "right",
  look_up: "up",
};

const isHandGesture = (action: string): action is HandGesture =>
  [
    "thumbs_up",
    "victory",
    "open_palm",
    "closed_fist",
    "show_one_finger",
    "show_two_fingers",
    "show_three_fingers",
  ].includes(action);

/** Whether a single frame's signals satisfy a non-blink action right now. */
const matchesInstant = (action: string, signal: FrameSignals): boolean => {
  const orientation = orientationActions[action];
  if (orientation) {
    return signal.faceCount === 1 && signal.orientation === orientation;
  }
  if (action === "smile") {
    return signal.faceCount === 1 && signal.smiling === true;
  }
  if (isHandGesture(action)) {
    return signal.gesture === action;
  }
  return false;
};

export class ChallengeGate {
  private readonly steps: readonly GateStep[];
  private readonly holdDurationMs: number;
  private readonly blinkWindowMs: number;
  private readonly now: () => number;

  private stepIndex = 0;
  private stepStartedAtMs: number;
  private holdStartedAtMs: number | null = null;
  private prevEyesClosed = false;
  private blinkTimestamps: number[] = [];
  private readonly results: StepResult[] = [];
  private readonly logEntries: GateLogEntry[] = [];
  private done = false;
  private readonly totalTimeLimitMs: number;
  private readonly sessionStartedAtMs: number;

  constructor(options: ChallengeGateOptions) {
    this.steps = options.steps;
    this.holdDurationMs = options.holdDurationMs ?? DEFAULT_HOLD_MS;
    this.blinkWindowMs = options.blinkWindowMs ?? DEFAULT_BLINK_WINDOW_MS;
    this.now = options.now ?? (() => Date.now());
    this.sessionStartedAtMs = this.now();
    this.stepStartedAtMs = this.sessionStartedAtMs;
    this.totalTimeLimitMs = this.steps.reduce(
      (sum, s) => sum + s.timeLimitMs,
      0,
    );
  }

  isComplete(): boolean {
    return this.done;
  }

  stepResults(): readonly StepResult[] {
    return this.results;
  }

  log(): readonly GateLogEntry[] {
    return this.logEntries;
  }

  progress(): GateProgress {
    const step = this.steps[this.stepIndex];
    const holdMs =
      this.holdStartedAtMs === null ? 0 : this.now() - this.holdStartedAtMs;
    const requiredBlinks =
      step?.action === "blink_once"
        ? 1
        : step?.action === "blink_twice"
          ? 2
          : 0;
    return {
      stepIndex: this.stepIndex,
      holdMs: Math.max(0, holdMs),
      requiredMs: this.holdDurationMs,
      blinkCount: this.blinkTimestamps.length,
      requiredBlinks,
    };
  }

  private record(event: string): void {
    const step = this.steps[this.stepIndex];
    this.logEntries.push({
      stepIndex: this.stepIndex,
      action: step?.action ?? "(complete)",
      event,
      atMs: this.now(),
    });
  }

  /** Feeds one real, already-classified frame into the gate. Returns any
   * events this frame triggered (usually none, occasionally a step advance,
   * timeout, or full completion). */
  pushSignal(signal: FrameSignals): GateEvent[] {
    if (this.done) {
      return [];
    }
    const events: GateEvent[] = [];
    const step = this.steps[this.stepIndex];
    if (!step) {
      return events;
    }
    const t = signal.timestampMs;

    // Checked before the total-challenge timeout so the UI gets the more
    // specific "which step" signal whenever the two coincide (always true
    // for the final step, since its own budget and the remaining total
    // budget run out together).
    if (t > this.stepStartedAtMs + step.timeLimitMs) {
      this.done = true;
      this.record("step-timeout");
      events.push({
        type: "step-timeout",
        stepIndex: this.stepIndex,
        action: step.action,
      });
      return events;
    }

    // Structural backstop, not the primary path: because totalTimeLimitMs is
    // the sum of every step's own timeLimitMs (mirrors the server's
    // verifyChallengeSubmission), the per-step check above always reaches
    // its deadline at or before this one — this only fires if that
    // invariant is ever violated (e.g. a future caller passes a shorter
    // custom total budget).
    if (t > this.sessionStartedAtMs + this.totalTimeLimitMs) {
      this.done = true;
      this.record("challenge-timeout");
      events.push({ type: "challenge-timeout" });
      return events;
    }

    const satisfiedAt = BLINK_ACTIONS.has(step.action)
      ? this.trackBlink(step, signal)
      : this.trackHold(step, signal);

    if (satisfiedAt !== null) {
      this.results.push({ action: step.action, detectedAt: satisfiedAt });
      this.record("step-advanced");
      events.push({
        type: "step-advanced",
        stepIndex: this.stepIndex,
        action: step.action,
        detectedAtMs: satisfiedAt,
      });
      this.stepIndex += 1;
      this.holdStartedAtMs = null;
      this.blinkTimestamps = [];
      this.prevEyesClosed = false;
      this.stepStartedAtMs = t;

      if (this.stepIndex >= this.steps.length) {
        this.done = true;
        this.record("challenge-complete");
        events.push({ type: "challenge-complete", results: this.results });
      }
    }

    return events;
  }

  /** Hold-based matching: the target condition (orientation/smile/gesture,
   * or its accessible alternative) must hold continuously for
   * `holdDurationMs` before the step counts as done. */
  private trackHold(step: GateStep, signal: FrameSignals): number | null {
    const matches =
      matchesInstant(step.action, signal) ||
      (step.accessibleAlternative
        ? matchesInstant(step.accessibleAlternative, signal)
        : false);

    if (!matches) {
      this.holdStartedAtMs = null;
      return null;
    }
    if (this.holdStartedAtMs === null) {
      this.holdStartedAtMs = signal.timestampMs;
    }
    const held = signal.timestampMs - this.holdStartedAtMs;
    if (held >= this.holdDurationMs) {
      return this.holdStartedAtMs + this.holdDurationMs;
    }
    return null;
  }

  /** Edge-based matching for blink_once/blink_twice: counts closed->open
   * transitions ("a blink"), requiring the right count within the step's
   * time budget (and, for blink_twice, within `blinkWindowMs` of each
   * other so two unrelated blinks minutes apart don't count). */
  private trackBlink(step: GateStep, signal: FrameSignals): number | null {
    const closedNow = signal.eyesClosed === true;
    const blinkCompleted = this.prevEyesClosed && !closedNow;
    this.prevEyesClosed = closedNow;

    if (blinkCompleted) {
      this.blinkTimestamps.push(signal.timestampMs);
    }

    const required = step.action === "blink_once" ? 1 : 2;
    if (this.blinkTimestamps.length < required) {
      return null;
    }
    const relevant = this.blinkTimestamps.slice(-required);
    const first = relevant[0] as number;
    const last = relevant[relevant.length - 1] as number;
    if (required === 2 && last - first > this.blinkWindowMs) {
      // Too far apart — drop the stale one and keep waiting.
      this.blinkTimestamps = this.blinkTimestamps.slice(-1);
      return null;
    }
    return last;
  }
}

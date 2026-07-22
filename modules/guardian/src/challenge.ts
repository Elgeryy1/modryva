/**
 * Server-generated liveness challenges for Guardian Verification. Challenges
 * are ALWAYS built here (never trusted from the client) so a manipulated Mini
 * App client cannot choose an easy challenge or skip steps.
 */

export type FaceAction =
  | "look_center"
  | "turn_left"
  | "turn_right"
  | "look_up"
  | "blink_once"
  | "blink_twice"
  | "smile";

export type HandAction =
  | "thumbs_up"
  | "victory"
  | "open_palm"
  | "closed_fist"
  | "show_one_finger"
  | "show_two_fingers"
  | "show_three_fingers";

export type ChallengeDifficultyValue = "basic" | "normal" | "strict";

export interface ChallengeStep {
  readonly kind: "face" | "hand";
  readonly action: FaceAction | HandAction;
  readonly timeLimitMs: number;
  /** Alternative step a user unable to perform this gesture (e.g. missing a
   * hand) may substitute, keeping the challenge accessible. */
  readonly accessibleAlternative: FaceAction;
}

export interface ChallengeDefinition {
  readonly nonce: string;
  readonly difficulty: ChallengeDifficultyValue;
  readonly steps: readonly ChallengeStep[];
  /** strict mode reveals steps one at a time instead of showing the whole
   * sequence up front (harder to script/replay against). */
  readonly revealStepsAhead: boolean;
  readonly totalTimeLimitMs: number;
}

const faceActions: readonly FaceAction[] = [
  "look_center",
  "turn_left",
  "turn_right",
  "look_up",
  "blink_once",
  "blink_twice",
  "smile",
];

const handActions: readonly HandAction[] = [
  "thumbs_up",
  "victory",
  "open_palm",
  "closed_fist",
  "show_one_finger",
  "show_two_fingers",
  "show_three_fingers",
];

const STEP_TIME_LIMIT_MS = 6_000;

// Deterministic pseudo-random generator (mulberry32) so challenge generation
// is reproducible in tests given a fixed seed — mirrors the approach used by
// modules/security/src/captcha.ts.
const nextRandom = (seed: number): { value: number; seed: number } => {
  let state = (seed + 0x6d2b79f5) | 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  state = t | 0;
  return { value, seed: state };
};

const pick = <T>(
  items: readonly T[],
  seed: number,
): { value: T; seed: number } => {
  const next = nextRandom(seed);
  const index = Math.min(
    items.length - 1,
    Math.floor(next.value * items.length),
  );
  const value = items[index] as T;
  return { value, seed: next.seed };
};

const buildStep = (
  kind: "face" | "hand",
  action: FaceAction | HandAction,
  seed: number,
): { step: ChallengeStep; seed: number } => {
  const alt = pick(
    faceActions.filter((a) => a !== action),
    seed,
  );
  return {
    step: {
      kind,
      action,
      timeLimitMs: STEP_TIME_LIMIT_MS,
      accessibleAlternative: alt.value,
    },
    seed: alt.seed,
  };
};

const stepCountFor = (difficulty: ChallengeDifficultyValue): number => {
  switch (difficulty) {
    case "strict":
      return 3;
    case "normal":
      return 2;
    default:
      return 1;
  }
};

/**
 * Photo-mode gestures: a single clear hand gesture shown together with the
 * face in ONE still photo, verified by the vision AI (Gemini/Groq) rather than
 * on-device MediaPipe. Chosen for visual distinctness so the model can tell
 * them apart reliably. Each maps to an emoji-labelled instruction in the Mini
 * App (see apps/web/app/guardian/verify/page.tsx STEP_LABELS).
 */
export const PHOTO_GESTURE_ACTIONS: readonly HandAction[] = [
  "thumbs_up",
  "victory",
  "open_palm",
  "closed_fist",
  "show_one_finger",
  "show_three_fingers",
];

// Generous: the user reads the instruction, poses the gesture with their face
// in frame, and takes a single photo — no per-step race like the old liveness
// video. Still bounded so a submission can't be replayed arbitrarily late.
const PHOTO_GESTURE_TIME_LIMIT_MS = 120_000;

/**
 * Photo-mode challenge: one hand gesture the user performs with their face
 * visible, in a single still photo. The gesture itself is confirmed server-side
 * by the vision AI (see GestureVisionProvider), which also estimates age and
 * checks the subject is a real, live person — this only fixes WHICH gesture was
 * asked so the submission is checked against the exact challenge issued.
 *
 * `photoCount` 2 (double verification) adds a SECOND step with a DIFFERENT
 * gesture than the first — different on purpose, so a single recycled photo
 * or looping video can't satisfy both steps at once — for a second photo the
 * AI also cross-checks is the same person as the first (see
 * GestureVisionProvider.compareFaces / decision-engine.ts's samePerson gate).
 *
 * `forcedFirstGesture`/`forcedSecondGesture` are test-only (see
 * GUARDIAN_TEST_FORCED_GESTURE / _2) — pin the gesture(s) instead of picking
 * at random, so a tester can prepare matching photos (e.g. spoof/gesture-pack
 * images) and reliably re-test spoof detection against known gestures
 * instead of re-rolling until a random one happens to match what they have.
 * Callers MUST only pass these when GUARDIAN_TEST_MODE is on. If both are set
 * to the SAME gesture, the second falls back to a random (different) one —
 * double verification's whole point is the two gestures differ.
 */
export const generateGestureChallenge = (
  seed: number,
  nonce: string,
  photoCount: 1 | 2 = 1,
  forcedFirstGesture?: HandAction,
  forcedSecondGesture?: HandAction,
): ChallengeDefinition => {
  const first =
    forcedFirstGesture && PHOTO_GESTURE_ACTIONS.includes(forcedFirstGesture)
      ? { value: forcedFirstGesture, seed }
      : pick(PHOTO_GESTURE_ACTIONS, seed);
  const steps: ChallengeStep[] = [
    {
      kind: "hand",
      action: first.value,
      timeLimitMs: PHOTO_GESTURE_TIME_LIMIT_MS,
      // Face-only fallback for a user who cannot perform the hand gesture.
      accessibleAlternative: "smile",
    },
  ];
  if (photoCount === 2) {
    const second =
      forcedSecondGesture &&
      forcedSecondGesture !== first.value &&
      PHOTO_GESTURE_ACTIONS.includes(forcedSecondGesture)
        ? { value: forcedSecondGesture }
        : pick(
            PHOTO_GESTURE_ACTIONS.filter((a) => a !== first.value),
            first.seed,
          );
    steps.push({
      kind: "hand",
      action: second.value,
      timeLimitMs: PHOTO_GESTURE_TIME_LIMIT_MS,
      accessibleAlternative: "smile",
    });
  }
  return {
    nonce,
    difficulty: "basic",
    steps,
    revealStepsAhead: true,
    totalTimeLimitMs: PHOTO_GESTURE_TIME_LIMIT_MS * steps.length,
  };
};

/**
 * Generates a fresh challenge for the given difficulty and numeric seed.
 * `nonce` must be a caller-supplied single-use value (e.g. a UUID) — it is
 * embedded verbatim so a later submission can be checked against the exact
 * challenge that was issued, not merely "a" challenge.
 */
export const generateChallenge = (
  difficulty: ChallengeDifficultyValue,
  seed: number,
  nonce: string,
): ChallengeDefinition => {
  const count = stepCountFor(difficulty);
  const steps: ChallengeStep[] = [];
  let cursor = seed;
  let usedFace = false;

  for (let i = 0; i < count; i += 1) {
    // First step of any challenge is always a face step (need a face in
    // frame before asking for a hand gesture); later steps mix in hands.
    const useFace =
      i === 0 || !usedFace ? true : pick([true, false], cursor).value;
    if (useFace) {
      const face = pick(faceActions, cursor);
      cursor = face.seed;
      const built = buildStep("face", face.value, cursor);
      cursor = built.seed;
      steps.push(built.step);
      usedFace = true;
    } else {
      const hand = pick(handActions, cursor);
      cursor = hand.seed;
      const built = buildStep("hand", hand.value, cursor);
      cursor = built.seed;
      steps.push(built.step);
    }
  }

  return {
    nonce,
    difficulty,
    steps,
    revealStepsAhead: difficulty !== "strict",
    totalTimeLimitMs: steps.reduce((sum, step) => sum + step.timeLimitMs, 0),
  };
};

export interface SubmittedStepResult {
  readonly action: string;
  readonly detectedAt: number;
}

export type ChallengeVerification =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "nonce-mismatch"
        | "step-count-mismatch"
        | "wrong-order"
        | "step-timeout"
        | "total-timeout";
    };

/**
 * Verifies the ORDER, IDENTITY and TIMING of a client-submitted step
 * sequence against the challenge that was actually issued. This does NOT
 * verify that the gesture truly happened on camera — that is the server-side
 * analysis's job (VerificationAnalysis). This only rejects a submission that
 * couldn't possibly be honest: wrong nonce, skipped/reordered/late steps.
 */
export const verifyChallengeSubmission = (
  definition: ChallengeDefinition,
  submittedNonce: string,
  results: readonly SubmittedStepResult[],
  sessionStartedAtMs: number,
): ChallengeVerification => {
  if (submittedNonce !== definition.nonce) {
    return { ok: false, reason: "nonce-mismatch" };
  }
  if (results.length !== definition.steps.length) {
    return { ok: false, reason: "step-count-mismatch" };
  }

  // Each step's deadline is relative to when the PREVIOUS step actually
  // completed (not its own worst-case deadline), so a fast user isn't
  // penalized — only monotonic order + each step's own time budget matter.
  let previousDetectedAt = sessionStartedAtMs;
  for (let i = 0; i < definition.steps.length; i += 1) {
    const expected = definition.steps[i] as ChallengeStep;
    const actual = results[i] as SubmittedStepResult;
    const matchesExpected =
      actual.action === expected.action ||
      actual.action === expected.accessibleAlternative;
    if (!matchesExpected) {
      return { ok: false, reason: "wrong-order" };
    }
    if (actual.detectedAt < previousDetectedAt) {
      return { ok: false, reason: "wrong-order" };
    }
    if (actual.detectedAt > previousDetectedAt + expected.timeLimitMs) {
      return { ok: false, reason: "step-timeout" };
    }
    previousDetectedAt = actual.detectedAt;
  }

  if (previousDetectedAt > sessionStartedAtMs + definition.totalTimeLimitMs) {
    return { ok: false, reason: "total-timeout" };
  }

  return { ok: true };
};

/**
 * Resolves which of a step's two allowed actions — its original `action` or
 * its `accessibleAlternative` — a client's declared step result maps to.
 * Restricted to returning ONLY one of those two server-known values, never
 * the raw `submittedAction` string verbatim, because the return value ends
 * up inside a prompt sent to a vision LLM (GestureVisionProvider.analyze's
 * requestedGesture) — an arbitrary/attacker-controlled client string must
 * never flow through here. Falls back to the step's original `action` for
 * anything that isn't an exact match to the alternative, including a
 * missing/absent step result.
 */
export const resolveStepAction = (
  step: ChallengeStep,
  submittedAction: string | undefined,
): FaceAction | HandAction =>
  submittedAction === step.accessibleAlternative
    ? step.accessibleAlternative
    : step.action;

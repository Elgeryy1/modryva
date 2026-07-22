import type {
  GuardianDecisionValue,
  GuardianModeValue,
  GuardianProvenanceStatusValue,
  GuardianProviderStatusValue,
} from "@superbot/data";

/**
 * Deterministic, side-effect-free policy engine for Guardian Verification.
 * Given the same input it always returns the same output — this is what
 * makes it unit-testable without mocking AI providers, Telegram, or a clock.
 *
 * Design notes (see docs — rule references are to the Guardian Verification
 * task spec this module implements):
 *
 * - MANUAL and ASSISTED modes never resolve better than MANUAL_REVIEW: the
 *   analysis still runs (ASSISTED annotates the STAFF report with it) but a
 *   human always makes the call.
 * - "Confidence" is the MINIMUM of the individual critical scores (liveness,
 *   gesture, 1-replayRisk, 1-syntheticRisk, quality) — never a naive average,
 *   so one bad signal cannot be hidden behind other good ones.
 * - A provider that is not_evaluated/unavailable/uncertain/failed can NEVER
 *   contribute a passing score. If liveness or synthetic-media detection is
 *   not actually configured, AUTO/STRICT mode caps out at MANUAL_REVIEW —
 *   this is intentional: without a real anti-spoofing signal there is no
 *   honest basis for high confidence (see rule 7 in the spec).
 * - AUTO_DECLINE is only ever returned when `allowAutomaticDecline` is true;
 *   otherwise every "would be a decline" case degrades to MANUAL_REVIEW so a
 *   misconfigured/cautious chat never auto-rejects a real person.
 */

export const DECISION_POLICY_VERSION = "guardian-decision-v1";

/**
 * Premium gate for auto-approval. AUTO and STRICT are the only modes that ever
 * resolve a decision from the AI signals; a chat may only use them while it
 * holds an active AI pack. Without one, guardian still runs the full camera
 * check, but every case is downgraded to MANUAL so STAFF makes the call.
 * MANUAL/ASSISTED/OFF are returned unchanged (they never auto-approve anyway).
 *
 * Applied at session start and snapshotted into the session, so a pack that
 * EXPIRES correctly downgrades an already-auto chat on its next join request,
 * while a mid-flow change can't reinterpret a verification already underway.
 */
export const resolveEffectiveGuardianMode = (
  configuredMode: GuardianModeValue,
  groupHasAiPack: boolean,
): GuardianModeValue => {
  if (
    !groupHasAiPack &&
    (configuredMode === "auto" || configuredMode === "strict")
  ) {
    return "manual";
  }
  return configuredMode;
};

export interface DecisionSettingsInput {
  readonly mode: GuardianModeValue;
  readonly autoApproveThreshold: number;
  readonly manualReviewThreshold: number;
  readonly livenessMinimum: number;
  readonly gestureMinimum: number;
  readonly replayRiskMaximum: number;
  readonly syntheticRiskMaximum: number;
  readonly requireSingleFace: boolean;
  readonly allowAutomaticDecline: boolean;
  readonly minimumAge: number | null;
  /** Upper age bound. When set, a subject the AI estimates as clearly older
   * routes to STAFF (never a sole auto-decline — same rule as minimumAge). */
  readonly maximumAge: number | null;
  /** 1 (default) or 2. When 2, samePersonStatus/samePersonMatch below MUST
   * come from a real comparison before AUTO/STRICT can approve — see the
   * same-person gate. */
  readonly requiredPhotos: number;
  /** ISO 3166-1 alpha-2 codes. Empty = no restriction — see the countryCode
   * gate. Resolved from the person's IP, never phone number or location. */
  readonly allowedCountries: readonly string[];
}

export interface DecisionSignalsInput {
  readonly faceCount: number | null;
  readonly challengeCompleted: boolean;
  readonly gestureScore: number | null;
  readonly qualityScore: number | null;
  readonly livenessScore: number | null;
  readonly livenessStatus: GuardianProviderStatusValue;
  readonly replayRisk: number | null;
  readonly syntheticMediaRisk: number | null;
  readonly syntheticStatus: GuardianProviderStatusValue;
  readonly provenanceStatus: GuardianProvenanceStatusValue | null;
  readonly estimatedAgeMin: number | null;
  readonly estimatedAgeMax: number | null;
  readonly ageStatus: GuardianProviderStatusValue;
  /** Only meaningful when settings.requiredPhotos is 2 — otherwise both stay
   * at their default not_evaluated/null and the same-person gate is skipped
   * entirely (single-photo mode never claims to have checked this). */
  readonly samePersonStatus: GuardianProviderStatusValue;
  readonly samePersonMatch: boolean | null;
  /** The SECOND photo's OWN gesture check (double verification only). Like
   * samePerson* above, only meaningful when requiredPhotos is 2: a second photo
   * whose (different) requested gesture the model could not positively confirm
   * must not ride through on photo 1's gesture alone — see the second-gesture
   * gate. Stays not_evaluated/null in single-photo mode. */
  readonly secondGestureStatus: GuardianProviderStatusValue;
  readonly secondGesturePresent: boolean | null;
  /** Whether photo 2's RESOLVED requested gesture actually differs from photo
   * 1's (double verification only; null in single-photo mode). Both steps carry
   * the same face-only accessibleAlternative ("smile"), so a client can declare
   * that alternative for BOTH photos — resolveStepAction then asks the vision AI
   * to verify "smile" for both, and one recycled smiling selfie (or the SAME
   * photo uploaded twice) satisfies both, collapsing the "two DIFFERENT live
   * gestures" anti-replay tier the chat opted into down to single-photo
   * strength. false here makes the second-gesture gate route to STAFF instead of
   * auto-approving on that collapse. */
  readonly secondGestureDistinct: boolean | null;
  /** ISO 3166-1 alpha-2, resolved from the person's IP — null when not yet
   * resolved (e.g. no CF-IPCountry header, such as local dev without
   * Cloudflare in front). Only meaningful when settings.allowedCountries is
   * non-empty — see the countryCode gate. */
  readonly countryCode: string | null;
  readonly hardFailures: readonly string[];
}

export type SessionIntegrityViolation =
  | "token-reused"
  | "user-mismatch"
  | "media-hash-reused-by-other-user";

export interface DecisionInput {
  readonly settings: DecisionSettingsInput;
  readonly signals: DecisionSignalsInput;
  readonly attemptsRemaining: number;
  readonly integrityViolation: SessionIntegrityViolation | null;
  /** Set when the analysis pipeline itself failed (storage error, provider
   * crash) rather than producing a normal — even if poor — result. */
  readonly pipelineError: boolean;
}

export interface DecisionResult {
  readonly decision: GuardianDecisionValue;
  readonly reasonCode: string;
  readonly confidence: number | null;
  readonly explanation: {
    readonly codes: readonly string[];
    readonly signals: Record<string, unknown>;
    readonly thresholds: Record<string, number>;
    readonly policyVersion: string;
  };
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const buildExplanation = (
  input: DecisionInput,
  codes: readonly string[],
): DecisionResult["explanation"] => ({
  codes,
  signals: { ...input.signals },
  thresholds: {
    autoApproveThreshold: input.settings.autoApproveThreshold,
    manualReviewThreshold: input.settings.manualReviewThreshold,
    livenessMinimum: input.settings.livenessMinimum,
    gestureMinimum: input.settings.gestureMinimum,
    replayRiskMaximum: input.settings.replayRiskMaximum,
    syntheticRiskMaximum: input.settings.syntheticRiskMaximum,
  },
  policyVersion: DECISION_POLICY_VERSION,
});

const declineOrReview = (
  input: DecisionInput,
  reasonCode: string,
  codes: readonly string[],
): DecisionResult => {
  // MANUAL and ASSISTED modes must never auto_decline — "a human always makes
  // the call" (module docstring invariant). `mode` and `allowAutomaticDecline`
  // are independent settings, so without this gate a chat that deliberately
  // chose manual mode (wanting every case seen by staff) could still have a
  // real user auto-rejected the moment a heuristic fires — a hard-failure list
  // hit, a session-integrity check, or a C2PA byte scan — with no human ever
  // seeing it. Every auto_decline path funnels through here, so gating it once
  // covers the integrity, hard-failure and provenance branches uniformly.
  const humanDecidesOnly =
    input.settings.mode === "manual" || input.settings.mode === "assisted";
  const autoDecline = input.settings.allowAutomaticDecline && !humanDecidesOnly;
  return {
    decision: autoDecline ? "auto_decline" : "manual_review",
    reasonCode: autoDecline
      ? reasonCode
      : humanDecidesOnly
        ? `${reasonCode}_${input.settings.mode}_mode`
        : `${reasonCode}_auto_decline_disabled`,
    confidence: null,
    explanation: buildExplanation(input, codes),
  };
};

export const evaluateDecision = (input: DecisionInput): DecisionResult => {
  const { settings, signals } = input;

  if (input.pipelineError) {
    return {
      decision: "technical_failure",
      reasonCode: "pipeline_error",
      confidence: null,
      explanation: buildExplanation(input, ["pipeline_error"]),
    };
  }

  // Identity/session integrity violations are the clearest fraud signal we
  // have; still gated behind allowAutomaticDecline so a cautious chat never
  // auto-rejects without a human look.
  if (input.integrityViolation) {
    return declineOrReview(input, `integrity_${input.integrityViolation}`, [
      `integrity_violation:${input.integrityViolation}`,
    ]);
  }

  const attemptsExhausted = input.attemptsRemaining <= 0;

  // --- RETRY-eligible recoverable problems (only while attempts remain) ---
  if (!signals.challengeCompleted) {
    if (!attemptsExhausted) {
      return {
        decision: "retry",
        reasonCode: "challenge_incomplete",
        confidence: null,
        explanation: buildExplanation(input, ["challenge_incomplete"]),
      };
    }
    return declineOrReview(input, "challenge_incomplete_attempts_exhausted", [
      "challenge_incomplete",
      "attempts_exhausted",
    ]);
  }

  if (signals.faceCount === 0) {
    if (!attemptsExhausted) {
      return {
        decision: "retry",
        reasonCode: "no_face_detected",
        confidence: null,
        explanation: buildExplanation(input, ["no_face_detected"]),
      };
    }
    return declineOrReview(input, "no_face_detected_attempts_exhausted", [
      "no_face_detected",
      "attempts_exhausted",
    ]);
  }

  if (
    settings.requireSingleFace &&
    signals.faceCount !== null &&
    signals.faceCount > 1
  ) {
    if (!attemptsExhausted) {
      return {
        decision: "retry",
        reasonCode: "multiple_faces_detected",
        confidence: null,
        explanation: buildExplanation(input, ["multiple_faces_detected"]),
      };
    }
    return declineOrReview(input, "multiple_faces_after_retries", [
      "multiple_faces_detected",
      "attempts_exhausted",
    ]);
  }

  if (
    signals.qualityScore !== null &&
    signals.qualityScore < 0.3 &&
    !attemptsExhausted
  ) {
    return {
      decision: "retry",
      reasonCode: "capture_quality_too_low",
      confidence: null,
      explanation: buildExplanation(input, ["capture_quality_too_low"]),
    };
  }

  if (signals.hardFailures.length > 0) {
    return declineOrReview(input, "hard_failure", [
      ...signals.hardFailures.map((f) => `hard_failure:${f}`),
    ]);
  }

  // Clear-cut fraud: a C2PA manifest that itself declares AI generation.
  if (signals.provenanceStatus === "c2pa_valid_ai_declared") {
    return declineOrReview(input, "provenance_ai_declared", [
      "provenance_ai_declared",
    ]);
  }

  // Age is NEVER a sole cause of auto-decline (rule: minimum age alone must
  // not auto-reject) — an inconclusive/borderline estimate only ever nudges
  // toward manual review, handled below via the confidence cap.
  const codes: string[] = ["challenge_verified_ok"];

  // MANUAL and ASSISTED modes never self-resolve past MANUAL_REVIEW — the
  // analysis (if any) is attached to the STAFF report as a recommendation.
  if (settings.mode === "manual" || settings.mode === "assisted") {
    return {
      decision: "manual_review",
      reasonCode:
        settings.mode === "manual" ? "manual_mode" : "assisted_mode_review",
      confidence: null,
      explanation: buildExplanation(input, [...codes, `mode:${settings.mode}`]),
    };
  }

  // --- AUTO / STRICT: a real decision requires a REAL visual/liveness
  // analysis. `livenessStatus` is populated by the server-side visual
  // analyzer (face count, orientation/blink/gesture cross-checks, motion
  // continuity, sequence/timing — see modules/guardian/src/providers.ts's
  // HttpVisualAnalyzerProvider and services/guardian-vision-analyzer). A
  // provider that is not configured (not_evaluated) or failed/uncertain can
  // never be treated as a passing score — see module docstring.
  //
  // syntheticStatus (deepfake/synthetic-media detection) is deliberately NOT
  // part of this hard gate: it's a separate, harder problem this project
  // does not yet have a real, non-fabricated model for, and shipping a
  // guessed detector would violate the "never fabricate a confidence score"
  // rule. When it IS configured and evaluated, its risk score still feeds
  // the confidence calculation and the decline gate below (replayTooHigh /
  // syntheticTooHigh) — it just isn't a precondition for AUTO to be reachable
  // at all while it stays not_evaluated.
  // "success" status is NOT enough: the vision provider hardcodes success
  // whenever its JSON parses, but livenessScore is null when the model never
  // actually determined "is this a real, live person". Requiring a non-null
  // score closes the gap where a photo-of-a-screen the model was unsure about
  // (realPerson null → livenessScore null) would auto-approve with zero
  // anti-spoof evidence (rule: never auto-approve without a real liveness signal).
  const livenessUsable =
    signals.livenessStatus === "success" && signals.livenessScore !== null;

  if (!livenessUsable) {
    return {
      decision: "manual_review",
      reasonCode: "insufficient_ai_signal",
      confidence: null,
      explanation: buildExplanation(input, [
        ...codes,
        `liveness_status:${signals.livenessStatus}`,
      ]),
    };
  }

  // Same-person gate (double verification, requiredPhotos: 2). Requested
  // explicitly by the chat, so an inconclusive comparison (not evaluated,
  // uncertain, failed) can never be silently treated as a pass — AUTO/STRICT
  // routes to STAFF instead of approving without a real answer. A CONFIRMED
  // mismatch is a clear-cut fraud signal, same tier as the provenance/
  // integrity checks above, so it goes through the same allowAutomaticDecline
  // gate as everything else (never a sole unconditional auto-decline).
  if (settings.requiredPhotos === 2) {
    if (
      signals.samePersonStatus !== "success" ||
      signals.samePersonMatch === null
    ) {
      return {
        decision: "manual_review",
        reasonCode: "same_person_unverified",
        confidence: null,
        explanation: buildExplanation(input, [
          ...codes,
          `same_person_status:${signals.samePersonStatus}`,
        ]),
      };
    }
    if (signals.samePersonMatch === false) {
      return declineOrReview(input, "same_person_mismatch", [
        ...codes,
        "same_person_mismatch",
      ]);
    }
    // Second-gesture gate. Same-person above proves the two photos are the SAME
    // face; it does NOT prove photo 2 actually performed its (different)
    // requested gesture. A clear "gesture not shown" on photo 2 is already a
    // hard failure upstream — this closes the softer gap where the model was
    // merely UNCERTAIN (status not "success", or gesturePresent null): route to
    // STAFF instead of auto-approving on photo 1's single confirmed gesture, so
    // the "two DIFFERENT live gestures" anti-replay guarantee the chat opted
    // into can't silently collapse to one. Mirrors photo 1's livenessUsable gate.
    if (
      signals.secondGestureStatus !== "success" ||
      signals.secondGesturePresent !== true
    ) {
      return {
        decision: "manual_review",
        reasonCode: "second_gesture_unverified",
        confidence: null,
        explanation: buildExplanation(input, [
          ...codes,
          `second_gesture_status:${signals.secondGestureStatus}`,
        ]),
      };
    }
    // Even a positively-confirmed second gesture is worthless as an anti-replay
    // factor if it's the SAME gesture as photo 1 — the whole point of double
    // verification is TWO different live gestures. Both steps share the "smile"
    // accessibleAlternative, so a client can declare "smile" for both photos and
    // satisfy both with one recycled selfie. When the two resolved gestures are
    // not distinct we can't auto-approve on that collapse: route to STAFF (never
    // an auto-decline — a legitimate accessibility user who genuinely needs the
    // face fallback for both steps must still be seen by a human, not rejected).
    if (signals.secondGestureDistinct === false) {
      return {
        decision: "manual_review",
        reasonCode: "second_gesture_not_distinct",
        confidence: null,
        explanation: buildExplanation(input, [
          ...codes,
          "second_gesture_not_distinct",
        ]),
      };
    }
  }

  // Country gate (nationality requirement). Resolved from the person's IP,
  // never phone number or GPS location, and pinned on the Mini App's FIRST
  // request before any consent/photo UI (see GuardianVerifyController) so a
  // VPN turned on mid-flow can't change it. IP geolocation is never perfect
  // (VPNs, carrier-grade NAT, database gaps), so — same rule as age — this
  // never SOLELY auto-declines: unresolved or disallowed both route to
  // STAFF, gated behind allowAutomaticDecline like everything else.
  if (settings.allowedCountries.length > 0) {
    if (signals.countryCode === null) {
      return {
        decision: "manual_review",
        reasonCode: "country_unverified",
        confidence: null,
        explanation: buildExplanation(input, [...codes, "country_unverified"]),
      };
    }
    if (!settings.allowedCountries.includes(signals.countryCode)) {
      return declineOrReview(input, "country_not_allowed", [
        ...codes,
        `country_not_allowed:${signals.countryCode}`,
      ]);
    }
  }

  // Age gate. A single-photo age ESTIMATE is imprecise, so it never SOLELY
  // auto-declines (spec rule: age alone must not auto-reject) — when the
  // subject looks below the minimum, above the maximum, sits on either
  // boundary, or age could not be evaluated, the case goes to STAFF
  // (manual_review) with an explicit flag and a human decides. Only a
  // confidently in-range estimate falls through to auto-approval below.
  if (settings.minimumAge !== null || settings.maximumAge !== null) {
    if (signals.ageStatus !== "success") {
      return {
        decision: "manual_review",
        reasonCode: "age_unverified",
        confidence: null,
        explanation: buildExplanation(input, [...codes, "age_unverified"]),
      };
    }
    // ageStatus "success" but no usable estimate (the model omitted or returned
    // a non-numeric age while succeeding on the rest) must NOT fall through to
    // auto-approval — without a real age we cannot confirm in-range, so route
    // to STAFF (rule: age gate must never be silently defeated).
    if (
      signals.estimatedAgeMin === null ||
      signals.estimatedAgeMax === null
    ) {
      return {
        decision: "manual_review",
        reasonCode: "age_unverified",
        confidence: null,
        explanation: buildExplanation(input, [
          ...codes,
          "age_estimate_missing",
        ]),
      };
    }
    if (settings.minimumAge !== null) {
      if (
        signals.estimatedAgeMax !== null &&
        signals.estimatedAgeMax < settings.minimumAge
      ) {
        return {
          decision: "manual_review",
          reasonCode: "likely_below_minimum_age",
          confidence: null,
          explanation: buildExplanation(input, [
            ...codes,
            `age_below_minimum:${settings.minimumAge}`,
          ]),
        };
      }
      if (
        signals.estimatedAgeMin !== null &&
        signals.estimatedAgeMin < settings.minimumAge
      ) {
        return {
          decision: "manual_review",
          reasonCode: "age_borderline_minimum",
          confidence: null,
          explanation: buildExplanation(input, [
            ...codes,
            `age_borderline:${settings.minimumAge}`,
          ]),
        };
      }
    }
    if (settings.maximumAge !== null) {
      if (
        signals.estimatedAgeMin !== null &&
        signals.estimatedAgeMin > settings.maximumAge
      ) {
        return {
          decision: "manual_review",
          reasonCode: "likely_above_maximum_age",
          confidence: null,
          explanation: buildExplanation(input, [
            ...codes,
            `age_above_maximum:${settings.maximumAge}`,
          ]),
        };
      }
      if (
        signals.estimatedAgeMax !== null &&
        signals.estimatedAgeMax > settings.maximumAge
      ) {
        return {
          decision: "manual_review",
          reasonCode: "age_borderline_maximum",
          confidence: null,
          explanation: buildExplanation(input, [
            ...codes,
            `age_borderline_max:${settings.maximumAge}`,
          ]),
        };
      }
    }
  }

  const componentScores: number[] = [];
  if (signals.gestureScore !== null)
    componentScores.push(clamp01(signals.gestureScore));
  if (signals.qualityScore !== null)
    componentScores.push(clamp01(signals.qualityScore));
  if (signals.livenessScore !== null)
    componentScores.push(clamp01(signals.livenessScore));
  if (signals.replayRisk !== null)
    componentScores.push(clamp01(1 - signals.replayRisk));
  if (signals.syntheticMediaRisk !== null)
    componentScores.push(clamp01(1 - signals.syntheticMediaRisk));

  // Weakest-link confidence: never a mean, so one bad signal cannot be
  // diluted by several good ones.
  const confidence =
    componentScores.length > 0 ? Math.min(...componentScores) : 0;

  const gestureBelowMinimum =
    signals.gestureScore !== null &&
    signals.gestureScore < settings.gestureMinimum;
  const livenessBelowMinimum =
    signals.livenessScore !== null &&
    signals.livenessScore < settings.livenessMinimum;
  const replayTooHigh =
    signals.replayRisk !== null &&
    signals.replayRisk > settings.replayRiskMaximum;
  const syntheticTooHigh =
    signals.syntheticMediaRisk !== null &&
    signals.syntheticMediaRisk > settings.syntheticRiskMaximum;

  if (replayTooHigh || syntheticTooHigh) {
    return declineOrReview(
      input,
      "spoofing_risk_too_high",
      [
        ...codes,
        replayTooHigh ? "replay_risk_too_high" : "",
        syntheticTooHigh ? "synthetic_risk_too_high" : "",
      ].filter(Boolean),
    );
  }

  if (gestureBelowMinimum || livenessBelowMinimum) {
    if (confidence >= settings.manualReviewThreshold) {
      return {
        decision: "manual_review",
        reasonCode: "below_minimum_but_reviewable",
        confidence,
        explanation: buildExplanation(input, [
          ...codes,
          "below_minimum_signal",
        ]),
      };
    }
    if (!attemptsExhausted) {
      return {
        decision: "retry",
        reasonCode: "below_minimum_signal",
        confidence,
        explanation: buildExplanation(input, [
          ...codes,
          "below_minimum_signal",
        ]),
      };
    }
    return declineOrReview(input, "below_minimum_attempts_exhausted", [
      ...codes,
      "below_minimum_signal",
      "attempts_exhausted",
    ]);
  }

  if (confidence >= settings.autoApproveThreshold) {
    return {
      decision: "auto_approve",
      reasonCode: "confidence_above_auto_approve_threshold",
      confidence,
      explanation: buildExplanation(input, [...codes, "auto_approve"]),
    };
  }

  if (confidence >= settings.manualReviewThreshold) {
    return {
      decision: "manual_review",
      reasonCode: "confidence_between_thresholds",
      confidence,
      explanation: buildExplanation(input, [...codes, "manual_review"]),
    };
  }

  if (!attemptsExhausted) {
    return {
      decision: "retry",
      reasonCode: "confidence_below_manual_review_threshold",
      confidence,
      explanation: buildExplanation(input, [...codes, "low_confidence_retry"]),
    };
  }

  return declineOrReview(input, "low_confidence_attempts_exhausted", [
    ...codes,
    "low_confidence",
    "attempts_exhausted",
  ]);
};

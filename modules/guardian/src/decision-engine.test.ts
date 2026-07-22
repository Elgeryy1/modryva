import { describe, expect, it } from "vitest";
import {
  type DecisionInput,
  type DecisionSettingsInput,
  evaluateDecision,
  resolveEffectiveGuardianMode,
} from "./decision-engine.js";

const baseSettings: DecisionSettingsInput = {
  mode: "auto",
  autoApproveThreshold: 0.85,
  manualReviewThreshold: 0.55,
  livenessMinimum: 0.6,
  gestureMinimum: 0.6,
  replayRiskMaximum: 0.4,
  syntheticRiskMaximum: 0.4,
  requireSingleFace: true,
  allowAutomaticDecline: false,
  minimumAge: null,
  maximumAge: null,
  requiredPhotos: 1,
  allowedCountries: [],
};

const strongInput: DecisionInput = {
  settings: baseSettings,
  attemptsRemaining: 2,
  integrityViolation: null,
  pipelineError: false,
  signals: {
    faceCount: 1,
    challengeCompleted: true,
    gestureScore: 0.95,
    qualityScore: 0.9,
    livenessScore: 0.95,
    livenessStatus: "success",
    replayRisk: 0.02,
    syntheticMediaRisk: 0.02,
    syntheticStatus: "success",
    provenanceStatus: "c2pa_not_found",
    estimatedAgeMin: null,
    estimatedAgeMax: null,
    ageStatus: "not_evaluated",
    samePersonStatus: "not_evaluated",
    samePersonMatch: null,
    secondGestureStatus: "not_evaluated",
    secondGesturePresent: null,
    secondGestureDistinct: null,
    countryCode: null,
    hardFailures: [],
  },
};

describe("evaluateDecision", () => {
  it("auto-approves a strong, fully-verified case in AUTO mode", () => {
    const result = evaluateDecision(strongInput);
    expect(result.decision).toBe("auto_approve");
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("never returns auto_approve/auto_decline in MANUAL mode", () => {
    const result = evaluateDecision({
      ...strongInput,
      settings: { ...baseSettings, mode: "manual" },
    });
    expect(result.decision).toBe("manual_review");
  });

  it("never returns auto_approve/auto_decline in ASSISTED mode, even with strong signals", () => {
    const result = evaluateDecision({
      ...strongInput,
      settings: { ...baseSettings, mode: "assisted" },
    });
    expect(result.decision).toBe("manual_review");
  });

  it("does NOT auto_decline in MANUAL mode even with a hard failure and allowAutomaticDecline on", () => {
    // Regression: mode and allowAutomaticDecline are independent. A chat that
    // chose manual mode (every case seen by staff) must never have a real user
    // auto-rejected by a heuristic false positive. Before the fix this returned
    // auto_decline because the hard-failure gate ran before the mode check.
    const result = evaluateDecision({
      ...strongInput,
      settings: {
        ...baseSettings,
        mode: "manual",
        allowAutomaticDecline: true,
      },
      signals: { ...strongInput.signals, hardFailures: ["deepfake-artifact"] },
    });
    expect(result.decision).toBe("manual_review");
  });

  it("does NOT auto_decline in ASSISTED mode on an integrity violation with allowAutomaticDecline on", () => {
    const result = evaluateDecision({
      ...strongInput,
      settings: {
        ...baseSettings,
        mode: "assisted",
        allowAutomaticDecline: true,
      },
      integrityViolation: "media-hash-reused-by-other-user",
    });
    expect(result.decision).toBe("manual_review");
  });

  it("caps at MANUAL_REVIEW when liveness provider is not configured", () => {
    const result = evaluateDecision({
      ...strongInput,
      signals: { ...strongInput.signals, livenessStatus: "not_evaluated" },
    });
    expect(result.decision).toBe("manual_review");
    expect(result.reasonCode).toBe("insufficient_ai_signal");
  });

  it("does NOT require the synthetic-media provider to be configured for auto_approve (not required yet)", () => {
    const result = evaluateDecision({
      ...strongInput,
      signals: {
        ...strongInput.signals,
        syntheticStatus: "not_evaluated",
        syntheticMediaRisk: null,
      },
    });
    expect(result.decision).toBe("auto_approve");
  });

  it("still declines/reviews on a HIGH synthetic-media risk when that signal IS evaluated", () => {
    const result = evaluateDecision({
      ...strongInput,
      signals: {
        ...strongInput.signals,
        syntheticStatus: "success",
        syntheticMediaRisk: 0.9,
      },
    });
    expect(result.decision).not.toBe("auto_approve");
  });

  it("retries when the face is out of frame and attempts remain", () => {
    const result = evaluateDecision({
      ...strongInput,
      signals: { ...strongInput.signals, faceCount: 0 },
    });
    expect(result.decision).toBe("retry");
  });

  it("retries an incomplete challenge with attempts remaining", () => {
    const result = evaluateDecision({
      ...strongInput,
      signals: { ...strongInput.signals, challengeCompleted: false },
    });
    expect(result.decision).toBe("retry");
  });

  it("degrades to manual_review (not decline) when attempts are exhausted and allowAutomaticDecline is off", () => {
    const result = evaluateDecision({
      ...strongInput,
      attemptsRemaining: 0,
      signals: { ...strongInput.signals, challengeCompleted: false },
    });
    expect(result.decision).toBe("manual_review");
  });

  it("auto-declines exhausted attempts only when allowAutomaticDecline is on", () => {
    const result = evaluateDecision({
      ...strongInput,
      attemptsRemaining: 0,
      settings: { ...baseSettings, allowAutomaticDecline: true },
      signals: { ...strongInput.signals, challengeCompleted: false },
    });
    expect(result.decision).toBe("auto_decline");
  });

  it("retries multiple faces with attempts remaining, declines only after exhaustion", () => {
    const retry = evaluateDecision({
      ...strongInput,
      signals: { ...strongInput.signals, faceCount: 2 },
    });
    expect(retry.decision).toBe("retry");

    const declined = evaluateDecision({
      ...strongInput,
      attemptsRemaining: 0,
      settings: { ...baseSettings, allowAutomaticDecline: true },
      signals: { ...strongInput.signals, faceCount: 2 },
    });
    expect(declined.decision).toBe("auto_decline");
  });

  it("flags a C2PA manifest that declares AI generation", () => {
    const result = evaluateDecision({
      ...strongInput,
      settings: { ...baseSettings, allowAutomaticDecline: true },
      signals: {
        ...strongInput.signals,
        provenanceStatus: "c2pa_valid_ai_declared",
      },
    });
    expect(result.decision).toBe("auto_decline");
    expect(result.reasonCode).toContain("provenance_ai_declared");
  });

  it("never lets a single bad signal hide behind good ones (weakest-link confidence)", () => {
    const result = evaluateDecision({
      ...strongInput,
      signals: { ...strongInput.signals, livenessScore: 0.5 },
    });
    expect(result.confidence).toBeLessThanOrEqual(0.5);
    expect(result.decision).not.toBe("auto_approve");
  });

  it("sends borderline confidence to manual review, not auto-approve", () => {
    const result = evaluateDecision({
      ...strongInput,
      signals: {
        ...strongInput.signals,
        livenessScore: 0.7,
        gestureScore: 0.7,
      },
    });
    expect(result.decision).toBe("manual_review");
  });

  it("returns manual_review for high replay risk instead of a silent approve", () => {
    const result = evaluateDecision({
      ...strongInput,
      signals: { ...strongInput.signals, replayRisk: 0.9 },
    });
    expect(result.decision).toBe("manual_review");
  });

  it("hard failures short-circuit straight past retry/approve logic", () => {
    const result = evaluateDecision({
      ...strongInput,
      settings: { ...baseSettings, allowAutomaticDecline: true },
      signals: { ...strongInput.signals, hardFailures: ["deepfake-artifact"] },
    });
    expect(result.decision).toBe("auto_decline");
  });

  it("routes a session/identity integrity violation to decline only when enabled", () => {
    const reviewed = evaluateDecision({
      ...strongInput,
      integrityViolation: "user-mismatch",
    });
    expect(reviewed.decision).toBe("manual_review");

    const declined = evaluateDecision({
      ...strongInput,
      settings: { ...baseSettings, allowAutomaticDecline: true },
      integrityViolation: "media-hash-reused-by-other-user",
    });
    expect(declined.decision).toBe("auto_decline");
  });

  it("maps a pipeline error to TECHNICAL_FAILURE, never to approve", () => {
    const result = evaluateDecision({ ...strongInput, pipelineError: true });
    expect(result.decision).toBe("technical_failure");
  });

  it("age alone never causes auto_decline (no age signal is asserted at all)", () => {
    const result = evaluateDecision({
      ...strongInput,
      settings: {
        ...baseSettings,
        allowAutomaticDecline: true,
        minimumAge: 18,
      },
      signals: {
        ...strongInput.signals,
        estimatedAgeMin: 14,
        estimatedAgeMax: 17,
        ageStatus: "success",
      },
    });
    // Age is informational only in this engine — STRICT policies that want to
    // act on it must route through manual_review upstream, never auto_decline.
    expect(result.decision).not.toBe("auto_decline");
  });

  it("routes a clearly over-maximum-age estimate to STAFF, never auto_decline", () => {
    const result = evaluateDecision({
      ...strongInput,
      settings: {
        ...baseSettings,
        allowAutomaticDecline: true,
        maximumAge: 23,
      },
      signals: {
        ...strongInput.signals,
        estimatedAgeMin: 30,
        estimatedAgeMax: 38,
        ageStatus: "success",
      },
    });
    expect(result.decision).toBe("manual_review");
    expect(result.reasonCode).toBe("likely_above_maximum_age");
  });

  it("routes a max-borderline age (upper bound over the max) to STAFF", () => {
    const result = evaluateDecision({
      ...strongInput,
      settings: { ...baseSettings, maximumAge: 23 },
      signals: {
        ...strongInput.signals,
        estimatedAgeMin: 21,
        estimatedAgeMax: 26,
        ageStatus: "success",
      },
    });
    expect(result.decision).toBe("manual_review");
    expect(result.reasonCode).toBe("age_borderline_maximum");
  });

  it("auto-approves a confidently in-range age when a min and max are set", () => {
    const result = evaluateDecision({
      ...strongInput,
      settings: { ...baseSettings, minimumAge: 13, maximumAge: 23 },
      signals: {
        ...strongInput.signals,
        estimatedAgeMin: 18,
        estimatedAgeMax: 21,
        ageStatus: "success",
      },
    });
    expect(result.decision).toBe("auto_approve");
  });

  it("routes to STAFF when a max age is set but age could not be evaluated", () => {
    const result = evaluateDecision({
      ...strongInput,
      settings: { ...baseSettings, maximumAge: 23 },
      signals: {
        ...strongInput.signals,
        estimatedAgeMin: null,
        estimatedAgeMax: null,
        ageStatus: "unavailable",
      },
    });
    expect(result.decision).toBe("manual_review");
    expect(result.reasonCode).toBe("age_unverified");
  });

  it("is a pure function: identical input always yields identical output", () => {
    const a = evaluateDecision(strongInput);
    const b = evaluateDecision(strongInput);
    expect(a).toEqual(b);
  });

  it("STRICT mode can also auto-approve a strong case", () => {
    const result = evaluateDecision({
      ...strongInput,
      settings: { ...baseSettings, mode: "strict" },
    });
    expect(result.decision).toBe("auto_approve");
  });

  describe("double verification (requiredPhotos: 2)", () => {
    it("never auto-approves when the same-person check wasn't evaluated", () => {
      const result = evaluateDecision({
        ...strongInput,
        settings: { ...baseSettings, requiredPhotos: 2 },
        signals: {
          ...strongInput.signals,
          samePersonStatus: "not_evaluated",
          samePersonMatch: null,
        },
      });
      expect(result.decision).toBe("manual_review");
      expect(result.reasonCode).toBe("same_person_unverified");
    });

    it("never auto-approves when the check succeeded but samePerson is somehow null", () => {
      const result = evaluateDecision({
        ...strongInput,
        settings: { ...baseSettings, requiredPhotos: 2 },
        signals: {
          ...strongInput.signals,
          samePersonStatus: "success",
          samePersonMatch: null,
        },
      });
      expect(result.decision).toBe("manual_review");
      expect(result.reasonCode).toBe("same_person_unverified");
    });

    it("routes a confirmed mismatch to STAFF when allowAutomaticDecline is off", () => {
      const result = evaluateDecision({
        ...strongInput,
        settings: { ...baseSettings, requiredPhotos: 2 },
        signals: {
          ...strongInput.signals,
          samePersonStatus: "success",
          samePersonMatch: false,
        },
      });
      expect(result.decision).toBe("manual_review");
      expect(result.reasonCode).toBe(
        "same_person_mismatch_auto_decline_disabled",
      );
    });

    it("auto-declines a confirmed mismatch when allowAutomaticDecline is on", () => {
      const result = evaluateDecision({
        ...strongInput,
        settings: {
          ...baseSettings,
          requiredPhotos: 2,
          allowAutomaticDecline: true,
        },
        signals: {
          ...strongInput.signals,
          samePersonStatus: "success",
          samePersonMatch: false,
        },
      });
      expect(result.decision).toBe("auto_decline");
      expect(result.reasonCode).toBe("same_person_mismatch");
    });

    it("still auto-approves a strong case when the same person IS confirmed", () => {
      const result = evaluateDecision({
        ...strongInput,
        settings: { ...baseSettings, requiredPhotos: 2 },
        signals: {
          ...strongInput.signals,
          samePersonStatus: "success",
          samePersonMatch: true,
          secondGestureStatus: "success",
          secondGesturePresent: true,
          secondGestureDistinct: true,
        },
      });
      expect(result.decision).toBe("auto_approve");
    });

    it("routes to STAFF when photo 2's gesture is confirmed but NOT distinct from photo 1 (shared 'smile' fallback collapse)", () => {
      // Both challenge steps share the "smile" accessibleAlternative, so a client
      // can declare "smile" for both photos and satisfy both with one recycled
      // selfie — collapsing double verification to single-photo strength. Even
      // with same-person + a positively-confirmed second gesture, a non-distinct
      // second gesture must never auto-approve.
      const result = evaluateDecision({
        ...strongInput,
        settings: { ...baseSettings, requiredPhotos: 2 },
        signals: {
          ...strongInput.signals,
          samePersonStatus: "success",
          samePersonMatch: true,
          secondGestureStatus: "success",
          secondGesturePresent: true,
          secondGestureDistinct: false,
        },
      });
      expect(result.decision).toBe("manual_review");
      expect(result.reasonCode).toBe("second_gesture_not_distinct");
    });

    it("does NOT auto-decline the non-distinct collapse even with allowAutomaticDecline on (accessibility: a human decides)", () => {
      const result = evaluateDecision({
        ...strongInput,
        settings: {
          ...baseSettings,
          requiredPhotos: 2,
          allowAutomaticDecline: true,
        },
        signals: {
          ...strongInput.signals,
          samePersonStatus: "success",
          samePersonMatch: true,
          secondGestureStatus: "success",
          secondGesturePresent: true,
          secondGestureDistinct: false,
        },
      });
      expect(result.decision).toBe("manual_review");
    });

    it("never auto-approves when photo 2's gesture was not confirmed, even with same person + strong photo 1", () => {
      const result = evaluateDecision({
        ...strongInput,
        settings: { ...baseSettings, requiredPhotos: 2 },
        signals: {
          ...strongInput.signals,
          samePersonStatus: "success",
          samePersonMatch: true,
          // Same face, but the model was UNCERTAIN whether photo 2 performed
          // its (different) requested gesture — must go to STAFF, never ride
          // through on photo 1's single confirmed gesture.
          secondGestureStatus: "success",
          secondGesturePresent: null,
        },
      });
      expect(result.decision).toBe("manual_review");
      expect(result.reasonCode).toBe("second_gesture_unverified");
    });

    it("skips the same-person gate entirely in single-photo mode, even if unevaluated", () => {
      const result = evaluateDecision({
        ...strongInput,
        settings: { ...baseSettings, requiredPhotos: 1 },
        signals: {
          ...strongInput.signals,
          samePersonStatus: "not_evaluated",
          samePersonMatch: null,
        },
      });
      expect(result.decision).toBe("auto_approve");
    });
  });

  describe("country requirement (allowedCountries)", () => {
    it("never auto-approves when the country wasn't resolved", () => {
      const result = evaluateDecision({
        ...strongInput,
        settings: { ...baseSettings, allowedCountries: ["ES", "PT"] },
        signals: { ...strongInput.signals, countryCode: null },
      });
      expect(result.decision).toBe("manual_review");
      expect(result.reasonCode).toBe("country_unverified");
    });

    it("routes a disallowed country to STAFF when allowAutomaticDecline is off", () => {
      const result = evaluateDecision({
        ...strongInput,
        settings: { ...baseSettings, allowedCountries: ["ES", "PT"] },
        signals: { ...strongInput.signals, countryCode: "US" },
      });
      expect(result.decision).toBe("manual_review");
      expect(result.reasonCode).toBe(
        "country_not_allowed_auto_decline_disabled",
      );
    });

    it("auto-declines a disallowed country when allowAutomaticDecline is on", () => {
      const result = evaluateDecision({
        ...strongInput,
        settings: {
          ...baseSettings,
          allowedCountries: ["ES", "PT"],
          allowAutomaticDecline: true,
        },
        signals: { ...strongInput.signals, countryCode: "US" },
      });
      expect(result.decision).toBe("auto_decline");
      expect(result.reasonCode).toBe("country_not_allowed");
    });

    it("still auto-approves a strong case when the country IS allowed", () => {
      const result = evaluateDecision({
        ...strongInput,
        settings: { ...baseSettings, allowedCountries: ["ES", "PT"] },
        signals: { ...strongInput.signals, countryCode: "ES" },
      });
      expect(result.decision).toBe("auto_approve");
    });

    it("skips the country gate entirely when no restriction is configured, even with no country resolved", () => {
      const result = evaluateDecision({
        ...strongInput,
        settings: { ...baseSettings, allowedCountries: [] },
        signals: { ...strongInput.signals, countryCode: null },
      });
      expect(result.decision).toBe("auto_approve");
    });
  });
});

describe("resolveEffectiveGuardianMode (auto-approval premium gate)", () => {
  it("downgrades AUTO to MANUAL when the group has no active AI pack", () => {
    expect(resolveEffectiveGuardianMode("auto", false)).toBe("manual");
  });

  it("downgrades STRICT to MANUAL when the group has no active AI pack", () => {
    expect(resolveEffectiveGuardianMode("strict", false)).toBe("manual");
  });

  it("keeps AUTO and STRICT when the group holds an AI pack", () => {
    expect(resolveEffectiveGuardianMode("auto", true)).toBe("auto");
    expect(resolveEffectiveGuardianMode("strict", true)).toBe("strict");
  });

  it("never touches MANUAL/ASSISTED/OFF, pack or not (they never auto-approve)", () => {
    for (const pack of [true, false]) {
      expect(resolveEffectiveGuardianMode("manual", pack)).toBe("manual");
      expect(resolveEffectiveGuardianMode("assisted", pack)).toBe("assisted");
      expect(resolveEffectiveGuardianMode("off", pack)).toBe("off");
    }
  });
});

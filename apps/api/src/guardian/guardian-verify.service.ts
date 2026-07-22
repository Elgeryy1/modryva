import { createHash } from "node:crypto";
import {
  type FoundationRepository,
  type GuardianProviderStatusValue,
  type GuardianRepository,
  type GuardianSettingsState,
  type VerificationSessionRecord,
} from "@superbot/data";
import {
  generateObjectKey,
  type ObjectStorageDriver,
} from "@superbot/module-files";
import {
  buildAutoApprovedKeyboard,
  buildManualReviewKeyboard,
  type ChallengeDefinition,
  type DecisionInput,
  decryptJoinRequestQueryId,
  evaluateDecision,
  formatStaffReportText,
  type GestureVisionProvider,
  type GuardianAiProviders,
  resolveStepAction,
  type SubmittedStepResult,
  sniffMimeType,
  validateCapturedMedia,
  verifyChallengeSubmission,
} from "@superbot/module-guardian";
import { createLogger } from "@superbot/shared";
import type {
  TelegramGateway,
  TelegramSendMessageResult,
} from "@superbot/telegram";

const logger = createLogger("guardian-verify");

export interface GuardianVerifyDeps {
  readonly repo: GuardianRepository;
  readonly foundation: FoundationRepository;
  readonly storage: ObjectStorageDriver;
  readonly providers: GuardianAiProviders;
  /** Photo-mode gesture + face + age check (Gemini primary, Groq fallback).
   * Supersedes the video liveness/synthetic providers for the still-photo
   * flow; when unconfigured it returns "unavailable" so AUTO routes to STAFF. */
  readonly gestureVision: GestureVisionProvider;
  readonly gateway: TelegramGateway;
  /** Undefined when GUARDIAN_SESSION_SECRET isn't configured — the service
   * degrades to TECHNICAL_FAILURE for anything that needs it, rather than
   * crashing the whole API at boot (see guardian-verify.factory.ts). */
  readonly sessionSecret: string | undefined;
  /** Optional decrypt-only fallback (env.GUARDIAN_SESSION_SECRET_PREVIOUS) used
   * only during a session-secret rotation window so an in-flight join request's
   * stored query_id stays decryptable across the rotation. */
  readonly sessionSecretPrevious?: string | undefined;
  readonly maxUploadBytes: number;
  /** env.TELEGRAM_BOT_TOKEN — the primary bot's token, passed through to
   * resolveBotTokenForTenant so it has something to fall back to for
   * primary-tenant sessions (a managed/child-bot tenant resolves its own
   * token instead and ignores this). */
  readonly primaryToken: string | undefined;
  /** env.MANAGED_BOT_TOKEN_KEY — decrypts a managed bot's stored token. */
  readonly managedBotTokenKey: string | undefined;
}

export interface SessionView {
  readonly status: string;
  readonly mode: string;
  readonly attemptsRemaining: number;
  readonly maxAttempts: number;
  readonly expiresAtIso: string;
  readonly challenge: {
    readonly steps: readonly {
      kind: string;
      action: string;
      timeLimitMs: number;
      accessibleAlternative: string;
    }[];
    readonly revealStepsAhead: boolean;
    readonly totalTimeLimitMs: number;
    readonly nonce: string;
  };
}

export interface SubmitAttemptInput {
  readonly attemptId: string;
  readonly mediaBase64: string;
  readonly declaredMimeType: string;
  readonly durationMs?: number;
  readonly width?: number;
  readonly height?: number;
  readonly clientFaceCount?: number;
  readonly clientQualityScore?: number;
  readonly challengeNonce: string;
  readonly stepResults: readonly SubmittedStepResult[];
  readonly sessionStartedAtMs: number;
  /** Age the user typed in the Mini App before the photo. STAFF-facing +
   * audit only — it is NEVER fed to the decision engine as an approve signal. */
  readonly declaredAge?: number;
  /** Second photo, present only when settings.requiredPhotos is 2 — a
   * different gesture than the first (see challenge.ts), AI-compared against
   * the first photo to confirm it's the same person (never silently
   * skipped — see decision-engine.ts's same-person gate). */
  readonly secondMediaBase64?: string;
  readonly secondDeclaredMimeType?: string;
}

export type SubmitAttemptResult =
  | {
      readonly outcome: "retry";
      readonly reasonCode: string;
      readonly attemptsRemaining: number;
    }
  | {
      readonly outcome: "resolved";
      readonly decision: string;
      readonly reasonCode: string;
    };

const MAX_UPLOAD_BASE64_SLACK = 1.4; // base64 inflates ~33%; leave headroom.

/** Extra, non-decision data carried from a successful capture into the STAFF
 * report: the user's self-declared age and the photo itself. Only present on
 * the real capture path — technical-failure paths send a text-only report. */
interface StaffReportExtras {
  readonly declaredAge?: number;
  readonly photo?: { readonly base64: string; readonly mimeType: string };
  /** The double-verification second photo — sent as its own follow-up
   * message so STAFF can see BOTH, since Telegram's sendPhoto only ever
   * attaches one image per message (rule: every photo actually submitted
   * must reach STAFF, not just the first). */
  readonly secondPhoto?: { readonly base64: string; readonly mimeType: string };
}

export class GuardianVerifyService {
  constructor(private readonly deps: GuardianVerifyDeps) {}

  buildSessionView(
    session: VerificationSessionRecord,
    settings: GuardianSettingsState,
  ): SessionView {
    const challenge =
      session.challengeDefinition as unknown as ChallengeDefinition;
    return {
      status: session.status,
      mode: session.mode,
      attemptsRemaining: Math.max(
        0,
        settings.maxAttempts - session.attemptCount,
      ),
      maxAttempts: settings.maxAttempts,
      expiresAtIso: session.expiresAt.toISOString(),
      challenge: {
        steps: challenge.steps.map((s) => ({
          kind: s.kind,
          action: s.action,
          timeLimitMs: s.timeLimitMs,
          accessibleAlternative: s.accessibleAlternative,
        })),
        revealStepsAhead: challenge.revealStepsAhead,
        totalTimeLimitMs: challenge.totalTimeLimitMs,
        nonce: challenge.nonce,
      },
    };
  }

  async beginAttempt(
    session: VerificationSessionRecord,
    settings: GuardianSettingsState,
  ): Promise<
    { attemptId: string } | { error: "no-attempts-left" | "conflict" }
  > {
    if (session.attemptCount >= settings.maxAttempts) {
      return { error: "no-attempts-left" };
    }
    const updated = await this.deps.repo.beginAttempt(
      session.id,
      session.version,
    );
    if (!updated) {
      return { error: "conflict" };
    }
    const attempt = await this.deps.repo.createAttempt({
      sessionId: session.id,
      attemptNumber: updated.attemptCount,
      captureType: "video",
    });
    return { attemptId: attempt.id };
  }

  async submitAttempt(
    session: VerificationSessionRecord,
    settings: GuardianSettingsState,
    input: SubmitAttemptInput,
  ): Promise<SubmitAttemptResult> {
    const attemptsRemaining = Math.max(
      0,
      settings.maxAttempts - session.attemptCount,
    );

    if (!this.deps.sessionSecret) {
      // Cannot safely decrypt the join request query_id or sign STAFF
      // callbacks without it — fail closed as a technical failure rather
      // than guessing. Never falls through to auto-approve.
      return this.resolveWithDecision(session, settings, {
        settings: this.toDecisionSettings(settings, session.mode),
        attemptsRemaining,
        integrityViolation: null,
        pipelineError: true,
        signals: this.emptySignals(false, session.countryCode),
      });
    }

    const bytes = Buffer.from(input.mediaBase64, "base64");
    if (bytes.length > this.deps.maxUploadBytes * MAX_UPLOAD_BASE64_SLACK) {
      return this.finishAsRetryOrDecline(
        session,
        settings,
        attemptsRemaining,
        "upload-too-large",
        ["upload-too-large"],
      );
    }

    const sniffed = sniffMimeType(bytes);
    const mimeType = sniffed ?? input.declaredMimeType;
    const mismatchedMime =
      sniffed !== null && sniffed !== input.declaredMimeType;

    const mediaValidation = validateCapturedMedia({
      mimeType,
      sizeBytes: bytes.length,
      ...(input.durationMs !== undefined
        ? { durationMs: input.durationMs }
        : {}),
      ...(input.width !== undefined ? { width: input.width } : {}),
      ...(input.height !== undefined ? { height: input.height } : {}),
    });

    if (!sniffed || !mediaValidation.ok) {
      await this.deps.repo.finishAttempt(input.attemptId, {
        analysisStatus: "failed",
        failureReason: !sniffed
          ? "unrecognized-format"
          : mediaValidation.ok
            ? ""
            : mediaValidation.reason,
      });
      if (attemptsRemaining > 0) {
        return {
          outcome: "retry",
          reasonCode: !sniffed ? "unrecognized-format" : "media-invalid",
          attemptsRemaining,
        };
      }
      return this.resolveWithDecision(session, settings, {
        settings: this.toDecisionSettings(settings, session.mode),
        attemptsRemaining: 0,
        integrityViolation: null,
        pipelineError: false,
        signals: this.emptySignals(false, session.countryCode),
      });
    }

    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const existingBySha = await this.deps.repo.findMediaBySha256(sha256);
    const reusedByOther = existingBySha.some((m) => m.sessionId !== session.id);

    const challenge =
      session.challengeDefinition as unknown as ChallengeDefinition;
    const challengeVerification = verifyChallengeSubmission(
      challenge,
      input.challengeNonce,
      input.stepResults,
      input.sessionStartedAtMs,
    );
    const nonceTampered =
      !challengeVerification.ok &&
      challengeVerification.reason === "nonce-mismatch";

    const objectKey = generateObjectKey(
      `guardian/${session.chatId}`,
      this.extFor(mimeType),
    );
    await this.deps.storage.put({
      key: objectKey,
      data: bytes,
      contentType: mimeType,
    });
    const deleteAfter = new Date(
      Date.now() + settings.mediaRetentionHours * 60 * 60 * 1000,
    );
    await this.deps.repo.createMedia({
      sessionId: session.id,
      attemptId: input.attemptId,
      objectStorageKey: objectKey,
      mimeDetected: mimeType,
      mimeDeclared: input.declaredMimeType,
      sizeBytes: bytes.length,
      sha256,
      deleteAfter,
      ...(input.durationMs !== undefined
        ? { durationMs: input.durationMs }
        : {}),
      ...(input.width !== undefined ? { width: input.width } : {}),
      ...(input.height !== undefined ? { height: input.height } : {}),
    });

    const mediaRef = { filePath: objectKey, mimeType };
    // Ask the vision AI to verify whatever the user actually attempted for
    // that step — if they used the step's accessibleAlternative (e.g.
    // "smile" for someone who can't perform a hand gesture), the prompt must
    // request THAT, not the original hand gesture, or an honest
    // accessible-alternative submission gets judged against a gesture the
    // photo was never meant to show. resolveStepAction only ever returns one
    // of the step's two server-known actions, never an arbitrary client
    // string, so this introduces no new prompt-injection surface.
    const handStepIndex = challenge.steps.findIndex((s) => s.kind === "hand");
    const requestedStepIndex = handStepIndex >= 0 ? handStepIndex : 0;
    const requestedStep = challenge.steps[requestedStepIndex];
    const requestedGesture = requestedStep
      ? resolveStepAction(
          requestedStep,
          input.stepResults[requestedStepIndex]?.action,
        )
      : "";

    // ONE multimodal vision call (Gemini primary, Groq fallback) judges the
    // gesture, whether this is a real live person, and the person's age from
    // the single photo — alongside a cheap provenance byte-scan. When the
    // vision call is unavailable its status is NOT "success", so every derived
    // score stays null and AUTO/STRICT cannot approve (routes to STAFF) — never
    // a fabricated pass. The client's own claims are stored as `clientEvidence`
    // only, never used as the decision signal.
    const [vision, provenance] = await Promise.all([
      this.deps.gestureVision.analyze(mediaRef, { requestedGesture }),
      this.deps.providers.provenance.inspectProvenance(mediaRef),
    ]);

    const faceCount = vision.personCount;
    const qualityScore = vision.qualityScore;
    // Gesture score is the AI's confidence when the requested gesture is
    // present, 0 when clearly absent, null when not evaluated.
    const gestureScore =
      vision.gesturePresent === null
        ? null
        : vision.gesturePresent
          ? (vision.gestureConfidence ?? 1)
          : 0;
    // "A real, present, live person" IS the liveness signal here; spoofRisk is
    // the screen/printout/photo-of-a-photo replay risk. Photo 2 (double
    // verification) goes through the exact same derivation below and gets
    // combined via worst-case — a screen/photo-of-a-photo on EITHER photo
    // must trip the same spoofing_risk_too_high gate, not just photo 1's.
    let livenessScore = this.deriveLivenessScore(vision);
    let syntheticMediaRisk = this.deriveSyntheticRisk(vision);

    const hardFailures: string[] = [];
    if (mismatchedMime) hardFailures.push("mime-mismatch");

    // Double verification (requiredPhotos: 2): a SECOND photo, requested with
    // a different gesture (see challenge.ts), cross-checked against the first
    // to confirm it's the same person. samePersonStatus/samePersonMatch stay
    // at their "not evaluated" default (never a fabricated match) unless this
    // actually runs — decision-engine.ts's gate then refuses to auto-approve
    // without a real answer.
    let samePersonStatus: GuardianProviderStatusValue = "not_evaluated";
    let samePersonMatch: boolean | null = null;
    // The second photo's OWN gesture result (double verification). Kept as a
    // typed pair — not read off the `unknown` secondVisionReport below — so the
    // decision engine's second-gesture gate can require it was positively
    // confirmed, mirroring photo 1.
    let secondGestureStatus: GuardianProviderStatusValue = "not_evaluated";
    let secondGesturePresent: boolean | null = null;
    let secondVisionReport: unknown = null;
    let faceMatchReport: unknown = null;
    let secondMimeType: string | null = null;
    const secondStep = challenge.steps[1];
    const secondGesture = secondStep
      ? resolveStepAction(secondStep, input.stepResults[1]?.action)
      : undefined;

    if (
      settings.requiredPhotos === 2 &&
      input.secondMediaBase64 &&
      secondGesture
    ) {
      const secondBytes = Buffer.from(input.secondMediaBase64, "base64");
      // Mirror photo 1's gate (raw-size cap, then the shared media policy:
      // size/mime-allowlist/duration/resolution) — previously the second
      // photo only got a format sniff, so an oversized or policy-violating
      // second photo was still stored and sent to the vision AI.
      const secondTooLarge =
        secondBytes.length > this.deps.maxUploadBytes * MAX_UPLOAD_BASE64_SLACK;
      const secondSniffed = secondTooLarge ? null : sniffMimeType(secondBytes);
      const secondMediaValidation = secondSniffed
        ? validateCapturedMedia({
            mimeType: secondSniffed,
            sizeBytes: secondBytes.length,
          })
        : null;
      if (secondTooLarge) {
        hardFailures.push("second-photo-upload-too-large");
      } else if (!secondSniffed) {
        hardFailures.push("second-photo-unrecognized-format");
      } else if (secondMediaValidation && !secondMediaValidation.ok) {
        hardFailures.push(`second-photo-${secondMediaValidation.reason}`);
      } else {
        secondMimeType = secondSniffed;
        const secondObjectKey = generateObjectKey(
          `guardian/${session.chatId}`,
          this.extFor(secondSniffed),
        );
        await this.deps.storage.put({
          key: secondObjectKey,
          data: secondBytes,
          contentType: secondSniffed,
        });
        await this.deps.repo.createMedia({
          sessionId: session.id,
          attemptId: input.attemptId,
          objectStorageKey: secondObjectKey,
          mimeDetected: secondSniffed,
          mimeDeclared: input.secondDeclaredMimeType ?? secondSniffed,
          sizeBytes: secondBytes.length,
          sha256: createHash("sha256").update(secondBytes).digest("hex"),
          deleteAfter,
        });
        const secondMediaRef = {
          filePath: secondObjectKey,
          mimeType: secondSniffed,
        };
        const [vision2, faceMatch] = await Promise.all([
          this.deps.gestureVision.analyze(secondMediaRef, {
            requestedGesture: secondGesture,
          }),
          this.deps.gestureVision.compareFaces(mediaRef, secondMediaRef),
        ]);
        secondVisionReport = vision2;
        secondGestureStatus = vision2.status;
        secondGesturePresent = vision2.gesturePresent;
        faceMatchReport = faceMatch;
        // A clear "gesture not shown" on the second photo is as much a hard
        // failure as it would be on the first (rule: both photos must be
        // real, checked captures — a stolen/reused first photo paired with a
        // throwaway second photo must not slip through on photo 1 alone).
        if (vision2.gesturePresent === false) {
          hardFailures.push("second-gesture-not-shown");
        }
        // Same-person compareFaces only judges identity, not liveness — a
        // photo held up to a screen of the SAME real person would still
        // "match". Fold photo 2's own spoof signals in via worst-case so a
        // screen/photo-of-a-photo on EITHER photo trips spoofing_risk_too_high,
        // not just photo 1's.
        const livenessScore2 = this.deriveLivenessScore(vision2);
        const syntheticMediaRisk2 = this.deriveSyntheticRisk(vision2);
        if (livenessScore !== null && livenessScore2 !== null) {
          livenessScore = Math.min(livenessScore, livenessScore2);
        } else if (livenessScore2 !== null) {
          livenessScore = livenessScore2;
        }
        if (syntheticMediaRisk !== null && syntheticMediaRisk2 !== null) {
          syntheticMediaRisk = Math.max(
            syntheticMediaRisk,
            syntheticMediaRisk2,
          );
        } else if (syntheticMediaRisk2 !== null) {
          syntheticMediaRisk = syntheticMediaRisk2;
        }
        samePersonStatus = faceMatch.status;
        samePersonMatch = faceMatch.samePerson;
      }
    }

    await this.deps.repo.finishAttempt(input.attemptId, {
      analysisStatus: challengeVerification.ok ? "success" : "uncertain",
      clientEvidence: {
        faceCount: input.clientFaceCount,
        qualityScore: input.clientQualityScore,
        ...(input.declaredAge !== undefined
          ? { declaredAge: input.declaredAge }
          : {}),
      },
    });

    await this.deps.repo.upsertAnalysis({
      attemptId: input.attemptId,
      ...(faceCount !== null ? { faceCount } : {}),
      ...(gestureScore !== null ? { gestureScore } : {}),
      ...(qualityScore !== null ? { qualityScore } : {}),
      gestureRequested: requestedGesture,
      ...(vision.gesturePresent ? { gestureDetected: requestedGesture } : {}),
      blinkRequested: false,
      livenessStatus: vision.status,
      ...(livenessScore !== null ? { livenessScore } : {}),
      ...(vision.spoofRisk !== null ? { replayRisk: vision.spoofRisk } : {}),
      syntheticStatus: vision.status,
      ...(syntheticMediaRisk !== null ? { syntheticMediaRisk } : {}),
      ...(vision.estimatedAgeMin !== null
        ? { estimatedAgeMin: vision.estimatedAgeMin }
        : {}),
      ...(vision.estimatedAgeMax !== null
        ? { estimatedAgeMax: vision.estimatedAgeMax }
        : {}),
      ageStatus: vision.status,
      provenanceStatus: provenance.provenanceStatus,
      hardFailures,
      warnings: [...vision.warnings, ...provenance.warnings],
      modelVersions: {
        vision: `${vision.modelName}@${vision.modelVersion}`,
        ...(vision.provider ? { visionProvider: vision.provider } : {}),
        provenance: `${provenance.modelName}@${provenance.modelVersion}`,
      },
      rawTechnicalReport: {
        vision,
        provenance,
        ...(secondVisionReport ? { vision2: secondVisionReport } : {}),
        ...(faceMatchReport ? { faceMatch: faceMatchReport } : {}),
      },
    });

    const decisionInput: DecisionInput = {
      settings: this.toDecisionSettings(settings, session.mode),
      attemptsRemaining,
      integrityViolation: nonceTampered
        ? "token-reused"
        : reusedByOther
          ? "media-hash-reused-by-other-user"
          : null,
      pipelineError: false,
      signals: {
        faceCount,
        challengeCompleted: challengeVerification.ok,
        gestureScore,
        qualityScore,
        livenessScore,
        livenessStatus: vision.status,
        replayRisk: vision.spoofRisk,
        syntheticMediaRisk,
        syntheticStatus: vision.status,
        provenanceStatus: provenance.provenanceStatus,
        estimatedAgeMin: vision.estimatedAgeMin,
        estimatedAgeMax: vision.estimatedAgeMax,
        ageStatus: vision.status,
        samePersonStatus,
        samePersonMatch,
        secondGestureStatus,
        secondGesturePresent,
        // Whether photo 2 was asked for a genuinely different gesture than photo
        // 1. Both challenge steps share the "smile" accessibleAlternative, so a
        // client that declares "smile" for both makes resolveStepAction return
        // "smile" for both — one recycled selfie then satisfies both photos. Only
        // meaningful in double verification; the decision engine's second-gesture
        // gate routes this collapse to STAFF instead of auto-approving.
        secondGestureDistinct:
          settings.requiredPhotos === 2
            ? secondGesture !== undefined && secondGesture !== requestedGesture
            : null,
        countryCode: session.countryCode,
        hardFailures,
      },
    };

    return this.resolveWithDecision(session, settings, decisionInput, {
      ...(input.declaredAge !== undefined
        ? { declaredAge: input.declaredAge }
        : {}),
      photo: { base64: input.mediaBase64, mimeType },
      ...(input.secondMediaBase64 && secondMimeType
        ? {
            secondPhoto: {
              base64: input.secondMediaBase64,
              mimeType: secondMimeType,
            },
          }
        : {}),
    });
  }

  /** "A real, present, live person" IS the liveness signal here — spoofRisk
   * is the screen/printout/photo-of-a-photo replay risk the vision AI was
   * explicitly asked to judge (see providers.ts's gesture prompt). Shared by
   * both photos so a screen-photo trips the same gate regardless of which
   * one it was submitted as. */
  private deriveLivenessScore(vision: {
    realPerson: boolean | null;
    spoofRisk: number | null;
  }): number | null {
    if (vision.realPerson === null) return null;
    return vision.realPerson
      ? Math.min(0.95, 1 - (vision.spoofRisk ?? 0))
      : 0.1;
  }

  private deriveSyntheticRisk(vision: {
    realPerson: boolean | null;
    spoofRisk: number | null;
  }): number | null {
    if (vision.realPerson === null) return null;
    return vision.realPerson
      ? (vision.spoofRisk ?? 0)
      : Math.max(vision.spoofRisk ?? 0, 0.8);
  }

  private emptySignals(completed: boolean, countryCode: string | null = null) {
    return {
      faceCount: null,
      challengeCompleted: completed,
      gestureScore: null,
      qualityScore: null,
      livenessScore: null,
      livenessStatus: "not_evaluated" as const,
      replayRisk: null,
      syntheticMediaRisk: null,
      syntheticStatus: "not_evaluated" as const,
      provenanceStatus: null,
      estimatedAgeMin: null,
      estimatedAgeMax: null,
      ageStatus: "not_evaluated" as const,
      samePersonStatus: "not_evaluated" as const,
      samePersonMatch: null,
      secondGestureStatus: "not_evaluated" as const,
      secondGesturePresent: null,
      secondGestureDistinct: null,
      countryCode,
      hardFailures: [],
    };
  }

  // `mode` is taken from the SESSION (its point-in-time snapshot), not the
  // freshly-loaded settings: the bot may have downgraded auto/strict to manual
  // at session start when the chat had no active AI pack (premium gate), and a
  // mid-flow config change must not reinterpret an in-flight verification.
  private toDecisionSettings(
    settings: GuardianSettingsState,
    mode: GuardianSettingsState["mode"],
  ) {
    return {
      mode,
      autoApproveThreshold: settings.autoApproveThreshold,
      manualReviewThreshold: settings.manualReviewThreshold,
      livenessMinimum: settings.livenessMinimum,
      gestureMinimum: settings.gestureMinimum,
      replayRiskMaximum: settings.replayRiskMaximum,
      syntheticRiskMaximum: settings.syntheticRiskMaximum,
      requireSingleFace: settings.requireSingleFace,
      allowAutomaticDecline: settings.allowAutomaticDecline,
      minimumAge: settings.minimumAge,
      maximumAge: settings.maximumAge,
      requiredPhotos: settings.requiredPhotos,
      allowedCountries: settings.allowedCountries,
    };
  }

  private mediaTypeFor(mimeType: string): "png" | "webp" | "jpg" {
    if (mimeType === "image/png") return "png";
    if (mimeType === "image/webp") return "webp";
    return "jpg";
  }

  private extFor(mimeType: string): string {
    if (mimeType === "video/mp4") return "mp4";
    if (mimeType === "video/webm") return "webm";
    if (mimeType === "image/png") return "png";
    if (mimeType === "image/webp") return "webp";
    return "jpg";
  }

  private async finishAsRetryOrDecline(
    session: VerificationSessionRecord,
    settings: GuardianSettingsState,
    attemptsRemaining: number,
    reasonCode: string,
    hardFailures: readonly string[],
  ): Promise<SubmitAttemptResult> {
    if (attemptsRemaining > 0) {
      return { outcome: "retry", reasonCode, attemptsRemaining };
    }
    return this.resolveWithDecision(session, settings, {
      settings: this.toDecisionSettings(settings, session.mode),
      attemptsRemaining: 0,
      integrityViolation: null,
      pipelineError: false,
      signals: {
        ...this.emptySignals(false, session.countryCode),
        hardFailures,
      },
    });
  }

  private async resolveWithDecision(
    session: VerificationSessionRecord,
    settings: GuardianSettingsState,
    decisionInput: DecisionInput,
    reportExtras?: StaffReportExtras,
  ): Promise<SubmitAttemptResult> {
    const result = evaluateDecision(decisionInput);

    if (result.decision === "retry") {
      return {
        outcome: "retry",
        reasonCode: result.reasonCode,
        attemptsRemaining: decisionInput.attemptsRemaining,
      };
    }

    const botToken = await this.deps.repo.resolveBotTokenForTenant(
      session.tenantId,
      this.deps.primaryToken,
      this.deps.managedBotTokenKey,
    );

    await this.answerTelegram(session, result.decision, botToken);

    const now = new Date();
    const resolved = await this.deps.repo.resolveSession(
      session.id,
      session.version,
      {
        status: "resolved",
        decision: result.decision,
        decisionReason: result.reasonCode,
        decisionPayload: result.explanation as unknown as Record<
          string,
          unknown
        >,
        resolvedAt: now,
        completedAt: now,
        clearIdempotencyKey: true,
        clearQueryId: true,
      },
    );

    if (resolved) {
      await this.sendStaffReport(
        resolved,
        settings,
        result.decision,
        result.reasonCode,
        decisionInput.signals,
        reportExtras,
      );
    }

    return {
      outcome: "resolved",
      decision: result.decision,
      reasonCode: result.reasonCode,
    };
  }

  private async answerTelegram(
    session: VerificationSessionRecord,
    decision: string,
    botToken: string | undefined,
  ): Promise<void> {
    if (!botToken) {
      return;
    }
    const result =
      decision === "auto_approve"
        ? "approve"
        : decision === "auto_decline"
          ? "decline"
          : "queue";

    // Step 1 — answer the Mini App's OWN query. This needs the one-shot
    // `query_id`, which is cleared right after the first answer (see
    // resolveSession `clearQueryId`). A retry that reaches a later decision no
    // longer has it — that is expected and must NOT block the admission below.
    if (session.joinRequestQueryIdEncrypted && this.deps.sessionSecret) {
      const decrypted = decryptJoinRequestQueryId(
        session.joinRequestQueryIdEncrypted,
        this.deps.sessionSecret,
        this.deps.sessionSecretPrevious,
      );
      if (decrypted.ok) {
        try {
          await this.deps.gateway.answerChatJoinRequestQuery({
            chatJoinRequestQueryId: decrypted.queryId,
            result,
            token: botToken,
          });
        } catch (error) {
          logger.warn(
            { err: error, sessionId: session.id },
            "guardian: answerChatJoinRequestQuery failed",
          );
        }
      }
    }

    // Step 2 — the ACTUAL admission/rejection of the pending chat_join_request.
    // Only chat_id + user_id are needed (NO query_id), so this MUST run for every
    // approve/decline — including a retry whose query_id was already consumed.
    // BUG THIS FIXES: this block used to sit behind the `query_id` guard above,
    // so a `retry -> auto_approve` recorded "approved" yet never admitted the
    // person (they stayed outside the group). A failure here is now logged
    // loudly instead of swallowed, so a silent Telegram rejection is diagnosable.
    try {
      if (result === "approve") {
        await this.deps.gateway.approveChatJoinRequest({
          chatId: session.telegramChatId,
          userId: session.telegramUserId,
          token: botToken,
        });
      } else if (result === "decline") {
        await this.deps.gateway.declineChatJoinRequest({
          chatId: session.telegramChatId,
          userId: session.telegramUserId,
          token: botToken,
        });
      }
    } catch (error) {
      logger.error(
        {
          err: error,
          sessionId: session.id,
          telegramChatId: session.telegramChatId.toString(),
          telegramUserId: session.telegramUserId.toString(),
          result,
        },
        "guardian: chat_join_request admission failed — person NOT admitted/rejected",
      );
    }
  }

  private async sendStaffReport(
    session: VerificationSessionRecord,
    settings: GuardianSettingsState,
    decision: string,
    reasonCode: string,
    signals: DecisionInput["signals"],
    reportExtras?: StaffReportExtras,
  ): Promise<void> {
    if (!settings.staffChatId || !this.deps.sessionSecret) {
      return;
    }
    const sessionSecret = this.deps.sessionSecret;
    const botToken = await this.deps.repo.resolveBotTokenForTenant(
      session.tenantId,
      this.deps.primaryToken,
      this.deps.managedBotTokenKey,
    );
    if (!botToken) {
      return;
    }

    const chat = await this.deps.foundation.findChatByTelegramId(
      session.tenantId,
      session.telegramChatId,
    );

    const status =
      decision === "auto_approve"
        ? "approved_auto"
        : decision === "auto_decline"
          ? "declined"
          : decision === "technical_failure"
            ? "technical_failure"
            : "queued";

    const challenge =
      session.challengeDefinition as unknown as ChallengeDefinition;

    const estimatedAge =
      signals.ageStatus === "success" &&
      signals.estimatedAgeMin !== null &&
      signals.estimatedAgeMax !== null
        ? `${signals.estimatedAgeMin}-${signals.estimatedAgeMax} años (estimado)`
        : null;

    const text = formatStaffReportText({
      sessionShortId: `VER-${session.id.slice(-8).toUpperCase()}`,
      status,
      displayName:
        [session.firstName, session.lastName].filter(Boolean).join(" ") ||
        session.username ||
        session.telegramUserId.toString(),
      username: session.username,
      telegramUserId: session.telegramUserId,
      groupTitle: chat?.title ?? "(grupo)",
      attemptNumber: session.attemptCount,
      maxAttempts: settings.maxAttempts,
      challengeSteps: challenge.steps.map((s) => s.action),
      reasonCode,
      estimatedAge,
      countryCode: session.countryCode,
      file: null,
      ...(reportExtras?.declaredAge !== undefined
        ? { declaredAge: reportExtras.declaredAge }
        : {}),
    });

    const keyboard =
      status === "approved_auto"
        ? buildAutoApprovedKeyboard(session.id, sessionSecret)
        : status === "queued"
          ? buildManualReviewKeyboard(session.id, sessionSecret, {
              telegramUserId: session.telegramUserId,
              username: session.username,
            })
          : undefined;

    // The captured photo is sent AS the report (caption = report text) ONLY
    // when we have a real image; a video capture or a failed photo upload
    // (Telegram's photo size/dimension limits) falls back to a text-only
    // message so the report ALWAYS reaches STAFF (rule: every resolved case
    // reaches STAFF). Telegram caps photo captions at 1024 chars, so we
    // truncate defensively; the full detail is still one tap away via the
    // "Informe técnico" button.
    const staffChatId = settings.staffChatId;
    const photo =
      reportExtras?.photo && reportExtras.photo.mimeType.startsWith("image/")
        ? reportExtras.photo
        : undefined;
    const caption = text.length > 1024 ? `${text.slice(0, 1023)}…` : text;

    const sendText = (): Promise<TelegramSendMessageResult> =>
      this.deps.gateway.sendMessage({
        chatId: staffChatId,
        token: botToken,
        reply: {
          text,
          ...(keyboard ? { replyMarkup: keyboard } : {}),
        },
      });

    try {
      let sent: TelegramSendMessageResult;
      if (photo) {
        try {
          sent = await this.deps.gateway.sendPhoto({
            chatId: staffChatId,
            token: botToken,
            imageBase64: photo.base64,
            type: this.mediaTypeFor(photo.mimeType),
            caption,
            protectContent: settings.protectStaffContent,
            ...(keyboard ? { replyMarkup: keyboard } : {}),
          });
        } catch {
          // Photo upload failed — never let a resolved case go unreported.
          sent = await sendText();
        }
      } else {
        sent = await sendText();
      }
      // Records WHICH chat/message this was AND stamps the report's own
      // retention deadline, so processGuardianStaffMessageRetention is driven
      // by the SESSION (every reported case, media or not) rather than by the
      // media table's mutable cursor — which could otherwise orphan the photo
      // in the STAFF chat forever once the media row is marked deleted.
      if (sent.messageId !== undefined) {
        await this.deps.repo.resolveSession(session.id, session.version, {
          status: session.status,
          staffChatId,
          staffReportMessageId: sent.messageId,
          staffReportDeleteAfter: new Date(
            Date.now() + settings.mediaRetentionHours * 60 * 60 * 1000,
          ),
        });
      }
      // Double verification: the second photo is a separate Telegram message
      // (sendPhoto attaches only one image) — no keyboard here, the buttons
      // stay on the first message so STAFF only ever sees one set to act on.
      const secondPhoto =
        reportExtras?.secondPhoto &&
        reportExtras.secondPhoto.mimeType.startsWith("image/")
          ? reportExtras.secondPhoto
          : undefined;
      if (secondPhoto) {
        await this.deps.gateway.sendPhoto({
          chatId: staffChatId,
          token: botToken,
          imageBase64: secondPhoto.base64,
          type: this.mediaTypeFor(secondPhoto.mimeType),
          caption: "📸 Segunda foto (doble verificación)",
          protectContent: settings.protectStaffContent,
        });
      }
    } catch (error) {
      // TODO: route through JobOutbox for retry-with-backoff (rule 18). Never
      // rethrow — a STAFF-delivery failure must not fail the user's own
      // resolved verification — but it must not vanish silently either, or
      // "every resolved case reaches STAFF" quietly stops being true.
      logger.error(
        { err: error, sessionId: session.id, staffChatId },
        "guardian staff report delivery failed",
      );
    }
  }
}

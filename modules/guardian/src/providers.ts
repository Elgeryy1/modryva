import type {
  GuardianProvenanceStatusValue,
  GuardianProviderStatusValue,
} from "@superbot/data";

/**
 * Pluggable AI provider interfaces for Guardian Verification's server-side
 * analysis. Every provider returns a `status` alongside its score — a
 * `not_evaluated`/`unavailable`/`failed`/`uncertain` status means the score
 * (if present at all) MUST be ignored by the decision engine. This module
 * never fabricates a passing score for a provider that isn't really wired up.
 *
 * The default exports here (`NotConfiguredLivenessProvider`, etc.) are the
 * SAFE FALLBACK used until a real model is configured — see
 * docs/GUARDIAN_TELEGRAM_TEST.md and the final report for what is actually
 * wired vs. prepared-via-interface-only.
 */

export interface ProviderResultBase {
  readonly status: GuardianProviderStatusValue;
  readonly warnings: readonly string[];
  readonly modelName: string;
  readonly modelVersion: string;
}

export interface MediaRef {
  readonly filePath: string;
  readonly mimeType: string;
}

/** One challenge step as the analyzer needs to see it — kept structurally
 * compatible with (but independent of) modules/guardian/src/challenge.ts's
 * ChallengeStep so this module has no hard dependency on it. */
export interface LivenessChallengeStep {
  readonly kind: "face" | "hand";
  readonly action: string;
  readonly timeLimitMs: number;
}

export interface LivenessDeclaredStepResult {
  readonly action: string;
  readonly detectedAt: number;
}

/** What a real visual analyzer needs to independently re-derive the same
 * signals the client claims — the server-generated challenge plus the
 * client's declared (untrusted) timestamps, so the analyzer can compare its
 * own re-derived results against what was claimed (rule: server must compare
 * server-generated challenge vs client-declared timestamps vs server-derived
 * video results). */
export interface LivenessAnalysisContext {
  readonly steps: readonly LivenessChallengeStep[];
  readonly declaredStepResults: readonly LivenessDeclaredStepResult[];
  readonly sessionStartedAtMs: number;
}

export interface LivenessStepAnalysis {
  readonly action: string;
  readonly kind: "face" | "hand";
  readonly declaredDetectedAtMs: number | null;
  readonly matched: boolean;
  readonly timingDiscrepancyMs: number | null;
}

export interface LivenessResult extends ProviderResultBase {
  readonly livenessScore?: number;
  readonly replayRisk?: number;
  readonly screenReplayRisk?: number;
  // Populated by a real visual-analyzer-backed implementation (see
  // HttpVisualAnalyzerProvider below) — absent when not evaluated.
  readonly faceCount?: number;
  readonly faceConfidence?: number;
  readonly qualityScore?: number;
  readonly lightingScore?: number;
  readonly staticVideoSuspected?: boolean;
  readonly sequenceOk?: boolean;
  readonly perStep?: readonly LivenessStepAnalysis[];
  readonly durationMs?: number;
  readonly sha256?: string;
}

export interface LivenessProvider {
  readonly modelName: string;
  readonly modelVersion: string;
  estimateLiveness(
    media: MediaRef,
    context: LivenessAnalysisContext,
  ): Promise<LivenessResult>;
}

export interface AgeResult extends ProviderResultBase {
  readonly estimatedAgeMin?: number;
  readonly estimatedAgeMax?: number;
  readonly ageConfidence?: number;
}

export interface AgeEstimatorProvider {
  readonly modelName: string;
  readonly modelVersion: string;
  estimateAge(media: MediaRef): Promise<AgeResult>;
}

export interface SyntheticMediaResult extends ProviderResultBase {
  readonly syntheticMediaRisk?: number;
}

export interface SyntheticMediaDetectorProvider {
  readonly modelName: string;
  readonly modelVersion: string;
  estimateSyntheticRisk(media: MediaRef): Promise<SyntheticMediaResult>;
}

export interface ProvenanceResult extends ProviderResultBase {
  readonly provenanceStatus: GuardianProvenanceStatusValue;
}

export interface ProvenanceProvider {
  readonly modelName: string;
  readonly modelVersion: string;
  inspectProvenance(media: MediaRef): Promise<ProvenanceResult>;
}

const notConfigured = (
  modelName: string,
): Pick<
  ProviderResultBase,
  "status" | "warnings" | "modelName" | "modelVersion"
> => ({
  status: "not_evaluated",
  warnings: ["no-provider-configured"],
  modelName,
  modelVersion: "0",
});

/** Honest default: no liveness model wired. Never fabricates a score. */
export class NotConfiguredLivenessProvider implements LivenessProvider {
  readonly modelName = "none";
  readonly modelVersion = "0";

  async estimateLiveness(
    _media: MediaRef,
    _context: LivenessAnalysisContext,
  ): Promise<LivenessResult> {
    return notConfigured("none");
  }
}

/** Honest default: no age model wired. Never fabricates a score. */
export class NotConfiguredAgeEstimatorProvider implements AgeEstimatorProvider {
  readonly modelName = "none";
  readonly modelVersion = "0";

  async estimateAge(_media: MediaRef): Promise<AgeResult> {
    return notConfigured("none");
  }
}

/** Honest default: no synthetic-media detector wired. Never fabricates a score. */
export class NotConfiguredSyntheticMediaDetectorProvider
  implements SyntheticMediaDetectorProvider
{
  readonly modelName = "none";
  readonly modelVersion = "0";

  async estimateSyntheticRisk(_media: MediaRef): Promise<SyntheticMediaResult> {
    return notConfigured("none");
  }
}

// --- Provenance: a real (if limited) implementation ---
//
// Full C2PA signature verification needs a maintained verifying library with
// native bindings that may not be available in every deployment target. What
// IS safe to implement without one is byte-level detection of an embedded
// JUMBF/C2PA manifest box — enough to distinguish "no manifest present" from
// "a manifest exists but we cannot cryptographically verify it here". This
// module NEVER returns c2pa_valid_* without running real signature
// verification — claiming "valid" without checking the signature would be
// exactly the kind of fabrication rule 7 forbids.

const C2PA_JUMBF_MARKERS: readonly Buffer[] = [
  Buffer.from("c2pa", "ascii"),
  Buffer.from("jumb", "ascii"),
  Buffer.from("application/c2pa", "ascii"),
];

const containsManifestMarker = (bytes: Buffer): boolean =>
  C2PA_JUMBF_MARKERS.some((marker) => bytes.includes(marker));

export interface ProvenanceScanner {
  readFile(filePath: string): Promise<Buffer>;
}

export class ByteScanProvenanceProvider implements ProvenanceProvider {
  readonly modelName = "byte-scan-jumbf-detector";
  readonly modelVersion = "1";

  constructor(private readonly scanner: ProvenanceScanner) {}

  async inspectProvenance(media: MediaRef): Promise<ProvenanceResult> {
    let bytes: Buffer;
    try {
      bytes = await this.scanner.readFile(media.filePath);
    } catch {
      return {
        status: "unavailable",
        warnings: ["media-read-failed"],
        modelName: this.modelName,
        modelVersion: this.modelVersion,
        provenanceStatus: "c2pa_unavailable",
      };
    }

    if (!containsManifestMarker(bytes)) {
      return {
        status: "success",
        warnings: [],
        modelName: this.modelName,
        modelVersion: this.modelVersion,
        provenanceStatus: "c2pa_not_found",
      };
    }

    // A manifest-like byte sequence exists, but this scanner does not verify
    // the C2PA signature chain — report "unavailable", never "valid".
    return {
      status: "uncertain",
      warnings: ["manifest-detected-but-not-cryptographically-verified"],
      modelName: this.modelName,
      modelVersion: this.modelVersion,
      provenanceStatus: "c2pa_unavailable",
    };
  }
}

// --- Visual analyzer: the REAL liveness/challenge-response check ---
//
// This is the server-side re-derivation the spec requires: an external
// service (services/guardian-vision-analyzer — Python/FastAPI/OpenCV/
// MediaPipe) independently decodes the captured video and re-checks face
// count, head orientation, blink, hand gesture, motion continuity, sequence
// order, duration, and quality — rather than trusting the client's claims.
// It implements the same `LivenessProvider` interface as the (always
// not_evaluated) default above, so the decision engine's AUTO/STRICT gate
// (`livenessStatus === "success"`) only ever passes when this real analysis
// actually confirms everything, never on an unevaluated/failed/uncertain
// result — see decision-engine.ts's docstring.

const isProviderStatus = (
  value: unknown,
): value is GuardianProviderStatusValue =>
  value === "success" ||
  value === "uncertain" ||
  value === "unavailable" ||
  value === "failed" ||
  value === "not_evaluated";

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const asStepAnalysis = (value: unknown): LivenessStepAnalysis | null => {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.action !== "string" || typeof v.matched !== "boolean") {
    return null;
  }
  return {
    action: v.action,
    kind: v.kind === "hand" ? "hand" : "face",
    declaredDetectedAtMs: numberOrUndefined(v.declaredDetectedAtMs) ?? null,
    matched: v.matched,
    timingDiscrepancyMs: numberOrUndefined(v.timingDiscrepancyMs) ?? null,
  };
};

/**
 * Validates and maps the analyzer's raw HTTP JSON response into a
 * `LivenessResult` — deliberately defensive, since this is an EXTERNAL
 * service's response: any field with the wrong shape is dropped rather than
 * trusted verbatim, and an unrecognized/missing `status` degrades to
 * `"unavailable"` rather than ever being coerced into `"success"`. Exported
 * so it's unit-testable against canned JSON fixtures without a real HTTP call.
 */
export const normalizeAnalyzerResponse = (
  raw: unknown,
  modelName: string,
  modelVersion: string,
): LivenessResult => {
  if (typeof raw !== "object" || raw === null) {
    return {
      status: "unavailable",
      warnings: ["analyzer-response-not-an-object"],
      modelName,
      modelVersion,
    };
  }
  const r = raw as Record<string, unknown>;
  const status = isProviderStatus(r.status) ? r.status : "unavailable";
  const warnings = Array.isArray(r.warnings)
    ? r.warnings.filter((w): w is string => typeof w === "string")
    : [];
  const perStepRaw = Array.isArray(r.perStep) ? r.perStep : [];
  const perStep = perStepRaw
    .map(asStepAnalysis)
    .filter((s): s is LivenessStepAnalysis => s !== null);

  const livenessScore = numberOrUndefined(r.livenessScore);
  const replayRisk = numberOrUndefined(r.replayRisk);
  const faceCount = numberOrUndefined(r.faceCount);
  const qualityScore = numberOrUndefined(r.qualityScore);
  const lightingScore = numberOrUndefined(r.lightingScore);
  const durationMs = numberOrUndefined(r.durationMs);

  return {
    status,
    warnings: isProviderStatus(r.status)
      ? warnings
      : [...warnings, "analyzer-response-missing-or-invalid-status"],
    modelName,
    modelVersion:
      typeof r.modelVersion === "string" ? r.modelVersion : modelVersion,
    ...(livenessScore !== undefined ? { livenessScore } : {}),
    ...(replayRisk !== undefined ? { replayRisk } : {}),
    ...(faceCount !== undefined ? { faceCount } : {}),
    ...(qualityScore !== undefined ? { qualityScore } : {}),
    ...(lightingScore !== undefined ? { lightingScore } : {}),
    ...(typeof r.staticVideoSuspected === "boolean"
      ? { staticVideoSuspected: r.staticVideoSuspected }
      : {}),
    ...(typeof r.sequenceOk === "boolean" ? { sequenceOk: r.sequenceOk } : {}),
    ...(perStep.length > 0 ? { perStep } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(typeof r.sha256 === "string" ? { sha256: r.sha256 } : {}),
  };
};

export interface VisualAnalyzerHttpConfig {
  readonly baseUrl: string;
  readonly apiKey?: string;
  /** Reads the raw media bytes for the given storage key — mirrors
   * ProvenanceScanner's pattern so this provider doesn't need to know which
   * storage driver (local/S3) is behind it. */
  readonly readMedia: (filePath: string) => Promise<Buffer>;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

const DEFAULT_ANALYZER_TIMEOUT_MS = 15_000;

/** Calls the real Python/FastAPI visual-analyzer microservice. Fails closed
 * (`"unavailable"`) on any network/parse error — never falls back to
 * fabricating a score, per this module's core rule. */
export class HttpVisualAnalyzerProvider implements LivenessProvider {
  readonly modelName = "guardian-vision-analyzer";
  readonly modelVersion = "http";

  constructor(private readonly config: VisualAnalyzerHttpConfig) {}

  async estimateLiveness(
    media: MediaRef,
    context: LivenessAnalysisContext,
  ): Promise<LivenessResult> {
    let bytes: Buffer;
    try {
      bytes = await this.config.readMedia(media.filePath);
    } catch {
      return {
        status: "unavailable",
        warnings: ["media-read-failed"],
        modelName: this.modelName,
        modelVersion: this.modelVersion,
      };
    }

    const fetchImpl = this.config.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? DEFAULT_ANALYZER_TIMEOUT_MS,
    );

    let response: Response;
    try {
      response = await fetchImpl(`${this.config.baseUrl}/v1/analyze`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          ...(this.config.apiKey
            ? { authorization: `Bearer ${this.config.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          video: bytes.toString("base64"),
          mimeType: media.mimeType,
          challenge: {
            steps: context.steps,
            sessionStartedAtMs: context.sessionStartedAtMs,
          },
          declaredStepResults: context.declaredStepResults,
        }),
      });
    } catch {
      return {
        status: "unavailable",
        warnings: ["analyzer-unreachable-or-timed-out"],
        modelName: this.modelName,
        modelVersion: this.modelVersion,
      };
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return {
        status: "unavailable",
        warnings: [`analyzer-http-${response.status}`],
        modelName: this.modelName,
        modelVersion: this.modelVersion,
      };
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      return {
        status: "unavailable",
        warnings: ["analyzer-response-not-json"],
        modelName: this.modelName,
        modelVersion: this.modelVersion,
      };
    }

    return normalizeAnalyzerResponse(parsed, this.modelName, this.modelVersion);
  }
}

// --- Gesture + face + age vision check (Gemini primary, Groq fallback) ---
//
// The photo-mode verification (see generateGestureChallenge): the user submits
// ONE still photo showing their FACE and a requested hand gesture. A multimodal
// LLM judges, in a single call: is the requested gesture shown, is this a real
// live person (not a screen/printout/AI image), and what is the person's
// estimated age. Gemini (gemini-flash-lite-latest) is primary and Groq
// (Llama-vision) is the fallback — both free-tier, so a rate-limit on one
// degrades to the other rather than to "unavailable". If BOTH fail, status is
// "unavailable" and the decision engine routes to STAFF — never auto-approve,
// per the never-fabricate-a-score rule.

export interface GestureVisionResult {
  readonly status: GuardianProviderStatusValue;
  readonly provider: string | null;
  readonly personCount: number | null;
  readonly faceVisible: boolean | null;
  readonly gesturePresent: boolean | null;
  readonly gestureConfidence: number | null;
  readonly estimatedAgeMin: number | null;
  readonly estimatedAgeMax: number | null;
  readonly realPerson: boolean | null;
  readonly spoofRisk: number | null;
  readonly qualityScore: number | null;
  readonly warnings: readonly string[];
  readonly reason: string;
  readonly modelName: string;
  readonly modelVersion: string;
}

export interface GestureVisionContext {
  /** The challenge's requested hand action, e.g. "thumbs_up". */
  readonly requestedGesture: string;
}

/** Double-verification (requiredPhotos: 2) result: does the SECOND photo show
 * the same person as the first. `not_evaluated`/`unavailable`/`uncertain`/
 * `failed` (i.e. anything but "success") must NEVER be treated as a match —
 * the decision engine routes those to manual review rather than assuming
 * consistency it never actually confirmed. */
export interface FaceMatchResult {
  readonly status: GuardianProviderStatusValue;
  readonly samePerson: boolean | null;
  readonly confidence: number | null;
  readonly reason: string;
  readonly modelName: string;
  readonly modelVersion: string;
}

export interface GestureVisionProvider {
  readonly modelName: string;
  readonly modelVersion: string;
  analyze(
    media: MediaRef,
    context: GestureVisionContext,
  ): Promise<GestureVisionResult>;
  compareFaces(mediaA: MediaRef, mediaB: MediaRef): Promise<FaceMatchResult>;
}

const GESTURE_DESCRIPTIONS: Record<string, string> = {
  thumbs_up: "a thumbs-up 👍 (thumb extended upward, other fingers curled)",
  victory: "a victory / peace sign ✌️ (index and middle fingers up forming a V)",
  open_palm: "an open palm ✋ (all five fingers spread, palm toward the camera)",
  closed_fist: "a closed fist ✊ (all fingers curled into a fist)",
  show_one_finger: "exactly one finger raised ☝️ (index finger only)",
  show_two_fingers: "exactly two fingers raised",
  show_three_fingers: "exactly three fingers raised",
  smile: "a clear smile (fallback for a user who cannot show a hand gesture)",
};

const describeGesture = (action: string): string =>
  GESTURE_DESCRIPTIONS[action] ?? `the '${action}' hand gesture`;

const buildGesturePrompt = (requestedGesture: string): string =>
  [
    "You verify photos for a private group's join gate. Analyze the SINGLE still photo.",
    `The user was asked to show their FACE together with this hand gesture: ${describeGesture(requestedGesture)}.`,
    "Reply with ONLY a JSON object (no markdown, no prose) with EXACTLY these keys:",
    '- "personCount": integer, number of distinct people visible.',
    '- "faceVisible": boolean, is exactly one human face clearly visible.',
    '- "gesturePresent": boolean, is the person clearly performing the requested gesture.',
    '- "gestureConfidence": number 0..1, confidence the requested gesture is correctly shown.',
    "- \"estimatedAgeMin\": integer, lower bound of the person's likely age in years.",
    "- \"estimatedAgeMax\": integer, upper bound of the person's likely age in years.",
    '- "realPerson": boolean, true if a real live person physically present; false if a photo of a screen, a printed photo, or an AI-generated/edited image.',
    '- "spoofRisk": number 0..1, risk this is a screen/printout/photo-of-a-photo rather than a live capture.',
    '- "qualityOk": boolean, is the image sharp and well-lit enough to judge.',
    '- "reason": short string, one sentence explaining the assessment.',
    "Be conservative: if unsure the gesture is correct or the person is real, lower gestureConfidence and realPerson.",
  ].join("\n");

interface RawGestureJudgment {
  readonly personCount: number | null;
  readonly faceVisible: boolean | null;
  readonly gesturePresent: boolean | null;
  readonly gestureConfidence: number | null;
  readonly estimatedAgeMin: number | null;
  readonly estimatedAgeMax: number | null;
  readonly realPerson: boolean | null;
  readonly spoofRisk: number | null;
  readonly qualityOk: boolean | null;
  readonly reason: string;
}

const clampUnit = (n: number | undefined): number | null =>
  n === undefined ? null : Math.min(1, Math.max(0, n));

const boolOrNull = (v: unknown): boolean | null =>
  typeof v === "boolean" ? v : null;

/** Models sometimes wrap JSON in ```json fences or add stray prose — extract
 * the first {...} block and validate each field defensively. */
const parseGestureJudgment = (text: string): RawGestureJudgment | null => {
  const match = text.match(/\{[\s\S]*\}/u);
  if (!match) return null;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
  return {
    personCount: numberOrUndefined(obj.personCount) ?? null,
    faceVisible: boolOrNull(obj.faceVisible),
    gesturePresent: boolOrNull(obj.gesturePresent),
    gestureConfidence: clampUnit(numberOrUndefined(obj.gestureConfidence)),
    estimatedAgeMin: numberOrUndefined(obj.estimatedAgeMin) ?? null,
    estimatedAgeMax: numberOrUndefined(obj.estimatedAgeMax) ?? null,
    realPerson: boolOrNull(obj.realPerson),
    spoofRisk: clampUnit(numberOrUndefined(obj.spoofRisk)),
    qualityOk: boolOrNull(obj.qualityOk),
    reason: typeof obj.reason === "string" ? obj.reason.slice(0, 300) : "",
  };
};

/** Gemini/Groq accept jpeg/png/webp inline; anything else (or a stray video
 * mime) is sent as jpeg, which is what the photo capture produces. */
const imageMimeFor = (mimeType: string): string =>
  mimeType === "image/png" || mimeType === "image/webp"
    ? mimeType
    : "image/jpeg";

const FACE_MATCH_PROMPT = [
  "You verify photos for a private group's join gate. Two photos were taken",
  "moments apart in the same verification session, each showing a person's",
  "face. Determine whether BOTH photos show the SAME person.",
  "Reply with ONLY a JSON object (no markdown, no prose) with EXACTLY these keys:",
  '- "samePerson": boolean, true only if you are confident both photos show the same person.',
  '- "confidence": number 0..1, confidence in the samePerson judgment.',
  '- "reason": short string, one sentence explaining the assessment.',
  "Be conservative: if the two faces are hard to compare (angle, lighting, blur), set samePerson to false and lower confidence rather than guessing.",
].join("\n");

interface RawFaceMatchJudgment {
  readonly samePerson: boolean | null;
  readonly confidence: number | null;
  readonly reason: string;
}

/** Mirrors parseGestureJudgment's defensive extraction — models sometimes
 * wrap JSON in ```json fences or add stray prose. */
const parseFaceMatchJudgment = (text: string): RawFaceMatchJudgment | null => {
  const match = text.match(/\{[\s\S]*\}/u);
  if (!match) return null;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
  return {
    samePerson: boolOrNull(obj.samePerson),
    confidence: clampUnit(numberOrUndefined(obj.confidence)),
    reason: typeof obj.reason === "string" ? obj.reason.slice(0, 300) : "",
  };
};

export interface GestureVisionConfig {
  readonly readMedia: (filePath: string) => Promise<Buffer>;
  readonly geminiApiKeys?: readonly string[];
  readonly geminiModel?: string;
  readonly groqApiKeys?: readonly string[];
  readonly groqModel?: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

const DEFAULT_VISION_TIMEOUT_MS = 20_000;

/** Honest default: no vision keys wired → always "unavailable" so AUTO can
 * never approve without a real judgment (routes to STAFF instead). */
export class NotConfiguredGestureVisionProvider
  implements GestureVisionProvider
{
  readonly modelName = "none";
  readonly modelVersion = "0";

  async analyze(): Promise<GestureVisionResult> {
    return {
      status: "unavailable",
      provider: null,
      personCount: null,
      faceVisible: null,
      gesturePresent: null,
      gestureConfidence: null,
      estimatedAgeMin: null,
      estimatedAgeMax: null,
      realPerson: null,
      spoofRisk: null,
      qualityScore: null,
      warnings: ["no-vision-provider-configured"],
      reason: "",
      modelName: this.modelName,
      modelVersion: this.modelVersion,
    };
  }

  async compareFaces(
    _mediaA: MediaRef,
    _mediaB: MediaRef,
  ): Promise<FaceMatchResult> {
    return {
      status: "unavailable",
      samePerson: null,
      confidence: null,
      reason: "",
      modelName: this.modelName,
      modelVersion: this.modelVersion,
    };
  }
}

export class GeminiGroqGestureVisionProvider implements GestureVisionProvider {
  readonly modelName = "gesture-vision-llm";
  readonly modelVersion = "1";

  constructor(private readonly config: GestureVisionConfig) {}

  async analyze(
    media: MediaRef,
    context: GestureVisionContext,
  ): Promise<GestureVisionResult> {
    let bytes: Buffer;
    try {
      bytes = await this.config.readMedia(media.filePath);
    } catch {
      return this.unavailable(["media-read-failed"]);
    }
    const base64 = bytes.toString("base64");
    const imageMime = imageMimeFor(media.mimeType);
    const prompt = buildGesturePrompt(context.requestedGesture);
    const warnings: string[] = [];

    // Gemini primary — rotate keys on any failure (free-tier rate limits).
    for (const key of this.config.geminiApiKeys ?? []) {
      const judgment = await this.callGemini(key, prompt, base64, imageMime);
      if (judgment) return this.fromJudgment(judgment, "gemini");
      warnings.push("gemini-attempt-failed");
    }
    // Groq fallback — a different free provider, so a Gemini-wide outage or
    // quota exhaustion still yields a real judgment.
    for (const key of this.config.groqApiKeys ?? []) {
      const judgment = await this.callGroq(key, prompt, base64, imageMime);
      if (judgment) return this.fromJudgment(judgment, "groq");
      warnings.push("groq-attempt-failed");
    }
    return this.unavailable(
      warnings.length > 0 ? warnings : ["no-vision-provider-configured"],
    );
  }

  /** Double-verification's second gate: are photo A and photo B the same
   * person. Same Gemini-primary/Groq-fallback pattern as analyze() — an
   * unreachable/unparseable result stays "unavailable", never a fabricated
   * samePerson guess. */
  async compareFaces(
    mediaA: MediaRef,
    mediaB: MediaRef,
  ): Promise<FaceMatchResult> {
    let bytesA: Buffer;
    let bytesB: Buffer;
    try {
      [bytesA, bytesB] = await Promise.all([
        this.config.readMedia(mediaA.filePath),
        this.config.readMedia(mediaB.filePath),
      ]);
    } catch {
      return this.unavailableMatch(["media-read-failed"]);
    }
    const imageA = { base64: bytesA.toString("base64"), mime: imageMimeFor(mediaA.mimeType) };
    const imageB = { base64: bytesB.toString("base64"), mime: imageMimeFor(mediaB.mimeType) };
    const warnings: string[] = [];

    for (const key of this.config.geminiApiKeys ?? []) {
      const judgment = await this.callGeminiCompare(key, imageA, imageB);
      if (judgment) return this.fromMatchJudgment(judgment, "gemini");
      warnings.push("gemini-attempt-failed");
    }
    for (const key of this.config.groqApiKeys ?? []) {
      const judgment = await this.callGroqCompare(key, imageA, imageB);
      if (judgment) return this.fromMatchJudgment(judgment, "groq");
      warnings.push("groq-attempt-failed");
    }
    return this.unavailableMatch(
      warnings.length > 0 ? warnings : ["no-vision-provider-configured"],
    );
  }

  private fromMatchJudgment(
    j: RawFaceMatchJudgment,
    provider: string,
  ): FaceMatchResult {
    return {
      status: "success",
      samePerson: j.samePerson,
      confidence: j.confidence,
      reason: j.reason,
      modelName: this.modelName,
      modelVersion: `${this.modelVersion}-${provider}`,
    };
  }

  private unavailableMatch(warnings: readonly string[]): FaceMatchResult {
    return {
      status: "unavailable",
      samePerson: null,
      confidence: null,
      reason: warnings.join(","),
      modelName: this.modelName,
      modelVersion: this.modelVersion,
    };
  }

  private async callGeminiCompare(
    key: string,
    imageA: { base64: string; mime: string },
    imageB: { base64: string; mime: string },
  ): Promise<RawFaceMatchJudgment | null> {
    const model = this.config.geminiModel ?? "gemini-flash-lite-latest";
    const fetchImpl = this.config.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? DEFAULT_VISION_TIMEOUT_MS,
    );
    try {
      const res = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model,
        )}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: FACE_MATCH_PROMPT },
                  { inlineData: { mimeType: imageA.mime, data: imageA.base64 } },
                  { inlineData: { mimeType: imageB.mime, data: imageB.base64 } },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json",
              maxOutputTokens: 300,
            },
          }),
        },
      );
      if (!res.ok) return null;
      const body = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = (body.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      return text ? parseFaceMatchJudgment(text) : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async callGroqCompare(
    key: string,
    imageA: { base64: string; mime: string },
    imageB: { base64: string; mime: string },
  ): Promise<RawFaceMatchJudgment | null> {
    const model =
      this.config.groqModel ?? "meta-llama/llama-4-scout-17b-16e-instruct";
    const fetchImpl = this.config.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? DEFAULT_VISION_TIMEOUT_MS,
    );
    try {
      const res = await fetchImpl(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.1,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: FACE_MATCH_PROMPT },
                  {
                    type: "image_url",
                    image_url: { url: `data:${imageA.mime};base64,${imageA.base64}` },
                  },
                  {
                    type: "image_url",
                    image_url: { url: `data:${imageB.mime};base64,${imageB.base64}` },
                  },
                ],
              },
            ],
          }),
        },
      );
      if (!res.ok) return null;
      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = body.choices?.[0]?.message?.content?.trim() ?? "";
      return text ? parseFaceMatchJudgment(text) : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private fromJudgment(
    j: RawGestureJudgment,
    provider: string,
  ): GestureVisionResult {
    return {
      status: "success",
      provider,
      personCount: j.personCount,
      faceVisible: j.faceVisible,
      gesturePresent: j.gesturePresent,
      gestureConfidence: j.gestureConfidence,
      estimatedAgeMin: j.estimatedAgeMin,
      estimatedAgeMax: j.estimatedAgeMax,
      realPerson: j.realPerson,
      spoofRisk: j.spoofRisk,
      qualityScore:
        j.qualityOk === null ? null : j.qualityOk ? 0.85 : 0.4,
      warnings: [],
      reason: j.reason,
      modelName: this.modelName,
      modelVersion: `${this.modelVersion}-${provider}`,
    };
  }

  private unavailable(warnings: readonly string[]): GestureVisionResult {
    return {
      status: "unavailable",
      provider: null,
      personCount: null,
      faceVisible: null,
      gesturePresent: null,
      gestureConfidence: null,
      estimatedAgeMin: null,
      estimatedAgeMax: null,
      realPerson: null,
      spoofRisk: null,
      qualityScore: null,
      warnings,
      reason: "",
      modelName: this.modelName,
      modelVersion: this.modelVersion,
    };
  }

  private async callGemini(
    key: string,
    prompt: string,
    base64: string,
    imageMime: string,
  ): Promise<RawGestureJudgment | null> {
    const model = this.config.geminiModel ?? "gemini-flash-lite-latest";
    const fetchImpl = this.config.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? DEFAULT_VISION_TIMEOUT_MS,
    );
    try {
      const res = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model,
        )}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: imageMime, data: base64 } },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json",
              maxOutputTokens: 400,
            },
          }),
        },
      );
      if (!res.ok) return null;
      const body = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = (body.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      return text ? parseGestureJudgment(text) : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async callGroq(
    key: string,
    prompt: string,
    base64: string,
    imageMime: string,
  ): Promise<RawGestureJudgment | null> {
    const model =
      this.config.groqModel ?? "meta-llama/llama-4-scout-17b-16e-instruct";
    const fetchImpl = this.config.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? DEFAULT_VISION_TIMEOUT_MS,
    );
    try {
      const res = await fetchImpl(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.1,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  {
                    type: "image_url",
                    image_url: { url: `data:${imageMime};base64,${base64}` },
                  },
                ],
              },
            ],
          }),
        },
      );
      if (!res.ok) return null;
      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = body.choices?.[0]?.message?.content?.trim() ?? "";
      return text ? parseGestureJudgment(text) : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

export interface GuardianAiProviders {
  readonly liveness: LivenessProvider;
  readonly age: AgeEstimatorProvider;
  readonly synthetic: SyntheticMediaDetectorProvider;
  readonly provenance: ProvenanceProvider;
}

export interface CreateDefaultProvidersOptions {
  /** When set (AI_SERVICE_URL configured), the real HttpVisualAnalyzerProvider
   * is wired as the liveness provider instead of the honest not_evaluated
   * stub. Omit/leave undefined to keep the safe default. */
  readonly visualAnalyzer?: VisualAnalyzerHttpConfig;
}

export const createDefaultProviders = (
  scanner: ProvenanceScanner,
  options?: CreateDefaultProvidersOptions,
): GuardianAiProviders => ({
  liveness: options?.visualAnalyzer
    ? new HttpVisualAnalyzerProvider(options.visualAnalyzer)
    : new NotConfiguredLivenessProvider(),
  age: new NotConfiguredAgeEstimatorProvider(),
  synthetic: new NotConfiguredSyntheticMediaDetectorProvider(),
  provenance: new ByteScanProvenanceProvider(scanner),
});

// --- Summarizing per-step analyzer results into the schema's named fields ---
//
// VerificationAnalysis (the Prisma model) stores ONE summary gesture/head-
// movement/blink signal per attempt, not a full per-step array — the
// complete per-step breakdown still goes into `rawTechnicalReport`. This
// picks a representative step of each kind so STAFF sees a real, specific
// "what was asked vs what was detected" instead of a placeholder.

export interface StepSignalSummary {
  readonly gestureRequested: string | null;
  readonly gestureDetected: string | null;
  readonly headMovementRequested: string | null;
  readonly headMovementDetected: string | null;
  readonly headMovementScore: number | null;
  readonly blinkRequested: boolean;
  readonly blinkDetected: boolean | null;
}

const ORIENTATION_ACTIONS = new Set([
  "look_center",
  "turn_left",
  "turn_right",
  "look_up",
]);
const BLINK_ACTIONS = new Set(["blink_once", "blink_twice"]);

export const summarizeStepSignals = (
  steps: readonly LivenessChallengeStep[],
  perStep: readonly LivenessStepAnalysis[] | undefined,
): StepSignalSummary => {
  const matchFor = (action: string): boolean | null =>
    perStep?.find((s) => s.action === action)?.matched ?? null;

  const handStep = steps.find((s) => s.kind === "hand");
  const orientationStep = steps.find((s) => ORIENTATION_ACTIONS.has(s.action));
  const blinkStep = steps.find((s) => BLINK_ACTIONS.has(s.action));

  const handMatched = handStep ? matchFor(handStep.action) : null;
  const orientationMatched = orientationStep
    ? matchFor(orientationStep.action)
    : null;
  const blinkMatched = blinkStep ? matchFor(blinkStep.action) : null;

  return {
    gestureRequested: handStep?.action ?? null,
    gestureDetected: handMatched ? (handStep?.action ?? null) : null,
    headMovementRequested: orientationStep?.action ?? null,
    headMovementDetected: orientationMatched
      ? (orientationStep?.action ?? null)
      : null,
    headMovementScore: orientationStep
      ? orientationMatched === null
        ? null
        : orientationMatched
          ? 1
          : 0
      : null,
    blinkRequested: blinkStep !== undefined,
    blinkDetected: blinkStep ? blinkMatched : null,
  };
};

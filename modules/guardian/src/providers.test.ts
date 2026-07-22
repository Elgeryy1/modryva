import { describe, expect, it, vi } from "vitest";
import {
  ByteScanProvenanceProvider,
  GeminiGroqGestureVisionProvider,
  HttpVisualAnalyzerProvider,
  type LivenessAnalysisContext,
  NotConfiguredAgeEstimatorProvider,
  NotConfiguredGestureVisionProvider,
  NotConfiguredLivenessProvider,
  NotConfiguredSyntheticMediaDetectorProvider,
  normalizeAnalyzerResponse,
  type ProvenanceScanner,
  summarizeStepSignals,
} from "./providers.js";

const media = { filePath: "/tmp/fake.mp4", mimeType: "video/mp4" };

const context: LivenessAnalysisContext = {
  steps: [{ kind: "face", action: "look_center", timeLimitMs: 6000 }],
  declaredStepResults: [{ action: "look_center", detectedAt: 1000 }],
  sessionStartedAtMs: 0,
};

describe("NotConfigured* providers", () => {
  it("liveness never fabricates a score when not configured", async () => {
    const result = await new NotConfiguredLivenessProvider().estimateLiveness(
      media,
      context,
    );
    expect(result.status).toBe("not_evaluated");
    expect(result.livenessScore).toBeUndefined();
  });

  it("age never fabricates a score when not configured", async () => {
    const result = await new NotConfiguredAgeEstimatorProvider().estimateAge(
      media,
    );
    expect(result.status).toBe("not_evaluated");
    expect(result.estimatedAgeMin).toBeUndefined();
  });

  it("synthetic-media detector never fabricates a score when not configured", async () => {
    const result =
      await new NotConfiguredSyntheticMediaDetectorProvider().estimateSyntheticRisk(
        media,
      );
    expect(result.status).toBe("not_evaluated");
    expect(result.syntheticMediaRisk).toBeUndefined();
  });
});

const scannerReturning = (bytes: Buffer): ProvenanceScanner => ({
  readFile: async () => bytes,
});

describe("ByteScanProvenanceProvider", () => {
  it("reports c2pa_not_found for plain media with no manifest markers", async () => {
    const provider = new ByteScanProvenanceProvider(
      scannerReturning(Buffer.from("just some plain video bytes", "ascii")),
    );
    const result = await provider.inspectProvenance(media);
    expect(result.provenanceStatus).toBe("c2pa_not_found");
    expect(result.status).toBe("success");
  });

  it("never claims c2pa_valid_* — a detected manifest is reported unavailable, not valid", async () => {
    const provider = new ByteScanProvenanceProvider(
      scannerReturning(Buffer.from("....c2pa....jumb....manifest", "ascii")),
    );
    const result = await provider.inspectProvenance(media);
    expect(result.provenanceStatus).toBe("c2pa_unavailable");
    expect(result.provenanceStatus).not.toBe("c2pa_valid_ai_declared");
    expect(result.provenanceStatus).not.toBe("c2pa_valid_other");
  });

  it("reports c2pa_unavailable when the media cannot be read", async () => {
    const provider = new ByteScanProvenanceProvider({
      readFile: async () => {
        throw new Error("disk error");
      },
    });
    const result = await provider.inspectProvenance(media);
    expect(result.provenanceStatus).toBe("c2pa_unavailable");
    expect(result.status).toBe("unavailable");
  });
});

describe("normalizeAnalyzerResponse", () => {
  it("passes through a well-formed success response", () => {
    const result = normalizeAnalyzerResponse(
      {
        status: "success",
        faceCount: 1,
        qualityScore: 0.8,
        lightingScore: 0.7,
        staticVideoSuspected: false,
        sequenceOk: true,
        livenessScore: 0.9,
        replayRisk: 0.05,
        durationMs: 4000,
        sha256: "abc123",
        perStep: [
          {
            action: "look_center",
            kind: "face",
            matched: true,
            declaredDetectedAtMs: 500,
            timingDiscrepancyMs: 40,
          },
        ],
        warnings: [],
      },
      "guardian-vision-analyzer",
      "1",
    );
    expect(result.status).toBe("success");
    expect(result.faceCount).toBe(1);
    expect(result.sequenceOk).toBe(true);
    expect(result.perStep).toHaveLength(1);
    expect(result.perStep?.[0]).toMatchObject({
      action: "look_center",
      matched: true,
    });
  });

  it("degrades to unavailable when status is missing", () => {
    const result = normalizeAnalyzerResponse({ faceCount: 1 }, "m", "1");
    expect(result.status).toBe("unavailable");
    expect(result.warnings).toContain(
      "analyzer-response-missing-or-invalid-status",
    );
  });

  it("degrades to unavailable when status is an unrecognized string", () => {
    const result = normalizeAnalyzerResponse(
      { status: "definitely_verified" },
      "m",
      "1",
    );
    expect(result.status).toBe("unavailable");
  });

  it("never coerces a non-object response into a passing status", () => {
    expect(normalizeAnalyzerResponse(null, "m", "1").status).toBe(
      "unavailable",
    );
    expect(normalizeAnalyzerResponse("success", "m", "1").status).toBe(
      "unavailable",
    );
    expect(normalizeAnalyzerResponse(42, "m", "1").status).toBe("unavailable");
  });

  it("drops malformed perStep entries instead of throwing", () => {
    const result = normalizeAnalyzerResponse(
      { status: "uncertain", perStep: [{ action: "x" }, "not-an-object", 5] },
      "m",
      "1",
    );
    expect(result.perStep).toBeUndefined();
  });

  it("ignores non-numeric score fields rather than passing NaN through", () => {
    const result = normalizeAnalyzerResponse(
      { status: "success", faceCount: "one", livenessScore: Number.NaN },
      "m",
      "1",
    );
    expect(result.faceCount).toBeUndefined();
    expect(result.livenessScore).toBeUndefined();
  });
});

describe("HttpVisualAnalyzerProvider", () => {
  it("returns unavailable when the media can't be read", async () => {
    const provider = new HttpVisualAnalyzerProvider({
      baseUrl: "http://analyzer.local",
      readMedia: async () => {
        throw new Error("not found");
      },
    });
    const result = await provider.estimateLiveness(media, context);
    expect(result.status).toBe("unavailable");
    expect(result.warnings).toContain("media-read-failed");
  });

  it("returns unavailable when the analyzer is unreachable", async () => {
    const provider = new HttpVisualAnalyzerProvider({
      baseUrl: "http://analyzer.local",
      readMedia: async () => Buffer.from("fake video bytes"),
      fetchImpl: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    });
    const result = await provider.estimateLiveness(media, context);
    expect(result.status).toBe("unavailable");
    expect(result.warnings).toContain("analyzer-unreachable-or-timed-out");
  });

  it("returns unavailable on a non-2xx HTTP response", async () => {
    const provider = new HttpVisualAnalyzerProvider({
      baseUrl: "http://analyzer.local",
      readMedia: async () => Buffer.from("fake video bytes"),
      fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    });
    const result = await provider.estimateLiveness(media, context);
    expect(result.status).toBe("unavailable");
    expect(result.warnings).toContain("analyzer-http-500");
  });

  it("maps a real success response through to a passing LivenessResult", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "success",
        faceCount: 1,
        sequenceOk: true,
        livenessScore: 0.88,
      }),
    });
    const provider = new HttpVisualAnalyzerProvider({
      baseUrl: "http://analyzer.local",
      readMedia: async () => Buffer.from("fake video bytes"),
      fetchImpl,
    });
    const result = await provider.estimateLiveness(media, context);
    expect(result.status).toBe("success");
    expect(result.faceCount).toBe(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://analyzer.local/v1/analyze",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends the challenge and declared step results as part of the request body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "uncertain" }),
    });
    const provider = new HttpVisualAnalyzerProvider({
      baseUrl: "http://analyzer.local",
      readMedia: async () => Buffer.from("fake video bytes"),
      fetchImpl,
    });
    await provider.estimateLiveness(media, context);
    const call = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(call[1].body as string);
    expect(body.challenge.steps).toEqual(context.steps);
    expect(body.declaredStepResults).toEqual(context.declaredStepResults);
    expect(body.mimeType).toBe(media.mimeType);
  });
});

const mediaA = { filePath: "/tmp/photo-a.jpg", mimeType: "image/jpeg" };
const mediaB = { filePath: "/tmp/photo-b.jpg", mimeType: "image/jpeg" };

const geminiResponseWith = (json: Record<string, unknown>) => ({
  ok: true,
  json: async () => ({
    candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }],
  }),
});

describe("GestureVisionProvider.compareFaces", () => {
  it("NotConfigured never fabricates a match — always unavailable/null", async () => {
    const result = await new NotConfiguredGestureVisionProvider().compareFaces(
      mediaA,
      mediaB,
    );
    expect(result.status).toBe("unavailable");
    expect(result.samePerson).toBeNull();
  });

  it("reports a confirmed match from Gemini's real response", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        geminiResponseWith({ samePerson: true, confidence: 0.92, reason: "same face" }),
      );
    const provider = new GeminiGroqGestureVisionProvider({
      readMedia: async () => Buffer.from("fake jpeg bytes"),
      geminiApiKeys: ["key-1"],
      fetchImpl,
    });
    const result = await provider.compareFaces(mediaA, mediaB);
    expect(result.status).toBe("success");
    expect(result.samePerson).toBe(true);
    expect(result.confidence).toBe(0.92);
  });

  it("reports a confirmed MISMATCH — never coerced into a pass", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        geminiResponseWith({
          samePerson: false,
          confidence: 0.81,
          reason: "different face shape",
        }),
      );
    const provider = new GeminiGroqGestureVisionProvider({
      readMedia: async () => Buffer.from("fake jpeg bytes"),
      geminiApiKeys: ["key-1"],
      fetchImpl,
    });
    const result = await provider.compareFaces(mediaA, mediaB);
    expect(result.status).toBe("success");
    expect(result.samePerson).toBe(false);
  });

  it("sends BOTH images in the same request", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        geminiResponseWith({ samePerson: true, confidence: 0.9, reason: "ok" }),
      );
    const provider = new GeminiGroqGestureVisionProvider({
      readMedia: async () => Buffer.from("fake jpeg bytes"),
      geminiApiKeys: ["key-1"],
      fetchImpl,
    });
    await provider.compareFaces(mediaA, mediaB);
    const call = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(call[1].body as string);
    const inlineParts = body.contents[0].parts.filter(
      (p: unknown) => (p as { inlineData?: unknown }).inlineData,
    );
    expect(inlineParts).toHaveLength(2);
  });

  it("falls back to Groq when every Gemini key fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 }) // Gemini fails
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  samePerson: true,
                  confidence: 0.7,
                  reason: "groq says same",
                }),
              },
            },
          ],
        }),
      });
    const provider = new GeminiGroqGestureVisionProvider({
      readMedia: async () => Buffer.from("fake jpeg bytes"),
      geminiApiKeys: ["key-1"],
      groqApiKeys: ["groq-key"],
      fetchImpl,
    });
    const result = await provider.compareFaces(mediaA, mediaB);
    expect(result.status).toBe("success");
    expect(result.modelVersion).toContain("groq");
  });

  it("stays unavailable — never a fabricated guess — when no provider is configured", async () => {
    const provider = new GeminiGroqGestureVisionProvider({
      readMedia: async () => Buffer.from("fake jpeg bytes"),
    });
    const result = await provider.compareFaces(mediaA, mediaB);
    expect(result.status).toBe("unavailable");
    expect(result.samePerson).toBeNull();
  });

  it("reports unavailable when either photo can't be read", async () => {
    const provider = new GeminiGroqGestureVisionProvider({
      readMedia: async () => {
        throw new Error("disk error");
      },
      geminiApiKeys: ["key-1"],
    });
    const result = await provider.compareFaces(mediaA, mediaB);
    expect(result.status).toBe("unavailable");
    expect(result.samePerson).toBeNull();
  });
});

describe("summarizeStepSignals", () => {
  const steps = [
    { kind: "face" as const, action: "turn_left", timeLimitMs: 6000 },
    { kind: "face" as const, action: "blink_twice", timeLimitMs: 6000 },
    { kind: "hand" as const, action: "victory", timeLimitMs: 6000 },
  ];

  it("reports everything unconfirmed when the analyzer produced no perStep data", () => {
    const summary = summarizeStepSignals(steps, undefined);
    expect(summary).toEqual({
      gestureRequested: "victory",
      gestureDetected: null,
      headMovementRequested: "turn_left",
      headMovementDetected: null,
      headMovementScore: null,
      blinkRequested: true,
      blinkDetected: null,
    });
  });

  it("reports confirmed detections when the analyzer matched every step", () => {
    const summary = summarizeStepSignals(steps, [
      {
        action: "turn_left",
        kind: "face",
        matched: true,
        declaredDetectedAtMs: 100,
        timingDiscrepancyMs: 10,
      },
      {
        action: "blink_twice",
        kind: "face",
        matched: true,
        declaredDetectedAtMs: 200,
        timingDiscrepancyMs: 5,
      },
      {
        action: "victory",
        kind: "hand",
        matched: true,
        declaredDetectedAtMs: 300,
        timingDiscrepancyMs: 20,
      },
    ]);
    expect(summary.gestureDetected).toBe("victory");
    expect(summary.headMovementDetected).toBe("turn_left");
    expect(summary.headMovementScore).toBe(1);
    expect(summary.blinkDetected).toBe(true);
  });

  it("reports a step as unmatched (not just unevaluated) when the analyzer explicitly says so", () => {
    const summary = summarizeStepSignals(steps, [
      {
        action: "turn_left",
        kind: "face",
        matched: false,
        declaredDetectedAtMs: 100,
        timingDiscrepancyMs: 900,
      },
      {
        action: "blink_twice",
        kind: "face",
        matched: false,
        declaredDetectedAtMs: null,
        timingDiscrepancyMs: null,
      },
      {
        action: "victory",
        kind: "hand",
        matched: false,
        declaredDetectedAtMs: null,
        timingDiscrepancyMs: null,
      },
    ]);
    expect(summary.headMovementScore).toBe(0);
    expect(summary.blinkDetected).toBe(false);
    expect(summary.gestureDetected).toBeNull();
  });

  it("reports no gesture/blink requested when the challenge never asked for one", () => {
    const summary = summarizeStepSignals(
      [{ kind: "face", action: "look_center", timeLimitMs: 6000 }],
      undefined,
    );
    expect(summary.gestureRequested).toBeNull();
    expect(summary.blinkRequested).toBe(false);
    expect(summary.headMovementRequested).toBe("look_center");
  });
});

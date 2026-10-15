import { describe, expect, it } from "vitest";
import { detectFakeScreenshotClaim } from "./fake-screenshot.js";

describe("detectFakeScreenshotClaim", () => {
  it("flags multiple phrases in FAKE_SCREENSHOT_PHRASES order", () => {
    expect(detectFakeScreenshotClaim("Mira la prueba, ya me pagaron!")).toEqual(
      {
        matched: true,
        phrases: ["mira la prueba", "ya me pagaron"],
      },
    );
  });

  it("is accent-insensitive on the input", () => {
    expect(
      detectFakeScreenshotClaim("Aquí está la prueba del comprobante"),
    ).toEqual({
      matched: true,
      phrases: ["comprobante", "aqui esta la prueba"],
    });
  });

  it("is case-insensitive", () => {
    expect(detectFakeScreenshotClaim("CAPTURA DE PAGO adjunta")).toEqual({
      matched: true,
      phrases: ["captura de pago"],
    });
  });

  it("deduplicates a repeated phrase", () => {
    expect(
      detectFakeScreenshotClaim("comprobante, comprobante y comprobante"),
    ).toEqual({
      matched: true,
      phrases: ["comprobante"],
    });
  });

  it("matches a single middle phrase", () => {
    expect(detectFakeScreenshotClaim("solo mira la prueba")).toEqual({
      matched: true,
      phrases: ["mira la prueba"],
    });
  });

  it("returns no match for clean text", () => {
    expect(detectFakeScreenshotClaim("hola, buenos dias a todos")).toEqual({
      matched: false,
      phrases: [],
    });
  });

  it("handles undefined", () => {
    expect(detectFakeScreenshotClaim(undefined)).toEqual({
      matched: false,
      phrases: [],
    });
  });

  it("handles empty string", () => {
    expect(detectFakeScreenshotClaim("")).toEqual({
      matched: false,
      phrases: [],
    });
  });

  it("preserves canonical order regardless of input order", () => {
    const result = detectFakeScreenshotClaim(
      "ya me pagaron y aqui esta la prueba, captura de pago incluida",
    );
    expect(result.phrases).toEqual([
      "captura de pago",
      "ya me pagaron",
      "aqui esta la prueba",
    ]);
  });

  it("is deterministic across repeated calls", () => {
    const input = "comprobante y mira la prueba";
    expect(detectFakeScreenshotClaim(input)).toEqual(
      detectFakeScreenshotClaim(input),
    );
  });
});

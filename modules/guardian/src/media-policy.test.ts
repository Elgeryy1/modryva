import { describe, expect, it } from "vitest";
import {
  defaultMediaPolicy,
  sniffMimeType,
  validateCapturedMedia,
  verifyDeclaredMime,
} from "./media-policy.js";

describe("validateCapturedMedia", () => {
  const ok = {
    mimeType: "video/mp4",
    sizeBytes: 2 * 1024 * 1024,
    durationMs: 4000,
    width: 720,
    height: 1280,
  };

  it("accepts a well-formed capture", () => {
    expect(validateCapturedMedia(ok)).toEqual({ ok: true });
  });

  it("rejects an oversized file", () => {
    expect(
      validateCapturedMedia({
        ...ok,
        sizeBytes: defaultMediaPolicy.maxSizeBytes + 1,
      }),
    ).toEqual({ ok: false, reason: "too-large" });
  });

  it("rejects a disallowed MIME type", () => {
    expect(
      validateCapturedMedia({ ...ok, mimeType: "application/pdf" }),
    ).toEqual({
      ok: false,
      reason: "mime-not-allowed",
    });
  });

  it("rejects a too-short capture", () => {
    expect(validateCapturedMedia({ ...ok, durationMs: 200 })).toEqual({
      ok: false,
      reason: "too-short",
    });
  });

  it("rejects a too-long capture", () => {
    expect(validateCapturedMedia({ ...ok, durationMs: 60_000 })).toEqual({
      ok: false,
      reason: "too-long",
    });
  });

  it("rejects a too-low resolution", () => {
    expect(validateCapturedMedia({ ...ok, width: 100, height: 100 })).toEqual({
      ok: false,
      reason: "resolution-too-low",
    });
  });

  // NaN comparisons are all false, so before the finite-guard these non-finite
  // fields silently passed every bound and returned ok:true — a hostile client
  // could bypass size/duration/resolution enforcement with malformed metadata.
  it("rejects a NaN duration instead of silently passing it", () => {
    expect(validateCapturedMedia({ ...ok, durationMs: Number.NaN })).toEqual({
      ok: false,
      reason: "too-short",
    });
  });

  it("rejects NaN width/height instead of silently passing them", () => {
    expect(
      validateCapturedMedia({ ...ok, width: Number.NaN, height: Number.NaN }),
    ).toEqual({ ok: false, reason: "resolution-too-low" });
  });

  it("rejects a non-finite size instead of silently passing it", () => {
    expect(
      validateCapturedMedia({ ...ok, sizeBytes: Number.POSITIVE_INFINITY }),
    ).toEqual({ ok: false, reason: "too-large" });
  });
});

describe("sniffMimeType", () => {
  it("recognizes JPEG magic bytes", () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0]);
    expect(sniffMimeType(bytes)).toBe("image/jpeg");
  });

  it("recognizes PNG magic bytes", () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(sniffMimeType(bytes)).toBe("image/png");
  });

  it("recognizes WebP (RIFF....WEBP)", () => {
    const bytes = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from("WEBP", "ascii"),
    ]);
    expect(sniffMimeType(bytes)).toBe("image/webp");
  });

  it("recognizes WebM/Matroska EBML header", () => {
    const bytes = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]);
    expect(sniffMimeType(bytes)).toBe("video/webm");
  });

  it("recognizes MP4 ISO-BMFF ftyp box", () => {
    const bytes = Buffer.concat([
      Buffer.from([0, 0, 0, 0x18]),
      Buffer.from("ftypisom", "ascii"),
    ]);
    expect(sniffMimeType(bytes)).toBe("video/mp4");
  });

  it("returns null for unrecognized bytes — callers must reject, not assume", () => {
    expect(
      sniffMimeType(Buffer.from("not a real media file", "ascii")),
    ).toBeNull();
  });
});

describe("verifyDeclaredMime", () => {
  it("flags a mismatch between declared and sniffed MIME (spoofed extension/header)", () => {
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const result = verifyDeclaredMime(pngBytes, "video/mp4");
    expect(result).toEqual({
      ok: true,
      mimeType: "image/png",
      matchesDeclared: false,
    });
  });

  it("confirms a match when declared and sniffed agree", () => {
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff]);
    const result = verifyDeclaredMime(jpegBytes, "image/jpeg");
    expect(result).toEqual({
      ok: true,
      mimeType: "image/jpeg",
      matchesDeclared: true,
    });
  });

  it("rejects bytes that match no known signature", () => {
    const result = verifyDeclaredMime(Buffer.from("garbage"), "image/jpeg");
    expect(result).toEqual({ ok: false, reason: "unrecognized-format" });
  });
});

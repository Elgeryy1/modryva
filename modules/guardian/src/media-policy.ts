/**
 * Media validation policy for Guardian Verification captures. Real MIME
 * sniffing from magic bytes (never trusting the client-declared MIME alone),
 * plus size/duration/resolution bounds enforcement.
 */

export interface MediaPolicy {
  readonly maxSizeBytes: number;
  readonly allowedMimeTypes: readonly string[];
  readonly minDurationMs: number;
  readonly maxDurationMs: number;
  readonly minWidth: number;
  readonly minHeight: number;
}

export const defaultMediaPolicy: MediaPolicy = {
  maxSizeBytes: 25 * 1024 * 1024,
  allowedMimeTypes: [
    "video/mp4",
    "video/webm",
    "image/jpeg",
    "image/png",
    "image/webp",
  ],
  minDurationMs: 1_500,
  maxDurationMs: 8_000,
  minWidth: 240,
  minHeight: 240,
};

export interface MediaMetadata {
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly durationMs?: number;
  readonly width?: number;
  readonly height?: number;
}

export type MediaValidation =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "too-large"
        | "mime-not-allowed"
        | "too-short"
        | "too-long"
        | "resolution-too-low"
        | "mime-mismatch";
    };

export const validateCapturedMedia = (
  metadata: MediaMetadata,
  policy: MediaPolicy = defaultMediaPolicy,
): MediaValidation => {
  // Non-finite numeric metadata (NaN/Infinity — e.g. from a failed Number()
  // coercion of a hostile client-supplied width/height/duration) must never
  // satisfy a bound: every comparison against NaN is false, so the unguarded
  // `NaN > max` / `NaN < min` checks below would silently pass and return
  // ok:true, defeating the whole point of this validator. Treat any non-finite
  // field as a violation of the bound it was meant to satisfy.
  if (
    !Number.isFinite(metadata.sizeBytes) ||
    metadata.sizeBytes > policy.maxSizeBytes
  ) {
    return { ok: false, reason: "too-large" };
  }
  if (!policy.allowedMimeTypes.includes(metadata.mimeType)) {
    return { ok: false, reason: "mime-not-allowed" };
  }
  if (metadata.durationMs !== undefined) {
    if (
      !Number.isFinite(metadata.durationMs) ||
      metadata.durationMs < policy.minDurationMs
    ) {
      return { ok: false, reason: "too-short" };
    }
    if (metadata.durationMs > policy.maxDurationMs) {
      return { ok: false, reason: "too-long" };
    }
  }
  if (
    metadata.width !== undefined &&
    metadata.height !== undefined &&
    (!Number.isFinite(metadata.width) ||
      !Number.isFinite(metadata.height) ||
      metadata.width < policy.minWidth ||
      metadata.height < policy.minHeight)
  ) {
    return { ok: false, reason: "resolution-too-low" };
  }
  return { ok: true };
};

// --- Real MIME sniffing from magic bytes (never trust the declared MIME alone) ---

const startsWith = (bytes: Buffer, signature: readonly number[]): boolean => {
  if (bytes.length < signature.length) {
    return false;
  }
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[i] !== signature[i]) {
      return false;
    }
  }
  return true;
};

const asciiAt = (bytes: Buffer, offset: number, text: string): boolean =>
  bytes.length >= offset + text.length &&
  bytes.subarray(offset, offset + text.length).toString("ascii") === text;

/**
 * Sniffs the real MIME type from magic bytes for the formats Guardian
 * Verification accepts. Returns `null` when the bytes don't match any known
 * signature — callers must treat that as "reject", never "assume declared".
 */
export const sniffMimeType = (bytes: Buffer): string | null => {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WEBP")) {
    return "image/webp";
  }
  // Matroska/WebM: EBML header 0x1A45DFA3.
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
    return "video/webm";
  }
  // ISO-BMFF (MP4): 4-byte size, then ASCII "ftyp" at offset 4.
  if (asciiAt(bytes, 4, "ftyp")) {
    return "video/mp4";
  }
  return null;
};

export type MimeSniffResult =
  | {
      readonly ok: true;
      readonly mimeType: string;
      readonly matchesDeclared: boolean;
    }
  | { readonly ok: false; readonly reason: "unrecognized-format" };

export const verifyDeclaredMime = (
  bytes: Buffer,
  declaredMimeType: string,
): MimeSniffResult => {
  const sniffed = sniffMimeType(bytes);
  if (!sniffed) {
    return { ok: false, reason: "unrecognized-format" };
  }
  return {
    ok: true,
    mimeType: sniffed,
    matchesDeclared: sniffed === declaredMimeType,
  };
};

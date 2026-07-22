import { describe, expect, it } from "vitest";
import {
  EMPTY_BODY_SHA256,
  signS3ObjectRequest,
  UNSIGNED_PAYLOAD,
} from "./s3-signer.js";

const config = {
  accessKeyId: "AKIAEXAMPLE",
  secretAccessKey: "secretkeyexample1234567890",
  region: "eu-west-1",
  endpoint: "https://s3.eu-west-1.amazonaws.com",
};

const fixedNow = new Date("2026-07-13T12:00:00Z");

describe("signS3ObjectRequest", () => {
  it("produces a deterministic signature for the same inputs and clock", () => {
    const a = signS3ObjectRequest(config, {
      method: "GET",
      bucket: "guardian-media",
      key: "sessions/abc/attempt-1.mp4",
      now: fixedNow,
    });
    const b = signS3ObjectRequest(config, {
      method: "GET",
      bucket: "guardian-media",
      key: "sessions/abc/attempt-1.mp4",
      now: fixedNow,
    });
    expect(a).toEqual(b);
  });

  it("changes the signature when the secret key changes", () => {
    const a = signS3ObjectRequest(config, {
      method: "GET",
      bucket: "guardian-media",
      key: "k",
      now: fixedNow,
    });
    const b = signS3ObjectRequest(
      { ...config, secretAccessKey: "different-secret" },
      { method: "GET", bucket: "guardian-media", key: "k", now: fixedNow },
    );
    expect(a.headers.authorization).not.toBe(b.headers.authorization);
  });

  it("changes the signature when the object key changes", () => {
    const a = signS3ObjectRequest(config, {
      method: "GET",
      bucket: "guardian-media",
      key: "k1",
      now: fixedNow,
    });
    const b = signS3ObjectRequest(config, {
      method: "GET",
      bucket: "guardian-media",
      key: "k2",
      now: fixedNow,
    });
    expect(a.headers.authorization).not.toBe(b.headers.authorization);
  });

  it("builds a virtual-hosted-style URL with the bucket as a subdomain", () => {
    const signed = signS3ObjectRequest(config, {
      method: "GET",
      bucket: "guardian-media",
      key: "sessions/x.mp4",
      now: fixedNow,
    });
    expect(signed.url).toBe(
      "https://guardian-media.s3.eu-west-1.amazonaws.com/sessions/x.mp4",
    );
  });

  it("defaults GET/DELETE to the well-known empty-body SHA-256", () => {
    const signed = signS3ObjectRequest(config, {
      method: "DELETE",
      bucket: "b",
      key: "k",
      now: fixedNow,
    });
    expect(signed.headers["x-amz-content-sha256"]).toBe(EMPTY_BODY_SHA256);
  });

  it("supports UNSIGNED-PAYLOAD for PUT uploads", () => {
    const signed = signS3ObjectRequest(config, {
      method: "PUT",
      bucket: "b",
      key: "k",
      payloadHash: UNSIGNED_PAYLOAD,
      contentType: "video/mp4",
      now: fixedNow,
    });
    expect(signed.headers["x-amz-content-sha256"]).toBe(UNSIGNED_PAYLOAD);
    expect(signed.headers["content-type"]).toBe("video/mp4");
  });

  it("includes an AWS4-HMAC-SHA256 Authorization header with the expected credential scope", () => {
    const signed = signS3ObjectRequest(config, {
      method: "GET",
      bucket: "b",
      key: "k",
      now: fixedNow,
    });
    expect(signed.headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=/,
    );
    expect(signed.headers.authorization).toContain(
      "AKIAEXAMPLE/20260713/eu-west-1/s3/aws4_request",
    );
    expect(signed.headers.authorization).toContain("SignedHeaders=");
    expect(signed.headers.authorization).toContain("Signature=");
  });

  it("URL-encodes special characters in the object key", () => {
    const signed = signS3ObjectRequest(config, {
      method: "GET",
      bucket: "b",
      key: "sessions/with space/file name.mp4",
      now: fixedNow,
    });
    expect(signed.url).toContain("with%20space");
    expect(signed.url).toContain("file%20name.mp4");
  });
});

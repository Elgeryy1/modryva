import { describe, expect, it } from "vitest";
import {
  computeSessionIdempotencyKey,
  decryptJoinRequestQueryId,
  encryptJoinRequestQueryId,
  generateChallengeNonce,
  generateSessionToken,
  hashSessionToken,
  signStaffCallbackId,
  verifyStaffCallbackId,
} from "./session-crypto.js";

describe("session-crypto", () => {
  it("generates unique, sufficiently long opaque session tokens", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it("hashes tokens deterministically but not reversibly", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toBe(token);
  });

  it("generates a fresh single-use nonce every call", () => {
    const nonces = new Set(Array.from({ length: 20 }, generateChallengeNonce));
    expect(nonces.size).toBe(20);
  });

  it("derives a stable idempotency key for the same chat+user", () => {
    const a = computeSessionIdempotencyKey("chat-1", 42n);
    const b = computeSessionIdempotencyKey("chat-1", 42n);
    const c = computeSessionIdempotencyKey("chat-2", 42n);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("round-trips an encrypted join request query_id", () => {
    const secret = "test-secret-value-1234567890";
    const encrypted = encryptJoinRequestQueryId("jrq-abc123", secret);
    const decrypted = decryptJoinRequestQueryId(encrypted, secret);
    expect(decrypted).toEqual({ ok: true, queryId: "jrq-abc123" });
  });

  it("never stores the query_id in plaintext inside the ciphertext blob", () => {
    const secret = "test-secret-value-1234567890";
    const encrypted = encryptJoinRequestQueryId("jrq-super-secret", secret);
    expect(encrypted).not.toContain("jrq-super-secret");
  });

  it("rejects decryption with the wrong secret", () => {
    const encrypted = encryptJoinRequestQueryId("jrq-abc123", "secret-a");
    const decrypted = decryptJoinRequestQueryId(encrypted, "secret-b");
    expect(decrypted.ok).toBe(false);
  });

  it("rejects a malformed ciphertext blob", () => {
    expect(decryptJoinRequestQueryId("not-valid", "secret").ok).toBe(false);
    expect(decryptJoinRequestQueryId("a:b", "secret").ok).toBe(false);
  });

  it("decrypts a query_id with the PREVIOUS secret during a rotation window", () => {
    const oldSecret = "old-session-secret-1234567890";
    const newSecret = "new-session-secret-0987654321";
    // Encrypted before rotation (old secret); read after switching primary.
    const encrypted = encryptJoinRequestQueryId("jrq-inflight", oldSecret);
    const decrypted = decryptJoinRequestQueryId(
      encrypted,
      newSecret,
      oldSecret,
    );
    expect(decrypted).toEqual({ ok: true, queryId: "jrq-inflight" });
  });

  it("decrypts a query_id with the PRIMARY secret even when a previous is supplied", () => {
    const oldSecret = "old-session-secret-1234567890";
    const newSecret = "new-session-secret-0987654321";
    const encrypted = encryptJoinRequestQueryId("jrq-fresh", newSecret);
    expect(decryptJoinRequestQueryId(encrypted, newSecret, oldSecret)).toEqual({
      ok: true,
      queryId: "jrq-fresh",
    });
  });

  it("STOPS decrypting old-secret ciphertext once the previous secret is removed", () => {
    const oldSecret = "old-session-secret-1234567890";
    const newSecret = "new-session-secret-0987654321";
    const encrypted = encryptJoinRequestQueryId("jrq-inflight", oldSecret);
    // No previous secret passed = post-retirement: must fail closed.
    expect(decryptJoinRequestQueryId(encrypted, newSecret).ok).toBe(false);
  });

  it("returns not-ok (no key oracle) when neither primary nor previous matches", () => {
    const encrypted = encryptJoinRequestQueryId("jrq-x", "some-other-secret");
    const result = decryptJoinRequestQueryId(
      encrypted,
      "new-session-secret-0987654321",
      "old-session-secret-1234567890",
    );
    // Surfaces the primary's error variant, never which key was tried.
    expect(result).toEqual({ ok: false, error: "auth-failed" });
  });

  it("does not fall back to the previous secret on a MALFORMED blob", () => {
    const result = decryptJoinRequestQueryId(
      "not-valid",
      "new-session-secret-0987654321",
      "old-session-secret-1234567890",
    );
    expect(result).toEqual({ ok: false, error: "malformed" });
  });

  it("signs and verifies staff callback ids, and rejects tampering", () => {
    const secret = "staff-secret";
    const signed = signStaffCallbackId("sess-1", "approve", secret);
    expect(verifyStaffCallbackId("sess-1", "approve", signed, secret)).toBe(
      true,
    );
    expect(verifyStaffCallbackId("sess-1", "decline", signed, secret)).toBe(
      false,
    );
    expect(verifyStaffCallbackId("sess-2", "approve", signed, secret)).toBe(
      false,
    );
    expect(verifyStaffCallbackId("sess-1", "approve", signed, "wrong")).toBe(
      false,
    );
  });
});

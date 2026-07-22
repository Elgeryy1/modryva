import { describe, expect, it } from "vitest";
import {
  ANNOUNCEMENT_DEFAULT_TTL_MS,
  computeAnnouncementExpiry,
  shouldUnpinAnnouncement,
} from "./announcement-expiry.js";

describe("computeAnnouncementExpiry", () => {
  it("adds the default 7-day ttl when no options given", () => {
    expect(computeAnnouncementExpiry(1000)).toBe(
      1000 + ANNOUNCEMENT_DEFAULT_TTL_MS,
    );
  });
  it("uses a custom ttlMs when provided", () => {
    expect(computeAnnouncementExpiry(1000, { ttlMs: 5000 })).toBe(6000);
  });
  it("treats a pinnedAt of 0 as an origin plus ttl", () => {
    expect(computeAnnouncementExpiry(0, { ttlMs: 5000 })).toBe(5000);
  });
  it("clamps a negative ttl to 0 (immediate expiry)", () => {
    expect(computeAnnouncementExpiry(1000, { ttlMs: -5000 })).toBe(1000);
  });
  it("is deterministic across repeated calls", () => {
    const a = computeAnnouncementExpiry(42, { ttlMs: 999 });
    const b = computeAnnouncementExpiry(42, { ttlMs: 999 });
    expect(a).toBe(b);
    expect(a).toBe(1041);
  });
});

describe("shouldUnpinAnnouncement", () => {
  it("returns false before expiry with default ttl", () => {
    expect(shouldUnpinAnnouncement(0, ANNOUNCEMENT_DEFAULT_TTL_MS - 1)).toBe(
      false,
    );
  });
  it("returns true exactly at expiry (boundary is inclusive)", () => {
    expect(shouldUnpinAnnouncement(0, ANNOUNCEMENT_DEFAULT_TTL_MS)).toBe(true);
  });
  it("returns true after expiry", () => {
    expect(shouldUnpinAnnouncement(0, ANNOUNCEMENT_DEFAULT_TTL_MS + 1)).toBe(
      true,
    );
  });
  it("honors a custom ttl at the boundary", () => {
    expect(shouldUnpinAnnouncement(1000, 6000, { ttlMs: 5000 })).toBe(true);
    expect(shouldUnpinAnnouncement(1000, 5999, { ttlMs: 5000 })).toBe(false);
  });
  it("unpins immediately when ttl is clamped to 0", () => {
    expect(shouldUnpinAnnouncement(1000, 1000, { ttlMs: -1 })).toBe(true);
  });
});

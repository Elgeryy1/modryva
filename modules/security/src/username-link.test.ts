import { describe, expect, it } from "vitest";
import { detectUsernameLink } from "./username-link.js";

describe("detectUsernameLink", () => {
  it("flags an embedded .xyz domain", () => {
    expect(detectUsernameLink("CryptoKing.xyz")).toEqual({
      matched: true,
      hits: [".xyz"],
    });
  });

  it("flags a full http t.me link in marker order", () => {
    expect(detectUsernameLink("http://t.me/spam.com")).toEqual({
      matched: true,
      hits: ["http", "t.me", ".com"],
    });
  });

  it("orders hits by LINK_MARKERS, not by appearance in the username", () => {
    expect(detectUsernameLink("buy.xyz.com")).toEqual({
      matched: true,
      hits: [".com", ".xyz"],
    });
  });

  it("is case-insensitive", () => {
    expect(detectUsernameLink("SHOP.IO")).toEqual({
      matched: true,
      hits: [".io"],
    });
  });

  it("deduplicates repeated markers", () => {
    expect(detectUsernameLink("a.com.b.com")).toEqual({
      matched: true,
      hits: [".com"],
    });
  });

  it("detects a leading @ handle with a domain", () => {
    expect(detectUsernameLink("@promo.io")).toEqual({
      matched: true,
      hits: [".io"],
    });
  });

  it("returns no match for a clean username", () => {
    expect(detectUsernameLink("demo_user17")).toEqual({
      matched: false,
      hits: [],
    });
  });

  it("returns no match for a username with dots but no known marker", () => {
    expect(detectUsernameLink("john.doe.dev")).toEqual({
      matched: false,
      hits: [],
    });
  });

  it("handles an empty string", () => {
    expect(detectUsernameLink("")).toEqual({ matched: false, hits: [] });
  });

  it("handles undefined", () => {
    expect(detectUsernameLink(undefined)).toEqual({ matched: false, hits: [] });
  });

  it("is deterministic across repeated calls", () => {
    const input = "http.spam.io.xyz";
    const first = detectUsernameLink(input);
    const second = detectUsernameLink(input);
    expect(first).toEqual(second);
    expect(first).toEqual({ matched: true, hits: ["http", ".io", ".xyz"] });
  });
});

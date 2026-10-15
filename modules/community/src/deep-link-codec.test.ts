import { describe, expect, it } from "vitest";
import {
  type DeepLinkKind,
  type DeepLinkTarget,
  decodeDeepLink,
  encodeDeepLink,
  isSafeDeepLinkId,
} from "./deep-link-codec.js";

const target = (kind: DeepLinkKind, id: string): DeepLinkTarget => ({
  kind,
  id,
});

describe("encodeDeepLink", () => {
  it("uses the c_ prefix for cases", () => {
    expect(encodeDeepLink(target("case", "42"))).toBe("c_42");
  });

  it("uses the u_ prefix for users", () => {
    expect(encodeDeepLink(target("user", "1001"))).toBe("u_1001");
  });

  it("uses the g_ prefix for groups", () => {
    expect(encodeDeepLink(target("group", "-100987"))).toBe("g_-100987");
  });

  it("preserves ids that contain underscores", () => {
    expect(encodeDeepLink(target("case", "ab_cd_ef"))).toBe("c_ab_cd_ef");
  });
});

describe("decodeDeepLink", () => {
  it("decodes a case payload", () => {
    expect(decodeDeepLink("c_42")).toEqual(target("case", "42"));
  });

  it("decodes a user payload", () => {
    expect(decodeDeepLink("u_1001")).toEqual(target("user", "1001"));
  });

  it("decodes a group payload with a negative id", () => {
    expect(decodeDeepLink("g_-100987")).toEqual(target("group", "-100987"));
  });

  it("keeps every char after the first separator as the id", () => {
    expect(decodeDeepLink("c_ab_cd_ef")).toEqual(target("case", "ab_cd_ef"));
  });

  it("returns null for an unknown prefix", () => {
    expect(decodeDeepLink("x_42")).toBeNull();
  });

  it("returns null when the separator is missing", () => {
    expect(decodeDeepLink("c42")).toBeNull();
    expect(decodeDeepLink("cx42")).toBeNull();
  });

  it("returns null for an empty id", () => {
    expect(decodeDeepLink("c_")).toBeNull();
  });

  it("returns null for empty or too-short payloads", () => {
    expect(decodeDeepLink("")).toBeNull();
    expect(decodeDeepLink("c")).toBeNull();
    expect(decodeDeepLink("c_")).toBeNull();
  });

  it("returns null when the id carries unsafe characters", () => {
    expect(decodeDeepLink("c_hola mundo")).toBeNull();
    expect(decodeDeepLink("u_a/b")).toBeNull();
    expect(decodeDeepLink("g_a.b")).toBeNull();
    expect(decodeDeepLink("c_ñ")).toBeNull();
  });

  it("requires the prefix letter to be exactly at position 0", () => {
    expect(decodeDeepLink("_c_42")).toBeNull();
    expect(decodeDeepLink(" c_42")).toBeNull();
  });
});

describe("isSafeDeepLinkId", () => {
  it("accepts alphanumerics, underscores and hyphens", () => {
    expect(isSafeDeepLinkId("42")).toBe(true);
    expect(isSafeDeepLinkId("-100987")).toBe(true);
    expect(isSafeDeepLinkId("ab_CD-99")).toBe(true);
  });

  it("rejects empty ids and unsafe characters", () => {
    expect(isSafeDeepLinkId("")).toBe(false);
    expect(isSafeDeepLinkId("a b")).toBe(false);
    expect(isSafeDeepLinkId("a/b")).toBe(false);
    expect(isSafeDeepLinkId("ñ")).toBe(false);
  });
});

describe("round-trip", () => {
  const kinds: readonly DeepLinkKind[] = ["case", "user", "group"];
  const ids: readonly string[] = ["1", "42", "-100987", "ab_cd", "X-9_z", "0"];

  for (const kind of kinds) {
    for (const id of ids) {
      it(`decode(encode) is identity for ${kind}/${id}`, () => {
        const original = target(kind, id);
        const encoded = encodeDeepLink(original);
        expect(decodeDeepLink(encoded)).toEqual(original);
      });
    }
  }

  it("is stable: encoding twice yields the same payload", () => {
    const original = target("group", "-100987");
    expect(encodeDeepLink(original)).toBe(encodeDeepLink(original));
  });

  it("encode then decode then encode is a fixed point", () => {
    const encoded = encodeDeepLink(target("user", "555"));
    const decoded = decodeDeepLink(encoded);
    expect(decoded).not.toBeNull();
    const roundTripped = decoded === null ? "" : encodeDeepLink(decoded);
    expect(roundTripped).toBe(encoded);
  });
});

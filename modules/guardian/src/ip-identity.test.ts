import { describe, expect, it } from "vitest";
import {
  findIpMatches,
  formatIpMatchWarning,
  type IpNeighbour,
  ipIdentity,
} from "./ip-identity.js";

describe("ipIdentity", () => {
  it("compares IPv4 exactly", () => {
    expect(ipIdentity("83.54.168.230")).toEqual({
      key: "83.54.168.230",
      strength: "exact",
    });
    expect(ipIdentity("83.54.168.230")?.key).not.toBe(
      ipIdentity("83.54.168.231")?.key,
    );
  });

  it("collapses IPv6 to its /64 so the same phone still matches hours later", () => {
    // Privacy extensions rotate the host part; the /64 is the subscriber line.
    const morning = ipIdentity("2a02:9130:88c1:4e00:1c2d:9f01:aaaa:bbbb");
    const evening = ipIdentity("2a02:9130:88c1:4e00:7788:1122:cccc:dddd");
    expect(morning?.key).toBe(evening?.key);
    expect(morning?.strength).toBe("network");
  });

  it("keeps different IPv6 subscribers apart", () => {
    expect(ipIdentity("2a02:9130:88c1:4e00::1")?.key).not.toBe(
      ipIdentity("2a02:9130:88c1:9999::1")?.key,
    );
  });

  it("groups a compressed IPv6 with its own /64", () => {
    expect(ipIdentity("2a02:9130::1")?.key).toBe(
      ipIdentity("2a02:9130::2")?.key,
    );
  });

  it("ignores an IPv6 zone id", () => {
    expect(ipIdentity("2a02:9130:88c1:4e00::1%eth0")?.key).toBe(
      ipIdentity("2a02:9130:88c1:4e00::2")?.key,
    );
  });

  it("returns null for junk rather than matching everything", () => {
    for (const junk of ["", "   ", "not-an-ip", null, undefined]) {
      expect(ipIdentity(junk)).toBeNull();
    }
  });
});

const neighbour = (
  telegramUserId: string,
  ip: string,
  lastSeen: string,
  displayName = `user-${telegramUserId}`,
): IpNeighbour => ({
  telegramUserId,
  displayName,
  ip,
  lastSeen: new Date(lastSeen),
});

describe("findIpMatches", () => {
  it("finds another person on the exact same IPv4", () => {
    const matches = findIpMatches("83.54.168.230", "1", [
      neighbour("2", "83.54.168.230", "2026-07-25T10:00:00Z", "Pepe"),
    ]);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.displayName).toBe("Pepe");
    expect(matches[0]?.strength).toBe("exact");
  });

  it("never reports the same person as their own multi-account", () => {
    const matches = findIpMatches("83.54.168.230", "1", [
      neighbour("1", "83.54.168.230", "2026-07-25T10:00:00Z"),
    ]);
    expect(matches).toEqual([]);
  });

  it("matches a different IPv6 in the same /64 as a weaker 'network' hit", () => {
    const matches = findIpMatches("2a02:9130:88c1:4e00:1111::1", "1", [
      neighbour("2", "2a02:9130:88c1:4e00:9999::5", "2026-07-25T10:00:00Z"),
    ]);
    expect(matches[0]?.strength).toBe("network");
  });

  it("reports one entry per person, keeping their most recent sighting", () => {
    const matches = findIpMatches("10.0.0.1", "1", [
      neighbour("2", "10.0.0.1", "2026-07-20T10:00:00Z"),
      neighbour("2", "10.0.0.1", "2026-07-25T10:00:00Z"),
    ]);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.lastSeen.toISOString()).toBe("2026-07-25T10:00:00.000Z");
  });

  it("returns nothing when the current session has no usable IP", () => {
    expect(
      findIpMatches(null, "1", [
        neighbour("2", "10.0.0.1", "2026-07-25T10:00:00Z"),
      ]),
    ).toEqual([]);
  });

  it("orders the freshest overlap first", () => {
    const matches = findIpMatches("10.0.0.1", "1", [
      neighbour("2", "10.0.0.1", "2026-07-20T10:00:00Z", "Viejo"),
      neighbour("3", "10.0.0.1", "2026-07-25T10:00:00Z", "Nuevo"),
    ]);
    expect(matches.map((m) => m.displayName)).toEqual(["Nuevo", "Viejo"]);
  });
});

describe("formatIpMatchWarning", () => {
  it("says nothing at all when there is no overlap", () => {
    // Deliberately not "no multi-account detected" — this check cannot promise that.
    expect(formatIpMatchWarning([])).toBeNull();
  });

  it("names the people and warns that a shared IP is not proof", () => {
    const text = formatIpMatchWarning([
      {
        telegramUserId: "2",
        displayName: "@pepe",
        ip: "10.0.0.1",
        lastSeen: new Date(),
        strength: "exact",
      },
    ]);
    expect(text).toContain("@pepe");
    expect(text).toContain("MULTICUENTA");
    expect(text).toContain("mismo WiFi");
  });

  it("marks a /64-only hit as the weaker 'misma red'", () => {
    const text = formatIpMatchWarning([
      {
        telegramUserId: "2",
        displayName: "@pepe",
        ip: "2a02::1",
        lastSeen: new Date(),
        strength: "network",
      },
    ]);
    expect(text).toContain("misma red");
  });

  it("summarises the tail instead of listing everyone", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      telegramUserId: String(i + 2),
      displayName: `@u${i}`,
      ip: "10.0.0.1",
      lastSeen: new Date(),
      strength: "exact" as const,
    }));
    expect(formatIpMatchWarning(many)).toContain("y 3 más");
  });
});

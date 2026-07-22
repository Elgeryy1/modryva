import { describe, expect, it } from "vitest";
import { assertPublicHttpUrl, isPrivateIp } from "./url-guard.js";

describe("isPrivateIp", () => {
  it("flags loopback, private, link-local and reserved ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "172.16.5.4",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata
      "100.64.0.1", // CGNAT
      "0.0.0.0",
      "224.0.0.1", // multicast
      "::1",
      "fe80::1",
      "fd00::1",
      "::ffff:10.0.0.1", // IPv4-mapped private
    ]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700::1"]) {
      expect(isPrivateIp(ip)).toBe(false);
    }
  });
});

describe("assertPublicHttpUrl", () => {
  it("rejects non-http(s) schemes", async () => {
    for (const raw of ["ftp://x/", "file:///etc/passwd", "gopher://x"]) {
      await expect(assertPublicHttpUrl(raw)).rejects.toThrow("scheme");
    }
  });

  it("rejects private/loopback/metadata IP literals (no DNS needed)", async () => {
    for (const raw of [
      "http://169.254.169.254/latest/meta-data/",
      "http://127.0.0.1:3001/v1/",
      "http://10.0.0.5/",
      "http://[::1]:6379/",
      "https://192.168.0.10/admin",
    ]) {
      await expect(assertPublicHttpUrl(raw)).rejects.toThrow(/ssrf-blocked/u);
    }
  });

  it("allows a public IP literal", async () => {
    await expect(
      assertPublicHttpUrl("http://93.184.216.34/"),
    ).resolves.toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { HttpSpamCheckProvider } from "./spam-check.js";

const jsonResponse = (body: unknown, ok = true): Response =>
  ({
    ok,
    json: async () => body,
  }) as unknown as Response;

describe("HttpSpamCheckProvider", () => {
  it("queries the configured endpoint with the user id and returns true when banned", async () => {
    let calledUrl = "";
    const fetcher = (async (url: string) => {
      calledUrl = url;
      return jsonResponse({ ok: true, result: { banned: true } });
    }) as unknown as typeof fetch;

    const provider = new HttpSpamCheckProvider(
      "https://example.test/check",
      fetcher,
    );
    const result = await provider.isKnownSpammer(123456789n);

    expect(calledUrl).toBe("https://example.test/check?user_id=123456789");
    expect(result).toBe(true);
  });

  it("returns false when the user is not in the ban list", async () => {
    const fetcher = (async () =>
      jsonResponse({
        ok: false,
        error: "record not found",
      })) as unknown as typeof fetch;

    const provider = new HttpSpamCheckProvider("https://x.test", fetcher);
    expect(await provider.isKnownSpammer(1n)).toBe(false);
  });

  it("fails open (false) on a non-ok response", async () => {
    const fetcher = (async () =>
      jsonResponse({}, false)) as unknown as typeof fetch;

    const provider = new HttpSpamCheckProvider("https://x.test", fetcher);
    expect(await provider.isKnownSpammer(1n)).toBe(false);
  });

  it("fails open (false) when the request throws", async () => {
    const fetcher = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const provider = new HttpSpamCheckProvider("https://x.test", fetcher);
    expect(await provider.isKnownSpammer(1n)).toBe(false);
  });
});

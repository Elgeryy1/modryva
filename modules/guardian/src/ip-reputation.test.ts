import { describe, expect, it } from "vitest";
import { checkIpReputation, parseProxyCheckResponse } from "./ip-reputation.js";

describe("parseProxyCheckResponse", () => {
  it("reads a flagged VPN with type + risk", () => {
    expect(
      parseProxyCheckResponse("1.2.3.4", {
        status: "ok",
        "1.2.3.4": { proxy: "yes", type: "VPN", risk: 66 },
      }),
    ).toEqual({ proxy: true, type: "VPN", risk: 66 });
  });

  it("reads a clean IP", () => {
    expect(
      parseProxyCheckResponse("1.2.3.4", {
        status: "ok",
        "1.2.3.4": { proxy: "no", risk: 0 },
      }),
    ).toEqual({ proxy: false, type: null, risk: 0 });
  });

  it("returns null on a non-ok status or a missing entry", () => {
    expect(parseProxyCheckResponse("1.2.3.4", { status: "denied" })).toBeNull();
    expect(parseProxyCheckResponse("1.2.3.4", { status: "ok" })).toBeNull();
    expect(parseProxyCheckResponse("1.2.3.4", null)).toBeNull();
  });
});

describe("checkIpReputation", () => {
  it("resolves null when the request throws (best-effort, never rejects)", async () => {
    const res = await checkIpReputation("1.2.3.4", {
      fetchImpl: (async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch,
    });
    expect(res).toBeNull();
  });

  it("parses a successful proxycheck response", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          status: "ok",
          "9.9.9.9": { proxy: "yes", type: "TOR", risk: 100 },
        }),
        { status: 200 },
      )) as unknown as typeof fetch;
    const res = await checkIpReputation("9.9.9.9", { fetchImpl });
    expect(res).toEqual({ proxy: true, type: "TOR", risk: 100 });
  });
});

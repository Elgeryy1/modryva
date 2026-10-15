import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyTelegramInitData } from "./telegram-init-data.js";

const signInitData = (raw: Record<string, string>, botToken: string) => {
  const dataCheckString = Object.entries(raw)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const hash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return new URLSearchParams({ ...raw, hash }).toString();
};

describe("verifyTelegramInitData", () => {
  it("validates signed Mini App initData", () => {
    const botToken = "123456:test-token";
    const initData = signInitData(
      {
        auth_date: "1710000000",
        query_id: "query-1",
        user: JSON.stringify({ id: 42, username: "gerard" }),
      },
      botToken,
    );

    expect(verifyTelegramInitData(initData, botToken)).toMatchObject({
      ok: true,
      authDate: 1710000000,
      queryId: "query-1",
      user: { id: 42, username: "gerard" },
      error: undefined,
    });
  });

  it("rejects tampered initData", () => {
    const botToken = "123456:test-token";
    const initData = signInitData(
      { auth_date: "1710000000", query_id: "query-1" },
      botToken,
    );

    expect(
      verifyTelegramInitData(`${initData}&extra=tampered`, botToken),
    ).toMatchObject({
      ok: false,
      error: "invalid-hash",
    });
  });

  const botToken = "123456:test-token";
  const AUTH = 1_710_000_000; // unix seconds baked into the signed fixtures

  it("accepts fresh initData within maxAgeSeconds", () => {
    const initData = signInitData({ auth_date: String(AUTH) }, botToken);
    expect(
      verifyTelegramInitData(initData, botToken, {
        maxAgeSeconds: 3600,
        now: AUTH + 1800, // 30 min later
      }),
    ).toMatchObject({ ok: true, authDate: AUTH, error: undefined });
  });

  it("rejects initData older than maxAgeSeconds", () => {
    const initData = signInitData({ auth_date: String(AUTH) }, botToken);
    expect(
      verifyTelegramInitData(initData, botToken, {
        maxAgeSeconds: 3600,
        now: AUTH + 7200, // 2 h later
      }),
    ).toMatchObject({ ok: false, error: "auth-date-expired" });
  });

  it("rejects initData without auth_date when freshness is enforced", () => {
    const initData = signInitData({ query_id: "q" }, botToken);
    expect(
      verifyTelegramInitData(initData, botToken, {
        maxAgeSeconds: 3600,
        now: AUTH,
      }),
    ).toMatchObject({ ok: false, error: "missing-auth-date" });
  });

  it("does not enforce freshness when maxAgeSeconds is omitted", () => {
    const initData = signInitData({ auth_date: String(AUTH) }, botToken);
    expect(
      verifyTelegramInitData(initData, botToken, { now: AUTH + 999_999 }),
    ).toMatchObject({ ok: true, error: undefined });
  });
});

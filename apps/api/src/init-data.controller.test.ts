import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { InitDataController } from "./init-data.controller.js";

// Forge a validly-HMAC-signed initData string for a known bot token, mirroring
// the signing Telegram itself does (secret = HMAC("WebAppData", token)).
const sign = (params: Record<string, string>, botToken: string): string => {
  const dataCheckString = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const hash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");
  return new URLSearchParams({ ...params, hash }).toString();
};

const TOKEN = "123456:test-token";

const withEnv = (fn: () => void) => {
  const prevToken = process.env.TELEGRAM_BOT_TOKEN;
  const prevAge = process.env.INITDATA_MAX_AGE_SECONDS;
  process.env.TELEGRAM_BOT_TOKEN = TOKEN;
  process.env.INITDATA_MAX_AGE_SECONDS = "3600";
  try {
    fn();
  } finally {
    if (prevToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = prevToken;
    if (prevAge === undefined) delete process.env.INITDATA_MAX_AGE_SECONDS;
    else process.env.INITDATA_MAX_AGE_SECONDS = prevAge;
  }
};

describe("InitDataController.verify enforces auth_date freshness", () => {
  it("rejects a validly-signed but STALE initData (replay window closed)", () => {
    withEnv(() => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const stale = sign(
        { auth_date: String(nowSeconds - 7200), query_id: "q" },
        TOKEN,
      );
      const controller = new InitDataController();
      // Before the fix this endpoint checked only the HMAC and returned ok:true
      // for a two-hour-old (captured) initData.
      expect(controller.verify({ initData: stale })).toMatchObject({
        ok: false,
        error: "auth-date-expired",
      });
    });
  });

  it("accepts a validly-signed FRESH initData", () => {
    withEnv(() => {
      const fresh = sign(
        { auth_date: String(Math.floor(Date.now() / 1000)), query_id: "q" },
        TOKEN,
      );
      const controller = new InitDataController();
      expect(controller.verify({ initData: fresh })).toMatchObject({
        ok: true,
      });
    });
  });
});

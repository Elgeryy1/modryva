import { describe, expect, it } from "vitest";
import {
  getRuntimeEnv,
  resolveGestureVisionJudgeStatus,
  resolveGuardianMiniAppUrl,
} from "./env.js";

describe("getRuntimeEnv Mini App vars", () => {
  it("applies defaults for the new Mini App vars", () => {
    const env = getRuntimeEnv({});
    expect(env.INITDATA_MAX_AGE_SECONDS).toBe(3600);
    expect(env.TELEGRAM_MINIAPP_NAME).toBe("config");
    expect(env.API_INTERNAL_URL).toBe("http://api:3001");
    expect(env.SUPERBOT_PLATFORM_ADMIN_TELEGRAM_IDS).toEqual([]);
  });

  it("coerces INITDATA_MAX_AGE_SECONDS from a string", () => {
    expect(
      getRuntimeEnv({ INITDATA_MAX_AGE_SECONDS: "900" })
        .INITDATA_MAX_AGE_SECONDS,
    ).toBe(900);
  });

  it("rejects a non-positive max age", () => {
    expect(() => getRuntimeEnv({ INITDATA_MAX_AGE_SECONDS: "0" })).toThrow();
  });

  it("rejects an invalid mini app short-name", () => {
    expect(() =>
      getRuntimeEnv({ TELEGRAM_MINIAPP_NAME: "bad name!" }),
    ).toThrow();
  });

  it("parses configured platform admin ids", () => {
    expect(
      getRuntimeEnv({
        SUPERBOT_PLATFORM_ADMIN_TELEGRAM_IDS: "8571420320, 123",
      }).SUPERBOT_PLATFORM_ADMIN_TELEGRAM_IDS,
    ).toEqual([8571420320n, 123n]);
  });

  it("ignores an empty managed bot token key", () => {
    expect(
      getRuntimeEnv({ MANAGED_BOT_TOKEN_KEY: "" }).MANAGED_BOT_TOKEN_KEY,
    ).toBeUndefined();
  });

  it("parses AI flags and provider order", () => {
    const env = getRuntimeEnv({
      AI_ENABLED: "1",
      AI_GROQ_ENABLED: "true",
      AI_PROVIDER_ORDER: "groq, gemini, openrouter",
    });
    expect(env.AI_ENABLED).toBe(true);
    expect(env.AI_GROQ_ENABLED).toBe(true);
    expect(env.AI_PROVIDER_ORDER).toEqual(["groq", "gemini", "openrouter"]);
  });

  it("blocks Groq 70B at env parse time", () => {
    expect(() =>
      getRuntimeEnv({ AI_GROQ_MODEL: "llama-3.1-70b-versatile" }),
    ).toThrow("Groq 70B disabled");
  });

  it("blocks paid OpenRouter models by default", () => {
    expect(() =>
      getRuntimeEnv({ AI_OPENROUTER_MODEL: "anthropic/claude-sonnet-4" }),
    ).toThrow("OpenRouter paid models disabled");
  });

  it("allows OpenRouter paid models only behind the explicit flag", () => {
    expect(
      getRuntimeEnv({
        AI_OPENROUTER_ALLOW_PAID_MODELS: "1",
        AI_OPENROUTER_MODEL: "anthropic/claude-sonnet-4",
      }).AI_OPENROUTER_MODEL,
    ).toBe("anthropic/claude-sonnet-4");
  });
});

describe("getRuntimeEnv Guardian Verification vars", () => {
  it("applies safe defaults when unset", () => {
    const env = getRuntimeEnv({});
    expect(env.GUARDIAN_ENABLED).toBe(false);
    expect(env.GUARDIAN_STORAGE_DRIVER).toBe("local");
    expect(env.GUARDIAN_STORAGE_PATH).toBe("./data/guardian-media");
    expect(env.GUARDIAN_RETENTION_HOURS).toBe(72);
    expect(env.GUARDIAN_MAX_UPLOAD_MB).toBe(25);
    expect(env.GUARDIAN_TEST_MODE).toBe(false);
  });

  it("requires the S3 credentials when GUARDIAN_STORAGE_DRIVER=s3", () => {
    expect(() => getRuntimeEnv({ GUARDIAN_STORAGE_DRIVER: "s3" })).toThrow();
  });

  it("accepts a fully configured S3 driver", () => {
    const env = getRuntimeEnv({
      GUARDIAN_STORAGE_DRIVER: "s3",
      S3_ENDPOINT: "https://s3.eu-west-1.amazonaws.com",
      S3_BUCKET: "guardian-media",
      S3_ACCESS_KEY: "key",
      S3_SECRET_KEY: "secret",
      S3_REGION: "eu-west-1",
    });
    expect(env.GUARDIAN_STORAGE_DRIVER).toBe("s3");
  });

  it("refuses GUARDIAN_TEST_MODE=true alongside GUARDIAN_ENABLED in production", () => {
    expect(() =>
      getRuntimeEnv({
        NODE_ENV: "production",
        GUARDIAN_ENABLED: "1",
        GUARDIAN_TEST_MODE: "1",
      }),
    ).toThrow("must never be true in production");
  });

  it("requires GUARDIAN_MEDIA_ENCRYPTION_KEY when Guardian runs in production", () => {
    expect(() =>
      getRuntimeEnv({ NODE_ENV: "production", GUARDIAN_ENABLED: "1" }),
    ).toThrow("GUARDIAN_MEDIA_ENCRYPTION_KEY");
    // Guardian off, or non-production, needs no media key.
    expect(getRuntimeEnv({ NODE_ENV: "production" }).GUARDIAN_ENABLED).toBe(
      false,
    );
    expect(getRuntimeEnv({ GUARDIAN_ENABLED: "1" }).GUARDIAN_ENABLED).toBe(
      true,
    );
  });

  it("accepts distinct primary + previous rotation keys", () => {
    const env = getRuntimeEnv({
      GUARDIAN_SESSION_SECRET: "primary-session-secret-123456",
      GUARDIAN_SESSION_SECRET_PREVIOUS: "previous-session-secret-654321",
      GUARDIAN_MEDIA_ENCRYPTION_KEY: "primary-media-key-1234567890",
      GUARDIAN_MEDIA_ENCRYPTION_KEY_PREVIOUS: "previous-media-key-0987654321",
    });
    expect(env.GUARDIAN_SESSION_SECRET_PREVIOUS).toBe(
      "previous-session-secret-654321",
    );
    expect(env.GUARDIAN_MEDIA_ENCRYPTION_KEY_PREVIOUS).toBe(
      "previous-media-key-0987654321",
    );
  });

  it("rejects a previous session secret equal to the primary", () => {
    expect(() =>
      getRuntimeEnv({
        GUARDIAN_SESSION_SECRET: "same-session-secret-1234567",
        GUARDIAN_SESSION_SECRET_PREVIOUS: "same-session-secret-1234567",
      }),
    ).toThrow("must differ from GUARDIAN_SESSION_SECRET");
  });

  it("rejects a previous session secret set without the primary", () => {
    expect(() =>
      getRuntimeEnv({
        GUARDIAN_SESSION_SECRET_PREVIOUS: "orphan-session-secret-123456",
      }),
    ).toThrow("requires GUARDIAN_SESSION_SECRET to be set");
  });

  it("rejects a previous media key equal to the primary", () => {
    expect(() =>
      getRuntimeEnv({
        GUARDIAN_MEDIA_ENCRYPTION_KEY: "same-media-key-1234567890",
        GUARDIAN_MEDIA_ENCRYPTION_KEY_PREVIOUS: "same-media-key-1234567890",
      }),
    ).toThrow("must differ from GUARDIAN_MEDIA_ENCRYPTION_KEY");
  });

  it("rejects a previous media key set without the primary", () => {
    expect(() =>
      getRuntimeEnv({
        GUARDIAN_MEDIA_ENCRYPTION_KEY_PREVIOUS: "orphan-media-key-1234567890",
      }),
    ).toThrow("requires GUARDIAN_MEDIA_ENCRYPTION_KEY to be set");
  });

  it("resolveGuardianMiniAppUrl falls back to TELEGRAM_APP_URL + /guardian/verify", () => {
    const env = getRuntimeEnv({ TELEGRAM_APP_URL: "https://modryva.example" });
    expect(resolveGuardianMiniAppUrl(env)).toBe(
      "https://modryva.example/guardian/verify",
    );
  });

  it("resolveGuardianMiniAppUrl prefers an explicit GUARDIAN_MINIAPP_URL", () => {
    const env = getRuntimeEnv({
      TELEGRAM_APP_URL: "https://modryva.example",
      GUARDIAN_MINIAPP_URL: "https://guardian.modryva.example/verify",
    });
    expect(resolveGuardianMiniAppUrl(env)).toBe(
      "https://guardian.modryva.example/verify",
    );
  });
});

describe("resolveGestureVisionJudgeStatus", () => {
  it("is not configured when the flag is off, even with a valid key", () => {
    const env = getRuntimeEnv({
      GUARDIAN_VISION_JUDGE_ENABLED: "0",
      AI_GEMINI_PROJECT_1_API_KEY: "real-key",
    });
    expect(resolveGestureVisionJudgeStatus(env)).toEqual({
      flagEnabled: false,
      keysConfigured: true,
      configured: false,
    });
  });

  it("is not configured when the flag is on but there are zero keys", () => {
    const env = getRuntimeEnv({ GUARDIAN_VISION_JUDGE_ENABLED: "1" });
    expect(resolveGestureVisionJudgeStatus(env)).toEqual({
      flagEnabled: true,
      keysConfigured: false,
      configured: false,
    });
  });

  it("is configured with just one Gemini project key", () => {
    const env = getRuntimeEnv({
      GUARDIAN_VISION_JUDGE_ENABLED: "1",
      AI_GEMINI_PROJECT_1_API_KEY: "real-key",
    });
    expect(resolveGestureVisionJudgeStatus(env).configured).toBe(true);
  });

  it("is configured with just a Groq CSV key list", () => {
    const env = getRuntimeEnv({
      GUARDIAN_VISION_JUDGE_ENABLED: "1",
      AI_GROQ_API_KEYS: "  ,realkey123,  ",
    });
    expect(resolveGestureVisionJudgeStatus(env).configured).toBe(true);
  });

  it("treats a whitespace/commas-only CSV as zero real keys", () => {
    const env = getRuntimeEnv({
      GUARDIAN_VISION_JUDGE_ENABLED: "1",
      AI_GEMINI_API_KEYS: " , , ",
    });
    expect(resolveGestureVisionJudgeStatus(env)).toEqual({
      flagEnabled: true,
      keysConfigured: false,
      configured: false,
    });
  });
});

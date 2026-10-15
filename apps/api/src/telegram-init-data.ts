import crypto from "node:crypto";

export interface TelegramInitDataVerification {
  readonly ok: boolean;
  readonly authDate: number | undefined;
  readonly user: Record<string, unknown> | undefined;
  readonly queryId: string | undefined;
  readonly raw: Record<string, string>;
  readonly error: string | undefined;
}

export interface VerifyInitDataOptions {
  /** Max age of `auth_date` in seconds. When set, stale initData is rejected. */
  readonly maxAgeSeconds?: number;
  /** Current time in unix SECONDS (injectable for tests). Defaults to now. */
  readonly now?: number;
}

const parseInitData = (initData: string): Record<string, string> => {
  const params = new URLSearchParams(initData);
  const result: Record<string, string> = {};

  for (const [key, value] of params.entries()) {
    result[key] = value;
  }

  return result;
};

const fail = (
  raw: Record<string, string>,
  error: string,
): TelegramInitDataVerification => ({
  ok: false,
  authDate: undefined,
  queryId: undefined,
  user: undefined,
  raw,
  error,
});

export const verifyTelegramInitData = (
  initData: string,
  botToken: string,
  options?: VerifyInitDataOptions,
): TelegramInitDataVerification => {
  const raw = parseInitData(initData);
  const hash = raw.hash;

  if (!hash) {
    return fail(raw, "missing-hash");
  }

  delete raw.hash;

  const dataCheckString = Object.entries(raw)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  // Constant-time comparison. Buffer.from(hex) silently drops invalid nibbles,
  // so a length guard is required before timingSafeEqual (which throws on
  // mismatched lengths).
  const provided = Buffer.from(hash, "hex");
  const expected = Buffer.from(calculatedHash, "hex");
  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    return fail(raw, "invalid-hash");
  }

  const authDate = raw.auth_date
    ? Number.parseInt(raw.auth_date, 10)
    : undefined;

  if (options?.maxAgeSeconds != null) {
    if (authDate === undefined || Number.isNaN(authDate)) {
      return fail(raw, "missing-auth-date");
    }
    const nowSeconds = options.now ?? Math.floor(Date.now() / 1000);
    if (nowSeconds - authDate > options.maxAgeSeconds) {
      return fail(raw, "auth-date-expired");
    }
  }

  let user: Record<string, unknown> | undefined;
  if (raw.user) {
    try {
      user = JSON.parse(raw.user) as Record<string, unknown>;
    } catch {
      return fail(raw, "invalid-user");
    }
  }

  return {
    ok: true,
    authDate:
      authDate !== undefined && !Number.isNaN(authDate) ? authDate : undefined,
    queryId: raw.query_id,
    user,
    raw,
    error: undefined,
  };
};

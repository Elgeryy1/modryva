/**
 * Redaction shared by everything that ships text somewhere it should not carry
 * secrets: AI prompts (which leave for a third-party model) and error reports
 * (which leave for the error tracker).
 *
 * These patterns lived inside modules/ai and were not exported, so error
 * tracking would have had to copy them — the same "fixed in one place, not its
 * siblings" split that let a Telegram failure go undiagnosable for a night.
 * They belong at the bottom layer instead, with one definition to update.
 */

export const SECRET_PATTERNS: readonly RegExp[] = [
  /\b(gsk_[A-Za-z0-9_-]{20,})\b/gu, // Groq
  /\b(sk-or-v1-[A-Za-z0-9_-]{20,})\b/gu, // OpenRouter
  /\bAIza[0-9A-Za-z_-]{35}\b/gu, // Google / Gemini API key
  // Any FOO_SECRET / FOO_TOKEN / FOO_KEY / FOO_PASSWORD = value assignment. The
  // previous fixed list missed GUARDIAN_SESSION_SECRET (a \b bug), plus
  // CLOUDFLARE_TUNNEL_TOKEN, S3_SECRET_KEY, GUARDIAN_MEDIA_ENCRYPTION_KEY, ...
  /\b[A-Z][A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASSWORD)=\S+/gu,
  /\bpostgres(?:ql)?:\/\/[^\s]*@\S+/giu, // Postgres URL carrying credentials
  // Telegram bot token. SIN `\b` a los lados, y no es un descuido:
  //
  // El token solo aparece de una forma en la vida real —
  // `https://api.telegram.org/bot<TOKEN>/sendMessage`— y ahí el carácter previo
  // a los dígitos es la `t` de "bot". `t`→`8` es letra→letra, o sea que NO hay
  // frontera de palabra en ningún punto de la ristra: con `\b` delante, este
  // patrón no casaba nunca en el único sitio donde el token existe. Se comprobó
  // capturando el sobre real que sale hacia el rastreador de errores: la IP de
  // la misma cadena salía redactada y el token entero en claro.
  //
  // El `\b` final también se va: un token puede terminar en `-`, y ahí la
  // frontera dejaría el último carácter fuera de la redacción.
  /\d{8,}:[A-Za-z0-9_-]{20,}/gu,
  /\b(ch|pi|cs|tok|key)_[A-Za-z0-9_-]{16,}\b/gu, // Stripe-ish tokens
];

/**
 * Telegram Mini App initData and the Guardian session token. initData is signed
 * proof of identity carrying the person's whole Telegram profile, and the
 * session token is a bearer credential for a verification in progress — both
 * ride in headers and query strings that an error report would otherwise
 * capture verbatim.
 */
const CREDENTIAL_PATTERNS: readonly RegExp[] = [
  /\bhash=[A-Fa-f0-9]{64}\b/gu, // initData signature
  /\bquery_id=[A-Za-z0-9_.-]+/gu,
  /\bauth_date=\d+&?/gu,
  /\buser=%7B[^&\s]*/gu, // URL-encoded Telegram user object inside initData
  /\bgrdv_[A-Za-z0-9_-]{10,}/gu, // Guardian retry deep-link token
  // El token de sesión de Guardian cuando viaja en una URL. Llega al navegador
  // como `?session=<43 chars base64url>` (la Mini App lo reenvía luego en una
  // cabecera, que sí se borra entera). No es una credencial por sí sola —el
  // guardia exige además un initData firmado del mismo usuario— pero es una
  // cadena con forma de credencial y no tiene por qué acabar en un rastreador.
  /\bsession=[A-Za-z0-9_-]{20,}/gu,
];

/**
 * Client IP addresses. Guardian pins these deliberately (they are the
 * multi-account signal shown to STAFF), which is exactly why they must not also
 * leak into a crash report: an error tracker is not the place that decision was
 * made, and nobody consented to it there.
 */
const IP_PATTERNS: readonly RegExp[] = [
  /\b\d{1,3}(?:\.\d{1,3}){3}\b/gu,
  /\b(?:[A-Fa-f0-9]{1,4}:){4,7}[A-Fa-f0-9]{1,4}\b/gu,
];

/** Replaces anything matching the secret patterns. Used on its own by the AI
 * sanitizer, where IPs and initData are not in play. */
export const redactSecrets = (text: string): string => {
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, "[REDACTED_SECRET]");
  }
  return out;
};

/** Everything above: secrets, Telegram credentials and IP addresses. */
export const redactSensitive = (text: string): string => {
  let out = redactSecrets(text);
  for (const pattern of CREDENTIAL_PATTERNS) {
    out = out.replace(pattern, "[REDACTED_CREDENTIAL]");
  }
  for (const pattern of IP_PATTERNS) {
    out = out.replace(pattern, "[REDACTED_IP]");
  }
  return out;
};

/** Keys whose VALUE is dropped outright rather than pattern-matched, because
 * the whole value is the sensitive thing and no pattern would reliably span it. */
const DROPPED_KEYS = new Set([
  "authorization",
  "cookie",
  "cookies",
  "set-cookie",
  "x-guardian-session",
  "x-telegram-bot-api-secret-token",
  "initdata",
  "init_data",
  "token",
  "sessiontoken",
  "session_token",
  "password",
  "mediabase64",
  "secondmediabase64",
  "imagebase64",
  "ip_address",
  "verifierip",
]);

/**
 * Walks a structure applying redactSensitive to every string and dropping any
 * key in DROPPED_KEYS. Depth-bounded and cycle-safe: a scrubber that hangs or
 * throws on a hostile payload would suppress the very report it was cleaning.
 */
export const redactDeep = (value: unknown, depth = 0): unknown => {
  if (depth > 12) {
    return "[REDACTED_DEPTH]";
  }
  if (typeof value === "string") {
    // Captured media arrives as base64 megabytes; it is never useful in a crash
    // report and is a photo of somebody's face.
    return value.length > 4096
      ? `${redactSensitive(value.slice(0, 512))}…[TRUNCATED]`
      : redactSensitive(value);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => redactDeep(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(
      value as Record<string, unknown>,
    )) {
      out[key] = DROPPED_KEYS.has(key.toLowerCase())
        ? "[REDACTED]"
        : redactDeep(item, depth + 1);
    }
    return out;
  }
  return value;
};

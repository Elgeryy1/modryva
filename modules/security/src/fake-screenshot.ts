/**
 * Signal describing whether a message claims to show a fake payment,
 * proof or promo screenshot, plus the matched phrases in canonical order.
 * Pure and deterministic.
 */
export interface FakeScreenshotClaimSignal {
  readonly matched: boolean;
  readonly phrases: readonly string[];
}

/**
 * Canonical accent-free claim phrases scanned for, in detection priority order.
 * Pure and deterministic.
 */
const FAKE_SCREENSHOT_PHRASES: readonly string[] = [
  "captura de pago",
  "comprobante",
  "mira la prueba",
  "ya me pagaron",
  "aqui esta la prueba",
];

/**
 * Lowercases and removes diacritics so matching is accent-insensitive.
 * Internal helper. Pure and deterministic.
 */
const foldForMatch = (value: string): string =>
  value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Detects messages that claim to show fake payments, proofs or promos,
 * accent-insensitive and case-insensitive. Returns matched phrases in
 * FAKE_SCREENSHOT_PHRASES order, deduplicated. Empty result for undefined,
 * empty or clean text. Pure and deterministic.
 */
export const detectFakeScreenshotClaim = (
  text: string | undefined,
): FakeScreenshotClaimSignal => {
  if (!text) {
    return { matched: false, phrases: [] };
  }
  const haystack = foldForMatch(text);
  const phrases: string[] = [];
  for (const phrase of FAKE_SCREENSHOT_PHRASES) {
    const needle = foldForMatch(phrase);
    if (haystack.includes(needle) && !phrases.includes(phrase)) {
      phrases.push(phrase);
    }
  }
  return { matched: phrases.length > 0, phrases };
};

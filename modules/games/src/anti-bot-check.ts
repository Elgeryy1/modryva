/**
 * Input for an anti-bot minigame challenge verification.
 * `answer` is what the player submitted, `expected` is the correct token,
 * and `responseMs` is how long the player took to answer, in milliseconds.
 */
export interface AntiBotChallengeInput {
  readonly answer: string;
  readonly expected: string;
  readonly responseMs: number;
}

/**
 * Optional timing window for the challenge. `minMs` guards against
 * inhumanly fast (scripted) answers; `maxMs` guards against timeouts.
 * Defaults are 300 ms and 30000 ms.
 */
export interface AntiBotChallengeOptions {
  readonly minMs?: number;
  readonly maxMs?: number;
}

/**
 * Result of verifying an anti-bot challenge. `human` is true only when the
 * answer is correct AND the response time falls inside the allowed window.
 * `reason` is a short user-facing Spanish explanation.
 */
export interface AntiBotChallengeResult {
  readonly human: boolean;
  readonly reason: string;
}

const DEFAULT_MIN_MS = 300;
const DEFAULT_MAX_MS = 30000;

const REASON_TOO_FAST = "Respuesta demasiado rápida, parece automatizada. 🤖";
const REASON_WRONG = "Respuesta incorrecta. ❌";
const REASON_TOO_SLOW =
  "Tiempo agotado, la respuesta llegó demasiado tarde. ⏰";
const REASON_OK = "Verificación superada. ✅";

const normalizeToken = (value: string): string => value.trim().toLowerCase();

/**
 * Verifies a minigame anti-bot challenge. The player is considered human when
 * the trimmed, case-insensitive answer equals the expected token AND the
 * response time is within [minMs, maxMs]. Reason precedence when not human:
 * too fast, then wrong answer, then too slow.
 * Pure and deterministic.
 */
export const verifyAntiBotChallenge = (
  input: AntiBotChallengeInput,
  options?: AntiBotChallengeOptions,
): AntiBotChallengeResult => {
  const minMs = options?.minMs ?? DEFAULT_MIN_MS;
  const maxMs = options?.maxMs ?? DEFAULT_MAX_MS;

  if (input.responseMs < minMs) {
    return { human: false, reason: REASON_TOO_FAST };
  }
  if (normalizeToken(input.answer) !== normalizeToken(input.expected)) {
    return { human: false, reason: REASON_WRONG };
  }
  if (input.responseMs > maxMs) {
    return { human: false, reason: REASON_TOO_SLOW };
  }
  return { human: true, reason: REASON_OK };
};

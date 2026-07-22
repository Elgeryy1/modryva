/**
 * Result of scanning a message for doxxing markers. `matched` is true when at
 * least one marker kind was found; `kinds` lists the detected kinds in the
 * curated KIND order, without duplicates.
 * Pure and deterministic.
 */
export interface DoxxingSignal {
  readonly matched: boolean;
  readonly kinds: readonly string[];
}

/**
 * Matches a run of 9 or more consecutive digits (typical phone number).
 * No global flag, so `.test` stays stateless. Pure and deterministic.
 */
const PHONE_PATTERN = /\d{9,}/;

/**
 * Matches a Spanish DNI: exactly 8 digits followed by one letter, bounded by
 * word boundaries so it does not fire inside longer digit runs.
 * Pure and deterministic.
 */
const DNI_PATTERN = /\b\d{8}[a-zA-Z]\b/;

/**
 * Matches a Spanish plate: 4 digits, an optional single space, then 3 letters.
 * Pure and deterministic.
 */
const PLATE_PATTERN = /\b\d{4}\s?[a-zA-Z]{3}\b/;

/**
 * Matches a street reference (calle / avenida / avda / c/) followed later on
 * the same line by a number. Case-insensitive. Pure and deterministic.
 */
const ADDRESS_PATTERN = /(?:\bcalle\b|\bavenida\b|\bavda\b|c\/)[^\n]*?\d+/i;

/**
 * Ordered list of detectors. The `kind` values define the curated output order
 * for `detectDoxxing`. Pure and deterministic.
 */
const DETECTORS: readonly {
  readonly kind: string;
  readonly pattern: RegExp;
}[] = [
  { kind: "telefono", pattern: PHONE_PATTERN },
  { kind: "dni", pattern: DNI_PATTERN },
  { kind: "matricula", pattern: PLATE_PATTERN },
  { kind: "direccion", pattern: ADDRESS_PATTERN },
];

/**
 * Detects doxxing markers (phone numbers, DNI documents, vehicle plates and
 * street addresses) in a message. Returns the matched kinds deduplicated and in
 * the curated DETECTORS order. Empty result for undefined or clean text.
 * Pure and deterministic.
 */
export const detectDoxxing = (text: string | undefined): DoxxingSignal => {
  if (!text) {
    return { matched: false, kinds: [] };
  }
  const kinds: string[] = [];
  for (const detector of DETECTORS) {
    if (detector.pattern.test(text) && !kinds.includes(detector.kind)) {
      kinds.push(detector.kind);
    }
  }
  return { matched: kinds.length > 0, kinds };
};

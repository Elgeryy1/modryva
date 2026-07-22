/**
 * Deteccion y redaccion de PII (informacion personal identificable) para
 * proteger la privacidad en grupos: emails, telefonos, IBAN y URLs con
 * credenciales embebidas (user:pass@host). Todo es regex puro y determinista:
 * no hay I/O, ni red, ni estado; la misma entrada produce siempre la misma
 * salida. La accion (borrar, avisar) vive en el servicio, no aqui.
 */

/** Conjunto de PII detectada en un texto, sin duplicados y en orden de aparicion. */
export interface PiiFindings {
  readonly emails: readonly string[];
  readonly phones: readonly string[];
  readonly ibans: readonly string[];
  readonly urlsWithCreds: readonly string[];
}

/** Numero minimo de digitos para considerar una secuencia como telefono. */
export const PII_MIN_PHONE_DIGITS = 9;

/** Numero maximo de digitos para considerar una secuencia como telefono. */
export const PII_MAX_PHONE_DIGITS = 15;

/**
 * Palabras (sin acentos, en minusculas) que por si solas sugieren un intento
 * de doxxing / exposicion de datos personales cuando aparecen en el texto.
 */
export const PII_DOXXING_KEYWORDS: readonly string[] = [
  "direccion",
  "dni",
  "matricula",
  "pasaporte",
  "nif",
  "codigo postal",
];

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const IBAN_PATTERN = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;
const URL_CREDS_PATTERN =
  /\b(?:https?|ftp):\/\/[^\s:/@]+:[^\s:/@]+@[^\s/]+[^\s]*/gi;
// Secuencia con aspecto de telefono: primer digito (con + opcional), separadores
// intermedios y un ultimo digito. El recuento real de digitos se valida aparte
// para no marcar numeros cortos normales.
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/g;

const countDigits = (value: string): number => {
  let digits = 0;
  for (const ch of value) {
    if (ch >= "0" && ch <= "9") {
      digits += 1;
    }
  }
  return digits;
};

const dedupe = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
};

const matchAll = (text: string, pattern: RegExp): string[] => {
  const out: string[] = [];
  for (const match of text.matchAll(pattern)) {
    out.push(match[0]);
  }
  return out;
};

/**
 * True cuando la secuencia tiene un recuento de digitos plausible para un
 * telefono (entre PII_MIN_PHONE_DIGITS y PII_MAX_PHONE_DIGITS). Evita marcar
 * cantidades cortas como "12345" o precios. Puro y determinista.
 */
export const isPiiPhoneCandidate = (value: string): boolean => {
  const digits = countDigits(value);
  return digits >= PII_MIN_PHONE_DIGITS && digits <= PII_MAX_PHONE_DIGITS;
};

/**
 * Extrae toda la PII de un texto. Cada lista viene deduplicada y en orden de
 * primera aparicion. Los telefonos se filtran por recuento de digitos para no
 * generar falsos positivos con numeros normales cortos. Puro y determinista.
 */
export const detectPii = (text: string): PiiFindings => {
  if (!text) {
    return { emails: [], phones: [], ibans: [], urlsWithCreds: [] };
  }

  const emails = dedupe(matchAll(text, EMAIL_PATTERN));
  const ibans = dedupe(matchAll(text, IBAN_PATTERN));
  const urlsWithCreds = dedupe(matchAll(text, URL_CREDS_PATTERN));
  const phones = dedupe(
    matchAll(text, PHONE_PATTERN).filter(isPiiPhoneCandidate),
  );

  return { emails, phones, ibans, urlsWithCreds };
};

const maskEmail = (email: string): string => {
  const at = email.indexOf("@");
  if (at <= 0) {
    return email;
  }
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local[0] ?? "";
  return `${head}***@${domain}`;
};

const maskIban = (iban: string): string => {
  if (iban.length <= 6) {
    return iban;
  }
  const head = iban.slice(0, 4);
  const tail = iban.slice(-2);
  return `${head}${"*".repeat(iban.length - 6)}${tail}`;
};

const maskPhone = (phone: string): string => {
  const plus = phone.startsWith("+") ? "+" : "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 2) {
    return phone;
  }
  const tail = digits.slice(-2);
  return `${plus}${"*".repeat(digits.length - 2)}${tail}`;
};

/**
 * Enmascara emails, telefonos e IBAN dentro del texto preservando algo de
 * contexto (primera letra del email, prefijo del IBAN, ultimos digitos del
 * telefono). El resto del texto queda intacto. El orden de reemplazo evita que
 * un token ya enmascarado vuelva a coincidir. Puro y determinista.
 */
export const redactPii = (text: string): string => {
  if (!text) {
    return text;
  }

  let result = text.replace(IBAN_PATTERN, (match) => maskIban(match));
  result = result.replace(EMAIL_PATTERN, (match) => maskEmail(match));
  result = result.replace(PHONE_PATTERN, (match) =>
    isPiiPhoneCandidate(match) ? maskPhone(match) : match,
  );

  return result;
};

/**
 * True cuando el texto presenta riesgo de doxxing: aparecen dos o mas piezas
 * de PII juntas, o aparece alguna palabra clave de datos personales
 * ("direccion", "dni", "matricula", ...). La deteccion de palabras clave es
 * insensible a mayusculas. Puro y determinista.
 */
export const hasDoxxingRisk = (text: string): boolean => {
  if (!text) {
    return false;
  }

  const findings = detectPii(text);
  const piiCount =
    findings.emails.length +
    findings.phones.length +
    findings.ibans.length +
    findings.urlsWithCreds.length;

  if (piiCount >= 2) {
    return true;
  }

  const lower = text.toLowerCase();
  return PII_DOXXING_KEYWORDS.some((keyword) => lower.includes(keyword));
};

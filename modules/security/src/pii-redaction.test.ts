import { describe, expect, it } from "vitest";
import {
  detectPii,
  hasDoxxingRisk,
  isPiiPhoneCandidate,
  PII_DOXXING_KEYWORDS,
  PII_MAX_PHONE_DIGITS,
  PII_MIN_PHONE_DIGITS,
  redactPii,
} from "./pii-redaction.js";

describe("detectPii", () => {
  it("returns empty lists for empty text", () => {
    expect(detectPii("")).toEqual({
      emails: [],
      phones: [],
      ibans: [],
      urlsWithCreds: [],
    });
  });

  it("extracts emails deduplicated and in order", () => {
    const result = detectPii(
      "escribe a juan@mail.com o a juan@mail.com y ana@x.org",
    );
    expect(result.emails).toEqual(["juan@mail.com", "ana@x.org"]);
  });

  it("extracts an international phone number", () => {
    const result = detectPii("llamame al +34 600 123 456 hoy");
    expect(result.phones).toEqual(["+34 600 123 456"]);
  });

  it("does not treat short normal numbers as phones", () => {
    const result = detectPii("cuestan 1234 euros y son 42 unidades");
    expect(result.phones).toEqual([]);
  });

  it("extracts an IBAN", () => {
    const result = detectPii("paga a ES9121000418450200051332 gracias");
    expect(result.ibans).toEqual(["ES9121000418450200051332"]);
  });

  it("does not misclassify the IBAN digits as a phone", () => {
    const result = detectPii("IBAN ES9121000418450200051332");
    expect(result.phones).toEqual([]);
  });

  it("extracts URLs with embedded credentials", () => {
    const result = detectPii(
      "mira https://admin:secret@panel.example.com/login ya",
    );
    expect(result.urlsWithCreds).toEqual([
      "https://admin:secret@panel.example.com/login",
    ]);
  });

  it("ignores plain URLs without credentials", () => {
    const result = detectPii("visita https://example.com/login por favor");
    expect(result.urlsWithCreds).toEqual([]);
  });

  it("is deterministic for identical inputs", () => {
    const text = "juan@mail.com y +34 600 123 456";
    expect(detectPii(text)).toEqual(detectPii(text));
  });
});

describe("isPiiPhoneCandidate", () => {
  it("accepts sequences within the digit bounds", () => {
    expect(isPiiPhoneCandidate("+34 600 123 456")).toBe(true);
    expect(isPiiPhoneCandidate("600123456")).toBe(true);
  });

  it("rejects sequences below the minimum digits", () => {
    expect(isPiiPhoneCandidate("12345678")).toBe(false);
    expect(PII_MIN_PHONE_DIGITS).toBe(9);
  });

  it("rejects sequences above the maximum digits", () => {
    expect(isPiiPhoneCandidate("9121000418450200051332")).toBe(false);
    expect(PII_MAX_PHONE_DIGITS).toBe(15);
  });
});

describe("redactPii", () => {
  it("returns empty text unchanged", () => {
    expect(redactPii("")).toBe("");
  });

  it("masks an email preserving the first letter and domain", () => {
    expect(redactPii("email: juan@mail.com")).toBe("email: j***@mail.com");
  });

  it("masks a phone keeping the last two digits", () => {
    expect(redactPii("tel +34 600 123 456")).toBe("tel +*********56");
  });

  it("masks an IBAN keeping the country prefix and tail", () => {
    expect(redactPii("iban ES9121000418450200051332")).toBe(
      "iban ES91******************32",
    );
  });

  it("leaves text without PII intact", () => {
    expect(redactPii("hola que tal, 42 amigos")).toBe(
      "hola que tal, 42 amigos",
    );
  });

  it("is deterministic for identical inputs", () => {
    const text = "juan@mail.com llama al +34 600 123 456";
    expect(redactPii(text)).toBe(redactPii(text));
  });
});

describe("hasDoxxingRisk", () => {
  it("is false for empty text", () => {
    expect(hasDoxxingRisk("")).toBe(false);
  });

  it("is false for a single isolated email", () => {
    expect(hasDoxxingRisk("mi correo es juan@mail.com")).toBe(false);
  });

  it("is true when two or more PII pieces appear together", () => {
    expect(hasDoxxingRisk("juan@mail.com y su tel +34 600 123 456")).toBe(true);
  });

  it("is true when a doxxing keyword appears, case-insensitively", () => {
    expect(hasDoxxingRisk("su DIRECCION es calle falsa 123")).toBe(true);
    expect(hasDoxxingRisk("comparto su DNI aqui")).toBe(true);
  });

  it("covers every configured keyword", () => {
    for (const keyword of PII_DOXXING_KEYWORDS) {
      expect(hasDoxxingRisk(`dato sensible: ${keyword}`)).toBe(true);
    }
  });

  it("is false for harmless text without PII or keywords", () => {
    expect(hasDoxxingRisk("quedamos manana para comer")).toBe(false);
  });
});

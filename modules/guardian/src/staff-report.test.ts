import { describe, expect, it } from "vitest";
import {
  buildAutoApprovedKeyboard,
  buildExpelConfirmKeyboard,
  buildManualReviewKeyboard,
  buildStaffCallbackData,
  formatStaffReportText,
  parseStaffCallbackData,
  plainReasonLabel,
  type StaffReportInput,
  verifyStaffCallback,
} from "./staff-report.js";

const secret = "test-staff-secret";

const baseInput: StaffReportInput = {
  sessionShortId: "VER-ABC123",
  status: "approved_auto",
  displayName: "Nueva Persona",
  username: "nueva",
  telegramUserId: 123456789n,
  groupTitle: "Grupo de prueba",
  attemptNumber: 1,
  maxAttempts: 3,
  challengeSteps: ["Girar la cabeza a la derecha", "Hacer 👍"],
  estimatedAge: null,
  countryCode: null,
  file: {
    kind: "video",
    resolution: "720x1280",
    durationSeconds: 4.2,
    sizeMb: 2.7,
    sha256: "a".repeat(64),
    capturedAtIso: "2026-07-13T12:00:00.000Z",
    retentionHours: 72,
  },
};

describe("formatStaffReportText", () => {
  it("includes every required field from the spec's report format", () => {
    const text = formatStaffReportText(baseInput);
    expect(text).toContain("NUEVA VERIFICACIÓN");
    expect(text).toContain("✅ Aprobado automáticamente");
    expect(text).toContain("Nueva Persona (@nueva)");
    expect(text).toContain("123456789");
    expect(text).toContain("Grupo de prueba");
    expect(text).toContain("VER-ABC123");
    expect(text).toContain("Intento: 1/3");
    expect(text).toContain("1. Girar la cabeza a la derecha");
    expect(text).toContain("Duración: 4.2 s");
    expect(text).toContain("Retención: se eliminará en 72 h");
  });

  it("shows the self-declared age when provided", () => {
    const text = formatStaffReportText({ ...baseInput, declaredAge: 20 });
    expect(text).toContain("Edad declarada por el usuario: 20 años");
  });

  it("omits the declared-age line when the user didn't declare one", () => {
    const text = formatStaffReportText(baseInput);
    expect(text).not.toContain("Edad declarada");
  });

  it("never prints the full SHA-256, only a snippet", () => {
    const text = formatStaffReportText(baseInput);
    expect(text).not.toContain("a".repeat(64));
    expect(text).toContain("aaaaaaaa");
  });

  it("shows a plain-language reason, never the raw reason code", () => {
    const text = formatStaffReportText({
      ...baseInput,
      status: "queued",
      reasonCode: "age_borderline_maximum",
    });
    expect(text).toContain(
      "Motivo: La edad estimada está cerca del máximo permitido",
    );
    expect(text).not.toContain("age_borderline_maximum");
  });

  it("omits the Motivo line when there is no reason code", () => {
    const text = formatStaffReportText(baseInput);
    expect(text).not.toContain("Motivo:");
  });

  it("never shows a Motivo line for an auto-approved case, even with a reason code set", () => {
    // Regression: the decision engine's own SUCCESS reason
    // (confidence_above_auto_approve_threshold) fell through plainReasonLabel's
    // fallback ("no se pudo confirmar automáticamente") for a case that very
    // much WAS confirmed and let the person in — contradictory and confusing.
    // approved_auto never needs a justification, so it's suppressed outright.
    const text = formatStaffReportText({
      ...baseInput,
      status: "approved_auto",
      reasonCode: "confidence_above_auto_approve_threshold",
    });
    expect(text).not.toContain("Motivo:");
  });

  it("shows the AI-estimated age when available", () => {
    const text = formatStaffReportText({
      ...baseInput,
      estimatedAge: "17-19 años (estimado)",
    });
    expect(text).toContain("Edad estimada por IA: 17-19 años (estimado)");
  });

  it("omits the estimated-age line when the AI didn't evaluate it", () => {
    const text = formatStaffReportText(baseInput);
    expect(text).not.toContain("Edad estimada");
  });

  it("shows the IP-resolved country when available", () => {
    const text = formatStaffReportText({ ...baseInput, countryCode: "ES" });
    expect(text).toContain("País detectado (por IP): ES");
  });

  it("omits the country line when it wasn't resolved", () => {
    const text = formatStaffReportText(baseInput);
    expect(text).not.toContain("País detectado");
  });

  it("shows a plain reason for a country mismatch, never the raw code", () => {
    const text = formatStaffReportText({
      ...baseInput,
      status: "queued",
      reasonCode: "country_not_allowed",
      countryCode: "US",
    });
    expect(text).toContain(
      "Motivo: El país detectado no está entre los permitidos para este grupo.",
    );
  });

  it("omits the ARCHIVO section when there is no file", () => {
    const text = formatStaffReportText({ ...baseInput, file: null });
    expect(text).not.toContain("ARCHIVO");
  });
});

describe("plainReasonLabel", () => {
  it("returns null when there is no reason code", () => {
    expect(plainReasonLabel(undefined)).toBeNull();
  });

  it("maps known reason codes to a plain, jargon-free sentence", () => {
    expect(plainReasonLabel("no_face_detected")).toBe(
      "No se detectó ninguna cara en la foto.",
    );
  });

  it("maps the auto-approve success code to a positive sentence, never the negative fallback", () => {
    const label = plainReasonLabel("confidence_above_auto_approve_threshold");
    expect(label).toBe("Todo correcto: se confirmó automáticamente.");
    expect(label).not.toContain("no se pudo confirmar");
  });

  it("maps any integrity_* violation to one generic, honest sentence", () => {
    expect(plainReasonLabel("integrity_user_mismatch")).toBe(
      "Se detectó algo irregular con la sesión de verificación.",
    );
  });

  it("strips the _auto_decline_disabled suffix so the manual-review form of a reason still gets its real translation", () => {
    // Regression: declineOrReview appends this suffix whenever
    // allowAutomaticDecline is off, and before this fix any reason code with
    // the suffix silently fell through to the generic fallback — even though
    // its base code (e.g. hard_failure) was mapped correctly.
    expect(plainReasonLabel("hard_failure_auto_decline_disabled")).toBe(
      plainReasonLabel("hard_failure"),
    );
    expect(plainReasonLabel("hard_failure_auto_decline_disabled")).not.toBe(
      "No se pudo confirmar automáticamente — revisa el caso.",
    );
    expect(plainReasonLabel("same_person_mismatch_auto_decline_disabled")).toBe(
      "Las dos fotos NO parecen ser de la misma persona.",
    );
  });

  it("maps the spoofing/replay-risk reason (previously unmapped)", () => {
    const label = plainReasonLabel("spoofing_risk_too_high");
    expect(label).not.toBe(
      "No se pudo confirmar automáticamente — revisa el caso.",
    );
  });

  it("never returns the raw code for an unknown reason", () => {
    const label = plainReasonLabel("some-future-reason-code");
    expect(label).not.toBe("some-future-reason-code");
    expect(label).toBeTruthy();
  });
});

const mustParse = (data: string) => {
  const parsed = parseStaffCallbackData(data);
  expect(parsed).not.toBeNull();
  if (!parsed) {
    throw new Error("expected parseStaffCallbackData to return a value");
  }
  return parsed;
};

describe("staff callback round-trip", () => {
  it("builds and parses a callback for every action", () => {
    const data = buildStaffCallbackData("sess-1", "approve", secret);
    const parsed = mustParse(data);
    expect(parsed).toEqual({
      action: "approve",
      sessionId: "sess-1",
      signature: expect.any(String),
    });
    expect(verifyStaffCallback(parsed, secret)).toBe(true);
  });

  it("rejects a callback signed with the wrong secret", () => {
    const data = buildStaffCallbackData("sess-1", "decline", secret);
    const parsed = mustParse(data);
    expect(verifyStaffCallback(parsed, "wrong-secret")).toBe(false);
  });

  it("rejects a callback where the session id was swapped after signing", () => {
    const data = buildStaffCallbackData("sess-1", "approve", secret);
    const parsed = mustParse(data);
    const tampered = { ...parsed, sessionId: "sess-2" };
    expect(verifyStaffCallback(tampered, secret)).toBe(false);
  });

  it("returns null for unrelated callback_data", () => {
    expect(parseStaffCallbackData("ig:rps:piedra")).toBeNull();
    expect(parseStaffCallbackData(undefined)).toBeNull();
  });

  it("keeps callback_data comfortably under Telegram's 64-byte limit", () => {
    const longSessionId = "c".repeat(25); // cuid-length
    const data = buildStaffCallbackData(
      longSessionId,
      "mark_false_positive",
      secret,
    );
    expect(Buffer.byteLength(data, "utf8")).toBeLessThanOrEqual(64);
  });

  it("builds a manual-review keyboard with 4 rows including a contact button", () => {
    const keyboard = buildManualReviewKeyboard("sess-1", secret, {
      telegramUserId: 123456789n,
      username: "nueva",
    }) as {
      inline_keyboard: Array<
        Array<{ text: string; callback_data?: string; url?: string }>
      >;
    };
    const allButtons = keyboard.inline_keyboard.flat();
    const contactButton = allButtons.find((b) => b.text.includes("Contactar"));
    expect(contactButton?.url).toBe("https://t.me/nueva");
    const signedButtons = allButtons.filter((b) => b.callback_data);
    expect(new Set(signedButtons.map((b) => b.callback_data)).size).toBe(5);
  });

  it("falls back to a tg://user deep link when the person has no username", () => {
    const keyboard = buildManualReviewKeyboard("sess-1", secret, {
      telegramUserId: 123456789n,
      username: null,
    }) as { inline_keyboard: Array<Array<{ text: string; url?: string }>> };
    const contactButton = keyboard.inline_keyboard
      .flat()
      .find((b) => b.text.includes("Contactar"));
    expect(contactButton?.url).toBe("tg://user?id=123456789");
  });

  it("builds an auto-approved keyboard with the false-positive + expel buttons", () => {
    const keyboard = buildAutoApprovedKeyboard("sess-1", secret) as {
      inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
    };
    const allButtons = keyboard.inline_keyboard.flat();
    expect(allButtons.some((b) => b.text.includes("falso positivo"))).toBe(
      true,
    );
    expect(allButtons.some((b) => b.text.includes("Expulsar"))).toBe(true);
  });

  it("expel requires a distinct second-tap confirmation callback", () => {
    const expelData = buildStaffCallbackData("sess-1", "expel", secret);
    const confirmData = buildStaffCallbackData(
      "sess-1",
      "expel_confirm",
      secret,
    );
    expect(expelData).not.toBe(confirmData);
    expect(parseStaffCallbackData(expelData)?.action).toBe("expel");
    expect(parseStaffCallbackData(confirmData)?.action).toBe("expel_confirm");

    const keyboard = buildExpelConfirmKeyboard("sess-1", secret) as {
      inline_keyboard: Array<Array<{ callback_data: string }>>;
    };
    expect(keyboard.inline_keyboard.flat()[0]?.callback_data).toBe(confirmData);
  });
});

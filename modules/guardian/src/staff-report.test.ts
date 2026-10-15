import { describe, expect, it } from "vitest";
import { PHOTO_GESTURE_ACTIONS } from "./challenge.js";
import {
  buildAutoApprovedKeyboard,
  buildExpelConfirmKeyboard,
  buildManualReviewKeyboard,
  buildMirrorKeyboard,
  buildStaffCallbackData,
  describeChallengeStep,
  formatStaffReportText,
  isButtonPrivacyError,
  isMirroredStaffCopy,
  parseStaffCallbackData,
  plainReasonLabel,
  redactForMirror,
  STAFF_MIRROR_CALLBACK,
  type StaffReportInput,
  stripPrivacyRestrictedButtons,
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
  verifierIp: null,
  ipReputation: null,
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
    expect(text).toContain("Verificación Guardian");
    expect(text).toContain("✅ Aprobado automáticamente");
    expect(text).toContain("Nueva Persona (@nueva)");
    expect(text).toContain("123456789");
    expect(text).toContain("Grupo de prueba");
    expect(text).toContain("VER-ABC123");
    expect(text).toContain("intento 1/3");
    expect(text).toContain("Girar la cabeza a la derecha");
    // Forensic detail (resolution, duration, size, hash) deliberately left out
    // of the caption in the redesign: it never helped a reviewer decide, and a
    // photo caption is capped at 1024 characters. It stays in the technical
    // report. What MUST survive is the retention promise, asserted below.
    expect(text).toContain("se borra en 72 h");
  });

  it("shows the self-declared age when provided", () => {
    const text = formatStaffReportText({ ...baseInput, declaredAge: 20 });
    expect(text).toContain("Edad que dice tener: 20");
  });

  it("omits the declared-age line when the user didn't declare one", () => {
    const text = formatStaffReportText(baseInput);
    expect(text).not.toContain("Edad declarada");
  });

  it("never prints a file hash in the caption at all", () => {
    // The redesign moved forensic detail behind the technical-report button:
    // a reviewer decides on the face and the gesture, not on a checksum. The
    // original invariant — never the full hash — holds a fortiori.
    const text = formatStaffReportText(baseInput);
    expect(text).not.toContain("a".repeat(64));
    expect(text).not.toContain("SHA");
  });

  it("shows a plain-language reason, never the raw reason code", () => {
    const text = formatStaffReportText({
      ...baseInput,
      status: "queued",
      reasonCode: "age_borderline_maximum",
    });
    expect(text).toContain("La edad estimada está cerca del máximo permitido");
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
    expect(text).toContain("Edad estimada: 17-19 años (estimado)");
  });

  it("omits the estimated-age line when the AI didn't evaluate it", () => {
    const text = formatStaffReportText(baseInput);
    expect(text).not.toContain("Edad estimada");
  });

  it("shows the IP-resolved country when available", () => {
    const text = formatStaffReportText({ ...baseInput, countryCode: "ES" });
    expect(text).toContain("🌍 ES");
  });

  it("omits the country line when it wasn't resolved", () => {
    const text = formatStaffReportText(baseInput);
    expect(text).not.toContain("País detectado");
  });

  it("NUNCA imprime la IP en crudo, ni teniendola", () => {
    // El informe es un mensaje de Telegram: se queda en el historial de la
    // sala, lo lee quien entre despues y se reenvia con dos toques. Nada de lo
    // que un revisor necesita exige leer la IP — el pais, el VPN y el aviso de
    // multicuenta ya vienen calculados.
    const withIp = formatStaffReportText({
      ...baseInput,
      verifierIp: "203.0.113.7",
    });
    expect(withIp).not.toContain("203.0.113.7");
    expect(withIp).not.toContain("🖧");
  });

  it("pero SI dice el pais y si la conexion es sospechosa", () => {
    // Quitar la IP no puede dejar ciego a quien revisa: lo util se queda.
    const text = formatStaffReportText({
      ...baseInput,
      verifierIp: "203.0.113.7",
      countryCode: "ES",
      ipReputation: { proxy: true, type: "VPN", risk: 66 },
    });
    expect(text).toContain("🌍 ES");
    expect(text).toContain("VPN/Proxy");
    expect(text).not.toContain("203.0.113.7");
  });

  it("flags a VPN/proxy IP, and marks a clean one, with the risk score", () => {
    const flagged = formatStaffReportText({
      ...baseInput,
      ipReputation: { proxy: true, type: "VPN", risk: 66 },
    });
    expect(flagged).toContain("VPN/Proxy");
    expect(flagged).toContain("riesgo 66/100");

    const clean = formatStaffReportText({
      ...baseInput,
      ipReputation: { proxy: false, type: null, risk: 2 },
    });
    expect(clean).toContain("✅ IP sin VPN/proxy");
    expect(clean).toContain("riesgo 2/100");
  });

  it("shows a plain reason for a country mismatch, never the raw code", () => {
    const text = formatStaffReportText({
      ...baseInput,
      status: "queued",
      reasonCode: "country_not_allowed",
      countryCode: "US",
    });
    expect(text).toContain(
      "El país detectado no está entre los permitidos para este grupo.",
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

  it("hands a mirrored copy nothing that can act on the case", () => {
    const keyboard = buildMirrorKeyboard("sess-1", secret, {
      telegramUserId: 123456789n,
      username: "nueva",
    }) as {
      inline_keyboard: Array<
        Array<{ text: string; callback_data?: string; url?: string }>
      >;
    };
    const actions = keyboard.inline_keyboard
      .flat()
      .flatMap((button) =>
        button.callback_data && button.callback_data !== STAFF_MIRROR_CALLBACK
          ? [parseStaffCallbackData(button.callback_data)?.action ?? "unknown"]
          : [],
      );
    // Exact: a new acting button added to the report later must break this
    // rather than silently reach the mirrors.
    expect(actions).toEqual(["report"]);
    // And the lock has to be visible, or an empty keyboard reads as breakage.
    expect(
      keyboard.inline_keyboard
        .flat()
        .some((b) => b.callback_data === STAFF_MIRROR_CALLBACK),
    ).toBe(true);
  });
});

describe("isMirroredStaffCopy", () => {
  const primary = {
    telegramChatId: -1001n,
    messageId: 10,
    isPrimary: true,
  };
  const mirror = {
    telegramChatId: -1002n,
    messageId: 20,
    isPrimary: false,
  };

  it("blocks a tap on a mirrored copy", () => {
    expect(
      isMirroredStaffCopy([primary, mirror], {
        chatId: -1002n,
        messageId: 20,
      }),
    ).toBe(true);
  });

  it("lets the primary room act", () => {
    expect(
      isMirroredStaffCopy([primary, mirror], {
        chatId: -1001n,
        messageId: 10,
      }),
    ).toBe(false);
  });

  it("does not block when there are no recorded copies at all", () => {
    // Reports that predate mirroring. Refusing here would make every one of
    // them undecidable by anyone.
    expect(isMirroredStaffCopy([], { chatId: -1001n, messageId: 10 })).toBe(
      false,
    );
  });

  it("does not block a message it cannot find among the copies", () => {
    // Writing the primary row is best-effort, so it CAN be missing while the
    // mirrors' rows exist. Treating "unknown" as "mirror" would then lock the
    // real STAFF room out of its own case — the exact failure this must avoid.
    expect(
      isMirroredStaffCopy([mirror], { chatId: -1001n, messageId: 10 }),
    ).toBe(false);
  });

  it("does not block when the callback carries no message id", () => {
    expect(
      isMirroredStaffCopy([primary, mirror], {
        chatId: -1002n,
        messageId: undefined,
      }),
    ).toBe(false);
  });

  it("does not confuse two rooms that share a message id", () => {
    // Message ids are per-chat, so the same number in two rooms is normal —
    // matching on the id alone would let a mirror pass as the primary.
    const clash = { telegramChatId: -1002n, messageId: 10, isPrimary: false };
    expect(
      isMirroredStaffCopy([primary, clash], { chatId: -1002n, messageId: 10 }),
    ).toBe(true);
  });
});

describe("describeChallengeStep", () => {
  it("renders a gesture as emoji + plain Spanish, never the raw action name", () => {
    expect(describeChallengeStep("show_three_fingers")).toBe("3️⃣ tres dedos");
    expect(describeChallengeStep("open_palm")).toBe("✋ palma abierta");
    expect(describeChallengeStep("vulcan_salute")).toBe("🖖 saludo vulcano");
  });

  it("falls back to the raw action for an unmapped gesture instead of crashing", () => {
    expect(describeChallengeStep("future_gesture")).toBe("future_gesture");
  });

  it("covers every photo gesture, so no report can leak a snake_case name", () => {
    for (const action of PHOTO_GESTURE_ACTIONS) {
      expect(describeChallengeStep(action)).not.toBe(action);
      expect(describeChallengeStep(action)).not.toContain("_");
    }
  });
});

describe("redactForMirror", () => {
  const withConnection: StaffReportInput = {
    ...baseInput,
    status: "queued",
    countryCode: "ES",
    verifierIp: "203.0.113.44",
    ipReputation: { proxy: true, type: "VPN", risk: 72 } as never,
    ipMatches: [{ telegramUserId: 999n, username: "otra" }] as never,
  };

  it("strips the IP, its country and its VPN verdict", () => {
    const text = formatStaffReportText(redactForMirror(withConnection));
    expect(text).not.toContain("203.0.113.44");
    expect(text).not.toContain("VPN");
    expect(text).not.toContain("ES");
  });

  it("strips the multi-account line, which is about OTHER people", () => {
    // The one that matters most: it names who else verified from the same
    // connection, and those people have no relationship with a mirror room.
    const text = formatStaffReportText(redactForMirror(withConnection));
    expect(text).not.toContain("otra");
    expect(text).not.toContain("999");
  });

  it("still says what happened, or the mirror is pointless", () => {
    const text = formatStaffReportText(redactForMirror(withConnection));
    expect(text).toContain("Verificación Guardian");
    expect(text).toContain(baseInput.sessionShortId);
    expect(text).toContain("Nueva Persona");
  });

  it("leaves the primary report untouched", () => {
    // Redaction must return a copy: mutating the shared input would silently
    // blind the room that actually decides the case. Se comprueba con el pais,
    // que es lo que el espejo borra y el principal conserva — la IP ya no vale
    // como testigo porque no se imprime en ninguno de los dos.
    redactForMirror(withConnection);
    expect(formatStaffReportText(withConnection)).toContain("🌍");
  });

  it("nulls every connection field, so a new one cannot leak by default", () => {
    const redacted = redactForMirror(withConnection);
    expect(redacted.verifierIp).toBeNull();
    expect(redacted.countryCode).toBeNull();
    expect(redacted.ipReputation).toBeNull();
    expect(redacted.ipMatches).toEqual([]);
  });
});

/**
 * El botón que tumbaba el informe entero.
 *
 * Telegram rechaza el MENSAJE COMPLETO —no solo el boton— con
 * BUTTON_USER_PRIVACY_RESTRICTED cuando lleva un `tg://user?id=` a alguien que
 * no permite que le enlacen asi. El 6 de agosto una verificacion resuelta se
 * quedo sin llegar a nadie por eso, rompiendo la regla de que todo caso
 * resuelto llega al STAFF.
 */
describe("stripPrivacyRestrictedButtons", () => {
  const teclado = {
    inline_keyboard: [
      [
        { text: "Aprobar", callback_data: "gv:approve:x" },
        { text: "Rechazar", callback_data: "gv:decline:x" },
      ],
      [{ text: "Contactar", url: "tg://user?id=42" }],
      [{ text: "Informe", url: "https://t.me/bot/app" }],
    ],
  };

  it("quita el enlace a la persona", () => {
    const out = stripPrivacyRestrictedButtons(teclado) as typeof teclado;
    const urls = out.inline_keyboard
      .flat()
      .map((b) => (b as { url?: string }).url);
    expect(urls).not.toContain("tg://user?id=42");
  });

  it("CONSERVA los botones con los que se decide", () => {
    // Un informe sin aprobar/rechazar obliga a resolver el caso a mano: seria
    // cambiar un fallo ruidoso por uno silencioso.
    const out = stripPrivacyRestrictedButtons(teclado) as typeof teclado;
    const acciones = out.inline_keyboard
      .flat()
      .map((b) => (b as { callback_data?: string }).callback_data)
      .filter(Boolean);
    expect(acciones).toContain("gv:approve:x");
    expect(acciones).toContain("gv:decline:x");
  });

  it("conserva los enlaces normales, que no molestan a nadie", () => {
    const out = stripPrivacyRestrictedButtons(teclado) as typeof teclado;
    const urls = out.inline_keyboard
      .flat()
      .map((b) => (b as { url?: string }).url);
    expect(urls).toContain("https://t.me/bot/app");
  });

  it("no deja filas vacias, que Telegram tampoco acepta", () => {
    const solo = { inline_keyboard: [[{ text: "C", url: "tg://user?id=7" }]] };
    const out = stripPrivacyRestrictedButtons(solo) as typeof solo;
    expect(out.inline_keyboard).toEqual([]);
  });

  it("aguanta basura sin reventar", () => {
    for (const raro of [null, undefined, 42, "x", {}]) {
      expect(() => stripPrivacyRestrictedButtons(raro)).not.toThrow();
    }
  });
});

describe("isButtonPrivacyError", () => {
  it("reconoce el error de Telegram", () => {
    expect(
      isButtonPrivacyError(
        new Error(
          "Telegram sendMessage failed with status 400: Bad Request: BUTTON_USER_PRIVACY_RESTRICTED",
        ),
      ),
    ).toBe(true);
  });

  it("no confunde otros fallos", () => {
    expect(isButtonPrivacyError(new Error("CHAT_ADMIN_REQUIRED"))).toBe(false);
    expect(isButtonPrivacyError(null)).toBe(false);
  });
});

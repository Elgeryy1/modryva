import { describe, expect, it } from "vitest";
import { classifyJoinRequestFailure } from "./join-request-outcome.js";

/**
 * El error que motivó todo esto, tal cual salió de producción.
 */
const ALREADY = new Error(
  "Telegram approveChatJoinRequest failed with status 400: Bad Request: USER_ALREADY_PARTICIPANT",
);
const MISSING = new Error(
  "Telegram approveChatJoinRequest failed with status 400: Bad Request: HIDE_REQUESTER_MISSING",
);

describe("el mismo error se lee distinto segun lo que pediamos", () => {
  it("ya-es-participante tras un approve es el final que queriamos", () => {
    expect(classifyJoinRequestFailure("approve", ALREADY)).toBe(
      "already-settled",
    );
  });

  it("ya-es-participante tras un decline es un fallo de verdad", () => {
    // Pedimos que NO entrara y esta dentro. Si esto se colara como benigno,
    // un rechazo que no rechaza nada seria invisible.
    expect(classifyJoinRequestFailure("decline", ALREADY)).toBe("failed");
  });
});

describe("la solicitud que ya no esta", () => {
  it("no se confunde con un fallo, ni en approve ni en decline", () => {
    expect(classifyJoinRequestFailure("approve", MISSING)).toBe(
      "no-longer-pending",
    );
    expect(classifyJoinRequestFailure("decline", MISSING)).toBe(
      "no-longer-pending",
    );
  });
});

describe("lo que no reconoce sale por la puerta ruidosa", () => {
  it("un error de permisos es un fallo", () => {
    expect(
      classifyJoinRequestFailure(
        "approve",
        new Error(
          "Telegram approveChatJoinRequest failed with status 400: Bad Request: not enough rights",
        ),
      ),
    ).toBe("failed");
  });

  it("un codigo de Telegram que aun no existe es un fallo, no un silencio", () => {
    // La prueba que evita que este filtro se vuelva una venda: cualquier
    // novedad de Telegram tiene que seguir gritando.
    expect(
      classifyJoinRequestFailure(
        "approve",
        new Error("PARTICIPANT_ID_INVALID"),
      ),
    ).toBe("failed");
  });

  it("aguanta cosas que no son Error sin clasificarlas mal", () => {
    expect(classifyJoinRequestFailure("approve", null)).toBe("failed");
    expect(classifyJoinRequestFailure("approve", undefined)).toBe("failed");
    expect(classifyJoinRequestFailure("approve", { code: 400 })).toBe("failed");
  });

  it("reconoce el motivo aunque llegue como texto pelado", () => {
    // Cruzando modulos un `instanceof Error` se pierde con facilidad; lo que
    // importa es el motivo, no el envoltorio.
    expect(
      classifyJoinRequestFailure(
        "approve",
        "Bad Request: USER_ALREADY_PARTICIPANT",
      ),
    ).toBe("already-settled");
  });
});

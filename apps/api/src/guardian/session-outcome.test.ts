import { describe, expect, it } from "vitest";
import { describirDesenlace } from "./session-outcome.js";

/**
 * Cada caso de aquí es una persona real del 11-ago-2026, y lo que se fija es
 * que NO se le vuelva a decir "ya se completó o fue cancelada" a quien no le
 * corresponde. La regla que más importa es la primera: el staff manda sobre la
 * decisión automática, porque entre las dos está la diferencia entre "ya estás
 * dentro" y "sigues esperando".
 */

const sesion = (status: string, decision: string | null = null) => ({
  status,
  decision,
});

describe("qué se le dice a quien vuelve con la sesión cerrada", () => {
  it("a quien la IA aprobó sola le dice que está aprobado, no cancelado", () => {
    // @usuario_alfa: auto-aprobado, DENTRO del grupo, y le salió tres veces
    // seguidas que su verificación estaba cancelada.
    expect(describirDesenlace(sesion("resolved", "auto_approve"), [])).toBe(
      "aprobada",
    );
  });

  it("a quien espera al staff le dice que está en revisión", () => {
    // @usuario_beta: ocho toques en un día con el caso sin decidir.
    expect(describirDesenlace(sesion("resolved", "manual_review"), [])).toBe(
      "en-revision",
    );
  });

  it("el staff manda sobre la decisión automática", () => {
    // Mandado a revisión por la IA y aprobado por un humano: está DENTRO. Leer
    // solo `decision` diría "en revisión" para siempre.
    expect(
      describirDesenlace(sesion("resolved", "manual_review"), ["approve"]),
    ).toBe("aprobada");
    expect(
      describirDesenlace(sesion("resolved", "manual_review"), ["decline"]),
    ).toBe("rechazada");
  });

  it("las acciones auxiliares del staff no cuentan como veredicto", () => {
    // retry/delete_media/mark_false_positive no deciden nada: quien pidió una
    // repetición sigue esperando, no está aprobado ni rechazado.
    expect(
      describirDesenlace(sesion("resolved", "manual_review"), [
        "retry",
        "delete_media",
        "mark_false_positive",
      ]),
    ).toBe("en-revision");
  });

  it("una sesión reemplazada manda al botón nuevo, no a un callejón", () => {
    // Volvió a pedir entrar: la vieja se canceló y el enlace bueno está más
    // abajo en el mismo chat. Decirle "ya se completó" le esconde la salida.
    expect(describirDesenlace(sesion("cancelled", null), [])).toBe(
      "reemplazada",
    );
  });

  it("un veredicto del staff pesa más que el reemplazo", () => {
    // Si un humano ya dijo que sí, da igual que la fila quedara cancelada.
    expect(describirDesenlace(sesion("cancelled", null), ["approve"])).toBe(
      "aprobada",
    );
  });

  it("un rechazo automático se dice tal cual", () => {
    expect(describirDesenlace(sesion("resolved", "auto_decline"), [])).toBe(
      "rechazada",
    );
  });

  it("sin decisión y sin staff, en revisión: es lo único que no miente", () => {
    // Cae aquí el fallo técnico (que por diseño nunca auto-aprueba y acaba en
    // manos de un humano) y cualquier estado que no sepamos leer. Prometer un
    // sí o cerrar la puerta serían las dos formas de equivocarse.
    expect(describirDesenlace(sesion("resolved", null), [])).toBe(
      "en-revision",
    );
    expect(
      describirDesenlace(sesion("resolved", "technical_failure"), []),
    ).toBe("en-revision");
  });
});

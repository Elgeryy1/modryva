import { describe, expect, it } from "vitest";
import { describeLlegadaTarde } from "./late-open.js";

/**
 * Lo que se fija aquí es que el dato sirva para decidir el TTL, no que la
 * función reste bien. Concretamente: que "cuánto tardó en abrir" se cuente
 * desde que la persona pidió entrar, no desde que la sesión murió — son dos
 * números distintos y solo el primero dice si subir el TTL sirve de algo.
 */

const sesion = (creada: string, caduca: string, status = "pending") => ({
  status,
  createdAt: new Date(creada),
  expiresAt: new Date(caduca),
});

describe("llegar tarde al enlace de verificación", () => {
  it("cuenta el tiempo desde que pidió entrar, no desde que caducó", () => {
    // TTL de 30 min; abre a los 45 desde que pidió entrar, o sea 15 tarde.
    const dato = describeLlegadaTarde(
      sesion("2026-08-05T10:00:00Z", "2026-08-05T10:30:00Z"),
      new Date("2026-08-05T10:45:00Z"),
      "caducada",
    );

    expect(dato.desdeElPrincipioMs).toBe(45 * 60_000);
    expect(dato.tardeMs).toBe(15 * 60_000);
  });

  it("separa 'caducada' de 'cerrada', porque solo una la arregla el TTL", () => {
    // Quien llega a una sesión ya resuelta no es un caso de TTL corto: ya se
    // decidió lo suyo. Mezclarlos inflaría el motivo equivocado.
    const caducada = describeLlegadaTarde(
      sesion("2026-08-05T10:00:00Z", "2026-08-05T10:30:00Z"),
      new Date("2026-08-05T11:00:00Z"),
      "caducada",
    );
    const cerrada = describeLlegadaTarde(
      sesion("2026-08-05T10:00:00Z", "2026-08-05T10:30:00Z", "resolved"),
      new Date("2026-08-05T11:00:00Z"),
      "cerrada",
    );

    expect(caducada.motivo).toBe("caducada");
    expect(cerrada.motivo).toBe("cerrada");
    expect(cerrada.estado).toBe("resolved");
  });

  it("un reloj que va hacia atrás no envenena la media con negativos", () => {
    // Un negativo colado en una media la baja en silencio y nadie lo mira.
    const dato = describeLlegadaTarde(
      sesion("2026-08-05T10:00:00Z", "2026-08-05T10:30:00Z"),
      new Date("2026-08-05T09:00:00Z"),
      "caducada",
    );

    expect(dato.tardeMs).toBe(0);
    expect(dato.desdeElPrincipioMs).toBe(0);
  });

  it("abrir justo al caducar cuenta 0 de retraso, no un número raro", () => {
    const dato = describeLlegadaTarde(
      sesion("2026-08-05T10:00:00Z", "2026-08-05T10:30:00Z"),
      new Date("2026-08-05T10:30:00Z"),
      "caducada",
    );

    expect(dato.tardeMs).toBe(0);
    expect(dato.desdeElPrincipioMs).toBe(30 * 60_000);
  });
});

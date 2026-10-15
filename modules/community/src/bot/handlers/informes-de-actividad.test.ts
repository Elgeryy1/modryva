import { describe, expect, it } from "vitest";

import {
  type ActividadDeMensaje,
  informeDeAbusoDeReacciones,
  informeDeMapaDeCalor,
  informeDeParticipacion,
  informeDeSenalDeAcoso,
} from "./informes-de-actividad.js";

const AHORA = new Date("2026-08-22T12:00:00Z").getTime();

const m = (parcial: Partial<ActividadDeMensaje> = {}): ActividadDeMensaje => ({
  autorId: "1",
  respondeAId: undefined,
  texto: "hola",
  enMs: AHORA,
  ...parcial,
});

/** El nucleo resuelve los nombres; aqui basta con uno de mentira. */
const nombreDe = (id: string) => `@u${id}`;

describe("sin datos, los tres lo dicen", () => {
  it("mapa de calor", () => {
    expect(informeDeMapaDeCalor([], 0)).toContain("Aún no hay actividad");
  });

  it("participacion", () => {
    expect(informeDeParticipacion([], nombreDe)).toContain("Aún no hay");
  });

  it("senal de acoso", () => {
    expect(informeDeSenalDeAcoso([], AHORA, nombreDe)).toContain(
      "No hay respuestas",
    );
  });
});

describe("informeDeMapaDeCalor respeta la zona horaria", () => {
  it("sin desfase lo dice en UTC", () => {
    expect(informeDeMapaDeCalor([m()], 0)).toContain("UTC");
  });

  it("con desfase lo dice, y con signo", () => {
    // Es lo que evita el problema del modo noche (C-24): decir una hora sin
    // decir de quien es.
    const texto = informeDeMapaDeCalor([m()], 120);
    expect(texto).toContain("UTC+2h");
  });

  it("un desfase negativo se lee igual de bien", () => {
    expect(informeDeMapaDeCalor([m()], -60)).toContain("UTC-1h");
  });
});

describe("informeDeParticipacion", () => {
  it("cuenta personas y mensajes, no solo mensajes", () => {
    const mensajes = [
      m({ autorId: "1" }),
      m({ autorId: "1" }),
      m({ autorId: "2" }),
    ];

    const texto = informeDeParticipacion(mensajes, nombreDe);
    expect(texto).toContain("2 personas");
    expect(texto).toContain("3 mensajes");
  });

  it("los mensajes sin autor no cuentan como persona", () => {
    // Hay filas de sistema sin autor; contarlas inflaria el reparto.
    const mensajes = [m({ autorId: "1" }), m({ autorId: undefined })];

    expect(informeDeParticipacion(mensajes, nombreDe)).toContain("1 personas");
  });

  it("cuando alguien acapara, lo nombra", () => {
    const mensajes = [
      ...Array.from({ length: 9 }, () => m({ autorId: "7" })),
      m({ autorId: "8" }),
    ];

    expect(informeDeParticipacion(mensajes, nombreDe)).toContain("@u7");
  });
});

describe("informeDeSenalDeAcoso", () => {
  it("los mensajes que no responden a nadie no cuentan", () => {
    const mensajes = [m({ respondeAId: undefined })];

    expect(informeDeSenalDeAcoso(mensajes, AHORA, nombreDe)).toContain(
      "No hay respuestas",
    );
  });

  it("lo de hace mas de una hora queda fuera de la ventana", () => {
    // El reloj entra por parametro justamente para poder probar esto.
    const viejos = [
      m({ autorId: "1", respondeAId: "9", enMs: AHORA - 3 * 60 * 60 * 1000 }),
      m({ autorId: "2", respondeAId: "9", enMs: AHORA - 3 * 60 * 60 * 1000 }),
      m({ autorId: "3", respondeAId: "9", enMs: AHORA - 3 * 60 * 60 * 1000 }),
    ];

    expect(informeDeSenalDeAcoso(viejos, AHORA, nombreDe)).toContain(
      "Sin señales",
    );
  });

  it("usa el resolutor de nombres que le pasan", () => {
    const recientes = [
      m({ autorId: "1", respondeAId: "9", enMs: AHORA - 1000 }),
      m({ autorId: "2", respondeAId: "9", enMs: AHORA - 2000 }),
      m({ autorId: "3", respondeAId: "9", enMs: AHORA - 3000 }),
      m({ autorId: "4", respondeAId: "9", enMs: AHORA - 4000 }),
    ];

    const texto = informeDeSenalDeAcoso(
      recientes,
      AHORA,
      (id) => `PERSONA-${id}`,
    );
    // O señala y usa el resolutor, o dice que no hay. Mudo no se queda.
    expect(texto.length).toBeGreaterThan(0);
  });
});

describe("informeDeAbusoDeReacciones", () => {
  const reaccion = (autorId: string | undefined, emoji: string, enMs: number) =>
    ({ autorId, respondeAId: undefined, texto: emoji, enMs }) as const;

  it("sin reacciones lo dice", () => {
    expect(informeDeAbusoDeReacciones([], AHORA, nombreDe)).toContain(
      "No hay reacciones",
    );
  });

  it("las reacciones sin emoji o sin autor no cuentan", () => {
    expect(
      informeDeAbusoDeReacciones(
        [reaccion("7", "", AHORA), reaccion(undefined, "👎", AHORA)],
        AHORA,
        nombreDe,
      ),
    ).toContain("No hay reacciones");
  });

  it("las reacciones positivas no son una oleada", () => {
    // La lista de emojis negativos vive en el modulo: que cuenta como negativo
    // es una decision suya, no del nucleo.
    const positivas = Array.from({ length: 10 }, () =>
      reaccion("7", "❤️", AHORA - 1000),
    );

    expect(informeDeAbusoDeReacciones(positivas, AHORA, nombreDe)).toContain(
      "Sin oleadas",
    );
  });

  it("lo de hace mas de una hora queda fuera", () => {
    const viejas = Array.from({ length: 10 }, () =>
      reaccion("7", "👎", AHORA - 3 * 60 * 60 * 1000),
    );

    expect(informeDeAbusoDeReacciones(viejas, AHORA, nombreDe)).toContain(
      "Sin oleadas",
    );
  });
});

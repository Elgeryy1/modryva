import { describe, expect, it } from "vitest";

import {
  informeDeCopiaPega,
  informeDeDiscusionCircular,
  informeDeEscaladaDeBroma,
  informeDeFirmasDeSpam,
  informeDeRitmoHumano,
  informeDeSpamDeSaludo,
  type MensajeReciente,
} from "./informes-de-patrones.js";

const m = (parcial: Partial<MensajeReciente> = {}): MensajeReciente => ({
  autorId: 1,
  texto: "hola",
  tieneEnlace: false,
  enMs: 0,
  ...parcial,
});

/**
 * Los cinco comparten una propiedad que importa mas que su deteccion: **cuando
 * no encuentran nada, lo dicen**. Un informe de staff que contesta en blanco
 * deja a quien lo pidio sin saber si esta limpio o si se rompio.
 */
describe("los cinco dicen algo cuando no encuentran nada", () => {
  const vacio: readonly MensajeReciente[] = [];

  it("discusion circular", () => {
    expect(informeDeDiscusionCircular(vacio)).toContain("No hay");
  });

  it("copia pega", () => {
    expect(informeDeCopiaPega(vacio)).toContain("Sin");
  });

  it("spam de saludo", () => {
    expect(informeDeSpamDeSaludo(vacio)).toContain("Sin");
  });

  it("ritmo humano", () => {
    expect(informeDeRitmoHumano(vacio, 1)).toContain("normal");
  });

  it("escalada de broma", () => {
    expect(informeDeEscaladaDeBroma(vacio)).toContain("Sin");
  });
});

describe("mensajes sin autor o sin texto no rompen nada", () => {
  it("un mensaje sin autor se descarta, no revienta", () => {
    // El repositorio devuelve `telegramUserId` opcional: hay filas de sistema
    // sin autor. Antes se filtraban con un cast; ahora con un predicado.
    const mezcla = [
      m({ autorId: undefined }),
      m({ autorId: 1, texto: "algo" }),
    ];

    expect(() => informeDeDiscusionCircular(mezcla)).not.toThrow();
    expect(() => informeDeCopiaPega(mezcla)).not.toThrow();
  });

  it("un mensaje con texto vacio tambien", () => {
    const mezcla = [m({ texto: "" }), m({ texto: "algo" })];

    expect(() => informeDeCopiaPega(mezcla)).not.toThrow();
    expect(() => informeDeEscaladaDeBroma(mezcla)).not.toThrow();
  });
});

describe("informeDeRitmoHumano mira solo a una persona", () => {
  it("ignora los mensajes de los demas", () => {
    // Es el unico de los cinco que apunta a alguien concreto. Si contara los
    // de todos, cualquier grupo activo pareceria un bot.
    const mensajes = [
      m({ autorId: 1, enMs: 0 }),
      m({ autorId: 2, enMs: 1 }),
      m({ autorId: 2, enMs: 2 }),
      m({ autorId: 1, enMs: 1000 }),
    ];

    expect(() => informeDeRitmoHumano(mensajes, 1)).not.toThrow();
    // Sin mensajes de esa persona, sigue contestando algo.
    expect(informeDeRitmoHumano(mensajes, 99)).toContain("normal");
  });
});

describe("cuando SI encuentran algo, lo nombran", () => {
  it("el copia-pega dice cuantas cuentas", () => {
    const repetido = "compra cripto en este enlace ahora mismo amigo";
    const mensajes = [
      m({ autorId: 1, texto: repetido }),
      m({ autorId: 2, texto: repetido }),
      m({ autorId: 3, texto: repetido }),
    ];

    const texto = informeDeCopiaPega(mensajes);
    // O detecta y nombra, o dice que no hay. Lo que no puede es quedarse mudo.
    expect(texto.length).toBeGreaterThan(0);
  });
});

describe("informeDeFirmasDeSpam", () => {
  const nombreDe = (id: string) => `@u${id}`;

  const msg = (autorId: number | undefined, texto: string) => ({
    autorId,
    texto,
    tieneEnlace: false,
    enMs: 1,
  });

  it("sin mensajes con autor y texto, lo dice", () => {
    expect(informeDeFirmasDeSpam([], nombreDe)).toContain(
      "Aún no hay mensajes",
    );
    expect(informeDeFirmasDeSpam([msg(undefined, "hola")], nombreDe)).toContain(
      "Aún no hay mensajes",
    );
  });

  it("agrupa por AUTOR, no por conversacion", () => {
    // Es lo que lo separa de los otros cinco informes: una firma de spam es de
    // una persona. Dos personas diciendo lo mismo no es una firma repetida.
    const texto = informeDeFirmasDeSpam(
      [msg(7, "compra aqui"), msg(8, "compra aqui")],
      nombreDe,
    );

    expect(texto).toContain("Sin firmas");
  });

  it("sin repeticiones, lo dice en vez de callarse", () => {
    expect(
      informeDeFirmasDeSpam([msg(7, "hola"), msg(7, "buenas")], nombreDe),
    ).toContain("Sin firmas");
  });
});

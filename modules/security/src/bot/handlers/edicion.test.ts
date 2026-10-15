import { describe, expect, it } from "vitest";

import {
  type EdicionParaRevisar,
  type MensajeOriginal,
  type OriginalDeMensajePort,
  revisarEdicion,
} from "./edicion.js";

/**
 * Se lleva la orquestacion entera, asi que los tests cubren tambien lo que
 * antes no tenia ninguno: que pasa cuando el original ya no esta, y que el
 * reloj llega inyectado en vez de leerse de `Date.now()`.
 */

const AHORA = new Date("2026-08-21T12:00:00Z").getTime();

const original = (
  parcial: Partial<MensajeOriginal> | null,
): OriginalDeMensajePort => ({
  buscar: async () =>
    parcial === null
      ? null
      : {
          texto: "hola",
          teniaEnlace: false,
          teniaMencion: false,
          publicadoEn: new Date(AHORA - 30_000),
          ...parcial,
        },
});

const edicion = (parcial: Partial<EdicionParaRevisar>): EdicionParaRevisar => ({
  mensajeId: 42n,
  textoNuevo: "hola",
  tieneEnlace: false,
  tieneMencion: false,
  ...parcial,
});

describe("revisarEdicion", () => {
  it("una edicion inocente no dice nada", async () => {
    expect(
      await revisarEdicion(
        edicion({ textoNuevo: "hola!" }),
        original({}),
        AHORA,
      ),
    ).toBeNull();
  });

  it("colar un enlace al editar avisa, y dice que fue el enlace", async () => {
    // El patron que este handler existe para cazar: llegar limpio y anadir el
    // enlace cuando la moderacion ya ha mirado el mensaje.
    const aviso = await revisarEdicion(
      edicion({ textoNuevo: "hola http://x.com", tieneEnlace: true }),
      original({}),
      AHORA,
    );

    expect(aviso).toContain("enlace");
  });

  it("colar una mencion avisa, y dice que fue la mencion", async () => {
    const aviso = await revisarEdicion(
      edicion({ textoNuevo: "hola @alguien", tieneMencion: true }),
      original({}),
      AHORA,
    );

    expect(aviso).toContain("mención");
  });

  it("si el original ya no esta, se calla", async () => {
    // El registro de actividad tiene ventana. Sin el original no hay
    // comparacion posible, y avisar a ciegas seria peor que callarse.
    expect(
      await revisarEdicion(
        edicion({ textoNuevo: "hola http://x.com", tieneEnlace: true }),
        original(null),
        AHORA,
      ),
    ).toBeNull();
  });

  it("sin id de mensaje o sin texto nuevo no hay nada que comparar", async () => {
    expect(
      await revisarEdicion(
        edicion({ mensajeId: undefined }),
        original({}),
        AHORA,
      ),
    ).toBeNull();
    expect(
      await revisarEdicion(
        edicion({ textoNuevo: undefined }),
        original({}),
        AHORA,
      ),
    ).toBeNull();
  });

  it("el reloj entra por parametro, no se lee de Date.now()", async () => {
    // Es lo que permite probar "editado justo despues" contra "editado tres
    // dias mas tarde" sin tocar el reloj del proceso.
    const recienPublicado = original({
      publicadoEn: new Date(AHORA - 1_000),
    });

    const aviso = await revisarEdicion(
      edicion({ textoNuevo: "hola http://x.com", tieneEnlace: true }),
      recienPublicado,
      AHORA,
    );

    expect(aviso).toContain("enlace");
  });

  it("cuando saltan spam y riesgo a la vez, manda el motivo de spam", async () => {
    // Los dos pueden dispararse con la misma edicion y solo se dice uno.
    // Invertir la precedencia no rompe nada visible: solo cambia lo que se le
    // dice a la persona, que es justo lo unico que hace este handler.
    const aviso = await revisarEdicion(
      edicion({
        textoNuevo: `http://x.com ${"a".repeat(200)}`,
        tieneEnlace: true,
      }),
      original({ publicadoEn: new Date(AHORA - 200_000) }),
      AHORA,
    );

    expect(aviso).toContain("enlace");
  });
});

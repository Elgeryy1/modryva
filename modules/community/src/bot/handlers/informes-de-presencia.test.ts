import { describe, expect, it } from "vitest";

import {
  type EventoConAutor,
  informeDeFantasmas,
  informeDeMiembrosInactivos,
} from "./informes-de-presencia.js";

const AHORA = new Date("2026-08-22T12:00:00Z").getTime();
const DIA = 24 * 60 * 60 * 1000;

const ev = (autorId: string | undefined, enMs: number): EventoConAutor => ({
  autorId,
  enMs,
});

const nombreDe = (id: string) => `@u${id}`;

describe("informeDeFantasmas", () => {
  it("sin entradas registradas lo dice", () => {
    // No es lo mismo que "no hay fantasmas": si nadie ha entrado, el informe
    // no tiene con que comparar.
    expect(informeDeFantasmas([], [], AHORA, nombreDe)).toContain(
      "No hay entradas",
    );
  });

  it("quien entro hace mas de un dia y no escribio es fantasma", () => {
    const texto = informeDeFantasmas(
      [ev("7", AHORA - 3 * DIA)],
      [],
      AHORA,
      nombreDe,
    );

    expect(texto).toContain("Fantasmas");
    expect(texto).toContain("@u7");
  });

  it("quien entro y escribio no es fantasma", () => {
    const texto = informeDeFantasmas(
      [ev("7", AHORA - 3 * DIA)],
      [ev("7", AHORA - 2 * DIA)],
      AHORA,
      nombreDe,
    );

    expect(texto).toContain("Sin miembros fantasma");
  });

  it("quien acaba de entrar todavia no cuenta", () => {
    // La ventana de cortesia son 24 horas: marcar a alguien de fantasma a los
    // diez minutos de entrar seria absurdo.
    expect(
      informeDeFantasmas([ev("7", AHORA - 1000)], [], AHORA, nombreDe),
    ).toContain("Sin miembros fantasma");
  });

  it("se queda con la PRIMERA entrada de cada persona", () => {
    // Alguien puede entrar, salir y volver. Lo que cuenta es cuando llego la
    // primera vez, o volver a entrar reiniciaria su cortesia para siempre.
    const texto = informeDeFantasmas(
      [ev("7", AHORA - 5 * DIA), ev("7", AHORA - 1000)],
      [],
      AHORA,
      nombreDe,
    );

    expect(texto).toContain("@u7");
  });

  it("los eventos sin autor no cuentan", () => {
    expect(
      informeDeFantasmas([ev(undefined, AHORA - 3 * DIA)], [], AHORA, nombreDe),
    ).toContain("No hay entradas");
  });

  it("anade la curva de silencio cuando alguien hablo", () => {
    // Sin ese segundo dato, "hay 40 fantasmas" no dice si es mucho o poco.
    const texto = informeDeFantasmas(
      [ev("7", AHORA - 3 * DIA), ev("8", AHORA - 3 * DIA)],
      [ev("8", AHORA - 3 * DIA + 60_000)],
      AHORA,
      nombreDe,
    );

    expect(texto).toContain("Hablaron");
  });
});

describe("informeDeMiembrosInactivos", () => {
  it("sin nadie inactivo lo dice", () => {
    expect(
      informeDeMiembrosInactivos([ev("7", AHORA - 1000)], AHORA, nombreDe),
    ).toContain("Sin miembros inactivos");
  });

  it("quien lleva semanas sin escribir sale, con los dias", () => {
    const texto = informeDeMiembrosInactivos(
      [ev("7", AHORA - 30 * DIA)],
      AHORA,
      nombreDe,
    );

    expect(texto).toContain("@u7");
    expect(texto).toContain("30d");
  });

  it("se queda con el ULTIMO mensaje de cada persona", () => {
    // Al reves que fantasmas: aqui lo que importa es cuando se le vio por
    // ultima vez. Quedarse con el primero marcaria como inactivo a quien
    // escribio ayer.
    expect(
      informeDeMiembrosInactivos(
        [ev("7", AHORA - 30 * DIA), ev("7", AHORA - 1000)],
        AHORA,
        nombreDe,
      ),
    ).toContain("Sin miembros inactivos");
  });

  it("usa el resolutor de nombres, no el id pelado", () => {
    // Antes se imprimia el id numerico: un numero de diez digitos no le dice
    // nada a quien lee el informe.
    expect(
      informeDeMiembrosInactivos([ev("7", AHORA - 30 * DIA)], AHORA, nombreDe),
    ).toContain("@u7");
  });
});

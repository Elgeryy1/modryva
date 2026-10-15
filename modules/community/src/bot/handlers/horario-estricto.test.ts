import { describe, expect, it, vi } from "vitest";

import {
  aplicarHorarioEstricto,
  type MensajeParaHorario,
  type PuertosDeHorarioEstricto,
  reglasValidas,
} from "./horario-estricto.js";

const ESTRICTA = { startHour: 23, endHour: 7, strict: true };
const RELAJADA = { startHour: 9, endHour: 18, strict: false };

const conEnlace: MensajeParaHorario = { esComando: false, tieneEnlace: true };

const puertos = (
  parcial: Partial<PuertosDeHorarioEstricto> = {},
): PuertosDeHorarioEstricto => ({
  reglasDelChat: async () => [ESTRICTA],
  esAdministrador: async () => false,
  borrarMensaje: async () => undefined,
  ...parcial,
});

describe("aplicarHorarioEstricto", () => {
  it("dentro de la franja estricta borra y avisa", async () => {
    const borrarMensaje = vi.fn(async () => undefined);

    const aviso = await aplicarHorarioEstricto(
      conEnlace,
      2,
      puertos({ borrarMensaje }),
    );

    expect(borrarMensaje).toHaveBeenCalledTimes(1);
    expect(aviso).toContain("no se permiten enlaces");
  });

  it("fuera de la franja no toca nada", async () => {
    const borrarMensaje = vi.fn(async () => undefined);

    expect(
      await aplicarHorarioEstricto(conEnlace, 15, puertos({ borrarMensaje })),
    ).toBeNull();
    expect(borrarMensaje).not.toHaveBeenCalled();
  });

  it("un mensaje sin enlace no dispara nada, ni siquiera leer los ajustes", async () => {
    // La guarda mas barata va primera: esto corre en CADA mensaje del grupo.
    const reglasDelChat = vi.fn(async () => [ESTRICTA]);

    await aplicarHorarioEstricto(
      { esComando: false, tieneEnlace: false },
      2,
      puertos({ reglasDelChat }),
    );

    expect(reglasDelChat).not.toHaveBeenCalled();
  });

  it("un admin se salta la franja", async () => {
    const borrarMensaje = vi.fn(async () => undefined);

    expect(
      await aplicarHorarioEstricto(
        conEnlace,
        2,
        puertos({ esAdministrador: async () => true, borrarMensaje }),
      ),
    ).toBeNull();
    expect(borrarMensaje).not.toHaveBeenCalled();
  });

  it("no pregunta por el admin si no hay franja estricta", async () => {
    // Es lo caro: preguntar cuesta una llamada a Telegram. Invertir el orden
    // la haria en cada mensaje con enlace, tambien fuera de horario.
    const esAdministrador = vi.fn(async () => false);

    await aplicarHorarioEstricto(conEnlace, 15, puertos({ esAdministrador }));

    expect(esAdministrador).not.toHaveBeenCalled();
  });

  it("si Telegram rechaza el borrado, se contesta igual", async () => {
    // Quitar este catch dejaria sin respuesta a quien escribio, ademas de
    // abortar el update entero.
    const aviso = await aplicarHorarioEstricto(
      conEnlace,
      2,
      puertos({
        borrarMensaje: async () => {
          throw new Error("message can't be deleted");
        },
      }),
    );

    expect(aviso).toContain("no se permiten enlaces");
  });

  it("sin reglas guardadas no hace nada", async () => {
    expect(
      await aplicarHorarioEstricto(
        conEnlace,
        2,
        puertos({ reglasDelChat: async () => [] }),
      ),
    ).toBeNull();
  });
});

describe("reglasValidas", () => {
  it("descarta lo que no tiene forma de regla", async () => {
    // Vienen de la base de datos, donde cabe cualquier cosa: un ajuste viejo,
    // una edicion a mano. El nucleo se fiaba con un cast.
    expect(reglasValidas([ESTRICTA, { startHour: "23" }, null, 7])).toEqual([
      ESTRICTA,
    ]);
  });

  it("lo que no es una lista da lista vacia", () => {
    expect(reglasValidas(undefined)).toEqual([]);
    expect(reglasValidas({ startHour: 23 })).toEqual([]);
    expect(reglasValidas("23-7")).toEqual([]);
  });

  it("una regla no estricta es valida, solo que no obliga", async () => {
    expect(reglasValidas([RELAJADA])).toEqual([RELAJADA]);
    expect(
      await aplicarHorarioEstricto(
        conEnlace,
        12,
        puertos({ reglasDelChat: async () => [RELAJADA] }),
      ),
    ).toBeNull();
  });
});

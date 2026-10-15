import { describe, expect, it } from "vitest";

import type { ActividadDeChat } from "../puertos.js";
import {
  actividadDesdeUpdate,
  cuentaComoActividad,
  registrarActividadDeChat,
  type UpdateParaActividad,
} from "./actividad.js";

/**
 * El primer handler extraido del servicio, y la prueba de que el patron sirve.
 *
 * Fijate en lo que NO hay aqui: ni un `BotUpdateService`, ni 56 dependencias,
 * ni Prisma, ni un gateway. El modulo recibe un update ya normalizado y un
 * puerto, asi que su logica se prueba con dos objetos literales. Ese es el
 * objetivo entero de la modularizacion — que tocar esto no pueda romper
 * moderacion ni Guardian, y que probarlo no cueste 17.000 lineas de andamiaje.
 */

const BASE: UpdateParaActividad = {
  tipo: "message",
  esComando: false,
  texto: "hola",
  tenantId: "t1",
  chatId: "c1",
  tieneEnlace: false,
  tieneMencion: false,
  usuarioTelegramId: 7n,
  usuario: "gery",
  respondeAUsuarioId: undefined,
  tema: undefined,
  mensajeId: 42n,
};

/** Un puerto que apunta lo que le mandan, sin base de datos ninguna. */
const registroFalso = () => {
  const registradas: ActividadDeChat[] = [];
  return {
    registradas,
    puerto: {
      registrar: async (actividad: ActividadDeChat) => {
        registradas.push(actividad);
      },
    },
  };
};

describe("cuentaComoActividad", () => {
  it("un mensaje de texto normal cuenta", () => {
    expect(cuentaComoActividad(BASE)).toBe(true);
  });

  it("un comando NO cuenta", () => {
    // Es la diferencia con el registro completo (message-log.archive), que si
    // guarda comandos. Son dos cosas distintas a proposito.
    expect(cuentaComoActividad({ ...BASE, esComando: true })).toBe(false);
  });

  it("lo que no es un mensaje no cuenta", () => {
    expect(cuentaComoActividad({ ...BASE, tipo: "callback_query" })).toBe(
      false,
    );
  });

  it("un mensaje sin texto no cuenta", () => {
    expect(cuentaComoActividad({ ...BASE, texto: undefined })).toBe(false);
    expect(cuentaComoActividad({ ...BASE, texto: "" })).toBe(false);
  });

  it("sin chat resuelto no cuenta", () => {
    expect(cuentaComoActividad({ ...BASE, chatId: undefined })).toBe(false);
  });
});

describe("actividadDesdeUpdate", () => {
  it("traslada los campos tal cual", () => {
    expect(actividadDesdeUpdate(BASE)).toEqual({
      tenantId: "t1",
      chatId: "c1",
      texto: "hola",
      tieneEnlace: false,
      tieneMencion: false,
      usuarioTelegramId: 7n,
      usuario: "gery",
      mensajeId: 42n,
    });
  });

  it("omite los campos ausentes en vez de ponerlos a undefined", () => {
    const actividad = actividadDesdeUpdate({
      ...BASE,
      usuario: undefined,
      mensajeId: undefined,
    });
    // Importa: la fila no debe llevar columnas puestas a null por accidente
    // solo porque el update no traia el dato.
    expect(actividad).not.toHaveProperty("usuario");
    expect(actividad).not.toHaveProperty("mensajeId");
  });

  it("conserva a quien se responde y el tema del foro", () => {
    const actividad = actividadDesdeUpdate({
      ...BASE,
      respondeAUsuarioId: 99n,
      tema: "12",
    });
    expect(actividad).toMatchObject({ respondeAUsuarioId: 99n, tema: "12" });
  });

  it("devuelve null para lo que no cuenta", () => {
    expect(actividadDesdeUpdate({ ...BASE, esComando: true })).toBeNull();
  });
});

describe("registrarActividadDeChat", () => {
  it("registra y devuelve null: nunca corta la cadena", async () => {
    const { puerto, registradas } = registroFalso();
    await expect(registrarActividadDeChat(BASE, puerto)).resolves.toBeNull();
    expect(registradas).toHaveLength(1);
  });

  it("no registra nada cuando el update no cuenta", async () => {
    const { puerto, registradas } = registroFalso();
    await registrarActividadDeChat({ ...BASE, esComando: true }, puerto);
    expect(registradas).toHaveLength(0);
  });

  it("si el registro falla, sigue devolviendo null", async () => {
    // Es best-effort: perder una fila de telemetria no puede dejar sin
    // respuesta a quien escribio. Por eso ademas esta declarado como tolerante
    // en el nucleo.
    const puerto = {
      registrar: async () => {
        throw new Error("la base de datos no responde");
      },
    };
    await expect(registrarActividadDeChat(BASE, puerto)).resolves.toBeNull();
  });
});

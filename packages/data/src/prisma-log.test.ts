import { describe, expect, it } from "vitest";
import { prismaLogLevel } from "./prisma-log.js";

/**
 * El filtro que decide qué error de Prisma es una noticia. Se prueba aparte
 * del cableado porque equivocarse aquí hacia el silencio significa perder
 * fallos de base de datos de verdad, y eso no se nota hasta que se necesita.
 */

describe("baja de nivel lo que el codigo ya espera", () => {
  it("el choque de idempotencyKey (76 de los 94 en produccion)", () => {
    expect(
      prismaLogLevel(
        "Invalid `prisma.verificationSession.create()` invocation:\nUnique constraint failed on the fields: (`idempotencyKey`)",
      ),
    ).toBe("debug");
  });

  it("el choque de asiento al pulsar Unirme a la vez", () => {
    expect(
      prismaLogLevel(
        "Invalid `prisma.gameMatchPlayer.create()` invocation:\nUnique constraint failed on the fields: (`matchId`,`seatIndex`)",
      ),
    ).toBe("debug");
  });

  it("tambien si llega como codigo pelado", () => {
    expect(prismaLogLevel("P2002")).toBe("debug");
  });
});

describe("todo lo demas sigue siendo error", () => {
  it("una conexion caida", () => {
    expect(
      prismaLogLevel("Can't reach database server at `postgres`:`5432`"),
    ).toBe("error");
  });

  it("un timeout del pool", () => {
    expect(
      prismaLogLevel(
        "Timed out fetching a new connection from the connection pool",
      ),
    ).toBe("error");
  });

  it("una clave foranea rota", () => {
    expect(
      prismaLogLevel("Foreign key constraint failed on the field: `matchId`"),
    ).toBe("error");
  });

  it("una migracion pendiente", () => {
    expect(
      prismaLogLevel("The table `public.game_matches` does not exist"),
    ).toBe("error");
  });

  it("un mensaje vacio no se cuela por silencio", () => {
    // El caso que decide si este filtro es un filtro o una venda: lo que no
    // reconoce tiene que salir por la puerta ruidosa.
    expect(prismaLogLevel("")).toBe("error");
  });
});

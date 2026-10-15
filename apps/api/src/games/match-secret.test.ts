import {
  InMemoryGameMatchPlayerRepository,
  InMemoryGameMatchRepository,
  type PrismaClient,
} from "@superbot/data";
import { beforeEach, describe, expect, it } from "vitest";
import { MatchService } from "./match.service.js";

/**
 * `MatchService.secret`: lo que solo puede ver quien pregunta.
 *
 * Se prueba el metodo de verdad, con los repositorios en memoria inyectados.
 * El cliente de Prisma se pasa como un objeto vacio porque `secret` no lo toca:
 * si algun dia lo tocara, este test reventaria, que es exactamente lo que
 * tendria que pasar.
 */

const TENANT = "t1";
let service: MatchService;
let matches: InMemoryGameMatchRepository;
let seats: InMemoryGameMatchPlayerRepository;
let matchId: string;

beforeEach(async () => {
  matches = new InMemoryGameMatchRepository();
  seats = new InMemoryGameMatchPlayerRepository();
  service = new MatchService({} as PrismaClient, matches, seats);

  const match = await matches.create({
    tenantId: TENANT,
    chatId: -100n,
    game: "impostor",
    hostId: 1n,
    hostName: "Ana",
    state: { phase: "clues" },
  });
  matchId = match.id;

  for (const [id, nombre] of [
    [1n, "Ana"],
    [2n, "Luis"],
    [3n, "Eva"],
    [4n, "Marc"],
  ] as const) {
    await seats.join({
      matchId,
      tenantId: TENANT,
      userId: id,
      name: nombre,
      maxPlayers: 12,
    });
  }
  await seats.dealSecrets(
    matchId,
    new Map<bigint, unknown>([
      [1n, { role: "impostor", word: "piscina" }],
      [2n, { role: "crew", word: "playa" }],
      [3n, { role: "crew", word: "playa" }],
      [4n, { role: "crew", word: "playa" }],
    ]),
  );
});

describe("lo privado de una partida", () => {
  it("cada uno recibe lo suyo", async () => {
    expect((await service.secret("1", matchId)).secret).toEqual({
      role: "impostor",
      word: "piscina",
    });
    expect((await service.secret("2", matchId)).secret).toEqual({
      role: "crew",
      word: "playa",
    });
  });

  it("el roster que acompaña NO lleva secretos de nadie", async () => {
    // Es lo que se pinta en pantalla junto a tu mano: si arrastrase `secret`,
    // ver lo tuyo seria ver lo de todos.
    const res = await service.secret("2", matchId);
    const plano = JSON.stringify(res.players);
    expect(plano).not.toContain("impostor");
    expect(plano).not.toContain("piscina");
    expect(res.players).toHaveLength(4);
  });

  it("quien no juega no ve nada", async () => {
    const res = await service.secret("999", matchId);
    expect(res.secret).toBeNull();
  });

  it("una partida que no existe se contesta como una en la que no juegas", async () => {
    // Distinguirlas le diria a cualquiera si una partida existe y quien esta
    // dentro, probando ids.
    const res = await service.secret("1", "no-existe");
    expect(res.secret).toBeNull();
    expect(res.game).toBeNull();
  });

  it("sin id no contesta nada", async () => {
    await expect(service.secret("1", "")).rejects.toThrow();
  });

  it("no hay parametro para pedir el secreto de otro", async () => {
    // El id de quien pregunta sale de initData verificado, que el cliente no
    // elige. Este test fija la forma: si alguien añadiese un tercer parametro
    // 'targetUserId', aqui se veria.
    expect(service.secret.length).toBe(2);
  });
});

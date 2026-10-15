import { describe, expect, it } from "vitest";
import { InMemoryGameMatchPlayerRepository } from "./game-match-player-repository.js";

const MATCH = "m1";
const TENANT = "t1";

const sit = (
  repo: InMemoryGameMatchPlayerRepository,
  userId: bigint,
  maxPlayers = 8,
) =>
  repo.join({
    matchId: MATCH,
    tenantId: TENANT,
    userId,
    name: `u${userId}`,
    maxPlayers,
  });

describe("sentarse", () => {
  it("da asientos por orden de llegada", async () => {
    const repo = new InMemoryGameMatchPlayerRepository();
    const a = await sit(repo, 1n);
    const b = await sit(repo, 2n);
    expect(a).toMatchObject({ ok: true, seat: { seatIndex: 0 } });
    expect(b).toMatchObject({ ok: true, seat: { seatIndex: 1 } });
  });

  it("no da dos asientos a la misma persona", async () => {
    const repo = new InMemoryGameMatchPlayerRepository();
    await sit(repo, 1n);
    expect(await sit(repo, 1n)).toEqual({ ok: false, reason: "already-in" });
    expect(await repo.roster(MATCH)).toHaveLength(1);
  });

  it("cierra la mesa al llegar al tope", async () => {
    const repo = new InMemoryGameMatchPlayerRepository();
    await sit(repo, 1n, 2);
    await sit(repo, 2n, 2);
    expect(await sit(repo, 3n, 2)).toEqual({ ok: false, reason: "full" });
  });

  it("cada partida lleva su propia cuenta de asientos", async () => {
    const repo = new InMemoryGameMatchPlayerRepository();
    await sit(repo, 1n);
    const otra = await repo.join({
      matchId: "m2",
      tenantId: TENANT,
      userId: 1n,
      name: "u1",
      maxPlayers: 8,
    });
    // La misma persona en dos partidas distintas es normal, no un duplicado.
    expect(otra).toMatchObject({ ok: true, seat: { seatIndex: 0 } });
  });
});

describe("lo privado", () => {
  it("el roster NO lleva secretos", async () => {
    const repo = new InMemoryGameMatchPlayerRepository();
    await sit(repo, 1n);
    await repo.dealSecrets(MATCH, new Map([[1n, { palabra: "playa" }]]));
    const roster = await repo.roster(MATCH);
    // Esto es la defensa entera: si el roster arrastrase `secret`, cualquier
    // respuesta que devuelva la partida enseñaria la palabra al grupo.
    // Los id de Telegram son BigInt y JSON.stringify no sabe serializarlos:
    // se pasan a texto antes de mirar dentro.
    const plano = JSON.stringify(roster, (_k, v) =>
      typeof v === "bigint" ? v.toString() : v,
    );
    expect(plano).not.toContain("playa");
    expect(roster[0]).not.toHaveProperty("secret");
  });

  it("cada uno ve lo suyo", async () => {
    const repo = new InMemoryGameMatchPlayerRepository();
    await sit(repo, 1n);
    await sit(repo, 2n);
    await repo.dealSecrets(
      MATCH,
      new Map<bigint, unknown>([
        [1n, { rol: "impostor" }],
        [2n, { rol: "tripulante" }],
      ]),
    );
    expect(await repo.secretFor(MATCH, 1n)).toEqual({ rol: "impostor" });
    expect(await repo.secretFor(MATCH, 2n)).toEqual({ rol: "tripulante" });
  });

  it("quien no juega no ve nada", async () => {
    const repo = new InMemoryGameMatchPlayerRepository();
    await sit(repo, 1n);
    await repo.dealSecrets(MATCH, new Map([[1n, { rol: "impostor" }]]));
    expect(await repo.secretFor(MATCH, 999n)).toBeNull();
  });
});

describe("eliminaciones", () => {
  it("saca de la lista de vivos sin borrar la fila", async () => {
    const repo = new InMemoryGameMatchPlayerRepository();
    await sit(repo, 1n);
    await sit(repo, 2n);
    expect(await repo.setStatus(MATCH, 1n, "out")).toBe(true);

    expect(await repo.countAlive(MATCH)).toBe(1);
    // La fila sigue: la partida tiene que poder contar quien cayo.
    expect(await repo.roster(MATCH)).toHaveLength(2);
  });

  it("no inventa a quien no esta", async () => {
    const repo = new InMemoryGameMatchPlayerRepository();
    expect(await repo.setStatus(MATCH, 7n, "out")).toBe(false);
  });

  it("los numeros de asiento no se reciclan al irse alguien", async () => {
    const repo = new InMemoryGameMatchPlayerRepository();
    await sit(repo, 1n);
    await sit(repo, 2n);
    await repo.setStatus(MATCH, 1n, "left");
    const tercero = await sit(repo, 3n);
    // Reutilizar el 0 haria que el turno saltase hacia atras a mitad de ronda.
    expect(tercero).toMatchObject({ ok: true, seat: { seatIndex: 2 } });
  });
});

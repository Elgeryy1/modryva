import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Los asientos de una partida de grupo.
 *
 * Dos reglas mandan sobre todo lo demas:
 *
 * 1. Apuntarse lo resuelve la base de datos, no el codigo. Media docena de
 *    personas pulsando "me apunto" en el mismo segundo es lo normal en un
 *    grupo, no un caso raro; contar jugadores y luego insertar seria una
 *    carrera perdida de antemano.
 * 2. Lo privado se lee aparte y a proposito. `roster()` NUNCA devuelve
 *    `secret`. Para verlo hay que llamar a `secretFor`, que pide de quien.
 *    Asi, enseñar la palabra del impostor al grupo entero no puede pasar por
 *    descuido: hace falta escribir la llamada que lo pide.
 */

/** Un asiento, sin nada privado dentro. Lo que puede ver todo el mundo. */
export interface MatchSeat {
  readonly matchId: string;
  readonly userId: bigint;
  readonly name: string | null;
  readonly seatIndex: number;
  readonly status: string;
}

export type SeatStatus = "alive" | "out" | "left";

export type JoinSeatResult =
  | { readonly ok: true; readonly seat: MatchSeat }
  | {
      readonly ok: false;
      readonly reason: "already-in" | "full" | "gone";
    };

export interface GameMatchPlayerRepository {
  /**
   * Sienta a alguien. Idempotente por persona: quien ya esta dentro recibe
   * "already-in" en vez de un segundo asiento.
   */
  join(input: {
    readonly matchId: string;
    readonly tenantId: string;
    readonly userId: bigint;
    readonly name: string | null;
    readonly maxPlayers: number;
  }): Promise<JoinSeatResult>;

  /** Todos los asientos por orden de llegada. Sin secretos. */
  roster(matchId: string): Promise<readonly MatchSeat[]>;

  /** Solo los que siguen en juego. */
  alive(matchId: string): Promise<readonly MatchSeat[]>;

  /**
   * Lo privado de UNA persona. Devuelve null si esa persona no juega esta
   * partida, que es lo mismo que decirle "no tienes nada que ver aqui".
   */
  secretFor(matchId: string, userId: bigint): Promise<unknown | null>;

  /**
   * Reparte. Se hace en una transaccion porque una reparticion a medias deja
   * una partida injugable: gente con carta y gente sin ella, sin forma de
   * distinguir a quien le falta de a quien no le tocaba nada.
   */
  dealSecrets(
    matchId: string,
    secrets: ReadonlyMap<bigint, unknown>,
  ): Promise<void>;

  /** Marca a alguien fuera. No borra: la partida tiene que poder contar que paso. */
  setStatus(
    matchId: string,
    userId: bigint,
    status: SeatStatus,
  ): Promise<boolean>;

  /** Cuantos siguen vivos. Para saber si la partida ya esta decidida. */
  countAlive(matchId: string): Promise<number>;
}

const toSeat = (row: {
  matchId: string;
  userId: bigint;
  name: string | null;
  seatIndex: number;
  status: string;
}): MatchSeat => ({
  matchId: row.matchId,
  userId: row.userId,
  name: row.name,
  seatIndex: row.seatIndex,
  status: row.status,
});

/** Solo los campos publicos: si `secret` no se pide, no puede escaparse. */
const PUBLIC_FIELDS = {
  matchId: true,
  userId: true,
  name: true,
  seatIndex: true,
  status: true,
} as const;

/** Codigo de Prisma para "violaste un indice unico". */
const UNIQUE_VIOLATION = "P2002";

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === UNIQUE_VIOLATION;

/** Que indice reviento: importa, porque uno es definitivo y el otro no. */
const violatedFields = (error: unknown): readonly string[] => {
  const target = (error as { meta?: { target?: unknown } })?.meta?.target;
  if (Array.isArray(target)) {
    return target.filter((f): f is string => typeof f === "string");
  }
  return typeof target === "string" ? [target] : [];
};

/**
 * Intentos de conseguir hueco antes de rendirse.
 *
 * Cada choque de asiento gasta uno, y solo puede haber tantos choques
 * simultaneos como gente pulsando a la vez. Ocho es holgado para un grupo de
 * Telegram y evita que un fallo raro se convierta en un bucle infinito.
 */
const SEAT_ATTEMPTS = 8;

export class PrismaGameMatchPlayerRepository
  implements GameMatchPlayerRepository
{
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async join(input: {
    matchId: string;
    tenantId: string;
    userId: bigint;
    name: string | null;
    maxPlayers: number;
  }): Promise<JoinSeatResult> {
    for (let intento = 0; intento < SEAT_ATTEMPTS; intento += 1) {
      const ocupados = await this.client.gameMatchPlayer.count({
        where: { matchId: input.matchId },
      });
      if (ocupados >= input.maxPlayers) {
        return { ok: false, reason: "full" };
      }
      try {
        const row = await this.client.gameMatchPlayer.create({
          data: {
            matchId: input.matchId,
            tenantId: input.tenantId,
            userId: input.userId,
            name: input.name,
            seatIndex: ocupados,
          },
          select: PUBLIC_FIELDS,
        });
        return { ok: true, seat: toSeat(row) };
      } catch (error) {
        if (!isUniqueViolation(error)) {
          // Una clave foranea rota aqui solo significa una cosa: la partida ya
          // no existe. Cualquier otra cosa sube, porque no se que es.
          if (
            typeof error === "object" &&
            error !== null &&
            (error as { code?: unknown }).code === "P2003"
          ) {
            return { ok: false, reason: "gone" };
          }
          throw error;
        }
        const campos = violatedFields(error);
        // Choque de PERSONA: definitivo, ya estaba dentro. Reintentar solo
        // volveria a chocar.
        if (campos.includes("userId")) {
          return { ok: false, reason: "already-in" };
        }
        // Choque de ASIENTO: alguien cogio ese numero entre el count y el
        // insert. Se vuelve a contar y se coge el siguiente.
      }
    }
    // Ocho carreras perdidas seguidas: se trata como mesa llena en vez de
    // devolver un error de sistema, porque para quien pulsa es lo mismo y
    // asi el mensaje que ve tiene sentido.
    return { ok: false, reason: "full" };
  }

  async roster(matchId: string): Promise<readonly MatchSeat[]> {
    const rows = await this.client.gameMatchPlayer.findMany({
      where: { matchId },
      orderBy: { seatIndex: "asc" },
      select: PUBLIC_FIELDS,
    });
    return rows.map(toSeat);
  }

  async alive(matchId: string): Promise<readonly MatchSeat[]> {
    const rows = await this.client.gameMatchPlayer.findMany({
      where: { matchId, status: "alive" },
      orderBy: { seatIndex: "asc" },
      select: PUBLIC_FIELDS,
    });
    return rows.map(toSeat);
  }

  async secretFor(matchId: string, userId: bigint): Promise<unknown | null> {
    const row = await this.client.gameMatchPlayer.findUnique({
      where: { matchId_userId: { matchId, userId } },
      select: { secret: true },
    });
    return row?.secret ?? null;
  }

  async dealSecrets(
    matchId: string,
    secrets: ReadonlyMap<bigint, unknown>,
  ): Promise<void> {
    await this.client.$transaction(
      [...secrets].map(([userId, secret]) =>
        this.client.gameMatchPlayer.update({
          where: { matchId_userId: { matchId, userId } },
          data: { secret: secret as never },
        }),
      ),
    );
  }

  async setStatus(
    matchId: string,
    userId: bigint,
    status: SeatStatus,
  ): Promise<boolean> {
    const res = await this.client.gameMatchPlayer.updateMany({
      where: { matchId, userId },
      data: { status },
    });
    return res.count > 0;
  }

  async countAlive(matchId: string): Promise<number> {
    return this.client.gameMatchPlayer.count({
      where: { matchId, status: "alive" },
    });
  }
}

/** Doble de test: mismo contrato, sin base de datos. */
export class InMemoryGameMatchPlayerRepository
  implements GameMatchPlayerRepository
{
  private readonly rows: {
    matchId: string;
    tenantId: string;
    userId: bigint;
    name: string | null;
    seatIndex: number;
    status: string;
    secret: unknown;
  }[] = [];

  async join(input: {
    matchId: string;
    tenantId: string;
    userId: bigint;
    name: string | null;
    maxPlayers: number;
  }): Promise<JoinSeatResult> {
    const dentro = this.rows.filter((r) => r.matchId === input.matchId);
    if (dentro.some((r) => r.userId === input.userId)) {
      return { ok: false, reason: "already-in" };
    }
    if (dentro.length >= input.maxPlayers) {
      return { ok: false, reason: "full" };
    }
    const row = {
      matchId: input.matchId,
      tenantId: input.tenantId,
      userId: input.userId,
      name: input.name,
      seatIndex: dentro.length,
      status: "alive",
      secret: null as unknown,
    };
    this.rows.push(row);
    return { ok: true, seat: toSeat(row) };
  }

  async roster(matchId: string): Promise<readonly MatchSeat[]> {
    return this.rows
      .filter((r) => r.matchId === matchId)
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map(toSeat);
  }

  async alive(matchId: string): Promise<readonly MatchSeat[]> {
    return (await this.roster(matchId)).filter((s) => s.status === "alive");
  }

  async secretFor(matchId: string, userId: bigint): Promise<unknown | null> {
    const row = this.rows.find(
      (r) => r.matchId === matchId && r.userId === userId,
    );
    return row?.secret ?? null;
  }

  async dealSecrets(
    matchId: string,
    secrets: ReadonlyMap<bigint, unknown>,
  ): Promise<void> {
    for (const [userId, secret] of secrets) {
      const row = this.rows.find(
        (r) => r.matchId === matchId && r.userId === userId,
      );
      if (row) {
        row.secret = secret;
      }
    }
  }

  async setStatus(
    matchId: string,
    userId: bigint,
    status: SeatStatus,
  ): Promise<boolean> {
    const row = this.rows.find(
      (r) => r.matchId === matchId && r.userId === userId,
    );
    if (!row) {
      return false;
    }
    row.status = status;
    return true;
  }

  async countAlive(matchId: string): Promise<number> {
    return (await this.alive(matchId)).length;
  }
}

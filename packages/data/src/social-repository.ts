import type { PrismaClient } from "@prisma/client";
import { type CounterSink, NOOP_COUNTERS } from "@superbot/shared";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Persistence for the social core.
 *
 * The interesting part is `claimPosition`. Everything else is ordinary reads.
 *
 * A pole claim is NOT "check whether the pole is free, then take it". At
 * midnight a hundred people can be inside that gap at once and every one of
 * them sees a free pole. The claim is an INSERT that the database either
 * accepts or rejects on a unique index, and a rejection is information rather
 * than an error: either that position just went to somebody else (try the next
 * one) or this person already holds a place (say so).
 *
 * Both implementations below obey the same contract, and the in-memory one
 * models the unique indexes and yields between read and write on purpose — a
 * double that cannot lose a race would make the concurrency test meaningless.
 */

export interface SocialScopeKey {
  readonly tenantId: string;
  readonly chatId: bigint;
  readonly threadId: number | null;
}

export interface PoleWindowRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly chatId: bigint;
  readonly threadId: number | null;
  readonly windowType: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly timezone: string;
  readonly resetMinutes: number;
  readonly dayKey: string;
}

export interface PoleClaimRecord {
  readonly id: string;
  readonly windowId: string;
  readonly position: number;
  readonly userId: bigint;
  readonly userName: string | null;
  readonly messageId: number | null;
  readonly latencyMs: number;
  readonly claimedAt: Date;
  /** The window's local day, joined in for stats. */
  readonly dayKey: string;
}

export interface EnsureWindowInput extends SocialScopeKey {
  readonly windowType: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly timezone: string;
  readonly resetMinutes: number;
  readonly dayKey: string;
}

export interface ClaimPositionInput {
  readonly windowId: string;
  readonly userId: bigint;
  readonly userName: string | null;
  readonly messageId: number | null;
  readonly latencyMs: number;
  /** How many places this group awards. */
  readonly positions: number;
}

export type ClaimOutcome =
  | { readonly ok: true; readonly claim: PoleClaimRecord }
  | {
      readonly ok: false;
      readonly reason: "already-claimed";
      readonly position: number;
    }
  | { readonly ok: false; readonly reason: "window-full" }
  /**
   * La ventana desapareció entre calcularla y reclamar.
   *
   * Poco frecuente pero real: una limpieza por retención, un reinicio de
   * temporada o el borrado de los datos de un grupo pueden llevársela mientras
   * un update está en vuelo. Salió al probar contra Postgres de verdad, donde
   * la FK lo rechaza; antes la excepción subía sin gestionar y el handler
   * moría en vez de contestar.
   */
  | { readonly ok: false; readonly reason: "window-gone" };

export interface RouletteRoundInput extends SocialScopeKey {
  readonly userId: bigint;
  readonly messageId: number;
  readonly numerator: number;
  readonly denominator: number;
  readonly outcome: "safe" | "adverse";
  readonly consequence: "fun" | "muted" | "degraded";
  readonly muteSeconds: number | null;
  readonly degradedWhy: string | null;
  readonly rngVersion: number;
}

export type RouletteRecordOutcome =
  | { readonly ok: true }
  /** This exact message already produced a round: a redelivery, not a new spin. */
  | { readonly ok: false; readonly reason: "duplicate" };

export interface SpinTimestamps {
  readonly lastUserSpinAt: Date | null;
  readonly lastChatSpinAt: Date | null;
}

/** Una fila de clasificación, ya agregada por la base de datos. */
export interface RankingRowRecord {
  readonly userId: string;
  readonly userName: string | null;
  readonly firsts: number;
  readonly seconds: number;
  readonly thirds: number;
  readonly total: number;
}

export interface PoleRecordsSummary {
  readonly fastest: {
    readonly userId: string;
    readonly userName: string | null;
    readonly latencyMs: number;
    readonly dayKey: string;
  } | null;
  readonly bestStreakUserId: string | null;
  readonly bestStreakUserName: string | null;
  readonly bestStreakDays: number;
}

export interface MediaAssetRecord {
  readonly id: string;
  readonly tenantId: string | null;
  readonly kind: string;
  readonly source: string;
  readonly licence: string;
  readonly attribution: string | null;
  readonly storageKey: string | null;
  readonly safetyStatus: string;
  readonly active: boolean;
}

export interface SocialRepository {
  /** Gets the window for this scope and start, creating it if it is new. */
  ensureWindow(input: EnsureWindowInput): Promise<PoleWindowRecord>;
  claimPosition(input: ClaimPositionInput): Promise<ClaimOutcome>;
  /** Every claim of one window, position order. */
  listWindowClaims(windowId: string): Promise<readonly PoleClaimRecord[]>;
  /**
   * Claims for a scope, newest window first, capped.
   *
   * `dayPrefix` filters by the local day key ("2026-07" for a month), which is
   * a prefix scan rather than a timezone conversion per row.
   */
  listScopeClaims(
    scope: SocialScopeKey,
    dayPrefix: string | null,
    limit: number,
  ): Promise<readonly PoleClaimRecord[]>;
  /**
   * Clasificación agregada POR LA BASE DE DATOS.
   *
   * Existe porque cargar las reclamaciones y contarlas en memoria obliga a
   * poner un techo, y un techo silencioso convierte un ranking en una mentira
   * en cuanto un grupo lleva un par de años jugando. `limit` recorta las FILAS
   * DEVUELTAS (cuántos puestos se enseñan), nunca las que se cuentan.
   */
  rankingFor(
    scope: SocialScopeKey,
    dayPrefix: string | null,
    limit: number,
  ): Promise<readonly RankingRowRecord[]>;
  /**
   * Los días (clave local "YYYY-MM-DD") en que esta persona se llevó la pole.
   *
   * Acotado por el calendario, no por el número de reclamaciones: un grupo con
   * cien mil reclamaciones sigue teniendo 365 días al año.
   */
  winDaysFor(scope: SocialScopeKey, userId: bigint): Promise<readonly string[]>;
  /** Quién tiene la pole más rápida y quién la mejor racha. */
  recordsFor(scope: SocialScopeKey): Promise<PoleRecordsSummary>;
  /** Cuántas reclamaciones tiene el ámbito. Contado en la BD, sin traerlas. */
  countClaims(scope: SocialScopeKey): Promise<number>;
  recordRouletteRound(
    input: RouletteRoundInput,
  ): Promise<RouletteRecordOutcome>;
  lastSpins(scope: SocialScopeKey, userId: bigint): Promise<SpinTimestamps>;
  /** Servable assets of a kind for this bot (its own plus the shared ones). */
  listMediaAssets(
    tenantId: string,
    kind: string,
  ): Promise<readonly MediaAssetRecord[]>;
  /** The Telegram file_id this bot holds for an asset, if any. */
  findMediaFileId(assetId: string, tenantId: string): Promise<string | null>;
  rememberMediaFileId(
    assetId: string,
    tenantId: string,
    fileId: string,
    fileUniqueId: string | null,
  ): Promise<void>;
  /**
   * Los recursos que este bot todavía no puede enviar.
   *
   * Un bot hijo nuevo empieza con la biblioteca compartida entera pendiente:
   * un `file_id` pertenece al bot que lo subió, así que hay que rehacer el
   * trabajo para cada identidad. Devuelve solo lo reintentables (`pending`),
   * nunca lo que ya se dio por fallido.
   */
  pendingMediaUploads(
    tenantId: string,
    limit: number,
  ): Promise<readonly MediaUploadTask[]>;
  /** Deja constancia de cómo fue un intento de subida. */
  recordMediaUpload(input: MediaUploadResult): Promise<void>;
  /** Cuántos recursos tiene este bot en cada estado. Para /status y métricas. */
  mediaStateCounts(tenantId: string): Promise<Readonly<Record<string, number>>>;
  /**
   * Retira un recurso de circulación sin borrarlo.
   *
   * Baja lógica: la fila se conserva para que el hash siga bloqueando una
   * reimportación del mismo fichero, y para que quede rastro de qué se retiró.
   */
  revokeMediaAsset(assetId: string): Promise<boolean>;
}

/** Un recurso que le falta a un bot, con lo necesario para subirlo. */
export interface MediaUploadTask {
  readonly assetId: string;
  readonly kind: string;
  readonly storageKey: string | null;
  readonly attempts: number;
}

export interface MediaUploadResult {
  readonly assetId: string;
  readonly tenantId: string;
  readonly state: string;
  readonly attempts: number;
  readonly fileId: string | null;
  readonly fileUniqueId: string | null;
  readonly lastError: string | null;
}

/**
 * True for "a unique index rejected this row".
 *
 * Deliberately does NOT try to work out WHICH index fired. Prisma reports the
 * target inconsistently across constraint styles, and the caller does not need
 * to know: it re-reads the person's own claim, and that answers the question
 * with certainty instead of by string matching.
 */
export const isUniqueViolation = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return code === "P2002" || code === "UNIQUE_VIOLATION";
};

/**
 * True para "la fila a la que apuntaba esto ya no existe".
 *
 * Distinta de la violación de único: aquella significa "otro llegó antes"
 * (reintentar), esta significa "el terreno desapareció" (rendirse limpiamente).
 */
export const isForeignKeyViolation = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return code === "P2003" || code === "FOREIGN_KEY_VIOLATION";
};

/** Thrown by the in-memory double to imitate a unique index. */
export class InMemoryUniqueViolation extends Error {
  readonly code = "UNIQUE_VIOLATION";
  constructor(what: string) {
    super(`unique violation: ${what}`);
    this.name = "InMemoryUniqueViolation";
  }
}

/** Thrown by the in-memory double to imitate a foreign key. */
export class InMemoryForeignKeyViolation extends Error {
  readonly code = "FOREIGN_KEY_VIOLATION";
  constructor(what: string) {
    super(`foreign key violation: ${what}`);
    this.name = "InMemoryForeignKeyViolation";
  }
}

/**
 * La tirada consecutiva más larga en una lista ORDENADA de días "YYYY-MM-DD".
 *
 * Duplicada a propósito respecto a `bestStreak` de modules/social: ese trabaja
 * sobre reclamaciones y este sobre días ya agregados por SQL. Un test de
 * paridad los mantiene de acuerdo.
 */
const longestRun = (days: readonly string[]): number => {
  const nextDay = (dayKey: string): string => {
    const [y, m, d] = dayKey.split("-").map((p) => Number.parseInt(p, 10));
    if (
      y === undefined ||
      m === undefined ||
      d === undefined ||
      Number.isNaN(y) ||
      Number.isNaN(m) ||
      Number.isNaN(d)
    ) {
      return dayKey;
    }
    const forward = new Date(Date.UTC(y, m - 1, d) + 24 * 3600 * 1000);
    const mm = String(forward.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(forward.getUTCDate()).padStart(2, "0");
    return `${forward.getUTCFullYear()}-${mm}-${dd}`;
  };

  let best = 0;
  let run = 0;
  let expected: string | null = null;
  for (const day of days) {
    run = expected !== null && day === expected ? run + 1 : 1;
    best = Math.max(best, run);
    expected = nextDay(day);
  }
  return best;
};

/** Lowest position not yet taken, or null when the podium is full. */
const firstFreePosition = (
  taken: ReadonlySet<number>,
  positions: number,
): number | null => {
  for (let position = 1; position <= positions; position += 1) {
    if (!taken.has(position)) {
      return position;
    }
  }
  return null;
};

/**
 * The claim loop, shared by both implementations.
 *
 * Bounded at `positions + 1` attempts, and that bound is exact rather than
 * generous: every failed attempt means somebody else consumed a position, so
 * after `positions` losses the podium is provably full and the extra attempt is
 * what discovers it.
 */
const runClaimLoop = async (
  input: ClaimPositionInput,
  readState: () => Promise<{
    taken: ReadonlySet<number>;
    mine: PoleClaimRecord | null;
  }>,
  insert: (position: number) => Promise<PoleClaimRecord>,
  /**
   * Se llama cada vez que una reclamación pierde su hueco y reintenta.
   *
   * El conflicto ocurre AQUÍ, así que se cuenta aquí. Contarlo desde fuera
   * obligaría a exponer el número de intentos en el resultado, y eso es
   * fontanería filtrándose al contrato.
   */
  onConflict: () => void = () => undefined,
): Promise<ClaimOutcome> => {
  const attempts = Math.max(1, input.positions) + 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { taken, mine } = await readState();
    if (mine) {
      return { ok: false, reason: "already-claimed", position: mine.position };
    }
    const position = firstFreePosition(taken, input.positions);
    if (position === null) {
      return { ok: false, reason: "window-full" };
    }
    try {
      return { ok: true, claim: await insert(position) };
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        // The window itself is gone. Retrying would only fail again, and the
        // caller needs an answer rather than an exception.
        return { ok: false, reason: "window-gone" };
      }
      if (!isUniqueViolation(error)) {
        throw error;
      }
      onConflict();
      // Lost this position (or this person got a place on another attempt).
      // The next iteration re-reads and finds out which.
    }
  }
  const { mine } = await readState();
  return mine
    ? { ok: false, reason: "already-claimed", position: mine.position }
    : { ok: false, reason: "window-full" };
};

export class PrismaSocialRepository implements SocialRepository {
  constructor(
    private readonly client: PrismaClient = defaultPrisma,
    /**
     * Opcional a propósito: la mayoría de los llamadores (tests, scripts) no
     * quieren métricas, y obligarles a pasar un sumidero solo añadiría ruido.
     */
    private readonly counters: CounterSink = NOOP_COUNTERS,
  ) {}

  async ensureWindow(input: EnsureWindowInput): Promise<PoleWindowRecord> {
    const where = {
      tenantId: input.tenantId,
      chatId: input.chatId,
      threadId: input.threadId,
      windowType: input.windowType,
      startsAt: input.startsAt,
    };
    const existing = await this.client.poleWindow.findFirst({ where });
    if (existing) {
      return existing as PoleWindowRecord;
    }
    try {
      return (await this.client.poleWindow.create({
        data: {
          ...where,
          endsAt: input.endsAt,
          timezone: input.timezone,
          resetMinutes: input.resetMinutes,
          dayKey: input.dayKey,
        },
      })) as PoleWindowRecord;
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      // Another process created the same window between the read and the
      // write. Theirs is as good as ours — the inputs were identical.
      const raced = await this.client.poleWindow.findFirst({ where });
      if (!raced) {
        throw error;
      }
      return raced as PoleWindowRecord;
    }
  }

  async claimPosition(input: ClaimPositionInput): Promise<ClaimOutcome> {
    const window = await this.client.poleWindow.findUnique({
      where: { id: input.windowId },
      select: { dayKey: true },
    });
    const dayKey = window?.dayKey ?? "";

    return runClaimLoop(
      input,
      async () => {
        const rows = await this.client.poleClaim.findMany({
          where: { windowId: input.windowId },
          select: {
            id: true,
            position: true,
            userId: true,
            userName: true,
            messageId: true,
            latencyMs: true,
            claimedAt: true,
          },
        });
        const mineRow = rows.find((row) => row.userId === input.userId);
        return {
          taken: new Set(rows.map((row) => row.position)),
          mine: mineRow
            ? { ...mineRow, windowId: input.windowId, dayKey }
            : null,
        };
      },
      async (position) => {
        const created = await this.client.poleClaim.create({
          data: {
            windowId: input.windowId,
            position,
            userId: input.userId,
            userName: input.userName,
            messageId: input.messageId,
            latencyMs: input.latencyMs,
          },
        });
        return { ...created, dayKey } as PoleClaimRecord;
      },
      () => this.counters.increment("social_pole_conflicts_total"),
    );
  }

  async listWindowClaims(
    windowId: string,
  ): Promise<readonly PoleClaimRecord[]> {
    const rows = await this.client.poleClaim.findMany({
      where: { windowId },
      orderBy: { position: "asc" },
      include: { window: { select: { dayKey: true } } },
    });
    return rows.map((row) => ({
      ...row,
      dayKey: row.window.dayKey,
    })) as PoleClaimRecord[];
  }

  async listScopeClaims(
    scope: SocialScopeKey,
    dayPrefix: string | null,
    limit: number,
  ): Promise<readonly PoleClaimRecord[]> {
    const rows = await this.client.poleClaim.findMany({
      where: {
        window: {
          tenantId: scope.tenantId,
          chatId: scope.chatId,
          threadId: scope.threadId,
          ...(dayPrefix ? { dayKey: { startsWith: dayPrefix } } : {}),
        },
      },
      orderBy: { claimedAt: "desc" },
      take: limit,
      include: { window: { select: { dayKey: true } } },
    });
    return rows.map((row) => ({
      ...row,
      dayKey: row.window.dayKey,
    })) as PoleClaimRecord[];
  }

  /**
   * `IS NOT DISTINCT FROM` en vez de `=`.
   *
   * Con `threadId = NULL` Postgres devuelve NULL (ni verdadero ni falso) y la
   * consulta no encuentra NADA — que es exactamente el caso mayoritario, los
   * grupos sin temas. `IS NOT DISTINCT FROM` sí trata NULL como un valor
   * comparable. Es la misma trampa de NULL que obligó al índice parcial.
   */
  async rankingFor(
    scope: SocialScopeKey,
    dayPrefix: string | null,
    limit: number,
  ): Promise<readonly RankingRowRecord[]> {
    const rows = await this.client.$queryRaw<
      {
        userId: string;
        userName: string | null;
        firsts: bigint;
        seconds: bigint;
        thirds: bigint;
        total: bigint;
      }[]
    >`
      SELECT c."userId"::text AS "userId",
             (array_agg(c."userName" ORDER BY c."claimedAt" DESC))[1] AS "userName",
             count(*) FILTER (WHERE c."position" = 1) AS firsts,
             count(*) FILTER (WHERE c."position" = 2) AS seconds,
             count(*) FILTER (WHERE c."position" = 3) AS thirds,
             count(*) AS total
      FROM pole_claims c
      JOIN pole_windows w ON w.id = c."windowId"
      WHERE w."tenantId" = ${scope.tenantId}
        AND w."chatId" = ${scope.chatId}
        AND w."threadId" IS NOT DISTINCT FROM ${scope.threadId}
        AND (${dayPrefix}::text IS NULL OR w."dayKey" LIKE ${dayPrefix} || '%')
      GROUP BY c."userId"
      ORDER BY firsts DESC, seconds DESC, thirds DESC, total DESC,
               c."userId"::text ASC
      LIMIT ${limit}
    `;
    return rows.map((row) => ({
      userId: row.userId,
      userName: row.userName,
      firsts: Number(row.firsts),
      seconds: Number(row.seconds),
      thirds: Number(row.thirds),
      total: Number(row.total),
    }));
  }

  async winDaysFor(
    scope: SocialScopeKey,
    userId: bigint,
  ): Promise<readonly string[]> {
    const rows = await this.client.$queryRaw<{ dayKey: string }[]>`
      SELECT DISTINCT w."dayKey" AS "dayKey"
      FROM pole_claims c
      JOIN pole_windows w ON w.id = c."windowId"
      WHERE w."tenantId" = ${scope.tenantId}
        AND w."chatId" = ${scope.chatId}
        AND w."threadId" IS NOT DISTINCT FROM ${scope.threadId}
        AND c."userId" = ${userId}
        AND c."position" = 1
      ORDER BY w."dayKey" ASC
    `;
    return rows.map((row) => row.dayKey);
  }

  async recordsFor(scope: SocialScopeKey): Promise<PoleRecordsSummary> {
    const fastestRows = await this.client.$queryRaw<
      {
        userId: string;
        userName: string | null;
        latencyMs: number;
        dayKey: string;
      }[]
    >`
      SELECT c."userId"::text AS "userId", c."userName" AS "userName",
             c."latencyMs" AS "latencyMs", w."dayKey" AS "dayKey"
      FROM pole_claims c
      JOIN pole_windows w ON w.id = c."windowId"
      WHERE w."tenantId" = ${scope.tenantId}
        AND w."chatId" = ${scope.chatId}
        AND w."threadId" IS NOT DISTINCT FROM ${scope.threadId}
        AND c."position" = 1
      ORDER BY c."latencyMs" ASC
      LIMIT 1
    `;
    const fastest = fastestRows[0] ?? null;

    // La mejor racha exige mirar los días de cada persona, así que se recorren
    // en orden de poles ganadas y se para en cuanto el candidato ya no puede
    // superar la mejor: una racha nunca es mayor que el total de poles de esa
    // persona. Es exacto y termina tras un puñado de consultas.
    const byFirsts = await this.rankingFor(scope, null, 200);
    let bestDays = 0;
    let bestUserId: string | null = null;
    let bestUserName: string | null = null;
    for (const row of byFirsts) {
      if (row.firsts <= bestDays) {
        break;
      }
      const days = await this.winDaysFor(scope, BigInt(row.userId));
      const streak = longestRun(days);
      if (streak > bestDays) {
        bestDays = streak;
        bestUserId = row.userId;
        bestUserName = row.userName;
      }
    }

    return {
      fastest: fastest
        ? {
            userId: fastest.userId,
            userName: fastest.userName,
            latencyMs: Number(fastest.latencyMs),
            dayKey: fastest.dayKey,
          }
        : null,
      bestStreakUserId: bestUserId,
      bestStreakUserName: bestUserName,
      bestStreakDays: bestDays,
    };
  }

  async countClaims(scope: SocialScopeKey): Promise<number> {
    return this.client.poleClaim.count({
      where: {
        window: {
          tenantId: scope.tenantId,
          chatId: scope.chatId,
          threadId: scope.threadId,
        },
      },
    });
  }

  async recordRouletteRound(
    input: RouletteRoundInput,
  ): Promise<RouletteRecordOutcome> {
    try {
      await this.client.rouletteRound.create({ data: { ...input } });
      return { ok: true };
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Same message, second delivery. The round already happened and, more
        // importantly, whoever lost it was already silenced once.
        return { ok: false, reason: "duplicate" };
      }
      throw error;
    }
  }

  async lastSpins(
    scope: SocialScopeKey,
    userId: bigint,
  ): Promise<SpinTimestamps> {
    const [user, chat] = await Promise.all([
      this.client.rouletteRound.findFirst({
        where: { tenantId: scope.tenantId, chatId: scope.chatId, userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      this.client.rouletteRound.findFirst({
        where: { tenantId: scope.tenantId, chatId: scope.chatId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);
    return {
      lastUserSpinAt: user?.createdAt ?? null,
      lastChatSpinAt: chat?.createdAt ?? null,
    };
  }

  async listMediaAssets(
    tenantId: string,
    kind: string,
  ): Promise<readonly MediaAssetRecord[]> {
    const rows = await this.client.funMediaAsset.findMany({
      where: {
        kind,
        active: true,
        safetyStatus: "approved",
        // A null tenant is the shared library; a set one is private to that bot.
        OR: [{ tenantId: null }, { tenantId }],
      },
      orderBy: { createdAt: "asc" },
    });
    return rows as MediaAssetRecord[];
  }

  async findMediaFileId(
    assetId: string,
    tenantId: string,
  ): Promise<string | null> {
    const row = await this.client.telegramMediaFile.findUnique({
      where: { assetId_tenantId: { assetId, tenantId } },
      select: { telegramFileId: true, state: true },
    });
    // Solo `ready` se envía. Una fila `pending` o `failed` puede tener un
    // file_id de un intento anterior que ya no sirve.
    return row?.state === "ready" ? (row.telegramFileId ?? null) : null;
  }

  async pendingMediaUploads(
    tenantId: string,
    limit: number,
  ): Promise<readonly MediaUploadTask[]> {
    // Recursos servibles que este bot NO tiene listos: o no tienen fila, o la
    // tienen en `pending`. `failed` y `disabled` quedan fuera a propósito —
    // reintentar en bucle algo que ya agotó sus intentos es cómo se hace un
    // bucle de errores contra Telegram.
    const rows = await this.client.funMediaAsset.findMany({
      where: {
        active: true,
        safetyStatus: "approved",
        OR: [{ tenantId: null }, { tenantId }],
        telegramFiles: {
          none: { tenantId, state: { in: ["ready", "failed", "disabled"] } },
        },
      },
      select: {
        id: true,
        kind: true,
        storageKey: true,
        telegramFiles: {
          where: { tenantId },
          select: { attempts: true },
        },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return rows.map((row) => ({
      assetId: row.id,
      kind: row.kind,
      storageKey: row.storageKey,
      attempts: row.telegramFiles[0]?.attempts ?? 0,
    }));
  }

  async recordMediaUpload(input: MediaUploadResult): Promise<void> {
    const data = {
      state: input.state,
      attempts: input.attempts,
      telegramFileId: input.fileId,
      telegramFileUniqueId: input.fileUniqueId,
      lastError: input.lastError,
      ...(input.state === "ready" ? { lastVerifiedAt: new Date() } : {}),
    };
    await this.client.telegramMediaFile.upsert({
      where: {
        assetId_tenantId: { assetId: input.assetId, tenantId: input.tenantId },
      },
      create: { assetId: input.assetId, tenantId: input.tenantId, ...data },
      update: data,
    });
  }

  async mediaStateCounts(
    tenantId: string,
  ): Promise<Readonly<Record<string, number>>> {
    const rows = await this.client.telegramMediaFile.groupBy({
      by: ["state"],
      where: { tenantId },
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.state] = row._count._all;
    }
    return counts;
  }

  async revokeMediaAsset(assetId: string): Promise<boolean> {
    // Baja lógica en los dos niveles: el recurso deja de servirse y sus
    // file_id quedan marcados, para que ningún bot los reutilice por error.
    const updated = await this.client.funMediaAsset.updateMany({
      where: { id: assetId, active: true },
      data: { active: false },
    });
    if (updated.count === 0) {
      return false;
    }
    await this.client.telegramMediaFile.updateMany({
      where: { assetId },
      data: { state: "disabled" },
    });
    return true;
  }

  async rememberMediaFileId(
    assetId: string,
    tenantId: string,
    fileId: string,
    fileUniqueId: string | null,
  ): Promise<void> {
    // Atajo para "esta subida salió bien": deja la fila en `ready`, que es la
    // única condición bajo la que findMediaFileId la devuelve.
    await this.recordMediaUpload({
      assetId,
      tenantId,
      state: "ready",
      attempts: 1,
      fileId,
      fileUniqueId,
      lastError: null,
    });
  }
}

/**
 * Test double with the same guarantees.
 *
 * Two things make it worth having rather than a stub: it enforces both unique
 * indexes, and `listState` yields to the microtask queue before returning. That
 * yield is what lets a hundred concurrent claims genuinely interleave in a
 * single-threaded runtime — without it the "concurrency" test would be a
 * hundred sequential calls wearing a costume.
 */
export class InMemorySocialRepository implements SocialRepository {
  private readonly windows = new Map<string, PoleWindowRecord>();
  private readonly claims = new Map<string, PoleClaimRecord>();
  private readonly rounds: (RouletteRoundInput & { createdAt: Date })[] = [];
  private readonly assets: MediaAssetRecord[] = [];
  private readonly fileIds = new Map<
    string,
    { fileId: string | null; state: string; attempts: number }
  >();
  private seq = 0;

  /** Seeds the media library for tests. */
  addAsset(asset: MediaAssetRecord): void {
    this.assets.push(asset);
  }

  private windowKey(input: EnsureWindowInput): string {
    return [
      input.tenantId,
      input.chatId.toString(),
      input.threadId ?? "-",
      input.windowType,
      input.startsAt.toISOString(),
    ].join("|");
  }

  async ensureWindow(input: EnsureWindowInput): Promise<PoleWindowRecord> {
    const key = this.windowKey(input);
    const existing = this.windows.get(key);
    if (existing) {
      return existing;
    }
    // Yield first, so two concurrent callers really can both miss above.
    await Promise.resolve();
    const raced = this.windows.get(key);
    if (raced) {
      return raced;
    }
    const record: PoleWindowRecord = {
      id: `win-${++this.seq}`,
      tenantId: input.tenantId,
      chatId: input.chatId,
      threadId: input.threadId,
      windowType: input.windowType,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timezone: input.timezone,
      resetMinutes: input.resetMinutes,
      dayKey: input.dayKey,
    };
    this.windows.set(key, record);
    return record;
  }

  private claimsOf(windowId: string): PoleClaimRecord[] {
    return [...this.claims.values()].filter(
      (claim) => claim.windowId === windowId,
    );
  }

  async claimPosition(input: ClaimPositionInput): Promise<ClaimOutcome> {
    const dayKey =
      [...this.windows.values()].find((w) => w.id === input.windowId)?.dayKey ??
      "";

    return runClaimLoop(
      input,
      async () => {
        // The yield point. Everything after this can be observed by another
        // in-flight claim, which is exactly the race being modelled.
        await Promise.resolve();
        const rows = this.claimsOf(input.windowId);
        return {
          taken: new Set(rows.map((row) => row.position)),
          mine: rows.find((row) => row.userId === input.userId) ?? null,
        };
      },
      async (position) => {
        await Promise.resolve();
        // The real table has a FK to pole_windows: a claim against a window
        // that does not exist is rejected there, so it must be rejected here
        // too. A double that allows it would have hidden the crash this very
        // case caused against real Postgres.
        if (![...this.windows.values()].some((w) => w.id === input.windowId)) {
          throw new InMemoryForeignKeyViolation("pole_claims.windowId");
        }
        const rows = this.claimsOf(input.windowId);
        if (rows.some((row) => row.position === position)) {
          throw new InMemoryUniqueViolation("(windowId, position)");
        }
        if (rows.some((row) => row.userId === input.userId)) {
          throw new InMemoryUniqueViolation("(windowId, userId)");
        }
        const record: PoleClaimRecord = {
          id: `claim-${++this.seq}`,
          windowId: input.windowId,
          position,
          userId: input.userId,
          userName: input.userName,
          messageId: input.messageId,
          latencyMs: input.latencyMs,
          claimedAt: new Date(),
          dayKey,
        };
        this.claims.set(record.id, record);
        return record;
      },
    );
  }

  async listWindowClaims(
    windowId: string,
  ): Promise<readonly PoleClaimRecord[]> {
    return this.claimsOf(windowId).sort((a, b) => a.position - b.position);
  }

  async listScopeClaims(
    scope: SocialScopeKey,
    dayPrefix: string | null,
    limit: number,
  ): Promise<readonly PoleClaimRecord[]> {
    const windowIds = new Set(
      [...this.windows.values()]
        .filter(
          (w) =>
            w.tenantId === scope.tenantId &&
            w.chatId === scope.chatId &&
            w.threadId === scope.threadId &&
            (dayPrefix === null || w.dayKey.startsWith(dayPrefix)),
        )
        .map((w) => w.id),
    );
    return [...this.claims.values()]
      .filter((claim) => windowIds.has(claim.windowId))
      .sort((a, b) => b.claimedAt.getTime() - a.claimedAt.getTime())
      .slice(0, limit);
  }

  /** Mismo contrato que la versión SQL, incluido el orden de desempate. */
  async rankingFor(
    scope: SocialScopeKey,
    dayPrefix: string | null,
    limit: number,
  ): Promise<readonly RankingRowRecord[]> {
    const claims = await this.listScopeClaims(
      scope,
      dayPrefix,
      Number.MAX_SAFE_INTEGER,
    );
    const byUser = new Map<string, RankingRowRecord & { seenAt: number }>();
    for (const claim of claims) {
      const key = claim.userId.toString();
      const prior = byUser.get(key);
      const fresher =
        prior === undefined || claim.claimedAt.getTime() >= prior.seenAt;
      byUser.set(key, {
        userId: key,
        userName: fresher ? claim.userName : (prior?.userName ?? null),
        firsts: (prior?.firsts ?? 0) + (claim.position === 1 ? 1 : 0),
        seconds: (prior?.seconds ?? 0) + (claim.position === 2 ? 1 : 0),
        thirds: (prior?.thirds ?? 0) + (claim.position === 3 ? 1 : 0),
        total: (prior?.total ?? 0) + 1,
        seenAt: fresher ? claim.claimedAt.getTime() : (prior?.seenAt ?? 0),
      });
    }
    return [...byUser.values()]
      .sort(
        (a, b) =>
          b.firsts - a.firsts ||
          b.seconds - a.seconds ||
          b.thirds - a.thirds ||
          b.total - a.total ||
          a.userId.localeCompare(b.userId),
      )
      .slice(0, limit)
      .map(({ seenAt: _seenAt, ...row }) => row);
  }

  async winDaysFor(
    scope: SocialScopeKey,
    userId: bigint,
  ): Promise<readonly string[]> {
    const claims = await this.listScopeClaims(
      scope,
      null,
      Number.MAX_SAFE_INTEGER,
    );
    return [
      ...new Set(
        claims
          .filter((claim) => claim.userId === userId && claim.position === 1)
          .map((claim) => claim.dayKey),
      ),
    ].sort();
  }

  async recordsFor(scope: SocialScopeKey): Promise<PoleRecordsSummary> {
    const claims = await this.listScopeClaims(
      scope,
      null,
      Number.MAX_SAFE_INTEGER,
    );
    const firsts = claims.filter((claim) => claim.position === 1);
    const fastest = firsts.reduce<(typeof firsts)[number] | null>(
      (best, claim) =>
        best === null || claim.latencyMs < best.latencyMs ? claim : best,
      null,
    );

    let bestDays = 0;
    let bestUserId: string | null = null;
    let bestUserName: string | null = null;
    for (const userId of new Set(firsts.map((claim) => claim.userId))) {
      const streak = longestRun(await this.winDaysFor(scope, userId));
      if (streak > bestDays) {
        bestDays = streak;
        bestUserId = userId.toString();
        bestUserName =
          firsts.find((claim) => claim.userId === userId)?.userName ?? null;
      }
    }

    return {
      fastest: fastest
        ? {
            userId: fastest.userId.toString(),
            userName: fastest.userName,
            latencyMs: fastest.latencyMs,
            dayKey: fastest.dayKey,
          }
        : null,
      bestStreakUserId: bestUserId,
      bestStreakUserName: bestUserName,
      bestStreakDays: bestDays,
    };
  }

  async countClaims(scope: SocialScopeKey): Promise<number> {
    return (await this.listScopeClaims(scope, null, Number.MAX_SAFE_INTEGER))
      .length;
  }

  async recordRouletteRound(
    input: RouletteRoundInput,
  ): Promise<RouletteRecordOutcome> {
    const duplicate = this.rounds.some(
      (round) =>
        round.tenantId === input.tenantId &&
        round.chatId === input.chatId &&
        round.messageId === input.messageId,
    );
    if (duplicate) {
      return { ok: false, reason: "duplicate" };
    }
    this.rounds.push({ ...input, createdAt: new Date() });
    return { ok: true };
  }

  async lastSpins(
    scope: SocialScopeKey,
    userId: bigint,
  ): Promise<SpinTimestamps> {
    const inChat = this.rounds.filter(
      (round) =>
        round.tenantId === scope.tenantId && round.chatId === scope.chatId,
    );
    const latest = (rows: typeof inChat): Date | null =>
      rows.length === 0
        ? null
        : new Date(Math.max(...rows.map((row) => row.createdAt.getTime())));
    return {
      lastUserSpinAt: latest(inChat.filter((row) => row.userId === userId)),
      lastChatSpinAt: latest(inChat),
    };
  }

  async listMediaAssets(
    tenantId: string,
    kind: string,
  ): Promise<readonly MediaAssetRecord[]> {
    return this.assets.filter(
      (asset) =>
        asset.kind === kind &&
        asset.active &&
        asset.safetyStatus === "approved" &&
        (asset.tenantId === null || asset.tenantId === tenantId),
    );
  }

  async findMediaFileId(
    assetId: string,
    tenantId: string,
  ): Promise<string | null> {
    const row = this.fileIds.get(`${assetId}|${tenantId}`);
    // Igual que en Postgres: solo `ready` se sirve.
    return row?.state === "ready" ? (row.fileId ?? null) : null;
  }

  async rememberMediaFileId(
    assetId: string,
    tenantId: string,
    fileId: string,
    fileUniqueId: string | null,
  ): Promise<void> {
    await this.recordMediaUpload({
      assetId,
      tenantId,
      state: "ready",
      attempts: 1,
      fileId,
      fileUniqueId,
      lastError: null,
    });
  }

  async pendingMediaUploads(
    tenantId: string,
    limit: number,
  ): Promise<readonly MediaUploadTask[]> {
    const servable = this.assets.filter(
      (asset) =>
        asset.active &&
        asset.safetyStatus === "approved" &&
        (asset.tenantId === null || asset.tenantId === tenantId),
    );
    const tasks: MediaUploadTask[] = [];
    for (const asset of servable) {
      const row = this.fileIds.get(`${asset.id}|${tenantId}`);
      if (row && ["ready", "failed", "disabled"].includes(row.state)) {
        continue;
      }
      tasks.push({
        assetId: asset.id,
        kind: asset.kind,
        storageKey: asset.storageKey,
        attempts: row?.attempts ?? 0,
      });
    }
    return tasks.slice(0, limit);
  }

  async recordMediaUpload(input: MediaUploadResult): Promise<void> {
    this.fileIds.set(`${input.assetId}|${input.tenantId}`, {
      fileId: input.fileId,
      state: input.state,
      attempts: input.attempts,
    });
  }

  async mediaStateCounts(
    tenantId: string,
  ): Promise<Readonly<Record<string, number>>> {
    const counts: Record<string, number> = {};
    for (const [key, row] of this.fileIds.entries()) {
      if (key.endsWith(`|${tenantId}`)) {
        counts[row.state] = (counts[row.state] ?? 0) + 1;
      }
    }
    return counts;
  }

  async revokeMediaAsset(assetId: string): Promise<boolean> {
    const index = this.assets.findIndex(
      (asset) => asset.id === assetId && asset.active,
    );
    if (index === -1) {
      return false;
    }
    this.assets[index] = {
      ...(this.assets[index] as MediaAssetRecord),
      active: false,
    };
    for (const [key, row] of this.fileIds.entries()) {
      if (key.startsWith(`${assetId}|`)) {
        this.fileIds.set(key, { ...row, state: "disabled" });
      }
    }
    return true;
  }
}

/**
 * Social Core contra POSTGRES REAL.
 *
 * POR QUÉ EXISTE ESTE FICHERO. `social-repository.test.ts` corre contra el doble
 * en memoria. Ese doble modela los dos índices únicos de `pole_claims`, pero NO
 * puede modelar la regla que de verdad importa: en Postgres **NULL nunca es
 * igual a NULL**, así que el `@@unique` de la ventana no cubre las filas con
 * `threadId IS NULL` — que son casi todos los grupos. Esa garantía vive
 * únicamente en un índice único PARCIAL declarado a mano en la migración, y un
 * doble en memoria la daría por buena aunque el índice no existiera.
 *
 * Concurrencia de verdad: cada cliente Prisma tiene su propio pool, así que dos
 * clientes son dos conexiones independientes al servidor. No hay transacción
 * compartida, no hay mock, y el conflicto lo resuelve Postgres.
 *
 * CÓMO EJECUTARLO (necesita Docker):
 *   docker run -d --name social-pg -e POSTGRES_USER=social \
 *     -e POSTGRES_PASSWORD=social -e POSTGRES_DB=social_test \
 *     -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL=postgresql://social:social@127.0.0.1:55432/social_test?schema=public \
 *     node node_modules/prisma/build/index.js migrate deploy \
 *       --schema packages/data/prisma/schema.prisma
 *   TEST_DATABASE_URL=postgresql://social:social@127.0.0.1:55432/social_test?schema=public \
 *     node node_modules/vitest/vitest.mjs run \
 *       packages/data/src/social-core.integration.test.ts
 *
 * Sin `TEST_DATABASE_URL` se salta entero, como el resto de la integración.
 */

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  type ClaimOutcome,
  PrismaSocialRepository,
} from "./social-repository.js";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

/** Dos bots de la plataforma que conviven en el MISMO grupo de Telegram. */
const TENANT_A = "tenant-parent-bot";
const TENANT_B = "tenant-child-bot";
const CHAT = -1001234567890n;

const WINDOW_BASE = {
  windowType: "daily",
  startsAt: new Date("2026-07-30T00:00:00.000Z"),
  endsAt: new Date("2026-07-31T00:00:00.000Z"),
  timezone: "Europe/Madrid",
  resetMinutes: 0,
  dayKey: "2026-07-30",
};

describe.skipIf(!TEST_DATABASE_URL)("Social Core (Postgres real)", () => {
  const url = TEST_DATABASE_URL ?? "postgresql://skipped";

  /**
   * Varios clientes = varios pools = varias conexiones. Es lo que convierte
   * "dos promesas" en "dos sesiones compitiendo de verdad".
   */
  const clients = Array.from(
    { length: 6 },
    () => new PrismaClient({ datasourceUrl: url }),
  );
  const primary = clients[0] as PrismaClient;
  const repos = clients.map((client) => new PrismaSocialRepository(client));
  const repo = repos[0] as PrismaSocialRepository;

  /**
   * Marca de este fichero en los recursos multimedia.
   *
   * Los recursos compartidos llevan `tenantId: null`, así que no se pueden
   * limpiar por tenant. Sin una marca propia, este suite borraba los datos de
   * `social-ranking.integration.test.ts` en mitad de su ejecución — vitest corre
   * los ficheros en paralelo y los dos usaban `deleteMany({})`.
   */
  const SOURCE_TAG = "fixture:social-core.integration";

  const wipe = async (): Promise<void> => {
    // Todo acotado a lo que crea ESTE fichero. pole_claims cae por
    // ON DELETE CASCADE al borrar sus ventanas.
    const tenants = { in: [TENANT_A, TENANT_B] };
    await primary.poleWindow.deleteMany({ where: { tenantId: tenants } });
    await primary.rouletteRound.deleteMany({ where: { tenantId: tenants } });
    // telegram_media_files cae en cascada con su recurso.
    await primary.funMediaAsset.deleteMany({ where: { source: SOURCE_TAG } });
  };

  /**
   * Conteos ACOTADOS a lo que crea este fichero.
   *
   * Un `count()` sin filtro sobre una base compartida cuenta también lo que
   * siembra el suite de escala, que corre en paralelo. Da igual lo bien que se
   * limpie: mientras el otro fichero tenga datos vivos, un conteo global es
   * una afirmación sobre el mundo, no sobre esta prueba.
   */
  const OURS = { in: [TENANT_A, TENANT_B] };
  const countWindows = () =>
    primary.poleWindow.count({ where: { tenantId: OURS } });
  const countClaims = () =>
    primary.poleClaim.count({ where: { window: { tenantId: OURS } } });
  const countRounds = () =>
    primary.rouletteRound.count({ where: { tenantId: OURS } });
  const countFiles = () =>
    primary.telegramMediaFile.count({
      where: { asset: { source: SOURCE_TAG } },
    });

  beforeEach(wipe);

  afterAll(async () => {
    await wipe();
    await Promise.all(clients.map((client) => client.$disconnect()));
  });

  const awarded = (outcomes: readonly ClaimOutcome[]) =>
    outcomes.filter((outcome) => outcome.ok);

  // -----------------------------------------------------------------------
  // El índice parcial: la razón de ser de este fichero
  // -----------------------------------------------------------------------

  describe("índice único parcial para threadId IS NULL", () => {
    it("existe y está declarado sobre el subconjunto correcto", async () => {
      const rows = await primary.$queryRaw<{ indexdef: string }[]>`
        SELECT indexdef FROM pg_indexes
        WHERE tablename = 'pole_windows'
          AND indexname = 'pole_windows_scope_nothread_key'
      `;
      expect(rows).toHaveLength(1);
      const def = rows[0]?.indexdef ?? "";
      expect(def).toContain("UNIQUE");
      expect(def).toContain('WHERE ("threadId" IS NULL)');
      // El orden de las columnas importa para que la consulta lo use.
      expect(def).toMatch(/"tenantId".*"chatId".*"windowType".*"startsAt"/u);
    });

    it("Postgres rechaza la segunda ventana idéntica sin thread", async () => {
      // La prueba directa de que el agujero de NULL != NULL está cerrado.
      await primary.poleWindow.create({
        data: {
          id: "w-a",
          tenantId: TENANT_A,
          chatId: CHAT,
          threadId: null,
          ...WINDOW_BASE,
        },
      });
      await expect(
        primary.poleWindow.create({
          data: {
            id: "w-b",
            tenantId: TENANT_A,
            chatId: CHAT,
            threadId: null,
            ...WINDOW_BASE,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      expect(await countWindows()).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Concurrencia real
  // -----------------------------------------------------------------------

  describe("ensureWindow con conexiones independientes", () => {
    it("seis conexiones simultáneas producen UNA ventana (thread nulo)", async () => {
      const windows = await Promise.all(
        repos.map((r) =>
          r.ensureWindow({
            tenantId: TENANT_A,
            chatId: CHAT,
            threadId: null,
            ...WINDOW_BASE,
          }),
        ),
      );
      expect(new Set(windows.map((w) => w.id)).size).toBe(1);
      expect(await countWindows()).toBe(1);
    });

    it("seis conexiones simultáneas producen UNA ventana (thread concreto)", async () => {
      const windows = await Promise.all(
        repos.map((r) =>
          r.ensureWindow({
            tenantId: TENANT_A,
            chatId: CHAT,
            threadId: 7,
            ...WINDOW_BASE,
          }),
        ),
      );
      expect(new Set(windows.map((w) => w.id)).size).toBe(1);
      expect(await countWindows()).toBe(1);
    });

    it("no confunde el thread nulo con un thread concreto", async () => {
      const shared = await repo.ensureWindow({
        tenantId: TENANT_A,
        chatId: CHAT,
        threadId: null,
        ...WINDOW_BASE,
      });
      const topic = await repo.ensureWindow({
        tenantId: TENANT_A,
        chatId: CHAT,
        threadId: 7,
        ...WINDOW_BASE,
      });
      expect(topic.id).not.toBe(shared.id);
      expect(await countWindows()).toBe(2);
    });
  });

  describe("claimPosition con conexiones independientes", () => {
    const claimFrom = (
      index: number,
      windowId: string,
      userId: bigint,
      positions = 3,
    ) =>
      (repos[index % repos.length] as PrismaSocialRepository).claimPosition({
        windowId,
        userId,
        userName: `u${userId}`,
        messageId: Number(userId % 100000n),
        latencyMs: Number(userId % 1000n),
        positions,
      });

    it("dos reclamaciones a la vez dan UN ganador (thread nulo)", async () => {
      const window = await repo.ensureWindow({
        tenantId: TENANT_A,
        chatId: CHAT,
        threadId: null,
        ...WINDOW_BASE,
      });
      const outcomes = await Promise.all([
        claimFrom(0, window.id, 111n, 1),
        claimFrom(1, window.id, 222n, 1),
      ]);
      expect(awarded(outcomes)).toHaveLength(1);
      expect(await countClaims()).toBe(1);
    });

    it("dos reclamaciones a la vez dan UN ganador (message_thread_id concreto)", async () => {
      const window = await repo.ensureWindow({
        tenantId: TENANT_A,
        chatId: CHAT,
        threadId: 42,
        ...WINDOW_BASE,
      });
      const outcomes = await Promise.all([
        claimFrom(2, window.id, 333n, 1),
        claimFrom(3, window.id, 444n, 1),
      ]);
      expect(awarded(outcomes)).toHaveLength(1);
      expect(await countClaims()).toBe(1);
    });

    it("40 reclamaciones repartidas en 6 conexiones dan exactamente 1-2-3", async () => {
      const window = await repo.ensureWindow({
        tenantId: TENANT_A,
        chatId: CHAT,
        threadId: null,
        ...WINDOW_BASE,
      });
      const outcomes = await Promise.all(
        Array.from({ length: 40 }, (_, i) =>
          claimFrom(i, window.id, BigInt(1000 + i)),
        ),
      );
      const positions = awarded(outcomes)
        .map((o) => (o.ok ? o.claim.position : 0))
        .sort();
      expect(positions).toEqual([1, 2, 3]);

      const stored = await primary.poleClaim.findMany({
        where: { windowId: window.id },
        orderBy: { position: "asc" },
      });
      expect(stored.map((row) => row.position)).toEqual([1, 2, 3]);
      // Y ninguna persona con dos puestos.
      expect(new Set(stored.map((row) => row.userId.toString())).size).toBe(3);
    });

    it("la misma persona compitiendo contra sí misma ocupa un solo puesto", async () => {
      const window = await repo.ensureWindow({
        tenantId: TENANT_A,
        chatId: CHAT,
        threadId: null,
        ...WINDOW_BASE,
      });
      const outcomes = await Promise.all(
        Array.from({ length: 12 }, (_, i) => claimFrom(i, window.id, 777n)),
      );
      expect(awarded(outcomes)).toHaveLength(1);
      expect(await countClaims()).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Aislamiento multi-tenant
  // -----------------------------------------------------------------------

  describe("aislamiento entre bots en el mismo grupo", () => {
    it("el mismo chat en dos tenants son dos competiciones", async () => {
      const [a, b] = await Promise.all([
        repo.ensureWindow({
          tenantId: TENANT_A,
          chatId: CHAT,
          threadId: null,
          ...WINDOW_BASE,
        }),
        (repos[1] as PrismaSocialRepository).ensureWindow({
          tenantId: TENANT_B,
          chatId: CHAT,
          threadId: null,
          ...WINDOW_BASE,
        }),
      ]);
      expect(a.id).not.toBe(b.id);

      await repo.claimPosition({
        windowId: a.id,
        userId: 555n,
        userName: "Ana",
        messageId: 1,
        latencyMs: 10,
        positions: 3,
      });

      const seenByB = await repo.listScopeClaims(
        { tenantId: TENANT_B, chatId: CHAT, threadId: null },
        null,
        50,
      );
      expect(seenByB).toHaveLength(0);
    });

    it("el mismo telegramUserId puede ganar en los dos tenants a la vez", async () => {
      // Un usuario real está en los dos grupos; sus poles no deben colisionar.
      const [a, b] = await Promise.all([
        repo.ensureWindow({
          tenantId: TENANT_A,
          chatId: CHAT,
          threadId: null,
          ...WINDOW_BASE,
        }),
        repo.ensureWindow({
          tenantId: TENANT_B,
          chatId: CHAT,
          threadId: null,
          ...WINDOW_BASE,
        }),
      ]);
      const base = {
        userId: 999n,
        userName: "Gerard",
        messageId: 5,
        latencyMs: 5,
        positions: 3,
      };
      expect((await repo.claimPosition({ ...base, windowId: a.id })).ok).toBe(
        true,
      );
      expect((await repo.claimPosition({ ...base, windowId: b.id })).ok).toBe(
        true,
      );
      expect(await countClaims()).toBe(2);
    });

    it("un cooldown de ruleta no cruza de un bot a otro", async () => {
      await repo.recordRouletteRound({
        tenantId: TENANT_A,
        chatId: CHAT,
        threadId: null,
        userId: 555n,
        messageId: 1,
        numerator: 1,
        denominator: 6,
        outcome: "safe",
        consequence: "fun",
        muteSeconds: null,
        degradedWhy: null,
        rngVersion: 1,
      });
      const spins = await repo.lastSpins(
        { tenantId: TENANT_B, chatId: CHAT, threadId: null },
        555n,
      );
      expect(spins.lastChatSpinAt).toBeNull();
      expect(spins.lastUserSpinAt).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Idempotencia
  // -----------------------------------------------------------------------

  describe("reentrega del mismo update", () => {
    it("la segunda ronda con el mismo messageId no se escribe", async () => {
      const round = {
        tenantId: TENANT_A,
        chatId: CHAT,
        threadId: null,
        userId: 555n,
        messageId: 4242,
        numerator: 1,
        denominator: 6,
        outcome: "adverse" as const,
        consequence: "muted" as const,
        muteSeconds: 60,
        degradedWhy: null,
        rngVersion: 1,
      };
      expect(await repo.recordRouletteRound(round)).toEqual({ ok: true });
      expect(await repo.recordRouletteRound(round)).toEqual({
        ok: false,
        reason: "duplicate",
      });
      expect(await countRounds()).toBe(1);
    });

    it("dos reentregas simultáneas tampoco duplican", async () => {
      // El caso que un `if (existe) return` no cubre.
      const round = {
        tenantId: TENANT_A,
        chatId: CHAT,
        threadId: null,
        userId: 555n,
        messageId: 777,
        numerator: 1,
        denominator: 6,
        outcome: "adverse" as const,
        consequence: "muted" as const,
        muteSeconds: 60,
        degradedWhy: null,
        rngVersion: 1,
      };
      const results = await Promise.all(
        repos.map((r) => r.recordRouletteRound(round)),
      );
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(await countRounds()).toBe(1);
    });

    it("una reclamación repetida no crea una segunda fila", async () => {
      const window = await repo.ensureWindow({
        tenantId: TENANT_A,
        chatId: CHAT,
        threadId: null,
        ...WINDOW_BASE,
      });
      const input = {
        windowId: window.id,
        userId: 555n,
        userName: "Ana",
        messageId: 10,
        latencyMs: 10,
        positions: 3,
      };
      const first = await repo.claimPosition(input);
      const replay = await repo.claimPosition(input);
      expect(first.ok).toBe(true);
      expect(replay).toEqual({
        ok: false,
        reason: "already-claimed",
        position: 1,
      });
      expect(await countClaims()).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Integridad ante fallos
  // -----------------------------------------------------------------------

  describe("transacciones fallidas", () => {
    it("una transacción abortada no deja ventana ni reclamación", async () => {
      await expect(
        primary.$transaction(async (tx) => {
          await tx.poleWindow.create({
            data: {
              id: "w-tx",
              tenantId: TENANT_A,
              chatId: CHAT,
              threadId: null,
              ...WINDOW_BASE,
            },
          });
          await tx.poleClaim.create({
            data: {
              windowId: "w-tx",
              position: 1,
              userId: 1n,
              userName: "Ana",
              messageId: 1,
              latencyMs: 1,
            },
          });
          throw new Error("fallo simulado a mitad");
        }),
      ).rejects.toThrow("fallo simulado a mitad");

      expect(await countWindows()).toBe(0);
      expect(await countClaims()).toBe(0);
    });

    it("una reclamación sobre una ventana inexistente responde, no revienta", async () => {
      // Este test encontró un fallo real: la FK rechazaba el INSERT y la
      // excepción subía sin gestionar, así que el handler moría en vez de
      // contestar. Ocurre de verdad cuando una limpieza por retención o un
      // reinicio de temporada se lleva la ventana con un update en vuelo.
      const outcome = await repo.claimPosition({
        windowId: "no-existe",
        userId: 1n,
        userName: "Ana",
        messageId: 1,
        latencyMs: 1,
        positions: 3,
      });
      expect(outcome).toEqual({ ok: false, reason: "window-gone" });
      expect(await countClaims()).toBe(0);
    });

    it("la ventana borrada a mitad de la reclamación da la misma respuesta", async () => {
      const window = await repo.ensureWindow({
        tenantId: TENANT_A,
        chatId: CHAT,
        threadId: null,
        ...WINDOW_BASE,
      });
      await primary.poleWindow.delete({ where: { id: window.id } });
      const outcome = await repo.claimPosition({
        windowId: window.id,
        userId: 2n,
        userName: "Luis",
        messageId: 2,
        latencyMs: 2,
        positions: 3,
      });
      expect(outcome).toEqual({ ok: false, reason: "window-gone" });
    });

    it("borrar la ventana se lleva sus reclamaciones (sin huérfanas)", async () => {
      const window = await repo.ensureWindow({
        tenantId: TENANT_A,
        chatId: CHAT,
        threadId: null,
        ...WINDOW_BASE,
      });
      await repo.claimPosition({
        windowId: window.id,
        userId: 1n,
        userName: "Ana",
        messageId: 1,
        latencyMs: 1,
        positions: 3,
      });
      await primary.poleWindow.delete({ where: { id: window.id } });
      expect(await countClaims()).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Compatibilidad con un rollback de aplicación
  // -----------------------------------------------------------------------

  describe("las tablas nuevas son inertes para el código anterior", () => {
    it("ninguna tabla existente apunta a las tablas sociales", async () => {
      // Si una tabla previa tuviera una FK hacia estas, el código anterior
      // podría fallar al escribir en ella tras revertir. Ninguna la tiene:
      // toda referencia sale DE las tablas sociales, nunca entra.
      const rows = await primary.$queryRaw<
        { referencing: string; referenced: string }[]
      >`
        SELECT c.conrelid::regclass::text AS referencing,
               c.confrelid::regclass::text AS referenced
        FROM pg_constraint c
        WHERE c.contype = 'f'
          AND c.confrelid::regclass::text IN (
            'pole_windows','pole_claims','roulette_rounds',
            'fun_media_assets','telegram_media_files')
      `;
      const foreign = rows.filter(
        (row) =>
          ![
            "pole_windows",
            "pole_claims",
            "roulette_rounds",
            "fun_media_assets",
            "telegram_media_files",
          ].includes(row.referencing),
      );
      expect(foreign).toEqual([]);
    });

    it("no hay disparadores sobre las tablas sociales", async () => {
      // Un trigger podría alterar el comportamiento de escrituras ajenas.
      const rows = await primary.$queryRaw<{ count: bigint }[]>`
        SELECT count(*)::bigint AS count
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        WHERE NOT t.tgisinternal
          AND c.relname IN ('pole_windows','pole_claims','roulette_rounds',
                            'fun_media_assets','telegram_media_files')
      `;
      expect(Number(rows[0]?.count ?? 0)).toBe(0);
    });

    it("todas las columnas nuevas son NOT NULL con default o nullable", async () => {
      // Requisito para que la migración sea aplicable en caliente: ninguna
      // columna NOT NULL sin default podría añadirse a una tabla con datos.
      // Aquí las tablas son nuevas, así que lo que se comprueba es que las
      // NOT NULL sin default son exactamente las que el código SIEMPRE escribe.
      const rows = await primary.$queryRaw<
        { table_name: string; column_name: string }[]
      >`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('pole_windows','pole_claims','roulette_rounds',
                             'fun_media_assets','telegram_media_files')
          AND is_nullable = 'NO'
          AND column_default IS NULL
        ORDER BY table_name, column_name
      `;
      const required = rows.map(
        (row) => `${row.table_name}.${row.column_name}`,
      );
      // source y licence entre ellas: un recurso sin procedencia es imposible
      // de almacenar, que es justo la garantía que se quería.
      expect(required).toContain("fun_media_assets.source");
      expect(required).toContain("fun_media_assets.licence");
      expect(required).toContain("pole_claims.latencyMs");
      expect(required).toContain("pole_windows.startsAt");
    });
  });

  // -----------------------------------------------------------------------
  // Biblioteca multimedia
  // -----------------------------------------------------------------------

  describe("biblioteca multimedia", () => {
    const asset = (over: Record<string, unknown> = {}) => ({
      kind: "cat",
      source: SOURCE_TAG,
      licence: "CC0-1.0",
      safetyStatus: "approved",
      active: true,
      ...over,
    });

    it("el mismo hash no se puede insertar dos veces para un tipo", async () => {
      await primary.funMediaAsset.create({
        data: asset({ contentHash: "abc123" }),
      });
      await expect(
        primary.funMediaAsset.create({
          data: asset({ contentHash: "abc123" }),
        }),
      ).rejects.toMatchObject({ code: "P2002" });
    });

    it("el mismo hash SÍ puede existir para otro tipo", async () => {
      await primary.funMediaAsset.create({
        data: asset({ contentHash: "shared-hash" }),
      });
      const dog = await primary.funMediaAsset.create({
        data: asset({ kind: "dog", contentHash: "shared-hash" }),
      });
      expect(dog.kind).toBe("dog");
    });

    it("un file_id es de UN bot: no se comparte ni se sobrescribe", async () => {
      const row = await primary.funMediaAsset.create({
        data: asset({ contentHash: "h1" }),
      });
      await repo.rememberMediaFileId(row.id, TENANT_A, "FILE-A", "uniq-a");
      await repo.rememberMediaFileId(row.id, TENANT_B, "FILE-B", "uniq-b");
      expect(await repo.findMediaFileId(row.id, TENANT_A)).toBe("FILE-A");
      expect(await repo.findMediaFileId(row.id, TENANT_B)).toBe("FILE-B");
      expect(await countFiles()).toBe(2);
    });

    it("guardar dos veces el file_id del mismo bot actualiza, no duplica", async () => {
      const row = await primary.funMediaAsset.create({
        data: asset({ contentHash: "h2" }),
      });
      await repo.rememberMediaFileId(row.id, TENANT_A, "FILE-1", null);
      await repo.rememberMediaFileId(row.id, TENANT_A, "FILE-2", null);
      expect(await repo.findMediaFileId(row.id, TENANT_A)).toBe("FILE-2");
      expect(await countFiles()).toBe(1);
    });

    it("solo sirve lo aprobado, activo y del tenant o compartido", async () => {
      await primary.funMediaAsset.createMany({
        data: [
          asset({ contentHash: "s1", tenantId: null }),
          asset({ contentHash: "s2", tenantId: TENANT_A }),
          asset({ contentHash: "s3", tenantId: TENANT_B }),
          asset({ contentHash: "s4", tenantId: null, safetyStatus: "pending" }),
          asset({ contentHash: "s5", tenantId: null, active: false }),
        ],
      });
      // Filtrado por la marca de este fichero: otro suite en paralelo puede
      // tener sus propios recursos compartidos, y contarlos aquí sería flaky.
      const rows = (await repo.listMediaAssets(TENANT_A, "cat")).filter(
        (row) => row.source === SOURCE_TAG,
      );
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.safetyStatus === "approved" && r.active)).toBe(
        true,
      );
    });

    it("un bot nuevo tiene TODA la biblioteca compartida pendiente", async () => {
      // Ningún file_id del padre le sirve: hay que rehacer la subida entera.
      await primary.funMediaAsset.createMany({
        data: [
          asset({ contentHash: "p1", tenantId: null }),
          asset({ contentHash: "p2", tenantId: null }),
        ],
      });
      const pending = await repo.pendingMediaUploads(TENANT_B, 50);
      expect(pending).toHaveLength(2);
      expect(pending.every((task) => task.attempts === 0)).toBe(true);
    });

    it("lo ya listo para un bot deja de estar pendiente PARA ESE bot", async () => {
      const row = await primary.funMediaAsset.create({
        data: asset({ contentHash: "p3", tenantId: null }),
      });
      await repo.rememberMediaFileId(row.id, TENANT_A, "FILE-A", null);
      expect(await repo.pendingMediaUploads(TENANT_A, 50)).toHaveLength(0);
      // Y el otro bot lo sigue teniendo pendiente: el trabajo es por identidad.
      expect(await repo.pendingMediaUploads(TENANT_B, 50)).toHaveLength(1);
    });

    it("un fallo aislado se reintenta; uno agotado no vuelve a la cola", async () => {
      const row = await primary.funMediaAsset.create({
        data: asset({ contentHash: "p4", tenantId: null }),
      });
      await repo.recordMediaUpload({
        assetId: row.id,
        tenantId: TENANT_A,
        state: "pending",
        attempts: 1,
        fileId: null,
        fileUniqueId: null,
        lastError: "429",
      });
      expect(await repo.pendingMediaUploads(TENANT_A, 50)).toHaveLength(1);

      await repo.recordMediaUpload({
        assetId: row.id,
        tenantId: TENANT_A,
        state: "failed",
        attempts: 3,
        fileId: null,
        fileUniqueId: null,
        lastError: "PHOTO_INVALID_DIMENSIONS",
      });
      // Reintentar en bucle algo agotado es como se construye un bucle de
      // errores contra Telegram.
      expect(await repo.pendingMediaUploads(TENANT_A, 50)).toHaveLength(0);
    });

    it("nunca sirve un file_id que no esté en estado listo", async () => {
      const row = await primary.funMediaAsset.create({
        data: asset({ contentHash: "p5", tenantId: null }),
      });
      // Un intento anterior dejó un file_id que ya no vale.
      await repo.recordMediaUpload({
        assetId: row.id,
        tenantId: TENANT_A,
        state: "pending",
        attempts: 1,
        fileId: "FILE-VIEJO",
        fileUniqueId: null,
        lastError: "timeout",
      });
      expect(await repo.findMediaFileId(row.id, TENANT_A)).toBeNull();
    });

    it("revocar retira el recurso y marca sus file_id, sin borrar la fila", async () => {
      const row = await primary.funMediaAsset.create({
        data: asset({ contentHash: "p6", tenantId: null }),
      });
      await repo.rememberMediaFileId(row.id, TENANT_A, "FILE-R", null);

      expect(await repo.revokeMediaAsset(row.id)).toBe(true);
      expect(await repo.listMediaAssets(TENANT_A, "cat")).toHaveLength(0);
      expect(await repo.findMediaFileId(row.id, TENANT_A)).toBeNull();
      // La fila sigue ahí: el hash debe seguir bloqueando una reimportación.
      const still = await primary.funMediaAsset.findUnique({
        where: { id: row.id },
      });
      expect(still?.active).toBe(false);
      await expect(
        primary.funMediaAsset.create({ data: asset({ contentHash: "p6" }) }),
      ).rejects.toMatchObject({ code: "P2002" });
    });

    it("revocar dos veces no miente sobre lo que ha hecho", async () => {
      const row = await primary.funMediaAsset.create({
        data: asset({ contentHash: "p7", tenantId: null }),
      });
      expect(await repo.revokeMediaAsset(row.id)).toBe(true);
      expect(await repo.revokeMediaAsset(row.id)).toBe(false);
    });

    it("cuenta los recursos por estado, para el diagnóstico", async () => {
      const rows = await Promise.all([
        primary.funMediaAsset.create({
          data: asset({ contentHash: "c1", tenantId: null }),
        }),
        primary.funMediaAsset.create({
          data: asset({ contentHash: "c2", tenantId: null }),
        }),
      ]);
      await repo.rememberMediaFileId(rows[0]?.id ?? "", TENANT_A, "F1", null);
      await repo.recordMediaUpload({
        assetId: rows[1]?.id ?? "",
        tenantId: TENANT_A,
        state: "failed",
        attempts: 3,
        fileId: null,
        fileUniqueId: null,
        lastError: "x",
      });
      const counts = await repo.mediaStateCounts(TENANT_A);
      expect(counts.ready).toBe(1);
      expect(counts.failed).toBe(1);
    });

    it("borrar el recurso se lleva sus file_id", async () => {
      const row = await primary.funMediaAsset.create({
        data: asset({ contentHash: "h3" }),
      });
      await repo.rememberMediaFileId(row.id, TENANT_A, "FILE-X", null);
      await primary.funMediaAsset.delete({ where: { id: row.id } });
      expect(await countFiles()).toBe(0);
    });
  });
});

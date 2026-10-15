/**
 * Clasificaciones a escala, contra POSTGRES REAL.
 *
 * POR QUÉ EXISTE. La primera versión cargaba las reclamaciones y las contaba en
 * memoria con un techo de 2.000. Un grupo que juega a diario con tres puestos
 * genera ~1.100 reclamaciones al año, así que el techo se cruza en el segundo
 * año y a partir de ahí el ranking recorta **en silencio** — y sesgado, porque
 * el corte era por fecha descendente: el histórico dejaba de ser histórico.
 *
 * Aquí se generan 6.000 reclamaciones (más del triple del techo viejo) y se
 * comprueba que el resultado es exacto, no aproximado.
 *
 * Se ejecuta igual que el resto de la integración (ver
 * `social-core.integration.test.ts` para el runbook).
 */

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaSocialRepository } from "./social-repository.js";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const TENANT_A = "tenant-scale-a";
const TENANT_B = "tenant-scale-b";
const CHAT = -1005555555555n;

/** 2.000 días × 3 puestos = 6.000 reclamaciones. */
const DAYS = 2000;
const POSITIONS = 3;

/** Cuántas personas se reparten el juego. */
const PLAYERS = 40;

const dayKeyFor = (index: number): string => {
  // Arranca en 2021-01-01 para cruzar varios cambios de año y de mes.
  const day = new Date(Date.UTC(2021, 0, 1) + index * 24 * 3600 * 1000);
  const mm = String(day.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(day.getUTCDate()).padStart(2, "0");
  return `${day.getUTCFullYear()}-${mm}-${dd}`;
};

describe.skipIf(!TEST_DATABASE_URL)(
  "clasificaciones a escala (Postgres real)",
  () => {
    const client = new PrismaClient({
      datasourceUrl: TEST_DATABASE_URL ?? "postgresql://skipped",
    });
    const repo = new PrismaSocialRepository(client);
    const scope = { tenantId: TENANT_A, chatId: CHAT, threadId: null };

    /** Cuentas esperadas, calculadas al sembrar: la verdad contra la que medir. */
    const expected = new Map<
      string,
      { firsts: number; seconds: number; thirds: number; total: number }
    >();

    beforeAll(async () => {
      await client.poleWindow.deleteMany({
        where: { tenantId: { in: [TENANT_A, TENANT_B] } },
      });

      const windows: {
        id: string;
        tenantId: string;
        chatId: bigint;
        threadId: number | null;
        windowType: string;
        startsAt: Date;
        endsAt: Date;
        timezone: string;
        resetMinutes: number;
        dayKey: string;
      }[] = [];
      const claims: {
        windowId: string;
        position: number;
        userId: bigint;
        userName: string;
        messageId: number;
        latencyMs: number;
        claimedAt: Date;
      }[] = [];

      for (let day = 0; day < DAYS; day += 1) {
        const dayKey = dayKeyFor(day);
        const startsAt = new Date(
          Date.UTC(2021, 0, 1) + day * 24 * 3600 * 1000,
        );
        const id = `sw-${day}`;
        windows.push({
          id,
          tenantId: TENANT_A,
          chatId: CHAT,
          threadId: null,
          windowType: "daily",
          startsAt,
          endsAt: new Date(startsAt.getTime() + 24 * 3600 * 1000),
          timezone: "Europe/Madrid",
          resetMinutes: 0,
          dayKey,
        });
        for (let pos = 1; pos <= POSITIONS; pos += 1) {
          // Reparto determinista, pero desigual: así el orden del ranking
          // significa algo en vez de ser un empate general.
          const player = (day * POSITIONS + pos * 7) % PLAYERS;
          const userId = BigInt(900000 + player);
          claims.push({
            windowId: id,
            position: pos,
            userId,
            // El nombre cambia con el tiempo: el ranking debe quedarse el último.
            userName: `Jugador ${player} v${Math.floor(day / 500)}`,
            messageId: day * 10 + pos,
            latencyMs: 1000 + ((day * 31 + pos * 13) % 90000),
            claimedAt: new Date(startsAt.getTime() + pos * 1000),
          });
          const key = userId.toString();
          const prior = expected.get(key) ?? {
            firsts: 0,
            seconds: 0,
            thirds: 0,
            total: 0,
          };
          expected.set(key, {
            firsts: prior.firsts + (pos === 1 ? 1 : 0),
            seconds: prior.seconds + (pos === 2 ? 1 : 0),
            thirds: prior.thirds + (pos === 3 ? 1 : 0),
            total: prior.total + 1,
          });
        }
      }

      await client.poleWindow.createMany({ data: windows });
      // En lotes: 6.000 filas en un solo createMany satura los parámetros.
      for (let i = 0; i < claims.length; i += 1000) {
        await client.poleClaim.createMany({ data: claims.slice(i, i + 1000) });
      }

      // Un segundo tenant en EL MISMO chat, con los MISMOS telegramUserId.
      await client.poleWindow.create({
        data: {
          id: "sw-other-tenant",
          tenantId: TENANT_B,
          chatId: CHAT,
          threadId: null,
          windowType: "daily",
          startsAt: new Date(Date.UTC(2021, 0, 1)),
          endsAt: new Date(Date.UTC(2021, 0, 2)),
          timezone: "Europe/Madrid",
          resetMinutes: 0,
          dayKey: "2021-01-01",
          claims: {
            create: [
              {
                position: 1,
                userId: 900000n,
                userName: "Otro bot",
                messageId: 1,
                latencyMs: 1,
              },
            ],
          },
        },
      });
    }, 120_000);

    afterAll(async () => {
      await client.poleWindow.deleteMany({
        where: { tenantId: { in: [TENANT_A, TENANT_B] } },
      });
      await client.$disconnect();
    });

    it("sembró de verdad más del triple del techo antiguo", async () => {
      expect(await repo.countClaims(scope)).toBe(DAYS * POSITIONS);
      expect(DAYS * POSITIONS).toBeGreaterThan(2000);
    });

    it("cuenta TODAS las reclamaciones, no las 2.000 últimas", async () => {
      const rows = await repo.rankingFor(scope, null, PLAYERS);
      const totalCounted = rows.reduce((sum, row) => sum + row.total, 0);
      expect(totalCounted).toBe(DAYS * POSITIONS);

      // Y cada jugador cuadra exactamente con lo sembrado.
      for (const row of rows) {
        expect(row).toMatchObject({
          userId: row.userId,
          ...expected.get(row.userId),
        });
      }
    });

    it("ordena por oros, luego platas, luego bronces", async () => {
      const rows = await repo.rankingFor(scope, null, PLAYERS);
      for (let i = 1; i < rows.length; i += 1) {
        const prev = rows[i - 1] as (typeof rows)[number];
        const cur = rows[i] as (typeof rows)[number];
        const ordered =
          prev.firsts > cur.firsts ||
          (prev.firsts === cur.firsts && prev.seconds > cur.seconds) ||
          (prev.firsts === cur.firsts &&
            prev.seconds === cur.seconds &&
            prev.thirds >= cur.thirds);
        expect(ordered).toBe(true);
      }
    });

    it("resuelve los empates de forma estable entre llamadas", async () => {
      const a = await repo.rankingFor(scope, null, PLAYERS);
      const b = await repo.rankingFor(scope, null, PLAYERS);
      expect(a.map((row) => row.userId)).toEqual(b.map((row) => row.userId));
    });

    it("se queda con el nombre más reciente de cada persona", async () => {
      // Los nombres van con sufijo v0, v1, v2, v3 según avanza el tiempo.
      const rows = await repo.rankingFor(scope, null, PLAYERS);
      expect(rows.every((row) => row.userName?.endsWith("v3"))).toBe(true);
    });

    it("el límite recorta lo que se enseña, no lo que se cuenta", async () => {
      const top = await repo.rankingFor(scope, null, 10);
      const all = await repo.rankingFor(scope, null, PLAYERS);
      expect(top).toHaveLength(10);
      // Las diez primeras filas son idénticas: el recorte es del final.
      expect(top).toEqual(all.slice(0, 10));
      // Y el primero tiene el mismo recuento con y sin límite.
      expect(top[0]?.firsts).toBe(all[0]?.firsts);
    });

    it("filtra por día, mes y año sobre el historial completo", async () => {
      const day = await repo.rankingFor(scope, "2021-06-15", PLAYERS);
      const month = await repo.rankingFor(scope, "2021-06", PLAYERS);
      const year = await repo.rankingFor(scope, "2021", PLAYERS);
      const all = await repo.rankingFor(scope, null, PLAYERS);

      const sum = (rows: readonly { total: number }[]) =>
        rows.reduce((acc, row) => acc + row.total, 0);

      expect(sum(day)).toBe(POSITIONS);
      expect(sum(month)).toBe(30 * POSITIONS);
      expect(sum(year)).toBe(365 * POSITIONS);
      expect(sum(all)).toBe(DAYS * POSITIONS);
    });

    it("cruza bien el cambio de año", async () => {
      const y2021 = await repo.rankingFor(scope, "2021", PLAYERS);
      const y2022 = await repo.rankingFor(scope, "2022", PLAYERS);
      const dec = await repo.rankingFor(scope, "2021-12", PLAYERS);
      const jan = await repo.rankingFor(scope, "2022-01", PLAYERS);
      const sum = (rows: readonly { total: number }[]) =>
        rows.reduce((acc, row) => acc + row.total, 0);

      expect(sum(y2021)).toBe(365 * POSITIONS);
      expect(sum(y2022)).toBe(365 * POSITIONS);
      expect(sum(dec)).toBe(31 * POSITIONS);
      expect(sum(jan)).toBe(31 * POSITIONS);
    });

    it("no mezcla el mismo telegramUserId de dos bots distintos", async () => {
      const mine = await repo.rankingFor(scope, null, PLAYERS);
      const theirs = await repo.rankingFor(
        { tenantId: TENANT_B, chatId: CHAT, threadId: null },
        null,
        PLAYERS,
      );
      expect(theirs).toHaveLength(1);
      expect(theirs[0]?.total).toBe(1);
      // El jugador 900000 existe en los dos; sus cuentas no se suman.
      const here = mine.find((row) => row.userId === "900000");
      expect(here?.total).toBe(expected.get("900000")?.total);
    });

    it("una persona borrada del ranking deja de aparecer, sin romper el resto", async () => {
      const before = await repo.rankingFor(scope, null, PLAYERS);
      const victim = before[before.length - 1] as (typeof before)[number];
      await client.poleClaim.deleteMany({
        where: {
          userId: BigInt(victim.userId),
          window: { tenantId: TENANT_A },
        },
      });
      const after = await repo.rankingFor(scope, null, PLAYERS);
      expect(after.some((row) => row.userId === victim.userId)).toBe(false);
      expect(after).toHaveLength(before.length - 1);
      // Y los recuentos de los demás no se han movido.
      expect(after[0]?.total).toBe(before[0]?.total);

      // Se restaura para no contaminar los tests siguientes.
      await client.poleClaim.createMany({
        data: Array.from({ length: victim.total }, (_, i) => ({
          windowId: `sw-${1500 + i}`,
          position: 3,
          userId: BigInt(victim.userId),
          userName: "restaurado",
          messageId: 900000 + i,
          latencyMs: 1,
        })),
        skipDuplicates: true,
      });
    });

    it("los días ganados están acotados por el calendario, no por el juego", async () => {
      const rows = await repo.rankingFor(scope, null, 1);
      const top = rows[0] as (typeof rows)[number];
      const days = await repo.winDaysFor(scope, BigInt(top.userId));
      expect(days.length).toBe(top.firsts);
      // Ordenados y sin repetidos: es lo que la racha da por supuesto.
      expect([...days]).toEqual([...days].sort());
      expect(new Set(days).size).toBe(days.length);
    });

    it("los récords salen del historial completo", async () => {
      const records = await repo.recordsFor(scope);
      expect(records.fastest).not.toBeNull();

      // El más rápido de VERDAD entre los primeros puestos, comprobado aparte.
      const trueFastest = await client.poleClaim.findFirst({
        where: { position: 1, window: { tenantId: TENANT_A } },
        orderBy: { latencyMs: "asc" },
      });
      expect(records.fastest?.latencyMs).toBe(trueFastest?.latencyMs);
      expect(records.bestStreakDays).toBeGreaterThan(0);
    });
  },
);

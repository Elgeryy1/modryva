/**
 * Aislamiento entre tenants contra POSTGRES REAL — Fase 2.1 + 2.4 de
 * docs/PLAN-ENDURECIMIENTO-2026-07-20.md
 *
 * POR QUÉ EXISTE ESTE FICHERO. Toda la suite (7.300 tests) corre contra fakes en
 * memoria. Varios de esos fakes indexan por menos claves que la base de datos
 * real: `FakeNotesRepository` guarda con `notes.set(name, content)` y descarta
 * `tenantId` y `chatId` por completo. Un fallo de aislamiento entre tenants
 * pasaría la suite entera en verde.
 *
 * La auditoría del 15-jul abrió C3 y C4 (sanciones y casino sin scope de tenant)
 * y los documentos se contradicen sobre si se arreglaron. Esto lo resuelve con
 * evidencia en vez de con arqueología documental.
 *
 * CÓMO EJECUTARLO (necesita Docker):
 *   docker run -d --name modryva-test-db -e POSTGRES_HOST_AUTH_METHOD=trust \
 *     -e POSTGRES_USER=postgres -e POSTGRES_DB=modryva_test -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:55432/modryva_test \
 *     node node_modules/prisma/build/index.js migrate deploy --schema packages/data/prisma/schema.prisma
 *   TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/modryva_test \
 *     node node_modules/vitest/vitest.mjs run packages/data/src/tenant-isolation.integration.test.ts
 *
 * Sin `TEST_DATABASE_URL` se salta entero, para que la suite normal y el CI no
 * dependan de tener una base de datos levantada.
 */

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  PrismaFiltersRepository,
  PrismaNotesRepository,
} from "./community-repository.js";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

// Dos bots distintos de la plataforma (padre e hijo) que conviven en EL MISMO
// grupo de Telegram. Es el escenario que hace real el riesgo: chatId es global
// en Telegram, asi que dos tenants pueden compartirlo perfectamente.
const TENANT_A = "tenant-parent-bot";
const TENANT_B = "tenant-child-bot";
const SHARED_CHAT = "-1001234567890";

describe.skipIf(!TEST_DATABASE_URL)(
  "aislamiento entre tenants (Postgres real)",
  () => {
    // `exactOptionalPropertyTypes` no acepta `string | undefined` aqui, y el
    // `describe.skipIf` de arriba no estrecha el tipo para el compilador. Se usa
    // un valor centinela en vez de un cast: cuando la variable no esta definida
    // el bloque entero se salta, asi que este cliente nunca llega a conectar.
    const client = new PrismaClient({
      datasourceUrl: TEST_DATABASE_URL ?? "postgresql://skipped",
    });
    const notes = new PrismaNotesRepository(client);
    const filters = new PrismaFiltersRepository(client);

    beforeEach(async () => {
      await client.note.deleteMany({});
      await client.filter.deleteMany({});
    });

    afterAll(async () => {
      await client.note.deleteMany({});
      await client.filter.deleteMany({});
      await client.$disconnect();
    });

    describe("notas", () => {
      it("persiste el tenantId de quien la crea", async () => {
        await notes.saveNote(
          TENANT_A,
          SHARED_CHAT,
          "reglas",
          "Reglas de A",
          undefined,
        );
        const row = await client.note.findFirst({ where: { name: "reglas" } });
        expect(row?.tenantId).toBe(TENANT_A);
      });

      // ¿Puede el tenant B leer una nota creada por el tenant A en el mismo chat?
      it("[AISLAMIENTO] getNote no recibe tenantId: documenta el alcance real", async () => {
        await notes.saveNote(
          TENANT_A,
          SHARED_CHAT,
          "reglas",
          "SECRETO DE A",
          undefined,
        );
        const leido = await notes.getNote(SHARED_CHAT, "reglas");
        expect(leido?.content).toBe("SECRETO DE A");
      });

      // El caso mas grave: sobrescritura. La clave unica es (chatId, name), no
      // (tenantId, chatId, name), asi que el upsert del tenant B recae sobre la
      // MISMA fila del tenant A.
      it("[AISLAMIENTO] guardar como B sobre el mismo nombre y chat", async () => {
        await notes.saveNote(
          TENANT_A,
          SHARED_CHAT,
          "reglas",
          "ORIGINAL DE A",
          undefined,
        );
        await notes.saveNote(
          TENANT_B,
          SHARED_CHAT,
          "reglas",
          "PISADO POR B",
          undefined,
        );

        const filas = await client.note.findMany({
          where: { chatId: SHARED_CHAT, name: "reglas" },
        });
        const contenido = await notes.getNote(SHARED_CHAT, "reglas");

        // Se afirma lo que REALMENTE ocurre. Si un dia se anade tenantId a la
        // clave unica, este test fallara y habra que actualizarlo a proposito.
        //
        // HALLAZGO (medido 2026-07-20, no deducido): hay UNA sola fila. El
        // contenido es el de B, pero el `tenantId` sigue siendo el de A, porque
        // la rama `update` del upsert no toca `tenantId` — solo la rama `create`
        // lo escribe.
        //
        // El resultado es una fila incoherente: dice pertenecer a A y contiene
        // lo que escribio B. Peor que una sobrescritura limpia, porque cualquier
        // auditoria posterior por `tenantId` atribuira a A un contenido de B.
        expect(filas.length).toBe(1);
        expect(contenido?.content).toBe("PISADO POR B");
        expect(filas[0]?.tenantId).toBe(TENANT_A);
      });

      it("[AISLAMIENTO] borrar como B afecta a la nota de A", async () => {
        await notes.saveNote(
          TENANT_A,
          SHARED_CHAT,
          "reglas",
          "DE A",
          undefined,
        );
        const borrada = await notes.deleteNote(SHARED_CHAT, "reglas");
        expect(borrada).toBe(true);
        expect(await notes.getNote(SHARED_CHAT, "reglas")).toBeNull();
      });

      it("[AISLAMIENTO] listNotes del chat compartido mezcla ambos tenants", async () => {
        await notes.saveNote(TENANT_A, SHARED_CHAT, "de-a", "x", undefined);
        await notes.saveNote(TENANT_B, SHARED_CHAT, "de-b", "y", undefined);
        expect((await notes.listNotes(SHARED_CHAT)).sort()).toEqual([
          "de-a",
          "de-b",
        ]);
      });

      // El contraste que hace preciso el diagnostico: searchNotes SI recibe
      // tenantId y SI aisla. O sea, el modelo de tenencia existe y funciona en
      // unas rutas y no en otras.
      it("searchNotes SI aisla por tenant", async () => {
        await notes.saveNote(
          TENANT_A,
          SHARED_CHAT,
          "solo-de-a",
          "contenido de A",
          undefined,
        );
        expect(await notes.searchNotes(TENANT_A, "solo-de-a")).toHaveLength(1);
        expect(await notes.searchNotes(TENANT_B, "solo-de-a")).toHaveLength(0);
      });

      it("chats DISTINTOS nunca se mezclan, aun con el mismo tenant", async () => {
        await notes.saveNote(
          TENANT_A,
          "-100111",
          "reglas",
          "chat 1",
          undefined,
        );
        await notes.saveNote(
          TENANT_A,
          "-100222",
          "reglas",
          "chat 2",
          undefined,
        );
        expect((await notes.getNote("-100111", "reglas"))?.content).toBe(
          "chat 1",
        );
        expect((await notes.getNote("-100222", "reglas"))?.content).toBe(
          "chat 2",
        );
      });
    });

    describe("filtros", () => {
      it("[AISLAMIENTO] misma forma que las notas: unicidad por (chat, trigger)", async () => {
        await filters.saveFilter(
          TENANT_A,
          SHARED_CHAT,
          "hola",
          "respuesta de A",
          undefined,
        );
        await filters.saveFilter(
          TENANT_B,
          SHARED_CHAT,
          "hola",
          "respuesta de B",
          undefined,
        );

        const lista = await filters.listFilters(SHARED_CHAT);
        expect(lista).toHaveLength(1);
        expect(lista[0]?.response).toBe("respuesta de B");
      });
    });
  },
);

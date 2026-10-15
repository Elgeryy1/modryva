import { describe, expect, it } from "vitest";

import { InMemoryIntroductionRepository } from "./introduction-repository.js";

/**
 * Dos ticks solapados no pueden avisar dos veces a la misma persona.
 *
 * El barrido de presentaciones corre cada 60 s, y BullMQ programa la vuelta
 * siguiente **al coger** el job, no al terminarlo: una vuelta lenta se solapa
 * con la siguiente. La fase 1 ya se protegia con `markReported`; la fase 2
 * incrementaba el contador de recordatorios **despues** de avisar y sin
 * condicion, asi que los dos ticks leian el mismo valor, los dos pasaban la
 * comprobacion de tiempo y los dos avisaban.
 *
 * Con la escalada a expulsion detras (`autoKickAtLimit`), un aviso de mas
 * acerca a alguien a que le echen.
 */

const alta = async (repo: InMemoryIntroductionRepository) => {
  await repo.start({
    tenantId: "t1",
    chatId: "c1",
    telegramChatId: -100n,
    telegramUserId: 7n,
    dueAt: new Date("2026-08-21T12:00:00Z"),
  });
  const fila = await repo.find("t1", "c1", 7n);
  if (!fila) throw new Error("no se creo la fila");
  return fila;
};

describe("reclamarRecordatorio", () => {
  it("el primero reserva y el segundo se queda fuera", async () => {
    // Los dos ticks vieron `reminders: 0`. Solo uno puede avisar.
    const repo = new InMemoryIntroductionRepository();
    const fila = await alta(repo);

    expect(await repo.reclamarRecordatorio(fila.id, 0)).toBe(true);
    expect(await repo.reclamarRecordatorio(fila.id, 0)).toBe(false);
  });

  it("el siguiente recordatorio si se puede reservar", async () => {
    // Cuando de verdad toca el segundo aviso, quien lo pide ya vio
    // `reminders: 1`.
    const repo = new InMemoryIntroductionRepository();
    const fila = await alta(repo);

    expect(await repo.reclamarRecordatorio(fila.id, 0)).toBe(true);
    expect(await repo.reclamarRecordatorio(fila.id, 1)).toBe(true);
  });

  it("reservar incrementa el contador, que es lo que gobierna la cadencia", async () => {
    // El siguiente aviso vence en `reportedAt + (reminders + 1) x cadencia`.
    // Si el contador no subiera, se avisaria en cada barrido.
    const repo = new InMemoryIntroductionRepository();
    const fila = await alta(repo);

    await repo.reclamarRecordatorio(fila.id, 0);

    const despues = await repo.find("t1", "c1", 7n);
    expect(despues?.reminders).toBe(1);
  });

  it("una fila que no existe no se puede reservar", async () => {
    const repo = new InMemoryIntroductionRepository();

    expect(await repo.reclamarRecordatorio("no-existe", 0)).toBe(false);
  });

  it("un contador que no coincide no reserva ni incrementa", async () => {
    // Es la mitad que importa: si reservara igual, dos ticks con lecturas
    // distintas avisarian los dos.
    const repo = new InMemoryIntroductionRepository();
    const fila = await alta(repo);

    expect(await repo.reclamarRecordatorio(fila.id, 5)).toBe(false);

    const despues = await repo.find("t1", "c1", 7n);
    expect(despues?.reminders).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  auditLogTarget,
  chatActivityTarget,
  MIN_AUDIT_LOG_DAYS,
  MIN_CHAT_ACTIVITY_DAYS,
  MIN_UPDATE_INBOX_DAYS,
  processRetention,
  type RetentionTarget,
  updateInboxTarget,
} from "./retention.js";

/**
 * Las tablas que nunca se vaciaban, y los suelos que impiden que vaciarlas
 * haga dano. El suelo va por tabla porque el dano de pasarse es distinto en
 * cada una — y en `audit_logs` es irreversible.
 */

const AHORA = new Date("2026-08-05T00:00:00Z");
const DIA = 24 * 60 * 60 * 1000;

/** Una tabla falsa con filas fechadas, que borra como lo haria la de verdad. */
const tablaCon = (edadesEnDias: number[]) => {
  let filas = edadesEnDias.map((dias, i) => ({
    id: `r${i}`,
    createdAt: new Date(AHORA.getTime() - dias * DIA),
  }));
  const cortes: Date[] = [];
  return {
    get restantes() {
      return filas.length;
    },
    get cortes() {
      return cortes;
    },
    purge: async (before: Date, limit: number) => {
      cortes.push(before);
      const viejas = filas.filter((f) => f.createdAt < before).slice(0, limit);
      const ids = new Set(viejas.map((f) => f.id));
      filas = filas.filter((f) => !ids.has(f.id));
      return viejas.length;
    },
  };
};

const objetivo = (
  name: string,
  days: number,
  minDays: number,
  purge: RetentionTarget["purge"],
): RetentionTarget => ({ name, days, minDays, purge });

describe("borra lo viejo y solo lo viejo", () => {
  it("deja intacto lo que esta dentro de la ventana", async () => {
    const tabla = tablaCon([0, 1, 5, 13, 20, 40]);

    const res = await processRetention({
      targets: [objetivo("t", 14, 2, tabla.purge)],
      now: AHORA,
    });

    expect(res.processed).toBe(2);
    expect(tabla.restantes).toBe(4);
  });

  it("el corte se calcula desde `now`, no desde el reloj real", async () => {
    const tabla = tablaCon([100]);

    await processRetention({
      targets: [objetivo("t", 14, 2, tabla.purge)],
      now: AHORA,
    });

    expect(tabla.cortes[0]?.getTime()).toBe(AHORA.getTime() - 14 * DIA);
  });
});

describe("los suelos, que son el seguro de verdad", () => {
  it("update_inbox nunca baja de 2 dias", async () => {
    // Borrar una fila viva no pierde datos: hace que el update se procese DOS
    // veces, o sea un baneo doble o un mensaje duplicado.
    const tabla = tablaCon([0, 0.5, 1]);

    const res = await processRetention({
      targets: [
        objetivo("update_inbox", 0, MIN_UPDATE_INBOX_DAYS, tabla.purge),
      ],
      now: AHORA,
    });

    expect(res.targets[0]?.retentionDays).toBe(MIN_UPDATE_INBOX_DAYS);
    expect(res.processed).toBe(0);
    expect(tabla.restantes).toBe(3);
  });

  it("audit_logs nunca baja de 30 dias, ni con un 1 en la configuracion", async () => {
    // El caso irreversible: audit_logs es la prueba de lo que hizo el bot. Es
    // lo que permitio reconstruir las 13 expulsiones del 3 de agosto.
    const tabla = tablaCon([2, 10, 25, 29]);

    const res = await processRetention({
      targets: [objetivo("audit_logs", 1, MIN_AUDIT_LOG_DAYS, tabla.purge)],
      now: AHORA,
    });

    expect(res.targets[0]?.retentionDays).toBe(MIN_AUDIT_LOG_DAYS);
    expect(res.processed).toBe(0);
    expect(tabla.restantes).toBe(4);
  });

  it("un valor negativo tampoco cuela", async () => {
    const tabla = tablaCon([0, 1]);

    const res = await processRetention({
      targets: [objetivo("t", -30, MIN_CHAT_ACTIVITY_DAYS, tabla.purge)],
      now: AHORA,
    });

    expect(res.targets[0]?.retentionDays).toBe(MIN_CHAT_ACTIVITY_DAYS);
    expect(tabla.restantes).toBe(2);
  });

  it("los suelos NO son iguales entre tablas", async () => {
    // Si alguien los unificara, `audit_logs` heredaria el suelo de 2 dias de
    // `update_inbox` y la traza de evidencia se borraria sola en 48 h.
    expect(MIN_AUDIT_LOG_DAYS).toBeGreaterThan(MIN_UPDATE_INBOX_DAYS);
    expect(MIN_CHAT_ACTIVITY_DAYS).toBeGreaterThan(MIN_UPDATE_INBOX_DAYS);
  });
});

describe("varias tablas en el mismo tick", () => {
  it("cada una con su ventana, y se suman", async () => {
    const inbox = tablaCon([20, 30]);
    const audit = tablaCon([200, 300]);

    const res = await processRetention({
      targets: [
        objetivo("update_inbox", 14, MIN_UPDATE_INBOX_DAYS, inbox.purge),
        objetivo("audit_logs", 180, MIN_AUDIT_LOG_DAYS, audit.purge),
      ],
      now: AHORA,
    });

    expect(res.processed).toBe(4);
    expect(res.targets.map((t) => t.name)).toEqual([
      "update_inbox",
      "audit_logs",
    ]);
  });

  it("que una falle no se lleva por delante a la otra", async () => {
    const buena = tablaCon([200, 300]);

    const res = await processRetention({
      targets: [
        objetivo("rota", 14, 2, async () => {
          throw new Error("la base de datos dijo que no");
        }),
        objetivo("buena", 180, 30, buena.purge),
      ],
      now: AHORA,
    });

    expect(res.errors).toBe(1);
    expect(res.targets[0]?.failed).toBe(true);
    // La segunda se hizo igualmente.
    expect(res.targets[1]?.deleted).toBe(2);
    expect(buena.restantes).toBe(0);
  });
});

describe("no da un tiron con el atraso acumulado", () => {
  it("respeta el tope de un tick y avisa de que quedan mas", async () => {
    const tabla = tablaCon(Array.from({ length: 5000 }, () => 30));

    const res = await processRetention({
      targets: [objetivo("t", 14, 2, tabla.purge)],
      now: AHORA,
      maxRows: 100,
    });

    expect(res.processed).toBe(100);
    expect(res.targets[0]?.truncated).toBe(true);
    expect(tabla.restantes).toBe(4900);
  });

  it("termina cuando ya no queda nada viejo, sin consultas de mas", async () => {
    const tabla = tablaCon([30, 30, 30]);

    const res = await processRetention({
      targets: [objetivo("t", 14, 2, tabla.purge)],
      now: AHORA,
      maxRows: 10_000,
    });

    expect(res.processed).toBe(3);
    expect(tabla.cortes).toHaveLength(1);
  });
});

describe("los objetivos ya montados llevan su suelo puesto", () => {
  const repoFalso = {
    purgeUpdateInbox: async () => 0,
    purgeAuditLogs: async () => 0,
    purgeChatActivityEvents: async () => 0,
  };

  it("cada uno con el suyo, no con uno compartido", () => {
    expect(updateInboxTarget(repoFalso, 14).minDays).toBe(
      MIN_UPDATE_INBOX_DAYS,
    );
    expect(auditLogTarget(repoFalso, 180).minDays).toBe(MIN_AUDIT_LOG_DAYS);
    expect(chatActivityTarget(repoFalso, 90).minDays).toBe(
      MIN_CHAT_ACTIVITY_DAYS,
    );
  });

  it("cada uno llama al metodo que le toca", async () => {
    const llamados: string[] = [];
    const repo = {
      purgeUpdateInbox: async () => {
        llamados.push("inbox");
        return 0;
      },
      purgeAuditLogs: async () => {
        llamados.push("audit");
        return 0;
      },
      purgeChatActivityEvents: async () => {
        llamados.push("activity");
        return 0;
      },
    };

    await processRetention({
      targets: [
        updateInboxTarget(repo, 14),
        auditLogTarget(repo, 180),
        chatActivityTarget(repo, 90),
      ],
      now: AHORA,
    });

    expect(llamados).toEqual(["inbox", "audit", "activity"]);
  });
});

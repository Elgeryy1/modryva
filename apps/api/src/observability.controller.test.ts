import { ServiceUnavailableException } from "@nestjs/common";
import { afterEach, describe, expect, it } from "vitest";
import { ObservabilityController } from "./observability.controller.js";

/** Base de datos que responde. `$queryRaw` se invoca como plantilla etiquetada. */
const okDatabase = { $queryRaw: async () => [{ "?column?": 1 }] };
/** Base de datos caída: rechaza la conexión. */
const downDatabase = {
  $queryRaw: async () => {
    throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
  },
};
/** Base de datos colgada: acepta pero nunca responde. El caso más peligroso. */
const hungDatabase = { $queryRaw: () => new Promise<never>(() => {}) };

// El cast es al tipo estructural mínimo que el controlador declara
// (`Pick<PrismaClient, "$queryRaw">`), no a un PrismaClient completo.
const make = (db: { $queryRaw: (...args: never[]) => Promise<unknown> }) =>
  new ObservabilityController(db as never);

afterEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.APP_BUILD_SHA;
  delete process.env.APP_BUILD_TIME;
});

describe("ObservabilityController", () => {
  it("reports liveness", () => {
    expect(make(okDatabase).live()).toEqual({ ok: true, status: "alive" });
  });

  describe("health/ready", () => {
    it("is ready when the database answers and config is present", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "token";
      const report = await make(okDatabase).ready();
      expect(report.ready).toBe(true);
      expect(report.probes[0]?.name).toBe("database");
      expect(report.probes[0]?.ok).toBe(true);
    });

    // La regresión que motivó la Fase 1.4: antes esto devolvía `ready: true` y un
    // 200 porque sólo miraba que DATABASE_URL no estuviera vacía.
    it("is NOT ready when the database is down, even with the URL set", async () => {
      process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";
      process.env.TELEGRAM_BOT_TOKEN = "token";
      await expect(make(downDatabase).ready()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it("answers 503 rather than a 200 carrying ready:false", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "token";
      const error = await make(downDatabase)
        .ready()
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getStatus()).toBe(503);
    });

    it("includes the failing probe in the 503 body so the cause is visible", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "token";
      const error = (await make(downDatabase)
        .ready()
        .catch((e: unknown) => e)) as ServiceUnavailableException;
      const body = error.getResponse() as {
        ready: boolean;
        probes: { name: string; ok: boolean; error?: string }[];
      };
      expect(body.ready).toBe(false);
      expect(body.probes[0]?.name).toBe("database");
      expect(body.probes[0]?.error).toContain("ECONNREFUSED");
    });

    // Una base colgada es peor que una caída: no rechaza, nunca responde. El
    // endpoint debe dar veredicto igualmente en vez de colgarse con ella.
    it("does not hang when the database hangs", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "token";
      const started = Date.now();
      await expect(make(hungDatabase).ready()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(Date.now() - started).toBeLessThan(5_000);
    }, 10_000);

    it("is not ready when required config is missing", async () => {
      await expect(make(okDatabase).ready()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it("never leaks credentials from a driver error", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "token";
      const leaky = {
        $queryRaw: async () => {
          throw new Error(
            "auth failed for postgresql://superbot:s3cr3t@db:5432/superbot",
          );
        },
      };
      const error = (await make(leaky)
        .ready()
        .catch((e: unknown) => e)) as ServiceUnavailableException;
      expect(JSON.stringify(error.getResponse())).not.toContain("s3cr3t");
    });
  });

  it("exposes Prometheus metrics", () => {
    const text = make(okDatabase).metrics();
    expect(text).toContain("superbot_api_up 1");
    expect(text).toContain("superbot_api_uptime_seconds");
  });

  it("exposes build provenance, defaulting to unknown", () => {
    const info = make(okDatabase).buildInfo();
    expect(info.service).toBe("api");
    expect(info.sha).toBe("unknown");
    expect(info.builtAt).toBe("unknown");
    expect(info.node).toBe(process.version);
    expect(typeof info.uptimeSeconds).toBe("number");
  });

  it("reflects the injected build sha/time", () => {
    process.env.APP_BUILD_SHA = "abc1234";
    process.env.APP_BUILD_TIME = "2026-07-16T00:00:00Z";
    const info = make(okDatabase).buildInfo();
    expect(info.sha).toBe("abc1234");
    expect(info.builtAt).toBe("2026-07-16T00:00:00Z");
  });
});

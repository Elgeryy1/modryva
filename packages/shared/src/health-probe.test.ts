import { describe, expect, it } from "vitest";
import {
  allProbesHealthy,
  describeProbeError,
  redactConnectionStrings,
  runProbe,
} from "./health-probe.js";

describe("runProbe", () => {
  it("reports ok when the check resolves", async () => {
    const result = await runProbe("database", async () => [{ "?column?": 1 }]);
    expect(result.ok).toBe(true);
    expect(result.name).toBe("database");
    expect(result.error).toBeUndefined();
  });

  it("reports failure when the check rejects, without throwing", async () => {
    const result = await runProbe("database", async () => {
      throw new Error("connection refused");
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("connection refused");
  });

  // El caso que motivó todo esto: una dependencia colgada, no caída. No rechaza
  // la conexión, simplemente nunca responde. Sin límite de tiempo, el health
  // check se cuelga con ella y el orquestador nunca obtiene un veredicto.
  it("gives up on a hung dependency instead of hanging with it", async () => {
    const started = Date.now();
    const result = await runProbe("database", () => new Promise(() => {}), 25);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("timeout");
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("never rejects — a failing probe is a result, not an exception", async () => {
    await expect(
      runProbe("x", async () => {
        throw new Error("boom");
      }),
    ).resolves.toBeDefined();
    await expect(
      runProbe("y", () => Promise.reject(new Error("boom"))),
    ).resolves.toMatchObject({ ok: false });
  });

  it("handles a check that throws synchronously", async () => {
    const result = await runProbe("sync", () => {
      throw new Error("thrown before any await");
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("thrown before any await");
  });

  it("measures latency with the injected clock", async () => {
    const ticks = [1_000, 1_150];
    let i = 0;
    const now = () => ticks[i++] ?? 1_150;
    const result = await runProbe("database", async () => 1, 5_000, now);
    expect(result.latencyMs).toBe(150);
  });

  it("does not leave a pending timer on the happy path", async () => {
    // Sin el clearTimeout del finally, este test dejaría 50 timers vivos y el
    // proceso de vitest no terminaría. Que la suite acabe ES la aserción.
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, n) =>
        runProbe(`p${n}`, async () => n, 60_000),
      ),
    );
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("treats a resolved-undefined check as healthy", async () => {
    // `redis.ping()` puede resolver a undefined según el cliente: no responder
    // nada no es lo mismo que fallar.
    const result = await runProbe("redis", async () => undefined);
    expect(result.ok).toBe(true);
  });
});

describe("describeProbeError", () => {
  it("keeps only the first line", () => {
    expect(describeProbeError(new Error("primera\nsegunda\ntercera"))).toBe(
      "primera",
    );
  });

  it("caps the length so a huge driver dump cannot flood the response", () => {
    expect(describeProbeError(new Error("x".repeat(5_000))).length).toBe(200);
  });

  it("handles non-Error throwables", () => {
    expect(describeProbeError("plain string")).toBe("plain string");
    expect(describeProbeError(null)).toBe("null");
  });
});

describe("redactConnectionStrings", () => {
  // Los errores de conexión de Postgres suelen incluir la URL entera, con la
  // contraseña dentro, y este endpoint puede estar expuesto a un monitor externo.
  it("removes credentials from a postgres URL", () => {
    const out = redactConnectionStrings(
      "Can't reach postgresql://superbot:hunter2@db:5432/superbot",
    );
    expect(out).toBe("Can't reach postgresql://***@db:5432/superbot");
    expect(out).not.toContain("hunter2");
  });

  it("removes credentials from a redis URL", () => {
    expect(
      redactConnectionStrings("ECONNREFUSED redis://user:pw@cache:6379"),
    ).not.toContain("pw@");
  });

  it("redacts every occurrence, not just the first", () => {
    const out = redactConnectionStrings(
      "postgres://a:1@x/ replica postgres://b:2@y/",
    );
    expect(out).not.toContain("a:1@");
    expect(out).not.toContain("b:2@");
  });

  it("leaves URLs without credentials untouched", () => {
    expect(redactConnectionStrings("http://localhost:3001/health")).toBe(
      "http://localhost:3001/health",
    );
  });

  it("redacts credentials surfaced through describeProbeError", () => {
    const message = describeProbeError(
      new Error(
        "auth failed for postgresql://superbot:s3cr3t@db:5432/superbot",
      ),
    );
    expect(message).not.toContain("s3cr3t");
  });
});

describe("allProbesHealthy", () => {
  it("is true only when every probe passed", () => {
    expect(
      allProbesHealthy([
        { name: "a", ok: true, latencyMs: 1 },
        { name: "b", ok: true, latencyMs: 2 },
      ]),
    ).toBe(true);
  });

  it("is false when any probe failed", () => {
    expect(
      allProbesHealthy([
        { name: "a", ok: true, latencyMs: 1 },
        { name: "b", ok: false, latencyMs: 2, error: "down" },
      ]),
    ).toBe(false);
  });

  // Sin sondas no hay evidencia de salud. Devolver `true` aquí reproduciría
  // exactamente el bug original: afirmar que todo va bien sin haber mirado.
  it("is false when there are no probes at all", () => {
    expect(allProbesHealthy([])).toBe(false);
  });
});

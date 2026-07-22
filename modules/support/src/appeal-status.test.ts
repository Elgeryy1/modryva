import { describe, expect, it } from "vitest";
import {
  APPEAL_BAR_WIDTH,
  APPEAL_STATES,
  type AppealState,
  appealProgress,
  formatAppealStatus,
  isTerminalAppealState,
  nextAppealState,
  renderAppealBar,
} from "./appeal-status.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("APPEAL_STATES", () => {
  it("lista los cinco estados en orden de ciclo de vida", () => {
    expect(APPEAL_STATES).toEqual([
      "enviada",
      "en-revision",
      "mas-info",
      "aceptada",
      "rechazada",
    ]);
  });
});

describe("nextAppealState", () => {
  it("avanza enviada segun cada evento", () => {
    expect(nextAppealState("enviada", "assign")).toBe("en-revision");
    expect(nextAppealState("enviada", "request-info")).toBe("mas-info");
    expect(nextAppealState("enviada", "accept")).toBe("aceptada");
    expect(nextAppealState("enviada", "reject")).toBe("rechazada");
  });

  it("desde en-revision pide info o resuelve", () => {
    expect(nextAppealState("en-revision", "request-info")).toBe("mas-info");
    expect(nextAppealState("en-revision", "assign")).toBe("en-revision");
    expect(nextAppealState("en-revision", "accept")).toBe("aceptada");
    expect(nextAppealState("en-revision", "reject")).toBe("rechazada");
  });

  it("desde mas-info vuelve a revision al reasignar", () => {
    expect(nextAppealState("mas-info", "assign")).toBe("en-revision");
    expect(nextAppealState("mas-info", "request-info")).toBe("mas-info");
    expect(nextAppealState("mas-info", "accept")).toBe("aceptada");
    expect(nextAppealState("mas-info", "reject")).toBe("rechazada");
  });

  it("los estados finales son idempotentes ante cualquier evento", () => {
    const events = ["assign", "request-info", "accept", "reject"] as const;
    for (const event of events) {
      expect(nextAppealState("aceptada", event)).toBe("aceptada");
      expect(nextAppealState("rechazada", event)).toBe("rechazada");
    }
  });

  it("es determinista para entradas identicas", () => {
    expect(nextAppealState("enviada", "assign")).toBe(
      nextAppealState("enviada", "assign"),
    );
  });
});

describe("appealProgress", () => {
  it("devuelve valores en el rango 0..1 para todos los estados", () => {
    for (const state of APPEAL_STATES) {
      const p = appealProgress(state);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("los estados finales valen 1", () => {
    expect(appealProgress("aceptada")).toBe(1);
    expect(appealProgress("rechazada")).toBe(1);
  });

  it("mas-info tiene menos progreso que en-revision", () => {
    expect(appealProgress("mas-info")).toBeLessThan(
      appealProgress("en-revision"),
    );
    expect(appealProgress("enviada")).toBeLessThan(appealProgress("mas-info"));
  });
});

describe("isTerminalAppealState", () => {
  it("solo aceptada y rechazada son finales", () => {
    expect(isTerminalAppealState("aceptada")).toBe(true);
    expect(isTerminalAppealState("rechazada")).toBe(true);
    expect(isTerminalAppealState("enviada")).toBe(false);
    expect(isTerminalAppealState("en-revision")).toBe(false);
    expect(isTerminalAppealState("mas-info")).toBe(false);
  });
});

describe("renderAppealBar", () => {
  it("dibuja una barra vacia para 0 y llena para 1", () => {
    expect(renderAppealBar(0)).toBe(`[${"-".repeat(APPEAL_BAR_WIDTH)}]`);
    expect(renderAppealBar(1)).toBe(`[${"#".repeat(APPEAL_BAR_WIDTH)}]`);
  });

  it("reparte segmentos a la mitad", () => {
    expect(renderAppealBar(0.5)).toBe("[####----]");
  });

  it("recorta progresos fuera de rango", () => {
    expect(renderAppealBar(-2)).toBe(renderAppealBar(0));
    expect(renderAppealBar(5)).toBe(renderAppealBar(1));
  });

  it("mantiene el ancho total constante", () => {
    for (const p of [0, 0.15, 0.35, 0.5, 0.99, 1]) {
      const bar = renderAppealBar(p);
      expect(bar.length).toBe(APPEAL_BAR_WIDTH + 2);
    }
  });
});

describe("formatAppealStatus", () => {
  it("incluye emoji, etiqueta, barra, porcentaje y tiempo transcurrido", () => {
    expect(
      formatAppealStatus("en-revision", { createdMs: 0, nowMs: 2 * HOUR }),
    ).toBe("🔍 En revision [####----] 50% · hace 2h");
  });

  it("anade ETA cuando queda tiempo y el estado no es final", () => {
    expect(
      formatAppealStatus("en-revision", {
        createdMs: 0,
        nowMs: 2 * HOUR,
        etaMs: 3 * HOUR,
      }),
    ).toBe("🔍 En revision [####----] 50% · hace 2h · ETA 1h");
  });

  it("marca ETA vencida cuando el eta ya paso", () => {
    expect(
      formatAppealStatus("mas-info", {
        createdMs: 0,
        nowMs: 5 * HOUR,
        etaMs: 3 * HOUR,
      }),
    ).toBe("❓ Falta info [###-----] 35% · hace 5h · ETA vencida");
  });

  it("omite la ETA en estados finales aunque se pase etaMs", () => {
    const out = formatAppealStatus("aceptada", {
      createdMs: 0,
      nowMs: DAY + 4 * HOUR,
      etaMs: 10 * DAY,
    });
    expect(out).toBe("✅ Aceptada [########] 100% · hace 1d 4h");
    expect(out).not.toContain("ETA");
  });

  it("usa <1m para tiempos transcurridos muy cortos o negativos", () => {
    expect(
      formatAppealStatus("enviada", { createdMs: 1_000, nowMs: 30_000 }),
    ).toBe("📨 Enviada [#-------] 15% · hace <1m");
    expect(formatAppealStatus("enviada", { createdMs: 10_000, nowMs: 0 })).toBe(
      "📨 Enviada [#-------] 15% · hace <1m",
    );
  });

  it("es determinista para entradas identicas", () => {
    const ctx = { createdMs: 0, nowMs: HOUR + 30 * MINUTE, etaMs: 4 * HOUR };
    expect(formatAppealStatus("en-revision", ctx)).toBe(
      formatAppealStatus("en-revision", ctx),
    );
  });

  it("recorre todos los estados sin fallar", () => {
    for (const state of APPEAL_STATES as readonly AppealState[]) {
      const out = formatAppealStatus(state, { createdMs: 0, nowMs: HOUR });
      expect(out).toContain("hace");
    }
  });
});

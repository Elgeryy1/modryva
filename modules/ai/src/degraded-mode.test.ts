import { describe, expect, it } from "vitest";
import {
  DEGRADED_MODE_COOLDOWN_MS,
  DEGRADED_MODE_FAILURE_THRESHOLD,
  type DegradedState,
  decideDegradedMode,
  formatDegradedNotice,
} from "./degraded-mode.js";

const state = (overrides: Partial<DegradedState> = {}): DegradedState => ({
  consecutiveFailures: 0,
  lastFailureMs: 0,
  budgetExceeded: false,
  ...overrides,
});

const MINUTE = 60_000;

describe("decideDegradedMode", () => {
  it("no degrada con estado limpio", () => {
    expect(decideDegradedMode(state(), 1_000)).toEqual({
      degraded: false,
      reason: "ok",
      retryAtMs: null,
    });
  });

  it("degrada de inmediato cuando se agota el presupuesto sin reintento", () => {
    expect(decideDegradedMode(state({ budgetExceeded: true }), 1_000)).toEqual({
      degraded: true,
      reason: "budget-exceeded",
      retryAtMs: null,
    });
  });

  it("el presupuesto agotado tiene prioridad sobre los fallos", () => {
    const decision = decideDegradedMode(
      state({
        budgetExceeded: true,
        consecutiveFailures: 99,
        lastFailureMs: 0,
      }),
      1_000,
    );
    expect(decision.reason).toBe("budget-exceeded");
    expect(decision.retryAtMs).toBeNull();
  });

  it("no degrada por debajo del umbral de fallos", () => {
    const decision = decideDegradedMode(
      state({ consecutiveFailures: DEGRADED_MODE_FAILURE_THRESHOLD - 1 }),
      1_000,
    );
    expect(decision).toEqual({
      degraded: false,
      reason: "ok",
      retryAtMs: null,
    });
  });

  it("degrada al alcanzar el umbral y programa el reintento", () => {
    const lastFailureMs = 10 * MINUTE;
    const decision = decideDegradedMode(
      state({
        consecutiveFailures: DEGRADED_MODE_FAILURE_THRESHOLD,
        lastFailureMs,
      }),
      lastFailureMs + MINUTE,
    );
    expect(decision).toEqual({
      degraded: true,
      reason: "failure-threshold",
      retryAtMs: lastFailureMs + DEGRADED_MODE_COOLDOWN_MS,
    });
  });

  it("degrada por encima del umbral dentro del cooldown", () => {
    const lastFailureMs = 0;
    const decision = decideDegradedMode(
      state({ consecutiveFailures: 10, lastFailureMs }),
      DEGRADED_MODE_COOLDOWN_MS - 1,
    );
    expect(decision.degraded).toBe(true);
    expect(decision.reason).toBe("failure-threshold");
  });

  it("permite reintentar cuando el cooldown ya expiro", () => {
    const lastFailureMs = 0;
    const decision = decideDegradedMode(
      state({
        consecutiveFailures: DEGRADED_MODE_FAILURE_THRESHOLD,
        lastFailureMs,
      }),
      DEGRADED_MODE_COOLDOWN_MS,
    );
    expect(decision).toEqual({
      degraded: false,
      reason: "cooling-down",
      retryAtMs: DEGRADED_MODE_COOLDOWN_MS,
    });
  });

  it("respeta un failureThreshold personalizado", () => {
    const decision = decideDegradedMode(
      state({ consecutiveFailures: 2, lastFailureMs: 0 }),
      MINUTE,
      { failureThreshold: 2 },
    );
    expect(decision.degraded).toBe(true);
    expect(decision.reason).toBe("failure-threshold");
  });

  it("respeta un cooldownMs personalizado", () => {
    const decision = decideDegradedMode(
      state({ consecutiveFailures: 5, lastFailureMs: 0 }),
      MINUTE,
      { cooldownMs: 2 * MINUTE },
    );
    expect(decision.retryAtMs).toBe(2 * MINUTE);
    expect(decision.degraded).toBe(true);
  });

  it("cae a los valores por defecto ante opciones invalidas", () => {
    const decision = decideDegradedMode(
      state({
        consecutiveFailures: DEGRADED_MODE_FAILURE_THRESHOLD,
        lastFailureMs: 0,
      }),
      MINUTE,
      { failureThreshold: 0, cooldownMs: -5 },
    );
    expect(decision.degraded).toBe(true);
    expect(decision.retryAtMs).toBe(DEGRADED_MODE_COOLDOWN_MS);
  });

  it("trata recuentos negativos o no finitos como cero", () => {
    expect(
      decideDegradedMode(state({ consecutiveFailures: -3 }), 1_000).degraded,
    ).toBe(false);
    expect(
      decideDegradedMode(state({ consecutiveFailures: Number.NaN }), 1_000)
        .degraded,
    ).toBe(false);
  });

  it("usa nowMs como respaldo cuando lastFailureMs no es finito", () => {
    const decision = decideDegradedMode(
      state({
        consecutiveFailures: DEGRADED_MODE_FAILURE_THRESHOLD,
        lastFailureMs: Number.NaN,
      }),
      1_000,
    );
    expect(decision.retryAtMs).toBe(1_000 + DEGRADED_MODE_COOLDOWN_MS);
    expect(decision.degraded).toBe(true);
  });

  it("es determinista para entradas identicas", () => {
    const input = state({ consecutiveFailures: 4, lastFailureMs: 500 });
    expect(decideDegradedMode(input, 1_000)).toEqual(
      decideDegradedMode(input, 1_000),
    );
  });

  it("nunca lanza ante nowMs no finito", () => {
    expect(() =>
      decideDegradedMode(
        state({ consecutiveFailures: 9, lastFailureMs: 0 }),
        Number.NaN,
      ),
    ).not.toThrow();
    const decision = decideDegradedMode(
      state({ consecutiveFailures: 9, lastFailureMs: 0 }),
      Number.NaN,
    );
    expect(decision.degraded).toBe(true);
  });
});

describe("formatDegradedNotice", () => {
  it("formatea el aviso de presupuesto agotado", () => {
    expect(formatDegradedNotice("budget-exceeded")).toContain("presupuesto");
  });

  it("formatea el aviso de umbral de fallos", () => {
    expect(formatDegradedNotice("failure-threshold")).toContain("problemas");
  });

  it("formatea el aviso de recuperacion", () => {
    expect(formatDegradedNotice("cooling-down")).toContain("disponible");
  });

  it("formatea el aviso operativo", () => {
    expect(formatDegradedNotice("ok")).toContain("operativa");
  });

  it("cae a un mensaje generico ante un motivo desconocido", () => {
    expect(formatDegradedNotice("lo-que-sea")).toBe(
      "🚧 La IA no esta disponible ahora mismo. Intentalo mas tarde.",
    );
  });

  it("nunca lanza con entradas anomalas", () => {
    expect(() => formatDegradedNotice("")).not.toThrow();
  });
});

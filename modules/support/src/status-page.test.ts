import { describe, expect, it } from "vitest";
import {
  formatStatusPage,
  type Incident,
  openIncidentCount,
} from "./status-page.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const incident = (overrides: Partial<Incident> = {}): Incident => ({
  id: "inc-1",
  title: "Caida de pagos",
  status: "investigando",
  ms: 0,
  ...overrides,
});

describe("openIncidentCount", () => {
  it("returns 0 for an empty list", () => {
    expect(openIncidentCount([])).toBe(0);
  });

  it("counts investigando and identificado as open", () => {
    const incidents = [
      incident({ id: "a", status: "investigando" }),
      incident({ id: "b", status: "identificado" }),
    ];
    expect(openIncidentCount(incidents)).toBe(2);
  });

  it("does not count resuelto incidents", () => {
    const incidents = [
      incident({ id: "a", status: "investigando" }),
      incident({ id: "b", status: "resuelto" }),
      incident({ id: "c", status: "resuelto" }),
    ];
    expect(openIncidentCount(incidents)).toBe(1);
  });

  it("returns 0 when every incident is resolved", () => {
    const incidents = [
      incident({ id: "a", status: "resuelto" }),
      incident({ id: "b", status: "resuelto" }),
    ];
    expect(openIncidentCount(incidents)).toBe(0);
  });
});

describe("formatStatusPage", () => {
  it("shows an all-clear page with no incidents", () => {
    expect(formatStatusPage([], 10 * HOUR)).toBe(
      "📡 Estado del servicio\n\n✅ Todo funciona con normalidad.",
    );
  });

  it("lists a single open incident with status label and relative time", () => {
    const incidents = [incident({ status: "investigando", ms: 0 })];
    expect(formatStatusPage(incidents, 5 * MINUTE)).toBe(
      [
        "📡 Estado del servicio",
        "",
        "⚠️ Incidencias abiertas (1)",
        "🔴 Caida de pagos — Investigando (5m)",
      ].join("\n"),
    );
  });

  it("renders the identificado status with its own emoji and label", () => {
    const incidents = [
      incident({ title: "Latencia alta", status: "identificado", ms: 0 }),
    ];
    expect(formatStatusPage(incidents, 2 * HOUR)).toBe(
      [
        "📡 Estado del servicio",
        "",
        "⚠️ Incidencias abiertas (1)",
        "🟠 Latencia alta — Identificado (2h)",
      ].join("\n"),
    );
  });

  it("groups open incidents before resolved ones", () => {
    const incidents = [
      incident({ id: "a", title: "Bug login", status: "investigando", ms: 0 }),
      incident({ id: "b", title: "Cache", status: "resuelto", ms: 0 }),
    ];
    expect(formatStatusPage(incidents, 3 * DAY)).toBe(
      [
        "📡 Estado del servicio",
        "",
        "⚠️ Incidencias abiertas (1)",
        "🔴 Bug login — Investigando (3d)",
        "",
        "✔️ Resueltas (1)",
        "🟢 Cache — Resuelto (3d)",
      ].join("\n"),
    );
  });

  it("shows the no-open-incidents line when only resolved exist", () => {
    const incidents = [
      incident({ id: "a", title: "Cache", status: "resuelto", ms: 0 }),
    ];
    expect(formatStatusPage(incidents, HOUR)).toBe(
      [
        "📡 Estado del servicio",
        "",
        "✅ Sin incidencias abiertas.",
        "",
        "✔️ Resueltas (1)",
        "🟢 Cache — Resuelto (1h)",
      ].join("\n"),
    );
  });

  it("preserves input order within each group", () => {
    const incidents = [
      incident({ id: "a", title: "Uno", status: "investigando", ms: 0 }),
      incident({ id: "b", title: "Dos", status: "identificado", ms: 0 }),
    ];
    const page = formatStatusPage(incidents, MINUTE);
    const idxUno = page.indexOf("Uno");
    const idxDos = page.indexOf("Dos");
    expect(idxUno).toBeGreaterThanOrEqual(0);
    expect(idxDos).toBeGreaterThan(idxUno);
  });

  it("uses 'ahora' for sub-minute durations", () => {
    const incidents = [incident({ ms: 0 })];
    expect(formatStatusPage(incidents, 30_000)).toContain("(ahora)");
  });

  it("uses 'ahora' for negative durations (clock skew)", () => {
    const incidents = [incident({ ms: 10 * MINUTE })];
    expect(formatStatusPage(incidents, 0)).toContain("(ahora)");
  });

  it("formats minutes, hours and days as the largest whole unit", () => {
    expect(formatStatusPage([incident({ ms: 0 })], 45 * MINUTE)).toContain(
      "(45m)",
    );
    expect(formatStatusPage([incident({ ms: 0 })], 5 * HOUR)).toContain("(5h)");
    expect(formatStatusPage([incident({ ms: 0 })], 2 * DAY)).toContain("(2d)");
  });

  it("counts multiple open incidents in the heading", () => {
    const incidents = [
      incident({ id: "a", status: "investigando" }),
      incident({ id: "b", status: "identificado" }),
      incident({ id: "c", status: "resuelto" }),
    ];
    expect(formatStatusPage(incidents, HOUR)).toContain(
      "⚠️ Incidencias abiertas (2)",
    );
  });

  it("is deterministic for identical inputs", () => {
    const incidents = [
      incident({ id: "a", status: "investigando", ms: 1_000 }),
      incident({ id: "b", status: "resuelto", ms: 2_000 }),
    ];
    expect(formatStatusPage(incidents, 5 * HOUR)).toBe(
      formatStatusPage(incidents, 5 * HOUR),
    );
  });
});

import { describe, expect, it } from "vitest";
import { computeChangePanels } from "./change-panels.js";

describe("computeChangePanels", () => {
  it("classifies higher-is-better metrics by delta sign", () => {
    expect(
      computeChangePanels([
        {
          name: "Miembros activos",
          before: 100,
          after: 120,
          higherIsBetter: true,
        },
        {
          name: "Reportes de spam",
          before: 50,
          after: 80,
          higherIsBetter: false,
        },
      ]),
    ).toEqual({
      improved: ["Miembros activos"],
      worsened: ["Reportes de spam"],
    });
  });

  it("classifies lower-is-better metrics by inverted delta sign", () => {
    expect(
      computeChangePanels([
        {
          name: "Tiempo de respuesta",
          before: 30,
          after: 12,
          higherIsBetter: false,
        },
        {
          name: "Mensajes borrados",
          before: 5,
          after: 9,
          higherIsBetter: false,
        },
      ]),
    ).toEqual({
      improved: ["Tiempo de respuesta"],
      worsened: ["Mensajes borrados"],
    });
  });

  it("excludes ties from both panels", () => {
    expect(
      computeChangePanels([
        { name: "Baneos", before: 7, after: 7, higherIsBetter: false },
        {
          name: "Nuevos usuarios",
          before: 40,
          after: 40,
          higherIsBetter: true,
        },
      ]),
    ).toEqual({ improved: [], worsened: [] });
  });

  it("returns empty panels for an empty input", () => {
    expect(computeChangePanels([])).toEqual({ improved: [], worsened: [] });
  });

  it("preserves input order within each panel", () => {
    expect(
      computeChangePanels([
        { name: "A", before: 1, after: 2, higherIsBetter: true },
        { name: "B", before: 2, after: 1, higherIsBetter: true },
        { name: "C", before: 1, after: 3, higherIsBetter: true },
        { name: "D", before: 5, after: 2, higherIsBetter: true },
      ]),
    ).toEqual({ improved: ["A", "C"], worsened: ["B", "D"] });
  });

  it("handles negative values crossing zero", () => {
    expect(
      computeChangePanels([
        { name: "Balance", before: -10, after: 5, higherIsBetter: true },
        { name: "Deuda", before: -2, after: -8, higherIsBetter: true },
      ]),
    ).toEqual({ improved: ["Balance"], worsened: ["Deuda"] });
  });

  it("treats a lower-is-better decrease as an improvement", () => {
    expect(
      computeChangePanels([
        { name: "Latencia", before: 200, after: 150, higherIsBetter: false },
      ]),
    ).toEqual({ improved: ["Latencia"], worsened: [] });
  });

  it("is deterministic across repeated calls", () => {
    const metrics = [
      { name: "X", before: 3, after: 9, higherIsBetter: true },
      { name: "Y", before: 9, after: 3, higherIsBetter: true },
    ] as const;
    const first = computeChangePanels(metrics);
    const second = computeChangePanels(metrics);
    expect(first).toEqual(second);
    expect(first).toEqual({ improved: ["X"], worsened: ["Y"] });
  });

  it("supports fractional deltas", () => {
    expect(
      computeChangePanels([
        { name: "Ratio", before: 0.5, after: 0.75, higherIsBetter: true },
        { name: "Error", before: 0.2, after: 0.25, higherIsBetter: false },
      ]),
    ).toEqual({ improved: ["Ratio"], worsened: ["Error"] });
  });
});

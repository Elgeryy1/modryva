import { describe, expect, it } from "vitest";
import {
  type AdminLoad,
  computeStaffLoad,
  detectOverloadedStaff,
  rankStaffWorkload,
  STAFF_CONFLICT_WEIGHT,
} from "./staff-workload.js";

const load = (overrides: Partial<AdminLoad> = {}): AdminLoad => ({
  adminId: "a",
  actions: 0,
  conflicts: 0,
  ...overrides,
});

describe("computeStaffLoad", () => {
  it("suma acciones sin conflictos", () => {
    expect(computeStaffLoad(load({ actions: 5 }))).toBe(5);
  });

  it("pondera cada conflicto por STAFF_CONFLICT_WEIGHT", () => {
    expect(computeStaffLoad(load({ actions: 2, conflicts: 3 }))).toBe(
      2 + 3 * STAFF_CONFLICT_WEIGHT,
    );
  });

  it("trata acciones y conflictos negativos como 0", () => {
    expect(computeStaffLoad(load({ actions: -10, conflicts: -4 }))).toBe(0);
    expect(computeStaffLoad(load({ actions: -1, conflicts: 2 }))).toBe(
      2 * STAFF_CONFLICT_WEIGHT,
    );
  });

  it("es cero para un admin sin actividad", () => {
    expect(computeStaffLoad(load())).toBe(0);
  });
});

describe("rankStaffWorkload", () => {
  it("ordena de mayor a menor carga", () => {
    const result = rankStaffWorkload([
      load({ adminId: "low", actions: 1 }),
      load({ adminId: "high", actions: 10 }),
      load({ adminId: "mid", actions: 5 }),
    ]);
    expect(result).toEqual([
      { adminId: "high", load: 10 },
      { adminId: "mid", load: 5 },
      { adminId: "low", load: 1 },
    ]);
  });

  it("mantiene el orden de entrada en empates (estable)", () => {
    const result = rankStaffWorkload([
      load({ adminId: "a", actions: 3 }),
      load({ adminId: "b", actions: 3 }),
      load({ adminId: "c", actions: 3 }),
    ]);
    expect(result.map((entry) => entry.adminId)).toEqual(["a", "b", "c"]);
  });

  it("mezcla acciones y conflictos en la puntuacion", () => {
    const result = rankStaffWorkload([
      load({ adminId: "actor", actions: 8, conflicts: 0 }),
      load({ adminId: "fighter", actions: 2, conflicts: 3 }),
    ]);
    expect(result).toEqual([
      { adminId: "fighter", load: 2 + 3 * STAFF_CONFLICT_WEIGHT },
      { adminId: "actor", load: 8 },
    ]);
  });

  it("devuelve un array vacio para entrada vacia", () => {
    expect(rankStaffWorkload([])).toEqual([]);
  });

  it("no muta el array de entrada", () => {
    const input: readonly AdminLoad[] = [
      load({ adminId: "a", actions: 1 }),
      load({ adminId: "b", actions: 9 }),
    ];
    const snapshot = input.map((entry) => entry.adminId);
    rankStaffWorkload(input);
    expect(input.map((entry) => entry.adminId)).toEqual(snapshot);
  });

  it("es determinista para entradas identicas", () => {
    const input = [
      load({ adminId: "x", actions: 4, conflicts: 1 }),
      load({ adminId: "y", actions: 4, conflicts: 1 }),
    ];
    expect(rankStaffWorkload(input)).toEqual(rankStaffWorkload(input));
  });
});

describe("detectOverloadedStaff", () => {
  it("devuelve solo los admins por encima estricto del umbral", () => {
    const result = detectOverloadedStaff(
      [
        load({ adminId: "calm", actions: 3 }),
        load({ adminId: "busy", actions: 12 }),
        load({ adminId: "edge", actions: 10 }),
      ],
      10,
    );
    expect(result).toEqual(["busy"]);
  });

  it("conserva el orden de entrada", () => {
    const result = detectOverloadedStaff(
      [
        load({ adminId: "first", actions: 20 }),
        load({ adminId: "calm", actions: 1 }),
        load({ adminId: "second", actions: 15 }),
      ],
      5,
    );
    expect(result).toEqual(["first", "second"]);
  });

  it("no repite un adminId duplicado", () => {
    const result = detectOverloadedStaff(
      [
        load({ adminId: "dup", actions: 8 }),
        load({ adminId: "dup", actions: 9 }),
      ],
      5,
    );
    expect(result).toEqual(["dup"]);
  });

  it("cuenta conflictos ponderados para el umbral", () => {
    const result = detectOverloadedStaff(
      [load({ adminId: "conflictivo", actions: 0, conflicts: 4 })],
      10,
    );
    expect(result).toEqual(["conflictivo"]);
  });

  it("devuelve vacio cuando nadie supera el umbral", () => {
    const result = detectOverloadedStaff(
      [load({ adminId: "a", actions: 2 }), load({ adminId: "b", actions: 3 })],
      100,
    );
    expect(result).toEqual([]);
  });

  it("devuelve vacio para entrada vacia", () => {
    expect(detectOverloadedStaff([], 0)).toEqual([]);
  });

  it("con umbral 0 incluye a cualquiera con carga positiva", () => {
    const result = detectOverloadedStaff(
      [load({ adminId: "active", actions: 1 }), load({ adminId: "idle" })],
      0,
    );
    expect(result).toEqual(["active"]);
  });
});

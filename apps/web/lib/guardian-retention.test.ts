import { describe, expect, it } from "vitest";
import { formatearRetencion } from "./guardian-retention.js";

describe("decir cuánto se guarda la foto", () => {
  it("dice días cuando son días exactos", () => {
    // "3 días" se entiende de un vistazo; "72 horas" hay que dividirlo.
    expect(formatearRetencion(72)).toBe("3 días");
    expect(formatearRetencion(24)).toBe("1 día");
  });

  it("dice horas cuando no cuadran en días", () => {
    expect(formatearRetencion(48)).toBe("2 días");
    expect(formatearRetencion(36)).toBe("36 horas");
    expect(formatearRetencion(1)).toBe("1 hora");
  });

  it("calla en vez de decir una barbaridad", () => {
    // Un ajuste corrupto no puede acabar prometiendo "se borra en 0 horas":
    // una promesa absurda dicha con seguridad hace más daño que no decirla.
    expect(formatearRetencion(0)).toBeNull();
    expect(formatearRetencion(-5)).toBeNull();
    expect(formatearRetencion(Number.NaN)).toBeNull();
    expect(formatearRetencion(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

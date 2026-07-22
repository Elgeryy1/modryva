import { describe, expect, it } from "vitest";
import {
  buildInternalEvent,
  INTERNAL_EVENT_TYPES,
  type InternalEvent,
  isInternalEventType,
  serializeInternalEvent,
  signInternalEvent,
} from "./internal-events.js";

const event = (overrides: Partial<InternalEvent> = {}): InternalEvent => ({
  type: "user_joined",
  payload: { userId: 7 },
  ts: 1_000,
  ...overrides,
});

describe("INTERNAL_EVENT_TYPES", () => {
  it("expone el catalogo documentado en orden estable", () => {
    expect(INTERNAL_EVENT_TYPES).toEqual([
      "user_joined",
      "case_created",
      "rule_triggered",
      "sanction_applied",
      "appeal_opened",
      "member_left",
    ]);
  });

  it("no tiene tipos duplicados", () => {
    expect(new Set(INTERNAL_EVENT_TYPES).size).toBe(
      INTERNAL_EVENT_TYPES.length,
    );
  });
});

describe("isInternalEventType", () => {
  it("acepta todos los tipos del catalogo", () => {
    for (const type of INTERNAL_EVENT_TYPES) {
      expect(isInternalEventType(type)).toBe(true);
    }
  });

  it("rechaza tipos desconocidos y cadenas vacias", () => {
    expect(isInternalEventType("nope")).toBe(false);
    expect(isInternalEventType("")).toBe(false);
    expect(isInternalEventType("USER_JOINED")).toBe(false);
  });
});

describe("buildInternalEvent", () => {
  it("construye un evento valido con payload y ts", () => {
    const result = buildInternalEvent("case_created", { caseId: 42 }, 5);
    expect(result).toEqual({
      ok: true,
      event: { type: "case_created", payload: { caseId: 42 }, ts: 5 },
    });
  });

  it("acepta ts igual a cero", () => {
    const result = buildInternalEvent("member_left", {}, 0);
    expect(result.ok).toBe(true);
  });

  it("copia el payload para no compartir la referencia mutable", () => {
    const payload: Record<string, unknown> = { a: 1 };
    const result = buildInternalEvent("rule_triggered", payload, 1);
    if (!result.ok) {
      throw new Error("esperaba ok:true");
    }
    payload.a = 999;
    expect(result.event.payload).toEqual({ a: 1 });
  });

  it("falla con unknown-type para un tipo fuera del catalogo", () => {
    const result = buildInternalEvent("boom", {}, 1);
    expect(result).toEqual({
      ok: false,
      error: {
        code: "unknown-type",
        message: "Tipo de evento desconocido: boom",
      },
    });
  });

  it("falla con invalid-timestamp para ts negativo", () => {
    const result = buildInternalEvent("user_joined", {}, -1);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("esperaba ok:false");
    }
    expect(result.error.code).toBe("invalid-timestamp");
  });

  it("falla con invalid-timestamp para ts no entero o no finito", () => {
    expect(buildInternalEvent("user_joined", {}, 1.5).ok).toBe(false);
    expect(buildInternalEvent("user_joined", {}, Number.NaN).ok).toBe(false);
    expect(
      buildInternalEvent("user_joined", {}, Number.POSITIVE_INFINITY).ok,
    ).toBe(false);
  });
});

describe("serializeInternalEvent", () => {
  it("ordena las claves de nivel superior de forma estable", () => {
    expect(serializeInternalEvent(event({ payload: {}, ts: 1 }))).toBe(
      '{"payload":{},"ts":1,"type":"user_joined"}',
    );
  });

  it("ordena tambien las claves anidadas del payload", () => {
    const serialized = serializeInternalEvent(
      event({ payload: { zeta: 1, alpha: 2 }, ts: 3 }),
    );
    expect(serialized).toBe(
      '{"payload":{"alpha":2,"zeta":1},"ts":3,"type":"user_joined"}',
    );
  });

  it("produce la misma cadena para payloads equivalentes con distinto orden", () => {
    const a = serializeInternalEvent(event({ payload: { x: 1, y: 2 } }));
    const b = serializeInternalEvent(event({ payload: { y: 2, x: 1 } }));
    expect(a).toBe(b);
  });

  it("preserva el orden de los arrays", () => {
    const serialized = serializeInternalEvent(
      event({ payload: { list: [3, 1, 2] }, ts: 0 }),
    );
    expect(serialized).toBe(
      '{"payload":{"list":[3,1,2]},"ts":0,"type":"user_joined"}',
    );
  });

  it("es determinista para el mismo evento", () => {
    const e = event({ payload: { b: 1, a: 2 } });
    expect(serializeInternalEvent(e)).toBe(serializeInternalEvent(e));
  });
});

describe("signInternalEvent", () => {
  const fakeHasher = (data: string, secret: string): string =>
    `${secret}:${data.length}`;

  it("delega en el hasher inyectado y devuelve su resultado", () => {
    const serialized = serializeInternalEvent(event({ payload: {}, ts: 1 }));
    expect(signInternalEvent(serialized, "s3cr3t", fakeHasher)).toBe(
      `s3cr3t:${serialized.length}`,
    );
  });

  it("es determinista si el hasher lo es", () => {
    const serialized = serializeInternalEvent(event());
    expect(signInternalEvent(serialized, "k", fakeHasher)).toBe(
      signInternalEvent(serialized, "k", fakeHasher),
    );
  });

  it("cambia la firma cuando cambia el secreto", () => {
    const serialized = serializeInternalEvent(event());
    expect(signInternalEvent(serialized, "a", fakeHasher)).not.toBe(
      signInternalEvent(serialized, "bb", fakeHasher),
    );
  });

  it("no transforma la cadena antes de pasarla al hasher", () => {
    const seen: string[] = [];
    const spy = (data: string): string => {
      seen.push(data);
      return "ok";
    };
    signInternalEvent("payload-crudo", "secret", spy);
    expect(seen).toEqual(["payload-crudo"]);
  });
});

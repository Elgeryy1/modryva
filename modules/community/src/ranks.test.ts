import { describe, expect, it } from "vitest";
import {
  buildNoRankReply,
  buildRankAnnouncement,
  buildRankReply,
  isPromotion,
  RANKS,
  rankFor,
  rankOrder,
  titleSlotsLeft,
} from "./ranks.js";

describe("rankFor", () => {
  it("no da rango a quien acaba de llegar", () => {
    expect(rankFor({ messages: 0, ageDays: 0 })).toBeNull();
    expect(rankFor({ messages: 49, ageDays: 3 })).toBeNull();
  });

  it("exige mensajes Y días, no uno de los dos", () => {
    // Una tarde de spam no te hace VIP...
    expect(rankFor({ messages: 5000, ageDays: 1 })).toBeNull();
    // ...ni estar apuntado un año sin abrir la boca.
    expect(rankFor({ messages: 3, ageDays: 400 })).toBeNull();
  });

  it("da el rango justo al alcanzarlo", () => {
    expect(rankFor({ messages: 50, ageDays: 3 })?.key).toBe("vip");
    expect(rankFor({ messages: 150, ageDays: 7 })?.key).toBe("titan");
    expect(rankFor({ messages: 400, ageDays: 14 })?.key).toBe("veterano");
    expect(rankFor({ messages: 800, ageDays: 21 })?.key).toBe("leyenda");
  });

  it("da el MÁS ALTO que cumpla, no el primero", () => {
    // Alguien con actividad importada no sube escalón a escalón.
    expect(rankFor({ messages: 9000, ageDays: 300 })?.key).toBe("leyenda");
  });

  it("se queda en el escalón anterior si falta uno de los dos requisitos", () => {
    // Mensajes de Titán pero antigüedad de VIP.
    expect(rankFor({ messages: 900, ageDays: 5 })?.key).toBe("vip");
  });

  it("no existe el rango de moderador: ese se nombra a mano", () => {
    expect(RANKS.map((r) => r.key)).not.toContain("moderador");
    expect(RANKS).toHaveLength(4);
  });

  it("NINGUN rango lleva titulo visible: la insignia degradaba", () => {
    // Este test afirmaba lo contrario, y lo que afirmaba estaba roto en
    // produccion. Un titulo visible ES un titulo de administrador, y la unica
    // forma que habia de darlo era ascender con TODOS los permisos a false —
    // que en la Bot API no crea una insignia sin poder, es la forma documentada
    // de degradar.
    //
    // El 6 de agosto de 2026, `9000000009` fue nombrado moderador con /admin a
    // las 04:18 y el ascenso a Leyenda le dejo de miembro raso a las 19:00.
    // Nunca llego a tener titulo: setChatAdministratorCustomTitle corre despues
    // y falla, porque para entonces ya no es administrador.
    //
    // Volver a ponerlo a true SIN conceder antes algun permiso real vuelve a
    // costarle el cargo a quien lo tenga. No es un flag, es una decision.
    expect(RANKS.filter((r) => r.titled)).toEqual([]);
  });

  it("cada etiqueta cabe en un título de administrador (16 caracteres)", () => {
    for (const r of RANKS) {
      expect([...r.label].length).toBeLessThanOrEqual(16);
    }
  });
});

describe("isPromotion", () => {
  it("detecta la subida desde nada", () => {
    expect(isPromotion(null, RANKS[0] ?? null)).toBe(true);
  });

  it("detecta la subida entre rangos", () => {
    expect(isPromotion("vip", RANKS[1] ?? null)).toBe(true);
  });

  it("no considera ascenso quedarse igual", () => {
    expect(isPromotion("titan", RANKS[1] ?? null)).toBe(false);
  });

  it("nunca baja a nadie", () => {
    // El mérito ya estaba hecho; irse de vacaciones no lo borra.
    expect(isPromotion("leyenda", RANKS[0] ?? null)).toBe(false);
    expect(isPromotion("vip", null)).toBe(false);
  });
});

describe("rankOrder", () => {
  it("ordena de menor a mayor", () => {
    expect(rankOrder("vip")).toBeLessThan(rankOrder("titan"));
    expect(rankOrder("titan")).toBeLessThan(rankOrder("veterano"));
    expect(rankOrder("veterano")).toBeLessThan(rankOrder("leyenda"));
  });

  it("sin rango va por debajo de todo", () => {
    expect(rankOrder(null)).toBe(-1);
  });
});

describe("mensajes", () => {
  it("el anuncio nombra a la persona y el rango", () => {
    const t = buildRankAnnouncement("@ana", RANKS[0] as never);
    expect(t).toContain("@ana");
    expect(t).toContain("VIP");
  });

  it("/rango dice cuánto falta para el siguiente", () => {
    const t = buildRankReply(RANKS[0] as never, { messages: 100, ageDays: 5 });
    expect(t).toContain("Titán");
    expect(t).toContain("50 mensajes");
    expect(t).toContain("2 días");
  });

  it("/rango no promete un siguiente que no existe", () => {
    const t = buildRankReply(RANKS[3] as never, {
      messages: 9000,
      ageDays: 500,
    });
    expect(t).toContain("el rango más alto");
  });

  it("a quien no tiene rango le dice qué le falta", () => {
    const t = buildNoRankReply({ messages: 40, ageDays: 1 });
    expect(t).toContain("10 mensajes");
    expect(t).toContain("2 días");
  });

  it("no pide lo que ya tiene", () => {
    const t = buildNoRankReply({ messages: 500, ageDays: 1 });
    expect(t).not.toContain("mensajes");
    expect(t).toContain("2 días");
  });
});

describe("titleSlotsLeft", () => {
  it("deja un colchón para nombrar moderadores de verdad", () => {
    // 50 - 10 de reserva - 6 admins actuales.
    expect(titleSlotsLeft(6)).toBe(34);
  });

  it("nunca devuelve negativo", () => {
    expect(titleSlotsLeft(48)).toBe(0);
    expect(titleSlotsLeft(200)).toBe(0);
  });
});

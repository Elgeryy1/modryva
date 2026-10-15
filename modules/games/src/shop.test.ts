import { describe, expect, it } from "vitest";
import {
  availableItems,
  defaultShopSettings,
  ESCUDO_PCT,
  extendedExpiry,
  formatRemaining,
  isShopItemId,
  isUsable,
  NAVAJA_PCT,
  noStealEffects,
  type OwnedItem,
  parseShopSettings,
  priceOf,
  quotePurchase,
  SHOP_BY_ID,
  SHOP_CATALOG,
  type ShopItemId,
  type ShopSettings,
  spentDefenceOf,
  stealEffectsOf,
  usableItems,
} from "./shop.js";

const AHORA = 1_000_000_000_000;
const HORA_MS = 3_600_000;

const ajustes = (over: Partial<ShopSettings> = {}): ShopSettings => ({
  ...defaultShopSettings,
  enabled: true,
  ...over,
});

const guardado = (over: Partial<OwnedItem> = {}): OwnedItem => ({
  itemId: "escudo",
  uses: 1,
  ...over,
});

describe("catalogo", () => {
  it("no tiene ids repetidos", () => {
    expect(SHOP_BY_ID.size).toBe(SHOP_CATALOG.length);
  });

  it("todo lo que se vende tiene precio, salvo lo que lo calcula", () => {
    for (const item of SHOP_CATALOG) {
      if (item.precioDinamico) {
        continue;
      }
      expect(item.precio, `${item.id} sin precio`).toBeGreaterThan(0);
    }
  });

  it("lo que se dispara contra alguien es solo el castigo", () => {
    // Si un objeto nuevo pide objetivo y no es de castigo, hay que pensarselo
    // dos veces: es poder sobre otra persona, y ese es el bloque que un admin
    // apaga entero cuando se le va de las manos.
    for (const item of SHOP_CATALOG.filter((i) => i.contraAlguien)) {
      expect(item.familia, `${item.id} apunta a alguien`).toBe("castigo");
    }
  });

  it("reconoce los ids del catalogo y rechaza lo demas", () => {
    expect(isShopItemId("navaja")).toBe(true);
    expect(isShopItemId("navajita")).toBe(false);
    expect(isShopItemId(7)).toBe(false);
    expect(isShopItemId(null)).toBe(false);
  });
});

describe("parseShopSettings", () => {
  it("cae entero a los defaults con basura", () => {
    expect(parseShopSettings(null)).toEqual(defaultShopSettings);
    expect(parseShopSettings("navaja")).toEqual(defaultShopSettings);
  });

  it("nace apagada aunque vengan precios", () => {
    expect(parseShopSettings({ precios: { navaja: 10 } }).enabled).toBe(false);
  });

  it("se queda solo con los precios de ids que existen", () => {
    const { precios } = parseShopSettings({
      precios: { navaja: 400, inventado: 10 },
    });
    expect(precios).toEqual({ navaja: 400 });
  });

  it("descarta un precio de 0, que casi siempre es un campo vacio", () => {
    // Aceptarlo regalaria el objeto, y en una mordaza eso es justo el fallo que
    // no se puede permitir.
    expect(parseShopSettings({ precios: { mute10: 0 } }).precios).toEqual({});
    expect(parseShopSettings({ precios: { mute10: -5 } }).precios).toEqual({});
    expect(parseShopSettings({ precios: { mute10: 1.5 } }).precios).toEqual({});
  });

  it("se queda solo con los exentos que parecen ids de Telegram", () => {
    const { exentosMute } = parseShopSettings({
      exentosMute: ["123", "@pepe", "", -7, "-1001234567890"],
    });
    expect(exentosMute).toEqual(["123", "-1001234567890"]);
  });

  it("acepta un 0 en las esperas, que significa sin espera", () => {
    const s = parseShopSettings({
      muteVictimCooldownSeconds: 0,
      muteGraceSeconds: 0,
    });
    expect(s.muteVictimCooldownSeconds).toBe(0);
    expect(s.muteGraceSeconds).toBe(0);
  });
});

describe("precios y disponibilidad", () => {
  it("el precio del grupo pisa al del catalogo", () => {
    const navaja = SHOP_BY_ID.get("navaja");
    if (!navaja) {
      throw new Error("catalogo sin navaja");
    }
    // Contra el precio del catálogo y no contra un número escrito aquí: los
    // precios son una decisión de producto y se retocan; lo que este test fija
    // es que sin override manda el catálogo y con override manda el grupo.
    expect(priceOf(navaja, ajustes())).toBe(navaja.precio);
    expect(priceOf(navaja, ajustes({ precios: { navaja: 999 } }))).toBe(999);
  });

  it("lo apagado no sale en la tienda", () => {
    const visibles = availableItems(ajustes({ apagados: ["mute10", "mote"] }));
    const ids = visibles.map((i) => i.id);
    expect(ids).not.toContain("mute10");
    expect(ids).not.toContain("mote");
    expect(ids).toContain("navaja");
  });
});

describe("quotePurchase", () => {
  it("no vende nada con la tienda apagada", () => {
    const q = quotePurchase({
      settings: ajustes({ enabled: false }),
      itemId: "navaja",
      balance: 10_000,
    });
    expect(q).toEqual({ ok: false, refusal: "disabled", precio: 0 });
  });

  it("rechaza un objeto que no existe", () => {
    const q = quotePurchase({
      settings: ajustes(),
      itemId: "bazooka",
      balance: 10_000,
    });
    expect(q.refusal).toBe("unknown-item");
  });

  it("rechaza un objeto que el grupo ha apagado", () => {
    const q = quotePurchase({
      settings: ajustes({ apagados: ["navaja"] }),
      itemId: "navaja",
      balance: 10_000,
    });
    expect(q.refusal).toBe("item-off");
  });

  it("dice cuanto cuesta aunque no llegue el saldo", () => {
    // El precio viaja en el rechazo justo para poder decir "te faltan 200" en
    // vez de un "no ha podido ser" que no ayuda a nadie.
    const q = quotePurchase({
      settings: ajustes({ precios: { navaja: 300 } }),
      itemId: "navaja",
      balance: 100,
    });
    expect(q.ok).toBe(false);
    expect(q.refusal).toBe("insufficient");
    expect(q.precio).toBe(300);
  });

  it("una mordaza sin objetivo no se cobra", () => {
    const q = quotePurchase({
      settings: ajustes(),
      itemId: "mute1",
      balance: 100_000,
    });
    expect(q.refusal).toBe("needs-target");
  });

  it("un mote sin texto no se cobra", () => {
    const q = quotePurchase({
      settings: ajustes(),
      itemId: "mote",
      balance: 100_000,
    });
    expect(q.refusal).toBe("needs-payload");
    expect(
      quotePurchase({
        settings: ajustes(),
        itemId: "mote",
        balance: 100_000,
        payload: "   ",
      }).refusal,
    ).toBe("needs-payload");
  });

  it("la fianza no se compra por aqui: su precio sale de la mordaza", () => {
    const q = quotePurchase({
      settings: ajustes(),
      itemId: "fianza",
      balance: 100_000,
    });
    expect(q.refusal).toBe("dynamic-price");
  });

  it("deja pasar la compra con el precio del grupo", () => {
    const q = quotePurchase({
      settings: ajustes({ precios: { navaja: 120 } }),
      itemId: "navaja",
      balance: 200,
    });
    expect(q.ok).toBe(true);
    expect(q.precio).toBe(120);
    expect(q.item?.id).toBe("navaja");
  });
});

describe("inventario", () => {
  it("un consumible sin caducidad sirve siempre", () => {
    expect(isUsable(guardado({ itemId: "navaja" }), AHORA)).toBe(true);
  });

  it("sin usos no sirve", () => {
    expect(isUsable(guardado({ uses: 0 }), AHORA)).toBe(false);
  });

  it("caducado no sirve", () => {
    expect(isUsable(guardado({ expiresAtMs: AHORA - 1 }), AHORA)).toBe(false);
    expect(isUsable(guardado({ expiresAtMs: AHORA + 1 }), AHORA)).toBe(true);
  });

  it("filtra lo que ya no vale", () => {
    const todo: OwnedItem[] = [
      guardado({ itemId: "navaja" }),
      guardado({ itemId: "escudo", expiresAtMs: AHORA - 1 }),
      guardado({ itemId: "saco", uses: 0 }),
    ];
    expect(usableItems(todo, AHORA).map((o) => o.itemId)).toEqual(["navaja"]);
  });
});

describe("extendedExpiry", () => {
  const escudo = SHOP_BY_ID.get("escudo");
  if (!escudo) {
    throw new Error("catalogo sin escudo");
  }

  it("un consumible no caduca", () => {
    const navaja = SHOP_BY_ID.get("navaja");
    if (!navaja) {
      throw new Error("catalogo sin navaja");
    }
    expect(extendedExpiry(navaja, AHORA)).toBeUndefined();
  });

  it("cuenta desde ahora si no habia nada", () => {
    expect(extendedExpiry(escudo, AHORA)).toBe(AHORA + 24 * HORA_MS);
  });

  it("alarga desde donde estaba, no desde ahora", () => {
    // Comprar el segundo teniendo el primero a medias no puede tirar lo que
    // queda: nadie entiende pagar por perder tiempo.
    const restante = AHORA + 3 * HORA_MS;
    expect(extendedExpiry(escudo, AHORA, restante)).toBe(
      restante + 24 * HORA_MS,
    );
  });

  it("cuenta desde ahora si el anterior ya caduco", () => {
    expect(extendedExpiry(escudo, AHORA, AHORA - 1)).toBe(AHORA + 24 * HORA_MS);
  });
});

describe("formatRemaining", () => {
  it("no promete tiempo que no queda", () => {
    expect(formatRemaining(0)).toBe("nada");
    expect(formatRemaining(-1)).toBe("nada");
    expect(formatRemaining(Number.NaN)).toBe("nada");
  });

  it("por debajo del minuto no da una cifra", () => {
    expect(formatRemaining(30_000)).toBe("menos de un minuto");
  });

  it("redondea hacia arriba dentro de cada unidad", () => {
    // 59 minutos y medio son "1 h": redondear hacia abajo daria "0 h", que no
    // es verdad de ninguna manera.
    expect(formatRemaining(90_000)).toBe("2 min");
    expect(formatRemaining(59.5 * 60_000)).toBe("1 h");
    expect(formatRemaining(23.5 * 3_600_000)).toBe("1 día");
  });

  it("usa una sola unidad", () => {
    expect(formatRemaining(24 * 3_600_000)).toBe("1 día");
    expect(formatRemaining(7 * 24 * 3_600_000)).toBe("7 días");
  });
});

describe("stealEffectsOf", () => {
  const efectos = (
    elegidos: readonly ShopItemId[],
    defensaVictima: readonly OwnedItem[] = [],
  ) => stealEffectsOf({ elegidos, defensaVictima, nowMs: AHORA });

  it("sin nada, no cambia nada", () => {
    // Contra `noStealEffects` y no contra un literal: asi, añadir un efecto
    // nuevo al catalogo no obliga a tocar este test, y sobre todo no se puede
    // añadir uno que por defecto venga encendido sin que salte.
    expect(efectos([])).toEqual(noStealEffects);
  });

  it("la navaja elegida suma sus puntos", () => {
    expect(efectos(["navaja"]).attackerBonusPct).toBe(NAVAJA_PCT);
  });

  it("el escudo de la victima resta sin que ella elija nada", () => {
    // Lo defensivo se aplica solo: nadie sabe cuando le van a robar.
    expect(efectos([], [guardado({ itemId: "escudo" })]).victimGuardPct).toBe(
      ESCUDO_PCT,
    );
  });

  it("un escudo caducado no defiende", () => {
    const caducado = guardado({ itemId: "escudo", expiresAtMs: AHORA - 1 });
    expect(efectos([], [caducado]).victimGuardPct).toBe(0);
  });

  it("navaja contra escudo se anulan", () => {
    const e = efectos(["navaja"], [guardado({ itemId: "escudo" })]);
    expect(e.attackerBonusPct - e.victimGuardPct).toBe(0);
  });

  it("cada ofensivo levanta lo suyo y nada mas", () => {
    expect(efectos(["ganzua"]).ignoreVictimShield).toBe(true);
    expect(efectos(["ganzua"]).ignoreCooldown).toBe(false);
    expect(efectos(["cafe"]).ignoreCooldown).toBe(true);
    expect(efectos(["guante"]).skipFine).toBe(true);
    expect(efectos(["saco"]).lootMultiplier).toBe(2);
  });

  it("el espejo dobla la multa del que falla", () => {
    // Tiene que ser mayor que 1: la multa YA iba entera a la victima, asi que
    // un multiplicador de 1 seria vender algo que ya se tenia gratis.
    expect(efectos([], [guardado({ itemId: "espejo" })]).fineMultiplier).toBe(
      2,
    );
    expect(efectos([]).fineMultiplier).toBe(1);
  });

  it("el comodin hace intocable a la victima", () => {
    expect(efectos([], [guardado({ itemId: "comodin" })]).victimImmune).toBe(
      true,
    );
  });

  it("tener un ofensivo guardado no lo usa: hay que elegirlo", () => {
    // La navaja se gasta cuando se escribe, no en el primer robo que pilla.
    // Gastarla sola en un golpe que iba a salir bien es robarle al dueño.
    const e = stealEffectsOf({
      elegidos: [],
      defensaVictima: [guardado({ itemId: "navaja" })],
      nowMs: AHORA,
    });
    expect(e.attackerBonusPct).toBe(0);
  });
});

describe("spentDefenceOf", () => {
  const gastado = (
    defensa: readonly OwnedItem[],
    desenlace: { success: boolean; blocked?: boolean },
  ) => spentDefenceOf({ defensaVictima: defensa, nowMs: AHORA, ...desenlace });

  it("el seguro se gasta cuando el robo sale bien", () => {
    const seguro = [guardado({ itemId: "seguro" })];
    expect(gastado(seguro, { success: true })).toEqual(["seguro"]);
    expect(gastado(seguro, { success: false })).toEqual([]);
  });

  it("el espejo se gasta cuando el robo falla", () => {
    const espejo = [guardado({ itemId: "espejo" })];
    expect(gastado(espejo, { success: false })).toEqual(["espejo"]);
    expect(gastado(espejo, { success: true })).toEqual([]);
  });

  it("el comodin se gasta solo cuando llega a parar el golpe", () => {
    const comodin = [guardado({ itemId: "comodin" })];
    expect(gastado(comodin, { success: false, blocked: true })).toEqual([
      "comodin",
    ]);
    expect(gastado(comodin, { success: false })).toEqual([]);
  });

  it("el escudo no se gasta nunca: dura lo que dura", () => {
    // Es exactamente lo que se compra. Gastarlo por golpe recibido lo
    // convertiria en un consumible de 500 monedas.
    const escudo = [guardado({ itemId: "escudo" })];
    expect(gastado(escudo, { success: true })).toEqual([]);
    expect(gastado(escudo, { success: false })).toEqual([]);
    expect(gastado(escudo, { success: false, blocked: true })).toEqual([]);
  });

  it("lo caducado no se gasta porque no ha hecho nada", () => {
    const viejo = [
      guardado({ itemId: "seguro", expiresAtMs: AHORA - 1, uses: 1 }),
    ];
    expect(gastado(viejo, { success: true })).toEqual([]);
  });
});

/**
 * La tienda del grupo: que se vende, cuanto cuesta y como se tiene.
 *
 * Es lo primero que SACA monedas de circulacion. Todo lo demas las mueve o las
 * crea: hablando se acuñan, la purga solo las cambia de bolsillo y el cambio con
 * el casino las aparca. Lo que se gasta aqui se quema, y esa es media razon de
 * que la tienda exista — la otra es que sin nada que comprar, tener saldo no
 * significa nada.
 *
 * Puro y determinista: sin reloj, sin azar y sin I/O. El "ahora" entra por
 * parametro donde hace falta. La persistencia va por `chat_settings` bajo
 * SHOP_SETTINGS_KEY (precios y que esta encendido) y por la tabla `user_items`
 * (que tiene cada uno).
 *
 * Regla que ordena todo el modulo: **lo ofensivo se elige, lo defensivo se
 * aplica solo**. La navaja se gasta cuando escribes `/robar @alguien navaja`,
 * porque gastarla sola en un golpe que ibas a ganar igual seria robarte a ti
 * mismo. El escudo salta sin preguntar, porque nadie elige cuando le roban.
 */

/**
 * Todo lo que se vende. Union cerrada y no `string`: el id viaja a la base de
 * datos, a los ajustes por grupo y a la Mini App, y un typo silencioso crearia
 * un objeto que se compra, se cobra y no hace nada.
 */
export type ShopItemId =
  // Ofensivos del robo
  | "navaja"
  | "ganzua"
  | "guante"
  | "saco"
  | "cafe"
  // Defensivos del robo
  | "escudo"
  | "seguro"
  | "espejo"
  | "comodin"
  // Economia
  | "doblon"
  | "caja"
  // Contra otra persona
  | "mute1"
  | "mute5"
  | "mute10"
  | "fianza"
  // Mascotas
  | "pelota"
  | "ovillo"
  | "cometa"
  // Vanidad
  | "mote"
  | "renombrar";

/**
 * Familias. Sirven para agrupar en la pantalla y, sobre todo, para que un admin
 * pueda apagar un bloque entero sin ir objeto por objeto: el dia que los mutes
 * se le vayan de las manos a un grupo, querra apagar "castigo" de un golpe.
 */
export type ShopFamily =
  | "ataque"
  | "defensa"
  | "economia"
  | "castigo"
  | "vanidad"
  | "mascotas";

/**
 * Como se tiene un objeto una vez comprado.
 *
 * - `consumible`: se gasta al usarse. Comprar otro suma usos.
 * - `temporal`: vale hasta una fecha. Comprar otro alarga desde donde estaba,
 *   no desde ahora — si no, comprar dos seguidos tiraria el primero a la basura.
 * - `instantaneo`: hace su efecto al comprarlo y no llega a entrar al
 *   inventario. Los mutes y la fianza son esto: no tiene sentido "tener" un
 *   mute guardado en un cajon.
 */
export type ShopItemHold =
  | { readonly kind: "consumible"; readonly usos: number }
  | { readonly kind: "temporal"; readonly segundos: number }
  | { readonly kind: "instantaneo" };

export interface ShopItem {
  readonly id: ShopItemId;
  readonly nombre: string;
  readonly icono: string;
  /** Una linea; es la que sale en la lista de la tienda. */
  readonly resumen: string;
  /** Precio por defecto. Cada grupo puede pisarlo. */
  readonly precio: number;
  readonly hold: ShopItemHold;
  readonly familia: ShopFamily;
  /** Se dispara contra otra persona, asi que la compra pide objetivo. */
  readonly contraAlguien: boolean;
  /**
   * El precio no sale del catalogo sino de la situacion. Hoy solo la fianza:
   * cuesta el doble de lo que le costo al que te silencio, y eso no se sabe
   * hasta que se mira quien te silencio y con que.
   */
  readonly precioDinamico?: true;
  /** Necesita un texto al comprarlo: el mote, el nombre nuevo de la moneda. */
  readonly pidePayload?: true;
}

const HORA = 3600;
const DIA = 24 * HORA;

/**
 * El catalogo.
 *
 * Los precios se anclan a lo que se GANA, no a lo que cuesta un robo. El techo
 * de hablar son 200 al dia, asi que el consumible mas barato es mas o menos una
 * semana de grupo para quien no roba, y un objeto es una meta y no un impulso.
 *
 * La primera tabla (2026-08-12) se calibro contra el botin de un golpe y
 * resulto ser calderilla: en una purga se sacan varios miles en cinco minutos,
 * asi que todo se compraba el primer dia. Esta es la segunda pasada, con el
 * propietario mirando los saldos reales.
 *
 * El cafe rompe la escala a proposito: es el unico objeto que convierte dinero
 * en TIEMPO —se salta la espera entre robos— y comprando varios la espera deja
 * de existir para quien tenga saldo. Mientras se pueda apilar, el precio es lo
 * unico que lo frena.
 *
 * Estos son los precios POR DEFECTO. Cada grupo puede pisarlos desde
 * `/settings` -> Economia y juegos, y ahi es donde se afina segun lo rapido que
 * se gane en esa comunidad.
 */
export const SHOP_CATALOG: readonly ShopItem[] = [
  {
    id: "navaja",
    nombre: "Navaja",
    icono: "🔪",
    resumen: "Un solo golpe con 25 puntos más de probabilidad.",
    precio: 2000,
    hold: { kind: "consumible", usos: 1 },
    familia: "ataque",
    contraAlguien: false,
  },
  {
    id: "ganzua",
    nombre: "Ganzúa",
    icono: "🗝️",
    resumen: "Un golpe que se salta el escudo de la víctima.",
    precio: 1800,
    hold: { kind: "consumible", usos: 1 },
    familia: "ataque",
    contraAlguien: false,
  },
  {
    id: "guante",
    nombre: "Guante de terciopelo",
    icono: "🧤",
    resumen: "Si fallas el golpe, no pagas multa.",
    precio: 1500,
    hold: { kind: "consumible", usos: 1 },
    familia: "ataque",
    contraAlguien: false,
  },
  {
    id: "saco",
    nombre: "Saco",
    icono: "🎒",
    resumen: "Dobla lo que te llevas en un golpe.",
    precio: 2500,
    hold: { kind: "consumible", usos: 1 },
    familia: "ataque",
    contraAlguien: false,
  },
  {
    id: "cafe",
    nombre: "Café cargado",
    icono: "☕",
    resumen: "Te quita la espera para volver a robar, una vez.",
    precio: 2500,
    hold: { kind: "consumible", usos: 1 },
    familia: "ataque",
    contraAlguien: false,
  },
  {
    id: "escudo",
    nombre: "Escudo",
    icono: "🛡️",
    resumen: "24 h restando 25 puntos a quien te intente robar.",
    precio: 3500,
    hold: { kind: "temporal", segundos: DIA },
    familia: "defensa",
    contraAlguien: false,
  },
  {
    id: "seguro",
    nombre: "Seguro",
    icono: "📄",
    resumen: "El próximo robo que te entre, recuperas la mitad.",
    precio: 4000,
    hold: { kind: "consumible", usos: 1 },
    familia: "defensa",
    contraAlguien: false,
  },
  {
    id: "espejo",
    nombre: "Espejo",
    icono: "🪞",
    resumen: "Si alguien falla robándote, su multa es para ti.",
    precio: 3000,
    hold: { kind: "consumible", usos: 1 },
    familia: "defensa",
    contraAlguien: false,
  },
  {
    id: "comodin",
    nombre: "Comodín de purga",
    icono: "🃏",
    resumen: "Intocable durante la próxima purga.",
    // Muy por encima del resto de su familia, y no por capricho: es lo unico
    // que para la purga entera, o sea el objeto que anula el evento del dia.
    precio: 5000,
    hold: { kind: "consumible", usos: 1 },
    familia: "defensa",
    contraAlguien: false,
  },
  {
    id: "doblon",
    nombre: "Doblón",
    icono: "💰",
    resumen: "12 h ganando el doble por hablar.",
    precio: 5000,
    hold: { kind: "temporal", segundos: 12 * HORA },
    familia: "economia",
    contraAlguien: false,
  },
  {
    id: "caja",
    nombre: "Ampliar la caja fuerte",
    icono: "🔐",
    resumen: "+1.000 de tope en lo que puedes poner a salvo.",
    precio: 6000,
    hold: { kind: "instantaneo" },
    familia: "economia",
    contraAlguien: false,
  },
  {
    id: "mute1",
    nombre: "Mordaza de 1 minuto",
    icono: "🤐",
    resumen: "Silencia a alguien 1 minuto.",
    precio: 15000,
    hold: { kind: "instantaneo" },
    familia: "castigo",
    contraAlguien: true,
  },
  {
    id: "mute5",
    nombre: "Mordaza de 5 minutos",
    icono: "🤐",
    resumen: "Silencia a alguien 5 minutos.",
    precio: 50000,
    hold: { kind: "instantaneo" },
    familia: "castigo",
    contraAlguien: true,
  },
  {
    id: "mute10",
    nombre: "Mordaza de 10 minutos",
    icono: "🤐",
    resumen: "Silencia a alguien 10 minutos.",
    precio: 120000,
    hold: { kind: "instantaneo" },
    familia: "castigo",
    contraAlguien: true,
  },
  {
    id: "fianza",
    nombre: "Fianza",
    icono: "⚖️",
    resumen: "Sales de tu mordaza pagando el doble de lo que costó.",
    precio: 0,
    precioDinamico: true,
    hold: { kind: "instantaneo" },
    familia: "castigo",
    contraAlguien: false,
  },
  // Los juguetes de las mascotas. Suben el animo, que es lo unico que hasta
  // ahora SOLO bajaba: el dia se lleva 24 puntos y jugar gratis devuelve 15.
  //
  // Van con tope diario —lo aplica la mascota, no la tienda— para que el animo
  // siga midiendo el cuidado y no el saldo. Sin el, quien tiene millones
  // compraria la barra llena a diario sin mirar al bicho una sola vez.
  {
    id: "pelota",
    nombre: "Pelota",
    icono: "🎾",
    resumen: "Un rato de juego. +15 de ánimo para tu bicho.",
    precio: 300,
    hold: { kind: "instantaneo" },
    familia: "mascotas",
    contraAlguien: false,
  },
  {
    id: "ovillo",
    nombre: "Ovillo de lana",
    icono: "🧶",
    resumen: "Se pasa la tarde con él. +40 de ánimo.",
    precio: 700,
    hold: { kind: "instantaneo" },
    familia: "mascotas",
    contraAlguien: false,
  },
  {
    id: "cometa",
    nombre: "Cometa",
    icono: "🪁",
    resumen: "El mejor día de su vida. Le llena el ánimo entero.",
    precio: 1500,
    hold: { kind: "instantaneo" },
    familia: "mascotas",
    contraAlguien: false,
  },
  {
    id: "mote",
    nombre: "Mote",
    icono: "🏷️",
    resumen: "Una semana con tu apodo al lado del nombre en /ricos.",
    precio: 12000,
    hold: { kind: "temporal", segundos: 7 * DIA },
    familia: "vanidad",
    contraAlguien: false,
    pidePayload: true,
  },
  {
    id: "renombrar",
    nombre: "Rebautizar la moneda",
    icono: "🪧",
    resumen: "24 h con el nombre que tú le pongas a la moneda del grupo.",
    // Absurdamente caro porque le cambia el nombre a la moneda A TODO EL GRUPO.
    // Tiene que ser una gesta de la que se hable, no algo que se pueda hacer dos
    // veces en la misma tarde.
    precio: 150000,
    hold: { kind: "temporal", segundos: DIA },
    familia: "vanidad",
    contraAlguien: false,
    pidePayload: true,
  },
];

/** El catalogo indexado por id, que es como se consulta el 90% de las veces. */
export const SHOP_BY_ID: ReadonlyMap<ShopItemId, ShopItem> = new Map(
  SHOP_CATALOG.map((item) => [item.id, item]),
);

/** Si una cadena cualquiera es un id del catalogo. */
export const isShopItemId = (value: unknown): value is ShopItemId =>
  typeof value === "string" && SHOP_BY_ID.has(value as ShopItemId);

export interface ShopSettings {
  /** Apagada hasta que un admin la enciende, como el resto del repo. */
  readonly enabled: boolean;
  /** Precios que pisan al del catalogo, por id. */
  readonly precios: Readonly<Partial<Record<ShopItemId, number>>>;
  /** Objetos que este grupo no vende. */
  readonly apagados: readonly ShopItemId[];
  /**
   * Ids de Telegram a los que no se les puede comprar una mordaza.
   *
   * Existe ademas de la comprobacion de admin porque no son lo mismo: Telegram
   * ya rechaza silenciar a un administrador, pero mucha gente que modera de
   * hecho figura en el grupo como miembro normal, sin el cargo puesto. "El bot
   * me deja pagar por silenciar al que modera" es exactamente el estreno que no
   * se quiere.
   */
  readonly exentosMute: readonly string[];
  /** Espera entre dos mordazas compradas contra la MISMA persona. */
  readonly muteVictimCooldownSeconds: number;
  /**
   * Gracia al salir de una mordaza: durante estos segundos no te pueden comprar
   * otra.
   *
   * Sin esto, dos personas con saldo se turnan y una tercera no vuelve a hablar
   * en toda la tarde. Es el freno de la guerra de mordazas.
   */
  readonly muteGraceSeconds: number;
  /**
   * Lo que cabe en la caja fuerte sin haber comprado nada.
   *
   * Va aqui y no en los ajustes de la moneda porque lo que lo amplia es un
   * objeto de la tienda: los dos numeros que suman el tope real conviene que se
   * editen en la misma pantalla.
   */
  readonly vaultBase: number;
}

/** Lo que sube el tope de la caja fuerte cada vez que se amplia. */
export const VAULT_STEP = 1000;

/** Minutos que dura cada mordaza. Fuera del catalogo porque el motor los
 * necesita como numero, no como texto de escaparate. */
export const MUTE_MINUTES: Readonly<Record<string, number>> = {
  mute1: 1,
  mute5: 5,
  mute10: 10,
};

/** Los ids de mordaza, para preguntar por "la ultima que le cayo a alguien". */
export const MUTE_ITEM_IDS: readonly ShopItemId[] = [
  "mute1",
  "mute5",
  "mute10",
];

/**
 * El tope real de la caja fuerte de alguien: el basico del grupo mas lo que
 * haya ampliado.
 *
 * Se calcula al leer y no se guarda ya sumado a proposito: si un grupo cambia
 * su basico, el cambio tiene que alcanzar a todo el mundo, incluida la gente
 * que amplio hace un mes. Guardando el total, esa gente se quedaria con el
 * basico viejo dentro y nadie entenderia por que.
 */
export const vaultLimitOf = (
  settings: ShopSettings,
  comprado: number,
): number => Math.max(0, settings.vaultBase) + Math.max(0, comprado);

/**
 * El tope de la caja fuerte, con la excepcion de quien la tiene sin limite.
 *
 * `sinTope` sale de `ECONOMIA_CAJA_ILIMITADA_IDS`, una lista por entorno: los
 * ids de Telegram son datos personales y la regla del repo dice que no entran
 * en git, ademas de que asi se anade o se quita a alguien sin desplegar.
 *
 * **Solo levanta el limite de lo que CABE dentro.** No crea monedas, no cambia
 * el saldo y no toca nada para nadie mas: el efecto es que a esas personas no
 * se les puede robar lo que guarden.
 *
 * El "sin tope" es `MAX_SAFE_INTEGER` y no `Infinity` a proposito: el valor
 * viaja a la consulta como limite y un `Infinity` ahi no significa nada.
 */
export const topeDeCajaFuerte = (
  settings: ShopSettings,
  comprado: number,
  sinTope: boolean,
): number =>
  sinTope ? Number.MAX_SAFE_INTEGER : vaultLimitOf(settings, comprado);

export const defaultShopSettings: ShopSettings = {
  enabled: false,
  precios: {},
  apagados: [],
  exentosMute: [],
  muteVictimCooldownSeconds: 30 * 60,
  muteGraceSeconds: 5 * 60,
  // Mil monedas: lo que se repartio de arranque, y el doble del botin maximo
  // de un golpe. Bastante para dormir tranquilo con los ahorros y poco para
  // sacar del juego todo lo que se gana.
  vaultBase: 1000,
};

/** Clave en el almacen de ajustes por chat. */
export const SHOP_SETTINGS_KEY = "group_shop";

const nonNegativeInt = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : fallback;

/**
 * Precios guardados, quedandose solo con lo que tiene sentido.
 *
 * Un precio de 0 se descarta en vez de aceptarse: en un campo numerico editado a
 * mano, el 0 casi siempre es "no he puesto nada", y aceptarlo significaria
 * regalar el objeto — que en el caso de las mordazas es justo el fallo que no se
 * puede permitir. Quien quiera regalar algo tiene `apagados` y el precio del
 * catalogo, no un cero silencioso.
 */
const parsePrecios = (
  value: unknown,
): Readonly<Partial<Record<ShopItemId, number>>> => {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const salida: Partial<Record<ShopItemId, number>> = {};
  for (const [clave, precio] of Object.entries(value)) {
    if (
      isShopItemId(clave) &&
      typeof precio === "number" &&
      Number.isInteger(precio) &&
      precio > 0
    ) {
      salida[clave] = precio;
    }
  }
  return salida;
};

const parseIds = (value: unknown): readonly ShopItemId[] =>
  Array.isArray(value) ? value.filter(isShopItemId) : [];

/** Ids de Telegram tal y como se guardan: cadenas de digitos. */
const parseExentos = (value: unknown): readonly string[] =>
  Array.isArray(value)
    ? value.filter(
        (v): v is string => typeof v === "string" && /^-?\d{1,20}$/u.test(v),
      )
    : [];

/**
 * Lee los ajustes con red de seguridad: lo que falte o venga corrupto cae al
 * valor por defecto. Aqui el descuido no da un error visible, da una tienda que
 * vende mordazas a mitad de precio.
 */
export const parseShopSettings = (value: unknown): ShopSettings => {
  if (typeof value !== "object" || value === null) {
    return defaultShopSettings;
  }
  const raw = value as Record<string, unknown>;
  return {
    enabled: raw.enabled === true,
    precios: parsePrecios(raw.precios),
    apagados: parseIds(raw.apagados),
    exentosMute: parseExentos(raw.exentosMute),
    muteVictimCooldownSeconds: nonNegativeInt(
      raw.muteVictimCooldownSeconds,
      defaultShopSettings.muteVictimCooldownSeconds,
    ),
    muteGraceSeconds: nonNegativeInt(
      raw.muteGraceSeconds,
      defaultShopSettings.muteGraceSeconds,
    ),
    vaultBase: nonNegativeInt(raw.vaultBase, defaultShopSettings.vaultBase),
  };
};

/** Lo que cuesta un objeto en ESTE grupo. */
export const priceOf = (item: ShopItem, settings: ShopSettings): number =>
  settings.precios[item.id] ?? item.precio;

/** Lo que este grupo vende ahora mismo, en el orden del catalogo. */
export const availableItems = (settings: ShopSettings): readonly ShopItem[] => {
  const apagados = new Set(settings.apagados);
  return SHOP_CATALOG.filter((item) => !apagados.has(item.id));
};

/** Por que no se puede comprar. */
export type ShopRefusal =
  | "disabled"
  | "unknown-item"
  | "item-off"
  | "insufficient"
  | "needs-target"
  | "needs-payload"
  | "dynamic-price";

export interface ShopQuote {
  readonly ok: boolean;
  readonly refusal?: ShopRefusal;
  readonly item?: ShopItem;
  /** Lo que costaria, ya con el precio del grupo aplicado. */
  readonly precio: number;
}

/**
 * Decide si una compra puede seguir adelante, y por cuanto.
 *
 * No cobra: devuelve el precio y quien llama lo debita con la operacion atomica
 * del repositorio. Igual que en el robo, mezclar decision y efecto obligaria a
 * este fichero a saber de transacciones y a los tests a montar una base.
 *
 * El saldo se compara aqui ademas de en el `debit`, que tambien lo comprueba.
 * No es redundante para el usuario: sin esto el unico mensaje posible seria un
 * "no ha podido ser" generico, y lo util es "te faltan 200".
 */
export const quotePurchase = (input: {
  readonly settings: ShopSettings;
  readonly itemId: string;
  readonly balance: number;
  /** Si la compra trae objetivo, para los que se disparan contra alguien. */
  readonly tieneObjetivo?: boolean;
  /** Si la compra trae texto, para los que lo piden. */
  readonly payload?: string;
}): ShopQuote => {
  const { settings } = input;
  if (!settings.enabled) {
    return { ok: false, refusal: "disabled", precio: 0 };
  }
  if (!isShopItemId(input.itemId)) {
    return { ok: false, refusal: "unknown-item", precio: 0 };
  }
  const item = SHOP_BY_ID.get(input.itemId);
  if (!item) {
    return { ok: false, refusal: "unknown-item", precio: 0 };
  }
  if (settings.apagados.includes(item.id)) {
    return { ok: false, refusal: "item-off", item, precio: 0 };
  }
  // La fianza no se compra desde la tienda: su precio sale de la mordaza que
  // te comiste, asi que tiene su propio camino y aqui solo se rechaza.
  if (item.precioDinamico) {
    return { ok: false, refusal: "dynamic-price", item, precio: 0 };
  }
  if (item.contraAlguien && input.tieneObjetivo !== true) {
    return { ok: false, refusal: "needs-target", item, precio: 0 };
  }
  if (
    item.pidePayload &&
    (typeof input.payload !== "string" || input.payload.trim().length === 0)
  ) {
    return { ok: false, refusal: "needs-payload", item, precio: 0 };
  }
  const precio = priceOf(item, settings);
  if (input.balance < precio) {
    return { ok: false, refusal: "insufficient", item, precio };
  }
  return { ok: true, item, precio };
};

/**
 * Lo que hay en el inventario de alguien, ya leido de la base.
 *
 * `expiresAtMs` a undefined significa "no caduca" (los consumibles), no
 * "caducado". Es la distincion que hace que un consumible no se evapore.
 *
 * Campos en ingles, a diferencia del resto del catalogo: este es el unico tipo
 * del modulo que cruza la frontera con `InventoryRepository`, y una fila de
 * aquel se pasa aqui tal cual. Traducir `uses` a `usos` en la frontera solo
 * añadiria un sitio donde equivocarse. `hold.usos` sigue en español porque eso
 * es vocabulario del catalogo y no sale de este fichero.
 */
export interface OwnedItem {
  readonly itemId: ShopItemId;
  readonly uses: number;
  readonly expiresAtMs?: number;
  readonly payload?: string;
}

/** Si un objeto del inventario sirve ahora mismo. */
export const isUsable = (owned: OwnedItem, nowMs: number): boolean => {
  if (owned.uses <= 0) {
    return false;
  }
  return owned.expiresAtMs === undefined || owned.expiresAtMs > nowMs;
};

/** Los que sirven ahora mismo, que es lo que se enseña en /inventario. */
export const usableItems = (
  owned: readonly OwnedItem[],
  nowMs: number,
): readonly OwnedItem[] => owned.filter((o) => isUsable(o, nowMs));

/**
 * Hasta cuando vale un objeto temporal despues de comprarlo.
 *
 * Se alarga desde donde estaba, no desde ahora: comprar un segundo escudo
 * teniendo uno a medias tiraria el resto del primero, y nadie entiende pagar
 * por perder tiempo. Si ya caduco (o no habia), cuenta desde ahora.
 */
export const extendedExpiry = (
  item: ShopItem,
  nowMs: number,
  actualMs?: number,
): number | undefined => {
  if (item.hold.kind !== "temporal") {
    return undefined;
  }
  const desde = actualMs !== undefined && actualMs > nowMs ? actualMs : nowMs;
  return desde + item.hold.segundos * 1000;
};

const MINUTO_MS = 60_000;
const HORA_MS = 60 * MINUTO_MS;
const DIA_MS = 24 * HORA_MS;

/**
 * Lo que le queda a un objeto temporal, para decirlo en un mensaje.
 *
 * Redondea hacia arriba, que es lo que espera quien lee: "te dura 1 h" con 59
 * minutos y medio es verdad, y "te dura 0 h" no lo es de ninguna manera. Solo
 * una unidad, sin "1 dia y 3 horas": es un mensaje de chat, no un cronometro.
 *
 * El redondeo se comprueba DESPUES de hacerlo y no antes, porque puede cruzar
 * la frontera de la unidad: 59 minutos y medio redondean a 60, y "60 min" es
 * cierto pero nadie lo dice asi.
 */
export const formatRemaining = (ms: number): string => {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "nada";
  }
  if (ms < MINUTO_MS) {
    return "menos de un minuto";
  }
  const minutos = Math.ceil(ms / MINUTO_MS);
  if (minutos < 60) {
    return `${minutos} min`;
  }
  const horas = Math.ceil(ms / HORA_MS);
  if (horas < 24) {
    return `${horas} h`;
  }
  const dias = Math.ceil(ms / DIA_MS);
  return dias === 1 ? "1 día" : `${dias} días`;
};

/**
 * Lo que los objetos le hacen a un robo.
 *
 * Existe para que `steal.ts` no tenga que saber que hay una tienda: el motor
 * sigue recibiendo numeros por parametro y este modulo es el que traduce "lleva
 * navaja" a "suma 25 puntos". Si la traduccion viviera dentro del motor, cada
 * objeto nuevo seria un `if` mas en la funcion que decide todos los robos del
 * bot.
 */
export interface StealItemEffects {
  /** Puntos porcentuales que se suman a la probabilidad del ladron. */
  readonly attackerBonusPct: number;
  /** Puntos porcentuales que la victima le resta al ladron. */
  readonly victimGuardPct: number;
  /** Se salta el escudo de la victima (el de `victimShieldSeconds`). */
  readonly ignoreVictimShield: boolean;
  /** Se salta la espera del ladron. */
  readonly ignoreCooldown: boolean;
  /** Fallar no cuesta multa. */
  readonly skipFine: boolean;
  /** Multiplica el botin y su tope. */
  readonly lootMultiplier: number;
  /** Multiplica la multa que paga quien falla. La cobra la victima. */
  readonly fineMultiplier: number;
  /** La victima es intocable en esta purga. */
  readonly victimImmune: boolean;
}

export const noStealEffects: StealItemEffects = {
  attackerBonusPct: 0,
  victimGuardPct: 0,
  ignoreVictimShield: false,
  ignoreCooldown: false,
  skipFine: false,
  lootMultiplier: 1,
  fineMultiplier: 1,
  victimImmune: false,
};

/** Cuanto suma la navaja y cuanto resta el escudo. Mismo numero a proposito:
 * navaja contra escudo se anulan, que es la lectura que espera cualquiera. */
export const NAVAJA_PCT = 25;
export const ESCUDO_PCT = 25;
/** Lo que multiplica el saco al botin. */
export const SACO_MULTIPLICADOR = 2;
/**
 * Lo que multiplica el espejo a la multa del que falla.
 *
 * Tiene que ser mayor que 1 o el objeto no haria nada: la multa del robo
 * fallido YA va entera a la victima desde que existe el robo. "Su multa es para
 * ti" describia el comportamiento por defecto, no un objeto — se vendia algo
 * que ya se tenia gratis.
 */
export const ESPEJO_MULTIPLICADOR = 2;
/** Lo que devuelve el seguro de lo robado, en tantos por ciento. */
export const SEGURO_PCT = 50;
/** Lo que multiplica el doblon a lo que se gana por mensaje. */
export const DOBLON_MULTIPLICADOR = 2;

/**
 * Traduce inventarios a modificadores.
 *
 * Los ofensivos entran por `elegidos` —lo que quien roba ha escrito en el
 * comando— y no por lo que tenga guardado. Los defensivos entran por lo que la
 * victima tiene y este usable, sin elegir nada, porque nadie sabe cuando le van
 * a robar.
 */
export const stealEffectsOf = (input: {
  /** Ofensivos que el ladron ha elegido usar en ESTE golpe. */
  readonly elegidos: readonly ShopItemId[];
  /** Todo lo que la victima tiene guardado. */
  readonly defensaVictima: readonly OwnedItem[];
  readonly nowMs: number;
}): StealItemEffects => {
  const elegidos = new Set(input.elegidos);
  const defensa = new Set(
    usableItems(input.defensaVictima, input.nowMs).map((o) => o.itemId),
  );
  return {
    attackerBonusPct: elegidos.has("navaja") ? NAVAJA_PCT : 0,
    victimGuardPct: defensa.has("escudo") ? ESCUDO_PCT : 0,
    ignoreVictimShield: elegidos.has("ganzua"),
    ignoreCooldown: elegidos.has("cafe"),
    skipFine: elegidos.has("guante"),
    lootMultiplier: elegidos.has("saco") ? SACO_MULTIPLICADOR : 1,
    fineMultiplier: defensa.has("espejo") ? ESPEJO_MULTIPLICADOR : 1,
    victimImmune: defensa.has("comodin"),
  };
};

/**
 * Los objetos defensivos que SE GASTAN con este desenlace.
 *
 * Separado de `stealEffectsOf` porque son dos preguntas distintas y se
 * responden en momentos distintos: que efecto tiene algo se sabe ANTES de tirar
 * el dado, y si se ha gastado solo se sabe DESPUES. Juntarlas obligaria a
 * decidir el gasto sin saber como acabo el golpe.
 *
 * El escudo no esta: dura 24 h y no se gasta por golpe recibido, que es
 * exactamente lo que se compra.
 */
export const spentDefenceOf = (input: {
  readonly defensaVictima: readonly OwnedItem[];
  readonly nowMs: number;
  /** Si el golpe salio bien para el ladron. */
  readonly success: boolean;
  /** Si el comodin llego a impedir el golpe. */
  readonly blocked?: boolean;
}): readonly ShopItemId[] => {
  const defensa = new Set(
    usableItems(input.defensaVictima, input.nowMs).map((o) => o.itemId),
  );
  if (input.blocked) {
    return defensa.has("comodin") ? ["comodin"] : [];
  }
  if (input.success) {
    return defensa.has("seguro") ? ["seguro"] : [];
  }
  return defensa.has("espejo") ? ["espejo"] : [];
};

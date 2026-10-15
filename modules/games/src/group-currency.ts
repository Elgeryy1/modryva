/**
 * La moneda del grupo: como se llama y como se gana.
 *
 * Cada comunidad le pone su nombre desde la Mini App —"pavos", "chapas", lo que
 * sea— y ese nombre sale en cada mensaje de economia. De ahi que sanear no sea
 * cosmetico: el texto lo escribe un admin y acaba dentro de mensajes con
 * `parseMode: "Markdown"`, asi que un asterisco suelto no "queda feo", parte el
 * formato de todos los mensajes del sistema.
 *
 * Logica pura: sin I/O, sin reloj, sin azar. La persistencia va por
 * `chat_settings` bajo GROUP_CURRENCY_SETTINGS_KEY.
 */

export interface GroupCurrencySettings {
  /** Inerte hasta que un admin la enciende, como el resto del repo. */
  readonly enabled: boolean;
  /** Nombre en plural: "monedas", "pavos", "chapas". */
  readonly nombre: string;
  /** Emoji o simbolo corto que acompaña a las cifras. */
  readonly simbolo: string;
  /** Cuanto se gana por mensaje que cuenta. */
  readonly porMensaje: number;
  /** Techo de lo que se puede ganar hablando en un dia. */
  readonly cupoDiario: number;
  /** Longitud minima para que un mensaje cuente. */
  readonly minCaracteres: number;
  /** Segundos entre dos ganancias de la misma persona. */
  readonly cooldownSegundos: number;
  /** Lo que se lleva quien gana una partida en el chat. 0 = sin premio. */
  readonly premioPartida: number;
  /**
   * Cuantas monedas del grupo cuesta UNA ficha del casino. 0 = no se pueden
   * comprar fichas con monedas.
   *
   * Lo pone cada grupo porque el ritmo al que se ganan monedas cambia mucho
   * entre comunidades: el mismo precio seria regalado en un grupo activo y
   * prohibitivo en uno tranquilo.
   */
  readonly monedasPorFicha: number;
  /**
   * Comision al VENDER fichas, en porcentaje.
   *
   * Las fichas son globales pero el precio lo pone cada grupo, asi que sin
   * diferencia entre comprar y vender alguien podria comprar barato en un grupo
   * y vender caro en otro sin parar. La comision se lleva ese margen.
   */
  readonly comisionVentaPct: number;
  /**
   * Nombre que alguien ha comprado en la tienda, y hasta cuando vale.
   *
   * Caduca al LEERSE y no con un trabajo programado: un job que no corra —o que
   * se pierda en un redespliegue— dejaria al grupo con un nombre de broma para
   * siempre, y nadie sabria de donde salio. Comprobandolo al leer, lo peor que
   * puede pasar es que vuelva a llamarse como siempre.
   *
   * Los dos campos van juntos o no van: un nombre sin fecha seria permanente.
   */
  readonly nombreTemporal?: string;
  readonly nombreTemporalHastaMs?: number;
}

export const defaultGroupCurrencySettings: GroupCurrencySettings = {
  enabled: false,
  nombre: "monedas",
  simbolo: "🪙",
  porMensaje: 1,
  // 200 al dia con 1 por mensaje son 200 mensajes: inalcanzable hablando normal,
  // y a la vez un techo que corta en seco al que automatiza.
  cupoDiario: 200,
  // "ok", "jaja" y "+1" no son participar. Cuatro caracteres dejan fuera lo mas
  // obvio sin castigar a quien contesta corto de verdad.
  minCaracteres: 4,
  cooldownSegundos: 60,
  // Bastante mas que un mensaje (1) para que ganar se note, y bastante menos
  // que un robo (hasta 500) para que jugar no sea la via rapida a hacerse rico.
  premioPartida: 25,
  // Apagado por defecto: mezclar las dos monedas es una decision del grupo, y
  // conviene que sea explicita.
  monedasPorFicha: 0,
  comisionVentaPct: 20,
};

/** Clave en el almacen de ajustes por chat. */
export const GROUP_CURRENCY_SETTINGS_KEY = "group_currency";

/** Tope de nombre. Va dentro de frases, no es un titulo. */
const MAX_NOMBRE = 20;
/** Tope de simbolo, contado en code points para no partir un emoji por la mitad. */
const MAX_SIMBOLO = 4;

/** Lo que Telegram interpreta como Markdown. */
const MARKDOWN: ReadonlySet<string> = new Set([
  "*",
  "_",
  "`",
  "[",
  "]",
  "~",
  "\\",
]);

/**
 * Un caracter de control C0 o DEL.
 *
 * Comprobado por code point y no con un rango en una expresion regular a
 * proposito: escrito como `[\x00-\x1f]` el rango acaba en el fuente como bytes
 * literales invisibles, que es imposible de revisar y facil de ampliar sin
 * querer hasta comerse espacios y parentesis.
 */
const esControl = (ch: string): boolean => {
  const cp = ch.codePointAt(0) ?? 0;
  return cp < 0x20 || cp === 0x7f;
};

/**
 * Deja un texto en condiciones de entrar en un mensaje con Markdown.
 *
 * Quita lo que Telegram interpreta y los caracteres de control, colapsa espacios
 * y recorta a `maxCodePoints`. Devuelve null si no queda nada util, para que
 * quien llama caiga al valor por defecto en vez de enseñar una cadena vacia.
 */
export const sanitizeCurrencyText = (
  value: unknown,
  maxCodePoints: number,
): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const limpio = [...value]
    // Markdown se borra; los controles se cambian por un espacio. Borrarlos
    // tambien parecia mas limpio y pegaba palabras: "pavos\nde oro" acababa en
    // "pavosde oro".
    .map((ch) => {
      if (MARKDOWN.has(ch)) {
        return "";
      }
      return esControl(ch) ? " " : ch;
    })
    .join("")
    .replace(/\s+/gu, " ")
    .trim();
  const recortado = [...limpio].slice(0, maxCodePoints).join("").trim();
  return recortado.length > 0 ? recortado : null;
};

const positiveInt = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;

/** Igual que positiveInt pero admitiendo el 0, que aqui significa "sin espera". */
const nonNegativeInt = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : fallback;

/**
 * Lee los ajustes guardados de forma defensiva: lo que falte o venga corrupto
 * cae al valor por defecto. Una fila editada a mano o un campo añadido en una
 * version posterior no pueden dejar la economia repartiendo con numeros basura.
 */
export const parseGroupCurrencySettings = (
  value: unknown,
): GroupCurrencySettings => {
  if (typeof value !== "object" || value === null) {
    return defaultGroupCurrencySettings;
  }
  const raw = value as Record<string, unknown>;
  return {
    enabled: raw.enabled === true,
    nombre:
      sanitizeCurrencyText(raw.nombre, MAX_NOMBRE) ??
      defaultGroupCurrencySettings.nombre,
    simbolo:
      sanitizeCurrencyText(raw.simbolo, MAX_SIMBOLO) ??
      defaultGroupCurrencySettings.simbolo,
    porMensaje: positiveInt(
      raw.porMensaje,
      defaultGroupCurrencySettings.porMensaje,
    ),
    cupoDiario: positiveInt(
      raw.cupoDiario,
      defaultGroupCurrencySettings.cupoDiario,
    ),
    minCaracteres: nonNegativeInt(
      raw.minCaracteres,
      defaultGroupCurrencySettings.minCaracteres,
    ),
    cooldownSegundos: nonNegativeInt(
      raw.cooldownSegundos,
      defaultGroupCurrencySettings.cooldownSegundos,
    ),
    premioPartida: nonNegativeInt(
      raw.premioPartida,
      defaultGroupCurrencySettings.premioPartida,
    ),
    monedasPorFicha: nonNegativeInt(
      raw.monedasPorFicha,
      defaultGroupCurrencySettings.monedasPorFicha,
    ),
    comisionVentaPct: nonNegativeInt(
      raw.comisionVentaPct,
      defaultGroupCurrencySettings.comisionVentaPct,
    ),
    // El nombre comprado se sanea igual que el de siempre: lo escribe cualquiera
    // del grupo, no un admin, asi que con mas razon.
    ...(sanitizeCurrencyText(raw.nombreTemporal, MAX_NOMBRE) !== null &&
    typeof raw.nombreTemporalHastaMs === "number" &&
    Number.isFinite(raw.nombreTemporalHastaMs)
      ? {
          nombreTemporal: sanitizeCurrencyText(
            raw.nombreTemporal,
            MAX_NOMBRE,
          ) as string,
          nombreTemporalHastaMs: raw.nombreTemporalHastaMs,
        }
      : {}),
  };
};

/**
 * Los ajustes tal y como se usan AHORA: con el nombre comprado puesto, si sigue
 * vigente.
 *
 * Funcion aparte de `parseGroupCurrencySettings` porque aquella es pura y no
 * tiene reloj, y este es justo el sitio donde hace falta uno. Todo lo que
 * enseñe la moneda tiene que pasar por aqui, o el grupo veria dos nombres a la
 * vez segun el comando.
 */
export const applyTemporaryName = (
  settings: GroupCurrencySettings,
  nowMs: number,
): GroupCurrencySettings => {
  if (
    settings.nombreTemporal === undefined ||
    settings.nombreTemporalHastaMs === undefined ||
    settings.nombreTemporalHastaMs <= nowMs
  ) {
    return settings;
  }
  return { ...settings, nombre: settings.nombreTemporal };
};

/**
 * Agrupa los miles con punto, al modo español.
 *
 * A mano y no con `toLocaleString("es-ES")` porque esa depende de los datos de
 * ICU que traiga el Node de turno: en un binario con ICU reducido devuelve
 * "1234" en vez de "1.234", asi que el mismo bot enseñaria una cifra distinta
 * segun la maquina donde corra. Este modulo promete ser determinista.
 */
export const groupThousands = (value: number): string => {
  const entero = Math.trunc(value);
  const signo = entero < 0 ? "-" : "";
  return (
    signo +
    Math.abs(entero)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/gu, ".")
  );
};

/** Una cantidad tal y como se enseña: "1.234 🪙 monedas". */
export const formatCurrency = (
  amount: number,
  settings: GroupCurrencySettings,
): string => `${groupThousands(amount)} ${settings.simbolo} ${settings.nombre}`;

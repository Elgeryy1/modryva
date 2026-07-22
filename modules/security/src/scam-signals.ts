/**
 * Productor de senales de scam para el motor de senales del superbot. Analiza un
 * mensaje plano (texto + metadatos) y emite una lista de senales estructurales
 * { key, weight, present, detail? }, una por patron detectado. Logica pura y
 * determinista: no hace I/O, no toca red ni Prisma, no usa Date/Math.random; solo
 * recibe inputs planos y devuelve valores. No importa el motor de senales: la
 * forma de "senal" se redefine aqui localmente para evitar acoplamiento.
 */

/**
 * Mensaje candidato a analizar. Todos los campos vienen ya extraidos por el
 * gateway; este modulo no parsea updates de Telegram.
 */
export interface ScamMessage {
  readonly text: string;
  readonly hasUrl: boolean;
  readonly domains: readonly string[];
  readonly username?: string;
  readonly bio?: string;
  readonly isFirstMessage: boolean;
}

/**
 * Forma estructural de una senal (redefinida localmente, sin importar el motor).
 * `present` indica si el patron se disparo; `detail` da contexto legible.
 */
export interface ScamSignal {
  readonly key: string;
  readonly weight: number;
  readonly present: boolean;
  readonly detail?: string;
}

/** Claves estables de cada senal, en el orden en que se emiten. */
export const SCAM_SIGNAL_KEYS = [
  "scam.disguised-link",
  "scam.confusable-unicode",
  "scam.dm-bait",
  "scam.unrealistic-promise",
  "scam.commercial-username",
  "scam.hello-plus-link",
  "scam.fake-social-proof",
] as const;

/** Quita tildes y diacriticos para comparar frases de forma robusta. */
const stripAccents = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Normaliza a minusculas sin acentos y con espacios colapsados. */
const normalize = (value: string): string =>
  stripAccents(value.toLowerCase()).replace(/\s+/g, " ").trim();

const buildSignal = (
  key: string,
  weight: number,
  present: boolean,
  detail?: string,
): ScamSignal =>
  detail !== undefined && present
    ? { key, weight, present, detail }
    : { key, weight, present };

/**
 * Dominios acortadores conocidos. Encadenar dos o mas suele indicar un intento
 * de esconder el destino real del enlace.
 */
const SHORTENERS: ReadonlySet<string> = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "cutt.ly",
  "is.gd",
  "ow.ly",
  "rebrand.ly",
  "rb.gy",
  "shorturl.at",
  "s.id",
  "v.gd",
]);

/** TLDs frecuentes en dominios ofuscados. */
const TLD =
  "(?:com|net|org|io|xyz|ru|info|link|app|co|me|biz|online|site|club|vip|top|gg|cc|ly)";

/**
 * Un "punto" camuflado: espacio antes/despues del punto, punto unicode raro
 * (fullwidth, one-dot-leader, ideografico) o el clasico "(dot)"/"[dot]"/" dot ".
 */
const WEIRD_DOT =
  "(?:\\s*[.\\uFF0E\\u2024\\u3002]\\s+|\\s+[.\\uFF0E\\u2024\\u3002]\\s*|[\\uFF0E\\u2024\\u3002]|\\s*\\(dot\\)\\s*|\\s*\\[dot\\]\\s*|\\s+dot\\s+)";

const DISGUISED_DOMAIN = new RegExp(`[a-z0-9-]{2,}${WEIRD_DOT}${TLD}\\b`, "i");

/**
 * Senal de link camuflado: dominios con puntos raros/espacios/"(dot)", o dos o
 * mas acortadores encadenados. `weight` alto porque es una tecnica deliberada.
 */
export const detectScamDisguisedLink = (msg: ScamMessage): ScamSignal => {
  const techniques: string[] = [];

  if (DISGUISED_DOMAIN.test(msg.text)) {
    techniques.push("punto-camuflado");
  }

  const shortenerCount = msg.domains.filter((domain) =>
    SHORTENERS.has(domain.toLowerCase()),
  ).length;
  if (shortenerCount >= 2) {
    techniques.push("acortadores-encadenados");
  }

  return buildSignal(
    "scam.disguised-link",
    3,
    techniques.length > 0,
    techniques.join(","),
  );
};

const LATIN = /[a-z]/i;
const CONFUSABLE = /[Ѐ-ӿͰ-Ͽ]/;

/**
 * Senal de unicode confusable: letras cirilicas o griegas mezcladas con letras
 * latinas en el mismo texto (homoglifos tipo "pаypal"). El texto puramente no
 * latino no se marca para no penalizar idiomas legitimos.
 */
export const detectScamConfusableUnicode = (msg: ScamMessage): ScamSignal => {
  const match = msg.text.match(CONFUSABLE);
  const present = match !== null && LATIN.test(msg.text);
  return buildSignal(
    "scam.confusable-unicode",
    2,
    present,
    present ? match?.[0] : undefined,
  );
};

const DM_BAIT_PHRASES: readonly string[] = [
  "mandame dm",
  "mandame un dm",
  "manda dm",
  "escribeme dm",
  "escribeme por dm",
  "escribeme al dm",
  "escribeme al privado",
  "escribeme por privado",
  "escribeme por interno",
  "te escribo por privado",
  "hablemos por privado",
  "hablame por privado",
  "mensaje directo",
  "al privado",
  "por interno",
];

/** Senal de "DM bait": empujar a la conversacion privada fuera de moderacion. */
export const detectScamDmBait = (msg: ScamMessage): ScamSignal => {
  const text = normalize(msg.text);
  const phrase = DM_BAIT_PHRASES.find((needle) => text.includes(needle));
  return buildSignal("scam.dm-bait", 2, phrase !== undefined, phrase);
};

const PROMISE_PHRASES: readonly string[] = [
  "dinero rapido",
  "dinero facil",
  "dinero extra",
  "gana dinero",
  "ganar dinero",
  "ganancias garantizadas",
  "retorno garantizado",
  "duplica tu dinero",
  "triplica tu dinero",
  "inversion",
  "invierte",
  "invertir",
  "regalo",
  "sorteo",
  "premio",
  "gratis",
  "bitcoin gratis",
  "cripto gratis",
  "forex",
];

/** Senal de promesas irreales: dinero rapido, inversion, regalos, sorteos. */
export const detectScamUnrealisticPromise = (msg: ScamMessage): ScamSignal => {
  const text = normalize(msg.text);
  const phrase = PROMISE_PHRASES.find((needle) => text.includes(needle));
  return buildSignal(
    "scam.unrealistic-promise",
    2,
    phrase !== undefined,
    phrase,
  );
};

const COMMERCIAL_USERNAME_KEYWORDS: readonly string[] = [
  "promo",
  "deal",
  "cash",
  "support",
  "crypto",
  "forex",
  "invest",
  "bonus",
  "casino",
  "earn",
  "money",
  "market",
  "trade",
  "giveaway",
  "airdrop",
];

/**
 * Senal de username comercial: promo/deal/cash/support y similares. Cuando el
 * handle contiene varias keywords, el detail es la que aparece antes por
 * posicion en el texto (no la primera del listado interno).
 */
export const detectScamCommercialUsername = (msg: ScamMessage): ScamSignal => {
  const handle = msg.username ? msg.username.toLowerCase() : "";
  let keyword: string | undefined;
  let bestIndex = Number.POSITIVE_INFINITY;
  if (handle) {
    for (const needle of COMMERCIAL_USERNAME_KEYWORDS) {
      const at = handle.indexOf(needle);
      if (at !== -1 && at < bestIndex) {
        bestIndex = at;
        keyword = needle;
      }
    }
  }
  return buildSignal(
    "scam.commercial-username",
    2,
    keyword !== undefined,
    keyword,
  );
};

const GREETING = /^(?:hola+|buenas|hey|hi|hello|holi)\b/;

/**
 * Senal "hola+link": saludo seco al inicio junto con un enlace (real, por
 * dominios, o camuflado). Patron tipico del primer mensaje de un scammer.
 */
export const detectScamHelloPlusLink = (msg: ScamMessage): ScamSignal => {
  const text = normalize(msg.text);
  const greeted = GREETING.test(text);
  const hasLink =
    msg.hasUrl || msg.domains.length > 0 || DISGUISED_DOMAIN.test(msg.text);
  const present = greeted && hasLink;
  return buildSignal(
    "scam.hello-plus-link",
    2,
    present,
    present ? "saludo+enlace" : undefined,
  );
};

const SOCIAL_PROOF_PHRASES: readonly string[] = [
  "100% real",
  "100 % real",
  "ya gane",
  "ya cobre",
  "me pago",
  "es legit",
  "no es estafa",
  "pago real",
  "pago seguro",
  "retire mi dinero",
  "cobre hoy",
  "totalmente real",
  "es real y funciona",
  "comprobado",
];

/** Senal de prueba social falsa: "100% real", "ya gane", "no es estafa". */
export const detectScamFakeSocialProof = (msg: ScamMessage): ScamSignal => {
  const text = normalize(msg.text);
  const phrase = SOCIAL_PROOF_PHRASES.find((needle) => text.includes(needle));
  return buildSignal("scam.fake-social-proof", 2, phrase !== undefined, phrase);
};

/**
 * Corre todos los detectores y devuelve las senales en orden estable
 * (coincidente con SCAM_SIGNAL_KEYS). Siempre emite una senal por patron, con
 * `present` false cuando no se disparo. Pura y determinista.
 */
export const detectScamSignals = (msg: ScamMessage): ScamSignal[] => [
  detectScamDisguisedLink(msg),
  detectScamConfusableUnicode(msg),
  detectScamDmBait(msg),
  detectScamUnrealisticPromise(msg),
  detectScamCommercialUsername(msg),
  detectScamHelloPlusLink(msg),
  detectScamFakeSocialProof(msg),
];

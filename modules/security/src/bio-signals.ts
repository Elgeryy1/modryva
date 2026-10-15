/**
 * Detector de bio/username sospechosos para el motor de senales del superbot.
 * Analiza el perfil plano de un usuario (bio + username, ya extraidos por el
 * gateway) y emite una lista de senales estructurales { key, weight, present,
 * detail? }, una por patron. Marca frases tipo inversion/crypto/adulto/estafa en
 * la bio y patrones comerciales (promo/deal/cash/support) en el username. Logica
 * pura y determinista: no hace I/O, no toca red ni Prisma, no usa Date/Math.random;
 * solo recibe inputs planos y devuelve valores. No importa signals.ts: la forma de
 * "senal" se redefine aqui localmente para evitar acoplamiento.
 */

/**
 * Perfil candidato a analizar. Ambos campos son opcionales porque Telegram no
 * siempre expone bio o username. Este modulo no parsea updates.
 */
export interface BioProfile {
  readonly bio?: string;
  readonly username?: string;
}

/**
 * Forma estructural de una senal (redefinida localmente, sin importar el motor).
 * `present` indica si el patron se disparo; `detail` da contexto legible y solo
 * aparece cuando la senal esta presente.
 */
export interface BioSignal {
  readonly key: string;
  readonly weight: number;
  readonly present: boolean;
  readonly detail?: string;
}

/** Claves estables de cada senal, en el orden en que se emiten. */
export const BIO_SIGNAL_KEYS = [
  "bio.investment",
  "bio.adult",
  "bio.scam",
  "bio.commercial-username",
] as const;

/** Quita tildes y diacriticos para comparar frases de forma robusta. */
const stripAccents = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Normaliza a minusculas sin acentos y con espacios colapsados. */
const bioNormalize = (value: string): string =>
  stripAccents(value.toLowerCase()).replace(/\s+/g, " ").trim();

/**
 * Devuelve la keyword que aparece antes por posicion en el texto normalizado,
 * o undefined si ninguna coincide. Empata a la de menor indice de aparicion (no
 * la primera del listado). Pura y determinista.
 */
const firstByPosition = (
  text: string,
  keywords: readonly string[],
): string | undefined => {
  let found: string | undefined;
  let bestIndex = Number.POSITIVE_INFINITY;
  for (const needle of keywords) {
    const at = text.indexOf(needle);
    if (at !== -1 && at < bestIndex) {
      bestIndex = at;
      found = needle;
    }
  }
  return found;
};

/** Construye una senal incluyendo `detail` solo cuando esta presente. */
const buildBioSignal = (
  key: string,
  weight: number,
  present: boolean,
  detail: string | undefined,
): BioSignal =>
  present && detail !== undefined
    ? { key, weight, present, detail }
    : { key, weight, present };

/** Frases de inversion/cripto/trading tipicas en bios de captacion. */
const INVESTMENT_PHRASES: readonly string[] = [
  "inversion",
  "invierte",
  "invertir",
  "inversor",
  "trading",
  "trader",
  "senales de trading",
  "forex",
  "cripto",
  "crypto",
  "criptomonedas",
  "bitcoin",
  "btc",
  "ethereum",
  "nft",
  "airdrop",
  "mercado de valores",
  "retorno garantizado",
  "ganancias garantizadas",
];

/**
 * Senal de bio de inversion/cripto: promociona trading, forex, criptomonedas o
 * retornos garantizados. `weight` 2.
 */
export const detectBioInvestment = (profile: BioProfile): BioSignal => {
  const text = profile.bio ? bioNormalize(profile.bio) : "";
  const phrase = firstByPosition(text, INVESTMENT_PHRASES);
  return buildBioSignal("bio.investment", 2, phrase !== undefined, phrase);
};

/** Frases de contenido adulto tipicas en bios de spam sexual. */
const ADULT_PHRASES: readonly string[] = [
  "+18",
  "18+",
  "contenido adulto",
  "solo adultos",
  "adultos",
  "xxx",
  "onlyfans",
  "only fans",
  "nudes",
  "escort",
  "webcam",
  "sexo",
  "porno",
  "hot content",
  "contenido hot",
  "vendo pack",
  "vendo packs",
];

/**
 * Senal de bio adulta: enlaza o promociona contenido sexual/+18. `weight` 2.
 */
export const detectBioAdult = (profile: BioProfile): BioSignal => {
  const text = profile.bio ? bioNormalize(profile.bio) : "";
  const phrase = firstByPosition(text, ADULT_PHRASES);
  return buildBioSignal("bio.adult", 2, phrase !== undefined, phrase);
};

/** Frases de estafa/dinero rapido tipicas en bios de captacion fraudulenta. */
const SCAM_PHRASES: readonly string[] = [
  "dinero facil",
  "dinero rapido",
  "dinero extra",
  "trabajo desde casa",
  "prestamo",
  "prestamos",
  "casino",
  "apuestas",
  "sorteo",
  "premio",
  "regalo",
  "gratis",
  "oferta unica",
  "duplica tu dinero",
  "triplica tu dinero",
  "no es estafa",
];

/**
 * Senal de bio de estafa: dinero facil, prestamos, apuestas, sorteos y demas
 * ganchos fraudulentos. `weight` 2.
 */
export const detectBioScam = (profile: BioProfile): BioSignal => {
  const text = profile.bio ? bioNormalize(profile.bio) : "";
  const phrase = firstByPosition(text, SCAM_PHRASES);
  return buildBioSignal("bio.scam", 2, phrase !== undefined, phrase);
};

/** Keywords comerciales tipicas en handles de cuentas de spam/soporte falso. */
const COMMERCIAL_USERNAME_KEYWORDS: readonly string[] = [
  "promo",
  "deal",
  "deals",
  "cash",
  "support",
  "offer",
  "offers",
  "sale",
  "sales",
  "shop",
  "store",
  "market",
  "bonus",
  "giveaway",
  "airdrop",
  "crypto",
  "forex",
  "casino",
  "invest",
  "earn",
  "money",
  "helpdesk",
];

/**
 * Senal de username comercial: promo/deal/cash/support y similares embebidos en
 * el handle. Cuando aparecen varias keywords, `detail` es la que ocurre antes por
 * posicion en el handle (no la primera del listado). `weight` 2.
 */
export const detectBioCommercialUsername = (profile: BioProfile): BioSignal => {
  const handle = profile.username
    ? profile.username.toLowerCase().replace(/^@/, "")
    : "";
  const keyword = firstByPosition(handle, COMMERCIAL_USERNAME_KEYWORDS);
  return buildBioSignal(
    "bio.commercial-username",
    2,
    keyword !== undefined,
    keyword,
  );
};

/**
 * Corre todos los detectores y devuelve las senales en orden estable
 * (coincidente con BIO_SIGNAL_KEYS). Siempre emite una senal por patron, con
 * `present` false cuando no se disparo. Pura y determinista.
 */
export const detectBioSignals = (profile: BioProfile): BioSignal[] => [
  detectBioInvestment(profile),
  detectBioAdult(profile),
  detectBioScam(profile),
  detectBioCommercialUsername(profile),
];

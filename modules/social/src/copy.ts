/**
 * The social copy catalogue.
 *
 * Two rules the report is strict about (§11), and one this repo forces:
 *
 *  1. No handler writes a user-facing sentence. Everything comes from here, so
 *     tone, translation and variety are one file's problem instead of two
 *     hundred call sites'. `copy-discipline.test.ts` lo comprueba leyendo el
 *     handler: una frase suelta en `apps/bot/src/handlers/social.ts` rompe la
 *     suite.
 *  2. Fun and moderation do NOT share a voice. A pole is allowed to tease; a
 *     sanction is never funny. They are separate key namespaces on purpose.
 *  3. Social replies are sent as PLAIN TEXT — no parse mode. Display names come
 *     from Telegram and are attacker-controlled: with Markdown on, a user named
 *     `*_[` breaks the message or, worse, forges emphasis around someone else's
 *     name. Plain text makes that whole class of bug impossible, and these are
 *     one-liners that gain nothing from bold.
 *
 * IDIOMAS. El catálogo acepta un `locale` y hoy solo tiene `es`. La dimensión
 * está para que añadir `en` sea rellenar entradas y no reescribir llamadas, y
 * el fallback es siempre el español: una clave sin traducir devuelve la frase
 * en castellano, nunca la clave cruda ni una cadena vacía.
 *
 * `normalizeLocale` sigue exactamente la misma regla que `normalizeLang` de
 * `modules/community/src/i18n.ts` (desconocido → "es"); hay un test de paridad
 * que lo comprueba importando aquella, para que las dos no se separen sin que
 * nadie se entere.
 */

/** Variants for one event. Never empty; the first is the safe default. */
type Variants = readonly [string, ...string[]];

/** Idiomas que el catálogo social puede servir. Hoy uno. */
export const SOCIAL_LOCALES = ["es"] as const;
export type SocialLocale = (typeof SOCIAL_LOCALES)[number];

/** El idioma de respaldo. Nunca se devuelve una clave cruda. */
export const FALLBACK_LOCALE: SocialLocale = "es";

/**
 * Cualquier cosa que llegue (un `language_code` de Telegram, undefined, basura)
 * se reduce a un idioma servible. `es-ES` y `ES` cuentan como `es`.
 */
export const normalizeLocale = (value: string | undefined): SocialLocale => {
  const base = (value ?? "").toLowerCase().split("-")[0] ?? "";
  return (SOCIAL_LOCALES as readonly string[]).includes(base)
    ? (base as SocialLocale)
    : FALLBACK_LOCALE;
};

const CATALOGUE = {
  // --- Pole: celebration -----------------------------------------------
  "pole.first": [
    "🥇 Pole para {user}. {latency} desde que abrió el día.",
    "🥇 {user} se lleva la pole. {latency} de reflejos.",
    "🥇 Pole de {user}, en {latency}. Hoy venías con hambre.",
    "🥇 Primera del día: {user}. Tardó {latency}.",
    "🥇 {user} llega antes que nadie. {latency}.",
    "🥇 La pole es de {user}. {latency} y a desayunar.",
  ],
  "pole.second": [
    "🥈 Subpole para {user}. Cerca, pero no.",
    "🥈 {user} se queda con la plata. {latency}.",
    "🥈 Segunda posición: {user}. Mañana quizá.",
    "🥈 Subpole de {user}. El oro tenía dueño desde {latency}.",
    "🥈 {user}, segundo. Nada mal.",
  ],
  "pole.third": [
    "🥉 Bronce para {user}. Podio es podio.",
    "🥉 {user} cierra el podio.",
    "🥉 Tercero: {user}. {latency}.",
    "🥉 {user} se cuelga el bronce.",
  ],
  "pole.other": [
    "Puesto {position} para {user}.",
    "{user} entra en el puesto {position}.",
    "Posición {position}: {user}.",
  ],
  // --- Pole: refusals ---------------------------------------------------
  "pole.already-claimed": [
    "Ya tienes el puesto {position} de hoy. No se puede repetir.",
    "Tranquilo, {user}: el puesto {position} ya es tuyo.",
    "Tu sitio de hoy es el {position}. Mañana otra vez.",
  ],
  "pole.window-full": [
    "Se acabaron los puestos de hoy. Mañana a las {reset}.",
    "Hoy ya está todo repartido. Vuelve mañana a las {reset}.",
    "Llegas tarde: el podio está completo. Reabre a las {reset}.",
  ],
  "pole.disabled": [
    "La pole no está activada en este grupo. Un admin puede encenderla desde el panel del grupo.",
  ],
  // La ventana desapareció mientras el comando estaba en vuelo (limpieza por
  // retención, reinicio de temporada, borrado de datos del grupo). Es
  // reintentable, así que el mensaje lo dice en vez de sonar a error.
  "pole.window-gone": [
    "Se me ha ido el día de las manos. Vuelve a intentarlo en un momento.",
  ],
  "pole.private": ["La pole se juega en un grupo, no por privado."],
  "pole.no-data": ["Aún no hay ninguna pole registrada aquí."],
  // --- Pole: reports ----------------------------------------------------
  "pole.today.header": ["📅 Pole de hoy ({day})"],
  "pole.ranking.header": ["🏆 Clasificación — {period}"],
  "pole.streak.none": ["{user} no tiene ninguna racha viva ahora mismo."],
  "pole.streak.alive": [
    "🔥 {user} suma {days} poles seguidas.",
    "🔥 Racha de {user}: {days} días.",
    "🔥 {days} poles seguidas para {user}. Empieza a ser sospechoso.",
  ],
  "pole.records.header": ["⏱ Récords"],
  "pole.summary": ["📣 Podio de hoy ({day}):"],
  // --- Roulette ---------------------------------------------------------
  "roulette.safe": [
    "🔫 Clic. Hoy sobrevives.",
    "🔫 Clic. Nada. Sigue tu día.",
    "🔫 Vacía. Te has librado, {user}.",
    "🔫 Clic… y ya está. Otro día será.",
    "🔫 Nada. La suerte hoy va contigo.",
    "🔫 Clic. El tambor gira y te perdona.",
  ],
  "roulette.hit-fun": [
    "💥 Te tocó, {user}. Suerte que hoy solo cuenta como anécdota.",
    "💥 Bang. Si esto contara, estarías callado un rato.",
    "💥 Mala suerte, {user}. Hoy sin consecuencias.",
    "💥 Premio gordo. Por hoy, solo el susto.",
  ],
  "roulette.hit-muted": [
    "💥 Mala suerte, {user}. {duration} de silencio.",
    "💥 Te tocó. Nos vemos en {duration}.",
    "💥 Bang. {duration} al banquillo, {user}.",
  ],
  "roulette.hit-no-permission": [
    "💥 Te habría tocado, pero no tengo permiso para silenciar aquí. Que un admin revise /status.",
  ],
  "roulette.hit-protected": [
    "💥 Te tocaba, pero no silencio a los administradores. Considéralo un privilegio.",
  ],
  "roulette.cooldown-user": [
    "Espera {seconds} s antes de volver a probar.",
    "Demasiado rápido. Inténtalo en {seconds} s.",
  ],
  "roulette.cooldown-chat": ["El tambor aún gira. Prueba en {seconds} s."],
  "roulette.disabled": [
    "La ruleta no está activada aquí. Un admin puede encenderla desde el panel del grupo.",
  ],
  "roulette.private": ["La ruleta se juega en un grupo."],
  "roulette.status": [
    "🔫 Ruleta: {state}. Probabilidad {numerator}/{denominator}. Consecuencia: {consequence}.",
  ],
  // Las dos consecuencias, como claves propias: se interpolan dentro del estado
  // y por tanto también las lee una persona.
  "roulette.consequence.fun": ["solo diversión"],
  "roulette.consequence.mute": ["silencio de {duration}"],
  "roulette.state.on": ["activa"],
  // --- Fun media --------------------------------------------------------
  "fun.cat.caption": ["🐱", "🐱 Toma gato.", "🐱 Uno de los buenos."],
  "fun.dog.caption": ["🐶", "🐶 Toma perro.", "🐶 Va con energía."],
  "fun.media.empty": [
    "Todavía no hay biblioteca de {kind} en este bot. Un admin puede añadirla desde el panel.",
  ],
  "fun.disabled": ["Ese comando no está activado en este grupo."],
  // --- Support ----------------------------------------------------------
  "support.none": [
    "Gracias por preguntar, pero ahora mismo no hay ningún método de apoyo configurado.",
  ],
  "support.link": ["Si te apetece echar una mano: {url}"],
  // --- Punteros a la configuración --------------------------------------
  "config.pole.panel": ["⚙️ La pole se configura desde el panel del grupo."],
  "config.pole.settings": ["⚙️ La pole se configura desde /settings."],
  "config.roulette.panel": [
    "⚙️ La ruleta se configura desde el panel del grupo.",
  ],
  "config.roulette.settings": ["⚙️ La ruleta se configura desde /settings."],
  "config.button": ["⚙️ Abrir ajustes"],
  // --- Filas de los informes --------------------------------------------
  // Con formato, no frases: aun así pasan por aquí, porque el criterio es
  // "nada legible por una persona se escribe en un handler".
  "pole.today.row": ["{medal} {user} — {latency}"],
  "pole.ranking.row": ["{rank}. {user} — 🥇{firsts} 🥈{seconds} 🥉{thirds}"],
  "pole.records.fastest": ["⚡ Más rápida: {user} — {latency} ({day})"],
  "pole.records.streak": ["🔥 Mejor racha: {user} — {days} días"],
  // --- Moderation-adjacent: sober, never funny --------------------------
  "mod.not-admin": ["Solo los administradores del grupo pueden hacer esto."],
  "mod.group-only": ["Este comando solo funciona dentro de un grupo."],
} as const satisfies Record<string, Variants>;

export type CopyKey = keyof typeof CATALOGUE;

/**
 * Una tabla por idioma.
 *
 * `es` es el catálogo completo. Un idioma nuevo se añade como tabla PARCIAL:
 * lo que traduzca se sirve, y lo que falte cae al español por la búsqueda de
 * `copy()`. Así se puede traducir a trozos sin dejar huecos en el grupo.
 */
const TABLES: Readonly<
  Record<SocialLocale, Partial<Record<CopyKey, Variants>>>
> = {
  es: CATALOGUE,
};

/** Every key, for the parity test that keeps the catalogue honest. */
export const COPY_KEYS = Object.keys(CATALOGUE) as readonly CopyKey[];

/**
 * Renders one variant.
 *
 * `pick` selects among the variants — callers pass a RandomSource draw in
 * production and a fixed number in tests, so a test never has to accept
 * "one of six possible strings". Out-of-range and negative values wrap, so no
 * caller can crash the bot by passing a bad index.
 *
 * A `{var}` with no value renders as empty rather than leaving the brace
 * visible: a half-substituted template in a group chat looks broken, and the
 * missing value is a bug for the logs, not for the members.
 */
export const copy = (
  key: CopyKey,
  vars: Readonly<Record<string, string | number>> = {},
  pick = 0,
  /**
   * Idioma pedido. Hoy solo hay `es`, así que cualquier valor acaba ahí; el
   * parámetro existe para que añadir un idioma no obligue a tocar ni una sola
   * llamada.
   */
  locale: string | undefined = FALLBACK_LOCALE,
): string => {
  const table = TABLES[normalizeLocale(locale)] ?? CATALOGUE;
  const variants = (table[key] ?? CATALOGUE[key]) as Variants;
  const index =
    ((Math.trunc(pick) % variants.length) + variants.length) % variants.length;
  const template = variants[index] ?? variants[0];
  return template.replace(/\{([a-zA-Z_]+)\}/gu, (_match, name: string) => {
    const value = vars[name];
    return value === undefined ? "" : String(value);
  });
};

/** How many variants a key has. Used by the catalogue's own tests. */
export const variantCount = (key: CopyKey): number => CATALOGUE[key].length;

/**
 * Strips the characters Telegram would read as formatting.
 *
 * Not used by the social replies (they are plain text, see the header), but
 * exported for any caller that DOES set a parse mode and needs to put an
 * attacker-controlled display name inside it.
 */
export const escapeHtml = (value: string): string =>
  value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");

/**
 * A display name safe to show in a group.
 *
 * Length-capped and stripped of newlines and control characters, because a name
 * is arbitrary user input that ends up in a message everybody reads. Falls back
 * to a neutral word rather than printing a raw numeric id, which helps nobody.
 */
export const displayName = (
  name: string | null | undefined,
  fallback = "alguien",
): string => {
  const cleaned = (name ?? "")
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .trim();
  if (cleaned.length === 0) {
    return fallback;
  }
  return cleaned.length > 32 ? `${cleaned.slice(0, 31)}…` : cleaned;
};

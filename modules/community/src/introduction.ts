/**
 * "Introduce yourself or you're out": a new member must post a photo, their age
 * (or birth year) and where they are from, within a deadline.
 *
 * The asymmetry drives every decision here. A false POSITIVE just lets a sloppy
 * introduction through — a human reads it later and nothing is lost. A false
 * NEGATIVE removes a real person who did what was asked, and they have no idea
 * why. So every check below is deliberately generous, and anything ambiguous
 * counts as done.
 *
 * Pure: no clock, no I/O.
 */

export interface IntroductionSettings {
  readonly enabled: boolean;
  /** Hours a newcomer has before they are removed. */
  readonly deadlineHours: number;
  readonly requirePhoto: boolean;
  readonly requireAge: boolean;
  readonly requireOrigin: boolean;
  /**
   * Tema (topic) del grupo de STAFF donde publicar las fichas de presentación,
   * cuando se quiere separarlas de los informes de verificación.
   *
   * `null` = el de siempre: el mismo tema que usa Guardian. Deliberadamente NO
   * es una sala aparte, solo un tema: el worker ya advierte que tener dos
   * ajustes de "dónde avisa el bot al equipo" garantiza que uno acabe sin
   * configurar. Aquí no puede pasar — sin poner nada, todo sigue llegando
   * exactamente donde llegaba.
   */
  readonly staffThreadId: number | null;
  /**
   * Copiar al staff TAMBIÉN las presentaciones que sí se dan por buenas, no
   * solo las fichas de quien no se presentó.
   *
   * Interruptor propio y apagado por defecto: `staffThreadId` dice DÓNDE, y
   * usarlo además como el "sí quiero" haría que poner un tema para las fichas
   * empezara a copiar de golpe la foto y el texto de cada recién llegado a otra
   * sala. Eso es una decisión sobre datos de personas, y tiene que decirse
   * aparte y a propósito.
   */
  readonly mirrorToStaff: boolean;
  /**
   * Cada cuántas horas vuelve a avisar DESPUÉS de la ficha, hasta el límite de
   * warns del grupo. `null` apaga la escalada: un aviso al vencer el plazo y
   * ya — que fue el comportamiento hasta agosto de 2026, y su resultado fue un
   * tema de STAFF lleno de fichas que nadie pulsaba.
   */
  readonly reminderEveryHours: number | null;
  /**
   * Expulsar (kick suave: puede volver a entrar) al llegar los warns activos
   * al límite del grupo.
   *
   * Encendido por defecto A PESAR del incidente del 3-ago-2026 (el barrido
   * expulsó a tres admins): aquello pasó porque el job no podía distinguir a
   * nadie, y hoy sí puede — comprueba `getChatMember` y salta a los admins
   * antes de cada aviso y antes del kick. Es una decisión del propietario
   * (2026-08-13): la puerta sin consecuencia acumulaba fichas que nadie
   * decidía.
   */
  readonly autoKickAtLimit: boolean;
}

export const defaultIntroductionSettings: IntroductionSettings = {
  enabled: false,
  deadlineHours: 12,
  requirePhoto: true,
  requireAge: true,
  requireOrigin: true,
  staffThreadId: null,
  mirrorToStaff: false,
  reminderEveryHours: 2,
  autoKickAtLimit: true,
};

/** Key in the shared chat_settings store — one small object per chat, no table
 * of its own (same reasoning as the appointed-admin guard). */
export const INTRODUCTION_SETTINGS_KEY = "introduction_gate";

/**
 * Reads stored settings defensively: anything missing or malformed falls back
 * to the default, and `enabled` must be explicitly true. A garbled row must
 * never be what starts removing people from a group.
 */
export const parseIntroductionSettings = (
  value: unknown,
): IntroductionSettings => {
  if (typeof value !== "object" || value === null) {
    return defaultIntroductionSettings;
  }
  const raw = value as Record<string, unknown>;
  const hours =
    typeof raw.deadlineHours === "number" &&
    Number.isInteger(raw.deadlineHours) &&
    raw.deadlineHours >= 1 &&
    raw.deadlineHours <= 168
      ? raw.deadlineHours
      : defaultIntroductionSettings.deadlineHours;
  const flag = (key: string, fallback: boolean): boolean =>
    typeof raw[key] === "boolean" ? (raw[key] as boolean) : fallback;
  // Un message_thread_id de Telegram es un entero positivo. Cualquier otra cosa
  // vuelve a null, que significa "el tema de siempre" — nunca un tema
  // inventado, que mandaría las fichas a un sitio donde nadie las mira.
  const tema =
    typeof raw.staffThreadId === "number" &&
    Number.isInteger(raw.staffThreadId) &&
    raw.staffThreadId > 0
      ? raw.staffThreadId
      : null;
  // `null` GUARDADO significa "escalada apagada a propósito" y se respeta;
  // ausente o ilegible cae al default (2 h). La distinción importa: sin ella
  // no habría forma de apagar la escalada, porque apagar y "no dijo nada"
  // serían lo mismo.
  const cadencia =
    raw.reminderEveryHours === null
      ? null
      : typeof raw.reminderEveryHours === "number" &&
          Number.isInteger(raw.reminderEveryHours) &&
          raw.reminderEveryHours >= 1 &&
          raw.reminderEveryHours <= 48
        ? raw.reminderEveryHours
        : defaultIntroductionSettings.reminderEveryHours;
  return {
    enabled: raw.enabled === true,
    deadlineHours: hours,
    requirePhoto: flag("requirePhoto", true),
    requireAge: flag("requireAge", true),
    requireOrigin: flag("requireOrigin", true),
    staffThreadId: tema,
    mirrorToStaff: flag("mirrorToStaff", false),
    reminderEveryHours: cadencia,
    autoKickAtLimit: flag("autoKickAtLimit", true),
  };
};

/** What is still missing, in the order a person would fix it. */
export type IntroductionGap = "photo" | "age" | "origin";

export interface IntroductionCheck {
  readonly complete: boolean;
  readonly missing: readonly IntroductionGap[];
  /** The age we read, when we read one. Informational for staff. */
  readonly age: number | null;
}

/**
 * A plausible human age, or a birth year turned into one.
 *
 * Bounded to 5–99 so a bare "2024" or a phone number is not read as an age, and
 * birth years only from 1900 so "1000 gracias" is not a birthday.
 */
const readAge = (text: string, nowYear: number): number | null => {
  // Birth year first: "2006" is unambiguous where "06" would not be.
  const year = /\b(19\d{2}|20[0-2]\d)\b/u.exec(text);
  if (year?.[1]) {
    const age = nowYear - Number(year[1]);
    if (age >= 5 && age <= 99) {
      return age;
    }
  }
  // Then a plain number that reads like an age. Requires a word boundary on
  // both sides so "1234" and "20:30" do not qualify.
  for (const match of text.matchAll(/\b(\d{1,2})\b/gu)) {
    const value = Number(match[1]);
    if (value >= 5 && value <= 99) {
      return value;
    }
  }
  return null;
};

/**
 * Whether the text names a place.
 *
 * Deliberately NOT a list of cities: any such list is wrong for somebody, and
 * being wrong here removes them from the group. Instead it looks for the SHAPE
 * of saying where you are from — "de Madrid", "soy de", "vivo en", "desde" —
 * plus a bare capitalised word as a last chance, because "Madrid" on its own is
 * how half of people answer.
 */
/** Palabras que no son un sitio por mucho que aparezcan solas. */
const NOT_A_PLACE = new Set([
  "hola",
  "buenas",
  "hey",
  "que",
  "tal",
  "soy",
  "años",
  "ano",
  "anos",
  "año",
  "aqui",
  "aquí",
  "nuevo",
  "nueva",
  "gracias",
  "chico",
  "chica",
  "tio",
  "tia",
  "jaja",
  "jeje",
  "wenas",
  "holaa",
  "grupo",
  "tengo",
  "vivo",
  "edad",
  "cumplo",
  "hago",
  "aca",
  "por",
  "para",
  "con",
  "una",
  "uno",
]);

const hasOrigin = (raw: string): boolean => {
  const text = raw.trim();
  if (
    /\b(?:soy\s+de|vivo\s+en|desde|de\s+la|del|de)\s+[\p{L}]{2,}/iu.test(text)
  ) {
    return true;
  }
  // A capitalised word that is not the sentence opener — "Hola, Madrid" or
  // "18 Madrid". Loose on purpose.
  if (
    /(?:^|[\s,.:;-])\p{Lu}[\p{L}]{2,}/u.test(
      text.replace(/^\s*\p{Lu}[\p{L}]*/u, ""),
    )
  ) {
    return true;
  }
  // Nadie escribe "Barcelona": escriben "bcn", "mdrz", "vlc", "coru" — en
  // minuscula, abreviado y sin preposicion. La forma real es "19 bcn" o
  // "bcn 19": un numero y una palabra corta, y poco mas.
  //
  // Por eso solo se acepta en mensajes CORTOS. "tengo 18 años" tiene la misma
  // pinta si se mira palabra a palabra, y darlo por bueno vaciaria el requisito
  // de procedencia entero. Exigir que el mensaje sea telegráfico distingue una
  // abreviatura de una frase.
  const palabras = text.toLowerCase().match(/[\p{L}]{2,}/gu) ?? [];
  if (palabras.length > 0 && palabras.length <= 3) {
    return palabras.some((palabra) => !NOT_A_PLACE.has(palabra));
  }
  return false;
};

/**
 * Judges one message as an introduction.
 *
 * `hasPhoto` comes from the update, not the text — the caller knows whether an
 * image was attached and this module should not try to guess it from words.
 */
export const checkIntroduction = (input: {
  readonly text: string;
  readonly hasPhoto: boolean;
  readonly settings: IntroductionSettings;
  readonly nowYear: number;
}): IntroductionCheck => {
  const { text, hasPhoto, settings, nowYear } = input;
  const age = readAge(text, nowYear);
  const missing: IntroductionGap[] = [];

  if (settings.requirePhoto && !hasPhoto) {
    missing.push("photo");
  }
  if (settings.requireAge && age === null) {
    missing.push("age");
  }
  // Origin is only judged when there is something to judge. A photo with a
  // caption of "18 Madrid" passes; a photo with no caption at all fails on the
  // age check first, which is a clearer thing to tell someone.
  if (settings.requireOrigin && !hasOrigin(text)) {
    missing.push("origin");
  }

  return { complete: missing.length === 0, missing, age };
};

/**
 * Escapa lo que Telegram interpretaría como etiquetas HTML. Los nombres los
 * elige el usuario, asi que un nombre con `<b>` no puede romper el formato del
 * mensaje ni inyectar marcado en el resto.
 */
export const escapeHtml = (raw: string): string =>
  raw.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");

/** Enlace pulsable a una persona, que funciona aunque no tenga @alias. */
export const mentionHtml = (
  telegramUserId: bigint,
  displayName: string,
): string =>
  `<a href="tg://user?id=${telegramUserId.toString()}">${escapeHtml(displayName)}</a>`;

const plazo = (hours: number): string =>
  hours === 1 ? "<b>1 hora</b>" : `<b>${hours} horas</b>`;

/**
 * El bloque de instrucciones, compartido por el aviso de entrada y por
 * `/nopresentado`. Va en `<blockquote>` a proposito: separa "lo que tienes que
 * hacer" del resto del mensaje de un vistazo, sin que haya que leerlo entero.
 *
 * Se listan SOLO los requisitos que el grupo pide de verdad. Un mensaje que
 * exige una foto donde el grupo no la exige acaba echando a quien hizo caso.
 */
const instructionsBlock = (settings: IntroductionSettings): string => {
  const lines: string[] = [];
  if (settings.requirePhoto) {
    lines.push("📸 Una <b>foto o vídeo</b> tuyo (puedes taparte la cara).");
  }
  const datos: string[] = [];
  if (settings.requireAge) {
    datos.push("tu <b>año de nacimiento</b>");
  }
  if (settings.requireOrigin) {
    datos.push("de <b>dónde eres</b>");
  }
  if (datos.length > 0) {
    const unidos = datos.join(" y ");
    lines.push(settings.requirePhoto ? `✍️ Con ${unidos}.` : `✍️ ${unidos}.`);
  }
  return `<blockquote>${lines.join("\n")}</blockquote>`;
};

/**
 * El plazo y su consecuencia, en una línea.
 *
 * "Sales del grupo" a secas se lee como un baneo, y quien cree que le han
 * baneado no vuelve — por eso la coletilla de que puede volver se queda por
 * corto que sea el mensaje. Es la diferencia entre perder a alguien y no.
 *
 * La consecuencia depende de los ajustes y el texto tiene que decir LA QUE
 * APLICA. Con la escalada encendida, "lo revisa un admin y se queda en nada"
 * seria mentira: hay avisos periodicos y al limite se sale del grupo. Sin
 * escalada, prometer una expulsion que no llega quema el aviso igual — cada
 * variante cuenta exactamente lo que va a pasar.
 */
const cadaCuanto = (hours: number): string =>
  hours === 1 ? "cada hora" : `cada ${hours} h`;

const deadlineLine = (settings: IntroductionSettings): string => {
  if (settings.reminderEveryHours !== null && settings.autoKickAtLimit) {
    return `⌛ ${plazo(settings.deadlineHours)}. Después aviso ${cadaCuanto(settings.reminderEveryHours)}, y al llegar al límite de avisos sales del grupo — puedes volver a entrar y presentarte.`;
  }
  if (settings.reminderEveryHours !== null) {
    return `⌛ ${plazo(settings.deadlineHours)}. Después te lo recuerdo ${cadaCuanto(settings.reminderEveryHours)} y lo revisa un admin — preséntate y se queda en nada.`;
  }
  return `⌛ ${plazo(settings.deadlineHours)}. Si no, lo revisa un admin — puedes presentarte igualmente y se queda en nada.`;
};

/** Lo que ve un recién llegado. `who` ya viene como HTML (mención o nombre). */
export const buildIntroductionPrompt = (
  who: string,
  settings: IntroductionSettings,
): string =>
  [
    `🙋 ${who}, preséntate para quedarte.`,
    instructionsBlock(settings),
    deadlineLine(settings),
  ].join("\n");

/**
 * Lo que se publica cuando un administrador usa `/nopresentado`: la persona ya
 * estaba dentro y tiene que volver a presentarse.
 */
export const buildRepresentNotice = (
  who: string,
  settings: IntroductionSettings,
): string =>
  [
    `🙋 ${who}, tienes que volver a presentarte.`,
    instructionsBlock(settings),
    deadlineLine(settings),
  ].join("\n");

/** Confirmación de que la presentación se ha dado por buena. */
export const buildIntroductionAccepted = (who: string): string =>
  `✅ Listo, ${who}. Ya estás dentro.`;

/** Confirmación de `/presentado` (lo da por bueno un administrador a mano). */
export const buildIntroductionForgiven = (who: string): string =>
  `✅ Presentación de ${who} validada por un admin.`;

// --- Aviso automático al vencer el plazo ------------------------------------

/**
 * El motivo que queda escrito en el warn.
 *
 * Constante y no una plantilla porque es lo que un administrador lee meses
 * despues en el historial de esa persona. Si cada sitio lo redacta a su manera,
 * el historial deja de poder leerse de un vistazo y deja de poder filtrarse.
 */
export const INTRODUCTION_WARN_REASON = "No se presentó dentro del plazo";

/** Warns activos DESPUES de poner el automatico, y el limite del grupo. */
export interface IntroductionWarnCount {
  readonly count: number;
  readonly limit: number;
}

/**
 * El aviso publico en el grupo cuando vence el plazo.
 *
 * Dice el PORQUE, no solo que hay un aviso. Un "⚠️ aviso 1/3" a secas obliga a
 * la persona a preguntar que ha hecho, y quien no pregunta se va — que es justo
 * a quien esta puerta intenta no perder.
 *
 * Repite las instrucciones enteras a proposito. El mensaje de bienvenida se
 * perdio hace doce horas entre otros doscientos; mandar a alguien a buscarlo es
 * mandarlo a nada.
 *
 * Cuando el aviso alcanza el limite del grupo lo dice y aclara que NO se ha
 * sancionado a nadie. Sin esa linea el mensaje diria "3/3" y no pasaria nada, y
 * un contador que anuncia una consecuencia que no llega se queda sin credito la
 * primera vez que alguien lo comprueba.
 */
export const buildIntroductionWarnNotice = (input: {
  readonly who: string;
  readonly settings: IntroductionSettings;
  readonly warn: IntroductionWarnCount;
}): string => {
  const { who, settings, warn } = input;
  // La línea final dice la consecuencia REAL según los ajustes. Con la
  // expulsión automática encendida, el "no te he sancionado: lo mira un admin"
  // del modo manual sería prometer una clemencia que no existe — y el aviso
  // que engaña una vez no vuelve a mover a nadie.
  const alLimite = settings.autoKickAtLimit
    ? warn.count >= warn.limit
      ? "🚪 <b>Límite de avisos alcanzado: en el próximo repaso sales del grupo</b> — salvo que te presentes ahora. Podrás volver a entrar."
      : warn.count === warn.limit - 1
        ? "🚪 <b>Al siguiente aviso sales del grupo.</b> Preséntate y se corta aquí."
        : `Preséntate y se corta aquí. Al llegar a ${warn.limit}/${warn.limit} sales del grupo (podrás volver a entrar).`
    : warn.count >= warn.limit
      ? "🔔 Con este llegas al límite de avisos del grupo. <b>No te he sancionado</b>: lo mira un admin. Preséntate y se queda en nada."
      : "Preséntate y un admin te quita el aviso.";
  return [
    `⚠️ ${who} — aviso automático ${warn.count}/${warn.limit}.`,
    `Se te dieron ${plazo(settings.deadlineHours)} para presentarte y el plazo ha vencido.`,
    instructionsBlock(settings),
    alLimite,
  ].join("\n");
};

/**
 * El aviso público cuando la escalada llega al límite y expulsa.
 *
 * Dice que puede volver a entrar EN el mismo mensaje: el kick es de 120 s
 * (mismo patrón que el botón del staff) y quien lo lee como un baneo no
 * vuelve a intentarlo. También queda escrito para el resto del grupo, que es
 * quien decide si la puerta les parece justa viendo cómo se aplica.
 */
export const buildIntroductionKickNotice = (input: {
  readonly who: string;
  readonly warn: IntroductionWarnCount;
}): string =>
  [
    `🚪 ${input.who} sale del grupo: ${input.warn.count}/${input.warn.limit} avisos sin presentarse.`,
    "Puede volver a entrar cuando quiera — presentándose, esta vez.",
  ].join("\n");

/**
 * `/presentado` y `/nopresentado`: la salida manual cuando el automatismo se
 * equivoca en cualquiera de los dos sentidos.
 *
 * Existe porque `checkIntroduction` es deliberadamente generoso y aun asi falla
 * a veces: da por buena una presentación que no lo era, o no reconoce una que
 * si lo era. Sin estos comandos la única forma de arreglarlo era esperar a que
 * el bot expulsara a alguien que había hecho lo que se le pidió.
 *
 * Devuelve null cuando el comando no es ninguno de los dos.
 */
export type IntroductionAdminCommand =
  | { readonly kind: "presented" }
  | { readonly kind: "not-presented" };

export const parseIntroductionAdminCommand = (
  name: string | undefined,
): IntroductionAdminCommand | null => {
  if (name === "presentado") {
    return { kind: "presented" };
  }
  if (name === "nopresentado" || name === "no_presentado") {
    return { kind: "not-presented" };
  }
  return null;
};

export const INTRODUCTION_ADMIN_USAGE =
  "Responde al mensaje de la persona, o pásame su @usuario o su ID.\n\n• /presentado — doy su presentación por buena y le quito el plazo.\n• /nopresentado — le pido que se vuelva a presentar.";

// --- Aviso al staff cuando vence un plazo ---

/**
 * Vencer el plazo ya no expulsa a nadie: abre una ficha en la sala de STAFF con
 * dos botones. Lo decide una persona.
 *
 * El automatismo anterior expulsaba solo, y el 3 de agosto de 2026 se llevo por
 * delante a tres administradores del grupo a los que el propio bot habia
 * ascendido horas antes — no tenia forma de distinguir a nadie, porque a esa
 * altura del codigo (un job del worker) no hay contexto para distinguir. Esto
 * mueve la decision a donde SI lo hay: alguien que conoce al grupo.
 */
export const INTRODUCTION_STAFF_CALLBACK = "ip";

export type IntroductionStaffAction = "kick" | "keep";

export interface IntroductionStaffCallback {
  readonly action: IntroductionStaffAction;
  /** Fila de `introduction_pending`. Un caso, una ficha. */
  readonly pendingId: string;
}

const ACTION_CODE: Record<IntroductionStaffAction, string> = {
  kick: "k",
  keep: "n",
};

export const buildIntroductionStaffCallback = (
  action: IntroductionStaffAction,
  pendingId: string,
): string =>
  `${INTRODUCTION_STAFF_CALLBACK}:${ACTION_CODE[action]}:${pendingId}`;

/**
 * Devuelve null para cualquier cosa que no sea nuestra — el enrutador de
 * callbacks los prueba en cadena y este tiene que dejar pasar los ajenos.
 */
export const parseIntroductionStaffCallback = (
  data: string | undefined,
): IntroductionStaffCallback | null => {
  if (!data) {
    return null;
  }
  const parts = data.split(":");
  if (parts.length !== 3 || parts[0] !== INTRODUCTION_STAFF_CALLBACK) {
    return null;
  }
  const action = parts[1] === "k" ? "kick" : parts[1] === "n" ? "keep" : null;
  if (!action || !parts[2]) {
    return null;
  }
  return { action, pendingId: parts[2] };
};

export interface IntroductionStaffCardInput {
  readonly pendingId: string;
  readonly telegramUserId: bigint;
  readonly username: string | null;
  readonly displayName: string | null;
  readonly joinedAt: Date;
  readonly dueAt: Date;
  readonly now: Date;
  readonly chatTitle: string | null;
  /** Solo para dar formato a las horas; no se lee ningun reloj aqui. */
  readonly timeZone?: string;
  /**
   * El aviso automatico que acompaña a esta ficha, si se llego a poner.
   *
   * `undefined` significa que NO hay warn — porque fallo al escribirlo. La linea
   * entonces no se escribe: una ficha que anuncia un aviso inexistente manda al
   * staff a buscar en el historial algo que no van a encontrar, y la siguiente
   * vez ya no se creen la ficha entera.
   */
  readonly warn?: IntroductionWarnCount | undefined;
  /**
   * La escalada del grupo, si esta encendida, para que la ficha diga que va a
   * pasar si nadie pulsa nada. Sin esta linea el staff cree que la ficha
   * espera a una persona para siempre — que era verdad hasta agosto de 2026 y
   * dejo de serlo.
   */
  readonly escalation?:
    | { readonly everyHours: number; readonly autoKick: boolean }
    | undefined;
}

/** Espana, que es donde estan los dos grupos que usan esto. */
const DEFAULT_TIME_ZONE = "Europe/Madrid";

const formatMoment = (value: Date, timeZone: string): string =>
  new Intl.DateTimeFormat("es-ES", {
    timeZone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);

/** "3 h y 12 min", "12 min", "menos de 1 min". */
export const formatElapsed = (milliseconds: number): string => {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
  if (totalMinutes === 0) {
    return "menos de 1 min";
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes} min`;
  }
  return minutes === 0 ? `${hours} h` : `${hours} h y ${minutes} min`;
};

/**
 * La ficha que ve el staff. Lleva el ID numerico ademas de la mencion porque un
 * alias se cambia en dos segundos y el ID es lo unico con lo que se puede
 * buscar a alguien despues.
 */
export const buildIntroductionStaffCard = (
  input: IntroductionStaffCardInput,
): string => {
  const timeZone = input.timeZone ?? DEFAULT_TIME_ZONE;
  const nombre =
    input.displayName ??
    (input.username ? `@${input.username}` : input.telegramUserId.toString());
  const alias = input.username ? ` (@${escapeHtml(input.username)})` : "";
  const donde = input.chatTitle
    ? ` en <b>${escapeHtml(input.chatTitle)}</b>`
    : "";
  return [
    `⏰ <b>No se ha presentado</b>${donde}`,
    "",
    `👤 ${mentionHtml(input.telegramUserId, nombre)}${alias}`,
    `🆔 <code>${input.telegramUserId.toString()}</code>`,
    `📥 Entró el ${formatMoment(input.joinedAt, timeZone)}`,
    `⌛ Se le acabó el plazo el ${formatMoment(input.dueAt, timeZone)} — hace ${formatElapsed(
      input.now.getTime() - input.dueAt.getTime(),
    )}`,
    ...(input.warn
      ? [
          input.warn.count >= input.warn.limit
            ? `⚠️ Aviso automático ${input.warn.count}/${input.warn.limit} — <b>límite alcanzado</b>. No he sancionado a nadie.`
            : `⚠️ Aviso automático ${input.warn.count}/${input.warn.limit}, avisado en el grupo.`,
        ]
      : []),
    ...(input.escalation
      ? [
          input.escalation.autoKick
            ? `⏳ Si nadie decide, sigo avisando ${cadaCuanto(input.escalation.everyHours)} y al llegar al límite lo expulso yo (podrá volver a entrar).`
            : `⏳ Si nadie decide, sigo avisando ${cadaCuanto(input.escalation.everyHours)} hasta el límite — expulsar sigue siendo cosa vuestra.`,
        ]
      : []),
    "",
    "Decidid vosotros:",
  ].join("\n");
};

export const buildIntroductionStaffKeyboard = (
  pendingId: string,
): Record<string, unknown> => ({
  inline_keyboard: [
    [
      {
        text: "🚪 Expulsar",
        callback_data: buildIntroductionStaffCallback("kick", pendingId),
      },
      {
        text: "✅ Que se quede",
        callback_data: buildIntroductionStaffCallback("keep", pendingId),
      },
    ],
  ],
});

/**
 * La ficha una vez decidida. Sustituye a la anterior y se queda sin botones:
 * quien llega tarde tiene que ver QUE se decidio y QUIEN lo decidio, no un par
 * de botones que ya no hacen nada.
 */
export const buildIntroductionStaffResolved = (input: {
  readonly card: string;
  readonly action: IntroductionStaffAction;
  readonly decidedBy: string;
  readonly telegramOk: boolean;
}): string => {
  const veredicto =
    input.action === "keep"
      ? `✅ Se queda — lo decidió ${input.decidedBy}.`
      : input.telegramOk
        ? `🚪 Expulsado por ${input.decidedBy}. Puede volver a entrar.`
        : `⚠️ ${input.decidedBy} pulsó expulsar, pero Telegram no lo aceptó. Hay que hacerlo a mano.`;
  return `${input.card}\n\n${veredicto}`;
};

/**
 * La ficha cuando la cierra la escalada, no una persona. Misma regla que la
 * resolución manual: el texto sustituye a los botones, y quien llegue tarde ve
 * QUÉ pasó y POR QUÉ — aquí, que fue el propio bot al agotarse los avisos.
 */
export const buildIntroductionStaffAutoResolved = (input: {
  readonly card: string;
  readonly warn: IntroductionWarnCount;
}): string =>
  `${input.card}\n\n🚪 Expulsado automáticamente: ${input.warn.count}/${input.warn.limit} avisos sin presentarse. Puede volver a entrar.`;

/** Lo que se responde a quien pulsa un botón de una ficha que ya no existe. */
export const INTRODUCTION_STAFF_STALE =
  "Este caso ya no está abierto: o se presentó, o alguien ya lo decidió.";

// --- El espejo de presentaciones -------------------------------------------

/**
 * La copia de una presentación buena en la sala de STAFF.
 *
 * El tema donde caen las fichas de "no se ha presentado" acaba contando solo la
 * mitad de la historia: quien lo abre ve una lista de fallos y ni rastro de las
 * doscientas presentaciones que sí salieron bien. Copiar también las buenas es
 * lo que convierte ese tema en el registro de quién ha entrado — que es para lo
 * que los administradores lo abrieron.
 *
 * La copia del mensaje va por su cuenta (foto y pie tal cual los mandó la
 * persona); esta ficha es el pie de foto que dice de quién era. Van separadas
 * porque el pie original NO se toca: sustituirlo por texto nuestro tiraría la
 * mitad de la presentación.
 */
export const buildIntroductionMirrorCard = (input: {
  readonly telegramUserId: bigint;
  readonly displayName: string;
  readonly username: string | null;
  /** La que leyó el detector, cuando leyó alguna. Informativa. */
  readonly age: number | null;
  readonly chatTitle: string | null;
  /**
   * Si la copia del mensaje llegó a publicarse.
   *
   * Cuando no llega (el grupo tiene el contenido protegido, o Telegram dijo que
   * no), la ficha lo DICE en vez de salir sola y en silencio: una ficha suelta
   * sin la foto encima se lee como que la persona no mandó nada, que es
   * justamente lo contrario de lo que pasó.
   */
  readonly copied: boolean;
}): string => {
  const alias = input.username ? ` (@${escapeHtml(input.username)})` : "";
  const donde = input.chatTitle
    ? ` en <b>${escapeHtml(input.chatTitle)}</b>`
    : "";
  const lines = [
    `✅ <b>Se ha presentado</b>${donde}`,
    "",
    `👤 ${mentionHtml(input.telegramUserId, input.displayName)}${alias}`,
    // El ID va aparte y en monoespaciado aunque el nombre ya lo lleve: un alias
    // se cambia en dos segundos y el ID es lo unico con lo que se puede buscar
    // a alguien meses despues.
    `🆔 <code>${input.telegramUserId.toString()}</code>`,
  ];
  if (input.age !== null) {
    lines.push(`🎂 Dice tener <b>${input.age}</b>`);
  }
  if (!input.copied) {
    lines.push(
      "",
      "⚠️ No he podido copiar aquí su mensaje. Está en el grupo — el botón lleva a él.",
    );
  }
  return lines.join("\n");
};

/** Un solo botón: el camino de vuelta al mensaje original. */
export const buildIntroductionMirrorKeyboard = (
  link: string | null,
): Record<string, unknown> => ({
  inline_keyboard: link ? [[{ text: "🔗 Ver en el grupo", url: link }]] : [],
});

// --- El comando del espejo -------------------------------------------------

export type IntroductionMirrorCommand =
  /** Ver dónde van las presentaciones ahora mismo. */
  | { readonly kind: "show" }
  /** Encenderlo, opcionalmente en un tema concreto. */
  | { readonly kind: "on"; readonly staffThreadId: number | null }
  | { readonly kind: "off" };

export const INTRODUCTION_MIRROR_USAGE = [
  "🪞 <b>Presentaciones en STAFF</b>",
  "",
  "Copia a vuestra sala de STAFF cada presentación que se da por buena, y manda al mismo tema las fichas de quien <b>no</b> se presentó.",
  "",
  "• <code>/presentaciones on</code> — encenderlo (va al tema de Guardian).",
  "• <code>/presentaciones on 13523</code> — encenderlo en un tema concreto.",
  "• <code>/presentaciones off</code> — apagarlo.",
  "",
  "Para saber el número del tema: abre ese tema en el grupo de STAFF y manda <code>/topicid</code> dentro.",
].join("\n");

const MIRROR_THREAD_PATTERN = /^\d{1,10}$/u;

const INTRODUCTION_MIRROR_COMMANDS = new Set([
  "presentaciones",
  "temapresentaciones",
]);

/**
 * Devuelve null cuando el update no trae este comando — el enrutador los prueba
 * en cadena y este tiene que dejar pasar los ajenos.
 */
export const parseIntroductionMirrorCommand = (
  name: string | undefined,
  args: readonly string[] = [],
): IntroductionMirrorCommand | null => {
  if (!name || !INTRODUCTION_MIRROR_COMMANDS.has(name)) {
    return null;
  }
  const primero = args[0]?.toLowerCase();

  if (primero === undefined) {
    return { kind: "show" };
  }
  if (primero === "off" || primero === "no" || primero === "apagar") {
    return { kind: "off" };
  }
  if (primero === "on" || primero === "si" || primero === "sí") {
    const tema = args[1];
    const numero =
      tema && MIRROR_THREAD_PATTERN.test(tema) ? Number.parseInt(tema, 10) : 0;
    return { kind: "on", staffThreadId: numero > 0 ? numero : null };
  }
  // `/presentaciones 13523` sin el "on": es lo que va a escribir cualquiera que
  // acabe de copiar el numero del tema, y negarselo por una palabra seria un no
  // gratuito.
  if (MIRROR_THREAD_PATTERN.test(primero)) {
    const numero = Number.parseInt(primero, 10);
    if (numero > 0) {
      return { kind: "on", staffThreadId: numero };
    }
  }
  return { kind: "show" };
};

/** Lo que se responde a `/presentaciones` a secas y después de cada cambio. */
export const formatIntroductionMirrorState = (input: {
  readonly settings: IntroductionSettings;
  readonly staffChatConfigured: boolean;
}): string => {
  if (!input.staffChatConfigured) {
    // Encenderlo sin sala a la que mandar las copias seria un interruptor que
    // se queda en "on" y no publica nada — la forma mas fiable de que alguien
    // de por hecho que hay registro cuando no lo hay.
    return [
      "🪞 <b>Presentaciones en STAFF</b>",
      "",
      "Este grupo no tiene sala de STAFF configurada, así que no hay a dónde mandarlas.",
      "Configúrala primero en el panel de Guardian.",
    ].join("\n");
  }
  const donde =
    input.settings.staffThreadId === null
      ? "el tema de siempre (el de Guardian)"
      : `el tema <code>${input.settings.staffThreadId}</code>`;

  if (!input.settings.mirrorToStaff) {
    return [
      "🪞 La copia de presentaciones está <b>apagada</b>.",
      "",
      `Las fichas de quien no se presenta sí siguen yendo a ${donde}.`,
      "",
      INTRODUCTION_MIRROR_USAGE,
    ].join("\n");
  }
  return [
    `🪞 La copia de presentaciones está <b>encendida</b> y va a ${donde}.`,
    "",
    "Ahí caen las dos cosas: cada presentación que se da por buena (el mensaje tal cual, con quién es debajo) y las fichas de quien no se presentó a tiempo.",
    // Encendido sobre una puerta apagada no copia nada, y callarlo dejaria al
    // equipo esperando presentaciones que nadie va a juzgar.
    ...(input.settings.enabled
      ? []
      : [
          "",
          "⚠️ Ojo: la presentación obligatoria está <b>apagada</b> en este grupo, así que no se juzga ninguna y no se va a copiar nada.",
        ]),
    "",
    "Para apagarlo: <code>/presentaciones off</code>",
  ].join("\n");
};

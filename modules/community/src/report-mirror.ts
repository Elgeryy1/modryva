/**
 * El espejo de reportes: cada `@admin` del grupo, copiado al tema de REPORTES
 * de la sala de STAFF, con un boton que lleva al mensaje y otro para darlo por
 * resuelto.
 *
 * `@admin` ya menciona al equipo DENTRO del grupo, y eso seguira estando: es lo
 * que hace que alguien acuda en el momento. Pero esa mencion vive en el grupo,
 * donde se la come el siguiente mensaje, y el equipo no tiene forma de saber si
 * alguien la atendio o si se quedo ahi. Un tema aparte convierte cada aviso en
 * una fila con dos estados — abierto o resuelto — que se puede mirar de un
 * vistazo un rato despues.
 *
 * Puro: sin reloj, sin red, sin base de datos.
 */

// --- Ajustes ---------------------------------------------------------------

/**
 * Clave en el almacen compartido `chat_settings` — un objeto pequeño por chat,
 * sin tabla propia (mismo criterio que el parte de sanciones y la puerta de
 * presentaciones).
 */
export const REPORT_MIRROR_SETTINGS_KEY = "report_mirror";

export interface ReportMirrorSettings {
  readonly enabled: boolean;
  /**
   * Tema de la sala de STAFF donde va el aviso.
   *
   * `null` = el mismo tema que usa Guardian. Deliberadamente NO es una sala
   * aparte: tener dos ajustes de "donde avisa el bot al equipo" garantiza que
   * uno de los dos acabe sin configurar, y este repo ya tiene esa cicatriz.
   */
  readonly staffThreadId: number | null;
}

export const defaultReportMirrorSettings: ReportMirrorSettings = {
  enabled: false,
  staffThreadId: null,
};

/**
 * Lee los ajustes a la defensiva: cualquier cosa ausente o corrupta vuelve al
 * valor por defecto, y `enabled` tiene que ser `true` explicito. Una fila
 * ilegible no puede ser lo que empieza a copiar mensajes de gente a otra sala.
 */
export const parseReportMirrorSettings = (
  value: unknown,
): ReportMirrorSettings => {
  if (typeof value !== "object" || value === null) {
    return defaultReportMirrorSettings;
  }
  const raw = value as Record<string, unknown>;
  // Un message_thread_id de Telegram es un entero positivo. Cualquier otra cosa
  // vuelve a null, que significa "el tema de siempre" — nunca un tema
  // inventado, que mandaria los avisos a un sitio donde nadie los mira.
  const tema =
    typeof raw.staffThreadId === "number" &&
    Number.isInteger(raw.staffThreadId) &&
    raw.staffThreadId > 0
      ? raw.staffThreadId
      : null;
  return { enabled: raw.enabled === true, staffThreadId: tema };
};

// --- Enlace al mensaje -----------------------------------------------------

/**
 * El enlace `t.me/c/...` a un mensaje concreto.
 *
 * Solo existe para supergrupos y canales, que son los unicos cuyo id empieza
 * por `-100`: en un grupo normal Telegram no da forma de enlazar un mensaje, y
 * devolver algo inventado pondria un boton que lleva a un error. `null`
 * significa "no hay enlace posible", y quien lo pinta se limita a no pintar el
 * boton.
 *
 * El tema va en el enlace cuando se conoce. Sin el, Telegram tambien abre el
 * mensaje, pero abrirlo dentro de su tema es lo que deja al staff leer la
 * conversacion de alrededor, que es justo lo que hace falta para juzgar.
 */
export const buildTelegramMessageLink = (input: {
  readonly chatId: bigint;
  readonly messageId: number;
  readonly topicId?: number | undefined;
}): string | null => {
  const raw = input.chatId.toString();
  if (!raw.startsWith("-100") || raw.length <= 4) {
    return null;
  }
  if (!Number.isInteger(input.messageId) || input.messageId <= 0) {
    return null;
  }
  const interno = raw.slice(4);
  const tema =
    input.topicId !== undefined &&
    Number.isInteger(input.topicId) &&
    input.topicId > 0
      ? `${input.topicId.toString()}/`
      : "";
  return `https://t.me/c/${interno}/${tema}${input.messageId.toString()}`;
};

// --- La ficha --------------------------------------------------------------

/**
 * Escapa lo que Telegram interpretaria como etiquetas. El texto lo escribe
 * quien reporta, asi que un "@admin <b>" no puede romper el formato de la ficha
 * ni inyectar marcado en el resto del mensaje.
 *
 * Privado a proposito: `introduction.ts` exporta otro con el mismo nombre y el
 * modulo entero se reexporta desde un solo `index.ts`, asi que exportarlo aqui
 * seria una colision esperando.
 */
const escapeHtml = (raw: string): string =>
  raw.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");

/** Enlace pulsable a una persona, que funciona aunque no tenga @alias. */
const mention = (telegramUserId: bigint, displayName: string): string =>
  `<a href="tg://user?id=${telegramUserId.toString()}">${escapeHtml(displayName)}</a>`;

/** De donde sale el aviso: alguien escribio `@admin`, o alguien uso `/report`. */
export type ReportMirrorSource = "mention" | "command";

export interface ReportMirrorEntry {
  readonly source: ReportMirrorSource;
  /** Quien avisa, ya legible ("Dani" o "@dani"). */
  readonly reporter: string;
  readonly reporterTelegramUserId: bigint | undefined;
  /** Lo que escribio despues de `@admin`, o el motivo de `/report`. */
  readonly text: string | undefined;
  readonly chatTitle: string | null;
  /**
   * A quien señala, cuando se sabe: `@admin` respondiendo a un mensaje, o el
   * objetivo de `/report`. La mayoria de los avisos utiles son de este tipo, y
   * sin esta linea el staff tiene que abrir el enlace solo para saber de quien
   * se habla.
   */
  readonly reported:
    | { readonly name: string; readonly telegramUserId: bigint }
    | undefined;
}

/** La ficha que se publica en el tema de REPORTES, en HTML. */
export const buildReportMirrorCard = (entry: ReportMirrorEntry): string => {
  const lines: string[] = [
    entry.source === "mention"
      ? "🚨 <b>AVISO AL EQUIPO</b>"
      : "🚨 <b>REPORTE</b>",
    "",
  ];

  lines.push(
    `🙋 <b>Avisa:</b> ${
      entry.reporterTelegramUserId
        ? mention(entry.reporterTelegramUserId, entry.reporter)
        : escapeHtml(entry.reporter)
    }`,
  );

  if (entry.reported) {
    lines.push(
      `👤 <b>Sobre:</b> ${mention(entry.reported.telegramUserId, entry.reported.name)}`,
    );
    // El ID va aparte y en monoespaciado aunque el nombre ya lo lleve: un alias
    // se cambia en dos segundos y el ID es lo unico con lo que se puede buscar
    // a alguien meses despues.
    lines.push(`🆔 <code>${entry.reported.telegramUserId.toString()}</code>`);
  }

  const dicho = entry.text?.trim();
  if (dicho) {
    // En cita y truncado: un `@admin` con media conversacion pegada dentro no
    // puede empujar los botones fuera de la pantalla del que lo tiene que
    // atender.
    const recortado = dicho.length > 700 ? `${dicho.slice(0, 699)}…` : dicho;
    lines.push("", `<blockquote>${escapeHtml(recortado)}</blockquote>`);
  }

  if (entry.chatTitle) {
    lines.push("", `📍 <b>Grupo:</b> ${escapeHtml(entry.chatTitle)}`);
  }

  return lines.join("\n");
};

// --- Los botones -----------------------------------------------------------

export const REPORT_MIRROR_CALLBACK = "rpm";

/**
 * Lo que viaja en el boton de "resuelto": el chat y el mensaje a los que
 * apunta la ficha.
 *
 * No es un identificador de fila porque no hay fila: resolver un aviso es
 * editar la ficha que tienes delante, y para eso basta con el mensaje del
 * callback. Lo que si hace falta es poder REHACER el boton del enlace al
 * editar — Telegram tira el teclado entero en cualquier edicion que no lo
 * mande — y esos dos numeros son justo lo que hace falta para eso.
 */
export interface ReportResolveCallback {
  readonly telegramChatId: bigint;
  readonly messageId: number;
}

export const buildReportResolveCallback = (
  input: ReportResolveCallback,
): string =>
  `${REPORT_MIRROR_CALLBACK}:${input.telegramChatId.toString()}:${input.messageId.toString()}`;

/**
 * Devuelve null para cualquier cosa que no sea nuestra — el enrutador de
 * callbacks los prueba en cadena y este tiene que dejar pasar los ajenos.
 */
export const parseReportResolveCallback = (
  data: string | undefined,
): ReportResolveCallback | null => {
  if (!data) {
    return null;
  }
  const parts = data.split(":");
  if (parts.length !== 3 || parts[0] !== REPORT_MIRROR_CALLBACK) {
    return null;
  }
  const [, chat, message] = parts;
  if (
    !chat ||
    !message ||
    !/^-?\d{1,20}$/u.test(chat) ||
    !/^\d{1,10}$/u.test(message)
  ) {
    return null;
  }
  // El 0 se acepta: significa "esta ficha no tenia mensaje al que enlazar".
  // Rechazarlo dejaria el boton de resuelto sin hacer nada justo en las fichas
  // que ya venian sin enlace, que son las mas dificiles de atender.
  return {
    telegramChatId: BigInt(chat),
    messageId: Number.parseInt(message, 10),
  };
};

/**
 * El teclado de la ficha: ir al mensaje y darlo por resuelto.
 *
 * `link` puede faltar (grupo sin enlaces posibles) y entonces el boton no se
 * pinta. Un boton que lleva a un error es peor que no tenerlo: se pulsa una
 * vez, falla, y a partir de ahi nadie se fia del resto de la ficha.
 */
export const buildReportMirrorKeyboard = (input: {
  readonly link: string | null;
  readonly resolveData: string;
}): Record<string, unknown> => ({
  inline_keyboard: [
    [
      ...(input.link ? [{ text: "🔗 Ir al mensaje", url: input.link }] : []),
      { text: "✅ Resuelto", callback_data: input.resolveData },
    ],
  ],
});

/**
 * El teclado de una ficha ya resuelta: se queda el enlace y desaparece el
 * boton.
 *
 * El enlace sobrevive a proposito. Quien abre el tema una semana despues suele
 * venir a leer QUE paso, y quitarle el camino al mensaje original convierte el
 * historial en una lista de titulares.
 */
export const buildReportResolvedKeyboard = (
  link: string | null,
): Record<string, unknown> => ({
  inline_keyboard: link ? [[{ text: "🔗 Ir al mensaje", url: link }]] : [],
});

/**
 * La ficha una vez atendida. Sustituye a la anterior: quien llega tarde tiene
 * que ver QUE se decidio y QUIEN lo decidio, no un boton que ya no hace nada.
 */
export const buildReportResolved = (input: {
  readonly card: string;
  readonly resolvedBy: string;
}): string => `${input.card}\n\n✅ <b>Resuelto</b> por ${input.resolvedBy}.`;

/** Lo que se responde a quien pulsa "resuelto" sin poder. */
export const REPORT_MIRROR_FORBIDDEN =
  "Solo el staff puede dar un aviso por resuelto.";

// --- El comando ------------------------------------------------------------

export type ReportMirrorCommand =
  /** Ver donde van los avisos ahora mismo. */
  | { readonly kind: "show" }
  /** Encenderlo, opcionalmente en un tema concreto. */
  | { readonly kind: "on"; readonly staffThreadId: number | null }
  | { readonly kind: "off" };

export const REPORT_MIRROR_USAGE = [
  "🚨 <b>Avisos al equipo en STAFF</b>",
  "",
  "Copia cada <code>@admin</code> y cada <code>/report</code> del grupo a vuestra sala de STAFF, con un botón que lleva al mensaje y otro para darlo por resuelto.",
  "",
  "• <code>/reportes on</code> — encenderlo (va al tema de Guardian).",
  "• <code>/reportes on 7</code> — encenderlo en un tema concreto.",
  "• <code>/reportes off</code> — apagarlo.",
  "",
  "Para saber el número del tema: abre ese tema en el grupo de STAFF y manda <code>/topicid</code> dentro.",
].join("\n");

const THREAD_PATTERN = /^\d{1,10}$/u;

const REPORT_MIRROR_COMMANDS = new Set(["reportes", "partereportes", "avisos"]);

/**
 * Devuelve null cuando el update no trae este comando — el enrutador los prueba
 * en cadena y este tiene que dejar pasar los ajenos.
 */
export const parseReportMirrorCommand = (
  name: string | undefined,
  args: readonly string[] = [],
): ReportMirrorCommand | null => {
  if (!name || !REPORT_MIRROR_COMMANDS.has(name)) {
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
      tema && THREAD_PATTERN.test(tema) ? Number.parseInt(tema, 10) : 0;
    return { kind: "on", staffThreadId: numero > 0 ? numero : null };
  }
  // `/reportes 7` sin el "on": es lo que va a escribir cualquiera que acabe de
  // copiar el numero del tema, y negarselo por una palabra seria un no gratuito.
  if (THREAD_PATTERN.test(primero)) {
    const numero = Number.parseInt(primero, 10);
    if (numero > 0) {
      return { kind: "on", staffThreadId: numero };
    }
  }
  return { kind: "show" };
};

/** Lo que se responde a `/reportes` a secas y despues de cada cambio. */
export const formatReportMirrorState = (input: {
  readonly settings: ReportMirrorSettings;
  readonly staffChatConfigured: boolean;
}): string => {
  if (!input.staffChatConfigured) {
    // Encenderlo sin sala a la que mandar los avisos seria un interruptor que
    // se queda en "on" y no publica nada — la forma mas fiable de que alguien
    // de por hecho que hay registro cuando no lo hay.
    return [
      "🚨 <b>Avisos al equipo en STAFF</b>",
      "",
      "Este grupo no tiene sala de STAFF configurada, así que no hay a dónde mandarlos.",
      "Configúrala primero en el panel de Guardian.",
    ].join("\n");
  }
  if (!input.settings.enabled) {
    return `🚨 La copia de avisos está <b>apagada</b>.\n\n${REPORT_MIRROR_USAGE}`;
  }
  const donde =
    input.settings.staffThreadId === null
      ? "el tema de siempre (el de Guardian)"
      : `el tema <code>${input.settings.staffThreadId}</code>`;
  return [
    `🚨 La copia de avisos está <b>encendida</b> y va a ${donde}.`,
    "",
    "Cada <code>@admin</code> y cada <code>/report</code> abre una ficha ahí, con quién avisa, sobre quién, qué dijo, un botón al mensaje y otro para darlo por resuelto.",
    "",
    "En el grupo no cambia nada: <code>@admin</code> sigue mencionando al equipo igual que siempre.",
    "",
    "Para apagarlo: <code>/reportes off</code>",
  ].join("\n");
};

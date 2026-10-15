/**
 * El parte de sanciones: cada accion de moderacion, publicada en el tema que el
 * grupo elija de la sala de STAFF.
 *
 * Lo pidieron los administradores, y lo pidieron porque ya lo hacian a mano —
 * escribiendo "Ban -> @fulano - 26 años" en un tema llamado SANCIONES. Un parte
 * escrito a mano se olvida el dia que hay prisa, y justo ese dia es cuando hace
 * falta saber quien sanciono a quien.
 *
 * Puro: sin reloj, sin red, sin base de datos.
 */

import type { TelegramUpdateEnvelope } from "@superbot/domain";

// --- Ajustes ---------------------------------------------------------------

/**
 * Clave en el almacen compartido `chat_settings` — un objeto pequeño por chat,
 * sin tabla propia (mismo criterio que el guardia de admins y la puerta de
 * presentaciones).
 */
export const SANCTIONS_LOG_SETTINGS_KEY = "sanctions_log";

export interface SanctionsLogSettings {
  readonly enabled: boolean;
  /**
   * Tema de la sala de STAFF donde va el parte.
   *
   * `null` = el mismo tema que usa Guardian. Deliberadamente NO es una sala
   * aparte: tener dos ajustes de "donde avisa el bot al equipo" garantiza que
   * uno de los dos acabe sin configurar, y este repo ya tiene esa cicatriz.
   */
  readonly staffThreadId: number | null;
}

export const defaultSanctionsLogSettings: SanctionsLogSettings = {
  enabled: false,
  staffThreadId: null,
};

/**
 * Lee los ajustes a la defensiva: cualquier cosa ausente o corrupta vuelve al
 * valor por defecto, y `enabled` tiene que ser `true` explicito. Una fila
 * ilegible no puede ser lo que empieza a publicar nombres de gente en una sala.
 */
export const parseSanctionsLogSettings = (
  value: unknown,
): SanctionsLogSettings => {
  if (typeof value !== "object" || value === null) {
    return defaultSanctionsLogSettings;
  }
  const raw = value as Record<string, unknown>;
  // Un message_thread_id de Telegram es un entero positivo. Cualquier otra cosa
  // vuelve a null, que significa "el tema de siempre" — nunca un tema inventado,
  // que mandaria el parte a un sitio donde nadie lo mira.
  const tema =
    typeof raw.staffThreadId === "number" &&
    Number.isInteger(raw.staffThreadId) &&
    raw.staffThreadId > 0
      ? raw.staffThreadId
      : null;
  return { enabled: raw.enabled === true, staffThreadId: tema };
};

// --- El parte --------------------------------------------------------------

export type SanctionsLogAction =
  | "ban"
  | "mute"
  | "kick"
  | "warn"
  | "unban"
  | "unmute";

/**
 * Titulo por accion. Se separa el castigo (rojo) de la marcha atras (verde)
 * porque quien abre el tema para revisar lo que ha pasado necesita distinguirlos
 * de un vistazo, sin leer.
 */
const TITLES: Record<SanctionsLogAction, string> = {
  ban: "🔨 <b>BAN</b>",
  mute: "🔇 <b>SILENCIO</b>",
  kick: "🚪 <b>EXPULSIÓN</b>",
  warn: "⚠️ <b>AVISO</b>",
  unban: "♻️ <b>BAN RETIRADO</b>",
  unmute: "🔊 <b>SILENCIO RETIRADO</b>",
};

/**
 * Escapa lo que Telegram interpretaria como etiquetas. Los nombres los elige
 * quien los lleva, asi que un admin llamado `<b>` no puede romper el formato del
 * parte ni inyectar marcado en el resto del mensaje.
 *
 * Privado a proposito: `module-community` exporta otro con el mismo nombre y el
 * bot importa de los dos, asi que exportarlo aqui seria una colision esperando.
 */
const escapeHtml = (raw: string): string =>
  raw.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");

export interface SanctionsLogEntry {
  readonly action: SanctionsLogAction;
  /** Quien la ejecuto, ya legible ("Dani" o "@dani"). */
  readonly admin: string;
  /** A quien, ya legible. */
  readonly target: string;
  readonly targetTelegramUserId: bigint;
  readonly reason: string | undefined;
  readonly chatTitle: string | null;
  readonly caseNumber: number | undefined;
  /** "2/3" en los avisos; nada en el resto. */
  readonly warnCount: string | undefined;
  /** Duracion de un silencio temporal. `undefined` = indefinido. */
  readonly durationMs: number | undefined;
  /**
   * El error de Telegram cuando la accion NO se pudo aplicar.
   *
   * Este campo es el motivo de que este parte valga algo. Un registro que
   * anuncia "BAN" de un baneo que Telegram rechazo es peor que no tener
   * registro: el equipo da por resuelto un caso que sigue abierto, y solo se
   * entera cuando la persona vuelve a escribir.
   */
  readonly enforcementFailure: string | undefined;
}

/** "10 m", "2 h", "7 d" — la forma en que se escribio el comando. */
const formatDuration = (durationMs: number): string => {
  const minutos = Math.round(durationMs / 60_000);
  if (minutos < 60) {
    return `${minutos} min`;
  }
  const horas = minutos / 60;
  if (horas < 24) {
    return Number.isInteger(horas) ? `${horas} h` : `${horas.toFixed(1)} h`;
  }
  const dias = horas / 24;
  return Number.isInteger(dias) ? `${dias} d` : `${dias.toFixed(1)} d`;
};

/** El parte que se publica en el tema de SANCIONES, en HTML. */
export const buildSanctionsLogEntry = (entry: SanctionsLogEntry): string => {
  const lines: string[] = [TITLES[entry.action], ""];

  lines.push(`👮 <b>Admin:</b> ${escapeHtml(entry.admin)}`);
  // Quien describe al usuario ya suele meter el id entre parentesis, y aqui va
  // ademas en su propia linea. Verlo dos veces en dos renglones es ruido justo
  // en el sitio donde menos sobra.
  const target = entry.target
    .replace(
      new RegExp(`\\s*\\(${entry.targetTelegramUserId}\\)\\s*$`, "u"),
      "",
    )
    .trim();
  lines.push(
    `👤 <b>Usuario:</b> ${escapeHtml(target.length > 0 ? target : entry.target)}`,
  );
  // El ID va aparte y en monoespaciado aunque el nombre ya lo lleve: un alias se
  // cambia en dos segundos y el ID es lo unico con lo que se puede buscar a
  // alguien meses despues.
  lines.push(`🆔 <code>${entry.targetTelegramUserId.toString()}</code>`);
  lines.push(`📝 <b>Motivo:</b> ${escapeHtml(entry.reason ?? "sin motivo")}`);

  if (entry.action === "mute") {
    // "indefinido" explicito y no una linea ausente: un silencio sin fecha de
    // caducidad es la diferencia entre una tarde y para siempre, y quien lee el
    // parte tiene que verlo sin deducirlo de que falte un campo.
    lines.push(
      `⏱ <b>Duración:</b> ${entry.durationMs === undefined ? "indefinido" : formatDuration(entry.durationMs)}`,
    );
  }
  if (entry.warnCount) {
    lines.push(`📊 <b>Avisos:</b> ${escapeHtml(entry.warnCount)}`);
  }
  if (entry.chatTitle) {
    lines.push(`📍 <b>Grupo:</b> ${escapeHtml(entry.chatTitle)}`);
  }
  if (entry.caseNumber !== undefined) {
    lines.push(`🗂 <b>Caso:</b> #${entry.caseNumber}`);
  }

  if (entry.enforcementFailure) {
    lines.push(
      "",
      `⚠️ <b>Telegram lo rechazó:</b> ${escapeHtml(entry.enforcementFailure)}`,
      "El caso queda registrado, pero la acción NO se aplicó. Hay que hacerlo a mano.",
    );
  }

  return lines.join("\n");
};

// --- El comando ------------------------------------------------------------

export type SanctionsLogCommand =
  /** Ver donde va el parte ahora mismo. */
  | { readonly kind: "show" }
  /** Encenderlo, opcionalmente en un tema concreto. */
  | { readonly kind: "on"; readonly staffThreadId: number | null }
  | { readonly kind: "off" };

export const SANCTIONS_LOG_USAGE = [
  "📋 <b>Parte de sanciones</b>",
  "",
  "Publica cada ban, expulsión, silencio y aviso en vuestra sala de STAFF.",
  "",
  "• <code>/sanciones on</code> — encenderlo (va al tema de Guardian).",
  "• <code>/sanciones on 187</code> — encenderlo en un tema concreto.",
  "• <code>/sanciones off</code> — apagarlo.",
  "",
  "Para saber el número del tema: abre ese tema en el grupo de STAFF y manda <code>/topicid</code> dentro.",
].join("\n");

const THREAD_PATTERN = /^\d{1,10}$/u;

/**
 * Devuelve null cuando el update no trae este comando — el enrutador los prueba
 * en cadena y este tiene que dejar pasar los ajenos.
 */
export const parseSanctionsLogCommand = (
  update: TelegramUpdateEnvelope,
): SanctionsLogCommand | null => {
  const name = update.command?.name;
  if (name !== "sanciones" && name !== "partesanciones") {
    return null;
  }
  const args = update.command?.args ?? [];
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
  // `/sanciones 187` sin el "on": es lo que va a escribir cualquiera que acabe
  // de copiar el numero del tema, y negarselo por una palabra seria un no
  // gratuito.
  if (THREAD_PATTERN.test(primero)) {
    const numero = Number.parseInt(primero, 10);
    if (numero > 0) {
      return { kind: "on", staffThreadId: numero };
    }
  }
  return { kind: "show" };
};

/** Lo que se responde a `/sanciones` a secas y despues de cada cambio. */
export const formatSanctionsLogState = (input: {
  readonly settings: SanctionsLogSettings;
  readonly staffChatConfigured: boolean;
}): string => {
  if (!input.staffChatConfigured) {
    // Encenderlo sin sala a la que mandar el parte seria un interruptor que se
    // queda en "on" y no publica nada — la forma mas fiable de que alguien de
    // por hecho que hay registro cuando no lo hay.
    return [
      "📋 <b>Parte de sanciones</b>",
      "",
      "Este grupo no tiene sala de STAFF configurada, así que no hay a dónde mandarlo.",
      "Configúrala primero en el panel de Guardian.",
    ].join("\n");
  }
  if (!input.settings.enabled) {
    return `📋 El parte de sanciones está <b>apagado</b>.\n\n${SANCTIONS_LOG_USAGE}`;
  }
  const donde =
    input.settings.staffThreadId === null
      ? "el tema de siempre (el de Guardian)"
      : `el tema <code>${input.settings.staffThreadId}</code>`;
  return [
    `📋 El parte de sanciones está <b>encendido</b> y va a ${donde}.`,
    "",
    "Se publica cada ban, expulsión, silencio, aviso y sus marchas atrás, con quién lo hizo y por qué.",
    "",
    "Para apagarlo: <code>/sanciones off</code>",
  ].join("\n");
};

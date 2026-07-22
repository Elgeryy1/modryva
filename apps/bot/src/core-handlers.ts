import type { BotReply, TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Extracts the sender's first name from the raw Telegram update, for greeting
 * personalization. Returns undefined when the shape does not match.
 */
export const extractFirstName = (raw: unknown): string | undefined => {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }

  const container = raw as {
    message?: unknown;
    callback_query?: unknown;
  };
  const source =
    (typeof container.message === "object" && container.message !== null
      ? container.message
      : undefined) ??
    (typeof container.callback_query === "object" &&
    container.callback_query !== null
      ? container.callback_query
      : undefined);

  if (typeof source !== "object" || source === null) {
    return undefined;
  }

  const from = (source as { from?: unknown }).from;

  if (typeof from !== "object" || from === null) {
    return undefined;
  }

  const firstName = (from as { first_name?: unknown }).first_name;

  return typeof firstName === "string" && firstName.trim().length > 0
    ? firstName.trim()
    : undefined;
};

/**
 * The GroupHelp-style home screen: a compact welcome plus a keyboard whose first
 * row is a deep link that opens Telegram's "add me to a group as admin" flow.
 */
const buildHomeMenu = (botUsername: string): Record<string, unknown> => ({
  inline_keyboard: [
    [
      {
        text: "➕ Añádeme a un grupo",
        url: `https://t.me/${botUsername}?startgroup=true&admin=change_info+delete_messages+restrict_members+invite_users+pin_messages+promote_members`,
      },
    ],
    [
      { text: "🛡 Moderación", callback_data: "menu:moderation" },
      { text: "🌊 Antispam", callback_data: "menu:antispam" },
    ],
    [
      { text: "🎮 Comunidad", callback_data: "menu:community" },
      { text: "👮 Admin", callback_data: "menu:admin" },
    ],
    [
      { text: "🎲 Diversión", callback_data: "menu:fun" },
      { text: "🧰 Utilidades", callback_data: "menu:utils" },
    ],
    [
      { text: "🤖 IA y automatización", callback_data: "menu:tools" },
      { text: "💳 Pagos", callback_data: "menu:pay" },
    ],
    [
      { text: "📊 Estado", callback_data: "menu:status" },
      { text: "❓ Guía", callback_data: "menu:help" },
    ],
  ],
});

const backRow = [{ text: "🔙 Volver", callback_data: "menu:home" }];

const withBack = (rows: unknown[] = []): Record<string, unknown> => ({
  inline_keyboard: [...rows, backRow],
});

const homeText = (firstName: string | undefined): string => {
  const greeting = firstName ? `Hola *${firstName}*!` : "Hola!";
  return [
    `👋 ${greeting}`,
    "",
    "Soy *Modryva*, el bot todo-en-uno para administrar y dar vida a tus grupos: moderación, antispam, bienvenidas, reputación, juegos, utilidades, pagos con Stars e *IA*.",
    "",
    "💬 En privado escribeme directamente y te respondo con IA.",
    "👥 Para gestionar un grupo, añádeme con el botón de abajo y dame permisos de admin.",
    "",
    "Elige una sección 👇",
  ].join("\n");
};

interface Section {
  readonly title: string;
  readonly lines: readonly string[];
}

const sections: Record<string, Section> = {
  moderation: {
    title: "🛡 *Moderación y sanciones*",
    lines: [
      "Requiere que sea admin del grupo.",
      "",
      "🌐 *Federaciones:* /newfed /joinfed /leavefed /chatfed · /fban /unfban /fedstat · /fedadmins /fpromote /fdemote · /fedinfo /setfedlog /subfed /fedexport /fedimport",
      "",
      "/warn — avisar a un usuario (responde a su mensaje)",
      "/ban /unban — banear o readmitir",
      "/mute /unmute — silenciar (soporta duración: /mute 30m)",
      "/kick — expulsar sin banear",
      "/warnings /unwarn /resetwarn — gestionar avisos",
      "/purge <n> — borrar los últimos N mensajes",
      "/report — avisar a los admins",
    ],
  },
  antispam: {
    title: "🌊 *Antispam y protección*",
    lines: [
      "💡 Todo esto también se configura con botones en ⚙️ /settings.",
      "",
      "/antiflood_on — activar control de flood",
      "/antiflood_limit <n> /antiflood_action — ajustar límite y castigo",
      "/antiraid_on /antiraid_mode — protección contra raids",
      "/captcha_on /captcha_mode /captcha_action — verificación de entrada",
      "/lock /unlock /locks — bloquear tipos de contenido (enlaces, media...)",
    ],
  },
  community: {
    title: "🎮 *Comunidad y contenido*",
    lines: [
      "/save /get /notes /clear — notas del grupo (recupera con #nombre)",
      "/filter /filters /stop — respuestas automaticas",
      "/setwelcome /welcome /setrules /rules — bienvenida y reglas",
      "/rep /top /level — reputación y niveles por actividad",
      "/invites /inviters — referidos",
      "/stats /activity — estadísticas del grupo",
      "/afk [motivo] · /back — ausencias",
      "/poll /quiz /giveaway /gdraw /trivia — encuestas y juegos",
    ],
  },
  admin: {
    title: "👮 *Herramientas de admin*",
    lines: [
      "⚙️ /settings — *panel de configuración del grupo* (bienvenida, antiflood, captcha, locks, antiraid) con botones, desde tu chat privado.",
      "",
      "/pin /unpin — fijar o liberar (responde al mensaje)",
      "/del — borrar el mensaje respondido",
      "/settitle <texto> /setdesc <texto> — título y descripción",
      "/promote [titulo] /demote — gestionar administradores",
      "/invitelink — nuevo enlace de invitación",
      "/admins — lista de administradores",
      "/addcmd /delcmd /cmds — comandos personalizados",
    ],
  },
  fun: {
    title: "🎲 *Diversión*",
    lines: [
      "/q — convierte un mensaje en cita/sticker (responde con /q; /q png para imagen)",
      "/dice /dart /basket /soccer /bowling /slots — dados animados",
      "/roll 2d6 — tiradas clásicas",
      "/coin — cara o cruz",
      "/8ball <pregunta> — la bola magica",
      "/rps — piedra, papel o tijera (con botones)",
      "/love nombre1 | nombre2 — compatibilidad",
      "/rate <algo> — puntuación 0-10",
    ],
  },
  utils: {
    title: "🧰 *Utilidades*",
    lines: [
      "/calc <expresion> — calculadora (+ - * / % ^ y parentesis)",
      "/id — tu ID, el del chat y el del mensaje",
      "/pick a | b | c — elige al azar",
      "/password [longitud] — contraseña segura",
      "/hash <texto> — sha256",
      "/b64 /unb64 — codificar/decodificar base64",
      "/reverse /len /upper /lower — trucos de texto",
    ],
  },
  tools: {
    title: "🤖 *IA y automatización*",
    lines: [
      "En privado hablame sin comandos: respondo con IA.",
      "",
      "/ai <pregunta> — chat con IA",
      "/summarize — resumir un texto",
      "/translate <idioma> <texto> — traducir",
      "/aiforget — borrar la memoria de la conversacion",
      "/rss add <url> — seguir un feed",
      "/webhook add <url> — webhooks salientes",
      "/remind <min> <texto> · /task /tasks — recordatorios y tareas",
      "/ticket /tickets — soporte",
    ],
  },
  pay: {
    title: "💳 *Pagos con Telegram Stars*",
    lines: [
      "/products — catalogo de productos",
      "/buy <id> — comprar con Stars",
      "/addproduct — crear un producto (admins)",
    ],
  },
  status: {
    title: "📊 *Estado de Modryva*",
    lines: [
      "✅ Bot en linea (modo polling)",
      "✅ IA conversacional en chats privados",
      "✅ Router de updates + idempotencia",
      "✅ Persistencia (PostgreSQL) y auditoria",
      "✅ 11 modulos activos: seguridad, comunidad, admin, soporte,",
      "   automatización, archivos, juegos, diversión, utilidades, IA, pagos",
    ],
  },
  help: {
    title: "❓ *Guía rápida*",
    lines: [
      "1. Añádeme a tu grupo con el botón del menú principal.",
      "2. Dame permisos de administrador.",
      "3. Activa lo que quieras: /antiflood_on, /captcha_on, /setwelcome...",
      "4. Escribe cualquier comando; casi todos tienen ayuda si los usas mal.",
      "",
      "En privado, escribeme sin comando y charlamos con IA.",
      "Pulsa una sección para ver todos sus comandos.",
    ],
  },
};

/**
 * Where to send someone who wants the Mini App version of a chat-native menu.
 * Groups can't render `web_app` buttons (Telegram rejects them there), so a
 * group falls back to a plain `url` deep link into the named Mini App with a
 * `startapp` payload; a private chat gets a direct `web_app` button.
 */
export interface MiniAppLink {
  readonly appUrl: string;
  readonly botUsername: string;
  readonly miniAppName: string;
  readonly isGroup: boolean;
}

const buildMiniAppButton = (
  miniApp: MiniAppLink | undefined,
  startapp: string,
  path: string,
  label: string,
): Record<string, unknown> | null => {
  if (!miniApp?.appUrl.startsWith("https://")) {
    return null;
  }
  return miniApp.isGroup
    ? {
        text: label,
        url: `https://t.me/${miniApp.botUsername}/${miniApp.miniAppName}?startapp=${startapp}`,
      }
    : { text: label, web_app: { url: `${miniApp.appUrl}${path}` } };
};

const sectionReply = (key: string, miniApp?: MiniAppLink): BotReply | null => {
  const section = sections[key];

  if (!section) {
    return null;
  }

  const helpButton =
    key === "help"
      ? buildMiniAppButton(
          miniApp,
          "help",
          "/help",
          "📱 Abrir guía en Mini App",
        )
      : null;

  return {
    text: [section.title, "", ...section.lines].join("\n"),
    parseMode: "Markdown",
    replyMarkup: withBack(helpButton ? [[helpButton]] : []),
    edit: true,
  };
};

/**
 * Handles /start, /help, /menu and the other top-level commands. Needs the bot
 * username to build the "add me to a group" deep link, and (for /help)
 * optionally where to point the Mini App button.
 */
export const handleCoreCommand = (
  update: TelegramUpdateEnvelope,
  botUsername: string,
  miniApp?: MiniAppLink,
): BotReply | null => {
  const commandName = update.command?.name;

  if (!commandName) {
    return null;
  }

  switch (commandName) {
    case "start":
    case "menu":
      return {
        text: homeText(extractFirstName(update.raw)),
        parseMode: "Markdown",
        replyMarkup: buildHomeMenu(botUsername),
      };
    case "help": {
      const reply = sectionReply("help", miniApp);
      // As a command (not a callback) it must send a fresh message, not edit.
      return reply ? { ...reply, edit: false } : null;
    }
    // /settings is handled by handleSettings() (the GroupHelp-style panel),
    // which runs before this dispatcher — no stale duplicate here.
    case "status": {
      const reply = sectionReply("status");
      return reply ? { ...reply, edit: false } : null;
    }
    case "cancel":
      return { text: "Flujo cancelado." };
    default:
      return null;
  }
};

/**
 * Handles taps on the core inline menu (`menu:*` callbacks), editing the message
 * in place for GroupHelp-style navigation. Returns null for any other callback
 * so module-specific handlers (captcha, polls, quizzes…) still run.
 */
export const handleCoreCallback = (
  update: TelegramUpdateEnvelope,
  botUsername: string,
  miniApp?: MiniAppLink,
): BotReply | null => {
  const data = update.callbackData;

  if (!data?.startsWith("menu:")) {
    return null;
  }

  const key = data.slice("menu:".length);

  if (key === "home") {
    return {
      text: homeText(extractFirstName(update.raw)),
      parseMode: "Markdown",
      replyMarkup: buildHomeMenu(botUsername),
      edit: true,
    };
  }

  return sectionReply(key, miniApp);
};

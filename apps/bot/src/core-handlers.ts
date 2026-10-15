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
      { text: "🪙 Moneda", callback_data: "menu:economy" },
    ],
    [
      { text: "🧰 Utilidades", callback_data: "menu:utils" },
      { text: "🤖 IA y automatización", callback_data: "menu:tools" },
    ],
    [
      { text: "💳 Pagos", callback_data: "menu:pay" },
      { text: "📊 Estado", callback_data: "menu:status" },
    ],
    [{ text: "❓ Guía", callback_data: "menu:help" }],
  ],
});

const backRow = [{ text: "🔙 Volver", callback_data: "menu:home" }];

const withBack = (rows: unknown[] = []): Record<string, unknown> => ({
  inline_keyboard: [...rows, backRow],
});

const homeText = (firstName: string | undefined): string => {
  // En castellano la exclamacion se abre, y el vocativo lleva su coma. Es la
  // primerisima linea que lee quien abre el bot: sin la apertura suena a
  // traduccion automatica.
  const greeting = firstName ? `¡Hola, *${firstName}*!` : "¡Hola!";
  return [
    `👋 ${greeting}`,
    "",
    "Soy *Modryva*, el bot todo-en-uno para administrar y dar vida a tus grupos: moderación, antispam, bienvenidas, reputación, juegos, utilidades, pagos con Stars e *IA*.",
    "",
    "💬 En privado escríbeme directamente y te respondo con IA.",
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
      "@admin <mensaje> — menciona al equipo (cualquiera, 1 cada 10 min)",
      "/sanciones on <tema> — copia cada sanción al tema de SANCIONES del staff",
      "/reportes on <tema> — copia cada @admin y /report al tema de REPORTES, con botón al mensaje y botón de resuelto",
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
      "/save <nombre> <texto> · /get <nombre> · /notes · /clear <nombre> — notas del grupo (también se recuperan escribiendo #nombre)",
      "/filter <palabra> <respuesta> · /filters · /stop <palabra> — respuestas automáticas",
      "/setwelcome /welcome /setrules /rules — bienvenida y reglas",
      "/info [@usuario|id] — lo que sé de alguien (la tuya, sin argumentos)",
      "/presentado /nopresentado — validar o revocar una presentación (admins)",
      "/presentaciones on <tema> — copia cada presentación al tema del staff",
      "/rep /top /level — reputación y niveles por actividad",
      "/rango /rangos — tu rango por actividad y antigüedad (VIP → Leyenda)",
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
      "/promote [título] /demote — gestionar administradores",
      "/invitelink — nuevo enlace de invitación",
      "/admins — lista de administradores",
      "/addcmd /delcmd /cmds — comandos personalizados",
      "/send <texto> — lo digo yo, tal cual (y borro tu comando)",
      "/cleancommands on|off — borrar el comando en cuanto lo respondo",
    ],
  },
  fun: {
    title: "🎲 *Diversión*",
    lines: [
      "🥇 *Social* — lo enciende un admin desde el panel del grupo:",
      "/pole — reclama tu puesto del día · /pole hoy /pole ranking /pole racha /pole récords",
      "/ruleta — ruleta rusa virtual (siempre juegas tú) · /ruleta estado",
      "/paulo [tema] — frase motivacional absurda",
      "/gato /perro — imágenes de la biblioteca del grupo",
      "/status social — diagnóstico: permisos y por qué la pole automática no va",
      "",
      "/q — convierte un mensaje en cita/sticker (responde con /q; /q png para imagen)",
      "/dice /dart /basket /soccer /bowling /slots — dados animados",
      "/roll 2d6 — tiradas clásicas",
      "/coin — cara o cruz",
      "/8ball <pregunta> — la bola mágica",
      "/rps — piedra, papel o tijera (con botones)",
      "/love nombre1 | nombre2 — compatibilidad",
      "/rate <algo> — puntuación 0-10",
    ],
  },
  economy: {
    title: "🪙 *Moneda del grupo*",
    lines: [
      "Cada grupo tiene su propia moneda y le pone su nombre. Se gana",
      "*hablando*, con un tope diario para que no se pueda granjear.",
      "Se activa en ⚙️ /settings › 💰 Economía y juegos.",
      "",
      "/monedas — lo que tienes y lo que llevas ganado hoy",
      "/checkin — tu bono diario",
      "/ricos — el ranking del grupo",
      "/donar 50 @persona — regalarle monedas a alguien",
      "/movimientos — tu historial",
      "",
      "🥷 *Robar*",
      "/robar @persona — intentar quitarle monedas",
      "Si te pillan pagas una multa, y va directa a tu víctima. No se puede",
      "robar a quien casi no tiene, ni cebarse con la misma persona: tras un",
      "robo queda protegida un rato.",
      "",
      "😈 *La purga*",
      "Una vez al día, a una hora que nadie sabe, se abren unos minutos sin",
      "esperas, sin escudos y con más probabilidad de acertar. El bot avisa",
      "al empezar y cuenta los daños al terminar.",
      "/purga — los admins pueden lanzarla a mano",
      "",
      "🛒 *La tienda*",
      "/comprar — la tienda: lo que se vende, con tu saldo delante",
      "/comprar navaja — llevarte un objeto concreto",
      "/inventario — lo que tienes y lo que te queda de cada cosa",
      "Lo de atacar se elige al robar (/robar @persona navaja); lo de",
      "defenderte salta solo cuando te roban.",
      "",
      "🔐 *Caja fuerte*",
      "/guardar <n> o /guardar todo — poner saldo a salvo de los robos",
      "/sacar <n> — devolverlo a la parte robable",
      "Tiene un tope, y se amplía con /comprar caja.",
      "",
      "🤐 *Mordazas*",
      "/comprar mute1|mute5|mute10 @persona — silenciar a alguien un rato",
      "Son caras, se anuncia en público quién las paga, y la víctima puede",
      "salir antes con /fianza pagando el doble.",
      "",
      "🎰 *Casino*",
      "/comprarfichas <n> — cambiar monedas por fichas",
      "/venderfichas <n> — cambiar fichas por monedas",
      "Las fichas compradas con Stars no se cambian por monedas: así nadie",
      "puede robarte lo que pagaste con dinero.",
    ],
  },
  utils: {
    title: "🧰 *Utilidades*",
    lines: [
      "/calc <expresión> — calculadora (+ - * / % ^ y paréntesis). Ej.: /calc (12+8)*3",
      "/id — tu ID, el del chat y el del mensaje",
      "/pick a | b | c — elige al azar entre las opciones",
      "/password [longitud] — contraseña segura",
      "/hash <texto> — huella sha256 del texto",
      "/b64 <texto> · /unb64 <texto> — codificar y descodificar en base64",
      "/reverse <texto> · /len <texto> · /upper <texto> · /lower <texto> — trucos de texto",
    ],
  },
  tools: {
    title: "🤖 *IA y automatización*",
    lines: [
      "En privado háblame sin comandos: respondo con IA.",
      "",
      "/ai <pregunta> — chat con IA",
      "/summarize — resumir un texto",
      "/translate <idioma> <texto> — traducir",
      "/aiforget — borrar la memoria de la conversación",
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
    // Esta pantalla la abre quien administra un grupo, no quien mantiene el
    // servidor: "modo polling", "Router de updates" e "idempotencia" no le
    // dicen nada. Las propiedades son buenas y merecen contarse en castellano.
    //
    // La lista de areas ademas era FALSA: nombraba dos que no existen como
    // tales, y se dejaba fuera nucleo, guardian y social.
    lines: [
      "✅ Estoy en marcha y respondiendo",
      "✅ Charlo con IA en los chats privados",
      "✅ No repito acciones aunque Telegram me mande el mismo mensaje dos veces",
      "✅ Guardo todo y dejo registro de quién hizo qué",
      "✅ Las 11 áreas están activas: núcleo, seguridad, Guardian, comunidad,",
      "   soporte, automatización, archivos, juegos, social, IA y pagos",
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
      "En privado, escríbeme sin comando y charlamos con IA.",
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

/**
 * Everything the bot knows about one member of one group, rendered as a single
 * chat message plus an action keyboard. Pure: the caller gathers the facts,
 * this decides how to say them.
 *
 * Every field is optional-by-absence rather than zeroed, because "0 mensajes"
 * and "no lo he mirado" are different answers and a dossier that cannot tell
 * them apart is worse than one that admits the gap.
 */

export type DossierMembership =
  | "creator"
  | "administrator"
  | "member"
  | "restricted"
  | "left"
  | "kicked"
  | "unknown";

/** What the group's own permissions let this member do right now. */
export interface DossierPermissions {
  readonly canSendMessages: boolean | undefined;
  readonly canSendMedia: boolean | undefined;
  readonly canSendLinks: boolean | undefined;
  readonly canAddWebPagePreviews: boolean | undefined;
}

export interface UserDossier {
  readonly telegramUserId: bigint;
  readonly username: string | undefined;
  readonly firstName: string | undefined;
  readonly lastName: string | undefined;
  readonly isBot: boolean;
  readonly membership: DossierMembership;
  /** Admin title the group gave them ("Capitán", "Mod"…), if any. */
  readonly customTitle: string | undefined;
  /** Ms since the bot first saw them in this chat; undefined if never seen. */
  readonly seenForMs: number | undefined;
  /** Absolute first-seen instant, so the card can show a real date. */
  readonly firstSeenAt: Date | undefined;
  readonly messages: number | undefined;
  readonly historicalMessages: number | undefined;
  readonly liveMessages: number | undefined;
  /** Ms since their last known message; undefined if they never wrote one. */
  readonly silentForMs: number | undefined;
  readonly activeWarnings: number | undefined;
  readonly warnLimit: number | undefined;
  readonly reputation: number | undefined;
  readonly thanksReceived: number | undefined;
  readonly trustTier: string | undefined;
  readonly languageCode: string | undefined;
  readonly verified: boolean;
  /** Active mute/ban recorded by the bot, if any (e.g. "mute hasta 12:40"). */
  readonly activeSanction: string | undefined;
  readonly permissions: DossierPermissions | undefined;
  /** True when this dossier was assembled about the person who asked for it. */
  readonly isSelf: boolean;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

const MEMBERSHIP_LABEL: Readonly<Record<DossierMembership, string>> = {
  creator: "Creador",
  administrator: "Administrador",
  member: "Miembro",
  restricted: "Restringido",
  left: "Ya no está en el grupo",
  kicked: "Expulsado / baneado",
  unknown: "No he podido comprobarlo",
};

const MEMBERSHIP_BADGE: Readonly<Record<DossierMembership, string>> = {
  creator: "👑",
  administrator: "🛡️",
  member: "✅",
  restricted: "🔇",
  left: "🚪",
  kicked: "⛔",
  unknown: "❔",
};

const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const LANGUAGES: Readonly<Record<string, string>> = {
  es: "Español",
  en: "Inglés",
  pt: "Portugués",
  fr: "Francés",
  it: "Italiano",
  de: "Alemán",
  ca: "Catalán",
  gl: "Gallego",
  eu: "Euskera",
  ar: "Árabe",
  ru: "Ruso",
  ro: "Rumano",
};

/** "12 ago 2026, 10:19" — absolute, because "hace 11 días" hides the date. */
const formatStamp = (date: Date): string => {
  const day = date.getUTCDate();
  const month = MONTHS[date.getUTCMonth()] ?? "?";
  const year = date.getUTCFullYear();
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hh}:${mm}`;
};

/** "3 días", "5 h", "20 min", "ahora mismo". */
const formatElapsed = (ms: number): string => {
  if (ms >= DAY_MS) {
    const days = Math.floor(ms / DAY_MS);
    return days === 1 ? "1 día" : `${days} días`;
  }
  if (ms >= HOUR_MS) {
    const hours = Math.floor(ms / HOUR_MS);
    return hours === 1 ? "1 hora" : `${hours} horas`;
  }
  if (ms >= MINUTE_MS) {
    const mins = Math.floor(ms / MINUTE_MS);
    return mins === 1 ? "1 minuto" : `${mins} minutos`;
  }
  return "ahora mismo";
};

const fullName = (dossier: UserDossier): string => {
  const parts = [dossier.firstName, dossier.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "—";
};

const headline = (dossier: UserDossier): string => {
  const name = [dossier.firstName, dossier.lastName].filter(Boolean).join(" ");
  if (name && dossier.username) {
    return `${name} (@${dossier.username})`;
  }
  if (name) {
    return name;
  }
  if (dossier.username) {
    return `@${dossier.username}`;
  }
  return "Sin nombre ni alias";
};

const permissionLine = (perms: DossierPermissions): string | undefined => {
  const flags: string[] = [];
  const add = (value: boolean | undefined, label: string) => {
    if (value !== undefined) {
      flags.push(`${value ? "✅" : "🚫"} ${label}`);
    }
  };
  add(perms.canSendMessages, "escribir");
  add(perms.canSendMedia, "media");
  add(perms.canSendLinks, "enlaces");
  add(perms.canAddWebPagePreviews, "previews");
  return flags.length > 0 ? flags.join(" · ") : undefined;
};

/**
 * Renders the dossier card. Two blocks on purpose: the top is what a moderator
 * reads in two seconds to decide something, the bottom is the detail they only
 * want when the top was not enough. Sections with nothing to say are omitted
 * rather than printed as "—", so the length of the card is itself a signal of
 * how much the bot actually knows about someone.
 */
export const formatUserDossier = (dossier: UserDossier): string => {
  const badge = MEMBERSHIP_BADGE[dossier.membership];
  const lines: string[] = [
    `${badge} ${headline(dossier)}${dossier.customTitle ? ` — «${dossier.customTitle}»` : ""}`,
    "",
    `🆔 ID: ${dossier.telegramUserId.toString()}`,
    `👤 Nombre: ${fullName(dossier)}`,
    `🌐 Usuario: ${dossier.username ? `@${dossier.username}` : "sin alias"}`,
    `👀 Situación: ${MEMBERSHIP_LABEL[dossier.membership]}`,
  ];

  if (dossier.activeWarnings !== undefined) {
    const limit = dossier.warnLimit ? `/${dossier.warnLimit}` : "";
    lines.push(`❗ Advertencias: ${dossier.activeWarnings}${limit}`);
  }

  if (dossier.firstSeenAt) {
    const since =
      dossier.seenForMs === undefined
        ? ""
        : ` (hace ${formatElapsed(dossier.seenForMs)})`;
    lines.push(`⬇️ Visto desde: ${formatStamp(dossier.firstSeenAt)}${since}`);
  } else {
    lines.push("⬇️ Visto desde: no tengo registro");
  }

  if (dossier.languageCode) {
    const label =
      LANGUAGES[dossier.languageCode.slice(0, 2).toLowerCase()] ??
      dossier.languageCode;
    lines.push(`🗣 Idioma: ${label}`);
  }

  if (dossier.activeSanction) {
    lines.push(`⛔ Sanción activa: ${dossier.activeSanction}`);
  }

  // ---- technical block ----
  const tech: string[] = [];

  if (dossier.messages !== undefined) {
    if (dossier.messages === 0) {
      tech.push("💬 Mensajes: 0 — nunca ha escrito (fantasma)");
    } else {
      const split =
        dossier.historicalMessages !== undefined &&
        dossier.liveMessages !== undefined &&
        dossier.historicalMessages > 0
          ? ` (${dossier.historicalMessages} antiguos + ${dossier.liveMessages} en vivo)`
          : "";
      tech.push(`💬 Mensajes: ${dossier.messages}${split}`);
    }
  }
  if (dossier.silentForMs !== undefined) {
    tech.push(`🕐 Último mensaje: hace ${formatElapsed(dossier.silentForMs)}`);
  }
  if (dossier.reputation !== undefined) {
    tech.push(`⭐ Reputación: ${dossier.reputation}`);
  }
  if (dossier.thanksReceived !== undefined) {
    tech.push(`🙏 Gracias recibidas: ${dossier.thanksReceived}`);
  }
  if (dossier.trustTier) {
    tech.push(`🎖 Confianza: ${dossier.trustTier}`);
  }
  tech.push(
    dossier.verified ? "🪪 Guardian: verificado" : "🪪 Guardian: sin verificar",
  );
  if (dossier.isBot) {
    tech.push("🤖 Es una cuenta de bot");
  }
  const perms = dossier.permissions
    ? permissionLine(dossier.permissions)
    : undefined;
  if (perms) {
    tech.push(`🔐 Puede: ${perms}`);
  }

  lines.push("", "── técnico ──", ...tech);

  if (dossier.isSelf) {
    lines.push("", "Esto es lo que sé de ti en este grupo.");
  }

  return lines.join("\n");
};

/** The actions the card offers. Kept as data so the parser and the keyboard
 * can never drift apart. */
export const DOSSIER_ACTIONS = [
  "warns",
  "roles",
  "mute",
  "ban",
  "perms",
] as const;
export type DossierAction = (typeof DOSSIER_ACTIONS)[number];

export const DOSSIER_CALLBACK_PREFIX = "info";

export interface DossierCallback {
  readonly action: DossierAction;
  readonly telegramUserId: bigint;
}

/**
 * `info:<action>:<userId>`. The user id travels in the payload because the card
 * outlives the command that produced it — but it is only ever a HINT: the
 * handler re-checks who is pressing and what they may do, since callback data
 * is client-supplied and a stale card must not become a standing permission.
 */
export const parseDossierCallback = (
  data: string | undefined,
): DossierCallback | null => {
  if (!data?.startsWith(`${DOSSIER_CALLBACK_PREFIX}:`)) {
    return null;
  }
  const [, action, rawId] = data.split(":");
  if (!action || !rawId || !/^\d+$/u.test(rawId)) {
    return null;
  }
  if (!(DOSSIER_ACTIONS as readonly string[]).includes(action)) {
    return null;
  }
  return { action: action as DossierAction, telegramUserId: BigInt(rawId) };
};

const BUTTON_LABEL: Readonly<Record<DossierAction, string>> = {
  warns: "❗ Advertencias",
  roles: "🎖 Roles",
  mute: "🔇 Silenciar",
  ban: "🚫 Ban",
  perms: "🔐 Permisos",
};

/**
 * The action keyboard under the card. Moderation buttons only appear for an
 * admin looking at someone else: showing a greyed-out "Ban" on your own card
 * invites people to press it, and a button that always answers "no puedes" is
 * worse than no button.
 */
export const buildUserDossierKeyboard = (
  telegramUserId: bigint,
  options: { readonly canModerate: boolean },
): Record<string, unknown> | undefined => {
  const id = telegramUserId.toString();
  const button = (action: DossierAction) => ({
    text: BUTTON_LABEL[action],
    callback_data: `${DOSSIER_CALLBACK_PREFIX}:${action}:${id}`,
  });

  if (!options.canModerate) {
    return { inline_keyboard: [[button("warns"), button("perms")]] };
  }

  return {
    inline_keyboard: [
      [button("warns"), button("roles")],
      [button("mute"), button("ban")],
      [button("perms")],
    ],
  };
};

export type InfoTargetError = "no-target";

/**
 * How `/info` was told who to look up. `id` resolves without any lookup;
 * `username` needs the bot to have seen that handle before, which is why it can
 * fail in a way the other two cannot.
 */
export type InfoTarget =
  | { readonly kind: "id"; readonly telegramUserId: bigint }
  | { readonly kind: "username"; readonly username: string }
  | { readonly kind: "self" };

export interface InfoCommandResult {
  readonly ok: boolean;
  readonly target?: InfoTarget;
  readonly error?: InfoTargetError;
}

const USERNAME_PATTERN = /^@?([A-Za-z][A-Za-z0-9_]{3,31})$/u;

/**
 * Reads the argument of `/info`: a numeric id, an @username, or nothing (which
 * means "about me"). Reply-targeting is applied upstream by the service, which
 * rewrites the args to carry the replied-to user's id, so this parser only
 * ever sees the three shapes above.
 */
export const parseInfoTarget = (args: readonly string[]): InfoCommandResult => {
  const raw = args[0]?.trim();

  if (!raw) {
    return { ok: true, target: { kind: "self" } };
  }

  if (/^\d+$/u.test(raw)) {
    return { ok: true, target: { kind: "id", telegramUserId: BigInt(raw) } };
  }

  const match = USERNAME_PATTERN.exec(raw);
  if (match?.[1]) {
    return { ok: true, target: { kind: "username", username: match[1] } };
  }

  return { ok: false, error: "no-target" };
};

export const INFO_USAGE =
  "Uso: /info @usuario · /info <id> · responde a un mensaje con /info · o /info a secas para verte a ti.";

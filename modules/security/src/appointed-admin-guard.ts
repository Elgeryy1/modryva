import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Watches the administrators the bot itself appointed (see the BotGrantedAdmin
 * model) and decides when one of them has turned on the group.
 *
 * This exists because of a hard Telegram rule: a bot may only demote admins it
 * promoted itself. That cuts both ways — it is exactly what makes an automatic
 * revocation possible, and it is why this guard is deliberately blind to
 * anyone promoted by hand. Acting on them is impossible, so pretending to
 * watch them would be theatre.
 *
 * Deliberately NOT part of antiraid.ts: that module answers "are a lot of
 * strangers joining at once", a question about volume from outside. This one
 * answers "is someone we trusted abusing the badge we gave them", a question
 * about behaviour from inside. They share nothing but the word "raid".
 *
 * Pure: no I/O, no clock. The caller supplies the recent actions and `nowMs`.
 */

/**
 * What an appointed admin did, as far as the Bot API lets us see.
 *
 * NOT here, and it matters: mass message deletion. Telegram never notifies a
 * bot when someone else deletes messages, so the classic rogue-admin move is
 * structurally invisible. Anyone reading this should not assume the absence of
 * a `delete` kind means deletions are tolerated — they are simply unseeable.
 */
export type AdminActionKind =
  /** Banned or kicked a member. */
  | "ban"
  /** Returned a previously banned member to the group. */
  | "unban"
  /** Tried to make someone else an administrator. */
  | "promote"
  /** Changed the group's title, photo or description, or pinned a message. */
  | "chatinfo";

export interface AdminAction {
  readonly kind: AdminActionKind;
  readonly ms: number;
}

export type AppointedAdminMode = "observe" | "enforce";

const modes: ReadonlySet<string> = new Set(["observe", "enforce"]);

export interface AppointedAdminSettings {
  readonly enabled: boolean;
  /** observe = record and report only; enforce = demote + quarantine. */
  readonly mode: AppointedAdminMode;
  /** Rolling window every threshold below is counted over. */
  readonly windowSeconds: number;
  /** Bans/kicks in the window that trip the guard. */
  readonly banBurstLimit: number;
  /** Unbans in the window that trip it. */
  readonly unbanBurstLimit: number;
  /** Group title/photo/description changes and pins in the window. */
  readonly chatInfoLimit: number;
  /**
   * Whether a single promotion attempt trips it outright. The permission set
   * /admin grants never includes can_promote_members, so an appointed admin
   * CANNOT actually promote anyone — an attempt means they went looking for a
   * power they were never given, which is worth one strike on its own.
   */
  readonly tripOnPromote: boolean;
}

/** Inert until an admin configures it, like every other protection here. */
export const defaultAppointedAdminSettings: AppointedAdminSettings = {
  enabled: false,
  mode: "observe",
  windowSeconds: 60,
  banBurstLimit: 3,
  unbanBurstLimit: 3,
  chatInfoLimit: 2,
  tripOnPromote: true,
};

/** Stable, machine-readable causes. Stored verbatim as `revokedReason`, so a
 * revocation can always be traced back to the rule that caused it. */
export type AdminGuardReason =
  | "guard:ban_burst"
  | "guard:unban_burst"
  | "guard:promote_attempt"
  | "guard:chatinfo_burst";

export interface AdminGuardDecision {
  readonly triggered: boolean;
  readonly reason: AdminGuardReason | null;
  readonly mode: AppointedAdminMode;
  readonly counts: Readonly<Record<AdminActionKind, number>>;
}

const emptyCounts: Readonly<Record<AdminActionKind, number>> = {
  ban: 0,
  unban: 0,
  promote: 0,
  chatinfo: 0,
};

/**
 * Decides whether the actions of ONE appointed admin, inside the window, cross
 * a line. `actions` must already be scoped to a single (chat, admin) pair —
 * mixing admins here would blame one person for another's activity.
 *
 * Order of checks is by severity, not by count: a promotion attempt outranks a
 * ban burst even when the bursts are larger, because reaching for a power you
 * were never granted says something a volume of legitimate-looking bans does
 * not.
 */
export const evaluateAppointedAdmin = (
  actions: readonly AdminAction[],
  nowMs: number,
  settings: AppointedAdminSettings,
): AdminGuardDecision => {
  if (!settings.enabled) {
    return {
      triggered: false,
      reason: null,
      mode: settings.mode,
      counts: emptyCounts,
    };
  }

  const windowStart = nowMs - settings.windowSeconds * 1000;
  const counts = { ...emptyCounts };
  for (const action of actions) {
    if (action.ms >= windowStart) {
      counts[action.kind] += 1;
    }
  }

  const trip = (reason: AdminGuardReason): AdminGuardDecision => ({
    triggered: true,
    reason,
    mode: settings.mode,
    counts,
  });

  if (settings.tripOnPromote && counts.promote > 0) {
    return trip("guard:promote_attempt");
  }
  // `>=`, not `>`: these limits read as "this many is already too many". The
  // antiraid join limit uses `>` because there it means "more than N normal
  // joins"; conflating the two would silently shift every threshold by one.
  if (counts.ban >= settings.banBurstLimit) {
    return trip("guard:ban_burst");
  }
  if (counts.unban >= settings.unbanBurstLimit) {
    return trip("guard:unban_burst");
  }
  if (counts.chatinfo >= settings.chatInfoLimit) {
    return trip("guard:chatinfo_burst");
  }

  return { triggered: false, reason: null, mode: settings.mode, counts };
};

/** A threshold of 1 is a perfectly normal setting, so these strings have to
 * read correctly at n=1 — "baneó a 1 personas" showed up in the live test. */
const people = (n: number): string => (n === 1 ? "1 persona" : `${n} personas`);

/** Plain Spanish for a report to STAFF. */
export const describeAdminGuardReason = (
  reason: AdminGuardReason,
  counts: Readonly<Record<AdminActionKind, number>>,
  windowSeconds: number,
): string => {
  switch (reason) {
    case "guard:promote_attempt":
      return "intentó nombrar administrador a otra persona";
    case "guard:ban_burst":
      return `expulsó o baneó a ${people(counts.ban)} en ${windowSeconds} s`;
    case "guard:unban_burst":
      return `readmitió a ${people(counts.unban)} baneada${counts.unban === 1 ? "" : "s"} en ${windowSeconds} s`;
    case "guard:chatinfo_burst":
      return `cambió la identidad del grupo ${counts.chatinfo} ${counts.chatinfo === 1 ? "vez" : "veces"} en ${windowSeconds} s`;
  }
};

/**
 * Maps a chat_member transition to what the ACTOR did, or null when it is not
 * an act against a third party.
 *
 * `actorId === subjectId` is the important exclusion: Telegram reports someone
 * leaving on their own with `from` set to that same person, which would
 * otherwise count as the admin "kicking" a member every time anyone walked out
 * while they held the badge.
 */
export const classifyMemberTransition = (input: {
  readonly actorId: bigint | undefined;
  readonly subjectId: bigint | undefined;
  readonly oldStatus: string | undefined;
  readonly newStatus: string | undefined;
}): AdminActionKind | null => {
  const { actorId, subjectId, oldStatus, newStatus } = input;
  if (actorId === undefined || subjectId === undefined) {
    return null;
  }
  if (actorId === subjectId) {
    return null;
  }
  if (newStatus === "kicked") {
    return "ban";
  }
  // "left" caused by someone else is a kick; caused by the person themselves it
  // was already excluded above.
  if (newStatus === "left" && oldStatus !== "kicked") {
    return "ban";
  }
  if (
    oldStatus === "kicked" &&
    (newStatus === "member" || newStatus === "restricted")
  ) {
    return "unban";
  }
  if (newStatus === "administrator") {
    return "promote";
  }
  return null;
};

// --- Commands ---------------------------------------------------------------

export type AppointedAdminCommand =
  /** Appoint someone, bringing them under the guard. */
  | {
      readonly kind: "appoint";
      readonly targetUsername: string | null;
      /** A raw numeric id. The escape hatch for someone the bot cannot resolve
       * any other way — a bot, or a person who has never spoken here, neither
       * of whom can be reached by @username or by replying to a message. */
      readonly targetUserId: bigint | undefined;
      readonly customTitle: string | null;
    }
  /** Revoke an appointment by hand. */
  | {
      readonly kind: "revoke";
      readonly targetUsername: string | null;
      readonly targetUserId: bigint | undefined;
    }
  /** Who the bot has appointed here, and who it cannot touch. */
  | { readonly kind: "list" }
  /** Re-appoint the admins that predate the bot, so the guard covers them. */
  | { readonly kind: "adopt" };

export interface AppointedAdminCommandError {
  readonly code: "missing-target";
  readonly usage: string;
}

export type AppointedAdminCommandResult =
  | { readonly ok: true; readonly command: AppointedAdminCommand }
  | { readonly ok: false; readonly error: AppointedAdminCommandError };

const APPOINT_USAGE =
  "Uso: /admin @persona [título] — o responde a un mensaje suyo con /admin";
const REVOKE_USAGE =
  "Uso: /desadmin @persona — o responde a un mensaje suyo con /desadmin";

/** A leading @mention, if the first argument is one. Returned WITHOUT the @. */
const mentionOf = (arg: string | undefined): string | null => {
  if (!arg?.startsWith("@") || arg.length < 2) {
    return null;
  }
  return arg.slice(1);
};

/** A bare numeric id as the first argument. */
const idOf = (arg: string | undefined): bigint | undefined =>
  arg && /^\d{5,}$/u.test(arg) ? BigInt(arg) : undefined;

/**
 * `hasReplyTarget` lets "reply to their message with /admin" work without a
 * username, which is the only way to reach someone who has none.
 */
export const parseAppointedAdminCommand = (
  update: TelegramUpdateEnvelope,
  hasReplyTarget: boolean,
): AppointedAdminCommandResult | null => {
  const name = update.command?.name;
  if (!name) {
    return null;
  }
  const args = update.command?.args ?? [];

  if (name === "adminlist" || name === "adminbot") {
    return { ok: true, command: { kind: "list" } };
  }

  if (name === "adoptaradmins") {
    return { ok: true, command: { kind: "adopt" } };
  }

  if (name === "admin") {
    const targetUsername = mentionOf(args[0]);
    const targetUserId = idOf(args[0]);
    if (!targetUsername && targetUserId === undefined && !hasReplyTarget) {
      return {
        ok: false,
        error: { code: "missing-target", usage: APPOINT_USAGE },
      };
    }
    // When arg 0 named the target the title starts at arg 1; replying, the
    // whole tail is the title.
    const named = targetUsername !== null || targetUserId !== undefined;
    const customTitle = (named ? args.slice(1) : args).join(" ").trim();
    return {
      ok: true,
      command: {
        kind: "appoint",
        targetUsername,
        targetUserId,
        customTitle: customTitle.length > 0 ? customTitle : null,
      },
    };
  }

  if (name === "desadmin" || name === "quitaradmin") {
    const targetUsername = mentionOf(args[0]);
    const targetUserId = idOf(args[0]);
    if (!targetUsername && targetUserId === undefined && !hasReplyTarget) {
      return {
        ok: false,
        error: { code: "missing-target", usage: REVOKE_USAGE },
      };
    }
    return {
      ok: true,
      command: { kind: "revoke", targetUsername, targetUserId },
    };
  }

  return null;
};

/** Validates a settings patch coming from the Mini App. */
export const normalizeAppointedAdminMode = (
  value: string,
): AppointedAdminMode | null =>
  modes.has(value) ? (value as AppointedAdminMode) : null;

/** Key under which the per-chat settings live in the shared chat_settings
 * table. No dedicated table: this is one small object per chat, exactly what
 * that store exists for. */
export const APPOINTED_ADMIN_SETTINGS_KEY = "appointed_admin_guard";

const positiveInt = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;

/**
 * Reads stored settings defensively. Anything missing or malformed falls back
 * to the default, so a hand-edited row or a field added in a later version can
 * never turn the guard into something that enforces on garbage thresholds.
 */
export const parseAppointedAdminSettings = (
  value: unknown,
): AppointedAdminSettings => {
  if (typeof value !== "object" || value === null) {
    return defaultAppointedAdminSettings;
  }
  const raw = value as Record<string, unknown>;
  const mode =
    typeof raw.mode === "string" ? normalizeAppointedAdminMode(raw.mode) : null;
  return {
    enabled: raw.enabled === true,
    mode: mode ?? defaultAppointedAdminSettings.mode,
    windowSeconds: positiveInt(
      raw.windowSeconds,
      defaultAppointedAdminSettings.windowSeconds,
    ),
    banBurstLimit: positiveInt(
      raw.banBurstLimit,
      defaultAppointedAdminSettings.banBurstLimit,
    ),
    unbanBurstLimit: positiveInt(
      raw.unbanBurstLimit,
      defaultAppointedAdminSettings.unbanBurstLimit,
    ),
    chatInfoLimit: positiveInt(
      raw.chatInfoLimit,
      defaultAppointedAdminSettings.chatInfoLimit,
    ),
    tripOnPromote:
      typeof raw.tripOnPromote === "boolean"
        ? raw.tripOnPromote
        : defaultAppointedAdminSettings.tripOnPromote,
  };
};

/**
 * El conjunto de permisos que concede `/admin`: la insignia, y nada más.
 *
 * REGLA: si el bot tiene un comando para hacerlo, el permiso nativo NO se
 * concede. Un administrador nombrado modera **a través del bot** — `/ban`,
 * `/kick`, `/mute`, `/warn`, `/del`, `/purge`, `/pin`, `/settitle` — y no desde
 * el menú de Telegram.
 *
 * Por qué importa, y no es burocracia: una expulsión hecha desde el menú de
 * Telegram no pasa por `evaluatePolicy`, no crea un `ModerationCase`, no escribe
 * en `audit_logs`, no cuenta para el contador de ráfagas del guardia y no se
 * puede apelar. Existe y desaparece. La misma expulsión hecha con `/ban` deja
 * caso, motivo, actor, fecha y una vía para revertirla. Quitar el permiso
 * nativo no le resta poder a nadie: le cambia la puerta por una que deja rastro.
 *
 * `can_manage_chat` es el ÚNICO `true`, y es estructural: Telegram interpreta
 * una promoción con todos los permisos en false como una DEGRADACIÓN, así que
 * uno tiene que quedar en pie. Éste es el candidato correcto porque no otorga
 * ninguna acción de moderación — da acceso al registro de eventos y poco más.
 *
 * Y el permiso nativo no hace falta para que el bot les obedezca: la
 * autorización mira si la persona está en `getChatAdministrators`, que la
 * lista **tenga los permisos que tenga**. Un admin nombrado con solo
 * `can_manage_chat` sigue pudiendo usar todos los comandos de moderación.
 *
 * Los tres que ya estaban vetados siguen vetados, cada uno por su motivo:
 *
 * `can_promote_members` — quien puede promover crea administradores que el bot
 * nunca nombró, y entonces Telegram le prohíbe degradarlos. Un solo comando
 * bastaría para salirse del guardia para siempre.
 *
 * `can_invite_users` — añade gente y reparte enlaces, las dos cosas que se
 * saltan la verificación de Guardian. La admisión es trabajo del bot.
 *
 * `can_manage_topics` — false por hecho, no por política: el bot no lo tiene, y
 * Telegram solo deja conceder lo que uno posee. Pedirlo haría fallar cada
 * `/admin`.
 *
 * CONTRAPARTIDA, dicha en voz alta: si el bot está caído, un administrador
 * nombrado no puede moderar por su cuenta. El creador del grupo y quien fue
 * nombrado a mano sí — y son quienes deben poder.
 */
export const APPOINTED_ADMIN_RIGHTS = {
  // El único true. Sin él la promoción sería una degradación.
  can_manage_chat: true,

  // Todo lo de abajo tiene comando en el bot, así que va por ahí:
  can_restrict_members: false, // /ban /kick /mute /warn
  can_delete_messages: false, // /del /purge
  can_pin_messages: false, // /pin /unpin
  can_change_info: false, // /settitle /setdesc

  // Sin equivalente en el bot, pero tampoco son moderación: conceder permisos
  // que nadie necesita es lo contrario de dar solo los necesarios. Si algún día
  // hacen falta, éstos son los primeros candidatos a revisar.
  can_manage_video_chats: false,
  can_post_stories: false,
  can_edit_stories: false,
  can_delete_stories: false,

  // Las puertas del bot — ver arriba.
  can_invite_users: false,
  can_promote_members: false,
  can_manage_topics: false,
} as const;

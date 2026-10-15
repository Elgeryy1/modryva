/**
 * Watches changes to who holds power in the group, and shouts about the ones
 * nobody asked for.
 *
 * The gap this closes: every other guard here watches what people DO once they
 * have power. Nothing watched power itself changing hands — and the opening
 * move of a group takeover is not a ban wave, it is quietly demoting the bot so
 * that nothing can answer the ban wave. Until now that move was silent.
 *
 * Deliberately distinct from appointed-admin-guard.ts: that one asks "is
 * someone we trusted abusing the badge we gave them", and is blind by design to
 * anyone the bot did not appoint. This one asks "did the set of people who hold
 * power change without us", and is most useful exactly where the other is
 * blind — because an admin the bot never appointed is one Telegram will never
 * let it demote, so an early warning is the ONLY defence available.
 *
 * Pure: no I/O, no clock. The caller resolves ids and membership.
 */

/** Telegram statuses that mean "holds administrative power in this chat". */
const ADMIN_STATUSES: ReadonlySet<string> = new Set([
  "administrator",
  "creator",
]);

/** Statuses that mean the member is no longer in the chat at all. */
const GONE_STATUSES: ReadonlySet<string> = new Set(["left", "kicked"]);

const holdsPower = (status: string | undefined): boolean =>
  status !== undefined && ADMIN_STATUSES.has(status);

export type PowerAlertKind =
  /** The bot lost its own admin badge. Every protection it offers dies here. */
  | "bot_demoted"
  /** The bot was removed from the chat outright. */
  | "bot_removed"
  /**
   * Someone became an administrator without going through the bot. Telegram
   * forbids a bot from demoting an admin it did not promote, so this person is
   * permanently outside the bot's reach — noticing is all it can do.
   *
   * Deliberately the QUIETEST of these: promoting by hand is the normal,
   * intended way to create an admin trusted to change the bot's own settings,
   * so this fires on correct operation. It is reported for the record, not as
   * an incident — an alarm that shouts during routine is an alarm nobody reads.
   */
  | "outsider_promoted"
  /**
   * The group changed OWNER. Distinct from a promotion and far graver: the
   * owner can do everything, including removing this bot permanently, and no
   * one — bot or admin — can undo it. Telegram only allows the transfer from
   * the official client, with 2FA, so it is never accidental.
   */
  | "owner_transferred"
  /** An admin the bot appointed was demoted by somebody other than the bot. */
  | "ours_demoted";

export interface PowerAlert {
  readonly kind: PowerAlertKind;
  /** Who caused it. */
  readonly actorId: bigint;
  /** Who it happened to. */
  readonly subjectId: bigint;
  /** True when the group's own protection is now weaker than it was. */
  readonly weakensDefence: boolean;
}

export interface PowerChangeInput {
  readonly actorId: bigint | undefined;
  readonly subjectId: bigint | undefined;
  readonly oldStatus: string | undefined;
  readonly newStatus: string | undefined;
  /** This bot's own Telegram id, so it can recognise itself as the subject. */
  readonly botId: bigint | undefined;
  /** Whether the SUBJECT is currently an admin this bot appointed. */
  readonly subjectIsAppointedByUs: boolean;
}

/**
 * Classifies one membership transition, or null when nothing about power
 * changed in a way worth waking anyone for.
 *
 * Two exclusions carry most of the weight:
 *
 * - `actorId === subjectId` is ignored for the human cases. Telegram reports a
 *   self-demotion and a member leaving with `from` set to that same person, and
 *   an admin stepping down is not an attack. Without this, every departure
 *   would page the team.
 * - Anything the BOT itself did is ignored. `/admin` and `/desadmin` promote and
 *   demote on purpose; alerting on the bot's own deliberate actions would train
 *   everyone to ignore the alert that matters.
 */
export const classifyPowerChange = (
  input: PowerChangeInput,
): PowerAlert | null => {
  const { actorId, subjectId, oldStatus, newStatus, botId } = input;
  if (actorId === undefined || subjectId === undefined) {
    return null;
  }

  // The bot as SUBJECT is checked first and is never excluded by the
  // actor-is-the-bot rule below: a bot cannot demote itself, so if the subject
  // is the bot then somebody else did this.
  if (botId !== undefined && subjectId === botId) {
    if (GONE_STATUSES.has(newStatus ?? "")) {
      return {
        kind: "bot_removed",
        actorId,
        subjectId,
        weakensDefence: true,
      };
    }
    if (holdsPower(oldStatus) && !holdsPower(newStatus)) {
      return {
        kind: "bot_demoted",
        actorId,
        subjectId,
        weakensDefence: true,
      };
    }
    return null;
  }

  if (actorId === subjectId) {
    return null;
  }
  if (botId !== undefined && actorId === botId) {
    return null;
  }

  // Checked before the generic promotion below: becoming `creator` IS a gain of
  // power, so the order is what keeps an ownership transfer from being filed as
  // an ordinary promotion — and it must never be silenced by
  // subjectIsAppointedByUs either, since the bot appointing someone says
  // nothing about them later being handed the group.
  if (newStatus === "creator" && oldStatus !== "creator") {
    return {
      kind: "owner_transferred",
      actorId,
      subjectId,
      // The new owner can remove the bot at will, and nobody can reverse this.
      weakensDefence: true,
    };
  }

  if (!holdsPower(oldStatus) && holdsPower(newStatus)) {
    // Someone the bot did not appoint just gained power. If the bot DID appoint
    // them the ledger already knows, and appointed-admin-guard owns them.
    return input.subjectIsAppointedByUs
      ? null
      : {
          kind: "outsider_promoted",
          actorId,
          subjectId,
          // Not weaker defence — but permanently un-revokable, which is why it
          // is recorded at all.
          weakensDefence: false,
        };
  }

  if (holdsPower(oldStatus) && !holdsPower(newStatus)) {
    return input.subjectIsAppointedByUs
      ? {
          kind: "ours_demoted",
          actorId,
          subjectId,
          weakensDefence: true,
        }
      : null;
  }

  return null;
};

/**
 * The alert, in plain Spanish, for the group's own admins to read.
 *
 * Written to be actionable rather than dramatic: each one says what happened,
 * what it costs, and the single next step. `actor` and `subject` are already
 * human labels (@username or a display name) — this module never formats ids.
 */
export const describePowerAlert = (
  alert: PowerAlert,
  labels: { readonly actor: string; readonly subject: string },
): string => {
  switch (alert.kind) {
    case "bot_removed":
      return [
        `🚨 ${labels.actor} me ha sacado del grupo.`,
        "Desde este momento no hay verificación, ni antispam, ni moderación automática aquí.",
        "Si no ha sido cosa vuestra, volved a añadirme y revisad quién tiene permisos.",
      ].join("\n");
    case "bot_demoted":
      return [
        `🚨 ${labels.actor} me ha quitado los permisos de administrador.`,
        "Sin ellos no puedo verificar a quien entra, ni borrar, ni silenciar: el grupo se queda sin defensa.",
        "Quitarle los poderes al bot suele ser el primer paso de un ataque. Si no lo habéis pedido vosotros, comprobadlo ya.",
      ].join("\n");
    case "outsider_promoted":
      // No advice to re-do it through /admin, on purpose. Promoting by hand is
      // the intended way to create an admin trusted with the bot's own
      // settings, and telling the group to convert that person into a
      // bot-appointed admin would strip them of exactly that trust.
      return [
        `ℹ️ ${labels.actor} ha hecho administrador a ${labels.subject}.`,
        "Lo apunto: como no lo he nombrado yo, Telegram no me deja quitarle los permisos si algún día hiciera falta.",
        "Si no ha sido cosa vuestra, revisadlo.",
      ].join("\n");
    case "owner_transferred":
      return [
        `🚨 El grupo tiene nuevo dueño: ${labels.subject}.`,
        "Quien es dueño puede todo, incluido echarme para siempre, y esto no lo puede deshacer nadie: ni vosotros ni yo.",
        "Telegram solo permite traspasar la propiedad desde la app oficial y con verificación en dos pasos, así que esto no ha sido un descuido.",
        "Si no lo habéis hecho vosotros, la cuenta del dueño anterior está comprometida.",
      ].join("\n");
    case "ours_demoted":
      return [
        `⚠️ ${labels.actor} ha quitado de administrador a ${labels.subject}, que estaba bajo mi vigilancia.`,
        "Lo he apuntado. Si no lo habéis decidido vosotros, revisad quién más tiene permisos.",
      ].join("\n");
  }
};

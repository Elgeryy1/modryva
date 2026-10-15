/**
 * Which messages may take the pole in AUTO_FIRST_MESSAGE mode.
 *
 * This predicate runs on EVERY message of every group that turns the mode on,
 * so it is deliberately a pile of cheap boolean checks over already-parsed
 * fields — no allocation, no regex, no I/O.
 *
 * It returns a REASON rather than a boolean because `/status` has to be able to
 * explain why the automatic pole is not firing, and "it just doesn't" is the
 * failure mode the report singles out as unacceptable (§5.11).
 */

export interface AutoPoleCandidate {
  /** True for a plain text message (the envelope's own classification). */
  readonly isTextMessage: boolean;
  /** A slash command is a claim or a report, never an accidental pole. */
  readonly hasCommand: boolean;
  readonly senderIsBot: boolean;
  readonly senderUserId: bigint | undefined;
  /** Posted as the group/channel itself — an anonymous admin has no person. */
  readonly isAnonymousSender: boolean;
  /** Join/leave/pin notices and the like. */
  readonly isServiceMessage: boolean;
  readonly hasMedia: boolean;
  /** Edits are not arrivals; the original message already had its chance. */
  readonly isEdit: boolean;
}

export type AutoPoleVerdict =
  | { readonly eligible: true }
  | {
      readonly eligible: false;
      readonly reason:
        | "bot"
        | "anonymous"
        | "service"
        | "edit"
        | "command"
        | "media-not-allowed"
        | "no-content"
        | "no-user";
    };

const no = (reason: Extract<AutoPoleVerdict, { eligible: false }>["reason"]) =>
  ({ eligible: false, reason }) as const;

/**
 * `allowMedia` decides whether a photo or sticker can win the day.
 *
 * Defaults to false (KNOWN_GAPS D12): the report does not know what the
 * original bot counted, and "the first person who SAID something" is the
 * reading nobody argues with. A group that wants sticker-poles turns it on.
 */
export const autoPoleVerdict = (
  candidate: AutoPoleCandidate,
  allowMedia: boolean,
): AutoPoleVerdict => {
  if (candidate.isEdit) {
    return no("edit");
  }
  if (candidate.isServiceMessage) {
    return no("service");
  }
  if (candidate.senderIsBot) {
    return no("bot");
  }
  // An anonymous admin posts AS the chat, so there is no person to award the
  // pole to. Awarding it to the chat id would put "the group" on the podium.
  if (candidate.isAnonymousSender || candidate.senderUserId === undefined) {
    return no(candidate.isAnonymousSender ? "anonymous" : "no-user");
  }
  if (candidate.hasCommand) {
    return no("command");
  }
  if (candidate.isTextMessage) {
    return { eligible: true };
  }
  if (candidate.hasMedia) {
    return allowMedia ? { eligible: true } : no("media-not-allowed");
  }
  return no("no-content");
};

/** Plain-Spanish reason, for `/status` and for the audit payload. */
export const describeVerdict = (verdict: AutoPoleVerdict): string | null => {
  if (verdict.eligible) {
    return null;
  }
  switch (verdict.reason) {
    case "bot":
      return "los bots no compiten";
    case "anonymous":
      return "los administradores anónimos no tienen a quién premiar";
    case "service":
      return "los avisos de entrada y salida no cuentan";
    case "edit":
      return "editar un mensaje no vale como llegada";
    case "command":
      return "un comando no cuenta como mensaje";
    case "media-not-allowed":
      return "este grupo solo admite mensajes de texto";
    case "no-user":
      return "no he podido identificar al remitente";
    default:
      return "el mensaje no tiene contenido que cuente";
  }
};

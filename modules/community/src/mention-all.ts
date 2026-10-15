/**
 * `@all` — one message that actually pings everybody.
 *
 * Telegram has no "mention everyone" primitive: a notification only fires for a
 * user explicitly linked in the text. So this builds `tg://user?id=` links, and
 * the only real work is respecting two hard limits at once — 4096 characters
 * per message, and a practical cap on how many mentions Telegram will actually
 * notify from a single message. Hence batching.
 *
 * Pure: no I/O, no clock.
 */

export interface MentionTarget {
  readonly telegramUserId: bigint;
  readonly name: string;
}

/** Telegram's hard per-message limit. */
const MAX_MESSAGE_CHARS = 4096;
/** Mentions per message. Well under the character limit even with long names,
 * and small enough that a group of hundreds does not become one unreadable
 * wall — the announcement is the point, the pings are the delivery. */
export const MENTIONS_PER_MESSAGE = 25;

/**
 * HTML-escapes a display name before it goes inside an anchor.
 *
 * Not cosmetic: a member called `<b>` or `Ana & Co` would otherwise break the
 * parse and Telegram would reject the whole message — one badly-named member
 * silently killing every announcement.
 */
const escapeHtml = (value: string): string =>
  value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");

/** A name long enough to eat the budget is trimmed, never dropped. */
const shortName = (value: string): string => {
  const clean = value.trim().replace(/\s+/gu, " ");
  return clean.length > 32 ? `${clean.slice(0, 31)}…` : clean || "alguien";
};

export const mentionLink = (target: MentionTarget): string =>
  `<a href="tg://user?id=${target.telegramUserId.toString()}">${escapeHtml(
    shortName(target.name),
  )}</a>`;

/**
 * Splits an announcement into the messages to actually send: the text first,
 * then batches of mentions.
 *
 * The text goes in its OWN message rather than riding along with the first
 * batch, so a long announcement can never push mentions past the character
 * limit and silently lose the people at the end of the list.
 */
export const buildMentionAllMessages = (
  text: string,
  targets: readonly MentionTarget[],
  perMessage: number = MENTIONS_PER_MESSAGE,
): string[] => {
  const body = text.trim();
  const messages: string[] = [];
  if (body.length > 0) {
    messages.push(
      escapeHtml(
        body.length > MAX_MESSAGE_CHARS
          ? `${body.slice(0, MAX_MESSAGE_CHARS - 1)}…`
          : body,
      ),
    );
  }
  const size = Math.max(1, perMessage);
  for (let i = 0; i < targets.length; i += size) {
    messages.push(
      targets
        .slice(i, i + size)
        .map(mentionLink)
        .join(" "),
    );
  }
  return messages;
};

export interface MentionAllCommand {
  readonly text: string;
}

/**
 * Recognises `@all <mensaje>` / `/all <mensaje>` / `@todos …`.
 *
 * Matched at the START only: "@all" mid-sentence is someone talking about the
 * feature, not using it, and pinging a whole group by accident is the kind of
 * mistake people remember.
 */
export const parseMentionAll = (text: string): MentionAllCommand | null => {
  const match = /^\s*(?:@all|@todos|\/all|\/todos)\b\s*([\s\S]*)$/iu.exec(text);
  if (!match) {
    return null;
  }
  return { text: (match[1] ?? "").trim() };
};

/**
 * `@admin <mensaje>` — avisar al equipo del grupo.
 *
 * Al reves que `@all`, esto lo puede usar CUALQUIERA: es la forma de pedir
 * ayuda cuando pasa algo, y exigir ser admin para avisar a los admins no
 * tendria sentido. El precio es que hay que limitarlo por persona, o se
 * convierte en un boton de molestar al equipo.
 */
export const parseMentionAdmins = (text: string): MentionAllCommand | null => {
  const match = /^\s*(?:@admin|@admins|@staff|@mods)\b\s*([\s\S]*)$/iu.exec(
    text,
  );
  if (!match) {
    return null;
  }
  return { text: (match[1] ?? "").trim() };
};

/**
 * El aviso al equipo: quien llama, que dice, y las menciones detras.
 *
 * Se nombra a quien avisa a proposito. Un "@admin venid" anonimo obliga al
 * equipo a buscar quien lo ha escrito antes de poder hacer nada.
 */
export const buildAdminAlertMessages = (
  text: string,
  quienAvisa: MentionTarget,
  admins: readonly MentionTarget[],
  perMessage: number = MENTIONS_PER_MESSAGE,
): string[] => {
  const cuerpo = text.trim();
  const cabecera = cuerpo
    ? `🚨 ${mentionLink(quienAvisa)} avisa al equipo:\n\n${escapeHtml(
        cuerpo.length > 3000 ? `${cuerpo.slice(0, 2999)}…` : cuerpo,
      )}`
    : `🚨 ${mentionLink(quienAvisa)} pide ayuda del equipo.`;

  const messages = [cabecera];
  for (let i = 0; i < admins.length; i += perMessage) {
    const lote = admins.slice(i, i + perMessage);
    if (lote.length > 0) {
      messages.push(lote.map(mentionLink).join(" "));
    }
  }
  return messages;
};

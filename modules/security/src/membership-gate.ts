/**
 * Cross-chat membership requirement: a group can require that members also
 * belong to another ("required") chat. Pure interpretation of a Telegram
 * getChatMember status — the actual API call and enforcement (decline join
 * request / kick) live in the service.
 */

export type ChatMemberStatus =
  | "creator"
  | "administrator"
  | "member"
  | "restricted"
  | "left"
  | "kicked"
  | undefined;

/** True when the status means the user currently belongs to the chat. */
export const isActiveChatMember = (status: ChatMemberStatus): boolean =>
  status === "creator" ||
  status === "administrator" ||
  status === "member" ||
  status === "restricted";

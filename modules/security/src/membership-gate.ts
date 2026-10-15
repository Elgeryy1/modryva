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

/**
 * True when a `chat_member` transition means "this person just entered the
 * chat" — they were outside (left/kicked/unknown) and now belong to it.
 *
 * This is the ONLY signal for joins that go through an approved join request:
 * Telegram emits no `new_chat_members` service message for those, so a group
 * that vets everyone through requests never produced a single join event for
 * the bot. Promotions, demotions and restrictions all keep the member inside
 * the chat and are deliberately NOT joins.
 */
export const isJoinTransition = (
  oldStatus: ChatMemberStatus,
  newStatus: ChatMemberStatus,
): boolean => !isActiveChatMember(oldStatus) && isActiveChatMember(newStatus);

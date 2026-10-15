import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type InviteCommand =
  | { readonly kind: "self" }
  | { readonly kind: "top" };

export type InviteCommandResult = {
  readonly ok: true;
  readonly command: InviteCommand;
};

const inviteCommandNames: ReadonlySet<string> = new Set([
  "invites",
  "inviters",
]);

export const parseInviteCommand = (
  update: TelegramUpdateEnvelope,
): InviteCommandResult | null => {
  const name = update.command?.name;

  if (!name || !inviteCommandNames.has(name)) {
    return null;
  }

  return {
    ok: true,
    command: { kind: name === "inviters" ? "top" : "self" },
  };
};

/**
 * Counts how many of the new members were actually invited by `inviterId`. A user
 * joining on their own (their id appears among the new members) is not an
 * invitation, so self-joins are excluded.
 */
export const countInvitedMembers = (
  inviterId: bigint | undefined,
  newMemberIds: readonly bigint[],
): number => {
  if (inviterId === undefined) {
    return 0;
  }

  return newMemberIds.filter((memberId) => memberId !== inviterId).length;
};

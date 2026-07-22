import { apiFetch } from "./api";

export type ModerationInboxKind = "report" | "quarantine" | "appeal" | "ticket";

export interface ModerationInboxItem {
  id: string;
  kind: ModerationInboxKind;
  chatId: string;
  subjectTelegramId?: string;
  reason?: string;
  priority?: string;
  status: string;
  createdAt: string;
}

export interface ModerationInboxResponse {
  items: ModerationInboxItem[];
  chatIds: string[];
}

export interface ModerationInboxFilters {
  chatId?: string;
  kind?: ModerationInboxKind;
  status?: string;
}

export type ModerationInboxAction = "approve" | "reject" | "close" | "assign";

const buildQuery = (filters: ModerationInboxFilters): string => {
  const params = new URLSearchParams();
  if (filters.chatId) {
    params.set("chatId", filters.chatId);
  }
  if (filters.kind) {
    params.set("kind", filters.kind);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
};

export const getModerationInbox = (
  gid: string,
  filters: ModerationInboxFilters = {},
) =>
  apiFetch<ModerationInboxResponse>(
    `/v1/miniapp/groups/${gid}/moderation/inbox${buildQuery(filters)}`,
  );

export const resolveModerationInboxItem = (
  gid: string,
  kind: ModerationInboxKind,
  id: string,
  action: ModerationInboxAction,
  assigneeTelegramId?: string,
) =>
  apiFetch<{ ok: boolean }>(
    `/v1/miniapp/groups/${gid}/moderation/inbox/${kind}/${encodeURIComponent(id)}/resolve`,
    {
      method: "POST",
      body: JSON.stringify(
        assigneeTelegramId ? { action, assigneeTelegramId } : { action },
      ),
    },
  );

import { apiFetch } from "./api";

export const INTERNAL_ROLES = [
  "owner",
  "network_manager",
  "moderator",
  "support",
  "analyst",
  "read_only",
] as const;
export type InternalRole = (typeof INTERNAL_ROLES)[number];

export interface UserPanelWarning {
  reason: string | null;
  createdAt: string;
}

export interface UserPanelReport {
  id: string;
  chatId: string | null;
  reason: string | null;
  status: string;
  createdAt: string;
}

export interface UserPanelRisk {
  score: number;
  deletedCount: number;
  reportCount: number;
  quarantineCount: number;
  linkCount: number;
  sanctionCount: number;
}

export interface UserPanelProfile {
  telegramUserId: string;
  inNetwork: boolean;
  networkChats?: { chatId: string; telegramChatId: string }[];
  warnings: UserPanelWarning[];
  reports: UserPanelReport[];
  sanctions?: unknown;
  internalRole: InternalRole | null;
  canManageRole: boolean;
  risk: UserPanelRisk | null;
  badges?: unknown;
}

export const getUserPanelProfile = (gid: string, telegramUserId: string) =>
  apiFetch<UserPanelProfile>(
    `/v1/miniapp/groups/${gid}/users/${encodeURIComponent(telegramUserId)}`,
  );

export const setUserPanelRole = (
  gid: string,
  telegramUserId: string,
  role: InternalRole,
) =>
  apiFetch<{ telegramUserId: string; role: InternalRole }>(
    `/v1/miniapp/groups/${gid}/users/${encodeURIComponent(telegramUserId)}/role`,
    { method: "PUT", body: JSON.stringify({ role }) },
  );

export const addUserPanelNote = (
  gid: string,
  telegramUserId: string,
  note: string,
) =>
  apiFetch<{ telegramUserId: string; note: string; persisted: boolean }>(
    `/v1/miniapp/groups/${gid}/users/${encodeURIComponent(telegramUserId)}/notes`,
    { method: "POST", body: JSON.stringify({ note }) },
  );

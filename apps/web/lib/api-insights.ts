import { apiFetch } from "./api";

export interface GhostMember {
  userId: string;
  username: string | null;
  joinedAt: string;
}

export interface InactiveMember {
  userId: string;
  username: string | null;
  idleDays: number;
  lastActiveAt: string;
}

export const getGhosts = (gid: string) =>
  apiFetch<{ total: number; ghosts: GhostMember[] }>(
    `/v1/miniapp/groups/${gid}/insights/ghosts`,
  );

export const getInactive = (gid: string) =>
  apiFetch<{ total: number; inactive: InactiveMember[] }>(
    `/v1/miniapp/groups/${gid}/insights/inactive`,
  );

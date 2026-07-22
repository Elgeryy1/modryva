import { ApiError, apiFetch } from "./api";

export type { ApiError };

export interface EntitlementStatus {
  inNetwork: boolean;
  plan: string;
  maxChats: number;
  chatCount: number;
  premiumUntil: string | null;
}

export const getEntitlementStatus = (gid: string) =>
  apiFetch<EntitlementStatus>(`/v1/miniapp/groups/${gid}/entitlement`);

export const redeemEntitlementCode = (gid: string, code: string) =>
  apiFetch<EntitlementStatus>(`/v1/miniapp/groups/${gid}/entitlement/redeem`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });

export const generateEntitlementCode = (
  gid: string,
  plan: string,
  maxChats: number,
  days: number,
) =>
  apiFetch<{ code: string }>(`/v1/miniapp/groups/${gid}/entitlement/codes`, {
    method: "POST",
    body: JSON.stringify({ plan, maxChats, days }),
  });

import { ApiError, apiFetch } from "./api";

export type RiskClassification = "none" | "low" | "medium" | "high";

export interface RiskUserEntry {
  telegramUserId: string;
  score: number;
  classification: RiskClassification;
  deletedCount: number;
  reportCount: number;
  quarantineCount: number;
  linkCount: number;
  sanctionCount: number;
  chatCount: number;
  updatedAt: string;
}

export type NetworkRiskStatus =
  | { inNetwork: false }
  | {
      inNetwork: true;
      networkId: string;
      users: RiskUserEntry[];
    };

export const getNetworkRisk = (gid: string) =>
  apiFetch<NetworkRiskStatus>(`/v1/miniapp/groups/${gid}/network/risk`);

export const resetNetworkRiskProfile = (gid: string, userId: string) =>
  apiFetch<{ ok: boolean }>(
    `/v1/miniapp/groups/${gid}/network/risk/${encodeURIComponent(userId)}/reset`,
    { method: "POST" },
  );

export { ApiError };

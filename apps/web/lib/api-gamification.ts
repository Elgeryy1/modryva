import { ApiError, apiFetch } from "./api";

export { ApiError };

export interface GamificationMission {
  kind: "first_message" | "read_rules" | "joined_required_group";
  completed: boolean;
  completedAt: string | null;
}

export interface GamificationRankingRow {
  telegramUserId: string;
  badgeCount: number;
  name?: string | null;
}

export interface GamificationGroupRankingRow {
  telegramUserId: string;
  points: number;
  name?: string | null;
}

export type GamificationStatus =
  | {
      inNetwork: false;
      groupRanking: GamificationGroupRankingRow[];
    }
  | {
      inNetwork: true;
      fedId: string;
      missions: GamificationMission[];
      badges: string[];
      networkRanking: GamificationRankingRow[];
      groupRanking: GamificationGroupRankingRow[];
    };

export const getGamificationStatus = (gid: string) =>
  apiFetch<GamificationStatus>(`/v1/miniapp/groups/${gid}/gamification`);

export interface WelcomeButtonsInput {
  rules: boolean;
  otherGroups: boolean;
  support: boolean;
  verify: boolean;
}

export interface WelcomeButtonsResult extends WelcomeButtonsInput {
  persisted: boolean;
}

export const updateWelcomeButtons = (gid: string, body: WelcomeButtonsInput) =>
  apiFetch<WelcomeButtonsResult>(
    `/v1/miniapp/groups/${gid}/gamification/welcome-buttons`,
    { method: "POST", body: JSON.stringify(body) },
  );

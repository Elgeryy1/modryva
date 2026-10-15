import { ApiError, apiFetch } from "./api";

export { ApiError };

export interface AnalyticsActivityDay {
  day: string;
  messages: number;
}

export interface AnalyticsTopPoster {
  telegramUserId: string;
  username?: string;
  messages: number;
}

export interface AnalyticsUnconfiguredChat {
  chatId: string;
  telegramChatId: string;
  missingCaptcha: boolean;
  missingAntiflood: boolean;
  missingWelcome: boolean;
}

export interface AnalyticsRecommendation {
  id: string;
  text: string;
}

export interface NetworkAnalytics {
  chatCount: number;
  totalMessages: number;
  activeUsers: number;
  recentDays: AnalyticsActivityDay[];
  topPosters: AnalyticsTopPoster[];
  hourlyRaidSpamEvents: number[];
  unconfiguredChats: AnalyticsUnconfiguredChat[];
  healthScore: number;
  recommendations: AnalyticsRecommendation[];
}

export const getNetworkAnalytics = (gid: string) =>
  apiFetch<NetworkAnalytics>(`/v1/miniapp/groups/${gid}/network/analytics`);

export const applyDoctorFix = (gid: string, recommendationId: string) =>
  apiFetch<NetworkAnalytics>(`/v1/miniapp/groups/${gid}/network/doctor/fix`, {
    method: "POST",
    body: JSON.stringify({ recommendationId }),
  });

import { ApiError, apiFetch } from "./api";

export type { ApiError };

export interface AiPackStatus {
  scope: "chat" | "user";
  priceStars: number;
  subscription: {
    active: boolean;
    canceled: boolean;
    currentPeriodEnd: string | null;
  };
}

export const getChatAiPackStatus = (gid: string) =>
  apiFetch<AiPackStatus>(`/v1/miniapp/groups/${gid}/ai-pack`);

export const createChatAiPackInvoice = (gid: string) =>
  apiFetch<{ url: string }>(`/v1/miniapp/groups/${gid}/ai-pack/invoice`, {
    method: "POST",
  });

export const redeemChatAiPackCode = (gid: string, code: string) =>
  apiFetch<AiPackStatus>(`/v1/miniapp/groups/${gid}/ai-pack/redeem-code`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });

export const cancelChatAiPack = (gid: string) =>
  apiFetch<AiPackStatus>(`/v1/miniapp/groups/${gid}/ai-pack/cancel`, {
    method: "POST",
  });

export const getPersonalAiPackStatus = () =>
  apiFetch<AiPackStatus>("/v1/miniapp/ai-pack/me");

export const createPersonalAiPackInvoice = () =>
  apiFetch<{ url: string }>("/v1/miniapp/ai-pack/me/invoice", {
    method: "POST",
  });

export const cancelPersonalAiPack = () =>
  apiFetch<AiPackStatus>("/v1/miniapp/ai-pack/me/cancel", {
    method: "POST",
  });

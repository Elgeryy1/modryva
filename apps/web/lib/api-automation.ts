import { apiFetch } from "./api";

export type AutomationTrigger =
  | { kind: "contains_text"; text: string }
  | { kind: "contains_link" }
  | { kind: "new_member" }
  | { kind: "report" }
  | { kind: "schedule"; cron: string }
  | { kind: "high_risk" };

export type AutomationCondition =
  | { kind: "none" }
  | { kind: "is_new_user"; maxAgeHours: number }
  | { kind: "not_in_chat"; telegramChatId: string }
  | { kind: "missing_badge"; badge: string }
  | { kind: "source_chat"; chatId: string };

export type AutomationAction =
  | { kind: "delete" }
  | { kind: "reply"; text: string }
  | { kind: "quarantine" }
  | { kind: "notify_staff"; text: string }
  | { kind: "log"; text: string }
  | { kind: "mute"; durationMs?: number }
  | { kind: "webhook"; url: string }
  | { kind: "assign_mission"; missionKind: string };

export interface AutomationEntry {
  id: string;
  chatId: string | null;
  name: string;
  trigger: AutomationTrigger;
  condition: AutomationCondition;
  action: AutomationAction;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export const getAutomations = (gid: string) =>
  apiFetch<{ automations: AutomationEntry[] }>(
    `/v1/miniapp/groups/${gid}/automations`,
  );

export const createAutomation = (
  gid: string,
  body: {
    name: string;
    trigger: AutomationTrigger;
    condition: AutomationCondition;
    action: AutomationAction;
    scope?: "chat" | "network";
  },
) =>
  apiFetch<AutomationEntry>(`/v1/miniapp/groups/${gid}/automations`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateAutomation = (
  gid: string,
  id: string,
  patch: Partial<{
    name: string;
    trigger: AutomationTrigger;
    condition: AutomationCondition;
    action: AutomationAction;
    enabled: boolean;
  }>,
) =>
  apiFetch<AutomationEntry>(
    `/v1/miniapp/groups/${gid}/automations/${encodeURIComponent(id)}`,
    { method: "PUT", body: JSON.stringify(patch) },
  );

export const removeAutomation = (gid: string, id: string) =>
  apiFetch<{ ok: boolean }>(
    `/v1/miniapp/groups/${gid}/automations/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );

export const toggleAutomation = (gid: string, id: string, enabled: boolean) =>
  apiFetch<{ ok: boolean }>(
    `/v1/miniapp/groups/${gid}/automations/${encodeURIComponent(id)}/toggle`,
    { method: "POST", body: JSON.stringify({ enabled }) },
  );

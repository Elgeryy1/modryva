import { apiFetch } from "./api";

export type TicketScope = "open" | "all";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
// Statuses the Mini App can set; the raw status field may also read "assigned".
export type TicketSettableStatus = "open" | "resolved" | "closed";

export interface TicketView {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  assigneeTelegramId: string | null;
  reporterTelegramId: string;
  createdAt: string;
}

export const getTickets = (gid: string, scope: TicketScope = "open") =>
  apiFetch<{ tickets: TicketView[] }>(
    `/v1/miniapp/groups/${gid}/tickets${scope === "all" ? "?scope=all" : ""}`,
  );

export const getTicket = (gid: string, id: string) =>
  apiFetch<{ ticket: TicketView }>(
    `/v1/miniapp/groups/${gid}/tickets/${encodeURIComponent(id)}`,
  );

export const setTicketStatus = (
  gid: string,
  id: string,
  status: TicketSettableStatus,
) =>
  apiFetch<{ ok: boolean }>(
    `/v1/miniapp/groups/${gid}/tickets/${encodeURIComponent(id)}/status`,
    { method: "POST", body: JSON.stringify({ status }) },
  );

export const setTicketPriority = (
  gid: string,
  id: string,
  priority: TicketPriority,
) =>
  apiFetch<{ ok: boolean }>(
    `/v1/miniapp/groups/${gid}/tickets/${encodeURIComponent(id)}/priority`,
    { method: "POST", body: JSON.stringify({ priority }) },
  );

export const assignTicket = (
  gid: string,
  id: string,
  assigneeTelegramId: string,
) =>
  apiFetch<{ ok: boolean }>(
    `/v1/miniapp/groups/${gid}/tickets/${encodeURIComponent(id)}/assign`,
    { method: "POST", body: JSON.stringify({ assigneeTelegramId }) },
  );

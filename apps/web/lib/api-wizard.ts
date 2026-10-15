import { apiFetch } from "./api";

export type WizardPlaybookId =
  | "comunidad_limpia"
  | "ventas_sin_spam"
  | "solo_miembros_verificados"
  | "modo_raid"
  | "anuncios"
  | "soporte";

export type WizardSecurityLevel = "soft" | "normal" | "strict";

export interface WizardPlaybookSummary {
  id: WizardPlaybookId;
  name: string;
  description: string;
}

export const getWizardPlaybooks = (gid: string) =>
  apiFetch<{ playbooks: WizardPlaybookSummary[] }>(
    `/v1/miniapp/groups/${gid}/wizard/playbooks`,
  );

export interface ApplyWizardInput {
  playbook: WizardPlaybookId;
  security: WizardSecurityLevel;
  staffChatId?: string;
  logsChatId?: string;
  supportChatId?: string;
}

export const applyWizardPlaybook = (gid: string, body: ApplyWizardInput) =>
  apiFetch<{
    ok: boolean;
    playbook: WizardPlaybookId;
    security: WizardSecurityLevel;
  }>(`/v1/miniapp/groups/${gid}/wizard/apply`, {
    method: "POST",
    body: JSON.stringify(body),
  });

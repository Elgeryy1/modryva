import { apiFetch } from "./api";

export interface BackupSections {
  welcome: { welcomeText: string | null; goodbyeText: string | null };
  rules: { rulesText: string | null };
  flood: {
    enabled: boolean;
    messageLimit: number;
    windowSeconds: number;
    action: "warn" | "mute" | "ban" | "delete";
  };
  captcha: {
    enabled: boolean;
    mode: "button" | "math" | "text";
    failAction: "mute" | "ban" | "restrict";
    timeoutSeconds: number;
    maxAttempts: number;
  };
  locks: { locked: string[] };
  warns: {
    warnLimit: number;
    warnMode: "ban" | "kick" | "mute" | "tban" | "tmute";
    durationMs: number | null;
    expireMs: number | null;
  };
  hygiene: {
    cleanService: boolean;
    cleanWelcome: boolean;
    nightMode: boolean;
    nightStart: number;
    nightEnd: number;
    welcomeMute: boolean;
    autoApprove: boolean;
    rtlFilter: boolean;
    cjkFilter: boolean;
    language: string;
    blockKnownSpammers: boolean;
  };
  membershipGate: { requiredTelegramChatId: string | null };
}

export interface BackupPayload {
  version: 1;
  exportedAt: string;
  sections: BackupSections;
}

export interface BackupTemplateSummary {
  id: string;
  name: string;
  description: string;
}

export const exportBackup = (gid: string) =>
  apiFetch<BackupPayload>(`/v1/miniapp/groups/${gid}/backup/export`);

export const importBackup = (gid: string, payload: unknown) =>
  apiFetch<BackupPayload>(`/v1/miniapp/groups/${gid}/backup/import`, {
    method: "POST",
    body: JSON.stringify({ payload }),
  });

export const cloneBackup = (gid: string, targetGid: string) =>
  apiFetch<BackupPayload>(`/v1/miniapp/groups/${gid}/backup/clone`, {
    method: "POST",
    body: JSON.stringify({ targetGid }),
  });

export const getBackupTemplates = (gid: string) =>
  apiFetch<{ templates: BackupTemplateSummary[] }>(
    `/v1/miniapp/groups/${gid}/backup/templates`,
  );

export const applyBackupTemplate = (gid: string, templateId: string) =>
  apiFetch<BackupPayload>(
    `/v1/miniapp/groups/${gid}/backup/templates/${encodeURIComponent(templateId)}/apply`,
    { method: "POST" },
  );

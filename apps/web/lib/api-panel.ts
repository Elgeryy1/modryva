import { apiFetch } from "./api";

export interface ModuleNameView {
  key: string;
  default: string;
  current: string;
}

export interface PanelConfig {
  dock: { available: string[]; active: string[] };
  moduleNames: ModuleNameView[];
  density: { modes: string[]; current: string };
  voice: { options: string[]; current: string };
}

export const getPanel = (gid: string) =>
  apiFetch<PanelConfig>(`/v1/miniapp/groups/${gid}/panel`);

export const toggleDockItem = (gid: string, id: string) =>
  apiFetch<{ active: string[] }>(`/v1/miniapp/groups/${gid}/panel/dock`, {
    method: "PUT",
    body: JSON.stringify({ id }),
  });

export const setModuleName = (gid: string, key: string, name: string) =>
  apiFetch<{ moduleNames: ModuleNameView[] }>(
    `/v1/miniapp/groups/${gid}/panel/module-name`,
    { method: "PUT", body: JSON.stringify({ key, name }) },
  );

export const setDensity = (gid: string, mode: string) =>
  apiFetch<{ current: string }>(`/v1/miniapp/groups/${gid}/panel/density`, {
    method: "PUT",
    body: JSON.stringify({ mode }),
  });

export const setVoice = (gid: string, voice: string) =>
  apiFetch<{ current: string }>(`/v1/miniapp/groups/${gid}/panel/voice`, {
    method: "PUT",
    body: JSON.stringify({ voice }),
  });

import { apiFetch } from "./api";

export interface StaffNoteView {
  id: string;
  authorName: string | null;
  text: string;
  createdAt: string;
}

export const getStaffNotes = (gid: string) =>
  apiFetch<{ notes: StaffNoteView[] }>(`/v1/miniapp/groups/${gid}/notes`);

export const addStaffNote = (gid: string, text: string) =>
  apiFetch<{ ok: boolean }>(`/v1/miniapp/groups/${gid}/notes`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });

export const deleteStaffNote = (gid: string, id: string) =>
  apiFetch<{ ok: boolean }>(
    `/v1/miniapp/groups/${gid}/notes/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );

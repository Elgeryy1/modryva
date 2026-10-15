"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  AppHeader,
  Banner,
  Button,
  Empty,
  Group,
  Screen,
  Section,
  SkeletonList,
  useBackButton,
} from "../../../components/ui";
import {
  addStaffNote,
  deleteStaffNote,
  getStaffNotes,
  type StaffNoteView,
} from "../../../lib/api-notes";
import { haptic, ready } from "../../../lib/telegram";

const ERROR_LABELS: Record<string, string> = {
  "not-admin": "Solo los administradores del grupo pueden ver las notas.",
  "note-not-found": "Esa nota ya no existe.",
  "invalid-note": "Escribe algo antes de guardar la nota.",
};

const humanError = (message: string): string =>
  ERROR_LABELS[message] ?? message;

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  });

function NotesInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [notes, setNotes] = useState<StaffNoteView[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useBackButton(() => router.back());

  const load = useCallback(() => {
    if (!gid) {
      setError("Abre esta pantalla desde tu grupo.");
      setNotes([]);
      return;
    }
    getStaffNotes(gid)
      .then((res) => setNotes(res.notes))
      .catch((e: Error) => {
        setError(humanError(e.message));
        setNotes([]);
      });
  }, [gid]);

  useEffect(() => {
    ready();
    load();
  }, [load]);

  const add = useCallback(async () => {
    const text = draft.trim();
    if (!text || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addStaffNote(gid, text);
      setDraft("");
      haptic.notify("success");
      load();
    } catch (e) {
      setError(humanError(e instanceof Error ? e.message : "error"));
      haptic.notify("error");
    } finally {
      setBusy(false);
    }
  }, [draft, busy, gid, load]);

  const remove = useCallback(
    async (id: string) => {
      if (busy) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await deleteStaffNote(gid, id);
        haptic.notify("success");
        load();
      } catch (e) {
        setError(humanError(e instanceof Error ? e.message : "error"));
        haptic.notify("error");
      } finally {
        setBusy(false);
      }
    },
    [busy, gid, load],
  );

  return (
    <Screen>
      <AppHeader
        glyph="📝"
        tone="teal"
        title="Notas de staff"
        subtitle="Un bloc compartido del equipo. También con /note en el chat."
      />

      {error && <Banner kind="error">{error}</Banner>}

      <Section caption="Nueva nota">
        <Group>
          <div className="row" style={{ display: "block" }}>
            <textarea
              className="textarea"
              aria-label="Texto de la nota"
              rows={3}
              value={draft}
              placeholder="Contexto de un caso, acuerdo con un miembro, recordatorio para el staff…"
              onChange={(e) => setDraft(e.target.value)}
            />
            <Button block disabled={busy || !draft.trim()} onClick={add}>
              {busy ? "…" : "Añadir nota"}
            </Button>
          </div>
        </Group>
      </Section>

      {notes === null ? (
        <SkeletonList rows={3} />
      ) : notes.length === 0 ? (
        <Empty
          icon="📝"
          tone="teal"
          title="Sin notas todavía"
          hint="Deja aquí contexto que el resto del staff deba conocer."
        />
      ) : (
        <Section caption={`${notes.length} nota(s)`}>
          <Group>
            {notes.map((n) => (
              <div className="row" style={{ display: "block" }} key={n.id}>
                <div className="row-text">
                  <span
                    className="row-title"
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    {n.text}
                  </span>
                  <span className="row-sub">
                    {`${n.authorName ?? "staff"} · ${formatDate(n.createdAt)}`}
                  </span>
                </div>
                <div className="network-role-toggles">
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() => remove(n.id)}
                  >
                    Borrar
                  </Button>
                </div>
              </div>
            ))}
          </Group>
        </Section>
      )}
    </Screen>
  );
}

export default function NotesPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={3} />
        </Screen>
      }
    >
      <NotesInner />
    </Suspense>
  );
}

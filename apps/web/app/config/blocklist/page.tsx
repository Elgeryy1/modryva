"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  AppHeader,
  Banner,
  Button,
  Empty,
  Field,
  Group,
  Row,
  Screen,
  Section,
  Segmented,
  SkeletonList,
  useBackButton,
} from "../../../components/ui";
import {
  addBlocklistEntry,
  type BlocklistEntry,
  getBlocklist,
  removeBlocklistEntry,
  setBlocklistMode,
} from "../../../lib/api";
import { BLOCKLIST_MODES } from "../../../lib/config-meta";
import { haptic, ready } from "../../../lib/telegram";

const MODE_LABELS: Record<string, string> = {
  delete: "Borrar",
  warn: "Avisar",
  mute: "Silenciar",
  ban: "Expulsar",
  kick: "Sacar",
};
const modeOptions = BLOCKLIST_MODES.map((value) => ({
  value,
  label: MODE_LABELS[value] ?? value,
}));

function BlocklistInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [mode, setMode] = useState<string>("delete");
  const [entries, setEntries] = useState<BlocklistEntry[] | null>(null);
  const [trigger, setTrigger] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useBackButton(() => router.back());

  useEffect(() => {
    ready();
    if (!gid) {
      setError("Abre esta pantalla desde tu grupo.");
      setEntries([]);
      return;
    }
    getBlocklist(gid)
      .then((res) => {
        setMode(res.mode);
        setEntries(res.entries);
      })
      .catch((e: Error) => {
        setError(e.message);
        setEntries([]);
      });
  }, [gid]);

  const onMode = useCallback(
    async (next: string) => {
      const prev = mode;
      setMode(next);
      setError(null);
      try {
        await setBlocklistMode(gid, next);
        haptic.selection();
      } catch (e) {
        setMode(prev);
        setError(e instanceof Error ? e.message : "error");
        haptic.notify("error");
      }
    },
    [gid, mode],
  );

  const onAdd = useCallback(async () => {
    const word = trigger.trim();
    if (!word || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const note = reason.trim();
      const created = await addBlocklistEntry(
        gid,
        word,
        note.length > 0 ? note : undefined,
      );
      setEntries((list) => [...(list ?? []), created]);
      setTrigger("");
      setReason("");
      haptic.notify("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      haptic.notify("error");
    } finally {
      setBusy(false);
    }
  }, [gid, trigger, reason, busy]);

  const onRemove = useCallback(
    async (id: string) => {
      setError(null);
      try {
        await removeBlocklistEntry(gid, id);
        setEntries((list) => (list ?? []).filter((e) => e.id !== id));
        haptic.notify("success");
      } catch (e) {
        setError(e instanceof Error ? e.message : "error");
        haptic.notify("error");
      }
    },
    [gid],
  );

  return (
    <Screen>
      <AppHeader
        glyph="🚫"
        tone="red"
        title="Palabras prohibidas"
        subtitle="Actúa cuando alguien las escribe"
      />

      <Field label="Acción al detectar">
        <Segmented options={modeOptions} value={mode} onChange={onMode} />
      </Field>

      {error && <Banner kind="error">{error}</Banner>}

      <Section caption="Palabras">
        {entries === null ? (
          <SkeletonList rows={3} />
        ) : entries.length === 0 ? (
          <Empty
            icon="🚫"
            tone="red"
            title="Sin palabras prohibidas"
            hint="Añade abajo la primera palabra o frase a vigilar."
          />
        ) : (
          <Group>
            {entries.map((entry) => (
              <Row
                key={entry.id}
                title={entry.trigger}
                {...(entry.reason ? { subtitle: entry.reason } : {})}
                trailing={
                  <Button
                    variant="ghost"
                    aria-label={`Quitar ${entry.trigger}`}
                    onClick={() => onRemove(entry.id)}
                  >
                    ×
                  </Button>
                }
              />
            ))}
          </Group>
        )}
      </Section>

      <Section caption="Añadir">
        <Field label="Palabra o frase" hint="Admite * como comodín.">
          <input
            className="input"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder="p. ej. spam*"
          />
        </Field>
        <Field label="Motivo (opcional)">
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Por qué se prohíbe"
          />
        </Field>
        <Button
          variant="primary"
          block
          disabled={busy || trigger.trim().length === 0}
          onClick={onAdd}
        >
          {busy ? "Añadiendo…" : "Añadir palabra"}
        </Button>
      </Section>
    </Screen>
  );
}

export default function BlocklistPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={3} />
        </Screen>
      }
    >
      <BlocklistInner />
    </Suspense>
  );
}

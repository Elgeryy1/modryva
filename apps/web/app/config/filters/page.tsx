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
  SkeletonList,
  useBackButton,
} from "../../../components/ui";
import {
  addFilter,
  type FilterEntry,
  getFilters,
  removeFilter,
} from "../../../lib/api";
import { haptic, ready } from "../../../lib/telegram";

function FiltersInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [entries, setEntries] = useState<FilterEntry[] | null>(null);
  const [trigger, setTrigger] = useState("");
  const [response, setResponse] = useState("");
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
    getFilters(gid)
      .then((res) => setEntries(res.entries))
      .catch((e: Error) => {
        setError(e.message);
        setEntries([]);
      });
  }, [gid]);

  const onAdd = useCallback(async () => {
    const word = trigger.trim();
    const reply = response.trim();
    if (!word || !reply || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await addFilter(gid, word, reply);
      setEntries((list) => {
        const rest = (list ?? []).filter((e) => e.id !== created.id);
        return [...rest, created];
      });
      setTrigger("");
      setResponse("");
      haptic.notify("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      haptic.notify("error");
    } finally {
      setBusy(false);
    }
  }, [gid, trigger, response, busy]);

  const onRemove = useCallback(
    async (id: string) => {
      setError(null);
      try {
        await removeFilter(gid, id);
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
        glyph="💬"
        tone="teal"
        title="Filtros"
        subtitle="Respuestas automáticas a palabras clave"
      />

      {error && <Banner kind="error">{error}</Banner>}

      <Section caption="Respuestas">
        {entries === null ? (
          <SkeletonList rows={3} />
        ) : entries.length === 0 ? (
          <Empty
            icon="💬"
            tone="teal"
            title="Sin filtros"
            hint="Crea abajo tu primera respuesta automática."
          />
        ) : (
          <Group>
            {entries.map((entry) => (
              <Row
                key={entry.id}
                icon="💬"
                tone="teal"
                title={entry.trigger}
                subtitle={entry.response}
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
        <Field label="Palabra clave" hint="El texto que dispara la respuesta.">
          <input
            className="input"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder="p. ej. horario"
          />
        </Field>
        <Field label="Respuesta">
          <textarea
            className="textarea"
            rows={3}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="El mensaje que enviará el bot"
          />
        </Field>
        <Button
          variant="primary"
          block
          disabled={
            busy || trigger.trim().length === 0 || response.trim().length === 0
          }
          onClick={onAdd}
        >
          {busy ? "Guardando…" : "Añadir filtro"}
        </Button>
      </Section>
    </Screen>
  );
}

export default function FiltersPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={3} />
        </Screen>
      }
    >
      <FiltersInner />
    </Suspense>
  );
}

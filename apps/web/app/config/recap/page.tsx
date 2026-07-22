"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  AppHeader,
  Banner,
  Group,
  GroupNote,
  Row,
  Screen,
  Section,
  SkeletonList,
  Toggle,
  useBackButton,
} from "../../../components/ui";
import { getWeeklyRecap, putWeeklyRecap } from "../../../lib/api";
import { haptic, ready } from "../../../lib/telegram";

function RecapInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useBackButton(() => router.back());

  useEffect(() => {
    ready();
    if (!gid) {
      setError("Abre esta pantalla desde tu grupo.");
      setEnabled(false);
      return;
    }
    getWeeklyRecap(gid)
      .then((res) => setEnabled(res.enabled))
      .catch((e: Error) => {
        setError(e.message);
        setEnabled(false);
      });
  }, [gid]);

  const onToggle = useCallback(
    async (next: boolean) => {
      if (busy) {
        return;
      }
      setEnabled(next);
      setBusy(true);
      setError(null);
      try {
        const res = await putWeeklyRecap(gid, next);
        setEnabled(res.enabled);
        haptic.notify("success");
      } catch (e) {
        setEnabled(!next); // revert on failure
        setError(e instanceof Error ? e.message : "error");
        haptic.notify("error");
      } finally {
        setBusy(false);
      }
    },
    [gid, busy],
  );

  return (
    <Screen>
      <AppHeader
        glyph="🗓️"
        tone="teal"
        title="Recap semanal"
        subtitle="Un resumen de la semana del grupo, cada lunes"
      />

      {error && <Banner kind="error">{error}</Banner>}

      <Section caption="Resumen automático">
        {enabled === null ? (
          <SkeletonList rows={1} />
        ) : (
          <Group>
            <Row
              icon="🗓️"
              tone="teal"
              title="Recap semanal"
              subtitle="El bot publica un resumen de la semana (más activos, actividad, tema)"
              trailing={
                <Toggle
                  label="Recap semanal"
                  checked={enabled}
                  onChange={(next) => void onToggle(next)}
                />
              }
            />
          </Group>
        )}
      </Section>

      <GroupNote>
        Cada lunes el bot publica un resumen corto de la semana. Usa solo datos
        agregados (número de mensajes, quién participó más, día más activo) —
        nunca el contenido de los mensajes. Si la IA está disponible lo redacta
        en tono natural; si no, lo muestra como estadísticas. Respeta el modo
        silencio: con el bot silenciado no lo publica.
      </GroupNote>
    </Screen>
  );
}

export default function RecapPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={1} />
        </Screen>
      }
    >
      <RecapInner />
    </Suspense>
  );
}

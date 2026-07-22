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
import { getQuiet, putQuiet } from "../../../lib/api";
import { haptic, ready } from "../../../lib/telegram";

function QuietInner() {
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
    getQuiet(gid)
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
        const res = await putQuiet(gid, next);
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
        glyph="🔕"
        tone="blue"
        title="Modo silencio"
        subtitle="Que el bot solo hable cuando se le pide"
      />

      {error && <Banner kind="error">{error}</Banner>}

      <Section caption="Anuncios del bot">
        {enabled === null ? (
          <SkeletonList rows={1} />
        ) : (
          <Group>
            <Row
              icon="🔕"
              tone="blue"
              title="Modo silencio"
              subtitle="El bot deja de anunciar subidas de nivel y celebraciones"
              trailing={
                <Toggle
                  label="Modo silencio"
                  checked={enabled}
                  onChange={(next) => void onToggle(next)}
                />
              }
            />
          </Group>
        )}
      </Section>

      <GroupNote>
        Con el modo silencio activado, el bot no escribe por su cuenta (nada de
        "subió de nivel"). Sigue moderando el grupo y respondiendo a los
        comandos y a la IA cuando se le pide.
      </GroupNote>
    </Screen>
  );
}

export default function QuietPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={1} />
        </Screen>
      }
    >
      <QuietInner />
    </Suspense>
  );
}

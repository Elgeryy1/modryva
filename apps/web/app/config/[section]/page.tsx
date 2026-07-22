"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SectionForm } from "../../../components/config-sections";
import {
  Banner,
  Empty,
  Screen,
  SkeletonList,
  useBackButton,
} from "../../../components/ui";
import { getSection, putSection } from "../../../lib/api";
import { isSectionName } from "../../../lib/config-meta";
import { haptic, ready } from "../../../lib/telegram";

type Value = Record<string, unknown>;

export default function SectionPage() {
  const params = useParams<{ section: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const section = String(params.section);
  const gid = search.get("gid") ?? "";

  const [value, setValue] = useState<Value | null>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "saving" | "error" | "bad"
  >("loading");
  const [error, setError] = useState<string | null>(null);

  // Native back arrow returns to the config menu (restoring its start param).
  useBackButton(() => router.back());

  useEffect(() => {
    ready();
    if (!isSectionName(section) || !gid) {
      setStatus("bad");
      return;
    }
    getSection<Value>(gid, section)
      .then((v) => {
        setValue(v);
        setStatus("ready");
      })
      .catch((e: Error) => {
        setStatus("error");
        setError(e.message);
      });
  }, [section, gid]);

  const save = useCallback(
    async (next: Value) => {
      setStatus("saving");
      setError(null);
      try {
        const saved = await putSection<Value>(gid, section, next);
        setValue(saved);
        setStatus("ready");
        haptic.notify("success");
      } catch (e) {
        setStatus("ready");
        setError(e instanceof Error ? e.message : "error");
        haptic.notify("error");
      }
    },
    [gid, section],
  );

  if (status === "bad") {
    return (
      <Screen>
        <Empty
          icon="🚧"
          tone="orange"
          title="Sección no válida"
          hint="Vuelve al menú de configuración y elige una opción."
        />
      </Screen>
    );
  }
  if (status === "error" && value === null) {
    return (
      <Screen>
        <Banner kind="error">{error}</Banner>
      </Screen>
    );
  }
  if (value === null) {
    return (
      <Screen>
        <SkeletonList rows={4} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionForm
        section={section}
        gid={gid}
        initial={value}
        onSave={save}
        saving={status === "saving"}
        error={error}
      />
    </Screen>
  );
}

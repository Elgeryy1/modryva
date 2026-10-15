"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  AppHeader,
  Banner,
  Button,
  Group,
  GroupNote,
  Row,
  Screen,
  Section,
  Segmented,
  SkeletonList,
  Toggle,
  useBackButton,
} from "../../../components/ui";
import {
  getPanel,
  type PanelConfig,
  setDensity,
  setModuleName,
  setVoice,
  toggleDockItem,
} from "../../../lib/api-panel";
import { haptic, ready } from "../../../lib/telegram";

const ERROR_LABELS: Record<string, string> = {
  "not-admin": "Solo los administradores pueden personalizar el panel.",
  "invalid-dock-item": "Ese acceso rápido no existe.",
  "invalid-module": "Ese módulo no existe.",
  "invalid-density": "Ese modo de densidad no es válido.",
  "invalid-voice": "Ese tono no es válido.",
};

const humanError = (message: string): string =>
  ERROR_LABELS[message] ?? message;

const DOCK_LABELS: Record<string, string> = {
  hoy: "Hoy",
  inbox: "Bandeja",
  usuarios: "Usuarios",
  juegos: "Juegos",
  staff: "Staff",
};

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function PanelInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [config, setConfig] = useState<PanelConfig | null>(null);
  const [nameEdits, setNameEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useBackButton(() => router.back());

  const load = useCallback(() => {
    if (!gid) {
      setError("Abre esta pantalla desde tu grupo.");
      return;
    }
    getPanel(gid)
      .then((cfg) => {
        setConfig(cfg);
        setNameEdits(
          Object.fromEntries(cfg.moduleNames.map((m) => [m.key, m.current])),
        );
      })
      .catch((e: Error) => setError(humanError(e.message)));
  }, [gid]);

  useEffect(() => {
    ready();
    load();
  }, [load]);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      if (busy) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await action();
        haptic.notify("success");
      } catch (e) {
        setError(humanError(e instanceof Error ? e.message : "error"));
        haptic.notify("error");
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  if (error && !config) {
    return (
      <Screen>
        <AppHeader glyph="🎛️" tone="blue" title="Personalizar panel" />
        <Banner kind="error">{error}</Banner>
      </Screen>
    );
  }

  if (!config) {
    return (
      <Screen>
        <AppHeader glyph="🎛️" tone="blue" title="Personalizar panel" />
        <SkeletonList rows={4} />
      </Screen>
    );
  }

  const densityOptions = config.density.modes.map((m) => ({
    value: m,
    label: cap(m),
  }));
  const voiceOptions = config.voice.options.map((v) => ({
    value: v,
    label: cap(v),
  }));

  return (
    <Screen>
      <AppHeader
        glyph="🎛️"
        tone="blue"
        title="Personalizar panel"
        subtitle="Accesos, nombres, densidad y tono del bot"
      />

      {error && <Banner kind="error">{error}</Banner>}

      <Section caption="Accesos rápidos (dock)">
        <Group>
          {config.dock.available.map((id) => {
            const active = config.dock.active.includes(id);
            return (
              <Row
                key={id}
                icon={active ? "★" : "☆"}
                tone={active ? "brand" : "gray"}
                title={DOCK_LABELS[id] ?? cap(id)}
                trailing={
                  <Toggle
                    checked={active}
                    label={DOCK_LABELS[id] ?? id}
                    onChange={() =>
                      run(async () => {
                        const res = await toggleDockItem(gid, id);
                        setConfig((c) =>
                          c
                            ? { ...c, dock: { ...c.dock, active: res.active } }
                            : c,
                        );
                      })
                    }
                  />
                }
              />
            );
          })}
        </Group>
        <GroupNote>
          Qué botones aparecen en la barra de accesos del panel.
        </GroupNote>
      </Section>

      <Section caption="Densidad (tu vista)">
        <Group>
          <div className="row">
            <Segmented
              options={densityOptions}
              value={config.density.current}
              onChange={(mode) =>
                run(async () => {
                  const res = await setDensity(gid, mode);
                  setConfig((c) =>
                    c
                      ? {
                          ...c,
                          density: { ...c.density, current: res.current },
                        }
                      : c,
                  );
                })
              }
            />
          </div>
        </Group>
        <GroupNote>
          Cuántas filas y animaciones ves en la Mini App. Es tu ajuste personal.
        </GroupNote>
      </Section>

      <Section caption="Tono del bot">
        <Group>
          <div className="row">
            <Segmented
              options={voiceOptions}
              value={config.voice.current}
              onChange={(voice) =>
                run(async () => {
                  const res = await setVoice(gid, voice);
                  setConfig((c) =>
                    c
                      ? { ...c, voice: { ...c.voice, current: res.current } }
                      : c,
                  );
                })
              }
            />
          </div>
        </Group>
        <GroupNote>
          Cómo suenan los mensajes del bot en el grupo (serio, cercano, gamer…).
        </GroupNote>
      </Section>

      <Section caption="Nombres de los módulos">
        <GroupNote>
          Renombra cómo llama el bot a cada módulo. Vacío = por defecto.
        </GroupNote>
        <Group>
          {config.moduleNames.map((m) => {
            const value = nameEdits[m.key] ?? "";
            const changed = value.trim() !== m.current;
            return (
              <div className="row" style={{ display: "block" }} key={m.key}>
                <span className="row-sub">{m.default}</span>
                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                  <input
                    className="input"
                    aria-label={`Nombre de ${m.default}`}
                    value={value}
                    placeholder={m.default}
                    onChange={(e) =>
                      setNameEdits((prev) => ({
                        ...prev,
                        [m.key]: e.target.value,
                      }))
                    }
                  />
                  <Button
                    variant="secondary"
                    disabled={busy || !changed}
                    onClick={() =>
                      run(async () => {
                        const res = await setModuleName(
                          gid,
                          m.key,
                          value.trim(),
                        );
                        setConfig((c) =>
                          c ? { ...c, moduleNames: res.moduleNames } : c,
                        );
                        setNameEdits(
                          Object.fromEntries(
                            res.moduleNames.map((x) => [x.key, x.current]),
                          ),
                        );
                      })
                    }
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            );
          })}
        </Group>
      </Section>
    </Screen>
  );
}

export default function PanelPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={4} />
        </Screen>
      }
    >
      <PanelInner />
    </Suspense>
  );
}

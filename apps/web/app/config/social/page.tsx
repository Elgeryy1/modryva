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
  getSocial,
  putSocial,
  type SocialRankingRow,
  type SocialSettings,
} from "../../../lib/api";
import { haptic, ready } from "../../../lib/telegram";

/**
 * The Social panel.
 *
 * Edits are held locally and saved with one button rather than on every
 * keystroke: the settings are interdependent (a probability is a pair, a mute
 * duration only matters under one consequence), and PUTting each half-typed
 * state would let the group live for a moment in a configuration the admin
 * never meant.
 */

const TIMEZONES = [
  "Europe/Madrid",
  "Europe/London",
  "Atlantic/Canary",
  "America/Bogota",
  "America/Mexico_City",
  "America/Argentina/Buenos_Aires",
  "America/New_York",
  "UTC",
];

const clampInt = (raw: string, min: number, max: number, fallback: number) => {
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
};

const timeLabel = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;

function SocialInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [settings, setSettings] = useState<SocialSettings | null>(null);
  const [ranking, setRanking] = useState<SocialRankingRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useBackButton(() => router.back());

  useEffect(() => {
    ready();
    if (!gid) {
      setError("Abre esta pantalla desde tu grupo.");
      return;
    }
    getSocial(gid)
      .then((res) => {
        setSettings(res.settings);
        setRanking(res.ranking);
      })
      .catch((e: Error) => setError(e.message));
  }, [gid]);

  const patch = useCallback((next: Partial<SocialSettings>) => {
    setSettings((prior) => (prior ? { ...prior, ...next } : prior));
    setDirty(true);
    setSaved(false);
  }, []);

  const save = useCallback(async () => {
    if (!settings || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const stored = await putSocial(gid, settings);
      // Render what the SERVER stored, not what was typed: the two can differ
      // (a clamped duration), and showing the typed value would be a lie.
      setSettings(stored);
      setDirty(false);
      setSaved(true);
      haptic.notify("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No he podido guardar.");
      haptic.notify("error");
    } finally {
      setBusy(false);
    }
  }, [gid, settings, busy]);

  if (error && !settings) {
    return (
      <Screen>
        <AppHeader glyph="🥇" tone="brand" title="Social" />
        <Banner kind="error">{error}</Banner>
      </Screen>
    );
  }

  if (!settings) {
    return (
      <Screen>
        <AppHeader glyph="🥇" tone="brand" title="Social" />
        <SkeletonList rows={4} />
      </Screen>
    );
  }

  const { pole, roulette, fun } = settings;

  return (
    <Screen>
      <AppHeader
        glyph="🥇"
        tone="brand"
        title="Social"
        subtitle="Pole diaria, ruleta y diversión del grupo"
      />

      {error && <Banner kind="error">{error}</Banner>}
      {saved && !dirty && <Banner kind="success">Guardado.</Banner>}

      {/* ---------------------------------------------------------------- */}
      <Section caption="Pole diaria">
        <Group>
          <Row
            icon="🥇"
            tone="brand"
            title="Pole activada"
            subtitle="Un ritual diario: quién llega primero al grupo"
            trailing={
              <Toggle
                label="Pole activada"
                checked={pole.enabled}
                onChange={(enabled) => patch({ pole: { ...pole, enabled } })}
              />
            }
          />
        </Group>

        {pole.enabled && (
          <>
            <Group>
              <Field
                label="Cómo se reclama"
                hint={
                  pole.mode === "AUTO_FIRST_MESSAGE"
                    ? "El primer mensaje del día se lleva la pole. Necesita que me lleguen los mensajes normales: comprueba /status social."
                    : "Cada persona escribe /pole. Funciona siempre, incluso con el modo privacidad activado."
                }
              >
                <Segmented
                  value={pole.mode}
                  options={[
                    { value: "COMMAND_CLAIM", label: "Con /pole" },
                    { value: "AUTO_FIRST_MESSAGE", label: "Automática" },
                  ]}
                  onChange={(mode) => patch({ pole: { ...pole, mode } })}
                />
              </Field>

              <Field
                label="Zona horaria"
                hint="Decide cuándo empieza el día para este grupo."
              >
                <select
                  className="input"
                  value={pole.timezone}
                  onChange={(e) =>
                    patch({ pole: { ...pole, timezone: e.target.value } })
                  }
                >
                  {/* A zone already saved but not in the shortlist must not
                      vanish from the picker and silently change on save. */}
                  {(TIMEZONES.includes(pole.timezone)
                    ? TIMEZONES
                    : [pole.timezone, ...TIMEZONES]
                  ).map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label={`Hora de reinicio — ${timeLabel(pole.resetMinutes)}`}
                hint="A esta hora local se abre la pole del día siguiente."
              >
                <input
                  className="input"
                  type="time"
                  value={timeLabel(pole.resetMinutes)}
                  onChange={(e) => {
                    const [hh, mm] = e.target.value.split(":");
                    const minutes =
                      clampInt(hh ?? "0", 0, 23, 0) * 60 +
                      clampInt(mm ?? "0", 0, 59, 0);
                    patch({ pole: { ...pole, resetMinutes: minutes } });
                  }}
                />
              </Field>

              <Field
                label="Puestos"
                hint="1 = solo la pole. 3 = pole, subpole y bronce."
              >
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={10}
                  value={pole.positions}
                  onChange={(e) =>
                    patch({
                      pole: {
                        ...pole,
                        positions: clampInt(e.target.value, 1, 10, 3),
                      },
                    })
                  }
                />
              </Field>

              <Field
                label="Grupos con temas"
                hint="Un solo ranking para todo el grupo, o uno por tema."
              >
                <Segmented
                  value={pole.threadScope}
                  options={[
                    { value: "shared", label: "Todo el grupo" },
                    { value: "per-topic", label: "Por tema" },
                  ]}
                  onChange={(threadScope) =>
                    patch({ pole: { ...pole, threadScope } })
                  }
                />
              </Field>
            </Group>

            {pole.mode === "AUTO_FIRST_MESSAGE" && (
              <Group>
                <Row
                  icon="🖼"
                  tone="purple"
                  title="Las fotos y stickers cuentan"
                  subtitle="Si está apagado, solo gana un mensaje de texto"
                  trailing={
                    <Toggle
                      label="Las fotos y stickers cuentan"
                      checked={pole.allowMedia}
                      onChange={(allowMedia) =>
                        patch({ pole: { ...pole, allowMedia } })
                      }
                    />
                  }
                />
              </Group>
            )}
          </>
        )}
        <GroupNote>
          La ventana se calcula con la zona horaria del grupo cada vez que
          alguien reclama, así que un reinicio del bot o un cambio de hora no
          rompen el día.
        </GroupNote>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section caption="Ruleta rusa virtual">
        <Group>
          <Row
            icon="🔫"
            tone="red"
            title="Ruleta activada"
            subtitle="Juego del grupo. Siempre juega quien escribe el comando"
            trailing={
              <Toggle
                label="Ruleta activada"
                checked={roulette.enabled}
                onChange={(enabled) =>
                  patch({ roulette: { ...roulette, enabled } })
                }
              />
            }
          />
        </Group>

        {roulette.enabled && (
          <Group>
            <Field
              label={`Probabilidad — ${roulette.numerator} de cada ${roulette.denominator}`}
              hint="Cuántas veces de cada N sale mal."
            >
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={roulette.denominator - 1}
                  value={roulette.numerator}
                  onChange={(e) =>
                    patch({
                      roulette: {
                        ...roulette,
                        numerator: clampInt(
                          e.target.value,
                          1,
                          Math.max(1, roulette.denominator - 1),
                          1,
                        ),
                      },
                    })
                  }
                />
                <input
                  className="input"
                  type="number"
                  min={2}
                  max={100}
                  value={roulette.denominator}
                  onChange={(e) => {
                    const denominator = clampInt(e.target.value, 2, 100, 6);
                    patch({
                      roulette: {
                        ...roulette,
                        denominator,
                        // Keeping the numerator below the denominator here
                        // stops the form ever showing "6 de cada 6", which the
                        // API would refuse anyway.
                        numerator: Math.min(
                          roulette.numerator,
                          denominator - 1,
                        ),
                      },
                    });
                  }}
                />
              </div>
            </Field>

            <Field
              label="Qué pasa si sale mal"
              hint={
                roulette.consequence === "TEMPORARY_MUTE"
                  ? "Necesito permiso para restringir miembros. Si no lo tengo, lo digo y no silencio a nadie."
                  : "Solo una frase. Nadie es sancionado."
              }
            >
              <Segmented
                value={roulette.consequence}
                options={[
                  { value: "FUN_ONLY", label: "Solo diversión" },
                  { value: "TEMPORARY_MUTE", label: "Silencio temporal" },
                ]}
                onChange={(consequence) =>
                  patch({ roulette: { ...roulette, consequence } })
                }
              />
            </Field>

            {roulette.consequence === "TEMPORARY_MUTE" && (
              <Field
                label="Duración del silencio (segundos)"
                hint="Mínimo 60. Por debajo, Telegram lo interpreta como permanente."
              >
                <input
                  className="input"
                  type="number"
                  min={60}
                  max={86400}
                  step={60}
                  value={roulette.muteSeconds}
                  onChange={(e) =>
                    patch({
                      roulette: {
                        ...roulette,
                        muteSeconds: clampInt(e.target.value, 60, 86400, 60),
                      },
                    })
                  }
                />
              </Field>
            )}

            <Field
              label="Espera entre tiradas (segundos)"
              hint="Por persona y para todo el grupo."
            >
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={3600}
                  value={roulette.userCooldownSeconds}
                  onChange={(e) =>
                    patch({
                      roulette: {
                        ...roulette,
                        userCooldownSeconds: clampInt(
                          e.target.value,
                          0,
                          3600,
                          30,
                        ),
                      },
                    })
                  }
                />
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={3600}
                  value={roulette.chatCooldownSeconds}
                  onChange={(e) =>
                    patch({
                      roulette: {
                        ...roulette,
                        chatCooldownSeconds: clampInt(
                          e.target.value,
                          0,
                          3600,
                          5,
                        ),
                      },
                    })
                  }
                />
              </div>
            </Field>
          </Group>
        )}
        <GroupNote>
          Es un juego virtual. Nunca se puede apuntar a otra persona, y los
          administradores no se silencian nunca.
        </GroupNote>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section caption="Diversión">
        <Group>
          <Row
            icon="📜"
            tone="purple"
            title="/paulo"
            subtitle="Frases motivacionales absurdas, originales de Modryva"
            trailing={
              <Toggle
                label="/paulo"
                checked={fun.pauloEnabled}
                onChange={(pauloEnabled) =>
                  patch({ fun: { ...fun, pauloEnabled } })
                }
              />
            }
          />
          <Row
            icon="🐱"
            tone="orange"
            title="/gato"
            subtitle="Necesita una biblioteca de imágenes con licencia"
            trailing={
              <Toggle
                label="/gato"
                checked={fun.catsEnabled}
                onChange={(catsEnabled) =>
                  patch({ fun: { ...fun, catsEnabled } })
                }
              />
            }
          />
          <Row
            icon="🐶"
            tone="teal"
            title="/perro"
            subtitle="Necesita una biblioteca de imágenes con licencia"
            trailing={
              <Toggle
                label="/perro"
                checked={fun.dogsEnabled}
                onChange={(dogsEnabled) =>
                  patch({ fun: { ...fun, dogsEnabled } })
                }
              />
            }
          />
        </Group>
        <GroupNote>
          De fábrica no hay biblioteca de gatos ni de perros: solo se sirven
          imágenes con fuente y licencia registradas, así que hasta que se suban
          los comandos responden que no hay nada.
        </GroupNote>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section caption="Apoyo">
        <Group>
          <Field
            label="Enlace de /apoyar"
            hint="Solo https. Déjalo vacío y el comando dirá que no hay nada configurado."
          >
            <input
              className="input"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={settings.supportUrl}
              onChange={(e) => patch({ supportUrl: e.target.value.trim() })}
            />
          </Field>
        </Group>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section caption="Clasificación">
        {ranking.length === 0 ? (
          <Empty
            icon="🏆"
            tone="brand"
            title="Todavía no hay poles"
            hint="En cuanto alguien reclame la primera, aparecerá aquí."
          />
        ) : (
          <Group>
            {ranking.map((row, index) => (
              <Row
                key={row.userId}
                icon={["🥇", "🥈", "🥉"][index] ?? String(index + 1)}
                tone={index < 3 ? "brand" : "gray"}
                title={row.userName ?? "Alguien"}
                value={`🥇${row.firsts} 🥈${row.seconds} 🥉${row.thirds}`}
              />
            ))}
          </Group>
        )}
      </Section>

      <Section>
        <Button block disabled={busy || !dirty} onClick={() => void save()}>
          {busy ? "Guardando…" : dirty ? "Guardar cambios" : "Sin cambios"}
        </Button>
      </Section>
    </Screen>
  );
}

export default function SocialPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={4} />
        </Screen>
      }
    >
      <SocialInner />
    </Suspense>
  );
}

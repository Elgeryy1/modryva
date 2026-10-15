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
  Toggle,
  useBackButton,
} from "../../../components/ui";
import {
  type GamificationStatus,
  getGamificationStatus,
  updateWelcomeButtons,
  type WelcomeButtonsInput,
} from "../../../lib/api-gamification";
import { haptic, ready } from "../../../lib/telegram";

const DEFAULT_WELCOME_BUTTONS: WelcomeButtonsInput = {
  rules: false,
  otherGroups: false,
  support: false,
  verify: false,
};

const MISSION_LABELS: Record<string, string> = {
  first_message: "Escribir el primer mensaje",
  read_rules: "Leer las reglas",
  joined_required_group: "Unirse al grupo requerido",
};

const ERROR_LABELS: Record<string, string> = {
  "not-admin": "Solo los administradores del grupo pueden ver esto.",
  "invalid-body": "Revisa los botones de bienvenida e intenta de nuevo.",
};

const humanError = (message: string): string =>
  ERROR_LABELS[message] ?? message;

function GamificationInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [status, setStatus] = useState<GamificationStatus | null>(null);
  const [welcomeButtons, setWelcomeButtons] = useState<WelcomeButtonsInput>(
    DEFAULT_WELCOME_BUTTONS,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [persistedNote, setPersistedNote] = useState(false);

  useBackButton(() => router.back());

  const load = useCallback(() => {
    if (!gid) {
      setError("Abre esta pantalla desde tu grupo.");
      setStatus({ inNetwork: false, groupRanking: [] });
      return;
    }
    getGamificationStatus(gid)
      .then(setStatus)
      .catch((e: Error) => {
        setError(humanError(e.message));
        setStatus({ inNetwork: false, groupRanking: [] });
      });
  }, [gid]);

  useEffect(() => {
    ready();
    load();
  }, [load]);

  const saveWelcomeButtons = useCallback(async () => {
    if (busy || !gid) {
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const result = await updateWelcomeButtons(gid, welcomeButtons);
      setPersistedNote(!result.persisted);
      setSaved(true);
      haptic.notify("success");
    } catch (e) {
      setError(humanError(e instanceof Error ? e.message : "error"));
      haptic.notify("error");
    } finally {
      setBusy(false);
    }
  }, [busy, gid, welcomeButtons]);

  return (
    <Screen>
      <AppHeader
        glyph="M"
        tone="purple"
        title="Misiones y gamificación"
        subtitle="Progreso, insignias y ranking de la comunidad"
      />

      {error && <Banner kind="error">{error}</Banner>}
      {saved && <Banner kind="success">Cambios aplicados.</Banner>}
      {saved && persistedNote && (
        <Banner>
          Estos botones aun no se guardan de forma permanente: el bot todavia no
          tiene un lugar donde persistirlos. Por ahora solo se validan.
        </Banner>
      )}

      {status === null ? (
        <SkeletonList rows={4} />
      ) : (
        <>
          {status.inNetwork && (
            <Section caption="Tus misiones">
              <Group>
                {status.missions.map((mission) => (
                  <Row
                    key={mission.kind}
                    icon={mission.completed ? "✓" : "•"}
                    tone={mission.completed ? "teal" : "gray"}
                    title={MISSION_LABELS[mission.kind] ?? mission.kind}
                    subtitle={
                      mission.completed && mission.completedAt
                        ? new Date(mission.completedAt).toLocaleString()
                        : "Pendiente"
                    }
                    value={mission.completed ? "Completada" : "En progreso"}
                  />
                ))}
              </Group>
            </Section>
          )}

          {status.inNetwork && (
            <Section caption="Tus insignias">
              {status.badges.length === 0 ? (
                <Empty
                  icon="B"
                  tone="gray"
                  title="Todavia sin insignias"
                  hint="Completa misiones para conseguir tu primera insignia."
                />
              ) : (
                <Group>
                  {status.badges.map((badge) => (
                    <Row key={badge} icon="B" tone="orange" title={badge} />
                  ))}
                </Group>
              )}
            </Section>
          )}

          {status.inNetwork && (
            <Section caption="Ranking de la red">
              {status.networkRanking.length === 0 ? (
                <Empty
                  icon="R"
                  tone="gray"
                  title="Sin datos todavia"
                  hint="El ranking se llena a medida que la gente consigue insignias."
                />
              ) : (
                <Group>
                  {status.networkRanking.map((row, index) => (
                    <Row
                      key={row.telegramUserId}
                      icon={String(index + 1)}
                      tone="purple"
                      title={row.name ?? row.telegramUserId}
                      value={`${row.badgeCount} insignias`}
                    />
                  ))}
                </Group>
              )}
            </Section>
          )}

          <Section caption="Ranking de este grupo">
            {status.groupRanking.length === 0 ? (
              <Empty
                icon="R"
                tone="gray"
                title="Sin puntos todavia"
                hint="El ranking se llena con la actividad del grupo."
              />
            ) : (
              <Group>
                {status.groupRanking.map((row, index) => (
                  <Row
                    key={row.telegramUserId}
                    icon={String(index + 1)}
                    tone="blue"
                    title={row.name ?? row.telegramUserId}
                    value={`${row.points} pts`}
                  />
                ))}
              </Group>
            )}
          </Section>

          <Section caption="Botones de bienvenida">
            <Group>
              <Field label="Reglas">
                <Toggle
                  checked={welcomeButtons.rules}
                  label="Reglas"
                  onChange={(next) =>
                    setWelcomeButtons((prev) => ({ ...prev, rules: next }))
                  }
                />
              </Field>
              <Field label="Otros grupos">
                <Toggle
                  checked={welcomeButtons.otherGroups}
                  label="Otros grupos"
                  onChange={(next) =>
                    setWelcomeButtons((prev) => ({
                      ...prev,
                      otherGroups: next,
                    }))
                  }
                />
              </Field>
              <Field label="Soporte">
                <Toggle
                  checked={welcomeButtons.support}
                  label="Soporte"
                  onChange={(next) =>
                    setWelcomeButtons((prev) => ({ ...prev, support: next }))
                  }
                />
              </Field>
              <Field label="Verificar">
                <Toggle
                  checked={welcomeButtons.verify}
                  label="Verificar"
                  onChange={(next) =>
                    setWelcomeButtons((prev) => ({ ...prev, verify: next }))
                  }
                />
              </Field>
            </Group>
            <Button
              variant="primary"
              block
              disabled={busy}
              onClick={() => void saveWelcomeButtons()}
            >
              {busy ? "Guardando..." : "Guardar botones"}
            </Button>
          </Section>
        </>
      )}
    </Screen>
  );
}

export default function GamificationPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={4} />
        </Screen>
      }
    >
      <GamificationInner />
    </Suspense>
  );
}

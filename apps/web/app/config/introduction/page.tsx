"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  AppHeader,
  Banner,
  Field,
  Group,
  GroupNote,
  Row,
  Screen,
  Section,
  SkeletonList,
  Toggle,
  useBackButton,
} from "../../../components/ui";
import {
  ApiError,
  getIntroductionSettings,
  type IntroductionSettingsDto,
  putIntroductionSettings,
} from "../../../lib/api";
import { ready } from "../../../lib/telegram";

type Status = "loading" | "ready" | "error" | "no-group";

function IntroductionScreen() {
  const gid = useSearchParams().get("gid") ?? "";
  const [status, setStatus] = useState<Status>("loading");
  const [settings, setSettings] = useState<IntroductionSettingsDto | null>(
    null,
  );
  const [error, setError] = useState("");

  useBackButton();

  useEffect(() => {
    ready();
    if (!gid) {
      setStatus("no-group");
      return;
    }
    getIntroductionSettings(gid)
      .then((result) => {
        setSettings(result.settings);
        setStatus("ready");
      })
      .catch((e: unknown) => {
        setError(
          e instanceof ApiError && e.status === 403
            ? "Solo los administradores del grupo pueden ver esto."
            : "No se pudo cargar.",
        );
        setStatus("error");
      });
  }, [gid]);

  const save = (patch: Partial<IntroductionSettingsDto>) => {
    if (!settings) {
      return;
    }
    const previous = settings;
    const next = { ...settings, ...patch };
    setSettings(next);
    putIntroductionSettings(gid, next)
      .then((result) => setSettings(result.settings))
      .catch(() => {
        // A failed save must not leave the screen claiming the gate is on when
        // it is not: nobody would be asked to introduce themselves, and the
        // staff room would sit waiting for cards that never come.
        setSettings(previous);
        setError("No se pudo guardar.");
      });
  };

  if (status === "no-group") {
    return (
      <Screen>
        <AppHeader title="Presentación obligatoria" />
        <Banner kind="info">
          Abre esta pantalla desde los ajustes del grupo.
        </Banner>
      </Screen>
    );
  }
  if (status === "loading" || !settings) {
    return (
      <Screen>
        <AppHeader title="Presentación obligatoria" />
        {status === "error" ? (
          <Banner kind="error">{error}</Banner>
        ) : (
          <SkeletonList rows={5} />
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title="Presentación obligatoria"
        subtitle={
          settings.enabled
            ? `A las ${settings.deadlineHours} h, quien no se haya presentado pasa por el staff`
            : "Desactivada"
        }
      />

      {settings.enabled ? (
        <Banner kind="info">
          El bot no expulsa a nadie por esto. Cuando se cumple el plazo abre una
          ficha en vuestro grupo de staff con dos botones — expulsar o dejarlo —
          y decide una persona. A los administradores del grupo ni les abre
          ficha.
        </Banner>
      ) : null}

      <Section caption="Al entrar alguien nuevo, el bot le pide presentarse">
        <Group>
          <Row
            title="Exigir presentación"
            trailing={
              <Toggle
                checked={settings.enabled}
                label="Exigir presentación"
                onChange={(next) => save({ enabled: next })}
              />
            }
          />
          <Field
            hint="Entre 1 y 168 horas. Pasado el plazo no ocurre nada solo: se abre la ficha en el staff."
            label="Horas de plazo"
          >
            <input
              className="input"
              disabled={!settings.enabled}
              inputMode="numeric"
              onChange={(e) => {
                const value = Number.parseInt(e.target.value, 10);
                if (Number.isInteger(value) && value >= 1 && value <= 168) {
                  save({ deadlineHours: value });
                }
              }}
              type="number"
              value={settings.deadlineHours}
            />
          </Field>
        </Group>
      </Section>

      <Section caption="Qué tiene que mandar">
        <Group>
          <Row
            title="Una foto"
            trailing={
              <Toggle
                checked={settings.requirePhoto}
                label="Una foto"
                onChange={(next) => save({ requirePhoto: next })}
              />
            }
          />
          <Row
            subtitle="Vale la edad o el año de nacimiento"
            title="Su edad"
            trailing={
              <Toggle
                checked={settings.requireAge}
                label="Su edad"
                onChange={(next) => save({ requireAge: next })}
              />
            }
          />
          <Row
            title="De dónde es"
            trailing={
              <Toggle
                checked={settings.requireOrigin}
                label="De dónde es"
                onChange={(next) => save({ requireOrigin: next })}
              />
            }
          />
        </Group>
        <GroupNote>
          Todo en un mismo mensaje: una foto con el pie «18, de Madrid» cuenta.
          El bot es deliberadamente generoso al interpretarlo — prefiere dejar
          pasar una presentación floja a echar a alguien que sí lo hizo.
        </GroupNote>
      </Section>

      {settings.enabled ? (
        <Section caption="Dónde llegan las fichas">
          <Group>
            <Row
              subtitle="Copia al staff cada presentación que se da por buena, no solo los fallos"
              title="Guardar las presentaciones"
              trailing={
                <Toggle
                  checked={settings.mirrorToStaff}
                  label="Guardar las presentaciones"
                  onChange={(next) => save({ mirrorToStaff: next })}
                />
              }
            />
          </Group>
          <GroupNote>
            Van al grupo de staff configurado en Guardian, al mismo tema. Si
            este grupo no tiene ninguno, el plazo vence y no pasa nada: nadie se
            entera y nadie sale. Y si nadie pulsa un botón, la persona se queda
            — el silencio ya no expulsa. Para mandarlas a un tema concreto,
            escribe <code>/presentaciones on 13523</code> en el grupo, con el
            número que te dé <code>/topicid</code> dentro de ese tema.
          </GroupNote>
        </Section>
      ) : null}
    </Screen>
  );
}

export default function IntroductionPage() {
  return (
    <Suspense fallback={null}>
      <IntroductionScreen />
    </Suspense>
  );
}

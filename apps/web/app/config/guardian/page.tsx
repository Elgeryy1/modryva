"use client";

import type {
  GuardianConfigInput,
  GuardianConfigIssue,
  GuardianDiagnosticsResult,
} from "@superbot/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  AppHeader,
  Banner,
  Button,
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
  ApiError,
  getGuardianConfig,
  getGuardianDiagnostics,
  putGuardianConfig,
} from "../../../lib/api";
import { haptic, ready } from "../../../lib/telegram";

type Status = "loading" | "ready" | "saving" | "error" | "no-group";

const MODE_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "manual", label: "Manual" },
  { value: "assisted", label: "Asistido" },
  { value: "auto", label: "Auto" },
  { value: "strict", label: "Estricto" },
] as const;

const CAPTURE_OPTIONS = [
  { value: "photo", label: "Foto" },
  { value: "video", label: "Vídeo" },
  { value: "video_with_fallback", label: "Vídeo + respaldo" },
] as const;

const DIFFICULTY_OPTIONS = [
  { value: "basic", label: "Básico" },
  { value: "normal", label: "Normal" },
  { value: "strict", label: "Estricto" },
] as const;

const MODE_HINT: Record<string, string> = {
  off: "Guardian está desactivado: las solicitudes de entrada se gestionan como hasta ahora.",
  manual:
    "La IA no decide nada: todos los casos van al STAFF para que decidan.",
  assisted: "La IA analiza y anota el informe, pero el STAFF decide siempre.",
  auto: "Casos fuertes se aprueban solos; el resto va a revisión o repetición.",
  strict: "Como Auto, pero exige más pasos y umbrales más altos.",
};

function GuardianConfigInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<GuardianConfigIssue[]>([]);
  const [warnings, setWarnings] = useState<GuardianConfigIssue[]>([]);
  const [config, setConfig] = useState<GuardianConfigInput | null>(null);
  const [diagnostics, setDiagnostics] =
    useState<GuardianDiagnosticsResult | null>(null);
  const [diagBusy, setDiagBusy] = useState(false);
  // Free-typed text for allowedCountries, decoupled from the parsed array so
  // typing "ES, P..." doesn't get stripped mid-keystroke — parsed into the
  // real array only on blur (see commitCountries below).
  const [countriesText, setCountriesText] = useState("");

  useBackButton(() => router.back());

  useEffect(() => {
    ready();
    if (!gid) {
      setStatus("no-group");
      return;
    }
    getGuardianConfig(gid)
      .then((cfg) => {
        setConfig(cfg);
        setCountriesText(cfg.allowedCountries.join(", "));
        setStatus("ready");
      })
      .catch((e: Error) => {
        setError(e.message);
        setStatus("error");
      });
    // Runs proactively (not just on manual "Ejecutar diagnóstico") so the
    // AUTO/STRICT-without-a-real-analyzer warning below is visible the
    // moment the admin opens this screen, not hidden behind an extra click.
    getGuardianDiagnostics(gid)
      .then(setDiagnostics)
      .catch(() => {
        // Best-effort — the manual "Ejecutar diagnóstico" button still works.
      });
  }, [gid]);

  const patch = (next: Partial<GuardianConfigInput>) =>
    setConfig((prev) => (prev ? { ...prev, ...next } : prev));

  const commitCountries = () => {
    const codes = [
      ...new Set(
        countriesText
          .split(/[,\s]+/u)
          .map((c) => c.trim().toUpperCase())
          .filter((c) => /^[A-Z]{2}$/u.test(c)),
      ),
    ];
    setCountriesText(codes.join(", "));
    patch({ allowedCountries: codes });
  };

  const save = async () => {
    if (!config) return;
    setStatus("saving");
    setError(null);
    setIssues([]);
    try {
      const { warnings: savedWarnings, ...saved } = await putGuardianConfig(
        gid,
        config,
      );
      setConfig(saved);
      setWarnings(savedWarnings ?? []);
      haptic.notify("success");
      setStatus("ready");
    } catch (e) {
      // The API sends structured, human-readable issues for a blocked save
      // (e.g. "La edad máxima no puede ser menor que la mínima.") — show those
      // instead of the raw error code ("invalid-settings") whenever present.
      if (e instanceof ApiError && e.issues && e.issues.length > 0) {
        setIssues(e.issues);
        setError(null);
      } else {
        setError(e instanceof Error ? e.message : "error");
      }
      setWarnings([]);
      haptic.notify("error");
      setStatus("ready");
    }
  };

  const runDiagnostics = async () => {
    setDiagBusy(true);
    try {
      const result = await getGuardianDiagnostics(gid);
      setDiagnostics(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setDiagBusy(false);
    }
  };

  if (status === "no-group") {
    return (
      <Screen>
        <AppHeader glyph="🛡️" tone="blue" title="Guardian Verification" />
        <Banner kind="error">Abre esta pantalla desde tu grupo.</Banner>
      </Screen>
    );
  }

  if (status === "loading" || !config) {
    return (
      <Screen>
        <AppHeader
          glyph="🛡️"
          tone="blue"
          title="Guardian Verification"
          subtitle="Cargando…"
        />
        <SkeletonList rows={4} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        glyph="🛡️"
        tone="blue"
        title="Guardian Verification"
        subtitle="Verifica solicitudes de entrada con un reto en Mini App"
      />

      {error && <Banner kind="error">{error}</Banner>}
      {issues.length > 0 && (
        <Banner kind="error">{issues.map((i) => i.message).join(" ")}</Banner>
      )}
      {warnings.length > 0 && (
        <Banner kind="info">
          ⚠️ {warnings.map((w) => w.message).join(" ")}
        </Banner>
      )}

      <Section caption="Estado">
        <Group>
          <Row
            icon="🛡️"
            tone="blue"
            title="Activado"
            subtitle="Cuando está apagado, las solicitudes se gestionan como antes"
            trailing={
              <Toggle
                label="Guardian activado"
                checked={config.enabled}
                onChange={(next) => patch({ enabled: next })}
              />
            }
          />
        </Group>
        <Field label="Modo" hint={MODE_HINT[config.mode]}>
          <Segmented
            options={MODE_OPTIONS}
            value={config.mode}
            onChange={(next) => patch({ mode: next })}
          />
        </Field>
        {(config.mode === "auto" || config.mode === "strict") &&
          diagnostics &&
          diagnostics.gestureVisionJudgeConfigured !== true && (
            <Banner kind="error">
              La aprobación automática requiere el juez de IA de cara/edad/
              gesto configurado (Gemini o Groq). Sin él, este grupo funcionará
              como Revisión manual aunque el modo diga Auto/Estricto — ningún
              caso se aprobará solo basándose en señales no evaluadas.
            </Banner>
          )}
      </Section>

      <Section caption="Chat STAFF (obligatorio para activar)">
        <Field
          label="ID del chat STAFF"
          hint="El ID numérico del chat/canal donde llegarán los expedientes (usa /status en ese chat para verlo)."
        >
          <input
            className="input"
            inputMode="numeric"
            value={config.staffChatId ?? ""}
            onChange={(e) =>
              patch({
                staffChatId: e.target.value.trim()
                  ? e.target.value.trim()
                  : null,
              })
            }
            placeholder="-1001234567890"
          />
        </Field>
      </Section>

      <Section caption="Captura">
        <Field label="Tipo de captura">
          <Segmented
            options={CAPTURE_OPTIONS}
            value={config.captureMode}
            onChange={(next) => patch({ captureMode: next })}
          />
        </Field>
        <Field label="Dificultad del reto">
          <Segmented
            options={DIFFICULTY_OPTIONS}
            value={config.challengeDifficulty}
            onChange={(next) => patch({ challengeDifficulty: next })}
          />
        </Field>
      </Section>

      <Section caption="Intentos y tiempos">
        <Field label="Intentos máximos">
          <input
            className="input"
            type="number"
            min={1}
            max={10}
            value={config.maxAttempts}
            onChange={(e) => patch({ maxAttempts: Number(e.target.value) })}
          />
        </Field>
        <Field label="Duración de la sesión (segundos)">
          <input
            className="input"
            type="number"
            min={60}
            max={3600}
            value={config.sessionTtlSeconds}
            onChange={(e) =>
              patch({ sessionTtlSeconds: Number(e.target.value) })
            }
          />
        </Field>
        <Field
          label="Retención del medio (horas)"
          hint="Pasado este tiempo el vídeo/foto se elimina automáticamente."
        >
          <input
            className="input"
            type="number"
            min={1}
            max={720}
            value={config.mediaRetentionHours}
            onChange={(e) =>
              patch({ mediaRetentionHours: Number(e.target.value) })
            }
          />
        </Field>
      </Section>

      <Section caption="Umbrales (avanzado)">
        {(
          [
            ["autoApproveThreshold", "Umbral de auto-aprobación"],
            ["manualReviewThreshold", "Umbral de revisión manual"],
            ["livenessMinimum", "Prueba de vida mínima"],
            ["gestureMinimum", "Gesto mínimo"],
            ["replayRiskMaximum", "Riesgo de repetición máximo"],
            ["syntheticRiskMaximum", "Riesgo sintético máximo"],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label}>
            <input
              className="input"
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={config[key]}
              onChange={(e) => {
                // Never silently coerce a cleared field to 0 (Number("")===0)
                // — that would quietly zero a security floor like the liveness
                // or gesture minimum. Ignore empty/NaN and keep the last value.
                const raw = e.target.value;
                if (raw === "") return;
                const n = Number(raw);
                if (!Number.isNaN(n)) {
                  patch({ [key]: n } as never);
                }
              }}
            />
          </Field>
        ))}
      </Section>

      <Section caption="Otros ajustes">
        <Group>
          <Row
            icon="👤"
            tone="purple"
            title="Exigir una sola cara"
            trailing={
              <Toggle
                label="Exigir una sola cara"
                checked={config.requireSingleFace}
                onChange={(next) => patch({ requireSingleFace: next })}
              />
            }
          />
          <Row
            icon="🤳"
            tone="blue"
            title="Doble verificación (2 fotos)"
            subtitle="Pide una segunda foto con OTRO gesto y comprueba con IA que es la misma persona. Nunca aprueba solo si no se pudo confirmar."
            trailing={
              <Toggle
                label="Doble verificación"
                checked={config.requiredPhotos === 2}
                onChange={(next) => patch({ requiredPhotos: next ? 2 : 1 })}
              />
            }
          />
          <Field
            label="Países permitidos"
            hint="Códigos ISO de 2 letras separados por coma (ej: ES, PT). Se detecta por la IP del móvil — nunca se pide número de teléfono ni ubicación. Vacío = sin restricción. Nunca rechaza automáticamente por sí solo."
          >
            <input
              className="input"
              type="text"
              value={countriesText}
              onChange={(e) => setCountriesText(e.target.value)}
              onBlur={commitCountries}
              placeholder="Ej: ES, PT"
            />
          </Field>
          <Row
            icon="🧪"
            tone="orange"
            title="Estimar edad (experimental)"
            subtitle="La edad nunca rechaza automáticamente por sí sola."
            trailing={
              <Toggle
                label="Estimar edad"
                checked={config.estimateAge}
                onChange={(next) => patch({ estimateAge: next })}
              />
            }
          />
          {config.estimateAge && (
            <>
              <Field
                label="Edad mínima"
                hint="Por debajo de esta edad, el caso va a revisión humana (nunca rechazo automático). Vacío = sin mínimo."
              >
                <input
                  className="input"
                  type="number"
                  min={13}
                  max={99}
                  value={config.minimumAge ?? ""}
                  onChange={(e) =>
                    patch({
                      minimumAge:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field
                label="Edad máxima"
                hint="Por encima de esta edad, el caso va a revisión humana. Vacío = sin máximo."
              >
                <input
                  className="input"
                  type="number"
                  min={13}
                  max={99}
                  value={config.maximumAge ?? ""}
                  onChange={(e) =>
                    patch({
                      maximumAge:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </Field>
            </>
          )}
          <Row
            icon="🚫"
            tone="red"
            title="Permitir rechazo automático"
            subtitle="Si está apagado, los casos dudosos van siempre a revisión humana."
            trailing={
              <Toggle
                label="Permitir rechazo automático"
                checked={config.allowAutomaticDecline}
                onChange={(next) => patch({ allowAutomaticDecline: next })}
              />
            }
          />
          <Row
            icon="🔒"
            tone="gray"
            title="Proteger contenido en STAFF"
            subtitle="Envía el medio con protect_content (no reenviable)."
            trailing={
              <Toggle
                label="Proteger contenido en STAFF"
                checked={config.protectStaffContent}
                onChange={(next) => patch({ protectStaffContent: next })}
              />
            }
          />
        </Group>
      </Section>

      <Button
        variant="primary"
        block
        disabled={status === "saving"}
        onClick={() => void save()}
      >
        {status === "saving" ? "Guardando…" : "Guardar"}
      </Button>

      <Section caption="Diagnóstico">
        <Button
          variant="secondary"
          block
          disabled={diagBusy}
          onClick={() => void runDiagnostics()}
        >
          {diagBusy ? "Comprobando…" : "Ejecutar diagnóstico"}
        </Button>
        {diagnostics && (
          <Group>
            <Row
              icon={diagnostics.botIsAdmin ? "✅" : "❌"}
              tone={diagnostics.botIsAdmin ? "green" : "red"}
              title="Bot administrador"
            />
            <Row
              icon={diagnostics.supportsJoinRequestQueries ? "✅" : "❔"}
              tone={diagnostics.supportsJoinRequestQueries ? "green" : "orange"}
              title="Bot API 10.1 (join request queries)"
              subtitle={
                diagnostics.supportsJoinRequestQueries === null
                  ? "No se pudo comprobar"
                  : undefined
              }
            />
            <Row
              icon={diagnostics.guardBotAssigned ? "✅" : "❔"}
              tone={diagnostics.guardBotAssigned ? "green" : "orange"}
              title="Guardian Bot asignado"
              subtitle="Debe asignarse manualmente desde Telegram (ver docs)."
            />
            <Row
              icon={diagnostics.staffChatConfigured ? "✅" : "❌"}
              tone={diagnostics.staffChatConfigured ? "green" : "red"}
              title="Chat STAFF configurado"
            />
            <Row
              icon={diagnostics.storageReachable ? "✅" : "❌"}
              tone={diagnostics.storageReachable ? "green" : "red"}
              title="Almacenamiento accesible"
            />
            <Row
              icon={diagnostics.sessionSecretConfigured ? "✅" : "❌"}
              tone={diagnostics.sessionSecretConfigured ? "green" : "red"}
              title="GUARDIAN_SESSION_SECRET configurado"
            />
            <Row
              icon={diagnostics.gestureVisionJudgeConfigured ? "✅" : "❌"}
              tone={diagnostics.gestureVisionJudgeConfigured ? "green" : "red"}
              title="Juez de IA cara/edad/gesto (Gemini/Groq)"
              subtitle={
                !diagnostics.gestureVisionJudgeFlagEnabled
                  ? "GUARDIAN_VISION_JUDGE_ENABLED está apagado — Auto/Estricto quedan en revisión manual."
                  : !diagnostics.gestureVisionJudgeKeysConfigured
                    ? "Sin claves Gemini/Groq configuradas — Auto/Estricto quedan en revisión manual."
                    : "Configurado — Auto/Estricto pueden aprobar solos."
              }
            />
            <Row
              icon={
                diagnostics.visualAnalyzerReachable
                  ? "✅"
                  : diagnostics.visualAnalyzerConfigured
                    ? "❌"
                    : "❔"
              }
              tone={
                diagnostics.visualAnalyzerReachable
                  ? "green"
                  : diagnostics.visualAnalyzerConfigured
                    ? "red"
                    : "orange"
              }
              title="Analizador visual adicional (AI_SERVICE_URL, opcional)"
              subtitle={
                diagnostics.visualAnalyzerConfigured
                  ? diagnostics.visualAnalyzerReachable
                    ? "Configurado y operativo."
                    : "Configurado pero no responde."
                  : "No configurado."
              }
            />
          </Group>
        )}
      </Section>

      <GroupNote>
        Guardian Verification abre una Mini App con reto de cámara antes de
        admitir solicitudes de entrada. Todos los casos (aprobados, en revisión
        o rechazados) se reportan al chat STAFF.
      </GroupNote>
    </Screen>
  );
}

export default function GuardianConfigPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={4} />
        </Screen>
      }
    >
      <GuardianConfigInner />
    </Suspense>
  );
}

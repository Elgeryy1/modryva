"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  AppHeader,
  Banner,
  Button,
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
  applyWizardPlaybook,
  getWizardPlaybooks,
  type WizardPlaybookId,
  type WizardPlaybookSummary,
  type WizardSecurityLevel,
} from "../../../lib/api-wizard";
import { haptic, ready } from "../../../lib/telegram";

type GroupTypeId =
  | "comunidad"
  | "ventas"
  | "soporte"
  | "anuncios"
  | "privado"
  | "gaming"
  | "cursos";

const GROUP_TYPE_OPTIONS: ReadonlyArray<{
  value: GroupTypeId;
  label: string;
  hint: string;
  playbook: WizardPlaybookId;
}> = [
  {
    value: "comunidad",
    label: "Comunidad",
    hint: "Chat general para una comunidad o marca",
    playbook: "comunidad_limpia",
  },
  {
    value: "ventas",
    label: "Ventas",
    hint: "Grupo de ofertas o catalogo de productos",
    playbook: "ventas_sin_spam",
  },
  {
    value: "soporte",
    label: "Soporte",
    hint: "Atencion al cliente y resolucion de dudas",
    playbook: "soporte",
  },
  {
    value: "anuncios",
    label: "Anuncios",
    hint: "Canal de avisos de solo lectura",
    playbook: "anuncios",
  },
  {
    value: "privado",
    label: "Privado",
    hint: "Solo para miembros verificados",
    playbook: "solo_miembros_verificados",
  },
  {
    value: "gaming",
    label: "Gaming / casino",
    hint: "Comunidad de juegos, necesita moderacion activa",
    playbook: "comunidad_limpia",
  },
  {
    value: "cursos",
    label: "Cursos",
    hint: "Alumnos de un curso o formacion",
    playbook: "solo_miembros_verificados",
  },
];

const SECURITY_OPTIONS: ReadonlyArray<{
  value: WizardSecurityLevel;
  label: string;
}> = [
  { value: "soft", label: "Suave" },
  { value: "normal", label: "Normal" },
  { value: "strict", label: "Estricto" },
];

const SECURITY_HINTS: Record<WizardSecurityLevel, string> = {
  soft: "Capcha opcional y antiflood laxo. Ideal para grupos de confianza.",
  normal: "Equilibrio entre proteccion y comodidad para el dia a dia.",
  strict: "Capcha obligatorio, antiflood agresivo y bloqueo de enlaces.",
};

const ERROR_LABELS: Record<string, string> = {
  "invalid-playbook": "Ese playbook no existe.",
  "invalid-body": "Revisa los datos introducidos.",
};

const humanError = (message: string): string =>
  ERROR_LABELS[message] ?? message;

function WizardInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [step, setStep] = useState(0);
  const [playbooks, setPlaybooks] = useState<WizardPlaybookSummary[] | null>(
    null,
  );
  const [groupType, setGroupType] = useState<GroupTypeId>("comunidad");
  const [security, setSecurity] = useState<WizardSecurityLevel>("normal");
  const [staffChatId, setStaffChatId] = useState("");
  const [logsChatId, setLogsChatId] = useState("");
  const [supportChatId, setSupportChatId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useBackButton(() =>
    step === 0 ? router.back() : setStep((prev) => prev - 1),
  );

  useEffect(() => {
    ready();
    if (!gid) {
      setError("Abre esta pantalla desde tu grupo.");
      return;
    }
    getWizardPlaybooks(gid)
      .then((res) => setPlaybooks(res.playbooks))
      .catch((e: Error) => setError(humanError(e.message)));
  }, [gid]);

  const selectedType = GROUP_TYPE_OPTIONS.find(
    (opt) => opt.value === groupType,
  );
  const selectedPlaybook = playbooks?.find(
    (p) => p.id === selectedType?.playbook,
  );

  const apply = async () => {
    if (!selectedType || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await applyWizardPlaybook(gid, {
        playbook: selectedType.playbook,
        security,
        ...(staffChatId.trim() ? { staffChatId: staffChatId.trim() } : {}),
        ...(logsChatId.trim() ? { logsChatId: logsChatId.trim() } : {}),
        ...(supportChatId.trim()
          ? { supportChatId: supportChatId.trim() }
          : {}),
      });
      setDone(true);
      haptic.notify("success");
    } catch (e) {
      setError(humanError(e instanceof Error ? e.message : "error"));
      haptic.notify("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppHeader
        glyph="W"
        tone="purple"
        title="Asistente de configuracion"
        subtitle="Aplica un paquete de ajustes en un solo paso"
      />

      {error && <Banner kind="error">{error}</Banner>}
      {done && <Banner kind="success">Ajustes aplicados correctamente.</Banner>}

      {playbooks === null ? (
        <SkeletonList rows={4} />
      ) : done ? (
        <Group>
          <Row
            icon="OK"
            tone="green"
            title="Listo"
            subtitle="Tu grupo ya usa la nueva configuracion"
          />
        </Group>
      ) : (
        <>
          {step === 0 && (
            <Section caption="Paso 1 de 4 · Tipo de grupo">
              <Group>
                {GROUP_TYPE_OPTIONS.map((opt) => (
                  <Row
                    key={opt.value}
                    icon={opt.label.charAt(0)}
                    tone={opt.value === groupType ? "purple" : "gray"}
                    title={opt.label}
                    subtitle={opt.hint}
                    value={opt.value === groupType ? "Elegido" : undefined}
                    onClick={() => setGroupType(opt.value)}
                  />
                ))}
              </Group>
              <Button variant="primary" block onClick={() => setStep(1)}>
                Continuar
              </Button>
            </Section>
          )}

          {step === 1 && (
            <Section caption="Paso 2 de 4 · Nivel de seguridad">
              <Field label="Seguridad" hint={SECURITY_HINTS[security]}>
                <Segmented
                  options={SECURITY_OPTIONS}
                  value={security}
                  onChange={setSecurity}
                />
              </Field>
              <Button variant="primary" block onClick={() => setStep(2)}>
                Continuar
              </Button>
              <Button variant="ghost" block onClick={() => setStep(0)}>
                Atras
              </Button>
            </Section>
          )}

          {step === 2 && (
            <Section caption="Paso 3 de 4 · Chats de destino (opcional)">
              <Field
                label="Chat de staff"
                hint="Usado por playbooks que exigen verificacion de membresia."
              >
                <input
                  className="input"
                  inputMode="numeric"
                  value={staffChatId}
                  onChange={(e) =>
                    setStaffChatId(
                      e.target.value.trim().replace(/[^-\d]/gu, ""),
                    )
                  }
                  placeholder="-1001234567890"
                />
              </Field>
              <Field
                label="Chat de logs"
                hint="Recibira los eventos D1 de este grupo."
              >
                <input
                  className="input"
                  inputMode="numeric"
                  value={logsChatId}
                  onChange={(e) =>
                    setLogsChatId(e.target.value.trim().replace(/[^-\d]/gu, ""))
                  }
                  placeholder="-1001234567890"
                />
              </Field>
              <Field label="Chat de soporte">
                <input
                  className="input"
                  inputMode="numeric"
                  value={supportChatId}
                  onChange={(e) =>
                    setSupportChatId(
                      e.target.value.trim().replace(/[^-\d]/gu, ""),
                    )
                  }
                  placeholder="-1001234567890"
                />
              </Field>
              <Button variant="primary" block onClick={() => setStep(3)}>
                Continuar
              </Button>
              <Button variant="ghost" block onClick={() => setStep(1)}>
                Atras
              </Button>
            </Section>
          )}

          {step === 3 && selectedType && (
            <Section caption="Paso 4 de 4 · Resumen">
              <Group>
                <Row
                  icon="G"
                  tone="purple"
                  title="Tipo de grupo"
                  value={selectedType.label}
                />
                <Row
                  icon="P"
                  tone="blue"
                  title="Playbook"
                  subtitle={selectedPlaybook?.description}
                  value={selectedPlaybook?.name ?? selectedType.playbook}
                />
                <Row
                  icon="S"
                  tone="orange"
                  title="Seguridad"
                  value={
                    SECURITY_OPTIONS.find((o) => o.value === security)?.label
                  }
                />
                {staffChatId && (
                  <Row icon="C" tone="teal" title="Staff" value={staffChatId} />
                )}
                {logsChatId && (
                  <Row icon="L" tone="teal" title="Logs" value={logsChatId} />
                )}
                {supportChatId && (
                  <Row
                    icon="S"
                    tone="teal"
                    title="Soporte"
                    value={supportChatId}
                  />
                )}
              </Group>
              <Button variant="primary" block disabled={busy} onClick={apply}>
                {busy ? "Aplicando..." : "Aplicar"}
              </Button>
              <Button variant="ghost" block onClick={() => setStep(2)}>
                Atras
              </Button>
            </Section>
          )}
        </>
      )}
    </Screen>
  );
}

export default function WizardPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={4} />
        </Screen>
      }
    >
      <WizardInner />
    </Suspense>
  );
}

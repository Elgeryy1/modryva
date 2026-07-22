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
  applyBackupTemplate,
  type BackupPayload,
  type BackupTemplateSummary,
  cloneBackup,
  exportBackup,
  getBackupTemplates,
  importBackup,
} from "../../../lib/api-backup";
import { haptic, ready } from "../../../lib/telegram";

const ERROR_LABELS: Record<string, string> = {
  "invalid-payload": "Ese JSON no es una copia de seguridad valida.",
  "invalid-target": "Pon el ID del grupo destino.",
  "unknown-template": "Esa plantilla no existe.",
  "not-admin":
    "Solo los administradores del grupo pueden usar copias de seguridad.",
  "chat-not-found": "No encuentro ese grupo.",
};

const humanError = (message: string): string =>
  ERROR_LABELS[message] ?? message;

function BackupInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [backup, setBackup] = useState<BackupPayload | null>(null);
  const [importText, setImportText] = useState("");
  const [targetGid, setTargetGid] = useState("");
  const [templates, setTemplates] = useState<BackupTemplateSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useBackButton(() => router.back());

  const load = useCallback(() => {
    if (!gid) {
      setError("Abre esta pantalla desde tu grupo.");
      return;
    }
    getBackupTemplates(gid)
      .then((res: { templates: BackupTemplateSummary[] }) =>
        setTemplates(res.templates),
      )
      .catch((e: Error) => setError(humanError(e.message)));
  }, [gid]);

  useEffect(() => {
    ready();
    load();
  }, [load]);

  const run = useCallback(
    async (task: () => Promise<BackupPayload>, message: string) => {
      if (busy) {
        return;
      }
      setBusy(true);
      setError(null);
      setSuccess(null);
      try {
        const result = await task();
        setBackup(result);
        setSuccess(message);
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

  const handleExport = () =>
    run(() => exportBackup(gid), "Configuracion exportada.");

  const handleCopy = async () => {
    if (!backup) {
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(backup, null, 2));
      setCopied(true);
      haptic.notify("success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar. Selecciona y copia el texto manualmente.");
    }
  };

  const handleImport = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setError(humanError("invalid-payload"));
      return;
    }
    run(() => importBackup(gid, parsed), "Configuracion importada.");
  };

  const handleClone = () => {
    if (targetGid.trim().length === 0) {
      setError(humanError("invalid-target"));
      return;
    }
    run(
      () => cloneBackup(gid, targetGid.trim()),
      "Configuracion clonada al grupo destino.",
    );
  };

  const handleApplyTemplate = (templateId: string) =>
    run(
      () => applyBackupTemplate(gid, templateId),
      "Plantilla aplicada a este grupo.",
    );

  if (!gid) {
    return (
      <Screen>
        <AppHeader
          glyph="B"
          tone="blue"
          title="Copias de seguridad"
          subtitle="Exporta, importa, clona o aplica una plantilla"
        />
        <Empty
          icon="B"
          tone="blue"
          title="Abre esta pantalla desde tu grupo"
          hint="Necesitamos saber que grupo configurar."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        glyph="B"
        tone="blue"
        title="Copias de seguridad"
        subtitle="Exporta, importa, clona o aplica una plantilla"
      />

      {error && <Banner kind="error">{error}</Banner>}
      {success && <Banner kind="success">{success}</Banner>}

      <Section caption="Exportar">
        <Group>
          <Row
            icon="E"
            tone="teal"
            title="Exportar configuracion de este grupo"
            subtitle="Captcha, antiflood, locks, bienvenida, reglas, higiene y membresia"
          />
        </Group>
        <Button variant="primary" block disabled={busy} onClick={handleExport}>
          {busy ? "Exportando..." : "Exportar"}
        </Button>
        {backup && (
          <>
            <textarea
              className="textarea"
              rows={10}
              readOnly
              value={JSON.stringify(backup, null, 2)}
            />
            <Button variant="secondary" block onClick={handleCopy}>
              {copied ? "Copiado!" : "Copiar JSON"}
            </Button>
          </>
        )}
      </Section>

      <Section caption="Importar">
        <Banner kind="error">
          Importar sobreescribe TODA la configuracion actual de este grupo
          (captcha, antiflood, locks, bienvenida, reglas, higiene y membresia).
          No se puede deshacer.
        </Banner>
        <Field label="Pega el JSON de la copia de seguridad">
          <textarea
            className="textarea"
            rows={8}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='{"version": 2, "exportedAt": "...", "sections": {...}, "network": null}'
          />
        </Field>
        <Button
          variant="danger"
          block
          disabled={busy || importText.trim().length === 0}
          onClick={handleImport}
        >
          {busy ? "Importando..." : "Importar y sobreescribir"}
        </Button>
      </Section>

      <Section caption="Clonar a otro grupo">
        <Banner kind="error">
          Clonar sobreescribe toda la configuracion del grupo destino. Debes ser
          administrador de ambos grupos.
        </Banner>
        <Field
          label="ID del grupo destino"
          hint="El telegramChatId del grupo al que quieres copiar esta configuracion."
        >
          <input
            className="input"
            inputMode="numeric"
            value={targetGid}
            onChange={(e) =>
              setTargetGid(e.target.value.trim().replace(/[^-\d]/gu, ""))
            }
            placeholder="-1001234567890"
          />
        </Field>
        <Button
          variant="secondary"
          block
          disabled={busy || targetGid.trim().length === 0}
          onClick={handleClone}
        >
          {busy ? "Clonando..." : "Clonar configuracion"}
        </Button>
      </Section>

      <Section caption="Plantillas de negocio">
        <Banner>
          Aplicar una plantilla sobreescribe la configuracion actual de este
          grupo, igual que un import.
        </Banner>
        {templates.length === 0 ? (
          <SkeletonList rows={3} />
        ) : (
          <Group>
            {templates.map((template) => (
              <Row
                key={template.id}
                icon="P"
                tone="purple"
                title={template.name}
                subtitle={template.description}
                disabled={busy}
                onClick={() => handleApplyTemplate(template.id)}
                value={busy ? "..." : "Aplicar"}
              />
            ))}
          </Group>
        )}
      </Section>
    </Screen>
  );
}

export default function BackupPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={4} />
        </Screen>
      }
    >
      <BackupInner />
    </Suspense>
  );
}

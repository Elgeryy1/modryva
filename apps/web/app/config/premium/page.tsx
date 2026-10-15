"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  AppHeader,
  Banner,
  Button,
  Field,
  Group,
  Row,
  Screen,
  Section,
  SkeletonList,
  useBackButton,
} from "../../../components/ui";
import {
  type EntitlementStatus,
  generateEntitlementCode,
  getEntitlementStatus,
  redeemEntitlementCode,
} from "../../../lib/api-entitlement";
import { ready } from "../../../lib/telegram";

const ERROR_LABELS: Record<string, string> = {
  "not-found": "Ese codigo no existe.",
  "already-used": "Ese codigo ya se canjeo.",
  "not-in-network": "Este grupo no pertenece a ninguna red.",
  "not-network-admin":
    "Solo el propietario o un admin de la red puede canjear codigos.",
  "not-platform-owner": "Solo el dueno de la plataforma puede generar codigos.",
  "invalid-body": "Revisa los datos del formulario.",
};

const humanError = (message: string): string =>
  ERROR_LABELS[message] ?? message;

function PremiumInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [status, setStatus] = useState<EntitlementStatus | null>(null);
  const [code, setCode] = useState("");
  const [genPlan, setGenPlan] = useState("pro");
  const [genMaxChats, setGenMaxChats] = useState("10");
  const [genDays, setGenDays] = useState("30");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useBackButton(() => router.back());

  const load = useCallback(() => {
    if (!gid) {
      setError("Abre esta pantalla desde tu grupo.");
      return;
    }
    getEntitlementStatus(gid)
      .then(setStatus)
      .catch((e: Error) => setError(humanError(e.message)));
  }, [gid]);

  useEffect(() => {
    ready();
    load();
  }, [load]);

  const handleRedeem = async () => {
    if (busy || code.trim().length === 0) {
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await redeemEntitlementCode(gid, code.trim());
      setStatus(next);
      setCode("");
      setSaved(true);
    } catch (e) {
      setError(humanError(e instanceof Error ? e.message : "error"));
    } finally {
      setBusy(false);
    }
  };

  const handleGenerate = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    setGeneratedCode(null);
    try {
      const maxChats = Number.parseInt(genMaxChats, 10);
      const days = Number.parseInt(genDays, 10);
      const result = await generateEntitlementCode(
        gid,
        genPlan,
        Number.isFinite(maxChats) ? maxChats : 0,
        Number.isFinite(days) ? days : 0,
      );
      setGeneratedCode(result.code);
    } catch (e) {
      setError(humanError(e instanceof Error ? e.message : "error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppHeader
        glyph="P"
        tone="purple"
        title="Premium"
        subtitle="Plan y limites de tu red de grupos"
      />

      {error && <Banner kind="error">{error}</Banner>}
      {saved && <Banner kind="success">Codigo canjeado.</Banner>}

      {status === null ? (
        <SkeletonList rows={3} />
      ) : (
        <Group>
          <Row
            icon="P"
            tone="purple"
            title={`Plan ${status.plan}`}
            subtitle={
              status.inNetwork
                ? "Red activa"
                : "Este grupo no pertenece a ninguna red"
            }
          />
          <Row
            icon="G"
            tone="teal"
            title="Grupos en la red"
            value={`${status.chatCount} / ${status.maxChats}`}
          />
          {status.premiumUntil && (
            <Row
              icon="T"
              tone="orange"
              title="Premium hasta"
              value={new Date(status.premiumUntil).toLocaleDateString()}
            />
          )}
        </Group>
      )}

      <Section caption="Canjear codigo">
        <Field label="Codigo">
          <input
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Pega tu codigo aqui"
          />
        </Field>
        <Button
          variant="primary"
          block
          disabled={busy || code.trim().length === 0}
          onClick={handleRedeem}
        >
          {busy ? "Canjeando..." : "Canjear codigo"}
        </Button>
      </Section>

      <Section caption="Generar codigo (solo dueno de la plataforma)">
        <Field label="Plan">
          <input
            className="input"
            value={genPlan}
            onChange={(e) => setGenPlan(e.target.value)}
            placeholder="pro"
          />
        </Field>
        <Field label="Maximo de grupos">
          <input
            className="input"
            inputMode="numeric"
            value={genMaxChats}
            onChange={(e) => setGenMaxChats(e.target.value.replace(/\D/gu, ""))}
            placeholder="10"
          />
        </Field>
        <Field label="Dias de duracion">
          <input
            className="input"
            inputMode="numeric"
            value={genDays}
            onChange={(e) => setGenDays(e.target.value.replace(/\D/gu, ""))}
            placeholder="30"
          />
        </Field>
        <Button
          variant="secondary"
          block
          disabled={busy}
          onClick={handleGenerate}
        >
          {busy ? "Generando..." : "Generar codigo"}
        </Button>
        {generatedCode && (
          <Section caption="Codigo generado">
            <p className="code-value">{generatedCode}</p>
          </Section>
        )}
      </Section>
    </Screen>
  );
}

export default function PremiumPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={3} />
        </Screen>
      }
    >
      <PremiumInner />
    </Suspense>
  );
}

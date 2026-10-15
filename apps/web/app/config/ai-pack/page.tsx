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
  type AiPackStatus,
  cancelChatAiPack,
  cancelPersonalAiPack,
  createChatAiPackInvoice,
  createPersonalAiPackInvoice,
  getChatAiPackStatus,
  getPersonalAiPackStatus,
  redeemChatAiPackCode,
} from "../../../lib/api-ai-pack";
import { openInvoice, ready } from "../../../lib/telegram";

const ERROR_LABELS: Record<string, string> = {
  "not-admin": "Solo un admin del grupo puede gestionar el pack de IA.",
  "chat-not-found": "No encuentro este grupo.",
  "invoice-link-failed":
    "Telegram no pudo generar la factura. Intentalo de nuevo.",
  "invalid-code": "Escribe un código.",
  "not-found": "Ese código no existe.",
  "already-used": "Ese código ya se canjeó.",
  "no-subscription": "No hay ninguna suscripción que cancelar.",
  "cancel-failed": "No se pudo cancelar.",
};

const humanError = (message: string): string =>
  ERROR_LABELS[message] ?? message;

function AiPackInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";
  const isGroupScope = gid.length > 0;

  const [status, setStatus] = useState<AiPackStatus | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useBackButton(() => router.back());

  const load = useCallback(() => {
    const request = isGroupScope
      ? getChatAiPackStatus(gid)
      : getPersonalAiPackStatus();
    request
      .then(setStatus)
      .catch((e: Error) => setError(humanError(e.message)));
  }, [gid, isGroupScope]);

  useEffect(() => {
    ready();
    load();
  }, [load]);

  const handleBuy = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { url } = isGroupScope
        ? await createChatAiPackInvoice(gid)
        : await createPersonalAiPackInvoice();
      openInvoice(url, (invoiceStatus) => {
        if (invoiceStatus === "paid") {
          setMessage(
            "Pago recibido. La IA se activará en unos segundos (Telegram nos avisa por su cuenta).",
          );
          setTimeout(load, 3000);
        }
      });
    } catch (e) {
      setError(humanError(e instanceof Error ? e.message : "error"));
    } finally {
      setBusy(false);
    }
  };

  const handleRedeem = async () => {
    if (busy || code.trim().length === 0) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await redeemChatAiPackCode(gid, code.trim());
      setStatus(next);
      setCode("");
      setMessage("Código canjeado. IA activa para este grupo.");
    } catch (e) {
      setError(humanError(e instanceof Error ? e.message : "error"));
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = isGroupScope
        ? await cancelChatAiPack(gid)
        : await cancelPersonalAiPack();
      setStatus(next);
      setMessage(
        `Renovación cancelada. Sigue activo hasta ${
          next.subscription.currentPeriodEnd
            ? new Date(next.subscription.currentPeriodEnd).toLocaleDateString()
            : "el final del periodo"
        }.`,
      );
    } catch (e) {
      setError(humanError(e instanceof Error ? e.message : "error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppHeader
        glyph="🤖"
        tone="purple"
        title="Pack de IA"
        subtitle={
          isGroupScope
            ? "IA real para este grupo"
            : "IA real para ti, en cualquier chat"
        }
      />

      {error && <Banner kind="error">{error}</Banner>}
      {message && <Banner kind="success">{message}</Banner>}

      {status === null ? (
        <SkeletonList rows={3} />
      ) : (
        <>
          <Section caption="Estado">
            <Group>
              <Row
                icon="🤖"
                tone={status.subscription.active ? "green" : "gray"}
                title={
                  status.subscription.active
                    ? status.subscription.canceled
                      ? "Activo (no se renovará)"
                      : "Activo, se renueva cada mes"
                    : "Sin pack de IA"
                }
                subtitle={
                  status.subscription.currentPeriodEnd
                    ? `Hasta ${new Date(status.subscription.currentPeriodEnd).toLocaleDateString()}`
                    : isGroupScope
                      ? "Este grupo no tiene IA todavía"
                      : "Aún no tienes acceso personal a la IA"
                }
              />
              <Row
                icon="⭐"
                tone="orange"
                title="Precio"
                value={`${status.priceStars} ⭐/mes`}
              />
            </Group>
          </Section>

          {!status.subscription.active || status.subscription.canceled ? (
            <Section>
              <Button
                variant="primary"
                block
                disabled={busy}
                onClick={handleBuy}
              >
                {busy
                  ? "Abriendo pago..."
                  : `Comprar por ${status.priceStars} ⭐/mes`}
              </Button>
            </Section>
          ) : (
            <Section>
              <Button
                variant="secondary"
                block
                disabled={busy}
                onClick={handleCancel}
              >
                {busy ? "Cancelando..." : "Cancelar renovación"}
              </Button>
            </Section>
          )}

          {isGroupScope && !status.subscription.active ? (
            <Section caption="O canjear un código">
              <Field label="Código">
                <input
                  className="input"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="AI-XXXXXX-XXXXXX"
                />
              </Field>
              <Button
                variant="secondary"
                block
                disabled={busy || code.trim().length === 0}
                onClick={handleRedeem}
              >
                {busy ? "Canjeando..." : "Canjear código"}
              </Button>
            </Section>
          ) : null}

          <Section caption="Cómo funciona">
            <Group>
              <Row
                icon="1"
                tone="blue"
                title="Se cobra en Telegram Stars"
                subtitle="Se renueva solo cada 30 días mientras esté activo"
              />
              <Row
                icon="2"
                tone="blue"
                title={
                  isGroupScope
                    ? "Desbloquea la IA para TODO este grupo"
                    : "Te desbloquea la IA a TI, en cualquier chat"
                }
              />
              <Row
                icon="3"
                tone="blue"
                title="Cancela cuando quieras"
                subtitle="Desde este panel, sin escribir ningún comando"
              />
            </Group>
          </Section>
        </>
      )}
    </Screen>
  );
}

export default function AiPackPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={3} />
        </Screen>
      }
    >
      <AiPackInner />
    </Suspense>
  );
}

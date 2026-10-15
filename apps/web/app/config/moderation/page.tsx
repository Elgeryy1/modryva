"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  AppHeader,
  Banner,
  Button,
  Empty,
  Group,
  Row,
  Screen,
  Section,
  Segmented,
  SkeletonList,
  useBackButton,
} from "../../../components/ui";
import {
  getModerationInbox,
  type ModerationInboxAction,
  type ModerationInboxItem,
  type ModerationInboxKind,
  resolveModerationInboxItem,
} from "../../../lib/api-moderation";
import { haptic, ready } from "../../../lib/telegram";

const KIND_OPTIONS: ReadonlyArray<{
  value: "all" | ModerationInboxKind;
  label: string;
}> = [
  { value: "all", label: "Todo" },
  { value: "report", label: "Reportes" },
  { value: "quarantine", label: "Cuarentena" },
  { value: "appeal", label: "Apelaciones" },
  { value: "ticket", label: "Tickets" },
];

const KIND_LABELS: Record<ModerationInboxKind, string> = {
  report: "Reporte",
  quarantine: "Cuarentena",
  appeal: "Apelacion",
  ticket: "Ticket",
};

const KIND_TONE: Record<
  ModerationInboxKind,
  "red" | "orange" | "purple" | "teal"
> = {
  report: "red",
  quarantine: "orange",
  appeal: "purple",
  ticket: "teal",
};

const ERROR_LABELS: Record<string, string> = {
  "invalid-kind": "Filtro de tipo invalido.",
  "invalid-body": "Accion invalida.",
  "missing-assignee": "Indica a quien asignar el ticket.",
  "invalid-assignee": "El ID de Telegram del asignado no es valido.",
  "resolve-failed":
    "No se pudo resolver este elemento (puede que ya no exista).",
  "not-admin": "Solo los administradores del grupo pueden usar la bandeja.",
};

const humanError = (message: string): string =>
  ERROR_LABELS[message] ?? message;

const actionsFor = (
  kind: ModerationInboxKind,
): { action: ModerationInboxAction; label: string }[] => {
  switch (kind) {
    case "report":
      return [
        { action: "approve", label: "Aprobar" },
        { action: "reject", label: "Descartar" },
      ];
    case "quarantine":
      return [
        { action: "approve", label: "Aprobar" },
        { action: "reject", label: "Borrar" },
      ];
    case "appeal":
      return [
        { action: "approve", label: "Aceptar" },
        { action: "reject", label: "Rechazar" },
      ];
    case "ticket":
      return [
        { action: "approve", label: "Resolver" },
        { action: "close", label: "Cerrar" },
      ];
  }
};

function ModerationInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [items, setItems] = useState<ModerationInboxItem[] | null>(null);
  const [chatIds, setChatIds] = useState<string[]>([]);
  const [kindFilter, setKindFilter] = useState<"all" | ModerationInboxKind>(
    "all",
  );
  const [chatFilter, setChatFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useBackButton(() => router.back());

  const load = useCallback(() => {
    if (!gid) {
      setError("Abre esta pantalla desde tu grupo.");
      setItems([]);
      return;
    }
    getModerationInbox(gid, {
      ...(kindFilter !== "all" ? { kind: kindFilter } : {}),
      ...(chatFilter !== "all" ? { chatId: chatFilter } : {}),
    })
      .then((res) => {
        setItems(res.items);
        setChatIds(res.chatIds);
      })
      .catch((e: Error) => {
        setError(humanError(e.message));
        setItems([]);
      });
  }, [gid, kindFilter, chatFilter]);

  useEffect(() => {
    ready();
    load();
  }, [load]);

  const resolve = useCallback(
    async (item: ModerationInboxItem, action: ModerationInboxAction) => {
      if (busyId) {
        return;
      }
      setBusyId(item.id);
      setError(null);
      try {
        await resolveModerationInboxItem(gid, item.kind, item.id, action);
        haptic.notify("success");
        load();
      } catch (e) {
        setError(humanError(e instanceof Error ? e.message : "error"));
        haptic.notify("error");
      } finally {
        setBusyId(null);
      }
    },
    [gid, busyId, load],
  );

  return (
    <Screen>
      <AppHeader
        glyph="M"
        tone="red"
        title="Bandeja de moderacion"
        subtitle="Reportes, cuarentena, apelaciones y tickets de toda la red"
      />

      {error && <Banner kind="error">{error}</Banner>}

      <Section caption="Tipo">
        <Segmented
          options={KIND_OPTIONS}
          value={kindFilter}
          onChange={setKindFilter}
        />
      </Section>

      {chatIds.length > 1 && (
        <Section caption="Grupo">
          <select
            className="select"
            value={chatFilter}
            onChange={(e) => setChatFilter(e.target.value)}
          >
            <option value="all">Todos los grupos</option>
            {chatIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </Section>
      )}

      {items === null ? (
        <SkeletonList rows={4} />
      ) : items.length === 0 ? (
        <Empty
          icon="M"
          tone="teal"
          title="Bandeja vacia"
          hint="No hay reportes, cuarentena, apelaciones ni tickets pendientes con estos filtros."
        />
      ) : (
        <Section caption={`Pendientes (${items.length})`}>
          <Group>
            {items.map((item) => (
              <div className="row" key={`${item.kind}:${item.id}`}>
                <Row
                  icon={KIND_LABELS[item.kind].charAt(0)}
                  tone={KIND_TONE[item.kind]}
                  title={item.reason ?? KIND_LABELS[item.kind]}
                  subtitle={[
                    KIND_LABELS[item.kind],
                    item.chatId,
                    item.subjectTelegramId
                      ? `usuario ${item.subjectTelegramId}`
                      : undefined,
                    item.priority,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  value={item.status}
                  trailing={
                    <div className="network-role-toggles">
                      {actionsFor(item.kind).map(({ action, label }) => (
                        <Button
                          key={action}
                          variant={action === "reject" ? "danger" : "secondary"}
                          disabled={busyId === item.id}
                          onClick={() => resolve(item, action)}
                        >
                          {busyId === item.id ? "..." : label}
                        </Button>
                      ))}
                    </div>
                  }
                />
              </div>
            ))}
          </Group>
        </Section>
      )}
    </Screen>
  );
}

export default function ModerationPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={4} />
        </Screen>
      }
    >
      <ModerationInner />
    </Suspense>
  );
}

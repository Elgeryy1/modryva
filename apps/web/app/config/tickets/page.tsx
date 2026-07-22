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
  Segmented,
  SkeletonList,
  type Tone,
  useBackButton,
} from "../../../components/ui";
import {
  assignTicket,
  getTicket,
  getTickets,
  setTicketPriority,
  setTicketStatus,
  type TicketPriority,
  type TicketScope,
  type TicketSettableStatus,
  type TicketView,
} from "../../../lib/api-tickets";
import { haptic, ready } from "../../../lib/telegram";

const SCOPE_OPTIONS: ReadonlyArray<{ value: TicketScope; label: string }> = [
  { value: "open", label: "Abiertos" },
  { value: "all", label: "Historial" },
];

const STATUS_LABELS: Record<string, string> = {
  open: "Abierto",
  assigned: "Asignado",
  resolved: "Resuelto",
  closed: "Cerrado",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

const PRIORITY_OPTIONS: ReadonlyArray<{
  value: TicketPriority;
  label: string;
}> = [
  { value: "low", label: "Baja" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const PRIORITY_TONE: Record<string, Tone> = {
  urgent: "red",
  high: "orange",
  normal: "teal",
  low: "gray",
};

const ERROR_LABELS: Record<string, string> = {
  "not-admin": "Solo los administradores del grupo pueden gestionar tickets.",
  "ticket-not-found": "Ese ticket ya no existe.",
  "invalid-status": "Estado no válido.",
  "invalid-priority": "Prioridad no válida.",
  "missing-assignee": "Indica el ID de Telegram de quien asignar.",
  "invalid-assignee": "El ID de Telegram no es válido.",
};

const humanError = (message: string): string =>
  ERROR_LABELS[message] ?? message;

const statusLabel = (status: string): string => STATUS_LABELS[status] ?? status;

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  });

function TicketsInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [scope, setScope] = useState<TicketScope>("open");
  const [tickets, setTickets] = useState<TicketView[] | null>(null);
  const [selected, setSelected] = useState<TicketView | null>(null);
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Back button: from a ticket's detail, return to the list; from the list,
  // leave the screen.
  useBackButton(() => {
    if (selected) {
      setSelected(null);
      return;
    }
    router.back();
  });

  const loadList = useCallback(() => {
    if (!gid) {
      setError("Abre esta pantalla desde tu grupo.");
      setTickets([]);
      return;
    }
    getTickets(gid, scope)
      .then((res) => setTickets(res.tickets))
      .catch((e: Error) => {
        setError(humanError(e.message));
        setTickets([]);
      });
  }, [gid, scope]);

  useEffect(() => {
    ready();
    loadList();
  }, [loadList]);

  const openDetail = useCallback(
    async (ticket: TicketView) => {
      setError(null);
      setAssignee(ticket.assigneeTelegramId ?? "");
      // Re-fetch so the detail reflects the latest status/priority even if the
      // list is stale.
      try {
        const res = await getTicket(gid, ticket.id);
        setSelected(res.ticket);
        setAssignee(res.ticket.assigneeTelegramId ?? "");
      } catch (e) {
        setError(humanError(e instanceof Error ? e.message : "error"));
      }
    },
    [gid],
  );

  const refreshSelected = useCallback(
    async (id: string) => {
      try {
        const res = await getTicket(gid, id);
        setSelected(res.ticket);
        setAssignee(res.ticket.assigneeTelegramId ?? "");
      } catch {
        // If it vanished, fall back to the list.
        setSelected(null);
      }
      loadList();
    },
    [gid, loadList],
  );

  const runAction = useCallback(
    async (id: string, action: () => Promise<unknown>) => {
      if (busy) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await action();
        haptic.notify("success");
        await refreshSelected(id);
      } catch (e) {
        setError(humanError(e instanceof Error ? e.message : "error"));
        haptic.notify("error");
      } finally {
        setBusy(false);
      }
    },
    [busy, refreshSelected],
  );

  const changeStatus = (id: string, status: TicketSettableStatus) =>
    runAction(id, () => setTicketStatus(gid, id, status));

  const changePriority = (id: string, priority: TicketPriority) =>
    runAction(id, () => setTicketPriority(gid, id, priority));

  const doAssign = (id: string) => {
    const value = assignee.trim();
    if (!value) {
      setError(humanError("missing-assignee"));
      return;
    }
    runAction(id, () => assignTicket(gid, id, value));
  };

  // --- Detail view ---
  if (selected) {
    const t = selected;
    const isClosed = t.status === "closed";
    const canReopen = t.status === "closed" || t.status === "resolved";
    return (
      <Screen>
        <AppHeader
          glyph="🎫"
          tone="teal"
          title={`Ticket #${t.number}`}
          subtitle={t.subject}
        />

        {error && <Banner kind="error">{error}</Banner>}

        <Section caption="Detalle">
          <Group>
            <Row
              icon="●"
              tone={t.status === "closed" ? "gray" : "teal"}
              title="Estado"
              value={statusLabel(t.status)}
            />
            <Row
              icon="⚑"
              tone={PRIORITY_TONE[t.priority] ?? "gray"}
              title="Prioridad"
              value={PRIORITY_LABELS[t.priority] ?? t.priority}
            />
            <Row
              icon="👤"
              tone="blue"
              title="Reportado por"
              value={t.reporterTelegramId}
            />
            <Row
              icon="🙋"
              tone="purple"
              title="Asignado a"
              value={t.assigneeTelegramId ?? "Sin asignar"}
            />
            <Row
              icon="🕒"
              tone="gray"
              title="Creado"
              value={formatDate(t.createdAt)}
            />
          </Group>
        </Section>

        <Section caption="Cambiar estado">
          <Group>
            <div className="row">
              <div className="network-role-toggles">
                {!isClosed && (
                  <Button
                    variant="secondary"
                    disabled={busy || t.status === "resolved"}
                    onClick={() => changeStatus(t.id, "resolved")}
                  >
                    Resolver
                  </Button>
                )}
                {!isClosed && (
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() => changeStatus(t.id, "closed")}
                  >
                    Cerrar
                  </Button>
                )}
                {canReopen && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => changeStatus(t.id, "open")}
                  >
                    Reabrir
                  </Button>
                )}
              </div>
            </div>
          </Group>
        </Section>

        <Section caption="Prioridad">
          <Group>
            <div className="row">
              <Segmented
                options={PRIORITY_OPTIONS}
                value={
                  (PRIORITY_OPTIONS.some((o) => o.value === t.priority)
                    ? t.priority
                    : "normal") as TicketPriority
                }
                onChange={(next) => changePriority(t.id, next)}
              />
            </div>
          </Group>
        </Section>

        <Section caption="Asignar">
          <Group>
            <div className="row" style={{ display: "block" }}>
              <Field
                label="ID de Telegram del responsable"
                hint="El ID numérico del miembro del staff (usa /id en el chat)."
              >
                <input
                  className="input"
                  inputMode="numeric"
                  aria-label="ID de Telegram del responsable"
                  value={assignee}
                  placeholder="123456789"
                  onChange={(e) => setAssignee(e.target.value)}
                />
              </Field>
              <Button block disabled={busy} onClick={() => doAssign(t.id)}>
                {busy ? "…" : "Asignar ticket"}
              </Button>
            </div>
          </Group>
        </Section>
      </Screen>
    );
  }

  // --- List view ---
  return (
    <Screen>
      <AppHeader
        glyph="🎫"
        tone="teal"
        title="Tickets de soporte"
        subtitle="Abre tickets con /ticket en el chat; gestiónalos aquí"
      />

      {error && <Banner kind="error">{error}</Banner>}

      <Section caption="Ver">
        <Segmented options={SCOPE_OPTIONS} value={scope} onChange={setScope} />
      </Section>

      {tickets === null ? (
        <SkeletonList rows={4} />
      ) : tickets.length === 0 ? (
        <Empty
          icon="🎫"
          tone="teal"
          title={scope === "open" ? "Sin tickets abiertos" : "Sin tickets"}
          hint="Cuando alguien escriba /ticket <asunto> en el grupo, aparecerá aquí."
        />
      ) : (
        <Section caption={`${tickets.length} ticket(s)`}>
          <Group>
            {tickets.map((t) => (
              <Row
                key={t.id}
                icon={`#${t.number}`}
                tone={PRIORITY_TONE[t.priority] ?? "gray"}
                title={t.subject}
                subtitle={[
                  statusLabel(t.status),
                  PRIORITY_LABELS[t.priority] ?? t.priority,
                  formatDate(t.createdAt),
                ].join(" · ")}
                chevron
                onClick={() => openDetail(t)}
              />
            ))}
          </Group>
        </Section>
      )}
    </Screen>
  );
}

export default function TicketsPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={4} />
        </Screen>
      }
    >
      <TicketsInner />
    </Suspense>
  );
}

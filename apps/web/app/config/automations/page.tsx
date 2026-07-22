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
  type AutomationAction,
  type AutomationCondition,
  type AutomationEntry,
  type AutomationTrigger,
  createAutomation,
  getAutomations,
  removeAutomation,
  toggleAutomation,
} from "../../../lib/api-automation";
import { haptic, ready } from "../../../lib/telegram";

type TriggerKind = AutomationTrigger["kind"];
type ConditionKind = AutomationCondition["kind"];
type ActionKind = AutomationAction["kind"];

const TRIGGER_OPTIONS: ReadonlyArray<{ value: TriggerKind; label: string }> = [
  { value: "contains_text", label: "Mensaje contiene texto" },
  { value: "contains_link", label: "Mensaje contiene un enlace" },
  { value: "new_member", label: "Nuevo miembro" },
  { value: "report", label: "Reporte" },
  { value: "schedule", label: "Programado (cron)" },
  { value: "high_risk", label: "Usuario de alto riesgo" },
];

const CONDITION_OPTIONS: ReadonlyArray<{
  value: ConditionKind;
  label: string;
}> = [
  { value: "none", label: "Sin condición" },
  { value: "is_new_user", label: "Es un usuario nuevo" },
  { value: "not_in_chat", label: "No está en otro grupo" },
  { value: "missing_badge", label: "Le falta una insignia" },
  { value: "source_chat", label: "El evento viene de un grupo concreto" },
];

const ACTION_OPTIONS: ReadonlyArray<{ value: ActionKind; label: string }> = [
  { value: "delete", label: "Borrar el mensaje" },
  { value: "reply", label: "Responder con un texto" },
  { value: "quarantine", label: "Poner en cuarentena" },
  { value: "notify_staff", label: "Avisar al staff" },
  { value: "log", label: "Registrar en el log" },
  { value: "mute", label: "Silenciar" },
  { value: "webhook", label: "Llamar a un webhook" },
  { value: "assign_mission", label: "Asignar una misión" },
];

const ERROR_LABELS: Record<string, string> = {
  "invalid-body": "Revisa los campos del formulario.",
  "not-in-network":
    "Este grupo debe pertenecer a una red para usar automatizaciones.",
  "not-found": "Esta automatización ya no existe.",
};

const humanError = (message: string): string =>
  ERROR_LABELS[message] ?? message;

const defaultTrigger = (kind: TriggerKind): AutomationTrigger => {
  switch (kind) {
    case "contains_text":
      return { kind, text: "" };
    case "contains_link":
      return { kind };
    case "new_member":
      return { kind };
    case "report":
      return { kind };
    case "schedule":
      return { kind, cron: "0 * * * *" };
    case "high_risk":
      return { kind };
  }
};

const defaultCondition = (kind: ConditionKind): AutomationCondition => {
  switch (kind) {
    case "none":
      return { kind };
    case "is_new_user":
      return { kind, maxAgeHours: 24 };
    case "not_in_chat":
      return { kind, telegramChatId: "" };
    case "missing_badge":
      return { kind, badge: "" };
    case "source_chat":
      return { kind, chatId: "" };
  }
};

const defaultAction = (kind: ActionKind): AutomationAction => {
  switch (kind) {
    case "delete":
      return { kind };
    case "reply":
      return { kind, text: "" };
    case "quarantine":
      return { kind };
    case "notify_staff":
      return { kind, text: "" };
    case "log":
      return { kind, text: "" };
    case "mute":
      return { kind };
    case "webhook":
      return { kind, url: "" };
    case "assign_mission":
      return { kind, missionKind: "" };
  }
};

const triggerLabel = (trigger: AutomationTrigger): string =>
  TRIGGER_OPTIONS.find((t) => t.value === trigger.kind)?.label ?? trigger.kind;
const conditionLabel = (condition: AutomationCondition): string =>
  CONDITION_OPTIONS.find((c) => c.value === condition.kind)?.label ??
  condition.kind;
const actionLabel = (action: AutomationAction): string =>
  ACTION_OPTIONS.find((a) => a.value === action.kind)?.label ?? action.kind;

function AutomationsInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [items, setItems] = useState<AutomationEntry[] | null>(null);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<AutomationTrigger>(
    defaultTrigger("contains_text"),
  );
  const [condition, setCondition] = useState<AutomationCondition>(
    defaultCondition("none"),
  );
  const [action, setAction] = useState<AutomationAction>(
    defaultAction("delete"),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useBackButton(() => router.back());

  const load = useCallback(() => {
    if (!gid) {
      setError("Abre esta pantalla desde tu grupo.");
      setItems([]);
      return;
    }
    getAutomations(gid)
      .then((res) => setItems(res.automations))
      .catch((e: Error) => {
        setError(humanError(e.message));
        setItems([]);
      });
  }, [gid]);

  useEffect(() => {
    ready();
    load();
  }, [load]);

  const create = useCallback(async () => {
    if (busy || name.trim().length === 0) {
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await createAutomation(gid, {
        name: name.trim(),
        trigger,
        condition,
        action,
      });
      setName("");
      setTrigger(defaultTrigger("contains_text"));
      setCondition(defaultCondition("none"));
      setAction(defaultAction("delete"));
      setSaved(true);
      haptic.notify("success");
      load();
    } catch (e) {
      setError(humanError(e instanceof Error ? e.message : "error"));
      haptic.notify("error");
    } finally {
      setBusy(false);
    }
  }, [busy, gid, name, trigger, condition, action, load]);

  const toggle = useCallback(
    async (id: string, enabled: boolean) => {
      if (busy) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await toggleAutomation(gid, id, enabled);
        haptic.selection();
        load();
      } catch (e) {
        setError(humanError(e instanceof Error ? e.message : "error"));
        haptic.notify("error");
      } finally {
        setBusy(false);
      }
    },
    [busy, gid, load],
  );

  const remove = useCallback(
    async (id: string) => {
      if (busy) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await removeAutomation(gid, id);
        haptic.notify("success");
        load();
      } catch (e) {
        setError(humanError(e instanceof Error ? e.message : "error"));
        haptic.notify("error");
      } finally {
        setBusy(false);
      }
    },
    [busy, gid, load],
  );

  return (
    <Screen>
      <AppHeader
        glyph="A"
        tone="purple"
        title="Automatizaciones"
        subtitle="Crea reglas visuales: si pasa esto, haz aquello"
      />

      {error && <Banner kind="error">{error}</Banner>}
      {saved && <Banner kind="success">Automatización creada.</Banner>}

      <Section caption="Nueva automatización">
        <Field label="Nombre">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Borra enlaces de nuevos"
          />
        </Field>

        <Field label="Cuando (trigger)">
          <select
            className="select"
            value={trigger.kind}
            onChange={(e) =>
              setTrigger(defaultTrigger(e.target.value as TriggerKind))
            }
          >
            {TRIGGER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        {trigger.kind === "contains_text" && (
          <Field label="Texto a buscar">
            <input
              className="input"
              value={trigger.text}
              onChange={(e) =>
                setTrigger({ kind: "contains_text", text: e.target.value })
              }
              placeholder="gratis"
            />
          </Field>
        )}
        {trigger.kind === "schedule" && (
          <Field label="Expresión cron" hint="Ej: 0 * * * * (cada hora)">
            <input
              className="input"
              value={trigger.cron}
              onChange={(e) =>
                setTrigger({ kind: "schedule", cron: e.target.value })
              }
            />
          </Field>
        )}

        <Field label="Si además (condición)">
          <select
            className="select"
            value={condition.kind}
            onChange={(e) =>
              setCondition(defaultCondition(e.target.value as ConditionKind))
            }
          >
            {CONDITION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        {condition.kind === "is_new_user" && (
          <Field label="Antigüedad máxima (horas)">
            <input
              className="input"
              inputMode="numeric"
              value={condition.maxAgeHours}
              onChange={(e) =>
                setCondition({
                  kind: "is_new_user",
                  maxAgeHours: Number(e.target.value) || 0,
                })
              }
            />
          </Field>
        )}
        {condition.kind === "not_in_chat" && (
          <Field label="ID del grupo requerido">
            <input
              className="input"
              value={condition.telegramChatId}
              onChange={(e) =>
                setCondition({
                  kind: "not_in_chat",
                  telegramChatId: e.target.value,
                })
              }
              placeholder="-1001234567890"
            />
          </Field>
        )}
        {condition.kind === "missing_badge" && (
          <Field label="Insignia">
            <input
              className="input"
              value={condition.badge}
              onChange={(e) =>
                setCondition({ kind: "missing_badge", badge: e.target.value })
              }
              placeholder="veterano"
            />
          </Field>
        )}
        {condition.kind === "source_chat" && (
          <Field label="ID interno del grupo origen">
            <input
              className="input"
              value={condition.chatId}
              onChange={(e) =>
                setCondition({ kind: "source_chat", chatId: e.target.value })
              }
            />
          </Field>
        )}

        <Field label="Entonces (acción)">
          <select
            className="select"
            value={action.kind}
            onChange={(e) =>
              setAction(defaultAction(e.target.value as ActionKind))
            }
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        {(action.kind === "reply" ||
          action.kind === "notify_staff" ||
          action.kind === "log") && (
          <Field label="Texto">
            <textarea
              className="textarea"
              rows={3}
              value={action.text}
              onChange={(e) =>
                setAction({ kind: action.kind, text: e.target.value })
              }
              placeholder="Escribe el texto..."
            />
          </Field>
        )}
        {action.kind === "mute" && (
          <Field
            label="Duración (ms)"
            hint="Déjalo vacío para un silencio indefinido."
          >
            <input
              className="input"
              inputMode="numeric"
              value={action.durationMs ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                setAction({
                  kind: "mute",
                  ...(v ? { durationMs: Number(v) || 0 } : {}),
                });
              }}
            />
          </Field>
        )}
        {action.kind === "webhook" && (
          <Field label="URL">
            <input
              className="input"
              value={action.url}
              onChange={(e) =>
                setAction({ kind: "webhook", url: e.target.value })
              }
              placeholder="https://ejemplo.com/webhook"
            />
          </Field>
        )}
        {action.kind === "assign_mission" && (
          <Field label="Tipo de misión">
            <input
              className="input"
              value={action.missionKind}
              onChange={(e) =>
                setAction({
                  kind: "assign_mission",
                  missionKind: e.target.value,
                })
              }
            />
          </Field>
        )}

        <Button
          variant="primary"
          block
          disabled={busy || name.trim().length === 0}
          onClick={create}
        >
          {busy ? "Creando..." : "Crear automatización"}
        </Button>
      </Section>

      <Section caption="Automatizaciones existentes">
        {items === null ? (
          <SkeletonList rows={3} />
        ) : items.length === 0 ? (
          <Empty
            icon="A"
            tone="purple"
            title="Todavía no hay automatizaciones"
            hint="Crea la primera arriba: elige cuándo, con qué condición y qué debe pasar."
          />
        ) : (
          <Group>
            {items.map((item) => (
              <Row
                key={item.id}
                icon="A"
                tone={item.enabled ? "purple" : "gray"}
                title={item.name}
                subtitle={`${triggerLabel(item.trigger)} · ${conditionLabel(item.condition)} · ${actionLabel(item.action)}${item.chatId === null ? " · toda la red" : ""}`}
                trailing={
                  <span className="network-role-toggles">
                    <Toggle
                      checked={item.enabled}
                      label="Activar"
                      onChange={(next) => toggle(item.id, next)}
                    />
                    <Button
                      variant="danger"
                      onClick={() => remove(item.id)}
                      disabled={busy}
                    >
                      Borrar
                    </Button>
                  </span>
                }
              />
            ))}
          </Group>
        )}
      </Section>
    </Screen>
  );
}

export default function AutomationsPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={4} />
        </Screen>
      }
    >
      <AutomationsInner />
    </Suspense>
  );
}

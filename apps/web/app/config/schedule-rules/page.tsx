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
  GroupNote,
  Row,
  Screen,
  Section,
  SkeletonList,
  Toggle,
  useBackButton,
} from "../../../components/ui";
import {
  getScheduleRules,
  putScheduleRules,
  type ScheduleRule,
} from "../../../lib/api";
import { haptic, ready } from "../../../lib/telegram";

const hh = (h: number): string => `${String(h).padStart(2, "0")}:00`;
const windowLabel = (r: ScheduleRule): string =>
  r.startHour === r.endHour
    ? "Todo el día"
    : `${hh(r.startHour)} – ${hh(r.endHour)}`;
const clampHour = (n: number): number =>
  Math.max(0, Math.min(23, Math.trunc(n)));

function ScheduleRulesInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [rules, setRules] = useState<ScheduleRule[] | null>(null);
  const [startHour, setStartHour] = useState(22);
  const [endHour, setEndHour] = useState(6);
  const [strict, setStrict] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useBackButton(() => router.back());

  useEffect(() => {
    ready();
    if (!gid) {
      setError("Abre esta pantalla desde tu grupo.");
      setRules([]);
      return;
    }
    getScheduleRules(gid)
      .then((res) => setRules(res.rules))
      .catch((e: Error) => {
        setError(e.message);
        setRules([]);
      });
  }, [gid]);

  const persist = useCallback(
    async (next: ScheduleRule[]) => {
      setBusy(true);
      setError(null);
      try {
        const res = await putScheduleRules(gid, next);
        setRules(res.rules);
        haptic.notify("success");
      } catch (e) {
        setError(e instanceof Error ? e.message : "error");
        haptic.notify("error");
      } finally {
        setBusy(false);
      }
    },
    [gid],
  );

  const onAdd = useCallback(() => {
    if (busy) {
      return;
    }
    // One rule per window: replace any existing rule with the same hours.
    const rest = (rules ?? []).filter(
      (r) => !(r.startHour === startHour && r.endHour === endHour),
    );
    void persist([...rest, { startHour, endHour, strict }]);
  }, [rules, startHour, endHour, strict, busy, persist]);

  const onRemove = useCallback(
    (rule: ScheduleRule) => {
      void persist(
        (rules ?? []).filter(
          (r) =>
            !(r.startHour === rule.startHour && r.endHour === rule.endHour),
        ),
      );
    },
    [rules, persist],
  );

  return (
    <Screen>
      <AppHeader
        glyph="🕘"
        tone="purple"
        title="Ventanas estrictas"
        subtitle="Modera más fuerte en ciertas horas del día"
      />

      {error && <Banner kind="error">{error}</Banner>}

      <Section caption="Ventanas">
        {rules === null ? (
          <SkeletonList rows={3} />
        ) : rules.length === 0 ? (
          <Empty
            icon="🕘"
            tone="purple"
            title="Sin ventanas"
            hint="Crea abajo una franja horaria para moderar más fuerte."
          />
        ) : (
          <Group>
            {rules.map((rule) => (
              <Row
                key={`${rule.startHour}-${rule.endHour}`}
                icon={rule.strict ? "🔒" : "🕘"}
                tone={rule.strict ? "red" : "gray"}
                title={windowLabel(rule)}
                subtitle={
                  rule.strict ? "Moderación estricta" : "Sin restricción extra"
                }
                trailing={
                  <Button
                    variant="ghost"
                    aria-label={`Quitar ${windowLabel(rule)}`}
                    onClick={() => onRemove(rule)}
                  >
                    ×
                  </Button>
                }
              />
            ))}
          </Group>
        )}
      </Section>

      <Section caption="Añadir ventana">
        <Field
          label="Hora de inicio"
          hint="Hora (0-23) en la que empieza la ventana."
        >
          <input
            className="input"
            type="number"
            min={0}
            max={23}
            value={startHour}
            onChange={(e) => setStartHour(clampHour(Number(e.target.value)))}
          />
        </Field>
        <Field label="Hora de fin" hint="Hora (0-23) en la que termina.">
          <input
            className="input"
            type="number"
            min={0}
            max={23}
            value={endHour}
            onChange={(e) => setEndHour(clampHour(Number(e.target.value)))}
          />
        </Field>
        <Group>
          <Row
            icon="🔒"
            tone="red"
            title="Moderación estricta"
            subtitle="Durante la ventana, quita enlaces de quien no es admin"
            trailing={
              <Toggle
                label="Moderación estricta"
                checked={strict}
                onChange={setStrict}
              />
            }
          />
        </Group>
        <Button variant="primary" block disabled={busy} onClick={onAdd}>
          {busy ? "Guardando…" : "Añadir ventana"}
        </Button>
      </Section>

      <GroupNote>
        Si la hora de inicio es mayor que la de fin, la ventana cruza la
        medianoche (p. ej. 22:00 – 06:00). Poner la misma hora de inicio y fin
        cubre todo el día.
      </GroupNote>
    </Screen>
  );
}

export default function ScheduleRulesPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={3} />
        </Screen>
      }
    >
      <ScheduleRulesInner />
    </Suspense>
  );
}

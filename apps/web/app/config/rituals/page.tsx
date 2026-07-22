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
  Segmented,
  SkeletonList,
  useBackButton,
} from "../../../components/ui";
import { getRituals, putRituals, type Ritual } from "../../../lib/api";
import { haptic, ready } from "../../../lib/telegram";

// Weekday index matches Date.getUTCDay(): 0 = domingo .. 6 = sábado.
const WEEKDAYS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
] as const;
const WEEKDAYS_SHORT = ["D", "L", "M", "X", "J", "V", "S"] as const;

const hh = (h: number): string => `${String(h).padStart(2, "0")}:00`;
const ritualLabel = (r: Ritual): string =>
  `${WEEKDAYS[r.weekday] ?? r.weekday} ${hh(r.hour)}`;
const clampHour = (n: number): number =>
  Math.max(0, Math.min(23, Math.trunc(n)));

function RitualsInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [rituals, setRituals] = useState<Ritual[] | null>(null);
  const [weekday, setWeekday] = useState(1);
  const [hour, setHour] = useState(9);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useBackButton(() => router.back());

  useEffect(() => {
    ready();
    if (!gid) {
      setError("Abre esta pantalla desde tu grupo.");
      setRituals([]);
      return;
    }
    getRituals(gid)
      .then((res) => setRituals(res.rituals))
      .catch((e: Error) => {
        setError(e.message);
        setRituals([]);
      });
  }, [gid]);

  const persist = useCallback(
    async (next: Ritual[]) => {
      setBusy(true);
      setError(null);
      try {
        const res = await putRituals(gid, next);
        setRituals(res.rituals);
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
    const text = message.trim();
    if (!text || busy) {
      return;
    }
    // One ritual per (weekday, hour) slot: replace any existing one.
    const rest = (rituals ?? []).filter(
      (r) => !(r.weekday === weekday && r.hour === hour),
    );
    void persist([...rest, { weekday, hour, message: text }]).then(() =>
      setMessage(""),
    );
  }, [rituals, weekday, hour, message, busy, persist]);

  const onRemove = useCallback(
    (ritual: Ritual) => {
      void persist(
        (rituals ?? []).filter(
          (r) => !(r.weekday === ritual.weekday && r.hour === ritual.hour),
        ),
      );
    },
    [rituals, persist],
  );

  return (
    <Screen>
      <AppHeader
        glyph="🔁"
        tone="teal"
        title="Rituales"
        subtitle="Mensajes automáticos que se repiten cada semana"
      />

      {error && <Banner kind="error">{error}</Banner>}

      <Section caption="Rituales">
        {rituals === null ? (
          <SkeletonList rows={3} />
        ) : rituals.length === 0 ? (
          <Empty
            icon="🔁"
            tone="teal"
            title="Sin rituales"
            hint="Crea abajo un mensaje que se repita cada semana."
          />
        ) : (
          <Group>
            {rituals.map((ritual) => (
              <Row
                key={`${ritual.weekday}-${ritual.hour}`}
                icon="🔁"
                tone="teal"
                title={ritualLabel(ritual)}
                subtitle={ritual.message}
                trailing={
                  <Button
                    variant="ghost"
                    aria-label={`Quitar ${ritualLabel(ritual)}`}
                    onClick={() => onRemove(ritual)}
                  >
                    ×
                  </Button>
                }
              />
            ))}
          </Group>
        )}
      </Section>

      <Section caption="Añadir ritual">
        <Field label="Día de la semana">
          <Segmented
            options={WEEKDAYS_SHORT.map((label, i) => ({
              value: String(i),
              label,
            }))}
            value={String(weekday)}
            onChange={(next) => setWeekday(Number(next))}
          />
        </Field>
        <Field label="Hora" hint="Hora (0-23) a la que se publica (UTC).">
          <input
            className="input"
            type="number"
            min={0}
            max={23}
            value={hour}
            onChange={(e) => setHour(clampHour(Number(e.target.value)))}
          />
        </Field>
        <Field label="Mensaje">
          <textarea
            className="textarea"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="El mensaje que publicará el bot"
          />
        </Field>
        <Button
          variant="primary"
          block
          disabled={busy || message.trim().length === 0}
          onClick={onAdd}
        >
          {busy ? "Guardando…" : "Añadir ritual"}
        </Button>
      </Section>

      <GroupNote>
        Cada ritual se publica una vez por semana, el día y la hora indicados.
        Solo hay un ritual por franja: si repites día y hora, se reemplaza.
      </GroupNote>
    </Screen>
  );
}

export default function RitualsPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={3} />
        </Screen>
      }
    >
      <RitualsInner />
    </Suspense>
  );
}

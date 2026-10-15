"use client";

import type { AppointedAdminPanel } from "@superbot/shared";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  AppHeader,
  Banner,
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
  ApiError,
  getAppointedAdmins,
  putAppointedAdminSettings,
} from "../../../lib/api";
import { ready } from "../../../lib/telegram";

type Settings = AppointedAdminPanel["settings"];
type Status = "loading" | "ready" | "error" | "no-group";

const REASON_LABEL: Record<string, string> = {
  manual: "revocado a mano",
  "guard:ban_burst": "expulsiones en ráfaga",
  "guard:unban_burst": "readmisiones en ráfaga",
  "guard:promote_attempt": "intentó nombrar admin",
  "guard:chatinfo_burst": "cambió el grupo repetidamente",
};

const nameOf = (entry: {
  username: string | null;
  displayName: string | null;
  telegramUserId: string;
}): string =>
  (entry.username ? `@${entry.username}` : null) ??
  entry.displayName ??
  entry.telegramUserId;

function AdminsScreen() {
  const gid = useSearchParams().get("gid") ?? "";
  const [status, setStatus] = useState<Status>("loading");
  const [panel, setPanel] = useState<AppointedAdminPanel | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useBackButton();

  useEffect(() => {
    ready();
    if (!gid) {
      setStatus("no-group");
      return;
    }
    getAppointedAdmins(gid)
      .then((result) => {
        setPanel(result);
        setStatus("ready");
      })
      .catch((e: unknown) => {
        setError(
          e instanceof ApiError && e.status === 403
            ? "Solo los administradores del grupo pueden ver esto."
            : "No se pudo cargar.",
        );
        setStatus("error");
      });
  }, [gid]);

  const save = (patch: Partial<Settings>) => {
    if (!panel || saving) {
      return;
    }
    const next = { ...panel.settings, ...patch };
    // Optimistic: a toggle that visibly lags reads as broken. A failed save
    // restores the previous value rather than leaving the UI lying.
    const previous = panel.settings;
    setPanel({ ...panel, settings: next });
    setSaving(true);
    putAppointedAdminSettings(gid, next)
      .then((result) => setPanel((p) => (p ? { ...p, ...result } : p)))
      .catch(() => {
        setPanel((p) => (p ? { ...p, settings: previous } : p));
        setError("No se pudo guardar.");
      })
      .finally(() => setSaving(false));
  };

  if (status === "no-group") {
    return (
      <Screen>
        <AppHeader title="Administradores" />
        <Banner kind="info">Abre esta pantalla desde /adminlist.</Banner>
      </Screen>
    );
  }
  if (status === "loading") {
    return (
      <Screen>
        <AppHeader title="Administradores" />
        <SkeletonList rows={6} />
      </Screen>
    );
  }
  if (status === "error" || !panel) {
    return (
      <Screen>
        <AppHeader title="Administradores" />
        <Banner kind="error">{error}</Banner>
      </Screen>
    );
  }

  const active = panel.appointed.filter((row) => row.status === "active");
  const revoked = panel.appointed.filter((row) => row.status !== "active");
  const s = panel.settings;

  return (
    <Screen>
      <AppHeader
        title="Administradores"
        subtitle={`${active.length} nombrados por el bot · ${panel.beyondReach.length} fuera de su alcance`}
      />

      {/* The single most important thing on this screen: what it cannot do. */}
      {!panel.liveListAvailable ? (
        <Banner kind="error">
          No he podido leer la lista de administradores de Telegram, así que no
          sé si hay alguien fuera de mi alcance. Vuelve a abrir en un momento.
        </Banner>
      ) : panel.beyondReach.length > 0 ? (
        <Banner kind="error">
          {panel.beyondReach.length}{" "}
          {panel.beyondReach.length === 1
            ? "administrador no lo nombré yo"
            : "administradores no los nombré yo"}
          . Telegram no me deja quitarles los permisos pase lo que pase. Usa
          /adoptaradmins en el grupo para ponerlos bajo vigilancia.
        </Banner>
      ) : (
        <Banner kind="info">
          Todos los administradores (salvo el dueño) los nombré yo, así que
          puedo revocarlos si hace falta.
        </Banner>
      )}

      <Section caption="Qué hace el vigilante cuando un admin nombrado por el bot se pasa">
        <Group>
          <Row
            title="Vigilancia activada"
            trailing={
              <Toggle
                checked={s.enabled}
                label="Vigilancia activada"
                onChange={(next) => save({ enabled: next })}
              />
            }
          />
          <Row
            subtitle="Sin esto, solo avisa"
            title="Quitar permisos y silenciar"
            trailing={
              <Toggle
                checked={s.mode === "enforce"}
                label="Quitar permisos y silenciar"
                onChange={(next) =>
                  save({ mode: next ? "enforce" : "observe" })
                }
              />
            }
          />
        </Group>
        <GroupNote>
          Sin esto marcado solo avisa, no toca nada. Con ello, al detectarlo le
          quita el administrador y le silencia sin plazo, para que alguien
          revise antes de devolverle la voz.
        </GroupNote>
      </Section>

      <Section caption="Cuánto es demasiado">
        <Group>
          {(
            [
              ["windowSeconds", "Ventana (segundos)"],
              ["banBurstLimit", "Expulsiones seguidas"],
              ["unbanBurstLimit", "Readmisiones seguidas"],
              ["chatInfoLimit", "Cambios del grupo"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                disabled={!s.enabled}
                inputMode="numeric"
                onChange={(e) => {
                  const value = Number.parseInt(e.target.value, 10);
                  // Empty or non-numeric would otherwise store 0 and make the
                  // guard fire on the very first action.
                  if (Number.isInteger(value) && value > 0) {
                    save({ [key]: value } as Partial<Settings>);
                  }
                }}
                type="number"
                value={s[key]}
              />
            </Field>
          ))}
          <Row
            title="Intentar nombrar admin = revocación directa"
            trailing={
              <Toggle
                checked={s.tripOnPromote}
                label="Intentar nombrar admin"
                onChange={(next) => save({ tripOnPromote: next })}
              />
            }
          />
        </Group>
        <GroupNote>
          No puedo ver borrados de mensajes: Telegram nunca avisa al bot cuando
          otra persona borra. Es el movimiento clásico de un admin traidor y es
          justo el que no se puede detectar.
        </GroupNote>
      </Section>

      {active.length > 0 ? (
        <Section caption="Puedo quitarles los permisos">
          <Group>
            {active.map((row) => (
              <div className="guardian-roster-row" key={row.telegramUserId}>
                <div className="guardian-roster-head">
                  <strong>{nameOf(row)}</strong>
                  {row.adoptedExisting ? (
                    <span className="guardian-roster-badge">adoptado</span>
                  ) : null}
                </div>
                <dl className="guardian-roster-facts">
                  <div>
                    <dt>ID</dt>
                    <dd>
                      <code>{row.telegramUserId}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Le nombró</dt>
                    <dd>
                      <code>{row.grantedByTelegramId}</code>
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </Group>
          <GroupNote>
            Para quitar a alguien: /desadmin respondiendo a un mensaje suyo.
          </GroupNote>
        </Section>
      ) : null}

      {revoked.length > 0 ? (
        <Section caption="Historial de revocaciones">
          <Group>
            {revoked.map((row) => (
              <div className="guardian-roster-row" key={row.telegramUserId}>
                <div className="guardian-roster-head">
                  <strong>{nameOf(row)}</strong>
                  <span className="guardian-roster-badge">
                    {REASON_LABEL[row.revokedReason ?? ""] ??
                      row.revokedReason ??
                      "revocado"}
                  </span>
                </div>
              </div>
            ))}
          </Group>
        </Section>
      ) : null}

      {panel.beyondReach.length > 0 ? (
        <Section caption="Fuera de mi alcance">
          <Group>
            {panel.beyondReach.map((row) => (
              <div className="guardian-roster-row" key={row.telegramUserId}>
                <div className="guardian-roster-head">
                  <strong>{nameOf(row)}</strong>
                </div>
              </div>
            ))}
          </Group>
          <GroupNote>
            Los nombró alguien a mano en Telegram. Un bot solo puede degradar a
            quien él mismo nombró, así que sobre estos no tengo ningún poder.
          </GroupNote>
        </Section>
      ) : null}
    </Screen>
  );
}

export default function AppointedAdminsPage() {
  return (
    <Suspense fallback={null}>
      <AdminsScreen />
    </Suspense>
  );
}

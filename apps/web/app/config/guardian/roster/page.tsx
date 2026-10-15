"use client";

import type {
  GuardianRosterEntry,
  GuardianRosterGroup,
} from "@superbot/shared";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  AppHeader,
  Banner,
  Group,
  GroupNote,
  Screen,
  Section,
  SkeletonList,
  useBackButton,
} from "../../../../components/ui";
import {
  ApiError,
  getGuardianRoster,
  getGuardianRosterAll,
} from "../../../../lib/api";
import { ready } from "../../../../lib/telegram";

type Status = "loading" | "ready" | "error" | "no-group";
/** "group" = the community /bdani was typed in. "all" = every group the viewer
 * administers, which the api decides — asking for it grants nothing. */
type Scope = "group" | "all";

const formatWhen = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
};

const DECISION_LABEL: Record<string, string> = {
  auto_approve: "aprobado automáticamente",
  auto_decline: "rechazado automáticamente",
  manual_review: "revisión manual",
  technical_failure: "fallo técnico",
};

function RosterRow({
  entry,
  showGroups,
}: {
  entry: GuardianRosterEntry;
  showGroups: boolean;
}) {
  const shared = entry.sharesConnectionWith;
  return (
    <div className="guardian-roster-row">
      <div className="guardian-roster-head">
        <strong>{entry.displayName}</strong>
        {entry.verifications > 1 ? (
          <span className="guardian-roster-badge">
            {entry.verifications} verificaciones
          </span>
        ) : null}
      </div>
      <dl className="guardian-roster-facts">
        <div>
          <dt>ID</dt>
          <dd>
            <code>{entry.telegramUserId}</code>
          </dd>
        </div>
        <div>
          <dt>@</dt>
          <dd>{entry.username ? `@${entry.username}` : "—"}</dd>
        </div>
        <div>
          <dt>IP</dt>
          <dd>
            <code>{entry.ip}</code>
          </dd>
        </div>
        <div>
          <dt>País</dt>
          <dd>{entry.countryCode ?? "—"}</dd>
        </div>
        <div>
          <dt>Última acción</dt>
          <dd>
            {entry.lastActivity} · {formatWhen(entry.lastSeen)}
          </dd>
        </div>
        {/* Only in the cross-group view: in a single group it would be the same
            title on every row, which is noise. */}
        {showGroups ? (
          <div>
            <dt>Grupos</dt>
            <dd>
              {/* No group at all = they opened the app from a private chat and
                  were never seen in one of your communities. Saying "solo
                  privado" beats a dash, which reads like missing data. */}
              {entry.groups.length > 0
                ? entry.groups.map((g) => g.title).join(" · ")
                : "solo privado"}
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Resultado</dt>
          <dd>
            {/* verifications 0 with no decision = never verified, we only know
                them from opening a Mini App. */}
            {entry.verifications === 0 && !entry.lastDecision
              ? "sin verificar (solo abrió la app)"
              : entry.abandoned
                ? "no la completó"
                : entry.lastDecision
                  ? (DECISION_LABEL[entry.lastDecision] ?? entry.lastDecision)
                  : entry.lastStatus}
          </dd>
        </div>
      </dl>
      {shared.length > 0 ? (
        <p className="guardian-roster-shared">
          ⚠️ Misma conexión que{" "}
          {shared
            .map(
              (s) =>
                `${s.displayName}${s.strength === "network" ? " (misma red)" : ""}`,
            )
            .join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function RosterScreen() {
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";
  // `?all=1` comes from the `bd_all` deep link. Without a gid there is no
  // single group to fall back to, so that link forces the cross-group scope.
  const [scope, setScope] = useState<Scope>(
    search.get("all") === "1" || !gid ? "all" : "group",
  );
  const [status, setStatus] = useState<Status>("loading");
  const [entries, setEntries] = useState<GuardianRosterEntry[]>([]);
  const [groups, setGroups] = useState<GuardianRosterGroup[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState("");

  useBackButton();

  const load = useCallback(() => {
    setStatus("loading");
    return scope === "all" ? getGuardianRosterAll() : getGuardianRoster(gid);
  }, [scope, gid]);

  useEffect(() => {
    ready();
    if (scope === "group" && !gid) {
      setStatus("no-group");
      return;
    }
    let cancelled = false;
    load()
      .then((result) => {
        if (cancelled) {
          return;
        }
        setEntries([...result.entries]);
        setGroups([...result.groups]);
        setTruncated(result.truncated === true);
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) {
          return;
        }
        setError(
          e instanceof ApiError && e.status === 403
            ? "Solo los administradores del grupo pueden ver esto."
            : "No se pudo cargar el listado.",
        );
        setStatus("error");
      });
    // A slow first request must not overwrite a newer one after the viewer
    // flips the scope.
    return () => {
      cancelled = true;
    };
  }, [load, scope, gid]);

  if (status === "no-group") {
    return (
      <Screen>
        <AppHeader title="Base de datos de verificaciones" />
        <Banner kind="info">
          Abre esta pantalla desde el comando /bdani dentro del grupo.
        </Banner>
      </Screen>
    );
  }

  if (status === "loading") {
    return (
      <Screen>
        <AppHeader title="Base de datos de verificaciones" />
        <SkeletonList rows={6} />
      </Screen>
    );
  }

  if (status === "error") {
    return (
      <Screen>
        <AppHeader title="Base de datos de verificaciones" />
        <Banner kind="error">{error}</Banner>
      </Screen>
    );
  }

  const flagged = entries.filter((e) => e.sharesConnectionWith.length > 0);
  const allScope = scope === "all";
  const toggle = (
    <button
      className="guardian-roster-scope"
      onClick={() => setScope(allScope ? "group" : "all")}
      type="button"
    >
      {allScope ? "Ver solo este grupo" : "Ver todos mis grupos"}
    </button>
  );

  // Only truly empty when there are no groups AND nobody from a private chat:
  // the owner of a bot with no groups still has private-chat opens to show.
  if (allScope && groups.length === 0 && entries.length === 0) {
    return (
      <Screen>
        <AppHeader title="Base de datos de verificaciones" />
        <Banner kind="info">
          No administras ningún grupo con este bot, así que no hay nada que
          juntar.
        </Banner>
        {gid ? toggle : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title="Base de datos de verificaciones"
        subtitle={`${entries.length} personas · ${entries.filter((e) => e.verifications > 0).length} verificadas${
          allScope ? ` · ${groups.length} grupos` : ""
        }`}
      />
      {/* Only offer the per-group view when we know which group that is: the
          bd_all deep link carries no gid. */}
      {allScope && !gid ? null : toggle}
      {/* Said out loud, never implied: a partial list of shared connections is
          indistinguishable from a clean one unless the screen admits it. */}
      {truncated ? (
        <Banner kind="error">
          Hay más verificaciones de las que caben aquí. Esto son las más
          recientes, no todas: alguien que compartiera conexión y quedara fuera
          de este corte no aparecería.
        </Banner>
      ) : null}
      {flagged.length > 0 ? (
        <Banner kind="error">
          {flagged.length}{" "}
          {flagged.length === 1
            ? "persona comparte conexión con otra"
            : "personas comparten conexión con otras"}
          . Compruébalo mirando las fotos: el mismo WiFi de casa o el mismo
          operador móvil también dan la misma IP.
        </Banner>
      ) : (
        <Banner kind="info">
          Nadie comparte conexión con nadie ahora mismo.
        </Banner>
      )}
      <Section
        caption={
          allScope
            ? `Ordenado poniendo primero a quien comparte conexión. Junta ${groups.map((g) => g.title).join(", ")}.`
            : "Ordenado poniendo primero a quien comparte conexión"
        }
      >
        <Group>
          {entries.map((entry) => (
            <RosterRow
              entry={entry}
              key={entry.telegramUserId}
              showGroups={allScope}
            />
          ))}
        </Group>
        <GroupNote>
          Incluye a quien se verificó y a quien solo abrió una Mini App
          (juegos).{" "}
          {allScope ? "Solo salen los grupos que administras tú. " : ""}
          Estos son datos personales: no los compartas fuera del equipo.
        </GroupNote>
      </Section>
    </Screen>
  );
}

export default function GuardianRosterPage() {
  return (
    <Suspense fallback={null}>
      <RosterScreen />
    </Suspense>
  );
}

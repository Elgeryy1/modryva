"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  AppHeader,
  Banner,
  Button,
  Empty,
  Group,
  GroupNote,
  Row,
  Screen,
  Section,
  Segmented,
  SkeletonList,
  useBackButton,
} from "../../../components/ui";
import {
  type GhostMember,
  getGhosts,
  getInactive,
  type InactiveMember,
  kickInsightMember,
} from "../../../lib/api-insights";
import { ready } from "../../../lib/telegram";

type Tab = "ghosts" | "inactive";

const TAB_OPTIONS: ReadonlyArray<{ value: Tab; label: string }> = [
  { value: "ghosts", label: "Fantasmas" },
  { value: "inactive", label: "Inactivos" },
];

const ERROR_LABELS: Record<string, string> = {
  "not-admin": "Solo los administradores del grupo pueden ver esto.",
  "cannot-remove-self": "No puedes expulsarte a ti mismo.",
  "cannot-remove-admin": "No se puede expulsar a otro administrador.",
  "target-not-member": "Esta persona ya no pertenece al grupo.",
  "member-no-longer-eligible":
    "Esta persona ya no aparece como fantasma o inactiva.",
  "kick-failed":
    "Telegram no pudo expulsar a esta persona. Revisa los permisos del bot.",
};

const humanError = (message: string): string =>
  ERROR_LABELS[message] ?? message;

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("es-ES", { dateStyle: "medium" });

const nameOf = (m: { username: string | null; userId: string }): string =>
  m.username ? `@${m.username}` : m.userId;

function InsightsInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [tab, setTab] = useState<Tab>("ghosts");
  const [ghosts, setGhosts] = useState<GhostMember[] | null>(null);
  const [inactive, setInactive] = useState<InactiveMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kickingId, setKickingId] = useState<string | null>(null);

  useBackButton(() => router.back());

  const load = useCallback(() => {
    if (!gid) {
      setError("Abre esta pantalla desde tu grupo.");
      setGhosts([]);
      setInactive([]);
      return;
    }
    setError(null);
    if (tab === "ghosts") {
      getGhosts(gid)
        .then((res) => setGhosts(res.ghosts))
        .catch((e: Error) => {
          setError(humanError(e.message));
          setGhosts([]);
        });
    } else {
      getInactive(gid)
        .then((res) => setInactive(res.inactive))
        .catch((e: Error) => {
          setError(humanError(e.message));
          setInactive([]);
        });
    }
  }, [gid, tab]);

  useEffect(() => {
    ready();
    load();
  }, [load]);

  const current = tab === "ghosts" ? ghosts : inactive;

  const kick = async (member: { userId: string; username: string | null }) => {
    const name = nameOf(member);
    if (
      !window.confirm(
        `¿Expulsar a ${name}? Se eliminará solo a esta persona y podrá volver a entrar con un enlace de invitación.`,
      )
    ) {
      return;
    }

    setError(null);
    setKickingId(member.userId);
    try {
      await kickInsightMember(gid, member.userId);
      setGhosts(
        (rows) => rows?.filter((row) => row.userId !== member.userId) ?? rows,
      );
      setInactive(
        (rows) => rows?.filter((row) => row.userId !== member.userId) ?? rows,
      );
    } catch (e) {
      setError(humanError(e instanceof Error ? e.message : "kick-failed"));
    } finally {
      setKickingId(null);
    }
  };

  return (
    <Screen>
      <AppHeader
        glyph="📊"
        tone="teal"
        title="Radar de miembros"
        subtitle="Quién entró y no escribe, y quién lleva tiempo sin aparecer"
      />

      {error && <Banner kind="error">{error}</Banner>}

      <Section caption="Ver">
        <Segmented options={TAB_OPTIONS} value={tab} onChange={setTab} />
      </Section>

      {current === null ? (
        <SkeletonList rows={4} />
      ) : tab === "ghosts" ? (
        (ghosts ?? []).length === 0 ? (
          <Empty
            icon="👻"
            tone="teal"
            title="Sin fantasmas"
            hint="Nadie lleva más de 24h en el grupo sin haber escrito nunca."
          />
        ) : (
          <Section caption={`${(ghosts ?? []).length} fantasma(s)`}>
            <Group>
              {(ghosts ?? []).map((g) => (
                <Row
                  key={g.userId}
                  icon="👻"
                  tone="purple"
                  title={nameOf(g)}
                  subtitle={`Observado el ${formatDate(g.observedAt)} · 0 mensajes`}
                  trailing={
                    <Button
                      variant="danger"
                      disabled={kickingId !== null}
                      onClick={() => void kick(g)}
                    >
                      {kickingId === g.userId ? "Expulsando…" : "Expulsar"}
                    </Button>
                  }
                />
              ))}
            </Group>
            <GroupNote>
              Sin mensajes tras 24h desde que el bot los observó, o sin mensajes
              en el historial analizado. Cada expulsión requiere confirmación y
              afecta únicamente a la persona elegida.
            </GroupNote>
          </Section>
        )
      ) : (inactive ?? []).length === 0 ? (
        <Empty
          icon="😴"
          tone="teal"
          title="Sin inactivos"
          hint="Nadie lleva 14 días o más sin escribir en la ventana reciente."
        />
      ) : (
        <Section caption={`${(inactive ?? []).length} inactivo(s)`}>
          <Group>
            {(inactive ?? []).map((m) => (
              <Row
                key={m.userId}
                icon="😴"
                tone="orange"
                title={nameOf(m)}
                subtitle={`${m.idleDays}d sin escribir · visto el ${formatDate(m.lastActiveAt)}`}
                trailing={
                  <Button
                    variant="danger"
                    disabled={kickingId !== null}
                    onClick={() => void kick(m)}
                  >
                    {kickingId === m.userId ? "Expulsando…" : "Expulsar"}
                  </Button>
                }
              />
            ))}
          </Group>
          <GroupNote>
            Miembros con 14 días o más sin actividad en la ventana reciente.
            Cada expulsión requiere confirmación y afecta únicamente a la
            persona elegida.
          </GroupNote>
        </Section>
      )}
    </Screen>
  );
}

export default function InsightsPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={4} />
        </Screen>
      }
    >
      <InsightsInner />
    </Suspense>
  );
}

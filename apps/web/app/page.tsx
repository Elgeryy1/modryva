"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardPanel } from "../components/dashboard-panel";
import {
  AppHeader,
  Banner,
  Empty,
  Group,
  GroupNote,
  Row,
  Screen,
  Section,
  SkeletonList,
  type Tone,
} from "../components/ui";
import { type PlayerHome, platformMe, playerProfile } from "../lib/api";
import { decodeStartParam } from "../lib/config-meta";
import { getStartParam, ready } from "../lib/telegram";

type State =
  | { status: "loading" }
  | { status: "ready"; profile: PlayerHome; isOwner: boolean }
  | { status: "error"; error: string };

const MEDALS = ["🥇", "🥈", "🥉"];
const MEDAL_TONES: Tone[] = ["brand", "gray", "orange"];

// Landing router + player home. A named Mini App opens here; the startapp payload
// sends config/onboarding/game deep links to their pages. With no relevant
// payload (opened from the menu button), THIS is the user's home — their own
// profile and games, not the owner's admin console.
export default function HomePage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    ready();
    const startParam = getStartParam();
    const qs = typeof window !== "undefined" ? window.location.search : "";
    if (startParam === "casino" || startParam?.startsWith("casino_")) {
      router.replace(`/casino${qs}` as Route);
      return;
    }
    if (startParam === "help") {
      router.replace(`/help${qs}` as Route);
      return;
    }
    const decoded = decodeStartParam(startParam);
    if (decoded?.kind === "onboarding") {
      router.replace(`/config/onboarding${qs}` as Route);
      return;
    }
    if (decoded?.kind === "config") {
      router.replace(`/config${qs}` as Route);
      return;
    }
    if (
      decoded?.kind === "game" ||
      decoded?.kind === "inlineGame" ||
      decoded?.kind === "gamesHub"
    ) {
      router.replace(`/games${qs}` as Route);
      return;
    }
    // Player home: load the profile + whether this user owns the platform (only
    // the owner sees the operations panel). Owner check is best-effort.
    Promise.all([
      playerProfile(),
      platformMe()
        .then((me) => me.isOwner)
        .catch(() => false),
    ])
      .then(([profile, isOwner]) =>
        setState({ status: "ready", profile, isOwner }),
      )
      .catch((e: Error) => setState({ status: "error", error: e.message }));
  }, [router]);

  if (state.status === "loading") {
    return (
      <Screen>
        <AppHeader
          glyph="◆"
          tone="brand"
          title="Modryva"
          subtitle="Cargando…"
        />
        <SkeletonList rows={2} />
        <SkeletonList rows={3} />
      </Screen>
    );
  }

  if (state.status === "error") {
    return (
      <Screen>
        <AppHeader glyph="◆" tone="brand" title="Modryva" />
        <Banner kind="error">{state.error}</Banner>
      </Screen>
    );
  }

  const { profile, isOwner } = state;
  const firstName = (profile.name ?? "").trim().split(/\s+/u)[0] ?? "";
  const initials =
    (profile.name ?? "")
      .split(/\s+/u)
      .map((word) => word.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "🙂";

  const span = Math.max(1, profile.levelCeil - profile.levelFloor);
  const pct = Math.max(
    0,
    Math.min(
      100,
      Math.round(((profile.points - profile.levelFloor) / span) * 100),
    ),
  );
  const toNext = Math.max(0, profile.levelCeil - profile.points);
  const streakLabel =
    profile.streakDays > 0
      ? `🔥 Racha ${profile.streakDays} días`
      : "Sin racha";

  const badges = [
    { icon: "🏆", on: profile.points > 0 },
    { icon: "🔥", on: profile.streakDays >= 3 },
    { icon: "⭐", on: profile.level >= 5 },
    { icon: "🥇", on: profile.rank !== null && profile.rank <= 3 },
    { icon: "🧠", on: !profile.dailyPending },
  ];

  return (
    <Screen>
      <AppHeader
        glyph="◆"
        tone="brand"
        title={firstName ? `¡Hola, ${firstName}!` : "Tu perfil"}
        subtitle="Juega, suma puntos y sube en la clasificación."
      />

      {/* Player profile hero */}
      <Section>
        <Group>
          <div className="ph-hero">
            <div className="ph-top">
              <span className="ph-av" aria-hidden="true">
                {initials}
              </span>
              <div className="ph-who">
                <div className="ph-name">{profile.name ?? "Jugador"}</div>
                <div className="ph-sub">
                  Nivel {profile.level} · {streakLabel}
                </div>
              </div>
              <div className="ph-pts">
                <b>{profile.points.toLocaleString("es-ES")}</b>
                <span>PUNTOS</span>
              </div>
            </div>
            <div>
              <div className="ph-barmeta">
                <span>Nivel {profile.level}</span>
                <span>{toNext} pts para el siguiente</span>
              </div>
              <div
                className="ph-bar"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <i style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        </Group>
      </Section>

      {/* Play now */}
      <Section caption="Jugar ahora">
        <Group>
          <Row
            icon="🧠"
            tone="purple"
            title="Trivia de hoy"
            subtitle={
              profile.dailyPending
                ? "Sin responder — ¡ve por los puntos!"
                : "Ya respondida hoy ✓"
            }
            chevron
            href={"/games" as Route}
          />
          <Row
            icon="⚔️"
            tone="red"
            title="Boss cooperativo"
            subtitle="Derriba al jefe con tu comunidad"
            chevron
            href={"/games" as Route}
          />
          <Row
            icon="🎮"
            tone="teal"
            title="Todos los juegos"
            subtitle="Tres en raya, quiz infinito, parejas…"
            chevron
            href={"/games" as Route}
          />
          <Row
            icon="🎰"
            tone="orange"
            title="Casino"
            subtitle="Fichas virtuales, provably-fair"
            chevron
            href={"/casino" as Route}
          />
        </Group>
      </Section>

      {/* Global ranking */}
      <Section caption="Ranking global">
        {profile.top.length === 0 ? (
          <Empty
            icon="🏆"
            tone="brand"
            title="Aún no hay ranking"
            hint="¡Juega una partida y sé el primero en marcar!"
          />
        ) : (
          <>
            <Group>
              {profile.top.map((row, i) => (
                <Row
                  key={row.telegramUserId}
                  icon={i < 3 ? (MEDALS[i] ?? String(i + 1)) : String(i + 1)}
                  tone={
                    row.you
                      ? "brand"
                      : i < 3
                        ? (MEDAL_TONES[i] ?? "gray")
                        : "gray"
                  }
                  title={
                    row.you ? (
                      <span className="ph-you">Tú</span>
                    ) : (
                      (row.name ?? row.telegramUserId)
                    )
                  }
                  value={<span className="board-points">{row.points}</span>}
                />
              ))}
            </Group>
            {profile.rank === null && (
              <GroupNote>
                Aún no estás en el top. ¡Juega para colarte en la clasificación!
              </GroupNote>
            )}
            {profile.rank !== null && profile.rank > 3 && (
              <GroupNote>
                Vas en el puesto #{profile.rank}. ¡A por el podio!
              </GroupNote>
            )}
          </>
        )}
      </Section>

      {/* Achievements */}
      <Section caption="Logros">
        <Group>
          <div className="ph-hero" style={{ gap: 0 }}>
            <div className="ph-badges">
              {badges.map((badge, i) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed milestone set, never reordered
                  key={i}
                  className={badge.on ? "ph-badge" : "ph-badge locked"}
                  aria-hidden="true"
                >
                  {badge.icon}
                </span>
              ))}
            </div>
          </div>
        </Group>
        <GroupNote>
          Desbloquea insignias jugando cada día y subiendo de nivel.
        </GroupNote>
      </Section>

      {/* Discreet secondary entries */}
      <Section caption="Más">
        <Group>
          <Row
            icon="⚙️"
            tone="blue"
            title="Administrar un grupo"
            subtitle="Modera y configura tus grupos"
            chevron
            href={"/config" as Route}
          />
          <Row
            icon="🤖"
            tone="purple"
            title="Pack de IA"
            subtitle="Usa la IA en cualquier chat, 30 ⭐/mes"
            chevron
            href={"/config/ai-pack" as Route}
          />
          <Row
            icon="❓"
            tone="teal"
            title="Guía rápida"
            subtitle="Todos los comandos, explicados"
            chevron
            href={"/help" as Route}
          />
        </Group>
      </Section>

      {/* Owner-only operations panel */}
      {isOwner && (
        <Section caption="Operaciones · solo tú">
          <DashboardPanel />
        </Section>
      )}

      <footer className="shell-foot">
        <a href="/privacy">Privacidad</a>
        <span aria-hidden="true">·</span>
        <a href="/terms">Términos</a>
        <span aria-hidden="true">·</span>
        <span>Modryva</span>
      </footer>
    </Screen>
  );
}

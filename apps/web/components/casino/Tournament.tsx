"use client";

// Torneo semanal — the running weekly tournament. Shows the prize pool, a live
// countdown to the deadline, the current standings (top players by net chips
// this week, with 🥇🥈🥉 medals) and, if you've played, a "Tu puesto: #N" pill.
// Backed by the InitData-guarded /v1/casino/tournament endpoint, which also lazy-
// settles any finished tournament server-side on each read.

import { type JSX, useEffect, useState } from "react";
import { type CasinoStanding, casinoTournament } from "../../lib/api";
import { Banner, Caption, Empty, Group, SkeletonList } from "../ui";

interface TournamentData {
  period: string;
  endsAt: string;
  prizePool: number;
  standings: CasinoStanding[];
  you?: { rank: number; net: number } | null;
}

const MEDALS = ["🥇", "🥈", "🥉"] as const;

function displayName(row: CasinoStanding): string {
  const n = row.name?.trim();
  if (n) {
    return n;
  }
  return `Jugador ${row.telegramUserId.slice(-4)}`;
}

function fmtNet(net: number): string {
  const sign = net > 0 ? "+" : net < 0 ? "−" : "";
  return `${sign}${Math.abs(net).toLocaleString("es-ES")}`;
}

/** Live "Nd Nh Nm" (or "Nm Ns" in the last hour) until `endsAt`. */
function useCountdown(endsAt: string | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!endsAt) {
    return "";
  }
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(end)) {
    return "";
  }
  const ms = end - now;
  if (ms <= 0) {
    return "Cerrando…";
  }
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) {
    return `${days}d ${hours}h ${mins}m`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m ${secs}s`;
}

function fmtEndDate(endsAt: string | null): string {
  if (!endsAt) {
    return "";
  }
  const d = new Date(endsAt);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return d.toLocaleString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Tournament(): JSX.Element {
  const [data, setData] = useState<TournamentData | null>(null);
  const [error, setError] = useState("");
  const countdown = useCountdown(data?.endsAt ?? null);

  useEffect(() => {
    let alive = true;
    casinoTournament()
      .then((res) => {
        if (alive) {
          setData(res);
        }
      })
      .catch((e: unknown) => {
        if (alive) {
          setError(e instanceof Error ? e.message : "No se pudo cargar.");
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <div className="casino-social">
        <Banner kind="error">{error}</Banner>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="casino-social">
        <div className="tourney-hero skel-tourney" aria-hidden="true" />
        <SkeletonList rows={4} />
      </div>
    );
  }

  const { prizePool, standings, you, endsAt } = data;

  return (
    <div className="casino-social">
      <div className="tourney-hero">
        <span className="tourney-hero-label">Bote del torneo</span>
        <span className="tourney-hero-pool">
          🏆 {prizePool.toLocaleString("es-ES")}
        </span>
        <span className="tourney-hero-ends">
          Termina en{" "}
          <span className="tourney-hero-clock">{countdown || "…"}</span>
        </span>
        {fmtEndDate(endsAt) && (
          <span className="tourney-hero-date">{fmtEndDate(endsAt)}</span>
        )}
      </div>

      {you && (
        <div className="tourney-you" role="status">
          <span className="tourney-you-label">Tu puesto</span>
          <span className="tourney-you-rank">#{you.rank}</span>
          <span
            className={`tourney-you-net${
              you.net > 0 ? " up" : you.net < 0 ? " down" : ""
            }`}
          >
            {fmtNet(you.net)}
          </span>
        </div>
      )}

      {standings.length === 0 ? (
        <Empty
          icon="🥇"
          tone="brand"
          title="Torneo recién abierto"
          hint="Juega esta semana para entrar en la tabla y llevarte parte del bote."
        />
      ) : (
        <>
          <Caption>Clasificación de esta semana</Caption>
          <Group>
            {standings.map((row, i) => {
              const medal = MEDALS[i];
              return (
                <div className="row" key={row.telegramUserId}>
                  <span className="row-icon" aria-hidden="true">
                    {medal ? (
                      <span className={`tile lb-medal lb-medal-${i + 1}`}>
                        {medal}
                      </span>
                    ) : (
                      <span className="tile lb-rank">{i + 1}</span>
                    )}
                  </span>
                  <span className="row-body">
                    <span className="row-text">
                      <span className="row-title">{displayName(row)}</span>
                    </span>
                    <span
                      className={`row-value lb-net${
                        row.net > 0 ? " up" : row.net < 0 ? " down" : ""
                      }`}
                    >
                      {fmtNet(row.net)}
                    </span>
                  </span>
                </div>
              );
            })}
          </Group>
          <p className="casino-hub-note">
            Reparto del bote: 🥇 60% · 🥈 30% · 🥉 10%. Solo cuentan las
            apuestas (ganancias y pérdidas del casino) de esta semana.
          </p>
        </>
      )}
    </div>
  );
}

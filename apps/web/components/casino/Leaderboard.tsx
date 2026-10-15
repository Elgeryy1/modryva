"use client";

// Clasificación — the casino leaderboard. A Semana/Histórico segmented control
// picks the range; below it a Group of rows shows the top players ranked by net
// chips, with 🥇🥈🥉 medal tiles for the podium and plain numbers after. Reads
// the same InitData-guarded API as the games; shows a skeleton while loading and
// a friendly empty state when nobody has played yet.

import { type JSX, useEffect, useState } from "react";
import {
  type CasinoStanding,
  casinoLeaderboard,
  type LeaderboardRange,
} from "../../lib/api";
import { Banner, Caption, Empty, Group, Segmented, SkeletonList } from "../ui";

const RANGE_OPTIONS: ReadonlyArray<{ value: LeaderboardRange; label: string }> =
  [
    { value: "week", label: "Semana" },
    { value: "all", label: "Histórico" },
  ];

/** Podium medal for ranks 1–3, otherwise the plain position number. */
const MEDALS = ["🥇", "🥈", "🥉"] as const;

/** A player's display handle: their name, or a short id fallback. */
function displayName(row: CasinoStanding): string {
  const n = row.name?.trim();
  if (n) {
    return n;
  }
  return `Jugador ${row.telegramUserId.slice(-4)}`;
}

/** Signed, formatted net chips: "+1 200" / "−340" / "0". */
function fmtNet(net: number): string {
  const sign = net > 0 ? "+" : net < 0 ? "−" : "";
  return `${sign}${Math.abs(net).toLocaleString("es-ES")}`;
}

export function Leaderboard(): JSX.Element {
  const [range, setRange] = useState<LeaderboardRange>("week");
  const [rows, setRows] = useState<CasinoStanding[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setRows(null);
    setError("");
    casinoLeaderboard(range)
      .then((res) => {
        if (alive) {
          setRows(res.rows);
        }
      })
      .catch((e: unknown) => {
        if (alive) {
          setError(e instanceof Error ? e.message : "No se pudo cargar.");
          setRows([]);
        }
      });
    return () => {
      alive = false;
    };
  }, [range]);

  return (
    <div className="casino-social">
      <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} />

      {error && <Banner kind="error">{error}</Banner>}

      {rows === null ? (
        <SkeletonList rows={5} />
      ) : rows.length === 0 ? (
        <Empty
          icon="🏆"
          tone="brand"
          title="Aún no hay clasificación"
          hint={
            range === "week"
              ? "Juega esta semana para aparecer aquí."
              : "Nadie ha jugado todavía. ¡Sé el primero!"
          }
        />
      ) : (
        <>
          <Caption>
            {range === "week" ? "Mejores de la semana" : "Mejores de siempre"}
          </Caption>
          <Group>
            {rows.map((row, i) => {
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
        </>
      )}
    </div>
  );
}

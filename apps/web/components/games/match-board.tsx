"use client";

// A live tres en raya between two people. The server owns the board; this only
// draws what it is told and asks to move.

import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import {
  type MatchView,
  matchJoin,
  matchMove,
  matchState,
} from "../../lib/api";
import { Banner, Button, Group, GroupNote, SkeletonList } from "../ui";

/**
 * How often a client re-reads the position.
 *
 * Polling rather than a socket: a turn-based board changes a handful of times
 * per match, and a websocket would add infrastructure whose failure modes are
 * far worse than a two-second delay. Only while the match is live — a finished
 * one is asked about once and then left alone.
 */
const POLL_MS = 2000;

const GLYPH: Record<string, string> = { X: "❌", O: "⭕" };

export function MatchBoard({ matchId }: { matchId: string }): JSX.Element {
  const [match, setMatch] = useState<MatchView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Kept in a ref so the polling effect never re-subscribes on every update.
  const live = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await matchState(matchId);
      if (live.current) {
        setMatch(next);
      }
    } catch {
      if (live.current) {
        setError("No he podido cargar la partida.");
      }
    }
  }, [matchId]);

  useEffect(() => {
    live.current = true;
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => {
      live.current = false;
      clearInterval(timer);
    };
  }, [refresh]);

  const join = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      setMatch(await matchJoin(matchId));
    } catch {
      // The realistic one: somebody took the seat between the tap and here.
      setError("Alguien se te ha adelantado. Puedes verla igualmente.");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const play = async (index: number): Promise<void> => {
    if (!match || busy || !match.yourTurn || match.board[index] !== null) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setMatch(await matchMove(matchId, index, match.version));
    } catch {
      // Almost always a stale board: the other player moved first. Re-reading
      // shows the truth instead of leaving a wrong board on screen.
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!match) {
    return <SkeletonList rows={3} />;
  }

  const spectator = match.seat === null;
  const finished = match.status === "finished";
  const youWon = finished && match.result === match.seat;
  const draw = finished && match.result === "draw";

  const status = finished
    ? draw
      ? "🤝 Empate."
      : spectator
        ? `🏆 Ganó ${match.result === "host" ? (match.host.name ?? "el anfitrión") : (match.guest?.name ?? "el invitado")}.`
        : youWon
          ? "🏆 ¡Has ganado!"
          : "😔 Has perdido."
    : match.status === "open"
      ? "Esperando a que alguien acepte…"
      : spectator
        ? `Juegan ${match.host.name ?? "?"} y ${match.guest?.name ?? "?"}.`
        : match.yourTurn
          ? "Es tu turno."
          : "Turno del rival.";

  return (
    <>
      <Group>
        <div className="ttt-players">
          <span>
            {GLYPH.X} {match.host.name ?? "Anfitrión"}
          </span>
          <span>
            {GLYPH.O} {match.guest?.name ?? "—"}
          </span>
        </div>
      </Group>

      {error != null && <Banner kind="error">{error}</Banner>}
      <Banner kind={finished ? "success" : "info"}>{status}</Banner>

      <Group>
        <div className="ttt-board">
          {match.board.map((cell, i) => (
            <button
              // Cells never reorder, and index IS the identity of a square.
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed 3x3 board
              key={i}
              type="button"
              className="ttt-cell"
              disabled={
                spectator ||
                finished ||
                !match.yourTurn ||
                cell !== null ||
                busy
              }
              onClick={() => void play(i)}
              aria-label={`Casilla ${i + 1}`}
            >
              {cell ? (GLYPH[cell] ?? cell) : ""}
            </button>
          ))}
        </div>
      </Group>

      {match.status === "open" && spectator && (
        <Group>
          <Button block disabled={busy} onClick={() => void join()}>
            {busy ? "Entrando…" : "🎮 Jugar contra el anfitrión"}
          </Button>
        </Group>
      )}

      {spectator && match.status === "playing" && (
        <GroupNote>Estás viendo la partida. Se actualiza sola.</GroupNote>
      )}
    </>
  );
}

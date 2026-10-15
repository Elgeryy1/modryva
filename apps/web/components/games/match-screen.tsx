"use client";

// Qué pantalla toca para una partida. El enlace del chat es el mismo para
// todas (`m_<id>`), así que alguien tiene que mirar de qué juego se trata.

import { type JSX, useEffect, useState } from "react";
import { matchSecret } from "../../lib/api";
import { Banner, SkeletonList } from "../ui";
import { CardsTable } from "./cards-table";
import { MatchBoard } from "./match-board";
import { PrivateHand } from "./private-hand";
import { WordleBoard } from "./wordle-board";

/**
 * Juegos donde lo que abre esta pantalla es algo que solo puede ver una
 * persona. El resto son tableros públicos: los pinta `MatchBoard`.
 */
const PRIVATE_GAMES: ReadonlySet<string> = new Set(["impostor", "cartas"]);

export function MatchScreen({ matchId }: { matchId: string }): JSX.Element {
  const [game, setGame] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    // Una sola llamada, solo para saber qué juego es. La pantalla que se elija
    // vuelve a pedir lo suyo y se encarga de refrescarlo desde ahí.
    matchSecret(matchId)
      .then((res) => {
        if (live) {
          setGame(res.game);
        }
      })
      .catch(() => {
        if (live) {
          setError(true);
        }
      });
    return () => {
      live = false;
    };
  }, [matchId]);

  if (error) {
    return <Banner kind="error">No he podido cargar la partida.</Banner>;
  }
  if (game === undefined) {
    return <SkeletonList rows={3} />;
  }

  // Las cartas tienen pantalla propia porque son el unico juego que se JUEGA
  // aqui: el resto se juegan en el chat y esto solo enseña lo privado.
  if (game === "cartas") {
    return <CardsTable matchId={matchId} />;
  }
  // El wordle tambien: se movio del chat aqui para tener teclado de verdad.
  if (game === "wordle") {
    return <WordleBoard matchId={matchId} />;
  }

  // Sin juego (partida borrada, o enlace inventado) se cae al tablero, que ya
  // sabe decir que no existe. Un enlace roto no merece una pantalla propia.
  return game && PRIVATE_GAMES.has(game) ? (
    <PrivateHand matchId={matchId} />
  ) : (
    <MatchBoard matchId={matchId} />
  );
}

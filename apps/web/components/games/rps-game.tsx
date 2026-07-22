"use client";

import { useState } from "react";

type Choice = "piedra" | "papel" | "tijera";

const CHOICES: readonly Choice[] = ["piedra", "papel", "tijera"];
const EMOJI: Record<Choice, string> = {
  piedra: "🪨",
  papel: "📄",
  tijera: "✂️",
};
// What each choice beats: piedra > tijera > papel > piedra.
const BEATS: Record<Choice, Choice> = {
  piedra: "tijera",
  papel: "piedra",
  tijera: "papel",
};
const ROUNDS = 5;

/**
 * Piedra, papel o tijera al mejor de 5 contra un CPU aleatorio. Raw score is
 * the number of rounds the player wins (0..5), so a clean sweep is worth the
 * full 3 leaderboard points.
 */
export function RpsGame({
  onFinish,
}: {
  onFinish: (rawScore: number) => void;
}) {
  const [round, setRound] = useState(1);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [last, setLast] = useState("Elige tu jugada — al mejor de 5.");
  const [busy, setBusy] = useState(false);

  const pick = (choice: Choice) => {
    if (busy) {
      return;
    }
    setBusy(true);
    const ai = CHOICES[Math.floor(Math.random() * CHOICES.length)] ?? "piedra";
    const outcome =
      choice === ai ? "draw" : BEATS[choice] === ai ? "win" : "lose";
    const nextWins = wins + (outcome === "win" ? 1 : 0);
    setWins(nextWins);
    setLosses(losses + (outcome === "lose" ? 1 : 0));
    setLast(
      `${EMOJI[choice]} vs ${EMOJI[ai]} — ${
        outcome === "win"
          ? "ganas 🟢"
          : outcome === "draw"
            ? "empate 🟡"
            : "pierdes 🔴"
      }`,
    );

    if (round >= ROUNDS) {
      setTimeout(() => onFinish(nextWins), 1150);
      return;
    }
    setRound(round + 1);
    setTimeout(() => setBusy(false), 650);
  };

  return (
    <div className="game">
      <p className="game-progress">
        Ronda {Math.min(round, ROUNDS)}/{ROUNDS} · {wins} 🟢 · {losses} 🔴
      </p>
      <p className="rps-last">{last}</p>
      <div className="rps-choices">
        {CHOICES.map((choice) => (
          <button
            key={choice}
            type="button"
            className="rps-btn"
            disabled={busy}
            onClick={() => pick(choice)}
          >
            <span className="rps-emoji">{EMOJI[choice]}</span>
            <span>{choice}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "idle" | "waiting" | "ready" | "toosoon" | "done";

const ROUNDS = 5;

/**
 * Reflex timing game: tap when the pad turns green, over 5 rounds. Raw score is
 * derived from the average reaction time (faster = higher, 0..100). A false
 * start restarts the round. Calls onFinish(rawScore) when the 5 rounds are done.
 */
export function ReflexGame({
  onFinish,
}: {
  onFinish: (rawScore: number) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState("Toca para empezar");
  const timesRef = useRef<number[]>([]);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const armRound = useCallback(() => {
    setPhase("waiting");
    setMessage("Espera al verde…");
    const delay = 1000 + Math.random() * 2500;
    timerRef.current = setTimeout(() => {
      setPhase("ready");
      setMessage("¡AHORA!");
      startRef.current = performance.now();
    }, delay);
  }, []);

  const finishGame = useCallback(() => {
    const times = timesRef.current;
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    // ~150 ms -> ~81, ~500 ms -> ~38, >=800 ms -> 0
    const raw = Math.max(0, Math.min(100, Math.round(100 - avg / 8)));
    setPhase("done");
    setMessage(`Media ${Math.round(avg)} ms`);
    onFinish(raw);
  }, [onFinish]);

  const tap = () => {
    if (phase === "idle") {
      timesRef.current = [];
      setCount(0);
      armRound();
      return;
    }
    if (phase === "waiting") {
      clearTimer();
      setPhase("toosoon");
      setMessage("¡Muy pronto! Toca para reintentar");
      return;
    }
    if (phase === "toosoon") {
      armRound();
      return;
    }
    if (phase === "ready") {
      const reaction = performance.now() - startRef.current;
      timesRef.current = [...timesRef.current, reaction];
      const done = timesRef.current.length;
      setCount(done);
      setMessage(`${Math.round(reaction)} ms`);
      if (done >= ROUNDS) {
        setTimeout(finishGame, 600);
      } else {
        timerRef.current = setTimeout(armRound, 700);
      }
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: clears the timer on unmount only
  useEffect(() => () => clearTimer(), []);

  const background =
    phase === "ready" ? "#2f855a" : phase === "toosoon" ? "#b23a2e" : "#12354b";

  return (
    <div className="game">
      <p className="game-progress">
        Ronda {Math.min(count + (phase === "ready" ? 1 : 0), ROUNDS)}/{ROUNDS}
      </p>
      <button
        type="button"
        className="reflex-pad"
        style={{ background }}
        onClick={tap}
        disabled={phase === "done"}
      >
        {message}
      </button>
    </div>
  );
}

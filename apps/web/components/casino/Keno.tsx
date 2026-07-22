"use client";

// Keno — el jugador elige exactamente 3 números de 1 a 20; el servidor sortea
// 5 números sin repetición y paga según cuántos de los 3 elegidos coinciden.
// Simple grid UI (sin animación elaborada, como Roulette.tsx) — el resultado
// solo resalta los números sorteados que coinciden con la elección.

import { type JSX, useRef, useState } from "react";
import { casinoBet, casinoErrorLabel } from "../../lib/api";
import { Button } from "../ui";
import { BetControls, type CasinoGameProps } from "./shared";

const RANGE = 20;
const PICK_COUNT = 3;
const NUMBERS = Array.from({ length: RANGE }, (_, i) => i + 1);

export function Keno({
  balance,
  onBalance,
  onResult,
}: CasinoGameProps): JSX.Element {
  const [stake, setStake] = useState(50);
  const [picks, setPicks] = useState<number[]>([]);
  const [drawn, setDrawn] = useState<number[] | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const toggle = (n: number) => {
    if (busy) {
      return;
    }
    setPicks((prev) => {
      if (prev.includes(n)) {
        return prev.filter((x) => x !== n);
      }
      if (prev.length >= PICK_COUNT) {
        return prev; // ya hay 3 elegidos: deshabilita más allá de 3
      }
      return [...prev, n];
    });
  };

  const play = async () => {
    if (picks.length !== PICK_COUNT || busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setDrawn(null);
    try {
      const r = await casinoBet("keno", stake, { picks });
      onBalance(r.balance);
      // The API returns `detail.drawn` (the drawn numbers) but no `hits` count —
      // reading `detail.hits` (the old bug) rendered "undefined/3 aciertos". We
      // compute hits from our picks ∩ the drawn set.
      const { drawn } = r.detail as { drawn: number[] };
      setDrawn(drawn);
      const hits = picks.filter((p) => drawn.includes(p)).length;
      const win = r.payout > 0;
      onResult({
        win,
        amount: win ? r.payout : stake,
        label: `🎯 ${hits}/${PICK_COUNT} aciertos`,
        ...(win ? { multiplier: r.multiplier } : {}),
        ...(r.jackpotWon ? { jackpotWon: r.jackpotWon } : {}),
      });
    } catch (e) {
      // Rejected bet — no chips moved. Neutral notice, not a "−stake" loss.
      onResult({
        neutral: true,
        win: false,
        amount: 0,
        label: casinoErrorLabel(e),
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="game">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 6,
          padding: "4px 0 8px",
        }}
      >
        {NUMBERS.map((n) => {
          const picked = picks.includes(n);
          const hit = drawn?.includes(n) ?? false;
          const disabled = busy || (!picked && picks.length >= PICK_COUNT);
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => toggle(n)}
              style={{
                aspectRatio: "1",
                borderRadius: "var(--radius-md, 8px)",
                border: picked
                  ? "2px solid var(--accent)"
                  : "1px solid var(--border)",
                background: hit
                  ? "color-mix(in srgb, var(--success) 35%, transparent)"
                  : picked
                    ? "color-mix(in srgb, var(--accent) 20%, transparent)"
                    : "var(--card)",
                color: "var(--text)",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                opacity: disabled && !picked ? 0.5 : 1,
              }}
            >
              {n}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 12, color: "var(--muted)", padding: "0 2px" }}>
        {picks.length}/{PICK_COUNT} números elegidos
        {drawn != null && (
          <span>
            {" "}
            · Sorteados:{" "}
            {drawn
              .slice()
              .sort((a, b) => a - b)
              .join(", ")}
          </span>
        )}
      </div>

      <BetControls
        stake={stake}
        setStake={setStake}
        balance={balance}
        disabled={busy}
      />
      <Button
        variant="gold"
        block
        disabled={busy || picks.length !== PICK_COUNT}
        onClick={play}
      >
        {busy ? "Sorteando…" : "Sortear"}
      </Button>
    </div>
  );
}

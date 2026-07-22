"use client";

// Dado (Dice) — bet low/high against a provably-fair 0–100 roll. Re-skinned onto
// the kit + shared BetControls; the settled round is reported via onResult so the
// page can show the animated ResultCard instead of an inline text message.
//
// Animation (all component-local): on "Tirar" a big number display scrambles for
// ~700ms then settles on r.detail.roll, while a marker slides along a 1–100 track
// whose winning zone is shaded and whose target is marked. Win → green flash,
// loss → red flash. onResult fires the instant the roll settles.

import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import { casinoBet, casinoErrorLabel } from "../../lib/api";
import { Button, Field, Segmented } from "../ui";
import { BetControls, type CasinoGameProps } from "./shared";

const ROLL_MS = 700;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type Phase = "idle" | "rolling" | "settled";

export function Dice({
  balance,
  onBalance,
  onResult,
}: CasinoGameProps): JSX.Element {
  const [stake, setStake] = useState(50);
  const [side, setSide] = useState<"bajo" | "alto">("bajo");
  const [target, setTarget] = useState(50);
  const [busy, setBusy] = useState(false);

  // Visual roll state. `display` is the big scrambling/settled number; `marker`
  // (0–100) drives the track dot; `phase`/`outcome` gate the flash colors.
  const [display, setDisplay] = useState(50);
  const [marker, setMarker] = useState(50);
  const [phase, setPhase] = useState<Phase>("idle");
  const [outcome, setOutcome] = useState<"win" | "lose" | null>(null);

  // Resolved on mount (SSR-safe: starts false, so the first paint adds no
  // motion). Gates every transform/transition below.
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  // Animation handles, cleared on new round / unmount so nothing outlives it.
  const rafRef = useRef<number | null>(null);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sync reentrancy guard: the disabled button covers the common case, but a
  // very fast double-tap can fire before `busy` re-renders.
  const busyRef = useRef(false);

  const stopAnim = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (settleRef.current !== null) {
      clearTimeout(settleRef.current);
      settleRef.current = null;
    }
  }, []);

  useEffect(() => stopAnim, [stopAnim]);

  // Settle the visuals + report the round. Shared by both motion paths. The
  // balance is applied HERE (at the reveal), not when the bet resolves, so the
  // header never changes before the roll lands and spoils the outcome.
  const finish = useCallback(
    (
      roll: number,
      win: boolean,
      multiplier: number,
      payout: number,
      jackpotWon: number,
      newBalance: number,
    ) => {
      setDisplay(roll);
      setMarker(roll);
      setPhase("settled");
      setOutcome(win ? "win" : "lose");
      onBalance(newBalance);
      onResult({
        win,
        amount: win ? payout : stake,
        multiplier,
        label: `🎲 ${roll}`,
        ...(jackpotWon > 0 ? { jackpotWon } : {}),
      });
    },
    [onBalance, onResult, stake],
  );

  const play = async () => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusy(true);
    stopAnim();
    setOutcome(null);
    setPhase("rolling");
    try {
      const r = await casinoBet("dice", stake, { side, target });
      const d = r.detail as { roll: number };
      const win = r.payout > 0;
      const jackpotWon = r.jackpotWon ?? 0;

      if (prefersReducedMotion()) {
        finish(d.roll, win, r.multiplier, r.payout, jackpotWon, r.balance);
        busyRef.current = false;
        setBusy(false);
        return;
      }

      // Scramble the big number and jitter the marker until ROLL_MS elapses,
      // then snap to the real roll. rAF-driven so it pauses with the tab and
      // stays cheap on mobile.
      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = now - start;
        if (elapsed >= ROLL_MS) {
          rafRef.current = null;
          finish(d.roll, win, r.multiplier, r.payout, jackpotWon, r.balance);
          busyRef.current = false;
          setBusy(false);
          return;
        }
        // Ease the scramble: fast early, converging toward the real roll late.
        const t = elapsed / ROLL_MS;
        const spread = Math.max(1, Math.round((1 - t) * 100));
        const lo = Math.max(0, d.roll - spread);
        const hi = Math.min(100, d.roll + spread);
        const guess = lo + Math.floor(Math.random() * (hi - lo + 1));
        setDisplay(guess);
        setMarker(guess);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      // The bet was rejected — no chips moved. Show a neutral notice, not a
      // red "−stake" loss card for a round that never happened.
      stopAnim();
      setPhase("idle");
      setOutcome(null);
      onResult({
        neutral: true,
        win: false,
        amount: 0,
        label: casinoErrorLabel(e),
      });
      busyRef.current = false;
      setBusy(false);
    }
  };

  // Winning zone on the 0–100 track: "bajo" wins below target, "alto" at/above.
  const zoneLeft = side === "bajo" ? 0 : target;
  const zoneRight = side === "bajo" ? target : 100;
  const flash =
    phase === "settled" && outcome
      ? outcome === "win"
        ? "var(--success)"
        : "var(--danger)"
      : "var(--text)";

  return (
    <div className="game">
      <div
        aria-hidden="true"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          padding: "18px 12px 20px",
          borderRadius: "var(--radius-lg)",
          background: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            fontSize: 64,
            lineHeight: 1,
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.02em",
            color: flash,
            transition:
              !reduced && phase === "settled"
                ? "color 160ms ease, transform 160ms ease"
                : "none",
            transform:
              reduced || phase === "idle"
                ? "scale(1)"
                : phase === "settled"
                  ? "scale(1.06)"
                  : "scale(0.98)",
          }}
        >
          {display}
        </div>

        {/* 1–100 track: shaded winning zone, target marker, sliding roll dot. */}
        <svg
          viewBox="0 0 100 16"
          preserveAspectRatio="none"
          style={{ width: "100%", height: 26, display: "block" }}
        >
          <title>Pista 1–100</title>
          {/* base track */}
          <rect
            x={0}
            y={6}
            width={100}
            height={4}
            rx={2}
            fill="color-mix(in srgb, var(--muted) 26%, transparent)"
          />
          {/* winning zone */}
          <rect
            x={zoneLeft}
            y={6}
            width={Math.max(0, zoneRight - zoneLeft)}
            height={4}
            rx={2}
            fill="color-mix(in srgb, var(--success) 55%, transparent)"
          />
          {/* target marker */}
          <rect
            x={Math.min(99.4, Math.max(0, target - 0.3))}
            y={2}
            width={0.6}
            height={12}
            fill="var(--accent)"
          />
          {/* sliding roll marker */}
          <circle
            cx={marker}
            cy={8}
            r={3.4}
            fill={flash}
            stroke="var(--surface)"
            strokeWidth={1}
            style={{
              transition:
                !reduced && phase === "settled"
                  ? "cx 220ms ease-out, fill 160ms ease"
                  : "none",
            }}
          />
        </svg>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            fontSize: 12,
            color: "var(--muted)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span>0</span>
          <span>
            {side === "bajo" ? `Bajo < ${target}` : `Alto ≥ ${target}`}
          </span>
          <span>100</span>
        </div>
      </div>

      <BetControls
        stake={stake}
        setStake={setStake}
        balance={balance}
        disabled={busy}
      />
      <Field label="Predicción">
        <Segmented
          value={side}
          onChange={setSide}
          options={[
            { value: "bajo", label: `Bajo < ${target}` },
            { value: "alto", label: `Alto ≥ ${target}` },
          ]}
        />
      </Field>
      <Field label={`Objetivo: ${target}`}>
        <input
          className="input"
          type="range"
          min={2}
          max={98}
          value={target}
          disabled={busy}
          onChange={(e) => setTarget(Number(e.target.value))}
        />
      </Field>
      <Button variant="gold" block disabled={busy} onClick={play}>
        Tirar
      </Button>
    </div>
  );
}

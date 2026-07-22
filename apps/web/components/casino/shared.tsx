"use client";

// Shared foundation for the casino visual overhaul. Every game file consumes
// this contract: BetControls for staking, ResultCard for the animated outcome,
// ChipBadge for the header balance, and the GameResult/CasinoGameProps types
// that flow between the page and each game.

import { type JSX, useEffect } from "react";
import { haptic } from "../../lib/telegram";
import { Field } from "../ui";

/** The settled outcome of one round, handed up to the page for the ResultCard. */
export interface GameResult {
  win: boolean;
  /** Chips won (win) or lost (loss). Always positive; the card signs it. */
  amount: number;
  /** Optional payout multiplier, shown as an "x{multiplier}" chip. */
  multiplier?: number;
  /** Short context, e.g. "🎲 42", "🔴 17", "💥 x1.83". */
  label?: string;
  /**
   * Chips won from the progressive jackpot on this round (positive only). When
   * set, the ResultCard adds a gold "¡JACKPOT! +N" flourish on top of the
   * normal win. Independent of `amount` (the round's own payout).
   */
  jackpotWon?: number;
  /**
   * A zero-net outcome: no chips changed hands. Either the bet was rejected
   * before any debit (insufficient funds, stale session, network error) or the
   * round pushed (e.g. a blackjack tie returns the stake). The ResultCard
   * renders a neutral notice with `label`/`icon` only — no ±amount — so it is
   * never shown as a win or a loss. When true, `win`/`amount` are ignored.
   */
  neutral?: boolean;
  /** Glyph for the neutral notice (defaults to ⚠️). Ignored unless `neutral`. */
  icon?: string;
}

/** Props every game receives from the casino page. */
export interface CasinoGameProps {
  balance: number | null;
  onBalance: (n: number) => void;
  onResult: (r: GameResult) => void;
}

const MIN_STAKE = 10;
const MAX_STAKE = 10000;
const QUICK_BETS = [10, 50, 100, 500] as const;

function clampStake(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(n)));
}

/**
 * A labeled stake input plus a row of quick-bet chips (10 / 50 / 100 / 500 /
 * Todo). "Todo" bets the whole balance, capped at max. Everything clamps to
 * [min, max] and buzzes on tap.
 */
export function BetControls({
  stake,
  setStake,
  min = MIN_STAKE,
  max = MAX_STAKE,
  balance,
  disabled,
}: {
  stake: number;
  setStake: (n: number) => void;
  min?: number;
  max?: number;
  balance: number | null;
  disabled?: boolean;
}): JSX.Element {
  const pick = (n: number) => {
    haptic.selection();
    setStake(clampStake(n, min, max));
  };
  const allIn = () => {
    haptic.selection();
    const target = balance != null ? Math.min(balance, max) : max;
    setStake(clampStake(target, min, max));
  };

  return (
    <div className="bet-controls">
      <Field label="Apuesta">
        <input
          className="input"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={stake}
          disabled={disabled}
          onChange={(e) =>
            setStake(clampStake(Number(e.target.value), min, max))
          }
        />
      </Field>
      <div className="bet-chips">
        {QUICK_BETS.map((n) => (
          <button
            key={n}
            type="button"
            className={`bet-chip${stake === clampStake(n, min, max) ? " on" : ""}`}
            disabled={disabled}
            onClick={() => pick(n)}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          className="bet-chip bet-chip-all"
          disabled={disabled}
          onClick={allIn}
        >
          Todo
        </button>
      </div>
    </div>
  );
}

const CONFETTI = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"] as const;
// A jackpot rains extra confetti and lingers a beat longer to sell the moment.
const CONFETTI_JACKPOT = [
  ...CONFETTI,
  "c9",
  "c10",
  "c11",
  "c12",
  "c13",
  "c14",
] as const;
const DISMISS_MS = 2200;
const DISMISS_JACKPOT_MS = 3600;

/**
 * The animated outcome overlay. Win bounces with confetti, loss shakes; both
 * auto-dismiss after ~2.2s or on tap. Returns null when there is no result.
 * Reduced-motion users get the same card without transforms (CSS-gated).
 */
export function ResultCard({
  result,
  onDismiss,
}: {
  result: GameResult | null;
  onDismiss: () => void;
}): JSX.Element | null {
  const jackpot =
    result != null &&
    typeof result.jackpotWon === "number" &&
    result.jackpotWon > 0
      ? result.jackpotWon
      : null;

  useEffect(() => {
    if (!result) {
      return;
    }
    // A jackpot always feels like a win, even if the underlying round lost; a
    // neutral (rejected/push) outcome gets a soft warning, not an error buzz.
    haptic.notify(
      result.win || jackpot != null
        ? "success"
        : result.neutral
          ? "warning"
          : "error",
    );
    const id = setTimeout(
      onDismiss,
      jackpot != null ? DISMISS_JACKPOT_MS : DISMISS_MS,
    );
    return () => clearTimeout(id);
  }, [result, onDismiss, jackpot]);

  if (!result) {
    return null;
  }

  // A zero-net outcome (rejected bet or push) shows a neutral notice with no
  // ±amount, so it is never mistaken for a win or a loss.
  if (result.neutral) {
    return (
      <button
        type="button"
        className="result-overlay"
        aria-label="Cerrar aviso"
        onClick={onDismiss}
      >
        <div className="result-card result-notice">
          <span className="result-emoji" aria-hidden="true">
            {result.icon ?? "⚠️"}
          </span>
          <span className="result-notice-text">
            {result.label ?? "No se pudo apostar"}
          </span>
        </div>
      </button>
    );
  }

  const { win, amount, multiplier, label } = result;
  const sign = win ? "+" : "−";
  const confetti = jackpot != null ? CONFETTI_JACKPOT : CONFETTI;

  return (
    <button
      type="button"
      className="result-overlay"
      aria-label="Cerrar resultado"
      onClick={onDismiss}
    >
      <div
        className={`result-card ${win ? "result-win" : "result-lose"}${
          jackpot != null ? " result-jackpot" : ""
        }`}
      >
        {(win || jackpot != null) && (
          <div className="result-confetti" aria-hidden="true">
            {confetti.map((c) => (
              <span key={c} className={`confetti ${c}`} />
            ))}
          </div>
        )}
        {jackpot != null && (
          <div className="result-jackpot-flourish">
            <span className="result-jackpot-emoji" aria-hidden="true">
              🎰
            </span>
            <span className="result-jackpot-title">¡JACKPOT!</span>
            <span className="result-jackpot-amount">+{jackpot}</span>
          </div>
        )}
        <span className="result-emoji" aria-hidden="true">
          {win ? "🎉" : "💥"}
        </span>
        <span className="result-amount">
          {sign}
          {amount}
        </span>
        <div className="result-meta">
          {multiplier != null && (
            <span className="result-mult">x{multiplier}</span>
          )}
          {label != null && <span className="result-label">{label}</span>}
        </div>
      </div>
    </button>
  );
}

/**
 * A gold pill announcing the current progressive jackpot pot in the header /
 * hub. Pulses subtly (gated behind prefers-reduced-motion in CSS). Renders a
 * placeholder "…" while `amount` is still loading (null).
 */
export function JackpotBanner({
  amount,
}: {
  amount: number | null;
}): JSX.Element {
  return (
    <div className="jackpot-banner" role="status">
      <span className="jackpot-banner-glyph" aria-hidden="true">
        🎰
      </span>
      <span className="jackpot-banner-label">Bote</span>
      <span className="jackpot-banner-amount">{amount ?? "…"}</span>
    </div>
  );
}

/** A 🪙 {balance} pill for the header trailing slot. */
export function ChipBadge({
  balance,
}: {
  balance: number | null;
}): JSX.Element {
  return (
    <span className="chip-badge">
      🪙 <span className="chip-badge-value">{balance ?? "…"}</span>
    </span>
  );
}

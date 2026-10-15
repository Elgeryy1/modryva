"use client";

// Crash — bet, watch the live multiplier climb, and cash out before it explodes.
// Same start/cashout API flow as the original inline game; re-skinned with the
// kit and the shared BetControls, and reporting the settled round via onResult.
//
// Animation: the live multiplier now eases upward on a requestAnimationFrame
// loop (natural acceleration) instead of a fixed 0.03-per-100ms tick, an inline
// SVG plots the rising curve left→right/upward with a glowing gold head, the big
// x-value scales gently with the multiplier, and a crash flashes the curve red
// with a quick shake. All of it is gated behind prefers-reduced-motion.

import { type JSX, useEffect, useRef, useState } from "react";
import {
  ApiError,
  casinoErrorLabel,
  crashCashout,
  crashStart,
} from "../../lib/api";
import { Banner, Button } from "../ui";
import { BetControls, type CasinoGameProps } from "./shared";

// Errors that mean the bet is already gone server-side (no point retrying):
// clear the live round instead of leaving the player stuck on "Retirar ahora".
const TERMINAL_BET_ERRORS = new Set(["no-bet", "bet-closed", "wrong-game"]);
const isTerminalBetError = (e: unknown): boolean =>
  e instanceof ApiError && TERMINAL_BET_ERRORS.has(e.message);

// Viewbox for the inline curve. Kept small + unitless so it scales to any width.
const VIEW_W = 300;
const VIEW_H = 120;
// The multiplier we treat as "top of the chart" for mapping the curve height.
// Beyond this the head simply pins to the ceiling — the number keeps climbing.
const CURVE_CEIL = 6;
// Acceleration of the live climb, per second, applied on top of a base rate so
// the value speeds up naturally the longer the round survives.
const BASE_RATE = 0.28;
const ACCEL = 0.16;

const reducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Map a multiplier to a Y coordinate (SVG y grows downward, so invert). */
function multToY(m: number): number {
  const t = Math.min(1, Math.log(m) / Math.log(CURVE_CEIL));
  return VIEW_H - t * (VIEW_H - 6) - 3;
}

/** Build the polyline points for a climb that has reached multiplier `m`. */
function curvePoints(m: number): string {
  const steps = 24;
  const pts: string[] = [];
  const span = Math.max(0, m - 1);
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const cm = 1 + span * f;
    const x = f * VIEW_W;
    pts.push(`${x.toFixed(1)},${multToY(cm).toFixed(1)}`);
  }
  return pts.join(" ");
}

export function Crash({
  balance,
  onBalance,
  onResult,
}: CasinoGameProps): JSX.Element {
  const [stake, setStake] = useState(50);
  const [betId, setBetId] = useState<string | null>(null);
  const [mult, setMult] = useState(1);
  const [error, setError] = useState("");

  const raf = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTs = useRef<number>(0);
  const svgRef = useRef<SVGSVGElement | null>(null);
  // In-flight guards: block a second start/cashout from a rapid double-tap
  // (which would double-debit or hit "bet-closed"). betIdRef/multRef mirror the
  // live state for the unmount cleanup, which runs with a stale closure.
  const busy = useRef(false);
  const settling = useRef(false);
  const betIdRef = useRef<string | null>(null);
  const multRef = useRef(1);

  // Track the live multiplier in both state (for render) and a ref (for the
  // unmount settle, which can't read React state).
  const setLiveMult = (m: number) => {
    const v = Math.round(m * 100) / 100;
    multRef.current = v;
    setMult(v);
  };

  const stop = () => {
    if (raf.current != null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    if (timer.current != null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  const start = async () => {
    // Ignore taps while a round is live or a start is already in flight.
    if (busy.current || betIdRef.current) {
      return;
    }
    busy.current = true;
    setError("");
    try {
      const r = await crashStart(stake);
      onBalance(r.balance);
      setBetId(r.betId);
      betIdRef.current = r.betId;
      setLiveMult(1);
      stop();
      if (reducedMotion()) {
        // No rAF under reduced motion, but the value must still climb so the
        // player can cash out for a real win — advance it on a slow timer.
        timer.current = setInterval(() => {
          setLiveMult(multRef.current + 0.05);
        }, 220);
        return;
      }
      startTs.current = performance.now();
      const tick = (now: number) => {
        const dt = (now - startTs.current) / 1000;
        // Integral of (BASE_RATE + ACCEL*dt): value accelerates as dt grows.
        setLiveMult(1 + BASE_RATE * dt + 0.5 * ACCEL * dt * dt);
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    } catch (e) {
      setError(casinoErrorLabel(e));
    } finally {
      busy.current = false;
    }
  };

  const cashout = async () => {
    if (!betId || settling.current) {
      return;
    }
    settling.current = true;
    stop();
    // The server rejects cashoutAt<=1 (settleCrash's floor makes exactly 1.00
    // a guaranteed win) — mult can be exactly 1 synchronously right after
    // start(), before the first animation frame, so floor what we send just
    // above it.
    const at = Math.max(1.01, multRef.current);
    try {
      const r = await crashCashout(betId, at);
      onBalance(r.balance);
      if (r.win) {
        onResult({
          win: true,
          amount: r.payout,
          multiplier: at,
          label: `🚀 x${at.toFixed(2)}`,
        });
      } else {
        // Loss: flash the curve red + a quick shake before settling.
        flashCrash();
        onResult({
          win: false,
          amount: stake,
          label: `💥 x${r.crash}`,
        });
      }
      setBetId(null);
      betIdRef.current = null;
    } catch (e) {
      setError(casinoErrorLabel(e));
      // On a transient failure keep the bet live so the player can retry the
      // cashout; if the bet is already gone server-side, drop back to betting.
      if (isTerminalBetError(e)) {
        setBetId(null);
        betIdRef.current = null;
      }
    } finally {
      settling.current = false;
    }
  };

  // Red flash + shake on the chart, via the Web Animations API so nothing
  // leaks into globals.css. Skipped entirely under reduced motion.
  const flashCrash = () => {
    const el = svgRef.current;
    if (!el || reducedMotion() || typeof el.animate !== "function") {
      return;
    }
    el.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(5px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 320, easing: "ease-out" },
    );
  };

  // On unmount (tab away / close), settle any live bet so its stake is never
  // orphaned server-side. Best-effort: cash out at the last live multiplier; the
  // server decides win/lose against the real crash point. No state updates here
  // — the component is gone. Cleanup is inlined (not via `stop`) so it needs no
  // dependencies.
  useEffect(
    () => () => {
      if (raf.current != null) {
        cancelAnimationFrame(raf.current);
        raf.current = null;
      }
      if (timer.current != null) {
        clearInterval(timer.current);
        timer.current = null;
      }
      const orphan = betIdRef.current;
      if (orphan) {
        betIdRef.current = null;
        // Same floor as cashout() above — the server rejects cashoutAt<=1.
        crashCashout(orphan, Math.max(1.01, multRef.current)).catch(() => {});
      }
    },
    [],
  );

  const live = betId != null;
  // Head sits at the far right of the curve, at the current multiplier height.
  const headY = multToY(mult);
  // Text scales gently: 1.0 at x1 up to ~1.35 near the ceiling.
  const textScale =
    1 +
    Math.min(0.35, (Math.log(Math.max(1, mult)) / Math.log(CURVE_CEIL)) * 0.35);

  return (
    <div className="game">
      {live ? (
        <>
          <div
            style={{
              position: "relative",
              width: "100%",
              borderRadius: 14,
              overflow: "hidden",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.14))",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              width="100%"
              height="120"
              preserveAspectRatio="none"
              role="img"
              aria-label={`Multiplicador x${mult.toFixed(2)}`}
              style={{ display: "block" }}
            >
              <title>Curva del multiplicador</title>
              <defs>
                <linearGradient id="crashStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(255,209,102,0.35)" />
                  <stop offset="100%" stopColor="#ffd166" />
                </linearGradient>
                <linearGradient id="crashFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,209,102,0.22)" />
                  <stop offset="100%" stopColor="rgba(255,209,102,0)" />
                </linearGradient>
              </defs>
              {/* Soft area under the curve for depth. */}
              <polygon
                fill="url(#crashFill)"
                points={`0,${VIEW_H} ${curvePoints(mult)} ${VIEW_W},${VIEW_H}`}
              />
              {/* The rising curve. */}
              <polyline
                fill="none"
                stroke="url(#crashStroke)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={curvePoints(mult)}
              />
              {/* Glowing gold head at the current multiplier. */}
              <circle
                cx={VIEW_W}
                cy={headY}
                r="7"
                fill="rgba(255,209,102,0.25)"
              />
              <circle cx={VIEW_W} cy={headY} r="3.5" fill="#ffd166">
                <animate
                  attributeName="r"
                  values="3.5;5;3.5"
                  dur="0.9s"
                  repeatCount="indefinite"
                />
              </circle>
            </svg>
            <div
              className="crash-mult"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
                transform: `scale(${textScale.toFixed(3)})`,
                transformOrigin: "center",
                transition: "transform 90ms linear",
                textShadow: "0 2px 12px rgba(0,0,0,0.45)",
              }}
            >
              x{mult.toFixed(2)}
            </div>
          </div>
          <Button variant="gold" block onClick={cashout}>
            Retirar ahora
          </Button>
        </>
      ) : (
        <>
          <BetControls stake={stake} setStake={setStake} balance={balance} />
          <Button variant="gold" block onClick={start}>
            Lanzar 🚀
          </Button>
        </>
      )}
      {error && <Banner kind="error">{error}</Banner>}
    </div>
  );
}

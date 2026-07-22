"use client";

// Plinko: drop a chip through a 12-row peg board; where it lands sets the
// multiplier. Same API call as before (casinoBet "plinko"), re-skinned with the
// kit and reporting the settled round through onResult / onBalance. The board is
// an inline SVG; on drop we call the API, learn the landing slot, then animate a
// ball bouncing peg-to-peg down into that bin (rAF) before settling the round.

import { type JSX, useEffect, useRef, useState } from "react";
import { casinoBet, casinoErrorLabel } from "../../lib/api";
import { Banner, Button, Field, Segmented } from "../ui";
import { BetControls, type CasinoGameProps, type GameResult } from "./shared";

type Risk = "bajo" | "medio" | "alto";

const RISK_OPTIONS: ReadonlyArray<{ value: Risk; label: string }> = [
  { value: "bajo", label: "Bajo" },
  { value: "medio", label: "Medio" },
  { value: "alto", label: "Alto" },
];

// Board geometry (SVG user units). Mobile-first: the viewBox scales to fit.
const ROWS = 12;
const SLOTS = ROWS + 1; // 13 bins across the bottom
const VB_W = 320;
const VB_H = 300;
const PAD_X = 20;
const TOP_Y = 34; // first peg row baseline
const ROW_GAP = 18; // vertical spacing between peg rows
const BIN_Y = TOP_Y + ROWS * ROW_GAP + 14; // top edge of the slot bins
const PEG_R = 2.6;
const BALL_R = 5.2;
const STEP_MS = 92; // time to fall one peg row
const DROP_MS = 150; // fall from release into the top peg row

/** X position of peg `col` (0..row) in peg `row` (0..ROWS-1). */
function pegX(row: number, col: number): number {
  const usable = VB_W - PAD_X * 2;
  const rowWidth = (row + 1) * (usable / ROWS);
  const start = (VB_W - rowWidth) / 2 + PAD_X / 2;
  return start + col * (usable / ROWS);
}

/**
 * Center X of slot bin `slot` (0..ROWS). Aligned to the bottom peg row: those
 * pegs span from pegX(ROWS-1, 0) to pegX(ROWS-1, ROWS-1), and each bin sits in
 * the gap just below, so bin `s` centers on pegX(ROWS-1, s) shifted half a step.
 */
function slotX(slot: number): number {
  const usable = VB_W - PAD_X * 2;
  const step = usable / ROWS;
  const start = pegX(ROWS - 1, 0) - step / 2;
  return start + (slot + 0.5) * step;
}

/**
 * Build the peg-to-peg column path that lands exactly in `targetSlot`. Across
 * ROWS transitions the ball moves right `targetSlot` times and left the rest;
 * we spread the right-moves pseudo-randomly (seeded by slot) so the zigzag
 * looks natural but always reaches the target.
 */
function buildPath(targetSlot: number): number[] {
  const moves = new Array<0 | 1>(ROWS).fill(0);
  let rights = Math.max(0, Math.min(ROWS, targetSlot));
  // Deterministic-ish shuffle so consecutive drops to the same slot differ.
  let seed = (targetSlot + 1) * 2654435761 + Date.now();
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = ROWS - 1; i >= 0 && rights > 0; i--) {
    // Reservoir-style: give remaining rows a fair chance to take a right.
    if (rand() < rights / (i + 1) || rights > i) {
      moves[i] = 1;
      rights--;
    }
  }
  const cols: number[] = [0];
  let col = 0;
  for (let r = 0; r < ROWS; r++) {
    col += moves[r] ?? 0;
    cols.push(col);
  }
  return cols; // length ROWS + 1; cols[ROWS] === targetSlot
}

interface BallState {
  x: number;
  y: number;
}

export function Plinko({
  balance,
  onBalance,
  onResult,
}: CasinoGameProps): JSX.Element {
  const [stake, setStake] = useState(50);
  const [risk, setRisk] = useState<Risk>("medio");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ball, setBall] = useState<BallState | null>(null);
  const [landed, setLanded] = useState<number | null>(null);

  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const cancelMotion = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: unmount-only cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelMotion();
    };
  }, []);

  const prefersReduced = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** rAF drive the ball down the column path, then settle the round. */
  const runDrop = (targetSlot: number, settle: () => void) => {
    const cols = buildPath(targetSlot);
    // Waypoints: release point above the apex peg, each peg row, then the bin.
    const points: BallState[] = [{ x: pegX(0, 0), y: 8 }];
    for (let r = 0; r < ROWS; r++) {
      points.push({ x: pegX(r, cols[r] ?? 0), y: TOP_Y + r * ROW_GAP });
    }
    points.push({ x: slotX(targetSlot), y: BIN_Y + 10 });

    const segMs = points.map((_, i) => (i === 1 ? DROP_MS : STEP_MS));
    let seg = 0;
    let segStart = performance.now();
    setBall(points[0] ?? null);

    const tick = (now: number) => {
      if (!mountedRef.current) {
        return;
      }
      const from = points[seg];
      const to = points[seg + 1];
      if (!from || !to) {
        setBall(points[points.length - 1] ?? null);
        setLanded(targetSlot);
        rafRef.current = null;
        settle();
        return;
      }
      const dur = segMs[seg + 1] ?? STEP_MS;
      const t = Math.min(1, (now - segStart) / dur);
      // Ease-in on descent (gravity), tiny horizontal ease for the bounce.
      const ty = t * t;
      const tx = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setBall({
        x: from.x + (to.x - from.x) * tx,
        y: from.y + (to.y - from.y) * ty,
      });
      if (t >= 1) {
        seg++;
        segStart = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const play = async () => {
    cancelMotion();
    setBusy(true);
    setError("");
    setLanded(null);
    setBall(null);
    try {
      const r = await casinoBet("plinko", stake, { rows: 12, risk });
      const d = r.detail as { slot: number };
      const slot = Math.max(0, Math.min(ROWS, Math.round(d.slot)));
      const jackpot = r.jackpotWon ?? 0;
      const jackpotField = jackpot > 0 ? { jackpotWon: jackpot } : {};
      const label = `🔵 Casilla ${d.slot}`;

      // Plinko has fractional multipliers (e.g. 0.5x), so payout can be > 0 yet
      // still a net LOSS. Classify by payout vs stake, not payout vs 0, and show
      // the true net amount so a partial return is never coloured as a win.
      const net = r.payout - stake;
      let result: GameResult;
      if (net > 0) {
        result = {
          win: true,
          amount: r.payout,
          multiplier: r.multiplier,
          label,
          ...jackpotField,
        };
      } else if (net === 0) {
        result = {
          neutral: true,
          icon: "🔵",
          win: false,
          amount: 0,
          multiplier: r.multiplier,
          label: `Recuperas tu apuesta · casilla ${d.slot}`,
          ...jackpotField,
        };
      } else {
        result = {
          win: false,
          amount: stake - r.payout,
          multiplier: r.multiplier,
          label,
          ...jackpotField,
        };
      }

      const settle = () => {
        if (!mountedRef.current) {
          return;
        }
        onBalance(r.balance);
        onResult(result);
        setBusy(false);
      };

      if (prefersReduced()) {
        // Show the final resting state instantly, no transforms/loops.
        setBall({ x: slotX(slot), y: BIN_Y + 10 });
        setLanded(slot);
        settle();
        return;
      }

      runDrop(slot, settle);
    } catch (e) {
      setError(casinoErrorLabel(e));
      setBall(null);
      setLanded(null);
      setBusy(false);
    }
  };

  return (
    <div className="game">
      <PlinkoBoard ball={ball} landed={landed} />
      <BetControls
        stake={stake}
        setStake={setStake}
        balance={balance}
        disabled={busy}
      />
      <Field label="Riesgo">
        <Segmented options={RISK_OPTIONS} value={risk} onChange={setRisk} />
      </Field>
      <Button variant="gold" block disabled={busy} onClick={play}>
        {busy ? "Cayendo…" : "Soltar ficha"}
      </Button>
      {error && <Banner kind="error">{error}</Banner>}
    </div>
  );
}

/** The static peg triangle + slot bins, with the live ball drawn on top. */
function PlinkoBoard({
  ball,
  landed,
}: {
  ball: BallState | null;
  landed: number | null;
}): JSX.Element {
  const pegs: JSX.Element[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= r; c++) {
      pegs.push(
        <circle
          key={`p-${r}-${c}`}
          cx={pegX(r, c)}
          cy={TOP_Y + r * ROW_GAP}
          r={PEG_R}
          fill="currentColor"
          opacity={0.32}
        />,
      );
    }
  }

  const bins: JSX.Element[] = [];
  const usable = VB_W - PAD_X * 2;
  const binW = usable / ROWS;
  for (let s = 0; s < SLOTS; s++) {
    const cx = slotX(s);
    const on = landed === s;
    bins.push(
      <g key={`b-${s}`}>
        <rect
          x={cx - binW / 2 + 1}
          y={BIN_Y}
          width={binW - 2}
          height={22}
          rx={4}
          fill={on ? "var(--tg-accent, #f5b300)" : "currentColor"}
          opacity={on ? 1 : 0.12}
        >
          {on && (
            <animate
              attributeName="opacity"
              values="1;0.55;1"
              dur="0.5s"
              begin="0s"
              repeatCount="2"
            />
          )}
        </rect>
      </g>,
    );
  }

  return (
    <div
      style={{
        borderRadius: 14,
        overflow: "hidden",
        marginBottom: 12,
        background:
          "linear-gradient(180deg, rgba(127,127,127,0.06), rgba(127,127,127,0.02))",
      }}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        role="img"
        aria-label="Tablero de Plinko"
        style={{ display: "block", color: "var(--tg-text, currentColor)" }}
      >
        <title>Tablero de Plinko</title>
        {pegs}
        {bins}
        {ball && (
          <g>
            <circle
              cx={ball.x}
              cy={ball.y}
              r={BALL_R}
              fill="var(--tg-accent, #f5b300)"
            />
            <circle
              cx={ball.x - 1.4}
              cy={ball.y - 1.6}
              r={1.6}
              fill="#fff"
              opacity={0.75}
            />
          </g>
        )}
      </svg>
    </div>
  );
}

"use client";

// Ruleta europea (0–36). Same server call & payout logic as the original inline
// game — only re-skinned with the kit + shared BetControls, and the old text
// "msg" replaced by props.onResult(...) at the moment the spin settles.
//
// The wheel is inline SVG. On spin we call the API first, then animate the wheel
// (several turns, cubic-bezier ease-out) to LAND the result pocket under the
// fixed pointer, and only fire onResult once it settles.

import { type JSX, useEffect, useRef, useState } from "react";
import { casinoBet, casinoErrorLabel } from "../../lib/api";
import { Button, Field, Segmented } from "../ui";
import { BetControls, type CasinoGameProps, type GameResult } from "./shared";

// Red pockets on a European roulette wheel (the rest, bar 0, are black).
const RED = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

// Physical pocket order around a European wheel, clockwise from 0.
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;

const POCKETS = WHEEL_ORDER.length; // 37
const SLICE = 360 / POCKETS; // ~9.73° per pocket

const KINDS = [
  { value: "red", label: "🔴 Rojo" },
  { value: "black", label: "⚫ Negro" },
  { value: "odd", label: "Impar" },
  { value: "even", label: "Par" },
  { value: "low", label: "1–18" },
  { value: "high", label: "19–36" },
] as const;

type Kind = (typeof KINDS)[number]["value"];

const R = 100; // wheel radius in SVG units
const CX = 110;
const CY = 110;
const LABEL_R = R - 13; // radius for the number labels

function pocketColor(n: number): string {
  if (n === 0) {
    return "#1f9d55"; // green
  }
  return RED.has(n) ? "#c62828" : "#1a1a1a";
}

// One pie slice for pocket at index i (centered on the wheel's 12-o'clock axis
// when rotation is 0). Angles are measured clockwise from the top.
function slicePath(i: number): string {
  const a0 = (i - 0.5) * SLICE - 90; // -90 puts index 0 at the top
  const a1 = (i + 0.5) * SLICE - 90;
  const r0 = (a0 * Math.PI) / 180;
  const r1 = (a1 * Math.PI) / 180;
  const x0 = CX + R * Math.cos(r0);
  const y0 = CY + R * Math.sin(r0);
  const x1 = CX + R * Math.cos(r1);
  const y1 = CY + R * Math.sin(r1);
  return `M ${CX} ${CY} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

function labelPos(i: number): { x: number; y: number; angle: number } {
  const a = i * SLICE - 90;
  const rad = (a * Math.PI) / 180;
  return {
    x: CX + LABEL_R * Math.cos(rad),
    y: CY + LABEL_R * Math.sin(rad),
    angle: a + 90, // rotate the glyph to sit radially
  };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function Roulette({
  balance,
  onBalance,
  onResult,
}: CasinoGameProps): JSX.Element {
  const [stake, setStake] = useState(50);
  const [kind, setKind] = useState<Kind>("red");
  const [busy, setBusy] = useState(false);
  // Live rotation of the wheel group (degrees). Kept in state so React renders
  // the resting position; the spin itself is driven by the Web Animations API.
  const [rotation, setRotation] = useState(0);

  const wheelRef = useRef<SVGGElement | null>(null);
  const animRef = useRef<Animation | null>(null);
  // Sync reentrancy guard: prevents a fast double-tap from starting a second
  // spin that would cancel the first (orphaning its balance/result sync).
  const busyRef = useRef(false);

  // Cancel any in-flight spin on unmount.
  useEffect(() => {
    return () => {
      animRef.current?.cancel();
      animRef.current = null;
    };
  }, []);

  // Rotation (positive, clockwise) that brings pocket at WHEEL_ORDER index
  // `idx` up to the pointer at the top, plus `turns` extra full spins.
  const targetRotation = (idx: number, turns: number): number => {
    const base = rotation - (rotation % 360); // keep accumulating forward
    const land = (360 - idx * SLICE) % 360; // pocket idx -> under the pointer
    return base + turns * 360 + land;
  };

  // Apply the new balance when the wheel SETTLES (not at spin start), so the
  // coins change in sync with the reveal instead of 4.2s early behind the result
  // overlay — which read as "the balance never moves" (and spoiled the outcome).
  const settle = (result: GameResult, newBalance: number) => {
    animRef.current = null;
    onBalance(newBalance);
    busyRef.current = false;
    setBusy(false);
    onResult(result);
  };

  const play = async () => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    // A fresh round cancels a lingering animation before it can fire.
    animRef.current?.cancel();
    animRef.current = null;
    setBusy(true);
    try {
      const r = await casinoBet("roulette", stake, { kind });
      const d = r.detail as { pocket: number };
      const color = d.pocket === 0 ? "🟢" : RED.has(d.pocket) ? "🔴" : "⚫";
      const win = r.payout > 0;
      const jackpotWon = r.jackpotWon ?? 0;
      const result: GameResult = {
        win,
        amount: win ? r.payout : stake,
        label: `${color} ${d.pocket}`,
        ...(win ? { multiplier: r.multiplier } : {}),
        ...(jackpotWon > 0 ? { jackpotWon } : {}),
      };

      const idx = (WHEEL_ORDER as readonly number[]).indexOf(d.pocket);
      const safeIdx = idx >= 0 ? idx : 0;
      const turns = 5 + Math.floor(Math.random() * 3); // 5–7 full spins
      const to = targetRotation(safeIdx, turns);

      const node = wheelRef.current;
      if (
        prefersReducedMotion() ||
        !node ||
        typeof node.animate !== "function"
      ) {
        // Snap to the landing angle and settle immediately.
        setRotation(to);
        settle(result, r.balance);
        return;
      }

      const anim = node.animate(
        [
          { transform: `rotate(${rotation}deg)` },
          { transform: `rotate(${to}deg)` },
        ],
        {
          duration: 4200,
          easing: "cubic-bezier(0.16, 0.84, 0.28, 1)",
          fill: "forwards",
        },
      );
      animRef.current = anim;
      anim.onfinish = () => {
        anim.cancel(); // drop the fill so the state transform takes over
        setRotation(to);
        settle(result, r.balance);
      };
      anim.oncancel = () => {
        // Superseded by a new round or unmount — don't fire this result.
      };
    } catch (e) {
      // Rejected bet — nothing was staked. Show a neutral notice, not a loss.
      animRef.current = null;
      busyRef.current = false;
      setBusy(false);
      onResult({
        neutral: true,
        win: false,
        amount: 0,
        label: casinoErrorLabel(e),
      });
    }
  };

  return (
    <div className="game">
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "4px 0 8px",
        }}
      >
        <svg
          viewBox="0 0 220 232"
          width="100%"
          style={{ maxWidth: 260, height: "auto", display: "block" }}
          role="img"
          aria-label="Ruleta europea"
        >
          {/* Pointer / marker fixed at the top. */}
          <path
            d="M 110 6 L 118 22 L 102 22 Z"
            fill="#f5c451"
            stroke="#3a2c00"
            strokeWidth="1"
          />
          {/* Outer rim. */}
          <circle
            cx={CX}
            cy={CY}
            r={R + 6}
            fill="#2a1a08"
            stroke="#f5c451"
            strokeWidth="2"
          />
          <g
            ref={wheelRef}
            style={{
              transform: `rotate(${rotation}deg)`,
              transformOrigin: `${CX}px ${CY}px`,
            }}
          >
            {WHEEL_ORDER.map((n, i) => (
              <path
                key={n}
                d={slicePath(i)}
                fill={pocketColor(n)}
                stroke="#f5c451"
                strokeWidth="0.5"
              />
            ))}
            {WHEEL_ORDER.map((n, i) => {
              const p = labelPos(i);
              return (
                <text
                  key={`t-${n}`}
                  x={p.x.toFixed(2)}
                  y={p.y.toFixed(2)}
                  fill="#fff"
                  fontSize="7"
                  fontWeight="700"
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${p.angle.toFixed(2)} ${p.x.toFixed(2)} ${p.y.toFixed(2)})`}
                >
                  {n}
                </text>
              );
            })}
          </g>
          {/* Hub. */}
          <circle
            cx={CX}
            cy={CY}
            r="14"
            fill="#3a2c00"
            stroke="#f5c451"
            strokeWidth="2"
          />
          <circle cx={CX} cy={CY} r="4" fill="#f5c451" />
        </svg>
      </div>
      <BetControls
        stake={stake}
        setStake={setStake}
        balance={balance}
        disabled={busy}
      />
      <Field label="Apuesta a">
        <Segmented options={KINDS} value={kind} onChange={(k) => setKind(k)} />
      </Field>
      <Button variant="gold" block disabled={busy} onClick={play}>
        {busy ? "Girando…" : "Girar"}
      </Button>
    </div>
  );
}

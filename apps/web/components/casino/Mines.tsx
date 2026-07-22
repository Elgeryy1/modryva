"use client";

// Minas: destapa casillas sin tocar una mina; retira antes de reventar. The
// game logic and API calls are copied verbatim from the old inline Mines in
// app/casino/page.tsx — only the skin (kit Button + shared BetControls) and the
// outcome reporting (props.onResult instead of a text msg) changed.
//
// Animations live entirely inside this component: a 3D rotateY flip per reveal
// (Web Animations API), a gem pop-in with a soft green glow, a mine explosion
// (scale + shake) that staggers the reveal of every other mine and shakes the
// board, and a smoothly tweened multiplier readout. Everything respects
// prefers-reduced-motion and is torn down on unmount / new round.

import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import {
  casinoErrorLabel,
  minesCashout,
  minesReveal,
  minesStart,
} from "../../lib/api";
import { haptic } from "../../lib/telegram";
import { Banner, Button, Field } from "../ui";
import { BetControls, type CasinoGameProps } from "./shared";

const MINE_TILES = Array.from({ length: 25 }, (_, tile) => tile);

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Mines({
  balance,
  onBalance,
  onResult,
}: CasinoGameProps): JSX.Element {
  const [stake, setStake] = useState(50);
  const [mineCount, setMineCount] = useState(3);
  const [betId, setBetId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<number, "safe" | "mine">>({});
  const [mult, setMult] = useState(1);
  // The number actually painted on screen — tweened up toward `mult`.
  const [shownMult, setShownMult] = useState(1);
  // Mirror of shownMult for the tween to read its start value without the
  // effect having to depend on (and restart from) shownMult itself.
  const shownRef = useRef(1);
  const [boom, setBoom] = useState(false);
  const [err, setErr] = useState("");

  // In-flight guards. `starting`/`settling` block double-taps on start/cashout;
  // `revealing` serialises tile reveals so the client never fires two concurrent
  // minesReveal calls (which would race on the same server-side bet state).
  const starting = useRef(false);
  const revealing = useRef(false);
  const settling = useRef(false);
  // Mirror of betId for the unmount cleanup (which runs with a stale closure).
  const betIdRef = useRef<string | null>(null);
  useEffect(() => {
    betIdRef.current = betId;
  }, [betId]);

  // Tile <button> DOM nodes, so we can drive per-tile flips/pops imperatively.
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const gridRef = useRef<HTMLDivElement | null>(null);
  // Everything we must cancel on unmount / new round.
  const rafRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);
  const animsRef = useRef<Animation[]>([]);

  const clearMotion = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    for (const t of timersRef.current) {
      clearTimeout(t);
    }
    timersRef.current = [];
    for (const a of animsRef.current) {
      a.cancel();
    }
    animsRef.current = [];
  }, []);

  useEffect(() => clearMotion, [clearMotion]);

  // On unmount (tab away / close) with an unfinished game, best-effort cash out
  // so the stake isn't orphaned server-side. If no safe tile was revealed yet
  // the server rejects it (nothing-revealed) and the bet simply stays open —
  // acceptable for the rare "start then leave immediately" case. No state
  // updates here; the component is gone.
  useEffect(
    () => () => {
      const orphan = betIdRef.current;
      if (orphan) {
        betIdRef.current = null;
        minesCashout(orphan).catch(() => {});
      }
    },
    [],
  );

  // Keep the mirror ref in sync with the painted value.
  const paint = useCallback((v: number) => {
    shownRef.current = v;
    setShownMult(v);
  }, []);

  // Smoothly tween the displayed multiplier toward the real one.
  useEffect(() => {
    const to = mult;
    if (prefersReducedMotion()) {
      paint(to);
      return;
    }
    const from = shownRef.current;
    if (from === to) {
      return;
    }
    const DURATION = 420;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      // easeOutCubic for a lively settle.
      const eased = 1 - (1 - t) ** 3;
      paint(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        paint(to);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [mult, paint]);

  const track = (a: Animation | null | undefined) => {
    if (a) {
      animsRef.current.push(a);
    }
  };

  // A 3D rotateY flip on the tile as it turns over.
  const flipTile = (tile: number) => {
    if (prefersReducedMotion()) {
      return;
    }
    const el = tileRefs.current[tile];
    track(
      el?.animate(
        [
          { transform: "perspective(420px) rotateY(0deg)" },
          { transform: "perspective(420px) rotateY(90deg)", offset: 0.5 },
          { transform: "perspective(420px) rotateY(0deg)" },
        ],
        { duration: 360, easing: "ease-in-out" },
      ),
    );
  };

  // Gem pop: scale-in with a soft settle (glow comes from the CSS class).
  const popGem = (tile: number) => {
    if (prefersReducedMotion()) {
      return;
    }
    const el = tileRefs.current[tile];
    // Delay to the mid-point of the flip so the gem appears face-up.
    const id = window.setTimeout(() => {
      const span = el?.querySelector<HTMLElement>(".mine-face");
      track(
        span?.animate(
          [
            { transform: "scale(0)", opacity: "0" },
            { transform: "scale(1.35)", opacity: "1", offset: 0.6 },
            { transform: "scale(1)", opacity: "1" },
          ],
          { duration: 340, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
        ),
      );
    }, 150);
    timersRef.current.push(id);
  };

  const shakeBoard = () => {
    if (prefersReducedMotion()) {
      return;
    }
    track(
      gridRef.current?.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-6px)" },
          { transform: "translateX(5px)" },
          { transform: "translateX(-3px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 320, easing: "ease-in-out" },
      ),
    );
  };

  // Explosion on the hit tile: violent scale + shake.
  const explodeTile = (tile: number) => {
    if (prefersReducedMotion()) {
      return;
    }
    const el = tileRefs.current[tile];
    track(
      el?.animate(
        [
          { transform: "scale(1) rotate(0deg)" },
          { transform: "scale(1.4) rotate(-8deg)", offset: 0.35 },
          { transform: "scale(1.15) rotate(7deg)", offset: 0.6 },
          { transform: "scale(1) rotate(0deg)" },
        ],
        { duration: 420, easing: "ease-out" },
      ),
    );
  };

  const start = async () => {
    if (starting.current || betId) {
      return;
    }
    starting.current = true;
    setErr("");
    clearMotion();
    setBoom(false);
    setRevealed({});
    setMult(1);
    paint(1);
    try {
      const r = await minesStart(stake, mineCount);
      setBetId(r.betId);
      // The stake was just debited server-side; reflect it in the header now.
      onBalance(r.balance);
    } catch (e) {
      setErr(casinoErrorLabel(e));
    } finally {
      starting.current = false;
    }
  };

  const reveal = async (tile: number) => {
    if (!betId || revealed[tile] || boom || revealing.current) {
      return;
    }
    revealing.current = true;
    try {
      const r = await minesReveal(betId, tile);
      if (r.mine) {
        const reduce = prefersReducedMotion();
        setBoom(true);
        haptic.notify("error");
        // Show the hit tile immediately and blow it up.
        setRevealed((prev) => ({ ...prev, [tile]: "mine" }));
        explodeTile(tile);
        shakeBoard();

        const others = (r.layout ?? []).filter((m) => m !== tile);
        const settle = () => {
          onBalance(r.balance ?? 0);
          onResult({ win: false, amount: stake, label: "💣 Mina" });
          setBetId(null);
        };

        if (reduce) {
          // No stagger: reveal every mine at once, then settle instantly.
          setRevealed((prev) => {
            const map = { ...prev };
            for (const m of r.layout ?? []) {
              map[m] = "mine";
            }
            return map;
          });
          settle();
        } else {
          // Stagger the remaining mines in, then fire onResult after the boom.
          others.forEach((m, idx) => {
            const id = window.setTimeout(
              () => {
                setRevealed((prev) => ({ ...prev, [m]: "mine" }));
                flipTile(m);
              },
              120 + idx * 70,
            );
            timersRef.current.push(id);
          });
          const settleId = window.setTimeout(
            settle,
            120 + others.length * 70 + 260,
          );
          timersRef.current.push(settleId);
        }
      } else {
        setRevealed((prev) => ({ ...prev, [tile]: "safe" }));
        flipTile(tile);
        popGem(tile);
        haptic.impact("light");
        setMult(r.multiplier ?? 1);
        if (r.cleared) {
          // Every safe tile is uncovered: the server auto-cashed the bet out.
          // Settle it as a win — there is nothing left to reveal.
          const clearedMult = r.multiplier ?? 1;
          haptic.notify("success");
          onBalance(r.balance ?? balance ?? 0);
          onResult({
            win: true,
            amount: r.payout ?? 0,
            multiplier: clearedMult,
            label: `💎 x${clearedMult} · ¡tablero limpio!`,
          });
          setBetId(null);
        }
      }
    } catch (e) {
      setErr(casinoErrorLabel(e));
    } finally {
      revealing.current = false;
    }
  };

  const cashout = async () => {
    // Block a cash-out once a mine has blown (boom) or while one is in flight.
    if (!betId || boom || settling.current) {
      return;
    }
    settling.current = true;
    try {
      const r = await minesCashout(betId);
      onBalance(r.balance);
      onResult({
        win: true,
        amount: r.payout,
        multiplier: r.multiplier,
        label: `💎 x${r.multiplier}`,
      });
      setBetId(null);
    } catch (e) {
      setErr(casinoErrorLabel(e));
    } finally {
      settling.current = false;
    }
  };

  const multLabel = shownMult.toFixed(2).replace(/\.00$/, "");

  return (
    <div className="game">
      <style>{MINES_ANIM_CSS}</style>
      {betId ? (
        <>
          <p className="game-progress">
            Multiplicador actual: x{multLabel} · {mineCount} minas
          </p>
          <div
            className={`mines-grid${boom ? " mines-boom" : ""}`}
            ref={gridRef}
          >
            {MINE_TILES.map((i) => (
              <button
                key={`mine-tile-${i}`}
                type="button"
                ref={(el) => {
                  tileRefs.current[i] = el;
                }}
                className={`mine-tile mines-anim-tile${revealed[i] ? ` ${revealed[i]}` : ""}`}
                onClick={() => reveal(i)}
              >
                <span className="mine-face" aria-hidden="true">
                  {revealed[i] === "safe"
                    ? "💎"
                    : revealed[i] === "mine"
                      ? "💥"
                      : ""}
                </span>
              </button>
            ))}
          </div>
          <Button variant="gold" block onClick={cashout}>
            Retirar x{multLabel}
          </Button>
        </>
      ) : (
        <>
          <BetControls stake={stake} setStake={setStake} balance={balance} />
          <Field label="Minas">
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              max={24}
              value={mineCount}
              onChange={(e) => setMineCount(Number(e.target.value))}
            />
          </Field>
          <Button variant="gold" block onClick={start}>
            Empezar
          </Button>
        </>
      )}
      {err && <Banner kind="error">{err}</Banner>}
    </div>
  );
}

// Component-local styles. Only additive polish (glow, centering the emoji,
// reduced-motion guard) — the base .mine-tile / .safe / .mine come from
// globals.css and are left untouched.
const MINES_ANIM_CSS = `
.mines-anim-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  transform-style: preserve-3d;
  transition: box-shadow 200ms ease, background 200ms ease;
}
.mines-anim-tile .mine-face {
  display: inline-flex;
  line-height: 1;
  will-change: transform;
}
.mines-anim-tile.safe {
  box-shadow: 0 0 10px 1px rgba(47, 133, 90, 0.55),
    inset 0 0 8px rgba(47, 133, 90, 0.35);
}
.mines-anim-tile.mine {
  box-shadow: 0 0 12px 1px rgba(178, 58, 46, 0.5);
}
@media (prefers-reduced-motion: reduce) {
  .mines-anim-tile,
  .mines-anim-tile .mine-face {
    transition: none;
  }
}
`;

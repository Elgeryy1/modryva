"use client";

// Blackjack — deal, then hit / stand against the dealer. The round can settle
// immediately on a natural blackjack (start) or after an action. We keep the
// exact API calls (blackjackStart / blackjackAction) and the card values, but
// re-skin the table with dealt-card animations: each card slides + flips in
// from the deck (staggered, Web Animations API), the dealer hole card flips
// face-up on settle, totals tween, and the table pulses green/red on outcome.
// The settled round is still reported through onResult / onBalance.

import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import {
  blackjackAction,
  blackjackStart,
  casinoErrorLabel,
} from "../../lib/api";
import { Banner, Button } from "../ui";
import { BetControls, type CasinoGameProps, type GameResult } from "./shared";

const RANK = (r: number) =>
  r === 1 ? "A" : r === 11 ? "J" : r === 12 ? "Q" : r === 13 ? "K" : String(r);

// A deterministic suit per card slot — purely cosmetic (the API only sends
// ranks), rotated by position so a hand doesn't look monotone.
const SUITS = ["♠", "♥", "♦", "♣"] as const;
const RED_SUITS = new Set(["♥", "♦"]);

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Best blackjack total for a set of ranks (aces soft→11 when it doesn't bust).
function handTotal(ranks: number[]): number {
  let total = 0;
  let aces = 0;
  for (const r of ranks) {
    if (r === 1) {
      aces += 1;
      total += 11;
    } else if (r >= 10) {
      total += 10;
    } else {
      total += r;
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

/** One rendered card. Animates its entrance from the deck when it first mounts. */
function PlayingCard({
  rank,
  suitIndex,
  faceDown = false,
  flipUp = false,
  index,
  reduce,
}: {
  rank: number | null;
  suitIndex: number;
  faceDown?: boolean;
  flipUp?: boolean;
  index: number;
  reduce: boolean;
}): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  const dealtRef = useRef(false);
  const flippedRef = useRef(false);
  const suit = SUITS[suitIndex % SUITS.length] ?? "♠";
  const red = RED_SUITS.has(suit);

  // Deal-in animation: slide + flip from the deck, staggered by hand position.
  useEffect(() => {
    const el = ref.current;
    if (!el || dealtRef.current) {
      return;
    }
    dealtRef.current = true;
    if (reduce || typeof el.animate !== "function") {
      return;
    }
    const anim = el.animate(
      [
        {
          transform:
            "translate(-140px, -90px) rotateY(90deg) rotateZ(-12deg) scale(0.9)",
          opacity: 0,
        },
        {
          transform: "translate(0, 0) rotateY(0deg) rotateZ(0deg) scale(1)",
          opacity: 1,
        },
      ],
      {
        duration: 380,
        delay: Math.min(index, 8) * 90,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "both",
      },
    );
    return () => anim.cancel();
  }, [index, reduce]);

  // Hole-card flip: face-down → face-up when the dealer's hand is revealed.
  useEffect(() => {
    const el = ref.current;
    if (!el || !flipUp || flippedRef.current) {
      return;
    }
    flippedRef.current = true;
    if (reduce || typeof el.animate !== "function") {
      return;
    }
    const anim = el.animate(
      [
        { transform: "rotateY(180deg)" },
        { transform: "rotateY(90deg)", offset: 0.5 },
        { transform: "rotateY(0deg)" },
      ],
      { duration: 460, easing: "cubic-bezier(0.45, 0, 0.15, 1)", fill: "both" },
    );
    return () => anim.cancel();
  }, [flipUp, reduce]);

  return (
    <div
      ref={ref}
      style={{
        width: 42,
        height: 60,
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "4px 5px",
        fontWeight: 700,
        fontSize: 16,
        lineHeight: 1,
        boxShadow: "0 2px 6px rgba(0,0,0,0.28)",
        transformStyle: "preserve-3d",
        backfaceVisibility: "hidden",
        userSelect: "none",
        ...(faceDown
          ? {
              background:
                "repeating-linear-gradient(45deg, #2b6cb0 0 6px, #234e7d 6px 12px)",
              color: "transparent",
              border: "1px solid #1a365d",
            }
          : {
              background: "#fdfdfd",
              color: red ? "#d92a2a" : "#1a1a1a",
              border: "1px solid #d9d9d9",
            }),
      }}
    >
      {faceDown ? (
        <span aria-hidden="true" />
      ) : (
        <>
          <span>{rank != null ? RANK(rank) : ""}</span>
          <span style={{ alignSelf: "flex-end", fontSize: 18 }}>{suit}</span>
        </>
      )}
    </div>
  );
}

/** A total that tweens up/down to its target value over ~350ms. */
function TweenTotal({
  value,
  reduce,
}: {
  value: number;
  reduce: boolean;
}): JSX.Element {
  const [shown, setShown] = useState(value);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef(value);

  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    const from = fromRef.current;
    if (from === value) {
      return;
    }
    const start = performance.now();
    const duration = 350;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) * (1 - t);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = value;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      fromRef.current = value;
    };
  }, [value, reduce]);

  return <>{shown}</>;
}

export function Blackjack({
  balance,
  onBalance,
  onResult,
}: CasinoGameProps): JSX.Element {
  const [stake, setStake] = useState(50);
  const [betId, setBetId] = useState<string | null>(null);
  const [player, setPlayer] = useState<number[]>([]);
  const [dealerUp, setDealerUp] = useState<number | null>(null);
  const [dealer, setDealer] = useState<number[] | null>(null);
  const [error, setError] = useState("");
  // Disable deal/hit/stand while a request is in flight (double-tap → a second
  // action would race the round or hit "bet-closed"). Ref for the sync guard,
  // state to grey out the buttons.
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  // Bumped each time a fresh round begins so the card <div key> changes and the
  // deal-in animation re-runs from the deck for the new hand.
  const [roundKey, setRoundKey] = useState(0);

  const tableRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<Animation | null>(null);
  const reduce = prefersReducedMotion();

  // Cancel any lingering table glow on unmount.
  useEffect(() => {
    return () => {
      glowRef.current?.cancel();
      glowRef.current = null;
    };
  }, []);

  const betIdRef = useRef<string | null>(null);
  useEffect(() => {
    betIdRef.current = betId;
  }, [betId]);

  // If the player leaves mid-hand (Telegram back button, switching games)
  // resolve the open bet immediately instead of leaving it orphaned until
  // their next blackjack visit — blackjackStart also reconciles it
  // server-side as the actual safety net; this just closes the gap sooner
  // for the common in-app-navigation case. Skipped when a request is
  // already in flight, since that request will itself settle or continue
  // the bet — firing a second "stand" concurrently could race it.
  useEffect(() => {
    return () => {
      const id = betIdRef.current;
      if (id && !busyRef.current) {
        void blackjackAction(id, "stand").catch(() => {
          // Best-effort — blackjackStart reconciles it on the next visit.
        });
      }
    };
  }, []);

  // Green/red pulse on the table when a round settles.
  const pulseTable = useCallback(
    (win: boolean) => {
      const el = tableRef.current;
      if (!el || reduce || typeof el.animate !== "function") {
        return;
      }
      glowRef.current?.cancel();
      const color = win ? "rgba(56, 200, 120, 0.55)" : "rgba(220, 70, 70, 0.5)";
      glowRef.current = el.animate(
        [
          { boxShadow: "0 0 0 0 rgba(0,0,0,0)" },
          { boxShadow: `0 0 0 3px ${color}, 0 0 22px 4px ${color}` },
          { boxShadow: "0 0 0 0 rgba(0,0,0,0)" },
        ],
        { duration: 1100, easing: "ease-out", fill: "none" },
      );
    },
    [reduce],
  );

  const resetVisuals = useCallback(() => {
    glowRef.current?.cancel();
    glowRef.current = null;
    setDealer(null);
    setRoundKey((k) => k + 1);
  }, []);

  // Turn a settled round into the outcome card. A push (tie) returns the stake,
  // so it is a neutral zero-net outcome — never a green win nor a red loss.
  const reportSettlement = (r: {
    outcome?: string;
    payout?: number;
    balance?: number;
    playerTotal?: number;
    dealerTotal?: number;
  }): void => {
    onBalance(r.balance ?? balance ?? 0);
    const payout = r.payout ?? 0;
    const isPush = r.outcome === "push";
    const win = !isPush && payout > 0;
    const totals =
      r.playerTotal != null
        ? ` · ${r.playerTotal} vs ${r.dealerTotal ?? "?"}`
        : "";
    if (isPush) {
      const push: GameResult = {
        neutral: true,
        icon: "🤝",
        win: false,
        amount: 0,
        label: `Empate — recuperas tu apuesta${totals}`,
      };
      onResult(push);
      return;
    }
    pulseTable(win);
    onResult({
      win,
      amount: win ? payout : stake,
      label: `🃏 ${r.outcome ?? "blackjack"}${totals}`,
    });
  };

  const start = async () => {
    if (busyRef.current || betId) {
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    resetVisuals();
    try {
      const r = await blackjackStart(stake);
      setPlayer(r.player ?? []);
      setDealerUp(r.dealerUp ?? null);
      if (r.done) {
        setBetId(null);
        setDealer(r.dealer ?? (r.dealerUp != null ? [r.dealerUp] : null));
        reportSettlement(r);
        return;
      }
      setBetId(r.betId ?? null);
      // The stake is already debited on the deal — reflect it in the header.
      onBalance(r.balance ?? balance ?? 0);
    } catch (e) {
      setError(casinoErrorLabel(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const act = async (action: "hit" | "stand") => {
    if (!betId || busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await blackjackAction(betId, action);
      setPlayer(r.player);
      if (r.done) {
        setBetId(null);
        setDealer(r.dealer ?? (dealerUp != null ? [dealerUp] : null));
        reportSettlement(r);
      }
    } catch (e) {
      setError(casinoErrorLabel(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const settled = dealer != null;
  const playerTotal = handTotal(player);
  // The dealer total is only "true" once revealed; while playing we only know
  // the up-card, so we tween just that partial value.
  const dealerTotal = settled
    ? handTotal(dealer)
    : dealerUp != null
      ? handTotal([dealerUp])
      : 0;

  return (
    <div className="game">
      {betId != null || settled ? (
        <>
          <div
            ref={tableRef}
            style={{
              borderRadius: 14,
              padding: "12px 12px 14px",
              background:
                "linear-gradient(160deg, rgba(20,70,45,0.35), rgba(12,40,26,0.25))",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* Dealer row */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <p
                className="game-progress"
                style={{ margin: 0, display: "flex", gap: 8 }}
              >
                <span>Crupier</span>
                <strong>
                  {settled ? (
                    <TweenTotal value={dealerTotal} reduce={reduce} />
                  ) : dealerUp != null ? (
                    `${RANK(dealerUp)} + ?`
                  ) : (
                    "?"
                  )}
                </strong>
              </p>
              <div style={{ display: "flex", gap: 6, minHeight: 60 }}>
                {settled && dealer != null
                  ? dealer.map((r, i) => (
                      <PlayingCard
                        // biome-ignore lint/suspicious/noArrayIndexKey: card slot is positional within the round
                        key={`d-${roundKey}-${i}`}
                        rank={r}
                        suitIndex={i + 1}
                        index={i}
                        // The second dealt card was the face-down hole card.
                        flipUp={i === 1}
                        reduce={reduce}
                      />
                    ))
                  : dealerUp != null && (
                      <>
                        <PlayingCard
                          key={`du-${roundKey}`}
                          rank={dealerUp}
                          suitIndex={1}
                          index={0}
                          reduce={reduce}
                        />
                        <PlayingCard
                          key={`dh-${roundKey}`}
                          rank={null}
                          suitIndex={2}
                          faceDown
                          index={1}
                          reduce={reduce}
                        />
                      </>
                    )}
              </div>
            </div>

            {/* Player row */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <p
                className="game-progress"
                style={{ margin: 0, display: "flex", gap: 8 }}
              >
                <span>Tú</span>
                <strong
                  style={{
                    color:
                      playerTotal > 21
                        ? "#e06666"
                        : playerTotal === 21
                          ? "#39c878"
                          : undefined,
                  }}
                >
                  <TweenTotal value={playerTotal} reduce={reduce} />
                </strong>
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  minHeight: 60,
                  flexWrap: "wrap",
                }}
              >
                {player.map((r, i) => (
                  <PlayingCard
                    // biome-ignore lint/suspicious/noArrayIndexKey: card slot is positional within the round
                    key={`p-${roundKey}-${i}`}
                    rank={r}
                    suitIndex={i}
                    index={i}
                    reduce={reduce}
                  />
                ))}
              </div>
            </div>
          </div>

          {betId != null ? (
            <div className="casino-row">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => act("hit")}
              >
                Pedir
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => act("stand")}
              >
                Plantarse
              </Button>
            </div>
          ) : (
            <Button variant="gold" block disabled={busy} onClick={start}>
              Repartir de nuevo
            </Button>
          )}
        </>
      ) : (
        <>
          <BetControls stake={stake} setStake={setStake} balance={balance} />
          <Button variant="gold" block onClick={start}>
            Repartir
          </Button>
        </>
      )}
      {error && <Banner kind="error">{error}</Banner>}
    </div>
  );
}

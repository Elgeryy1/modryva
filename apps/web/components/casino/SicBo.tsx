"use client";

// Sic Bo — 3 dice (1..6). Simple bet-selector + "Tirar" button, no custom dice
// animation: the shared ResultCard already sells the win/loss/jackpot moment.
// Bet kinds: small (4-10, no triple), big (11-17, no triple), or a specific
// triple (pick 1-6). See modules/games/src/sicbo.ts for the house-edge math.

import { type JSX, useRef, useState } from "react";
import { casinoBet, casinoErrorLabel } from "../../lib/api";
import { Button, Field, Segmented } from "../ui";
import { BetControls, type CasinoGameProps } from "./shared";

const KINDS = [
  { value: "small", label: "Pequeña 4–10" },
  { value: "big", label: "Grande 11–17" },
  { value: "triple", label: "Trío" },
] as const;

type Kind = (typeof KINDS)[number]["value"];

const DIE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"] as const;
const dieFace = (n: number): string => DIE_FACES[n - 1] ?? "🎲";

const VALUES = [1, 2, 3, 4, 5, 6] as const;

export function SicBo({
  balance,
  onBalance,
  onResult,
}: CasinoGameProps): JSX.Element {
  const [stake, setStake] = useState(50);
  const [kind, setKind] = useState<Kind>("small");
  const [value, setValue] = useState<(typeof VALUES)[number]>(1);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [lastRoll, setLastRoll] = useState<{
    d1: number;
    d2: number;
    d3: number;
  } | null>(null);

  const play = async () => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const params = kind === "triple" ? { kind, value } : ({ kind } as const);
      const r = await casinoBet("sicbo", stake, params);
      onBalance(r.balance);
      // The API nests the dice under `detail.roll`; reading `detail.d1` directly
      // (the old bug) rendered "🎲🎲🎲 = NaN".
      const { roll: d } = r.detail as {
        roll: { d1: number; d2: number; d3: number };
      };
      setLastRoll(d);
      const win = r.payout > 0;
      const jackpotWon = r.jackpotWon ?? 0;
      const sum = d.d1 + d.d2 + d.d3;
      onResult({
        win,
        amount: win ? r.payout : stake,
        ...(win ? { multiplier: r.multiplier } : {}),
        label: `${dieFace(d.d1)}${dieFace(d.d2)}${dieFace(d.d3)} = ${sum}`,
        ...(jackpotWon > 0 ? { jackpotWon } : {}),
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
        aria-hidden="true"
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 10,
          padding: "18px 12px 20px",
          fontSize: 48,
          lineHeight: 1,
        }}
      >
        {lastRoll ? (
          <>
            <span>{dieFace(lastRoll.d1)}</span>
            <span>{dieFace(lastRoll.d2)}</span>
            <span>{dieFace(lastRoll.d3)}</span>
          </>
        ) : (
          <>
            <span>🎲</span>
            <span>🎲</span>
            <span>🎲</span>
          </>
        )}
      </div>

      <BetControls
        stake={stake}
        setStake={setStake}
        balance={balance}
        disabled={busy}
      />

      <Field label="Tipo de apuesta">
        <Segmented options={KINDS} value={kind} onChange={setKind} />
      </Field>

      {kind === "triple" && (
        <Field label="Número del trío">
          <Segmented
            options={VALUES.map((v) => ({
              value: String(v),
              label: String(v),
            }))}
            value={String(value)}
            onChange={(v) => setValue(Number(v) as (typeof VALUES)[number])}
          />
        </Field>
      )}

      <Button variant="gold" block disabled={busy} onClick={play}>
        {busy ? "Tirando…" : "Tirar"}
      </Button>
    </div>
  );
}

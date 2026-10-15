"use client";

// Hi-Lo — bet whether the next card's rank is higher or lower than the
// current one, drawn atomically in the same call. Simple text/emoji card
// display, no custom animation (see shared.tsx for the ResultCard).

import { type JSX, useRef, useState } from "react";
import { casinoBet, casinoErrorLabel } from "../../lib/api";
import { Button, Field, Segmented } from "../ui";
import { BetControls, type CasinoGameProps } from "./shared";

const RANK_LABEL: Record<number, string> = {
  1: "A",
  11: "J",
  12: "Q",
  13: "K",
};
const rankLabel = (rank: number): string => RANK_LABEL[rank] ?? String(rank);

type Kind = "higher" | "lower";

const KINDS = [
  { value: "higher", label: "⬆️ Alto" },
  { value: "lower", label: "⬇️ Bajo" },
] as const;

export function HiLo({
  balance,
  onBalance,
  onResult,
}: CasinoGameProps): JSX.Element {
  const [stake, setStake] = useState(50);
  const [kind, setKind] = useState<Kind>("higher");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [deal, setDeal] = useState<{ current: number; next: number } | null>(
    null,
  );

  const play = async () => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await casinoBet("hilo", stake, { kind });
      onBalance(r.balance);
      // The API nests the draw under `detail.deal` ({ current, next }); reading
      // `detail.current` directly (the old bug) rendered "undefined → undefined".
      const { deal: d } = r.detail as {
        deal: { current: number; next: number };
      };
      setDeal(d);
      const win = r.payout > 0;
      const jackpotWon = r.jackpotWon ?? 0;
      onResult({
        win,
        amount: win ? r.payout : stake,
        label: `🃏 ${rankLabel(d.current)} → ${rankLabel(d.next)}`,
        ...(win ? { multiplier: r.multiplier } : {}),
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
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 16,
          padding: "12px 0 16px",
          fontSize: 40,
        }}
        aria-hidden="true"
      >
        <span>🃏 {deal ? rankLabel(deal.current) : "?"}</span>
        <span style={{ alignSelf: "center", fontSize: 20 }}>→</span>
        <span>🃏 {deal ? rankLabel(deal.next) : "?"}</span>
      </div>
      <BetControls
        stake={stake}
        setStake={setStake}
        balance={balance}
        disabled={busy}
      />
      <Field label="Predicción">
        <Segmented options={KINDS} value={kind} onChange={(k) => setKind(k)} />
      </Field>
      <Button variant="gold" block disabled={busy} onClick={play}>
        {busy ? "Repartiendo…" : "Jugar"}
      </Button>
    </div>
  );
}

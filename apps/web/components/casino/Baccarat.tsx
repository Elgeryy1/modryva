"use client";

// Baccarat (simplificado) — una carta cada lado (Banca vs Jugador), sin regla
// de tercera carta. Patrón simple igual que Roulette.tsx: selector de apuesta +
// BetControls + botón, sin animación elaborada (solo texto/emoji 🃏).

import { type JSX, useRef, useState } from "react";
import { casinoBet, casinoErrorLabel } from "../../lib/api";
import { Button, Field, Segmented } from "../ui";
import { BetControls, type CasinoGameProps } from "./shared";

const KINDS = [
  { value: "player", label: "Jugador" },
  { value: "banker", label: "Banca" },
  { value: "tie", label: "Empate" },
] as const;

type Kind = (typeof KINDS)[number]["value"];

export function Baccarat({
  balance,
  onBalance,
  onResult,
}: CasinoGameProps): JSX.Element {
  const [stake, setStake] = useState(50);
  const [kind, setKind] = useState<Kind>("player");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [deal, setDeal] = useState<{
    bancaValue: number;
    jugadorValue: number;
  } | null>(null);

  const play = async () => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await casinoBet("baccarat", stake, { kind });
      onBalance(r.balance);
      // The API nests the values under `detail.deal`; reading `detail.bancaValue`
      // directly (the old bug) rendered "Banca undefined vs Jugador undefined".
      const { deal: d } = r.detail as {
        deal: { bancaValue: number; jugadorValue: number };
      };
      setDeal(d);
      const win = r.payout > 0;
      const jackpotWon = r.jackpotWon ?? 0;
      onResult({
        win,
        amount: win ? r.payout : stake,
        label: `🃏 Banca ${d.bancaValue} vs Jugador ${d.jugadorValue}`,
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
        aria-hidden="true"
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 24,
          padding: "18px 12px 20px",
          borderRadius: "var(--radius-lg)",
          background: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Banca</div>
          <div style={{ fontSize: 40, lineHeight: 1, fontWeight: 800 }}>
            🃏 {deal ? deal.bancaValue : "?"}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Jugador</div>
          <div style={{ fontSize: 40, lineHeight: 1, fontWeight: 800 }}>
            🃏 {deal ? deal.jugadorValue : "?"}
          </div>
        </div>
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
        {busy ? "Repartiendo…" : "Repartir"}
      </Button>
    </div>
  );
}

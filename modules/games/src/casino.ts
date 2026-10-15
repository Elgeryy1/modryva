import type { TelegramUpdateEnvelope } from "@superbot/domain";
import type { DartTier } from "./bullseye.js";
import { fairFloat } from "./fairness.js";
import type { OverUnderPick } from "./over-under-seven.js";

// Economy + house constants. Fase 3 moves these into configurable env.
export const CASINO = {
  welcomeGrant: 1000,
  dailyBonus: 500,
  houseEdge: 0.02,
  minBet: 10,
  maxBet: 10_000,
  duelRake: 0.05,
} as const;

export type DiceSide = "bajo" | "alto";

export interface DiceDetail {
  readonly roll: number; // 0.00 .. 99.99
  readonly side: DiceSide;
  readonly target: number;
  readonly win: boolean;
}

/**
 * Payout multiplier (× stake) for a dice bet. Derived from the win chance with a
 * fixed house edge: multiplier = (100 / winChance%) × (1 − edge). Returns 0 for
 * impossible targets. Only applied on a win; a loss is always 0.
 */
export const diceMultiplier = (
  side: DiceSide,
  target: number,
  edge = CASINO.houseEdge,
): number => {
  const chancePct = side === "bajo" ? target : 100 - target;
  if (chancePct <= 0 || chancePct >= 100) {
    return 0;
  }
  return Math.round((100 / chancePct) * (1 - edge) * 100) / 100;
};

/**
 * Provably-fair dice: a roll in [0, 100) from (serverSeed, clientSeed, nonce).
 * "bajo N" wins when roll < N; "alto N" wins when roll ≥ N.
 */
export const resolveDice = (
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  side: DiceSide,
  target: number,
  edge = CASINO.houseEdge,
): { multiplier: number; detail: DiceDetail } => {
  const roll =
    Math.floor(fairFloat(serverSeed, clientSeed, nonce) * 10_000) / 100;
  const win = side === "bajo" ? roll < target : roll >= target;
  return {
    multiplier: win ? diceMultiplier(side, target, edge) : 0,
    detail: { roll, side, target, win },
  };
};

// --- Command parsing ---

export type CasinoCommand =
  | { readonly kind: "wallet" }
  | { readonly kind: "daily" }
  | { readonly kind: "verify" }
  | { readonly kind: "help" }
  | {
      readonly kind: "dice";
      readonly stake: number;
      readonly side: DiceSide;
      readonly target: number;
    }
  | { readonly kind: "slot"; readonly stake: number }
  | {
      readonly kind: "overunder";
      readonly stake: number;
      readonly pick: OverUnderPick;
    }
  | {
      readonly kind: "bullseye";
      readonly stake: number;
      readonly tier: DartTier;
    }
  | { readonly kind: "duel"; readonly stake: number }
  | { readonly kind: "level" }
  | { readonly kind: "cashback" }
  | { readonly kind: "rescue" }
  | { readonly kind: "gift"; readonly amount: number }
  | { readonly kind: "buy"; readonly pack: string };

/** Telegram Stars chip packs (inbound-only; chips are non-cashable). */
export const CHIP_PACKS: Record<
  string,
  { chips: number; stars: number; label: string }
> = {
  s: { chips: 5_000, stars: 50, label: "5.000 fichas" },
  m: { chips: 15_000, stars: 120, label: "15.000 fichas" },
  l: { chips: 50_000, stars: 350, label: "50.000 fichas" },
};

export interface CasinoCommandError {
  readonly usage: string;
}

export type CasinoCommandResult =
  | { readonly ok: true; readonly command: CasinoCommand }
  | { readonly ok: false; readonly error: CasinoCommandError };

const WALLET_NAMES: ReadonlySet<string> = new Set([
  "wallet",
  "cartera",
  "saldo",
  "fichas",
]);
const DAILY_NAMES: ReadonlySet<string> = new Set(["daily", "bono", "diario"]);
const DICE_NAMES: ReadonlySet<string> = new Set(["dado", "apostar"]);
const VERIFY_NAMES: ReadonlySet<string> = new Set(["verificar", "verify"]);
const HELP_NAMES: ReadonlySet<string> = new Set(["casino"]);
const SLOT_NAMES: ReadonlySet<string> = new Set(["tragaperras", "slot"]);
const OVERUNDER_NAMES: ReadonlySet<string> = new Set(["mm", "overunder"]);
const BULLSEYE_NAMES: ReadonlySet<string> = new Set(["diana", "dardos"]);
const DUEL_NAMES: ReadonlySet<string> = new Set(["duelo", "duel", "reto"]);
const LEVEL_NAMES: ReadonlySet<string> = new Set(["nivel", "level", "vip"]);
const CASHBACK_NAMES: ReadonlySet<string> = new Set(["cashback", "rakeback"]);
const RESCUE_NAMES: ReadonlySet<string> = new Set([
  "rescate",
  "rescue",
  "socorro",
]);
const GIFT_NAMES: ReadonlySet<string> = new Set(["regalar", "regalo", "gift"]);
// NOTE: no "buy" alias — it collides with the existing /buy <product> payment command.
const BUY_NAMES: ReadonlySet<string> = new Set(["comprar", "tienda", "shop"]);

/** VIP tier + level derived purely from total chips ever wagered. */
export const walletLevel = (
  wagered: number,
): { level: number; tier: string; next: number } => {
  const level = Math.floor(Math.sqrt(Math.max(0, wagered) / 500));
  const tier =
    level >= 30
      ? "💎 Diamante"
      : level >= 15
        ? "🥇 Oro"
        : level >= 5
          ? "🥈 Plata"
          : "🥉 Bronce";
  // Chips still needed to reach the next level.
  const next = Math.max(0, (level + 1) ** 2 * 500 - wagered);
  return { level, tier, next };
};

const diceUsage =
  "Uso: /dado <apuesta> [bajo|alto] [objetivo 1-99] — ej: /dado 100 bajo 50";
const slotUsage = "Uso: /tragaperras <apuesta> — ej: /tragaperras 100";
const overUnderUsage =
  "Uso: /mm <apuesta> <bajo|siete|alto> — ej: /mm 100 bajo";
const bullseyeUsage =
  "Uso: /diana <apuesta> <fuera|aro|diana> — ej: /diana 100 diana";
const duelUsage =
  "Uso: /duelo <apuesta> — reta a otro jugador (ej: /duelo 200)";

const parseStake = (raw: string | undefined): number | null => {
  const stake = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(stake) && stake > 0 ? stake : null;
};

export const parseCasinoCommand = (
  update: TelegramUpdateEnvelope,
): CasinoCommandResult | null => {
  const name = update.command?.name;
  if (!name) {
    return null;
  }
  if (WALLET_NAMES.has(name)) {
    return { ok: true, command: { kind: "wallet" } };
  }
  if (DAILY_NAMES.has(name)) {
    return { ok: true, command: { kind: "daily" } };
  }
  if (VERIFY_NAMES.has(name)) {
    return { ok: true, command: { kind: "verify" } };
  }
  if (HELP_NAMES.has(name)) {
    return { ok: true, command: { kind: "help" } };
  }
  if (LEVEL_NAMES.has(name)) {
    return { ok: true, command: { kind: "level" } };
  }
  if (CASHBACK_NAMES.has(name)) {
    return { ok: true, command: { kind: "cashback" } };
  }
  if (RESCUE_NAMES.has(name)) {
    return { ok: true, command: { kind: "rescue" } };
  }
  if (GIFT_NAMES.has(name)) {
    const amount = parseStake((update.command?.args ?? [])[0]);
    return amount === null
      ? {
          ok: false,
          error: {
            usage: "Responde al mensaje de alguien con /regalar <cantidad>",
          },
        }
      : { ok: true, command: { kind: "gift", amount } };
  }
  if (BUY_NAMES.has(name)) {
    const pack = ((update.command?.args ?? [])[0] ?? "").toLowerCase();
    return { ok: true, command: { kind: "buy", pack } };
  }
  if (SLOT_NAMES.has(name)) {
    const stake = parseStake((update.command?.args ?? [])[0]);
    return stake === null
      ? { ok: false, error: { usage: slotUsage } }
      : { ok: true, command: { kind: "slot", stake } };
  }
  if (OVERUNDER_NAMES.has(name)) {
    const args = update.command?.args ?? [];
    const stake = parseStake(args[0]);
    const pick = (args[1] ?? "").toLowerCase();
    if (
      stake === null ||
      (pick !== "bajo" && pick !== "siete" && pick !== "alto")
    ) {
      return { ok: false, error: { usage: overUnderUsage } };
    }
    return {
      ok: true,
      command: { kind: "overunder", stake, pick: pick as OverUnderPick },
    };
  }
  if (BULLSEYE_NAMES.has(name)) {
    const args = update.command?.args ?? [];
    const stake = parseStake(args[0]);
    const tier = (args[1] ?? "").toLowerCase();
    if (
      stake === null ||
      (tier !== "fuera" && tier !== "aro" && tier !== "diana")
    ) {
      return { ok: false, error: { usage: bullseyeUsage } };
    }
    return {
      ok: true,
      command: { kind: "bullseye", stake, tier: tier as DartTier },
    };
  }
  if (DUEL_NAMES.has(name)) {
    const stake = parseStake((update.command?.args ?? [])[0]);
    return stake === null
      ? { ok: false, error: { usage: duelUsage } }
      : { ok: true, command: { kind: "duel", stake } };
  }
  if (!DICE_NAMES.has(name)) {
    return null;
  }

  const args = update.command?.args ?? [];
  const stake = Number.parseInt(args[0] ?? "", 10);
  if (!Number.isInteger(stake) || stake <= 0) {
    return { ok: false, error: { usage: diceUsage } };
  }
  const side: DiceSide =
    (args[1] ?? "").toLowerCase() === "alto" ? "alto" : "bajo";
  const target = args[2] !== undefined ? Number.parseInt(args[2], 10) : 50;
  if (!Number.isInteger(target) || target < 1 || target > 99) {
    return { ok: false, error: { usage: diceUsage } };
  }
  return { ok: true, command: { kind: "dice", stake, side, target } };
};

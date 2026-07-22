import { createHash, createHmac, randomBytes } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

// Allowed chip-ledger reasons. This is a CLOSED union on purpose: there is no
// "withdraw" / "cashout" reason, so chips can never leave as value. TypeScript
// rejects any such reason at compile time — the load-bearing legal invariant that
// keeps this a social casino (virtual, non-cashable) rather than gambling.
export const CHIP_REASONS = [
  "welcome",
  "daily",
  "bet",
  "win",
  "purchase",
  "refund",
  "jackpot",
  "bonus",
  "rakeback",
  "gift",
  "tournament",
] as const;
export type ChipReason = (typeof CHIP_REASONS)[number];

const newServerSeed = (): string => randomBytes(32).toString("hex");
const newClientSeed = (): string => randomBytes(8).toString("hex");
const commitOf = (seed: string): string =>
  createHash("sha256").update(seed).digest("hex");

// --- Progressive jackpot tuning (fed by a rake on every bet) ---
const JACKPOT_RAKE = 0.01; // 1% of each stake feeds the pot
const JACKPOT_ODDS = 4000; // ~1 in 4000 bets wins the whole pot
const JACKPOT_SEED = 200; // pot floor: created at / reset to this after a win
const JACKPOT_MIN_AWARD = 500; // never award a trivially small pot

/** Provably-fair jackpot roll in [0,1), from the same seed triple as the bet. */
const jackpotRoll = (
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): number => {
  const hex = createHmac("sha256", serverSeed)
    .update(`jackpot:${clientSeed}:${nonce}`)
    .digest("hex")
    .slice(0, 13);
  return Number.parseInt(hex, 16) / 2 ** 52;
};

const toJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

// --- Weekly tournament tuning + ISO-week helpers ---
// Reasons that count as pure casino P&L for leaderboard/tournament scoring.
// Excludes jackpot/daily/purchase/gift/etc. so the ranking is skill+luck at the
// tables, not a proxy for who topped up the most Stars.
const NET_REASONS = ["bet", "win"] as const;
const TOURNAMENT_SEED = 1000; // starting prize pool for a fresh weekly tournament
const TOURNAMENT_SPLIT = [0.6, 0.3, 0.1] as const; // top-3 payout shares
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** UTC Monday 00:00 of the ISO week containing `at` (default: now). */
const startOfIsoWeek = (at: Date = new Date()): Date => {
  const d = new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()),
  );
  // getUTCDay: Sun=0..Sat=6 -> days since Monday (Mon=0 .. Sun=6).
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d;
};

/** ISO-week label "YYYY-Www" for the week containing `at`. */
const isoWeekLabel = (at: Date = new Date()): string => {
  // ISO 8601: the week's Thursday determines its year and week number.
  const start = startOfIsoWeek(at);
  const thursday = new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000);
  const year = thursday.getUTCFullYear();
  const firstThursday = (() => {
    const jan4 = new Date(Date.UTC(year, 0, 4));
    return new Date(startOfIsoWeek(jan4).getTime() + 3 * 24 * 60 * 60 * 1000);
  })();
  const week =
    1 + Math.round((thursday.getTime() - firstThursday.getTime()) / WEEK_MS);
  return `${year}-W${String(week).padStart(2, "0")}`;
};

/** The current ISO week as [start, end) + its label. */
const currentIsoWeek = (
  at: Date = new Date(),
): { period: string; startsAt: Date; endsAt: Date } => {
  const startsAt = startOfIsoWeek(at);
  return {
    period: isoWeekLabel(at),
    startsAt,
    endsAt: new Date(startsAt.getTime() + WEEK_MS),
  };
};

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

interface TournamentWinner {
  readonly telegramUserId: string;
  readonly prize: number;
  readonly net: number;
}

/** Defensive parse of Tournament.winners (Json?) back into typed rows — used
 *  only when RESUMING a settled-but-unpaid tournament after a crash. */
const parseWinners = (value: Prisma.JsonValue | null): TournamentWinner[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): TournamentWinner[] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    if (
      typeof record.telegramUserId !== "string" ||
      typeof record.prize !== "number"
    ) {
      return [];
    }
    return [
      {
        telegramUserId: record.telegramUserId,
        prize: record.prize,
        net: typeof record.net === "number" ? record.net : 0,
      },
    ];
  });
};

/** Public wallet view — NEVER exposes the secret serverSeed. */
export interface WalletState {
  readonly balance: number;
  /** Published commit = sha256(serverSeed), shown BEFORE any bet. */
  readonly serverSeedHash: string;
  readonly clientSeed: string;
  readonly nonce: number;
}

export interface BetOutcome {
  readonly ok: boolean;
  readonly error?: "insufficient";
  readonly balance: number;
  readonly stake: number;
  readonly multiplier: number;
  readonly payout: number;
  /** The nonce used for this bet (for provably-fair verification). */
  readonly nonce: number;
  readonly serverSeedHash: string;
  readonly clientSeed: string;
  /** Game-specific display data (the dice roll, slot reels, plinko path, ...). */
  readonly detail?: unknown;
  /** Chips awarded by the progressive jackpot on this bet (0 = not hit). */
  readonly jackpotWon?: number;
  /** The jackpot pot AFTER this bet (post-rake, post-award). */
  readonly jackpot?: number;
}

/**
 * Pure payout resolver. Given the secret serverSeed + public clientSeed + nonce
 * it returns the payout multiplier (0 = loss). The seed is passed in by the
 * repository and never leaves it, so the game math stays server-authoritative
 * while remaining verifiable after the seed is revealed.
 */
export type BetResolver = (
  serverSeed: string,
  clientSeed: string,
  nonce: number,
) => { multiplier: number; detail?: unknown };

export type DuelClaimResult =
  | {
      readonly status: "ok";
      readonly stake: number;
      readonly challengerId: bigint;
      readonly challengerName: string | null;
    }
  | { readonly status: "gone" | "self" | "insufficient" };

export interface DuelSettleResult {
  readonly tie: boolean;
  readonly challengerId: bigint;
  readonly opponentId: bigint;
  readonly stake: number;
  readonly winnerId: bigint | null;
  readonly payout: number;
}

/** A duel stuck in 'rolling' past the recovery threshold — claimDuel
 *  debited the opponent and flipped status, but settleDuel never ran. */
export interface StaleDuel {
  readonly id: string;
  readonly tenantId: string;
  readonly chatId: string;
  readonly stake: number;
  readonly challengerId: bigint;
  readonly challengerName: string | null;
  readonly opponentId: bigint;
  readonly claimedAt: Date;
}

/** A persisted multi-step casino bet (crash / mines / blackjack). */
export interface CasinoBetRecord {
  readonly id: string;
  readonly game: string;
  readonly stake: number;
  readonly status: string;
  readonly serverSeed: string;
  readonly serverSeedHash: string;
  readonly clientSeed: string;
  readonly nonce: number;
  readonly state: unknown;
  readonly payout: number;
}

export interface StartCasinoBetInput {
  readonly tenantId: string;
  readonly telegramUserId: bigint;
  readonly game: string;
  readonly stake: number;
  readonly serverSeed: string;
  readonly serverSeedHash: string;
  readonly clientSeed: string;
  readonly nonce: number;
  readonly state: unknown;
}

/** One row of a net-chips ranking (leaderboard or tournament standings). */
export interface NetStanding {
  readonly telegramUserId: string;
  readonly net: number;
}

/** Current tournament view: the open week + its live standings (+ caller rank). */
export interface TournamentState {
  readonly period: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly prizePool: number;
  readonly standings: NetStanding[];
  readonly you?: { readonly rank: number; readonly net: number } | null;
}

export interface ChipRepository {
  ensureWallet(
    tenantId: string,
    telegramUserId: bigint,
    welcomeGrant: number,
  ): Promise<WalletState>;
  getWallet(
    tenantId: string,
    telegramUserId: bigint,
  ): Promise<WalletState | null>;
  /**
   * Atomic stake debit for games whose outcome comes from an EXTERNAL roll (the
   * native Telegram dice), settled by a later credit(). count===0 => insufficient.
   */
  debit(
    tenantId: string,
    telegramUserId: bigint,
    stake: number,
    betId: string,
  ): Promise<{ ok: boolean; balance: number }>;
  placeBet(input: {
    tenantId: string;
    telegramUserId: bigint;
    stake: number;
    betId: string;
    resolve: BetResolver;
  }): Promise<BetOutcome>;
  claimDaily(
    tenantId: string,
    telegramUserId: bigint,
    day: string,
    amount: number,
  ): Promise<{ ok: boolean; amount: number; balance: number }>;
  credit(
    tenantId: string,
    telegramUserId: bigint,
    amount: number,
    reason: ChipReason,
    refId?: string,
  ): Promise<number>;
  rotateSeed(
    tenantId: string,
    telegramUserId: bigint,
    clientSeed?: string,
  ): Promise<{
    revealedServerSeed: string;
    serverSeedHash: string;
    clientSeed: string;
  }>;
  openDuel(input: {
    tenantId: string;
    chatId: string;
    challengerId: bigint;
    challengerName: string | null;
    stake: number;
  }): Promise<{ ok: boolean; duelId: string | null; balance: number }>;
  claimDuel(
    tenantId: string,
    duelId: string,
    opponentId: bigint,
  ): Promise<DuelClaimResult>;
  settleDuel(
    tenantId: string,
    duelId: string,
    winner: 0 | 1 | 2,
    rake: number,
  ): Promise<DuelSettleResult | null>;
  /** Recovery for duels wedged in 'rolling' (see StaleDuel). Used by the
   *  casino.duel.expire worker job, not by the live request handler. */
  listStaleRollingDuels(cutoff: Date, limit?: number): Promise<StaleDuel[]>;
  cancelDuel(
    tenantId: string,
    duelId: string,
    byUserId: bigint,
  ): Promise<{ ok: boolean; balance: number }>;
  startCasinoBet(
    input: StartCasinoBetInput,
  ): Promise<{ ok: boolean; betId: string | null; balance: number }>;
  getCasinoBet(
    tenantId: string,
    betId: string,
    telegramUserId: bigint,
  ): Promise<CasinoBetRecord | null>;
  /** The user's most recent still-open bet for a game, if any — used to
   * reconcile a hand abandoned mid-round before a new one may start. */
  findOpenCasinoBet(
    tenantId: string,
    telegramUserId: bigint,
    game: string,
  ): Promise<CasinoBetRecord | null>;
  updateCasinoBetState(
    tenantId: string,
    betId: string,
    telegramUserId: bigint,
    state: unknown,
  ): Promise<void>;
  settleCasinoBet(
    tenantId: string,
    betId: string,
    telegramUserId: bigint,
    payout: number,
    state: unknown,
  ): Promise<{ ok: boolean; balance: number }>;
  /** Total chips ever staked (for XP/level), derived from the ledger. */
  totalWagered(tenantId: string, telegramUserId: bigint): Promise<number>;
  /** Net game result (bet+win+refund) since a date — negative means net losses. */
  netSince(
    tenantId: string,
    telegramUserId: bigint,
    since: Date,
  ): Promise<number>;
  /** Idempotent weekly cashback credit (one per weekKey). */
  claimCashback(
    tenantId: string,
    telegramUserId: bigint,
    weekKey: string,
    amount: number,
  ): Promise<{ ok: boolean; balance: number }>;
  /** Anti-churn rescue: grant chips only if broke, idempotent per cooldown bucket. */
  claimRescue(
    tenantId: string,
    telegramUserId: bigint,
    bucketKey: string,
    amount: number,
    maxBalance: number,
  ): Promise<{
    ok: boolean;
    balance: number;
    reason: "granted" | "not-broke" | "cooldown";
  }>;
  /** Atomic gift transfer between two players (creates the receiver wallet). */
  transfer(
    tenantId: string,
    fromId: bigint,
    toId: bigint,
    amount: number,
    refId: string,
  ): Promise<{
    ok: boolean;
    error?: "insufficient" | "self";
    fromBalance: number;
  }>;
  /** Credits chips bought with Telegram Stars, exactly once per chargeId. */
  creditPurchase(
    tenantId: string,
    telegramUserId: bigint,
    chargeId: string,
    amount: number,
  ): Promise<{ ok: boolean; balance: number }>;
  /** Current progressive jackpot pot for the tenant (seed floor if unseeded). */
  getJackpot(tenantId: string): Promise<number>;
  /** Top players by net chips (bet+win) — all-time or the current ISO week. */
  leaderboard(
    tenantId: string,
    opts?: { range?: "week" | "all"; limit?: number },
  ): Promise<NetStanding[]>;
  /**
   * Ensures the current weekly tournament exists, lazily settles any ended-but-
   * open tournaments (paying top-3 from the prize pool), and returns the live
   * standings for the current week (plus the caller's rank when `userId` given).
   */
  tournamentState(tenantId: string, userId?: bigint): Promise<TournamentState>;
}

type WalletRow = {
  balance: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
};

const toState = (row: WalletRow): WalletState => ({
  balance: row.balance,
  serverSeedHash: row.serverSeedHash,
  clientSeed: row.clientSeed,
  nonce: row.nonce,
});

export class PrismaChipRepository implements ChipRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async ensureWallet(
    tenantId: string,
    telegramUserId: bigint,
    welcomeGrant: number,
  ): Promise<WalletState> {
    const key = { tenantId_telegramUserId: { tenantId, telegramUserId } };
    const existing = await this.client.chipWallet.findUnique({ where: key });
    if (existing) {
      return toState(existing);
    }
    const serverSeed = newServerSeed();
    try {
      const created = await this.client.$transaction(async (tx) => {
        const wallet = await tx.chipWallet.create({
          data: {
            tenantId,
            telegramUserId,
            balance: Math.max(0, welcomeGrant),
            serverSeed,
            serverSeedHash: commitOf(serverSeed),
            clientSeed: newClientSeed(),
            nonce: 0,
          },
        });
        if (welcomeGrant > 0) {
          await tx.chipLedger.create({
            data: {
              tenantId,
              telegramUserId,
              delta: welcomeGrant,
              reason: "welcome",
            },
          });
        }
        return wallet;
      });
      return toState(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const wallet = await this.client.chipWallet.findUniqueOrThrow({
          where: key,
        });
        return toState(wallet);
      }
      throw error;
    }
  }

  async getWallet(
    tenantId: string,
    telegramUserId: bigint,
  ): Promise<WalletState | null> {
    const wallet = await this.client.chipWallet.findUnique({
      where: { tenantId_telegramUserId: { tenantId, telegramUserId } },
    });
    return wallet ? toState(wallet) : null;
  }

  async debit(
    tenantId: string,
    telegramUserId: bigint,
    stake: number,
    betId: string,
  ): Promise<{ ok: boolean; balance: number }> {
    const key = { tenantId_telegramUserId: { tenantId, telegramUserId } };
    return this.client.$transaction(async (tx) => {
      const debited = await tx.chipWallet.updateMany({
        where: { tenantId, telegramUserId, balance: { gte: stake } },
        data: { balance: { decrement: stake } },
      });
      const wallet = await tx.chipWallet.findUnique({ where: key });
      if (!wallet || debited.count === 0) {
        return { ok: false, balance: wallet?.balance ?? 0 };
      }
      await tx.chipLedger.create({
        data: {
          tenantId,
          telegramUserId,
          delta: -stake,
          reason: "bet",
          refId: betId,
        },
      });
      return { ok: true, balance: wallet.balance };
    });
  }

  async placeBet({
    tenantId,
    telegramUserId,
    stake,
    betId,
    resolve,
  }: {
    tenantId: string;
    telegramUserId: bigint;
    stake: number;
    betId: string;
    resolve: BetResolver;
  }): Promise<BetOutcome> {
    const key = { tenantId_telegramUserId: { tenantId, telegramUserId } };
    return this.client.$transaction(async (tx) => {
      // Atomic conditional debit: the balance>=stake guard lives in the WHERE, so
      // a concurrent bet can never overdraw. count===0 => insufficient funds.
      const debited = await tx.chipWallet.updateMany({
        where: { tenantId, telegramUserId, balance: { gte: stake } },
        data: { balance: { decrement: stake }, nonce: { increment: 1 } },
      });
      const wallet = await tx.chipWallet.findUnique({ where: key });
      if (!wallet) {
        return {
          ok: false,
          error: "insufficient",
          balance: 0,
          stake,
          multiplier: 0,
          payout: 0,
          nonce: 0,
          serverSeedHash: "",
          clientSeed: "",
        } satisfies BetOutcome;
      }
      if (debited.count === 0) {
        return {
          ok: false,
          error: "insufficient",
          balance: wallet.balance,
          stake,
          multiplier: 0,
          payout: 0,
          nonce: wallet.nonce,
          serverSeedHash: wallet.serverSeedHash,
          clientSeed: wallet.clientSeed,
        } satisfies BetOutcome;
      }
      // wallet.nonce is the POST-increment value = this bet's nonce.
      const nonce = wallet.nonce;
      const resolved = resolve(wallet.serverSeed, wallet.clientSeed, nonce);
      const multiplier = Math.max(0, resolved.multiplier);
      const payout = Math.floor(stake * multiplier);
      await tx.chipLedger.create({
        data: {
          tenantId,
          telegramUserId,
          delta: -stake,
          reason: "bet",
          refId: betId,
        },
      });
      let balance = wallet.balance;
      if (payout > 0) {
        const credited = await tx.chipWallet.update({
          where: key,
          data: { balance: { increment: payout } },
        });
        balance = credited.balance;
        await tx.chipLedger.create({
          data: {
            tenantId,
            telegramUserId,
            delta: payout,
            reason: "win",
            refId: betId,
          },
        });
      }
      // Progressive jackpot: rake a slice of the stake into the pot, then a rare
      // provably-fair roll (same seed triple) may award the whole thing.
      const rake = Math.max(1, Math.floor(stake * JACKPOT_RAKE));
      const pot = await tx.jackpot.upsert({
        where: { tenantId },
        create: { tenantId, amount: JACKPOT_SEED + rake },
        update: { amount: { increment: rake } },
      });
      let jackpotWon = 0;
      let jackpot = pot.amount;
      if (
        pot.amount >= JACKPOT_MIN_AWARD &&
        jackpotRoll(wallet.serverSeed, wallet.clientSeed, nonce) <
          1 / JACKPOT_ODDS
      ) {
        jackpotWon = pot.amount;
        const reset = await tx.jackpot.update({
          where: { tenantId },
          data: { amount: JACKPOT_SEED },
        });
        jackpot = reset.amount;
        const won = await tx.chipWallet.update({
          where: key,
          data: { balance: { increment: jackpotWon } },
        });
        balance = won.balance;
        await tx.chipLedger.create({
          data: {
            tenantId,
            telegramUserId,
            delta: jackpotWon,
            reason: "jackpot",
            refId: betId,
          },
        });
      }
      return {
        ok: true,
        balance,
        stake,
        multiplier,
        payout,
        nonce,
        serverSeedHash: wallet.serverSeedHash,
        clientSeed: wallet.clientSeed,
        detail: resolved.detail,
        jackpotWon,
        jackpot,
      } satisfies BetOutcome;
    });
  }

  async claimDaily(
    tenantId: string,
    telegramUserId: bigint,
    day: string,
    amount: number,
  ): Promise<{ ok: boolean; amount: number; balance: number }> {
    const key = { tenantId_telegramUserId: { tenantId, telegramUserId } };
    try {
      const balance = await this.client.$transaction(async (tx) => {
        // Idempotent per (user, "daily", day) via the ledger composite unique.
        await tx.chipLedger.create({
          data: {
            tenantId,
            telegramUserId,
            delta: amount,
            reason: "daily",
            refId: day,
          },
        });
        const wallet = await tx.chipWallet.update({
          where: key,
          data: { balance: { increment: amount } },
        });
        return wallet.balance;
      });
      return { ok: true, amount, balance };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const wallet = await this.client.chipWallet.findUnique({ where: key });
        return { ok: false, amount: 0, balance: wallet?.balance ?? 0 };
      }
      throw error;
    }
  }

  async credit(
    tenantId: string,
    telegramUserId: bigint,
    amount: number,
    reason: ChipReason,
    refId?: string,
  ): Promise<number> {
    const key = { tenantId_telegramUserId: { tenantId, telegramUserId } };
    return this.client.$transaction(async (tx) => {
      await tx.chipLedger.create({
        data: {
          tenantId,
          telegramUserId,
          delta: amount,
          reason,
          ...(refId ? { refId } : {}),
        },
      });
      const wallet = await tx.chipWallet.update({
        where: key,
        data: { balance: { increment: amount } },
      });
      return wallet.balance;
    });
  }

  async rotateSeed(
    tenantId: string,
    telegramUserId: bigint,
    clientSeed?: string,
  ): Promise<{
    revealedServerSeed: string;
    serverSeedHash: string;
    clientSeed: string;
  }> {
    const key = { tenantId_telegramUserId: { tenantId, telegramUserId } };
    const wallet = await this.client.chipWallet.findUniqueOrThrow({
      where: key,
    });
    const serverSeed = newServerSeed();
    const serverSeedHash = commitOf(serverSeed);
    const nextClientSeed = clientSeed?.trim()
      ? clientSeed.trim().slice(0, 64)
      : newClientSeed();
    await this.client.chipWallet.update({
      where: key,
      data: {
        serverSeed,
        serverSeedHash,
        clientSeed: nextClientSeed,
        nonce: 0,
      },
    });
    return {
      revealedServerSeed: wallet.serverSeed,
      serverSeedHash,
      clientSeed: nextClientSeed,
    };
  }

  async openDuel({
    tenantId,
    chatId,
    challengerId,
    challengerName,
    stake,
  }: {
    tenantId: string;
    chatId: string;
    challengerId: bigint;
    challengerName: string | null;
    stake: number;
  }): Promise<{ ok: boolean; duelId: string | null; balance: number }> {
    const key = {
      tenantId_telegramUserId: { tenantId, telegramUserId: challengerId },
    };
    // Single atomic transaction: confirm funds, create the duel, and write the
    // debit ledger together. Previously the CasinoDuel row was created BEFORE a
    // separate debit transaction, with a best-effort delete only on the modeled
    // insufficient-funds path. If that debit transaction instead THREW (DB blip,
    // deadlock, dropped connection), the exception propagated out uncaught and
    // left an "open" duel whose stake was never debited — another player could
    // then claim/settle it and be paid a payout funded by nothing. Creating the
    // duel only after the stake is secured, inside the same transaction, makes an
    // orphaned payable duel impossible: any failure rolls the whole thing back,
    // and insufficient funds never create a duel at all.
    return this.client.$transaction(async (tx) => {
      const applied = await tx.chipWallet.updateMany({
        where: {
          tenantId,
          telegramUserId: challengerId,
          balance: { gte: stake },
        },
        data: { balance: { decrement: stake } },
      });
      const wallet = await tx.chipWallet.findUnique({ where: key });
      if (!wallet || applied.count === 0) {
        return { ok: false, duelId: null, balance: wallet?.balance ?? 0 };
      }
      const duel = await tx.casinoDuel.create({
        data: { tenantId, chatId, challengerId, challengerName, stake },
      });
      await tx.chipLedger.create({
        data: {
          tenantId,
          telegramUserId: challengerId,
          delta: -stake,
          reason: "bet",
          refId: duel.id,
        },
      });
      return { ok: true, duelId: duel.id, balance: wallet.balance };
    });
  }

  async claimDuel(
    tenantId: string,
    duelId: string,
    opponentId: bigint,
  ): Promise<DuelClaimResult> {
    return this.client.$transaction(async (tx) => {
      const duel = await tx.casinoDuel.findUnique({ where: { id: duelId } });
      if (!duel || duel.tenantId !== tenantId || duel.status !== "open") {
        return { status: "gone" };
      }
      if (duel.challengerId === opponentId) {
        return { status: "self" };
      }
      // Atomic claim: only the first opponent flips open -> rolling.
      const claimed = await tx.casinoDuel.updateMany({
        where: { id: duelId, status: "open" },
        data: { status: "rolling", opponentId },
      });
      if (claimed.count === 0) {
        return { status: "gone" };
      }
      const debited = await tx.chipWallet.updateMany({
        where: {
          tenantId,
          telegramUserId: opponentId,
          balance: { gte: duel.stake },
        },
        data: { balance: { decrement: duel.stake } },
      });
      if (debited.count === 0) {
        await tx.casinoDuel.updateMany({
          where: { id: duelId },
          data: { status: "open", opponentId: null },
        });
        return { status: "insufficient" };
      }
      await tx.chipLedger.create({
        data: {
          tenantId,
          telegramUserId: opponentId,
          delta: -duel.stake,
          reason: "bet",
          refId: duelId,
        },
      });
      return {
        status: "ok",
        stake: duel.stake,
        challengerId: duel.challengerId,
        challengerName: duel.challengerName,
      };
    });
  }

  async settleDuel(
    tenantId: string,
    duelId: string,
    winner: 0 | 1 | 2,
    rake: number,
  ): Promise<DuelSettleResult | null> {
    return this.client.$transaction(async (tx) => {
      const duel = await tx.casinoDuel.findUnique({ where: { id: duelId } });
      if (
        !duel ||
        duel.tenantId !== tenantId ||
        duel.status !== "rolling" ||
        duel.opponentId === null
      ) {
        return null;
      }
      const { stake, challengerId } = duel;
      const opponentId = duel.opponentId;
      const winnerId =
        winner === 0 ? null : winner === 1 ? challengerId : opponentId;

      // Atomically claim the rolling->settled transition BEFORE crediting any
      // wallet. Without this, two concurrent settlers (the live win-settle and
      // the worker's stale-duel refund) can both read status="rolling" under
      // READ COMMITTED and both credit. Their ChipLedger rows use different
      // reasons ("win" vs "refund"), so the (tenantId,userId,reason,refId)
      // unique does NOT stop the double-pay — only this counted claim does.
      // Mirrors settleCasinoBet; every other money mutator already does this.
      const claimed = await tx.casinoDuel.updateMany({
        where: { id: duelId, tenantId, status: "rolling" },
        data: { status: "settled", winnerId },
      });
      if (claimed.count === 0) {
        return null;
      }

      const creditTx = async (
        uid: bigint,
        amount: number,
        reason: ChipReason,
      ) => {
        await tx.chipWallet.update({
          where: { tenantId_telegramUserId: { tenantId, telegramUserId: uid } },
          data: { balance: { increment: amount } },
        });
        await tx.chipLedger.create({
          data: {
            tenantId,
            telegramUserId: uid,
            delta: amount,
            reason,
            refId: duelId,
          },
        });
      };
      if (winner === 0) {
        await creditTx(challengerId, stake, "refund");
        await creditTx(opponentId, stake, "refund");
        return {
          tie: true,
          challengerId,
          opponentId,
          stake,
          winnerId: null,
          payout: 0,
        };
      }
      const winnerUserId = winner === 1 ? challengerId : opponentId;
      const payout = Math.floor(stake * 2 * (1 - rake));
      await creditTx(winnerUserId, payout, "win");
      return {
        tie: false,
        challengerId,
        opponentId,
        stake,
        winnerId: winnerUserId,
        payout,
      };
    });
  }

  async listStaleRollingDuels(cutoff: Date, limit = 50): Promise<StaleDuel[]> {
    const rolling = await this.client.casinoDuel.findMany({
      where: { status: "rolling" },
      take: limit,
    });
    const stale: StaleDuel[] = [];
    for (const duel of rolling) {
      if (duel.opponentId === null) continue; // defensive; claimDuel always sets it alongside status
      const claimLedger = await this.client.chipLedger.findFirst({
        where: {
          tenantId: duel.tenantId,
          telegramUserId: duel.opponentId,
          reason: "bet",
          refId: duel.id,
        },
      });
      // Missing row should be impossible (same tx that flips to 'rolling'
      // writes it) — if it's ever missing, skip rather than guess; it'll be
      // picked up next tick once/if it appears, and never blocks the sweep
      // of other duels.
      if (!claimLedger || claimLedger.createdAt > cutoff) continue;
      stale.push({
        id: duel.id,
        tenantId: duel.tenantId,
        chatId: duel.chatId,
        stake: duel.stake,
        challengerId: duel.challengerId,
        challengerName: duel.challengerName,
        opponentId: duel.opponentId,
        claimedAt: claimLedger.createdAt,
      });
    }
    return stale;
  }

  async cancelDuel(
    tenantId: string,
    duelId: string,
    byUserId: bigint,
  ): Promise<{ ok: boolean; balance: number }> {
    const key = {
      tenantId_telegramUserId: { tenantId, telegramUserId: byUserId },
    };
    return this.client.$transaction(async (tx) => {
      const duel = await tx.casinoDuel.findUnique({ where: { id: duelId } });
      const wallet = await tx.chipWallet.findUnique({ where: key });
      if (
        !duel ||
        duel.tenantId !== tenantId ||
        duel.status !== "open" ||
        duel.challengerId !== byUserId
      ) {
        return { ok: false, balance: wallet?.balance ?? 0 };
      }
      const cancelled = await tx.casinoDuel.updateMany({
        where: { id: duelId, status: "open" },
        data: { status: "cancelled" },
      });
      if (cancelled.count === 0) {
        return { ok: false, balance: wallet?.balance ?? 0 };
      }
      const updated = await tx.chipWallet.update({
        where: key,
        data: { balance: { increment: duel.stake } },
      });
      await tx.chipLedger.create({
        data: {
          tenantId,
          telegramUserId: byUserId,
          delta: duel.stake,
          reason: "refund",
          refId: duelId,
        },
      });
      return { ok: true, balance: updated.balance };
    });
  }

  async startCasinoBet(
    input: StartCasinoBetInput,
  ): Promise<{ ok: boolean; betId: string | null; balance: number }> {
    const { tenantId, telegramUserId, stake } = input;
    const key = { tenantId_telegramUserId: { tenantId, telegramUserId } };
    return this.client.$transaction(async (tx) => {
      const debited = await tx.chipWallet.updateMany({
        where: { tenantId, telegramUserId, balance: { gte: stake } },
        data: { balance: { decrement: stake } },
      });
      const wallet = await tx.chipWallet.findUnique({ where: key });
      if (!wallet || debited.count === 0) {
        return { ok: false, betId: null, balance: wallet?.balance ?? 0 };
      }
      const bet = await tx.casinoBet.create({
        data: {
          tenantId,
          telegramUserId,
          game: input.game,
          stake,
          serverSeed: input.serverSeed,
          serverSeedHash: input.serverSeedHash,
          clientSeed: input.clientSeed,
          nonce: input.nonce,
          state: toJson(input.state),
        },
      });
      await tx.chipLedger.create({
        data: {
          tenantId,
          telegramUserId,
          delta: -stake,
          reason: "bet",
          refId: bet.id,
        },
      });
      return { ok: true, betId: bet.id, balance: wallet.balance };
    });
  }

  async getCasinoBet(
    tenantId: string,
    betId: string,
    telegramUserId: bigint,
  ): Promise<CasinoBetRecord | null> {
    const bet = await this.client.casinoBet.findUnique({
      where: { id: betId },
    });
    if (
      !bet ||
      bet.tenantId !== tenantId ||
      bet.telegramUserId !== telegramUserId
    ) {
      return null;
    }
    return {
      id: bet.id,
      game: bet.game,
      stake: bet.stake,
      status: bet.status,
      serverSeed: bet.serverSeed,
      serverSeedHash: bet.serverSeedHash,
      clientSeed: bet.clientSeed,
      nonce: bet.nonce,
      state: bet.state,
      payout: bet.payout,
    };
  }

  async findOpenCasinoBet(
    tenantId: string,
    telegramUserId: bigint,
    game: string,
  ): Promise<CasinoBetRecord | null> {
    const bet = await this.client.casinoBet.findFirst({
      where: { tenantId, telegramUserId, game, status: "open" },
      orderBy: { createdAt: "desc" },
    });
    if (!bet) {
      return null;
    }
    return {
      id: bet.id,
      game: bet.game,
      stake: bet.stake,
      status: bet.status,
      serverSeed: bet.serverSeed,
      serverSeedHash: bet.serverSeedHash,
      clientSeed: bet.clientSeed,
      nonce: bet.nonce,
      state: bet.state,
      payout: bet.payout,
    };
  }

  async updateCasinoBetState(
    tenantId: string,
    betId: string,
    telegramUserId: bigint,
    state: unknown,
  ): Promise<void> {
    await this.client.casinoBet.updateMany({
      where: { id: betId, tenantId, telegramUserId, status: "open" },
      data: { state: toJson(state) },
    });
  }

  async settleCasinoBet(
    tenantId: string,
    betId: string,
    telegramUserId: bigint,
    payout: number,
    state: unknown,
  ): Promise<{ ok: boolean; balance: number }> {
    const key = { tenantId_telegramUserId: { tenantId, telegramUserId } };
    return this.client.$transaction(async (tx) => {
      // One-settle-per-bet: only an open bet flips to settled.
      const closed = await tx.casinoBet.updateMany({
        where: { id: betId, tenantId, telegramUserId, status: "open" },
        data: { status: "settled", payout, state: toJson(state) },
      });
      if (closed.count === 0) {
        const wallet = await tx.chipWallet.findUnique({ where: key });
        return { ok: false, balance: wallet?.balance ?? 0 };
      }
      if (payout > 0) {
        const wallet = await tx.chipWallet.update({
          where: key,
          data: { balance: { increment: payout } },
        });
        await tx.chipLedger.create({
          data: {
            tenantId,
            telegramUserId,
            delta: payout,
            reason: "win",
            refId: betId,
          },
        });
        return { ok: true, balance: wallet.balance };
      }
      const wallet = await tx.chipWallet.findUnique({ where: key });
      return { ok: true, balance: wallet?.balance ?? 0 };
    });
  }

  async totalWagered(
    tenantId: string,
    telegramUserId: bigint,
  ): Promise<number> {
    const agg = await this.client.chipLedger.aggregate({
      where: { tenantId, telegramUserId, reason: "bet" },
      _sum: { delta: true },
    });
    return Math.abs(agg._sum.delta ?? 0);
  }

  async netSince(
    tenantId: string,
    telegramUserId: bigint,
    since: Date,
  ): Promise<number> {
    const agg = await this.client.chipLedger.aggregate({
      where: {
        tenantId,
        telegramUserId,
        reason: { in: ["bet", "win", "refund"] },
        createdAt: { gte: since },
      },
      _sum: { delta: true },
    });
    return agg._sum.delta ?? 0;
  }

  async claimCashback(
    tenantId: string,
    telegramUserId: bigint,
    weekKey: string,
    amount: number,
  ): Promise<{ ok: boolean; balance: number }> {
    const key = { tenantId_telegramUserId: { tenantId, telegramUserId } };
    try {
      const balance = await this.client.$transaction(async (tx) => {
        await tx.chipLedger.create({
          data: {
            tenantId,
            telegramUserId,
            delta: amount,
            reason: "rakeback",
            refId: weekKey,
          },
        });
        const wallet = await tx.chipWallet.update({
          where: key,
          data: { balance: { increment: amount } },
        });
        return wallet.balance;
      });
      return { ok: true, balance };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const wallet = await this.client.chipWallet.findUnique({ where: key });
        return { ok: false, balance: wallet?.balance ?? 0 };
      }
      throw error;
    }
  }

  async claimRescue(
    tenantId: string,
    telegramUserId: bigint,
    bucketKey: string,
    amount: number,
    maxBalance: number,
  ): Promise<{
    ok: boolean;
    balance: number;
    reason: "granted" | "not-broke" | "cooldown";
  }> {
    const key = { tenantId_telegramUserId: { tenantId, telegramUserId } };
    const wallet = await this.client.chipWallet.findUnique({ where: key });
    if (!wallet || wallet.balance > maxBalance) {
      return {
        ok: false,
        balance: wallet?.balance ?? 0,
        reason: "not-broke",
      };
    }
    try {
      const balance = await this.client.$transaction(async (tx) => {
        await tx.chipLedger.create({
          data: {
            tenantId,
            telegramUserId,
            delta: amount,
            reason: "bonus",
            refId: bucketKey,
          },
        });
        const updated = await tx.chipWallet.update({
          where: key,
          data: { balance: { increment: amount } },
        });
        return updated.balance;
      });
      return { ok: true, balance, reason: "granted" };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const current = await this.client.chipWallet.findUnique({ where: key });
        return {
          ok: false,
          balance: current?.balance ?? 0,
          reason: "cooldown",
        };
      }
      throw error;
    }
  }

  private freshWalletData(
    tenantId: string,
    telegramUserId: bigint,
    balance: number,
  ) {
    const serverSeed = newServerSeed();
    return {
      tenantId,
      telegramUserId,
      balance,
      serverSeed,
      serverSeedHash: commitOf(serverSeed),
      clientSeed: newClientSeed(),
      nonce: 0,
    };
  }

  async transfer(
    tenantId: string,
    fromId: bigint,
    toId: bigint,
    amount: number,
    refId: string,
  ): Promise<{
    ok: boolean;
    error?: "insufficient" | "self";
    fromBalance: number;
  }> {
    if (fromId === toId) {
      return { ok: false, error: "self", fromBalance: 0 };
    }
    const fromKey = {
      tenantId_telegramUserId: { tenantId, telegramUserId: fromId },
    };
    return this.client.$transaction(async (tx) => {
      const debited = await tx.chipWallet.updateMany({
        where: { tenantId, telegramUserId: fromId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (debited.count === 0) {
        const wallet = await tx.chipWallet.findUnique({ where: fromKey });
        return {
          ok: false,
          error: "insufficient",
          fromBalance: wallet?.balance ?? 0,
        };
      }
      await tx.chipLedger.create({
        data: {
          tenantId,
          telegramUserId: fromId,
          delta: -amount,
          reason: "gift",
          refId,
        },
      });
      await tx.chipWallet.upsert({
        where: { tenantId_telegramUserId: { tenantId, telegramUserId: toId } },
        create: this.freshWalletData(tenantId, toId, amount),
        update: { balance: { increment: amount } },
      });
      await tx.chipLedger.create({
        data: {
          tenantId,
          telegramUserId: toId,
          delta: amount,
          reason: "gift",
          refId,
        },
      });
      const from = await tx.chipWallet.findUnique({ where: fromKey });
      return { ok: true, fromBalance: from?.balance ?? 0 };
    });
  }

  async creditPurchase(
    tenantId: string,
    telegramUserId: bigint,
    chargeId: string,
    amount: number,
  ): Promise<{ ok: boolean; balance: number }> {
    const key = { tenantId_telegramUserId: { tenantId, telegramUserId } };
    try {
      const balance = await this.client.$transaction(async (tx) => {
        // chargeId is @unique on the ledger -> credited exactly once per purchase.
        await tx.chipLedger.create({
          data: {
            tenantId,
            telegramUserId,
            delta: amount,
            reason: "purchase",
            chargeId,
          },
        });
        const wallet = await tx.chipWallet.upsert({
          where: key,
          create: this.freshWalletData(tenantId, telegramUserId, amount),
          update: { balance: { increment: amount } },
        });
        return wallet.balance;
      });
      return { ok: true, balance };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const wallet = await this.client.chipWallet.findUnique({ where: key });
        return { ok: false, balance: wallet?.balance ?? 0 };
      }
      throw error;
    }
  }

  async getJackpot(tenantId: string): Promise<number> {
    const pot = await this.client.jackpot.findUnique({ where: { tenantId } });
    return pot?.amount ?? JACKPOT_SEED;
  }

  /**
   * Net chips (SUM of ledger delta over bet+win) grouped by player, ranked
   * descending. `since`, when given, restricts to rows at/after that instant.
   */
  private async netStandings(
    tenantId: string,
    limit: number,
    since?: Date,
  ): Promise<NetStanding[]> {
    const grouped = await this.client.chipLedger.groupBy({
      by: ["telegramUserId"],
      where: {
        tenantId,
        reason: { in: [...NET_REASONS] },
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      _sum: { delta: true },
      orderBy: { _sum: { delta: "desc" } },
      take: limit,
    });
    return grouped.map((row) => ({
      telegramUserId: row.telegramUserId.toString(),
      net: row._sum.delta ?? 0,
    }));
  }

  async leaderboard(
    tenantId: string,
    opts?: { range?: "week" | "all"; limit?: number },
  ): Promise<NetStanding[]> {
    const limit = opts?.limit ?? 10;
    const since =
      opts?.range === "week" ? currentIsoWeek().startsAt : undefined;
    return this.netStandings(tenantId, limit, since);
  }

  /**
   * Net chips over an EXACT [start, end) window per player, ranked descending.
   * Used for tournament scoring (both live standings and settlement).
   */
  private async netStandingsInWindow(
    tenantId: string,
    startsAt: Date,
    endsAt: Date,
    limit: number,
  ): Promise<NetStanding[]> {
    const grouped = await this.client.chipLedger.groupBy({
      by: ["telegramUserId"],
      where: {
        tenantId,
        reason: { in: [...NET_REASONS] },
        createdAt: { gte: startsAt, lt: endsAt },
      },
      _sum: { delta: true },
      orderBy: { _sum: { delta: "desc" } },
      take: limit,
    });
    return grouped.map((row) => ({
      telegramUserId: row.telegramUserId.toString(),
      net: row._sum.delta ?? 0,
    }));
  }

  async tournamentState(
    tenantId: string,
    userId?: bigint,
  ): Promise<TournamentState> {
    const now = new Date();
    const { period, startsAt, endsAt } = currentIsoWeek(now);

    // Ensure the current week's tournament row exists (create seeded; no-op on
    // update so a re-read never disturbs an in-flight prize pool).
    await this.client.tournament.upsert({
      where: { tenantId_period: { tenantId, period } },
      create: {
        tenantId,
        period,
        startsAt,
        endsAt,
        prizePool: TOURNAMENT_SEED,
      },
      update: {},
    });

    // LAZY SETTLE: pay out any prior weeks that have ended but never settled.
    await this.settleEndedTournaments(tenantId, period, now);

    const current = await this.client.tournament.findUnique({
      where: { tenantId_period: { tenantId, period } },
    });
    const prizePool = current?.prizePool ?? TOURNAMENT_SEED;

    const standings = await this.netStandingsInWindow(
      tenantId,
      startsAt,
      endsAt,
      10,
    );

    let you: TournamentState["you"] = null;
    if (userId !== undefined) {
      const uid = userId.toString();
      const inTop = standings.findIndex((s) => s.telegramUserId === uid);
      if (inTop >= 0) {
        const row = standings[inTop];
        you = { rank: inTop + 1, net: row?.net ?? 0 };
      } else {
        // Not in the top-10: compute this player's own net + a rank by counting
        // how many players out-net them over the window.
        const mine = await this.client.chipLedger.aggregate({
          where: {
            tenantId,
            telegramUserId: userId,
            reason: { in: [...NET_REASONS] },
            createdAt: { gte: startsAt, lt: endsAt },
          },
          _sum: { delta: true },
        });
        const net = mine._sum.delta ?? 0;
        const full = await this.netStandingsInWindow(
          tenantId,
          startsAt,
          endsAt,
          10_000,
        );
        const rank = full.filter((s) => s.net > net).length + 1;
        you = { rank, net };
      }
    }

    return { period, startsAt, endsAt, prizePool, standings, you };
  }

  /**
   * Finds every tournament for the tenant that needs settlement work: either
   * still OPEN with an ended window (needs the open->settled claim + payout),
   * or already SETTLED but with unfinished payouts (a prior attempt claimed
   * it and crashed before every winner got paid). Both cases funnel into
   * settleTournament, which is safe to call repeatedly — see its docstring.
   */
  private async settleEndedTournaments(
    tenantId: string,
    currentPeriod: string,
    now: Date,
  ): Promise<void> {
    const pending = await this.client.tournament.findMany({
      where: {
        tenantId,
        period: { not: currentPeriod },
        OR: [
          { status: "open", endsAt: { lte: now } },
          { status: "settled", payoutsCompletedAt: null },
        ],
      },
    });
    for (const tournament of pending) {
      await this.settleTournament(tenantId, tournament.id);
    }
  }

  /**
   * Settles one tournament, resumably. Phase 1 claims the row (open ->
   * settled) atomically and snapshots the winners so a resume never has to
   * recompute standings. Phase 2 pays every winner via the ledger — each
   * credit() is idempotent thanks to ChipLedger's (tenantId, telegramUserId,
   * reason, refId) unique constraint, so re-running this after a crash just
   * skips whoever was already paid. Phase 3 marks payoutsCompletedAt, the
   * only signal that lets settleEndedTournaments stop rescanning this row.
   */
  private async settleTournament(
    tenantId: string,
    tournamentId: string,
  ): Promise<void> {
    const row = await this.client.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!row || row.tenantId !== tenantId) {
      return;
    }

    if (row.status === "settled") {
      if (row.payoutsCompletedAt) {
        return; // fully done already
      }
      // A prior attempt claimed this tournament but crashed before finishing
      // payouts. Resume from the winners snapshot recorded at claim time — do
      // NOT recompute standings; the scoring window already closed and ledger
      // activity since then must not change who won.
      await this.payWinnersAndComplete(
        tenantId,
        tournamentId,
        parseWinners(row.winners),
      );
      return;
    }
    if (row.status !== "open") {
      return; // defensive: unknown status
    }

    // Phase 1: claim the row (open -> settled) atomically + snapshot winners.
    // Only the winner of this race proceeds to Phase 2, so credits happen
    // exactly once per (tenant, tournament) even under concurrent readers.
    const claimed = await this.client.$transaction(async (tx) => {
      const fresh = await tx.tournament.findUnique({
        where: { id: tournamentId },
      });
      if (!fresh || fresh.tenantId !== tenantId || fresh.status !== "open") {
        return null;
      }
      const top = await tx.chipLedger.groupBy({
        by: ["telegramUserId"],
        where: {
          tenantId,
          reason: { in: [...NET_REASONS] },
          createdAt: { gte: fresh.startsAt, lt: fresh.endsAt },
        },
        _sum: { delta: true },
        orderBy: { _sum: { delta: "desc" } },
        take: 3,
      });
      const payouts: TournamentWinner[] = top.flatMap((entry, i) => {
        const net = entry._sum.delta ?? 0;
        const share = TOURNAMENT_SPLIT[i] ?? 0;
        const prize = Math.floor(fresh.prizePool * share);
        // Skip losers (net<=0) and any zero-share/zero-prize slot.
        if (net <= 0 || prize <= 0) {
          return [];
        }
        return [
          { telegramUserId: entry.telegramUserId.toString(), prize, net },
        ];
      });
      const result = await tx.tournament.updateMany({
        where: { id: tournamentId, status: "open" },
        data: {
          status: "settled",
          settledAt: new Date(),
          winners: toJson(payouts),
        },
      });
      if (result.count === 0) {
        return null; // lost the race; the winner (or the next lazy-settle poll) pays.
      }
      return payouts;
    });

    if (!claimed) {
      return;
    }
    await this.payWinnersAndComplete(tenantId, tournamentId, claimed);
  }

  private async payWinnersAndComplete(
    tenantId: string,
    tournamentId: string,
    winners: readonly TournamentWinner[],
  ): Promise<void> {
    // Phase 2: pay prizes via the ledger-backed credit (refId = tournamentId).
    for (const winner of winners) {
      try {
        await this.credit(
          tenantId,
          BigInt(winner.telegramUserId),
          winner.prize,
          "tournament",
          tournamentId,
        );
      } catch (error) {
        if (!isUniqueViolation(error)) {
          // Real failure: payoutsCompletedAt stays unset so the next
          // lazy-settle poll retries only the remaining winners.
          throw error;
        }
        // else: already paid in a prior attempt (crash-resume or a race) — skip.
      }
    }

    // Phase 3: mark payouts fully done. If the process crashes before this
    // write, status stays 'settled' + payoutsCompletedAt stays null, and the
    // very next tournamentState() call anywhere resumes exactly here.
    await this.client.tournament.update({
      where: { id: tournamentId },
      data: { payoutsCompletedAt: new Date() },
    });
  }
}

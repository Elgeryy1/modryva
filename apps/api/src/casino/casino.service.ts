import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  PrismaChipRepository,
  type PrismaClient,
  prisma,
} from "@superbot/data";
import {
  type BaccaratBet,
  baccaratMultiplier,
  buildShoe,
  CASINO,
  commit,
  crashPoint,
  dealBaccarat,
  dealerPlays,
  dealHiLo,
  drawKeno,
  type HiLoBet,
  handValue,
  hiLoMultiplier,
  isMine,
  kenoMultiplier,
  minesLayout,
  minesMultiplier,
  newServerSeed,
  type RouletteBet,
  resolveDice,
  resolvePlinko,
  rollSicBo,
  rouletteMultiplier,
  type SicBoBet,
  settleBlackjack,
  settleCrash,
  sicBoMultiplier,
  spinRoulette,
} from "@superbot/module-games";
import { getRuntimeEnv } from "@superbot/shared";

/**
 * Server-authoritative provably-fair casino for the Mini App. Instant games
 * (dice/plinko/roulette) settle in one call via the wallet's rotating seed.
 * Multi-step games (crash/mines/blackjack) persist a CasinoBet whose hidden
 * outcome is committed (sha256) up front and the serverSeed revealed on settle.
 */
/** The bot serving this request (HMAC-proven by InitDataGuard); parent default. */
interface BotScope {
  readonly username: string;
  readonly token: string;
}

@Injectable()
export class CasinoService {
  private readonly chips = new PrismaChipRepository();

  constructor(private readonly client: PrismaClient = prisma) {}

  private async tenantId(bot?: BotScope): Promise<string> {
    const botKey = (bot?.username ?? getRuntimeEnv().TELEGRAM_BOT_USERNAME)
      .replace(/^@/u, "")
      .toLowerCase();
    const tenant = await this.client.tenant.findUnique({
      where: { slug: `telegram-${botKey}` },
    });
    if (!tenant) {
      throw new ServiceUnavailableException({ error: "no-tenant" });
    }
    return tenant.id;
  }

  private validStake(stake: unknown): number {
    const value = Number(stake);
    if (
      !Number.isInteger(value) ||
      value < CASINO.minBet ||
      value > CASINO.maxBet
    ) {
      throw new BadRequestException({ error: "invalid-stake" });
    }
    return value;
  }

  async balance(userId: string, bot?: BotScope) {
    const tenantId = await this.tenantId(bot);
    const wallet = await this.chips.ensureWallet(
      tenantId,
      BigInt(userId),
      CASINO.welcomeGrant,
    );
    return {
      balance: wallet.balance,
      commit: wallet.serverSeedHash,
      clientSeed: wallet.clientSeed,
      nonce: wallet.nonce,
    };
  }

  // --- Instant games: one atomic bet via the wallet seed ---

  async instantBet(
    userId: string,
    game: string,
    stakeRaw: unknown,
    params: Record<string, unknown>,
    bot?: BotScope,
  ) {
    const tenantId = await this.tenantId(bot);
    const stake = this.validStake(stakeRaw);
    await this.chips.ensureWallet(
      tenantId,
      BigInt(userId),
      CASINO.welcomeGrant,
    );

    const resolver = this.instantResolver(game, params);
    const out = await this.chips.placeBet({
      tenantId,
      telegramUserId: BigInt(userId),
      stake,
      betId: randomUUID(),
      resolve: resolver,
    });
    if (!out.ok) {
      throw new BadRequestException({
        error: "insufficient",
        balance: out.balance,
      });
    }
    return {
      ok: true,
      payout: out.payout,
      multiplier: out.multiplier,
      balance: out.balance,
      detail: out.detail,
      // Progressive jackpot: chips won on this bet (0 = not hit) + the pot after.
      jackpotWon: out.jackpotWon ?? 0,
      jackpot: out.jackpot ?? 0,
      proof: {
        commit: out.serverSeedHash,
        clientSeed: out.clientSeed,
        nonce: out.nonce,
      },
    };
  }

  // --- Social layer: jackpot pot, net-chips leaderboard, weekly tournament ---

  async jackpot(bot?: BotScope) {
    const tenantId = await this.tenantId(bot);
    const amount = await this.chips.getJackpot(tenantId);
    return { amount };
  }

  async leaderboard(range: "week" | "all", bot?: BotScope) {
    const tenantId = await this.tenantId(bot);
    const rows = await this.chips.leaderboard(tenantId, { range });
    const names = await this.resolveNames(rows.map((r) => r.telegramUserId));
    return {
      range,
      rows: rows.map((r) => ({
        telegramUserId: r.telegramUserId,
        name: names.get(r.telegramUserId) ?? null,
        net: r.net,
      })),
    };
  }

  async tournament(userId: string, bot?: BotScope) {
    const tenantId = await this.tenantId(bot);
    const state = await this.chips.tournamentState(tenantId, BigInt(userId));
    const names = await this.resolveNames(
      state.standings.map((s) => s.telegramUserId),
    );
    return {
      period: state.period,
      endsAt: state.endsAt.toISOString(),
      prizePool: state.prizePool,
      standings: state.standings.map((s) => ({
        telegramUserId: s.telegramUserId,
        name: names.get(s.telegramUserId) ?? null,
        net: s.net,
      })),
      you: state.you ?? null,
    };
  }

  /**
   * Batch-resolves human display names for a set of telegram ids, mirroring the
   * games leaderboard: prefer displayName, fall back to @username, else omit.
   */
  private async resolveNames(ids: string[]): Promise<Map<string, string>> {
    const nameById = new Map<string, string>();
    if (ids.length === 0) {
      return nameById;
    }
    const bigints: bigint[] = [];
    for (const id of ids) {
      if (/^-?\d+$/u.test(id)) {
        bigints.push(BigInt(id));
      }
    }
    if (bigints.length === 0) {
      return nameById;
    }
    const users = await this.client.appUser.findMany({
      where: { telegramUserId: { in: bigints } },
      select: { telegramUserId: true, displayName: true, username: true },
    });
    for (const user of users) {
      const name =
        user.displayName ?? (user.username ? `@${user.username}` : null);
      if (name) {
        nameById.set(user.telegramUserId.toString(), name);
      }
    }
    return nameById;
  }

  private instantResolver(game: string, params: Record<string, unknown>) {
    if (game === "dice") {
      const side = params.side === "alto" ? "alto" : "bajo";
      const target = Number(params.target);
      if (!Number.isInteger(target) || target < 1 || target > 99) {
        throw new BadRequestException({ error: "invalid-params" });
      }
      return (ss: string, cs: string, n: number) =>
        resolveDice(ss, cs, n, side, target);
    }
    if (game === "plinko") {
      const risk =
        params.risk === "alto" || params.risk === "medio"
          ? params.risk
          : "bajo";
      const rows = [8, 12, 16].includes(Number(params.rows))
        ? Number(params.rows)
        : 12;
      return (ss: string, cs: string, n: number) =>
        resolvePlinko(ss, cs, n, rows, risk as "bajo" | "medio" | "alto");
    }
    if (game === "roulette") {
      const bet = this.parseRouletteBet(params);
      return (ss: string, cs: string, n: number) => {
        const pocket = spinRoulette(ss, cs, n);
        return {
          multiplier: rouletteMultiplier(bet, pocket),
          detail: { pocket, bet },
        };
      };
    }
    if (game === "sicbo") {
      const bet = this.parseSicBoBet(params);
      return (ss: string, cs: string, n: number) => {
        const roll = rollSicBo(ss, cs, n);
        return {
          multiplier: sicBoMultiplier(bet, roll),
          detail: { roll, bet },
        };
      };
    }
    if (game === "baccarat") {
      const kind = params.kind;
      if (kind !== "player" && kind !== "banker" && kind !== "tie") {
        throw new BadRequestException({ error: "invalid-params" });
      }
      const bet: BaccaratBet = { kind };
      return (ss: string, cs: string, n: number) => {
        const deal = dealBaccarat(ss, cs, n);
        return {
          multiplier: baccaratMultiplier(bet, deal),
          detail: { deal, bet },
        };
      };
    }
    if (game === "keno") {
      const picks = Array.isArray(params.picks) ? params.picks.map(Number) : [];
      const unique = new Set(picks);
      if (
        picks.length !== 3 ||
        unique.size !== 3 ||
        picks.some((p) => !Number.isInteger(p) || p < 1 || p > 20)
      ) {
        throw new BadRequestException({ error: "invalid-params" });
      }
      return (ss: string, cs: string, n: number) => {
        const drawn = drawKeno(ss, cs, n);
        return {
          multiplier: kenoMultiplier(picks, drawn),
          detail: { picks, drawn },
        };
      };
    }
    if (game === "hilo") {
      const kind = params.kind;
      if (kind !== "higher" && kind !== "lower") {
        throw new BadRequestException({ error: "invalid-params" });
      }
      const bet: HiLoBet = { kind };
      return (ss: string, cs: string, n: number) => {
        const deal = dealHiLo(ss, cs, n);
        return { multiplier: hiLoMultiplier(bet, deal), detail: { deal, bet } };
      };
    }
    throw new BadRequestException({ error: "unknown-game" });
  }

  private parseSicBoBet(params: Record<string, unknown>): SicBoBet {
    const kind = params.kind;
    if (kind === "small" || kind === "big") {
      return { kind };
    }
    if (kind === "triple") {
      const value = Number(params.value);
      if (![1, 2, 3, 4, 5, 6].includes(value)) {
        throw new BadRequestException({ error: "invalid-params" });
      }
      return { kind: "triple", value: value as 1 | 2 | 3 | 4 | 5 | 6 };
    }
    throw new BadRequestException({ error: "invalid-params" });
  }

  private parseRouletteBet(params: Record<string, unknown>): RouletteBet {
    const kind = String(params.kind);
    if (kind === "straight") {
      const n = Number(params.n);
      if (!Number.isInteger(n) || n < 0 || n > 36) {
        throw new BadRequestException({ error: "invalid-params" });
      }
      return { kind: "straight", n };
    }
    if (["red", "black", "odd", "even", "low", "high"].includes(kind)) {
      return { kind } as RouletteBet;
    }
    if (kind === "dozen" || kind === "column") {
      const index = Number(params.index);
      if (index !== 1 && index !== 2 && index !== 3) {
        throw new BadRequestException({ error: "invalid-params" });
      }
      return { kind, index } as RouletteBet;
    }
    throw new BadRequestException({ error: "invalid-params" });
  }

  private async loadBet(tenantId: string, betId: string, userId: string) {
    const bet = await this.chips.getCasinoBet(tenantId, betId, BigInt(userId));
    if (!bet) {
      throw new BadRequestException({ error: "no-bet" });
    }
    if (bet.status !== "open") {
      throw new BadRequestException({ error: "bet-closed" });
    }
    return bet;
  }

  // CRASH
  async crashStart(userId: string, stakeRaw: unknown, bot?: BotScope) {
    const tenantId = await this.tenantId(bot);
    await this.chips.ensureWallet(
      tenantId,
      BigInt(userId),
      CASINO.welcomeGrant,
    );
    const stake = this.validStake(stakeRaw);
    const serverSeed = newServerSeed();
    const crash = crashPoint(serverSeed, `${userId}`, 0);
    const started = await this.chips.startCasinoBet({
      tenantId,
      telegramUserId: BigInt(userId),
      game: "crash",
      stake,
      serverSeed,
      serverSeedHash: commit(serverSeed),
      clientSeed: `${userId}`,
      nonce: 0,
      state: { crash },
    });
    if (!started.ok || !started.betId) {
      throw new BadRequestException({
        error: "insufficient",
        balance: started.balance,
      });
    }
    return {
      betId: started.betId,
      commit: commit(serverSeed),
      balance: started.balance,
    };
  }

  async crashCashout(
    userId: string,
    betId: string,
    cashoutAtRaw: unknown,
    bot?: BotScope,
  ) {
    const tenantId = await this.tenantId(bot);
    const bet = await this.loadBet(tenantId, betId, userId);
    if (bet.game !== "crash") {
      throw new BadRequestException({ error: "wrong-game" });
    }
    const cashoutAt = Number(cashoutAtRaw);
    // Strictly greater than 1 — see settleCrash's docstring: crash is floored
    // to 1.00 for ~1% of rounds, so cashoutAt === 1.00 would otherwise always
    // win, a risk-free refund that erases the house edge.
    if (!Number.isFinite(cashoutAt) || cashoutAt <= 1) {
      throw new BadRequestException({ error: "invalid-params" });
    }
    const crash = (bet.state as { crash: number }).crash;
    const settled = settleCrash(crash, cashoutAt, bet.stake);
    const res = await this.chips.settleCasinoBet(
      tenantId,
      betId,
      BigInt(userId),
      settled.payout,
      { crash, cashoutAt, win: settled.win },
    );
    if (!res.ok) {
      throw new BadRequestException({
        error: "bet-closed",
        balance: res.balance,
      });
    }
    return {
      win: settled.win,
      crash,
      payout: settled.payout,
      balance: res.balance,
      reveal: bet.serverSeed,
    };
  }

  // MINES
  async minesStart(
    userId: string,
    stakeRaw: unknown,
    mineCountRaw: unknown,
    bot?: BotScope,
  ) {
    const tenantId = await this.tenantId(bot);
    await this.chips.ensureWallet(
      tenantId,
      BigInt(userId),
      CASINO.welcomeGrant,
    );
    const stake = this.validStake(stakeRaw);
    const mineCount = Number(mineCountRaw);
    if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount > 24) {
      throw new BadRequestException({ error: "invalid-params" });
    }
    const serverSeed = newServerSeed();
    const layout = minesLayout(serverSeed, `${userId}`, 0, mineCount);
    const { betId, balance } = await this.openBetWithSeed(
      userId,
      tenantId,
      "mines",
      stake,
      serverSeed,
      {
        layout,
        mineCount,
        revealed: [] as number[],
      },
    );
    return { betId, commit: commit(serverSeed), mineCount, balance };
  }

  private async openBetWithSeed(
    userId: string,
    tenantId: string,
    game: string,
    stake: number,
    serverSeed: string,
    state: unknown,
  ) {
    const started = await this.chips.startCasinoBet({
      tenantId,
      telegramUserId: BigInt(userId),
      game,
      stake,
      serverSeed,
      serverSeedHash: commit(serverSeed),
      clientSeed: `${userId}`,
      nonce: 0,
      state,
    });
    if (!started.ok || !started.betId) {
      throw new BadRequestException({
        error: "insufficient",
        balance: started.balance,
      });
    }
    // Propagate the post-debit balance so the caller can update the header
    // immediately (otherwise the UI shows the pre-bet balance all round).
    return { betId: started.betId, balance: started.balance };
  }

  async minesReveal(
    userId: string,
    betId: string,
    tileRaw: unknown,
    bot?: BotScope,
  ) {
    const tenantId = await this.tenantId(bot);
    const bet = await this.loadBet(tenantId, betId, userId);
    if (bet.game !== "mines") {
      throw new BadRequestException({ error: "wrong-game" });
    }
    const tile = Number(tileRaw);
    if (!Number.isInteger(tile) || tile < 0 || tile > 24) {
      throw new BadRequestException({ error: "invalid-params" });
    }
    const state = bet.state as {
      layout: number[];
      mineCount: number;
      revealed: number[];
    };
    if (state.revealed.includes(tile)) {
      throw new BadRequestException({ error: "already-revealed" });
    }
    if (isMine(state.layout, tile)) {
      const res = await this.chips.settleCasinoBet(
        tenantId,
        betId,
        BigInt(userId),
        0,
        { ...state, hitMine: tile },
      );
      if (!res.ok) {
        throw new BadRequestException({
          error: "bet-closed",
          balance: res.balance,
        });
      }
      return {
        mine: true,
        tile,
        layout: state.layout,
        payout: 0,
        balance: res.balance,
        reveal: bet.serverSeed,
      };
    }
    const revealed = [...state.revealed, tile];
    const multiplier = minesMultiplier(state.mineCount, revealed.length);
    // Board cleared (all safe tiles revealed): auto-cash-out at the max payout
    // instead of leaving the bet open — every remaining tile is a mine, so one
    // more tap would detonate and lose the whole win.
    const safeTiles = 25 - state.mineCount;
    if (revealed.length >= safeTiles) {
      const payout = Math.floor(bet.stake * multiplier);
      const res = await this.chips.settleCasinoBet(
        tenantId,
        betId,
        BigInt(userId),
        payout,
        { ...state, revealed, cashedOut: true, cleared: true },
      );
      if (!res.ok) {
        throw new BadRequestException({
          error: "bet-closed",
          balance: res.balance,
        });
      }
      return {
        mine: false,
        tile,
        revealed: revealed.length,
        multiplier,
        cleared: true,
        payout,
        balance: res.balance,
        reveal: bet.serverSeed,
      };
    }
    await this.chips.updateCasinoBetState(tenantId, betId, BigInt(userId), {
      ...state,
      revealed,
    });
    return {
      mine: false,
      tile,
      revealed: revealed.length,
      multiplier,
    };
  }

  async minesCashout(userId: string, betId: string, bot?: BotScope) {
    const tenantId = await this.tenantId(bot);
    const bet = await this.loadBet(tenantId, betId, userId);
    if (bet.game !== "mines") {
      throw new BadRequestException({ error: "wrong-game" });
    }
    const state = bet.state as {
      layout: number[];
      mineCount: number;
      revealed: number[];
    };
    if (state.revealed.length === 0) {
      throw new BadRequestException({ error: "nothing-revealed" });
    }
    const multiplier = minesMultiplier(state.mineCount, state.revealed.length);
    const payout = Math.floor(bet.stake * multiplier);
    const res = await this.chips.settleCasinoBet(
      tenantId,
      betId,
      BigInt(userId),
      payout,
      { ...state, cashedOut: true },
    );
    if (!res.ok) {
      throw new BadRequestException({
        error: "bet-closed",
        balance: res.balance,
      });
    }
    return {
      payout,
      multiplier,
      balance: res.balance,
      layout: state.layout,
      reveal: bet.serverSeed,
    };
  }

  // BLACKJACK
  async blackjackStart(userId: string, stakeRaw: unknown, bot?: BotScope) {
    const tenantId = await this.tenantId(bot);
    await this.chips.ensureWallet(
      tenantId,
      BigInt(userId),
      CASINO.welcomeGrant,
    );

    // Reconcile a hand abandoned mid-round (closed tab, switched games,
    // network drop) before opening a new one: resolve it exactly as pressing
    // "Plantarse" would (fair dealer playout against the shoe already
    // committed to that bet) so the staked chip is never stuck in limbo.
    // Best-effort: if a concurrent request already closed it, move on.
    const stale = await this.chips.findOpenCasinoBet(
      tenantId,
      BigInt(userId),
      "blackjack",
    );
    if (stale) {
      try {
        await this.blackjackSettle(tenantId, stale.id, userId, "stand");
      } catch {
        // Already resolved concurrently — nothing left to reconcile.
      }
    }

    const stake = this.validStake(stakeRaw);
    const serverSeed = newServerSeed();
    const shoe = buildShoe(serverSeed, `${userId}`, 0);
    const player = [shoe[0] ?? 1, shoe[2] ?? 1];
    const dealer = [shoe[1] ?? 1, shoe[3] ?? 1];
    const cursor = 4;
    const state = { shoe, cursor, player, dealer };
    const { betId, balance } = await this.openBetWithSeed(
      userId,
      tenantId,
      "blackjack",
      stake,
      serverSeed,
      state,
    );
    const pv = handValue(player);
    if (pv.total === 21) {
      return this.blackjackSettle(tenantId, betId, userId, "stand");
    }
    return {
      betId,
      commit: commit(serverSeed),
      player,
      dealerUp: dealer[0],
      total: pv.total,
      balance,
    };
  }

  async blackjackAction(
    userId: string,
    betId: string,
    action: string,
    bot?: BotScope,
  ) {
    const tenantId = await this.tenantId(bot);
    if (action !== "hit" && action !== "stand") {
      throw new BadRequestException({ error: "invalid-action" });
    }
    if (action === "stand") {
      return this.blackjackSettle(tenantId, betId, userId, "stand");
    }
    const bet = await this.loadBet(tenantId, betId, userId);
    if (bet.game !== "blackjack") {
      throw new BadRequestException({ error: "wrong-game" });
    }
    const state = bet.state as {
      shoe: number[];
      cursor: number;
      player: number[];
      dealer: number[];
    };
    const card = state.shoe[state.cursor] ?? 1;
    const player = [...state.player, card];
    const cursor = state.cursor + 1;
    const pv = handValue(player);
    if (pv.total > 21) {
      // Bust — settle as a loss.
      const res = await this.chips.settleCasinoBet(
        tenantId,
        betId,
        BigInt(userId),
        0,
        { ...state, player, cursor, outcome: "lose" },
      );
      if (!res.ok) {
        throw new BadRequestException({
          error: "bet-closed",
          balance: res.balance,
        });
      }
      return {
        done: true,
        outcome: "lose",
        player,
        total: pv.total,
        // Frontend reads `playerTotal` for the result label ("? vs ?" without it).
        playerTotal: pv.total,
        payout: 0,
        balance: res.balance,
        reveal: bet.serverSeed,
      };
    }
    await this.chips.updateCasinoBetState(tenantId, betId, BigInt(userId), {
      ...state,
      player,
      cursor,
    });
    return { done: false, player, total: pv.total };
  }

  private async blackjackSettle(
    tenantId: string,
    betId: string,
    userId: string,
    _action: "stand",
  ) {
    const bet = await this.loadBet(tenantId, betId, userId);
    const state = bet.state as {
      shoe: number[];
      cursor: number;
      player: number[];
      dealer: number[];
    };
    // Seed the dealer's play with its two initial cards so the "stand on 17+"
    // decision is made on the FULL dealer hand (otherwise the dealer draws on top
    // of an empty hand and busts almost every round — a house-breaking bug).
    const dealerPlay = dealerPlays(state.shoe, state.cursor, state.dealer);
    const dealer = [...state.dealer, ...dealerPlay.cards];
    const playerV = handValue(state.player);
    const dealerV = handValue(dealer);
    const isBlackjack = state.player.length === 2 && playerV.total === 21;
    // Natural-vs-natural is a push, not a 2.5x blackjack payout: only pay the
    // blackjack bonus when the dealer does NOT also have a natural.
    const dealerNatural =
      state.dealer.length === 2 && handValue(state.dealer).total === 21;
    const result = settleBlackjack(
      playerV.total,
      dealerV.total,
      isBlackjack && !dealerNatural,
    );
    const payout = Math.floor(bet.stake * result.multiplier);
    const res = await this.chips.settleCasinoBet(
      tenantId,
      betId,
      BigInt(userId),
      payout,
      { ...state, dealer, outcome: result.outcome },
    );
    if (!res.ok) {
      throw new BadRequestException({
        error: "bet-closed",
        balance: res.balance,
      });
    }
    return {
      done: true,
      outcome: result.outcome,
      player: state.player,
      playerTotal: playerV.total,
      dealer,
      dealerTotal: dealerV.total,
      payout,
      balance: res.balance,
      reveal: bet.serverSeed,
    };
  }
}

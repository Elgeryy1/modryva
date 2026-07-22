import { describe, expect, it } from "vitest";
import type { MiniappRequest } from "../miniapp/init-data.guard.js";
import { CasinoController } from "./casino.controller.js";
import type { CasinoService } from "./casino.service.js";

const reqWith = (miniapp: MiniappRequest["miniapp"]): MiniappRequest => ({
  headers: {},
  ...(miniapp ? { miniapp } : {}),
});

const CHILD_BOT = { botUsername: "childbot", botToken: "child-token" };

const ctxFor = (userId: string) => ({
  userId,
  user: { id: Number(userId) },
  startParam: null,
  botUsername: CHILD_BOT.botUsername,
  botToken: CHILD_BOT.botToken,
});

/** Records the `bot` argument every CasinoService method actually received —
 * this is what would have caught the original bug (the controller silently
 * dropping ctx.botUsername/ctx.botToken before it ever reached the service). */
class FakeCasinoService {
  calls: Array<{ method: string; bot: unknown }> = [];

  async balance(_userId: string, bot?: unknown) {
    this.calls.push({ method: "balance", bot });
    return {};
  }
  async instantBet(
    _userId: string,
    _game: string,
    _stake: unknown,
    _params: unknown,
    bot?: unknown,
  ) {
    this.calls.push({ method: "instantBet", bot });
    return {};
  }
  async jackpot(bot?: unknown) {
    this.calls.push({ method: "jackpot", bot });
    return {};
  }
  async leaderboard(_range: unknown, bot?: unknown) {
    this.calls.push({ method: "leaderboard", bot });
    return {};
  }
  async tournament(_userId: string, bot?: unknown) {
    this.calls.push({ method: "tournament", bot });
    return {};
  }
  async crashStart(_userId: string, _stake: unknown, bot?: unknown) {
    this.calls.push({ method: "crashStart", bot });
    return {};
  }
  async crashCashout(
    _userId: string,
    _betId: string,
    _cashoutAt: unknown,
    bot?: unknown,
  ) {
    this.calls.push({ method: "crashCashout", bot });
    return {};
  }
  async minesStart(
    _userId: string,
    _stake: unknown,
    _mineCount: unknown,
    bot?: unknown,
  ) {
    this.calls.push({ method: "minesStart", bot });
    return {};
  }
  async minesReveal(
    _userId: string,
    _betId: string,
    _tile: unknown,
    bot?: unknown,
  ) {
    this.calls.push({ method: "minesReveal", bot });
    return {};
  }
  async minesCashout(_userId: string, _betId: string, bot?: unknown) {
    this.calls.push({ method: "minesCashout", bot });
    return {};
  }
  async blackjackStart(_userId: string, _stake: unknown, bot?: unknown) {
    this.calls.push({ method: "blackjackStart", bot });
    return {};
  }
  async blackjackAction(
    _userId: string,
    _betId: string,
    _action: string,
    bot?: unknown,
  ) {
    this.calls.push({ method: "blackjackAction", bot });
    return {};
  }
}

const makeController = () => {
  const casino = new FakeCasinoService();
  const controller = new CasinoController(casino as unknown as CasinoService);
  return { controller, casino };
};

const expectedBot = {
  username: CHILD_BOT.botUsername,
  token: CHILD_BOT.botToken,
};

describe("CasinoController forwards the request's bot scope", () => {
  const req = reqWith(ctxFor("42"));

  it("balance", async () => {
    const { controller, casino } = makeController();
    await controller.balance(req);
    expect(casino.calls[0]).toEqual({ method: "balance", bot: expectedBot });
  });

  it("bet", async () => {
    const { controller, casino } = makeController();
    await controller.bet(req, { game: "plinko", stake: 10, params: {} });
    expect(casino.calls[0]).toEqual({
      method: "instantBet",
      bot: expectedBot,
    });
  });

  it("jackpot", async () => {
    const { controller, casino } = makeController();
    await controller.jackpot(req);
    expect(casino.calls[0]).toEqual({ method: "jackpot", bot: expectedBot });
  });

  it("leaderboard", async () => {
    const { controller, casino } = makeController();
    await controller.leaderboard(req, { range: "week" });
    expect(casino.calls[0]).toEqual({
      method: "leaderboard",
      bot: expectedBot,
    });
  });

  it("tournament", async () => {
    const { controller, casino } = makeController();
    await controller.tournament(req);
    expect(casino.calls[0]).toEqual({
      method: "tournament",
      bot: expectedBot,
    });
  });

  it("crashStart / crashCashout", async () => {
    const { controller, casino } = makeController();
    await controller.crashStart(req, { stake: 10 });
    await controller.crashCashout(req, { betId: "b1", cashoutAt: 1.5 });
    expect(casino.calls).toEqual([
      { method: "crashStart", bot: expectedBot },
      { method: "crashCashout", bot: expectedBot },
    ]);
  });

  it("minesStart / minesReveal / minesCashout", async () => {
    const { controller, casino } = makeController();
    await controller.minesStart(req, { stake: 10, mineCount: 3 });
    await controller.minesReveal(req, { betId: "b1", tile: 0 });
    await controller.minesCashout(req, { betId: "b1" });
    expect(casino.calls).toEqual([
      { method: "minesStart", bot: expectedBot },
      { method: "minesReveal", bot: expectedBot },
      { method: "minesCashout", bot: expectedBot },
    ]);
  });

  it("blackjackStart / blackjackAction", async () => {
    const { controller, casino } = makeController();
    await controller.blackjackStart(req, { stake: 10 });
    await controller.blackjackAction(req, { betId: "b1", action: "hit" });
    expect(casino.calls).toEqual([
      { method: "blackjackStart", bot: expectedBot },
      { method: "blackjackAction", bot: expectedBot },
    ]);
  });
});

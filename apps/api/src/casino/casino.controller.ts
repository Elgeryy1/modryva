import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "../miniapp/init-data.guard.js";
import { CasinoService } from "./casino.service.js";

@Controller("v1/casino")
@UseGuards(InitDataGuard)
export class CasinoController {
  // Explicit @Inject: tsx/esbuild does not emit decorator metadata.
  constructor(@Inject(CasinoService) private readonly casino: CasinoService) {}

  @Post("balance")
  async balance(@Req() req: MiniappRequest) {
    const ctx = getMiniappContext(req);
    return this.casino.balance(ctx.userId, {
      username: ctx.botUsername,
      token: ctx.botToken,
    });
  }

  @Post("bet")
  async bet(
    @Req() req: MiniappRequest,
    @Body()
    body: { game?: string; stake?: unknown; params?: Record<string, unknown> },
  ) {
    const ctx = getMiniappContext(req);
    return this.casino.instantBet(
      ctx.userId,
      String(body?.game ?? ""),
      body?.stake,
      body?.params ?? {},
      { username: ctx.botUsername, token: ctx.botToken },
    );
  }

  @Get("jackpot")
  async jackpot(@Req() req: MiniappRequest) {
    const ctx = getMiniappContext(req);
    return this.casino.jackpot({
      username: ctx.botUsername,
      token: ctx.botToken,
    });
  }

  @Post("leaderboard")
  async leaderboard(
    @Req() req: MiniappRequest,
    @Body() body: { range?: "week" | "all" },
  ) {
    const ctx = getMiniappContext(req);
    const range = body?.range === "all" ? "all" : "week";
    return this.casino.leaderboard(range, {
      username: ctx.botUsername,
      token: ctx.botToken,
    });
  }

  @Post("tournament")
  async tournament(@Req() req: MiniappRequest) {
    const ctx = getMiniappContext(req);
    return this.casino.tournament(ctx.userId, {
      username: ctx.botUsername,
      token: ctx.botToken,
    });
  }

  @Post("crash/start")
  async crashStart(
    @Req() req: MiniappRequest,
    @Body() body: { stake?: unknown },
  ) {
    const ctx = getMiniappContext(req);
    return this.casino.crashStart(ctx.userId, body?.stake, {
      username: ctx.botUsername,
      token: ctx.botToken,
    });
  }

  @Post("crash/cashout")
  async crashCashout(
    @Req() req: MiniappRequest,
    @Body() body: { betId?: string; cashoutAt?: unknown },
  ) {
    const ctx = getMiniappContext(req);
    return this.casino.crashCashout(
      ctx.userId,
      String(body?.betId ?? ""),
      body?.cashoutAt,
      { username: ctx.botUsername, token: ctx.botToken },
    );
  }

  @Post("mines/start")
  async minesStart(
    @Req() req: MiniappRequest,
    @Body() body: { stake?: unknown; mineCount?: unknown },
  ) {
    const ctx = getMiniappContext(req);
    return this.casino.minesStart(ctx.userId, body?.stake, body?.mineCount, {
      username: ctx.botUsername,
      token: ctx.botToken,
    });
  }

  @Post("mines/reveal")
  async minesReveal(
    @Req() req: MiniappRequest,
    @Body() body: { betId?: string; tile?: unknown },
  ) {
    const ctx = getMiniappContext(req);
    return this.casino.minesReveal(
      ctx.userId,
      String(body?.betId ?? ""),
      body?.tile,
      { username: ctx.botUsername, token: ctx.botToken },
    );
  }

  @Post("mines/cashout")
  async minesCashout(
    @Req() req: MiniappRequest,
    @Body() body: { betId?: string },
  ) {
    const ctx = getMiniappContext(req);
    return this.casino.minesCashout(ctx.userId, String(body?.betId ?? ""), {
      username: ctx.botUsername,
      token: ctx.botToken,
    });
  }

  @Post("blackjack/start")
  async blackjackStart(
    @Req() req: MiniappRequest,
    @Body() body: { stake?: unknown },
  ) {
    const ctx = getMiniappContext(req);
    return this.casino.blackjackStart(ctx.userId, body?.stake, {
      username: ctx.botUsername,
      token: ctx.botToken,
    });
  }

  @Post("blackjack/action")
  async blackjackAction(
    @Req() req: MiniappRequest,
    @Body() body: { betId?: string; action?: string },
  ) {
    const ctx = getMiniappContext(req);
    return this.casino.blackjackAction(
      ctx.userId,
      String(body?.betId ?? ""),
      String(body?.action ?? ""),
      { username: ctx.botUsername, token: ctx.botToken },
    );
  }
}

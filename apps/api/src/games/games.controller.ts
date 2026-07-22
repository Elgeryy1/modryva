import {
  BadRequestException,
  Body,
  Controller,
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
import { GamesService, type PlayerProfile } from "./games.service.js";

/** Extracts a display name + username from the verified Telegram initData user. */
const playerProfileFromInitData = (
  user: Record<string, unknown>,
): PlayerProfile => {
  const first = typeof user.first_name === "string" ? user.first_name : "";
  const last = typeof user.last_name === "string" ? user.last_name : "";
  const displayName = `${first} ${last}`.trim();
  const username = typeof user.username === "string" ? user.username : "";
  const profile: { displayName?: string; username?: string } = {};
  if (displayName) {
    profile.displayName = displayName;
  }
  if (username) {
    profile.username = username;
  }
  return profile;
};

@Controller("v1/games")
@UseGuards(InitDataGuard)
export class GamesController {
  // Explicit @Inject: tsx/esbuild does not emit decorator metadata, so implicit
  // type-based injection resolves to undefined.
  constructor(@Inject(GamesService) private readonly games: GamesService) {}

  @Post("start")
  async start(@Req() req: MiniappRequest, @Body() body: { game?: string }) {
    const ctx = getMiniappContext(req);
    return this.games.start(
      ctx.userId,
      ctx.startParam,
      String(body?.game ?? ""),
      playerProfileFromInitData(ctx.user),
      { username: ctx.botUsername, token: ctx.botToken },
    );
  }

  @Post("submit")
  async submit(
    @Req() req: MiniappRequest,
    @Body() body: { sessionId?: string; score?: number },
  ) {
    const ctx = getMiniappContext(req);
    if (!body?.sessionId || typeof body.score !== "number") {
      throw new BadRequestException({ error: "invalid-body" });
    }
    return this.games.submit(ctx.userId, body.sessionId, body.score, {
      username: ctx.botUsername,
      token: ctx.botToken,
    });
  }

  @Post("leaderboard")
  async leaderboard(@Req() req: MiniappRequest) {
    const ctx = getMiniappContext(req);
    return this.games.leaderboard(ctx.userId, ctx.startParam, {
      username: ctx.botUsername,
      token: ctx.botToken,
    });
  }

  @Post("profile")
  async profile(@Req() req: MiniappRequest) {
    const ctx = getMiniappContext(req);
    return this.games.playerProfile(
      ctx.userId,
      playerProfileFromInitData(ctx.user),
      { username: ctx.botUsername, token: ctx.botToken },
    );
  }

  @Post("daily")
  async daily(@Req() req: MiniappRequest) {
    const ctx = getMiniappContext(req);
    return this.games.dailyTrivia(ctx.userId, ctx.startParam, {
      username: ctx.botUsername,
      token: ctx.botToken,
    });
  }

  @Post("daily/answer")
  async dailyAnswer(
    @Req() req: MiniappRequest,
    @Body() body: { optionIndex?: number },
  ) {
    const ctx = getMiniappContext(req);
    if (
      typeof body?.optionIndex !== "number" ||
      !Number.isInteger(body.optionIndex) ||
      body.optionIndex < 0
    ) {
      throw new BadRequestException({ error: "invalid-body" });
    }
    return this.games.answerDailyTrivia(
      ctx.userId,
      ctx.startParam,
      body.optionIndex,
      { username: ctx.botUsername, token: ctx.botToken },
    );
  }

  @Post("quiz")
  async quiz(@Req() req: MiniappRequest, @Body() body: { round?: number }) {
    const ctx = getMiniappContext(req);
    const round = typeof body?.round === "number" ? body.round : 0;
    return this.games.quizBatch(ctx.userId, round);
  }

  @Post("boss")
  async boss(@Req() req: MiniappRequest) {
    const ctx = getMiniappContext(req);
    return this.games.coopBoss(ctx.userId, ctx.startParam, {
      username: ctx.botUsername,
      token: ctx.botToken,
    });
  }

  @Post("boss/attack")
  async bossAttack(@Req() req: MiniappRequest) {
    const ctx = getMiniappContext(req);
    const profile = playerProfileFromInitData(ctx.user);
    return this.games.attackBoss(
      ctx.userId,
      ctx.startParam,
      profile.displayName ?? profile.username,
      { username: ctx.botUsername, token: ctx.botToken },
    );
  }
}

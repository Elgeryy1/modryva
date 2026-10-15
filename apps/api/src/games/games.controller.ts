import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "../miniapp/init-data.guard.js";
import { MiniappVisitInterceptor } from "../miniapp/visit-tracker.interceptor.js";
import { CardsService } from "./cards.service.js";
import { GamesService, type PlayerProfile } from "./games.service.js";
import { MatchService } from "./match.service.js";
import { WordleService } from "./wordle.service.js";

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
// Every games route feeds the /bdani roster, so opening the app is recorded no
// matter which endpoint the client happens to call first.
@UseInterceptors(MiniappVisitInterceptor)
export class GamesController {
  // Explicit @Inject: tsx/esbuild does not emit decorator metadata, so implicit
  // type-based injection resolves to undefined.
  constructor(
    @Inject(GamesService) private readonly games: GamesService,
    @Inject(MatchService) private readonly match: MatchService,
    @Inject(CardsService) private readonly cards: CardsService,
    @Inject(WordleService) private readonly wordle: WordleService,
  ) {}

  /** Opens a two-player match and announces it in the group. */
  @Post("match/open")
  async matchOpen(@Req() req: MiniappRequest, @Body() body: { game?: string }) {
    const ctx = getMiniappContext(req);
    const profile = playerProfileFromInitData(ctx.user);
    return this.match.open(
      ctx.userId,
      ctx.startParam,
      String(body?.game ?? ""),
      profile.displayName ?? profile.username ?? null,
      { username: ctx.botUsername, token: ctx.botToken },
    );
  }

  /** Takes the open seat of an existing match. */
  @Post("match/join")
  async matchJoin(@Req() req: MiniappRequest, @Body() body: { id?: string }) {
    const ctx = getMiniappContext(req);
    const profile = playerProfileFromInitData(ctx.user);
    return this.match.join(
      ctx.userId,
      String(body?.id ?? ""),
      profile.displayName ?? profile.username ?? null,
      { username: ctx.botUsername, token: ctx.botToken },
    );
  }

  /** The current position — players and spectators alike. */
  @Post("match/state")
  async matchState(@Req() req: MiniappRequest, @Body() body: { id?: string }) {
    const ctx = getMiniappContext(req);
    return this.match.state(ctx.userId, String(body?.id ?? ""));
  }

  /**
   * Lo privado de quien pregunta: su palabra, su mano.
   *
   * No hay parametro para pedir el de otro. El id sale de initData verificado,
   * que el cliente no elige, asi que la unica forma de leer la palabra del
   * impostor por aqui es ser el impostor.
   */
  @Post("match/secret")
  async matchSecret(@Req() req: MiniappRequest, @Body() body: { id?: string }) {
    const ctx = getMiniappContext(req);
    return this.match.secret(ctx.userId, String(body?.id ?? ""));
  }

  /** Open invites in this group. */
  @Post("match/lobby")
  async matchLobby(@Req() req: MiniappRequest) {
    const ctx = getMiniappContext(req);
    return this.match.lobby(ctx.userId, ctx.startParam, {
      username: ctx.botUsername,
      token: ctx.botToken,
    });
  }

  @Post("match/move")
  async matchMove(
    @Req() req: MiniappRequest,
    @Body() body: { id?: string; index?: unknown; version?: unknown },
  ) {
    const ctx = getMiniappContext(req);
    return this.match.move(
      ctx.userId,
      String(body?.id ?? ""),
      body?.index,
      body?.version,
      { username: ctx.botUsername, token: ctx.botToken },
    );
  }

  // ─────────────────── cartas de colores ───────────────────
  //
  // Las unicas jugadas que no llegan por un boton del chat: una mano de siete
  // cartas no cabe en un teclado de Telegram, y ademas solo la puede ver una
  // persona. La mesa se refresca sola en el grupo desde el servicio.

  /** La mesa y TU mano. Quien no juega ve la mesa y nada mas. */
  @Post("cards/table")
  async cardsTable(@Req() req: MiniappRequest, @Body() body: { id?: string }) {
    const ctx = getMiniappContext(req);
    return this.cards.table(ctx.userId, String(body?.id ?? ""));
  }

  @Post("cards/play")
  async cardsPlay(
    @Req() req: MiniappRequest,
    @Body()
    body: { id?: string; card?: unknown; color?: unknown; version?: unknown },
  ) {
    const ctx = getMiniappContext(req);
    return this.cards.play(
      ctx.userId,
      String(body?.id ?? ""),
      body?.card,
      body?.color,
      body?.version,
      { username: ctx.botUsername, token: ctx.botToken },
    );
  }

  @Post("cards/draw")
  async cardsDraw(
    @Req() req: MiniappRequest,
    @Body() body: { id?: string; version?: unknown },
  ) {
    const ctx = getMiniappContext(req);
    return this.cards.draw(ctx.userId, String(body?.id ?? ""), body?.version, {
      username: ctx.botUsername,
      token: ctx.botToken,
    });
  }

  // ───────────────────── wordle del grupo ─────────────────────
  //
  // Un tablero por chat y seis intentos para todos, pero tecleado aqui: en un
  // mensaje de Telegram no hay teclado con las letras de colores.

  @Post("wordle/board")
  async wordleBoard(@Req() req: MiniappRequest, @Body() body: { id?: string }) {
    const ctx = getMiniappContext(req);
    return this.wordle.table(ctx.userId, String(body?.id ?? ""));
  }

  @Post("wordle/guess")
  async wordleGuess(
    @Req() req: MiniappRequest,
    @Body() body: { id?: string; word?: unknown; version?: unknown },
  ) {
    const ctx = getMiniappContext(req);
    return this.wordle.guess(
      ctx.userId,
      String(body?.id ?? ""),
      body?.word,
      body?.version,
      { username: ctx.botUsername, token: ctx.botToken },
    );
  }

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

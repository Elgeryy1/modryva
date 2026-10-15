import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  type GameMatchPlayerRepository,
  type GameMatchRecord,
  type GameMatchRepository,
  type PrismaClient,
  PrismaFoundationRepository,
  PrismaGameMatchPlayerRepository,
  PrismaGameMatchRepository,
  prisma,
} from "@superbot/data";
import {
  applyMove,
  emptyBoard,
  markFor,
  outcomeOf,
  parseBoard,
  type Seat,
  turnOf,
} from "@superbot/module-games";
import {
  buildMiniAppLink,
  decodeStartParam,
  getRuntimeEnv,
} from "@superbot/shared";
import { HttpTelegramGateway } from "@superbot/telegram";
import {
  type GroupLookup,
  type GroupMembershipGateway,
  resolveGroupForCaller,
} from "./group-binding.js";

/**
 * Matches between two real people, opened from the Mini App and advertised in
 * the group.
 *
 * The shape of the thing: the Mini App is where the game is played, the group
 * message is the lobby. When the seat is still free that message offers to
 * play; once somebody takes it, the same message offers to watch. One message,
 * mutated — not a second one — so the group never ends up with a live-looking
 * invite to a match that already started.
 */

interface BotScope {
  readonly username: string;
  readonly token: string;
}

/**
 * Lo que este servicio necesita de Telegram. Se declara aqui, en vez de exigir
 * el `HttpTelegramGateway` entero, para que un test pueda pasar un doble sin
 * implementar doscientos metodos que no usa.
 */
type MatchGateway = GroupMembershipGateway &
  Pick<HttpTelegramGateway, "sendMessage" | "editMessageText">;

/** Games that can be played by two people. Anything else is single-player. */
const TWO_PLAYER_GAMES: ReadonlySet<string> = new Set(["tictactoe"]);

const TITLES: Record<string, string> = { tictactoe: "Tres en raya" };

@Injectable()
export class MatchService {
  /**
   * Los repositorios entran por el constructor, con el de Prisma por defecto.
   *
   * Nest los sigue construyendo solo; lo que gana con esto es que un test
   * pueda pasar los dobles en memoria y probar ESTE metodo en vez de una copia
   * suya escrita al lado, que es lo unico que se podia hacer cuando eran
   * campos fijos.
   *
   * El gateway y el repositorio de chats bajaron aqui al añadir la
   * comprobacion de pertenencia: como campos fijos, cada test de partidas se
   * ponia a llamar a Telegram de verdad y tardaba cuatro segundos en rendirse.
   * Un control que solo se puede probar con red no se prueba.
   */
  constructor(
    private readonly client: PrismaClient = prisma,
    private readonly matches: GameMatchRepository = new PrismaGameMatchRepository(),
    private readonly seats: GameMatchPlayerRepository = new PrismaGameMatchPlayerRepository(),
    private readonly gateway: MatchGateway = new HttpTelegramGateway(),
    private readonly foundation: GroupLookup = new PrismaFoundationRepository(),
  ) {}

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

  /**
   * The Telegram group this session belongs to, taken from the start param.
   *
   * A match has to live in a group: the whole point is that the invite is
   * visible to other people. Opening the games hub from a private chat gives no
   * group id, and there is nowhere to advertise.
   */
  private groupIdFrom(startParam: string | null): bigint {
    const decoded = decodeStartParam(startParam);
    const raw =
      decoded?.kind === "game"
        ? decoded.groupId
        : decoded?.kind === "gamesHub"
          ? (decoded.groupId ?? null)
          : null;
    if (raw == null || !/^-?\d{1,20}$/u.test(raw)) {
      throw new BadRequestException({ error: "not-in-a-group" });
    }
    return BigInt(raw);
  }

  /**
   * El id del grupo, comprobando ademas que quien pregunta ESTA en el.
   *
   * `groupIdFrom` solo valida la SINTAXIS del id, y eso no autoriza nada: el
   * `start_param` lo elige quien construye el enlace, asi que sin esta segunda
   * mitad cualquiera podia abrir
   * `t.me/<bot>/<app>?startapp=games_<grupo_ajeno>` y hacer que el bot
   * publicara un mensaje con su nombre en un grupo del que ni siquiera es
   * miembro — incluso estando expulsado de el, que es la parte que de verdad
   * duele.
   *
   * Falla cerrado: si Telegram no contesta, no hay grupo.
   */
  private async groupForCaller(
    startParam: string | null,
    userId: string,
    tenantId: string,
    bot?: BotScope,
  ): Promise<bigint> {
    const telegramChatId = this.groupIdFrom(startParam);
    const permitido = await resolveGroupForCaller(
      { foundation: this.foundation, gateway: this.gateway },
      {
        tenantId,
        telegramChatId,
        telegramUserId: BigInt(userId),
        token: bot?.token ?? getRuntimeEnv().TELEGRAM_BOT_TOKEN,
      },
    );
    if (!permitido) {
      throw new ForbiddenException({ error: "not-in-a-group" });
    }
    return telegramChatId;
  }

  /** Everything a client may know about a match, from one seat's point of view. */
  private view(match: GameMatchRecord, viewerId: string) {
    const board = parseBoard(match.state) ?? emptyBoard();
    const viewer = BigInt(viewerId);
    const seat: Seat | null =
      match.hostId === viewer
        ? "host"
        : match.guestId === viewer
          ? "guest"
          : null;
    const outcome = outcomeOf(board);
    return {
      id: match.id,
      game: match.game,
      title: TITLES[match.game] ?? match.game,
      status: match.status,
      board,
      version: match.version,
      // Null for a spectator: they have no seat and nothing to play.
      seat,
      yourTurn:
        seat !== null &&
        match.status === "playing" &&
        turnOf(board) === markFor(seat),
      host: { id: match.hostId.toString(), name: match.hostName },
      guest: match.guestId
        ? { id: match.guestId.toString(), name: match.guestName }
        : null,
      result: match.result,
      outcome: outcome.status,
    };
  }

  /**
   * Opens a match and announces it in the group.
   *
   * The announcement is best-effort: a group the bot cannot post to must still
   * leave the host with a playable match rather than an error, because the
   * match itself already exists and the host is already looking at it.
   */
  async open(
    userId: string,
    startParam: string | null,
    game: string,
    displayName: string | null,
    bot?: BotScope,
  ) {
    if (!TWO_PLAYER_GAMES.has(game)) {
      throw new BadRequestException({ error: "not-two-player" });
    }
    const tenantId = await this.tenantId(bot);
    const chatId = await this.groupForCaller(startParam, userId, tenantId, bot);

    const match = await this.matches.create({
      tenantId,
      chatId,
      game,
      hostId: BigInt(userId),
      hostName: displayName,
      state: emptyBoard(),
    });

    const posted = await this.announce(match, displayName, bot).catch(
      () => null,
    );
    if (posted !== null) {
      await this.matches.attachMessage(match.id, posted).catch(() => undefined);
    }
    return { ...this.view(match, userId), announced: posted !== null };
  }

  /** Posts the lobby message; returns its id, or throws for the caller to swallow. */
  private async announce(
    match: GameMatchRecord,
    displayName: string | null,
    bot?: BotScope,
  ): Promise<number | null> {
    const token = bot?.token ?? getRuntimeEnv().TELEGRAM_BOT_TOKEN;
    const who = displayName ?? "Alguien";
    const title = TITLES[match.game] ?? match.game;
    const sent = await this.gateway.sendMessage({
      chatId: match.chatId,
      token,
      reply: {
        text: `🎮 ${who} busca con quién jugar a ${title}.`,
        replyMarkup: {
          inline_keyboard: [
            [{ text: "🎮 Jugar", url: this.matchLink(match.id, bot) }],
          ],
        },
      },
    });
    return sent.messageId ?? null;
  }

  /** Deep link straight into this match inside the Mini App. */
  private matchLink(matchId: string, bot?: BotScope): string {
    const env = getRuntimeEnv();
    return buildMiniAppLink(
      (bot?.username ?? env.TELEGRAM_BOT_USERNAME).replace(/^@/u, ""),
      env.TELEGRAM_MINIAPP_NAME,
      `m_${matchId}`,
    );
  }

  /**
   * Takes the open seat, and turns the lobby message into a spectator link.
   *
   * The button swap is what stops a queue of people tapping "jugar" on a match
   * that filled seconds ago — they would all be refused, one after another, by
   * a message still telling them to try.
   */
  async join(
    userId: string,
    matchId: string,
    displayName: string | null,
    bot?: BotScope,
  ) {
    const res = await this.matches.join(matchId, BigInt(userId), displayName);
    if (!res.ok) {
      if (res.reason === "gone") {
        throw new NotFoundException({ error: "match-gone" });
      }
      if (res.reason === "own-match") {
        throw new BadRequestException({ error: "own-match" });
      }
      throw new BadRequestException({ error: "seat-taken" });
    }
    await this.updateLobby(res.match, bot).catch(() => undefined);
    return this.view(res.match, userId);
  }

  /** Rewrites the lobby message for a match that is no longer open. */
  private async updateLobby(
    match: GameMatchRecord,
    bot?: BotScope,
  ): Promise<void> {
    if (match.messageId === null) {
      return;
    }
    const token = bot?.token ?? getRuntimeEnv().TELEGRAM_BOT_TOKEN;
    const title = TITLES[match.game] ?? match.game;
    const host = match.hostName ?? "Alguien";
    const guest = match.guestName ?? "alguien";
    const finished = match.status === "finished";
    const text = finished
      ? `🎮 ${title}: ${host} vs ${guest} — partida terminada.`
      : `🎮 ${title}: ${host} vs ${guest}. ¡Están jugando!`;
    await this.gateway.editMessageText({
      chatId: match.chatId,
      messageId: match.messageId,
      token,
      reply: {
        text,
        ...(finished
          ? {}
          : {
              replyMarkup: {
                inline_keyboard: [
                  [
                    {
                      text: "👀 Ver la partida",
                      url: this.matchLink(match.id, bot),
                    },
                  ],
                ],
              },
            }),
      },
    });
  }

  /** The current position, for a player OR a spectator. */
  async state(userId: string, matchId: string) {
    const match = await this.matches.find(matchId);
    if (!match) {
      throw new NotFoundException({ error: "match-gone" });
    }
    return this.view(match, userId);
  }

  /** Open invites in this group, so the hub can offer to join instead of open. */
  async lobby(userId: string, startParam: string | null, bot?: BotScope) {
    const tenantId = await this.tenantId(bot);
    const chatId = await this.groupForCaller(startParam, userId, tenantId, bot);
    const rows = await this.matches.listOpen(tenantId, chatId);
    return {
      rows: rows
        // Your own invite is not something you can accept.
        .filter((m) => m.hostId !== BigInt(userId))
        .map((m) => ({
          id: m.id,
          game: m.game,
          title: TITLES[m.game] ?? m.game,
          host: m.hostName,
        })),
    };
  }

  /**
   * Plays one move.
   *
   * `expectedVersion` comes from the state the client drew, so a tap decided
   * against a stale board is refused rather than applied to a different one —
   * the realistic case being two taps in flight at once from the same person.
   */
  async move(
    userId: string,
    matchId: string,
    index: unknown,
    expectedVersion: unknown,
    bot?: BotScope,
  ) {
    const match = await this.matches.find(matchId);
    if (!match) {
      throw new NotFoundException({ error: "match-gone" });
    }
    if (match.status !== "playing") {
      throw new BadRequestException({ error: "not-playing" });
    }
    const viewer = BigInt(userId);
    const seat: Seat | null =
      match.hostId === viewer
        ? "host"
        : match.guestId === viewer
          ? "guest"
          : null;
    if (seat === null) {
      // Spectators can watch and nothing else.
      throw new ForbiddenException({ error: "not-a-player" });
    }
    if (
      !Number.isInteger(expectedVersion) ||
      expectedVersion !== match.version
    ) {
      throw new BadRequestException({ error: "stale-board" });
    }
    const board = parseBoard(match.state);
    if (board === null) {
      throw new ServiceUnavailableException({ error: "corrupt-match" });
    }
    const played = applyMove(board, seat, Number(index));
    if (!played.ok) {
      throw new BadRequestException({ error: played.reason });
    }
    const outcome = outcomeOf(played.board);
    const status = outcome.status === "playing" ? "playing" : "finished";
    const result =
      outcome.status === "won"
        ? outcome.seat
        : outcome.status === "draw"
          ? "draw"
          : null;

    const committed = await this.matches.commitMove({
      id: matchId,
      expectedVersion: match.version,
      state: played.board,
      status,
      result,
    });
    if (!committed.ok) {
      throw new BadRequestException({ error: "stale-board" });
    }
    if (status === "finished") {
      await this.updateLobby(committed.match, bot).catch(() => undefined);
    }
    return this.view(committed.match, userId);
  }

  /**
   * Lo que solo puede ver quien pregunta: su palabra en El Impostor, su mano
   * de cartas.
   *
   * Este endpoint es la razon de que exista la Mini App autenticada. Un chat de
   * grupo no tiene ningun canal privado —todo lo que el bot escribe alli lo lee
   * todo el mundo— asi que el reparto es: lo publico en el chat, esto aqui,
   * detras de un initData verificado.
   *
   * Devuelve el secreto de UNA persona y solo la suya. No hay parametro para
   * pedir el de otro; el id sale de initData, que el cliente no elige. La forma
   * de sacarle a este metodo la palabra del impostor es ser el impostor.
   *
   * Quien no juega esa partida recibe null, no un error: distinguir "no juegas"
   * de "no existe" le diria a cualquiera si una partida existe y quien esta en
   * ella con solo probar ids.
   */
  async secret(userId: string, matchId: string) {
    if (!matchId) {
      throw new BadRequestException({ error: "missing-id" });
    }
    const match = await this.matches.find(matchId);
    if (!match) {
      return { matchId, game: null, secret: null };
    }
    const secret = await this.seats.secretFor(matchId, BigInt(userId));
    const roster = await this.seats.roster(matchId);
    return {
      matchId,
      game: match.game,
      status: match.status,
      // El roster va sin secretos por construccion: ver el repositorio.
      players: roster.map((p) => ({
        id: p.userId.toString(),
        name: p.name,
        seatIndex: p.seatIndex,
        status: p.status,
      })),
      secret,
    };
  }
}

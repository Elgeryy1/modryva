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
  PrismaGameMatchPlayerRepository,
  PrismaGameMatchRepository,
} from "@superbot/data";
import { colorCards, seedFrom } from "@superbot/module-games";
import { buildMiniAppLink, getRuntimeEnv } from "@superbot/shared";
import { HttpTelegramGateway } from "@superbot/telegram";

/**
 * Las cartas de colores, jugadas desde la Mini App.
 *
 * Es el unico juego cuyas jugadas NO llegan por un boton del chat: una mano de
 * siete cartas no cabe en un teclado de Telegram, y ademas solo la puede ver
 * una persona. Asi que la mesa vive en el chat —editada, nunca reenviada— y la
 * mano vive aqui, detras de un initData verificado.
 *
 * El reparto de responsabilidades no cambia: las reglas estan en
 * `modules/games/color-cards.ts` y este fichero no decide nada del juego. Lo
 * que hace es traducir entre como se guarda (estado compartido + una mano por
 * asiento) y como se juega (el estado entero), que es la parte que no puede
 * vivir en un modulo puro porque necesita la base de datos.
 */

interface BotScope {
  readonly username: string;
  readonly token: string;
}

/** Lo que el cliente puede ver de una partida: la mesa y SU mano. */
export interface CardsTableView {
  readonly matchId: string;
  readonly version: number;
  /** Null cuando quien pregunta no juega, o la partida no existe. */
  readonly seat: number | null;
  readonly hand: readonly colorCards.Card[];
  /** Las que puede tirar ahora mismo. Vacia si no es su turno. */
  readonly playable: readonly colorCards.Card[];
  readonly table: colorCards.PublicView | null;
  readonly players: readonly {
    readonly seat: number;
    readonly name: string | null;
    readonly cards: number;
  }[];
}

const isColor = (value: unknown): value is colorCards.Color =>
  typeof value === "string" &&
  (colorCards.COLORS as readonly string[]).includes(value);

@Injectable()
export class CardsService {
  private readonly gateway = new HttpTelegramGateway();

  constructor(
    private readonly matches: GameMatchRepository = new PrismaGameMatchRepository(),
    private readonly seats: GameMatchPlayerRepository = new PrismaGameMatchPlayerRepository(),
  ) {}

  /**
   * Reconstruye el estado completo juntando lo compartido con TODAS las manos.
   *
   * Hace falta el estado entero porque el motor es puro y no sabe de tablas: no
   * se le puede pedir que juegue una carta sabiendo solo una mano. Lo que este
   * metodo devuelve nunca sale de este servicio sin pasar por {@link viewFor},
   * que es quien recorta lo que ve cada uno.
   */
  private async loadFull(match: GameMatchRecord): Promise<{
    state: colorCards.ColorCardsState;
    seatOf: Map<string, number>;
    names: Map<number, string | null>;
  } | null> {
    const shared = match.state as Omit<colorCards.ColorCardsState, "hands">;
    if (
      typeof shared !== "object" ||
      shared === null ||
      !Array.isArray((shared as { seats?: unknown }).seats)
    ) {
      return null;
    }

    const roster = await this.seats.roster(match.id);
    const hands: Record<number, readonly colorCards.Card[]> = {};
    const seatOf = new Map<string, number>();
    const names = new Map<number, string | null>();

    for (const seat of roster) {
      seatOf.set(seat.userId.toString(), seat.seatIndex);
      names.set(seat.seatIndex, seat.name);
      const secret = await this.seats.secretFor(match.id, seat.userId);
      const mano = (secret as { hand?: unknown } | null)?.hand;
      hands[seat.seatIndex] = Array.isArray(mano)
        ? (mano as colorCards.Card[])
        : [];
    }

    const state = colorCards.mergeState(shared, hands);
    return colorCards.isValidColorCardsState(state)
      ? { state, seatOf, names }
      : null;
  }

  /** Lo que se le devuelve a UNA persona: la mesa entera y solo su mano. */
  private viewFor(
    match: GameMatchRecord,
    state: colorCards.ColorCardsState,
    seat: number | null,
    names: Map<number, string | null>,
  ): CardsTableView {
    const mano = seat === null ? [] : (state.hands[seat] ?? []);
    return {
      matchId: match.id,
      version: match.version,
      seat,
      hand: mano,
      // Solo tiene sentido ofrecer jugadas cuando es tu turno; calcularlas
      // fuera de turno invita a pintar cartas resaltadas que no se pueden
      // tirar todavia.
      playable:
        seat !== null && state.turnSeat === seat && !state.finished
          ? colorCards.playableCards(state, seat)
          : [],
      table: colorCards.publicView(state),
      players: state.seats.map((s) => ({
        seat: s,
        name: names.get(s) ?? null,
        cards: (state.hands[s] ?? []).length,
      })),
    };
  }

  /** Una partida de cartas viva, o el error que corresponda. */
  private async loadMatch(matchId: string): Promise<GameMatchRecord> {
    if (!matchId) {
      throw new BadRequestException({ error: "missing-id" });
    }
    const match = await this.matches.find(matchId);
    if (match?.game !== "cartas") {
      throw new NotFoundException({ error: "match-gone" });
    }
    return match;
  }

  /**
   * La mesa, para pintarla.
   *
   * Quien no juega recibe `seat: null` y mano vacia, pero SI ve la mesa: mirar
   * una partida ajena no le da ventaja a nadie, y en un grupo la gente entra a
   * curiosear constantemente.
   */
  async table(userId: string, matchId: string): Promise<CardsTableView> {
    const match = await this.loadMatch(matchId);
    const full = await this.loadFull(match);
    if (!full) {
      throw new ServiceUnavailableException({ error: "corrupt-match" });
    }
    const seat = full.seatOf.get(userId) ?? null;
    return this.viewFor(match, full.state, seat, full.names);
  }

  /** Tira una carta. `color` solo para comodines, y es obligatorio ahi. */
  async play(
    userId: string,
    matchId: string,
    card: unknown,
    color: unknown,
    expectedVersion: unknown,
    bot?: BotScope,
  ): Promise<CardsTableView> {
    const match = await this.loadMatch(matchId);
    const full = await this.loadFull(match);
    if (!full) {
      throw new ServiceUnavailableException({ error: "corrupt-match" });
    }
    const seat = full.seatOf.get(userId);
    if (seat === undefined) {
      throw new ForbiddenException({ error: "not-a-player" });
    }
    // La version que trae el cliente es la que vio al pintar. Si no coincide,
    // alguien ha jugado entremedias y su pantalla esta vieja: se le rechaza
    // para que no tire a ciegas sobre una mesa que ya no existe.
    if (
      !Number.isInteger(expectedVersion) ||
      expectedVersion !== match.version
    ) {
      throw new BadRequestException({ error: "stale-table" });
    }
    if (typeof card !== "string" || card.length === 0) {
      throw new BadRequestException({ error: "missing-card" });
    }

    const played = colorCards.playCard(
      full.state,
      seat,
      card,
      isColor(color) ? color : undefined,
    );
    if (!played.ok) {
      throw new BadRequestException({ error: played.error });
    }

    const linea = colorCards.describeMove({
      who: full.names.get(seat) ?? `Asiento ${seat}`,
      card,
      ...(isColor(color) && colorCards.isWild(card)
        ? { chosenColor: color }
        : {}),
      cardsLeft: (played.state.hands[seat] ?? []).length,
    });
    return this.commit(match, played.state, seat, full.names, linea, bot);
  }

  /** Roba: una carta, o todas las del castigo pendiente. */
  async draw(
    userId: string,
    matchId: string,
    expectedVersion: unknown,
    bot?: BotScope,
  ): Promise<CardsTableView> {
    const match = await this.loadMatch(matchId);
    const full = await this.loadFull(match);
    if (!full) {
      throw new ServiceUnavailableException({ error: "corrupt-match" });
    }
    const seat = full.seatOf.get(userId);
    if (seat === undefined) {
      throw new ForbiddenException({ error: "not-a-player" });
    }
    if (
      !Number.isInteger(expectedVersion) ||
      expectedVersion !== match.version
    ) {
      throw new BadRequestException({ error: "stale-table" });
    }

    // La semilla sale del id de la partida y de la version, asi que el robo es
    // reproducible: la misma mesa robada dos veces saca las mismas cartas, y
    // reintentar una peticion perdida no cambia la baraja.
    const drawn = colorCards.drawCards(
      full.state,
      seat,
      seedFrom(`${match.id}:${match.version}`),
    );
    if (!drawn.ok) {
      throw new BadRequestException({ error: drawn.error });
    }

    const linea = colorCards.describeMove({
      who: full.names.get(seat) ?? `Asiento ${seat}`,
      drew: drawn.drawn.length,
      cardsLeft: (drawn.state.hands[seat] ?? []).length,
    });
    return this.commit(match, drawn.state, seat, full.names, linea, bot);
  }

  /**
   * El historial de la partida, guardado junto al estado compartido.
   *
   * NO forma parte del estado del juego: el motor no lo lee, no lo valida y no
   * decide nada con el. Vive ahi por lo prosaico — es lo unico que se guarda
   * por partida y sobrevive entre peticiones — y por eso se lee y se escribe
   * solo aqui, con un tope de lineas para que el mensaje no tape el chat.
   */
  private static logOf(match: GameMatchRecord): readonly string[] {
    const raw = (match.state as { log?: unknown } | null)?.log;
    return Array.isArray(raw)
      ? (raw.filter((l) => typeof l === "string") as string[])
      : [];
  }

  /**
   * Guarda una jugada: estado compartido, manos por asiento y mesa del chat.
   *
   * El orden importa. Primero el estado compartido con bloqueo optimista: si
   * esa escritura pierde la carrera, no se ha tocado ninguna mano y la jugada
   * no ha pasado. Repartir las manos primero dejaria cartas movidas en una
   * partida cuyo estado no avanzo.
   */
  private async commit(
    match: GameMatchRecord,
    next: colorCards.ColorCardsState,
    seat: number,
    names: Map<number, string | null>,
    move: string,
    bot?: BotScope,
  ): Promise<CardsTableView> {
    const { shared, hands } = colorCards.splitState(next);
    const log = colorCards.pushMove(CardsService.logOf(match), move);
    const committed = await this.matches.commitMove({
      id: match.id,
      expectedVersion: match.version,
      state: { ...shared, log },
      status: next.finished ? "finished" : "playing",
      result: next.winner === null ? null : String(next.winner),
    });
    if (!committed.ok) {
      throw new BadRequestException({ error: "stale-table" });
    }

    const roster = await this.seats.roster(match.id);
    await this.seats.dealSecrets(
      match.id,
      new Map(
        roster.map((s) => [s.userId, { hand: hands[s.seatIndex] ?? [] }]),
      ),
    );

    await this.refreshChat(committed.match, next, names, log, bot).catch(
      () => undefined,
    );
    return this.viewFor(committed.match, next, seat, names);
  }

  /**
   * Refresca la mesa en el chat del grupo.
   *
   * Edita SIEMPRE el mismo mensaje, nunca manda uno nuevo. Una partida de
   * cuatro son unas sesenta tiradas: un mensaje por tirada convertiria el grupo
   * en un teletipo. Si no hay mensaje que editar —porque la partida se repartio
   * antes de que esto existiera— no pasa nada y el grupo simplemente no se
   * entera; la Mini App sigue siendo la verdad.
   */
  private async refreshChat(
    match: GameMatchRecord,
    state: colorCards.ColorCardsState,
    names: Map<number, string | null>,
    log: readonly string[],
    bot?: BotScope,
  ): Promise<void> {
    if (match.messageId === null || match.messageId === undefined) {
      return;
    }
    const token = bot?.token ?? getRuntimeEnv().TELEGRAM_BOT_TOKEN;
    await this.gateway.editMessageText({
      chatId: match.chatId,
      messageId: match.messageId,
      token,
      reply: {
        text: colorCards.renderTable(state, names, log),
        parseMode: "HTML",
        ...(state.finished
          ? {}
          : {
              replyMarkup: {
                inline_keyboard: [
                  [
                    {
                      text: "🔒 Mi mano",
                      url: this.miniAppLink(match.id, bot),
                    },
                  ],
                ],
              },
            }),
      },
    });
  }

  /**
   * El enlace a la Mini App, con el constructor compartido.
   *
   * Escrito a mano ponia `/app`, y el nombre corto real sale de
   * `TELEGRAM_MINIAPP_NAME` — que por defecto es `config`. El efecto era
   * exactamente el que se ve jugando: el boton que pone el bot al repartir
   * funciona, y en cuanto alguien tira una carta este metodo reescribe el
   * mensaje con un enlace muerto. Entras una vez y no puedes volver.
   *
   * De ahi que use `buildMiniAppLink` como el resto: un enlace de Telegram
   * tiene tres piezas y dos de ellas son configuracion. Ninguna se adivina.
   */
  private miniAppLink(matchId: string, bot?: BotScope): string {
    const env = getRuntimeEnv();
    return buildMiniAppLink(
      (bot?.username ?? env.TELEGRAM_BOT_USERNAME).replace(/^@/u, ""),
      env.TELEGRAM_MINIAPP_NAME,
      `m_${matchId}`,
    );
  }
}

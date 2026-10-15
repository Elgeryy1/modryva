import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  type GameMatchRecord,
  type GameMatchRepository,
  PrismaGameMatchRepository,
} from "@superbot/data";
import { groupWordle } from "@superbot/module-games";
import { buildMiniAppLink, getRuntimeEnv } from "@superbot/shared";
import { HttpTelegramGateway } from "@superbot/telegram";

/**
 * El wordle del grupo, jugado desde la Mini App.
 *
 * Antes se jugaba escribiendo la palabra en el chat. Se movio aqui por
 * decision de Gerard: en pantalla hay teclado de verdad con las letras de
 * colores, que en un mensaje de Telegram no se puede hacer.
 *
 * Lo que NO cambia es que la partida es del grupo: un tablero, seis intentos
 * para todos, y las mismas dos reglas de convivencia (no repetir palabra, no
 * encadenar mas de dos intentos seguidos). El tablero se sigue viendo en el
 * chat, editado en el mismo mensaje, para que el grupo se entere sin abrir
 * nada.
 */

interface BotScope {
  readonly username: string;
  readonly token: string;
}

export interface WordleView {
  readonly matchId: string;
  readonly version: number;
  readonly attempts: readonly {
    readonly word: string;
    readonly marks: readonly groupWordle.Mark[];
    readonly mine: boolean;
  }[];
  readonly finished: boolean;
  readonly solved: boolean;
  /** La respuesta, SOLO cuando la partida ha terminado. */
  readonly answer: string | null;
  readonly attemptsLeft: number;
  readonly wordLength: number;
  /** Mejor noticia por letra, para pintar el teclado. */
  readonly letters: Readonly<Record<string, groupWordle.Mark>>;
  /** Si esta persona puede tirar ahora, y si no, por que. */
  readonly canGuess: boolean;
  readonly blockedReason: "finished" | "hogging" | null;
}

@Injectable()
export class WordleService {
  private readonly gateway = new HttpTelegramGateway();

  constructor(
    private readonly matches: GameMatchRepository = new PrismaGameMatchRepository(),
  ) {}

  private async load(matchId: string): Promise<{
    match: GameMatchRecord;
    state: groupWordle.WordleState;
  }> {
    if (!matchId) {
      throw new BadRequestException({ error: "missing-id" });
    }
    const match = await this.matches.find(matchId);
    if (match?.game !== "wordle") {
      throw new NotFoundException({ error: "match-gone" });
    }
    if (!groupWordle.isValidWordleState(match.state)) {
      throw new ServiceUnavailableException({ error: "corrupt-match" });
    }
    return { match, state: match.state };
  }

  /**
   * El tablero.
   *
   * La respuesta solo viaja cuando la partida ha terminado. Mientras se juega
   * no sale de aqui por ningun camino — quien abriera las herramientas del
   * navegador la leeria y se acabo el juego para todo el grupo.
   */
  private view(
    match: GameMatchRecord,
    state: groupWordle.WordleState,
    userId: string,
  ): WordleView {
    const hogging = groupWordle.isHogging(state, userId);
    return {
      matchId: match.id,
      version: match.version,
      attempts: state.attempts.map((a) => ({
        word: a.word,
        marks: a.marks,
        mine: a.playerId === userId,
      })),
      finished: state.finished,
      solved: state.solvedBy !== null,
      answer: state.finished ? state.answer : null,
      attemptsLeft: groupWordle.attemptsLeft(state),
      wordLength: groupWordle.WORD_LENGTH,
      letters: groupWordle.letterMarks(state),
      canGuess: !state.finished && !hogging,
      blockedReason: state.finished ? "finished" : hogging ? "hogging" : null,
    };
  }

  async table(userId: string, matchId: string): Promise<WordleView> {
    const { match, state } = await this.load(matchId);
    return this.view(match, state, userId);
  }

  /** Un intento. Las reglas las pone el motor; aqui solo se guarda. */
  async guess(
    userId: string,
    matchId: string,
    word: unknown,
    expectedVersion: unknown,
    bot?: BotScope,
  ): Promise<WordleView> {
    const { match, state } = await this.load(matchId);
    if (
      !Number.isInteger(expectedVersion) ||
      expectedVersion !== match.version
    ) {
      throw new BadRequestException({ error: "stale-board" });
    }
    if (typeof word !== "string") {
      throw new BadRequestException({ error: "missing-word" });
    }

    const res = groupWordle.submitGuess(state, word, userId);
    if (!res.ok) {
      throw new BadRequestException({ error: res.error });
    }

    const committed = await this.matches.commitMove({
      id: match.id,
      expectedVersion: match.version,
      state: res.state,
      // "open" mientras se juega: es lo que impide abrir un segundo wordle en
      // el mismo chat, que compartiria palabra y no tendria ninguna gracia.
      status: res.state.finished ? "finished" : "open",
      result: res.solved ? "host" : res.state.finished ? "draw" : null,
    });
    if (!committed.ok) {
      throw new BadRequestException({ error: "stale-board" });
    }

    await this.refreshChat(committed.match, res.state, bot).catch(
      () => undefined,
    );
    return this.view(committed.match, res.state, userId);
  }

  /**
   * El tablero en el chat del grupo.
   *
   * Se edita el mismo mensaje, nunca se manda uno nuevo. Es lo que sostiene la
   * parte social del juego ahora que las palabras se escriben en otra
   * pantalla: quien no abra nada sigue viendo como va.
   */
  private async refreshChat(
    match: GameMatchRecord,
    state: groupWordle.WordleState,
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
        text: renderWordleChat(state),
        parseMode: "HTML",
        ...(state.finished
          ? {}
          : {
              replyMarkup: {
                inline_keyboard: [
                  [
                    {
                      text: "⌨️ Jugar",
                      url: this.miniAppLink(match.id, bot),
                    },
                  ],
                ],
              },
            }),
      },
    });
  }

  private miniAppLink(matchId: string, bot?: BotScope): string {
    const env = getRuntimeEnv();
    return buildMiniAppLink(
      (bot?.username ?? env.TELEGRAM_BOT_USERNAME).replace(/^@/u, ""),
      env.TELEGRAM_MINIAPP_NAME,
      `m_${matchId}`,
    );
  }
}

const escapeHtml = (text: string): string =>
  text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");

/**
 * Lo que ve el grupo en el chat.
 *
 * Lleva las palabras probadas ademas de los cuadrados: son publicas —las tiro
 * alguien del grupo— y sin ellas el tablero del chat no dice nada util. La
 * respuesta solo aparece cuando ya no hay nada que estropear.
 */
export const renderWordleChat = (state: groupWordle.WordleState): string => {
  const lineas = [
    `🟩 <b>Wordle del grupo</b> — ${groupWordle.attemptsLeft(state)}/${groupWordle.MAX_ATTEMPTS} intentos`,
  ];
  if (state.attempts.length > 0) {
    lineas.push("", groupWordle.renderBoard(state));
  }
  const fuera = groupWordle.discardedLetters(state);
  if (fuera.length > 0 && !state.finished) {
    lineas.push("", `Descartadas: ${fuera.join(" ")}`);
  }
  if (state.finished) {
    lineas.push(
      "",
      state.solvedBy
        ? `✅ <b>¡Acertada!</b> Era <b>${escapeHtml(state.answer)}</b>.`
        : `❌ <b>Se acabaron los intentos.</b> Era <b>${escapeHtml(state.answer)}</b>.`,
    );
  } else {
    lineas.push("", "<i>Abre el teclado para probar una palabra.</i>");
  }
  return lineas.join("\n");
};

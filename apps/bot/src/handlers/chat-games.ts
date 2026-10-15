import type {
  GameMatchPlayerRepository,
  GameMatchRecord,
  GameMatchRepository,
} from "@superbot/data";
import type { BotReply, TelegramUpdateEnvelope } from "@superbot/domain";
import {
  colorCards,
  connectFour,
  creditRanking,
  groupWordle,
  // Ahorcado y wordle viven planos en el barrel; el resto entra con apellido
  // porque comparten nombres (MIN_PLAYERS, applyMove, Seat...).
  guessLetter,
  guessWord,
  type HangmanState,
  impostor,
  isLost,
  isSolved,
  isValidHangmanState,
  missedLetters,
  renderGallows,
  renderMask,
  rps,
  seedFrom,
  startHangman,
} from "@superbot/module-games";
import { extractCallbackMessageId } from "../delivery.js";

/**
 * Las partidas, jugadas DENTRO del chat.
 *
 * La diferencia con lo que ya habia (`apps/api/src/games/match.service.ts`) es
 * donde se juega: alli el mensaje del grupo era un cartel con un enlace y la
 * partida pasaba en la Mini App. Aqui el tablero ES el mensaje. Nadie tiene que
 * salir de la conversacion, que es la unica forma de que un juego de grupo se
 * juegue de verdad — un enlace que hay que abrir ya ha perdido a la mitad.
 *
 * Lo privado sigue yendo por la Mini App: la palabra del impostor y la mano de
 * cartas no caben en un chat de grupo sin enseñarselas a todos. Ese es el
 * reparto: publico en el chat, privado en la Mini App autenticada.
 *
 * Este fichero es solo el cableado. Las reglas estan en `modules/games` y no se
 * repiten aqui; si algo decide quien gana y esta escrito en este fichero, esta
 * en el sitio equivocado.
 */

/** Prefijo de todos los callbacks de este modulo. */
export const CG = "cg";

/** Los juegos que se pueden abrir desde el chat. */
export type ChatGame =
  | "conecta4"
  | "ppt"
  | "ahorcado"
  | "wordle"
  | "impostor"
  | "cartas";

interface GameSpec {
  readonly key: ChatGame;
  readonly title: string;
  readonly emoji: string;
  /** Cuantos asientos hace falta llenar antes de empezar. */
  readonly minPlayers: number;
  readonly maxPlayers: number;
  /** Si hay algo que solo puede ver una persona: va por la Mini App. */
  readonly hasSecrets: boolean;
  readonly howTo: string;
}

export const GAMES: readonly GameSpec[] = [
  {
    key: "conecta4",
    title: "Conecta 4",
    emoji: "🔴",
    minPlayers: 2,
    maxPlayers: 2,
    hasSecrets: false,
    howTo: "Pulsa una columna para soltar tu ficha.",
  },
  {
    key: "ppt",
    title: "Piedra, papel o tijera",
    emoji: "✂️",
    minPlayers: 2,
    maxPlayers: 2,
    hasSecrets: false,
    howTo: "Al mejor de 3. Nadie ve tu tirada hasta que tira el otro.",
  },
  {
    key: "ahorcado",
    title: "Ahorcado",
    emoji: "🎯",
    minPlayers: 1,
    maxPlayers: 1,
    hasSecrets: false,
    howTo: "Escribe una letra en el chat. Juega el grupo entero.",
  },
  {
    key: "wordle",
    title: "Wordle del grupo",
    emoji: "🟩",
    minPlayers: 1,
    maxPlayers: 1,
    hasSecrets: false,
    howTo: "Teclado en la Mini App. Seis intentos para todo el grupo.",
  },
  {
    key: "impostor",
    title: "El Impostor",
    emoji: "🕵️",
    minPlayers: impostor.MIN_PLAYERS,
    maxPlayers: impostor.MAX_PLAYERS,
    hasSecrets: true,
    howTo:
      "Cada uno recibe una palabra; a uno le toca otra. Pistas con /pista.",
  },
  {
    key: "cartas",
    title: "Cartas de colores",
    emoji: "🎴",
    minPlayers: 2,
    maxPlayers: colorCards.MAX_PLAYERS,
    hasSecrets: true,
    howTo: "Mismo color o misma figura. Tu mano solo la ves tú.",
  },
];

export const gameSpec = (key: string): GameSpec | null =>
  GAMES.find((g) => g.key === key) ?? null;

/**
 * Los que se juegan escribiendo en el chat.
 *
 * Solo el ahorcado. El wordle se movio a la Mini App —teclado de verdad con
 * las letras de colores, que en un mensaje de Telegram no se puede hacer— y
 * dejar tambien el camino del chat abierto daria dos formas de tirar la misma
 * palabra sobre el mismo tablero.
 *
 * Aparte de este conjunto, tanto el ahorcado como el wordle se quedan en estado
 * "open" MIENTRAS se juegan y no pasan a "playing". Para ellos "abierta" es
 * literal —cualquiera tira en cualquier momento— y ademas es lo unico que los
 * mantiene localizables por chat: la partida viva se busca con `listOpen`, asi
 * que pasarlos a "playing" tras la primera jugada los hacia invisibles y el
 * juego se moria despues de una letra.
 */
const TYPED_IN_CHAT: ReadonlySet<ChatGame> = new Set(["ahorcado"]);

/** Lo que este modulo necesita del mundo. Todo lo demas es puro. */
export interface ChatGamesPorts {
  readonly matches: GameMatchRepository;
  readonly players: GameMatchPlayerRepository;
  /** Enlace profundo a la Mini App para ver lo privado de una partida. */
  miniAppLink(matchId: string): string;
  /** Dia actual. Se usa como numero de puzle al compartir el resultado. */
  today(): number;
  /**
   * Un numero que cambia entre partidas, para elegir palabra.
   *
   * Separado de `today()` a proposito: con el dia como semilla, la segunda
   * partida del mismo grupo el mismo dia repetia palabra. No hace falta que
   * sea reproducible —la respuesta se guarda en el estado de la partida en
   * cuanto empieza— solo que varie. Inyectado para poder fijarlo en pruebas.
   */
  seed(): number;
  /**
   * Publica un tablero y devuelve su `message_id`.
   *
   * Existe porque el wordle se juega en la Mini App: sus jugadas no vuelven por
   * ningun callback, asi que para poder refrescar el tablero del grupo despues
   * hay que saber QUE mensaje editar — y eso solo se sabe habiendolo enviado.
   * Devolver un `BotReply` y dejar que lo mande la capa de entrega no sirve
   * aqui: ese camino no informa del id de vuelta.
   */
  postBoard(chatId: bigint, reply: BotReply): Promise<number | undefined>;
  /**
   * Paga a quien gana una partida, en la moneda del grupo, y devuelve cuanto
   * (o null si no hubo premio: moneda apagada, premio a 0 o ya pagada).
   *
   * Opcional a proposito: sin el puerto no se paga y todo lo demas sigue igual,
   * asi que los dobles de prueba que solo miran tableros no tienen que saber
   * nada de economia.
   *
   * Solo se llama en los juegos 1v1 donde `result` señala a una persona
   * concreta. El ahorcado y el impostor terminan con un resultado colectivo, y
   * repartir ahi exigiria decidir a quien —¿el que acerto?, ¿los
   * supervivientes?— que es una decision de diseño, no un detalle.
   */
  awardMatchWinner?(input: {
    tenantId: string;
    telegramChatId: bigint;
    matchId: string;
    winnerTelegramId: bigint;
  }): Promise<number | null>;
}

const escapeHtml = (text: string): string =>
  text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");

/** Quien gano, a partir del `result` de una partida 1v1. */
const winnerIdOf = (match: GameMatchRecord): bigint | null => {
  if (match.status !== "finished") {
    return null;
  }
  if (match.result === "host") {
    return match.hostId;
  }
  // Un empate no paga: en piedra-papel-tijera se repite la ronda, y en conecta
  // cuatro nadie ha ganado.
  return match.result === "guest" ? match.guestId : null;
};

/** Reparte una lista en filas. Para teclados: Telegram no las parte solo. */
const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const filas: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    filas.push(items.slice(i, i + size));
  }
  return filas;
};

const nameOf = (update: TelegramUpdateEnvelope): string =>
  update.user.firstName ??
  (update.user.username ? `@${update.user.username}` : "Alguien");

/** Callback: `cg:<accion>:<matchId>[:<arg>]`. */
export interface ChatGameCallback {
  readonly action: string;
  readonly matchId: string;
  readonly arg: string | null;
}

export const parseChatGameCallback = (
  data: string | undefined,
): ChatGameCallback | null => {
  if (!data?.startsWith(`${CG}:`)) {
    return null;
  }
  const [, action, matchId, ...rest] = data.split(":");
  if (!action || !matchId) {
    return null;
  }
  return { action, matchId, arg: rest.length > 0 ? rest.join(":") : null };
};

export const buildChatGameCallback = (
  action: string,
  matchId: string,
  arg?: string,
): string =>
  arg === undefined
    ? `${CG}:${action}:${matchId}`
    : `${CG}:${action}:${matchId}:${arg}`;

/** El menu de `/juegos`. */
export const buildGamesMenu = (): BotReply => ({
  text: [
    "<b>🎮 Juegos del grupo</b>",
    "",
    ...GAMES.map((g) => `${g.emoji} <b>${g.title}</b> — ${g.howTo}`),
    "",
    "<i>Abre uno con /jugar y el nombre. Ejemplo: <code>/jugar conecta4</code></i>",
  ].join("\n"),
  parseMode: "HTML",
});

export class ChatGamesHandlers {
  constructor(private readonly ports: ChatGamesPorts) {}

  /** `/juegos` y `/jugar <juego>`. */
  async handleCommand(
    update: TelegramUpdateEnvelope,
    tenantId: string | undefined,
  ): Promise<BotReply | null> {
    const name = update.command?.name;
    if (name === "juegos") {
      return buildGamesMenu();
    }
    if (name === "pista") {
      const chat = update.chat.chatId;
      return chat && tenantId && update.chat.chatType !== "private"
        ? this.handleImpostorClue(update, tenantId, chat)
        : null;
    }
    if (name !== "jugar") {
      return null;
    }

    // `/jugar` a secas NO es de este modulo: ya abria el hub de la Mini App y
    // sigue haciendolo. Solo se queda con `/jugar <juego>` de los suyos, y
    // cualquier otra cosa sale por null para que la coja quien la cogia antes.
    // Descubrir los juegos de chat es lo que hace `/juegos`.
    const pedido = (update.command?.args?.[0] ?? "").toLowerCase();
    const spec = gameSpec(pedido);
    if (!spec) {
      return null;
    }

    const chatId = update.chat.chatId;
    if (!chatId || update.chat.chatType === "private") {
      // Toda la gracia es que lo vea el grupo. En privado no hay a quien
      // enseñarle el tablero ni con quien jugar.
      return {
        text: "🎮 Los juegos son de grupo: úsalo dentro del chat del grupo.",
      };
    }

    if (!tenantId) {
      return null;
    }

    return spec.key === "ahorcado" || spec.key === "wordle"
      ? this.openOpenTable(spec, tenantId, chatId, update)
      : this.openSeatedMatch(spec, tenantId, chatId, update);
  }

  /**
   * Abre ahorcado o wordle: partida del grupo entero, sin apuntarse.
   *
   * Solo puede haber una viva por chat. Dos ahorcados a la vez en el mismo
   * grupo convierten cada letra suelta en una ambigüedad — no habria forma de
   * saber a cual va.
   */
  private async openOpenTable(
    spec: GameSpec,
    tenantId: string,
    chatId: bigint,
    update: TelegramUpdateEnvelope,
    // Null cuando el tablero ya se ha publicado a mano — ver el wordle abajo.
  ): Promise<BotReply | null> {
    const viva = await this.liveOpenTable(tenantId, chatId, spec.key);
    if (viva) {
      return {
        text: `${spec.emoji} Ya hay un ${spec.title.toLowerCase()} en marcha en este grupo.`,
        parseMode: "HTML",
      };
    }

    const state =
      spec.key === "ahorcado"
        ? startHangman(this.pickHangmanWord())
        : groupWordle.startWordle(groupWordle.pickWord(this.ports.seed()));
    if (!state) {
      return {
        text: "🎮 No he podido preparar la partida. Inténtalo otra vez.",
      };
    }

    // La fila hay que crearla aunque no se use aqui: para el ahorcado es lo que
    // `handleText` busca despues, y para el wordle es lo que la Mini App abre.
    const match = await this.ports.matches.create({
      tenantId,
      chatId,
      game: spec.key,
      hostId: update.user.userId ?? 0n,
      hostName: nameOf(update),
      state,
    });

    if (spec.key === "ahorcado") {
      return this.renderHangman(state as HangmanState, null);
    }

    // El wordle se manda a mano, no devolviendo un BotReply, porque hace falta
    // el id del mensaje para poder refrescarlo cuando alguien juegue desde la
    // Mini App. Se devuelve null: el tablero ya esta publicado.
    const board = this.renderWordle(state as groupWordle.WordleState, match.id);
    const messageId = await this.ports
      .postBoard(chatId, board)
      .catch(() => undefined);
    if (messageId !== undefined) {
      await this.ports.matches
        .attachMessage(match.id, messageId)
        .catch(() => undefined);
    }
    return null;
  }

  /**
   * La palabra del ahorcado.
   *
   * Sale de la lista del wordle porque ya esta filtrada de lo que da problemas:
   * cinco letras, sin tildes y sin Ñ, comunes. El desfase (`* 7 + 3`) evita que
   * un ahorcado y un wordle abiertos a la vez compartan palabra.
   */
  private pickHangmanWord(): string {
    return groupWordle.pickWord(this.ports.seed() * 7 + 3);
  }

  /** La partida abierta de ese juego en ese chat, si la hay. */
  private async liveOpenTable(
    tenantId: string,
    chatId: bigint,
    game: ChatGame,
  ): Promise<GameMatchRecord | null> {
    const abiertas = await this.ports.matches.listOpen(tenantId, chatId, 20);
    return abiertas.find((m) => m.game === game) ?? null;
  }

  /**
   * Abre una partida con asientos: conecta 4, ppt, impostor, cartas.
   *
   * Empieza vacia y con un boton para sentarse. El anfitrion NO ocupa asiento
   * aqui todavia en los juegos de dos: eso lo hace `join`, y asi hay un solo
   * sitio en el codigo donde alguien se sienta.
   */
  private async openSeatedMatch(
    spec: GameSpec,
    tenantId: string,
    chatId: bigint,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply> {
    const hostId = update.user.userId ?? 0n;
    const hostName = nameOf(update);

    const estadoInicial =
      spec.key === "conecta4"
        ? connectFour.emptyBoard()
        : spec.key === "ppt"
          ? rps.startRps()
          : { phase: "lobby" };

    const match = await this.ports.matches.create({
      tenantId,
      chatId,
      game: spec.key,
      hostId,
      hostName,
      state: estadoInicial,
    });

    if (spec.maxPlayers > 2) {
      // Juego de mesa: el anfitrion se sienta el primero, como todos.
      await this.ports.players.join({
        matchId: match.id,
        tenantId,
        userId: hostId,
        name: hostName,
        maxPlayers: spec.maxPlayers,
      });
      return this.renderLobby(spec, match.id, [hostName]);
    }

    return {
      text: [
        `${spec.emoji} <b>${escapeHtml(spec.title)}</b>`,
        "",
        `${escapeHtml(hostName)} busca rival.`,
        `<i>${escapeHtml(spec.howTo)}</i>`,
      ].join("\n"),
      parseMode: "HTML",
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: "⚔️ Jugar",
              callback_data: buildChatGameCallback("join", match.id),
            },
            {
              text: "✖️ Retirar",
              callback_data: buildChatGameCallback("cancel", match.id),
            },
          ],
        ],
      },
    };
  }

  /** El cartel de una mesa que se esta llenando. */
  private renderLobby(
    spec: GameSpec,
    matchId: string,
    nombres: readonly string[],
  ): BotReply {
    const faltan = Math.max(0, spec.minPlayers - nombres.length);
    const filas: Record<string, unknown>[][] = [
      [
        {
          text: "✋ Me apunto",
          callback_data: buildChatGameCallback("join", matchId),
        },
      ],
    ];
    if (faltan === 0) {
      filas.push([
        {
          text: "▶️ Empezar",
          callback_data: buildChatGameCallback("start", matchId),
        },
      ]);
    }
    filas.push([
      {
        text: "✖️ Cancelar",
        callback_data: buildChatGameCallback("cancel", matchId),
      },
    ]);

    return {
      text: [
        `${spec.emoji} <b>${escapeHtml(spec.title)}</b>`,
        "",
        `<b>En la mesa (${nombres.length}/${spec.maxPlayers}):</b>`,
        ...nombres.map((n) => `· ${escapeHtml(n)}`),
        "",
        faltan > 0
          ? `<i>Faltan ${faltan} para poder empezar.</i>`
          : "<i>Ya se puede empezar.</i>",
      ].join("\n"),
      parseMode: "HTML",
      replyMarkup: { inline_keyboard: filas },
    };
  }

  // ─────────────────────────── conecta 4 ───────────────────────────

  private renderConnectFour(
    match: GameMatchRecord,
    board: connectFour.Board,
  ): BotReply {
    const acabada = match.status === "finished";
    const turno = connectFour.seatToMove(board);
    const quien =
      turno === "host" ? match.hostName : (match.guestName ?? "el invitado");

    const cabecera = acabada
      ? match.result === "draw"
        ? "🤝 <b>Empate.</b>"
        : `🏆 <b>Gana ${escapeHtml(
            (match.result === "host" ? match.hostName : match.guestName) ??
              "el ganador",
          )}.</b>`
      : `Le toca a <b>${escapeHtml(quien ?? "alguien")}</b> ${
          turno === "host" ? "🔴" : "🟡"
        }`;

    const filas: Record<string, unknown>[][] = [];
    if (!acabada) {
      const columnas = connectFour.playableColumns(board);
      // Siete botones no caben en una fila legible en un movil: se parten en
      // dos, cuatro y tres.
      for (const trozo of [columnas.slice(0, 4), columnas.slice(4)]) {
        if (trozo.length > 0) {
          filas.push(
            trozo.map((col) => ({
              text: `${col + 1}`,
              callback_data: buildChatGameCallback("c4", match.id, String(col)),
            })),
          );
        }
      }
    }

    return {
      text: [
        `🔴 <b>Conecta 4</b> — ${escapeHtml(match.hostName ?? "?")} 🔴 vs 🟡 ${escapeHtml(
          match.guestName ?? "?",
        )}`,
        "",
        connectFour.renderBoard(board),
        "",
        cabecera,
      ].join("\n"),
      parseMode: "HTML",
      edit: true,
      ...(filas.length > 0 ? { replyMarkup: { inline_keyboard: filas } } : {}),
    };
  }

  private async moveConnectFour(
    match: GameMatchRecord,
    userId: bigint,
    rawCol: string | null,
  ): Promise<BotReply | null> {
    const board = connectFour.isValidBoard(match.state)
      ? match.state
      : connectFour.emptyBoard();
    const seat =
      match.hostId === userId
        ? "host"
        : match.guestId === userId
          ? "guest"
          : null;
    if (!seat) {
      return { text: "Esta partida no es tuya.", edit: false };
    }

    const col = Number(rawCol);
    const res = connectFour.applyMove(board, seat, col);
    if (!res.ok) {
      // Un boton que ya no vale (columna llena, no es tu turno) no merece un
      // mensaje nuevo en el grupo: se contesta y no se toca el tablero.
      return null;
    }

    const commit = await this.ports.matches.commitMove({
      id: match.id,
      expectedVersion: match.version,
      state: res.board,
      status: res.finished ? "finished" : "playing",
      result: res.finished ? res.result : null,
    });
    if (!commit.ok) {
      // Dos pulsaciones a la vez: la que perdio no escribe nada. El tablero
      // que se ve ya es el bueno.
      return null;
    }
    await this.pagarGanador(commit.match);
    return this.renderConnectFour(commit.match, res.board);
  }

  // ───────────────────────────── ppt ─────────────────────────────

  private renderRps(match: GameMatchRecord, state: rps.RpsState): BotReply {
    const vista = rps.publicRound(state);
    const marcador = rps.renderScore(
      state,
      match.hostName ?? "Anfitrión",
      match.guestName ?? "Invitado",
    );

    const lineas = [
      `✂️ <b>Piedra, papel o tijera</b>`,
      "",
      escapeHtml(marcador),
    ];
    if (vista.reveal) {
      const r = vista.reveal;
      lineas.push(
        "",
        `${rps.EMOJI[r.host]} vs ${rps.EMOJI[r.guest]} — ${
          r.winner === null
            ? "empate, se repite"
            : `gana ${escapeHtml(
                (r.winner === "host" ? match.hostName : match.guestName) ?? "?",
              )}`
        }`,
      );
    }
    if (!state.finished) {
      lineas.push(
        "",
        `${vista.hostReady ? "✅" : "⏳"} ${escapeHtml(match.hostName ?? "?")}   ${
          vista.guestReady ? "✅" : "⏳"
        } ${escapeHtml(match.guestName ?? "?")}`,
      );
    } else {
      lineas.push(
        "",
        `🏆 <b>Gana ${escapeHtml(
          (state.result === "host" ? match.hostName : match.guestName) ?? "?",
        )}</b>`,
      );
    }

    return {
      text: lineas.join("\n"),
      parseMode: "HTML",
      edit: true,
      ...(state.finished
        ? {}
        : {
            replyMarkup: {
              inline_keyboard: [
                rps.THROWS.map((t) => ({
                  text: rps.EMOJI[t],
                  callback_data: buildChatGameCallback("ppt", match.id, t),
                })),
              ],
            },
          }),
    };
  }

  private async throwRps(
    match: GameMatchRecord,
    userId: bigint,
    raw: string | null,
  ): Promise<BotReply | null> {
    const state = rps.isValidRpsState(match.state)
      ? match.state
      : rps.startRps();
    const seat =
      match.hostId === userId
        ? "host"
        : match.guestId === userId
          ? "guest"
          : null;
    if (!seat) {
      return { text: "Esta partida no es tuya.", edit: false };
    }
    const tirada = rps.parseThrow(raw ?? "");
    if (!tirada) {
      return null;
    }

    const res = rps.submitThrow(state, seat, tirada);
    if (!res.ok) {
      return null;
    }
    const commit = await this.ports.matches.commitMove({
      id: match.id,
      expectedVersion: match.version,
      state: res.state,
      status: res.state.finished ? "finished" : "playing",
      result: res.state.result,
    });
    if (!commit.ok) {
      return null;
    }
    await this.pagarGanador(commit.match);
    return this.renderRps(commit.match, res.state);
  }

  /**
   * Paga el premio al ganador, si lo hay y si hay con que.
   *
   * Nunca deja caer un error hacia arriba: si la economia falla, la partida ya
   * esta jugada y ganada, y convertir eso en un tablero que no se refresca
   * seria cambiar un premio perdido por una partida rota.
   */
  private async pagarGanador(match: GameMatchRecord): Promise<void> {
    const ganador = winnerIdOf(match);
    if (ganador === null || !this.ports.awardMatchWinner) {
      return;
    }
    await this.ports
      .awardMatchWinner({
        tenantId: match.tenantId,
        telegramChatId: match.chatId,
        matchId: match.id,
        winnerTelegramId: ganador,
      })
      .catch(() => null);
  }

  // ─────────────────────────── ahorcado ───────────────────────────

  /** Sin `matchId`: estos dos se juegan escribiendo, no hay botones que firmar. */
  private renderHangman(state: HangmanState, aviso: string | null): BotReply {
    const fallos = missedLetters(state);
    const lineas = [
      `🎯 <b>Ahorcado</b> ${renderGallows(state)}`,
      "",
      `<code>${renderMask(state)}</code>`,
    ];
    if (fallos.length > 0) {
      lineas.push("", `Falladas: ${fallos.join(" ")}`);
    }
    if (isSolved(state)) {
      const ranking = creditRanking(state);
      lineas.push(
        "",
        `✅ <b>¡La habéis sacado!</b> La palabra era <b>${escapeHtml(state.word)}</b>.`,
      );
      if (ranking.length > 0) {
        lineas.push(
          ...ranking
            .slice(0, 3)
            .map((r, i) => `${["🥇", "🥈", "🥉"][i]} ${r.letters} letras`),
        );
      }
    } else if (isLost(state)) {
      lineas.push(
        "",
        `💀 <b>Se acabó.</b> Era <b>${escapeHtml(state.word)}</b>.`,
      );
    } else {
      lineas.push("", "<i>Escribe una letra en el chat.</i>");
    }
    if (aviso) {
      lineas.push("", `<i>${escapeHtml(aviso)}</i>`);
    }
    return { text: lineas.join("\n"), parseMode: "HTML" };
  }

  /**
   * Una letra suelta escrita en el chat.
   *
   * No lleva comando a proposito: obligar a escribir `/letra a` mata el ritmo
   * del juego. El precio es que hay que mirar todos los mensajes de una letra,
   * y por eso esto solo hace algo si hay una partida viva en ese chat.
   */
  private async handleHangmanText(
    match: GameMatchRecord,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const texto = (update.messageText ?? "").trim();
    if (texto.length === 0 || texto.startsWith("/")) {
      return null;
    }
    const state = isValidHangmanState(match.state)
      ? match.state
      : startHangman("PERRO");
    const quien = String(update.user.userId ?? 0n);

    // Una letra prueba letra; una palabra del mismo largo intenta resolver.
    const res =
      texto.length === 1
        ? guessLetter(state, texto, quien)
        : texto.length === state.word.length
          ? guessWord(state, texto, quien)
          : null;
    if (res === null || res.outcome === "not-a-letter") {
      return null;
    }
    if (res.outcome === "already-guessed" || res.outcome === "game-over") {
      // Silencio: dos personas mandando la misma letra a la vez es lo normal,
      // y contestarles llena el chat de avisos por algo que no es un fallo.
      return null;
    }

    await this.ports.matches.commitMove({
      id: match.id,
      expectedVersion: match.version,
      state: res.state,
      // "open" mientras se juega: ver OPEN_TABLE_GAMES.
      status: isSolved(res.state) || isLost(res.state) ? "finished" : "open",
      result: isSolved(res.state) ? "host" : isLost(res.state) ? "draw" : null,
    });
    return this.renderHangman(res.state, null);
  }

  // ──────────────────────────── wordle ────────────────────────────

  /**
   * El tablero del wordle en el chat.
   *
   * Ya no se juega aqui —las palabras se escriben en la Mini App, con teclado
   * de colores— pero el tablero se queda en el grupo, editado en el mismo
   * mensaje. Es lo que sostiene la parte social ahora que se teclea en otra
   * pantalla: quien no abra nada sigue viendo como va.
   */
  private renderWordle(
    state: groupWordle.WordleState,
    matchId: string,
  ): BotReply {
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
        "",
        `<code>${groupWordle.renderShare(state, this.ports.today())}</code>`,
      );
    } else {
      lineas.push("", "<i>Abre el teclado para probar una palabra.</i>");
    }
    return {
      text: lineas.join("\n"),
      parseMode: "HTML",
      ...(state.finished
        ? {}
        : {
            replyMarkup: {
              inline_keyboard: [
                [{ text: "⌨️ Jugar", url: this.ports.miniAppLink(matchId) }],
              ],
            },
          }),
    };
  }

  // ─────────────────────── mensajes de texto ───────────────────────

  /**
   * Mensajes sueltos que pueden ser una jugada.
   *
   * Sale corriendo en cuanto puede: la inmensa mayoria de los mensajes de un
   * grupo no son jugadas, y esto se ejecuta para todos ellos.
   */
  async handleText(
    update: TelegramUpdateEnvelope,
    tenantId: string | undefined,
  ): Promise<BotReply | null> {
    const chatId = update.chat.chatId;
    const texto = (update.messageText ?? "").trim();
    if (
      !chatId ||
      !update.isTextMessage ||
      texto.length === 0 ||
      texto.startsWith("/") ||
      // Solo una letra suelta puede ser jugada del ahorcado, que es el unico
      // que se juega escribiendo. Se corta antes de tocar la base de datos.
      texto.length !== 1
    ) {
      return null;
    }

    if (!tenantId) {
      return null;
    }
    const abiertas = await this.ports.matches.listOpen(tenantId, chatId, 20);
    const viva = abiertas.find((m) => TYPED_IN_CHAT.has(m.game as ChatGame));
    if (!viva) {
      return null;
    }

    return this.handleHangmanText(viva, update);
  }

  // ────────────────────────── callbacks ──────────────────────────

  async handleCallback(
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const parsed = parseChatGameCallback(update.callbackData);
    if (!parsed) {
      return null;
    }
    const match = await this.ports.matches.find(parsed.matchId);
    if (!match) {
      return { text: "Esa partida ya no existe.", edit: false };
    }
    const userId = update.user.userId ?? 0n;

    switch (parsed.action) {
      case "join":
        return this.joinMatch(match, update);
      case "start":
        return this.startTable(match, update);
      case "cancel":
        return this.cancelMatch(match, userId);
      case "c4":
        return this.moveConnectFour(match, userId, parsed.arg);
      case "ppt":
        return this.throwRps(match, userId, parsed.arg);
      case "vote":
        return this.voteImpostor(match, userId, parsed.arg);
      default:
        return null;
    }
  }

  /**
   * Si una mesa ya reparti.
   *
   * El lobby es el unico estado con `phase: "lobby"`; en cuanto se reparte, el
   * estado pasa a ser el del juego. Hace falta porque estas partidas siguen en
   * "open" mientras se juegan (ver LIVE_AS_OPEN) y un boton de apuntarse de un
   * mensaje viejo seguiria vivo: sentaria a alguien sin palabra ni rol, y el
   * motor contaria con el para cerrar la ronda. La partida no avanzaria nunca.
   */
  private static mesaEmpezada(match: GameMatchRecord): boolean {
    const estado = match.state as { phase?: unknown } | null;
    return (
      typeof estado === "object" && estado !== null && estado.phase !== "lobby"
    );
  }

  /** Sentarse: en los de dos ocupa el asiento libre, en los de mesa se apunta. */
  private async joinMatch(
    match: GameMatchRecord,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const spec = gameSpec(match.game);
    if (!spec) {
      return null;
    }
    const userId = update.user.userId ?? 0n;
    const nombre = nameOf(update);

    if (spec.maxPlayers > 2) {
      if (ChatGamesHandlers.mesaEmpezada(match)) {
        return null;
      }
      const res = await this.ports.players.join({
        matchId: match.id,
        tenantId: match.tenantId,
        userId,
        name: nombre,
        maxPlayers: spec.maxPlayers,
      });
      if (!res.ok) {
        return null;
      }
      const roster = await this.ports.players.roster(match.id);
      return {
        ...this.renderLobby(
          spec,
          match.id,
          roster.map((s) => s.name ?? "alguien"),
        ),
        edit: true,
      };
    }

    const res = await this.ports.matches.join(match.id, userId, nombre);
    if (!res.ok) {
      // "Ya está pillado" o "es tu propia partida": el mensaje del grupo no
      // cambia, solo se le contesta a quien pulso.
      return null;
    }

    return match.game === "conecta4"
      ? this.renderConnectFour(res.match, connectFour.emptyBoard())
      : this.renderRps(res.match, rps.startRps());
  }

  /**
   * El anfitrion arranca una mesa que ya tiene gente.
   *
   * Solo el anfitrion: si pudiera empezarla cualquiera, el ultimo en llegar
   * arrancaria la partida mientras todavia se estan apuntando.
   */
  private async startTable(
    match: GameMatchRecord,
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const spec = gameSpec(match.game);
    if (!spec || (update.user.userId ?? 0n) !== match.hostId) {
      return null;
    }
    const roster = await this.ports.players.roster(match.id);
    if (roster.length < spec.minPlayers) {
      return null;
    }

    const seed = seedFrom(match.id);
    if (match.game === "impostor") {
      return this.startImpostor(match, roster, seed);
    }
    if (match.game === "cartas") {
      return this.startColorCards(
        match,
        roster,
        seed,
        extractCallbackMessageId(update.raw),
      );
    }
    return null;
  }

  private async startImpostor(
    match: GameMatchRecord,
    roster: readonly {
      readonly userId: bigint;
      readonly name: string | null;
    }[],
    seed: number,
  ): Promise<BotReply | null> {
    const pair =
      impostor.WORD_PAIRS[Math.abs(seed) % impostor.WORD_PAIRS.length];
    if (!pair) {
      return null;
    }
    const dealt = impostor.dealRoles(
      roster.map((r) => r.userId.toString()),
      pair,
      seed,
    );
    if (!dealt) {
      return null;
    }

    // Los secretos van a la tabla de asientos, NO al estado de la partida: el
    // estado se enseña entero en el chat cada vez que cambia.
    await this.ports.players.dealSecrets(
      match.id,
      new Map([...dealt.secrets].map(([id, secret]) => [BigInt(id), secret])),
    );
    const commit = await this.ports.matches.commitMove({
      id: match.id,
      expectedVersion: match.version,
      state: dealt.state,
      // "open" mientras se juega, por el mismo motivo que el ahorcado y el
      // wordle (ver OPEN_TABLE_GAMES): `/pista rojo` no lleva id de partida, y
      // quien la escribe no tiene por que saberlo. `listOpen` es lo unico que
      // permite encontrarla por chat.
      //
      // El precio es que "open" deja de significar "admite gente" para el
      // impostor, y por eso `mesaEmpezada` guarda la puerta.
      status: "open",
      result: null,
    });
    if (!commit.ok) {
      return null;
    }

    return {
      ...this.renderImpostorClues(match.id, dealt.state, roster, null),
      edit: true,
    };
  }

  // ─────────────────────────── impostor ───────────────────────────

  /** Nombre por id, para no pintar numeros en el chat. */
  private static namesOf(
    roster: readonly {
      readonly userId: bigint;
      readonly name: string | null;
    }[],
  ): Map<string, string> {
    return new Map(
      roster.map((r) => [r.userId.toString(), r.name ?? "alguien"]),
    );
  }

  /** Los que siguen dentro, en el orden en que se sentaron. */
  private static aliveNames(
    state: impostor.ImpostorState,
    roster: readonly {
      readonly userId: bigint;
      readonly name: string | null;
    }[],
  ): readonly { readonly id: string; readonly name: string }[] {
    const nombres = ChatGamesHandlers.namesOf(roster);
    return impostor
      .aliveOf(
        state,
        roster.map((r) => r.userId.toString()),
      )
      .map((id) => ({ id, name: nombres.get(id) ?? "alguien" }));
  }

  /**
   * La ronda de pistas.
   *
   * Se pintan las pistas ya dichas: son publicas por definicion — en este juego
   * se dicen en voz alta — y tenerlas todas juntas es justo lo que hace falta
   * para votar. Fiarlo al scroll del chat castiga a quien llega tarde.
   */
  private renderImpostorClues(
    matchId: string,
    state: impostor.ImpostorState,
    roster: readonly {
      readonly userId: bigint;
      readonly name: string | null;
    }[],
    aviso: string | null,
  ): BotReply {
    const vivos = ChatGamesHandlers.aliveNames(state, roster);
    const faltan = vivos.filter((v) => !(v.id in state.clues));
    const lineas = [
      `🕵️ <b>El Impostor</b> — ronda ${state.round}`,
      "",
      ...vivos.map((v) => {
        const pista = state.clues[v.id];
        return pista
          ? `✅ <b>${escapeHtml(v.name)}</b>: ${escapeHtml(pista)}`
          : `⏳ ${escapeHtml(v.name)}`;
      }),
      "",
      `<i>Faltan ${faltan.length}. Di la tuya con</i> <code>/pista palabra</code>`,
    ];
    if (aviso) {
      lineas.push("", `<i>${escapeHtml(aviso)}</i>`);
    }
    return {
      text: lineas.join("\n"),
      parseMode: "HTML",
      replyMarkup: {
        inline_keyboard: [
          [{ text: "🔒 Mi palabra", url: this.ports.miniAppLink(matchId) }],
        ],
      },
    };
  }

  /**
   * La votacion.
   *
   * Un boton por cada uno que sigue vivo, incluido uno mismo — el motor rechaza
   * el autovoto, y quitar tu propio boton solo consigue que la fila de botones
   * sea distinta para cada persona y nadie sepa de que se habla.
   */
  private renderImpostorVoting(
    matchId: string,
    state: impostor.ImpostorState,
    roster: readonly {
      readonly userId: bigint;
      readonly name: string | null;
    }[],
  ): BotReply {
    const vivos = ChatGamesHandlers.aliveNames(state, roster);
    const yaVotaron = Object.keys(state.votes).length;
    return {
      text: [
        `🕵️ <b>El Impostor</b> — ronda ${state.round}, votación`,
        "",
        ...vivos.map(
          (v) =>
            `· <b>${escapeHtml(v.name)}</b>: ${escapeHtml(state.clues[v.id] ?? "—")}`,
        ),
        "",
        `<i>¿Quién sobra? ${yaVotaron}/${vivos.length} han votado.</i>`,
      ].join("\n"),
      parseMode: "HTML",
      replyMarkup: {
        // De dos en dos: un nombre largo por fila desperdicia la pantalla, y
        // cuatro por fila los deja ilegibles en un movil.
        inline_keyboard: chunk(
          vivos.map((v) => ({
            text: v.name.slice(0, 20),
            callback_data: buildChatGameCallback("vote", matchId, v.id),
          })),
          2,
        ),
      },
    };
  }

  /**
   * El final de una ronda: a quien se llevo la votacion y si eso acaba con
   * todo.
   *
   * Solo se destapa la palabra cuando la partida termina. Enseñarla antes le
   * regala al impostor superviviente exactamente lo que le falta.
   */
  private renderImpostorRound(
    state: impostor.ImpostorState,
    outcome: impostor.RoundOutcome,
    roster: readonly {
      readonly userId: bigint;
      readonly name: string | null;
    }[],
    pair: impostor.WordPair | null,
  ): BotReply {
    const nombres = ChatGamesHandlers.namesOf(roster);
    const lineas = [`🕵️ <b>El Impostor</b> — ronda ${state.round}`, ""];

    if (outcome.tally.eliminated === null) {
      lineas.push(
        `🤝 <b>Empate.</b> No se va nadie${
          outcome.tally.tied.length > 0
            ? ` — ${outcome.tally.tied
                .map((id) => escapeHtml(nombres.get(id) ?? "?"))
                .join(" y ")}`
            : ""
        }.`,
      );
    } else {
      const fuera = escapeHtml(nombres.get(outcome.tally.eliminated) ?? "?");
      const eraImpostor = outcome.tally.eliminated === state.impostorId;
      lineas.push(
        `🚪 Fuera <b>${fuera}</b> — ${eraImpostor ? "<b>era el impostor</b>" : "no era el impostor"}.`,
      );
    }

    if (outcome.finished) {
      lineas.push(
        "",
        outcome.state.result === "crew"
          ? "🎉 <b>Gana el grupo.</b>"
          : `😈 <b>Gana el impostor</b> — era <b>${escapeHtml(
              nombres.get(state.impostorId) ?? "?",
            )}</b>.`,
      );
      if (pair) {
        lineas.push(
          "",
          `Palabra del grupo: <b>${escapeHtml(pair.crew)}</b>`,
          `Palabra del impostor: <b>${escapeHtml(pair.impostor)}</b>`,
        );
      }
    } else {
      lineas.push("", `<i>Sigue la ronda ${outcome.state.round}.</i>`);
    }

    return { text: lineas.join("\n"), parseMode: "HTML" };
  }

  /**
   * `/pista <palabra>` — la jugada de la fase de pistas.
   *
   * Es un comando y no una palabra suelta a proposito. En el ahorcado una letra
   * perdida no cuesta nada; aqui la pista es unica e irreversible, asi que si
   * cualquier palabra contase, el primero que escribiera "jajaja" se quedaria
   * sin ella. Ademas evita mirar todos los mensajes del grupo.
   */
  private async handleImpostorClue(
    update: TelegramUpdateEnvelope,
    tenantId: string,
    chatId: bigint,
  ): Promise<BotReply | null> {
    const partidas = await this.ports.matches.listOpen(tenantId, chatId, 20);
    const match = partidas.find((m) => m.game === "impostor") ?? null;
    if (!match || !impostor.isValidImpostorState(match.state)) {
      return null;
    }
    const state = match.state;
    const userId = update.user.userId ?? 0n;
    const quien = userId.toString();

    const palabra = (update.command?.args ?? []).join(" ").trim();
    if (palabra.length === 0) {
      return {
        text: "🕵️ Di tu pista así: <code>/pista rojo</code>.",
        parseMode: "HTML",
      };
    }

    // La palabra de quien habla, para que el motor pueda rechazar la pista que
    // ES la palabra secreta. Sale de la tabla de asientos, nunca del estado.
    const secreto = await this.ports.players.secretFor(match.id, userId);
    const suPalabra =
      typeof secreto === "object" &&
      secreto !== null &&
      typeof (secreto as { word?: unknown }).word === "string"
        ? (secreto as { word: string }).word
        : "";
    if (suPalabra.length === 0) {
      return null; // No juega esta partida: ni contestar.
    }

    const roster = await this.ports.players.roster(match.id);
    const vivos = impostor.aliveOf(
      state,
      roster.map((r) => r.userId.toString()),
    );
    const res = impostor.submitClue(state, quien, palabra, vivos, suPalabra);
    if (!res.ok) {
      return this.impostorClueError(res.error);
    }

    const commit = await this.ports.matches.commitMove({
      id: match.id,
      expectedVersion: match.version,
      state: res.state,
      status: "open",
      result: null,
    });
    if (!commit.ok) {
      // Otra pista gano la carrera. La suya no se ha perdido: el estado que se
      // ve es el bueno y puede repetirla.
      return null;
    }

    return res.complete
      ? this.renderImpostorVoting(match.id, res.state, roster)
      : this.renderImpostorClues(match.id, res.state, roster, null);
  }

  /** Por que no cuela una pista. Corto: se lee en mitad de una partida. */
  private impostorClueError(error: impostor.ClueError): BotReply | null {
    switch (error) {
      case "too-many-words":
        return { text: "🕵️ Una sola palabra." };
      case "gives-it-away":
        return { text: "🕵️ Esa no cuela. Prueba con otra." };
      case "already-said":
        return { text: "🕵️ Ya has dicho la tuya." };
      case "wrong-phase":
        return { text: "🕵️ Ahora toca votar, no dar pistas." };
      default:
        // "not-playing" y "empty": silencio. Quien no juega no necesita que se
        // lo digan delante del grupo.
        return null;
    }
  }

  /** Un voto. Cierra la ronda cuando ha votado todo el mundo. */
  private async voteImpostor(
    match: GameMatchRecord,
    userId: bigint,
    targetRaw: string | null,
  ): Promise<BotReply | null> {
    if (!impostor.isValidImpostorState(match.state) || !targetRaw) {
      return null;
    }
    const state = match.state;
    const roster = await this.ports.players.roster(match.id);
    const vivos = impostor.aliveOf(
      state,
      roster.map((r) => r.userId.toString()),
    );

    const res = impostor.submitVote(state, userId.toString(), targetRaw, vivos);
    if (!res.ok) {
      return res.error === "self-vote"
        ? { text: "🕵️ A ti mismo no.", edit: false }
        : null;
    }

    if (!res.complete) {
      const commit = await this.ports.matches.commitMove({
        id: match.id,
        expectedVersion: match.version,
        state: res.state,
        status: "open",
        result: null,
      });
      return commit.ok
        ? {
            ...this.renderImpostorVoting(match.id, res.state, roster),
            edit: true,
          }
        : null;
    }

    const outcome = impostor.closeRound(res.state, vivos);
    const commit = await this.ports.matches.commitMove({
      id: match.id,
      expectedVersion: match.version,
      state: outcome.state,
      status: outcome.finished ? "finished" : "open",
      result: outcome.finished ? outcome.state.result : null,
    });
    if (!commit.ok) {
      return null;
    }

    // El asiento del eliminado se marca fuera para que la Mini App lo enseñe
    // como tal: quien mira su pantalla tiene que ver lo mismo que el chat.
    if (outcome.tally.eliminated !== null) {
      await this.ports.players
        .setStatus(match.id, BigInt(outcome.tally.eliminated), "out")
        .catch(() => undefined);
    }

    const cierre = this.renderImpostorRound(
      res.state,
      outcome,
      roster,
      outcome.finished ? this.impostorPair(match.id) : null,
    );
    if (outcome.finished) {
      return { ...cierre, edit: true };
    }
    // Sigue: el cierre de ronda y el tablero nuevo son dos cosas distintas, y
    // el tablero nuevo es el que lleva los botones. Se edita al tablero y el
    // resumen de la ronda va dentro.
    const siguiente = this.renderImpostorClues(
      match.id,
      outcome.state,
      roster,
      null,
    );
    return {
      ...siguiente,
      text: `${cierre.text}\n\n${siguiente.text}`,
      edit: true,
    };
  }

  /** La pareja de palabras de una partida, derivada de su id igual que en el reparto. */
  private impostorPair(matchId: string): impostor.WordPair | null {
    const seed = seedFrom(matchId);
    return (
      impostor.WORD_PAIRS[Math.abs(seed) % impostor.WORD_PAIRS.length] ?? null
    );
  }

  /**
   * Reparte las cartas.
   *
   * Guarda el id del mensaje del grupo antes de nada. A diferencia del resto,
   * las tiradas de este juego NO llegan por un callback —llegan por la Mini
   * App, que va contra la API— asi que cuando toque refrescar la mesa no habra
   * ningun callback del que sacar el mensaje que hay que editar. Sin esto, la
   * unica forma de contar lo que pasa seria mandar un mensaje nuevo por carta.
   */
  private async startColorCards(
    match: GameMatchRecord,
    roster: readonly {
      readonly userId: bigint;
      readonly name: string | null;
    }[],
    seed: number,
    messageId?: number,
  ): Promise<BotReply | null> {
    if (messageId !== undefined) {
      await this.ports.matches
        .attachMessage(match.id, messageId)
        .catch(() => undefined);
    }
    const seats = roster.map((_, i) => i);
    const state = colorCards.startGame(seats, seed);
    if (!state) {
      return null;
    }
    const { shared, hands } = colorCards.splitState(state);

    await this.ports.players.dealSecrets(
      match.id,
      new Map(
        roster.map((r, i) => [r.userId, { hand: hands[i] ?? [] }] as const),
      ),
    );
    await this.ports.matches.commitMove({
      id: match.id,
      expectedVersion: match.version,
      state: shared,
      status: "playing",
      result: null,
    });

    // La misma mesa que pintara la API en cada tirada. Cuando cada uno tenia su
    // formato, el mensaje cambiaba de aspecto al primer movimiento y parecia
    // que se hubiera roto algo.
    return {
      text: colorCards.renderTable(
        state,
        new Map(roster.map((r, i) => [i, r.name])),
      ),
      parseMode: "HTML",
      edit: true,
      replyMarkup: {
        inline_keyboard: [
          [{ text: "🔒 Mi mano", url: this.ports.miniAppLink(match.id) }],
        ],
      },
    };
  }

  /** Retirar la partida. Solo el anfitrion, y solo si nadie la ha empezado. */
  private async cancelMatch(
    match: GameMatchRecord,
    userId: bigint,
  ): Promise<BotReply | null> {
    const ok = await this.ports.matches.cancel(match.id, userId);
    if (!ok) {
      return null;
    }
    return {
      text: "🎮 Partida retirada.",
      edit: true,
      replyMarkup: { inline_keyboard: [] },
    };
  }
}

import {
  InMemoryGameMatchPlayerRepository,
  InMemoryGameMatchRepository,
} from "@superbot/data";
import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { connectFour } from "@superbot/module-games";
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildChatGameCallback,
  ChatGamesHandlers,
  type ChatGamesPorts,
  GAMES,
  gameSpec,
  parseChatGameCallback,
} from "./chat-games.js";

const CHAT = -100123n;
const TENANT = "t1";

let matches: InMemoryGameMatchRepository;
let players: InMemoryGameMatchPlayerRepository;
let handlers: ChatGamesHandlers;

/** Los tableros publicados a mano, para poder mirarlos en los tests. */
let publicados: {
  chatId: bigint;
  text: string;
  markup: Record<string, unknown> | undefined;
}[] = [];

let premios: { matchId: string; winnerTelegramId: bigint }[] = [];

const ports = (): ChatGamesPorts => ({
  matches,
  players,
  miniAppLink: (id) => `https://t.me/bot/config?startapp=m_${id}`,
  today: () => 42,
  // Fijo para que las pruebas sean reproducibles. En produccion son los
  // milisegundos del reloj: lo unico que importa es que cambie entre partidas.
  seed: () => 42,
  postBoard: async (chatId, reply) => {
    publicados.push({ chatId, text: reply.text, markup: reply.replyMarkup });
    return 900 + publicados.length;
  },
  awardMatchWinner: async ({ matchId, winnerTelegramId }) => {
    premios.push({ matchId, winnerTelegramId });
    return 25;
  },
});

beforeEach(() => {
  matches = new InMemoryGameMatchRepository();
  players = new InMemoryGameMatchPlayerRepository();
  publicados = [];
  premios = [];
  handlers = new ChatGamesHandlers(ports());
});

/** Un update mínimo: solo lo que este módulo lee. */
const update = (
  over: {
    command?: { name: string; args?: string[] };
    callbackData?: string;
    text?: string;
    userId?: bigint;
    name?: string;
    chatType?: string;
  } = {},
): TelegramUpdateEnvelope =>
  ({
    updateId: 1,
    kind: over.callbackData ? "callback_query" : "message",
    receivedAt: new Date(0),
    chat: {
      chatId: CHAT,
      chatType: over.chatType ?? "supergroup",
      topicId: undefined,
    },
    user: {
      userId: over.userId ?? 1n,
      username: undefined,
      firstName: over.name ?? "Ana",
      languageCode: undefined,
    },
    command: over.command
      ? { name: over.command.name, raw: "", args: over.command.args ?? [] }
      : undefined,
    callbackData: over.callbackData,
    messageText: over.text,
    content: {},
    attachment: undefined,
    preCheckout: undefined,
    successfulPayment: undefined,
    inlineQuery: undefined,
    messageId: 10,
    newChatMemberIds: [],
    isTextMessage: over.text !== undefined,
    raw: {},
  }) as unknown as TelegramUpdateEnvelope;

/** Abre una partida y devuelve su id, leyéndolo del repositorio. */
const abrir = async (juego: string, userId = 1n, name = "Ana") => {
  const reply = await handlers.handleCommand(
    update({ command: { name: "jugar", args: [juego] }, userId, name }),
    TENANT,
  );
  const abiertas = await matches.listOpen(TENANT, CHAT, 20);
  const match = abiertas.find((m) => m.game === juego);
  if (!match) {
    throw new Error(`no se abrió la partida de ${juego}`);
  }
  return { reply, match };
};

describe("callbacks", () => {
  it("van y vuelven", () => {
    expect(
      parseChatGameCallback(buildChatGameCallback("c4", "abc", "3")),
    ).toEqual({ action: "c4", matchId: "abc", arg: "3" });
    expect(parseChatGameCallback(buildChatGameCallback("join", "abc"))).toEqual(
      {
        action: "join",
        matchId: "abc",
        arg: null,
      },
    );
  });

  it("no se queda con lo que no es suyo", () => {
    // Este parser corre sobre TODOS los callbacks del bot: si se quedara con
    // los ajenos, taparia handlers que ya existen.
    expect(parseChatGameCallback("settings:x")).toBeNull();
    expect(parseChatGameCallback("cg:")).toBeNull();
    expect(parseChatGameCallback(undefined)).toBeNull();
  });
});

describe("menú", () => {
  it("/juegos lista todos", async () => {
    const reply = await handlers.handleCommand(
      update({ command: { name: "juegos" } }),
      TENANT,
    );
    for (const g of GAMES) {
      expect(reply?.text).toContain(g.title);
    }
  });

  it("/jugar a secas NO es suyo: lo sigue cogiendo el hub de la Mini App", async () => {
    // Este comando ya existía y abría el hub. Quedárselo aquí habría cambiado
    // en silencio lo que hace un comando que la gente ya usa.
    expect(
      await handlers.handleCommand(
        update({ command: { name: "jugar" } }),
        TENANT,
      ),
    ).toBeNull();
  });

  it("/jugar con un juego que no existe tampoco es suyo", async () => {
    expect(
      await handlers.handleCommand(
        update({ command: { name: "jugar", args: ["parchis"] } }),
        TENANT,
      ),
    ).toBeNull();
  });

  it("no responde a comandos de otro", async () => {
    expect(
      await handlers.handleCommand(
        update({ command: { name: "ban" } }),
        TENANT,
      ),
    ).toBeNull();
  });

  it("en privado avisa en vez de abrir partida", async () => {
    // Toda la gracia es que lo vea el grupo.
    const reply = await handlers.handleCommand(
      update({
        command: { name: "jugar", args: ["conecta4"] },
        chatType: "private",
      }),
      TENANT,
    );
    expect(reply?.text).toContain("grupo");
    expect(await matches.listOpen(TENANT, CHAT, 20)).toHaveLength(0);
  });
});

describe("conecta 4", () => {
  it("se abre buscando rival", async () => {
    const { reply } = await abrir("conecta4");
    expect(reply?.text).toContain("busca rival");
  });

  it("al sentarse el rival aparece el tablero", async () => {
    const { match } = await abrir("conecta4");
    const reply = await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("join", match.id),
        userId: 2n,
        name: "Luis",
      }),
    );
    expect(reply?.text).toContain("Conecta 4");
    expect(reply?.text).toContain("⚪");
    expect(reply?.edit).toBe(true);
  });

  it("las columnas son botones", async () => {
    const { match } = await abrir("conecta4");
    const reply = await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("join", match.id),
        userId: 2n,
      }),
    );
    const filas = (reply?.replyMarkup?.inline_keyboard ?? []) as {
      callback_data: string;
    }[][];
    expect(filas.flat()).toHaveLength(connectFour.COLUMNS);
  });

  it("una jugada cae en el tablero", async () => {
    const { match } = await abrir("conecta4");
    await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("join", match.id),
        userId: 2n,
      }),
    );
    const reply = await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("c4", match.id, "3"),
        userId: 1n,
      }),
    );
    expect(reply?.text).toContain("🔴");
  });

  it("quien no juega no puede mover", async () => {
    const { match } = await abrir("conecta4");
    await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("join", match.id),
        userId: 2n,
      }),
    );
    const reply = await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("c4", match.id, "3"),
        userId: 99n,
      }),
    );
    expect(reply?.text).toContain("no es tuya");
  });

  it("mover fuera de turno no toca el tablero", async () => {
    // Devolver null deja el mensaje del grupo como estaba: un botón que ya no
    // vale no merece un mensaje nuevo.
    const { match } = await abrir("conecta4");
    await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("join", match.id),
        userId: 2n,
      }),
    );
    const reply = await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("c4", match.id, "3"),
        userId: 2n,
      }),
    );
    expect(reply).toBeNull();
  });
});

describe("piedra, papel o tijera", () => {
  it("la primera tirada NO se ve en el chat", async () => {
    // Es todo el juego: si se viera, el segundo ganaría siempre.
    const { match } = await abrir("ppt");
    await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("join", match.id),
        userId: 2n,
      }),
    );
    const reply = await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("ppt", match.id, "piedra"),
        userId: 1n,
      }),
    );
    expect(reply?.text).not.toContain("🪨");
    expect(reply?.text).toContain("✅");
  });

  it("con las dos tiradas se resuelve la ronda", async () => {
    const { match } = await abrir("ppt");
    await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("join", match.id),
        userId: 2n,
      }),
    );
    await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("ppt", match.id, "piedra"),
        userId: 1n,
      }),
    );
    const reply = await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("ppt", match.id, "tijera"),
        userId: 2n,
      }),
    );
    expect(reply?.text).toContain("🪨");
    expect(reply?.text).toContain("✂️");
  });

  it("no paga mientras la partida sigue viva", async () => {
    const { match } = await abrir("ppt");
    await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("join", match.id),
        userId: 2n,
      }),
    );
    // Una ronda ganada no es la partida: es a dos.
    await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("ppt", match.id, "piedra"),
        userId: 1n,
      }),
    );
    await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("ppt", match.id, "tijera"),
        userId: 2n,
      }),
    );

    expect(premios).toEqual([]);
  });

  it("paga al ganador cuando la partida termina, y solo una vez", async () => {
    const { match } = await abrir("ppt");
    await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("join", match.id),
        userId: 2n,
      }),
    );
    // Dos rondas de piedra contra tijera: gana el anfitrion 2-0.
    for (const _ronda of [1, 2]) {
      await handlers.handleCallback(
        update({
          callbackData: buildChatGameCallback("ppt", match.id, "piedra"),
          userId: 1n,
        }),
      );
      await handlers.handleCallback(
        update({
          callbackData: buildChatGameCallback("ppt", match.id, "tijera"),
          userId: 2n,
        }),
      );
    }

    expect(premios).toEqual([{ matchId: match.id, winnerTelegramId: 1n }]);
  });
});

describe("ahorcado", () => {
  it("se abre con la palabra tapada", async () => {
    const { reply } = await abrir("ahorcado");
    expect(reply?.text).toContain("Ahorcado");
    expect(reply?.text).toContain("_");
  });

  it("una letra escrita en el chat cuenta", async () => {
    await abrir("ahorcado");
    const reply = await handlers.handleText(update({ text: "a" }), TENANT);
    // Acierte o falle, el tablero se vuelve a pintar.
    expect(reply?.text).toContain("Ahorcado");
  });

  it("no se abren dos a la vez en el mismo grupo", async () => {
    // Con dos vivos, cada letra suelta sería ambigua.
    await abrir("ahorcado");
    const segunda = await handlers.handleCommand(
      update({ command: { name: "jugar", args: ["ahorcado"] } }),
      TENANT,
    );
    expect(segunda?.text).toContain("ya hay un ahorcado".replace("ya", "Ya"));
  });

  it("los mensajes normales no se tocan", async () => {
    await abrir("ahorcado");
    expect(
      await handlers.handleText(update({ text: "hola que tal" }), TENANT),
    ).toBeNull();
    expect(
      await handlers.handleText(update({ text: "/otra" }), TENANT),
    ).toBeNull();
  });

  it("sin partida viva no se mira nada", async () => {
    expect(await handlers.handleText(update({ text: "a" }), TENANT)).toBeNull();
  });
});

describe("wordle", () => {
  it("publica el tablero a mano y guarda su mensaje", async () => {
    // A mano y no devolviendo un BotReply: hace falta el message_id para poder
    // refrescar el tablero cuando alguien juegue desde la Mini App, y la capa
    // de entrega no informa de ese id de vuelta.
    const { reply, match } = await abrir("wordle");

    expect(reply).toBeNull();
    expect(publicados).toHaveLength(1);
    expect(publicados[0]?.text).toContain("6/6");
    expect((await matches.find(match.id))?.messageId).toBe(901);
  });

  it("el tablero lleva el botón que abre el teclado, apuntando a ESTA partida", async () => {
    const { match } = await abrir("wordle");
    const teclado = publicados[0]?.markup as
      | { inline_keyboard: { text: string; url: string }[][] }
      | undefined;
    const boton = teclado?.inline_keyboard[0]?.[0];

    expect(boton?.text).toContain("Jugar");
    // Sin el id de la partida el botón abre la Mini App en el hub y quien lo
    // pulse no llega al tablero: es el mismo fallo que tuvieron las cartas.
    expect(boton?.url).toContain(`m_${match.id}`);
  });

  it("escribir la palabra en el chat YA NO juega", async () => {
    // Se movió a la Mini App. Dejar también el camino del chat daría dos
    // formas de tirar sobre el mismo tablero.
    await abrir("wordle");
    expect(
      await handlers.handleText(update({ text: "PERRO" }), TENANT),
    ).toBeNull();
    expect(publicados).toHaveLength(1);
  });

  it("no se abre un segundo wordle en el mismo chat", async () => {
    // Compartirían palabra del día, así que el segundo no tendría gracia.
    await abrir("wordle");
    const otro = await handlers.handleCommand(
      update({ command: { name: "jugar", args: ["wordle"] } }),
      TENANT,
    );
    expect(otro?.text).toContain("Ya hay");
  });
});

describe("mesas de varios", () => {
  it("el impostor abre lobby con el anfitrión ya sentado", async () => {
    const { reply, match } = await abrir("impostor");
    expect(reply?.text).toContain("1/");
    expect(await players.roster(match.id)).toHaveLength(1);
  });

  it("apuntarse llena la mesa", async () => {
    const { match } = await abrir("impostor");
    for (const [id, nombre] of [
      [2n, "Luis"],
      [3n, "Eva"],
    ] as const) {
      await handlers.handleCallback(
        update({
          callbackData: buildChatGameCallback("join", match.id),
          userId: id,
          name: nombre,
        }),
      );
    }
    const reply = await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("join", match.id),
        userId: 4n,
        name: "Marc",
      }),
    );
    expect(reply?.text).toContain("4/");
    expect(reply?.text).toContain("Marc");
    expect(reply?.text).toContain("Ya se puede empezar");
  });

  it("nadie se sienta dos veces", async () => {
    const { match } = await abrir("impostor");
    const repetido = await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("join", match.id),
        userId: 1n,
      }),
    );
    expect(repetido).toBeNull();
    expect(await players.roster(match.id)).toHaveLength(1);
  });

  it("no se puede empezar con la mesa a medias", async () => {
    const { match } = await abrir("impostor");
    expect(
      await handlers.handleCallback(
        update({
          callbackData: buildChatGameCallback("start", match.id),
          userId: 1n,
        }),
      ),
    ).toBeNull();
  });

  it("solo el anfitrión arranca", async () => {
    // Si arrancase cualquiera, el último en llegar la empezaría mientras la
    // gente todavía se está apuntando.
    const { match } = await abrir("impostor");
    for (const id of [2n, 3n, 4n]) {
      await handlers.handleCallback(
        update({
          callbackData: buildChatGameCallback("join", match.id),
          userId: id,
        }),
      );
    }
    expect(
      await handlers.handleCallback(
        update({
          callbackData: buildChatGameCallback("start", match.id),
          userId: 3n,
        }),
      ),
    ).toBeNull();
  });

  it("al arrancar, la palabra NO sale en el mensaje del grupo", async () => {
    const { match } = await abrir("impostor");
    for (const id of [2n, 3n, 4n]) {
      await handlers.handleCallback(
        update({
          callbackData: buildChatGameCallback("join", match.id),
          userId: id,
        }),
      );
    }
    const reply = await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("start", match.id),
        userId: 1n,
      }),
    );
    expect(reply?.text).toContain("ronda 1");

    // Ni la palabra del grupo ni la del impostor pueden aparecer en un mensaje
    // que ve todo el chat.
    const secreto = (await players.secretFor(match.id, 1n)) as {
      word: string;
    } | null;
    expect(secreto?.word).toBeTruthy();
    expect(reply?.text).not.toContain(secreto?.word ?? "###");
  });

  it("cada uno recibe su propio secreto y solo uno es el impostor", async () => {
    const { match } = await abrir("impostor");
    for (const id of [2n, 3n, 4n]) {
      await handlers.handleCallback(
        update({
          callbackData: buildChatGameCallback("join", match.id),
          userId: id,
        }),
      );
    }
    await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("start", match.id),
        userId: 1n,
      }),
    );

    const roles = await Promise.all(
      [1n, 2n, 3n, 4n].map(async (id) => {
        const s = (await players.secretFor(match.id, id)) as {
          role: string;
        } | null;
        return s?.role;
      }),
    );
    expect(roles.filter((r) => r === "impostor")).toHaveLength(1);
    expect(roles.filter((r) => r === "crew")).toHaveLength(3);
  });

  it("las cartas reparten mano privada y enseñan solo la carta en juego", async () => {
    const { match } = await abrir("cartas");
    await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("join", match.id),
        userId: 2n,
      }),
    );
    const reply = await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("start", match.id),
        userId: 1n,
      }),
    );
    expect(reply?.text).toContain("Carta en juego");

    const mano = (await players.secretFor(match.id, 1n)) as {
      hand: string[];
    } | null;
    expect(mano?.hand).toHaveLength(7);
    // Ninguna carta de la mano puede leerse en el mensaje del grupo.
    for (const carta of mano?.hand ?? []) {
      expect(reply?.text).not.toContain(`"${carta}"`);
    }
  });

  it("el botón de lo privado apunta a la Mini App de esa partida", async () => {
    const { match } = await abrir("cartas");
    await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("join", match.id),
        userId: 2n,
      }),
    );
    const reply = await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("start", match.id),
        userId: 1n,
      }),
    );
    const botones = (reply?.replyMarkup?.inline_keyboard ?? []) as {
      url?: string;
    }[][];
    expect(botones.flat()[0]?.url).toContain(match.id);
  });
});

describe("retirar", () => {
  it("el anfitrión puede retirar la suya", async () => {
    const { match } = await abrir("conecta4");
    const reply = await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("cancel", match.id),
        userId: 1n,
      }),
    );
    expect(reply?.text).toContain("retirada");
  });

  it("otro no", async () => {
    const { match } = await abrir("conecta4");
    expect(
      await handlers.handleCallback(
        update({
          callbackData: buildChatGameCallback("cancel", match.id),
          userId: 9n,
        }),
      ),
    ).toBeNull();
  });

  it("una partida que no existe se dice y ya", async () => {
    const reply = await handlers.handleCallback(
      update({ callbackData: buildChatGameCallback("join", "no-existe") }),
    );
    expect(reply?.text).toContain("ya no existe");
  });
});

describe("catálogo", () => {
  it("los juegos con secretos están marcados", () => {
    expect(gameSpec("impostor")?.hasSecrets).toBe(true);
    expect(gameSpec("cartas")?.hasSecrets).toBe(true);
    expect(gameSpec("conecta4")?.hasSecrets).toBe(false);
  });

  it("no hay claves repetidas", () => {
    expect(new Set(GAMES.map((g) => g.key)).size).toBe(GAMES.length);
  });
});

/**
 * El bucle del impostor: pistas, votación y cierre de ronda.
 *
 * Antes esto no existía — la partida repartía y se paraba, y el mensaje del
 * grupo pedía al grupo que se lo jugara de viva voz.
 */
describe("impostor — la partida entera", () => {
  const JUGADORES = [1n, 2n, 3n, 4n];

  /** Mesa de cuatro, repartida y lista para dar pistas. */
  const repartir = async () => {
    const { match } = await abrir("impostor");
    for (const id of JUGADORES.slice(1)) {
      await handlers.handleCallback(
        update({
          callbackData: buildChatGameCallback("join", match.id),
          userId: id,
        }),
      );
    }
    await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("start", match.id),
        userId: 1n,
      }),
    );
    return match;
  };

  const pista = (userId: bigint, palabra: string) =>
    handlers.handleCommand(
      update({ command: { name: "pista", args: [palabra] }, userId }),
      TENANT,
    );

  const votar = (matchId: string, votante: bigint, aQuien: bigint) =>
    handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("vote", matchId, aQuien.toString()),
        userId: votante,
      }),
    );

  /** Quién es el impostor, leído de los secretos como haría la Mini App. */
  const quienEsElImpostor = async (matchId: string): Promise<bigint> => {
    for (const id of JUGADORES) {
      const s = (await players.secretFor(matchId, id)) as {
        role?: string;
      } | null;
      if (s?.role === "impostor") {
        return id;
      }
    }
    throw new Error("ninguno es el impostor");
  };

  /** Las cuatro pistas de una ronda, y lo último que contestó el bot. */
  const rondaDePistas = async () => {
    let ultima = null;
    for (const [i, id] of JUGADORES.entries()) {
      ultima = await pista(id, `p${i}`);
    }
    return ultima;
  };

  it("una pista aparece en el tablero, y las que faltan también", async () => {
    await repartir();
    const reply = await pista(1n, "rojo");

    expect(reply?.text).toContain("rojo");
    expect(reply?.text).toContain("Faltan 3");
  });

  it("una pista de más de una palabra no cuela", async () => {
    // Una frase permite describir la palabra entera y el juego se acaba.
    await repartir();
    const largo = await handlers.handleCommand(
      update({ command: { name: "pista", args: ["muy", "rojo"] }, userId: 2n }),
      TENANT,
    );
    expect(largo?.text).toContain("Una sola palabra");
  });

  it("no puedes decir tu propia palabra como pista, y el rechazo no la delata", async () => {
    const match = await repartir();
    const secreto = (await players.secretFor(match.id, 1n)) as { word: string };
    const rechazo = (await pista(1n, secreto.word))?.text ?? "";
    expect(rechazo).toContain("Esa no cuela");
    // Lo importante es lo que NO dice. La pista se escribe en el chat del
    // grupo, o sea que todo el mundo la ha visto ya; si ademas el bot
    // confirma en publico que ESA es la palabra secreta, como la comparte
    // toda la tripulacion, el impostor gana la partida en ese mensaje.
    expect(rechazo).not.toContain("tu palabra");
    expect(rechazo).not.toContain(secreto.word);
  });

  it("nadie dice dos pistas en la misma ronda", async () => {
    await repartir();
    await pista(1n, "rojo");
    expect((await pista(1n, "azul"))?.text).toContain("Ya has dicho la tuya");
  });

  it("quien no juega no recibe ni respuesta", async () => {
    await repartir();
    expect(await pista(99n, "rojo")).toBeNull();
  });

  it("con todas las pistas se abre la votación, un botón por jugador", async () => {
    await repartir();
    const ultima = await rondaDePistas();

    expect(ultima?.text).toContain("votación");
    const teclado = ultima?.replyMarkup as {
      inline_keyboard: { callback_data: string }[][];
    };
    expect(teclado.inline_keyboard.flat()).toHaveLength(4);
  });

  it("votarse a uno mismo se rechaza", async () => {
    const match = await repartir();
    await rondaDePistas();
    expect((await votar(match.id, 1n, 1n))?.text).toContain("A ti mismo no");
  });

  it("si cae el impostor, gana el grupo y se destapan las dos palabras", async () => {
    const match = await repartir();
    await rondaDePistas();

    const impostorId = await quienEsElImpostor(match.id);
    const inocentes = JUGADORES.filter((id) => id !== impostorId);
    for (const votante of inocentes) {
      await votar(match.id, votante, impostorId);
    }
    // El impostor vota el último: es su voto el que cierra la ronda.
    const ultima = await votar(match.id, impostorId, inocentes[0] as bigint);

    expect(ultima?.text).toContain("era el impostor");
    expect(ultima?.text).toContain("Gana el grupo");
    expect(ultima?.text).toContain("Palabra del grupo");

    const cerrada = await matches.find(match.id);
    expect(cerrada?.status).toBe("finished");
    expect(cerrada?.result).toBe("crew");
  });

  it("si cae un inocente, la partida sigue en la ronda siguiente", async () => {
    const match = await repartir();
    await rondaDePistas();

    const impostorId = await quienEsElImpostor(match.id);
    const victima = JUGADORES.filter((id) => id !== impostorId)[0] as bigint;
    for (const votante of JUGADORES.filter((id) => id !== victima)) {
      await votar(match.id, votante, victima);
    }
    const ultima = await votar(match.id, victima, impostorId);

    expect(ultima?.text).toContain("no era el impostor");
    expect(ultima?.text).toContain("ronda 2");

    // Sigue viva y localizable por chat: si pasara a "playing", /pista dejaría
    // de encontrarla y la partida se moriría justo aquí.
    expect((await matches.find(match.id))?.status).toBe("open");

    // Y el eliminado queda marcado fuera, para que la Mini App enseñe lo mismo
    // que el chat.
    const roster = await players.roster(match.id);
    expect(roster.find((s) => s.userId === victima)?.status).toBe("out");
  });

  it("en la ronda 2 el eliminado calla y los vivos siguen jugando", async () => {
    // Las dos mitades van juntas a propósito. Comprobar solo que el eliminado
    // recibe null pasaría igual si /pista estuviera roto para TODOS en la
    // ronda 2, que es exactamente el fallo que mató al wordle y al ahorcado
    // después de una jugada.
    const match = await repartir();
    await rondaDePistas();
    const impostorId = await quienEsElImpostor(match.id);
    const victima = JUGADORES.filter((id) => id !== impostorId)[0] as bigint;
    for (const votante of JUGADORES.filter((id) => id !== victima)) {
      await votar(match.id, votante, victima);
    }
    await votar(match.id, victima, impostorId);

    expect(await pista(victima, "tarde")).toBeNull();

    const vivo = JUGADORES.filter(
      (id) => id !== victima && id !== impostorId,
    )[0] as bigint;
    const reply = await pista(vivo, "sigo");
    expect(reply?.text).toContain("sigo");
    expect(reply?.text).toContain("ronda 2");
    expect(reply?.text).toContain("Faltan 2");
  });

  it("nadie se apunta a una partida ya repartida", async () => {
    // El botón de apuntarse de un mensaje viejo sigue vivo: sentaría a alguien
    // sin palabra ni rol, y el motor lo esperaría para cerrar la ronda.
    const match = await repartir();
    const tarde = await handlers.handleCallback(
      update({
        callbackData: buildChatGameCallback("join", match.id),
        userId: 9n,
      }),
    );
    expect(tarde).toBeNull();
    expect(await players.roster(match.id)).toHaveLength(4);
  });

  it("ninguna de las dos palabras sale en el chat mientras se juega", async () => {
    const match = await repartir();
    const impostorId = await quienEsElImpostor(match.id);
    const delImpostor = (await players.secretFor(match.id, impostorId)) as {
      word: string;
    };
    const delGrupo = (await players.secretFor(
      match.id,
      JUGADORES.find((id) => id !== impostorId) as bigint,
    )) as { word: string };

    const textos: string[] = [];
    for (const [i, id] of JUGADORES.entries()) {
      const r = await pista(id, `p${i}`);
      if (r?.text) {
        textos.push(r.text);
      }
    }
    for (const texto of textos) {
      expect(texto).not.toContain(delImpostor.word);
      expect(texto).not.toContain(delGrupo.word);
    }
  });
});

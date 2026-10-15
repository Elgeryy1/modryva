import {
  InMemoryGameMatchPlayerRepository,
  InMemoryGameMatchRepository,
} from "@superbot/data";
import { colorCards } from "@superbot/module-games";
import { buildMiniAppLink, getRuntimeEnv } from "@superbot/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { CardsService } from "./cards.service.js";

/**
 * `CardsService`: el unico sitio del proyecto donde una jugada llega desde
 * fuera del chat.
 *
 * Se prueba el servicio de verdad con los repositorios en memoria. Lo que
 * importa aqui es lo que tiene consecuencias: que nadie vea la mano de otro,
 * que no se pueda tirar fuera de turno, y que una pantalla vieja no juegue a
 * ciegas sobre una mesa que ya cambio.
 */

const TENANT = "t1";
let service: CardsService;
let matches: InMemoryGameMatchRepository;
let seats: InMemoryGameMatchPlayerRepository;
let matchId: string;

/** Una mesa de tres, repartida y guardada como lo hace el bot. */
const montar = async (over?: Partial<colorCards.ColorCardsState>) => {
  matches = new InMemoryGameMatchRepository();
  seats = new InMemoryGameMatchPlayerRepository();
  service = new CardsService(matches, seats);

  const base = colorCards.startGame([0, 1, 2], 12345);
  if (!base) {
    throw new Error("no se pudo repartir");
  }
  const state = { ...base, ...over } as colorCards.ColorCardsState;
  const { shared, hands } = colorCards.splitState(state);

  const match = await matches.create({
    tenantId: TENANT,
    chatId: -100n,
    game: "cartas",
    hostId: 1n,
    hostName: "Ana",
    state: shared,
  });
  matchId = match.id;

  for (const [i, id] of [1n, 2n, 3n].entries()) {
    await seats.join({
      matchId,
      tenantId: TENANT,
      userId: id,
      name: ["Ana", "Luis", "Marc"][i] ?? null,
      maxPlayers: 10,
    });
  }
  await seats.dealSecrets(
    matchId,
    new Map([1n, 2n, 3n].map((id, i) => [id, { hand: hands[i] ?? [] }])),
  );
  return { match, state };
};

beforeEach(async () => {
  await montar();
});

/** El usuario que ocupa un asiento, tal como llega desde initData. */
const usuarioDe = (seat: number) => String(seat + 1);

describe("lo que ve cada uno", () => {
  it("te da TU mano y de los demas solo el numero", async () => {
    const view = await service.table("1", matchId);

    expect(view.seat).toBe(0);
    expect(view.hand).toHaveLength(colorCards.HAND_SIZE);
    expect(view.players).toHaveLength(3);
    for (const p of view.players) {
      expect(p.cards).toBe(colorCards.HAND_SIZE);
    }
    // La respuesta entera no puede contener la mano de otro por ningun camino:
    // ni en un campo con nombre ni de rebote dentro del estado compartido.
    const otra = (await seats.secretFor(matchId, 2n)) as {
      hand: colorCards.Card[];
    };
    const mias = new Set([...view.hand, view.table?.top]);
    const soloSuyas = otra.hand.filter((c) => !mias.has(c));
    // Si no quedara ninguna, el test no probaria nada — el reparto tendria que
    // ser degenerado para eso, y conviene enterarse si algun dia pasa.
    expect(soloSuyas.length).toBeGreaterThan(0);

    const serializado = JSON.stringify(view);
    for (const carta of soloSuyas) {
      expect(serializado).not.toContain(`"${carta}"`);
    }
  });

  it("quien mira sin jugar ve la mesa y ninguna mano", async () => {
    const view = await service.table("999", matchId);

    expect(view.seat).toBeNull();
    expect(view.hand).toEqual([]);
    expect(view.playable).toEqual([]);
    expect(view.table).not.toBeNull();
  });

  it("el monton de robar sale como numero, nunca como lista", async () => {
    // Enseñar el orden del monton es enseñar todas las cartas que van a salir.
    const view = await service.table("1", matchId);
    expect(typeof view.table?.deckSize).toBe("number");
    expect(JSON.stringify(view)).not.toContain('"deck"');
  });

  it("solo se ofrecen jugadas a quien le toca", async () => {
    const deQuienEs = (await service.table("1", matchId)).table?.turnSeat ?? 0;
    const otro = [0, 1, 2].find((s) => s !== deQuienEs) as number;

    expect((await service.table(usuarioDe(otro), matchId)).playable).toEqual(
      [],
    );
  });
});

describe("tirar una carta", () => {
  it("una jugada legal cambia la mesa y pasa el turno", async () => {
    const antes = await service.table("1", matchId);
    const turno = antes.table?.turnSeat ?? 0;
    const quien = usuarioDe(turno);
    const mano = await service.table(quien, matchId);
    const carta = mano.playable.find((c) => !colorCards.isWild(c));
    if (!carta) {
      return; // Reparto sin carta simple jugable: no es lo que prueba esto.
    }

    const despues = await service.play(
      quien,
      matchId,
      carta,
      null,
      mano.version,
    );

    expect(despues.table?.top).toBe(carta);
    expect(despues.table?.turnSeat).not.toBe(turno);
    expect(despues.hand).toHaveLength(colorCards.HAND_SIZE - 1);
  });

  it("no se puede tirar fuera de turno", async () => {
    const view = await service.table("1", matchId);
    const turno = view.table?.turnSeat ?? 0;
    const otro = [0, 1, 2].find((s) => s !== turno) as number;
    const suya = await service.table(usuarioDe(otro), matchId);

    await expect(
      service.play(
        usuarioDe(otro),
        matchId,
        suya.hand[0] as string,
        null,
        suya.version,
      ),
    ).rejects.toMatchObject({ response: { error: "not-your-turn" } });
  });

  it("no se puede tirar una carta que no tienes", async () => {
    const view = await service.table("1", matchId);
    const turno = view.table?.turnSeat ?? 0;
    const quien = usuarioDe(turno);
    const suya = await service.table(quien, matchId);
    const ajena = colorCards
      .buildDeck()
      .find((c) => !suya.hand.includes(c)) as string;

    await expect(
      service.play(quien, matchId, ajena, null, suya.version),
    ).rejects.toMatchObject({ response: {} });
  });

  it("quien no juega no puede tirar aunque acierte la carta", async () => {
    const view = await service.table("1", matchId);
    await expect(
      service.play(
        "999",
        matchId,
        view.table?.top as string,
        null,
        view.version,
      ),
    ).rejects.toMatchObject({ response: { error: "not-a-player" } });
  });

  it("una pantalla vieja no juega a ciegas", async () => {
    // La version es la mesa contra la que se decidio. Si cambio, la jugada se
    // decidio mirando otra cosa.
    const view = await service.table("1", matchId);
    const turno = view.table?.turnSeat ?? 0;
    const quien = usuarioDe(turno);
    const suya = await service.table(quien, matchId);

    await expect(
      service.play(
        quien,
        matchId,
        suya.hand[0] as string,
        null,
        suya.version - 1,
      ),
    ).rejects.toMatchObject({ response: { error: "stale-table" } });
  });

  it("el comodin exige color: sin el, no se tira", async () => {
    // Que lo eligiera el servidor convertiria la mejor carta del juego en una
    // tirada al azar.
    const { state } = await montar();
    const turno = state.turnSeat;
    const mano = [...(state.hands[turno] ?? [])];
    mano[0] = "W";
    const conComodin = colorCards.mergeState(
      colorCards.splitState(state).shared,
      {
        ...state.hands,
        [turno]: mano,
      },
    );
    const { shared, hands } = colorCards.splitState(conComodin);
    await matches.commitMove({
      id: matchId,
      expectedVersion: (await matches.find(matchId))?.version ?? 0,
      state: shared,
      status: "playing",
      result: null,
    });
    await seats.dealSecrets(
      matchId,
      new Map([1n, 2n, 3n].map((id, i) => [id, { hand: hands[i] ?? [] }])),
    );

    const quien = usuarioDe(turno);
    const suya = await service.table(quien, matchId);
    await expect(
      service.play(quien, matchId, "W", null, suya.version),
    ).rejects.toMatchObject({ response: { error: "color-required" } });

    const ok = await service.play(quien, matchId, "W", "G", suya.version);
    expect(ok.table?.activeColor).toBe("G");
  });
});

describe("robar", () => {
  it("robar suma una carta y pasa el turno", async () => {
    const view = await service.table("1", matchId);
    const turno = view.table?.turnSeat ?? 0;
    const quien = usuarioDe(turno);
    const suya = await service.table(quien, matchId);

    const despues = await service.draw(quien, matchId, suya.version);

    expect(despues.hand.length).toBe(suya.hand.length + 1);
    expect(despues.table?.turnSeat).not.toBe(turno);
  });

  it("no se puede robar en turno ajeno", async () => {
    const view = await service.table("1", matchId);
    const turno = view.table?.turnSeat ?? 0;
    const otro = [0, 1, 2].find((s) => s !== turno) as number;
    const suya = await service.table(usuarioDe(otro), matchId);

    await expect(
      service.draw(usuarioDe(otro), matchId, suya.version),
    ).rejects.toMatchObject({ response: { error: "not-your-turn" } });
  });
});

describe("la mesa que ve el grupo", () => {
  it("dice de quien es el turno y cuantas cartas lleva cada uno", async () => {
    const { state } = await montar();
    const texto = colorCards.renderTable(
      state,
      new Map([
        [0, "Ana"],
        [1, "Luis"],
        [2, "Marc"],
      ]),
    );

    expect(texto).toContain("Ana");
    expect(texto).toContain("7 cartas");
    expect(texto).toContain("▶️");
  });

  it("NUNCA lleva una carta de la mano de nadie", async () => {
    // Este texto lo lee el chat entero, incluido quien juega en contra.
    const { state } = await montar();
    const texto = colorCards.renderTable(state, new Map());

    for (const seat of state.seats) {
      for (const carta of state.hands[seat] ?? []) {
        // La carta de arriba de la mesa SI sale, y puede coincidir con una de
        // una mano; se compara contra el resto.
        if (carta === colorCards.topCard(state)) {
          continue;
        }
        expect(texto).not.toContain(colorCards.renderCard(carta));
      }
    }
  });

  it("escapa el nombre de quien juega", async () => {
    const { state } = await montar();
    const texto = colorCards.renderTable(state, new Map([[0, "<b>Ana</b>"]]));
    expect(texto).toContain("&lt;b&gt;Ana&lt;/b&gt;");
  });
});

describe("el enlace de vuelta a la Mini App", () => {
  /**
   * El boton que el servicio deja en el mensaje del grupo tiene que abrir la
   * Mini App. Estaba escrito a mano con "/app", y el nombre corto real sale de
   * `TELEGRAM_MINIAPP_NAME` (por defecto "config"): el boton del bot funcionaba
   * y el que ponia este servicio, no. Entrabas una vez y no podias volver.
   *
   * Se compara contra `buildMiniAppLink`, que es de donde salen todos los demas
   * enlaces del proyecto, para que las tres piezas no puedan divergir otra vez.
   */
  it("es el mismo que produce el constructor compartido", async () => {
    const enviados: { replyMarkup?: unknown }[] = [];
    const espia = {
      async editMessageText(input: {
        reply: { replyMarkup?: Record<string, unknown> };
      }) {
        enviados.push({ replyMarkup: input.reply.replyMarkup });
        return { ok: true, skipped: false };
      },
    };
    // El gateway es privado a proposito; se sustituye para poder mirar lo que
    // sale hacia Telegram sin llamar a Telegram.
    (service as unknown as { gateway: unknown }).gateway = espia;
    await matches.attachMessage(matchId, 555);

    const view = await service.table("1", matchId);
    const turno = view.table?.turnSeat ?? 0;
    const quien = usuarioDe(turno);
    const suya = await service.table(quien, matchId);
    await service.draw(quien, matchId, suya.version, {
      username: "modryvabot",
      token: "t",
    });

    const teclado = enviados[0]?.replyMarkup as
      | { inline_keyboard: { url: string }[][] }
      | undefined;
    const url = teclado?.inline_keyboard[0]?.[0]?.url ?? "";
    const env = getRuntimeEnv();

    expect(url).toBe(
      buildMiniAppLink("modryvabot", env.TELEGRAM_MINIAPP_NAME, `m_${matchId}`),
    );
    // Y el sintoma, dicho tal cual: nada de "/app" inventado.
    expect(url).not.toContain("/app?");
  });
});

describe("el historial que se ve en el chat", () => {
  it("se va llenando con cada jugada, sin mandar mensajes nuevos", async () => {
    const editados: string[] = [];
    (service as unknown as { gateway: unknown }).gateway = {
      async editMessageText(input: { reply: { text: string } }) {
        editados.push(input.reply.text);
        return { ok: true, skipped: false };
      },
      async sendMessage() {
        throw new Error("no debe mandar mensajes nuevos");
      },
    };
    await matches.attachMessage(matchId, 555);

    for (let i = 0; i < 3; i += 1) {
      const actual = await service.table("1", matchId);
      const turno = actual.table?.turnSeat ?? 0;
      const suya = await service.table(usuarioDe(turno), matchId);
      await service.draw(usuarioDe(turno), matchId, suya.version);
    }

    expect(editados).toHaveLength(3);
    // El ultimo mensaje acumula las tres jugadas.
    for (const nombre of ["Ana", "Luis", "Marc"]) {
      expect(editados[2]).toContain(nombre);
    }
    expect(editados[2]).toContain("robó");
  });

  it("se queda con las ultimas y no crece sin fin", () => {
    let log: readonly string[] = [];
    for (let i = 0; i < 20; i += 1) {
      log = colorCards.pushMove(log, `jugada ${i}`);
    }
    expect(log).toHaveLength(colorCards.LOG_LINES);
    expect(log[log.length - 1]).toBe("jugada 19");
  });

  it("NUNCA nombra una carta que sigue en la mano de alguien", async () => {
    // Es lo unico que hay que vigilar aqui: el historial lo lee el chat entero,
    // y una carta tirada ya esta boca arriba, pero una de la mano no.
    const { state } = await montar();
    const enMano = new Set(
      state.seats.flatMap((s) => [...(state.hands[s] ?? [])]),
    );
    const texto = colorCards.renderTable(state, new Map([[0, "Ana"]]), [
      colorCards.describeMove({
        who: "Ana",
        card: colorCards.topCard(state),
        cardsLeft: 3,
      }),
    ]);
    for (const carta of enMano) {
      if (carta === colorCards.topCard(state)) {
        continue;
      }
      expect(texto).not.toContain(colorCards.renderCard(carta));
    }
  });

  it("avisa cuando a alguien le queda una sola carta", () => {
    const linea = colorCards.describeMove({
      who: "Ana",
      card: "R5",
      cardsLeft: 1,
    });
    expect(linea).toContain("¡le queda 1!");

    expect(
      colorCards.describeMove({ who: "Ana", card: "R5", cardsLeft: 4 }),
    ).not.toContain("queda 1");
  });

  it("el comodin dice a que color se cambio", () => {
    const linea = colorCards.describeMove({
      who: "Ana",
      card: "W",
      chosenColor: "G",
      cardsLeft: 3,
    });
    expect(linea).toContain("verde");
  });

  it("escapa el nombre en el historial", () => {
    const linea = colorCards.describeMove({
      who: "<b>Ana</b>",
      card: "R5",
      cardsLeft: 3,
    });
    expect(linea).toContain("&lt;b&gt;Ana&lt;/b&gt;");
  });
});

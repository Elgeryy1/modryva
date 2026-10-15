import { InMemoryGameMatchRepository } from "@superbot/data";
import { emptyBoard } from "@superbot/module-games";
import { describe, expect, it } from "vitest";
import { MatchService } from "./match.service.js";

/**
 * What is pinned here is the part a two-player game gets wrong: races. Two
 * people accepting the same invite, one person's two taps both landing, and a
 * spectator trying to play.
 */

const GROUP = "games_-1001";

const makeService = (opciones: { estado?: string } = {}) => {
  const matches = new InMemoryGameMatchRepository();
  const sent: { chatId: bigint; text: string }[] = [];
  const svc = new MatchService();
  Object.assign(svc, {
    matches,
    client: { tenant: { findUnique: async () => ({ id: "t1" }) } },
    // El chat y la pertenencia son dobles a proposito: sin ellos, cada test se
    // ponia a llamar a la API de Telegram de verdad y tardaba cuatro segundos
    // en rendirse. Por defecto quien pregunta ES miembro, que es el caso normal.
    foundation: {
      findChatByTelegramId: async () => ({ chatId: "chat_interno" }),
    },
    gateway: {
      getChatMember: async () => ({
        ok: true,
        status: opciones.estado ?? "member",
      }),
      sendMessage: async (input: {
        chatId: bigint;
        reply: { text: string };
      }) => {
        sent.push({ chatId: input.chatId, text: input.reply.text });
        return { ok: true, skipped: false, messageId: 500 };
      },
      editMessageText: async () => ({ ok: true, skipped: false }),
    },
  });
  return { svc, matches, sent };
};

describe("MatchService.open", () => {
  it("announces the match in the group it was opened from", async () => {
    const { svc, sent } = makeService();
    const match = await svc.open("111", GROUP, "tictactoe", "Ana");
    expect(match.status).toBe("open");
    expect(sent).toHaveLength(1);
    expect(sent[0]?.chatId).toBe(-1001n);
    expect(sent[0]?.text).toContain("Ana");
  });

  it("refuses a game that is not two-player", async () => {
    const { svc } = makeService();
    await expect(svc.open("111", GROUP, "reflex", "Ana")).rejects.toThrow();
  });

  it("refuses to open outside a group", async () => {
    // There is nowhere to advertise, which is the whole point of the feature.
    const { svc } = makeService();
    await expect(svc.open("111", null, "tictactoe", "Ana")).rejects.toThrow();
    await expect(
      svc.open("111", "games", "tictactoe", "Ana"),
    ).rejects.toThrow();
  });

  it("still yields a playable match when the group post fails", async () => {
    // The match already exists and the host is already looking at it; an
    // un-postable group must not turn that into an error.
    const { svc } = makeService();
    Object.assign(svc, {
      gateway: {
        // La pertenencia sigue respondiendo: lo que falla aqui es SOLO el
        // envio, que es lo que este test quiere probar.
        getChatMember: async () => ({ ok: true, status: "member" }),
        sendMessage: async () => {
          throw new Error("CHAT_ADMIN_REQUIRED");
        },
        editMessageText: async () => ({ ok: true }),
      },
    });
    const match = await svc.open("111", GROUP, "tictactoe", "Ana");
    expect(match.id).toBeTruthy();
    expect(match.announced).toBe(false);
  });
});

describe("MatchService.join", () => {
  it("gives the seat to the first person only", async () => {
    const { svc } = makeService();
    const match = await svc.open("111", GROUP, "tictactoe", "Ana");
    await svc.join("222", match.id, "Luis");
    // The second person is refused rather than silently replacing the first.
    await expect(svc.join("333", match.id, "Eva")).rejects.toThrow();
  });

  it("refuses the host joining their own match", async () => {
    const { svc } = makeService();
    const match = await svc.open("111", GROUP, "tictactoe", "Ana");
    await expect(svc.join("111", match.id, "Ana")).rejects.toThrow();
  });

  it("refuses a match that does not exist", async () => {
    const { svc } = makeService();
    await expect(svc.join("222", "nope", "Luis")).rejects.toThrow();
  });
});

describe("MatchService.move", () => {
  const started = async () => {
    const { svc, matches } = makeService();
    const match = await svc.open("111", GROUP, "tictactoe", "Ana");
    const joined = await svc.join("222", match.id, "Luis");
    return { svc, matches, id: match.id, version: joined.version };
  };

  it("lets the host open and hands the turn over", async () => {
    const { svc, id, version } = await started();
    const after = await svc.move("111", id, 0, version);
    expect(after.board[0]).toBe("X");
    expect(after.yourTurn).toBe(false);
  });

  it("refuses a move from someone who is not playing", async () => {
    // Spectators watch. That is the whole contract of the "ver la partida"
    // button, and it cannot rest on the client hiding the board.
    const { svc, id, version } = await started();
    await expect(svc.move("999", id, 0, version)).rejects.toThrow();
  });

  it("refuses a move aimed at a board that has moved on", async () => {
    // Two taps in flight from the same person: the second carries the version
    // of the board they were looking at, which no longer exists.
    const { svc, id, version } = await started();
    await svc.move("111", id, 0, version);
    await expect(svc.move("222", id, 1, version)).rejects.toThrow();
  });

  it("refuses playing out of turn", async () => {
    const { svc, id, version } = await started();
    await expect(svc.move("222", id, 0, version)).rejects.toThrow();
  });

  it("finishes the match and records who won", async () => {
    const { svc, id } = await started();
    let v = (await svc.state("111", id)).version;
    const seq: Array<[string, number]> = [
      ["111", 0],
      ["222", 3],
      ["111", 1],
      ["222", 4],
      ["111", 2],
    ];
    let last = await svc.state("111", id);
    for (const [who, cell] of seq) {
      last = await svc.move(who, id, cell, v);
      v = last.version;
    }
    expect(last.status).toBe("finished");
    expect(last.result).toBe("host");
  });

  it("refuses any move once the match is finished", async () => {
    const { svc, id } = await started();
    let v = (await svc.state("111", id)).version;
    for (const [who, cell] of [
      ["111", 0],
      ["222", 3],
      ["111", 1],
      ["222", 4],
      ["111", 2],
    ] as Array<[string, number]>) {
      v = (await svc.move(who, id, cell, v)).version;
    }
    await expect(svc.move("222", id, 5, v)).rejects.toThrow();
  });

  it("refuses a move before anyone has joined", async () => {
    const { svc } = makeService();
    const match = await svc.open("111", GROUP, "tictactoe", "Ana");
    await expect(svc.move("111", match.id, 0, match.version)).rejects.toThrow();
  });
});

describe("MatchService.state", () => {
  it("tells a spectator they have no seat", async () => {
    const { svc } = makeService();
    const match = await svc.open("111", GROUP, "tictactoe", "Ana");
    await svc.join("222", match.id, "Luis");
    const seen = await svc.state("999", match.id);
    expect(seen.seat).toBeNull();
    expect(seen.yourTurn).toBe(false);
  });

  it("starts every match from an empty board", async () => {
    const { svc } = makeService();
    const match = await svc.open("111", GROUP, "tictactoe", "Ana");
    expect(match.board).toEqual(emptyBoard());
  });
});

describe("MatchService.lobby", () => {
  it("never offers you your own invite", async () => {
    const { svc } = makeService();
    await svc.open("111", GROUP, "tictactoe", "Ana");
    expect((await svc.lobby("111", GROUP)).rows).toEqual([]);
    expect((await svc.lobby("222", GROUP)).rows).toHaveLength(1);
  });

  it("drops an invite once its seat is taken", async () => {
    const { svc } = makeService();
    const match = await svc.open("111", GROUP, "tictactoe", "Ana");
    await svc.join("222", match.id, "Luis");
    expect((await svc.lobby("333", GROUP)).rows).toEqual([]);
  });
});

/**
 * El agujero que cerro el helper compartido: el id del grupo venia del
 * `start_param`, que lo elige quien construye el enlace.
 */
describe("MatchService — el grupo tiene que ser TUYO", () => {
  it("no deja abrir partida en un grupo del que no eres miembro", async () => {
    const { svc, sent } = makeService({ estado: "left" });
    await expect(svc.open("111", GROUP, "tictactoe", "Ana")).rejects.toThrow();
    expect(sent).toHaveLength(0);
  });

  it("tampoco si te han EXPULSADO de el", async () => {
    // La parte que de verdad duele: sin esta comprobacion, un baneado seguia
    // haciendo que el bot escribiera su nombre en el grupo.
    const { svc, sent } = makeService({ estado: "kicked" });
    await expect(svc.open("111", GROUP, "tictactoe", "Ana")).rejects.toThrow();
    expect(sent).toHaveLength(0);
  });

  it("y tampoco puedes leer el lobby de un grupo ajeno", async () => {
    const { svc } = makeService({ estado: "left" });
    await expect(svc.lobby("111", GROUP)).rejects.toThrow();
  });
});

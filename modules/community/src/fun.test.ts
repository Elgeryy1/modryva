import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  botRpsChoice,
  buildFunReply,
  buildRpsKeyboard,
  buildRpsReply,
  coinFlip,
  EIGHT_BALL_ANSWERS,
  eightBallAnswer,
  type FunCommand,
  loveScore,
  loveVerdict,
  NATIVE_DICE,
  parseFunCommand,
  parseRpsCallback,
  RPS_EMOJI,
  type RpsChoice,
  rateScore,
  rollDice,
  rpsOutcome,
} from "./fun.js";

const baseUpdate = (
  overrides: Partial<TelegramUpdateEnvelope> = {},
): TelegramUpdateEnvelope => ({
  updateId: 1,
  kind: "message",
  receivedAt: new Date("2026-01-01T00:00:00Z"),
  chat: { chatId: 100n, chatType: "supergroup", topicId: undefined },
  user: { userId: 7n, username: "tester", languageCode: "es" },
  command: undefined,
  callbackData: undefined,
  messageText: undefined,
  content: {
    hasText: true,
    hasUrl: false,
    hasMention: false,
    isForward: false,
    viaBot: false,
    hasPhoto: false,
    hasVideo: false,
    hasAnimation: false,
    hasSticker: false,
    hasAudio: false,
    hasVoice: false,
    hasDocument: false,
    hasContact: false,
    hasLocation: false,
    hasPoll: false,
  },
  attachment: undefined,
  preCheckout: undefined,
  successfulPayment: undefined,
  inlineQuery: undefined,
  messageId: 555,
  newChatMemberIds: [],
  isTextMessage: true,
  raw: {},
  ...overrides,
});

const cmd = (
  name: string,
  args: readonly string[] = [],
): TelegramUpdateEnvelope =>
  baseUpdate({
    command: { name, raw: `/${name} ${args.join(" ")}`.trim(), args },
  });

describe("parseFunCommand", () => {
  it("returns null for commands outside the fun module", () => {
    expect(parseFunCommand(cmd("ban"))).toBeNull();
    expect(parseFunCommand(cmd("quiz", ["Q", "|", "A", "|", "B"]))).toBeNull();
    expect(parseFunCommand(baseUpdate())).toBeNull();
  });

  it("parses /8ball with a question", () => {
    expect(
      parseFunCommand(cmd("8ball", ["ganare", "la", "quiniela?"])),
    ).toEqual({
      ok: true,
      command: { kind: "8ball", question: "ganare la quiniela?" },
    });
  });

  it("parses the bola8 alias and allows an empty question", () => {
    expect(parseFunCommand(cmd("bola8"))).toEqual({
      ok: true,
      command: { kind: "8ball", question: "" },
    });
  });

  it("parses /coin and its flip and moneda aliases", () => {
    for (const name of ["coin", "flip", "moneda"]) {
      expect(parseFunCommand(cmd(name))).toEqual({
        ok: true,
        command: { kind: "coin" },
      });
    }
  });

  it("defaults /roll without args to 1d6", () => {
    expect(parseFunCommand(cmd("roll"))).toEqual({
      ok: true,
      command: { kind: "roll", count: 1, sides: 6 },
    });
  });

  it("parses /roll NdM including uppercase D", () => {
    expect(parseFunCommand(cmd("roll", ["2d6"]))).toEqual({
      ok: true,
      command: { kind: "roll", count: 2, sides: 6 },
    });
    expect(parseFunCommand(cmd("roll", ["20D1000"]))).toEqual({
      ok: true,
      command: { kind: "roll", count: 20, sides: 1000 },
    });
  });

  it("rejects malformed or out-of-range /roll args with usage", () => {
    for (const bad of [
      ["abc"],
      ["d6"],
      ["2d"],
      ["0d6"],
      ["21d6"],
      ["1d1"],
      ["1d1001"],
      ["2d6", "extra"],
    ]) {
      const result = parseFunCommand(cmd("roll", bad));
      expect(result).toEqual({
        ok: false,
        error: {
          code: "format",
          usage: "Uso: /roll NdM (ej: /roll 2d6; 1<=N<=20, 2<=M<=1000)",
        },
      });
    }
  });

  it("parses /rps without arg as an undefined choice", () => {
    expect(parseFunCommand(cmd("rps"))).toEqual({
      ok: true,
      command: { kind: "rps", choice: undefined },
    });
  });

  it("parses /rps with a choice normalizing case", () => {
    expect(parseFunCommand(cmd("rps", ["piedra"]))).toEqual({
      ok: true,
      command: { kind: "rps", choice: "piedra" },
    });
    expect(parseFunCommand(cmd("rps", ["TIJERA"]))).toEqual({
      ok: true,
      command: { kind: "rps", choice: "tijera" },
    });
  });

  it("rejects an invalid /rps choice with usage", () => {
    expect(parseFunCommand(cmd("rps", ["lagarto"]))).toEqual({
      ok: false,
      error: { code: "format", usage: "Uso: /rps [piedra|papel|tijera]" },
    });
  });

  it("parses /love nombre1 | nombre2 and the ship alias", () => {
    expect(parseFunCommand(cmd("love", ["Ana", "|", "Luis"]))).toEqual({
      ok: true,
      command: { kind: "love", a: "Ana", b: "Luis" },
    });
    expect(parseFunCommand(cmd("ship", ["Ana | Luis"]))).toEqual({
      ok: true,
      command: { kind: "love", a: "Ana", b: "Luis" },
    });
  });

  it("rejects /love with missing or extra parts", () => {
    const usage = "Uso: /love nombre1 | nombre2";
    expect(parseFunCommand(cmd("love", ["Ana"]))).toEqual({
      ok: false,
      error: { code: "format", usage },
    });
    expect(parseFunCommand(cmd("love", ["Ana", "|"]))).toEqual({
      ok: false,
      error: { code: "format", usage },
    });
    expect(parseFunCommand(cmd("love", ["A", "|", "B", "|", "C"]))).toEqual({
      ok: false,
      error: { code: "format", usage },
    });
  });

  it("parses /rate with a subject", () => {
    expect(parseFunCommand(cmd("rate", ["mi", "codigo"]))).toEqual({
      ok: true,
      command: { kind: "rate", subject: "mi codigo" },
    });
  });

  it("rejects /rate without subject with usage", () => {
    expect(parseFunCommand(cmd("rate"))).toEqual({
      ok: false,
      error: { code: "format", usage: "Uso: /rate <algo>" },
    });
  });

  it("maps every native dice command to its Telegram emoji", () => {
    const expected: Record<string, string> = {
      dice: "🎲",
      dart: "🎯",
      basket: "🏀",
      soccer: "⚽",
      bowling: "🎳",
      slots: "🎰",
    };
    for (const [name, emoji] of Object.entries(expected)) {
      expect(parseFunCommand(cmd(name))).toEqual({
        ok: true,
        command: { kind: "native", emoji },
      });
    }
  });
});

describe("EIGHT_BALL_ANSWERS and eightBallAnswer", () => {
  it("ships at least 16 answers", () => {
    expect(EIGHT_BALL_ANSWERS.length).toBeGreaterThanOrEqual(16);
  });

  it("is deterministic and always picks from the list", () => {
    for (const seed of [0, 1, 7, 42, 999, 123456]) {
      const first = eightBallAnswer(seed);
      expect(eightBallAnswer(seed)).toBe(first);
      expect(EIGHT_BALL_ANSWERS).toContain(first);
    }
  });

  it("covers different answers across seeds", () => {
    const answers = new Set(
      Array.from({ length: 64 }, (_, seed) => eightBallAnswer(seed)),
    );
    expect(answers.size).toBeGreaterThan(1);
  });
});

describe("coinFlip", () => {
  it("is deterministic and returns cara or cruz", () => {
    for (const seed of [0, 1, 2, 3, 50, 777]) {
      const side = coinFlip(seed);
      expect(coinFlip(seed)).toBe(side);
      expect(["cara", "cruz"]).toContain(side);
    }
  });

  it("produces both sides across seeds", () => {
    const sides = new Set(Array.from({ length: 32 }, (_, s) => coinFlip(s)));
    expect(sides).toEqual(new Set(["cara", "cruz"]));
  });
});

describe("rollDice", () => {
  it("returns count rolls each within 1..sides", () => {
    const rolls = rollDice(20, 6, 42);
    expect(rolls).toHaveLength(20);
    for (const roll of rolls) {
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(6);
      expect(Number.isInteger(roll)).toBe(true);
    }
  });

  it("is deterministic for the same seed and differs across seeds", () => {
    expect(rollDice(5, 20, 7)).toEqual(rollDice(5, 20, 7));
    expect(rollDice(10, 1000, 1)).not.toEqual(rollDice(10, 1000, 2));
  });

  it("advances the generator per roll instead of repeating one value", () => {
    const rolls = rollDice(10, 1000, 99);
    expect(new Set(rolls).size).toBeGreaterThan(1);
  });
});

describe("botRpsChoice", () => {
  it("is deterministic and returns a valid choice", () => {
    for (const seed of [0, 1, 2, 10, 500]) {
      const choice = botRpsChoice(seed);
      expect(botRpsChoice(seed)).toBe(choice);
      expect(["piedra", "papel", "tijera"]).toContain(choice);
    }
  });
});

describe("rpsOutcome", () => {
  it("resolves the full 9-case table", () => {
    const table: ReadonlyArray<
      [RpsChoice, RpsChoice, "win" | "lose" | "draw"]
    > = [
      ["piedra", "piedra", "draw"],
      ["piedra", "papel", "lose"],
      ["piedra", "tijera", "win"],
      ["papel", "piedra", "win"],
      ["papel", "papel", "draw"],
      ["papel", "tijera", "lose"],
      ["tijera", "piedra", "lose"],
      ["tijera", "papel", "win"],
      ["tijera", "tijera", "draw"],
    ];
    for (const [player, bot, outcome] of table) {
      expect(rpsOutcome(player, bot)).toBe(outcome);
    }
  });
});

describe("parseRpsCallback", () => {
  it("parses the three valid callbacks", () => {
    expect(parseRpsCallback("rps:piedra")).toEqual({ choice: "piedra" });
    expect(parseRpsCallback("rps:papel")).toEqual({ choice: "papel" });
    expect(parseRpsCallback("rps:tijera")).toEqual({ choice: "tijera" });
  });

  it("returns null for invalid or foreign callbacks", () => {
    expect(parseRpsCallback("rps:lagarto")).toBeNull();
    expect(parseRpsCallback("rps:")).toBeNull();
    expect(parseRpsCallback("rps:piedra:extra")).toBeNull();
    expect(parseRpsCallback("quiz:abc:1")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseRpsCallback(undefined)).toBeNull();
  });
});

describe("buildRpsKeyboard", () => {
  it("builds one row with the three choices wired to rps callbacks", () => {
    expect(buildRpsKeyboard()).toEqual({
      inline_keyboard: [
        [
          { text: "🪨 Piedra", callback_data: "rps:piedra" },
          { text: "📄 Papel", callback_data: "rps:papel" },
          { text: "✂️ Tijera", callback_data: "rps:tijera" },
        ],
      ],
    });
  });
});

describe("loveScore", () => {
  it("stays within 0..100 and is deterministic", () => {
    const pairs: ReadonlyArray<[string, string]> = [
      ["Ana", "Luis"],
      ["Romeo", "Julieta"],
      ["a", "b"],
      ["bot", "bot"],
    ];
    for (const [a, b] of pairs) {
      const score = loveScore(a, b);
      expect(loveScore(a, b)).toBe(score);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(Number.isInteger(score)).toBe(true);
    }
  });

  it("is symmetric and normalizes case and whitespace", () => {
    expect(loveScore("Ana", "Luis")).toBe(loveScore("Luis", "Ana"));
    expect(loveScore("  ANA ", "luis")).toBe(loveScore("Luis", "ana  "));
  });
});

describe("rateScore", () => {
  it("stays within 0..10, is deterministic and normalizes input", () => {
    for (const subject of ["mi codigo", "la pizza", "x", "el lunes"]) {
      const score = rateScore(subject);
      expect(rateScore(subject)).toBe(score);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(10);
      expect(Number.isInteger(score)).toBe(true);
    }
    expect(rateScore("  Mi Codigo ")).toBe(rateScore("mi codigo"));
  });
});

describe("NATIVE_DICE", () => {
  it("exposes exactly the six native Telegram dice", () => {
    expect(NATIVE_DICE).toEqual({
      dice: "🎲",
      dart: "🎯",
      basket: "🏀",
      soccer: "⚽",
      bowling: "🎳",
      slots: "🎰",
    });
  });
});

describe("RPS_EMOJI", () => {
  it("maps every choice to its player-perspective emoji", () => {
    expect(RPS_EMOJI).toEqual({ piedra: "🪨", papel: "📄", tijera: "✂️" });
  });
});

describe("loveVerdict", () => {
  it("maps scores to the five verdict tiers at their thresholds", () => {
    expect(loveVerdict(100)).toBe("Boda a la vista! 💍");
    expect(loveVerdict(80)).toBe("Boda a la vista! 💍");
    expect(loveVerdict(79)).toBe("Hay quimica de la buena. 🔥");
    expect(loveVerdict(60)).toBe("Hay quimica de la buena. 🔥");
    expect(loveVerdict(59)).toBe("Con esfuerzo, todo se puede. 🤔");
    expect(loveVerdict(40)).toBe("Con esfuerzo, todo se puede. 🤔");
    expect(loveVerdict(39)).toBe("Mejor como amigos... 🫠");
    expect(loveVerdict(20)).toBe("Mejor como amigos... 🫠");
    expect(loveVerdict(19)).toBe("Huye mientras puedas. 🏃");
    expect(loveVerdict(0)).toBe("Huye mientras puedas. 🏃");
  });
});

describe("buildRpsReply", () => {
  it("is deterministic and renders both hands with the correct verdict", () => {
    for (const choice of ["piedra", "papel", "tijera"] as const) {
      for (const seed of [0, 1, 42, 421, 999]) {
        const reply = buildRpsReply(choice, seed);
        expect(buildRpsReply(choice, seed)).toEqual(reply);

        const bot = botRpsChoice(seed);
        const outcome = rpsOutcome(choice, bot);
        const verdict =
          outcome === "win"
            ? "Ganaste! 🏆"
            : outcome === "lose"
              ? "Gane yo! 😎"
              : "Empate! 🤝";
        expect(reply).toEqual({
          text: `Tu: ${RPS_EMOJI[choice]} ${choice}\nYo: ${RPS_EMOJI[bot]} ${bot}\n\n${verdict}`,
        });
      }
    }
  });

  it("leads with the player's chosen hand and its emoji", () => {
    expect(buildRpsReply("piedra", 421).text).toMatch(/^Tu: 🪨 piedra\nYo: /u);
  });
});

describe("buildFunReply", () => {
  it("renders /8ball with a deterministic answer from the list", () => {
    const command: FunCommand = { kind: "8ball", question: "hoy?" };
    const reply = buildFunReply(command, 7);
    expect(reply.text.startsWith("🎱 ")).toBe(true);
    expect(EIGHT_BALL_ANSWERS).toContain(reply.text.slice("🎱 ".length));
    expect(buildFunReply(command, 7)).toEqual(reply);
  });

  it("renders /coin as Markdown landing on cara or cruz", () => {
    const reply = buildFunReply({ kind: "coin" }, 3);
    expect(reply.parseMode).toBe("Markdown");
    expect(reply.text).toMatch(/^🪙 Ha salido \*(cara|cruz)\*!$/u);
  });

  it("renders a single /roll without the addition detail", () => {
    const reply = buildFunReply({ kind: "roll", count: 1, sides: 6 }, 5);
    expect(reply.parseMode).toBe("Markdown");
    expect(reply.text).toMatch(/^🎲 1d6: \*\d+\*$/u);
  });

  it("renders a multi /roll with the addition detail", () => {
    const reply = buildFunReply({ kind: "roll", count: 2, sides: 6 }, 5);
    expect(reply.text).toMatch(/^🎲 2d6: \d+ \+ \d+ = \*\d+\*$/u);
  });

  it("prompts with the inline keyboard for /rps without a choice", () => {
    expect(buildFunReply({ kind: "rps", choice: undefined }, 1)).toEqual({
      text: "✊ Piedra, papel o tijera... elige!",
      replyMarkup: buildRpsKeyboard(),
    });
  });

  it("delegates /rps with a choice to buildRpsReply", () => {
    expect(buildFunReply({ kind: "rps", choice: "piedra" }, 99)).toEqual(
      buildRpsReply("piedra", 99),
    );
  });

  it("renders /love with the score and its verdict as plain text", () => {
    const reply = buildFunReply({ kind: "love", a: "Ana", b: "Luis" }, 1);
    const score = loveScore("Ana", "Luis");
    expect(reply.text).toBe(`💘 Ana + Luis = ${score}%\n${loveVerdict(score)}`);
    expect(reply.parseMode).toBeUndefined();
  });

  it("renders /rate with the 0..10 score for the subject", () => {
    const reply = buildFunReply({ kind: "rate", subject: "mi codigo" }, 1);
    expect(reply.text).toBe(
      `⭐ Le doy un ${rateScore("mi codigo")}/10 a "mi codigo".`,
    );
  });

  it("renders native dice as a dice reply for sendDice", () => {
    expect(buildFunReply({ kind: "native", emoji: "🎲" }, 1)).toEqual({
      text: "🎲",
      dice: "🎲",
    });
  });
});

import {
  BadRequestException,
  ForbiddenException,
  type HttpException,
} from "@nestjs/common";
import {
  type GameScoreState,
  type GameSessionRecord,
  InMemoryChatActivityRepository,
  InMemoryChatSettingRepository,
} from "@superbot/data";
import {
  dailyTriviaHash,
  dayKeyFromMs,
  levelForPoints,
  pickDailyIndex,
  TRIVIA_QUESTIONS,
} from "@superbot/module-games";
import { defaultGamesConfig } from "@superbot/shared";
import { describe, expect, it } from "vitest";
import { GamesService } from "./games.service.js";

const expectError = async (p: Promise<unknown>, code: string) => {
  try {
    await p;
  } catch (e) {
    expect((e as HttpException).getResponse()).toMatchObject({ error: code });
    return;
  }
  throw new Error(`expected HttpException error=${code}`);
};

class FakeGames {
  session: GameSessionRecord | null = null;
  scored: Array<{ chatId: string; userId: bigint; delta: number }> = [];

  async createSession(
    _t: string,
    chatId: string,
    kind: string,
    payload: unknown,
    correctIndex: number,
  ): Promise<GameSessionRecord> {
    this.session = {
      id: "s1",
      kind,
      status: "open",
      correctIndex,
      chatId,
      createdAt: new Date(),
      payload,
    };
    return this.session;
  }
  async getSession() {
    return this.session;
  }
  async closeWithWinner() {
    if (this.session && this.session.status === "open") {
      this.session = { ...this.session, status: "closed" };
      return true;
    }
    return false;
  }
  async addScore(
    _t: string,
    chatId: string,
    userId: bigint,
    delta: number,
  ): Promise<GameScoreState> {
    this.scored.push({ chatId, userId, delta });
    return { telegramUserId: userId, points: delta };
  }
  async topScores() {
    return [];
  }
}

const makeService = (sessionOverrides: Partial<GameSessionRecord> = {}) => {
  const svc = new GamesService();
  const games = new FakeGames();
  games.session = {
    id: "s1",
    kind: "arcade:quiz-arcade",
    status: "open",
    correctIndex: -1,
    chatId: "c1",
    createdAt: new Date(Date.now() - 10_000), // 10 s ago
    payload: { telegramUserId: "42", game: "quiz-arcade" },
    ...sessionOverrides,
  };
  // chatActivity in-memory so submit's best-effort markDailyPlay never touches
  // a real Prisma client during the anti-cheat tests.
  Object.assign(svc, {
    games,
    chatActivity: new InMemoryChatActivityRepository(),
    tenantId: async () => "t1",
  });
  return { svc, games };
};

describe("GamesService anti-cheat", () => {
  it("accepts a plausible score and writes 0..3 points", async () => {
    const { svc, games } = makeService();
    const result = await svc.submit("42", "s1", 8); // perfect quiz-arcade
    expect(result.points).toBe(3);
    expect(games.scored).toHaveLength(1);
    expect(games.scored[0]?.chatId).toBe("c1");
  });

  it("rejects a submit from another user (403)", async () => {
    const { svc } = makeService();
    await expectError(svc.submit("99", "s1", 8), "not-your-session");
  });

  it("rejects an implausible score (too fast)", async () => {
    const { svc } = makeService({ createdAt: new Date() }); // ~0 ms elapsed
    await expectError(svc.submit("42", "s1", 8), "implausible-score");
  });

  it("rejects a second submit for the same session (already closed)", async () => {
    const { svc } = makeService();
    await svc.submit("42", "s1", 5);
    // The first submit closed the session atomically, so the second is rejected.
    await expectError(svc.submit("42", "s1", 5), "session-not-open");
  });

  it("rejects an unknown game on start", async () => {
    const { svc } = makeService();
    await expectError(svc.start("42", null, "snake"), "unknown-game");
  });

  it("starts portable inline games in the global inline scope", async () => {
    const { svc, games } = makeService();
    const result = await svc.start("42", "inline_reflex", "reflex");

    expect(result.scope).toBe("portable");
    expect(games.session?.chatId).toBe("inline:global");
  });

  it("keeps a groupless games-hub link on the portable board", async () => {
    const { svc, games } = makeService();
    const result = await svc.start("42", "games", "reflex");

    expect(result.scope).toBe("portable");
    expect(games.session?.chatId).toBe("inline:global");
  });

  it("scopes a group games-hub link (games_<gid>) to that group for a member", async () => {
    const svc = new GamesService();
    const games = new FakeGames();
    Object.assign(svc, {
      games,
      chatActivity: new InMemoryChatActivityRepository(),
      tenantId: async () => "t1",
      foundation: {
        findChatByTelegramId: async () => ({ chatId: "cGroup" }),
      },
      gateway: {
        getChatMember: async () => ({ ok: true, status: "member" }),
      },
    });
    const result = await svc.start("42", "games_-100123", "reflex");

    expect(result.scope).toBe("group");
    expect(games.session?.chatId).toBe("cGroup");
  });

  it("throws Nest exceptions", async () => {
    const { svc } = makeService();
    await expect(svc.submit("99", "s1", 8)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(svc.start("42", null, "x")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe("GamesService daily trivia", () => {
  // A fixed instant → a fixed day key → a deterministic question of the day.
  const FIXED_NOW = 20_000 * 86_400_000;
  const dayKey = dayKeyFromMs(FIXED_NOW, 0);
  const question =
    TRIVIA_QUESTIONS[pickDailyIndex(dayKey, TRIVIA_QUESTIONS.length)];
  const correctIndex = question?.correctIndex ?? 0;
  const wrongIndex = (correctIndex + 1) % (question?.options.length ?? 2);

  const makeDaily = () => {
    const svc = new GamesService();
    const games = new FakeGames();
    const chatActivity = new InMemoryChatActivityRepository();
    Object.assign(svc, { games, chatActivity, tenantId: async () => "t1" });
    return { svc, games, chatActivity };
  };

  it("serves the day's question without revealing the answer until you play", async () => {
    const { svc } = makeDaily();
    const view = await svc.dailyTrivia("42", null, undefined, FIXED_NOW);
    expect(view.scope).toBe("personal");
    expect(view.answered).toBe(false);
    expect(view.correctIndex).toBeNull();
    expect(view.question.options.length).toBeGreaterThan(1);
  });

  it("scores a correct first answer and is idempotent for the day", async () => {
    const { svc, games } = makeDaily();
    const first = await svc.answerDailyTrivia(
      "42",
      null,
      correctIndex,
      undefined,
      FIXED_NOW,
    );
    expect(first).toMatchObject({
      alreadyAnswered: false,
      correct: true,
      points: 2,
    });
    expect(games.scored).toHaveLength(1);
    expect(games.scored[0]?.delta).toBe(2);

    // A second answer the same day is a no-op that echoes the first outcome.
    const second = await svc.answerDailyTrivia(
      "42",
      null,
      wrongIndex,
      undefined,
      FIXED_NOW,
    );
    expect(second).toMatchObject({
      alreadyAnswered: true,
      correct: true,
      points: 0,
    });
    expect(games.scored).toHaveLength(1);

    // The board view now reveals the answer and counts the participant.
    const view = await svc.dailyTrivia("42", null, undefined, FIXED_NOW);
    expect(view.answered).toBe(true);
    expect(view.correctIndex).toBe(correctIndex);
    expect(view.participants).toBe(1);
    expect(view.correctCount).toBe(1);
  });

  it("records a wrong answer without points but still blocks a retry", async () => {
    const { svc, games } = makeDaily();
    const result = await svc.answerDailyTrivia(
      "42",
      null,
      wrongIndex,
      undefined,
      FIXED_NOW,
    );
    expect(result).toMatchObject({ correct: false, points: 0 });
    expect(games.scored).toHaveLength(0);

    const retry = await svc.answerDailyTrivia(
      "42",
      null,
      correctIndex,
      undefined,
      FIXED_NOW,
    );
    expect(retry.alreadyAnswered).toBe(true);
    expect(retry.correct).toBe(false);
  });
});

describe("GamesService coop boss", () => {
  const FIXED_NOW = 20_000 * 86_400_000;
  const NEXT_DAY = FIXED_NOW + 86_400_000;

  const makeBoss = () => {
    const svc = new GamesService();
    const chatActivity = new InMemoryChatActivityRepository();
    const chatSetting = new InMemoryChatSettingRepository();
    Object.assign(svc, {
      chatActivity,
      chatSetting,
      tenantId: async () => "t1",
      // Force a shared group boss (personal scope would give each user their own
      // chatId `dm:t1:<user>`, i.e. a separate solo boss). Group scope requires a
      // live membership check we don't stub here.
      resolveScope: async () => ({ scope: "group", chatId: "c1" }),
    });
    return { svc, chatActivity, chatSetting };
  };

  it("spawns a level-0 boss at full health for a fresh chat", async () => {
    const { svc } = makeBoss();
    const view = await svc.coopBoss("42", null, undefined, FIXED_NOW);
    expect(view.level).toBe(0);
    expect(view.done).toBe(0);
    expect(view.percent).toBe(0);
    expect(view.goal).toBeGreaterThan(0);
    expect(view.youAttackedToday).toBe(false);
  });

  it("deals fixed damage once per day and tallies the contributor", async () => {
    const { svc } = makeBoss();
    const first = await svc.attackBoss("42", null, "Ana", undefined, FIXED_NOW);
    expect(first.alreadyAttacked).toBe(false);
    expect(first.dealt).toBe(8);
    expect(first.done).toBe(8);
    expect(first.yourDamage).toBe(8);
    expect(first.youAttackedToday).toBe(true);
    expect(first.contributors[0]).toMatchObject({
      telegramUserId: "42",
      name: "Ana",
      damage: 8,
    });

    // Same day → a no-op that leaves the boss untouched.
    const again = await svc.attackBoss("42", null, "Ana", undefined, FIXED_NOW);
    expect(again.alreadyAttacked).toBe(true);
    expect(again.dealt).toBe(0);
    expect(again.done).toBe(8);

    // A new day → the member can attack again.
    const tomorrow = await svc.attackBoss(
      "42",
      null,
      "Ana",
      undefined,
      NEXT_DAY,
    );
    expect(tomorrow.alreadyAttacked).toBe(false);
    expect(tomorrow.done).toBe(16);
    expect(tomorrow.yourDamage).toBe(16);
  });

  it("defeats the boss, spawns a tougher one and announces a reward", async () => {
    const { svc } = makeBoss();
    // Goal for level 0 is 50; 7 distinct members × 8 damage = 56 ≥ 50.
    let last: Awaited<ReturnType<typeof svc.attackBoss>> | undefined;
    for (let i = 0; i < 7; i += 1) {
      last = await svc.attackBoss(
        String(100 + i),
        null,
        `U${i}`,
        undefined,
        FIXED_NOW,
      );
    }
    expect(last?.justDefeated).toBe(true);
    expect(last?.defeatedName).toBe("El Troll del Chat");
    expect(last?.reward).toBeGreaterThan(0);
    // The returned view is already the fresh, tougher boss for the next cycle.
    expect(last?.level).toBe(1);
    expect(last?.done).toBe(0);
    expect(last?.goal).toBeGreaterThan(50);
    expect(last?.contributors).toHaveLength(0);
  });
});

describe("GamesService quiz batch", () => {
  const svc = new GamesService();
  const poolLen = TRIVIA_QUESTIONS.length;

  it("returns a batch of 8 questions with answers", async () => {
    const batch = await svc.quizBatch("42", 0);
    expect(batch.round).toBe(0);
    expect(batch.questions).toHaveLength(8);
    for (const q of batch.questions) {
      expect(q.options.length).toBeGreaterThan(1);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.options.length);
    }
  });

  it("is deterministic per (user, round) and starts at the hashed offset", async () => {
    const start0 = dailyTriviaHash("42:0") % poolLen;
    const a = await svc.quizBatch("42", 0);
    const again = await svc.quizBatch("42", 0);
    expect(a.questions[0]?.question).toBe(TRIVIA_QUESTIONS[start0]?.question);
    expect(again.questions[0]?.question).toBe(a.questions[0]?.question);
  });

  it("advances to a different offset on the next round", async () => {
    const start0 = dailyTriviaHash("42:0") % poolLen;
    const start1 = dailyTriviaHash("42:1") % poolLen;
    const next = await svc.quizBatch("42", 1);
    expect(next.questions[0]?.question).toBe(
      TRIVIA_QUESTIONS[start1]?.question,
    );
    // The offsets differ (astronomically unlikely to collide in a 5000+ pool).
    expect(start1).not.toBe(start0);
  });

  it("normalizes a non-finite round to 0", async () => {
    const batch = await svc.quizBatch("42", Number.NaN);
    expect(batch.round).toBe(0);
  });
});

describe("GamesService trivia cadence", () => {
  const FIXED = 20_000 * 86_400_000; // 00:00 UTC of a day
  const HOUR = 3_600_000;

  const makeGroup = () => {
    const svc = new GamesService();
    const games = new FakeGames();
    const chatActivity = new InMemoryChatActivityRepository();
    const chatSetting = new InMemoryChatSettingRepository();
    Object.assign(svc, {
      games,
      chatActivity,
      chatSetting,
      tenantId: async () => "t1",
      resolveScope: async () => ({ scope: "group", chatId: "c1" }),
    });
    return { svc, chatSetting };
  };

  it("keeps the same question all day in daily cadence", async () => {
    const { svc, chatSetting } = makeGroup();
    await chatSetting.setValue("t1", "c1", "games_config", {
      ...defaultGamesConfig("play"),
      triviaCadence: "daily",
    });
    const morning = await svc.dailyTrivia("42", null, undefined, FIXED + HOUR);
    const evening = await svc.dailyTrivia(
      "42",
      null,
      undefined,
      FIXED + 20 * HOUR,
    );
    expect(morning.dayKey).toBe(evening.dayKey);
    expect(morning.question.question).toBe(evening.question.question);
  });

  it("opens a new question every hour in hourly cadence", async () => {
    const { svc, chatSetting } = makeGroup();
    await chatSetting.setValue("t1", "c1", "games_config", {
      ...defaultGamesConfig("play"),
      triviaCadence: "hourly",
    });
    const h0 = await svc.dailyTrivia("42", null, undefined, FIXED);
    const h1 = await svc.dailyTrivia("42", null, undefined, FIXED + HOUR);
    // The window bucket (surfaced as dayKey) advances hour by hour.
    expect(h1.dayKey).toBe(h0.dayKey + 1);
  });
});

describe("GamesService player profile", () => {
  const FIXED = 20_000 * 86_400_000;
  const DAY = 86_400_000;

  const makeProfile = (
    players: Array<{
      telegramUserId: bigint;
      name: string | null;
      points: number;
    }>,
    summed = 0,
  ) => {
    const svc = new GamesService();
    const chatActivity = new InMemoryChatActivityRepository();
    Object.assign(svc, {
      chatActivity,
      tenantId: async () => "t1",
      games: {
        topPlayers: async () => players,
        sumUserPoints: async () => summed,
        topScores: async () => [],
      },
    });
    return { svc, chatActivity };
  };

  it("returns rank, level, streak and the top board with you flagged", async () => {
    const { svc, chatActivity } = makeProfile([
      { telegramUserId: 7n, name: "Ana", points: 500 },
      { telegramUserId: 42n, name: "Yo", points: 300 },
    ]);
    const today = dayKeyFromMs(FIXED, 0);
    for (const day of [today, today - 1, today - 2]) {
      await chatActivity.record({
        tenantId: "t1",
        chatId: "dm:t1:42",
        kind: "daily_play",
        telegramUserId: 42n,
        messageId: BigInt(day),
      });
    }
    const p = await svc.playerProfile(
      "42",
      { displayName: "Yo" },
      undefined,
      FIXED,
    );
    expect(p.name).toBe("Yo");
    expect(p.points).toBe(300);
    expect(p.rank).toBe(2);
    expect(p.level).toBe(levelForPoints(300).level);
    expect(p.streakDays).toBe(3);
    expect(p.dailyPending).toBe(true);
    expect(p.top).toHaveLength(2);
    expect(p.top[1]).toMatchObject({ you: true, name: "Yo" });
    expect(p.top[0]?.you).toBe(false);
  });

  it("falls back to summed points and null rank when unranked", async () => {
    const { svc } = makeProfile(
      [{ telegramUserId: 7n, name: "Ana", points: 500 }],
      999,
    );
    const p = await svc.playerProfile("42", undefined, undefined, FIXED);
    expect(p.rank).toBeNull();
    expect(p.points).toBe(999);
    expect(p.streakDays).toBe(0);
  });

  it("marks the streak dead when the last play was two days ago", async () => {
    const { svc, chatActivity } = makeProfile([]);
    const today = dayKeyFromMs(FIXED, 0);
    await chatActivity.record({
      tenantId: "t1",
      chatId: "dm:t1:42",
      kind: "daily_play",
      telegramUserId: 42n,
      messageId: BigInt(today - 2),
    });
    const p = await svc.playerProfile(
      "42",
      undefined,
      undefined,
      FIXED + DAY * 0,
    );
    expect(p.streakDays).toBe(0);
  });
});

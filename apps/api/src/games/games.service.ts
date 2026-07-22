import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  PrismaChatActivityRepository,
  PrismaChatSettingRepository,
  type PrismaClient,
  PrismaFoundationRepository,
  PrismaGameRepository,
  prisma,
} from "@superbot/data";
import {
  computeBossProgress,
  computeCollectiveReward,
  computeStreak,
  dailyTriviaHash,
  dayKeyFromMs,
  type GameId,
  hourKeyFromMs,
  isCorrectAnswer,
  isGameId,
  isPlausibleScore,
  levelForPoints,
  pickDailyIndex,
  scoreToPoints,
  TRIVIA_QUESTIONS,
} from "@superbot/module-games";
import {
  decodeStartParam,
  GAMES_CONFIG_KEY,
  getRuntimeEnv,
  parseGamesConfig,
  type TriviaCadence,
} from "@superbot/shared";
import { HttpTelegramGateway } from "@superbot/telegram";

interface Scope {
  readonly scope: "group" | "personal" | "portable";
  readonly chatId: string;
}

/** The bot serving this request (HMAC-proven by InitDataGuard); parent default. */
interface BotScope {
  readonly username: string;
  readonly token: string;
}

export interface PlayerProfile {
  readonly displayName?: string;
  readonly username?: string;
}

const MEMBER_STATUSES = new Set([
  "member",
  "administrator",
  "creator",
  "restricted",
]);

// Daily trivia resets at 00:00 UTC so every member of a group shares the exact
// same question on the same calendar day, regardless of their device timezone.
const DAILY_TZ_OFFSET_MIN = 0;
const DAILY_TRIVIA_KIND = "daily_trivia";
const DAILY_TRIVIA_POINTS = 2;
// One marker per day the user played anything, in their personal scope — the
// basis for the streak. 0 migration: reuses ChatActivityEvent (messageId=dayKey).
const DAILY_PLAY_KIND = "daily_play";

/** The player's own home view: profile, streak, global rank + top board. */
export interface PlayerHomeView {
  readonly name: string | null;
  readonly points: number;
  readonly level: number;
  readonly levelFloor: number;
  readonly levelCeil: number;
  readonly streakDays: number;
  /** Position on the global (per-user total) leaderboard, or null if unranked. */
  readonly rank: number | null;
  /** True when today's personal daily trivia is still unanswered. */
  readonly dailyPending: boolean;
  readonly top: Array<{
    telegramUserId: string;
    name: string | null;
    points: number;
    you: boolean;
  }>;
}

/** Today's question + the caller's status + the group board, for the Mini App. */
export interface DailyTriviaView {
  readonly scope: "group" | "personal" | "portable";
  readonly dayKey: number;
  readonly question: { readonly question: string; readonly options: string[] };
  readonly answered: boolean;
  /** The right option, revealed only once the caller has answered (else null). */
  readonly correctIndex: number | null;
  readonly yourAnswerCorrect: boolean;
  readonly participants: number;
  readonly correctCount: number;
  readonly board: Array<{
    telegramUserId: string;
    points: number;
    name: string | null;
  }>;
}

/** The outcome of one daily-trivia answer. */
export interface DailyTriviaResult {
  readonly alreadyAnswered: boolean;
  readonly correct: boolean;
  readonly correctIndex: number;
  readonly points: number;
}

// Weekly cooperative boss. The group whittles a shared boss down with one attack
// per member per day (fixed damage); defeating it spawns a tougher one. State is
// a small aggregate (level/goal/done) in ChatSetting; per-member contributions
// are boss_hit events keyed by messageId=day (the daily gate) and topic=cycle.
const BOSS_SETTING_KEY = "coop_boss";
const BOSS_HIT_KIND = "boss_hit";
const BOSS_HIT_DAMAGE = 8;
const BOSS_BASE_GOAL = 50;
const BOSS_GOAL_STEP = 30;
const BOSS_ROSTER: ReadonlyArray<{ name: string; emoji: string }> = [
  { name: "El Troll del Chat", emoji: "👹" },
  { name: "Spammer Supremo", emoji: "🤖" },
  { name: "El Pulpo Off-Topic", emoji: "🐙" },
  { name: "Capitán Flood", emoji: "🌊" },
  { name: "El Dragón del Drama", emoji: "🐉" },
];

const bossGoalFor = (level: number): number =>
  BOSS_BASE_GOAL + Math.max(0, level) * BOSS_GOAL_STEP;

const bossMetaFor = (level: number): { name: string; emoji: string } => {
  const size = BOSS_ROSTER.length;
  const index = ((level % size) + size) % size;
  return BOSS_ROSTER[index] ?? { name: "El Jefe", emoji: "👾" };
};

const bossRewardFor = (level: number): number => 50 + Math.max(0, level) * 10;

interface BossState {
  readonly level: number;
  readonly goal: number;
  readonly done: number;
}

/** One member's total damage to the current boss. */
export interface CoopBossContributor {
  readonly telegramUserId: string;
  readonly name: string | null;
  readonly damage: number;
}

/** The live cooperative-boss state for the Mini App. */
export interface CoopBossView {
  readonly scope: "group" | "personal" | "portable";
  readonly level: number;
  readonly name: string;
  readonly emoji: string;
  readonly goal: number;
  readonly done: number;
  readonly percent: number;
  readonly remaining: number;
  readonly youAttackedToday: boolean;
  readonly yourDamage: number;
  readonly contributors: CoopBossContributor[];
}

/** The outcome of one boss attack, plus the (possibly fresh) boss to show next. */
export interface CoopBossAttackResult extends CoopBossView {
  readonly alreadyAttacked: boolean;
  readonly dealt: number;
  readonly justDefeated: boolean;
  readonly defeatedName: string | null;
  readonly reward: number;
  readonly rewardMessage: string | null;
}

/**
 * Arcade game sessions with server-side anti-cheat: the server issues the
 * session (server clock), verifies ownership + one-submit-per-session (atomic),
 * bounds the score by plausibility caps, and — for group-bound sessions —
 * requires live group membership so nobody injects scores into a leaderboard
 * they are not in. Scores land in the SAME GameScore table as quiz/trivia.
 */
@Injectable()
export class GamesService {
  private readonly games = new PrismaGameRepository();
  private readonly foundation = new PrismaFoundationRepository();
  private readonly gateway = new HttpTelegramGateway();
  private readonly chatActivity = new PrismaChatActivityRepository();
  private readonly chatSetting = new PrismaChatSettingRepository();

  constructor(private readonly client: PrismaClient = prisma) {}

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

  private toBigIntOrNull(value: string | undefined): bigint | null {
    if (value === undefined || !/^-?\d+$/u.test(value)) {
      return null;
    }
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }

  private async resolveScope(
    startParam: string | null,
    userId: string,
    tenantId: string,
    bot?: BotScope,
  ): Promise<Scope> {
    const decoded = decodeStartParam(startParam);
    if (decoded?.kind === "inlineGame") {
      return { scope: "portable", chatId: "inline:global" };
    }
    // A group id can arrive two ways: a direct game link (game_<name>_<gid>) or a
    // group-scoped games hub (games_<gid>). Both attribute play to that group.
    // Guard: a malformed groupId (non-numeric) must not crash with a 500 — fall
    // through to the personal/portable board instead.
    const rawGroupId =
      decoded?.kind === "game"
        ? decoded.groupId
        : decoded?.kind === "gamesHub"
          ? (decoded.groupId ?? null)
          : null;
    const groupId = rawGroupId != null ? this.toBigIntOrNull(rawGroupId) : null;
    if (groupId !== null) {
      const chat = await this.foundation.findChatByTelegramId(
        tenantId,
        groupId,
      );
      if (chat) {
        const membership = await this.gateway
          .getChatMember({
            chatId: groupId,
            userId: BigInt(userId),
            token: bot?.token ?? getRuntimeEnv().TELEGRAM_BOT_TOKEN,
          })
          .catch(() => ({ ok: false, status: undefined }));
        if (membership.ok && MEMBER_STATUSES.has(membership.status ?? "")) {
          return { scope: "group", chatId: chat.chatId };
        }
      }
    }
    // A groupless hub link stays on the shared portable board; everything else
    // falls back to a per-user personal scoreboard, namespaced by tenant so a
    // user's personal points don't merge across the primary and child bots.
    if (decoded?.kind === "gamesHub") {
      return { scope: "portable", chatId: "inline:global" };
    }
    return { scope: "personal", chatId: `dm:${tenantId}:${userId}` };
  }

  async start(
    userId: string,
    startParam: string | null,
    game: string,
    player?: PlayerProfile,
    bot?: BotScope,
  ): Promise<{ sessionId: string; game: GameId; scope: Scope["scope"] }> {
    if (!isGameId(game)) {
      throw new BadRequestException({ error: "unknown-game" });
    }
    const tenantId = await this.tenantId(bot);
    // Best-effort: never let a name-capture failure block starting a game.
    await this.rememberPlayer(BigInt(userId), tenantId, player).catch(() => {});
    const { scope, chatId } = await this.resolveScope(
      startParam,
      userId,
      tenantId,
      bot,
    );
    const session = await this.games.createSession(
      tenantId,
      chatId,
      `arcade:${game}`,
      { telegramUserId: userId, game },
      -1,
    );
    return { sessionId: session.id, game, scope };
  }

  async submit(
    userId: string,
    sessionId: string,
    rawScore: number,
    bot?: BotScope,
  ): Promise<{ points: number }> {
    const session = await this.games.getSession(sessionId);
    if (session?.status !== "open") {
      throw new BadRequestException({ error: "session-not-open" });
    }
    const payload = (session.payload ?? {}) as {
      telegramUserId?: string;
      game?: string;
    };
    if (payload.telegramUserId !== userId) {
      throw new ForbiddenException({ error: "not-your-session" });
    }
    const game = payload.game;
    if (!game || !isGameId(game)) {
      throw new BadRequestException({ error: "unknown-game" });
    }

    const elapsedMs = Date.now() - new Date(session.createdAt).getTime();
    if (!isPlausibleScore(game, rawScore, elapsedMs)) {
      throw new BadRequestException({ error: "implausible-score" });
    }

    // Atomically close the session so a second submit for it fails.
    const claimed = await this.games.closeWithWinner(sessionId, BigInt(userId));
    if (!claimed) {
      throw new BadRequestException({ error: "already-submitted" });
    }

    const points = scoreToPoints(game, rawScore);
    const tenantId = await this.tenantId(bot);
    await this.games.addScore(tenantId, session.chatId, BigInt(userId), points);
    await this.markDailyPlay(userId, tenantId).catch(() => {});
    return { points };
  }

  async leaderboard(
    userId: string,
    startParam: string | null,
    bot?: BotScope,
  ): Promise<{
    scope: Scope["scope"];
    rows: Array<{
      telegramUserId: string;
      points: number;
      name: string | null;
    }>;
  }> {
    const tenantId = await this.tenantId(bot);
    const { scope, chatId } = await this.resolveScope(
      startParam,
      userId,
      tenantId,
      bot,
    );
    const rows = await this.games.topScores(chatId, 10);
    return {
      scope,
      rows: rows.map((row) => ({
        telegramUserId: row.telegramUserId.toString(),
        points: row.points,
        name: row.name ?? null,
      })),
    };
  }

  private dailyQuestion(dayKey: number) {
    const pool = TRIVIA_QUESTIONS;
    const question = pool[pickDailyIndex(dayKey, pool.length)] ?? pool[0];
    if (!question) {
      throw new ServiceUnavailableException({ error: "no-trivia" });
    }
    return question;
  }

  /**
   * A group's community-trivia cadence: "daily" (default) or "hourly" (a fresh
   * question every hour on the dot). Read from the chat's GamesConfig. Personal
   * and portable scopes have no per-chat config, so they always run daily.
   */
  private async triviaCadenceFor(
    tenantId: string,
    chatId: string,
    scope: Scope["scope"],
  ): Promise<TriviaCadence> {
    if (scope !== "group") {
      return "daily";
    }
    const raw = await this.chatSetting.getValue(
      tenantId,
      chatId,
      GAMES_CONFIG_KEY,
    );
    return parseGamesConfig(raw).triviaCadence;
  }

  /** The current trivia window bucket for a cadence (day or hour key, UTC). */
  private triviaWindowKey(cadence: TriviaCadence, nowMs: number): number {
    return cadence === "hourly"
      ? hourKeyFromMs(nowMs, DAILY_TZ_OFFSET_MIN)
      : dayKeyFromMs(nowMs, DAILY_TZ_OFFSET_MIN);
  }

  /**
   * A fresh batch of trivia questions for the solo/inline arcade, drawn from the
   * full 5000+ bank. Deterministic per (user, round) so a reload returns the
   * same batch, but each new round advances to different questions — giving
   * effectively unlimited solo play. Includes correctIndex (the arcade scores
   * client-side; submitted scores are still capped server-side by the catalog).
   */
  async quizBatch(
    userId: string,
    round: number,
    size = 8,
  ): Promise<{
    round: number;
    questions: Array<{
      question: string;
      options: string[];
      correctIndex: number;
    }>;
  }> {
    const pool = TRIVIA_QUESTIONS;
    if (pool.length === 0) {
      throw new ServiceUnavailableException({ error: "no-trivia" });
    }
    const safeRound = Number.isFinite(round) ? Math.trunc(round) : 0;
    const start = dailyTriviaHash(`${userId}:${safeRound}`) % pool.length;
    const questions: Array<{
      question: string;
      options: string[];
      correctIndex: number;
    }> = [];
    for (let i = 0; i < size; i += 1) {
      const q = pool[(start + i) % pool.length];
      if (q) {
        questions.push({
          question: q.question,
          options: [...q.options],
          correctIndex: q.correctIndex,
        });
      }
    }
    return { round: safeRound, questions };
  }

  /**
   * Today's shared trivia for the resolved scope (group / personal / portable):
   * the same question all day, whether the caller already answered, the live
   * participation counters, and the group leaderboard. The correct option is
   * withheld until the caller has committed an answer.
   */
  async dailyTrivia(
    userId: string,
    startParam: string | null,
    bot?: BotScope,
    nowMs: number = Date.now(),
  ): Promise<DailyTriviaView> {
    const tenantId = await this.tenantId(bot);
    const { scope, chatId } = await this.resolveScope(
      startParam,
      userId,
      tenantId,
      bot,
    );
    const cadence = await this.triviaCadenceFor(tenantId, chatId, scope);
    const dayKey = this.triviaWindowKey(cadence, nowMs);
    const question = this.dailyQuestion(dayKey);
    const marker = await this.chatActivity.findUserEvent(
      tenantId,
      chatId,
      DAILY_TRIVIA_KIND,
      BigInt(userId),
      BigInt(dayKey),
    );
    const answered = marker !== undefined;
    const today = (
      await this.chatActivity.listRecent(
        tenantId,
        chatId,
        DAILY_TRIVIA_KIND,
        500,
      )
    ).filter((entry) => entry.messageId === BigInt(dayKey));
    const rows = await this.games.topScores(chatId, 10);
    return {
      scope,
      dayKey,
      question: { question: question.question, options: [...question.options] },
      answered,
      correctIndex: answered ? question.correctIndex : null,
      yourAnswerCorrect: marker?.text === "1",
      participants: today.length,
      correctCount: today.filter((entry) => entry.text === "1").length,
      board: rows.map((row) => ({
        telegramUserId: row.telegramUserId.toString(),
        points: row.points,
        name: row.name ?? null,
      })),
    };
  }

  /**
   * Records one daily-trivia answer for the caller. Idempotent per day: a second
   * answer the same day is a no-op that echoes the first result. A correct
   * first answer adds points to the resolved scope's leaderboard.
   */
  async answerDailyTrivia(
    userId: string,
    startParam: string | null,
    optionIndex: number,
    bot?: BotScope,
    nowMs: number = Date.now(),
  ): Promise<DailyTriviaResult> {
    const tenantId = await this.tenantId(bot);
    const { scope, chatId } = await this.resolveScope(
      startParam,
      userId,
      tenantId,
      bot,
    );
    const cadence = await this.triviaCadenceFor(tenantId, chatId, scope);
    const dayKey = this.triviaWindowKey(cadence, nowMs);
    const question = this.dailyQuestion(dayKey);
    const existing = await this.chatActivity.findUserEvent(
      tenantId,
      chatId,
      DAILY_TRIVIA_KIND,
      BigInt(userId),
      BigInt(dayKey),
    );
    if (existing) {
      return {
        alreadyAnswered: true,
        correct: existing.text === "1",
        correctIndex: question.correctIndex,
        points: 0,
      };
    }
    const correct = isCorrectAnswer(question, optionIndex);
    await this.chatActivity.record({
      tenantId,
      chatId,
      kind: DAILY_TRIVIA_KIND,
      telegramUserId: BigInt(userId),
      messageId: BigInt(dayKey),
      text: correct ? "1" : "0",
    });
    let points = 0;
    if (correct) {
      points = DAILY_TRIVIA_POINTS;
      await this.games.addScore(tenantId, chatId, BigInt(userId), points);
    }
    await this.markDailyPlay(userId, tenantId, nowMs).catch(() => {});
    return {
      alreadyAnswered: false,
      correct,
      correctIndex: question.correctIndex,
      points,
    };
  }

  private async loadBoss(tenantId: string, chatId: string): Promise<BossState> {
    const raw = await this.chatSetting.getValue(
      tenantId,
      chatId,
      BOSS_SETTING_KEY,
    );
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      const level = typeof obj.level === "number" ? obj.level : 0;
      const done = typeof obj.done === "number" ? obj.done : 0;
      const goal = typeof obj.goal === "number" ? obj.goal : bossGoalFor(level);
      return { level, goal, done };
    }
    return { level: 0, goal: bossGoalFor(0), done: 0 };
  }

  private async bossStatus(
    tenantId: string,
    chatId: string,
    scope: Scope["scope"],
    userId: string,
    state: BossState,
    dayKey: number,
  ): Promise<CoopBossView> {
    const meta = bossMetaFor(state.level);
    const progress = computeBossProgress({
      done: state.done,
      goal: state.goal,
    });
    const cycleTopic = `boss:${state.level}`;
    const hits = (
      await this.chatActivity.listRecent(tenantId, chatId, BOSS_HIT_KIND, 500)
    ).filter((entry) => entry.topic === cycleTopic);
    const tally = new Map<string, { name: string | null; damage: number }>();
    for (const hit of hits) {
      if (hit.telegramUserId === undefined) {
        continue;
      }
      const id = hit.telegramUserId.toString();
      const prev = tally.get(id);
      tally.set(id, {
        name: prev?.name ?? hit.username ?? null,
        damage: (prev?.damage ?? 0) + (hit.tensionScore ?? 0),
      });
    }
    const contributors = [...tally.entries()]
      .map(([telegramUserId, value]) => ({
        telegramUserId,
        name: value.name,
        damage: value.damage,
      }))
      .sort((a, b) => b.damage - a.damage)
      .slice(0, 10);
    const marker = await this.chatActivity.findUserEvent(
      tenantId,
      chatId,
      BOSS_HIT_KIND,
      BigInt(userId),
      BigInt(dayKey),
    );
    return {
      scope,
      level: state.level,
      name: meta.name,
      emoji: meta.emoji,
      goal: state.goal,
      done: state.done,
      percent: progress.percent,
      remaining: progress.remaining,
      youAttackedToday: marker !== undefined,
      yourDamage: tally.get(userId)?.damage ?? 0,
      contributors,
    };
  }

  /** The live cooperative boss for the resolved scope (group = the whole chat). */
  async coopBoss(
    userId: string,
    startParam: string | null,
    bot?: BotScope,
    nowMs: number = Date.now(),
  ): Promise<CoopBossView> {
    const tenantId = await this.tenantId(bot);
    const { scope, chatId } = await this.resolveScope(
      startParam,
      userId,
      tenantId,
      bot,
    );
    const dayKey = dayKeyFromMs(nowMs, DAILY_TZ_OFFSET_MIN);
    const state = await this.loadBoss(tenantId, chatId);
    return this.bossStatus(tenantId, chatId, scope, userId, state, dayKey);
  }

  /**
   * One boss attack for the caller. Once per day: a second attack the same day is
   * a no-op. Fixed damage; when the hit drops the boss, a tougher one spawns and
   * a shared collective reward is announced.
   */
  async attackBoss(
    userId: string,
    startParam: string | null,
    playerName: string | undefined,
    bot?: BotScope,
    nowMs: number = Date.now(),
  ): Promise<CoopBossAttackResult> {
    const tenantId = await this.tenantId(bot);
    const { scope, chatId } = await this.resolveScope(
      startParam,
      userId,
      tenantId,
      bot,
    );
    const dayKey = dayKeyFromMs(nowMs, DAILY_TZ_OFFSET_MIN);
    const state = await this.loadBoss(tenantId, chatId);
    const already = await this.chatActivity.findUserEvent(
      tenantId,
      chatId,
      BOSS_HIT_KIND,
      BigInt(userId),
      BigInt(dayKey),
    );
    if (already) {
      const view = await this.bossStatus(
        tenantId,
        chatId,
        scope,
        userId,
        state,
        dayKey,
      );
      return {
        ...view,
        alreadyAttacked: true,
        dealt: 0,
        justDefeated: false,
        defeatedName: null,
        reward: 0,
        rewardMessage: null,
      };
    }

    await this.chatActivity.record({
      tenantId,
      chatId,
      kind: BOSS_HIT_KIND,
      telegramUserId: BigInt(userId),
      ...(playerName ? { username: playerName } : {}),
      messageId: BigInt(dayKey),
      topic: `boss:${state.level}`,
      tensionScore: BOSS_HIT_DAMAGE,
    });
    await this.markDailyPlay(userId, tenantId, nowMs).catch(() => {});

    const newDone = state.done + BOSS_HIT_DAMAGE;
    let justDefeated = false;
    let defeatedName: string | null = null;
    let reward = 0;
    let rewardMessage: string | null = null;
    let nextState: BossState;
    if (newDone >= state.goal) {
      justDefeated = true;
      defeatedName = bossMetaFor(state.level).name;
      const outcome = computeCollectiveReward(
        { improvement: state.goal },
        { threshold: 1, reward: bossRewardFor(state.level) },
      );
      reward = outcome.rewardPerMember;
      rewardMessage = outcome.message;
      nextState = {
        level: state.level + 1,
        goal: bossGoalFor(state.level + 1),
        done: 0,
      };
    } else {
      nextState = { level: state.level, goal: state.goal, done: newDone };
    }
    await this.chatSetting.setValue(
      tenantId,
      chatId,
      BOSS_SETTING_KEY,
      nextState,
    );

    const view = await this.bossStatus(
      tenantId,
      chatId,
      scope,
      userId,
      nextState,
      dayKey,
    );
    return {
      ...view,
      alreadyAttacked: false,
      dealt: BOSS_HIT_DAMAGE,
      justDefeated,
      defeatedName,
      reward,
      rewardMessage,
    };
  }

  /**
   * Marks that the user played something today (idempotent per day), in their
   * personal scope. This is the raw material for the streak on the player home.
   * Best-effort: a failure here must never break the game that triggered it.
   */
  private async markDailyPlay(
    userId: string,
    tenantId: string,
    nowMs: number = Date.now(),
  ): Promise<void> {
    const chatId = `dm:${tenantId}:${userId}`;
    const dayKey = dayKeyFromMs(nowMs, DAILY_TZ_OFFSET_MIN);
    const existing = await this.chatActivity.findUserEvent(
      tenantId,
      chatId,
      DAILY_PLAY_KIND,
      BigInt(userId),
      BigInt(dayKey),
    );
    if (!existing) {
      await this.chatActivity.record({
        tenantId,
        chatId,
        kind: DAILY_PLAY_KIND,
        telegramUserId: BigInt(userId),
        messageId: BigInt(dayKey),
      });
    }
  }

  /**
   * The player's own home: name, points, level + progress, day streak, global
   * rank and the top board — with the caller flagged. `points`/`rank` come from
   * one global per-user total (so the number and the position are consistent).
   */
  async playerProfile(
    userId: string,
    player?: PlayerProfile,
    bot?: BotScope,
    nowMs: number = Date.now(),
  ): Promise<PlayerHomeView> {
    const tenantId = await this.tenantId(bot);
    const uid = BigInt(userId);
    const personalChatId = `dm:${tenantId}:${userId}`;
    const dayKey = dayKeyFromMs(nowMs, DAILY_TZ_OFFSET_MIN);

    const [players, playDays, dailyMarker] = await Promise.all([
      this.games.topPlayers(tenantId, 50),
      this.chatActivity.listRecent(
        tenantId,
        personalChatId,
        DAILY_PLAY_KIND,
        90,
      ),
      this.chatActivity.findUserEvent(
        tenantId,
        personalChatId,
        DAILY_TRIVIA_KIND,
        uid,
        BigInt(dayKey),
      ),
    ]);

    const meIndex = players.findIndex((p) => p.telegramUserId === uid);
    const me = meIndex >= 0 ? players[meIndex] : undefined;
    const points = me
      ? me.points
      : await this.games.sumUserPoints(tenantId, uid);
    const level = levelForPoints(points);
    const streakDays = computeStreak(
      playDays.map((entry) =>
        entry.messageId !== undefined ? Number(entry.messageId) : Number.NaN,
      ),
      dayKey,
    );

    return {
      name: player?.displayName ?? player?.username ?? null,
      points,
      level: level.level,
      levelFloor: level.floor,
      levelCeil: level.ceil,
      streakDays,
      rank: meIndex >= 0 ? meIndex + 1 : null,
      dailyPending: dailyMarker === undefined,
      top: players.slice(0, 5).map((p) => ({
        telegramUserId: p.telegramUserId.toString(),
        name: p.name ?? null,
        points: p.points,
        you: p.telegramUserId === uid,
      })),
    };
  }

  /**
   * Records the player's current Telegram name (from verified initData) so the
   * leaderboard can show a human name instead of a raw id — even for members who
   * only ever played via the Mini App and never chatted in the group.
   */
  private async rememberPlayer(
    telegramUserId: bigint,
    tenantId: string,
    player: PlayerProfile | undefined,
  ): Promise<void> {
    if (!player) {
      return;
    }
    const data: { displayName?: string; username?: string } = {};
    if (player.displayName) {
      data.displayName = player.displayName;
    }
    if (player.username) {
      data.username = player.username;
    }
    if (Object.keys(data).length === 0) {
      return;
    }
    await this.client.appUser.upsert({
      where: { telegramUserId },
      create: { telegramUserId, tenantId, ...data },
      update: data,
    });
  }
}

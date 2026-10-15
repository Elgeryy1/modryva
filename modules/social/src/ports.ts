/**
 * The two things the social domain is not allowed to reach for on its own.
 *
 * Everything else in `modules/social` is a pure function of its arguments. Time
 * and randomness are the exceptions that would make a daily ritual and a 1-in-6
 * draw untestable, so they come in through these ports instead — which is what
 * lets a test pin "it is 02:30 on the night the clocks go back" or "this round
 * is the losing one" without waiting for either to happen.
 */

/** Wall-clock reader. Production passes the system clock; tests pass a fixed one. */
export interface Clock {
  now(): Date;
}

/**
 * Uniform integer source over `[minInclusive, maxExclusive)`.
 *
 * Production MUST back this with `crypto.randomInt` — never `Math.random()`,
 * whose output is predictable from previous draws and would let someone work
 * out when the roulette is safe.
 */
export interface RandomSource {
  int(minInclusive: number, maxExclusive: number): number;
}

/** The system clock. The only place in the social module that reads real time. */
export const systemClock: Clock = { now: () => new Date() };

/**
 * A clock frozen at one instant, for tests. Kept in the production bundle on
 * purpose: it is three lines, and every test that needs a date would otherwise
 * hand-roll its own slightly different version.
 */
export const fixedClock = (at: Date): Clock => ({ now: () => new Date(at) });

/**
 * A RandomSource that walks a fixed list of draws and then repeats it.
 *
 * Tests state the outcome they mean ("the first round loses, the next five
 * survive") instead of hunting for a seed that happens to produce it.
 */
export const sequenceRandom = (draws: readonly number[]): RandomSource => {
  let index = 0;
  return {
    int: (minInclusive: number, maxExclusive: number): number => {
      if (draws.length === 0) {
        return minInclusive;
      }
      const raw = draws[index % draws.length] ?? minInclusive;
      index += 1;
      const span = Math.max(1, maxExclusive - minInclusive);
      // Clamp rather than trust the fixture: a draw outside the range would
      // otherwise silently mean something different per call site.
      return minInclusive + ((((raw - minInclusive) % span) + span) % span);
    },
  };
};

/**
 * Outcome of asking the existing moderation stack to mute somebody.
 *
 * `no-permission` is deliberately distinct from `failed`: the first is a
 * configuration problem the group can fix and must be told about, the second is
 * Telegram refusing for a reason the user cannot act on.
 */
export type ModerationOutcome =
  | { readonly ok: true; readonly caseNumber: number | null }
  | {
      readonly ok: false;
      readonly reason: "no-permission" | "protected" | "failed";
    };

export interface MuteRequest {
  readonly tenantId: string;
  readonly chatId: bigint;
  readonly targetUserId: bigint;
  readonly seconds: number;
  readonly reason: string;
}

/**
 * The social module's only door to sanctions.
 *
 * It exists so `modules/social` can decide that a round was lost without
 * knowing what a sanction record or `restrictChatMember` is. The implementation
 * in `apps/bot` is a facade over the moderation path that already exists — it
 * creates no second sanction table and makes no second Telegram call of its own.
 */
export interface ModerationPort {
  /** Whether the bot can restrict members here at all. */
  canRestrict(chatId: bigint): Promise<boolean>;
  /** Whether this person must never be sanctioned (admin, creator, the bot). */
  isProtected(chatId: bigint, userId: bigint): Promise<boolean>;
  mute(request: MuteRequest): Promise<ModerationOutcome>;
}

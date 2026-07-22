/**
 * Support subscription plans, ordered from lowest to highest base priority.
 * Pure and deterministic.
 */
export type SupportPlan = "free" | "pro" | "vip";

/**
 * A support ticket waiting to be attended, described by its owner plan and how
 * long it has already been waiting, in milliseconds. Plain data with no side
 * effects.
 */
export interface SupportTicket {
  readonly id: string;
  readonly plan: SupportPlan;
  readonly ageMs: number;
}

/**
 * A ticket id paired with its computed numeric priority. A higher number means
 * the ticket should be attended sooner. Plain data with no side effects.
 */
export interface PrioritizedTicket {
  readonly id: string;
  readonly priority: number;
}

/** Base priority granted by each plan. Higher plans always outrank lower ones. */
const PLAN_WEIGHT: Readonly<Record<SupportPlan, number>> = {
  free: 10,
  pro: 20,
  vip: 30,
};

/** Milliseconds in one minute, used to turn waiting time into bonus points. */
const MINUTE_MS = 60_000;

/**
 * Maximum age bonus, in points. Capped below the gap between adjacent plans
 * (which is 10) so that waiting time can reorder tickets within a plan but can
 * never let a lower plan overtake a higher one.
 */
const AGE_BONUS_CAP = 9;

/**
 * Bounded age bonus for a ticket: one point per full waiting minute, clamped to
 * the range [0, AGE_BONUS_CAP]. Non-finite or negative wait times yield 0.
 * Pure and deterministic.
 */
const ageBonus = (ageMs: number): number => {
  const minutes = Number.isFinite(ageMs) ? Math.floor(ageMs / MINUTE_MS) : 0;
  return Math.max(0, Math.min(AGE_BONUS_CAP, minutes));
};

/**
 * Priority of a single ticket: its plan weight plus a bounded age bonus.
 * Pure and deterministic.
 */
const ticketPriority = (plan: SupportPlan, ageMs: number): number =>
  PLAN_WEIGHT[plan] + ageBonus(ageMs);

/**
 * Prioritizes support tickets by plan and waiting time. Each ticket receives a
 * numeric priority equal to its plan weight plus a bounded age bonus, and the
 * result is sorted by priority descending, breaking ties by id ascending. The
 * input array is never mutated, and an empty input yields an empty result.
 * Pure and deterministic.
 */
export const prioritizeByPlan = (
  tickets: readonly SupportTicket[],
): readonly PrioritizedTicket[] => {
  const scored: PrioritizedTicket[] = tickets.map((ticket) => ({
    id: ticket.id,
    priority: ticketPriority(ticket.plan, ticket.ageMs),
  }));
  scored.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    if (a.id < b.id) {
      return -1;
    }
    if (a.id > b.id) {
      return 1;
    }
    return 0;
  });
  return scored;
};

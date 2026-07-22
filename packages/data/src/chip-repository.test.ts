import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { CHIP_REASONS, PrismaChipRepository } from "./chip-repository.js";

// Load-bearing legal guardrail: the casino is a SOCIAL casino — chips are virtual
// and can NEVER be cashed out. The ledger reason union is the enforcement point.
// If anyone adds a withdraw/cashout reason this test fails the build, and because
// ChipReason is a closed TS union the credit paths won't even compile with one.
describe("chip economy guardrails", () => {
  it("has no cash-out / withdraw path in the ledger reasons", () => {
    for (const reason of CHIP_REASONS) {
      expect(/cash|withdraw|payout.?real|redeem|money/i.test(reason)).toBe(
        false,
      );
    }
  });

  it("exposes only inbound/virtual reasons", () => {
    // Sanity: the reasons we rely on exist; nobody silently dropped them.
    for (const required of ["welcome", "daily", "bet", "win", "purchase"]) {
      expect(CHIP_REASONS).toContain(required);
    }
  });
});

interface FakeTournamentRow {
  id: string;
  tenantId: string;
  period: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  prizePool: number;
  winners: unknown;
  settledAt: Date | null;
  payoutsCompletedAt: Date | null;
}

interface FakeLedgerRow {
  tenantId: string;
  telegramUserId: bigint;
  delta: number;
  reason: string;
  refId: string | null;
  createdAt: Date;
}

const p2002 = (): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });

const findTournament = (
  tournaments: FakeTournamentRow[],
  where: {
    id?: string;
    tenantId_period?: { tenantId: string; period: string };
  },
): FakeTournamentRow | undefined => {
  if (where.id !== undefined) {
    return tournaments.find((t) => t.id === where.id);
  }
  if (where.tenantId_period) {
    const { tenantId, period } = where.tenantId_period;
    return tournaments.find(
      (t) => t.tenantId === tenantId && t.period === period,
    );
  }
  return undefined;
};

interface FakeClientOptions {
  /** Simulates a non-unique-violation failure in chipLedger.create for this user. */
  failLedgerFor?: bigint;
}

const buildFakeClient = (
  tournaments: FakeTournamentRow[],
  ledger: FakeLedgerRow[],
  options: FakeClientOptions = {},
) => {
  const calls = { groupBy: 0, ledgerCreate: 0, tournamentUpdate: 0 };
  let nextId = 1;
  const wallets = new Map<string, number>();

  const client = {
    calls,
    tournament: {
      findUnique: async ({
        where,
      }: {
        where: {
          id?: string;
          tenantId_period?: { tenantId: string; period: string };
        };
      }) => findTournament(tournaments, where) ?? null,
      findMany: async ({
        where,
      }: {
        where: {
          tenantId: string;
          period: { not: string };
          OR: Array<Record<string, unknown>>;
        };
      }) =>
        tournaments.filter((t) => {
          if (t.tenantId !== where.tenantId) return false;
          if (t.period === where.period.not) return false;
          return where.OR.some((cond) => {
            if (cond.status !== t.status) return false;
            if (cond.status === "open") {
              const endsAt = cond.endsAt as { lte: Date };
              return t.endsAt.getTime() <= endsAt.lte.getTime();
            }
            // { status: "settled", payoutsCompletedAt: null }
            return t.payoutsCompletedAt === null;
          });
        }),
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { tenantId_period: { tenantId: string; period: string } };
        create: {
          tenantId: string;
          period: string;
          startsAt: Date;
          endsAt: Date;
          prizePool: number;
        };
        update: Record<string, unknown>;
      }) => {
        const existing = findTournament(tournaments, where);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row: FakeTournamentRow = {
          id: `tour_auto_${nextId++}`,
          tenantId: create.tenantId,
          period: create.period,
          startsAt: create.startsAt,
          endsAt: create.endsAt,
          status: "open",
          prizePool: create.prizePool,
          winners: null,
          settledAt: null,
          payoutsCompletedAt: null,
        };
        tournaments.push(row);
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; status: string };
        data: Partial<FakeTournamentRow>;
      }) => {
        const row = tournaments.find(
          (t) => t.id === where.id && t.status === where.status,
        );
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeTournamentRow>;
      }) => {
        calls.tournamentUpdate += 1;
        const row = tournaments.find((t) => t.id === where.id);
        if (!row) throw new Error(`fake tournament ${where.id} not found`);
        Object.assign(row, data);
        return row;
      },
    },
    chipLedger: {
      groupBy: async ({
        where,
        take,
      }: {
        where: {
          tenantId: string;
          reason: { in: string[] };
          createdAt: { gte: Date; lt: Date };
        };
        take?: number;
      }) => {
        calls.groupBy += 1;
        const totals = new Map<string, number>();
        for (const row of ledger) {
          if (row.tenantId !== where.tenantId) continue;
          if (!where.reason.in.includes(row.reason)) continue;
          if (row.createdAt.getTime() < where.createdAt.gte.getTime()) {
            continue;
          }
          if (row.createdAt.getTime() >= where.createdAt.lt.getTime()) {
            continue;
          }
          const key = row.telegramUserId.toString();
          totals.set(key, (totals.get(key) ?? 0) + row.delta);
        }
        const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
        const limited = take ? sorted.slice(0, take) : sorted;
        return limited.map(([telegramUserId, sum]) => ({
          telegramUserId: BigInt(telegramUserId),
          _sum: { delta: sum },
        }));
      },
      create: async ({
        data,
      }: {
        data: {
          tenantId: string;
          telegramUserId: bigint;
          delta: number;
          reason: string;
          refId?: string;
        };
      }) => {
        calls.ledgerCreate += 1;
        if (
          options.failLedgerFor !== undefined &&
          data.telegramUserId === options.failLedgerFor
        ) {
          throw new Error("simulated non-unique db failure");
        }
        const refId = data.refId ?? null;
        if (
          ledger.some(
            (row) =>
              row.tenantId === data.tenantId &&
              row.telegramUserId === data.telegramUserId &&
              row.reason === data.reason &&
              row.refId === refId,
          )
        ) {
          throw p2002();
        }
        ledger.push({
          tenantId: data.tenantId,
          telegramUserId: data.telegramUserId,
          delta: data.delta,
          reason: data.reason,
          refId,
          createdAt: new Date(),
        });
      },
    },
    chipWallet: {
      update: async ({
        where,
        data,
      }: {
        where: {
          tenantId_telegramUserId: {
            tenantId: string;
            telegramUserId: bigint;
          };
        };
        data: { balance: { increment: number } };
      }) => {
        const { tenantId, telegramUserId } = where.tenantId_telegramUserId;
        const key = `${tenantId}:${telegramUserId}`;
        const next = (wallets.get(key) ?? 0) + data.balance.increment;
        wallets.set(key, next);
        return { balance: next };
      },
    },
  };

  const withTransaction = {
    ...client,
    $transaction: async (fn: (tx: typeof client) => Promise<unknown>) =>
      fn(client),
  };

  return withTransaction as unknown as PrismaClient & { calls: typeof calls };
};

// Fixed past window, far from any real ISO week this suite ever runs in —
// guarantees `period !== currentPeriod` and `endsAt <= now` deterministically.
const START = new Date("2020-01-01T00:00:00.000Z");
const END = new Date("2020-01-08T00:00:00.000Z");
const MID = new Date("2020-01-03T00:00:00.000Z");

describe("PrismaChipRepository weekly tournament settlement (crash-resume)", () => {
  it("settles an ended open tournament, paying the top-3 net players", async () => {
    const tournaments: FakeTournamentRow[] = [
      {
        id: "tour1",
        tenantId: "t1",
        period: "2020-W01",
        startsAt: START,
        endsAt: END,
        status: "open",
        prizePool: 1000,
        winners: null,
        settledAt: null,
        payoutsCompletedAt: null,
      },
    ];
    const ledger: FakeLedgerRow[] = [
      {
        tenantId: "t1",
        telegramUserId: 111n,
        delta: 500,
        reason: "win",
        refId: null,
        createdAt: MID,
      },
      {
        tenantId: "t1",
        telegramUserId: 222n,
        delta: 300,
        reason: "win",
        refId: null,
        createdAt: MID,
      },
      {
        tenantId: "t1",
        telegramUserId: 333n,
        delta: 100,
        reason: "win",
        refId: null,
        createdAt: MID,
      },
    ];
    const client = buildFakeClient(tournaments, ledger);
    const repo = new PrismaChipRepository(client);

    await repo.tournamentState("t1");

    const row = tournaments.find((t) => t.id === "tour1");
    expect(row?.status).toBe("settled");
    expect(row?.payoutsCompletedAt).not.toBeNull();

    const payouts = ledger.filter(
      (r) => r.reason === "tournament" && r.refId === "tour1",
    );
    expect(payouts).toHaveLength(3);
    expect(payouts.find((p) => p.telegramUserId === 111n)?.delta).toBe(600); // 60% of 1000
    expect(payouts.find((p) => p.telegramUserId === 222n)?.delta).toBe(300); // 30% of 1000
    expect(payouts.find((p) => p.telegramUserId === 333n)?.delta).toBe(100); // 10% of 1000
  });

  it("resumes a settled-but-unpaid tournament after a simulated crash without double-paying", async () => {
    const tournaments: FakeTournamentRow[] = [
      {
        id: "tour2",
        tenantId: "t1",
        period: "2020-W02",
        startsAt: START,
        endsAt: END,
        status: "settled",
        prizePool: 1000,
        winners: [
          { telegramUserId: "111", prize: 600, net: 500 },
          { telegramUserId: "222", prize: 300, net: 300 },
          { telegramUserId: "333", prize: 100, net: 100 },
        ],
        settledAt: MID,
        payoutsCompletedAt: null,
      },
    ];
    // Winner #1 was already paid before the crash.
    const ledger: FakeLedgerRow[] = [
      {
        tenantId: "t1",
        telegramUserId: 111n,
        delta: 600,
        reason: "tournament",
        refId: "tour2",
        createdAt: MID,
      },
    ];
    const client = buildFakeClient(tournaments, ledger);
    const repo = new PrismaChipRepository(client);

    await repo.tournamentState("t1");

    const row = tournaments.find((t) => t.id === "tour2");
    expect(row?.payoutsCompletedAt).not.toBeNull();

    const payouts = ledger.filter(
      (r) => r.reason === "tournament" && r.refId === "tour2",
    );
    // Still exactly 3 total: the pre-existing one + the 2 that were missing.
    expect(payouts).toHaveLength(3);
    expect(payouts.filter((p) => p.telegramUserId === 111n)).toHaveLength(1);
    expect(payouts.find((p) => p.telegramUserId === 222n)?.delta).toBe(300);
    expect(payouts.find((p) => p.telegramUserId === 333n)?.delta).toBe(100);
  });

  it("never rescans or re-touches a tournament whose payouts already completed", async () => {
    const tournaments: FakeTournamentRow[] = [
      {
        id: "tour3",
        tenantId: "t1",
        period: "2020-W03",
        startsAt: START,
        endsAt: END,
        status: "settled",
        prizePool: 1000,
        winners: [{ telegramUserId: "111", prize: 600, net: 500 }],
        settledAt: MID,
        payoutsCompletedAt: MID,
      },
    ];
    const ledger: FakeLedgerRow[] = [];
    const client = buildFakeClient(tournaments, ledger);
    const repo = new PrismaChipRepository(client);

    await repo.tournamentState("t1");

    expect(client.calls.ledgerCreate).toBe(0);
    expect(client.calls.tournamentUpdate).toBe(0);
    const row = tournaments.find((t) => t.id === "tour3");
    expect(row).toMatchObject({ status: "settled", payoutsCompletedAt: MID });
  });

  it("marks payouts complete even when nobody had a positive net (no winners)", async () => {
    const tournaments: FakeTournamentRow[] = [
      {
        id: "tour4",
        tenantId: "t1",
        period: "2020-W04",
        startsAt: START,
        endsAt: END,
        status: "open",
        prizePool: 1000,
        winners: null,
        settledAt: null,
        payoutsCompletedAt: null,
      },
    ];
    const ledger: FakeLedgerRow[] = [];
    const client = buildFakeClient(tournaments, ledger);
    const repo = new PrismaChipRepository(client);

    await repo.tournamentState("t1");

    const row = tournaments.find((t) => t.id === "tour4");
    expect(row?.status).toBe("settled");
    expect(row?.payoutsCompletedAt).not.toBeNull();
    expect(ledger.filter((r) => r.reason === "tournament")).toHaveLength(0);
  });

  it("leaves payoutsCompletedAt unset on a real payout failure, so the next poll retries", async () => {
    const tournaments: FakeTournamentRow[] = [
      {
        id: "tour5",
        tenantId: "t1",
        period: "2020-W05",
        startsAt: START,
        endsAt: END,
        status: "open",
        prizePool: 1000,
        winners: null,
        settledAt: null,
        payoutsCompletedAt: null,
      },
    ];
    const ledger: FakeLedgerRow[] = [
      {
        tenantId: "t1",
        telegramUserId: 999n,
        delta: 500,
        reason: "win",
        refId: null,
        createdAt: MID,
      },
    ];
    const client = buildFakeClient(tournaments, ledger, {
      failLedgerFor: 999n,
    });
    const repo = new PrismaChipRepository(client);

    await expect(repo.tournamentState("t1")).rejects.toThrow(
      "simulated non-unique db failure",
    );

    const row = tournaments.find((t) => t.id === "tour5");
    // Phase 1 already committed (claimed for settlement)...
    expect(row?.status).toBe("settled");
    // ...but payouts never completed, so the next lazy-settle poll retries.
    expect(row?.payoutsCompletedAt).toBeNull();
  });

  it("never double-pays a tournament settled concurrently by two readers", async () => {
    const tournaments: FakeTournamentRow[] = [
      {
        id: "tour6",
        tenantId: "t1",
        period: "2020-W06",
        startsAt: START,
        endsAt: END,
        status: "open",
        prizePool: 1000,
        winners: null,
        settledAt: null,
        payoutsCompletedAt: null,
      },
    ];
    const ledger: FakeLedgerRow[] = [
      {
        tenantId: "t1",
        telegramUserId: 111n,
        delta: 500,
        reason: "win",
        refId: null,
        createdAt: MID,
      },
    ];
    const client = buildFakeClient(tournaments, ledger);
    const repo = new PrismaChipRepository(client);

    // Two concurrent readers both trigger the lazy-settle path for the same
    // still-open tournament; only one may claim + pay it.
    await Promise.all([repo.tournamentState("t1"), repo.tournamentState("t1")]);

    const payouts = ledger.filter(
      (r) => r.reason === "tournament" && r.refId === "tour6",
    );
    expect(payouts).toHaveLength(1);
    expect(payouts[0]?.delta).toBe(600);
  });
});

describe("PrismaChipRepository.openDuel atomicity", () => {
  const buildDuelClient = (funded: boolean) => {
    const counts = { create: 0, ledger: 0, delete: 0 };
    const client = {
      $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> =>
        fn(client),
      chipWallet: {
        updateMany: async () => ({ count: funded ? 1 : 0 }),
        findUnique: async () => ({ balance: funded ? 90 : 5 }),
      },
      casinoDuel: {
        create: async () => {
          counts.create += 1;
          return { id: "duel_1" };
        },
        // Present so the pre-fix two-phase path (create-then-delete on a failed
        // debit) is still callable — the point is it must never run now.
        delete: async () => {
          counts.delete += 1;
          return {};
        },
      },
      chipLedger: {
        create: async () => {
          counts.ledger += 1;
          return {};
        },
      },
    };
    return { client: client as unknown as PrismaClient, counts };
  };

  it("never creates a duel row when the challenger cannot afford the stake", async () => {
    const { client, counts } = buildDuelClient(false);
    const repo = new PrismaChipRepository(client);

    const result = await repo.openDuel({
      tenantId: "t1",
      chatId: "c1",
      challengerId: 7n,
      challengerName: null,
      stake: 10,
    });

    expect(result).toEqual({ ok: false, duelId: null, balance: 5 });
    // Before the fix the duel row was created FIRST and only deleted afterwards;
    // now it is never created unless the stake is actually secured.
    expect(counts.create).toBe(0);
    expect(counts.ledger).toBe(0);
  });

  it("creates the duel and writes the debit ledger together when funds suffice", async () => {
    const { client, counts } = buildDuelClient(true);
    const repo = new PrismaChipRepository(client);

    const result = await repo.openDuel({
      tenantId: "t1",
      chatId: "c1",
      challengerId: 7n,
      challengerName: "Ada",
      stake: 10,
    });

    expect(result).toEqual({ ok: true, duelId: "duel_1", balance: 90 });
    expect(counts.create).toBe(1);
    expect(counts.ledger).toBe(1);
  });
});

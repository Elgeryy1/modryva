import type {
  ChipRepository,
  DuelSettleResult,
  StaleDuel,
} from "@superbot/data";
import { describe, expect, it } from "vitest";
import type { DuelNotifyGateway } from "./duel-processor.js";
import { processStaleDuels } from "./duel-processor.js";

const staleDuel = (overrides: Partial<StaleDuel> = {}): StaleDuel => ({
  id: "duel_1",
  tenantId: "tenant_1",
  chatId: "-100123",
  stake: 50,
  challengerId: 1n,
  challengerName: "Ana",
  opponentId: 2n,
  claimedAt: new Date(Date.now() - 10 * 60 * 1000),
  ...overrides,
});

class FakeChips {
  due: StaleDuel[] = [];
  settleResults = new Map<string, DuelSettleResult | null>();
  settleThrows = new Set<string>();
  settleCalls: string[] = [];

  async listStaleRollingDuels(): Promise<StaleDuel[]> {
    return this.due;
  }

  async settleDuel(
    _tenantId: string,
    duelId: string,
  ): Promise<DuelSettleResult | null> {
    this.settleCalls.push(duelId);
    if (this.settleThrows.has(duelId)) {
      throw new Error("db blip");
    }
    return this.settleResults.get(duelId) ?? null;
  }
}

class FakeGateway implements DuelNotifyGateway {
  sent: Array<{ chatId: bigint; text: string }> = [];
  shouldFail = false;

  async sendMessage(input: { chatId: bigint; reply: { text: string } }) {
    if (this.shouldFail) {
      throw new Error("send failed");
    }
    this.sent.push({ chatId: input.chatId, text: input.reply.text });
    return { ok: true, skipped: false };
  }
}

const tieResult = (duel: StaleDuel): DuelSettleResult => ({
  tie: true,
  challengerId: duel.challengerId,
  opponentId: duel.opponentId,
  stake: duel.stake,
  winnerId: null,
  payout: 0,
});

describe("processStaleDuels", () => {
  it("settles a stale rolling duel as a refunded tie and notifies the chat", async () => {
    const duel = staleDuel();
    const chips = new FakeChips();
    chips.due = [duel];
    chips.settleResults.set(duel.id, tieResult(duel));
    const gateway = new FakeGateway();

    const summary = await processStaleDuels({
      chips: chips as unknown as Pick<
        ChipRepository,
        "listStaleRollingDuels" | "settleDuel"
      >,
      gateway,
      resolveBotToken: async () => "bot-token",
      staleAfterMs: 5 * 60 * 1000,
      now: new Date(),
    });

    expect(summary).toEqual({ processed: 1, reverted: 1, errors: 0 });
    expect(chips.settleCalls).toEqual([duel.id]);
    expect(gateway.sent).toHaveLength(1);
    expect(gateway.sent[0]?.chatId).toBe(-100123n);
  });

  it("skips a duel already resolved concurrently by the live handler", async () => {
    const duel = staleDuel();
    const chips = new FakeChips();
    chips.due = [duel];
    chips.settleResults.set(duel.id, null); // settleDuel's own "not rolling anymore" guard fired
    const gateway = new FakeGateway();

    const summary = await processStaleDuels({
      chips: chips as unknown as Pick<
        ChipRepository,
        "listStaleRollingDuels" | "settleDuel"
      >,
      gateway,
      resolveBotToken: async () => "bot-token",
      staleAfterMs: 5 * 60 * 1000,
      now: new Date(),
    });

    expect(summary).toEqual({ processed: 1, reverted: 0, errors: 0 });
    expect(gateway.sent).toHaveLength(0);
  });

  it("counts an error without stopping the sweep of other duels", async () => {
    const broken = staleDuel({ id: "duel_broken" });
    const ok = staleDuel({ id: "duel_ok" });
    const chips = new FakeChips();
    chips.due = [broken, ok];
    chips.settleThrows.add(broken.id);
    chips.settleResults.set(ok.id, tieResult(ok));
    const gateway = new FakeGateway();

    const summary = await processStaleDuels({
      chips: chips as unknown as Pick<
        ChipRepository,
        "listStaleRollingDuels" | "settleDuel"
      >,
      gateway,
      resolveBotToken: async () => "bot-token",
      staleAfterMs: 5 * 60 * 1000,
      now: new Date(),
    });

    expect(summary).toEqual({ processed: 2, reverted: 1, errors: 1 });
    expect(chips.settleCalls).toEqual([broken.id, ok.id]);
  });

  it("still counts the refund as reverted even if the notification fails", async () => {
    const duel = staleDuel();
    const chips = new FakeChips();
    chips.due = [duel];
    chips.settleResults.set(duel.id, tieResult(duel));
    const gateway = new FakeGateway();
    gateway.shouldFail = true;

    const summary = await processStaleDuels({
      chips: chips as unknown as Pick<
        ChipRepository,
        "listStaleRollingDuels" | "settleDuel"
      >,
      gateway,
      resolveBotToken: async () => "bot-token",
      staleAfterMs: 5 * 60 * 1000,
      now: new Date(),
    });

    expect(summary).toEqual({ processed: 1, reverted: 1, errors: 0 });
  });
});

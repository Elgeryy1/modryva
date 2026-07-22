import type { ChipRepository } from "@superbot/data";
import type { BotReply } from "@superbot/domain";
import type { TelegramGatewayResult } from "@superbot/telegram";

export interface ExpirationSummary {
  readonly processed: number;
  readonly reverted: number;
  readonly errors: number;
}

export interface DuelNotifyGateway {
  sendMessage(input: {
    chatId: bigint;
    reply: BotReply;
    token: string | undefined;
  }): Promise<TelegramGatewayResult>;
}

export interface DuelExpirationContext {
  readonly chips: Pick<ChipRepository, "listStaleRollingDuels" | "settleDuel">;
  readonly gateway: DuelNotifyGateway;
  readonly resolveBotToken: (tenantId: string) => Promise<string | undefined>;
  readonly staleAfterMs: number;
  readonly now: Date;
}

/**
 * casino.duel.expire — recovers dice duels wedged in 'rolling': claimDuel
 * debited the opponent's stake and flipped the duel, but settleDuel never
 * ran (process crash/restart, or the unguarded settleDuel call in
 * handleDuelCallback throwing after both dice already landed). Force-
 * settles each as a refunded tie via the SAME atomic settleDuel transition
 * the live handler uses, so a duel that resolves normally a moment before
 * this runs can never be double-settled.
 */
export const processStaleDuels = async (
  context: DuelExpirationContext,
): Promise<ExpirationSummary> => {
  const cutoff = new Date(context.now.getTime() - context.staleAfterMs);
  const due = await context.chips.listStaleRollingDuels(cutoff);
  let reverted = 0;
  let errors = 0;

  for (const duel of due) {
    let settled: Awaited<ReturnType<ChipRepository["settleDuel"]>>;
    try {
      settled = await context.chips.settleDuel(duel.tenantId, duel.id, 0, 0);
    } catch {
      errors += 1;
      continue;
    }
    if (!settled) {
      continue; // already resolved by the live handler in the meantime
    }
    reverted += 1;
    try {
      const token = await context.resolveBotToken(duel.tenantId);
      if (token) {
        await context.gateway.sendMessage({
          chatId: BigInt(duel.chatId),
          reply: {
            text: "⚠️ Este duelo tardó demasiado en resolverse. Apuestas devueltas.",
          },
          token,
        });
      }
    } catch {
      // Best-effort notification only — the refund already committed above.
    }
  }

  return { processed: due.length, reverted, errors };
};

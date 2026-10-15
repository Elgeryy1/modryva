import type { AdminAction, AdminActionKind } from "./appointed-admin-guard.js";

/**
 * Sliding window of what each appointed admin has just done, keyed per
 * (chat, admin). Mirrors InMemoryRaidJoinNameStore's contract so it wires into
 * the bot the same way.
 *
 * In-memory on purpose. A restart forgets the window, which means a rogue admin
 * gets their counter reset — acceptable, because the alternative is a database
 * write on every ban in the group, and the window is measured in seconds. What
 * is NOT forgotten is any revocation the guard already performed: that lives in
 * bot_granted_admins and the audit log.
 */
export interface AdminActionStore {
  record(
    key: string,
    kind: AdminActionKind,
    nowMs: number,
    windowSeconds: number,
  ): Promise<readonly AdminAction[]>;
  reset(key: string): Promise<void>;
}

/** Bounded so a busy or hostile group cannot grow this map without limit. */
const MAX_KEYS = 5000;

export class InMemoryAdminActionStore implements AdminActionStore {
  private readonly buckets = new Map<string, AdminAction[]>();

  async record(
    key: string,
    kind: AdminActionKind,
    nowMs: number,
    windowSeconds: number,
  ): Promise<readonly AdminAction[]> {
    const windowStart = nowMs - windowSeconds * 1000;
    const existing = (this.buckets.get(key) ?? []).filter(
      (action) => action.ms >= windowStart,
    );
    existing.push({ kind, ms: nowMs });

    // Evict before inserting a NEW key, never an existing one: dropping the key
    // being written would reset the very counter about to trip.
    if (!this.buckets.has(key) && this.buckets.size >= MAX_KEYS) {
      const oldest = this.buckets.keys().next();
      if (!oldest.done) {
        this.buckets.delete(oldest.value);
      }
    }
    this.buckets.set(key, existing);
    return existing;
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }
}

/** One counter per admin per chat. */
export const adminActionKey = (
  telegramChatId: bigint,
  telegramUserId: bigint,
): string => `${telegramChatId.toString()}:${telegramUserId.toString()}`;

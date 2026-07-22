/**
 * A single game player fingerprint used to detect shared-signal multi-accounts.
 * Two players sharing the same `ip` and `deviceHash` are considered linked.
 */
export interface GameMultiAccountPlayer {
  /** Stable player identifier (e.g. Telegram user id as string). */
  readonly id: string;
  /** Source IP address observed for this player. */
  readonly ip: string;
  /** Opaque device/browser fingerprint hash observed for this player. */
  readonly deviceHash: string;
}

/**
 * A cluster of player ids that share the exact same entry signal (ip+deviceHash).
 */
export interface GameMultiAccountGroup {
  /** Composite signal key in the form `${ip}|${deviceHash}`. */
  readonly key: string;
  /** Distinct player ids in the cluster, sorted ascending. */
  readonly ids: readonly string[];
}

const SIGNAL_SEPARATOR = "|";

/** ASCII-stable ascending comparison for two strings. Pure and deterministic. */
const compareAsc = (a: string, b: string): number => {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
};

/**
 * Groups players that share the same entry signal (identical ip AND deviceHash),
 * flagging potential multi-accounts in games. Player ids are de-duplicated within
 * each group and sorted ascending. Only groups with at least two distinct ids are
 * returned. Groups are ordered by size descending, then by key ascending.
 * Empty input yields an empty result.
 * Pure and deterministic.
 */
export const detectGameMultiAccounts = (
  players: readonly GameMultiAccountPlayer[],
): readonly GameMultiAccountGroup[] => {
  const buckets = new Map<string, string[]>();
  for (const player of players) {
    const key = `${player.ip}${SIGNAL_SEPARATOR}${player.deviceHash}`;
    const existing = buckets.get(key) ?? [];
    if (!existing.includes(player.id)) {
      existing.push(player.id);
    }
    buckets.set(key, existing);
  }

  const groups: GameMultiAccountGroup[] = [];
  for (const [key, ids] of buckets) {
    if (ids.length >= 2) {
      const sortedIds = [...ids].sort(compareAsc);
      groups.push({ key, ids: sortedIds });
    }
  }

  groups.sort((a, b) => {
    if (a.ids.length !== b.ids.length) {
      return b.ids.length - a.ids.length;
    }
    return compareAsc(a.key, b.key);
  });

  return groups;
};

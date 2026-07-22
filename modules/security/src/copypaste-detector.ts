/**
 * A single chat message paired with the account that sent it.
 * Pure and deterministic.
 */
export interface CopyPasteMessage {
  readonly authorId: number;
  readonly text: string;
}

/**
 * Tuning options for copy-paste detection.
 * minAccounts is the minimum number of DISTINCT authors a normalized text
 * must reach to be reported as a cluster (default 2).
 * Pure and deterministic.
 */
export interface CopyPasteOptions {
  readonly minAccounts?: number;
}

/**
 * One detected group of near-identical messages: a representative sample
 * (the first original text seen for that normalized key) and the sorted
 * list of distinct authors that posted it.
 * Pure and deterministic.
 */
export interface CopyPasteCluster {
  readonly sample: string;
  readonly authors: readonly number[];
}

/**
 * Result of scanning a batch of messages for copy-pasted content.
 * matched is true when at least one cluster qualifies.
 * Pure and deterministic.
 */
export interface CopyPasteReport {
  readonly matched: boolean;
  readonly clusters: readonly CopyPasteCluster[];
}

interface MutableGroup {
  sample: string;
  readonly authors: number[];
}

/**
 * Normalizes a text for comparison: trims edges, lowercases, and collapses
 * every run of whitespace into a single space. Returns "" when the text is
 * blank so blank messages can be skipped.
 * Pure and deterministic.
 */
const normalize = (text: string): string =>
  text.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Detects copy-pasted messages: near-identical texts (after normalization)
 * posted by several distinct accounts. Messages are grouped by their
 * normalized text; a group becomes a cluster when it reaches at least
 * minAccounts distinct authors. Within a cluster authors are sorted
 * ascending; clusters are sorted by distinct-author count descending, then
 * by sample text ascending. Blank messages are ignored.
 * Pure and deterministic.
 */
export const detectCopyPaste = (
  messages: readonly CopyPasteMessage[],
  options?: CopyPasteOptions,
): CopyPasteReport => {
  const minAccounts = options?.minAccounts ?? 2;
  const groups = new Map<string, MutableGroup>();

  for (const message of messages) {
    const key = normalize(message.text);
    if (key === "") {
      continue;
    }
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, { sample: message.text, authors: [message.authorId] });
      continue;
    }
    if (!existing.authors.includes(message.authorId)) {
      existing.authors.push(message.authorId);
    }
  }

  const clusters: CopyPasteCluster[] = [];
  for (const group of groups.values()) {
    if (group.authors.length >= minAccounts) {
      const authors = [...group.authors].sort((a, b) => a - b);
      clusters.push({ sample: group.sample, authors });
    }
  }

  clusters.sort((a, b) => {
    if (b.authors.length !== a.authors.length) {
      return b.authors.length - a.authors.length;
    }
    if (a.sample < b.sample) {
      return -1;
    }
    if (a.sample > b.sample) {
      return 1;
    }
    return 0;
  });

  return { matched: clusters.length > 0, clusters };
};

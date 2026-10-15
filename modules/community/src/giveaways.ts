import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type GiveawayCommand =
  | { readonly kind: "create"; readonly prize: string }
  | { readonly kind: "draw"; readonly giveawayId: string };

export interface GiveawayCommandError {
  readonly code: "prize-required" | "id-required";
  readonly usage: string;
}

export type GiveawayCommandResult =
  | { readonly ok: true; readonly command: GiveawayCommand }
  | { readonly ok: false; readonly error: GiveawayCommandError };

const giveawayCommandNames: ReadonlySet<string> = new Set([
  "giveaway",
  "gdraw",
]);

export const parseGiveawayCommand = (
  update: TelegramUpdateEnvelope,
): GiveawayCommandResult | null => {
  const name = update.command?.name;

  if (!name || !giveawayCommandNames.has(name)) {
    return null;
  }

  const args = update.command?.args ?? [];

  if (name === "gdraw") {
    const giveawayId = args[0];
    return giveawayId
      ? { ok: true, command: { kind: "draw", giveawayId } }
      : {
          ok: false,
          error: { code: "id-required", usage: "Uso: /gdraw <giveaway_id>" },
        };
  }

  const prize = args.join(" ").trim();
  return prize
    ? { ok: true, command: { kind: "create", prize } }
    : {
        ok: false,
        error: { code: "prize-required", usage: "Uso: /giveaway <premio>" },
      };
};

export const parseGiveawayJoin = (
  callbackData: string | undefined,
): string | null => {
  if (!callbackData?.startsWith("giveaway:")) {
    return null;
  }

  const id = callbackData.slice("giveaway:".length);
  return id.length > 0 ? id : null;
};

/**
 * Deterministic 32-bit hash (FNV-1a) of a string. Used so a giveaway winner is
 * fully reproducible from the announced seed and the sorted participant list.
 */
export const hashSeed = (seed: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/**
 * Picks a verifiable winner: participants are sorted ascending, then the index is
 * `hashSeed(seed) % count`. Anyone with the seed and participant list can verify.
 */
export const pickWinner = (
  participants: readonly bigint[],
  seed: string,
): bigint | null => {
  if (participants.length === 0) {
    return null;
  }

  const sorted = [...participants].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const index = hashSeed(seed) % sorted.length;
  return sorted[index] ?? null;
};

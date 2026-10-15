/**
 * Picking a cat or a dog without repeating yourself.
 *
 * The security posture is the whole design (report §8.4, §16.3): `/gato` and
 * `/perro` never fetch a URL. They pick from a curated library whose every row
 * carries a source and a licence, and the only thing that ever reaches Telegram
 * is either a `file_id` this bot uploaded before or bytes the bot already has.
 * There is no code path in this module that takes a URL from anywhere.
 */

import type { RandomSource } from "./ports.js";

export const FUN_MEDIA_KINDS = ["cat", "dog"] as const;
export type FunMediaKind = (typeof FUN_MEDIA_KINDS)[number];

/**
 * A library entry.
 *
 * `licence` and `source` are not optional. An asset with no recorded provenance
 * cannot be served, which is enforced by `isServable` rather than by everyone
 * remembering.
 */
export interface FunMediaAsset {
  readonly id: string;
  readonly kind: FunMediaKind;
  readonly source: string;
  readonly licence: string;
  readonly attribution: string | null;
  readonly active: boolean;
  /** Reviewed for the whole-audience rule. Anything else is not served. */
  readonly safetyStatus: "approved" | "pending" | "rejected";
}

/** How many recent sends a group remembers, to avoid repeats (report §8.3). */
export const EXCLUSION_WINDOW = 20;

export const isServable = (asset: FunMediaAsset): boolean =>
  asset.active &&
  asset.safetyStatus === "approved" &&
  asset.source.trim().length > 0 &&
  asset.licence.trim().length > 0;

export type PickResult =
  | {
      readonly ok: true;
      readonly asset: FunMediaAsset;
      readonly repeated: boolean;
    }
  | { readonly ok: false; readonly reason: "empty-library" };

/**
 * Chooses an asset this group has not seen lately.
 *
 * When every servable asset is already in the exclusion window — a small
 * library, or a very chatty group — it falls back to the full set and says so
 * via `repeated`, instead of refusing. Refusing would make a five-image library
 * stop working after five uses, which is worse than a repeat.
 */
export const pickAsset = (
  library: readonly FunMediaAsset[],
  kind: FunMediaKind,
  recentlySent: readonly string[],
  random: RandomSource,
): PickResult => {
  const servable = library.filter(
    (asset) => asset.kind === kind && isServable(asset),
  );
  if (servable.length === 0) {
    return { ok: false, reason: "empty-library" };
  }

  const excluded = new Set(recentlySent.slice(-EXCLUSION_WINDOW));
  const fresh = servable.filter((asset) => !excluded.has(asset.id));
  const pool = fresh.length > 0 ? fresh : servable;
  const chosen = pool[random.int(0, pool.length)] ?? pool[0];

  return {
    ok: true,
    asset: chosen as FunMediaAsset,
    repeated: fresh.length === 0,
  };
};

/**
 * Rolls the exclusion window forward.
 *
 * Kept pure and separate from picking so the caller decides when a send counted
 * — a Telegram call that failed must not push an unseen asset out of the
 * window.
 */
export const rememberSent = (
  recentlySent: readonly string[],
  assetId: string,
): readonly string[] =>
  [...recentlySent.filter((id) => id !== assetId), assetId].slice(
    -EXCLUSION_WINDOW,
  );

/** Spanish label for the empty-library message. */
export const kindLabel = (kind: FunMediaKind): string =>
  kind === "cat" ? "gatos" : "perros";

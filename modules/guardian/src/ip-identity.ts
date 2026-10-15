/**
 * "Is this the same connection as someone else's?" — the multi-account signal
 * STAFF asked for. Pure and total: no I/O, no throwing.
 *
 * This is deliberately a SIGNAL, never a verdict. Sharing an IP does not mean
 * sharing a person:
 *  - Mobile carriers put hundreds of customers behind one public IP (CGNAT),
 *    so two strangers on the same network can collide.
 *  - Siblings, partners and flatmates legitimately share a home connection.
 * Everything here therefore produces something a human reads and judges, and
 * the wording distinguishes how strong the match actually is.
 */

/** How two verifications ended up on the same connection. */
export type IpMatchStrength =
  /** Byte-for-byte the same address. Strongest — but still not proof. */
  | "exact"
  /** Same IPv6 /64. A phone rotates its IPv6 within its own /64 (privacy
   * extensions), so exact matching would miss the same device an hour later.
   * The /64 is the household/subscriber, not the device. */
  | "network";

export interface IpIdentity {
  /** Grouping key — equal keys mean "same connection" at `strength`. */
  readonly key: string;
  readonly strength: IpMatchStrength;
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/u;

/**
 * The key two addresses must share to count as the same connection. IPv4 is
 * compared exactly. IPv6 collapses to its /64 prefix (the first four groups),
 * because the same phone hands out a different IPv6 within that /64 every few
 * hours — comparing the full address would never match the same person twice.
 *
 * Returns null for anything unparseable, so a malformed value simply never
 * matches rather than matching everything.
 */
export const ipIdentity = (
  ip: string | null | undefined,
): IpIdentity | null => {
  const value = ip?.trim().toLowerCase();
  if (!value) {
    return null;
  }
  if (IPV4.test(value)) {
    return { key: value, strength: "exact" };
  }
  if (!value.includes(":")) {
    return null;
  }
  // IPv6. Expand a "::" run just enough to know which groups are leading, then
  // keep the first four (the /64). An address that is already short (fewer than
  // four leading groups before "::") has no meaningful /64 to compare.
  const [head] = value.split("%"); // strip any zone id (fe80::1%eth0)
  if (!head) {
    return null;
  }
  const doubleColon = head.indexOf("::");
  const leading = (doubleColon >= 0 ? head.slice(0, doubleColon) : head)
    .split(":")
    .filter((group) => group.length > 0);
  if (leading.length >= 4) {
    return { key: leading.slice(0, 4).join(":"), strength: "network" };
  }
  // Fewer than four groups before "::" means the /64 itself contains zeroes;
  // pad so "2a02:9130::1" and "2a02:9130::2" still group together.
  if (doubleColon >= 0) {
    const padded = [...leading, "0", "0", "0", "0"].slice(0, 4);
    return { key: padded.join(":"), strength: "network" };
  }
  return null;
};

/** One earlier verification that shares a connection with the current one. */
export interface IpNeighbour {
  readonly telegramUserId: string;
  readonly displayName: string;
  readonly ip: string;
  readonly lastSeen: Date;
}

export interface IpMatch extends IpNeighbour {
  readonly strength: IpMatchStrength;
}

/**
 * Other PEOPLE (never the same person as themselves) whose verification came
 * from the same connection as `ip`. One entry per person, keeping their most
 * recent sighting. Sorted most-recent-first so the STAFF line leads with the
 * freshest overlap.
 */
export const findIpMatches = (
  ip: string | null | undefined,
  selfTelegramUserId: string,
  others: readonly IpNeighbour[],
): IpMatch[] => {
  const self = ipIdentity(ip);
  if (!self) {
    return [];
  }
  const byUser = new Map<string, IpMatch>();
  for (const other of others) {
    if (other.telegramUserId === selfTelegramUserId) {
      continue;
    }
    const identity = ipIdentity(other.ip);
    if (!identity || identity.key !== self.key) {
      continue;
    }
    // An exact address match is worth more than a shared /64; when a person
    // shows up both ways, report the stronger one.
    const strength: IpMatchStrength =
      other.ip.trim().toLowerCase() === ip?.trim().toLowerCase()
        ? "exact"
        : identity.strength;
    const existing = byUser.get(other.telegramUserId);
    if (
      !existing ||
      other.lastSeen > existing.lastSeen ||
      (strength === "exact" && existing.strength !== "exact")
    ) {
      byUser.set(other.telegramUserId, { ...other, strength });
    }
  }
  return [...byUser.values()].sort(
    (a, b) => b.lastSeen.getTime() - a.lastSeen.getTime(),
  );
};

/**
 * The STAFF report line for a set of matches, or null when there are none (the
 * report simply omits the line rather than saying "no multi-account detected",
 * which would read as a guarantee this check cannot give).
 *
 * Names the people, says how strong the match is, and explicitly says it is not
 * proof — a reviewer who reads only this line should not come away thinking the
 * bot caught someone.
 */
export const formatIpMatchWarning = (
  matches: readonly IpMatch[],
): string | null => {
  if (matches.length === 0) {
    return null;
  }
  const shown = matches.slice(0, 4);
  const names = shown
    .map(
      (m) =>
        `${m.displayName}${m.strength === "network" ? " (misma red)" : ""}`,
    )
    .join(", ");
  const rest =
    matches.length > shown.length
      ? ` y ${matches.length - shown.length} más`
      : "";
  const anyExact = matches.some((m) => m.strength === "exact");
  return [
    `⚠️ POSIBLE MULTICUENTA: ${anyExact ? "misma IP" : "misma red"} que ${names}${rest}.`,
    "   (Ojo: el mismo WiFi o el mismo operador móvil dan la misma IP — confírmalo mirando las fotos.)",
  ].join("\n");
};

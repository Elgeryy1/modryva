import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Per-tenant registry of link domains ever seen in messages, tracking only
 * {domain, firstSeenAt}. Exists to compute the `seenBefore` flag that
 * modules/security/src/shortener-quarantine.ts's `classifyDomain` /
 * `buildShortenerSignal` need: a domain the group has never seen before goes
 * into quarantine even if it isn't a known shortener. All judgement (allow vs
 * quarantine) stays in the pure shortener-quarantine module; this repository
 * only remembers "have we seen this domain for this tenant before".
 *
 * NOTE: the backing `DomainReputation` Prisma model does not exist in
 * schema.prisma yet (see prismaModelSnippet returned alongside this file) —
 * schema.prisma is a shared file this task must not edit directly. The
 * Prisma-backed class below talks to the client through a small local
 * `DomainReputationClient` shape (cast, not the generated delegate type) so
 * this file typechecks today; once the model is added to schema.prisma and
 * `prisma generate` runs, the same code will call the real generated
 * delegate at runtime without any changes here.
 */

export interface DomainReputationRepository {
  /**
   * True when this domain (normalized: trimmed, lowercased, "www." and
   * trailing dots stripped) has already been recorded for this tenant at
   * some point before now.
   */
  hasSeenDomain(tenantId: string, domain: string): Promise<boolean>;
  /**
   * Records the domain as seen for this tenant if it isn't already recorded.
   * First-seen wins: an existing `firstSeenAt` is never overwritten by a
   * later call. A no-op for an empty/unparseable domain.
   */
  recordDomainSeen(tenantId: string, domain: string): Promise<void>;
}

/**
 * Normalizes a domain for comparison: trims, lowercases and strips a leading
 * "www." and any trailing dots. Mirrors
 * modules/security/src/shortener-quarantine.ts's `normalizeDomain` (kept as
 * its own tiny copy here rather than a new cross-package dependency, same as
 * that module keeps its own copy independent of packages/data).
 */
const normalizeDomain = (domain: string): string => {
  let value = domain.trim().toLowerCase();
  while (value.startsWith("www.")) {
    value = value.slice(4);
  }
  while (value.endsWith(".")) {
    value = value.slice(0, -1);
  }
  return value;
};

/**
 * Minimal shape of the future generated `DomainReputation` Prisma delegate
 * this repository needs. See the NOTE above: used via a cast until the real
 * model lands in schema.prisma, at which point the generated delegate
 * satisfies this shape exactly.
 */
interface DomainReputationClient {
  domainReputation: {
    findUnique(args: {
      where: { tenantId_domain: { tenantId: string; domain: string } };
    }): Promise<{ id: string } | null>;
    upsert(args: {
      where: { tenantId_domain: { tenantId: string; domain: string } };
      create: { tenantId: string; domain: string };
      update: Record<string, never>;
    }): Promise<unknown>;
  };
}

export class PrismaDomainReputationRepository
  implements DomainReputationRepository
{
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  private get db(): DomainReputationClient {
    return this.client as unknown as DomainReputationClient;
  }

  async hasSeenDomain(tenantId: string, domain: string): Promise<boolean> {
    const value = normalizeDomain(domain);
    if (value.length === 0) {
      return false;
    }
    const row = await this.db.domainReputation.findUnique({
      where: { tenantId_domain: { tenantId, domain: value } },
    });
    return row !== null;
  }

  async recordDomainSeen(tenantId: string, domain: string): Promise<void> {
    const value = normalizeDomain(domain);
    if (value.length === 0) {
      return;
    }
    await this.db.domainReputation.upsert({
      where: { tenantId_domain: { tenantId, domain: value } },
      create: { tenantId, domain: value },
      update: {},
    });
  }
}

/** Store en memoria usado como default del constructor (tests). */
export class InMemoryDomainReputationRepository
  implements DomainReputationRepository
{
  private readonly firstSeenAt = new Map<string, Date>();

  private keyFor(tenantId: string, domain: string): string {
    return `${tenantId} ${domain}`;
  }

  async hasSeenDomain(tenantId: string, domain: string): Promise<boolean> {
    const value = normalizeDomain(domain);
    if (value.length === 0) {
      return false;
    }
    return this.firstSeenAt.has(this.keyFor(tenantId, value));
  }

  async recordDomainSeen(tenantId: string, domain: string): Promise<void> {
    const value = normalizeDomain(domain);
    if (value.length === 0) {
      return;
    }
    const key = this.keyFor(tenantId, value);
    if (!this.firstSeenAt.has(key)) {
      this.firstSeenAt.set(key, new Date());
    }
  }
}

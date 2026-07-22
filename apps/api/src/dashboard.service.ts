import { prisma as defaultPrisma, type PrismaClient } from "@superbot/data";
import type { DashboardCounts } from "@superbot/shared";

export interface DashboardCountsProvider {
  counts(tenantId: string | undefined): Promise<DashboardCounts>;
}

/**
 * Reads live counts from the database for the web dashboard. All queries are
 * tenant-scoped when a tenant id is provided so the panel never leaks data
 * across tenants.
 */
export class PrismaDashboardCountsProvider implements DashboardCountsProvider {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async counts(tenantId: string | undefined): Promise<DashboardCounts> {
    const tenantFilter = tenantId ? { tenantId } : {};

    const [updates, auditEvents, activeSanctions, openTickets, scheduledPosts] =
      await Promise.all([
        this.client.updateInbox.count({ where: tenantFilter }),
        this.client.auditLog.count({ where: tenantFilter }),
        this.client.sanction.count({
          where: { ...tenantFilter, status: "active" },
        }),
        this.client.ticket.count({
          where: { ...tenantFilter, status: { not: "closed" } },
        }),
        this.client.scheduledPost.count({
          where: { ...tenantFilter, status: "pending" },
        }),
      ]);

    const aiUsage = await this.client.aiUsage.aggregate({
      where: tenantFilter,
      _sum: { tokensIn: true, tokensOut: true },
    });

    return {
      updates,
      auditEvents,
      activeSanctions,
      openTickets,
      scheduledPosts,
      aiTokens: (aiUsage._sum.tokensIn ?? 0) + (aiUsage._sum.tokensOut ?? 0),
    };
  }
}

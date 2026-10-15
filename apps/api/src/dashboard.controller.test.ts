import type { DashboardCounts } from "@superbot/shared";
import { describe, expect, it } from "vitest";
import { DashboardController } from "./dashboard.controller.js";
import type { DashboardCountsProvider } from "./dashboard.service.js";
import type { MiniappRequest } from "./miniapp/init-data.guard.js";

// initData verification now lives in InitDataGuard (covered by its own tests);
// here we only assert the controller scopes counts to the request bot's tenant.
class FakeProvider implements DashboardCountsProvider {
  lastTenant: string | undefined = "__unset__";
  async counts(tenantId: string | undefined): Promise<DashboardCounts> {
    this.lastTenant = tenantId;
    return {
      updates: 10,
      auditEvents: 25,
      activeSanctions: 2,
      openTickets: 3,
      scheduledPosts: 1,
      aiTokens: 500,
    };
  }
}

const makeReq = (botUsername: string): MiniappRequest => ({
  headers: {},
  miniapp: {
    userId: "42",
    user: { id: 42 },
    startParam: null,
    botUsername,
    botToken: "tok",
  },
});

// biome-ignore lint/suspicious/noExplicitAny: minimal PrismaClient stub
const clientWith = (tenantId: string | null, slugs: string[]): any => ({
  tenant: {
    findUnique: async ({ where }: { where: { slug: string } }) => {
      slugs.push(where.slug);
      return tenantId ? { id: tenantId } : null;
    },
  },
});

describe("DashboardController", () => {
  it("scopes counts to the request bot's tenant", async () => {
    const provider = new FakeProvider();
    const slugs: string[] = [];
    const controller = new DashboardController(
      provider,
      clientWith("t-child", slugs),
    );

    const result = await controller.dashboard(
      // biome-ignore lint/suspicious/noExplicitAny: request stub
      makeReq("super_71420320_bot") as any,
    );

    expect(result.cards).toHaveLength(6);
    expect(slugs).toContain("telegram-super_71420320_bot");
    expect(provider.lastTenant).toBe("t-child");
  });

  it("uses no tenant filter when the bot has no tenant row", async () => {
    const provider = new FakeProvider();
    const slugs: string[] = [];
    const controller = new DashboardController(
      provider,
      clientWith(null, slugs),
    );

    // biome-ignore lint/suspicious/noExplicitAny: request stub
    await controller.dashboard(makeReq("modryvabot") as any);

    expect(provider.lastTenant).toBeUndefined();
  });
});

import { Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { type PrismaClient, prisma } from "@superbot/data";
import { type DashboardData, summarizeDashboard } from "@superbot/shared";
import {
  type DashboardCountsProvider,
  PrismaDashboardCountsProvider,
} from "./dashboard.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./miniapp/init-data.guard.js";

@Controller("v1/dashboard")
@UseGuards(InitDataGuard)
export class DashboardController {
  constructor(
    private readonly provider: DashboardCountsProvider = new PrismaDashboardCountsProvider(),
    private readonly client: PrismaClient = prisma,
  ) {}

  @Post()
  @HttpCode(200)
  async dashboard(@Req() req: MiniappRequest): Promise<DashboardData> {
    // The guard verified the initData against the resolved bot's token and
    // attached its username. Scope the counts to that bot's tenant so a managed
    // child bot sees its own activity (and never another tenant's).
    const ctx = getMiniappContext(req);
    const botKey = ctx.botUsername.replace(/^@/u, "").toLowerCase();
    const tenant = await this.client.tenant.findUnique({
      where: { slug: `telegram-${botKey}` },
    });
    const counts = await this.provider.counts(tenant?.id);
    return summarizeDashboard(counts, new Date().toISOString());
  }
}

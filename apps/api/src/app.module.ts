import { Module } from "@nestjs/common";
import { BootstrapController } from "./bootstrap.controller.js";
import { CasinoController } from "./casino/casino.controller.js";
import { CasinoService } from "./casino/casino.service.js";
import { DashboardController } from "./dashboard.controller.js";
import { GamesController } from "./games/games.controller.js";
import { GamesService } from "./games/games.service.js";
import { GuardianDevController } from "./guardian/guardian-dev.controller.js";
import { GuardianVerifyController } from "./guardian/guardian-verify.controller.js";
import { createGuardianVerifyService } from "./guardian/guardian-verify.factory.js";
import { GuardianVerifyService } from "./guardian/guardian-verify.service.js";
import { HealthController } from "./health.controller.js";
import { InitDataController } from "./init-data.controller.js";
import { MiniappAdminService } from "./miniapp/admin.service.js";
import { AiPackController } from "./miniapp/ai-pack.controller.js";
import { MiniappAutomationController } from "./miniapp/automation.controller.js";
import { MiniappBackupController } from "./miniapp/backup.controller.js";
import { MiniappConfigController } from "./miniapp/config.controller.js";
import { MiniappEntitlementController } from "./miniapp/entitlement.controller.js";
import { MiniappFederationController } from "./miniapp/federation.controller.js";
import { MiniappGamificationController } from "./miniapp/gamification.controller.js";
import { GuardianConfigController } from "./miniapp/guardian-config.controller.js";
import { InitDataGuard } from "./miniapp/init-data.guard.js";
import { MiniappInsightsController } from "./miniapp/insights.controller.js";
import { MiniappListsController } from "./miniapp/lists.controller.js";
import { MiniappModerationInboxController } from "./miniapp/moderation-inbox.controller.js";
import { MiniappNetworkAnalyticsController } from "./miniapp/network-analytics.controller.js";
import { MiniappNetworkRiskController } from "./miniapp/network-risk.controller.js";
import { MiniappOwnerNetworkController } from "./miniapp/owner-network.controller.js";
import { MiniappPanelController } from "./miniapp/panel.controller.js";
import { MiniappStaffNotesController } from "./miniapp/staff-notes.controller.js";
import { MiniappTicketsController } from "./miniapp/tickets.controller.js";
import { MiniappUserPanelController } from "./miniapp/user-panel.controller.js";
import { MiniappWizardController } from "./miniapp/wizard.controller.js";
import { ObservabilityController } from "./observability.controller.js";
import { PlatformController } from "./platform.controller.js";

@Module({
  controllers: [
    BootstrapController,
    HealthController,
    InitDataController,
    DashboardController,
    MiniappConfigController,
    GuardianConfigController,
    GuardianVerifyController,
    GuardianDevController,
    MiniappListsController,
    MiniappFederationController,
    MiniappOwnerNetworkController,
    MiniappModerationInboxController,
    MiniappTicketsController,
    MiniappStaffNotesController,
    MiniappInsightsController,
    MiniappPanelController,
    MiniappWizardController,
    MiniappNetworkRiskController,
    MiniappNetworkAnalyticsController,
    MiniappGamificationController,
    MiniappUserPanelController,
    MiniappAutomationController,
    MiniappBackupController,
    MiniappEntitlementController,
    AiPackController,
    GamesController,
    CasinoController,
    ObservabilityController,
    PlatformController,
  ],
  providers: [
    InitDataGuard,
    MiniappAdminService,
    GamesService,
    CasinoService,
    {
      provide: GuardianVerifyService,
      useFactory: createGuardianVerifyService,
    },
  ],
})
export class ApiAppModule {}

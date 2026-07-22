import { Module } from "@nestjs/common";
import {
  PrismaAiAccessRepository,
  PrismaAiRepository,
  PrismaAnalyticsRepository,
  PrismaAntifloodRepository,
  PrismaAntiraidRepository,
  PrismaAutomationRepository,
  PrismaCaptchaRepository,
  PrismaChatActivityRepository,
  PrismaChatSettingRepository,
  PrismaChipRepository,
  PrismaContentLockRepository,
  PrismaCoopMissionRepository,
  PrismaCustomCommandRepository,
  PrismaD1Repository,
  PrismaEconomyRepository,
  PrismaFederationRepository,
  PrismaFeedbackRepository,
  PrismaFeedRepository,
  PrismaFileRepository,
  PrismaFiltersRepository,
  PrismaFoundationRepository,
  PrismaGameRepository,
  PrismaGamificationRepository,
  PrismaGiveawayRepository,
  PrismaGratitudeRepository,
  PrismaGroupProtectionRepository,
  PrismaGuardianRepository,
  PrismaIncidentRepository,
  PrismaInviteRepository,
  PrismaModerationExtraRepository,
  PrismaModerationRepository,
  PrismaNotesRepository,
  PrismaOwnerNetworkRepository,
  PrismaOwnerNetworkRiskRepository,
  PrismaPaymentRepository,
  PrismaPlatformRepository,
  PrismaPollRepository,
  PrismaProductivityRepository,
  PrismaReputationRepository,
  PrismaScheduledPostRepository,
  PrismaStaffNoteRepository,
  PrismaTicketRepository,
  PrismaWebhookRepository,
  PrismaWelcomeRepository,
} from "@superbot/data";
import { buildAiProviderFromEnv } from "@superbot/module-ai";
import { InMemoryFloodCounter } from "@superbot/module-security";
import { getRuntimeEnv } from "@superbot/shared";
import {
  HttpQuoteRenderer,
  HttpSpamCheckProvider,
  HttpTelegramGateway,
} from "@superbot/telegram";
import { BotUpdateService } from "./bot-update.service.js";
import { HealthController } from "./health.controller.js";
import { TelegramWebhookController } from "./telegram-webhook.controller.js";
import {
  AI_ACCESS_REPOSITORY,
  AI_PROVIDER,
  AI_REPOSITORY,
  ANALYTICS_REPOSITORY,
  ANTIFLOOD_REPOSITORY,
  ANTIRAID_REPOSITORY,
  AUTOMATION_REPOSITORY,
  CAPTCHA_REPOSITORY,
  CHAT_ACTIVITY_REPOSITORY,
  CHAT_SETTING_REPOSITORY,
  CHIP_REPOSITORY,
  CONTENT_LOCK_REPOSITORY,
  COOP_MISSION_REPOSITORY,
  CUSTOM_COMMAND_REPOSITORY,
  D1_REPOSITORY,
  ECONOMY_REPOSITORY,
  FEDERATION_REPOSITORY,
  FEED_REPOSITORY,
  FEEDBACK_REPOSITORY,
  FILE_REPOSITORY,
  FILTERS_REPOSITORY,
  FLOOD_COUNTER,
  FOUNDATION_REPOSITORY,
  GAME_REPOSITORY,
  GAMIFICATION_REPOSITORY,
  GIVEAWAY_REPOSITORY,
  GRATITUDE_REPOSITORY,
  GROUP_PROTECTION_REPOSITORY,
  GUARDIAN_REPOSITORY,
  INCIDENT_REPOSITORY,
  INVITE_REPOSITORY,
  MODERATION_EXTRA_REPOSITORY,
  MODERATION_REPOSITORY,
  NOTES_REPOSITORY,
  OWNER_NETWORK_REPOSITORY,
  OWNER_NETWORK_RISK_REPOSITORY,
  PAYMENT_REPOSITORY,
  PLATFORM_REPOSITORY,
  POLL_REPOSITORY,
  PRODUCTIVITY_REPOSITORY,
  QUOTE_RENDERER,
  REPUTATION_REPOSITORY,
  RUNTIME_ENV,
  SCHEDULED_POST_REPOSITORY,
  SPAM_CHECK_PROVIDER,
  STAFF_NOTE_REPOSITORY,
  TELEGRAM_GATEWAY,
  TICKET_REPOSITORY,
  WEBHOOK_REPOSITORY,
  WELCOME_REPOSITORY,
} from "./tokens.js";

@Module({
  controllers: [HealthController, TelegramWebhookController],
  providers: [
    BotUpdateService,
    {
      provide: RUNTIME_ENV,
      useFactory: () => getRuntimeEnv(),
    },
    {
      provide: FOUNDATION_REPOSITORY,
      useFactory: () => new PrismaFoundationRepository(),
    },
    {
      provide: MODERATION_REPOSITORY,
      useFactory: () => new PrismaModerationRepository(),
    },
    {
      provide: MODERATION_EXTRA_REPOSITORY,
      useFactory: () => new PrismaModerationExtraRepository(),
    },
    {
      provide: WEBHOOK_REPOSITORY,
      useFactory: () => new PrismaWebhookRepository(),
    },
    {
      provide: CUSTOM_COMMAND_REPOSITORY,
      useFactory: () => new PrismaCustomCommandRepository(),
    },
    {
      provide: D1_REPOSITORY,
      useFactory: () => new PrismaD1Repository(),
    },
    {
      provide: OWNER_NETWORK_REPOSITORY,
      useFactory: () => new PrismaOwnerNetworkRepository(),
    },
    {
      provide: ANTIFLOOD_REPOSITORY,
      useFactory: () => new PrismaAntifloodRepository(),
    },
    {
      provide: CAPTCHA_REPOSITORY,
      useFactory: () => new PrismaCaptchaRepository(),
    },
    {
      provide: CONTENT_LOCK_REPOSITORY,
      useFactory: () => new PrismaContentLockRepository(),
    },
    {
      provide: ANTIRAID_REPOSITORY,
      useFactory: () => new PrismaAntiraidRepository(),
    },
    {
      provide: NOTES_REPOSITORY,
      useFactory: () => new PrismaNotesRepository(),
    },
    {
      provide: FILTERS_REPOSITORY,
      useFactory: () => new PrismaFiltersRepository(),
    },
    {
      provide: WELCOME_REPOSITORY,
      useFactory: () => new PrismaWelcomeRepository(),
    },
    {
      provide: REPUTATION_REPOSITORY,
      useFactory: () => new PrismaReputationRepository(),
    },
    {
      provide: INVITE_REPOSITORY,
      useFactory: () => new PrismaInviteRepository(),
    },
    {
      provide: ANALYTICS_REPOSITORY,
      useFactory: () => new PrismaAnalyticsRepository(),
    },
    {
      provide: POLL_REPOSITORY,
      useFactory: () => new PrismaPollRepository(),
    },
    {
      provide: GIVEAWAY_REPOSITORY,
      useFactory: () => new PrismaGiveawayRepository(),
    },
    {
      provide: SCHEDULED_POST_REPOSITORY,
      useFactory: () => new PrismaScheduledPostRepository(),
    },
    {
      provide: TICKET_REPOSITORY,
      useFactory: () => new PrismaTicketRepository(),
    },
    {
      provide: PRODUCTIVITY_REPOSITORY,
      useFactory: () => new PrismaProductivityRepository(),
    },
    {
      provide: FEED_REPOSITORY,
      useFactory: () => new PrismaFeedRepository(),
    },
    {
      provide: FILE_REPOSITORY,
      useFactory: () => new PrismaFileRepository(),
    },
    {
      provide: GAME_REPOSITORY,
      useFactory: () => new PrismaGameRepository(),
    },
    {
      provide: CHIP_REPOSITORY,
      useFactory: () => new PrismaChipRepository(),
    },
    {
      provide: AI_REPOSITORY,
      useFactory: () => new PrismaAiRepository(),
    },
    {
      provide: AI_PROVIDER,
      useFactory: () => buildAiProviderFromEnv(getRuntimeEnv()),
    },
    {
      provide: PAYMENT_REPOSITORY,
      useFactory: () => new PrismaPaymentRepository(),
    },
    {
      provide: PLATFORM_REPOSITORY,
      useFactory: () =>
        new PrismaPlatformRepository(
          undefined,
          getRuntimeEnv().MANAGED_BOT_TOKEN_KEY,
        ),
    },
    {
      provide: FLOOD_COUNTER,
      useFactory: () => new InMemoryFloodCounter(),
    },
    {
      provide: GROUP_PROTECTION_REPOSITORY,
      useFactory: () => new PrismaGroupProtectionRepository(),
    },
    {
      // Endpoint overridable via QUOTE_API_URL in case the public quote-api
      // moves again (it migrated from bot.lyo.su to quote.yuri.ly).
      provide: QUOTE_RENDERER,
      useFactory: () =>
        new HttpQuoteRenderer(process.env.QUOTE_API_URL || undefined),
    },
    {
      provide: SPAM_CHECK_PROVIDER,
      useFactory: () => new HttpSpamCheckProvider(),
    },
    {
      provide: FEDERATION_REPOSITORY,
      useFactory: () => new PrismaFederationRepository(),
    },
    {
      provide: FEEDBACK_REPOSITORY,
      useFactory: () => new PrismaFeedbackRepository(),
    },
    {
      provide: STAFF_NOTE_REPOSITORY,
      useFactory: () => new PrismaStaffNoteRepository(),
    },
    {
      provide: ECONOMY_REPOSITORY,
      useFactory: () => new PrismaEconomyRepository(),
    },
    {
      provide: INCIDENT_REPOSITORY,
      useFactory: () => new PrismaIncidentRepository(),
    },
    {
      provide: COOP_MISSION_REPOSITORY,
      useFactory: () => new PrismaCoopMissionRepository(),
    },
    {
      provide: GRATITUDE_REPOSITORY,
      useFactory: () => new PrismaGratitudeRepository(),
    },
    {
      provide: TELEGRAM_GATEWAY,
      useFactory: () => new HttpTelegramGateway(),
    },
    {
      provide: OWNER_NETWORK_RISK_REPOSITORY,
      useFactory: () => new PrismaOwnerNetworkRiskRepository(),
    },
    {
      provide: GAMIFICATION_REPOSITORY,
      useFactory: () => new PrismaGamificationRepository(),
    },
    {
      provide: AUTOMATION_REPOSITORY,
      useFactory: () => new PrismaAutomationRepository(),
    },
    {
      provide: AI_ACCESS_REPOSITORY,
      useFactory: () => new PrismaAiAccessRepository(),
    },
    {
      provide: CHAT_ACTIVITY_REPOSITORY,
      useFactory: () => new PrismaChatActivityRepository(),
    },
    {
      provide: CHAT_SETTING_REPOSITORY,
      useFactory: () => new PrismaChatSettingRepository(),
    },
    {
      provide: GUARDIAN_REPOSITORY,
      useFactory: () => new PrismaGuardianRepository(),
    },
  ],
})
export class BotAppModule {}

import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  ServiceUnavailableException,
} from "@nestjs/common";
import { getRuntimeEnv } from "@superbot/shared";
import { verifyTelegramInitData } from "./telegram-init-data.js";

@Controller("v1/init-data")
export class InitDataController {
  @Post("verify")
  @HttpCode(200)
  verify(@Body() body: { initData?: string }) {
    if (!body?.initData) {
      throw new BadRequestException({ ok: false, error: "missing-init-data" });
    }

    const env = getRuntimeEnv();

    if (!env.TELEGRAM_BOT_TOKEN) {
      throw new ServiceUnavailableException({
        ok: false,
        error: "missing-bot-token",
      });
    }

    // Enforce auth_date freshness like InitDataGuard does. Without maxAgeSeconds,
    // verifyTelegramInitData only checks the HMAC, so a captured initData string
    // stays valid forever through this endpoint (a replay window the guarded Mini
    // App routes don't have).
    return verifyTelegramInitData(body.initData, env.TELEGRAM_BOT_TOKEN, {
      maxAgeSeconds: env.INITDATA_MAX_AGE_SECONDS,
      now: Math.floor(Date.now() / 1000),
    });
  }
}

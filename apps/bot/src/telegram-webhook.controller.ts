import crypto from "node:crypto";
import {
  Body,
  Controller,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import {
  InMemoryPlatformRepository,
  type PlatformRepository,
} from "@superbot/data";
import type { RuntimeEnv } from "@superbot/shared";
import { BotUpdateService } from "./bot-update.service.js";
import { PLATFORM_REPOSITORY, RUNTIME_ENV } from "./tokens.js";

// Constant-time secret comparison: hashing both sides to a fixed 32-byte digest
// lets timingSafeEqual run regardless of input length and leaks neither the
// length nor the position of a byte mismatch (unlike a short-circuiting `!==`).
const timingSafeStrEqual = (a: string | undefined, b: string): boolean => {
  if (a === undefined) {
    return false;
  }
  const left = crypto.createHash("sha256").update(a).digest();
  const right = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(left, right);
};

@Controller("telegram/webhook/:botUsername")
export class TelegramWebhookController {
  constructor(
    @Inject(BotUpdateService)
    private readonly updates: BotUpdateService,
    @Inject(RUNTIME_ENV) private readonly env: RuntimeEnv,
    @Inject(PLATFORM_REPOSITORY)
    private readonly platform: PlatformRepository = new InMemoryPlatformRepository(),
  ) {}

  @Post()
  async handleWebhook(
    @Param("botUsername") botUsername: string,
    @Body() body: unknown,
    @Headers("x-telegram-bot-api-secret-token") secretToken: string | undefined,
  ) {
    const managedSecret = await this.platform.verifyWebhookSecret(
      botUsername,
      secretToken,
    );

    if (managedSecret === false) {
      throw new UnauthorizedException({
        ok: false,
        error: "invalid-secret-token",
      });
    }

    if (
      managedSecret === null &&
      this.env.TELEGRAM_WEBHOOK_SECRET &&
      !timingSafeStrEqual(secretToken, this.env.TELEGRAM_WEBHOOK_SECRET)
    ) {
      throw new UnauthorizedException({
        ok: false,
        error: "invalid-secret-token",
      });
    }

    if (
      managedSecret === null &&
      !this.env.TELEGRAM_WEBHOOK_SECRET &&
      this.env.NODE_ENV === "production"
    ) {
      throw new UnauthorizedException({
        ok: false,
        error: "missing-secret-token",
      });
    }

    return this.updates.processWebhook(botUsername, body);
  }

  @Post("simulate")
  async simulate(
    @Param("botUsername") botUsername: string,
    @Body() body: unknown,
  ) {
    // A dry-run test helper — never expose it on a public production surface.
    if (this.env.NODE_ENV === "production") {
      throw new NotFoundException({ ok: false, error: "not-found" });
    }
    return this.updates.simulate(botUsername, body);
  }
}

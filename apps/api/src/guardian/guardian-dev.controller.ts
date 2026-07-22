import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Post,
} from "@nestjs/common";
import { PrismaGuardianRepository } from "@superbot/data";
import {
  computeSessionIdempotencyKey,
  generateChallenge,
  generateChallengeNonce,
  generateSessionToken,
  hashSessionToken,
} from "@superbot/module-guardian";
import { getRuntimeEnv } from "@superbot/shared";

/**
 * DEV-ONLY test-session bootstrap for Guardian Verification — lets Playwright/
 * E2E tests mint a real session (and its settings row) WITHOUT a real
 * Telegram bot, chat, or join request. Every code path here is gated behind
 * the SAME env checks guardian-doctor.mjs and GuardianSessionGuard's test
 * bypass independently enforce: GUARDIAN_TEST_MODE=1 AND NODE_ENV is never
 * "production". This route 404s (not 403 — its existence isn't even implied)
 * the instant either condition is false, so a misconfigured production
 * deployment can't reach it no matter what.
 *
 * `chatId`/`tenantId` are free-form strings here on purpose — Guardian's
 * satellite tables (VerificationSession, GuardianVerificationSettings) never
 * enforce a foreign key to a real Chat/Tenant row (see the repository's loose-
 * coupling convention), so a fully self-contained test session needs no
 * separate chat/tenant seeding step.
 */

interface CreateTestSessionBody {
  readonly tenantId?: string;
  readonly chatId?: string;
  readonly telegramChatId?: string;
  readonly telegramUserId?: string;
  readonly mode?: "manual" | "assisted" | "auto" | "strict";
  readonly challengeDifficulty?: "basic" | "normal" | "strict";
  readonly maxAttempts?: number;
}

const assertTestModeAllowed = (): void => {
  const env = getRuntimeEnv();
  if (!env.GUARDIAN_TEST_MODE || process.env.NODE_ENV === "production") {
    // Deliberately identical to "route doesn't exist" — never confirm or
    // deny the harness's presence to an unauthenticated caller.
    throw new NotFoundException();
  }
};

@Controller("v1/guardian/dev")
export class GuardianDevController {
  private readonly guardian = new PrismaGuardianRepository();

  @Post("sessions")
  async createTestSession(@Body() body: CreateTestSessionBody) {
    assertTestModeAllowed();

    if (!body?.chatId || !body.telegramChatId || !body.telegramUserId) {
      throw new BadRequestException({
        error: "missing-required-fields",
        required: ["chatId", "telegramChatId", "telegramUserId"],
      });
    }

    const tenantId = body.tenantId ?? `test-tenant-${body.chatId}`;
    const mode = body.mode ?? "auto";
    const challengeDifficulty = body.challengeDifficulty ?? "normal";

    const settings = await this.guardian.upsertSettings(tenantId, body.chatId, {
      enabled: true,
      mode,
      challengeDifficulty,
      maxAttempts: body.maxAttempts ?? 3,
      sessionTtlSeconds: 600,
    });

    const nonce = generateChallengeNonce();
    const seed = Math.floor(Math.random() * 2 ** 31);
    const challenge = generateChallenge(
      settings.challengeDifficulty,
      seed,
      nonce,
    );
    const token = generateSessionToken();
    const telegramUserId = BigInt(body.telegramUserId);
    const expiresAt = new Date(Date.now() + settings.sessionTtlSeconds * 1000);

    const session = await this.guardian.createSession({
      tenantId,
      chatId: body.chatId,
      telegramChatId: BigInt(body.telegramChatId),
      telegramUserId,
      mode: settings.mode,
      challengeDefinition: challenge as unknown as Record<string, unknown>,
      challengeNonce: nonce,
      sessionTokenHash: hashSessionToken(token),
      expiresAt,
      idempotencyKey: computeSessionIdempotencyKey(body.chatId, telegramUserId),
    });

    if (!session) {
      throw new BadRequestException({
        error: "active-session-already-exists",
      });
    }

    return {
      sessionToken: token,
      sessionId: session.id,
      telegramUserId: telegramUserId.toString(),
      expiresAtIso: expiresAt.toISOString(),
    };
  }
}

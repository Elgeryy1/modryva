import { Body, Controller, Post } from "@nestjs/common";
import {
  PrismaFoundationRepository,
  PrismaGuardianRepository,
} from "@superbot/data";
import { hashSessionToken } from "@superbot/module-guardian";
import { createRateLimiter } from "@superbot/shared";

/**
 * Records that the verification PAGE was served — the one fact the funnel was
 * missing.
 *
 * `progressStep` already separates "opened the Mini App" (the app's first API
 * call) from everything after it. What it could not separate was the two very
 * different failures that both land on step 0: someone who never tapped the
 * button, and someone who tapped it and got a page that never finished
 * loading. On 2 Aug 2026 that was 15 of 52 sessions with no way to tell which.
 *
 * The page is server-rendered by the web app, so this ping happens BEFORE any
 * client JavaScript runs — which is precisely why it survives the failure it
 * exists to detect.
 *
 * Deliberately NOT behind GuardianSessionGuard: that guard requires Telegram
 * initData, which only exists inside the browser, and the caller here is the
 * web server. The opaque session token is the whole credential. That is
 * acceptable ONLY because this endpoint is write-only and says nothing back:
 * someone holding a stolen token can write one audit row, and they already
 * held the credential that matters. It grants nothing, reveals nothing, and
 * can never move a session forward.
 */
@Controller("v1/guardian")
export class GuardianPageViewController {
  private readonly guardian = new PrismaGuardianRepository();
  private readonly foundation = new PrismaFoundationRepository();

  // A page view is one per person per tap. This is generous for a human and
  // still bounds anyone replaying a token they stole.
  private readonly limiter = createRateLimiter({
    capacity: 10,
    refillPerSec: 1,
  });

  @Post("page-view")
  async record(@Body() body: { session?: string }) {
    const token = body?.session;
    // Always answers ok. A telemetry endpoint that reports "no such session"
    // would let anyone probe which tokens are real, and a failure here must
    // never be visible to the person trying to verify.
    if (!token || typeof token !== "string") {
      return { ok: true };
    }

    const hash = hashSessionToken(token);
    if (!this.limiter.tryConsume(hash)) {
      return { ok: true };
    }

    const session = await this.guardian
      .findSessionByTokenHash(hash)
      .catch(() => null);
    if (!session) {
      return { ok: true };
    }

    await this.foundation
      .recordAudit({
        tenantId: session.tenantId,
        actorType: "system",
        action: "guardian.page.served",
        resourceType: "verification_session",
        resourceId: session.id,
        payload: {
          telegramUserId: session.telegramUserId.toString(),
          chatId: session.chatId,
        },
      })
      .catch(() => {
        // Telemetry is never worth failing a page render for.
      });

    return { ok: true };
  }
}

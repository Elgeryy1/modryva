import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  PrismaGuardianRepository,
  type VerificationSessionRecord,
} from "@superbot/data";
import { hashSessionToken } from "@superbot/module-guardian";
import { createRateLimiter, getRuntimeEnv } from "@superbot/shared";
import { verifyTelegramInitData } from "../telegram-init-data.js";

const ACTIVE_STATUSES: readonly string[] = [
  "pending",
  "miniapp_opened",
  "capturing",
  "analyzing",
  "awaiting_retry",
];

// Same rationale as InitDataGuard: the api only ever sees the proxy's IP, so
// server.ts's global limiter can't isolate one Telegram user's Guardian
// attempts from another's. Key on the session's DB-verified telegramUserId —
// reachable only once a session lookup has already succeeded, so an attacker
// without the raw session token never reaches this check at all.
const USER_RATE_CAPACITY = 20;
const USER_RATE_REFILL_PER_SEC = 5;

export interface GuardianVerifiedContext {
  readonly session: VerificationSessionRecord;
  /** True when initData's user matches the session's Telegram user — a
   * mismatch is recorded as a session-integrity violation upstream, never
   * silently ignored. */
  readonly userMatches: boolean;
  readonly telegramUserId: bigint;
}

export interface GuardianRequest {
  headers: Record<string, string | string[] | undefined>;
  guardian?: GuardianVerifiedContext;
}

export const headerValue = (
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined => {
  const raw = headers[name];
  return Array.isArray(raw) ? raw[0] : raw;
};

/** Both must independently be true for the dev-only initData bypass below to
 * activate at all — an env flag alone is not enough, so a test-mode-enabled
 * production deployment still can't be tricked by just adding a header. */
const testBypassAllowed = (): boolean =>
  getRuntimeEnv().GUARDIAN_TEST_MODE && process.env.NODE_ENV !== "production";

/**
 * Authenticates Guardian Verification Mini App requests. Two independent
 * proofs are required, matching rule 6 of the spec:
 *   1. `X-Guardian-Session: <opaque token>` — resolves to a live session by
 *      its SHA-256 hash (the raw token is never persisted or logged).
 *   2. `Authorization: tma <initData>` — the standard Telegram Mini App HMAC
 *      proof, verified against the TOKEN OF THE BOT THAT ACTUALLY OWNS this
 *      session's tenant (resolved server-side, never trusted from a header).
 * The two are then cross-checked: initData's user.id must equal the
 * session's telegramUserId, or the request is flagged (not silently trusted)
 * so the decision engine can route it as an integrity violation.
 *
 * DEV-ONLY TEST BYPASS (Playwright/E2E, never usable in production): when
 * GUARDIAN_TEST_MODE=1 AND NODE_ENV!=="production" AND the request sends
 * `X-Guardian-Test-Bypass: 1` (an explicit third signal — ambient env state
 * alone is never enough), proof #2 becomes "send
 * `X-Guardian-Test-User: <telegramUserId>` matching the session's real
 * user" instead of a real signed initData blob, since fabricating one
 * requires the real bot token this project must never touch in this phase.
 * `scripts/guardian-doctor.mjs` and this same env check both independently
 * fail hard if GUARDIAN_TEST_MODE is ever 1 in production.
 */
@Injectable()
export class GuardianSessionGuard implements CanActivate {
  private readonly guardian = new PrismaGuardianRepository();
  private readonly perUser = createRateLimiter({
    capacity: USER_RATE_CAPACITY,
    refillPerSec: USER_RATE_REFILL_PER_SEC,
  });

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuardianRequest>();

    const sessionToken = headerValue(request.headers, "x-guardian-session");
    if (!sessionToken) {
      throw new UnauthorizedException({ error: "missing-session-token" });
    }

    const session = await this.guardian.findSessionByTokenHash(
      hashSessionToken(sessionToken),
    );
    if (!session) {
      throw new NotFoundException({ error: "session-not-found" });
    }
    if (!ACTIVE_STATUSES.includes(session.status)) {
      throw new GoneException({
        error: "session-not-active",
        status: session.status,
      });
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new GoneException({ error: "session-expired" });
    }
    if (!this.perUser.tryConsume(`user:${session.telegramUserId}`)) {
      throw new HttpException(
        { error: "rate-limited" },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const testBypass =
      headerValue(request.headers, "x-guardian-test-bypass") === "1" &&
      testBypassAllowed();
    if (testBypass) {
      const testUser = headerValue(request.headers, "x-guardian-test-user");
      if (!testUser) {
        throw new UnauthorizedException({ error: "missing-test-user" });
      }
      const telegramUserId = BigInt(testUser);
      if (telegramUserId !== session.telegramUserId) {
        throw new ForbiddenException({ error: "session-user-mismatch" });
      }
      request.guardian = { session, userMatches: true, telegramUserId };
      return true;
    }

    const rawAuth = headerValue(request.headers, "authorization");
    const spaceIndex = rawAuth?.indexOf(" ") ?? -1;
    const scheme = spaceIndex >= 0 ? rawAuth?.slice(0, spaceIndex) : rawAuth;
    const initData = spaceIndex >= 0 ? rawAuth?.slice(spaceIndex + 1) : "";
    if (!rawAuth || scheme?.toLowerCase() !== "tma" || !initData) {
      throw new UnauthorizedException({ error: "missing-auth" });
    }

    const env = getRuntimeEnv();
    let botToken: string | undefined;
    try {
      botToken = await this.guardian.resolveBotTokenForTenant(
        session.tenantId,
        env.TELEGRAM_BOT_TOKEN,
        env.MANAGED_BOT_TOKEN_KEY,
      );
    } catch {
      throw new ServiceUnavailableException({ error: "bot-token-unavailable" });
    }
    if (!botToken) {
      throw new ServiceUnavailableException({ error: "bot-token-unavailable" });
    }

    const verification = verifyTelegramInitData(initData, botToken, {
      maxAgeSeconds: env.INITDATA_MAX_AGE_SECONDS,
      now: Math.floor(Date.now() / 1000),
    });
    if (!verification.ok) {
      throw new UnauthorizedException({ error: verification.error });
    }
    const initDataUserId = verification.user?.id;
    if (initDataUserId == null) {
      throw new UnauthorizedException({ error: "missing-user" });
    }

    const telegramUserId = BigInt(String(initDataUserId));
    const userMatches = telegramUserId === session.telegramUserId;
    if (!userMatches) {
      // Never silently trust a mismatched user — but don't leak WHICH part
      // mismatched to the client either.
      throw new ForbiddenException({ error: "session-user-mismatch" });
    }

    request.guardian = { session, userMatches, telegramUserId };
    return true;
  }
}

export const getGuardianContext = (
  request: GuardianRequest,
): GuardianVerifiedContext => {
  if (!request.guardian) {
    throw new UnauthorizedException({ error: "missing-auth" });
  }
  return request.guardian;
};

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  type PlatformUserBanRecord,
  PrismaPlatformRepository,
} from "@superbot/data";
import { createRateLimiter, getRuntimeEnv } from "@superbot/shared";
import { verifyTelegramInitData } from "../telegram-init-data.js";

export interface MiniappContext {
  readonly userId: string;
  readonly user: Record<string, unknown>;
  readonly startParam: string | null;
  /**
   * The bot whose Mini App produced this request, resolved by proving the
   * initData HMAC against that bot's token. For the primary bot this is the
   * configured TELEGRAM_BOT_USERNAME; for a managed child bot it is that bot's
   * username. Downstream services use it to pick the right tenant.
   */
  readonly botUsername: string;
  /**
   * The decrypted token of {@link botUsername}. Downstream services use it for
   * Telegram calls made on behalf of that bot (getChatAdministrators, etc.).
   * NEVER include this in a response or log line.
   */
  readonly botToken: string;
  readonly platformActAs?: {
    readonly sourceBotUsername: string;
  };
}

export interface MiniappRequest {
  headers: Record<string, string | string[] | undefined>;
  miniapp?: MiniappContext;
}

const BOT_USERNAME_RE = /^[a-z0-9_]{4,64}$/u;
// Short positive TTL: a suspended/expired child bot must lose Mini App access
// promptly (the DB stops handing out its token once inactive), so we only cache
// a resolved token for a few seconds.
const TOKEN_CACHE_TTL_MS = 5_000;
// Cache "no such bot" briefly too, so a flood of bogus X-Bot-Username values
// can't hammer the DB with repeat lookups (cheap enumeration guard).
const TOKEN_MISS_TTL_MS = 10_000;
// Hard cap on the resolution cache so an attacker rotating through distinct
// X-Bot-Username values (which reach this code BEFORE the HMAC is verified)
// cannot grow the Map without bound. FIFO-evicted (Map preserves insert order).
const MAX_TOKEN_CACHE_ENTRIES = 5_000;
// Global token bucket for DB *miss* lookups (a distinct-value flood misses the
// cache every time). Legitimate misses are rare (a new bot, or a 5s-expired
// entry), so this only bites an enumeration flood; over-budget misses are
// treated as unknown-bot without touching the DB. Refills at MISS_REFILL/sec.
const MISS_BUCKET_CAPACITY = 60;
const MISS_REFILL_PER_SEC = 30;

// Per-user throttle: server.ts's global limiter keys on request.ip, but every
// Mini App request arrives from the Next.js proxy container (see
// apps/web/app/api/[...path]/route.ts), so that limiter is ONE shared budget
// across every Telegram user, not a per-user one. Key on the initData-verified
// user id instead — only reachable after the HMAC check below succeeds, so
// spoofed/unauthenticated traffic can't spend it. Mirrors apps/bot's perBot
// bucket (40/20).
const USER_RATE_CAPACITY = 40;
const USER_RATE_REFILL_PER_SEC = 20;

/**
 * Authenticates Mini App requests via `Authorization: tma <initData>`, verifying
 * the Telegram HMAC signature + auth_date freshness, and attaches the resolved
 * user + start_param to the request.
 *
 * Multi-tenant: when the client sends `X-Bot-Username: <childbot>` (set by the
 * web app from the `?tgbot=` param that a managed bot's menu button carries),
 * the guard resolves that child bot's decrypted token and verifies the initData
 * against it. A valid HMAC is itself the proof of identity — only that bot's
 * token can produce a matching hash — so the untrusted header cannot be forged.
 * Absent/primary hint → the primary bot token (fully backward compatible).
 */
@Injectable()
export class InitDataGuard implements CanActivate {
  // Lazily built on the first managed-bot request so construction never touches
  // the environment (tests instantiate the guard during collection).
  private platformRepo: PrismaPlatformRepository | undefined;
  private readonly tokenCache = new Map<
    string,
    { token: string | undefined; expiresAt: number }
  >();
  private missBudget = MISS_BUCKET_CAPACITY;
  private missBudgetAt = Date.now();
  private readonly perUser = createRateLimiter({
    capacity: USER_RATE_CAPACITY,
    refillPerSec: USER_RATE_REFILL_PER_SEC,
  });

  private get platform(): PrismaPlatformRepository {
    this.platformRepo ??= new PrismaPlatformRepository(
      undefined,
      getRuntimeEnv().MANAGED_BOT_TOKEN_KEY,
    );
    return this.platformRepo;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<MiniappRequest>();
    const rawHeader = request.headers.authorization;
    const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    if (!header) {
      throw new UnauthorizedException({ error: "missing-auth" });
    }

    const spaceIndex = header.indexOf(" ");
    const scheme = spaceIndex >= 0 ? header.slice(0, spaceIndex) : header;
    const initData = spaceIndex >= 0 ? header.slice(spaceIndex + 1) : "";
    if (scheme.toLowerCase() !== "tma" || !initData) {
      throw new UnauthorizedException({ error: "missing-auth" });
    }

    const env = getRuntimeEnv();
    if (!env.TELEGRAM_BOT_TOKEN) {
      throw new ServiceUnavailableException({ error: "missing-bot-token" });
    }

    const resolution = await this.resolveVerificationBot(request, env);

    const verification = verifyTelegramInitData(initData, resolution.botToken, {
      maxAgeSeconds: env.INITDATA_MAX_AGE_SECONDS,
      now: Math.floor(Date.now() / 1000),
    });

    if (!verification.ok) {
      throw new UnauthorizedException({ error: verification.error });
    }

    const user = verification.user;
    if (!user || user.id == null) {
      throw new UnauthorizedException({ error: "missing-user" });
    }
    const userId = BigInt(String(user.id));
    if (!this.perUser.tryConsume(`user:${userId}`)) {
      throw new HttpException(
        { error: "rate-limited" },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.assertNotPlatformBanned(userId, env);

    let botUsername = resolution.botUsername;
    let botToken = resolution.botToken;
    let platformActAs: MiniappContext["platformActAs"];
    if (resolution.actAsUsername) {
      if (!(await this.canPlatformActAs(userId, env))) {
        throw new ForbiddenException({ error: "platform-owner-required" });
      }
      const acted = await this.resolveActAsBot(resolution.actAsUsername, env);
      botUsername = acted.botUsername;
      botToken = acted.botToken;
      platformActAs = { sourceBotUsername: resolution.botUsername };
    }

    request.miniapp = {
      userId: String(user.id),
      user,
      startParam: new URLSearchParams(initData).get("start_param"),
      botUsername,
      botToken,
      ...(platformActAs ? { platformActAs } : {}),
    };

    return true;
  }

  /**
   * Resolves which bot this request belongs to and its token. Defaults to the
   * primary bot; a valid `X-Bot-Username` hint switches to a managed child bot.
   */
  private async resolveVerificationBot(
    request: MiniappRequest,
    env: ReturnType<typeof getRuntimeEnv>,
  ): Promise<{
    botUsername: string;
    botToken: string;
    actAsUsername?: string;
  }> {
    const parentUsername = env.TELEGRAM_BOT_USERNAME.replace(
      /^@/u,
      "",
    ).toLowerCase();

    const rawHint = request.headers["x-bot-username"];
    const hintValue = Array.isArray(rawHint) ? rawHint[0] : rawHint;
    const hint = (hintValue ?? "").replace(/^@/u, "").toLowerCase();
    const rawActAs = request.headers["x-platform-act-as-bot-username"];
    const actAsValue = Array.isArray(rawActAs) ? rawActAs[0] : rawActAs;
    const actAs = (actAsValue ?? "").replace(/^@/u, "").toLowerCase();

    if (actAs) {
      if (!BOT_USERNAME_RE.test(actAs)) {
        throw new UnauthorizedException({ error: "invalid-bot" });
      }
      if (hint && hint !== parentUsername) {
        throw new UnauthorizedException({
          error: "act-as-requires-primary-session",
        });
      }
      return {
        botUsername: parentUsername,
        botToken: env.TELEGRAM_BOT_TOKEN as string,
        actAsUsername: actAs,
      };
    }

    if (!hint || hint === parentUsername) {
      return {
        botUsername: parentUsername,
        botToken: env.TELEGRAM_BOT_TOKEN as string,
      };
    }

    if (!BOT_USERNAME_RE.test(hint)) {
      throw new UnauthorizedException({ error: "invalid-bot" });
    }

    const token = await this.resolveManagedToken(hint);
    if (!token) {
      throw new UnauthorizedException({ error: "unknown-bot" });
    }
    return { botUsername: hint, botToken: token };
  }

  private async resolveActAsBot(
    username: string,
    env: ReturnType<typeof getRuntimeEnv>,
  ): Promise<{ botUsername: string; botToken: string }> {
    const parentUsername = env.TELEGRAM_BOT_USERNAME.replace(
      /^@/u,
      "",
    ).toLowerCase();
    if (username === parentUsername) {
      return {
        botUsername: parentUsername,
        botToken: env.TELEGRAM_BOT_TOKEN as string,
      };
    }
    const token = await this.resolveManagedToken(username);
    if (!token) {
      throw new UnauthorizedException({ error: "unknown-bot" });
    }
    return { botUsername: username, botToken: token };
  }

  private async canPlatformActAs(
    userId: bigint,
    env: ReturnType<typeof getRuntimeEnv>,
  ): Promise<boolean> {
    if (env.SUPERBOT_OWNER_TELEGRAM_ID === userId) {
      return true;
    }
    try {
      return await this.platform.hasRole(userId, "platform_owner");
    } catch {
      throw new ServiceUnavailableException({ error: "platform-unavailable" });
    }
  }

  private async assertNotPlatformBanned(
    userId: bigint,
    env: ReturnType<typeof getRuntimeEnv>,
  ): Promise<void> {
    if (env.SUPERBOT_OWNER_TELEGRAM_ID === userId) {
      return;
    }
    let ban: PlatformUserBanRecord | null;
    try {
      ban = await this.platform.getActivePlatformUserBan(userId);
    } catch {
      throw new ServiceUnavailableException({
        error: "platform-ban-check-unavailable",
      });
    }
    if (!ban) {
      return;
    }
    throw new ForbiddenException({
      error: "platform-user-banned",
      reason: ban.reason,
      bannedAt: ban.bannedAt.toISOString(),
      expiresAt: ban.expiresAt?.toISOString() ?? null,
    });
  }

  private async resolveManagedToken(
    username: string,
  ): Promise<string | undefined> {
    const now = Date.now();
    const cached = this.tokenCache.get(username);
    if (cached) {
      if (cached.expiresAt > now) {
        return cached.token;
      }
      // Purge the stale entry so the Map can't accumulate dead keys over time.
      this.tokenCache.delete(username);
    }

    // A cache miss that needs a DB round-trip: gate distinct-value floods (they
    // miss every time) behind a global token bucket so they can't hammer the DB.
    if (!this.consumeMissBudget(now)) {
      // Over budget → treat as unknown without a DB call (fail-closed). Do NOT
      // cache, so legitimate bots resolve once the flood subsides.
      return undefined;
    }

    let token: string | undefined;
    try {
      token = await this.platform.getManagedBotToken(username);
    } catch {
      // Transient DB failure or missing MANAGED_BOT_TOKEN_KEY: surface as 503
      // instead of negative-caching a real bot as "unknown" for 10s.
      throw new ServiceUnavailableException({ error: "bot-token-unavailable" });
    }

    this.cacheSet(username, {
      token,
      expiresAt: now + (token ? TOKEN_CACHE_TTL_MS : TOKEN_MISS_TTL_MS),
    });
    return token;
  }

  /** Insert with a hard FIFO size cap so the cache can never grow unbounded. */
  private cacheSet(
    username: string,
    entry: { token: string | undefined; expiresAt: number },
  ): void {
    if (this.tokenCache.size >= MAX_TOKEN_CACHE_ENTRIES) {
      const oldest = this.tokenCache.keys().next().value;
      if (oldest !== undefined) {
        this.tokenCache.delete(oldest);
      }
    }
    this.tokenCache.set(username, entry);
  }

  /** Refill + spend one unit of the miss budget; false when exhausted. */
  private consumeMissBudget(now: number): boolean {
    const refill = ((now - this.missBudgetAt) / 1000) * MISS_REFILL_PER_SEC;
    if (refill > 0) {
      this.missBudget = Math.min(
        MISS_BUCKET_CAPACITY,
        this.missBudget + refill,
      );
      this.missBudgetAt = now;
    }
    if (this.missBudget < 1) {
      return false;
    }
    this.missBudget -= 1;
    return true;
  }
}

export const getMiniappContext = (request: MiniappRequest): MiniappContext => {
  if (!request.miniapp) {
    throw new UnauthorizedException({ error: "missing-auth" });
  }
  return request.miniapp;
};

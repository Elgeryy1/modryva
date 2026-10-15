import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { PrismaMiniappVisitRepository } from "@superbot/data";
import { decodeStartParam } from "@superbot/shared";
import type { Observable } from "rxjs";
import {
  headerValue,
  resolveClientIp,
} from "../guardian/guardian-session.guard.js";
import { getMiniappContext, type MiniappRequest } from "./init-data.guard.js";

/**
 * Records who opened a Mini App and from which connection, feeding the same
 * multi-account check as Guardian (see the /bdani roster). Without it that
 * check only ever sees the minority of members who went through a join
 * verification.
 *
 * An interceptor rather than a call inside one endpoint: the first attempt
 * hooked POST /v1/games/profile, which the games app never requests when it is
 * opened through its own deep link — the web root redirects straight to /games
 * before any profile call — so nothing was ever recorded. Applied to a
 * controller, every one of its routes feeds the roster and a route added later
 * cannot silently miss it.
 *
 * Never blocks or fails a request: this is bookkeeping, and playing a game must
 * not break because a write did.
 */
@Injectable()
export class MiniappVisitInterceptor implements NestInterceptor {
  private readonly visits = new PrismaMiniappVisitRepository();

  /**
   * Last time each (user, ip) pair was written. A single app session fires
   * several requests, so without this `visits` would count HTTP calls instead
   * of sessions and every request would carry a database write.
   */
  private readonly lastWrite = new Map<string, number>();
  private static readonly THROTTLE_MS = 10 * 60 * 1000;
  /** Bounded so a long-running process can't grow this map without limit. */
  private static readonly MAX_TRACKED = 5000;

  private shouldWrite(key: string, now: number): boolean {
    const previous = this.lastWrite.get(key);
    if (
      previous !== undefined &&
      now - previous < MiniappVisitInterceptor.THROTTLE_MS
    ) {
      return false;
    }
    if (this.lastWrite.size >= MiniappVisitInterceptor.MAX_TRACKED) {
      // Cheapest sound eviction: drop the oldest insertion (Map preserves it).
      const oldest = this.lastWrite.keys().next();
      if (!oldest.done) {
        this.lastWrite.delete(oldest.value);
      }
    }
    this.lastWrite.set(key, now);
    return true;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    void this.record(context.switchToHttp().getRequest<MiniappRequest>());
    return next.handle();
  }

  private async record(req: MiniappRequest): Promise<void> {
    try {
      const ctx = getMiniappContext(req);
      const ip = resolveClientIp(req.headers);
      if (!ip) {
        return;
      }
      const key = `${ctx.userId}:${ip}`;
      if (!this.shouldWrite(key, Date.now())) {
        return;
      }
      const user = ctx.user;
      const asString = (value: unknown): string | null =>
        typeof value === "string" && value.length > 0 ? value : null;
      const country = headerValue(req.headers, "cf-ipcountry");
      await this.visits.record({
        botUsername: ctx.botUsername,
        telegramUserId: BigInt(ctx.userId),
        username: asString(user.username),
        firstName: asString(user.first_name),
        lastName: asString(user.last_name),
        ip,
        countryCode:
          country && country !== "XX" && country !== "T1"
            ? country.toUpperCase()
            : null,
        // Which community this open belongs to, when the deep link says so.
        // Without it the visit is only ever shown to admins who already know
        // the person from a verification (see listForGroup).
        groupTelegramId: groupFromStartParam(ctx.startParam),
        surface: surfaceFor(req.url),
      });
    } catch {
      // Bookkeeping must never break the request it rode in on.
    }
  }
}

/** The group a `startapp` payload points at, or null when it carries none
 * (the portable games hub) or is unparseable. */
const groupFromStartParam = (startParam: string | null): bigint | null => {
  const decoded = decodeStartParam(startParam);
  const groupId = decoded && "groupId" in decoded ? decoded.groupId : undefined;
  if (!groupId) {
    return null;
  }
  try {
    return BigInt(groupId);
  } catch {
    return null;
  }
};

/** Which Mini App a request came from, derived from its path. Unknown paths
 * record as "miniapp" rather than being dropped — losing a visit is worse than
 * an imprecise label. */
const surfaceFor = (url: string | undefined): string => {
  if (!url) {
    return "miniapp";
  }
  if (url.includes("/v1/games")) {
    return "games";
  }
  if (url.includes("/v1/casino")) {
    return "casino";
  }
  return "miniapp";
};

import { Controller, Get, Inject, Param, Req, UseGuards } from "@nestjs/common";
import {
  type ChatActivityEntry,
  PrismaChatActivityRepository,
} from "@superbot/data";
import {
  detectDormantMembers,
  findGhostMembers,
} from "@superbot/module-community";
import { MiniappAdminService } from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./init-data.guard.js";

// Same knobs as the chat commands (/fantasmas, /miembros_inactivos) so the Mini
// App and the chat agree: 24h grace before a silent newcomer counts as a ghost,
// and the recent-activity window the detectors scan.
const GHOST_GRACE_MS = 24 * 60 * 60 * 1000;
const ACTIVITY_LIMIT = 500;
const RESULT_LIMIT = 50;
const DAY_MS = 86_400_000;

interface GhostView {
  readonly userId: string;
  readonly username: string | null;
  readonly joinedAt: string;
}

interface InactiveView {
  readonly userId: string;
  readonly username: string | null;
  readonly idleDays: number;
  readonly lastActiveAt: string;
}

/** First non-empty username seen for a user id, across the given entries. */
const rememberUsername = (
  map: Map<string, string>,
  entry: ChatActivityEntry,
): void => {
  if (entry.telegramUserId === undefined || !entry.username) {
    return;
  }
  const id = entry.telegramUserId.toString();
  if (!map.has(id)) {
    map.set(id, entry.username);
  }
};

/**
 * Read-only community insight dashboards, mirroring the chat's /fantasmas and
 * /miembros_inactivos over the same activity log — but browsable in the Mini
 * App instead of a one-shot chat message. Reuses the exact pure detectors so the
 * numbers match the chat. Reports only; no mutations, no audit.
 */
@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class MiniappInsightsController {
  private readonly activity = new PrismaChatActivityRepository();

  constructor(
    @Inject(MiniappAdminService) private readonly admin: MiniappAdminService,
  ) {}

  @Get("groups/:gid/insights/ghosts")
  async ghosts(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const chat = await this.authorize(req, gid);
    const [joins, messages] = await Promise.all([
      this.activity.listRecent(
        chat.tenantId,
        chat.chatId,
        "new_member",
        ACTIVITY_LIMIT,
      ),
      this.activity.listRecent(
        chat.tenantId,
        chat.chatId,
        "message",
        ACTIVITY_LIMIT,
      ),
    ]);

    const usernames = new Map<string, string>();
    const joinedMs = new Map<string, number>();
    for (const entry of joins) {
      rememberUsername(usernames, entry);
      if (entry.telegramUserId === undefined) {
        continue;
      }
      const id = entry.telegramUserId.toString();
      const ms = entry.createdAt.getTime();
      const prev = joinedMs.get(id);
      if (prev === undefined || ms < prev) {
        joinedMs.set(id, ms);
      }
    }

    const messageCount = new Map<string, number>();
    for (const entry of messages) {
      rememberUsername(usernames, entry);
      if (entry.telegramUserId === undefined) {
        continue;
      }
      const id = entry.telegramUserId.toString();
      messageCount.set(id, (messageCount.get(id) ?? 0) + 1);
    }

    const members = [...joinedMs.entries()].map(([userId, joined]) => ({
      userId,
      joinedMs: joined,
      messages: messageCount.get(userId) ?? 0,
    }));
    const ghosts = findGhostMembers(members, Date.now(), GHOST_GRACE_MS);

    const view: GhostView[] = ghosts.slice(0, RESULT_LIMIT).map((id) => ({
      userId: id,
      username: usernames.get(id) ?? null,
      joinedAt: new Date(joinedMs.get(id) ?? 0).toISOString(),
    }));
    return { total: ghosts.length, ghosts: view };
  }

  @Get("groups/:gid/insights/inactive")
  async inactive(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const chat = await this.authorize(req, gid);
    const messages = await this.activity.listRecent(
      chat.tenantId,
      chat.chatId,
      "message",
      ACTIVITY_LIMIT,
    );

    const usernames = new Map<string, string>();
    const lastActive = new Map<number, number>();
    for (const entry of messages) {
      rememberUsername(usernames, entry);
      if (entry.telegramUserId === undefined) {
        continue;
      }
      const id = Number(entry.telegramUserId);
      const ms = entry.createdAt.getTime();
      const known = lastActive.get(id);
      if (known === undefined || ms > known) {
        lastActive.set(id, ms);
      }
    }

    const members = [...lastActive.entries()].map(([userId, lastActiveMs]) => ({
      userId,
      lastActiveMs,
    }));
    const dormant = detectDormantMembers(members, Date.now());

    const view: InactiveView[] = dormant.slice(0, RESULT_LIMIT).map((m) => ({
      userId: m.userId.toString(),
      username: usernames.get(m.userId.toString()) ?? null,
      idleDays: Math.floor(m.idleMs / DAY_MS),
      lastActiveAt: new Date(lastActive.get(m.userId) ?? 0).toISOString(),
    }));
    return { total: dormant.length, inactive: view };
  }

  private async authorize(req: MiniappRequest, gid: string) {
    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    await this.admin.assertGroupAdmin(gid, ctx.userId, bot);
    return this.admin.resolveChat(gid, bot);
  }
}

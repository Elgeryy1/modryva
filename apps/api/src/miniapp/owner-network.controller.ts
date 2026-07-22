import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  type FederationChatRecord,
  type FederationRecord,
  OWNER_NETWORK_GROUP_ROLES,
  OWNER_NETWORK_ROUTE_EVENT_KINDS,
  OWNER_NETWORK_ROUTE_SOURCE_ALL,
  type OwnerNetworkConfigRecord,
  type OwnerNetworkGroupRole,
  type OwnerNetworkRouteEventKind,
  PrismaD1Repository,
  PrismaFederationRepository,
  PrismaFoundationRepository,
  PrismaGroupProtectionRepository,
  PrismaOwnerNetworkRepository,
  PrismaWelcomeRepository,
} from "@superbot/data";
import { z } from "zod";
import { MiniappAdminService } from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./init-data.guard.js";

const MAX_NAME_LEN = 64;
const nullableText = z.string().max(4096).nullable();
const telegramChatIdSchema = z
  .string()
  .regex(/^-?\d+$/u)
  .nullable();

const networkSettingsSchema = z.object({
  logTelegramChatId: telegramChatIdSchema,
  welcomeMode: z.enum(["per_group", "global"]),
  welcomeText: nullableText,
  goodbyeText: nullableText,
  rulesMode: z.enum(["per_group", "global"]),
  rulesText: nullableText,
  membershipMode: z.enum(["off", "require_all"]),
});

type NetworkSettingsInput = z.infer<typeof networkSettingsSchema>;

const routingSchema = z.object({
  roles: z
    .array(
      z.object({
        chatId: z.string().min(1),
        roles: z.array(z.enum(OWNER_NETWORK_GROUP_ROLES)).max(8),
        label: z.string().max(64).nullable().optional(),
      }),
    )
    .max(100),
  routes: z
    .array(
      z.object({
        sourceChatId: z.string().min(1).nullable(),
        eventKind: z.enum(OWNER_NETWORK_ROUTE_EVENT_KINDS),
        targetChatId: z.string().min(1),
        enabled: z.boolean().optional(),
      }),
    )
    .max(200),
});

type RoutingInput = z.infer<typeof routingSchema>;

interface NetworkSnapshotPayload {
  readonly config: {
    readonly logTelegramChatId: string | null;
    readonly welcomeMode: "per_group" | "global";
    readonly welcomeText: string | null;
    readonly goodbyeText: string | null;
    readonly rulesMode: "per_group" | "global";
    readonly rulesText: string | null;
    readonly membershipMode: "off" | "require_all";
  };
  readonly roles: readonly {
    chatId: string;
    role: OwnerNetworkGroupRole;
    label: string | null;
  }[];
  readonly routes: readonly {
    sourceChatId: string | null;
    eventKind: OwnerNetworkRouteEventKind;
    targetChatId: string;
    enabled?: boolean;
  }[];
  readonly chats: readonly {
    chatId: string;
    telegramChatId: string;
    welcomeText: string | null;
    goodbyeText: string | null;
    rulesText: string | null;
    requiredTelegramChatIds: readonly string[];
    logTelegramChatId: string | null;
  }[];
}

@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class MiniappOwnerNetworkController {
  private readonly d1 = new PrismaD1Repository();
  private readonly federation = new PrismaFederationRepository();
  private readonly foundation = new PrismaFoundationRepository();
  private readonly groupProtection = new PrismaGroupProtectionRepository();
  private readonly ownerNetwork = new PrismaOwnerNetworkRepository();
  private readonly welcome = new PrismaWelcomeRepository();

  constructor(
    @Inject(MiniappAdminService) private readonly admin: MiniappAdminService,
  ) {}

  @Get("groups/:gid/network")
  async status(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const auth = await this.authorize(req, gid);
    const fed = await this.federation.getFederationForChat(auth.chat.chatId);
    return this.view(fed, auth);
  }

  @Post("groups/:gid/network")
  async create(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const name = normalizeName((body as { name?: unknown } | null)?.name);
    if (!name) {
      throw new BadRequestException({ error: "invalid-name" });
    }
    const auth = await this.authorize(req, gid);
    const existing = await this.federation.getFederationForChat(
      auth.chat.chatId,
    );
    if (existing) {
      throw new BadRequestException({ error: "already-in-network" });
    }

    const fedId = randomUUID();
    const fed = await this.federation.createFederation({
      tenantId: auth.chat.tenantId,
      fedId,
      name,
      ownerTelegramId: auth.userId,
    });
    await this.federation.joinFederation(
      fedId,
      auth.chat.chatId,
      BigInt(auth.chat.telegramChatId),
    );
    await this.audit(auth, "network.create", { fedId, name });
    return this.view(fed, auth);
  }

  @Post("groups/:gid/network/join")
  async join(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const networkId = (body as { networkId?: unknown } | null)?.networkId;
    if (typeof networkId !== "string" || networkId.trim().length === 0) {
      throw new BadRequestException({ error: "invalid-network-id" });
    }
    const auth = await this.authorize(req, gid);
    const fed = await this.federation.getFederation(networkId.trim());
    if (!fed) {
      throw new BadRequestException({ error: "network-not-found" });
    }
    await this.federation.joinFederation(
      fed.fedId,
      auth.chat.chatId,
      BigInt(auth.chat.telegramChatId),
    );
    await this.audit(auth, "network.join", { fedId: fed.fedId });
    return this.view(fed, auth);
  }

  @Delete("groups/:gid/network")
  async leave(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const auth = await this.authorize(req, gid);
    const fed = await this.federation.getFederationForChat(auth.chat.chatId);
    const left = await this.federation.leaveFederation(auth.chat.chatId);
    if (left) {
      await this.groupProtection.setMembershipGates(
        auth.chat.tenantId,
        auth.chat.chatId,
        BigInt(auth.chat.telegramChatId),
        [],
      );
      await this.audit(auth, "network.leave", {
        ...(fed ? { fedId: fed.fedId } : {}),
      });
    }
    return { inNetwork: false as const };
  }

  @Post("groups/:gid/network/rename")
  async rename(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const name = normalizeName((body as { name?: unknown } | null)?.name);
    if (!name) {
      throw new BadRequestException({ error: "invalid-name" });
    }
    const auth = await this.requireNetworkAdmin(req, gid);
    await this.federation.renameFederation(auth.fed.fedId, name);
    await this.audit(auth, "network.rename", {
      fedId: auth.fed.fedId,
      name,
    });
    const renamed = await this.federation.getFederation(auth.fed.fedId);
    return this.view(renamed, auth);
  }

  @Put("groups/:gid/network/settings")
  async updateSettings(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const parsed = networkSettingsSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }

    const auth = await this.requireNetworkAdmin(req, gid);
    await this.snapshotNetwork(auth, "before-settings-apply");
    const config = await this.ownerNetwork.upsertConfig(
      auth.chat.tenantId,
      auth.fed.fedId,
      toConfigPatch(parsed.data),
    );
    const chats = await this.federation.listFederationChats(auth.fed.fedId);
    await this.applyConfig(auth.chat.tenantId, chats, config);
    await this.audit(auth, "network.settings.apply", {
      fedId: auth.fed.fedId,
      chatCount: chats.length,
      membershipMode: config.membershipMode,
      welcomeMode: config.welcomeMode,
      rulesMode: config.rulesMode,
      logs: config.logTelegramChatId ? "central" : "off",
    });
    return this.view(auth.fed, auth);
  }

  @Post("groups/:gid/network/rollback")
  async rollback(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const auth = await this.requireNetworkAdmin(req, gid);
    const snapshot = await this.ownerNetwork.getLatestSnapshot(auth.fed.fedId);
    if (!snapshot) {
      throw new BadRequestException({ error: "no-snapshot" });
    }
    await this.restoreSnapshot(
      auth,
      snapshot.payload as NetworkSnapshotPayload,
    );
    await this.audit(auth, "network.rollback", {
      fedId: auth.fed.fedId,
      snapshotId: snapshot.id,
    });
    return this.view(auth.fed, auth);
  }

  @Put("groups/:gid/network/routing")
  async updateRouting(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const parsed = routingSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }

    const auth = await this.requireNetworkAdmin(req, gid);
    await this.snapshotNetwork(auth, "before-routing-apply");
    const chats = await this.federation.listFederationChats(auth.fed.fedId);
    const chatIds = new Set(chats.map((chat) => chat.chatId));
    const normalized = normalizeRoutingInput(parsed.data, chatIds);

    await this.ownerNetwork.replaceGroupRoles(
      auth.chat.tenantId,
      auth.fed.fedId,
      normalized.roles,
    );
    await this.ownerNetwork.replaceRoutes(
      auth.chat.tenantId,
      auth.fed.fedId,
      normalized.routes,
    );
    await this.audit(auth, "network.routing.apply", {
      fedId: auth.fed.fedId,
      roleCount: normalized.roles.length,
      routeCount: normalized.routes.length,
    });

    return this.view(auth.fed, auth);
  }

  private async applyConfig(
    tenantId: string,
    chats: readonly FederationChatRecord[],
    config: OwnerNetworkConfigRecord,
  ): Promise<void> {
    await Promise.all(
      chats.map((chat) =>
        config.logTelegramChatId
          ? this.d1.setLogChannel(
              tenantId,
              chat.chatId,
              config.logTelegramChatId,
            )
          : this.d1.clearLogChannel(chat.chatId),
      ),
    );

    if (config.welcomeMode === "global") {
      await Promise.all(
        chats.map((chat) =>
          this.welcome.upsertConfig(tenantId, chat.chatId, {
            welcomeText: config.welcomeText,
            goodbyeText: config.goodbyeText,
          }),
        ),
      );
    }

    if (config.rulesMode === "global") {
      await Promise.all(
        chats.map((chat) =>
          this.welcome.upsertConfig(tenantId, chat.chatId, {
            rulesText: config.rulesText,
          }),
        ),
      );
    }

    await Promise.all(
      chats.map((chat) =>
        this.groupProtection.setMembershipGates(
          tenantId,
          chat.chatId,
          chat.telegramChatId,
          config.membershipMode === "require_all"
            ? chats
                .filter((other) => other.chatId !== chat.chatId)
                .map((other) => other.telegramChatId)
            : [],
        ),
      ),
    );
  }

  /** Captures enough state to undo a mass "apply to the whole network" write. */
  private async snapshotNetwork(
    auth: AuthorizedMiniapp & { fed: FederationRecord },
    reason: string,
  ): Promise<void> {
    const [config, roles, routes, chats] = await Promise.all([
      this.ownerNetwork.getConfig(auth.chat.tenantId, auth.fed.fedId),
      this.ownerNetwork.listGroupRoles(auth.fed.fedId),
      this.ownerNetwork.listRoutes(auth.fed.fedId),
      this.federation.listFederationChats(auth.fed.fedId),
    ]);
    const chatStates = await Promise.all(
      chats.map(async (chat) => {
        const [welcome, gates, log] = await Promise.all([
          this.welcome.getConfig(chat.chatId),
          this.groupProtection.listMembershipGates(chat.chatId),
          this.d1.getLogConfig(chat.chatId),
        ]);
        return {
          chatId: chat.chatId,
          telegramChatId: chat.telegramChatId.toString(),
          welcomeText: welcome?.welcomeText ?? null,
          goodbyeText: welcome?.goodbyeText ?? null,
          rulesText: welcome?.rulesText ?? null,
          requiredTelegramChatIds: gates.map((gate) =>
            gate.requiredTelegramChatId.toString(),
          ),
          logTelegramChatId: log?.logTelegramChatId.toString() ?? null,
        };
      }),
    );

    const payload: NetworkSnapshotPayload = {
      config: {
        logTelegramChatId: config.logTelegramChatId?.toString() ?? null,
        welcomeMode: config.welcomeMode,
        welcomeText: config.welcomeText,
        goodbyeText: config.goodbyeText,
        rulesMode: config.rulesMode,
        rulesText: config.rulesText,
        membershipMode: config.membershipMode,
      },
      roles: roles.map((role) => ({
        chatId: role.chatId,
        role: role.role,
        label: role.label ?? null,
      })),
      routes: routes.map((route) => ({
        sourceChatId: route.sourceChatId ?? null,
        eventKind: route.eventKind,
        targetChatId: route.targetChatId,
        enabled: route.enabled,
      })),
      chats: chatStates,
    };

    await this.ownerNetwork.createSnapshot(
      auth.chat.tenantId,
      auth.fed.fedId,
      auth.telegramUserId,
      reason,
      payload,
    );
  }

  private async restoreSnapshot(
    auth: AuthorizedMiniapp & { fed: FederationRecord },
    payload: NetworkSnapshotPayload,
  ): Promise<void> {
    await this.ownerNetwork.upsertConfig(auth.chat.tenantId, auth.fed.fedId, {
      logTelegramChatId: payload.config.logTelegramChatId
        ? BigInt(payload.config.logTelegramChatId)
        : null,
      welcomeMode: payload.config.welcomeMode,
      welcomeText: payload.config.welcomeText,
      goodbyeText: payload.config.goodbyeText,
      rulesMode: payload.config.rulesMode,
      rulesText: payload.config.rulesText,
      membershipMode: payload.config.membershipMode,
    });
    await this.ownerNetwork.replaceGroupRoles(
      auth.chat.tenantId,
      auth.fed.fedId,
      payload.roles.map((role) => ({
        chatId: role.chatId,
        role: role.role,
        label: role.label,
      })),
    );
    await this.ownerNetwork.replaceRoutes(
      auth.chat.tenantId,
      auth.fed.fedId,
      payload.routes,
    );

    await Promise.all(
      payload.chats.map(async (chat) => {
        await this.welcome.upsertConfig(auth.chat.tenantId, chat.chatId, {
          welcomeText: chat.welcomeText,
          goodbyeText: chat.goodbyeText,
          rulesText: chat.rulesText,
        });
        if (chat.logTelegramChatId) {
          await this.d1.setLogChannel(
            auth.chat.tenantId,
            chat.chatId,
            BigInt(chat.logTelegramChatId),
          );
        } else {
          await this.d1.clearLogChannel(chat.chatId);
        }
        await this.groupProtection.setMembershipGates(
          auth.chat.tenantId,
          chat.chatId,
          BigInt(chat.telegramChatId),
          chat.requiredTelegramChatIds.map((id) => BigInt(id)),
        );
      }),
    );
  }

  private async view(
    fed: FederationRecord | null,
    auth: AuthorizedMiniapp,
  ): Promise<Record<string, unknown>> {
    if (!fed) {
      return { inNetwork: false as const };
    }

    const isOwner = fed.ownerTelegramId === auth.userId;
    const isNetworkAdmin =
      isOwner || (await this.federation.isFedAdmin(fed.fedId, auth.userId));
    const [chatCount, adminCount, config] = await Promise.all([
      this.federation.countFedChats(fed.fedId),
      this.federation.countFedAdmins(fed.fedId),
      this.ownerNetwork.getConfig(auth.chat.tenantId, fed.fedId),
    ]);
    const chats = isNetworkAdmin
      ? await this.resolveNetworkChats(auth.chat.tenantId, fed.fedId, config)
      : undefined;
    const [roles, routes, lastSnapshot] = isNetworkAdmin
      ? await Promise.all([
          this.resolveNetworkRoles(fed.fedId),
          this.ownerNetwork.listRoutes(fed.fedId),
          this.ownerNetwork.getLatestSnapshot(fed.fedId),
        ])
      : [undefined, undefined, undefined];

    return {
      inNetwork: true as const,
      networkId: fed.fedId,
      name: fed.name,
      ownerTelegramId: fed.ownerTelegramId.toString(),
      isOwner,
      isNetworkAdmin,
      chatCount,
      adminCount,
      ...(chats ? { chats } : {}),
      ...(roles ? { roles } : {}),
      ...(routes
        ? {
            routes: routes.map((route) => ({
              id: route.id,
              sourceChatId: route.sourceChatId ?? null,
              sourceKey: route.sourceKey,
              eventKind: route.eventKind,
              targetChatId: route.targetChatId,
              enabled: route.enabled,
            })),
          }
        : {}),
      ...(lastSnapshot
        ? {
            lastSnapshot: {
              id: lastSnapshot.id,
              reason: lastSnapshot.reason,
              createdAt: lastSnapshot.createdAt.toISOString(),
            },
          }
        : {}),
      policy: {
        logTelegramChatId: config.logTelegramChatId?.toString() ?? null,
        welcomeMode: config.welcomeMode,
        welcomeText: config.welcomeText,
        goodbyeText: config.goodbyeText,
        rulesMode: config.rulesMode,
        rulesText: config.rulesText,
        membershipMode: config.membershipMode,
      },
    };
  }

  private async resolveNetworkChats(
    tenantId: string,
    fedId: string,
    config: OwnerNetworkConfigRecord,
  ) {
    const chats = await this.federation.listFederationChats(fedId);
    const roleRows = await this.ownerNetwork.listGroupRoles(fedId);
    const rolesByChat = new Map<string, OwnerNetworkGroupRole[]>();
    for (const row of roleRows) {
      const list = rolesByChat.get(row.chatId) ?? [];
      list.push(row.role);
      rolesByChat.set(row.chatId, list);
    }

    return Promise.all(
      chats.map(async (chat) => {
        const [resolved, gates, log, welcome] = await Promise.all([
          this.foundation.findChatByTelegramId(tenantId, chat.telegramChatId),
          this.groupProtection.listMembershipGates(chat.chatId),
          this.d1.getLogConfig(chat.chatId),
          this.welcome.getConfig(chat.chatId),
        ]);

        const logsAligned =
          !config.logTelegramChatId ||
          log?.logTelegramChatId === config.logTelegramChatId;
        const welcomeAligned =
          config.welcomeMode !== "global" ||
          ((welcome?.welcomeText ?? null) === (config.welcomeText ?? null) &&
            (welcome?.goodbyeText ?? null) === (config.goodbyeText ?? null));
        const rulesAligned =
          config.rulesMode !== "global" ||
          (welcome?.rulesText ?? null) === (config.rulesText ?? null);
        const membershipAligned =
          config.membershipMode !== "require_all" || gates.length > 0;
        const misalignedFields = [
          !logsAligned && "logs",
          !welcomeAligned && "welcome",
          !rulesAligned && "rules",
          !membershipAligned && "membership",
        ].filter((v): v is string => Boolean(v));

        return {
          chatId: chat.chatId,
          telegramChatId: chat.telegramChatId.toString(),
          title: resolved?.title ?? null,
          logTelegramChatId: log?.logTelegramChatId.toString() ?? null,
          requiredGroupCount: gates.length,
          roles: rolesByChat.get(chat.chatId) ?? [],
          status: misalignedFields.length > 0 ? "misaligned" : "aligned",
          misalignedFields,
        };
      }),
    );
  }

  private async resolveNetworkRoles(fedId: string) {
    const rows = await this.ownerNetwork.listGroupRoles(fedId);
    const byChat = new Map<
      string,
      { chatId: string; roles: OwnerNetworkGroupRole[]; label: string | null }
    >();
    for (const row of rows) {
      const current =
        byChat.get(row.chatId) ??
        ({ chatId: row.chatId, roles: [], label: null } as {
          chatId: string;
          roles: OwnerNetworkGroupRole[];
          label: string | null;
        });
      current.roles.push(row.role);
      current.label ??= row.label ?? null;
      byChat.set(row.chatId, current);
    }
    return [...byChat.values()];
  }

  private async authorize(
    req: MiniappRequest,
    gid: string,
  ): Promise<AuthorizedMiniapp> {
    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    await this.admin.assertGroupAdmin(gid, ctx.userId, bot);
    const chat = await this.admin.resolveChat(gid, bot);
    return {
      chat,
      gid,
      userId: BigInt(ctx.userId),
      telegramUserId: ctx.userId,
    };
  }

  private async requireNetworkAdmin(
    req: MiniappRequest,
    gid: string,
  ): Promise<AuthorizedMiniapp & { fed: FederationRecord }> {
    const auth = await this.authorize(req, gid);
    const fed = await this.federation.getFederationForChat(auth.chat.chatId);
    if (!fed) {
      throw new BadRequestException({ error: "not-in-network" });
    }
    const isOwner = fed.ownerTelegramId === auth.userId;
    const isNetworkAdmin =
      isOwner || (await this.federation.isFedAdmin(fed.fedId, auth.userId));
    if (!isNetworkAdmin) {
      throw new ForbiddenException({ error: "not-network-admin" });
    }
    return { ...auth, fed };
  }

  private async audit(
    auth: AuthorizedMiniapp,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.foundation.recordAudit({
      tenantId: auth.chat.tenantId,
      actorType: "user",
      action: `miniapp.${action}`,
      resourceType: "chat_settings",
      resourceId: auth.gid,
      payload: {
        ...payload,
        source: "miniapp",
        telegramUserId: auth.telegramUserId,
      },
    });
  }
}

interface AuthorizedMiniapp {
  readonly chat: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly telegramChatId: string;
    readonly title?: string | undefined;
  };
  readonly gid: string;
  readonly userId: bigint;
  readonly telegramUserId: string;
}

const normalizeName = (raw: unknown): string | null => {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_NAME_LEN ? trimmed : null;
};

const toConfigPatch = (input: NetworkSettingsInput) => ({
  logTelegramChatId:
    input.logTelegramChatId === null ? null : BigInt(input.logTelegramChatId),
  welcomeMode: input.welcomeMode,
  welcomeText: input.welcomeText,
  goodbyeText: input.goodbyeText,
  rulesMode: input.rulesMode,
  rulesText: input.rulesText,
  membershipMode: input.membershipMode,
});

const normalizeRoutingInput = (
  input: RoutingInput,
  allowedChatIds: ReadonlySet<string>,
) => {
  const roles: {
    chatId: string;
    role: OwnerNetworkGroupRole;
    label?: string | null;
  }[] = [];
  const roleKeys = new Set<string>();
  for (const entry of input.roles) {
    if (!allowedChatIds.has(entry.chatId)) {
      throw new BadRequestException({ error: "route-chat-not-in-network" });
    }
    for (const role of new Set(entry.roles)) {
      const key = `${entry.chatId}:${role}`;
      if (!roleKeys.has(key)) {
        roleKeys.add(key);
        roles.push({
          chatId: entry.chatId,
          role,
          label: entry.label ?? null,
        });
      }
    }
  }

  const routes: {
    sourceChatId?: string | null;
    eventKind: OwnerNetworkRouteEventKind;
    targetChatId: string;
    enabled?: boolean;
  }[] = [];
  const routeKeys = new Set<string>();
  for (const route of input.routes) {
    if (!allowedChatIds.has(route.targetChatId)) {
      throw new BadRequestException({ error: "route-chat-not-in-network" });
    }
    if (
      route.sourceChatId !== null &&
      !allowedChatIds.has(route.sourceChatId)
    ) {
      throw new BadRequestException({ error: "route-chat-not-in-network" });
    }

    const sourceKey = route.sourceChatId ?? OWNER_NETWORK_ROUTE_SOURCE_ALL;
    const key = `${sourceKey}:${route.eventKind}`;
    if (routeKeys.has(key)) {
      throw new BadRequestException({ error: "duplicate-route" });
    }
    routeKeys.add(key);
    routes.push({
      sourceChatId: route.sourceChatId,
      eventKind: route.eventKind,
      targetChatId: route.targetChatId,
      enabled: route.enabled ?? true,
    });
  }

  return { roles, routes };
};

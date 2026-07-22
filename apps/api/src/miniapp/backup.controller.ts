import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  type AutomationAction,
  type AutomationCondition,
  type AutomationTrigger,
  PrismaAntifloodRepository,
  PrismaAutomationRepository,
  PrismaCaptchaRepository,
  PrismaContentLockRepository,
  PrismaFederationRepository,
  PrismaFoundationRepository,
  PrismaGamificationRepository,
  PrismaGroupProtectionRepository,
  PrismaInternalRoleRepository,
  PrismaModerationExtraRepository,
  PrismaOwnerNetworkRepository,
  PrismaWelcomeRepository,
} from "@superbot/data";
import { MiniappAdminService } from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./init-data.guard.js";

const BACKUP_VERSION = 2 as const;

interface BackupSections {
  readonly welcome: { welcomeText: string | null; goodbyeText: string | null };
  readonly rules: { rulesText: string | null };
  readonly flood: {
    enabled: boolean;
    messageLimit: number;
    windowSeconds: number;
    action: "warn" | "mute" | "ban" | "delete";
  };
  readonly captcha: {
    enabled: boolean;
    mode: "button" | "math" | "text";
    failAction: "mute" | "ban" | "restrict";
    timeoutSeconds: number;
    maxAttempts: number;
  };
  readonly locks: { locked: string[] };
  readonly warns: {
    warnLimit: number;
    warnMode: "ban" | "kick" | "mute" | "tban" | "tmute";
    durationMs: number | null;
    expireMs: number | null;
  };
  readonly hygiene: {
    cleanService: boolean;
    cleanWelcome: boolean;
    nightMode: boolean;
    nightStart: number;
    nightEnd: number;
    welcomeMute: boolean;
    autoApprove: boolean;
    rtlFilter: boolean;
    cjkFilter: boolean;
    language: string;
    blockKnownSpammers: boolean;
  };
  readonly membershipGate: { requiredTelegramChatId: string | null };
  readonly gamificationWelcomeButtons: {
    rules: boolean;
    otherGroups: boolean;
    support: boolean;
    verify: boolean;
  };
}

interface BackupPayload {
  readonly version: 2;
  readonly exportedAt: string;
  readonly sections: BackupSections;
  readonly network: NetworkBackup | null;
}

interface NetworkBackup {
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
    readonly chatId: string;
    readonly role: string;
    readonly label: string | null;
  }[];
  readonly routes: readonly {
    readonly sourceChatId: string | null;
    readonly eventKind: string;
    readonly targetChatId: string;
    readonly enabled: boolean;
  }[];
  readonly automations: readonly {
    readonly chatId: string | null;
    readonly name: string;
    readonly trigger: AutomationTrigger;
    readonly condition: AutomationCondition;
    readonly action: AutomationAction;
    readonly enabled: boolean;
  }[];
  readonly internalRoles: readonly {
    readonly telegramUserId: string;
    readonly role: string;
  }[];
}

const FLOOD_DEFAULT: BackupSections["flood"] = {
  enabled: false,
  messageLimit: 5,
  windowSeconds: 10,
  action: "mute",
};
const CAPTCHA_DEFAULT: BackupSections["captcha"] = {
  enabled: false,
  mode: "button",
  failAction: "mute",
  timeoutSeconds: 120,
  maxAttempts: 3,
};

interface BusinessTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly sections: BackupSections;
}

const baseHygiene: BackupSections["hygiene"] = {
  cleanService: true,
  cleanWelcome: false,
  nightMode: false,
  nightStart: 23,
  nightEnd: 7,
  welcomeMute: false,
  autoApprove: false,
  rtlFilter: false,
  cjkFilter: false,
  language: "es",
  blockKnownSpammers: true,
};

const baseSections = (overrides: Partial<BackupSections>): BackupSections => ({
  welcome: { welcomeText: null, goodbyeText: null },
  rules: { rulesText: null },
  flood: { ...FLOOD_DEFAULT },
  captcha: { ...CAPTCHA_DEFAULT },
  locks: { locked: [] },
  warns: { warnLimit: 3, warnMode: "mute", durationMs: null, expireMs: null },
  hygiene: { ...baseHygiene },
  membershipGate: { requiredTelegramChatId: null },
  gamificationWelcomeButtons: {
    rules: true,
    otherGroups: true,
    support: true,
    verify: false,
  },
  ...overrides,
});

export const BUSINESS_TEMPLATES: readonly BusinessTemplate[] = [
  {
    id: "community",
    name: "Comunidad",
    description: "Grupo general con moderacion basica y bienvenida.",
    sections: baseSections({
      welcome: {
        welcomeText: "Bienvenido/a {first_name} a {chat_title}!",
        goodbyeText: "Hasta pronto, {first_name}.",
      },
      rules: {
        rulesText: "1. Respeta a todos\n2. Nada de spam\n3. Manten el tema",
      },
    }),
  },
  {
    id: "sales",
    name: "Ventas",
    description: "Enfocado en catalogo y sin distracciones de spam.",
    sections: baseSections({
      welcome: {
        welcomeText: "Hola {first_name}, mira el catalogo fijado.",
        goodbyeText: null,
      },
      flood: {
        enabled: true,
        messageLimit: 8,
        windowSeconds: 15,
        action: "warn",
      },
      locks: { locked: ["url", "forward", "via_bot"] },
    }),
  },
  {
    id: "support",
    name: "Soporte",
    description: "Grupo de soporte con captcha suave y sin flood.",
    sections: baseSections({
      welcome: {
        welcomeText: "Hola {first_name}, cuentanos tu problema.",
        goodbyeText: null,
      },
      captcha: {
        enabled: true,
        mode: "button",
        failAction: "mute",
        timeoutSeconds: 180,
        maxAttempts: 3,
      },
      flood: {
        enabled: true,
        messageLimit: 10,
        windowSeconds: 20,
        action: "mute",
      },
    }),
  },
  {
    id: "courses",
    name: "Cursos",
    description: "Comunidad educativa con reglas y cuarentena nocturna.",
    sections: baseSections({
      welcome: {
        welcomeText: "Bienvenido/a al curso, {first_name}!",
        goodbyeText: "Gracias por participar, {first_name}.",
      },
      rules: {
        rulesText:
          "1. Solo dudas del curso\n2. Nada de promocion externa\n3. Respeto entre companeros",
      },
      hygiene: {
        ...baseHygiene,
        nightMode: true,
        nightStart: 23,
        nightEnd: 7,
      },
    }),
  },
  {
    id: "gaming",
    name: "Gaming/casino",
    description: "Comunidad de juego con moderacion mas estricta.",
    sections: baseSections({
      welcome: {
        welcomeText: "GG {first_name}, bienvenido a la mesa!",
        goodbyeText: null,
      },
      flood: {
        enabled: true,
        messageLimit: 6,
        windowSeconds: 10,
        action: "mute",
      },
      captcha: {
        enabled: true,
        mode: "math",
        failAction: "mute",
        timeoutSeconds: 120,
        maxAttempts: 3,
      },
      warns: {
        warnLimit: 2,
        warnMode: "tmute",
        durationMs: 3_600_000,
        expireMs: null,
      },
    }),
  },
  {
    id: "crypto",
    name: "Crypto anti-scam",
    description: "Maxima proteccion contra estafas y enlaces no solicitados.",
    sections: baseSections({
      welcome: {
        welcomeText:
          "Bienvenido/a {first_name}. Nunca compartimos DMs ni pedimos claves.",
        goodbyeText: null,
      },
      rules: {
        rulesText:
          "1. Nadie del staff escribe por DM\n2. Nunca compartas tu seed phrase\n3. Reporta cualquier intento de estafa",
      },
      captcha: {
        enabled: true,
        mode: "text",
        failAction: "ban",
        timeoutSeconds: 90,
        maxAttempts: 2,
      },
      flood: {
        enabled: true,
        messageLimit: 4,
        windowSeconds: 10,
        action: "ban",
      },
      locks: { locked: ["url", "forward", "mention", "via_bot"] },
      hygiene: {
        ...baseHygiene,
        blockKnownSpammers: true,
        autoApprove: false,
      },
    }),
  },
];

@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class MiniappBackupController {
  private readonly welcome = new PrismaWelcomeRepository();
  private readonly flood = new PrismaAntifloodRepository();
  private readonly captcha = new PrismaCaptchaRepository();
  private readonly locks = new PrismaContentLockRepository();
  private readonly warns = new PrismaModerationExtraRepository();
  private readonly hygiene = new PrismaGroupProtectionRepository();
  private readonly foundation = new PrismaFoundationRepository();
  private readonly federation = new PrismaFederationRepository();
  private readonly ownerNetwork = new PrismaOwnerNetworkRepository();
  private readonly automations = new PrismaAutomationRepository();
  private readonly gamification = new PrismaGamificationRepository();
  private readonly internalRoles = new PrismaInternalRoleRepository();

  constructor(
    @Inject(MiniappAdminService) private readonly admin: MiniappAdminService,
  ) {}

  @Get("groups/:gid/backup/export")
  async export(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
  ): Promise<BackupPayload> {
    const chat = await this.authorize(req, gid);
    return this.exportChat(chat.tenantId, chat.chatId);
  }

  @Post("groups/:gid/backup/import")
  async import(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: { payload?: unknown },
  ) {
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    const parsed = this.parsePayload(body?.payload);
    await this.applySections(
      chat.tenantId,
      chat.chatId,
      chat.telegramChatId,
      parsed.sections,
    );
    await this.applyNetworkBackup(chat.tenantId, chat.chatId, parsed.network);
    await this.foundation.recordAudit({
      tenantId: chat.tenantId,
      actorType: "user",
      action: "miniapp.backup.imported",
      resourceType: "chat_settings",
      resourceId: gid,
      payload: { source: "miniapp", telegramUserId: ctx.userId },
    });
    return this.exportChat(chat.tenantId, chat.chatId);
  }

  @Post("groups/:gid/backup/clone")
  async clone(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: { targetGid?: unknown },
  ) {
    if (
      typeof body?.targetGid !== "string" ||
      body.targetGid.trim().length === 0
    ) {
      throw new BadRequestException({ error: "invalid-target" });
    }
    const targetGid = body.targetGid.trim();
    const ctx = getMiniappContext(req);
    const source = await this.authorize(req, gid);
    const target = await this.authorize(req, targetGid);

    const backup = await this.exportChat(source.tenantId, source.chatId);
    await this.applySections(
      target.tenantId,
      target.chatId,
      target.telegramChatId,
      backup.sections,
    );
    await this.applyNetworkBackup(
      target.tenantId,
      target.chatId,
      backup.network,
    );
    await this.foundation.recordAudit({
      tenantId: target.tenantId,
      actorType: "user",
      action: "miniapp.backup.cloned",
      resourceType: "chat_settings",
      resourceId: targetGid,
      payload: {
        source: "miniapp",
        telegramUserId: ctx.userId,
        fromGid: gid,
      },
    });
    return this.exportChat(target.tenantId, target.chatId);
  }

  @Get("groups/:gid/backup/templates")
  async templates(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    await this.authorize(req, gid);
    return {
      templates: BUSINESS_TEMPLATES.map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description,
      })),
    };
  }

  @Post("groups/:gid/backup/templates/:id/apply")
  async applyTemplate(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Param("id") id: string,
  ) {
    const template = BUSINESS_TEMPLATES.find((entry) => entry.id === id);
    if (!template) {
      throw new BadRequestException({ error: "unknown-template" });
    }
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    await this.applySections(
      chat.tenantId,
      chat.chatId,
      chat.telegramChatId,
      template.sections,
    );
    await this.foundation.recordAudit({
      tenantId: chat.tenantId,
      actorType: "user",
      action: "miniapp.backup.template_applied",
      resourceType: "chat_settings",
      resourceId: gid,
      payload: {
        source: "miniapp",
        telegramUserId: ctx.userId,
        templateId: id,
      },
    });
    return this.exportChat(chat.tenantId, chat.chatId);
  }

  private async authorize(req: MiniappRequest, gid: string) {
    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    await this.admin.assertGroupAdmin(gid, ctx.userId, bot);
    return this.admin.resolveChat(gid, bot);
  }

  private parsePayload(raw: unknown): {
    sections: BackupSections;
    network: NetworkBackup | null;
  } {
    if (
      typeof raw !== "object" ||
      raw === null ||
      ![1, BACKUP_VERSION].includes(
        Number((raw as { version?: unknown }).version),
      ) ||
      typeof (raw as { sections?: unknown }).sections !== "object" ||
      (raw as { sections?: unknown }).sections === null
    ) {
      throw new BadRequestException({ error: "invalid-payload" });
    }
    const payload = raw as {
      sections: Partial<BackupSections>;
      network?: NetworkBackup | null;
    };
    return {
      sections: normalizeSections(payload.sections),
      network: payload.network ?? null,
    };
  }

  private async exportChat(
    tenantId: string,
    chatId: string,
  ): Promise<BackupPayload> {
    const [
      welcomeCfg,
      flood,
      captcha,
      locked,
      warns,
      hygiene,
      membershipGate,
      gamificationWelcomeButtons,
      network,
    ] = await Promise.all([
      this.welcome.getConfig(chatId),
      this.flood.getConfig(tenantId, chatId),
      this.captcha.getConfig(tenantId, chatId),
      this.locks.getLocked(tenantId, chatId),
      this.warns.getWarnPolicy(chatId),
      this.hygiene.getHygiene(chatId),
      this.hygiene.getMembershipGate(chatId),
      this.gamification.getWelcomeButtons(tenantId, chatId),
      this.exportNetwork(tenantId, chatId),
    ]);

    return {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      network,
      sections: {
        welcome: {
          welcomeText: welcomeCfg?.welcomeText ?? null,
          goodbyeText: welcomeCfg?.goodbyeText ?? null,
        },
        rules: { rulesText: welcomeCfg?.rulesText ?? null },
        flood: flood
          ? {
              enabled: flood.enabled,
              messageLimit: flood.messageLimit,
              windowSeconds: flood.windowSeconds,
              action: flood.action as BackupSections["flood"]["action"],
            }
          : { ...FLOOD_DEFAULT },
        captcha: captcha
          ? {
              enabled: captcha.enabled,
              mode: captcha.mode,
              failAction: captcha.failAction,
              timeoutSeconds: captcha.timeoutSeconds,
              maxAttempts: captcha.maxAttempts,
            }
          : { ...CAPTCHA_DEFAULT },
        locks: { locked },
        warns: {
          warnLimit: warns.warnLimit,
          warnMode: warns.warnMode as BackupSections["warns"]["warnMode"],
          durationMs: warns.durationMs ?? null,
          expireMs: warns.expireMs ?? null,
        },
        hygiene: {
          cleanService: hygiene.cleanService,
          cleanWelcome: hygiene.cleanWelcome,
          nightMode: hygiene.nightMode,
          nightStart: hygiene.nightStart,
          nightEnd: hygiene.nightEnd,
          welcomeMute: hygiene.welcomeMute,
          autoApprove: hygiene.autoApprove,
          rtlFilter: hygiene.rtlFilter,
          cjkFilter: hygiene.cjkFilter,
          language: hygiene.language,
          blockKnownSpammers: hygiene.blockKnownSpammers,
        },
        membershipGate: {
          requiredTelegramChatId: membershipGate
            ? membershipGate.requiredTelegramChatId.toString()
            : null,
        },
        gamificationWelcomeButtons,
      },
    };
  }

  private async exportNetwork(
    tenantId: string,
    chatId: string,
  ): Promise<NetworkBackup | null> {
    const fed = await this.federation.getFederationForChat(chatId);
    if (!fed) {
      return null;
    }
    const [config, roles, routes, automations, internalRoles] =
      await Promise.all([
        this.ownerNetwork.getConfig(tenantId, fed.fedId),
        this.ownerNetwork.listGroupRoles(fed.fedId),
        this.ownerNetwork.listRoutes(fed.fedId),
        this.automations.list(fed.fedId),
        this.internalRoles.listRoles(fed.fedId),
      ]);
    return {
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
      automations: automations.map((automation) => ({
        chatId: automation.chatId,
        name: automation.name,
        trigger: automation.trigger,
        condition: automation.condition,
        action: automation.action,
        enabled: automation.enabled,
      })),
      internalRoles: internalRoles.map((role) => ({
        telegramUserId: role.telegramUserId.toString(),
        role: role.role,
      })),
    };
  }

  private async applySections(
    tenantId: string,
    chatId: string,
    telegramChatId: string,
    sections: BackupSections,
  ): Promise<void> {
    await Promise.all([
      this.welcome.upsertConfig(tenantId, chatId, {
        welcomeText: sections.welcome.welcomeText,
        goodbyeText: sections.welcome.goodbyeText,
        rulesText: sections.rules.rulesText,
      }),
      this.flood.upsertConfig(tenantId, chatId, {
        enabled: sections.flood.enabled,
        messageLimit: sections.flood.messageLimit,
        windowSeconds: sections.flood.windowSeconds,
        action: sections.flood.action,
      }),
      this.captcha.upsertConfig(tenantId, chatId, {
        enabled: sections.captcha.enabled,
        mode: sections.captcha.mode,
        failAction: sections.captcha.failAction,
        timeoutSeconds: sections.captcha.timeoutSeconds,
        maxAttempts: sections.captcha.maxAttempts,
      }),
      this.locks.setLocked(tenantId, chatId, sections.locks.locked),
      this.warns.setWarnPolicy(tenantId, chatId, {
        warnLimit: sections.warns.warnLimit,
        warnMode: sections.warns.warnMode,
        durationMs: sections.warns.durationMs,
        expireMs: sections.warns.expireMs,
      }),
      this.hygiene.setHygiene(tenantId, chatId, {
        cleanService: sections.hygiene.cleanService,
        cleanWelcome: sections.hygiene.cleanWelcome,
        nightMode: sections.hygiene.nightMode,
        nightStart: sections.hygiene.nightStart,
        nightEnd: sections.hygiene.nightEnd,
        welcomeMute: sections.hygiene.welcomeMute,
        autoApprove: sections.hygiene.autoApprove,
        rtlFilter: sections.hygiene.rtlFilter,
        cjkFilter: sections.hygiene.cjkFilter,
        language: sections.hygiene.language,
        blockKnownSpammers: sections.hygiene.blockKnownSpammers,
      }),
      this.hygiene.setMembershipGate(
        tenantId,
        chatId,
        BigInt(telegramChatId),
        sections.membershipGate.requiredTelegramChatId === null
          ? null
          : BigInt(sections.membershipGate.requiredTelegramChatId),
      ),
      this.gamification.setWelcomeButtons(
        tenantId,
        chatId,
        sections.gamificationWelcomeButtons,
      ),
    ]);
  }

  private async applyNetworkBackup(
    tenantId: string,
    chatId: string,
    network: NetworkBackup | null,
  ): Promise<void> {
    if (!network) {
      return;
    }
    const fed = await this.federation.getFederationForChat(chatId);
    if (!fed) {
      throw new BadRequestException({ error: "not-in-network" });
    }

    await this.ownerNetwork.upsertConfig(tenantId, fed.fedId, {
      logTelegramChatId: network.config.logTelegramChatId
        ? BigInt(network.config.logTelegramChatId)
        : null,
      welcomeMode: network.config.welcomeMode,
      welcomeText: network.config.welcomeText,
      goodbyeText: network.config.goodbyeText,
      rulesMode: network.config.rulesMode,
      rulesText: network.config.rulesText,
      membershipMode: network.config.membershipMode,
    });
    await this.ownerNetwork.replaceGroupRoles(
      tenantId,
      fed.fedId,
      network.roles.map((role) => ({
        chatId: role.chatId,
        role: role.role as never,
        label: role.label,
      })),
    );
    await this.ownerNetwork.replaceRoutes(
      tenantId,
      fed.fedId,
      network.routes.map((route) => ({
        sourceChatId: route.sourceChatId,
        eventKind: route.eventKind as never,
        targetChatId: route.targetChatId,
        enabled: route.enabled,
      })),
    );

    const existingAutomations = await this.automations.list(fed.fedId);
    await Promise.all(
      existingAutomations.map((automation) =>
        this.automations.remove(automation.id),
      ),
    );
    for (const automation of network.automations) {
      const created = await this.automations.create(
        tenantId,
        fed.fedId,
        automation.chatId,
        automation.name,
        automation.trigger,
        automation.condition,
        automation.action,
      );
      if (!automation.enabled) {
        await this.automations.setEnabled(created.id, false);
      }
    }

    const existingRoles = await this.internalRoles.listRoles(fed.fedId);
    await Promise.all(
      existingRoles.map((role) =>
        this.internalRoles.removeRole(fed.fedId, role.telegramUserId),
      ),
    );
    await Promise.all(
      network.internalRoles.map((role) =>
        this.internalRoles.setRole(
          tenantId,
          fed.fedId,
          BigInt(role.telegramUserId),
          role.role as never,
        ),
      ),
    );
  }
}

const normalizeSections = (raw: Partial<BackupSections>): BackupSections => {
  const defaults = baseSections({});
  return {
    ...defaults,
    ...raw,
    welcome: { ...defaults.welcome, ...raw.welcome },
    rules: { ...defaults.rules, ...raw.rules },
    flood: { ...defaults.flood, ...raw.flood },
    captcha: { ...defaults.captcha, ...raw.captcha },
    locks: { ...defaults.locks, ...raw.locks },
    warns: { ...defaults.warns, ...raw.warns },
    hygiene: { ...defaults.hygiene, ...raw.hygiene },
    membershipGate: {
      ...defaults.membershipGate,
      ...raw.membershipGate,
    },
    gamificationWelcomeButtons: {
      ...defaults.gamificationWelcomeButtons,
      ...raw.gamificationWelcomeButtons,
    },
  };
};

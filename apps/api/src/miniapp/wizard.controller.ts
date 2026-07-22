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
  PrismaAntifloodRepository,
  PrismaCaptchaRepository,
  PrismaContentLockRepository,
  PrismaD1Repository,
  PrismaFoundationRepository,
  PrismaGroupProtectionRepository,
  PrismaWelcomeRepository,
} from "@superbot/data";
import { z } from "zod";
import { MiniappAdminService } from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./init-data.guard.js";

export type WizardSecurityLevel = "soft" | "normal" | "strict";

export type WizardPlaybookId =
  | "comunidad_limpia"
  | "ventas_sin_spam"
  | "solo_miembros_verificados"
  | "modo_raid"
  | "anuncios"
  | "soporte";

interface WizardPlaybookDefinition {
  readonly id: WizardPlaybookId;
  readonly name: string;
  readonly description: string;
  readonly locksByLevel: Record<WizardSecurityLevel, readonly string[]>;
  readonly captchaByLevel: Record<
    WizardSecurityLevel,
    { enabled: boolean; mode: "button" | "math" | "text" }
  >;
  readonly floodByLevel: Record<
    WizardSecurityLevel,
    { enabled: boolean; messageLimit: number; windowSeconds: number }
  >;
  readonly quarantineByLevel: Record<
    WizardSecurityLevel,
    { enabled: boolean; strictness: string }
  >;
  readonly requireMembershipGate: boolean;
  readonly welcomeText: string;
  readonly rulesText: string;
}

const BASE_LOCKS = ["mention", "forward", "via_bot"] as const;
const STRICT_LOCKS = [...BASE_LOCKS, "url"] as const;

export const PLAYBOOKS: readonly WizardPlaybookDefinition[] = [
  {
    id: "comunidad_limpia",
    name: "Comunidad limpia",
    description:
      "Para comunidades generales: modera spam y mantiene el chat ordenado sin ser demasiado estricto.",
    locksByLevel: {
      soft: [],
      normal: [...BASE_LOCKS],
      strict: [...STRICT_LOCKS],
    },
    captchaByLevel: {
      soft: { enabled: false, mode: "button" },
      normal: { enabled: true, mode: "button" },
      strict: { enabled: true, mode: "math" },
    },
    floodByLevel: {
      soft: { enabled: true, messageLimit: 10, windowSeconds: 10 },
      normal: { enabled: true, messageLimit: 6, windowSeconds: 10 },
      strict: { enabled: true, messageLimit: 4, windowSeconds: 10 },
    },
    quarantineByLevel: {
      soft: { enabled: false, strictness: "balanced" },
      normal: { enabled: true, strictness: "balanced" },
      strict: { enabled: true, strictness: "strict" },
    },
    requireMembershipGate: false,
    welcomeText:
      "Bienvenido/a {first_name} a {chat_title}. Lee las reglas antes de participar.",
    rulesText:
      "1. Respeta a los demas miembros.\n2. Nada de spam ni enlaces no solicitados.\n3. Manten el tema de la conversacion.",
  },
  {
    id: "ventas_sin_spam",
    name: "Ventas sin spam",
    description:
      "Para grupos de ventas: bloquea enlaces y reenvios no deseados manteniendo el flujo de ofertas.",
    locksByLevel: {
      soft: ["via_bot"],
      normal: ["via_bot", "forward"],
      strict: ["via_bot", "forward", "mention", "url"],
    },
    captchaByLevel: {
      soft: { enabled: false, mode: "button" },
      normal: { enabled: true, mode: "button" },
      strict: { enabled: true, mode: "button" },
    },
    floodByLevel: {
      soft: { enabled: true, messageLimit: 8, windowSeconds: 10 },
      normal: { enabled: true, messageLimit: 5, windowSeconds: 10 },
      strict: { enabled: true, messageLimit: 3, windowSeconds: 10 },
    },
    quarantineByLevel: {
      soft: { enabled: false, strictness: "balanced" },
      normal: { enabled: true, strictness: "balanced" },
      strict: { enabled: true, strictness: "strict" },
    },
    requireMembershipGate: false,
    welcomeText:
      "Hola {first_name}, bienvenido/a a {chat_title}. Consulta el catalogo antes de preguntar.",
    rulesText:
      "1. Publica solo en los canales indicados.\n2. Nada de enlaces externos sin permiso.\n3. Respeta a compradores y vendedores.",
  },
  {
    id: "solo_miembros_verificados",
    name: "Solo miembros verificados",
    description:
      "Exige verificacion y pertenencia a un grupo de referencia antes de participar. Ideal para comunidades cerradas.",
    locksByLevel: {
      soft: [...BASE_LOCKS],
      normal: [...STRICT_LOCKS],
      strict: [...STRICT_LOCKS],
    },
    captchaByLevel: {
      soft: { enabled: true, mode: "button" },
      normal: { enabled: true, mode: "math" },
      strict: { enabled: true, mode: "text" },
    },
    floodByLevel: {
      soft: { enabled: true, messageLimit: 6, windowSeconds: 10 },
      normal: { enabled: true, messageLimit: 5, windowSeconds: 10 },
      strict: { enabled: true, messageLimit: 3, windowSeconds: 10 },
    },
    quarantineByLevel: {
      soft: { enabled: true, strictness: "balanced" },
      normal: { enabled: true, strictness: "strict" },
      strict: { enabled: true, strictness: "strict" },
    },
    requireMembershipGate: true,
    welcomeText:
      "Bienvenido/a {first_name}. Este grupo es solo para miembros verificados.",
    rulesText:
      "1. Debes estar verificado para escribir.\n2. Nada de spam ni enlaces externos.\n3. El incumplimiento conlleva expulsion.",
  },
  {
    id: "modo_raid",
    name: "Modo raid",
    description:
      "Maxima proteccion ante un ataque coordinado: capcha exigente, antiflood agresivo y bloqueo total de contenido no textual.",
    locksByLevel: {
      soft: [...STRICT_LOCKS],
      normal: [...STRICT_LOCKS, "photo", "video", "sticker"],
      strict: [
        ...STRICT_LOCKS,
        "photo",
        "video",
        "sticker",
        "gif",
        "document",
        "audio",
        "voice",
        "contact",
        "location",
        "poll",
      ],
    },
    captchaByLevel: {
      soft: { enabled: true, mode: "math" },
      normal: { enabled: true, mode: "text" },
      strict: { enabled: true, mode: "text" },
    },
    floodByLevel: {
      soft: { enabled: true, messageLimit: 4, windowSeconds: 10 },
      normal: { enabled: true, messageLimit: 3, windowSeconds: 10 },
      strict: { enabled: true, messageLimit: 2, windowSeconds: 10 },
    },
    quarantineByLevel: {
      soft: { enabled: true, strictness: "strict" },
      normal: { enabled: true, strictness: "strict" },
      strict: { enabled: true, strictness: "strict" },
    },
    requireMembershipGate: false,
    welcomeText:
      "Bienvenido/a {first_name}. Este grupo esta bajo proteccion reforzada temporalmente.",
    rulesText:
      "1. Nada de enlaces, menciones ni contenido multimedia mientras dure la proteccion.\n2. Cualquier comportamiento sospechoso sera sancionado sin previo aviso.",
  },
  {
    id: "anuncios",
    name: "Anuncios",
    description:
      "Canal de solo lectura para avisos: bloquea casi toda interaccion salvo la de los administradores.",
    locksByLevel: {
      soft: [...STRICT_LOCKS, "photo", "video", "sticker", "gif"],
      normal: [
        ...STRICT_LOCKS,
        "photo",
        "video",
        "sticker",
        "gif",
        "document",
        "audio",
        "voice",
      ],
      strict: [
        ...STRICT_LOCKS,
        "photo",
        "video",
        "sticker",
        "gif",
        "document",
        "audio",
        "voice",
        "contact",
        "location",
        "poll",
        "text",
      ],
    },
    captchaByLevel: {
      soft: { enabled: false, mode: "button" },
      normal: { enabled: false, mode: "button" },
      strict: { enabled: false, mode: "button" },
    },
    floodByLevel: {
      soft: { enabled: false, messageLimit: 10, windowSeconds: 10 },
      normal: { enabled: true, messageLimit: 3, windowSeconds: 10 },
      strict: { enabled: true, messageLimit: 1, windowSeconds: 10 },
    },
    quarantineByLevel: {
      soft: { enabled: false, strictness: "balanced" },
      normal: { enabled: false, strictness: "balanced" },
      strict: { enabled: false, strictness: "balanced" },
    },
    requireMembershipGate: false,
    welcomeText:
      "Bienvenido/a {first_name} al canal de avisos de {chat_title}.",
    rulesText:
      "1. Solo el equipo publica en este canal.\n2. Usa los comentarios con respeto.",
  },
  {
    id: "soporte",
    name: "Soporte",
    description:
      "Para grupos de atencion al cliente: prioriza mensajes ordenados y evita ruido publicitario.",
    locksByLevel: {
      soft: ["via_bot"],
      normal: ["via_bot", "forward", "mention"],
      strict: ["via_bot", "forward", "mention", "url"],
    },
    captchaByLevel: {
      soft: { enabled: false, mode: "button" },
      normal: { enabled: true, mode: "button" },
      strict: { enabled: true, mode: "button" },
    },
    floodByLevel: {
      soft: { enabled: true, messageLimit: 8, windowSeconds: 10 },
      normal: { enabled: true, messageLimit: 6, windowSeconds: 10 },
      strict: { enabled: true, messageLimit: 4, windowSeconds: 10 },
    },
    quarantineByLevel: {
      soft: { enabled: false, strictness: "balanced" },
      normal: { enabled: true, strictness: "balanced" },
      strict: { enabled: true, strictness: "balanced" },
    },
    requireMembershipGate: false,
    welcomeText:
      "Hola {first_name}, cuentanos en que podemos ayudarte en {chat_title}.",
    rulesText:
      "1. Explica tu problema con el mayor detalle posible.\n2. Un agente te respondera en breve.\n3. Manten el respeto en todo momento.",
  },
];

const PLAYBOOK_BY_ID = new Map(
  PLAYBOOKS.map((playbook) => [playbook.id, playbook]),
);

export const isWizardPlaybookId = (value: string): value is WizardPlaybookId =>
  PLAYBOOK_BY_ID.has(value as WizardPlaybookId);

const chatIdSchema = z
  .string()
  .regex(/^-?\d+$/u)
  .optional();

const applyWizardSchema = z.object({
  playbook: z.string(),
  security: z.enum(["soft", "normal", "strict"]),
  staffChatId: chatIdSchema,
  logsChatId: chatIdSchema,
  supportChatId: chatIdSchema,
});

type ApplyWizardInput = z.infer<typeof applyWizardSchema>;

@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class MiniappWizardController {
  private readonly welcome = new PrismaWelcomeRepository();
  private readonly flood = new PrismaAntifloodRepository();
  private readonly captcha = new PrismaCaptchaRepository();
  private readonly locks = new PrismaContentLockRepository();
  private readonly hygiene = new PrismaGroupProtectionRepository();
  private readonly d1 = new PrismaD1Repository();
  private readonly foundation = new PrismaFoundationRepository();

  // Explicit @Inject: tsx/esbuild does not emit decorator metadata.
  constructor(
    @Inject(MiniappAdminService) private readonly admin: MiniappAdminService,
  ) {}

  @Get("groups/:gid/wizard/playbooks")
  async playbooks(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    await this.authorize(req, gid);
    return {
      playbooks: PLAYBOOKS.map((playbook) => ({
        id: playbook.id,
        name: playbook.name,
        description: playbook.description,
      })),
    };
  }

  @Post("groups/:gid/wizard/apply")
  async apply(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const parsed = applyWizardSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }
    if (!isWizardPlaybookId(parsed.data.playbook)) {
      throw new BadRequestException({ error: "invalid-playbook" });
    }

    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    const playbook = PLAYBOOK_BY_ID.get(parsed.data.playbook);
    if (!playbook) {
      throw new BadRequestException({ error: "invalid-playbook" });
    }

    await this.applyPlaybook(playbook, parsed.data, chat);

    await this.foundation.recordAudit({
      tenantId: chat.tenantId,
      actorType: "user",
      action: "miniapp.wizard.applied",
      resourceType: "chat_settings",
      resourceId: gid,
      payload: {
        playbook: playbook.id,
        security: parsed.data.security,
        source: "miniapp",
        telegramUserId: ctx.userId,
      },
    });

    return {
      ok: true,
      playbook: playbook.id,
      security: parsed.data.security,
    };
  }

  private async applyPlaybook(
    playbook: WizardPlaybookDefinition,
    input: ApplyWizardInput,
    chat: { tenantId: string; chatId: string; telegramChatId: string },
  ): Promise<void> {
    const level = input.security;
    const captchaSettings = playbook.captchaByLevel[level];
    const floodSettings = playbook.floodByLevel[level];
    const quarantineSettings = playbook.quarantineByLevel[level];
    const locked = playbook.locksByLevel[level];

    await Promise.all([
      this.captcha.upsertConfig(chat.tenantId, chat.chatId, {
        enabled: captchaSettings.enabled,
        mode: captchaSettings.mode,
        failAction: "mute",
        timeoutSeconds: 120,
        maxAttempts: 3,
      }),
      this.flood.upsertConfig(chat.tenantId, chat.chatId, {
        enabled: floodSettings.enabled,
        messageLimit: floodSettings.messageLimit,
        windowSeconds: floodSettings.windowSeconds,
        action: "mute",
      }),
      this.locks.setLocked(chat.tenantId, chat.chatId, locked),
      this.d1.setQuarantineConfig(chat.tenantId, chat.chatId, {
        enabled: quarantineSettings.enabled,
        strictness: quarantineSettings.strictness,
      }),
      this.welcome.upsertConfig(chat.tenantId, chat.chatId, {
        welcomeText: playbook.welcomeText,
        rulesText: playbook.rulesText,
      }),
      this.hygiene.setMembershipGate(
        chat.tenantId,
        chat.chatId,
        BigInt(chat.telegramChatId),
        playbook.requireMembershipGate && input.staffChatId
          ? BigInt(input.staffChatId)
          : null,
      ),
      this.applyLogsDestination(chat, input),
    ]);
  }

  /**
   * `logsChatId` is the explicit destination for D1 event logs. When absent,
   * `staffChatId` or `supportChatId` (in that order) act as a fallback so the
   * wizard still centralizes logs somewhere useful for playbooks that ask for
   * a staff/support chat but not a dedicated logs chat.
   */
  private async applyLogsDestination(
    chat: { tenantId: string; chatId: string },
    input: ApplyWizardInput,
  ): Promise<void> {
    const target = input.logsChatId ?? input.staffChatId ?? input.supportChatId;
    if (!target) {
      return;
    }
    await this.d1.setLogChannel(chat.tenantId, chat.chatId, BigInt(target));
  }

  private async authorize(req: MiniappRequest, gid: string) {
    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    await this.admin.assertGroupAdmin(gid, ctx.userId, bot);
    return this.admin.resolveChat(gid, bot);
  }
}

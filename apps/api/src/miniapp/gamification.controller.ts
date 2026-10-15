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
  PrismaChatSettingRepository,
  PrismaFederationRepository,
  PrismaGamificationRepository,
  PrismaReputationRepository,
} from "@superbot/data";
import {
  GROUP_CURRENCY_SETTINGS_KEY,
  PURGE_SETTINGS_KEY,
  parseGroupCurrencySettings,
  parsePurgeSettings,
  parseShopSettings,
  parseStealSettings,
  SHOP_CATALOG,
  SHOP_SETTINGS_KEY,
  STEAL_SETTINGS_KEY,
} from "@superbot/module-games";
import { z } from "zod";
import { MiniappAdminService } from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./init-data.guard.js";

const NETWORK_RANKING_LIMIT = 20;
const GROUP_RANKING_LIMIT = 20;

const welcomeButtonsSchema = z.object({
  rules: z.boolean(),
  otherGroups: z.boolean(),
  support: z.boolean(),
  verify: z.boolean(),
});

/**
 * Robo y purga van juntos en un endpoint porque se configuran juntos: la purga
 * no significa nada si robar esta apagado, y quien entra a tocar uno entra a
 * mirar el otro.
 *
 * Los topes de porcentaje son de cordura. Un `baseChancePct` de 500 no daria un
 * error visible: daria un grupo donde robar sale siempre bien y nadie sabe por
 * que. La ventana horaria se valida entera en `parsePurgeSettings`, que rechaza
 * las que no avanzan.
 */
const stealSchema = z.object({
  enabled: z.boolean(),
  baseChancePct: z.number().int().min(0).max(100),
  maxChancePct: z.number().int().min(0).max(100),
  chancePerLevelPct: z.number().int().min(0).max(100),
  lootPct: z.number().int().min(0).max(100),
  lootMax: z.number().int().min(0).max(1_000_000),
  finePct: z.number().int().min(0).max(100),
  fineMax: z.number().int().min(0).max(1_000_000),
  cooldownSeconds: z.number().int().min(0).max(86_400),
  victimShieldSeconds: z.number().int().min(0).max(604_800),
  minVictimBalance: z.number().int().min(0).max(1_000_000),
});

const purgeSchema = z.object({
  enabled: z.boolean(),
  durationMinutes: z.number().int().min(1).max(120),
  windowStartHour: z.number().int().min(0).max(23),
  windowEndHour: z.number().int().min(1).max(24),
});

const economyRulesSchema = z.object({
  steal: stealSchema,
  purge: purgeSchema,
});

/**
 * Los ajustes de la tienda del grupo.
 *
 * `precios` viaja como diccionario abierto y lo estrecha `parseShopSettings`,
 * que descarta los ids que no existen y los importes que no valen. Aqui solo se
 * comprueba la forma: la lista de objetos vive en el catalogo, y duplicarla en
 * un enum de zod garantizaria que un dia las dos dejen de coincidir.
 *
 * El tope de 10 millones no es estetico: un cero de mas en el precio de una
 * mordaza la deja fuera del alcance de todo el mundo, y uno de menos la regala.
 */
const shopSchema = z.object({
  enabled: z.boolean(),
  precios: z.record(z.string(), z.number().int().min(0).max(10_000_000)),
  apagados: z.array(z.string().max(32)).max(64),
  exentosMute: z.array(z.string().max(24)).max(200),
  muteVictimCooldownSeconds: z.number().int().min(0).max(86_400),
  muteGraceSeconds: z.number().int().min(0).max(86_400),
  vaultBase: z.number().int().min(0).max(10_000_000),
});

/**
 * Los ajustes de la moneda del grupo.
 *
 * Los topes son de cordura, no de estilo: `porMensaje` y `cupoDiario` deciden
 * cuanto dinero se crea de la nada cada dia, asi que un cero de mas escrito sin
 * querer en la Mini App infla la economia del grupo entero de golpe.
 *
 * El nombre se guarda tal y como lo escribio el admin; quien lo lee lo sanea con
 * `parseGroupCurrencySettings`. Guardar ya destruido impediria cambiar de
 * criterio mas adelante sin haber perdido el original.
 */
const currencySchema = z.object({
  enabled: z.boolean(),
  nombre: z.string().max(64),
  simbolo: z.string().max(16),
  porMensaje: z.number().int().positive().max(1_000),
  cupoDiario: z.number().int().positive().max(1_000_000),
  minCaracteres: z.number().int().min(0).max(200),
  cooldownSegundos: z.number().int().min(0).max(86_400),
  premioPartida: z.number().int().min(0).max(1_000_000),
  monedasPorFicha: z.number().int().min(0).max(1_000_000),
  comisionVentaPct: z.number().int().min(0).max(100),
});

@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class MiniappGamificationController {
  private readonly federation = new PrismaFederationRepository();
  private readonly gamification = new PrismaGamificationRepository();
  private readonly reputation = new PrismaReputationRepository();
  private readonly chatSettings = new PrismaChatSettingRepository();

  constructor(
    @Inject(MiniappAdminService) private readonly admin: MiniappAdminService,
  ) {}

  @Get("groups/:gid/gamification")
  async status(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const auth = await this.authorize(req, gid);
    const groupRanking = await this.reputation.top(
      auth.chat.chatId,
      GROUP_RANKING_LIMIT,
    );

    const [fed, welcomeButtons] = await Promise.all([
      this.federation.getFederationForChat(auth.chat.chatId),
      this.gamification.getWelcomeButtons(auth.chat.tenantId, auth.chat.chatId),
    ]);
    if (!fed) {
      return {
        inNetwork: false as const,
        welcomeButtons,
        groupRanking: groupRanking.map((row) => ({
          telegramUserId: row.telegramUserId.toString(),
          points: row.points,
        })),
      };
    }

    const [missions, badges, networkRanking] = await Promise.all([
      this.gamification.ensureMissions(
        auth.chat.tenantId,
        fed.fedId,
        auth.userId,
      ),
      this.gamification.listBadges(fed.fedId, auth.userId),
      this.gamification.getNetworkRanking(fed.fedId, NETWORK_RANKING_LIMIT),
    ]);

    return {
      inNetwork: true as const,
      fedId: fed.fedId,
      welcomeButtons,
      missions: missions.map((mission) => ({
        kind: mission.kind,
        completed: mission.completedAt !== null,
        completedAt: mission.completedAt?.toISOString() ?? null,
      })),
      badges,
      networkRanking: networkRanking.map((row) => ({
        telegramUserId: row.telegramUserId.toString(),
        badgeCount: row.badgeCount,
      })),
      groupRanking: groupRanking.map((row) => ({
        telegramUserId: row.telegramUserId.toString(),
        points: row.points,
      })),
    };
  }

  @Post("groups/:gid/gamification/welcome-buttons")
  async updateWelcomeButtons(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const parsed = welcomeButtonsSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }

    const auth = await this.authorize(req, gid);
    const saved = await this.gamification.setWelcomeButtons(
      auth.chat.tenantId,
      auth.chat.chatId,
      parsed.data,
    );
    return {
      persisted: true as const,
      ...saved,
    };
  }

  /** Los ajustes de la moneda de este grupo, ya saneados y con defaults. */
  @Get("groups/:gid/currency")
  async currency(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const auth = await this.authorize(req, gid);
    const raw = await this.chatSettings.getValue(
      auth.chat.tenantId,
      auth.chat.chatId,
      GROUP_CURRENCY_SETTINGS_KEY,
    );
    return parseGroupCurrencySettings(raw);
  }

  @Post("groups/:gid/currency")
  async updateCurrency(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const parsed = currencySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }

    const auth = await this.authorize(req, gid);
    await this.chatSettings.setValue(
      auth.chat.tenantId,
      auth.chat.chatId,
      GROUP_CURRENCY_SETTINGS_KEY,
      parsed.data,
    );
    // Se devuelve lo que se vera de verdad en el chat, no lo que se envio: el
    // nombre pasa por el saneado y el admin merece enterarse ahi mismo si su
    // "*pavos*" se queda en "pavos".
    return {
      persisted: true as const,
      ...parseGroupCurrencySettings(parsed.data),
    };
  }

  /** Las reglas de robo y purga de este grupo, ya saneadas y con defaults. */
  @Get("groups/:gid/economy-rules")
  async economyRules(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const auth = await this.authorize(req, gid);
    const [steal, purge] = await Promise.all([
      this.chatSettings.getValue(
        auth.chat.tenantId,
        auth.chat.chatId,
        STEAL_SETTINGS_KEY,
      ),
      this.chatSettings.getValue(
        auth.chat.tenantId,
        auth.chat.chatId,
        PURGE_SETTINGS_KEY,
      ),
    ]);
    return {
      steal: parseStealSettings(steal),
      purge: parsePurgeSettings(purge),
    };
  }

  @Post("groups/:gid/economy-rules")
  async updateEconomyRules(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const parsed = economyRulesSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }

    const auth = await this.authorize(req, gid);
    await Promise.all([
      this.chatSettings.setValue(
        auth.chat.tenantId,
        auth.chat.chatId,
        STEAL_SETTINGS_KEY,
        parsed.data.steal,
      ),
      this.chatSettings.setValue(
        auth.chat.tenantId,
        auth.chat.chatId,
        PURGE_SETTINGS_KEY,
        parsed.data.purge,
      ),
    ]);
    // Se devuelve lo aplicado de verdad: `parsePurgeSettings` puede rechazar una
    // ventana que no avanza, y el admin tiene que verlo ahi mismo.
    return {
      persisted: true as const,
      steal: parseStealSettings(parsed.data.steal),
      purge: parsePurgeSettings(parsed.data.purge),
    };
  }

  /** Los ajustes de la tienda de este grupo, ya saneados y con defaults. */
  @Get("groups/:gid/shop-rules")
  async shopRules(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const auth = await this.authorize(req, gid);
    const guardado = await this.chatSettings.getValue(
      auth.chat.tenantId,
      auth.chat.chatId,
      SHOP_SETTINGS_KEY,
    );
    return {
      shop: parseShopSettings(guardado),
      // El catalogo viaja con los ajustes para que la pantalla no tenga que
      // llevar su propia copia de los objetos y los precios: una copia en el
      // cliente es una copia que se queda vieja en cuanto se retoca un numero.
      catalogo: SHOP_CATALOG.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        icono: item.icono,
        familia: item.familia,
        precio: item.precio,
        precioDinamico: item.precioDinamico === true,
      })),
    };
  }

  @Post("groups/:gid/shop-rules")
  async updateShopRules(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const parsed = shopSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }
    const auth = await this.authorize(req, gid);
    await this.chatSettings.setValue(
      auth.chat.tenantId,
      auth.chat.chatId,
      SHOP_SETTINGS_KEY,
      parsed.data,
    );
    // Se devuelve lo que se aplicara de verdad: `parseShopSettings` descarta
    // precios a cero y objetos que no existen, y el admin tiene que verlo aqui
    // y no descubrirlo cuando alguien intente comprar.
    return { persisted: true as const, shop: parseShopSettings(parsed.data) };
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
    };
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
}

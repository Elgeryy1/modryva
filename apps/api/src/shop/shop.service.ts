import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  type EconomyRepository,
  type InventoryRepository,
  PrismaChatSettingRepository,
  PrismaEconomyRepository,
  PrismaFoundationRepository,
  PrismaInventoryRepository,
  prisma,
} from "@superbot/data";
import {
  applyTemporaryName,
  availableItems,
  esJugueteId,
  formatRemaining,
  GROUP_CURRENCY_SETTINGS_KEY,
  isShopItemId,
  isUsable,
  JUGUETES,
  type OwnedItem,
  parseGroupCurrencySettings,
  parseShopSettings,
  priceOf,
  quotePurchase,
  SHOP_BY_ID,
  SHOP_SETTINGS_KEY,
  type ShopItemId,
  topeDeCajaFuerte,
} from "@superbot/module-games";
import { decodeStartParam, getRuntimeEnv } from "@superbot/shared";
import { HttpTelegramGateway } from "@superbot/telegram";
import { resolveGroupForCaller } from "../games/group-binding.js";
import { PetsService } from "../pets/pets.service.js";

/**
 * La tienda del grupo vista desde la Mini App.
 *
 * Solo lee y compra lo que NO le pasa a otra persona. Las mordazas y la fianza
 * se quedan fuera a proposito: le caen encima a alguien que no ha pedido nada, y
 * el chat es donde se ven —el anuncio publico es la mitad del freno—. Comprarlas
 * desde una pantalla privada quitaria justo eso.
 */
@Injectable()
export class ShopService {
  constructor(
    private readonly foundation = new PrismaFoundationRepository(),
    private readonly chatSettings = new PrismaChatSettingRepository(),
    private readonly economy: EconomyRepository = new PrismaEconomyRepository(),
    private readonly inventory: InventoryRepository = new PrismaInventoryRepository(),
    private readonly mascotas = new PetsService(),
    private readonly gateway = new HttpTelegramGateway(),
    private readonly client = prisma,
  ) {}

  /**
   * El tenant de ESTE bot, por su slug.
   *
   * Igual que en juegos y no por una variable de entorno: el mismo proceso
   * sirve la Mini App de varios bots, y un tenant fijo mezclaria las carteras de
   * unos con las de otros.
   */
  /**
   * El tope de la caja fuerte de ESTA persona.
   *
   * Tiene que dar lo mismo que el bot. Antes la API llamaba a `vaultLimitOf`
   * directamente, que no conoce la excepcion de
   * `ECONOMIA_CAJA_ILIMITADA_IDS`, asi que la Mini App seguia enseñando —y
   * aplicando— el tope normal a quien lo tenia levantado: la funcion
   * funcionaba por los comandos del bot y no por la Mini App.
   *
   * Es el mismo dato por dos caminos, y por eso pasa por la misma decision.
   */
  /** Si esta persona tiene la caja sin tope. */
  private tieneCajaSinTope(telegramUserId: bigint): boolean {
    return getRuntimeEnv().ECONOMIA_CAJA_ILIMITADA_IDS.some(
      (id) => id === telegramUserId,
    );
  }

  private topeDeCaja(
    tienda: Parameters<typeof topeDeCajaFuerte>[0],
    comprado: number,
    telegramUserId: bigint,
  ): number {
    return topeDeCajaFuerte(
      tienda,
      comprado,
      this.tieneCajaSinTope(telegramUserId),
    );
  }

  private async tenantId(bot: { username?: string }): Promise<string> {
    const botKey = (bot.username ?? getRuntimeEnv().TELEGRAM_BOT_USERNAME)
      .replace(/^@/u, "")
      .toLowerCase();
    const tenant = await this.client.tenant.findUnique({
      where: { slug: `telegram-${botKey}` },
    });
    if (!tenant) {
      throw new ServiceUnavailableException({ error: "no-tenant" });
    }
    return tenant.id;
  }

  /**
   * Resuelve el grupo del `start_param` y comprueba que quien pregunta esta
   * dentro.
   *
   * El `start_param` lo elige quien construye el enlace: la firma de Telegram
   * demuestra que paso por esta Mini App, no que esa persona tenga nada que ver
   * con ese grupo. Sin esta comprobacion, abrir
   * `t.me/<bot>/<app>?startapp=shop_<grupo_ajeno>` seria suficiente para
   * gastarse las monedas de otro sitio.
   */
  private async scope(
    startParam: string | null,
    userId: string,
    bot: { token?: string; username?: string } = {},
  ): Promise<{ tenantId: string; chatId: string; telegramUserId: bigint }> {
    const decoded = decodeStartParam(startParam);
    if (decoded?.kind !== "shop" || !decoded.groupId) {
      throw new ForbiddenException({ error: "not-a-group" });
    }
    const tenantId = await this.tenantId(bot);
    const telegramChatId = BigInt(decoded.groupId);
    const chat = await resolveGroupForCaller(
      { foundation: this.foundation, gateway: this.gateway },
      {
        tenantId,
        telegramChatId,
        telegramUserId: BigInt(userId),
        token: bot.token ?? getRuntimeEnv().TELEGRAM_BOT_TOKEN,
      },
    );
    if (!chat) {
      throw new ForbiddenException({ error: "not-in-a-group" });
    }
    return { tenantId, chatId: chat.chatId, telegramUserId: BigInt(userId) };
  }

  private async settingsOf(tenantId: string, chatId: string, nowMs: number) {
    const [tienda, moneda] = await Promise.all([
      this.chatSettings
        .getValue(tenantId, chatId, SHOP_SETTINGS_KEY)
        .catch(() => undefined),
      this.chatSettings
        .getValue(tenantId, chatId, GROUP_CURRENCY_SETTINGS_KEY)
        .catch(() => undefined),
    ]);
    return {
      tienda: parseShopSettings(tienda),
      currency: applyTemporaryName(parseGroupCurrencySettings(moneda), nowMs),
    };
  }

  /** El inventario en tipos del catalogo, descartando lo que ya no existe. */
  private async owned(
    tenantId: string,
    chatId: string,
    userId: bigint,
  ): Promise<OwnedItem[]> {
    const filas = await this.inventory.list(tenantId, chatId, userId);
    return filas
      .filter((fila) => isShopItemId(fila.itemId))
      .map((fila) => ({
        itemId: fila.itemId as ShopItemId,
        uses: fila.uses,
        ...(fila.expiresAtMs !== undefined
          ? { expiresAtMs: fila.expiresAtMs }
          : {}),
        ...(fila.payload !== undefined ? { payload: fila.payload } : {}),
      }));
  }

  /** Escaparate, saldo e inventario en una sola respuesta. */
  async view(
    startParam: string | null,
    userId: string,
    nowMs: number,
    bot?: { token?: string; username?: string },
  ) {
    const { tenantId, chatId, telegramUserId } = await this.scope(
      startParam,
      userId,
      bot ?? {},
    );
    const { tienda, currency } = await this.settingsOf(tenantId, chatId, nowMs);
    const [cartera, mio] = await Promise.all([
      this.economy.ensureWallet(tenantId, chatId, telegramUserId),
      this.owned(tenantId, chatId, telegramUserId),
    ]);
    const guardado = cartera.protectedBalance ?? 0;
    return {
      enabled: tienda.enabled,
      currency: { nombre: currency.nombre, simbolo: currency.simbolo },
      balance: cartera.balance,
      vault: {
        guardado,
        tope: this.topeDeCaja(tienda, cartera.vaultLimit ?? 0, telegramUserId),
        // La bandera va aparte del numero a proposito. Sin ella, la Mini App
        // tendria que reconocer el tope "infinito" comparando con
        // Number.MAX_SAFE_INTEGER, o sea repartir el mismo numero magico entre
        // dos repos — y el dia que cambie, uno de los dos se entera y el otro
        // no.
        sinTope: this.tieneCajaSinTope(telegramUserId),
        expuesto: Math.max(0, cartera.balance - guardado),
      },
      items: availableItems(tienda).map((item) => ({
        id: item.id,
        nombre: item.nombre,
        icono: item.icono,
        resumen: item.resumen,
        familia: item.familia,
        precio: item.precioDinamico ? null : priceOf(item, tienda),
        // Lo que le cae encima a otra persona no se vende desde aqui: se compra
        // en el chat, donde el grupo ve quien lo ha pagado.
        comprableAqui: !item.contraAlguien && !item.precioDinamico,
        pidePayload: item.pidePayload === true,
      })),
      inventario: mio
        .filter((o) => isUsable(o, nowMs))
        .map((o) => ({
          id: o.itemId,
          nombre: SHOP_BY_ID.get(o.itemId)?.nombre ?? o.itemId,
          icono: SHOP_BY_ID.get(o.itemId)?.icono ?? "",
          usos: o.uses,
          restante:
            o.expiresAtMs !== undefined
              ? formatRemaining(o.expiresAtMs - nowMs)
              : null,
          ...(o.payload !== undefined ? { texto: o.payload } : {}),
        })),
    };
  }

  /**
   * Comprar desde la pantalla.
   *
   * Mismo camino que el chat: decidir con el catalogo, cobrar con la operacion
   * atomica del repositorio y entregar despues. Lo que cambia es lo que NO se
   * puede pedir por aqui.
   */
  async buy(
    startParam: string | null,
    userId: string,
    itemId: string,
    payload: string | undefined,
    nowMs: number,
    bot?: { token?: string; username?: string },
  ) {
    const { tenantId, chatId, telegramUserId } = await this.scope(
      startParam,
      userId,
      bot ?? {},
    );
    const { tienda, currency } = await this.settingsOf(tenantId, chatId, nowMs);
    const item = isShopItemId(itemId) ? SHOP_BY_ID.get(itemId) : undefined;
    if (!item || item.contraAlguien || item.precioDinamico) {
      // Ni objetos inventados ni mordazas: aquellas van por el chat.
      throw new ForbiddenException({ error: "not-for-sale-here" });
    }
    const cartera = await this.economy.ensureWallet(
      tenantId,
      chatId,
      telegramUserId,
    );
    const presupuesto = quotePurchase({
      settings: tienda,
      itemId,
      balance: cartera.balance,
      payload: payload ?? "",
    });
    if (!presupuesto.ok || !presupuesto.item) {
      return {
        ok: false,
        error: presupuesto.refusal ?? "no",
        precio: presupuesto.precio,
        balance: cartera.balance,
      };
    }
    const refId = `mini:${nowMs}:${item.id}:${userId}`;
    const cobro = await this.economy.debit(
      tenantId,
      chatId,
      telegramUserId,
      presupuesto.precio,
      "shop-buy",
      refId,
    );
    if (!cobro.ok) {
      return {
        ok: false,
        error: "insufficient",
        precio: presupuesto.precio,
        balance: cobro.balance,
      };
    }
    await this.inventory.recordPurchase({
      tenantId,
      chatId,
      userTelegramId: telegramUserId,
      itemId: item.id,
      price: presupuesto.precio,
    });

    if (item.id === "caja") {
      const tope = await this.economy.raiseVaultLimit(
        tenantId,
        chatId,
        telegramUserId,
        1000,
      );
      return {
        ok: true,
        balance: cobro.balance,
        vaultLimit: this.topeDeCaja(tienda, tope, telegramUserId),
        currency: { nombre: currency.nombre, simbolo: currency.simbolo },
      };
    }
    // Los juguetes. La decision es pura y vive en el modulo; aplicarla es cosa
    // de PetsService, que ya tiene el repositorio. Si no se puede aplicar se
    // DEVUELVE el dinero: en los tres motivos de fallo la mascota no recibe
    // nada, y cobrar por lo que no pasa es la mentira que este repo persigue.
    if (esJugueteId(item.id)) {
      const hecho = await this.mascotas.darJuguete({
        tenantId,
        chatId,
        usuario: telegramUserId,
        juguete: JUGUETES[item.id],
        ahora: new Date(),
      });
      if (hecho.ok) {
        return {
          ok: true,
          balance: cobro.balance,
          animo: hecho.animo,
          subida: hecho.subida,
          currency: { nombre: currency.nombre, simbolo: currency.simbolo },
        };
      }
      await this.economy.credit(
        tenantId,
        chatId,
        telegramUserId,
        presupuesto.precio,
        "shop-refund",
        refId,
      );
      return { ok: false, error: hecho.motivo };
    }

    if (item.hold.kind === "instantaneo") {
      // No hay nada mas instantaneo que se pueda comprar aqui hoy. Se devuelve
      // en vez de cobrar por algo que no ha pasado.
      await this.economy.credit(
        tenantId,
        chatId,
        telegramUserId,
        presupuesto.precio,
        "shop-refund",
        refId,
      );
      return {
        ok: false,
        error: "not-for-sale-here",
        balance: cartera.balance,
      };
    }

    const fila = await this.inventory.grant({
      tenantId,
      chatId,
      userTelegramId: telegramUserId,
      itemId: item.id,
      ...(item.hold.kind === "consumible" ? { addUses: item.hold.usos } : {}),
      ...(item.hold.kind === "temporal"
        ? { extendMs: item.hold.segundos * 1000 }
        : {}),
      ...(item.pidePayload && payload ? { payload } : {}),
      nowMs,
    });
    return {
      ok: true,
      balance: cobro.balance,
      item: {
        id: item.id,
        usos: fila.uses,
        restante:
          fila.expiresAtMs !== undefined
            ? formatRemaining(fila.expiresAtMs - nowMs)
            : null,
      },
      currency: { nombre: currency.nombre, simbolo: currency.simbolo },
    };
  }

  /** Meter o sacar de la caja fuerte. `amount` positivo guarda, negativo saca. */
  async vault(
    startParam: string | null,
    userId: string,
    amount: number,
    nowMs: number,
    bot?: { token?: string; username?: string },
  ) {
    const { tenantId, chatId, telegramUserId } = await this.scope(
      startParam,
      userId,
      bot ?? {},
    );
    const { tienda } = await this.settingsOf(tenantId, chatId, nowMs);
    const cartera = await this.economy.ensureWallet(
      tenantId,
      chatId,
      telegramUserId,
    );
    const tope = this.topeDeCaja(
      tienda,
      cartera.vaultLimit ?? 0,
      telegramUserId,
    );
    const res = await this.economy.moveToVault({
      tenantId,
      chatId,
      userTelegramId: telegramUserId,
      amount: Math.trunc(amount),
      limit: tope,
    });
    return {
      ok: res.ok,
      // `error` solo existe en la rama de fallo de la union.
      ...(res.ok ? {} : { error: res.error }),
      guardado: res.protectedBalance,
      tope,
      expuesto: Math.max(0, res.balance - res.protectedBalance),
      balance: res.balance,
    };
  }
}

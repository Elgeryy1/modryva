import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * El inventario de la tienda del grupo y el historico de compras.
 *
 * Deliberadamente ignorante del catalogo: aqui `itemId` es una cadena y nada
 * mas. Que la navaja se gaste y el escudo caduque lo decide
 * @superbot/module-games, que es donde estan los precios y las duraciones; una
 * copia de esas reglas aqui abajo seria una copia que se queda vieja el dia que
 * alguien retoque un numero.
 *
 * Lo que si vive aqui es lo que tiene que ser ATOMICO. Gastar un objeto es la
 * operacion delicada del modulo: dos robos a la vez con la misma navaja tienen
 * que gastar una navaja, no dos golpes con la misma.
 */

/** Una fila del inventario, ya en tipos de dominio. */
export interface InventoryItem {
  readonly itemId: string;
  readonly uses: number;
  /** Epoch en ms, o undefined si el objeto no caduca. */
  readonly expiresAtMs?: number;
  readonly payload?: string;
}

/** Una compra del historico. */
export interface ShopPurchaseRow {
  readonly itemId: string;
  readonly userTelegramId: bigint;
  readonly targetTelegramId?: bigint;
  readonly price: number;
  readonly createdAt: Date;
}

export interface InventoryRepository {
  /** Todo lo que tiene esta persona en este chat, caducado incluido. Filtrar
   * es cosa de quien llama: el catalogo es quien sabe que significa cada fila. */
  list(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
  ): Promise<readonly InventoryItem[]>;
  /**
   * Mete un objeto en el inventario.
   *
   * `addUses` suma (la segunda navaja son dos golpes) y `extendMs` alarga desde
   * donde estaba, no desde ahora: comprar el segundo escudo teniendo uno a
   * medias no puede tirar lo que quedaba del primero. Devuelve como queda la
   * fila, que es lo que hace falta para decir "te dura hasta las 21:40".
   */
  grant(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    itemId: string;
    addUses?: number;
    extendMs?: number;
    payload?: string;
    nowMs: number;
  }): Promise<InventoryItem>;
  /**
   * Gasta un uso. `ok:false` significa "no le quedaba", no un error.
   *
   * Es la operacion que no puede fallar de forma barata: si dos golpes
   * simultaneos pudieran gastar la misma navaja, el objeto de pago mas caro del
   * juego seria gratis a base de escribir rapido.
   */
  consume(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    itemId: string;
    nowMs: number;
  }): Promise<{ ok: boolean; remaining: number }>;
  /** Anota una compra en el historico. */
  recordPurchase(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    itemId: string;
    price: number;
    targetTelegramId?: bigint;
  }): Promise<void>;
  /**
   * La ultima compra dirigida contra esta persona de entre esos objetos, o null.
   *
   * De aqui salen las dos cuentas de la mordaza: cuanto cuesta la fianza (el
   * doble de lo que costo) y si le compraron otra hace demasiado poco.
   */
  lastPurchaseAgainst(
    tenantId: string,
    chatId: string,
    targetTelegramId: bigint,
    itemIds: readonly string[],
  ): Promise<ShopPurchaseRow | null>;
}

/**
 * Hasta cuando vale un objeto temporal tras alargarlo.
 *
 * Misma regla que `extendedExpiry` del catalogo, y a proposito: alli decide lo
 * que se le PROMETE a alguien antes de pagar, y aqui decide lo que se ESCRIBE.
 * La de aqui es la que no se puede saltar ninguna llamada futura, igual que la
 * guarda de importes del libro mayor se comprueba en el repositorio ademas de
 * en el parser del comando.
 */
const alargar = (
  nowMs: number,
  extendMs: number,
  actual: Date | null,
): Date => {
  const actualMs = actual?.getTime() ?? 0;
  const desde = actualMs > nowMs ? actualMs : nowMs;
  return new Date(desde + extendMs);
};

const aDominio = (row: {
  itemId: string;
  uses: number;
  expiresAt: Date | null;
  payload: string | null;
}): InventoryItem => ({
  itemId: row.itemId,
  uses: row.uses,
  ...(row.expiresAt ? { expiresAtMs: row.expiresAt.getTime() } : {}),
  ...(row.payload !== null ? { payload: row.payload } : {}),
});

export class PrismaInventoryRepository implements InventoryRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async list(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
  ): Promise<readonly InventoryItem[]> {
    const rows = await this.client.userItem.findMany({
      where: { tenantId, chatId, userTelegramId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(aDominio);
  }

  async grant(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    itemId: string;
    addUses?: number;
    extendMs?: number;
    payload?: string;
    nowMs: number;
  }): Promise<InventoryItem> {
    const { tenantId, chatId, userTelegramId, itemId } = input;
    const key = {
      tenantId_chatId_userTelegramId_itemId: {
        tenantId,
        chatId,
        userTelegramId,
        itemId,
      },
    };
    // La lectura y la escritura van juntas porque alargar necesita saber por
    // donde iba. Fuera de la transaccion, dos compras a la vez leerian el mismo
    // "hasta" y la segunda escribiria encima de la primera: quien pago dos
    // escudos se quedaria con uno.
    const row = await this.client.$transaction(async (tx) => {
      const actual = await tx.userItem.findUnique({ where: key });
      const expiresAt =
        input.extendMs === undefined
          ? (actual?.expiresAt ?? null)
          : alargar(input.nowMs, input.extendMs, actual?.expiresAt ?? null);
      const uses = input.addUses ?? 0;
      if (!actual) {
        return tx.userItem.create({
          data: {
            tenantId,
            chatId,
            userTelegramId,
            itemId,
            // Un temporal no gasta usos, pero la fila nace con 1 para que
            // `isUsable` no lo lea como agotado nada mas comprarlo.
            uses: uses > 0 ? uses : 1,
            expiresAt,
            payload: input.payload ?? null,
          },
        });
      }
      return tx.userItem.update({
        where: key,
        data: {
          // Un consumible agotado (uses a 0) tiene que volver a 1 al comprarlo,
          // no quedarse en 0 + 1 por casualidad: el incremento lo hace bien
          // porque nunca se baja de 0.
          ...(uses > 0 ? { uses: { increment: uses } } : {}),
          expiresAt,
          // El payload solo se pisa si viene uno nuevo: renovar el mote sin
          // escribirlo otra vez no puede dejar a nadie sin mote.
          ...(input.payload !== undefined ? { payload: input.payload } : {}),
        },
      });
    });
    return aDominio(row);
  }

  async consume(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    itemId: string;
    nowMs: number;
  }): Promise<{ ok: boolean; remaining: number }> {
    const { tenantId, chatId, userTelegramId, itemId } = input;
    const ahora = new Date(input.nowMs);
    // La condicion entera va en el WHERE, igual que el saldo en `debit`: dos
    // golpes simultaneos no pueden gastar los dos, porque el segundo no
    // encuentra fila que cumpla `gte: 1`. Con un `findUnique` y un `update`
    // detras, los dos leerian 1 y los dos restarian.
    const gastado = await this.client.userItem.updateMany({
      where: {
        tenantId,
        chatId,
        userTelegramId,
        itemId,
        uses: { gte: 1 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: ahora } }],
      },
      data: { uses: { decrement: 1 } },
    });
    if (gastado.count === 0) {
      const fila = await this.client.userItem.findUnique({
        where: {
          tenantId_chatId_userTelegramId_itemId: {
            tenantId,
            chatId,
            userTelegramId,
            itemId,
          },
        },
      });
      return { ok: false, remaining: fila?.uses ?? 0 };
    }
    const fila = await this.client.userItem.findUnique({
      where: {
        tenantId_chatId_userTelegramId_itemId: {
          tenantId,
          chatId,
          userTelegramId,
          itemId,
        },
      },
    });
    return { ok: true, remaining: fila?.uses ?? 0 };
  }

  async recordPurchase(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    itemId: string;
    price: number;
    targetTelegramId?: bigint;
  }): Promise<void> {
    await this.client.shopPurchase.create({
      data: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        userTelegramId: input.userTelegramId,
        itemId: input.itemId,
        price: input.price,
        targetTelegramId: input.targetTelegramId ?? null,
      },
    });
  }

  async lastPurchaseAgainst(
    tenantId: string,
    chatId: string,
    targetTelegramId: bigint,
    itemIds: readonly string[],
  ): Promise<ShopPurchaseRow | null> {
    if (itemIds.length === 0) {
      return null;
    }
    const row = await this.client.shopPurchase.findFirst({
      where: {
        tenantId,
        chatId,
        targetTelegramId,
        itemId: { in: [...itemIds] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!row) {
      return null;
    }
    return {
      itemId: row.itemId,
      userTelegramId: row.userTelegramId,
      ...(row.targetTelegramId !== null
        ? { targetTelegramId: row.targetTelegramId }
        : {}),
      price: row.price,
      createdAt: row.createdAt,
    };
  }
}

/** Store en memoria usado como default del constructor (tests). */
export class InMemoryInventoryRepository implements InventoryRepository {
  private items = new Map<
    string,
    { uses: number; expiresAt: Date | null; payload: string | null }
  >();
  private purchases: (ShopPurchaseRow & {
    tenantId: string;
    chatId: string;
  })[] = [];

  private key(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    itemId: string,
  ): string {
    return `${tenantId}:${chatId}:${userTelegramId.toString()}:${itemId}`;
  }

  async list(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
  ): Promise<readonly InventoryItem[]> {
    const prefijo = `${tenantId}:${chatId}:${userTelegramId.toString()}:`;
    return [...this.items.entries()]
      .filter(([key]) => key.startsWith(prefijo))
      .map(([key, row]) =>
        aDominio({ itemId: key.slice(prefijo.length), ...row }),
      );
  }

  async grant(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    itemId: string;
    addUses?: number;
    extendMs?: number;
    payload?: string;
    nowMs: number;
  }): Promise<InventoryItem> {
    const key = this.key(
      input.tenantId,
      input.chatId,
      input.userTelegramId,
      input.itemId,
    );
    const actual = this.items.get(key);
    const uses = input.addUses ?? 0;
    const fila = {
      uses: actual ? actual.uses + uses : uses > 0 ? uses : 1,
      expiresAt:
        input.extendMs === undefined
          ? (actual?.expiresAt ?? null)
          : alargar(input.nowMs, input.extendMs, actual?.expiresAt ?? null),
      payload: input.payload ?? actual?.payload ?? null,
    };
    this.items.set(key, fila);
    return aDominio({ itemId: input.itemId, ...fila });
  }

  async consume(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    itemId: string;
    nowMs: number;
  }): Promise<{ ok: boolean; remaining: number }> {
    const key = this.key(
      input.tenantId,
      input.chatId,
      input.userTelegramId,
      input.itemId,
    );
    const fila = this.items.get(key);
    if (!fila || fila.uses < 1) {
      return { ok: false, remaining: fila?.uses ?? 0 };
    }
    if (fila.expiresAt !== null && fila.expiresAt.getTime() <= input.nowMs) {
      return { ok: false, remaining: fila.uses };
    }
    const remaining = fila.uses - 1;
    this.items.set(key, { ...fila, uses: remaining });
    return { ok: true, remaining };
  }

  async recordPurchase(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    itemId: string;
    price: number;
    targetTelegramId?: bigint;
  }): Promise<void> {
    this.purchases.push({
      tenantId: input.tenantId,
      chatId: input.chatId,
      itemId: input.itemId,
      userTelegramId: input.userTelegramId,
      ...(input.targetTelegramId !== undefined
        ? { targetTelegramId: input.targetTelegramId }
        : {}),
      price: input.price,
      createdAt: new Date(),
    });
  }

  async lastPurchaseAgainst(
    tenantId: string,
    chatId: string,
    targetTelegramId: bigint,
    itemIds: readonly string[],
  ): Promise<ShopPurchaseRow | null> {
    const candidatas = this.purchases.filter(
      (p) =>
        p.tenantId === tenantId &&
        p.chatId === chatId &&
        p.targetTelegramId === targetTelegramId &&
        itemIds.includes(p.itemId),
    );
    // El ultimo del array es el mas reciente: el orden de insercion es el orden
    // real, y con fechas iguales al milisegundo ordenar por fecha no lo seria.
    return candidatas.at(-1) ?? null;
  }
}

import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";
import {
  abonarSaldoDeCartera,
  cobrarSaldoDeCartera,
} from "./economy-repository.js";
import { commitOf, newClientSeed, newServerSeed } from "./fair-seeds.js";

/**
 * El cambio entre la moneda del grupo y las fichas del casino.
 *
 * Vive en su propio fichero, y no dentro de una de las dos carteras, porque una
 * operacion que mueve las dos tiene que ocurrir entera o no ocurrir: cobrar las
 * monedas y no entregar las fichas deja a alguien robado por el bot. Ponerla en
 * `chip-repository` o en `economy-repository` habria obligado a esa clase a
 * escribir en tablas que no son suyas.
 *
 * Va en los dos sentidos, pero NO son simetricos y ahi esta lo importante:
 *
 * - monedas -> fichas: libre. Las monedas se ganan hablando, no se compran.
 * - fichas -> monedas: acotado. Solo salen las GANANCIAS del juego; lo comprado
 *   con Telegram Stars no se puede cambiar, porque las monedas se donan y se
 *   roban y eso convertiria un robo en la perdida de algo pagado con dinero.
 *
 * Ese limite lo calcula `ChipRepository.sellableChips` y se recomprueba dentro
 * de la transaccion de venta. Es lo unico que separa esto de un cash-out: leer
 * el comentario de `CHIP_REASONS` antes de tocarlo.
 */

export type ExchangeError =
  /** El grupo no ha puesto precio: el cambio esta apagado. */
  | "disabled"
  /** Cantidad no positiva. */
  | "invalid-amount"
  /** No tiene monedas suficientes. */
  | "insufficient"
  /** Tiene fichas, pero son de las compradas con Stars y esas no salen. */
  | "locked";

/**
 * Lo que devuelve vender fichas.
 *
 * Union discriminada por `ok`, igual que `ResultadoDeCaja` y por el mismo
 * motivo: con `error?` el tipo permitia `ok: false` **sin motivo**, y quien lo
 * consume tenia que rellenar ese hueco. El bot lo rellenaba afirmando "No
 * tienes tantas", que es falso para tres de los cuatro motivos — y se
 * contradecia en la misma frase, porque a continuacion decia cuantas fichas
 * cambiables tiene.
 *
 * El caso alcanzable hoy es `invalid-amount` cuando la comision se come la
 * venta entera: con `comisionVentaPct: 100` —que la Mini App acepta— o con
 * `monedasPorFicha: 1` y la comision por defecto del 20% al vender una sola
 * ficha, `coins` sale 0.
 */
export type SellResult = SellOk | SellFallo;

interface SellDatos {
  /** Fichas cambiadas. */
  readonly chips: number;
  /** Monedas entregadas, ya con la comision descontada. */
  readonly coins: number;
  /** Fichas que le quedan. */
  readonly chipBalance: number;
  /** Cuantas de esas puede cambiar todavia. */
  readonly sellable: number;
  /** Monedas que tiene ahora. */
  readonly coinBalance: number;
}

interface SellOk extends SellDatos {
  readonly ok: true;
}

interface SellFallo extends SellDatos {
  readonly ok: false;
  readonly error: ExchangeError;
}

/** Lo que devuelve comprar fichas. Misma forma y mismo motivo que arriba. */
export type ExchangeResult = ExchangeOk | ExchangeFallo;

interface ExchangeDatos {
  /** Fichas entregadas. */
  readonly chips: number;
  /** Monedas cobradas. */
  readonly cost: number;
  /** Monedas que le quedan. */
  readonly coinBalance: number;
  /** Fichas que tiene ahora. */
  readonly chipBalance: number;
}

interface ExchangeOk extends ExchangeDatos {
  readonly ok: true;
}

interface ExchangeFallo extends ExchangeDatos {
  readonly ok: false;
  readonly error: ExchangeError;
}

export interface ExchangeRepository {
  /**
   * Cambia monedas del grupo por fichas del casino.
   *
   * `costPerChip` viene de los ajustes del grupo; 0 o menos significa apagado.
   * `refId` hace el movimiento idempotente en los dos libros.
   */
  buyChipsWithCoins(input: {
    tenantId: string;
    chatId: string;
    telegramUserId: bigint;
    chips: number;
    costPerChip: number;
    refId: string;
  }): Promise<ExchangeResult>;
  /**
   * Cambia fichas por monedas del grupo.
   *
   * `feePct` es la comision de venta, y no es decoracion: las fichas son
   * globales pero el precio lo pone cada grupo, asi que sin diferencia entre
   * comprar y vender alguien podria comprar barato en un grupo y vender caro en
   * otro indefinidamente. La comision se lleva ese margen y ademas drena
   * moneda, que a una economia que solo crece le viene bien.
   *
   * El limite de cuanto puede salir NO se decide aqui: lo calcula
   * `sellableChips`, y se recomprueba DENTRO de la transaccion.
   */
  sellChipsForCoins(input: {
    tenantId: string;
    chatId: string;
    telegramUserId: bigint;
    chips: number;
    coinsPerChip: number;
    feePct: number;
    refId: string;
  }): Promise<SellResult>;
}

export class PrismaExchangeRepository implements ExchangeRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async buyChipsWithCoins(input: {
    tenantId: string;
    chatId: string;
    telegramUserId: bigint;
    chips: number;
    costPerChip: number;
    refId: string;
  }): Promise<ExchangeResult> {
    const { tenantId, chatId, telegramUserId, chips, costPerChip } = input;
    const vacio = { chips: 0, cost: 0, coinBalance: 0, chipBalance: 0 };

    if (costPerChip <= 0) {
      return { ok: false, error: "disabled", ...vacio };
    }
    // Enteros y positivos. Un negativo aqui invertiria la operacion: cobraria
    // fichas negativas y ABONARIA monedas, o sea imprimir dinero escribiendo un
    // guion.
    if (!Number.isInteger(chips) || chips <= 0) {
      return { ok: false, error: "invalid-amount", ...vacio };
    }
    const cost = chips * costPerChip;
    if (!Number.isSafeInteger(cost)) {
      return { ok: false, error: "invalid-amount", ...vacio };
    }

    const coinKey = {
      tenantId_chatId_userTelegramId: {
        tenantId,
        chatId,
        userTelegramId: telegramUserId,
      },
    };
    const chipKey = { tenantId_telegramUserId: { tenantId, telegramUserId } };

    return this.client.$transaction(async (tx) => {
      // El cobro de monedas es el mismo de siempre: la guarda de saldo va en el
      // WHERE, asi que dos cambios a la vez no pueden dejar el saldo negativo.
      // Una cartera con saldo sin fondo paga y no se mueve.
      const cobro = await cobrarSaldoDeCartera(
        tx,
        { tenantId, chatId, userTelegramId: telegramUserId },
        cost,
      );
      if (!cobro.pagado) {
        const fichas = await tx.chipWallet.findUnique({ where: chipKey });
        return {
          ok: false,
          error: "insufficient" as const,
          chips: 0,
          cost,
          coinBalance: cobro.balance,
          chipBalance: fichas?.balance ?? 0,
        };
      }
      await tx.economyLedger.create({
        data: {
          tenantId,
          chatId,
          telegramUserId,
          delta: -cost,
          reason: "exchange-out",
          refId: input.refId,
        },
      });

      // La cartera de fichas puede no existir todavia: quien nunca jugo no
      // tiene ninguna. Se crea con sus semillas, como haria el casino.
      const serverSeed = newServerSeed();
      const fichas = await tx.chipWallet.upsert({
        where: chipKey,
        create: {
          tenantId,
          telegramUserId,
          balance: chips,
          serverSeed,
          serverSeedHash: commitOf(serverSeed),
          clientSeed: newClientSeed(),
          nonce: 0,
        },
        update: { balance: { increment: chips } },
      });
      await tx.chipLedger.create({
        data: {
          tenantId,
          telegramUserId,
          delta: chips,
          reason: "exchange",
          refId: input.refId,
        },
      });

      const cartera = await tx.economyWallet.findUniqueOrThrow({
        where: coinKey,
      });
      return {
        ok: true,
        chips,
        cost,
        coinBalance: cartera.balance,
        chipBalance: fichas.balance,
      };
    });
  }

  async sellChipsForCoins(input: {
    tenantId: string;
    chatId: string;
    telegramUserId: bigint;
    chips: number;
    coinsPerChip: number;
    feePct: number;
    refId: string;
  }): Promise<SellResult> {
    const { tenantId, chatId, telegramUserId, chips, coinsPerChip } = input;
    const vacio = { chips: 0, coins: 0 };

    if (coinsPerChip <= 0) {
      const estado = await this.chipState(tenantId, telegramUserId, chatId);
      return { ok: false, error: "disabled", ...vacio, ...estado };
    }
    if (!Number.isInteger(chips) || chips <= 0) {
      const estado = await this.chipState(tenantId, telegramUserId, chatId);
      return { ok: false, error: "invalid-amount", ...vacio, ...estado };
    }

    const fee = Math.min(100, Math.max(0, input.feePct));
    const bruto = chips * coinsPerChip;
    const coins = Math.floor((bruto * (100 - fee)) / 100);
    if (!Number.isSafeInteger(bruto) || coins <= 0) {
      const estado = await this.chipState(tenantId, telegramUserId, chatId);
      return { ok: false, error: "invalid-amount", ...vacio, ...estado };
    }

    const chipKey = { tenantId_telegramUserId: { tenantId, telegramUserId } };
    const coinKey = {
      tenantId_chatId_userTelegramId: {
        tenantId,
        chatId,
        userTelegramId: telegramUserId,
      },
    };

    return this.client.$transaction(async (tx) => {
      // El limite se recomprueba DENTRO de la transaccion, no fuera: entre leer
      // "puedes vender 300" y ejecutar la venta puede haber entrado una compra
      // con Stars, y entonces esas 300 ya no serian ganancias.
      const bloqueado = await this.lockedInside(tx, tenantId, telegramUserId);
      const debited = await tx.chipWallet.updateMany({
        where: {
          tenantId,
          telegramUserId,
          // Las dos condiciones a la vez: le tienen que sobrar fichas Y esas
          // fichas no pueden ser de las compradas.
          balance: { gte: chips + bloqueado },
        },
        data: { balance: { decrement: chips } },
      });
      if (debited.count === 0) {
        const wallet = await tx.chipWallet.findUnique({ where: chipKey });
        const saldo = wallet?.balance ?? 0;
        const cartera = await tx.economyWallet.findUnique({ where: coinKey });
        return {
          ok: false,
          // Distinguir los dos "no" importa: "no tienes" y "lo que tienes es
          // dinero que pagaste" son problemas distintos y se arreglan distinto.
          error: (saldo >= chips ? "locked" : "insufficient") as ExchangeError,
          ...vacio,
          chipBalance: saldo,
          sellable: Math.max(0, saldo - bloqueado),
          coinBalance: cartera?.balance ?? 0,
        };
      }
      await tx.chipLedger.create({
        data: {
          tenantId,
          telegramUserId,
          delta: -chips,
          reason: "exchange-out",
          refId: input.refId,
        },
      });

      // La cartera de monedas puede no existir. Se crea VACIA y el abono va
      // despues: creandola con las monedas dentro habria que distinguir
      // "creada" de "ya estaba" para no pagar dos veces, y el upsert no lo
      // dice. Recien creada nunca es ilimitada, asi que el abono aparte es
      // ademas el unico sitio donde hace falta mirar la bandera.
      await tx.economyWallet.upsert({
        where: coinKey,
        create: {
          tenantId,
          chatId,
          userTelegramId: telegramUserId,
          balance: 0,
        },
        update: {},
      });
      await abonarSaldoDeCartera(
        tx,
        { tenantId, chatId, userTelegramId: telegramUserId },
        coins,
      );
      await tx.economyLedger.create({
        data: {
          tenantId,
          chatId,
          telegramUserId,
          delta: coins,
          reason: "exchange-in",
          refId: input.refId,
        },
      });

      const wallet = await tx.chipWallet.findUniqueOrThrow({ where: chipKey });
      const cartera = await tx.economyWallet.findUniqueOrThrow({
        where: coinKey,
      });
      return {
        ok: true,
        chips,
        coins,
        chipBalance: wallet.balance,
        sellable: Math.max(0, wallet.balance - bloqueado),
        coinBalance: cartera.balance,
      };
    });
  }

  /** Lo comprado con Stars que aun no se ha consumido jugando. Ver
   * `ChipRepository.sellableChips`, que aplica la misma regla. */
  private async lockedInside(
    tx: Pick<PrismaClient, "chipLedger">,
    tenantId: string,
    telegramUserId: bigint,
  ): Promise<number> {
    const [comprado, apostado, ganado] = await Promise.all([
      tx.chipLedger.aggregate({
        where: { tenantId, telegramUserId, reason: "purchase" },
        _sum: { delta: true },
      }),
      tx.chipLedger.aggregate({
        where: { tenantId, telegramUserId, reason: "bet" },
        _sum: { delta: true },
      }),
      tx.chipLedger.aggregate({
        where: { tenantId, telegramUserId, reason: "win" },
        _sum: { delta: true },
      }),
    ]);
    const perdidasNetas = Math.max(
      0,
      Math.abs(apostado._sum.delta ?? 0) - (ganado._sum.delta ?? 0),
    );
    return Math.max(0, (comprado._sum.delta ?? 0) - perdidasNetas);
  }

  private async chipState(
    tenantId: string,
    telegramUserId: bigint,
    chatId: string,
  ): Promise<{
    chipBalance: number;
    sellable: number;
    coinBalance: number;
  }> {
    const [wallet, cartera] = await Promise.all([
      this.client.chipWallet.findUnique({
        where: { tenantId_telegramUserId: { tenantId, telegramUserId } },
      }),
      this.client.economyWallet.findUnique({
        where: {
          tenantId_chatId_userTelegramId: {
            tenantId,
            chatId,
            userTelegramId: telegramUserId,
          },
        },
      }),
    ]);
    const bloqueado = await this.lockedInside(
      this.client,
      tenantId,
      telegramUserId,
    );
    const saldo = wallet?.balance ?? 0;
    return {
      chipBalance: saldo,
      sellable: Math.max(0, saldo - bloqueado),
      coinBalance: cartera?.balance ?? 0,
    };
  }
}

/** Store en memoria para las pruebas. */
export class InMemoryExchangeRepository implements ExchangeRepository {
  readonly calls: { chips: number; cost: number }[] = [];
  coins = 0;
  chips = 0;
  /** Fichas compradas con Stars que aun no se han consumido jugando. */
  locked = 0;

  async sellChipsForCoins(input: {
    tenantId: string;
    chatId: string;
    telegramUserId: bigint;
    chips: number;
    coinsPerChip: number;
    feePct: number;
    refId: string;
  }): Promise<SellResult> {
    const estado = () => ({
      chipBalance: this.chips,
      sellable: Math.max(0, this.chips - this.locked),
      coinBalance: this.coins,
    });
    const vacio = { chips: 0, coins: 0 };
    if (input.coinsPerChip <= 0) {
      return { ok: false, error: "disabled", ...vacio, ...estado() };
    }
    if (!Number.isInteger(input.chips) || input.chips <= 0) {
      return { ok: false, error: "invalid-amount", ...vacio, ...estado() };
    }
    const fee = Math.min(100, Math.max(0, input.feePct));
    const coins = Math.floor(
      (input.chips * input.coinsPerChip * (100 - fee)) / 100,
    );
    if (coins <= 0) {
      return { ok: false, error: "invalid-amount", ...vacio, ...estado() };
    }
    if (this.chips < input.chips + this.locked) {
      return {
        ok: false,
        error: this.chips >= input.chips ? "locked" : "insufficient",
        ...vacio,
        ...estado(),
      };
    }
    this.chips -= input.chips;
    this.coins += coins;
    return { ok: true, chips: input.chips, coins, ...estado() };
  }

  async buyChipsWithCoins(input: {
    tenantId: string;
    chatId: string;
    telegramUserId: bigint;
    chips: number;
    costPerChip: number;
    refId: string;
  }): Promise<ExchangeResult> {
    const vacio = { chips: 0, cost: 0 };
    if (input.costPerChip <= 0) {
      return {
        ok: false,
        error: "disabled",
        ...vacio,
        coinBalance: this.coins,
        chipBalance: this.chips,
      };
    }
    if (!Number.isInteger(input.chips) || input.chips <= 0) {
      return {
        ok: false,
        error: "invalid-amount",
        ...vacio,
        coinBalance: this.coins,
        chipBalance: this.chips,
      };
    }
    const cost = input.chips * input.costPerChip;
    if (this.coins < cost) {
      return {
        ok: false,
        error: "insufficient",
        chips: 0,
        cost,
        coinBalance: this.coins,
        chipBalance: this.chips,
      };
    }
    this.coins -= cost;
    this.chips += input.chips;
    this.calls.push({ chips: input.chips, cost });
    return {
      ok: true,
      chips: input.chips,
      cost,
      coinBalance: this.coins,
      chipBalance: this.chips,
    };
  }
}

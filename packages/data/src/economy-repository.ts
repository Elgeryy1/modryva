import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";
import { commitOf, newClientSeed, newServerSeed } from "./fair-seeds.js";

/**
 * Moneda del grupo: carteras SIN valor monetario, por tenant + chat + usuario.
 *
 * La logica pura (ganancia con cupo, caducidad, temporadas) vive en
 * @superbot/module-games (`economy`); aqui esta la persistencia y, sobre todo,
 * las operaciones que tienen que ser ATOMICAS: donar y robar mueven saldo entre
 * dos personas y las dos patas tienen que cuadrar o no ocurrir.
 *
 * Deliberadamente separada de `chip-repository`: aquellas son las fichas del
 * casino, unicas por bot y comprables con Telegram Stars. Estas se ganan
 * hablando y se pueden robar.
 *
 * SI hay conversion entre ambas (ver `exchange-repository`), pero acotada: solo
 * salen de fichas a monedas las GANANCIAS del juego, nunca lo comprado con
 * Stars. Ese limite es lo que impide que alguien pierda en un robo lo que pago
 * con dinero real, que es la razon por la que las dos carteras siguen siendo
 * dos y no una.
 */

/** Estado persistido de una cartera. `lastEarnedMs` es epoch en ms. */
export interface EconomyWalletState {
  readonly balance: number;
  readonly lastEarnedMs: number;
  /** Parte del saldo que /robar no puede tocar. Cuenta dentro de balance. */
  readonly protectedBalance?: number;
  /** Tope COMPRADO de la caja fuerte. El efectivo suma ademas el basico del
   * grupo, que es un ajuste del chat y no vive en esta tabla. */
  readonly vaultLimit?: number;
  /**
   * Saldo sin fondo: la cartera paga siempre y el numero NO se mueve, ni al
   * cobrar ni al abonar. El porque esta escrito en la columna `unlimited` del
   * esquema; lo que hay que recordar al leer un `balance` de una cartera asi es
   * que ya no es un saldo, es un adorno: la verdad esta en el libro mayor.
   */
  readonly unlimited?: boolean;
}

/**
 * Motivo de un movimiento. Cadena cerrada y no `string` libre: el libro mayor se
 * consulta por motivo (`/movimientos`, el resumen de la purga), y un typo
 * silencioso partiria un total en dos sin que nadie lo notara.
 */
export type EconomyReason =
  /**
   * Ajuste hecho a mano por el owner con `/ajustarsaldo`.
   *
   * Tiene motivo propio y no reutiliza otro a proposito: en el libro mayor hay
   * que poder distinguir lo que gano alguien jugando de lo que le puso o le
   * quito una persona. Sin eso, una auditoria de la economia no significa nada.
   */
  | "admin-adjust"
  /** Ganado hablando en el grupo. */
  | "earn"
  /** Salida de una donacion. */
  | "donate-out"
  /** Entrada de una donacion. */
  | "donate-in"
  /** Botin de un robo con exito. */
  | "steal-win"
  /** Lo que le quitaron a la victima. */
  | "steal-loss"
  /** Multa por un robo fallido. */
  | "fine"
  /** Compensacion a la victima de un robo fallido. */
  | "fine-payout"
  /** Lo apostado en un juego del chat. */
  | "bet"
  /** Lo cobrado por una apuesta ganadora. */
  | "win"
  /** Monedas gastadas al cambiarlas por fichas del casino. */
  | "exchange-out"
  /** Monedas recibidas al cambiar fichas del casino. */
  | "exchange-in"
  /** Gastado en la tienda del grupo. */
  | "shop-buy"
  /**
   * Lo que devuelve el seguro tras un robo.
   *
   * Se acuña, no sale del ladron: si saliera de el, el seguro seria un castigo
   * al que roba y no una proteccion para el que lo compra, y encima el ladron
   * pagaria dos veces por un golpe que le salio bien. La inflacion que genera es
   * menor que lo que se quemo al comprarlo — el seguro cuesta mas de lo que
   * llega a devolver.
   */
  | "insurance"
  /** Devuelto porque la compra no llego a surtir efecto. */
  | "shop-refund"
  /**
   * Pagado para salir de una mordaza comprada.
   *
   * Se quema, no va a parar a quien te silencio. Pagarle al que compra la
   * mordaza convertiria silenciar en un negocio: comprar mordazas baratas a
   * quien tiene saldo para pagar la fianza saldria a cuenta, y el juego pasaria
   * de ser una gracia a ser una extorsion con tarifa.
   */
  | "bail"
  /** Ajuste a mano de un admin. */
  | "admin"
  /**
   * Una racion de comida para una mascota.
   *
   * Se quema. Es el segundo sumidero de la economia y el unico constante: la
   * tienda saca monedas a rachas, segun a quien le apetezca comprar; esto las
   * saca todos los dias.
   */
  | "pet-feed"
  /**
   * Lo que rinde una mascota en un dia.
   *
   * Es el unico motivo de mascotas que **acuña**, y por eso lleva siempre
   * `refId` con el dia UTC: el unique del libro mayor es lo que impide que un
   * worker reiniciado pague dos veces el martes. Sin ese `refId`, reiniciar el
   * worker imprimiria dinero.
   */
  | "pet-yield"
  /** El huevo que se compra en la tienda. Se quema. */
  | "pet-egg";

/**
 * Una cartera lista para apostar: la de siempre mas sus semillas.
 *
 * Tipo aparte de `EconomyWalletState` porque no toda cartera las tiene. Quien
 * solo ha hablado en el grupo no necesita semilla, y obligar a que el tipo
 * comun las traiga habria significado o rellenarlas para todo el mundo o
 * arrastrar tres campos opcionales por sitios que nunca apuestan.
 */
export interface EconomyBettingWallet extends EconomyWalletState {
  readonly serverSeed: string;
  readonly serverSeedHash: string;
  readonly clientSeed: string;
  readonly nonce: number;
}

/** Como se resuelve una apuesta a partir de las semillas. Lo pone quien llama:
 * cada juego tiene su curva y el repositorio no tiene por que conocerlas. */
export type EconomyBetResolver = (
  serverSeed: string,
  clientSeed: string,
  nonce: number,
) => { readonly multiplier: number };

export interface EconomyBetOutcome {
  readonly ok: boolean;
  readonly error?: "insufficient";
  /** Saldo tras la apuesta (o el que habia, si no se pudo). */
  readonly balance: number;
  readonly stake: number;
  readonly multiplier: number;
  readonly payout: number;
  /** El nonce con el que se resolvio ESTA apuesta. */
  readonly nonce: number;
  readonly serverSeedHash: string;
  readonly clientSeed: string;
}

/** Una linea del libro mayor, ya en tipos de dominio. */
export interface EconomyMovement {
  readonly delta: number;
  readonly reason: EconomyReason;
  readonly refId: string | null;
  readonly createdAt: Date;
}

/** Una fila del ranking de saldo. */
export interface EconomyRankRow {
  readonly userTelegramId: bigint;
  readonly balance: number;
}

/** Resultado de mover saldo de una persona a otra (donar o robar). */
export interface EconomyMoveResult {
  readonly ok: boolean;
  /** `self` = origen y destino son la misma persona; `insufficient` = no llega. */
  readonly error?: "insufficient" | "self";
  /** Saldo del origen despues de la operacion (o el que tenia, si fallo). */
  readonly fromBalance: number;
}

/**
 * Lo que devuelve mover saldo a la caja fuerte.
 *
 * Es una union discriminada por `ok` a proposito. Antes era un solo objeto con
 * `error?`, y eso permitia `ok: false` **sin motivo**. Las dos
 * implementaciones siempre lo ponen, asi que era correcto por convencion — pero
 * quien lo consume tenia que cubrirse igual, y el bot lo hacia con un
 * `default` que dice "No tienes tanto: tu saldo entero son X".
 *
 * Ese `default` acertaba porque el unico motivo que le llegaba era
 * `insufficient`. Con un motivo nuevo, o con un `ok: false` sin motivo, le
 * diria a alguien que no tiene dinero cuando el problema es otro.
 *
 * Asi el fallo lleva SIEMPRE su motivo, y el `switch` del bot puede ser
 * exhaustivo sin `default`: anadir un motivo nuevo pasa a ser un error de
 * compilacion en cada sitio que lo traduce a texto.
 */
export type ResultadoDeCaja =
  | {
      readonly ok: true;
      readonly protectedBalance: number;
      readonly balance: number;
    }
  | {
      readonly ok: false;
      readonly error: "insufficient" | "full" | "empty";
      readonly protectedBalance: number;
      readonly balance: number;
    };

export interface EconomyRepository {
  getWallet(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
  ): Promise<EconomyWalletState | null>;
  setWallet(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    state: EconomyWalletState,
  ): Promise<void>;
  /** Crea la cartera si no existe y devuelve su estado. */
  ensureWallet(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    welcome?: number,
  ): Promise<EconomyWalletState>;
  /**
   * La cartera con sus semillas, sembrandolas si es la primera vez que esta
   * persona apuesta. Es lo que hace falta para enseñar el compromiso ANTES de
   * jugar (`/verificar`).
   */
  ensureBettingWallet(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
  ): Promise<EconomyBettingWallet>;
  /**
   * Cobra la apuesta, resuelve con las semillas y paga si toca — todo en una
   * transaccion.
   *
   * `betId` es la llave de idempotencia del apunte. A diferencia de las fichas,
   * aqui NO hay comision ni bote progresivo: el bote se alimenta y se paga en
   * fichas, y no se puede ganar un bote de fichas apostando monedas del grupo.
   */
  placeBet(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    stake: number;
    betId: string;
    resolve: EconomyBetResolver;
  }): Promise<EconomyBetOutcome>;
  /**
   * Suma saldo dejando rastro. `refId` es la llave de idempotencia: con el mismo
   * (motivo, refId) el abono ocurre UNA vez. `ok:false` significa "ya estaba
   * hecho", no un error.
   */
  credit(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    amount: number,
    reason: EconomyReason,
    refId?: string,
  ): Promise<{ ok: boolean; balance: number }>;
  /** Resta saldo solo si llega. No deja saldos negativos jamas. */
  debit(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    amount: number,
    reason: EconomyReason,
    refId?: string,
  ): Promise<{ ok: boolean; balance: number }>;
  /**
   * FIJA el saldo a un valor exacto, en una sola transaccion.
   *
   * No es azucar sobre `credit`/`debit`: con esos hay que leer el saldo
   * primero y calcular la diferencia fuera, y entre la lectura y la escritura
   * el saldo se mueve —en un grupo vivo se mueve de verdad: check-in, robos,
   * mensajes—. Entonces o el ajuste se pasa, o se queda corto, y quien lo pidio
   * cree que dejo a alguien a cero cuando le ha dejado 37.
   *
   * El apunte que se escribe es la DIFERENCIA contra lo que habia, porque el
   * libro mayor cuenta movimientos y no fotos. Si la diferencia es 0 no se
   * escribe nada: no ha pasado nada que contar.
   *
   * `refId` es la llave de idempotencia, igual que en `credit`. `ok:false`
   * significa "ya estaba hecho".
   */
  setBalance(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    /** El saldo que tiene que quedar. Nunca negativo. */
    target: number;
    reason: EconomyReason;
    refId: string;
  }): Promise<{ ok: boolean; balance: number; delta: number }>;
  /**
   * Enciende o apaga el saldo sin fondo de una cartera. Devuelve como queda.
   *
   * Crea la cartera si no existia: encenderlo sobre alguien que todavia no ha
   * hablado en el grupo es un caso legitimo, y fallar ahi obligaria a quien lo
   * pide a saber antes si la fila esta.
   *
   * No pasa por el libro mayor a proposito. El libro cuenta MOVIMIENTOS, y esto
   * no mueve una moneda: cambia la regla por la que se mueven. Su rastro es la
   * auditoria, que es donde se pregunta quien concedio que.
   */
  setUnlimited(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    unlimited: boolean;
  }): Promise<boolean>;
  /** Mueve saldo entre dos personas en una sola transaccion. */
  move(input: {
    tenantId: string;
    chatId: string;
    fromId: bigint;
    toId: bigint;
    amount: number;
    fromReason: EconomyReason;
    toReason: EconomyReason;
    refId: string;
  }): Promise<EconomyMoveResult>;
  /**
   * Lo ganado hablando desde `since`. Alimenta el cupo diario de `earnPoints`.
   *
   * Se calcula del libro mayor y no de un contador aparte a proposito: un
   * contador es otro sitio donde el numero puede desincronizarse del saldo, y
   * este ya tiene la verdad. Solo suma "earn": donaciones y robos no gastan
   * cupo, porque ese dinero ya existia.
   */
  earnedSince(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    since: Date,
  ): Promise<number>;
  /**
   * Cuando fue el ultimo movimiento de esta persona por alguno de esos motivos,
   * o null si no hay ninguno.
   *
   * De aqui salen las esperas del robo: cuando robo por ultima vez (motivos
   * "steal-win" y "fine") y cuando le robaron ("steal-loss"). Derivarlo del
   * libro mayor evita una tabla de estado que podria contradecirlo — y aqui la
   * contradiccion no seria cosmetica: significaria cobrar un cooldown que no
   * toca o perdonar uno que si.
   */
  lastMovementAt(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    reasons: readonly EconomyReason[],
  ): Promise<Date | null>;
  /** Cuantos movimientos acumula por un motivo. Alimenta la progresion. */
  countByReason(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    reason: EconomyReason,
  ): Promise<number>;
  /**
   * Quien gano y quien perdio mas por un motivo en una franja de tiempo.
   *
   * Existe para el resumen de la purga, que es lo que convierte el evento en
   * algo de lo que se habla al dia siguiente. Se apoya en el libro mayor porque
   * es el unico sitio que sabe QUIEN movio QUE y CUANDO — el saldo solo sabe el
   * total.
   */
  rankByReasonBetween(
    tenantId: string,
    chatId: string,
    reason: EconomyReason,
    since: Date,
    until: Date,
    limit: number,
  ): Promise<readonly EconomyRankRow[]>;
  /** Los saldos mas altos del chat, de mayor a menor. */
  top(
    tenantId: string,
    chatId: string,
    limit: number,
  ): Promise<readonly EconomyRankRow[]>;
  /**
   * Quien tiene saldo sin fondo en este chat.
   *
   * Existe porque un privilegio que no se puede LISTAR no se puede revisar: si
   * la unica forma de saber quien lo tiene es entrar en la base de datos, en la
   * practica no lo mira nadie y el privilegio sobrevive a la razon por la que
   * se dio.
   */
  unlimitedWallets(
    tenantId: string,
    chatId: string,
  ): Promise<readonly EconomyRankRow[]>;
  /** Ultimos movimientos de una persona, del mas reciente al mas antiguo. */
  history(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    limit: number,
  ): Promise<readonly EconomyMovement[]>;
  /**
   * Sube el tope de la caja fuerte y devuelve el nuevo.
   *
   * Lo que se compra en la tienda es CAPACIDAD, no saldo: ampliar no mete ni
   * saca una moneda, solo cambia cuanto se puede poner a salvo. Por eso no pasa
   * por el libro mayor — no hay movimiento de dinero que anotar.
   */
  raiseVaultLimit(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    amount: number,
  ): Promise<number>;
  /**
   * Mueve saldo entre la parte libre y la caja fuerte.
   *
   * `amount` positivo guarda y negativo saca. El saldo total NO cambia: la caja
   * fuerte cuenta dentro de `balance`, asi que esto solo mueve la frontera de lo
   * que `/robar` puede tocar. Tampoco pasa por el libro mayor, por lo mismo.
   *
   * `limit` lo pone quien llama porque el tope efectivo no esta en esta tabla:
   * es el basico del grupo mas lo que se haya ampliado, y el basico es un ajuste
   * del chat.
   */
  moveToVault(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    amount: number;
    limit: number;
  }): Promise<ResultadoDeCaja>;
}

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

/**
 * Un importe valido para mover saldo: entero y positivo.
 *
 * El caso que de verdad protege es el negativo. En `move`, un importe negativo
 * invertiria la operacion —le quitaria al destinatario y le pagaria al origen,
 * o sea una donacion que roba— y la guarda de saldo del origen no lo detecta,
 * porque `balance >= -50` es cierto siempre. Se comprueba aqui, en el
 * repositorio, y no solo en el parser del comando, para que ninguna llamada
 * futura pueda reabrirlo.
 */
const isMovableAmount = (amount: number): boolean =>
  Number.isInteger(amount) && amount > 0;

/** La cartera sobre la que se mueve saldo: tenant + chat + persona. */
export interface CarteraDeGrupo {
  readonly tenantId: string;
  readonly chatId: string;
  readonly userTelegramId: bigint;
}

/** La clave compuesta, tal y como la pide el unique de la tabla. */
const claveDeCartera = (cartera: CarteraDeGrupo) => ({
  tenantId_chatId_userTelegramId: {
    tenantId: cartera.tenantId,
    chatId: cartera.chatId,
    userTelegramId: cartera.userTelegramId,
  },
});

/**
 * Cobra `amount` dentro de una transaccion YA ABIERTA.
 *
 * `pagado: false` significa una sola cosa: el saldo no llega. Una cartera con
 * `unlimited` paga SIEMPRE y su saldo no se mueve —quien cuenta el gasto es el
 * apunte del libro mayor, que se escribe igual—, asi que el numero que devuelve
 * es el mismo que habia.
 *
 * El orden de las dos consultas es la parte que importa. La primera lleva la
 * guarda de saldo en el WHERE y es la que toma el bloqueo de la fila, asi que
 * dos cobros a la vez no pueden pasar los dos: el segundo espera al primero y
 * vuelve a evaluar el `gte` contra la fila ya cobrada. Si la guarda viviera en
 * un `findUnique` previo, entre leer y escribir habria hueco para colarse.
 *
 * Al no encontrar fila hay que mirarla igualmente, porque "no llega" y "es
 * ilimitada" son dos respuestas distintas y el `count` no las distingue.
 */
export async function cobrarSaldoDeCartera(
  tx: Prisma.TransactionClient,
  cartera: CarteraDeGrupo,
  amount: number,
): Promise<{ pagado: boolean; balance: number }> {
  const clave = claveDeCartera(cartera);
  const cobrado = await tx.economyWallet.updateMany({
    where: {
      tenantId: cartera.tenantId,
      chatId: cartera.chatId,
      userTelegramId: cartera.userTelegramId,
      unlimited: false,
      balance: { gte: amount },
    },
    data: { balance: { decrement: amount } },
  });
  if (cobrado.count > 0) {
    const fila = await tx.economyWallet.findUniqueOrThrow({ where: clave });
    return { pagado: true, balance: fila.balance };
  }
  const fila = await tx.economyWallet.findUnique({ where: clave });
  return { pagado: fila?.unlimited === true, balance: fila?.balance ?? 0 };
}

/**
 * Abona `amount` dentro de una transaccion YA ABIERTA y devuelve lo que queda.
 *
 * A una cartera ilimitada tampoco se le abona: el saldo esta congelado en los
 * DOS sentidos, y eso no es simetria por gusto. Si el gasto no baja el numero,
 * la ganancia no puede subirlo o el numero contaria una historia que no es la
 * suya. Y de paso quita el desbordamiento de en medio: una cartera que nunca
 * suma no puede pasarse del `integer` y reventar con "integer out of range".
 */
export async function abonarSaldoDeCartera(
  tx: Prisma.TransactionClient,
  cartera: CarteraDeGrupo,
  amount: number,
): Promise<number> {
  await tx.economyWallet.updateMany({
    where: {
      tenantId: cartera.tenantId,
      chatId: cartera.chatId,
      userTelegramId: cartera.userTelegramId,
      unlimited: false,
    },
    data: { balance: { increment: amount } },
  });
  const fila = await tx.economyWallet.findUniqueOrThrow({
    where: claveDeCartera(cartera),
  });
  return fila.balance;
}

export class PrismaEconomyRepository implements EconomyRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async getWallet(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
  ): Promise<EconomyWalletState | null> {
    const wallet = await this.client.economyWallet.findUnique({
      where: {
        tenantId_chatId_userTelegramId: { tenantId, chatId, userTelegramId },
      },
    });
    if (!wallet) {
      return null;
    }
    return {
      balance: wallet.balance,
      lastEarnedMs: Number(wallet.lastEarnedMs),
      protectedBalance: wallet.protectedBalance,
      vaultLimit: wallet.vaultLimit,
      unlimited: wallet.unlimited,
    };
  }

  async setWallet(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    state: EconomyWalletState,
  ): Promise<void> {
    const lastEarnedMs = BigInt(Math.trunc(state.lastEarnedMs));
    // `unlimited` ausente no entra en la escritura: quien guarda un saldo no
    // esta opinando sobre el privilegio, y con `exactOptionalPropertyTypes` un
    // `undefined` explicito no es lo mismo que la clave ausente.
    const privilegio =
      state.unlimited === undefined ? {} : { unlimited: state.unlimited };
    await this.client.economyWallet.upsert({
      where: {
        tenantId_chatId_userTelegramId: { tenantId, chatId, userTelegramId },
      },
      create: {
        tenantId,
        chatId,
        userTelegramId,
        balance: state.balance,
        lastEarnedMs,
        ...privilegio,
      },
      update: { balance: state.balance, lastEarnedMs, ...privilegio },
    });
  }

  async ensureWallet(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    welcome = 0,
  ): Promise<EconomyWalletState> {
    const key = {
      tenantId_chatId_userTelegramId: { tenantId, chatId, userTelegramId },
    };
    const existing = await this.client.economyWallet.findUnique({
      where: key,
    });
    if (existing) {
      return {
        balance: existing.balance,
        lastEarnedMs: Number(existing.lastEarnedMs),
        protectedBalance: existing.protectedBalance,
        vaultLimit: existing.vaultLimit,
        unlimited: existing.unlimited,
      };
    }
    try {
      const created = await this.client.economyWallet.create({
        data: { tenantId, chatId, userTelegramId, balance: welcome },
      });
      return {
        balance: created.balance,
        lastEarnedMs: Number(created.lastEarnedMs),
        unlimited: created.unlimited,
      };
    } catch (error) {
      // Dos mensajes a la vez de alguien sin cartera entran aqui los dos. El
      // segundo pierde la carrera y relee en vez de reventar: crear la cartera
      // no es la operacion que le importaba.
      if (isUniqueViolation(error)) {
        const wallet = await this.client.economyWallet.findUniqueOrThrow({
          where: key,
        });
        return {
          balance: wallet.balance,
          lastEarnedMs: Number(wallet.lastEarnedMs),
          unlimited: wallet.unlimited,
        };
      }
      throw error;
    }
  }

  async ensureBettingWallet(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
  ): Promise<EconomyBettingWallet> {
    const key = {
      tenantId_chatId_userTelegramId: { tenantId, chatId, userTelegramId },
    };
    await this.ensureWallet(tenantId, chatId, userTelegramId);
    const wallet = await this.client.economyWallet.findUniqueOrThrow({
      where: key,
    });
    if (wallet.serverSeed && wallet.serverSeedHash && wallet.clientSeed) {
      return {
        balance: wallet.balance,
        lastEarnedMs: Number(wallet.lastEarnedMs),
        unlimited: wallet.unlimited,
        serverSeed: wallet.serverSeed,
        serverSeedHash: wallet.serverSeedHash,
        clientSeed: wallet.clientSeed,
        nonce: wallet.nonce,
      };
    }
    // Primera apuesta de esta persona: se siembra ahora. `updateMany` con la
    // condicion de que sigan a nulo evita que dos apuestas simultaneas generen
    // dos semillas distintas y la segunda invalide el compromiso de la primera.
    const serverSeed = newServerSeed();
    await this.client.economyWallet.updateMany({
      where: { tenantId, chatId, userTelegramId, serverSeed: null },
      data: {
        serverSeed,
        serverSeedHash: commitOf(serverSeed),
        clientSeed: newClientSeed(),
      },
    });
    const sembrada = await this.client.economyWallet.findUniqueOrThrow({
      where: key,
    });
    return {
      balance: sembrada.balance,
      lastEarnedMs: Number(sembrada.lastEarnedMs),
      unlimited: sembrada.unlimited,
      serverSeed: sembrada.serverSeed ?? serverSeed,
      serverSeedHash: sembrada.serverSeedHash ?? commitOf(serverSeed),
      clientSeed: sembrada.clientSeed ?? "",
      nonce: sembrada.nonce,
    };
  }

  async placeBet(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    stake: number;
    betId: string;
    resolve: EconomyBetResolver;
  }): Promise<EconomyBetOutcome> {
    const { tenantId, chatId, userTelegramId, stake, betId } = input;
    const cartera = await this.ensureBettingWallet(
      tenantId,
      chatId,
      userTelegramId,
    );
    // Misma red que en `move`: una apuesta negativa pasaria la guarda de saldo
    // (`balance >= -50` es cierto) y ABONARIA en vez de cobrar.
    if (!isMovableAmount(stake)) {
      return {
        ok: false,
        error: "insufficient",
        balance: cartera.balance,
        stake,
        multiplier: 0,
        payout: 0,
        nonce: cartera.nonce,
        serverSeedHash: cartera.serverSeedHash,
        clientSeed: cartera.clientSeed,
      };
    }
    const key = {
      tenantId_chatId_userTelegramId: { tenantId, chatId, userTelegramId },
    };
    return this.client.$transaction(async (tx) => {
      // La guarda de saldo y el `nonce` van en la MISMA consulta porque es la
      // que toma el bloqueo de la fila: dos apuestas a la vez no pueden pasar
      // las dos ni compartir nonce. La cartera ilimitada entra por el `OR`
      // —siempre puede apostar— y por eso el cobro no cabe aqui: subir el nonce
      // sin cobrar y cobrar son dos cosas distintas segun la fila.
      const admitida = await tx.economyWallet.updateMany({
        where: {
          tenantId,
          chatId,
          userTelegramId,
          OR: [{ unlimited: true }, { balance: { gte: stake } }],
        },
        data: { nonce: { increment: 1 } },
      });
      if (admitida.count > 0) {
        await tx.economyWallet.updateMany({
          where: { tenantId, chatId, userTelegramId, unlimited: false },
          data: { balance: { decrement: stake } },
        });
      }
      const wallet = await tx.economyWallet.findUniqueOrThrow({ where: key });
      if (admitida.count === 0) {
        return {
          ok: false,
          error: "insufficient" as const,
          balance: wallet.balance,
          stake,
          multiplier: 0,
          payout: 0,
          nonce: wallet.nonce,
          serverSeedHash: wallet.serverSeedHash ?? "",
          clientSeed: wallet.clientSeed ?? "",
        };
      }
      // `nonce` ya viene incrementado: ese es el de ESTA apuesta.
      const nonce = wallet.nonce;
      const resuelto = input.resolve(
        wallet.serverSeed ?? cartera.serverSeed,
        wallet.clientSeed ?? cartera.clientSeed,
        nonce,
      );
      const multiplier = Math.max(0, resuelto.multiplier);
      const payout = Math.floor(stake * multiplier);
      await tx.economyLedger.create({
        data: {
          tenantId,
          chatId,
          telegramUserId: userTelegramId,
          delta: -stake,
          reason: "bet",
          refId: betId,
        },
      });
      let balance = wallet.balance;
      if (payout > 0) {
        balance = await abonarSaldoDeCartera(
          tx,
          { tenantId, chatId, userTelegramId },
          payout,
        );
        await tx.economyLedger.create({
          data: {
            tenantId,
            chatId,
            telegramUserId: userTelegramId,
            delta: payout,
            reason: "win",
            refId: betId,
          },
        });
      }
      return {
        ok: true,
        balance,
        stake,
        multiplier,
        payout,
        nonce,
        serverSeedHash: wallet.serverSeedHash ?? cartera.serverSeedHash,
        clientSeed: wallet.clientSeed ?? cartera.clientSeed,
      };
    });
  }

  async credit(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    amount: number,
    reason: EconomyReason,
    refId?: string,
  ): Promise<{ ok: boolean; balance: number }> {
    if (!isMovableAmount(amount)) {
      const wallet = await this.getWallet(tenantId, chatId, userTelegramId);
      return { ok: false, balance: wallet?.balance ?? 0 };
    }
    await this.ensureWallet(tenantId, chatId, userTelegramId);
    try {
      const balance = await this.client.$transaction(async (tx) => {
        // El apunte va PRIMERO: si el unique salta, la transaccion entera se
        // deshace y el saldo no se toca. Al reves —sumar y luego anotar— un
        // reintento pagaria dos veces antes de descubrir que ya estaba hecho.
        await tx.economyLedger.create({
          data: {
            tenantId,
            chatId,
            telegramUserId: userTelegramId,
            delta: amount,
            reason,
            refId: refId ?? null,
          },
        });
        return await abonarSaldoDeCartera(
          tx,
          { tenantId, chatId, userTelegramId },
          amount,
        );
      });
      return { ok: true, balance };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const wallet = await this.getWallet(tenantId, chatId, userTelegramId);
        return { ok: false, balance: wallet?.balance ?? 0 };
      }
      throw error;
    }
  }

  async setBalance(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    target: number;
    reason: EconomyReason;
    refId: string;
  }): Promise<{ ok: boolean; balance: number; delta: number }> {
    const { tenantId, chatId, userTelegramId } = input;
    const objetivo = Math.trunc(input.target);
    if (!Number.isInteger(objetivo) || objetivo < 0) {
      const wallet = await this.getWallet(tenantId, chatId, userTelegramId);
      return { ok: false, balance: wallet?.balance ?? 0, delta: 0 };
    }
    await this.ensureWallet(tenantId, chatId, userTelegramId);
    try {
      return await this.client.$transaction(async (tx) => {
        const antes = await tx.economyWallet.findUniqueOrThrow({
          where: {
            tenantId_chatId_userTelegramId: {
              tenantId,
              chatId,
              userTelegramId,
            },
          },
        });
        const delta = objetivo - antes.balance;
        if (delta === 0) {
          // Ya estaba donde tenia que estar. No hay movimiento que anotar, y
          // repetirlo tampoco cambia nada: idempotente por construccion.
          return { ok: true, balance: antes.balance, delta: 0 };
        }
        // El apunte PRIMERO, como en `credit`: si el unique salta, la
        // transaccion entera se deshace y el saldo se queda como estaba.
        await tx.economyLedger.create({
          data: {
            tenantId,
            chatId,
            telegramUserId: userTelegramId,
            delta,
            reason: input.reason,
            refId: input.refId,
          },
        });
        const wallet = await tx.economyWallet.update({
          where: {
            tenantId_chatId_userTelegramId: {
              tenantId,
              chatId,
              userTelegramId,
            },
          },
          data: { balance: objetivo },
        });
        return { ok: true, balance: wallet.balance, delta };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const wallet = await this.getWallet(tenantId, chatId, userTelegramId);
        return { ok: false, balance: wallet?.balance ?? 0, delta: 0 };
      }
      throw error;
    }
  }

  async setUnlimited(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    unlimited: boolean;
  }): Promise<boolean> {
    const { tenantId, chatId, userTelegramId } = input;
    await this.ensureWallet(tenantId, chatId, userTelegramId);
    const fila = await this.client.economyWallet.update({
      where: {
        tenantId_chatId_userTelegramId: { tenantId, chatId, userTelegramId },
      },
      data: { unlimited: input.unlimited },
    });
    return fila.unlimited;
  }

  async debit(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    amount: number,
    reason: EconomyReason,
    refId?: string,
  ): Promise<{ ok: boolean; balance: number }> {
    if (!isMovableAmount(amount)) {
      const wallet = await this.getWallet(tenantId, chatId, userTelegramId);
      return { ok: false, balance: wallet?.balance ?? 0 };
    }
    try {
      return await this.client.$transaction(async (tx) => {
        const cobro = await cobrarSaldoDeCartera(
          tx,
          { tenantId, chatId, userTelegramId },
          amount,
        );
        if (!cobro.pagado) {
          return { ok: false, balance: cobro.balance };
        }
        // El apunte va DESPUES del cobro y dentro de la misma transaccion: si
        // el unique salta porque este `refId` ya se cobro, se deshace todo y el
        // saldo vuelve a su sitio.
        await tx.economyLedger.create({
          data: {
            tenantId,
            chatId,
            telegramUserId: userTelegramId,
            delta: -amount,
            reason,
            refId: refId ?? null,
          },
        });
        return { ok: true, balance: cobro.balance };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const wallet = await this.getWallet(tenantId, chatId, userTelegramId);
        return { ok: false, balance: wallet?.balance ?? 0 };
      }
      throw error;
    }
  }

  async move(input: {
    tenantId: string;
    chatId: string;
    fromId: bigint;
    toId: bigint;
    amount: number;
    fromReason: EconomyReason;
    toReason: EconomyReason;
    refId: string;
  }): Promise<EconomyMoveResult> {
    const { tenantId, chatId, fromId, toId, amount } = input;
    if (fromId === toId) {
      return { ok: false, error: "self", fromBalance: 0 };
    }
    if (!isMovableAmount(amount)) {
      const wallet = await this.getWallet(tenantId, chatId, fromId);
      return {
        ok: false,
        error: "insufficient",
        fromBalance: wallet?.balance ?? 0,
      };
    }
    await this.ensureWallet(tenantId, chatId, toId);
    return this.client.$transaction(async (tx) => {
      const cobro = await cobrarSaldoDeCartera(
        tx,
        { tenantId, chatId, userTelegramId: fromId },
        amount,
      );
      if (!cobro.pagado) {
        return {
          ok: false,
          error: "insufficient" as const,
          fromBalance: cobro.balance,
        };
      }
      await tx.economyLedger.create({
        data: {
          tenantId,
          chatId,
          telegramUserId: fromId,
          delta: -amount,
          reason: input.fromReason,
          refId: input.refId,
        },
      });
      await abonarSaldoDeCartera(
        tx,
        { tenantId, chatId, userTelegramId: toId },
        amount,
      );
      await tx.economyLedger.create({
        data: {
          tenantId,
          chatId,
          telegramUserId: toId,
          delta: amount,
          reason: input.toReason,
          refId: input.refId,
        },
      });
      return { ok: true, fromBalance: cobro.balance };
    });
  }

  async earnedSince(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    since: Date,
  ): Promise<number> {
    const result = await this.client.economyLedger.aggregate({
      where: {
        tenantId,
        chatId,
        telegramUserId: userTelegramId,
        reason: "earn",
        createdAt: { gte: since },
      },
      _sum: { delta: true },
    });
    return result._sum.delta ?? 0;
  }

  async lastMovementAt(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    reasons: readonly EconomyReason[],
  ): Promise<Date | null> {
    if (reasons.length === 0) {
      return null;
    }
    const row = await this.client.economyLedger.findFirst({
      where: {
        tenantId,
        chatId,
        telegramUserId: userTelegramId,
        reason: { in: [...reasons] },
      },
      orderBy: { createdAt: "desc" },
    });
    return row?.createdAt ?? null;
  }

  async countByReason(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    reason: EconomyReason,
  ): Promise<number> {
    return this.client.economyLedger.count({
      where: { tenantId, chatId, telegramUserId: userTelegramId, reason },
    });
  }

  async rankByReasonBetween(
    tenantId: string,
    chatId: string,
    reason: EconomyReason,
    since: Date,
    until: Date,
    limit: number,
  ): Promise<readonly EconomyRankRow[]> {
    const filas = await this.client.economyLedger.groupBy({
      by: ["telegramUserId"],
      where: {
        tenantId,
        chatId,
        reason,
        createdAt: { gte: since, lt: until },
      },
      _sum: { delta: true },
    });
    return filas
      .map((fila) => ({
        userTelegramId: fila.telegramUserId,
        // Las perdidas se guardan en negativo; para un ranking interesa la
        // magnitud, o "quien perdio mas" saldria ordenado justo al reves.
        balance: Math.abs(fila._sum.delta ?? 0),
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, Math.max(1, Math.trunc(limit)));
  }

  async top(
    tenantId: string,
    chatId: string,
    limit: number,
  ): Promise<readonly EconomyRankRow[]> {
    const rows = await this.client.economyWallet.findMany({
      where: { tenantId, chatId, balance: { gt: 0 } },
      orderBy: { balance: "desc" },
      take: Math.max(1, Math.trunc(limit)),
    });
    return rows.map((row) => ({
      userTelegramId: row.userTelegramId,
      balance: row.balance,
    }));
  }

  async unlimitedWallets(
    tenantId: string,
    chatId: string,
  ): Promise<readonly EconomyRankRow[]> {
    const rows = await this.client.economyWallet.findMany({
      where: { tenantId, chatId, unlimited: true },
      orderBy: { userTelegramId: "asc" },
    });
    return rows.map((row) => ({
      userTelegramId: row.userTelegramId,
      balance: row.balance,
    }));
  }

  async history(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    limit: number,
  ): Promise<readonly EconomyMovement[]> {
    const rows = await this.client.economyLedger.findMany({
      where: { tenantId, chatId, telegramUserId: userTelegramId },
      orderBy: { createdAt: "desc" },
      take: Math.max(1, Math.trunc(limit)),
    });
    return rows.map((row) => ({
      delta: row.delta,
      reason: row.reason as EconomyReason,
      refId: row.refId,
      createdAt: row.createdAt,
    }));
  }

  async raiseVaultLimit(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    amount: number,
  ): Promise<number> {
    await this.ensureWallet(tenantId, chatId, userTelegramId);
    const fila = await this.client.economyWallet.update({
      where: {
        tenantId_chatId_userTelegramId: { tenantId, chatId, userTelegramId },
      },
      data: { vaultLimit: { increment: Math.max(0, Math.trunc(amount)) } },
    });
    return fila.vaultLimit;
  }

  async moveToVault(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    amount: number;
    limit: number;
  }): Promise<ResultadoDeCaja> {
    const { tenantId, chatId, userTelegramId } = input;
    const key = {
      tenantId_chatId_userTelegramId: { tenantId, chatId, userTelegramId },
    };
    await this.ensureWallet(tenantId, chatId, userTelegramId);
    return this.client.$transaction(async (tx) => {
      const fila = await tx.economyWallet.findUniqueOrThrow({ where: key });
      const actual = fila.protectedBalance;
      const destino = actual + Math.trunc(input.amount);
      if (destino > input.limit) {
        return {
          ok: false,
          error: "full" as const,
          protectedBalance: actual,
          balance: fila.balance,
        };
      }
      if (destino < 0) {
        return {
          ok: false,
          error: "empty" as const,
          protectedBalance: actual,
          balance: fila.balance,
        };
      }
      // No se puede poner a salvo lo que no se tiene: la caja fuerte es una
      // marca DENTRO del saldo, y dejarla pasar del total significaria proteger
      // monedas que no existen y bloquear robos contra un saldo real.
      if (destino > fila.balance) {
        return {
          ok: false,
          error: "insufficient" as const,
          protectedBalance: actual,
          balance: fila.balance,
        };
      }
      const guardada = await tx.economyWallet.update({
        where: key,
        data: { protectedBalance: destino },
      });
      return {
        ok: true,
        protectedBalance: guardada.protectedBalance,
        balance: guardada.balance,
      };
    });
  }
}

/** Store en memoria usado como default del constructor (tests). */
export class InMemoryEconomyRepository implements EconomyRepository {
  private wallets = new Map<string, EconomyWalletState>();
  private ledger: {
    key: string;
    delta: number;
    reason: EconomyReason;
    refId: string | null;
    createdAt: Date;
  }[] = [];
  /** Espeja el unique compuesto de la tabla, que es lo que da idempotencia. */
  private seen = new Set<string>();

  private key(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
  ): string {
    return `${tenantId}:${chatId}:${userTelegramId.toString()}`;
  }

  /** Marca el apunte y dice si es nuevo. `refId` ausente nunca colisiona, igual
   * que un NULL en Postgres. */
  private claim(key: string, reason: EconomyReason, refId?: string): boolean {
    if (refId === undefined) {
      return true;
    }
    const token = `${key}|${reason}|${refId}`;
    if (this.seen.has(token)) {
      return false;
    }
    this.seen.add(token);
    return true;
  }

  /**
   * Anota el movimiento. `createdAt` es la fecha real y no un contador: con un
   * reloj artificial que empieza en 1970, `earnedSince(..., hoy)` no encontraba
   * nunca nada y el cupo diario parecia infinito en los tests.
   *
   * El orden lo da el array, no la fecha, asi que dos apuntes dentro del mismo
   * milisegundo siguen saliendo en el orden en que ocurrieron.
   */
  private record(
    key: string,
    delta: number,
    reason: EconomyReason,
    refId?: string,
  ): void {
    this.ledger.push({
      key,
      delta,
      reason,
      refId: refId ?? null,
      createdAt: new Date(),
    });
  }

  async getWallet(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
  ): Promise<EconomyWalletState | null> {
    return this.wallets.get(this.key(tenantId, chatId, userTelegramId)) ?? null;
  }

  async setWallet(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    state: EconomyWalletState,
  ): Promise<void> {
    const key = this.key(tenantId, chatId, userTelegramId);
    // Espeja a Prisma: `unlimited` ausente deja el privilegio como estaba.
    const previo = this.wallets.get(key)?.unlimited;
    const privilegio = state.unlimited ?? previo;
    this.wallets.set(key, {
      balance: state.balance,
      lastEarnedMs: state.lastEarnedMs,
      ...(privilegio === undefined ? {} : { unlimited: privilegio }),
    });
  }

  async ensureWallet(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    welcome = 0,
  ): Promise<EconomyWalletState> {
    const key = this.key(tenantId, chatId, userTelegramId);
    const existing = this.wallets.get(key);
    if (existing) {
      return existing;
    }
    const fresh = { balance: welcome, lastEarnedMs: 0 };
    this.wallets.set(key, fresh);
    return fresh;
  }

  /** Semillas por cartera, sembradas en la primera apuesta. */
  private seeds = new Map<
    string,
    { serverSeed: string; serverSeedHash: string; clientSeed: string }
  >();
  private nonces = new Map<string, number>();

  async ensureBettingWallet(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
  ): Promise<EconomyBettingWallet> {
    const key = this.key(tenantId, chatId, userTelegramId);
    const wallet = await this.ensureWallet(tenantId, chatId, userTelegramId);
    let seeds = this.seeds.get(key);
    if (!seeds) {
      const serverSeed = newServerSeed();
      seeds = {
        serverSeed,
        serverSeedHash: commitOf(serverSeed),
        clientSeed: newClientSeed(),
      };
      this.seeds.set(key, seeds);
    }
    return {
      ...wallet,
      ...seeds,
      nonce: this.nonces.get(key) ?? 0,
    };
  }

  async placeBet(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    stake: number;
    betId: string;
    resolve: EconomyBetResolver;
  }): Promise<EconomyBetOutcome> {
    const { tenantId, chatId, userTelegramId, stake, betId } = input;
    const key = this.key(tenantId, chatId, userTelegramId);
    const cartera = await this.ensureBettingWallet(
      tenantId,
      chatId,
      userTelegramId,
    );
    const base = {
      stake,
      serverSeedHash: cartera.serverSeedHash,
      clientSeed: cartera.clientSeed,
    };
    if (
      !isMovableAmount(stake) ||
      (!cartera.unlimited && cartera.balance < stake)
    ) {
      return {
        ...base,
        ok: false,
        error: "insufficient",
        balance: cartera.balance,
        multiplier: 0,
        payout: 0,
        nonce: cartera.nonce,
      };
    }
    const nonce = cartera.nonce + 1;
    this.nonces.set(key, nonce);
    const resuelto = input.resolve(
      cartera.serverSeed,
      cartera.clientSeed,
      nonce,
    );
    const multiplier = Math.max(0, resuelto.multiplier);
    const payout = Math.floor(stake * multiplier);
    const balance = cartera.unlimited
      ? cartera.balance
      : cartera.balance - stake + payout;
    this.wallets.set(key, { ...cartera, balance });
    this.record(key, -stake, "bet", betId);
    if (payout > 0) {
      this.record(key, payout, "win", betId);
    }
    return { ...base, ok: true, balance, multiplier, payout, nonce };
  }

  async credit(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    amount: number,
    reason: EconomyReason,
    refId?: string,
  ): Promise<{ ok: boolean; balance: number }> {
    const key = this.key(tenantId, chatId, userTelegramId);
    const wallet = await this.ensureWallet(tenantId, chatId, userTelegramId);
    if (!isMovableAmount(amount) || !this.claim(key, reason, refId)) {
      return { ok: false, balance: wallet.balance };
    }
    // Congelado en los dos sentidos, igual que en Prisma: el apunte se escribe
    // y el numero se queda donde estaba.
    const balance = wallet.unlimited ? wallet.balance : wallet.balance + amount;
    this.wallets.set(key, { ...wallet, balance });
    this.record(key, amount, reason, refId);
    return { ok: true, balance };
  }

  async setBalance(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    target: number;
    reason: EconomyReason;
    refId: string;
  }): Promise<{ ok: boolean; balance: number; delta: number }> {
    const { tenantId, chatId, userTelegramId } = input;
    const key = this.key(tenantId, chatId, userTelegramId);
    const wallet = await this.ensureWallet(tenantId, chatId, userTelegramId);
    const objetivo = Math.trunc(input.target);
    if (!Number.isInteger(objetivo) || objetivo < 0) {
      return { ok: false, balance: wallet.balance, delta: 0 };
    }
    const delta = objetivo - wallet.balance;
    if (delta === 0) {
      // Ya estaba donde tenia que estar: nada que anotar y nada que repetir.
      return { ok: true, balance: wallet.balance, delta: 0 };
    }
    if (!this.claim(key, input.reason, input.refId)) {
      return { ok: false, balance: wallet.balance, delta: 0 };
    }
    this.wallets.set(key, { ...wallet, balance: objetivo });
    this.record(key, delta, input.reason, input.refId);
    return { ok: true, balance: objetivo, delta };
  }

  async setUnlimited(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    unlimited: boolean;
  }): Promise<boolean> {
    const { tenantId, chatId, userTelegramId } = input;
    const key = this.key(tenantId, chatId, userTelegramId);
    const wallet = await this.ensureWallet(tenantId, chatId, userTelegramId);
    this.wallets.set(key, { ...wallet, unlimited: input.unlimited });
    return input.unlimited;
  }

  async debit(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    amount: number,
    reason: EconomyReason,
    refId?: string,
  ): Promise<{ ok: boolean; balance: number }> {
    const key = this.key(tenantId, chatId, userTelegramId);
    const wallet = await this.ensureWallet(tenantId, chatId, userTelegramId);
    if (
      !isMovableAmount(amount) ||
      (!wallet.unlimited && wallet.balance < amount)
    ) {
      return { ok: false, balance: wallet.balance };
    }
    if (!this.claim(key, reason, refId)) {
      return { ok: false, balance: wallet.balance };
    }
    const balance = wallet.unlimited ? wallet.balance : wallet.balance - amount;
    this.wallets.set(key, { ...wallet, balance });
    this.record(key, -amount, reason, refId);
    return { ok: true, balance };
  }

  async move(input: {
    tenantId: string;
    chatId: string;
    fromId: bigint;
    toId: bigint;
    amount: number;
    fromReason: EconomyReason;
    toReason: EconomyReason;
    refId: string;
  }): Promise<EconomyMoveResult> {
    const { tenantId, chatId, fromId, toId, amount } = input;
    if (fromId === toId) {
      return { ok: false, error: "self", fromBalance: 0 };
    }
    const fromKey = this.key(tenantId, chatId, fromId);
    const toKey = this.key(tenantId, chatId, toId);
    const from = await this.ensureWallet(tenantId, chatId, fromId);
    const to = await this.ensureWallet(tenantId, chatId, toId);
    if (
      !isMovableAmount(amount) ||
      (!from.unlimited && from.balance < amount)
    ) {
      return { ok: false, error: "insufficient", fromBalance: from.balance };
    }
    const fromBalance = from.unlimited ? from.balance : from.balance - amount;
    this.wallets.set(fromKey, { ...from, balance: fromBalance });
    this.wallets.set(toKey, {
      ...to,
      balance: to.unlimited ? to.balance : to.balance + amount,
    });
    this.record(fromKey, -amount, input.fromReason, input.refId);
    this.record(toKey, amount, input.toReason, input.refId);
    return { ok: true, fromBalance };
  }

  async earnedSince(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    since: Date,
  ): Promise<number> {
    const key = this.key(tenantId, chatId, userTelegramId);
    return this.ledger
      .filter(
        (row) =>
          row.key === key &&
          row.reason === "earn" &&
          row.createdAt.getTime() >= since.getTime(),
      )
      .reduce((sum, row) => sum + row.delta, 0);
  }

  async lastMovementAt(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    reasons: readonly EconomyReason[],
  ): Promise<Date | null> {
    const key = this.key(tenantId, chatId, userTelegramId);
    const coincidencias = this.ledger.filter(
      (row) => row.key === key && reasons.includes(row.reason),
    );
    // El ultimo del array es el mas reciente: el orden de insercion es el orden
    // real, y con fechas iguales al milisegundo ordenar por fecha no lo seria.
    return coincidencias.at(-1)?.createdAt ?? null;
  }

  async countByReason(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    reason: EconomyReason,
  ): Promise<number> {
    const key = this.key(tenantId, chatId, userTelegramId);
    return this.ledger.filter((row) => row.key === key && row.reason === reason)
      .length;
  }

  async rankByReasonBetween(
    tenantId: string,
    chatId: string,
    reason: EconomyReason,
    since: Date,
    until: Date,
    limit: number,
  ): Promise<readonly EconomyRankRow[]> {
    const prefix = `${tenantId}:${chatId}:`;
    const porPersona = new Map<string, number>();
    for (const row of this.ledger) {
      if (
        !row.key.startsWith(prefix) ||
        row.reason !== reason ||
        row.createdAt.getTime() < since.getTime() ||
        row.createdAt.getTime() >= until.getTime()
      ) {
        continue;
      }
      const id = row.key.slice(prefix.length);
      porPersona.set(id, (porPersona.get(id) ?? 0) + row.delta);
    }
    return [...porPersona.entries()]
      .map(([id, total]) => ({
        userTelegramId: BigInt(id),
        // Las perdidas se guardan en negativo; el ranking quiere la magnitud, o
        // "quien perdio mas" saldria ordenado justo al reves.
        balance: Math.abs(total),
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, Math.max(1, Math.trunc(limit)));
  }

  async top(
    tenantId: string,
    chatId: string,
    limit: number,
  ): Promise<readonly EconomyRankRow[]> {
    const prefix = `${tenantId}:${chatId}:`;
    return [...this.wallets.entries()]
      .filter(([key, wallet]) => key.startsWith(prefix) && wallet.balance > 0)
      .map(([key, wallet]) => ({
        userTelegramId: BigInt(key.slice(prefix.length)),
        balance: wallet.balance,
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, Math.max(1, Math.trunc(limit)));
  }

  async unlimitedWallets(
    tenantId: string,
    chatId: string,
  ): Promise<readonly EconomyRankRow[]> {
    const prefix = `${tenantId}:${chatId}:`;
    return [...this.wallets.entries()]
      .filter(([key, wallet]) => key.startsWith(prefix) && wallet.unlimited)
      .map(([key, wallet]) => ({
        userTelegramId: BigInt(key.slice(prefix.length)),
        balance: wallet.balance,
      }))
      .sort((a, b) => (a.userTelegramId < b.userTelegramId ? -1 : 1));
  }

  async history(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    limit: number,
  ): Promise<readonly EconomyMovement[]> {
    const key = this.key(tenantId, chatId, userTelegramId);
    return this.ledger
      .filter((row) => row.key === key)
      .reverse()
      .slice(0, Math.max(1, Math.trunc(limit)))
      .map((row) => ({
        delta: row.delta,
        reason: row.reason,
        refId: row.refId,
        createdAt: row.createdAt,
      }));
  }

  async raiseVaultLimit(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    amount: number,
  ): Promise<number> {
    const key = this.key(tenantId, chatId, userTelegramId);
    const cartera = await this.ensureWallet(tenantId, chatId, userTelegramId);
    const vaultLimit =
      (cartera.vaultLimit ?? 0) + Math.max(0, Math.trunc(amount));
    this.wallets.set(key, { ...cartera, vaultLimit });
    return vaultLimit;
  }

  async moveToVault(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    amount: number;
    limit: number;
  }): Promise<ResultadoDeCaja> {
    const key = this.key(input.tenantId, input.chatId, input.userTelegramId);
    const cartera = await this.ensureWallet(
      input.tenantId,
      input.chatId,
      input.userTelegramId,
    );
    const actual = cartera.protectedBalance ?? 0;
    const destino = actual + Math.trunc(input.amount);
    const estado = { protectedBalance: actual, balance: cartera.balance };
    if (destino > input.limit) {
      return { ok: false, error: "full", ...estado };
    }
    if (destino < 0) {
      return { ok: false, error: "empty", ...estado };
    }
    if (destino > cartera.balance) {
      return { ok: false, error: "insufficient", ...estado };
    }
    this.wallets.set(key, { ...cartera, protectedBalance: destino });
    return { ok: true, protectedBalance: destino, balance: cartera.balance };
  }
}

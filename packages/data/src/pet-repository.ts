import { prisma as defaultPrisma, type PrismaClient } from "./client.js";
import {
  abonarSaldoDeCartera,
  cobrarSaldoDeCartera,
} from "./economy-repository.js";

/**
 * La persistencia de las mascotas.
 *
 * Dos operaciones de aqui **tienen que ser atomicas**, y las dos lo son por la
 * misma razon: mezclan la cartera con la mascota, y hacer solo una mitad deja
 * el juego roto de una forma que nadie sabria reparar.
 *
 * - **Comer** cobra y llena en la misma transaccion. Cobrar sin llenar roba;
 *   llenar sin cobrar imprime.
 * - **Cobrar el rendimiento** acuña y marca el dia a la vez, con `refId` en el
 *   libro mayor. Es lo que impide que un worker reiniciado pague dos veces el
 *   mismo dia — que es la unica forma que tiene esta feature de crear dinero de
 *   la nada.
 * - **Operar de urgencia** cura y cobra en la misma transaccion, y es la que
 *   mas dinero mueve de las tres: la factura es "todo lo que tienes menos un
 *   resto", asi que puede vaciar una cartera de cientos de millones. Cobrar sin
 *   curar seria un robo a plena luz; curar sin cobrar seria salvar al bicho
 *   gratis. Ademas la cura va PRIMERO y condicionada a que siga enferma, que es
 *   lo que impide que dos `/operar` seguidos cobren dos veces — y van a llegar
 *   seguidos, porque el primero tarda y la gente repite.
 *
 * El cobro usa el mismo patron que `EconomyRepository.debit`: `updateMany` con
 * la condicion de saldo dentro del WHERE. Dos raciones simultaneas no pueden
 * pasar las dos, porque la segunda no encuentra fila que cumpla el `gte`, y no
 * hace falta bloquear nada.
 */

/** Una mascota tal y como esta guardada. */
export interface PetState {
  readonly id: string;
  readonly tenantId: string;
  readonly chatId: string;
  readonly userTelegramId: bigint;
  readonly especie: string;
  readonly rasgos: readonly string[];
  readonly nombre: string | null;
  readonly hambre: number;
  readonly animo: number;
  readonly nivel: number;
  readonly xp: number;
  readonly vistaEn: Date;
  readonly racionesHoy: number;
  readonly racionesDia: string | null;
  readonly xpDia: string | null;
  readonly hambreMax: number;
  readonly hambreMaxDia: string | null;
  readonly animoDia: string | null;
  readonly juguetesHoy: number;
  readonly juguetesDia: string | null;
  readonly racha: number;
  /** A quien protege ademas de a su dueño, si su especie sabe. */
  readonly protegeA: bigint | null;
  /** Lo que le robaron y aun no ha vuelto. */
  readonly robadoPendiente: number;
  readonly nonce: number;
  readonly huevosSinRara: number;
  readonly regalada: boolean;
  readonly nacidaEn: Date;
  /** La ficha clinica. `enfermaDesde` en null es una mascota sana. */
  readonly enfermaDesde: Date | null;
  readonly enfermaMotivo: string | null;
  readonly curaCoste: number | null;
  readonly curaResto: number | null;
  readonly curaVence: Date | null;
  readonly curaAvisos: number;
  readonly fallecidaEn: Date | null;
}

export interface NuevaMascota {
  readonly tenantId: string;
  readonly chatId: string;
  readonly userTelegramId: bigint;
  readonly especie: string;
  readonly rasgos: readonly string[];
  /** El reloj lo pone quien llama: aqui no hay `new Date()`. */
  readonly ahora: Date;
  /** Marca de bicho dado a mano por el creador. Se ve en el corral. */
  readonly regalada?: boolean;
  /**
   * Las semillas del commit-reveal con las que salio esta especie.
   *
   * Se guardan al crear y no despues: son la prueba de que el resultado no se
   * eligio a dedo. Sin ellas, "recomputalo tu mismo" no significa nada, que es
   * justo lo que hay que poder contestarle a quien crea que el bot le odia.
   */
  readonly serverSeed?: string;
  readonly serverSeedHash?: string;
  readonly clientSeed?: string;
}

/** Los cuatro numeros mas el reloj, que es lo que cambia el tick. */
export interface EstadoGuardable {
  readonly hambre: number;
  readonly animo: number;
  readonly nivel: number;
  readonly xp: number;
  readonly vistaEn: Date;
  /**
   * El dia UTC cuya XP se acaba de cobrar.
   *
   * Opcional y solo se manda en el barrido que de verdad cierra el dia. Si se
   * mandara siempre daria igual —el valor seria el mismo— pero escribirlo en
   * cada revision borraria la unica señal de que el cierre ya paso.
   */
  readonly xpDia?: string;
  /**
   * Lo mejor que estuvo la barra de hambre dentro del dia, con su dia al lado.
   *
   * Viajan juntos y siempre los dos: un maximo sin su dia no se distingue de
   * uno viejo, y escribir solo uno de ellos deja la pareja incoherente — que
   * es la unica forma de que el cierre lea un maximo de anteayer y regale un
   * dia cuidado.
   */
  readonly hambreMax?: number;
  readonly hambreMaxDia?: string;
  /**
   * La racha, recalculada al cerrar el dia.
   *
   * Opcional y por el mismo motivo que `xpDia`: solo viaja en el barrido que
   * de verdad cierra, no en las noventa y cinco revisiones que solo miran.
   */
  readonly racha?: number;
}

export type ResultadoDeRacion =
  | {
      readonly ok: true;
      readonly saldo: number;
      readonly racionesHoy: number;
      /** El nivel en que queda, ya guardado. Es lo que se anuncia. */
      readonly nivel: number;
    }
  | {
      readonly ok: false;
      readonly motivo: "sinSaldo" | "sinMascota";
      readonly saldo: number;
    };

/**
 * Como fue la operacion.
 *
 * `yaCurada` no es un error: es lo que contesta el segundo `/operar` de dos
 * seguidos, y hay que poder distinguirlo de "no llega" para no decirle a
 * alguien que no tiene dinero cuando lo que pasa es que ya ha pagado.
 */
export type ResultadoDeOperacion =
  | {
      readonly ok: true;
      /** Lo que se ha cobrado de verdad. */
      readonly pagado: number;
      /** Con cuanto se queda. */
      readonly saldo: number;
    }
  | {
      readonly ok: false;
      readonly motivo: "yaCurada" | "sinSaldo" | "sinMascota" | "haCambiado";
      readonly saldo: number;
    };

export type ResultadoDeRendimiento =
  | { readonly ok: true; readonly saldo: number }
  /** Ya se le pago hoy. No es un error: es la idempotencia funcionando. */
  | { readonly ok: false; readonly motivo: "yaPagadoHoy" };

export interface PetRepository {
  obtener(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
  ): Promise<PetState | null>;
  crear(nueva: NuevaMascota): Promise<PetState>;
  guardarEstado(id: string, estado: EstadoGuardable): Promise<void>;
  /** Cobra la racion y sube el hambre, o no hace ninguna de las dos cosas. */
  servirRacion(input: {
    readonly id: string;
    readonly tenantId: string;
    readonly chatId: string;
    readonly userTelegramId: bigint;
    readonly coste: number;
    readonly hambreNueva: number;
    /** XP y nivel ya calculados por el modulo. Aqui solo se guardan. */
    readonly xpNueva: number;
    readonly nivelNuevo: number;
    readonly diaUtc: string;
  }): Promise<ResultadoDeRacion>;
  /** Acuña el rendimiento del dia, una sola vez por dia. */
  pagarRendimiento(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly userTelegramId: bigint;
    readonly monedas: number;
    readonly diaUtc: string;
  }): Promise<ResultadoDeRendimiento>;
  /**
   * Juega con ella: sube el animo, gratis y una vez al dia.
   *
   * Devuelve `ok: false` cuando ya se jugo hoy, y esa respuesta la decide la
   * BASE DE DATOS, no una lectura previa: el `updateMany` lleva el dia en el
   * `where`, asi que dos toques a la vez suben el animo UNA vez. Comprobarlo
   * leyendo antes y escribiendo despues seria la carrera de siempre.
   */
  jugar(input: {
    readonly id: string;
    readonly animoNuevo: number;
    /**
     * XP y nivel ya calculados por el modulo.
     *
     * Entran en el MISMO `updateMany` que la marca del dia: si fueran dos
     * escrituras, la segunda llamada del dia no tocaria el animo pero si
     * podria volver a sumar la XP, y jugar seria una fuente repetible.
     */
    readonly xpNueva: number;
    readonly nivelNuevo: number;
    readonly diaUtc: string;
  }): Promise<{
    readonly ok: boolean;
    readonly animo: number;
    readonly nivel: number;
  }>;
  /**
   * Gasta un juguete: sube el animo y cuenta uno mas en el dia.
   *
   * El tope lo comprueba la transaccion, no quien llama: entre leer cuantos
   * van y escribir el siguiente hay sitio para otra compra, y dos a la vez se
   * saltarian el limite.
   */
  usarJuguete(input: {
    readonly id: string;
    readonly animoNuevo: number;
    readonly diaUtc: string;
    readonly topeDiario: number;
  }): Promise<{
    readonly ok: boolean;
    readonly animo: number;
    readonly juguetesHoy: number;
  }>;
  /**
   * Le pone nombre. Devuelve si de verdad cambio alguna fila.
   *
   * El nombre llega YA validado: quien decide que es un nombre valido es
   * `modules/games`, junto al codigo que compone el HTML donde acaba.
   */
  nombrar(id: string, nombre: string): Promise<boolean>;
  /** El corral del grupo, de mayor a menor nivel. */
  corral(
    tenantId: string,
    chatId: string,
    limite?: number,
  ): Promise<readonly PetState[]>;
  /** Las que llevan sin mirarse desde antes de `antesDe`. La cola del tick. */
  paraElTick(antesDe: Date, limite: number): Promise<readonly PetState[]>;
  /**
   * La mejor mascota de alguien en TODO el tenant, sin mirar el grupo.
   *
   * Existe para el casino, que es global por tenant mientras que las mascotas
   * son por grupo: ahi no hay un `chatId` con el que preguntar. Se coge la de
   * mayor nivel porque es la respuesta que la gente espera —"cuenta mi mejor
   * bicho"— y porque cualquier otra regla haria que el bono dependiera de en
   * que grupo escribiste por ultima vez, que no se puede ni explicar ni
   * predecir.
   */
  mejorDelUsuario(
    tenantId: string,
    userTelegramId: bigint,
  ): Promise<PetState | null>;
  /**
   * Pone —o quita, con `null`— a quien protege ademas de a su dueño.
   *
   * Devuelve si cambio alguna fila. Quien llama ya ha comprobado que la
   * especie sabe proteger: esto solo guarda.
   */
  protegerA(id: string, objetivo: bigint | null): Promise<boolean>;
  /**
   * El bicho que protege a esta persona, si alguien la protege.
   *
   * Se pregunta en CADA robo, por eso hay indice por `protegeA`. Devuelve uno
   * solo aunque varios la protejan: acumular escudos de media docena de
   * personas convertiria a alguien en intocable sin que se pudiera ver por
   * que.
   */
  quienProtegeA(
    tenantId: string,
    chatId: string,
    objetivo: bigint,
  ): Promise<PetState | null>;
  /**
   * Apunta que a alguien le acaban de robar, para que su bicho lo devuelva.
   *
   * Suma sobre lo que ya hubiera pendiente: dos robos seguidos se recuperan
   * los dos, no solo el ultimo.
   */
  apuntarRobado(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    cantidad: number,
  ): Promise<void>;
  /**
   * Devuelve parte de lo robado: acuña las monedas y baja el pendiente.
   *
   * **Las dos cosas o ninguna**, y una vez al dia: el `refId` del libro mayor
   * lleva el dia UTC, igual que el rendimiento. Sin eso, el barrido —que corre
   * cada quince minutos— devolveria lo robado noventa y seis veces al dia, que
   * es exactamente el fallo que ya paso con la XP.
   */
  devolverRobado(input: {
    readonly id: string;
    readonly tenantId: string;
    readonly chatId: string;
    readonly userTelegramId: bigint;
    readonly monedas: number;
    readonly diaUtc: string;
  }): Promise<{ readonly ok: boolean }>;
  /**
   * Declara una enfermedad grave. Solo prende si la mascota estaba sana.
   *
   * La condicion va en el WHERE y no en un `if` de quien llama: entre mirar y
   * escribir cabe otro mando, y reenfermar reiniciaria el plazo en silencio.
   */
  enfermar(input: {
    readonly id: string;
    readonly desde: Date;
    readonly motivo: string;
    readonly coste: number;
    readonly resto: number;
    readonly vence: Date;
  }): Promise<boolean>;
  /**
   * Paga la operacion: cura y cobra, o no hace ninguna de las dos cosas.
   *
   * `aPagar` y `resto` los decide `modules/games`; aqui solo se ejecuta. Lo que
   * si es de aqui es la atomicidad, que no la puede dar ningun modulo.
   */
  operar(input: {
    readonly id: string;
    readonly tenantId: string;
    readonly chatId: string;
    readonly userTelegramId: bigint;
    readonly aPagar: number;
    readonly resto: number;
    /** Para el `refId` del libro mayor: identifica ESTA enfermedad. */
    readonly refId: string;
  }): Promise<ResultadoDeOperacion>;
  /**
   * La mata. Solo prende si seguia enferma y viva.
   *
   * Marca `fallecidaEn` y deja la ficha clinica intacta a proposito: es lo
   * unico que puede contestar despues a "¿y de que murio?".
   */
  fallecer(id: string, cuando: Date): Promise<boolean>;
  /** El indulto: la cura sin cobrar. Devuelve si de verdad estaba enferma. */
  sanar(id: string): Promise<boolean>;
  /**
   * Devuelve a la vida a una fallecida, sana y con `vistaEn` puesto a `cuando`.
   *
   * El reloj no es un detalle: sin ponerlo, el primer barrido le pasaria de
   * golpe todo el tiempo que estuvo muerta y se dormiria de hambre en el mismo
   * minuto en que la resucitas.
   */
  revivir(id: string, cuando: Date): Promise<boolean>;
  /**
   * Apunta cuantos recordatorios se han mandado ya.
   *
   * Con el numero de avisos que se espera encontrar dentro del WHERE: dos
   * barridos solapados no pueden mandar el mismo aviso dos veces, porque el
   * segundo no encuentra fila que cumpla la condicion.
   */
  marcarAvisos(id: string, deQue: number, aQue: number): Promise<boolean>;
  /** Las enfermas o fallecidas de un grupo. Para el corral y los informes. */
  enfermasDelGrupo(
    tenantId: string,
    chatId: string,
  ): Promise<readonly PetState[]>;
}

type FilaDeMascota = {
  id: string;
  tenantId: string;
  chatId: string;
  userTelegramId: bigint;
  especie: string;
  rasgos: string[];
  nombre: string | null;
  hambre: number;
  animo: number;
  nivel: number;
  xp: number;
  vistaEn: Date;
  racionesHoy: number;
  racionesDia: string | null;
  xpDia: string | null;
  hambreMax: number;
  hambreMaxDia: string | null;
  animoDia: string | null;
  juguetesHoy: number;
  juguetesDia: string | null;
  racha: number;
  protegeA: bigint | null;
  robadoPendiente: number;
  nonce: number;
  huevosSinRara: number;
  regalada: boolean;
  nacidaEn: Date;
  enfermaDesde: Date | null;
  enfermaMotivo: string | null;
  curaCoste: number | null;
  curaResto: number | null;
  curaVence: Date | null;
  curaAvisos: number;
  fallecidaEn: Date | null;
};

const aEstado = (fila: FilaDeMascota): PetState => ({
  id: fila.id,
  tenantId: fila.tenantId,
  chatId: fila.chatId,
  userTelegramId: fila.userTelegramId,
  especie: fila.especie,
  rasgos: fila.rasgos,
  nombre: fila.nombre,
  hambre: fila.hambre,
  animo: fila.animo,
  nivel: fila.nivel,
  xp: fila.xp,
  vistaEn: fila.vistaEn,
  racionesHoy: fila.racionesHoy,
  racionesDia: fila.racionesDia,
  xpDia: fila.xpDia,
  protegeA: fila.protegeA,
  robadoPendiente: fila.robadoPendiente,
  hambreMax: fila.hambreMax,
  hambreMaxDia: fila.hambreMaxDia,
  animoDia: fila.animoDia,
  juguetesHoy: fila.juguetesHoy,
  juguetesDia: fila.juguetesDia,
  racha: fila.racha,
  nonce: fila.nonce,
  huevosSinRara: fila.huevosSinRara,
  regalada: fila.regalada,
  nacidaEn: fila.nacidaEn,
  enfermaDesde: fila.enfermaDesde,
  enfermaMotivo: fila.enfermaMotivo,
  curaCoste: fila.curaCoste,
  curaResto: fila.curaResto,
  curaVence: fila.curaVence,
  curaAvisos: fila.curaAvisos,
  fallecidaEn: fila.fallecidaEn,
});

/** El codigo que Postgres devuelve al violar un unique. */
const esViolacionDeUnico = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: unknown }).code === "P2002";

export class PrismaPetRepository implements PetRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async obtener(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
  ): Promise<PetState | null> {
    const fila = await this.client.pet.findUnique({
      where: {
        tenantId_chatId_userTelegramId: { tenantId, chatId, userTelegramId },
      },
    });
    return fila ? aEstado(fila) : null;
  }

  async crear(nueva: NuevaMascota): Promise<PetState> {
    const fila = await this.client.pet.create({
      data: {
        tenantId: nueva.tenantId,
        chatId: nueva.chatId,
        userTelegramId: nueva.userTelegramId,
        especie: nueva.especie,
        rasgos: [...nueva.rasgos],
        vistaEn: nueva.ahora,
        nacidaEn: nueva.ahora,
        regalada: nueva.regalada ?? false,
        serverSeed: nueva.serverSeed ?? null,
        serverSeedHash: nueva.serverSeedHash ?? null,
        clientSeed: nueva.clientSeed ?? null,
      },
    });
    return aEstado(fila);
  }

  async guardarEstado(id: string, estado: EstadoGuardable): Promise<void> {
    await this.client.pet.update({
      where: { id },
      data: {
        hambre: estado.hambre,
        animo: estado.animo,
        nivel: estado.nivel,
        xp: estado.xp,
        vistaEn: estado.vistaEn,
        ...(estado.xpDia === undefined ? {} : { xpDia: estado.xpDia }),
        ...(estado.racha === undefined ? {} : { racha: estado.racha }),
        // Los dos o ninguno: la pareja incoherente es lo unico que puede hacer
        // que el cierre lea un maximo de anteayer y regale un dia cuidado.
        ...(estado.hambreMax === undefined || estado.hambreMaxDia === undefined
          ? {}
          : { hambreMax: estado.hambreMax, hambreMaxDia: estado.hambreMaxDia }),
      },
    });
  }

  async servirRacion(input: {
    id: string;
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    coste: number;
    hambreNueva: number;
    /** XP y nivel ya calculados por el modulo. Aqui solo se guardan. */
    xpNueva: number;
    nivelNuevo: number;
    diaUtc: string;
  }): Promise<ResultadoDeRacion> {
    const {
      id,
      tenantId,
      chatId,
      userTelegramId,
      coste,
      hambreNueva,
      xpNueva,
      nivelNuevo,
      diaUtc,
    } = input;

    return this.client.$transaction(async (tx) => {
      // El cobro va primero y por la puerta comun de la economia. La guarda de
      // saldo sigue en el WHERE —dos raciones a la vez no pueden pasar las dos,
      // porque la segunda no encuentra fila que cumpla el `gte`— y ademas una
      // cartera con saldo sin fondo come sin que su cifra se mueva. Antes esto
      // era un `updateMany` propio que no sabia de la bandera y restaba igual.
      const cobro = await cobrarSaldoDeCartera(
        tx,
        { tenantId, chatId, userTelegramId },
        coste,
      );
      if (!cobro.pagado) {
        return {
          ok: false as const,
          motivo: "sinSaldo" as const,
          saldo: cobro.balance,
        };
      }

      await tx.economyLedger.create({
        data: {
          tenantId,
          chatId,
          telegramUserId: userTelegramId,
          delta: -coste,
          reason: "pet-feed",
          // Sin `refId`: las raciones son repetibles dentro del dia, y en
          // Postgres dos NULL no colisionan. Poner aqui el dia UTC haria que la
          // segunda racion del dia fallara por unique.
          refId: null,
        },
      });

      // El contador de raciones se reinicia solo al cambiar el dia: es lo que
      // hace que un contador viejo no cuente como servido hoy.
      const mismoDia = await tx.pet.findUnique({ where: { id } });
      const servidasHoy =
        mismoDia?.racionesDia === diaUtc ? (mismoDia?.racionesHoy ?? 0) : 0;

      // El maximo del dia se levanta AQUI y no en el tick, porque comer es lo
      // unico que sube la barra: el barrido solo la baja, asi que un maximo
      // que dependiera de el nunca veria el pico. Un maximo de otro dia no
      // cuenta y se sustituye entero.
      const maximoPrevio =
        mismoDia?.hambreMaxDia === diaUtc ? (mismoDia?.hambreMax ?? 0) : 0;

      const actualizada = await tx.pet.update({
        where: { id },
        data: {
          hambre: hambreNueva,
          racionesHoy: servidasHoy + 1,
          racionesDia: diaUtc,
          xp: xpNueva,
          nivel: nivelNuevo,
          hambreMax: Math.max(maximoPrevio, Math.round(hambreNueva)),
          hambreMaxDia: diaUtc,
        },
      });

      const cartera = await tx.economyWallet.findUniqueOrThrow({
        where: {
          tenantId_chatId_userTelegramId: { tenantId, chatId, userTelegramId },
        },
      });
      return {
        ok: true as const,
        saldo: cartera.balance,
        racionesHoy: actualizada.racionesHoy,
        nivel: actualizada.nivel,
      };
    });
  }

  async pagarRendimiento(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    monedas: number;
    diaUtc: string;
  }): Promise<ResultadoDeRendimiento> {
    const { tenantId, chatId, userTelegramId, monedas, diaUtc } = input;
    if (monedas <= 0) {
      return { ok: false, motivo: "yaPagadoHoy" };
    }

    try {
      return await this.client.$transaction(async (tx) => {
        // El apunte va PRIMERO. Si el dia ya estaba pagado, el unique del libro
        // mayor lanza aqui y la transaccion entera se deshace sin haber tocado
        // el saldo. Al reves —acuñar y luego anotar— un reintento pagaria dos
        // veces y solo fallaria al anotar.
        await tx.economyLedger.create({
          data: {
            tenantId,
            chatId,
            telegramUserId: userTelegramId,
            delta: monedas,
            reason: "pet-yield",
            refId: diaUtc,
          },
        });
        // Por la puerta comun: a una cartera con saldo sin fondo no se le
        // abona. El `update` propio que habia aqui fue el incidente del
        // 2026-09-11: con la cartera en el techo del `integer`, cada rendimiento
        // reventaba con "integer out of range", la transaccion se deshacia,
        // `vistaEn` no avanzaba y el barrido la volvia a coger al minuto
        // siguiente. Sesenta errores por hora durante seis horas.
        const saldo = await abonarSaldoDeCartera(
          tx,
          { tenantId, chatId, userTelegramId },
          monedas,
        );
        return { ok: true as const, saldo };
      });
    } catch (error) {
      if (esViolacionDeUnico(error)) {
        return { ok: false, motivo: "yaPagadoHoy" };
      }
      throw error;
    }
  }

  async jugar(input: {
    id: string;
    animoNuevo: number;
    /** XP y nivel ya calculados por el modulo. Aqui solo se guardan. */
    xpNueva: number;
    nivelNuevo: number;
    diaUtc: string;
  }): Promise<{ ok: boolean; animo: number; nivel: number }> {
    // El dia va en el `where`, que es lo que hace la operacion atomica: la
    // segunda llamada del mismo dia no encuentra fila y no toca nada.
    //
    // El `null` va APARTE y explicito. Un `NOT: { animoDia: dia }` a secas
    // parece que lo cubre y no lo cubre: en SQL `NULL <> '2026-08-28'` no es
    // cierto, es desconocido, asi que la fila no casa. Con eso, una mascota que
    // no ha jugado nunca —o sea, todas— no habria podido jugar jamas. Lo cazo
    // el test de integracion, que es justo para lo que esta.
    const jugado = await this.client.pet.updateMany({
      where: {
        id: input.id,
        OR: [{ animoDia: null }, { animoDia: { not: input.diaUtc } }],
      },
      // La XP entra en el MISMO `updateMany` que el dia, no en un update
      // aparte: si fueran dos, la segunda llamada del dia no tocaria el animo
      // pero si podria volver a sumar la XP, y jugar seria una fuente
      // repetible. Van juntas o no va ninguna.
      data: {
        animo: input.animoNuevo,
        animoDia: input.diaUtc,
        xp: input.xpNueva,
        nivel: input.nivelNuevo,
      },
    });
    if (jugado.count > 0) {
      return { ok: true, animo: input.animoNuevo, nivel: input.nivelNuevo };
    }
    // Ya se habia jugado hoy. Se devuelve el animo que hay para poder decirlo
    // sin mentir, en vez de repetir el que se pretendia dejar.
    const fila = await this.client.pet.findUnique({ where: { id: input.id } });
    return { ok: false, animo: fila?.animo ?? 0, nivel: fila?.nivel ?? 1 };
  }

  /**
   * Gasta un juguete: sube el animo y cuenta uno mas en el dia.
   *
   * Va en una transaccion y el contador se lee DENTRO, igual que
   * `servirRacion`: entre leer cuantos van y escribir el siguiente hay sitio
   * para otra compra, y sin la transaccion dos a la vez se saltarian el tope.
   *
   * El contador se reinicia solo al cambiar el dia — un `juguetesDia` viejo
   * cuenta como cero— asi que no hace falta un barrido que lo ponga a cero.
   */
  async usarJuguete(input: {
    id: string;
    animoNuevo: number;
    diaUtc: string;
    topeDiario: number;
  }): Promise<{ ok: boolean; animo: number; juguetesHoy: number }> {
    return this.client.$transaction(async (tx) => {
      const fila = await tx.pet.findUnique({ where: { id: input.id } });
      if (!fila) {
        return { ok: false, animo: 0, juguetesHoy: 0 };
      }
      const usados = fila.juguetesDia === input.diaUtc ? fila.juguetesHoy : 0;
      if (usados >= input.topeDiario) {
        return { ok: false, animo: fila.animo, juguetesHoy: usados };
      }
      const actualizada = await tx.pet.update({
        where: { id: input.id },
        data: {
          animo: input.animoNuevo,
          juguetesHoy: usados + 1,
          juguetesDia: input.diaUtc,
        },
      });
      return {
        ok: true,
        animo: actualizada.animo,
        juguetesHoy: actualizada.juguetesHoy,
      };
    });
  }

  async nombrar(id: string, nombre: string): Promise<boolean> {
    const puesto = await this.client.pet.updateMany({
      where: { id },
      data: { nombre },
    });
    return puesto.count > 0;
  }

  async corral(
    tenantId: string,
    chatId: string,
    limite = 50,
  ): Promise<readonly PetState[]> {
    const filas = await this.client.pet.findMany({
      where: { tenantId, chatId },
      orderBy: [{ nivel: "desc" }, { xp: "desc" }],
      take: limite,
    });
    return filas.map(aEstado);
  }

  async paraElTick(
    antesDe: Date,
    limite: number,
  ): Promise<readonly PetState[]> {
    const filas = await this.client.pet.findMany({
      // Las fallecidas no entran. No es solo que no tengan nada que procesar:
      // como el barrido es quien mueve `vistaEn`, una muerta se quedaria con el
      // reloj parado y volveria a salir en CADA lote para siempre, comiendose
      // sitio de las 200 que si tienen algo que hacer.
      where: { vistaEn: { lt: antesDe }, fallecidaEn: null },
      orderBy: { vistaEn: "asc" },
      take: limite,
    });
    return filas.map(aEstado);
  }

  async mejorDelUsuario(
    tenantId: string,
    userTelegramId: bigint,
  ): Promise<PetState | null> {
    const fila = await this.client.pet.findFirst({
      where: { tenantId, userTelegramId },
      orderBy: { nivel: "desc" },
    });
    return fila ? aEstado(fila) : null;
  }

  async protegerA(id: string, objetivo: bigint | null): Promise<boolean> {
    const cambiadas = await this.client.pet.updateMany({
      where: { id },
      data: { protegeA: objetivo },
    });
    return cambiadas.count > 0;
  }

  async quienProtegeA(
    tenantId: string,
    chatId: string,
    objetivo: bigint,
  ): Promise<PetState | null> {
    // El mas subido de los que la protejan, si hay varios. Da igual cual sea
    // mientras sea uno solo y estable: lo que no puede pasar es que se sumen.
    const fila = await this.client.pet.findFirst({
      where: { tenantId, chatId, protegeA: objetivo },
      orderBy: { nivel: "desc" },
    });
    return fila ? aEstado(fila) : null;
  }

  async apuntarRobado(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    cantidad: number,
  ): Promise<void> {
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return;
    }
    // `increment` y no leer-sumar-escribir: dos robos a la vez a la misma
    // persona se apuntan los dos.
    await this.client.pet.updateMany({
      where: { tenantId, chatId, userTelegramId },
      data: { robadoPendiente: { increment: Math.trunc(cantidad) } },
    });
  }

  async devolverRobado(input: {
    id: string;
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    monedas: number;
    diaUtc: string;
  }): Promise<{ ok: boolean }> {
    const { id, tenantId, chatId, userTelegramId, monedas, diaUtc } = input;
    if (monedas <= 0) {
      return { ok: false };
    }

    try {
      return await this.client.$transaction(async (tx) => {
        // El apunte va PRIMERO, igual que en `pagarRendimiento`: si el dia ya
        // estaba devuelto, el unique del libro mayor lanza aqui y la
        // transaccion se deshace sin haber tocado ni el saldo ni el pendiente.
        // Al reves, un reintento devolveria dos veces y solo fallaria al final.
        await tx.economyLedger.create({
          data: {
            tenantId,
            chatId,
            telegramUserId: userTelegramId,
            delta: monedas,
            reason: "pet-recovery",
            refId: `${id}:${diaUtc}`,
          },
        });
        await abonarSaldoDeCartera(
          tx,
          { tenantId, chatId, userTelegramId },
          monedas,
        );
        // Nunca por debajo de cero: el pendiente pudo bajar entre que se leyo
        // y se llego aqui.
        await tx.pet.updateMany({
          where: { id, robadoPendiente: { gte: monedas } },
          data: { robadoPendiente: { decrement: monedas } },
        });
        return { ok: true };
      });
    } catch {
      // Ya se devolvio hoy. No es un error: es la idempotencia funcionando.
      return { ok: false };
    }
  }

  async enfermar(input: {
    id: string;
    desde: Date;
    motivo: string;
    coste: number;
    resto: number;
    vence: Date;
  }): Promise<boolean> {
    // `enfermaDesde: null` y `fallecidaEn: null` van en el WHERE y no en un
    // `if` de quien llama: entre mirar y escribir cabe otro mando, y reenfermar
    // reiniciaria el plazo en silencio — que es el fallo mas facil de cometer,
    // porque basta con escribir el mando dos veces sin ver la primera
    // respuesta.
    const cambiadas = await this.client.pet.updateMany({
      where: { id: input.id, enfermaDesde: null, fallecidaEn: null },
      data: {
        enfermaDesde: input.desde,
        enfermaMotivo: input.motivo,
        curaCoste: input.coste,
        curaResto: input.resto,
        curaVence: input.vence,
        curaAvisos: 0,
      },
    });
    return cambiadas.count === 1;
  }

  async operar(input: {
    id: string;
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    aPagar: number;
    resto: number;
    refId: string;
  }): Promise<ResultadoDeOperacion> {
    const { id, tenantId, chatId, userTelegramId, aPagar, resto, refId } =
      input;

    return this.client
      .$transaction(async (tx) => {
        // 1. La cura va PRIMERO y condicionada a que siga enferma.
        //
        // Es la exclusion mutua de toda la operacion: dos `/operar` seguidos —y
        // llegan seguidos, porque el primero tarda y la gente repite— no pueden
        // cobrar dos veces, porque el segundo no encuentra fila que siga
        // enferma. Al reves —cobrar y luego curar— la ventana entre las dos
        // escrituras es justo donde cabe el cobro duplicado.
        const curada = await tx.pet.updateMany({
          where: { id, enfermaDesde: { not: null }, fallecidaEn: null },
          data: {
            enfermaDesde: null,
            enfermaMotivo: null,
            curaCoste: null,
            curaResto: null,
            curaVence: null,
            curaAvisos: 0,
          },
        });
        if (curada.count === 0) {
          const yaCurada = await tx.economyWallet.findUnique({
            where: {
              tenantId_chatId_userTelegramId: {
                tenantId,
                chatId,
                userTelegramId,
              },
            },
          });
          return {
            ok: false as const,
            motivo: "yaCurada" as const,
            saldo: yaCurada?.balance ?? 0,
          };
        }

        const cartera = await tx.economyWallet.findUnique({
          where: {
            tenantId_chatId_userTelegramId: {
              tenantId,
              chatId,
              userTelegramId,
            },
          },
        });
        if (!cartera || (!cartera.unlimited && cartera.balance < aPagar)) {
          // Lanzar y no devolver: hay que revertir la cura del paso 1.
          // Devolverla la dejaria curada gratis, que es exactamente el agujero
          // que esta transaccion existe para tapar.
          throw new SinSaldoParaOperar(cartera?.balance ?? 0);
        }

        // Una cartera con saldo sin fondo paga y NO se mueve, igual que en el
        // resto de la economia: la factura queda en el libro mayor y la cifra se
        // queda donde estaba. Dejarla en `resto` seria cobrarle de verdad a quien,
        // por definicion, no tiene fondo que vaciar. La exclusion mutua no
        // cambia: la sigue poniendo la cura del paso 1.
        if (!cartera.unlimited) {
          // El saldo leido va DENTRO del WHERE, asi que si alguien lo movio entre
          // la lectura y esta linea —una apuesta del casino cabe de sobra— no se
          // escribe nada y la transaccion entera se deshace. Es lo que permite
          // dejar el saldo en un valor exacto en vez de restar a ciegas: un
          // `decrement` sobre un balance que ya cambio daria otro resultado, y el
          // encargo era "que se quede con esto".
          const cobrado = await tx.economyWallet.updateMany({
            where: {
              tenantId,
              chatId,
              userTelegramId,
              balance: cartera.balance,
            },
            data: {
              balance: resto,
              // La caja fuerte cuenta DENTRO del saldo, asi que dejarla como
              // estaba haria que protegiera mas de lo que hay. No es estetica:
              // `protectedBalance` es lo que `/robar` no puede tocar, y uno por
              // encima del saldo real vuelve a alguien intocable sin que se vea
              // por que.
              protectedBalance: Math.min(cartera.protectedBalance, resto),
            },
          });
          if (cobrado.count === 0) {
            throw new SaldoCambiadoAlOperar(cartera.balance);
          }
        }

        await tx.economyLedger.create({
          data: {
            tenantId,
            chatId,
            telegramUserId: userTelegramId,
            delta: -aPagar,
            reason: "pet-surgery",
            // El `refId` lleva la fecha del diagnostico, no solo el id de la
            // mascota. El unique del libro mayor hace el cobro idempotente para
            // ESTA enfermedad y deja pagar la siguiente: sin la fecha, la
            // segunda enfermedad de su vida saldria gratis.
            refId,
          },
        });

        return {
          ok: true as const,
          pagado: aPagar,
          saldo: cartera.unlimited ? cartera.balance : resto,
        };
      })
      .catch((error: unknown) => {
        if (error instanceof SinSaldoParaOperar) {
          return {
            ok: false as const,
            motivo: "sinSaldo" as const,
            saldo: error.saldo,
          };
        }
        if (error instanceof SaldoCambiadoAlOperar) {
          return {
            ok: false as const,
            motivo: "haCambiado" as const,
            saldo: error.saldo,
          };
        }
        throw error;
      });
  }

  async fallecer(id: string, cuando: Date): Promise<boolean> {
    // La ficha clinica se deja intacta: es lo unico que puede contestar despues
    // a de que murio. Solo se marca la muerte.
    const cambiadas = await this.client.pet.updateMany({
      where: { id, enfermaDesde: { not: null }, fallecidaEn: null },
      data: { fallecidaEn: cuando },
    });
    return cambiadas.count === 1;
  }

  async sanar(id: string): Promise<boolean> {
    const cambiadas = await this.client.pet.updateMany({
      where: { id, enfermaDesde: { not: null }, fallecidaEn: null },
      data: {
        enfermaDesde: null,
        enfermaMotivo: null,
        curaCoste: null,
        curaResto: null,
        curaVence: null,
        curaAvisos: 0,
      },
    });
    return cambiadas.count === 1;
  }

  async revivir(id: string, cuando: Date): Promise<boolean> {
    // Vuelve viva y SANA. Revivirla dejandola enferma con el plazo ya vencido
    // la mataria otra vez en el siguiente barrido, quince minutos despues.
    const cambiadas = await this.client.pet.updateMany({
      where: { id, fallecidaEn: { not: null } },
      data: {
        fallecidaEn: null,
        // El reloj se pone a cero al volver. Sin esto, una que llevara una
        // semana muerta reviviria y el primer barrido le pasaria la semana
        // entera de golpe: se dormiria de hambre en el mismo minuto en que la
        // resucitas, que no es lo que nadie entiende por revivir.
        vistaEn: cuando,
        enfermaDesde: null,
        enfermaMotivo: null,
        curaCoste: null,
        curaResto: null,
        curaVence: null,
        curaAvisos: 0,
      },
    });
    return cambiadas.count === 1;
  }

  async marcarAvisos(
    id: string,
    deQue: number,
    aQue: number,
  ): Promise<boolean> {
    // El numero que se espera encontrar va en el WHERE: dos barridos solapados
    // no pueden mandar el mismo aviso dos veces, porque el segundo no encuentra
    // fila con ese contador.
    const cambiadas = await this.client.pet.updateMany({
      where: { id, curaAvisos: deQue, enfermaDesde: { not: null } },
      data: { curaAvisos: aQue },
    });
    return cambiadas.count === 1;
  }

  async enfermasDelGrupo(
    tenantId: string,
    chatId: string,
  ): Promise<readonly PetState[]> {
    const filas = await this.client.pet.findMany({
      where: {
        tenantId,
        chatId,
        OR: [{ enfermaDesde: { not: null } }, { fallecidaEn: { not: null } }],
      },
      orderBy: { curaVence: "asc" },
    });
    return filas.map(aEstado);
  }
}

/**
 * Dos señales internas de `operar`, y solo eso.
 *
 * Existen porque dentro de una transaccion **no vale devolver un fallo**: el
 * `return` la confirma, y confirmarla dejaria la mascota curada gratis, que es
 * justo el agujero que la transaccion existe para tapar. Lanzar es lo unico que
 * Prisma entiende como "deshaz esto".
 *
 * No salen de este fichero: `operar` las traduce a su resultado tipado.
 */
class SinSaldoParaOperar extends Error {
  constructor(readonly saldo: number) {
    super("sin saldo para operar");
  }
}

class SaldoCambiadoAlOperar extends Error {
  constructor(readonly saldo: number) {
    super("el saldo cambio mientras se operaba");
  }
}

/**
 * Lo que los handlers de mascotas necesitan del mundo exterior.
 *
 * **El puerto lo declara el MODULO, no `packages/domain`.** Los puertos del
 * dominio son transversales —Telegram, permisos, reloj—; la persistencia de
 * cada modulo es suya. Un puerto generico por repositorio en el dominio
 * reconstruiria el acoplamiento con un paso mas.
 *
 * Va **ya atado a la persona y al grupo de ESTE update**: no hay `tenantId` ni
 * `chatId` en ninguna firma. El nucleo construye el adaptador con ese contexto,
 * asi que un handler no puede leer la mascota de otro grupo porque no tiene con
 * que pedirla. Es la misma idea que impide que `TelegramPort` acepte un token.
 *
 * Los nombres estan traducidos a la forma del modulo (`hambre`, `animo`) y no a
 * la de la fila. Ese renombrado es justo lo que impide que el modulo sepa que
 * existe Prisma.
 */

import type { EspecieId } from "../especies.js";
import type { RasgoId } from "../rasgos.js";

/** Una mascota tal y como la ve el modulo. */
export interface MascotaVista {
  readonly especie: EspecieId;
  readonly rasgos: readonly RasgoId[];
  readonly nombre: string | null;
  readonly hambre: number;
  readonly animo: number;
  readonly nivel: number;
  readonly xp: number;
  /** Raciones ya servidas hoy, con el dia ya resuelto por quien lee. */
  readonly racionesHoy: number;
  readonly regalada: boolean;
  /**
   * Su ficha clinica, si esta enferma o ha fallecido.
   *
   * `null` es "sana", que es el caso de todas menos las que alguien haya
   * enfermado a mano. Va dentro de la vista y no en una consulta aparte porque
   * la salud manda sobre todo lo demas: una ficha que enseñe barras y niveles
   * sin decir que al bicho le quedan seis horas esta contando otra cosa.
   */
  readonly salud: SaludDeMascota | null;
}

/** Lo que hay que saber de una mascota enferma para poder contarlo. */
export interface SaludDeMascota {
  readonly estado: "enferma" | "vencida" | "muerta";
  readonly motivo: string | null;
  /** La factura pactada. */
  readonly coste: number;
  /** Con cuanto se queda quien pague. */
  readonly resto: number;
  /** Lo que queda de plazo, en milisegundos. Cero si ya se paso. */
  readonly msQueQuedan: number;
  /** Lo que queda de duelo, en milisegundos. Solo para las muertas. */
  readonly msDeDuelo: number;
}

/** Una linea del corral. */
export interface EntradaDeCorral {
  readonly usuario: bigint;
  readonly especie: EspecieId;
  readonly nombre: string | null;
  readonly nivel: number;
  readonly hambre: number;
  readonly regalada: boolean;
  /**
   * Si esta grave o ha fallecido.
   *
   * En el corral y no solo en la ficha porque **que se vea desde fuera es la
   * mitad de la mecanica**: una enfermedad que solo conoce su dueño es una
   * multa privada, y lo que la hace funcionar es que el grupo la mire.
   */
  readonly estadoDeSalud?: "enferma" | "vencida" | "muerta";
}

/**
 * Lo que hay que contar de la experiencia que acaba de ganar.
 *
 * Va pegado al resultado de la accion y no en una consulta aparte **porque el
 * anuncio solo sirve en ese momento**. Una mascota que sube de nivel y se
 * entera su dueño tres dias despues, al abrir la ficha, no ha subido de nivel
 * para el: ha aparecido con otro numero. Ese fue el estado real de la feature
 * hasta hoy — el tick calculaba `haSubido`, lo contaba en su resumen y no se
 * lo decia a nadie.
 */
export interface ProgresoDeMascota {
  /** XP sumada con esta accion. Cero es una respuesta valida. */
  readonly xpGanada: number;
  /** El nivel en que queda. */
  readonly nivel: number;
  /** Si ha cruzado un nivel justo ahora. */
  readonly haSubido: boolean;
  /** Si acaba de llegar al nivel de evolucion. */
  readonly evoluciona: boolean;
}

/** Por que no se ha podido dar de comer, ya resuelto contra la cartera. */
export type FalloAlAlimentar = "sinSaldo" | "topeDiario" | "yaLlena";

export type SalidaDeRacion =
  | {
      readonly ok: true;
      readonly coste: number;
      readonly hambre: number;
      readonly progreso: ProgresoDeMascota;
    }
  | {
      readonly ok: false;
      readonly motivo: FalloAlAlimentar;
      readonly coste: number;
      readonly saldo: number;
    };

/**
 * Como fue el rato de juego.
 *
 * `yaHoy` no es un error: es la respuesta normal a partir del segundo intento
 * del dia, y se cuenta como tal. `sinMascota` existe porque a este comando se
 * puede llegar sin bicho.
 */
export type SalidaDeJuego =
  | {
      readonly ok: true;
      readonly animo: number;
      readonly subida: number;
      readonly progreso: ProgresoDeMascota;
    }
  | { readonly ok: false; readonly motivo: "yaHoy" | "sinMascota" };

/**
 * Como fue el encargo de proteger a alguien.
 *
 * `noSabeProteger` es distinto de `sinMascota` a proposito: tener bicho y que
 * no sea de los que protegen es la respuesta mas comun, y confundirla con "no
 * tienes bicho" manda a la gente a comprar un huevo que ya tiene.
 */
export type SalidaDeProteger =
  | {
      readonly ok: true;
      /** A quien protege ahora. `null` es "ha dejado de proteger a nadie". */
      readonly objetivo: bigint | null;
    }
  | {
      readonly ok: false;
      readonly motivo: "sinMascota" | "noSabeProteger" | "aTiMismo";
    };

export type SalidaDeHuevo =
  | { readonly ok: true; readonly especie: EspecieId; readonly gratis: boolean }
  | {
      readonly ok: false;
      readonly motivo: "yaTiene" | "sinSaldo";
      readonly precio: number;
      readonly saldo: number;
    };

/**
 * Como fue la operacion de urgencia.
 *
 * `yaCurada` no es un error: es lo que contesta el segundo `/operar` de dos
 * seguidos, y hay que distinguirlo de "no llega" para no decirle a alguien que
 * no tiene dinero cuando lo que pasa es que ya ha pagado.
 */
export type SalidaDeOperacion =
  | {
      readonly ok: true;
      readonly pagado: number;
      readonly saldo: number;
    }
  | {
      readonly ok: false;
      readonly motivo:
        | "sinMascota"
        | "sanaYa"
        | "yaMuerta"
        | "fueraDePlazo"
        | "noLlega"
        | "yaCurada"
        | "haCambiado";
      /** La factura pactada, para poder decirla en la negativa. */
      readonly coste: number;
      readonly saldo: number;
    };

export interface PuertoDeMascotas {
  /** La mascota de quien escribe. */
  mia(): Promise<MascotaVista | null>;
  /** La de otra persona del mismo grupo. */
  deOtro(usuario: bigint): Promise<MascotaVista | null>;
  /** El corral del grupo, ya ordenado. */
  corral(limite: number): Promise<readonly EntradaDeCorral[]>;
  /** El saldo de quien escribe. */
  saldo(): Promise<number>;
  /** Sirve una racion. Cobra y llena, o no hace ninguna de las dos cosas. */
  alimentar(): Promise<SalidaDeRacion>;
  /** Compra un huevo y lo abre. En la fase 1 no hay espera de eclosion. */
  nacer(): Promise<SalidaDeHuevo>;
  /** Juega un rato con ella: gratis, una vez al dia, y le sube el animo. */
  jugar(): Promise<SalidaDeJuego>;
  /** Le pone nombre. Ya validado por quien llama. */
  nombrar(nombre: string): Promise<boolean>;
  /**
   * Paga la operacion de urgencia.
   *
   * Cura y cobra, o no hace ninguna de las dos cosas. Lo que se cobra es lo que
   * sobre del suelo pactado, no una cifra fija: el encargo era "que se quede
   * con esto", y una resta congelada envejece mal en cuanto se gasta algo.
   */
  operar(): Promise<SalidaDeOperacion>;
  /**
   * Encarga a su bicho que cubra tambien a otra persona.
   *
   * Con `null` deja de proteger a nadie. Quien comprueba que la especie sabe
   * hacerlo es el adaptador, que es quien conoce el catalogo de la fila.
   */
  proteger(objetivo: bigint | null): Promise<SalidaDeProteger>;
}

/** Como se llama alguien, para poder nombrarlo en el corral. */
export type NombreDeUsuario = (usuario: bigint) => string;

/**
 * Cuanto rinde una mascota hoy.
 *
 * Es el fichero mas delicado de la feature, porque es el unico que **acuña
 * moneda**. Todo lo demas mueve saldo de un bolsillo a otro o lo quema; esto lo
 * crea. Dos consecuencias que estan escritas en el codigo y no solo aqui:
 *
 * 1. **Hay un tope duro**, y no depende del nivel ni de la especie. Sin el, un
 *    bicho muy subido con la especie adecuada seria una impresora, y el error
 *    se descubriria por la inflacion y no por un test.
 * 2. **Devuelve menos de lo que cuesta mantenerla.** Tres raciones son 450 al
 *    dia; el rendimiento de referencia ronda 380. Los 70 de diferencia son el
 *    sumidero, y lo que compensa a quien juega no es dinero: es el bono de su
 *    especie y los cofres.
 *
 * El azar entra por parametro (`tirada`, un numero en [0,1)) porque la rana lo
 * necesita. Sin eso no se puede probar "le ha salido el peor dia" contra "le ha
 * salido el mejor", que son justo los dos casos que importan.
 *
 * Puro y determinista: sin reloj, sin azar y sin I/O.
 */

import { type EfectoDeEspecie, ESPECIES, type EspecieId } from "./especies.js";
import { caraDe, type EstadoDeMascota, MAXIMO } from "./estado.js";
import { combinarRasgos, type RasgoId } from "./rasgos.js";

/** Lo que rinde un bicho de nivel 1 en condiciones perfectas, sin especie. */
export const BASE_NIVEL_1 = 200;

/** Lo que suma cada nivel a esa base. */
export const BASE_POR_NIVEL = 40;

/**
 * El techo por mascota y dia.
 *
 * Es deliberadamente cercano al mantenimiento de cuatro raciones (600): un
 * bicho no puede llegar a pagarse a si mismo por mucho que suba. El dia que
 * alguien encuentre una combinacion que se acerque, el tope la corta y la
 * metrica de acuñado lo enseña; sin tope, lo enseñaria la economia del grupo
 * tres semanas despues.
 */
export const TOPE_DIARIO = 600;

/** La parte del rendimiento que NO depende del hambre. */
const SUELO_HAMBRE = 0.4;

/** La parte que no depende del animo. Pesa menos que el hambre a proposito. */
const SUELO_ANIMO = 0.7;

/**
 * Lo que hace falta saber del grupo para calcular algunas especies.
 *
 * Todo opcional: quien no lo sepa no lo pasa y la especie cae a su caso base.
 * Es lo que permite que el tick del worker —que si conoce el grupo— y una ficha
 * suelta —que no— usen la misma funcion.
 */
export interface ContextoDelGrupo {
  /** Cuantas mascotas mas de su especie hay en el grupo. Hormiga. */
  readonly companeras?: number;
  /** Si ahora es de noche donde vive el grupo. Murcielago. */
  readonly esDeNoche?: boolean;
  /** Dias seguidos sin sanciones. Paloma. */
  readonly diasLimpios?: number;
  /** Recien llegados que se han quedado. Pollito. */
  readonly novatosQueSeQuedan?: number;
  /** Si su clan esta activo. Oveja. */
  readonly clanActivo?: boolean;
  /** Dias seguidos de cuidado, para saber si a la ardilla le toca soltar. */
  readonly diaDeLaRacha?: number;
  /** El factor del bicho de al lado en el corral. Camaleon. */
  readonly factorDelVecino?: number;
}

export interface PeticionDeRendimiento {
  readonly especie: EspecieId;
  readonly estado: EstadoDeMascota;
  readonly rasgos?: readonly RasgoId[];
  /** Numero en [0,1) para las especies que se juegan la renta. */
  readonly tirada?: number;
  /** Tope del grupo. Si no viene, el de referencia. */
  readonly topeDiario?: number;
  /** Lo que se sepa del grupo. Ver `ContextoDelGrupo`. */
  readonly contexto?: ContextoDelGrupo;
}

export interface Rendimiento {
  /** Monedas a acuñar. Entero y nunca negativo. */
  readonly monedas: number;
  /** Si el tope ha recortado el resultado. Lo usa la metrica. */
  readonly recortado: boolean;
}

/** Lo que rinde el nivel, antes de todo lo demas. */
export const baseDeNivel = (nivel: number): number => {
  const n = Number.isFinite(nivel) ? Math.max(1, Math.trunc(nivel)) : 1;
  return BASE_NIVEL_1 + (n - 1) * BASE_POR_NIVEL;
};

/** Cuanto pesa el hambre, en tanto por uno. */
const factorDeHambre = (hambre: number): number =>
  SUELO_HAMBRE + (1 - SUELO_HAMBRE) * (Math.max(0, hambre) / MAXIMO);

/** Cuanto pesa el animo, en tanto por uno. */
const factorDeAnimo = (animo: number): number =>
  SUELO_ANIMO + (1 - SUELO_ANIMO) * (Math.max(0, animo) / MAXIMO);

/**
 * El multiplicador que aporta la especie.
 *
 * El `switch` es sobre la CLASE de efecto, no sobre la especie: es lo que
 * permite que el catalogo crezca por tandas sin tocar este fichero. Una especie
 * nueva que reutilice una clase existente no aparece por aqui.
 *
 * Las clases que no tocan la renta devuelven 1: el zorro y la tortuga rinden lo
 * normal y su ventaja esta en otro sitio.
 */
export interface AporteDeEspecie {
  readonly factor: number;
  /**
   * Si el animo NO cuenta para esta especie.
   *
   * Solo el gato: es la mascota para quien no quiere una mascota, y si el animo
   * le afectara seria una mascota normal peor. Su factor entra entero.
   */
  readonly ignoraAnimo?: boolean;
}

/**
 * El multiplicador que aporta la especie, sin el resto de la cuenta.
 *
 * Publico porque lo necesita el camaleon: su efecto es **copiar el bono del
 * bicho de al lado**, asi que quien prepara su contexto tiene que poder
 * calcular el factor de otra especie sin calcular su rendimiento entero —
 * derivarlo del rendimiento seria dividir por el hambre y el animo del vecino,
 * que no son suyos.
 *
 * El  es sobre la CLASE de efecto, no sobre la especie: es lo que
 * permite que el catalogo crezca por tandas sin tocar este fichero. Una especie
 * nueva que reutilice una clase existente no aparece por aqui — las treinta de
 * hoy se reparten en veinticuatro clases.
 *
 * **Las clases que no tocan la renta devuelven 1**, y son mayoria: el zorro
 * mejora el robo, el pulpo recorta esperas, el cerdito sube la caja. Rinden lo
 * normal y su ventaja vive en el sistema al que pertenecen. Mientras ese
 * sistema no este cableado, la especie sigue siendo jugable —sale del huevo,
 * come, sube de nivel— y su bono llega cuando llegue.
 */
export const factorDeEspecie = (
  efecto: EfectoDeEspecie,
  tirada: number,
  contexto: ContextoDelGrupo,
): AporteDeEspecie => {
  switch (efecto.clase) {
    case "renta":
      return { factor: efecto.factor };
    case "rentaAlAzar": {
      const t = Number.isFinite(tirada)
        ? Math.min(0.999999, Math.max(0, tirada))
        : 0;
      return { factor: efecto.minimo + t * (efecto.maximo - efecto.minimo) };
    }
    case "rentaAcumulada": {
      // Solo paga el dia que toca; los demas, cero. Quien entra poco se
      // encuentra el pico y no ha perdido nada por no venir.
      const dia = Math.max(0, Math.trunc(contexto.diaDeLaRacha ?? 0));
      const toca = dia > 0 && dia % Math.max(1, efecto.cadaDias) === 0;
      return { factor: toca ? efecto.factor * efecto.cadaDias : 0 };
    }
    case "rentaColectiva": {
      const companeras = Math.max(0, contexto.companeras ?? 0);
      return {
        factor: Math.min(
          efecto.tope,
          efecto.base + companeras * efecto.porCompanera,
        ),
      };
    }
    case "rentaPorHorario": {
      const deNoche = contexto.esDeNoche === true;
      return {
        factor: deNoche === efecto.deNoche ? efecto.enSuFranja : efecto.fuera,
      };
    }
    case "rentaIndiferente":
      return { factor: efecto.factor, ignoraAnimo: true };
    case "rentaPorBuenClima": {
      const limpios = Math.max(0, contexto.diasLimpios ?? 0);
      return {
        factor: Math.min(
          efecto.tope,
          efecto.base + limpios * efecto.porDiaLimpio,
        ),
      };
    }
    case "bonusDeClan":
      return { factor: contexto.clanActivo === true ? efecto.factor : 1 };
    case "bonusPorNovato": {
      const novatos = Math.max(0, contexto.novatosQueSeQuedan ?? 0);
      // Con tope: sin el, un grupo que crece rapido convertiria al pollito en
      // una impresora durante una semana.
      return { factor: Math.min(2, 1 + novatos * efecto.porNovato) };
    }
    case "copiaVecino":
      // Sin vecino se queda en lo normal. No hereda topes ajenos: lo que copia
      // es un factor ya calculado, y el tope diario se aplica igual despues.
      return { factor: Math.max(0, contexto.factorDelVecino ?? 1) };
    case "legendaria":
      return { factor: efecto.factor };
    // Las que viven en otro sistema. Rinden lo normal.
    case "roboMejorado":
    case "bloqueaRobo":
    case "ingenio":
    case "animoPorGratitud":
    case "topeDeCaja":
    case "robaObjetos":
    case "ahorraObjeto":
    case "recuperaRobado":
    case "contraataca":
    case "protegeAOtro":
    case "memoria":
    case "segundaOportunidad":
    case "menosEspera":
    case "bonusDeCasino":
    case "penalizaRetador":
      return { factor: 1 };
  }
};

/**
 * Lo que la mascota acuña hoy.
 *
 * Una dormida no rinde nada, y eso es lo unico que hace que el hambre importe
 * de verdad. Con un rendimiento residual, dejar de venir tendria un coste
 * pequeño y la feature no crearia ninguna rutina.
 */
export const rendimientoDelDia = (
  peticion: PeticionDeRendimiento,
): Rendimiento => {
  const {
    especie,
    estado,
    rasgos = [],
    tirada = 0.5,
    topeDiario = TOPE_DIARIO,
    contexto = {},
  } = peticion;

  if (caraDe(estado) === "dormido") {
    return { monedas: 0, recortado: false };
  }

  const declarada = ESPECIES[especie];
  if (!declarada) {
    return { monedas: 0, recortado: false };
  }

  const aporte = factorDeEspecie(declarada.efecto, tirada, contexto);
  const bruto =
    baseDeNivel(estado.nivel) *
    factorDeHambre(estado.hambre) *
    (aporte.ignoraAnimo ? 1 : factorDeAnimo(estado.animo)) *
    aporte.factor *
    combinarRasgos(rasgos).rendimiento;

  const tope = Number.isFinite(topeDiario) && topeDiario > 0 ? topeDiario : 0;
  const monedas = Math.max(0, Math.floor(bruto));

  return monedas > tope
    ? { monedas: tope, recortado: true }
    : { monedas, recortado: false };
};

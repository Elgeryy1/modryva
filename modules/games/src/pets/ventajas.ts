/**
 * Lo que una mascota le hace a los demas sistemas del bot.
 *
 * El catalogo declara treinta y ocho especies con su efecto, y hasta hoy solo hacian
 * algo las que tocaban la renta diaria. Las otras quince clases —el zorro que
 * roba mejor, la tortuga que te protege, el cerdito que agranda la caja— tenian
 * su numero escrito en la ficha, su linea en el mensaje de la Mini App, y
 * **cero efecto en ninguna parte**. `rendimiento.ts` las despachaba con un
 * `factor: 1` y un comentario que decia que su ventaja vivia "en el sistema al
 * que pertenecen"; el sistema al que pertenecen nunca les pregunto.
 *
 * Este fichero es esa pregunta. Traduce el efecto declarado de una especie a
 * numeros que cada sistema sabe consumir, y no hace nada mas: no decide, no
 * aplica y no sabe que existe una base de datos.
 *
 * **Un solo `switch` para las veintiseis clases de efecto.** La alternativa —una funcion
 * por sistema, cada una con su switch— repetiria las ramas cinco veces y
 * garantizaria que la sexta se olvidara de alguna. Aqui una especie se lee una
 * vez y sale con todas sus ventajas puestas; quien consume coge la suya.
 *
 * El `switch` no tiene `default` **a proposito**: TypeScript comprueba que
 * estan todas las clases, asi que una clase de efecto nueva no compila hasta
 * que alguien decida que ventaja da. Es la misma propiedad que protege a
 * `factorDeEspecie` en `rendimiento.ts`, y es justo la que faltaba para que
 * quince efectos pudieran quedarse a medias sin que fallara nada.
 *
 * Puro y determinista: sin reloj, sin azar y sin I/O.
 */

import { type EfectoDeEspecie, ESPECIES, type EspecieId } from "./especies.js";

/**
 * Lo que aporta una mascota cuando alguien roba.
 *
 * Los seis campos miran a los dos lados del robo —tres al de quien ataca y
 * tres al de quien lo sufre— porque una misma mascota puede estar en los dos
 * en el mismo dia. Separarlos en dos interfaces daria a entender que hay dos
 * clases de mascota, y no las hay.
 *
 * Todos van en tanto por uno y **el neutro es cero**: una mascota sin efecto
 * de robo no cambia nada, y eso tiene que poder escribirse sin condicionales
 * en quien consume.
 */
export interface VentajasDeRobo {
  /** Tanto por uno extra al botin de quien ataca. */
  readonly botinMas: number;
  /** Tanto por uno que se recorta de su espera entre robos. */
  readonly esperaMenos: number;
  /** Probabilidad de llevarse ademas un objeto del inventario. */
  readonly robaObjetos: number;
  /** Probabilidad de que un robo fallido no gaste el objeto usado. */
  readonly ahorraObjeto: number;
  /** Probabilidad de que un robo contra su dueño no llegue a cobrarse. */
  readonly bloqueaRobo: number;
  /** Tanto por uno de multa extra para quien falle al robarle. */
  readonly contraataca: number;
  /** Probabilidad con la que cubre tambien a una persona elegida. */
  readonly protegeAOtro: number;
  /** Parte de lo robado que vuelve sola cada dia. */
  readonly recuperaRobado: number;
}

/**
 * Lo que aporta en los juegos.
 *
 * `puntosDeIngenio` y `puntosDeMemoria` estan separados porque los declaran
 * dos clases distintas y premian dos cosas distintas —pensar rapido contra
 * acordarse—, y juntarlos haria que una especie cobrara en juegos que no son
 * los suyos.
 */
export interface VentajasDeJuegos {
  /** Energia extra al dia. */
  readonly energiaExtra: number;
  /** Puntos de mas en los juegos de ingenio. */
  readonly puntosDeIngenio: number;
  /** Puntos de mas en los de memoria y palabras. */
  readonly puntosDeMemoria: number;
  /** Reintentos al dia en la trivia. */
  readonly segundasOportunidades: number;
  /** Tanto por uno que se recorta de las esperas de todos los juegos. */
  readonly menosEspera: number;
  /** Tanto por uno de penalizacion para quien la rete en la arena. */
  readonly castigoAlRetador: number;
}

/** Todo lo que una mascota aporta fuera de su propia ficha. */
export interface VentajasDeMascota {
  readonly robo: VentajasDeRobo;
  /** Multiplicador de las ganancias del casino. 1 es no tocar nada. */
  readonly casino: number;
  /** Monedas que suma al tope de la caja fuerte. */
  readonly extraDeCaja: number;
  readonly juegos: VentajasDeJuegos;
  /** Animo que gana cuando a su dueño le dan las gracias. */
  readonly animoPorGracias: number;
}

const SIN_ROBO: VentajasDeRobo = {
  botinMas: 0,
  esperaMenos: 0,
  robaObjetos: 0,
  ahorraObjeto: 0,
  bloqueaRobo: 0,
  contraataca: 0,
  protegeAOtro: 0,
  recuperaRobado: 0,
};

const SIN_JUEGOS: VentajasDeJuegos = {
  energiaExtra: 0,
  puntosDeIngenio: 0,
  puntosDeMemoria: 0,
  segundasOportunidades: 0,
  menosEspera: 0,
  castigoAlRetador: 0,
};

/**
 * Lo que aporta no tener mascota, o tener una que solo toca la renta.
 *
 * Exportado porque lo necesita **todo** consumidor: la rama "esta persona no
 * tiene bicho" es la mayoritaria en cualquier grupo, y sin un neutro a mano
 * cada sistema se escribiria su propio objeto de ceros — que es como se
 * acaban colando neutros que no lo son.
 */
export const SIN_VENTAJAS: VentajasDeMascota = {
  robo: SIN_ROBO,
  casino: 1,
  extraDeCaja: 0,
  juegos: SIN_JUEGOS,
  animoPorGracias: 0,
};

/** Deja una probabilidad declarada dentro de [0, 1]. */
const comoProbabilidad = (valor: number): number =>
  Number.isFinite(valor) ? Math.min(1, Math.max(0, valor)) : 0;

/** Deja un tanto por uno en positivo, sin techo: hay bonos por encima de uno. */
const comoFactor = (valor: number): number =>
  Number.isFinite(valor) && valor > 0 ? valor : 0;

/** Deja un contador declarado en un entero no negativo. */
const comoCuenta = (valor: number): number =>
  Number.isFinite(valor) && valor > 0 ? Math.trunc(valor) : 0;

/**
 * Traduce el efecto declarado de una especie a ventajas por sistema.
 *
 * Las clases de renta caen todas en el neutro: su ventaja ya la cobra
 * `rendimiento.ts` y sumarla aqui la pagaria dos veces. Es el error mas facil
 * de cometer en este fichero, y por eso van nombradas una a una en vez de con
 * un `default` que se las tragaria en silencio.
 */
const deEfecto = (efecto: EfectoDeEspecie): VentajasDeMascota => {
  switch (efecto.clase) {
    case "roboMejorado":
      return {
        ...SIN_VENTAJAS,
        robo: {
          ...SIN_ROBO,
          botinMas: comoFactor(efecto.botinMas),
          esperaMenos: comoProbabilidad(efecto.esperaMenos),
        },
      };
    case "bloqueaRobo":
      return {
        ...SIN_VENTAJAS,
        robo: {
          ...SIN_ROBO,
          bloqueaRobo: comoProbabilidad(efecto.probabilidad),
        },
      };
    case "robaObjetos":
      return {
        ...SIN_VENTAJAS,
        robo: {
          ...SIN_ROBO,
          robaObjetos: comoProbabilidad(efecto.probabilidad),
        },
      };
    case "ahorraObjeto":
      return {
        ...SIN_VENTAJAS,
        robo: {
          ...SIN_ROBO,
          ahorraObjeto: comoProbabilidad(efecto.probabilidad),
        },
      };
    case "contraataca":
      return {
        ...SIN_VENTAJAS,
        robo: { ...SIN_ROBO, contraataca: comoFactor(efecto.castigo) },
      };
    case "protegeAOtro":
      return {
        ...SIN_VENTAJAS,
        robo: {
          ...SIN_ROBO,
          protegeAOtro: comoProbabilidad(efecto.probabilidad),
        },
      };
    case "recuperaRobado":
      return {
        ...SIN_VENTAJAS,
        robo: { ...SIN_ROBO, recuperaRobado: comoProbabilidad(efecto.porDia) },
      };
    case "bonusDeCasino":
      return { ...SIN_VENTAJAS, casino: comoFactor(efecto.factor) || 1 };
    case "topeDeCaja":
      return { ...SIN_VENTAJAS, extraDeCaja: comoCuenta(efecto.extra) };
    case "ingenio":
      return {
        ...SIN_VENTAJAS,
        juegos: {
          ...SIN_JUEGOS,
          energiaExtra: comoCuenta(efecto.energiaExtra),
          puntosDeIngenio: comoCuenta(efecto.puntosExtra),
        },
      };
    case "memoria":
      return {
        ...SIN_VENTAJAS,
        juegos: {
          ...SIN_JUEGOS,
          puntosDeMemoria: comoCuenta(efecto.puntosExtra),
        },
      };
    case "segundaOportunidad":
      return {
        ...SIN_VENTAJAS,
        juegos: {
          ...SIN_JUEGOS,
          segundasOportunidades: comoCuenta(efecto.vecesAlDia),
        },
      };
    case "menosEspera":
      return {
        ...SIN_VENTAJAS,
        juegos: {
          ...SIN_JUEGOS,
          menosEspera: comoProbabilidad(efecto.recorte),
        },
      };
    case "penalizaRetador":
      return {
        ...SIN_VENTAJAS,
        juegos: {
          ...SIN_JUEGOS,
          castigoAlRetador: comoProbabilidad(efecto.castigo),
        },
      };
    case "animoPorGratitud":
      return {
        ...SIN_VENTAJAS,
        animoPorGracias: comoCuenta(efecto.animoPorGracias),
      };
    // Las de renta. Su ventaja la cobra `rendimiento.ts` y aqui no suman nada:
    // contarla en los dos sitios seria pagarla dos veces.
    case "renta":
    case "rentaAlAzar":
    case "rentaAcumulada":
    case "rentaColectiva":
    case "rentaPorHorario":
    case "rentaIndiferente":
    case "rentaPorBuenClima":
    case "bonusDeClan":
    case "bonusPorNovato":
    case "copiaVecino":
    case "legendaria":
      return SIN_VENTAJAS;
  }
};

/**
 * Las ventajas de una especie del catalogo.
 *
 * Una especie que ya no exista devuelve el neutro en vez de lanzar: el
 * catalogo crece por tandas y una tanda retirada dejaria filas apuntando a
 * nada. Que a alguien se le caiga el bono es molesto; que no pueda robar
 * porque su bicho ya no esta declarado, no.
 */
export const ventajasDeEspecie = (especie: string): VentajasDeMascota => {
  const declarada = ESPECIES[especie as EspecieId];
  return declarada ? deEfecto(declarada.efecto) : SIN_VENTAJAS;
};

/**
 * Las ventajas de quien puede no tener mascota.
 *
 * Es la firma que de verdad usan los sistemas: casi todos parten de un
 * `especie | null` que sale de buscar la mascota de alguien, y obligarles a
 * escribir el `?:` en cada llamada es como se cuela el dia que se olvida.
 */
export const ventajasDe = (
  especie: string | null | undefined,
): VentajasDeMascota => (especie ? ventajasDeEspecie(especie) : SIN_VENTAJAS);

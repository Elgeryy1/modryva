/**
 * Subir de nivel: la curva de experiencia y las tres formas de ganarla.
 *
 * La XP no se compra: se gana **cuidando**. Y eso importa mas que a que ritmo
 * se gane — si subiera con monedas, el corral acabaria ordenado por saldo y
 * quien llega tarde no tendria nada que hacer. Por eso las tres fuentes son
 * acciones de cuidado y las tres llevan ya su tope diario puesto por otro:
 *
 * - **Dar de comer**, que lo acota el tope de raciones del grupo.
 * - **Jugar con ella**, que es gratis y una vez al dia.
 * - **Cerrar el dia con el bicho bien**, que lo acota `xpDia`.
 *
 * Ninguna de las tres se puede repetir en bucle, y por eso ninguna necesita
 * una guarda propia aqui: pedirla dos veces no es una decision de este fichero.
 *
 * Hasta el 2026-09-02 solo existia la tercera, y ese era el problema. El cierre
 * ocurre en el primer barrido pasada la medianoche UTC —las dos de la
 * madrugada en España—, asi que la XP no premiaba haber cuidado al bicho:
 * premiaba como estuviera la barra a esa hora concreta, que es justo cuando
 * lleva mas horas sin que nadie lo mire. Con el cuidado repartido en tres
 * momentos, cuidar suma cuando se cuida.
 *
 * La curva es cuadratica suave. Los primeros niveles caen en dias y los ultimos
 * en meses, que es lo que hace que el nivel 10 —donde evoluciona— se sienta como
 * una meta y no como un tramite.
 *
 * Puro y determinista: sin reloj, sin azar y sin I/O.
 */

import type { EstadoDeMascota } from "./estado.js";
import { MAXIMO } from "./estado.js";

/** XP por cada dia cerrado con el bicho bien. */
export const XP_POR_DIA_CUIDADO = 10;

/**
 * XP por cada racion servida.
 *
 * El tope lo pone el grupo con sus raciones diarias, no este numero: con las
 * cuatro de referencia son 12 al dia. Vale menos que el cierre a proposito
 * —dar de comer es un boton y el cierre es una rutina sostenida— pero llega
 * en el momento en que la persona esta mirando, que es lo que hace que se
 * note.
 */
export const XP_POR_RACION = 3;

/**
 * XP por jugar con ella.
 *
 * Es gratis y una vez al dia, asi que es la unica fuente que no cuesta
 * monedas. Da mas que una racion por eso mismo: si la XP solo llegara con el
 * gasto, la progresion volveria a estar ordenada por saldo.
 */
export const XP_POR_JUEGO = 5;

/** Por encima de esta hambre al cierre del dia, cuenta como cuidado. */
export const HAMBRE_MINIMA_PARA_XP = MAXIMO / 2;

/** El nivel al que evoluciona. Mas alla la curva sigue, pero sin forma nueva. */
export const NIVEL_DE_EVOLUCION = 10;

/**
 * Tope de nivel.
 *
 * Existe para que la base del rendimiento no crezca sin fin: aunque el tope
 * diario ya corta el resultado, un nivel sin techo haria que la barra de
 * progreso no significara nada a partir de cierto punto.
 */
export const NIVEL_MAXIMO = 20;

/**
 * XP total acumulada que hace falta para estar EN un nivel.
 *
 * Nivel 1 empieza en 0. Con 10 XP al dia, el 2 llega en dos dias, el 5 en unas
 * dos semanas y el 10 en un par de meses de cuidado casi diario.
 */
export const xpParaNivel = (nivel: number): number => {
  const n = Number.isFinite(nivel) ? Math.max(1, Math.trunc(nivel)) : 1;
  if (n <= 1) {
    return 0;
  }
  // 10 * (n-1) * n / 2 * 2 -> la suma de los primeros tramos, en dias de
  // cuidado: 2 dias al nivel 2, 6 al 3, 12 al 4...
  return XP_POR_DIA_CUIDADO * (n - 1) * n;
};

/** El nivel que corresponde a una XP acumulada. */
export const nivelParaXp = (xp: number): number => {
  const total = Number.isFinite(xp) && xp > 0 ? xp : 0;
  let nivel = 1;
  while (nivel < NIVEL_MAXIMO && total >= xpParaNivel(nivel + 1)) {
    nivel += 1;
  }
  return nivel;
};

/** Cuanta XP le falta para el siguiente. Cero si ya esta al tope. */
export const xpParaSiguiente = (estado: EstadoDeMascota): number => {
  const nivel = nivelParaXp(estado.xp);
  if (nivel >= NIVEL_MAXIMO) {
    return 0;
  }
  return Math.max(0, xpParaNivel(nivel + 1) - Math.max(0, estado.xp));
};

/**
 * El progreso dentro del nivel actual, en tanto por uno.
 *
 * Es lo que pinta la barra. Al tope devuelve 1: una barra a medias en el nivel
 * maximo se leeria como que queda algo, y no queda.
 */
export const progresoDeNivel = (estado: EstadoDeMascota): number => {
  const nivel = nivelParaXp(estado.xp);
  if (nivel >= NIVEL_MAXIMO) {
    return 1;
  }
  const desde = xpParaNivel(nivel);
  const hasta = xpParaNivel(nivel + 1);
  const tramo = hasta - desde;
  if (tramo <= 0) {
    return 1;
  }
  return Math.min(1, Math.max(0, (Math.max(0, estado.xp) - desde) / tramo));
};

/**
 * Lo que pasa al sumarle experiencia a una mascota.
 *
 * `haSubido` y `evoluciona` existen para **anunciarse**. Estuvieron calculados
 * y sin consumir desde el primer dia: el tick los contaba en su resumen y ahi
 * se acababa, asi que una mascota podia subir de nivel sin que su dueño se
 * enterara nunca. Un progreso invisible no es un progreso.
 */
export interface SubidaDeXp {
  readonly estado: EstadoDeMascota;
  /** Lo que ha sumado de verdad, ya acotado. Cero es una respuesta valida. */
  readonly ganada: number;
  /** Si ha cruzado un nivel con esta suma. Se anuncia en el chat. */
  readonly haSubido: boolean;
  /** El nivel en el que se queda. */
  readonly nivel: number;
  /** Si acaba de llegar al nivel de evolucion, justo ahora. */
  readonly evoluciona: boolean;
}

/**
 * Le suma experiencia y recalcula el nivel.
 *
 * Es el unico sitio donde sube la XP: comer, jugar y cerrar el dia pasan todos
 * por aqui. Tener una sola puerta es lo que hace que el nivel guardado no
 * pueda quedarse desfasado de la XP — un `xp + n` suelto en otro fichero es
 * exactamente como se produce esa incoherencia.
 *
 * Una cantidad negativa o corrupta no resta: la XP ganada no se pierde nunca,
 * ni por un mal dia ni por una fila rota.
 */
export const sumarXp = (
  estado: EstadoDeMascota,
  cantidad: number,
): SubidaDeXp => {
  const suma =
    Number.isFinite(cantidad) && cantidad > 0 ? Math.trunc(cantidad) : 0;
  const nivelAntes = nivelParaXp(estado.xp);
  const xp = Math.max(0, Math.trunc(estado.xp)) + suma;
  const nivel = nivelParaXp(xp);

  return {
    estado: { ...estado, xp, nivel },
    ganada: suma,
    haSubido: nivel > nivelAntes,
    nivel,
    evoluciona: nivelAntes < NIVEL_DE_EVOLUCION && nivel >= NIVEL_DE_EVOLUCION,
  };
};

export interface CierreDelDia {
  readonly estado: EstadoDeMascota;
  /** Si el dia ha contado como cuidado. */
  readonly cuidada: boolean;
  /** Si ha subido de nivel con este cierre. Se anuncia en el chat. */
  readonly haSubido: boolean;
  /** El nivel en el que se queda. */
  readonly nivel: number;
  /** Si acaba de llegar al nivel de evolucion, justo en este cierre. */
  readonly evoluciona: boolean;
}

/**
 * Cierra el dia de una mascota.
 *
 * Se llama una vez por dia desde el tick del worker. Es idempotente respecto al
 * estado que recibe —dos llamadas con el mismo estado dan el mismo resultado—
 * pero **no** respecto a la persistencia: quien lo llama tiene que garantizar
 * que solo se cierra una vez al dia, y eso lo hace la columna `xpDia`, no este
 * fichero.
 *
 * **`hambreDelDia` es lo MEJOR que estuvo la barra durante el dia, no como
 * esta ahora.** Es el arreglo del 2026-09-02 y el motivo esta medido: el
 * cierre corre en el primer barrido pasada la medianoche UTC, o sea a las dos
 * de la madrugada en España, que es la hora en que el bicho lleva mas tiempo
 * sin que nadie lo mire. Preguntando por el hambre de ESE instante, quien
 * cuido a su mascota toda la tarde se encontraba sin XP porque a las dos ya
 * habia bajado; se pagaba el horario y no el cuidado. Quien no lo sepa puede
 * no pasarlo, y entonces vale el hambre actual — que es exactamente lo que
 * hacia antes.
 */
export const cerrarDia = (
  estado: EstadoDeMascota,
  hambreDelDia?: number,
): CierreDelDia => {
  const referencia =
    hambreDelDia !== undefined && Number.isFinite(hambreDelDia)
      ? Math.max(hambreDelDia, estado.hambre)
      : estado.hambre;
  const cuidada = referencia >= HAMBRE_MINIMA_PARA_XP;
  if (!cuidada) {
    return {
      estado,
      cuidada: false,
      haSubido: false,
      nivel: nivelParaXp(estado.xp),
      evoluciona: false,
    };
  }

  const subida = sumarXp(estado, XP_POR_DIA_CUIDADO);
  return {
    estado: subida.estado,
    cuidada: true,
    haSubido: subida.haSubido,
    nivel: subida.nivel,
    evoluciona: subida.evoluciona,
  };
};

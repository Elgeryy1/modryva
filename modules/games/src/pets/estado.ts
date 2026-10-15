/**
 * El estado de una mascota y como lo cambia el paso del tiempo.
 *
 * Cuatro numeros —hambre, animo, nivel y XP— y de los dos primeros sale una
 * cara. La cara es lo que de verdad se lee: nadie mira dos barras, todo el
 * mundo mira una cara.
 *
 * **El tiempo entra por parametro.** No hay `Date.now()` en este fichero ni lo
 * puede haber: la mitad de los tests de esta feature son "acaba de comer"
 * contra "lleva tres dias sin comer", y sin el reloj inyectado eso solo se
 * prueba tocando el reloj del proceso.
 *
 * Puro y determinista: sin reloj, sin azar y sin I/O.
 */

import { combinarRasgos, type RasgoId } from "./rasgos.js";

/** El tope de las dos barras. Sube a 100 porque se enseña como porcentaje. */
export const MAXIMO = 100;

/**
 * Cuanta hambre baja por hora.
 *
 * Con la barra llena, la mascota aguanta **50 horas** sin nadie. Es el numero
 * que decide el caracter de toda la feature: dos dias liados no te cuestan el
 * bicho, tres si. Mas rapido castiga a quien trabaja; mas lento y deja de haber
 * motivo para volver.
 *
 * Bajado de 3 a 2 el 2026-09-02, y el motivo esta medido. A 3 por hora el
 * desgaste era de 72 al dia y una racion llena 25: hacian falta **tres
 * raciones diarias —450 monedas— solo para no perder terreno**, cuando la
 * renta de una mascota ronda las 240. La barra caia sola para casi todo el
 * mundo y el resultado se veia en produccion: 26 de 41 mascotas dormidas a
 * hambre cero, y solo 12 con la racha viva. A 2 por hora el desgaste es de 48
 * y dos raciones (300 monedas) la mantienen, que es un habito que la gente si
 * sostiene.
 */
export const HAMBRE_POR_HORA = 2;

/**
 * Cuanto animo se pierde por hora.
 *
 * Baja tres veces mas despacio que el hambre a proposito. El animo se recupera
 * con cosas que no dependen solo de ti —que alguien te de las gracias, jugar un
 * rato— y castigarlo al mismo ritmo convertiria una barra social en una segunda
 * barra de mantenimiento. Pero baja: un animo que solo sube se queda clavado
 * arriba y deja de significar nada.
 */
export const ANIMO_POR_HORA = 1;

/**
 * Cuanto animo sube por jugar con ella.
 *
 * Gratis y una vez al dia. Es la UNICA forma que hay hoy de subir el animo, y
 * hasta que existio no habia ninguna: la barra solo bajaba, asi que a los
 * cuatro dias toda mascota quedaba triste para siempre —cara de pena y el
 * rendimiento al minimo— sin que su dueño pudiera hacer absolutamente nada.
 *
 * Quince no compensa las veinticuatro que se pierden en un dia, y es a
 * proposito: jugar frena la caida, no la anula. La otra mitad tiene que venir
 * de la actividad en el grupo, que es lo que convierte el animo en una barra
 * social en vez de un boton diario. Mientras esa parte no exista, un dueño que
 * juega cada dia ve bajar el animo despacio en vez de a plomo.
 */
export const ANIMO_POR_JUEGO = 15;

/**
 * El animo despues de jugar, sin pasarse del tope.
 *
 * Funcion y no una suma suelta porque el tope es la parte que se olvida: sumar
 * 15 a un animo de 95 y guardarlo dejaria un 110 que ninguna barra sabe pintar.
 */
export const animoTrasJugar = (animo: number): number =>
  Math.min(MAXIMO, Math.max(0, animo) + ANIMO_POR_JUEGO);

const MS_POR_HORA = 3_600_000;

/** Los cuatro numeros de una mascota. */
export interface EstadoDeMascota {
  readonly hambre: number;
  readonly animo: number;
  readonly nivel: number;
  readonly xp: number;
}

/**
 * Las seis caras.
 *
 * `dormido` no es "muerto": es hambre cero. La mascota sigue ahi y se recupera
 * comiendo. Matarla castigaria justo a quien se fue una semana de vacaciones, y
 * lo que consigue no es que vuelva antes — es que no vuelva.
 */
export type Cara =
  | "feliz"
  | "normal"
  | "conHambre"
  | "triste"
  | "enfermo"
  | "dormido";

/** Deja un numero dentro de [0, MAXIMO]. */
const acotar = (valor: number): number => {
  if (!Number.isFinite(valor) || valor < 0) {
    return 0;
  }
  return valor > MAXIMO ? MAXIMO : valor;
};

/**
 * Adelanta el reloj de una mascota.
 *
 * `msTranscurridos` es cuanto ha pasado desde la ultima vez que se miro, y lo
 * calcula quien tiene el reloj. Un valor negativo o no finito no mueve nada:
 * un reloj que va hacia atras —un servidor que ajusta la hora, una fila con una
 * fecha futura— no debe alimentar a la mascota gratis.
 *
 * Los rasgos entran aqui y no despues porque el `dormilon` cambia el ritmo del
 * hambre, no el resultado final: aplicarlo al final daria otro numero.
 */
export const aplicarPasoDelTiempo = (
  estado: EstadoDeMascota,
  msTranscurridos: number,
  rasgos: readonly RasgoId[] = [],
): EstadoDeMascota => {
  if (!Number.isFinite(msTranscurridos) || msTranscurridos <= 0) {
    return {
      ...estado,
      hambre: acotar(estado.hambre),
      animo: acotar(estado.animo),
    };
  }

  const efecto = combinarRasgos(rasgos);
  const horas = msTranscurridos / MS_POR_HORA;

  return {
    ...estado,
    hambre: acotar(estado.hambre - horas * HAMBRE_POR_HORA * efecto.hambre),
    animo: acotar(estado.animo - horas * ANIMO_POR_HORA),
  };
};

/**
 * Que cara pone.
 *
 * El orden de las preguntas ES la definicion: se comprueba primero lo mas grave.
 * Un bicho dormido tambien tiene el animo por los suelos, y decir "triste"
 * cuando lleva dos dias sin comer seria quedarse corto.
 */
export const caraDe = (estado: EstadoDeMascota): Cara => {
  const hambre = acotar(estado.hambre);
  const animo = acotar(estado.animo);

  if (hambre <= 0) {
    return "dormido";
  }
  // Las dos barras muy bajas a la vez. Es la señal de abandono largo antes de
  // llegar a dormido, y la unica cara que pide accion en las dos cosas.
  if (hambre < 15 && animo < 25) {
    return "enfermo";
  }
  if (animo < 30) {
    return "triste";
  }
  if (hambre < 40) {
    return "conHambre";
  }
  if (hambre >= 70 && animo >= 70) {
    return "feliz";
  }
  return "normal";
};

/** Si la mascota esta dormida por hambre. Una dormida no rinde nada. */
export const estaDormida = (estado: EstadoDeMascota): boolean =>
  caraDe(estado) === "dormido";

/**
 * Cuanto tiempo le queda antes de dormirse, en milisegundos.
 *
 * Es lo que necesita el aviso por privado para saber a quien avisar y cuando,
 * y lo que la ficha enseña como "aguanta hasta mañana". Devuelve 0 si ya esta
 * dormida.
 */
export const msHastaDormirse = (
  estado: EstadoDeMascota,
  rasgos: readonly RasgoId[] = [],
): number => {
  const hambre = acotar(estado.hambre);
  if (hambre <= 0) {
    return 0;
  }
  const porHora = HAMBRE_POR_HORA * combinarRasgos(rasgos).hambre;
  // Un rasgo que anulara el hambre haria que no se durmiera nunca. Hoy no
  // existe, pero el catalogo crece: mejor contestar "nunca" que dividir por
  // cero y devolver infinito por accidente.
  if (porHora <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return (hambre / porHora) * MS_POR_HORA;
};

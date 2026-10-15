/**
 * La racha de cuidado: dias seguidos cerrando el dia con el bicho bien.
 *
 * Es el numero que sube y que no quieres perder, y hace tres cosas de una vez:
 *
 * - da una razon para volver que no es el dinero;
 * - es la base de una liga que puede ganar quien llego ayer, en vez del corral
 *   por nivel, que ordena por quien empezo antes;
 * - **enciende `rentaAcumulada`**, que ya estaba escrita en el motor esperando
 *   un `diaDeLaRacha` que nadie le pasaba.
 *
 * ## Por que se decide comparando fechas y no con un contador a secas
 *
 * Un `racha + 1` en cada cierre daria por seguidos dos dias que no lo son: si
 * el worker se cae un dia entero, o si alguien deja el bicho sin comer el
 * martes, el miercoles seguiria sumando. Comparando el dia que se cierra con
 * el ultimo cerrado, un hueco se ve y se corta — que es justo lo que una racha
 * tiene que hacer para significar algo.
 *
 * Puro y determinista: sin reloj, sin azar y sin I/O. El dia entra por
 * parametro en texto (`AAAA-MM-DD`, UTC), igual que en el resto de la feature.
 */

/** Un dia UTC en texto, `AAAA-MM-DD`. */
export type DiaUtc = string;

/** El dia siguiente a uno dado, en el mismo formato. */
export const diaSiguiente = (dia: DiaUtc): DiaUtc => {
  const t = Date.parse(`${dia}T00:00:00Z`);
  if (!Number.isFinite(t)) {
    return dia;
  }
  return new Date(t + 86_400_000).toISOString().slice(0, 10);
};

/**
 * La racha despues de cerrar un dia.
 *
 * - Si el bicho no estaba cuidado, la racha se **rompe**: vuelve a cero. Es lo
 *   que hace que valga algo; una racha que sobrevive al descuido no mide nada.
 * - Si el dia que se cierra es justo el siguiente al ultimo cerrado, suma uno.
 * - En cualquier otro caso —primera vez, o un hueco— empieza en uno. Uno y no
 *   cero: el dia que se acaba de cerrar YA cuenta.
 */
export const rachaTrasCerrar = ({
  racha,
  ultimoDiaCerrado,
  diaQueSeCierra,
  cuidada,
}: {
  readonly racha: number;
  readonly ultimoDiaCerrado: DiaUtc | null;
  readonly diaQueSeCierra: DiaUtc;
  readonly cuidada: boolean;
}): number => {
  if (!cuidada) {
    return 0;
  }
  const anterior = Number.isFinite(racha) ? Math.max(0, Math.trunc(racha)) : 0;
  if (ultimoDiaCerrado === null) {
    return 1;
  }
  if (ultimoDiaCerrado === diaQueSeCierra) {
    // El mismo dia otra vez. No deberia pasar —lo impide `xpDia`— pero si
    // pasara, repetir no es avanzar: se deja como estaba.
    return Math.max(1, anterior);
  }
  return diaSiguiente(ultimoDiaCerrado) === diaQueSeCierra ? anterior + 1 : 1;
};

/**
 * Los hitos que se anuncian.
 *
 * Lista corta y espaciada a proposito: felicitar cada dia convierte el aviso en
 * ruido y la racha en una obligacion. Se dice a la semana, al mes y al
 * trimestre, que son los tres momentos en que de verdad ha costado algo.
 */
export const HITOS_DE_RACHA: readonly number[] = [7, 30, 90];

/** Si esta racha merece que se diga algo. */
export const esHitoDeRacha = (racha: number): boolean =>
  HITOS_DE_RACHA.includes(racha);

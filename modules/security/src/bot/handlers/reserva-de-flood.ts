/**
 * La reja que impide sancionar dos veces el mismo flood.
 *
 * Una rafaga llega como varias entregas de Telegram a la vez, y todas ejecutan
 * el pipeline en paralelo. Entre contar los mensajes y reiniciar el contador
 * hay `await`s, asi que sin esta reja cada entrega lee la misma cuenta por
 * encima del limite y sanciona otra vez. **En produccion silencio a una persona
 * tres veces en dos segundos**, las tres con cuenta 5.
 *
 * Por eso `reservar` es **sincrona**: un `await` entre la lectura y la
 * escritura reabriria justo la carrera que existe para cerrar.
 *
 * ## El fallo que se arregla al extraerla
 *
 * La version anterior vivia dentro del servicio y purgaba las reservas con un
 * horizonte fijo de 10 minutos, mientras el cooldown se le pasaba por fuera.
 * Los dos numeros no se miraban entre si, y la validacion de `/antiflood_limit`
 * **no pone tope a la ventana**: acepta cualquier entero positivo.
 *
 * Con `/antiflood_limit 5 3600` la reserva se borraba a los 10 minutos aunque
 * el cooldown fuera de una hora, y a partir de ahi volvia a sancionar — el
 * incidente de arriba otra vez, solo que mas espaciado y por tanto mas dificil
 * de ver.
 *
 * La regla que lo cierra: **nunca se purga una reserva que sigue viva**. El
 * horizonte es el mayor de los dos. Para toda ventana de 600 s o menos —la de
 * por defecto son 10 s— el comportamiento es exactamente el de antes.
 */

/**
 * Cuanto se guarda una reserva ya caducada antes de barrerla.
 *
 * Es solo higiene de memoria: sin esto el mapa crece con cada chat y cada
 * persona que alguna vez hizo flood. No es la politica —esa es el cooldown— y
 * por eso nunca puede recortarla.
 */
export const HORIZONTE_DE_PURGA_MS = 600_000;

/** El horizonte real: la higiene no puede comerse una reserva viva. */
export const horizonteDePurga = (cooldownMs: number): number =>
  Math.max(HORIZONTE_DE_PURGA_MS, cooldownMs);

export interface ReservaDeFlood {
  /**
   * Pide el derecho a sancionar este flood. `true` solo para la primera
   * entrega dentro del cooldown; las demas se van en silencio.
   */
  reservar(clave: string, ahoraMs: number, cooldownMs: number): boolean;
  /** Cuantas reservas se guardan ahora mismo. Para tests y metricas. */
  readonly tamano: number;
}

export const crearReservaDeFlood = (): ReservaDeFlood => {
  const reservas = new Map<string, number>();

  return {
    reservar(clave: string, ahoraMs: number, cooldownMs: number): boolean {
      const ultima = reservas.get(clave);
      if (ultima !== undefined && ahoraMs - ultima <= cooldownMs) {
        return false;
      }
      reservas.set(clave, ahoraMs);

      const horizonte = horizonteDePurga(cooldownMs);
      for (const [vista, ms] of reservas) {
        if (ahoraMs - ms > horizonte) {
          reservas.delete(vista);
        }
      }
      return true;
    },
    get tamano() {
      return reservas.size;
    },
  };
};

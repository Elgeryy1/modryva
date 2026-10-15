import { shouldFilterByChars } from "../../char-filters.js";
import { isNightTime } from "../../group-hygiene.js";

/**
 * La decision del modo noche.
 *
 * Acaba en borrar el mensaje sin decir nada, asi que lo que devuelve es un si o
 * un no; el borrado se queda en el nucleo, que es quien tiene el gateway y el
 * token del bot correcto para este update.
 *
 * **Por que solo esta y no tambien `service-message.clean`:** aquel handler no
 * tiene decision que extraer. Es `isServiceMessage(raw) && hygiene.cleanService`
 * y despues un borrado — todo fontaneria. Sacarlo produciria un fichero que
 * solo envuelve un `&&`, que es justo el microfichero que el plan prohibe. Se
 * queda donde esta hasta que tenga logica propia que merezca modulo.
 *
 * El modo noche si la tiene: una franja horaria que puede cruzar la medianoche.
 */

/**
 * Un mensaje dentro de la franja de modo noche.
 *
 * `hora` la pone quien llama en vez de leerla del reloj aqui: asi la decision
 * es pura y se puede probar la franja que cruza la medianoche —de 23 a 7— sin
 * esperar a las once de la noche.
 */
export const debeBorrarPorModoNoche = (entrada: {
  readonly modoNocheActivo: boolean;
  readonly hora: number;
  readonly horaInicio: number;
  readonly horaFin: number;
}): boolean => {
  if (!entrada.modoNocheActivo) return false;
  return isNightTime(entrada.hora, {
    startHour: entrada.horaInicio,
    endHour: entrada.horaFin,
  });
};

/**
 * Un mensaje que cae en los filtros de alfabeto del grupo.
 *
 * Dos filtros independientes: RTL (arabe, hebreo, y de paso los caracteres de
 * control que se usan para camuflar texto) y CJK (chino, japones, coreano). Se
 * activan por separado porque responden a problemas distintos — el primero es
 * casi siempre spam camuflado, el segundo suele ser un grupo que simplemente no
 * quiere ese idioma.
 *
 * Con los dos apagados sale sin mirar el texto, igual que hacia el servicio:
 * este handler corre sobre **cada mensaje** del grupo, asi que el cortocircuito
 * se nota.
 */
export const debeBorrarPorCaracteres = (entrada: {
  readonly texto: string;
  readonly filtroRtl: boolean;
  readonly filtroCjk: boolean;
}): boolean => {
  if (!entrada.filtroRtl && !entrada.filtroCjk) return false;

  return shouldFilterByChars(entrada.texto, {
    rtlFilter: entrada.filtroRtl,
    cjkFilter: entrada.filtroCjk,
  });
};

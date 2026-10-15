/**
 * Cómo se le dice a una persona cuánto tiempo guardamos su foto.
 *
 * La pantalla de consentimiento decía "pasado el periodo de retención
 * configurado". Es una promesa sin número: quien la lee no sabe si son dos
 * horas o para siempre, y ahí es donde se cae 1 de cada 4 (217 de 878 personas
 * abren la Mini App y se van en esa pantalla).
 *
 * El dato existía en los ajustes del grupo desde el primer día; simplemente no
 * llegaba a la única persona que tiene que decidir con él.
 */

/**
 * Convierte horas de retención en algo que se lee de un vistazo: días cuando
 * son días exactos ("3 días" se entiende antes que "72 horas"), y horas en
 * cualquier otro caso.
 *
 * Pura y total. Un valor absurdo (0, negativo, no finito) devuelve null en vez
 * de escribir "se borra en 0 horas" — decir una barbaridad con seguridad es
 * peor que no decir nada, y quien llama enseña entonces la frase sin número.
 */
export const formatearRetencion = (horas: number): string | null => {
  if (!Number.isFinite(horas) || horas <= 0) {
    return null;
  }
  if (horas % 24 === 0) {
    const dias = horas / 24;
    return dias === 1 ? "1 día" : `${dias} días`;
  }
  return horas === 1 ? "1 hora" : `${horas} horas`;
};

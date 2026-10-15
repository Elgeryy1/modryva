/**
 * Qué se le enseña a quien vuelve a abrir el enlace con la sesión ya cerrada.
 *
 * El guard cerraba la puerta con UNA sola frase —"esta verificación ya se
 * completó o fue cancelada"— para tres situaciones que no se parecen en nada:
 * quien ya está DENTRO del grupo, quien espera a que un admin le revise, y
 * quien empezó otra verificación más nueva. Las tres leían igual, y ninguna de
 * las tres decía la verdad.
 *
 * No es teórico. El 11-ago-2026 esa pantalla salió 25 veces a 6 personas: a una
 * auto-aprobada —ya dentro del grupo— tres veces seguidas, y a otra ocho veces
 * en un día mientras su caso seguía sin decidir. Siete de esos toques fueron en
 * 80 segundos. Quien da ocho toques no está curioseando: cree que está roto.
 *
 * Esto NO abre ninguna puerta. La sesión sigue cerrada y el guard sigue
 * devolviendo su 410; lo único que añade es CUÁL de las tres es, para que la
 * Mini App pinte la pantalla verdadera. Quien pregunta ya trae el token de la
 * sesión, que es la credencial entera: contarle su propio veredicto no le
 * revela nada que no fuera suyo.
 *
 * Pura y sin Prisma a propósito (mismo criterio que late-open.ts): recibe
 * cadenas, no filas, así que se prueba sin base de datos.
 */

/** Lo que la Mini App necesita saber para elegir pantalla. */
export type DesenlaceSesion =
  | "aprobada"
  | "en-revision"
  | "rechazada"
  | "reemplazada";

/** Lo mínimo que hace falta de la sesión. */
export interface SesionCerrada {
  readonly status: string;
  readonly decision: string | null;
}

/**
 * `accionesDeStaff` son las acciones registradas sobre esta sesión (approve,
 * decline, retry…). Se miran ANTES que la decisión automática porque el staff
 * tiene la última palabra: un caso que la IA mandó a revisión y un humano
 * aprobó está aprobado, y decirle "en revisión" a alguien que ya está dentro es
 * el mismo fallo de siempre con otra cara.
 *
 * El resto cae en "en-revision" a propósito, incluido el fallo técnico y una
 * decisión ausente: es la única respuesta que no miente cuando no se sabe —no
 * promete un sí ni cierra la puerta— y es exactamente lo que le pasa a esa
 * persona, que su caso está en manos de un humano.
 */
export const describirDesenlace = (
  sesion: SesionCerrada,
  accionesDeStaff: readonly string[],
): DesenlaceSesion => {
  if (accionesDeStaff.includes("approve")) {
    return "aprobada";
  }
  if (
    accionesDeStaff.includes("decline") ||
    accionesDeStaff.includes("expel")
  ) {
    return "rechazada";
  }
  // Cancelada = la persona volvió a pedir entrar y su sesión vieja fue
  // reemplazada por la nueva (ver handleJoinRequest). El enlace que acaba de
  // abrir es el viejo; el bueno lo tiene más abajo en el mismo chat.
  if (sesion.status === "cancelled") {
    return "reemplazada";
  }
  if (sesion.decision === "auto_approve") {
    return "aprobada";
  }
  if (sesion.decision === "auto_decline") {
    return "rechazada";
  }
  return "en-revision";
};

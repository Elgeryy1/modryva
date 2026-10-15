/**
 * Que hacer cuando un mensaje cae en la lista negra del grupo.
 *
 * La deteccion (`matchBlocklist`) ya vivia en el módulo. Lo que estaba
 * enterrado en el handler era **la traduccion del modo configurado a acciones
 * de Telegram**, y era una cadena de ternarios:
 *
 * ```
 * const action = mode === "ban" ? "ban" : mode === "kick" ? "ban" : "mute";
 * ```
 *
 * Ahi hay una cosa que no se ve leyendola por encima y que es facil romper:
 * **"kick" no es una accion de la Bot API**. Telegram no tiene expulsar-sin-
 * banear; se banea y se desbanea acto seguido, que es lo que deja a la persona
 * fuera pero pudiendo volver a entrar. Si alguien "simplifica" ese ternario y
 * se lleva por delante el desbaneo, `kick` pasa a ser un baneo permanente y
 * nadie se entera hasta que alguien reclama.
 */

/** Los modos que puede tener configurados un grupo para su lista negra. */
export type ModoDeBlocklist = "delete" | "warn" | "mute" | "ban" | "kick";

/** Lo que hay que hacer en Telegram para un modo dado. */
export interface AccionDeBlocklist {
  /** La accion real de la Bot API. `null` = solo borrar el mensaje. */
  readonly accion: "mute" | "ban" | null;
  /**
   * Si hay que desbanear justo despues.
   *
   * Solo para `kick`: banear y desbanear es como se expulsa a alguien dejandole
   * volver. Sin esto, un `kick` es un baneo para siempre.
   */
  readonly desbanearDespues: boolean;
  /** Si ademas hay que abrir un aviso formal. */
  readonly avisar: boolean;
}

/**
 * Traduce el modo configurado a lo que hay que hacer.
 *
 * El mensaje se borra SIEMPRE, en todos los modos, asi que eso no viaja aqui:
 * es el suelo comun y lo hace el nucleo antes de preguntar.
 */
export const accionParaModoDeBlocklist = (modo: string): AccionDeBlocklist => {
  switch (modo) {
    case "delete":
      return { accion: null, desbanearDespues: false, avisar: false };
    case "warn":
      return { accion: null, desbanearDespues: false, avisar: true };
    case "ban":
      return { accion: "ban", desbanearDespues: false, avisar: false };
    case "kick":
      // Banear + desbanear. Ver la nota de arriba: no hay otra forma.
      return { accion: "ban", desbanearDespues: true, avisar: false };
    default:
      // `mute` y **cualquier valor desconocido**.
      //
      // Recibe `string` y no `ModoDeBlocklist` porque el modo sale de la base
      // de datos, donde cabe cualquier cosa: un valor viejo de antes de que
      // existiera un modo, o una errata.
      //
      // Que lo desconocido acabe en `mute` NO es una decision de este cambio:
      // es lo que ya hacia el ternario del servicio, donde el ultimo caso era
      // "mute" y se tragaba todo lo que no fuera ban ni kick. Se conserva
      // porque esto es una extraccion.
      //
      // Dicho eso: **silenciar a alguien porque el ajuste tiene una errata es
      // un mal comportamiento**, y estaria mejor no hacer nada. Cambiarlo es
      // una decision de producto y esta anotada como tal, no colada aqui.
      return { accion: "mute", desbanearDespues: false, avisar: false };
  }
};

/** Los modos, en castellano. El enum crudo no se ensena nunca. */
const MODO_EN_CASTELLANO: Record<string, string> = {
  ban: "baneo a quien lo envio",
  mute: "silencio a quien lo envio",
  delete: "no hago nada mas",
  warn: "le pongo un aviso",
};

/**
 * El texto de cuando se aplico lo que tocaba.
 *
 * NO nombra el disparador a proposito. Publicar en el grupo la palabra exacta
 * que salto —"Mensaje bloqueado (comprar seguidores)"— es regalarle a quien
 * hace spam el dato que necesita para encontrar la variante que pasa el
 * filtro. El disparador sigue yendo a la auditoria y al parte del staff, que
 * es donde sirve para algo.
 */
export const textoBlocklistAplicado = (
  _disparador: string,
  modo: string,
): string =>
  `🚷 Mensaje borrado: infringe las normas del grupo. ${MODO_EN_CASTELLANO[modo] ?? modo}.`;

/**
 * El texto de cuando se borro el mensaje pero Telegram rechazo la accion.
 *
 * La distincion importa y se mantiene: la persona tiene que saber que el
 * mensaje SI se fue aunque el castigo no llegara a aplicarse. Lo que ya no
 * sale es el disparador (mismo motivo que arriba) ni el error crudo de la Bot
 * API, que viene en ingles; ese se queda en el log, que es donde se lee.
 */
export const textoBlocklistSinAccion = (
  _disparador: string,
  modo: string,
  _motivo: string,
): string =>
  `🚷 Mensaje borrado: infringe las normas del grupo. No he podido hacer lo demas (${MODO_EN_CASTELLANO[modo] ?? modo}): me faltan permisos.`;

/**
 * Los puertos que necesita el modulo `community` para su parte del bot.
 *
 * Vive AQUI, no en `packages/domain`, y esa decision gobierna todo el reparto
 * de handlers. Los puertos del dominio son transversales —Telegram, permisos,
 * auditoria, reloj—; la persistencia propia de un modulo no cabe ahi. Un
 * `RegistroDeActividadPort` generico en el dominio reconstruiria el
 * acoplamiento con un paso mas: el dominio acabaria conociendo todos los
 * repositorios del bot.
 *
 * Asi, el modulo es dueno de su contrato de datos, el nucleo le entrega el
 * adaptador al construirlo, y `@superbot/data` sigue sin ser alcanzable desde
 * ningun modulo.
 */

/**
 * Una actividad de chat lista para registrar.
 *
 * Llega **ya normalizada**: el modulo no toca el update crudo de Telegram. En
 * concreto `respondeAUsuarioId` lo calcula el nucleo, porque la funcion que
 * navega `raw.message.reply_to_message` vive en otro modulo y un modulo no
 * importa a otro.
 */
export interface ActividadDeChat {
  readonly tenantId: string;
  readonly chatId: string;
  readonly texto: string;
  readonly tieneEnlace: boolean;
  readonly tieneMencion: boolean;
  readonly usuarioTelegramId?: bigint;
  readonly usuario?: string;
  readonly respondeAUsuarioId?: bigint;
  readonly tema?: string;
  readonly mensajeId?: bigint;
}

/** Donde se guarda la actividad. Una capacidad, no un repositorio entero. */
export interface RegistroDeActividadPort {
  registrar(actividad: ActividadDeChat): Promise<void>;
}

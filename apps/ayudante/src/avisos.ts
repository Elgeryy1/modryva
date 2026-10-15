import type { AyudanteAvisoPrivadoRepository } from "@superbot/data";
import type { ResultadoEnvioPrivado, UserbotPort } from "./userbot-port.js";

/**
 * El unico sitio donde el Ayudante manda un privado.
 *
 * Existio duplicado en cuatro bloques durante el pase en que se escribieron en
 * paralelo, y tres de las copias se dejaron por el camino la guarda de
 * `yaSeAviso`. Eso convertia el barrido de mascotas -que revisa cada quince
 * minutos- en 96 privados al dia a la misma persona: exactamente el fallo que
 * la columna `curaAvisos` de `Pet` documenta como ya sufrido. Un solo camino
 * para todos los bloques es lo que impide que vuelva a pasar.
 */

export interface ResultadoAvisoPrivado {
  /** `true` cuando ya se habia avisado de esto hoy y no se ha vuelto a mandar. */
  readonly yaAvisado: boolean;
  /** El resultado del envio, o `null` si no se llego a enviar por estar ya avisado. */
  readonly envio: ResultadoEnvioPrivado | null;
}

/** El inicio del dia UTC que contiene `ahora`. Pura: el reloj entra por parametro. */
export const inicioDeDiaUtc = (ahora: Date): Date =>
  new Date(
    Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()),
  );

/**
 * Manda un privado como mucho una vez al dia por (destinatario, tipo).
 *
 * El orden de los tres pasos no es negociable:
 *
 * 1. `yaSeAviso` ANTES de nada. Si ya se aviso hoy, no se registra fila nueva
 *    ni se llama al userbot.
 * 2. `registrarPendiente` ANTES de enviar. La fila `pendiente` es lo que hace
 *    de reserva: `yaSeAviso` la cuenta como intento en curso, asi que si el
 *    proceso muere entre el envio y el marcado, el reintento del despachador
 *    NO manda el mensaje otra vez. Duplicar un aviso es peor que perderlo:
 *    el que se pierde lo recupera el barrido de mañana.
 * 3. Si el envio LANZA, la fila se marca `rebotado` antes de propagar. Un
 *    fallo de envio si tiene que poder reintentarse hoy, y `rebotado` no lo
 *    bloquea; dejarla `pendiente` la habria bloqueado hasta mañana.
 */
export const enviarAvisoPrivado = async (
  repositorio: AyudanteAvisoPrivadoRepository,
  userbot: UserbotPort,
  input: {
    readonly tenantId: string;
    readonly destinatarioTelegramId: bigint;
    readonly tipo: string;
    readonly texto: string;
    /** El reloj, por parametro, para poder probar el borde de la medianoche UTC. */
    readonly ahora?: Date;
  },
): Promise<ResultadoAvisoPrivado> => {
  const ahora = input.ahora ?? new Date();

  const yaAvisado = await repositorio.yaSeAviso({
    tenantId: input.tenantId,
    destinatarioTelegramId: input.destinatarioTelegramId,
    tipo: input.tipo,
    desde: inicioDeDiaUtc(ahora),
  });
  if (yaAvisado) return { yaAvisado: true, envio: null };

  const fila = await repositorio.registrarPendiente({
    tenantId: input.tenantId,
    destinatarioTelegramId: input.destinatarioTelegramId,
    tipo: input.tipo,
  });

  let envio: ResultadoEnvioPrivado;
  try {
    envio = await userbot.enviarPrivado({
      userTelegramId: input.destinatarioTelegramId,
      texto: input.texto,
    });
  } catch (error) {
    // La reserva no puede quedarse colgada en `pendiente`: eso bloquearia el
    // reintento de hoy por un fallo que si merece reintentarse.
    await repositorio.marcarResultado({ id: fila.id, estado: "rebotado" });
    throw error;
  }

  await repositorio.marcarResultado({ id: fila.id, estado: envio.estado });
  return { yaAvisado: false, envio };
};

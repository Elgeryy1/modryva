import type { MessageContentFlags } from "@superbot/domain";

import {
  buildQuarantineKeyboard,
  buildQuarantineLog,
  evaluateQuarantineCandidate,
  type QuarantineItemView,
} from "../../d1.js";

/**
 * `quarantine.ambient`: aparta un mensaje sospechoso para que lo mire una
 * persona, en vez de decidir el bot.
 *
 * Se lleva la orquestacion entera: mirar los ajustes, decidir, borrar,
 * crear el item, anotar la senal de riesgo y dejar la bitacora con su teclado.
 * En el nucleo queda traducir el update y construir los puertos.
 *
 * **El orden de los cinco efectos es comportamiento y esta fijado con tests.**
 * Lo que importa no es el orden por si mismo sino que **el item se crea antes
 * que la bitacora**: la bitacora lleva el teclado de aprobar/rechazar, y ese
 * teclado necesita el id del item. Al reves saldria un botón que no apunta a
 * nada.
 *
 * Y el borrado va **antes** que todo lo demas: si el mensaje sigue visible
 * mientras se escribe en la base de datos, la ventana en la que la gente lo lee
 * es justo lo que la cuarentena existe para cerrar.
 */

/** Los ajustes del chat. */
export interface AjustesDeCuarentena {
  readonly enabled: boolean;
  readonly strictness: string;
}

/** Lo que hace falta para crear el item, ya sin forma de Telegram. */
export interface ItemDeCuarentena {
  readonly motivo: string;
  readonly texto: string | undefined;
}

/** Lo que el handler necesita del resto del sistema. */
export interface PuertosDeCuarentena {
  /** Si quien escribe se salta la cuarentena. */
  esAdministrador(): Promise<boolean>;
  /** Los ajustes del chat. */
  ajustes(): Promise<AjustesDeCuarentena>;
  /** Borra el mensaje apartado. */
  borrarMensaje(): Promise<void>;
  /** Guarda el item y devuelve como quedo, con su id. */
  crearItem(item: ItemDeCuarentena): Promise<QuarantineItemView>;
  /** Anota que esta persona ha tenido un mensaje en cuarentena. */
  anotarSenalDeRiesgo(): Promise<void>;
  /** Deja constancia para el staff, con el teclado de revision. */
  registrarEnBitacora(entrada: {
    readonly titulo: string;
    readonly cuerpo: string;
    readonly teclado: Record<string, unknown>;
  }): Promise<void>;
}

/** El update ya normalizado. */
export interface MensajeParaCuarentena {
  readonly esComando: boolean;
  readonly contenido: MessageContentFlags;
  readonly texto: string | undefined;
  readonly tieneMensajeId: boolean;
}

/** El aviso, o `null` si no hay que apartar nada. */
export const aplicarCuarentena = async (
  mensaje: MensajeParaCuarentena,
  puertos: PuertosDeCuarentena,
): Promise<string | null> => {
  if (mensaje.esComando) {
    return null;
  }

  if (await puertos.esAdministrador()) {
    return null;
  }

  const ajustes = await puertos.ajustes();
  if (!ajustes.enabled) {
    return null;
  }

  const decision = evaluateQuarantineCandidate(
    mensaje.contenido,
    mensaje.texto,
    ajustes.strictness,
  );
  if (!decision?.quarantine) {
    return null;
  }

  // Primero fuera de la vista. Cada milisegundo que siga visible es gente
  // leyendolo, que es lo que la cuarentena existe para evitar.
  //
  // Sin `messageId` no hay nada que borrar, pero el mensaje SI se aparta: se
  // pierde el borrado, no la revision.
  if (mensaje.tieneMensajeId) {
    await puertos.borrarMensaje();
  }

  // El item antes que la bitacora: el teclado de revision lleva su id dentro.
  const item = await puertos.crearItem({
    motivo: decision.reason,
    texto: mensaje.texto,
  });

  await puertos.anotarSenalDeRiesgo();

  await puertos.registrarEnBitacora({
    titulo: "Mensaje enviado a cuarentena",
    cuerpo: buildQuarantineLog(item),
    teclado: buildQuarantineKeyboard(item.id),
  });

  return "Mensaje enviado a cuarentena para revisión.";
};

import type { MessageContentFlags } from "@superbot/domain";

import { LOCKABLE_TYPES, type LockType } from "../../content-locks.js";
import {
  type BloqueosPorTema,
  resolverBloqueoDeContenido,
} from "./bloqueos.js";

/**
 * `content-lock.ambient`: borra el contenido que el grupo tiene bloqueado.
 *
 * Se lleva la orquestacion entera. La precedencia entre los dos niveles —la
 * lista del chat manda, y solo si no salta se mira lo que anada el tema— ya
 * vivia aqui al lado, en `bloqueos.ts`.
 *
 * **Los admins se lo saltan**, y se pregunta lo primero: si quien escribe puede
 * moderar, no hay nada mas que mirar.
 */

/**
 * Los tipos bloqueados, con la forma comprobada.
 *
 * El nucleo hacia `locked as LockType[]`, que se fia de que lo guardado sean
 * tipos que existen. Salen de la base de datos, donde cabe un tipo que se
 * renombro hace dos versiones o una errata. Lo que no esta en `LOCKABLE_TYPES`
 * se descarta: un tipo que no existe no puede bloquear nada, asi que tratarlo
 * como bloqueo seria borrar mensajes por un ajuste roto.
 */
export const tiposBloqueadosValidos = (
  crudo: readonly string[],
): readonly LockType[] =>
  crudo.filter((t): t is LockType =>
    (LOCKABLE_TYPES as readonly string[]).includes(t),
  );

/**
 * La senal de riesgo que deja un bloqueo.
 *
 * Enlaces y reenvios cuentan como `link` porque alimentan el detector de spam
 * de enlaces; lo demas es un borrado normal. Estaba inline en el handler como
 * un ternario y aqui tiene nombre y test.
 */
export const senalDeRiesgoPara = (tipo: LockType): "link" | "deleted" =>
  tipo === "url" || tipo === "forward" ? "link" : "deleted";

/** Lo que el handler necesita del resto del sistema. */
export interface PuertosDeBloqueoDeContenido {
  esAdministrador(): Promise<boolean>;
  bloqueadosEnElChat(): Promise<readonly string[]>;
  bloqueosPorTema(): Promise<BloqueosPorTema>;
  borrarMensaje(): Promise<void>;
  auditar(tipo: LockType): Promise<void>;
  anotarSenalDeRiesgo(senal: "link" | "deleted"): Promise<void>;
}

/** El update ya normalizado. */
export interface MensajeParaBloqueo {
  readonly contenido: MessageContentFlags;
  readonly temaId: string | undefined;
}

/** El aviso, o `null` si no hay que bloquear nada. */
export const aplicarBloqueoDeContenido = async (
  mensaje: MensajeParaBloqueo,
  puertos: PuertosDeBloqueoDeContenido,
): Promise<string | null> => {
  if (await puertos.esAdministrador()) {
    return null;
  }

  const [enElChat, porTema] = await Promise.all([
    puertos.bloqueadosEnElChat(),
    puertos.bloqueosPorTema(),
  ]);

  const violacion = resolverBloqueoDeContenido({
    contenido: mensaje.contenido,
    bloqueadosEnElChat: tiposBloqueadosValidos(enElChat),
    bloqueosPorTema: porTema,
    temaId: mensaje.temaId,
  });
  if (!violacion) {
    return null;
  }

  try {
    await puertos.borrarMensaje();
  } catch {
    // Que Telegram rechace el borrado no puede llevarse por delante el rastro:
    // la auditoria de abajo se escribe igual.
  }

  await puertos.auditar(violacion);
  await puertos.anotarSenalDeRiesgo(senalDeRiesgoPara(violacion));

  return `Contenido bloqueado (${violacion}) y eliminado.`;
};

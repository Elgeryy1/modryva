import type { MessageContentFlags } from "@superbot/domain";

import {
  evaluateLocks,
  LOCKABLE_TYPES,
  type LockType,
} from "../../content-locks.js";
import {
  isTypeLockedInTopic,
  type TopicScopedConfig,
} from "../../topic-scoping.js";

/**
 * La precedencia entre los dos niveles de bloqueo de contenido.
 *
 * Un grupo puede bloquear tipos de contenido de dos formas, y **no son la
 * misma**:
 *
 * - **Del chat entero** (`/lock`): manda en todos los temas.
 * - **De un tema concreto** (`/topicconfig`): anade tipos bloqueados **solo
 *   dentro de ese tema**, sin tocar la lista del chat.
 *
 * El orden importa y estaba repartido entre un `let` reasignado y dos bloques
 * del handler, que es donde es facil que alguien invierta la precedencia sin
 * darse cuenta. Aqui esta en una funcion con nombre y con tests.
 *
 * La regla: primero se mira la lista del chat, y **solo si no hay violacion**
 * se mira la del tema. Al reves cambiaria el resultado cuando ambas listas
 * bloquean tipos distintos y el mensaje viola los dos: se reportaria el tipo
 * equivocado, y ese tipo es lo que se le dice a la persona.
 */

/** Los ajustes de bloqueo por tema, tal como los guarda el grupo. */
export type BloqueosPorTema = TopicScopedConfig<{
  readonly lockedTypes: readonly string[];
}>;

/**
 * El tipo de contenido que hace saltar el bloqueo, o `null` si no salta.
 *
 * Se devuelve el TIPO y no un booleano porque es lo que se le dice a la
 * persona ("no se permiten stickers aqui"), asi que perderlo por el camino
 * empeoraria el mensaje.
 */
export const resolverBloqueoDeContenido = (entrada: {
  readonly contenido: MessageContentFlags;
  readonly bloqueadosEnElChat: readonly LockType[];
  readonly bloqueosPorTema: BloqueosPorTema;
  readonly temaId: string | undefined;
}): LockType | null => {
  // 1. La lista del chat manda.
  const delChat =
    entrada.bloqueadosEnElChat.length > 0
      ? evaluateLocks(entrada.contenido, entrada.bloqueadosEnElChat)
      : null;
  if (delChat) return delChat;

  // 2. Y solo entonces, lo que anada el tema.
  const delTema = LOCKABLE_TYPES.filter((tipo) =>
    isTypeLockedInTopic(entrada.bloqueosPorTema, entrada.temaId, tipo),
  );
  return delTema.length > 0 ? evaluateLocks(entrada.contenido, delTema) : null;
};

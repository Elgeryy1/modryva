/**
 * Atar un id de grupo llegado del cliente a quien lo envía.
 *
 * El `start_param` de una Mini App lo elige QUIEN CONSTRUYE EL ENLACE. La firma
 * de Telegram sobre `initData` demuestra que el valor pasó por esta Mini App;
 * no demuestra en absoluto que esa persona tenga nada que ver con ese grupo.
 * Abrir `t.me/<bot>/<app>?startapp=games_<grupo_ajeno>` es todo lo que hace
 * falta para que un id que no te corresponde llegue al servidor firmado.
 *
 * Por eso este fichero existe en vez de ser dos bloques copiados: `games.service`
 * hacía las dos comprobaciones y `match.service` no hacía ninguna, y las dos
 * leían el mismo `start_param`. La deriva entre dos copias del mismo control es
 * lo que produjo el agujero; una función compartida es parte del arreglo, no
 * una limpieza estética.
 */

/**
 * Estados de Telegram que cuentan como "está en el grupo".
 *
 * `restricted` entra a propósito: alguien silenciado sigue siendo miembro y no
 * se le echa de las funciones del bot por estarlo. `left` y `kicked` NO están,
 * y ésa es justo la diferencia que convierte esta comprobación en la que impide
 * que un expulsado siga usando el bot para aparecer en el grupo.
 */
export const MEMBER_STATUSES: ReadonlySet<string> = new Set([
  "member",
  "administrator",
  "creator",
  "restricted",
]);

/** Lo mínimo que hace falta de Telegram: preguntar por un miembro. */
export interface GroupMembershipGateway {
  getChatMember(input: {
    chatId: bigint;
    userId: bigint;
    token: string | undefined;
  }): Promise<{ ok: boolean; status?: string }>;
}

/** Lo mínimo que hace falta de la base: resolver el chat dentro del tenant. */
export interface GroupLookup {
  findChatByTelegramId(
    tenantId: string,
    telegramChatId: bigint,
  ): Promise<{ chatId: string } | null | undefined>;
}

/**
 * Devuelve el chat interno si —y solo si— el grupo pertenece a este tenant Y
 * quien pregunta está dentro de él. `null` en cualquier otro caso.
 *
 * Falla cerrado: si Telegram no contesta, la respuesta es `null`. Un fallo de
 * red no puede ser lo que conceda el acceso, que es exactamente el error que
 * comete un `catch` que devuelve "sí" por comodidad.
 */
export const resolveGroupForCaller = async (
  deps: {
    readonly foundation: GroupLookup;
    readonly gateway: GroupMembershipGateway;
  },
  input: {
    readonly tenantId: string;
    readonly telegramChatId: bigint;
    readonly telegramUserId: bigint;
    readonly token: string | undefined;
  },
): Promise<{ chatId: string } | null> => {
  const chat = await deps.foundation
    .findChatByTelegramId(input.tenantId, input.telegramChatId)
    .catch(() => null);
  if (!chat) {
    // El grupo no es de este tenant (o no se ha visto nunca). Sin esto, un bot
    // podría escribir en los grupos de otro.
    return null;
  }
  const membership = await deps.gateway
    .getChatMember({
      chatId: input.telegramChatId,
      userId: input.telegramUserId,
      token: input.token,
    })
    .catch(() => ({ ok: false, status: undefined }));
  if (!membership.ok || !MEMBER_STATUSES.has(membership.status ?? "")) {
    return null;
  }
  return { chatId: chat.chatId };
};

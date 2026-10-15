import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Scoping de configuracion por topic (message_thread_id), espejo del routing
 * por grupo de la red D2. Un `TopicScopedConfig<T>` guarda una config base y un
 * mapa de overrides parciales indexado por id de topic (como string). La logica
 * es generica y pura: resuelve la config efectiva de un topic mezclando la base
 * con su override, sin I/O ni estado. Incluye el comando `/topicconfig` que
 * gestiona bloqueos de tipos por topic.
 */

/**
 * Config scopeada por topic: una base compartida y overrides parciales por id
 * de topic. Las claves del mapa son ids de topic normalizados a string; el
 * topic "general" (sin thread) se representa con topicId undefined y usa la
 * base tal cual.
 */
export interface TopicScopedConfig<T> {
  readonly base: T;
  readonly overrides: Record<string, Partial<T>>;
}

/**
 * Normaliza un id de topic a la clave usada en `overrides`. Devuelve undefined
 * cuando no hay topic (thread general) o cuando el id esta vacio/en blanco, de
 * modo que ese caso siempre cae en la base. Pura y determinista.
 */
export const normalizeTopicKey = (
  topicId: string | undefined,
): string | undefined => {
  if (topicId === undefined) {
    return undefined;
  }
  const trimmed = topicId.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

/**
 * Resuelve la config efectiva de un topic: la base mezclada con el override del
 * topic (el override gana por clave). Sin topic (o topic desconocido) devuelve
 * una copia de la base. Nunca muta las entradas. Pura y determinista.
 */
export const resolveTopicConfig = <T>(
  scoped: TopicScopedConfig<T>,
  topicId: string | undefined,
): T => {
  const key = normalizeTopicKey(topicId);
  if (key === undefined) {
    return { ...scoped.base };
  }
  const override = scoped.overrides[key];
  if (override === undefined) {
    return { ...scoped.base };
  }
  return { ...scoped.base, ...override };
};

/**
 * True cuando el topic tiene declarado en su config efectiva que `type` esta
 * bloqueado (aparece en `lockedTypes`). La comparacion es exacta y sensible a
 * mayusculas. Pura y determinista.
 */
export const isTypeLockedInTopic = (
  scoped: TopicScopedConfig<{ readonly lockedTypes: readonly string[] }>,
  topicId: string | undefined,
  type: string,
): boolean => {
  const config = resolveTopicConfig(scoped, topicId);
  return config.lockedTypes.includes(type);
};

/**
 * Comando `/topicconfig` resuelto contra el topic en el que se emitio. `topicId`
 * es la clave normalizada del topic (siempre presente: fuera de un topic el
 * parser devuelve un error). `lock`/`unlock` operan sobre un tipo concreto;
 * `reset` limpia el override del topic y `show` solo consulta.
 */
export type TopicScopeCommand =
  | { readonly kind: "lock"; readonly topicId: string; readonly type: string }
  | { readonly kind: "unlock"; readonly topicId: string; readonly type: string }
  | { readonly kind: "reset"; readonly topicId: string }
  | { readonly kind: "show"; readonly topicId: string };

/** Motivos por los que `/topicconfig` puede rechazar la entrada. */
export type TopicScopeCommandError =
  | { readonly code: "no-topic"; readonly usage: string }
  | { readonly code: "missing-action"; readonly usage: string }
  | { readonly code: "unknown-action"; readonly usage: string }
  | { readonly code: "missing-type"; readonly usage: string };

export type TopicScopeCommandResult =
  | { readonly ok: true; readonly command: TopicScopeCommand }
  | { readonly ok: false; readonly error: TopicScopeCommandError };

const TOPIC_SCOPE_USAGE =
  "Uso (dentro de un topic): /topicconfig lock|unlock <tipo> | reset | show";

/**
 * Parsea `/topicconfig <accion> [tipo]` resolviendolo contra el topic del
 * update (`chat.topicId`). Acciones: `lock <tipo>`, `unlock <tipo>`, `reset`,
 * `show`. Devuelve un error tipado si el comando se usa fuera de un topic,
 * falta la accion, la accion es desconocida o falta el tipo en lock/unlock.
 * Devuelve null cuando el update no es `/topicconfig`. Pura y determinista.
 */
export const parseTopicScopeCommand = (
  update: TelegramUpdateEnvelope,
): TopicScopeCommandResult | null => {
  if (update.command?.name !== "topicconfig") {
    return null;
  }

  const key = normalizeTopicKey(
    update.chat.topicId === undefined ? undefined : String(update.chat.topicId),
  );
  if (key === undefined) {
    return {
      ok: false,
      error: { code: "no-topic", usage: TOPIC_SCOPE_USAGE },
    };
  }

  const args = update.command?.args ?? [];
  const action = args[0]?.toLowerCase();

  if (!action) {
    return {
      ok: false,
      error: { code: "missing-action", usage: TOPIC_SCOPE_USAGE },
    };
  }

  if (action === "reset") {
    return { ok: true, command: { kind: "reset", topicId: key } };
  }

  if (action === "show") {
    return { ok: true, command: { kind: "show", topicId: key } };
  }

  if (action === "lock" || action === "unlock") {
    const type = (args[1] ?? "").trim();
    if (type.length === 0) {
      return {
        ok: false,
        error: { code: "missing-type", usage: TOPIC_SCOPE_USAGE },
      };
    }
    return { ok: true, command: { kind: action, topicId: key, type } };
  }

  return {
    ok: false,
    error: { code: "unknown-action", usage: TOPIC_SCOPE_USAGE },
  };
};

import type { NormalizedReaction } from "@superbot/domain";

/**
 * Moderación de reacciones nativas de Telegram (`message_reaction`). Lógica pura
 * y determinista: DECIDE, no ejecuta. El cableado (retirar vía gateway, auditar,
 * alertar al staff) vive en el bot; aquí solo se evalúa la señal. Sin I/O.
 *
 * Semántica de retirada (Bot API 10.0): `deleteMessageReaction` identifica al
 * ACTOR (user_id | actor_chat_id), NO al emoji. Retirar una reacción bloqueada
 * de un actor sobre un mensaje elimina TODAS las reacciones de ese actor en ese
 * mensaje. `deleteAllMessageReactions` es una purga global del historial de un
 * actor (hasta 10 000) y queda FUERA de este módulo: es una acción manual con
 * confirmación de admin, nunca automática.
 *
 * Tres modos por grupo:
 *  - `off`     → no se evalúa nada (por defecto; opt-in explícito).
 *  - `shadow`  → se detecta y se audita, pero NO se retira ni se sanciona.
 *  - `enforce` → se detecta, se audita y se retira (si el bot puede borrar).
 */

export type ReactionModerationMode = "off" | "shadow" | "enforce";

export const REACTION_MODERATION_MODES: readonly ReactionModerationMode[] = [
  "off",
  "shadow",
  "enforce",
];

export interface ReactionModerationConfig {
  readonly mode: ReactionModerationMode;
  /** Emojis estándar vetados como reacción. */
  readonly blockedEmojis: readonly string[];
  /** IDs de custom_emoji vetados como reacción. */
  readonly blockedCustomEmojiIds: readonly string[];
  /** Reactores DISTINTOS de reacciones sospechosas que cuentan como "surge". */
  readonly surgeThreshold: number;
  /** Ventana (segundos) en la que se cuentan esos reactores. */
  readonly surgeWindowSeconds: number;
}

export const DEFAULT_REACTION_MODERATION: ReactionModerationConfig = {
  mode: "off",
  blockedEmojis: [],
  blockedCustomEmojiIds: [],
  surgeThreshold: 12,
  surgeWindowSeconds: 30,
};

/**
 * Conjunto sugerido de emojis abusivos que un admin PUEDE adoptar. Nunca se
 * aplica solo: la config por defecto lleva `blockedEmojis` vacío.
 */
export const SUGGESTED_ABUSIVE_REACTIONS: readonly string[] = [
  "🖕",
  "💩",
  "🤡",
  "🤮",
  "👎",
];

/** Tope defensivo de entradas de blocklist (evita configs abusivas). */
const MAX_BLOCKED = 50;

/**
 * Umbral de surge máximo que una config puede pedir. Dimensiona el store: su
 * `maxActorsPerKey` debe ser ≥ este valor o el umbral sería inalcanzable.
 */
export const MAX_SURGE_THRESHOLD = 1000;

/** Clave de ChatSetting bajo la que se guarda la config por-grupo. */
export const REACTION_MODERATION_SETTING_KEY = "reaction_moderation";

const isMode = (value: unknown): value is ReactionModerationMode =>
  typeof value === "string" &&
  (REACTION_MODERATION_MODES as readonly string[]).includes(value);

/** Recorta un entero a [min, max]; cae a `fallback` si no es finito. */
const clampInt = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(n)));
};

/** Normaliza strings: recorta y descarta vacíos/duplicados, preservando orden. */
const normalizeList = (values: readonly unknown[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length > 0 && !seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
};

/**
 * Parsea de forma defensiva la config almacenada en ChatSetting (JSON libre) a
 * una {@link ReactionModerationConfig} válida, cayendo a los valores por defecto
 * ante cualquier campo ausente o corrupto. Pura.
 */
export const parseReactionModerationConfig = (
  raw: unknown,
): ReactionModerationConfig => {
  if (raw == null || typeof raw !== "object") {
    return DEFAULT_REACTION_MODERATION;
  }
  const o = raw as Record<string, unknown>;
  return {
    mode: isMode(o.mode) ? o.mode : DEFAULT_REACTION_MODERATION.mode,
    blockedEmojis: Array.isArray(o.blockedEmojis)
      ? normalizeList(o.blockedEmojis).slice(0, MAX_BLOCKED)
      : DEFAULT_REACTION_MODERATION.blockedEmojis,
    blockedCustomEmojiIds: Array.isArray(o.blockedCustomEmojiIds)
      ? normalizeList(o.blockedCustomEmojiIds).slice(0, MAX_BLOCKED)
      : DEFAULT_REACTION_MODERATION.blockedCustomEmojiIds,
    surgeThreshold: clampInt(
      o.surgeThreshold,
      2,
      MAX_SURGE_THRESHOLD,
      DEFAULT_REACTION_MODERATION.surgeThreshold,
    ),
    surgeWindowSeconds: clampInt(
      o.surgeWindowSeconds,
      5,
      3600,
      DEFAULT_REACTION_MODERATION.surgeWindowSeconds,
    ),
  };
};

/**
 * Devuelve el subconjunto de reacciones recién añadidas que están vetadas
 * (por emoji estándar o por custom_emoji id). En `off`, o sin blocklist, vacío.
 * Pura.
 */
export const evaluateReactionAbuse = (
  reactionsAdded: readonly NormalizedReaction[],
  config: ReactionModerationConfig,
): readonly NormalizedReaction[] => {
  if (config.mode === "off") {
    return [];
  }
  const emojis = new Set(config.blockedEmojis);
  const customIds = new Set(config.blockedCustomEmojiIds);
  if (emojis.size === 0 && customIds.size === 0) {
    return [];
  }
  return reactionsAdded.filter((reaction) =>
    reaction.type === "emoji"
      ? emojis.has(reaction.emoji)
      : customIds.has(reaction.customEmojiId),
  );
};

/**
 * Clasificación SIN permiso (fase 1 del flujo de dos fases). Modela hasta dónde
 * se decide sin consultar a Telegram:
 *  - `none`    → nada bloqueado (o modo off) → terminar sin getMe/getChatMember.
 *  - `observe` → shadow: auditar, sin tocar Telegram ni consultar permiso.
 *  - `enforce` → hay bloqueo en modo enforce: HAY que resolver identidad+permiso.
 */
export type ReactionClassification =
  | { readonly kind: "none" }
  | {
      readonly kind: "observe";
      readonly blocked: readonly NormalizedReaction[];
    }
  | {
      readonly kind: "enforce";
      readonly blocked: readonly NormalizedReaction[];
    };

/**
 * Fase 1: clasifica sin consultar permisos. `enforce` es la ÚNICA rama que
 * obliga a resolver identidad + permiso del bot (fase 2). Pura.
 */
export const classifyReactionModeration = (
  reactionsAdded: readonly NormalizedReaction[],
  config: ReactionModerationConfig,
): ReactionClassification => {
  if (config.mode === "off") {
    return { kind: "none" };
  }
  const blocked = evaluateReactionAbuse(reactionsAdded, config);
  if (blocked.length === 0) {
    return { kind: "none" };
  }
  return config.mode === "shadow"
    ? { kind: "observe", blocked }
    : { kind: "enforce", blocked };
};

/**
 * Resultado de la fase 2 (solo se calcula tras `enforce`). El permiso es
 * TRIESTADO:
 *  - `true`      → `remove`: retirar (por actor) + auditar.
 *  - `false`     → `missing_permission`: permiso confirmado ausente; NO llamar a
 *                  la API, auditar y alertar al staff una vez por ventana.
 *  - `undefined` → `permission_unknown`: fallo transitorio (timeout/429/respuesta
 *                  incompleta); degradar y auditar, SIN alertar "faltan permisos".
 */
export type ReactionEnforceOutcome =
  | { readonly kind: "remove"; readonly blocked: readonly NormalizedReaction[] }
  | {
      readonly kind: "missing_permission";
      readonly blocked: readonly NormalizedReaction[];
    }
  | {
      readonly kind: "permission_unknown";
      readonly blocked: readonly NormalizedReaction[];
    };

/**
 * Fase 2: traduce el permiso triestado a la acción. Pura: no llama a Telegram
 * ni elige el actor — eso lo hace el cableado.
 */
export const resolveEnforceOutcome = (
  blocked: readonly NormalizedReaction[],
  botCanDeleteMessages: boolean | undefined,
): ReactionEnforceOutcome => {
  if (botCanDeleteMessages === true) {
    return { kind: "remove", blocked };
  }
  if (botCanDeleteMessages === false) {
    return { kind: "missing_permission", blocked };
  }
  return { kind: "permission_unknown", blocked };
};

/**
 * Si un mensaje está viendo un SURGE de reacciones sospechosas: reactores
 * DISTINTOS de reacciones marcadas dentro de la ventana ≥ umbral. NO cuenta
 * todas las reacciones — la popularidad legítima no es abuso. El surge es una
 * señal de revisión para el staff en modo shadow inicialmente; NUNCA dispara
 * una retirada automática (eso sería `deleteAllMessageReactions`, que es manual
 * y con confirmación de admin). Pura.
 */
export const isReactionSurge = (
  distinctSuspiciousActors: number,
  config: ReactionModerationConfig,
): boolean =>
  config.mode !== "off" && distinctSuspiciousActors >= config.surgeThreshold;

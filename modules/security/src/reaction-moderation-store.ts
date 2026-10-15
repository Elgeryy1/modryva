/**
 * Almacenes en memoria ACOTADOS para la moderación de reacciones. Estado, no
 * lógica: la decisión vive en `reaction-moderation.ts`. Todos aplican TTL y un
 * tope duro de claves (FIFO; el `Map` preserva orden de inserción) para que la
 * memoria nunca crezca sin límite bajo un flujo hostil.
 */

export interface ReactionSurgeStoreOptions {
  /**
   * TTL máximo de una señal (ms). Debe cubrir la MAYOR ventana por-grupo posible
   * (`surgeWindowSeconds` topa en 3600 s), porque cada grupo cuenta con SU propia
   * ventana vía {@link InMemoryReactionSurgeStore.distinctSince}.
   */
  readonly maxTtlMs: number;
  /** Tope de claves (tenant/chat/message) rastreadas a la vez. */
  readonly maxKeys: number;
  /**
   * Tope de actores DISTINTOS por clave. DEBE ser ≥ el mayor umbral de surge
   * efectivo, o una config podría pedir un umbral inalcanzable. Ver
   * `MAX_SURGE_THRESHOLD` en `reaction-moderation.ts`.
   */
  readonly maxActorsPerKey: number;
}

/**
 * Cuenta actores DISTINTOS de reacciones SOSPECHOSAS por clave
 * `${tenant}:${chat}:${message}`. Guarda un timestamp por actor (dedup nativo),
 * de modo que la ventana de conteo la elige el llamante (`distinctSince`) según
 * el `surgeWindowSeconds` del grupo — el store no fija una ventana global. Solo
 * se registran señales que el cableado considera sospechosas: no cuenta la
 * popularidad legítima.
 */
export class InMemoryReactionSurgeStore {
  private readonly buckets = new Map<string, Map<string, number>>();

  constructor(private readonly options: ReactionSurgeStoreOptions) {}

  /** Registra una señal sospechosa (dedup por actor: guarda el último instante). */
  record(key: string, actorKey: string, nowMs: number): void {
    let actors = this.buckets.get(key);
    if (actors === undefined) {
      actors = new Map<string, number>();
    } else {
      // Reinsertar mueve la clave al final → FIFO evinge primero las inactivas.
      this.buckets.delete(key);
      this.pruneExpired(actors, nowMs);
    }
    actors.set(actorKey, nowMs);
    while (actors.size > this.options.maxActorsPerKey) {
      const oldestActor = actors.keys().next().value;
      if (oldestActor === undefined) {
        break;
      }
      actors.delete(oldestActor);
    }
    this.buckets.set(key, actors);
    while (this.buckets.size > this.options.maxKeys) {
      const oldestKey = this.buckets.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.buckets.delete(oldestKey);
    }
  }

  /** Actores distintos vistos en/después de `sinceMs` (la ventana del grupo). */
  distinctSince(key: string, sinceMs: number): number {
    const actors = this.buckets.get(key);
    if (actors === undefined) {
      return 0;
    }
    let count = 0;
    for (const lastMs of actors.values()) {
      if (lastMs >= sinceMs) {
        count += 1;
      }
    }
    return count;
  }

  private pruneExpired(actors: Map<string, number>, nowMs: number): void {
    const cutoff = nowMs - this.options.maxTtlMs;
    for (const [actorKey, lastMs] of actors) {
      if (lastMs < cutoff) {
        actors.delete(actorKey);
      }
    }
  }

  /** Nº de claves rastreadas (para tests/observabilidad). */
  size(): number {
    return this.buckets.size;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }
}

export interface OncePerWindowGateOptions {
  readonly windowMs: number;
  readonly maxKeys: number;
}

/**
 * Puerta anti-repetición: `shouldFire(key)` es true como mucho una vez por
 * ventana y por clave. La usa el cableado para alertar al staff UNA sola vez por
 * ventana (permiso faltante / surge), en vez de spamear. Acotada por FIFO.
 */
export class InMemoryOncePerWindowGate {
  private readonly lastFiredAt = new Map<string, number>();

  constructor(private readonly options: OncePerWindowGateOptions) {}

  shouldFire(key: string, nowMs: number): boolean {
    const previous = this.lastFiredAt.get(key);
    if (previous !== undefined && nowMs - previous < this.options.windowMs) {
      return false;
    }
    this.lastFiredAt.delete(key);
    this.lastFiredAt.set(key, nowMs);
    while (this.lastFiredAt.size > this.options.maxKeys) {
      const oldest = this.lastFiredAt.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.lastFiredAt.delete(oldest);
    }
    return true;
  }

  /**
   * Undo a `shouldFire` reservation when the action it gated did NOT complete
   * (e.g. the staff alert send threw). Frees the key so the next attempt fires
   * immediately instead of being suppressed for the whole window — the gate must
   * only stay consumed after a SUCCESSFUL send.
   */
  rollback(key: string): void {
    this.lastFiredAt.delete(key);
  }
}

export interface BotPermissionCacheOptions {
  readonly ttlMs: number;
  readonly maxKeys: number;
}

/**
 * Caché triestado del permiso `can_delete_messages` del bot, por
 * `${botId}:${telegramChatId}` (NUNCA global para el bot padre). Con:
 *  - **TTL**: una entrada confirmada caduca y se re-resuelve.
 *  - **single-flight**: una ráfaga de reacciones para la misma clave comparte
 *    UNA sola resolución en vuelo, en vez de disparar N `getChatMember`.
 *  - **unknown no se cachea**: un fallo transitorio (timeout/429/respuesta
 *    incompleta → `undefined`) se reintenta la próxima vez, no se fija como "no".
 * Acotada por FIFO de claves.
 */
export class InMemoryBotPermissionCache {
  private readonly entries = new Map<
    string,
    { value: boolean; expiresAt: number }
  >();
  private readonly inFlight = new Map<string, Promise<boolean | undefined>>();

  constructor(private readonly options: BotPermissionCacheOptions) {}

  /**
   * Devuelve el permiso cacheado (true/false) o ejecuta `resolve` UNA vez. Un
   * `undefined` (unknown/transitorio) no se cachea. `resolve` debe devolver
   * `boolean | undefined` y no lanzar (el llamante traduce fallos a undefined).
   */
  async get(
    key: string,
    nowMs: number,
    resolve: () => Promise<boolean | undefined>,
  ): Promise<boolean | undefined> {
    const cached = this.entries.get(key);
    if (cached !== undefined && cached.expiresAt > nowMs) {
      return cached.value;
    }
    const existing = this.inFlight.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const pending = (async (): Promise<boolean | undefined> => {
      try {
        const value = await resolve();
        if (value !== undefined) {
          this.set(key, value, nowMs);
        }
        return value;
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, pending);
    return pending;
  }

  /** Invalida una entrada (my_chat_member del bot, o un 400/403 al retirar). */
  invalidate(key: string): void {
    this.entries.delete(key);
  }

  size(): number {
    return this.entries.size;
  }

  private set(key: string, value: boolean, nowMs: number): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: nowMs + this.options.ttlMs });
    while (this.entries.size > this.options.maxKeys) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.entries.delete(oldest);
    }
  }
}

/**
 * Deteccion de configuracion huerfana y grupos abandonados. Cuando el bot es
 * expulsado o abandona un chat, su configuracion persistida queda "huerfana";
 * cuando un grupo lleva mucho sin actividad se considera abandonado. Todo es
 * logica pura: recibe inputs planos y `nowMs`, no hace I/O ni consulta relojes.
 */

/** Registro plano de config por chat: incluye si el bot sigue en ese chat. */
export interface OrphanConfigEntry {
  readonly chatId: string;
  readonly botInChat: boolean;
}

/** Metricas planas de un grupo para juzgar si esta abandonado. */
export interface OrphanGroupStats {
  readonly lastActivityMs: number;
  readonly members: number;
}

/**
 * Devuelve los chatId cuya config esta huerfana: entradas donde el bot ya no
 * esta en el chat (`botInChat === false`). Preserva el orden de entrada y
 * elimina chatId duplicados quedandose con la primera aparicion. Pura y
 * determinista.
 */
export const findOrphanConfigs = (
  configs: readonly OrphanConfigEntry[],
): readonly string[] => {
  const seen = new Set<string>();
  const orphans: string[] = [];

  for (const entry of configs) {
    if (entry.botInChat) {
      continue;
    }
    if (seen.has(entry.chatId)) {
      continue;
    }
    seen.add(entry.chatId);
    orphans.push(entry.chatId);
  }

  return orphans;
};

/**
 * True cuando el grupo se considera abandonado: no ha tenido actividad en al
 * menos `idleMs` (es decir `nowMs - lastActivityMs >= idleMs`). Un grupo sin
 * miembros (`members <= 0`) se considera abandonado de inmediato. Un `idleMs`
 * no positivo hace que cualquier grupo con actividad no futura cuente como
 * abandonado. La actividad en el futuro (`lastActivityMs > nowMs`) nunca marca
 * abandono salvo que no queden miembros. Pura y determinista.
 */
export const isAbandonedGroup = (
  stats: OrphanGroupStats,
  nowMs: number,
  idleMs: number,
): boolean => {
  if (stats.members <= 0) {
    return true;
  }

  const idleFor = nowMs - stats.lastActivityMs;
  if (idleFor < 0) {
    return false;
  }

  return idleFor >= idleMs;
};

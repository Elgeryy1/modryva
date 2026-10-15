/**
 * Anti-spam de reapelaciones: impone un periodo minimo (cooldown) entre dos
 * intentos consecutivos de apelar una sancion. Logica pura y determinista: el
 * llamante aporta los timestamps (epoch ms) y la duracion del cooldown, de modo
 * que este modulo no toca reloj, red ni almacenamiento.
 */

/** Cooldown por defecto entre reapelaciones: 24 horas en milisegundos. */
export const REAPPEAL_DEFAULT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Resultado de evaluar si una reapelacion esta permitida. `allowed` es true
 * cuando ya paso el cooldown; en ese caso `waitMs` es 0. Cuando `allowed` es
 * false, `waitMs` (> 0) indica los milisegundos que faltan para poder reapelar.
 */
export interface ReappealDecision {
  readonly allowed: boolean;
  readonly waitMs: number;
}

/**
 * Normaliza una duracion de cooldown: valores negativos, NaN o no finitos se
 * tratan como 0 (sin cooldown). El resultado se trunca a entero.
 */
const normalizeCooldown = (cooldownMs: number): number => {
  if (!Number.isFinite(cooldownMs) || cooldownMs <= 0) {
    return 0;
  }
  return Math.floor(cooldownMs);
};

/**
 * Decide si un usuario puede volver a apelar. Dado el instante de la ultima
 * apelacion (`lastAppealMs`), el instante actual (`nowMs`) y la duracion del
 * cooldown (`cooldownMs`), calcula el tiempo transcurrido y compara contra el
 * cooldown.
 *
 * Reglas:
 * - Si transcurrido >= cooldown: `{ allowed: true, waitMs: 0 }`.
 * - Si transcurrido < cooldown: `{ allowed: false, waitMs: restante }` donde
 *   `restante = cooldown - transcurrido`.
 * - `cooldownMs <= 0` (o no finito) desactiva el limite: siempre permitido.
 * - Desfase de reloj: si `lastAppealMs` esta en el futuro (transcurrido < 0),
 *   `waitMs` se limita como maximo al cooldown completo, nunca lo supera.
 * - `waitMs` nunca es negativo y se devuelve como entero.
 *
 * Pura y determinista: mismos argumentos, mismo resultado.
 */
export const canReappeal = (
  lastAppealMs: number,
  nowMs: number,
  cooldownMs: number,
): ReappealDecision => {
  const cooldown = normalizeCooldown(cooldownMs);

  if (cooldown === 0) {
    return { allowed: true, waitMs: 0 };
  }

  const elapsed = nowMs - lastAppealMs;
  const remaining = cooldown - elapsed;

  if (remaining <= 0) {
    return { allowed: true, waitMs: 0 };
  }

  // Limita el desfase de reloj: el tiempo de espera nunca supera el cooldown.
  const waitMs = Math.floor(Math.min(remaining, cooldown));
  return { allowed: false, waitMs };
};

/**
 * Calcula el instante (epoch ms) a partir del cual se podra reapelar de nuevo,
 * es decir `lastAppealMs + cooldown`. Con cooldown desactivado devuelve
 * `lastAppealMs`. Pura y determinista.
 */
export const reappealNextAllowedMs = (
  lastAppealMs: number,
  cooldownMs: number,
): number => lastAppealMs + normalizeCooldown(cooldownMs);

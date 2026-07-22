/**
 * Misiones de limpieza + jefe de spam ficticio. Sistema de gamificacion puro
 * para premiar a los moderadores que confirman reportes, aprueban cuarentenas y
 * aciertan en la blocklist, y para dar vida a un "jefe" de spam comunitario al
 * que el grupo va restando vida entre todos. Sin I/O, sin red, sin Date.now():
 * cada funcion recibe inputs planos y devuelve valores deterministas.
 */

/** Accion de limpieza que otorga puntos al moderador. */
export type CleanupAction =
  | "report-confirmed"
  | "quarantine-approved"
  | "blocklist-hit";

/** Recompensa calculada para una accion de limpieza. */
export interface CleanupReward {
  readonly points: number;
  readonly badgeUnlocked?: string;
}

/** Resultado de aplicar dano al jefe de spam ficticio. */
export interface CleanupBossDamageResult {
  readonly hp: number;
  readonly defeated: boolean;
}

/** Puntos base por cada tipo de accion, antes del bonus por racha. */
export const CLEANUP_ACTION_POINTS: Readonly<Record<CleanupAction, number>> = {
  "report-confirmed": 10,
  "quarantine-approved": 25,
  "blocklist-hit": 15,
};

/** Tope de dias de racha que suman bonus; mas alla de esto no crece. */
export const CLEANUP_STREAK_CAP = 7;

/** Puntos extra por cada dia de racha (hasta CLEANUP_STREAK_CAP). */
export const CLEANUP_STREAK_BONUS = 2;

/** Vida maxima del jefe de spam ficticio. */
export const CLEANUP_BOSS_MAX_HP = 500;

/** Dano por reporte confirmado cuando no se indica otro valor. */
export const CLEANUP_BOSS_DEFAULT_DAMAGE = 5;

/**
 * Insignias por racha, de mayor a menor exigencia. Se devuelve la primera cuyo
 * umbral alcanza `streakDays`. El orden descendente garantiza que se entregue la
 * insignia mas alta lograda.
 */
const CLEANUP_BADGES: readonly {
  readonly minStreak: number;
  readonly badge: string;
}[] = [
  { minStreak: 30, badge: "leyenda-antispam" },
  { minStreak: 7, badge: "centinela-semanal" },
  { minStreak: 3, badge: "escoba-de-bronce" },
];

/** Recorta un entero al rango [0, max], tratando negativos y NaN como 0. */
const clampNonNegative = (value: number, max: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  const floored = Math.floor(value);
  return floored > max ? max : floored;
};

/**
 * Calcula los puntos de una accion de limpieza y, si corresponde, la insignia
 * desbloqueada por la racha. Los puntos son `base + min(racha, tope) * bonus`.
 * Rachas negativas o no finitas cuentan como 0. `badgeUnlocked` se omite cuando
 * la racha no alcanza ningun umbral. Puro y determinista.
 */
export const computeCleanupReward = (
  action: CleanupAction,
  streakDays: number,
): CleanupReward => {
  const base = CLEANUP_ACTION_POINTS[action];
  const streak = clampNonNegative(streakDays, CLEANUP_STREAK_CAP);
  const points = base + streak * CLEANUP_STREAK_BONUS;

  const effectiveStreak =
    Number.isFinite(streakDays) && streakDays > 0 ? Math.floor(streakDays) : 0;
  const badge = CLEANUP_BADGES.find(
    (entry) => effectiveStreak >= entry.minStreak,
  )?.badge;

  return badge ? { points, badgeUnlocked: badge } : { points };
};

/**
 * Aplica el dano de `confirmedReports` reportes al jefe de spam. Cada reporte
 * resta `perReport` (por defecto CLEANUP_BOSS_DEFAULT_DAMAGE). La vida nunca baja
 * de 0 y `defeated` es true cuando llega a 0. Reportes negativos o no finitos no
 * hacen dano; `perReport` no finito o negativo se ignora (dano 0). Puro y
 * determinista.
 */
export const applyBossDamage = (
  bossHp: number,
  confirmedReports: number,
  perReport: number = CLEANUP_BOSS_DEFAULT_DAMAGE,
): CleanupBossDamageResult => {
  const startHp =
    Number.isFinite(bossHp) && bossHp > 0 ? Math.floor(bossHp) : 0;
  const reports =
    Number.isFinite(confirmedReports) && confirmedReports > 0
      ? Math.floor(confirmedReports)
      : 0;
  const damagePer =
    Number.isFinite(perReport) && perReport > 0 ? Math.floor(perReport) : 0;

  const damage = reports * damagePer;
  const hp = damage >= startHp ? 0 : startHp - damage;

  return { hp, defeated: hp <= 0 };
};

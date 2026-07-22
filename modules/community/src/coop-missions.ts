/**
 * Misiones cooperativas de grupo + rachas diarias. Logica pura y
 * determinista: recibe estados planos y deltas, devuelve valores nuevos sin
 * mutar la entrada. Sin I/O, sin Prisma, sin red, sin Date.now()/Math.random().
 * Ideas del banco 104/105/108.
 */

/**
 * Una mision cooperativa del grupo. `goal` es el objetivo total de la mision y
 * `progress` el avance acumulado. El progreso se mantiene siempre dentro de
 * `[0, goal]` por las funciones de este modulo.
 */
export interface CoopMission {
  readonly goal: number;
  readonly progress: number;
}

/** Resultado de aplicar avance a una mision. */
export interface CoopMissionProgressResult {
  readonly mission: CoopMission;
  /**
   * True solo cuando esta llamada completa la mision (antes estaba incompleta y
   * ahora alcanza el objetivo). Aplicar mas avance a una mision ya completa
   * devuelve false.
   */
  readonly completed: boolean;
}

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

/** True cuando la mision alcanzo o supero su objetivo. Objetivo <= 0 ya esta cumplido. */
export const coopMissionIsComplete = (mission: CoopMission): boolean => {
  if (mission.goal <= 0) {
    return true;
  }
  return mission.progress >= mission.goal;
};

/**
 * Avance restante hasta el objetivo, nunca negativo. Devuelve 0 cuando la
 * mision ya esta completa o el objetivo es <= 0.
 */
export const coopMissionRemaining = (mission: CoopMission): number => {
  if (mission.goal <= 0) {
    return 0;
  }
  const remaining = mission.goal - mission.progress;
  return remaining > 0 ? remaining : 0;
};

/**
 * Porcentaje de avance (entero 0..100) de la mision. Redondea al entero mas
 * cercano y satura en 0..100. Un objetivo <= 0 se considera completo (100).
 */
export const missionPercent = (mission: CoopMission): number => {
  if (mission.goal <= 0) {
    return 100;
  }
  const raw = (mission.progress / mission.goal) * 100;
  return clamp(Math.round(raw), 0, 100);
};

/**
 * Aplica `delta` al avance de la mision (positivo suma, negativo revierte). El
 * progreso resultante se satura dentro de `[0, goal]`, por lo que nunca excede
 * el objetivo ni baja de cero. `completed` es true solo si esta llamada cruza
 * el umbral del objetivo. No muta la mision de entrada.
 */
export const addMissionProgress = (
  mission: CoopMission,
  delta: number,
): CoopMissionProgressResult => {
  const goal = mission.goal;
  const before = clamp(mission.progress, 0, goal > 0 ? goal : 0);
  const wasComplete = coopMissionIsComplete(mission);

  const nextProgress = clamp(before + delta, 0, goal > 0 ? goal : 0);
  const nextMission: CoopMission = { goal, progress: nextProgress };
  const isComplete = coopMissionIsComplete(nextMission);

  return {
    mission: nextMission,
    completed: !wasComplete && isComplete,
  };
};

/**
 * Bonus de racha por dias consecutivos, saturado por `cap`. Crece 1 por dia
 * hasta el tope. Dias <= 0 o cap <= 0 dan 0. Ambos parametros se truncan a
 * entero, de modo que valores fraccionarios no inflan el bonus.
 */
export const streakBonus = (consecutiveDays: number, cap: number): number => {
  const days = Math.floor(consecutiveDays);
  const limit = Math.floor(cap);
  if (Number.isNaN(days) || days <= 0) {
    return 0;
  }
  if (Number.isNaN(limit) || limit <= 0) {
    return 0;
  }
  return days < limit ? days : limit;
};

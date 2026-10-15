/**
 * Racha de dias seguidos jugando. Logica pura: recibe las claves de dia en las
 * que el usuario jugo (dayKey enteros) y la clave de hoy, y devuelve cuantos
 * dias consecutivos lleva. La racha sigue viva si jugo hoy O ayer (aun no ha
 * jugado hoy pero no la ha roto); se rompe si el ultimo dia jugado es anterior
 * a ayer. Determinista, sin Date.now().
 */
export const computeStreak = (
  dayKeys: readonly number[],
  todayKey: number,
): number => {
  const played = new Set<number>();
  for (const key of dayKeys) {
    if (Number.isFinite(key)) {
      played.add(Math.trunc(key));
    }
  }
  const today = Number.isFinite(todayKey) ? Math.trunc(todayKey) : 0;

  let anchor: number;
  if (played.has(today)) {
    anchor = today;
  } else if (played.has(today - 1)) {
    anchor = today - 1;
  } else {
    return 0;
  }

  let streak = 0;
  let day = anchor;
  while (played.has(day)) {
    streak += 1;
    day -= 1;
  }
  return streak;
};

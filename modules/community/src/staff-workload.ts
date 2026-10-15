/**
 * Carga de trabajo del staff: mide cuanto esta trabajando cada admin para poder
 * repartir el esfuerzo y sugerir descansos. Logica pura: recibe datos planos y
 * no toca red, Prisma ni el reloj. Un "conflicto" (accion revertida, choque con
 * otro admin, sancion apelada) pesa mas que una accion normal porque desgasta
 * mas, de ahi el multiplicador.
 */

/** Metrica cruda de un admin en la ventana observada. */
export interface AdminLoad {
  readonly adminId: string;
  readonly actions: number;
  readonly conflicts: number;
}

/** Fila puntuada del ranking de carga. */
export interface StaffWorkloadEntry {
  readonly adminId: string;
  readonly load: number;
}

/**
 * Peso de un conflicto frente a una accion normal al calcular la carga. Un
 * conflicto cuenta como STAFF_CONFLICT_WEIGHT acciones.
 */
export const STAFF_CONFLICT_WEIGHT = 3;

/**
 * Puntua la carga de un admin combinando acciones y conflictos ponderados.
 * Valores negativos se tratan como 0 para que datos sucios no bajen artificial-
 * mente la puntuacion. Pura y determinista.
 */
export const computeStaffLoad = (load: AdminLoad): number => {
  const actions = load.actions > 0 ? load.actions : 0;
  const conflicts = load.conflicts > 0 ? load.conflicts : 0;
  return actions + conflicts * STAFF_CONFLICT_WEIGHT;
};

/**
 * Ordena a los admins de mayor a menor carga (orden estable: los empates
 * conservan el orden de entrada). No muta el array recibido. Pura y
 * determinista.
 */
export const rankStaffWorkload = (
  loads: readonly AdminLoad[],
): readonly StaffWorkloadEntry[] => {
  const entries: StaffWorkloadEntry[] = loads.map((load) => ({
    adminId: load.adminId,
    load: computeStaffLoad(load),
  }));

  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) =>
      b.entry.load !== a.entry.load
        ? b.entry.load - a.entry.load
        : a.index - b.index,
    )
    .map(({ entry }) => entry);
};

/**
 * Devuelve los adminId cuya carga supera estrictamente el umbral, para
 * sugerirles un descanso. Conserva el orden de entrada y no repite ids aunque
 * aparezcan duplicados. Pura y determinista.
 */
export const detectOverloadedStaff = (
  loads: readonly AdminLoad[],
  threshold: number,
): readonly string[] => {
  const overloaded: string[] = [];
  const seen = new Set<string>();

  for (const load of loads) {
    if (computeStaffLoad(load) > threshold && !seen.has(load.adminId)) {
      seen.add(load.adminId);
      overloaded.push(load.adminId);
    }
  }

  return overloaded;
};

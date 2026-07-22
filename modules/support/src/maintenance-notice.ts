/**
 * Input for a scheduled-maintenance notice: the start timestamp, its duration
 * in minutes, and the current time (all in ms epoch). Pure and deterministic.
 */
export interface MaintenanceNoticeInput {
  readonly startMs: number;
  readonly durationMin: number;
  readonly nowMs: number;
}

/** The phase of a maintenance window relative to now. */
export type MaintenancePhase = "proximo" | "en_curso" | "finalizado";

/**
 * A maintenance notice: the phase and a user-facing Spanish message.
 * Pure and deterministic.
 */
export interface MaintenanceNotice {
  readonly phase: MaintenancePhase;
  readonly message: string;
}

/**
 * Builds a maintenance notice from the window and the current time. Before the
 * start it is "proximo"; within [start, start+duration) it is "en_curso"; at or
 * after the end it is "finalizado". The message is user-facing Spanish.
 * Pure and deterministic.
 */
export const buildMaintenanceNotice = (
  input: MaintenanceNoticeInput,
): MaintenanceNotice => {
  const endMs = input.startMs + input.durationMin * 60000;
  if (input.nowMs < input.startMs) {
    return {
      phase: "proximo",
      message:
        "🛠️ Mantenimiento programado próximamente. Puede haber cortes breves.",
    };
  }
  if (input.nowMs < endMs) {
    return {
      phase: "en_curso",
      message: "🛠️ Mantenimiento en curso. Gracias por tu paciencia.",
    };
  }
  return {
    phase: "finalizado",
    message:
      "✅ Mantenimiento finalizado. Todo debería funcionar con normalidad.",
  };
};

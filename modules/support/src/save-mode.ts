/**
 * Input for the save-mode decision: how many AI calls have been made today
 * and the configured daily budget of AI calls.
 */
export interface SaveModeInput {
  /** AI calls already spent today. Negative values are treated as 0. */
  readonly aiCallsToday: number;
  /** Daily budget of AI calls. Values <= 0 mean "no budget configured". */
  readonly budget: number;
}

/**
 * Tuning knobs for the save-mode decision.
 */
export interface SaveModeTuning {
  /**
   * Used-ratio threshold (0..1) at or above which save mode turns on.
   * Defaults to 0.8 when omitted.
   */
  readonly warnRatio?: number;
}

/**
 * Result of evaluating whether the bot should enter save mode to reduce AI
 * calls and non-critical work.
 */
export interface SaveModeDecision {
  /** True when non-critical work and AI calls should be throttled. */
  readonly saveMode: boolean;
  /** aiCallsToday / budget rounded to 2 decimals; 0 when there is no budget. */
  readonly usedRatio: number;
  /** User-facing Spanish advice describing the current mode. */
  readonly advice: string;
}

const DEFAULT_WARN_RATIO = 0.8;

const roundTo2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Decides whether the bot should enter "save mode" (reduce AI calls and
 * non-critical jobs) based on today's AI usage versus the daily budget.
 *
 * usedRatio is aiCallsToday / budget rounded to 2 decimals. Save mode turns on
 * when usedRatio is greater than or equal to warnRatio (default 0.8). When the
 * budget is <= 0 it is treated as "no budget configured": usedRatio is 0 and
 * save mode is enabled as a precaution. Negative call counts are clamped to 0.
 * Pure and deterministic.
 */
export const decideSaveMode = (
  input: SaveModeInput,
  options?: SaveModeTuning,
): SaveModeDecision => {
  const warnRatio = options?.warnRatio ?? DEFAULT_WARN_RATIO;
  const calls = Math.max(0, input.aiCallsToday);
  const budget = input.budget;

  if (budget <= 0) {
    return {
      saveMode: true,
      usedRatio: 0,
      advice:
        "⚠️ Sin presupuesto de IA configurado. Modo ahorro activado por precaución.",
    };
  }

  const usedRatio = roundTo2(calls / budget);
  const saveMode = usedRatio >= warnRatio;

  if (usedRatio >= 1) {
    return {
      saveMode: true,
      usedRatio,
      advice:
        "🔴 Presupuesto de IA agotado. Modo ahorro activado: se pausan las tareas no críticas.",
    };
  }

  if (saveMode) {
    return {
      saveMode: true,
      usedRatio,
      advice:
        "🟠 Consumo de IA alto. Modo ahorro activado para reducir llamadas y trabajos no críticos.",
    };
  }

  return {
    saveMode: false,
    usedRatio,
    advice: "🟢 Consumo de IA bajo control. Modo normal activo.",
  };
};

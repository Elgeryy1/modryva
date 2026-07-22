/**
 * Justicia restaurativa: convierte una sancion temporal (mute/restriccion) en
 * una accion positiva que reduce el tiempo restante. La idea es dar una salida
 * educativa a las faltas menores en vez de castigar sin mas. Logica pura: no
 * hace I/O ni conoce el reloj; recibe inputs planos y devuelve valores.
 */

/**
 * Catalogo de tareas restaurativas disponibles, de menor a mayor esfuerzo.
 * Solo lectura para que ningun consumidor mute la lista compartida.
 */
export const RESTORATIVE_TASKS = [
  "leer-reglas",
  "disculpa-publica",
  "ayudar-a-otro",
] as const;

/** Una de las tareas restaurativas del catalogo. */
export type RestorativeTask = (typeof RESTORATIVE_TASKS)[number];

/** Gravedad de la falta cometida. Solo las no graves son restaurables. */
export type RestorativeOffense = "leve" | "media" | "grave";

/**
 * Resultado de proponer una restauracion. Cuando `eligible` es false la falta
 * es demasiado grave y no se incluyen `task` ni `reduceMsBy` (props opcionales
 * omitidas, nunca asignadas a undefined).
 */
export interface RestorativeProposal {
  readonly eligible: boolean;
  readonly task?: RestorativeTask;
  readonly reduceMsBy?: number;
}

const MINUTE_MS = 60_000;

/**
 * Reduccion de tiempo (ms) y tarea sugerida por cada gravedad restaurable.
 * A mayor gravedad, mayor esfuerzo exigido y menor descuento otorgado.
 */
const RESTORATIVE_PLAN: Readonly<
  Record<
    "leve" | "media",
    { readonly task: RestorativeTask; readonly reduceMsBy: number }
  >
> = {
  leve: { task: "leer-reglas", reduceMsBy: 30 * MINUTE_MS },
  media: { task: "disculpa-publica", reduceMsBy: 15 * MINUTE_MS },
};

/**
 * Propone una restauracion segun la gravedad de la falta. Las faltas "leve" y
 * "media" son elegibles y devuelven su tarea y descuento; la falta "grave" no
 * es restaurable y devuelve `{ eligible: false }` sin mas campos. Puro y
 * determinista.
 */
export const proposeRestoration = (
  offense: RestorativeOffense,
): RestorativeProposal => {
  if (offense === "grave") {
    return { eligible: false };
  }

  const plan = RESTORATIVE_PLAN[offense];
  return { eligible: true, task: plan.task, reduceMsBy: plan.reduceMsBy };
};

/**
 * Aplica la reduccion al tiempo restante de la sancion y devuelve el nuevo
 * tiempo restante en ms, nunca negativo. Un `reduceMsBy` negativo o un
 * `remainingMs` negativo se tratan como cero. Puro y determinista.
 */
export const applyRestoration = (
  remainingMs: number,
  reduceMsBy: number,
): number => {
  const safeRemaining = remainingMs > 0 ? remainingMs : 0;
  const safeReduce = reduceMsBy > 0 ? reduceMsBy : 0;
  const next = safeRemaining - safeReduce;
  return next > 0 ? next : 0;
};

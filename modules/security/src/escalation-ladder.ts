/**
 * Sancion escalonada automatica para reincidentes. Cada infraccion previa sube
 * un peldano en la escalera aviso -> mute (temporal) -> ban. La primera vez es
 * solo un aviso, la segunda un mute temporal, la tercera y siguientes un ban.
 * Logica pura: sin I/O, sin reloj ni azar; el llamante pasa el numero de
 * infracciones previas y recibe la accion determinista.
 */

/** Acciones posibles de la escalera, de menor a mayor severidad. */
export type EscalationAction = "aviso" | "mute" | "ban";

/**
 * Un peldano de la escalera. `durationMs` solo aparece cuando la sancion es
 * temporal (mute); aviso y ban no lo llevan (exactOptionalPropertyTypes: la
 * prop se omite en vez de asignar undefined).
 */
export interface EscalationStep {
  readonly action: EscalationAction;
  readonly durationMs?: number;
}

const MINUTE_MS = 60_000;

/**
 * Escalera por defecto, editable copiandola. Indice 0 = primera infraccion.
 * A partir del ultimo peldano se mantiene el ban de forma indefinida.
 */
export const ESCALATION_LADDER: readonly EscalationStep[] = [
  { action: "aviso" },
  { action: "mute", durationMs: 60 * MINUTE_MS },
  { action: "ban" },
];

/**
 * Devuelve el peldano que corresponde tras `priorOffenses` infracciones ya
 * registradas (0 = es la primera vez, aun sin sanciones previas). Valores
 * negativos o no enteros se tratan como 0. Si el indice supera la escalera se
 * devuelve el ultimo peldano (ban permanente). Puro y determinista.
 */
export const nextEscalation = (priorOffenses: number): EscalationStep => {
  const lastIndex = ESCALATION_LADDER.length - 1;

  const index = Number.isNaN(priorOffenses)
    ? 0
    : priorOffenses <= 0
      ? 0
      : priorOffenses >= lastIndex
        ? lastIndex
        : Math.floor(priorOffenses);

  const step = ESCALATION_LADDER[index] ?? { action: "ban" };

  return step.durationMs !== undefined
    ? { action: step.action, durationMs: step.durationMs }
    : { action: step.action };
};

/**
 * Texto en espanol-neutro (sin acentos) que describe una accion de la escalera,
 * apto para logs o avisos al usuario. Una accion desconocida devuelve un texto
 * generico en vez de fallar. Puro y determinista.
 */
export const describeEscalation = (action: string): string => {
  switch (action) {
    case "aviso":
      return "Aviso: primera infraccion, sin sancion.";
    case "mute":
      return "Silenciado temporalmente por reincidencia.";
    case "ban":
      return "Expulsado por reincidencia repetida.";
    default:
      return "Accion de escalada desconocida.";
  }
};

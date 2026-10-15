/**
 * Possible states of an asynchronous mediation case. Each party writes its own
 * version privately and staff reviews without a public argument.
 * Pure and deterministic.
 */
export type MediationState =
  | "abierta"
  | "esperando_a"
  | "esperando_b"
  | "lista_revision"
  | "cerrada";

/**
 * Events that can drive a mediation case forward.
 * Pure and deterministic.
 */
export type MediationEvent = "version_a" | "version_b" | "revisar" | "cerrar";

/**
 * Result of advancing a mediation case: the resulting state and whether the
 * event actually caused a transition.
 * Pure and deterministic.
 */
export interface MediationStepResult {
  readonly next: MediationState;
  readonly changed: boolean;
}

/**
 * Full transition table. A missing entry means the event is invalid for that
 * state and leaves the case untouched. Both versions must arrive before a case
 * can reach "lista_revision", and only "revisar" or "cerrar" can close it.
 */
const MEDIATION_TRANSITIONS: Readonly<
  Record<
    MediationState,
    Readonly<Partial<Record<MediationEvent, MediationState>>>
  >
> = {
  abierta: {
    version_a: "esperando_b",
    version_b: "esperando_a",
    cerrar: "cerrada",
  },
  esperando_a: {
    version_a: "lista_revision",
    cerrar: "cerrada",
  },
  esperando_b: {
    version_b: "lista_revision",
    cerrar: "cerrada",
  },
  lista_revision: {
    revisar: "cerrada",
    cerrar: "cerrada",
  },
  cerrada: {},
};

/**
 * Advances a mediation case by applying an event to the current state.
 * Invalid or redundant events keep the case in its current state with
 * changed === false. Never throws.
 * Pure and deterministic.
 */
export const nextMediationStep = (
  current: MediationState,
  event: MediationEvent,
): MediationStepResult => {
  const target = MEDIATION_TRANSITIONS[current][event];
  const next = target ?? current;
  return { next, changed: next !== current };
};

/**
 * Spanish label describing a mediation state, suitable for showing to staff or
 * the involved parties in Telegram.
 * Pure and deterministic.
 */
export const mediationStateLabel = (state: MediationState): string => {
  switch (state) {
    case "abierta":
      return "🆕 Mediación abierta, esperando versiones";
    case "esperando_a":
      return "⏳ Esperando la versión de la parte A";
    case "esperando_b":
      return "⏳ Esperando la versión de la parte B";
    case "lista_revision":
      return "🔎 Lista para la revisión del staff";
    case "cerrada":
      return "✅ Mediación cerrada";
  }
};

/**
 * A requested action plus whether it was confirmed and how long the staff
 * waited before executing it. Pure and deterministic.
 */
export interface ImpulsiveActionInput {
  readonly action: string;
  readonly confirmed: boolean;
  readonly waitedMs: number;
}

/** Options for guardImpulsiveAction. */
export interface ImpulsiveGuardOptions {
  readonly minWaitMs?: number;
}

/**
 * Whether the action may proceed, with a user-facing Spanish reason.
 * Pure and deterministic.
 */
export interface ImpulsiveGuardResult {
  readonly allowed: boolean;
  readonly reason: string;
}

const DESTRUCTIVE_ACTIONS: ReadonlySet<string> = new Set([
  "global_ban",
  "purge",
  "delete_all",
  "mass_ban",
]);

const DEFAULT_MIN_WAIT_MS = 10000;

/**
 * Guards against impulsive destructive actions (global ban, purge, mass ban).
 * Such actions require an explicit confirmation and a minimum wait (default 10s)
 * before running; anything else is allowed immediately. Reasons are user-facing
 * Spanish. Pure and deterministic.
 */
export const guardImpulsiveAction = (
  input: ImpulsiveActionInput,
  options?: ImpulsiveGuardOptions,
): ImpulsiveGuardResult => {
  const minWaitMs = options?.minWaitMs ?? DEFAULT_MIN_WAIT_MS;
  const action = input.action.trim().toLowerCase();
  if (!DESTRUCTIVE_ACTIONS.has(action)) {
    return { allowed: true, reason: "Acción no destructiva: permitida." };
  }
  if (!input.confirmed) {
    return {
      allowed: false,
      reason: "Confirma la acción destructiva antes de ejecutarla.",
    };
  }
  if (input.waitedMs < minWaitMs) {
    return {
      allowed: false,
      reason: "Espera unos segundos antes de una acción destructiva.",
    };
  }
  return {
    allowed: true,
    reason: "Acción destructiva confirmada y con espera: permitida.",
  };
};

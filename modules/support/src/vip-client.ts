/** Supported support-plan tiers for a client. Pure and deterministic. */
export type VipClientPlan = "free" | "pro" | "vip";

/** Input describing a client's plan and their base SLA in minutes. Pure and deterministic. */
export interface VipTreatmentInput {
  readonly plan: VipClientPlan;
  readonly baseMinutes: number;
}

/** Result of applying VIP treatment: whether the client is VIP and their effective SLA. Pure and deterministic. */
export interface VipTreatmentResult {
  readonly vip: boolean;
  readonly slaMinutes: number;
}

/**
 * Normalizes a base-minutes value to a non-negative safe integer,
 * mapping non-finite or negative inputs to zero. Internal helper.
 */
const sanitizeMinutes = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.round(value);
};

/**
 * Applies VIP client treatment to an SLA. A client is VIP only when the plan
 * is "vip", in which case the base SLA in minutes is halved and rounded
 * (never below zero). Non-VIP plans keep their sanitized base SLA unchanged.
 * Pure and deterministic.
 */
export const applyVipTreatment = (
  input: VipTreatmentInput,
): VipTreatmentResult => {
  const base = sanitizeMinutes(input.baseMinutes);
  const vip = input.plan === "vip";
  const slaMinutes = vip ? Math.round(base / 2) : base;
  return { vip, slaMinutes };
};

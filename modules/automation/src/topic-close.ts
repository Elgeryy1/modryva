/**
 * Input describing the current activity of a forum topic (thread):
 * its heat score and how many messages per minute it is receiving.
 * Pure and deterministic.
 */
export interface TopicCloseInput {
  readonly heat: number;
  readonly messagesPerMin: number;
}

/**
 * Optional thresholds that decide when a topic is considered out of control.
 * Both are inclusive lower bounds. Pure and deterministic.
 */
export interface TopicCloseOptions {
  readonly heatThreshold?: number;
  readonly rateThreshold?: number;
}

/**
 * Decision about temporarily closing a forum topic, with a user-facing
 * Spanish reason explaining the outcome. Pure and deterministic.
 */
export interface TopicCloseDecision {
  readonly close: boolean;
  readonly reason: string;
}

const DEFAULT_HEAT_THRESHOLD = 8;
const DEFAULT_RATE_THRESHOLD = 30;

/**
 * Decides whether a forum topic should be temporarily closed because it is
 * running out of control. Closes when the heat score reaches heatThreshold
 * (default 8) OR the message rate reaches rateThreshold (default 30). The
 * returned reason is a user-facing Spanish message. Pure and deterministic.
 */
export const shouldCloseTopic = (
  input: TopicCloseInput,
  options?: TopicCloseOptions,
): TopicCloseDecision => {
  const heatThreshold = options?.heatThreshold ?? DEFAULT_HEAT_THRESHOLD;
  const rateThreshold = options?.rateThreshold ?? DEFAULT_RATE_THRESHOLD;

  const heatHit = input.heat >= heatThreshold;
  const rateHit = input.messagesPerMin >= rateThreshold;

  if (heatHit && rateHit) {
    return {
      close: true,
      reason:
        "🔒 El hilo se descontroló: temperatura y ritmo de mensajes superan el límite. Se cierra temporalmente.",
    };
  }
  if (heatHit) {
    return {
      close: true,
      reason: "🔒 El hilo está demasiado caldeado. Se cierra temporalmente.",
    };
  }
  if (rateHit) {
    return {
      close: true,
      reason:
        "🔒 El hilo recibe demasiados mensajes por minuto. Se cierra temporalmente.",
    };
  }
  return {
    close: false,
    reason: "✅ El hilo está tranquilo; no hace falta cerrarlo.",
  };
};

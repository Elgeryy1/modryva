/**
 * Puerta para el primer mensaje con media de usuarios nuevos. Los usuarios
 * recien llegados (pocos mensajes y poca antiguedad) que adjuntan media suelen
 * ser cuentas de spam/estafa que sueltan una imagen o video con enlace antes de
 * ganarse confianza. Este modulo decide si ese primer envio con media debe
 * pasar por cuarentena/revision. Logica pura y determinista: recibe datos
 * planos, sin I/O ni relojes.
 */

/** Umbral por defecto de mensajes bajo el cual una cuenta se considera nueva. */
export const NEW_MEDIA_GATE_DEFAULT_MAX_MESSAGES = 3;

/** Umbral por defecto de antiguedad (dias) bajo el cual una cuenta es nueva. */
export const NEW_MEDIA_GATE_DEFAULT_MAX_AGE_DAYS = 1;

/** Perfil minimo del usuario necesario para evaluar la puerta. */
export interface NewMediaGateUser {
  /** Numero de mensajes previos del usuario en el grupo (>= 0). */
  readonly messageCount: number;
  /** Antiguedad de la cuenta/miembro en dias (>= 0). */
  readonly ageDays: number;
}

/** Opciones de configuracion de los umbrales de "usuario nuevo". */
export interface NewMediaGateOptions {
  /** Mensajes maximos para seguir considerando a la cuenta nueva. */
  readonly newMaxMessages?: number;
  /** Dias maximos de antiguedad para seguir considerando a la cuenta nueva. */
  readonly newMaxAgeDays?: number;
}

/** Resultado de la evaluacion de la puerta de media. */
export interface NewMediaGateDecision {
  /** True cuando el mensaje debe ir a cuarentena/revision. */
  readonly gate: boolean;
  /** Motivo legible del veredicto (español-neutro). */
  readonly reason: string;
}

const clampMin0 = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0;

/**
 * Decide si el primer mensaje con media de un usuario nuevo debe pasar por
 * cuarentena/revision. Se activa (`gate: true`) solo cuando el mensaje trae
 * media Y la cuenta es nueva segun ambos umbrales (mensajes por debajo del
 * limite y antiguedad por debajo del limite). Sin media, o con una cuenta ya
 * asentada, no se activa. Pura y determinista.
 */
export const shouldGateFirstMedia = (
  user: NewMediaGateUser,
  hasMedia: boolean,
  opts?: NewMediaGateOptions,
): NewMediaGateDecision => {
  const maxMessages =
    opts?.newMaxMessages !== undefined
      ? clampMin0(opts.newMaxMessages)
      : NEW_MEDIA_GATE_DEFAULT_MAX_MESSAGES;
  const maxAgeDays =
    opts?.newMaxAgeDays !== undefined
      ? clampMin0(opts.newMaxAgeDays)
      : NEW_MEDIA_GATE_DEFAULT_MAX_AGE_DAYS;

  if (!hasMedia) {
    return { gate: false, reason: "El mensaje no contiene media." };
  }

  const messageCount = clampMin0(user.messageCount);
  const ageDays = clampMin0(user.ageDays);

  const fewMessages = messageCount <= maxMessages;
  const youngAccount = ageDays <= maxAgeDays;

  if (fewMessages && youngAccount) {
    return {
      gate: true,
      reason: "Primer envío con media de un usuario nuevo: en revisión.",
    };
  }

  if (!fewMessages && !youngAccount) {
    return { gate: false, reason: "Usuario asentado: media permitida." };
  }

  if (!fewMessages) {
    return {
      gate: false,
      reason: "El usuario ya tiene mensajes suficientes: media permitida.",
    };
  }

  return {
    gate: false,
    reason: "La cuenta ya tiene antigüedad suficiente: media permitida.",
  };
};

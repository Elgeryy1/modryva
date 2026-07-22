/**
 * Pulso social del grupo: motor analitico puro que resume una ventana de
 * actividad (mensajes, borrados, casos de moderacion, usuarios unicos,
 * respuestas) en un estado cualitativo y una puntuacion de tension. No hace
 * I/O ni depende del reloj: recibe conteos planos por parametro y devuelve
 * valores. Igual patron que afk.ts / char-filters.ts.
 */

/** Ventana de actividad agregada de un grupo durante un intervalo. */
export interface PulseWindow {
  /** Mensajes totales observados en la ventana. */
  readonly messages: number;
  /** Mensajes borrados (por moderacion o filtros) en la ventana. */
  readonly deletions: number;
  /** Casos de moderacion abiertos (warns, mutes, bans) en la ventana. */
  readonly cases: number;
  /** Usuarios distintos que participaron en la ventana. */
  readonly uniqueUsers: number;
  /** Mensajes que eran respuestas a otros (proxy de conversacion). */
  readonly replies: number;
}

/** Estado cualitativo del grupo, de mas calmado a mas convulso. */
export type SocialPulseState =
  | "tranquilo"
  | "activo"
  | "saturado"
  | "tenso"
  | "caotico";

/** Resultado del calculo del pulso social. */
export interface SocialPulse {
  readonly state: SocialPulseState;
  /** Tension normalizada 0..1: fraccion de mensajes que degeneran. */
  readonly tensionScore: number;
  /** Etiqueta corta lista para mostrar, en espanol-neutro. */
  readonly label: string;
}

/** A partir de esta tension (0..1) la ventana se considera tensa. */
export const PULSE_TENSION_THRESHOLD = 0.25;

/** Mensajes en la ventana a partir de los cuales la actividad es alta. */
export const PULSE_ACTIVITY_HIGH = 50;

/** Mensajes en la ventana a partir de los cuales el grupo esta activo. */
export const PULSE_ACTIVITY_ACTIVE = 10;

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value > 1 ? 1 : value;
};

/** Redondea a 4 decimales de forma estable para mantener el determinismo. */
const roundTension = (value: number): number =>
  Math.round(value * 10_000) / 10_000;

/**
 * Tension normalizada (0..1) de una ventana: fraccion de mensajes que acaban
 * en borrado o caso de moderacion. Sin mensajes la tension es 0. Los conteos
 * negativos o no finitos se tratan como 0. Pura y determinista.
 */
export const computePulseTension = (window: PulseWindow): number => {
  const messages = Number.isFinite(window.messages) ? window.messages : 0;
  if (messages <= 0) {
    return 0;
  }
  const deletions = Math.max(0, window.deletions || 0);
  const cases = Math.max(0, window.cases || 0);
  return roundTension(clamp01((deletions + cases) / messages));
};

const buildLabel = (state: SocialPulseState, tensionScore: number): string => {
  const pct = Math.round(tensionScore * 100);
  switch (state) {
    case "caotico":
      return `🔥 Caotico (tension ${pct}%)`;
    case "tenso":
      return `⚠️ Tenso (tension ${pct}%)`;
    case "saturado":
      return `🌊 Saturado (tension ${pct}%)`;
    case "activo":
      return `💬 Activo (tension ${pct}%)`;
    default:
      return `🌿 Tranquilo (tension ${pct}%)`;
  }
};

/**
 * Calcula el pulso social de una ventana de actividad. La tension combina
 * borrados + casos relativos a los mensajes; la actividad se mide por el
 * numero de mensajes. Reglas (evaluadas en orden):
 *  - sin mensajes -> "tranquilo" (tension 0).
 *  - tension por ENCIMA del umbral + actividad alta -> "caotico".
 *  - tension alta (umbral inclusive) sin caos -> "tenso".
 *  - actividad alta (tension baja) -> "saturado".
 *  - actividad media -> "activo".
 *  - resto -> "tranquilo".
 * Pura y determinista: mismos conteos, mismo resultado.
 */
export const computeSocialPulse = (window: PulseWindow): SocialPulse => {
  const messages = Number.isFinite(window.messages)
    ? Math.max(0, window.messages)
    : 0;
  const tensionScore = computePulseTension(window);

  const highTension = tensionScore >= PULSE_TENSION_THRESHOLD;
  const extremeTension = tensionScore > PULSE_TENSION_THRESHOLD;
  const highActivity = messages >= PULSE_ACTIVITY_HIGH;
  const active = messages >= PULSE_ACTIVITY_ACTIVE;

  let state: SocialPulseState;
  if (messages === 0) {
    state = "tranquilo";
  } else if (extremeTension && highActivity) {
    state = "caotico";
  } else if (highTension) {
    state = "tenso";
  } else if (highActivity) {
    state = "saturado";
  } else if (active) {
    state = "activo";
  } else {
    state = "tranquilo";
  }

  return { state, tensionScore, label: buildLabel(state, tensionScore) };
};

/**
 * Devuelve una descripcion humana del estado del pulso, en espanol-neutro.
 * Para un estado desconocido devuelve un texto generico. Pura y determinista.
 */
export const describePulse = (state: string): string => {
  switch (state) {
    case "tranquilo":
      return "El grupo esta tranquilo: poca actividad y sin conflictos.";
    case "activo":
      return "El grupo esta activo: conversacion fluida y sana.";
    case "saturado":
      return "El grupo esta saturado: mucho volumen de mensajes, pero sin tension.";
    case "tenso":
      return "El grupo esta tenso: proporcion alta de borrados y sanciones.";
    case "caotico":
      return "El grupo esta caotico: mucha actividad y mucha tension a la vez.";
    default:
      return "Estado de pulso desconocido.";
  }
};

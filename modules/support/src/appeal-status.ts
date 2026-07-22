/**
 * Estado visible de una apelacion (appeal) con barra de progreso. Logica pura:
 * sin I/O, sin red, sin Date.now(); todos los timestamps entran por parametro
 * (createdMs, nowMs, etaMs) y las transiciones son deterministas. La maquina de
 * estados avanza con eventos planos ("assign" | "request-info" | "accept" |
 * "reject") y los estados finales (aceptada/rechazada) son idempotentes.
 */

/** Estados posibles de una apelacion, en orden de ciclo de vida. */
export const APPEAL_STATES = [
  "enviada",
  "en-revision",
  "mas-info",
  "aceptada",
  "rechazada",
] as const;

/** Union de los estados validos de una apelacion. */
export type AppealState = (typeof APPEAL_STATES)[number];

/** Eventos que hacen avanzar la maquina de estados de la apelacion. */
export type AppealEvent = "assign" | "request-info" | "accept" | "reject";

/** Ancho (en caracteres) de la barra visual de progreso. */
export const APPEAL_BAR_WIDTH = 8;

interface AppealStateMeta {
  readonly label: string;
  readonly emoji: string;
  readonly progress: number;
  readonly terminal: boolean;
}

const APPEAL_STATE_META: Readonly<Record<AppealState, AppealStateMeta>> = {
  enviada: { label: "Enviada", emoji: "📨", progress: 0.15, terminal: false },
  "en-revision": {
    label: "En revision",
    emoji: "🔍",
    progress: 0.5,
    terminal: false,
  },
  "mas-info": {
    label: "Falta info",
    emoji: "❓",
    progress: 0.35,
    terminal: false,
  },
  aceptada: { label: "Aceptada", emoji: "✅", progress: 1, terminal: true },
  rechazada: { label: "Rechazada", emoji: "❌", progress: 1, terminal: true },
};

/**
 * Aplica un evento al estado actual y devuelve el estado resultante. Funcion
 * total y determinista: los estados finales (aceptada/rechazada) ignoran
 * cualquier evento y se devuelven sin cambios (idempotencia).
 */
export const nextAppealState = (
  current: AppealState,
  event: AppealEvent,
): AppealState => {
  if (APPEAL_STATE_META[current].terminal) {
    return current;
  }

  switch (event) {
    case "accept":
      return "aceptada";
    case "reject":
      return "rechazada";
    case "request-info":
      return "mas-info";
    case "assign":
      return "en-revision";
  }
};

/**
 * Progreso del estado en el rango 0..1. Los estados finales valen 1; los
 * intermedios reflejan cuanto ha avanzado la apelacion en su ciclo de vida.
 */
export const appealProgress = (state: AppealState): number =>
  APPEAL_STATE_META[state].progress;

/** True si el estado es final (aceptada o rechazada). */
export const isTerminalAppealState = (state: AppealState): boolean =>
  APPEAL_STATE_META[state].terminal;

/**
 * Formatea una duracion en milisegundos como texto compacto neutro:
 * "<1m" por debajo de un minuto (incluidos negativos), "5m", "2h 3m", "1d 4h".
 * Los restos en cero se omiten ("2h", "1d"). Interno y determinista.
 */
const formatAppealDuration = (ms: number): string => {
  if (ms < 60_000) {
    return "<1m";
  }

  const totalMinutes = Math.floor(ms / 60_000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  if (totalHours > 0) {
    return minutes > 0 ? `${totalHours}h ${minutes}m` : `${totalHours}h`;
  }

  return `${totalMinutes}m`;
};

/**
 * Dibuja la barra visual tipo "[####----]" para un progreso 0..1. El progreso
 * se recorta al rango valido antes de repartir los segmentos llenos/vacios.
 */
export const renderAppealBar = (progress: number): string => {
  const clamped = progress < 0 ? 0 : progress > 1 ? 1 : progress;
  const filled = Math.round(clamped * APPEAL_BAR_WIDTH);
  const empty = APPEAL_BAR_WIDTH - filled;
  return `[${"#".repeat(filled)}${"-".repeat(empty)}]`;
};

/** Contexto temporal (en ms epoch) para renderizar el estado de la apelacion. */
export interface AppealStatusContext {
  readonly createdMs: number;
  readonly nowMs: number;
  readonly etaMs?: number;
}

/**
 * Construye la linea de estado visible, p.ej.
 * "🔍 En revision [####----] 50% · hace 2h · ETA 1h". Incluye el tiempo
 * transcurrido desde createdMs y, para estados no finales con etaMs, el tiempo
 * restante ("ETA <dur>" o "ETA vencida" si ya paso). Puro y determinista.
 */
export const formatAppealStatus = (
  state: AppealState,
  ctx: AppealStatusContext,
): string => {
  const meta = APPEAL_STATE_META[state];
  const progress = meta.progress;
  const percent = Math.round(progress * 100);
  const bar = renderAppealBar(progress);
  const elapsed = formatAppealDuration(ctx.nowMs - ctx.createdMs);

  let line = `${meta.emoji} ${meta.label} ${bar} ${percent}% · hace ${elapsed}`;

  if (!meta.terminal && ctx.etaMs !== undefined) {
    const remaining = ctx.etaMs - ctx.nowMs;
    line +=
      remaining > 0
        ? ` · ETA ${formatAppealDuration(remaining)}`
        : " · ETA vencida";
  }

  return line;
};

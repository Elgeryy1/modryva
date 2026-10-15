/** A manually declared group event. Pure and deterministic. */
export type ManualEvent = "directo" | "sorteo" | "raid" | "clase" | "normal";

/**
 * The rule posture for a manual event: whether to tighten rules and a
 * user-facing Spanish note. Pure and deterministic.
 */
export interface EventModeRules {
  readonly event: ManualEvent;
  readonly strict: boolean;
  readonly note: string;
}

const EVENT_MODE: Record<
  ManualEvent,
  { readonly strict: boolean; readonly note: string }
> = {
  directo: {
    strict: true,
    note: "Directo: antiflood reforzado y menos ruido.",
  },
  sorteo: { strict: true, note: "Sorteo: defensas anti-spam al máximo." },
  raid: { strict: true, note: "Raid: modo de emergencia, entradas bajo lupa." },
  clase: { strict: true, note: "Clase: silencio de juegos y enlaces." },
  normal: { strict: false, note: "Modo normal: reglas estándar." },
};

/**
 * Returns the recommended rule posture for a manually declared event (live,
 * giveaway, raid, class or normal). Pure and deterministic.
 */
export const rulesForManualEvent = (event: ManualEvent): EventModeRules => {
  const config = EVENT_MODE[event];
  return { event, strict: config.strict, note: config.note };
};

/**
 * Options to customize the attended support window. Hours use a 24-hour clock
 * (0-23) and are normalized with modulo 24, so out-of-range or fractional
 * values still resolve to a valid hour.
 */
export interface SupportHoursOptions {
  /** First hour (inclusive) the desk is attended. Defaults to 9. */
  readonly openHour?: number;
  /** Closing hour (exclusive) after which the desk is unattended. Defaults to 21. */
  readonly closeHour?: number;
}

/**
 * Result of evaluating the support desk state for a given hour, with a
 * ready-to-send user-facing Spanish message.
 */
export interface SupportHoursStatus {
  /** True when the given hour falls inside the attended window. */
  readonly open: boolean;
  /** User-facing Spanish message describing the current state. */
  readonly message: string;
}

const DEFAULT_OPEN_HOUR = 9;
const DEFAULT_CLOSE_HOUR = 21;

/**
 * Normalizes any number into an integer hour in the range 0-23 by flooring and
 * applying modulo 24, so 25 maps to 1 and -1 maps to 23. Non-finite input maps
 * to 0. Pure and deterministic.
 */
const normalizeHour = (hour: number): number => {
  if (!Number.isFinite(hour)) {
    return 0;
  }
  const floored = Math.floor(hour);
  return ((floored % 24) + 24) % 24;
};

/**
 * Formats a normalized hour as an "H:00" label, e.g. 9 becomes "9:00".
 * Pure and deterministic.
 */
const formatHourLabel = (hour: number): string => `${normalizeHour(hour)}:00`;

/**
 * Decides whether hourOfDay lies inside the [openHour, closeHour) window.
 * Supports overnight windows where openHour is greater than closeHour
 * (for example 22 to 6). An equal openHour and closeHour means the desk is
 * always closed (a zero-length window). Pure and deterministic.
 */
export const isWithinSupportHours = (
  hourOfDay: number,
  openHour: number,
  closeHour: number,
): boolean => {
  const now = normalizeHour(hourOfDay);
  const open = normalizeHour(openHour);
  const close = normalizeHour(closeHour);
  if (open === close) {
    return false;
  }
  if (open < close) {
    return now >= open && now < close;
  }
  return now >= open || now < close;
};

/**
 * Evaluates the support desk state for a given hour of the day and returns the
 * open flag plus a user-facing Spanish message. When closed, the message
 * invites the user to leave their query and contact details and promises a
 * review once the desk reopens. Options default to a 9:00-21:00 window.
 * Pure and deterministic.
 */
export const supportHoursStatus = (
  hourOfDay: number,
  options?: SupportHoursOptions,
): SupportHoursStatus => {
  const openHour = options?.openHour ?? DEFAULT_OPEN_HOUR;
  const closeHour = options?.closeHour ?? DEFAULT_CLOSE_HOUR;
  const open = isWithinSupportHours(hourOfDay, openHour, closeHour);
  const window = `${formatHourLabel(openHour)}-${formatHourLabel(closeHour)}`;
  const message = open
    ? `🟢 Estamos disponibles (horario ${window}). ¿En qué podemos ayudarte?`
    : `🌙 Estamos fuera de horario (${window}). Déjanos tu consulta y tus datos de contacto y la revisaremos en cuanto volvamos. 🙏`;
  return { open, message };
};

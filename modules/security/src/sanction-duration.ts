/**
 * Input describing a moderation incident used to size a temporary sanction.
 * gravity is the severity 1..5 (clamped), recidivism is the count of prior
 * offenses (0..n, clamped to >= 0) and hourOfDay is the local hour 0..23
 * (normalized with wraparound). Plain data with no behavior.
 */
export interface SanctionInput {
  readonly gravity: number;
  readonly recidivism: number;
  readonly hourOfDay: number;
}

/**
 * Result of sizing a sanction: durationMs is the mute/ban length in
 * milliseconds and label is a user-facing Spanish summary. Plain data.
 */
export interface SanctionDuration {
  readonly durationMs: number;
  readonly label: string;
}

const MINUTE_MS = 60_000;

/** Base sanction length in minutes indexed by clamped gravity 1..5. */
const BASE_MINUTES_BY_GRAVITY: readonly number[] = [5, 15, 60, 360, 1440];

/** Extra fraction added to the duration inside the night window. */
const NIGHT_SURCHARGE = 0.25;

/** Inclusive night window (local hours) that triggers the surcharge. */
const NIGHT_START_HOUR = 0;
const NIGHT_END_HOUR = 6;

const clampGravity = (gravity: number): number => {
  if (!Number.isFinite(gravity)) {
    return 1;
  }
  const rounded = Math.round(gravity);
  if (rounded < 1) {
    return 1;
  }
  if (rounded > 5) {
    return 5;
  }
  return rounded;
};

const clampRecidivism = (recidivism: number): number => {
  if (!Number.isFinite(recidivism) || recidivism < 0) {
    return 0;
  }
  return Math.floor(recidivism);
};

const normalizeHour = (hourOfDay: number): number => {
  if (!Number.isFinite(hourOfDay)) {
    return 12;
  }
  const floored = Math.floor(hourOfDay);
  return ((floored % 24) + 24) % 24;
};

const isNightHour = (hour: number): boolean =>
  hour >= NIGHT_START_HOUR && hour <= NIGHT_END_HOUR;

const joinSpanishList = (parts: readonly string[]): string => {
  if (parts.length === 0) {
    return "";
  }
  if (parts.length === 1) {
    return parts[0] ?? "";
  }
  const last = parts[parts.length - 1] ?? "";
  const rest = parts.slice(0, parts.length - 1);
  return `${rest.join(", ")} y ${last}`;
};

const formatSpanishDuration = (totalMinutes: number): string => {
  if (totalMinutes <= 0) {
    return "0 minutos";
  }
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days} ${days === 1 ? "día" : "días"}`);
  }
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? "hora" : "horas"}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? "minuto" : "minutos"}`);
  }
  return joinSpanishList(parts);
};

/**
 * Computes an intelligent temporary sanction length from an incident's
 * gravity, the offender's recidivism and the local hour. Base minutes come
 * from gravity (clamped 1..5), scaled by (1 + recidivism * 0.5) and by a small
 * night surcharge for hours 0..6, then rounded to whole minutes so the label
 * matches the duration exactly. Returns the length in milliseconds plus a
 * user-facing Spanish label. Pure and deterministic.
 */
export const computeSanctionDurationMs = (
  input: SanctionInput,
): SanctionDuration => {
  const gravity = clampGravity(input.gravity);
  const recidivism = clampRecidivism(input.recidivism);
  const hour = normalizeHour(input.hourOfDay);

  const baseMinutes = BASE_MINUTES_BY_GRAVITY[gravity - 1] ?? 5;
  const recidivismFactor = 1 + recidivism * 0.5;
  const night = isNightHour(hour);
  const nightFactor = night ? 1 + NIGHT_SURCHARGE : 1;

  const totalMinutes = Math.round(baseMinutes * recidivismFactor * nightFactor);
  const durationMs = totalMinutes * MINUTE_MS;

  const humanDuration = formatSpanishDuration(totalMinutes);
  const nightNote = night ? " con recargo nocturno" : "";
  const label = `Sanción de ${humanDuration}${nightNote}`;

  return { durationMs, label };
};

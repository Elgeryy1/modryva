/**
 * In-group status page (known incidents). Renders a user-facing summary that
 * separates open incidents from resolved ones so members can see, at a glance,
 * what the operators are currently investigating. Pure logic: it receives plain
 * incident records plus `nowMs` and returns strings/counts, with no I/O, clock
 * or randomness.
 */

/** Lifecycle state of an incident, ordered from newest report to closure. */
export type StatusIncidentStatus = "investigando" | "identificado" | "resuelto";

/**
 * A known incident. `ms` is the epoch timestamp (ms) at which the incident was
 * last updated; callers provide it so this module stays deterministic.
 */
export interface Incident {
  readonly id: string;
  readonly title: string;
  readonly status: StatusIncidentStatus;
  readonly ms: number;
}

/** True when the incident is still open (not yet resolved). */
const isOpen = (incident: Incident): boolean => incident.status !== "resuelto";

/**
 * Counts incidents that are still open (status other than "resuelto"). Pure and
 * deterministic.
 */
export const openIncidentCount = (incidents: readonly Incident[]): number =>
  incidents.reduce((total, incident) => total + (isOpen(incident) ? 1 : 0), 0);

/** User-facing label (with accents) for each incident status. */
const STATUS_LABEL: Readonly<Record<StatusIncidentStatus, string>> = {
  investigando: "Investigando",
  identificado: "Identificado",
  resuelto: "Resuelto",
};

/** Emoji shown next to each incident status. */
const STATUS_EMOJI: Readonly<Record<StatusIncidentStatus, string>> = {
  investigando: "🔴",
  identificado: "🟠",
  resuelto: "🟢",
};

/**
 * Formats a duration in milliseconds as a compact Spanish-neutral string:
 * `"ahora"` under one minute (also for negative inputs), `"5m"`, `"2h"`,
 * `"3d"`. The largest whole unit wins. Pure and deterministic.
 */
const formatAgo = (ms: number): string => {
  if (ms < 60_000) {
    return "ahora";
  }
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  return `${Math.floor(hours / 24)}d`;
};

/** Renders one incident line, e.g. `"🔴 Caida de pagos — Investigando (5m)"`. */
const formatLine = (incident: Incident, nowMs: number): string => {
  const emoji = STATUS_EMOJI[incident.status];
  const label = STATUS_LABEL[incident.status];
  const ago = formatAgo(nowMs - incident.ms);
  return `${emoji} ${incident.title} — ${label} (${ago})`;
};

/**
 * Builds the in-group status page. Open incidents are listed first under an
 * "Incidencias abiertas" heading; resolved ones under "Resueltas". When there
 * are no open incidents the page leads with an all-clear line. Order within
 * each group follows the input order. Pure and deterministic: every relative
 * time derives from `nowMs - incident.ms`.
 */
export const formatStatusPage = (
  incidents: readonly Incident[],
  nowMs: number,
): string => {
  if (incidents.length === 0) {
    return "📡 Estado del servicio\n\n✅ Todo funciona con normalidad.";
  }

  const open = incidents.filter(isOpen);
  const resolved = incidents.filter((incident) => !isOpen(incident));

  const sections: string[] = ["📡 Estado del servicio"];

  if (open.length > 0) {
    const lines = open.map((incident) => formatLine(incident, nowMs));
    sections.push(
      `⚠️ Incidencias abiertas (${open.length})\n${lines.join("\n")}`,
    );
  } else {
    sections.push("✅ Sin incidencias abiertas.");
  }

  if (resolved.length > 0) {
    const lines = resolved.map((incident) => formatLine(incident, nowMs));
    sections.push(`✔️ Resueltas (${resolved.length})\n${lines.join("\n")}`);
  }

  return sections.join("\n\n");
};

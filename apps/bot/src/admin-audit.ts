import type { AdminDecisionEntry } from "@superbot/data";
import {
  type AdminDecision,
  type AdminSanctions,
  detectAggressiveAdmins,
  detectInconsistency,
} from "@superbot/module-security";

/**
 * Composition helper for the STAFF-only "/auditoria_admins" report: turns the
 * raw history recorded by AdminDecisionRepository into the plain input
 * shapes the two pure audit detectors in modules/security expect
 * (detectAggressiveAdmins, detectInconsistency), then renders one combined
 * report. Audit only — this never applies, reverts or suggests an automatic
 * action, it only summarizes history for a human admin to read.
 */

/**
 * Every recorded decision counts toward an admin's sanction load (warn,
 * mute, kick, ban, delete, restrict, ...) — this repository only records
 * moderation actions, so there is no lighter "non-sanction" action to
 * exclude. Tune here if a future action type should NOT count.
 */
const toAdminSanctions = (
  entries: readonly AdminDecisionEntry[],
): AdminSanctions[] => {
  const counts = new Map<number, number>();
  for (const entry of entries) {
    const adminId = Number(entry.adminId);
    counts.set(adminId, (counts.get(adminId) ?? 0) + 1);
  }
  return [...counts.entries()].map(([adminId, sanctions]) => ({
    adminId,
    sanctions,
  }));
};

/**
 * Only entries with a known ruleId can be grouped into a "case kind" for the
 * consistency check; decisions recorded without one (ruleId undefined) are
 * skipped since there is nothing to compare them against.
 */
const toAdminDecisions = (
  entries: readonly AdminDecisionEntry[],
): AdminDecision[] =>
  entries
    .filter((entry): entry is AdminDecisionEntry & { ruleId: string } =>
      Boolean(entry.ruleId),
    )
    .map((entry) => ({
      adminId: entry.adminId.toString(),
      caseKind: entry.ruleId,
      action: entry.action,
    }));

/**
 * Builds the STAFF-readable text combining both detectors' output. Pure
 * (given the entries already read from the repository) and deterministic.
 */
export const formatAdminAuditReport = (
  entries: readonly AdminDecisionEntry[],
): string => {
  if (entries.length === 0) {
    return "🔎 Auditoría de administradores\n\nSin decisiones de moderación registradas todavía.";
  }

  const aggressive = detectAggressiveAdmins(toAdminSanctions(entries));
  const divergences = detectInconsistency(toAdminDecisions(entries));

  const lines: string[] = [
    "🔎 Auditoría de administradores (solo lectura, sin acciones automáticas)",
    "",
    "Admins con carga de sanciones muy por encima de la media del equipo:",
  ];

  if (aggressive.length === 0) {
    lines.push("— Ninguno detectado.");
  } else {
    for (const admin of aggressive) {
      lines.push(
        `— ${admin.adminId}: ${admin.sanctions} sanciones (x${admin.ratioToAvg} sobre la media)`,
      );
    }
  }

  lines.push("");
  lines.push("Reglas resueltas con criterio distinto entre admins:");
  if (divergences.length === 0) {
    lines.push("— Ninguna detectada.");
  } else {
    for (const divergence of divergences) {
      lines.push(`— ${divergence.caseKind}: ${divergence.actions.join(", ")}`);
    }
  }

  return lines.join("\n");
};

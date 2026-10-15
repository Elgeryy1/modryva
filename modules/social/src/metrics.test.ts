import { describe, expect, it } from "vitest";
import {
  hasBoundedCardinality,
  type MediaResultLabel,
  type PoleAttemptResult,
  type RestrictFailureReason,
  type RouletteOutcomeLabel,
  SOCIAL_METRICS,
  SOCIAL_METRICS_HELP,
  type SocialCommandName,
} from "./metrics.js";

/**
 * Lo que se protege aquí no es que las métricas existan, sino que ninguna
 * etiqueta pueda llevar un id.
 *
 * Una etiqueta con `chatId` o `userId` crea una serie temporal por grupo o por
 * persona. Eso hunde cualquier Prometheus y, peor, convierte el almacén de
 * métricas en un registro de quién habla dónde — justo lo que el resto del
 * módulo evita a conciencia.
 */

const ATTEMPTS: PoleAttemptResult[] = [
  "claimed",
  "already-claimed",
  "window-full",
  "window-gone",
];
const COMMANDS: SocialCommandName[] = [
  "pole",
  "ruleta",
  "paulo",
  "gato",
  "perro",
  "apoyar",
  "status",
];
const OUTCOMES: RouletteOutcomeLabel[] = ["safe", "adverse"];
const FAILURES: RestrictFailureReason[] = [
  "no-permission",
  "protected",
  "failed",
];
const MEDIA: MediaResultLabel[] = [
  "sent",
  "empty-library",
  "no-file-id",
  "failed",
];

/** TODO nombre que el módulo puede llegar a producir. */
const everyMetricName = (): string[] => [
  ...ATTEMPTS.map((a) => SOCIAL_METRICS.poleAttempt(a)),
  ...[1, 2, 3, 4, 99].map((p) => SOCIAL_METRICS.poleClaim(p)),
  SOCIAL_METRICS.poleConflict(),
  SOCIAL_METRICS.duplicateUpdate("roulette"),
  SOCIAL_METRICS.duplicateUpdate("pole"),
  ...COMMANDS.map((c) => SOCIAL_METRICS.socialCommand(c)),
  ...OUTCOMES.map((o) => SOCIAL_METRICS.rouletteRound(o)),
  SOCIAL_METRICS.rouletteSanction(),
  ...FAILURES.map((f) => SOCIAL_METRICS.restrictFailure(f)),
  ...MEDIA.map((m) => SOCIAL_METRICS.media(m)),
  ...COMMANDS.map((c) => SOCIAL_METRICS.commandDurationSum(c)),
  ...COMMANDS.map((c) => SOCIAL_METRICS.commandDurationCount(c)),
];

describe("cardinalidad de las métricas sociales", () => {
  it("ninguna etiqueta de ninguna métrica lleva algo que parezca un id", () => {
    for (const name of everyMetricName()) {
      expect(hasBoundedCardinality(name)).toBe(true);
    }
  });

  it("el detector caza de verdad un id colado", () => {
    // Sin esto, el test de arriba pasaría aunque el detector fuese `() => true`.
    expect(hasBoundedCardinality('social_x_total{chat="-1001234567890"}')).toBe(
      false,
    );
    expect(hasBoundedCardinality('social_x_total{user="1000000001"}')).toBe(
      false,
    );
    expect(hasBoundedCardinality('social_x_total{result="claimed"}')).toBe(
      true,
    );
  });

  it("el conjunto de series es pequeño y acotado", () => {
    // Si esto crece de golpe, alguien ha metido una etiqueta abierta.
    const names = new Set(everyMetricName());
    expect(names.size).toBeLessThanOrEqual(45);
  });

  it("los puestos más allá del podio se agrupan en 'other'", () => {
    // Un grupo puede configurar hasta 10 puestos; una serie por puesto sería
    // ruido. Tres medallas y un cajón de sastre.
    expect(SOCIAL_METRICS.poleClaim(1)).toContain('position="1"');
    expect(SOCIAL_METRICS.poleClaim(3)).toContain('position="3"');
    expect(SOCIAL_METRICS.poleClaim(4)).toContain('position="other"');
    expect(SOCIAL_METRICS.poleClaim(10)).toContain('position="other"');
  });

  it("cada familia tiene su texto de ayuda", () => {
    // Prometheus avisa de las familias sin HELP.
    for (const name of everyMetricName()) {
      const family = name.split("{")[0] ?? name;
      expect(SOCIAL_METRICS_HELP[family]).toBeTruthy();
    }
  });

  it("todos los nombres son válidos para Prometheus", () => {
    for (const name of everyMetricName()) {
      expect(name).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*(\{[^}]*\})?$/u);
    }
  });

  it("cubre lo que el informe pide medir", () => {
    const families = new Set(
      everyMetricName().map((name) => name.split("{")[0]),
    );
    for (const required of [
      "social_pole_attempts_total",
      "social_pole_claims_total",
      "social_pole_conflicts_total",
      "social_duplicate_updates_total",
      "social_commands_total",
      "social_roulette_rounds_total",
      "social_roulette_sanctions_total",
      "social_restrict_failures_total",
      "social_media_requests_total",
      "social_command_duration_ms_sum",
      "social_command_duration_ms_count",
    ]) {
      expect(families).toContain(required);
    }
  });
});

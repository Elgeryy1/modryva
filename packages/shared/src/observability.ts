import { createHash } from "node:crypto";

export interface MetricSample {
  readonly name: string;
  readonly help: string;
  readonly value: number;
}

/**
 * Renders counter samples in the Prometheus text exposition format. Pure so the
 * /metrics endpoint and tests share one implementation.
 */
export const formatPrometheusMetrics = (
  samples: readonly MetricSample[],
): string => {
  const lines: string[] = [];
  for (const sample of samples) {
    lines.push(`# HELP ${sample.name} ${sample.help}`);
    lines.push(`# TYPE ${sample.name} counter`);
    lines.push(`${sample.name} ${sample.value}`);
  }
  return `${lines.join("\n")}\n`;
};

/** In-memory counter registry for process-local metrics (per service instance). */
export class MetricsRegistry {
  private readonly counters = new Map<string, number>();

  increment(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  get(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  snapshot(help: Readonly<Record<string, string>> = {}): MetricSample[] {
    return [...this.counters.entries()].map(([name, value]) => ({
      name,
      help: help[name] ?? name,
      value,
    }));
  }
}

export interface ReadinessCheck {
  readonly name: string;
  readonly ok: boolean;
}

export interface ReadinessReport {
  readonly ready: boolean;
  readonly checks: readonly ReadinessCheck[];
}

/** Aggregates dependency checks into a single readiness verdict. */
export const evaluateReadiness = (
  checks: readonly ReadinessCheck[],
): ReadinessReport => ({
  ready: checks.every((check) => check.ok),
  checks,
});

/** Stable content checksum used for backup integrity / restore verification. */
export const computeChecksum = (content: string): string =>
  createHash("sha256").update(content).digest("hex");

export const verifyChecksum = (content: string, checksum: string): boolean =>
  computeChecksum(content) === checksum;

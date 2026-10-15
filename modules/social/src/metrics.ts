/**
 * Los nombres de las métricas sociales, en un solo sitio.
 *
 * No es un sistema de métricas nuevo: `packages/shared` ya tiene
 * `MetricsRegistry` y `formatPrometheusMetrics`, y la API ya expone `/metrics`.
 * Esto solo fija los NOMBRES y, sobre todo, las etiquetas permitidas.
 *
 * REGLA DURA SOBRE CARDINALIDAD. Ninguna etiqueta lleva `chatId`, `userId`,
 * nombres ni texto de mensajes. Una etiqueta con un id de Telegram crea una
 * serie temporal por cada persona o grupo: un Prometheus con cien mil series
 * de un solo bot no es observabilidad, es una fuga de memoria con gráficas —
 * y además convierte el almacén de métricas en un registro de quién habla
 * dónde, que es justo lo que la política de privacidad del proyecto evita.
 *
 * Por eso cada `label` de aquí es una unión de literales cerrada, y el
 * compilador rechaza cualquier otra cosa.
 */

export type PoleAttemptResult =
  | "claimed"
  | "already-claimed"
  | "window-full"
  | "window-gone";

export type SocialCommandName =
  | "pole"
  | "ruleta"
  | "paulo"
  | "gato"
  | "perro"
  | "apoyar"
  | "status";

export type RouletteOutcomeLabel = "safe" | "adverse";

export type RestrictFailureReason = "no-permission" | "protected" | "failed";

export type MediaResultLabel =
  | "sent"
  | "empty-library"
  | "no-file-id"
  | "failed";

/** `nombre{clave="valor"}`, que es como Prometheus codifica una etiqueta. */
const withLabel = (name: string, label: string, value: string): string =>
  `${name}{${label}="${value}"}`;

export const SOCIAL_METRICS = {
  /** Cada vez que alguien intenta reclamar, con el resultado. */
  poleAttempt: (result: PoleAttemptResult): string =>
    withLabel("social_pole_attempts_total", "result", result),
  /** Solo las concedidas, por puesto. */
  poleClaim: (position: number): string =>
    withLabel(
      "social_pole_claims_total",
      "position",
      position <= 3 ? String(position) : "other",
    ),
  /**
   * Una reclamación que perdió su hueco y tuvo que reintentar.
   *
   * Es la señal de que la carrera de medianoche está ocurriendo de verdad. Si
   * esto es siempre cero, o el grupo no juega o el reloj está mal.
   */
  poleConflict: (): string => "social_pole_conflicts_total",
  /** Un update reentregado que NO se volvió a ejecutar. */
  duplicateUpdate: (kind: "roulette" | "pole"): string =>
    withLabel("social_duplicate_updates_total", "kind", kind),
  socialCommand: (command: SocialCommandName): string =>
    withLabel("social_commands_total", "command", command),
  rouletteRound: (outcome: RouletteOutcomeLabel): string =>
    withLabel("social_roulette_rounds_total", "outcome", outcome),
  /** Sanciones efectivamente aplicadas por la ruleta. */
  rouletteSanction: (): string => "social_roulette_sanctions_total",
  /** Sanciones que NO se aplicaron, con el motivo. */
  restrictFailure: (reason: RestrictFailureReason): string =>
    withLabel("social_restrict_failures_total", "reason", reason),
  media: (result: MediaResultLabel): string =>
    withLabel("social_media_requests_total", "result", result),
  /**
   * Latencia de comando, como suma y cuenta.
   *
   * `MetricsRegistry` solo tiene contadores, así que no hay histogramas. Un par
   * suma/cuenta da la media, que es honesto; fingir percentiles con contadores
   * no lo sería.
   */
  commandDurationSum: (command: SocialCommandName): string =>
    withLabel("social_command_duration_ms_sum", "command", command),
  commandDurationCount: (command: SocialCommandName): string =>
    withLabel("social_command_duration_ms_count", "command", command),
} as const;

/** Textos de ayuda para el endpoint. Sin ellos Prometheus avisa. */
export const SOCIAL_METRICS_HELP: Readonly<Record<string, string>> = {
  social_pole_attempts_total: "Intentos de reclamar la pole, por resultado",
  social_pole_claims_total: "Poles concedidas, por puesto",
  social_pole_conflicts_total:
    "Reclamaciones que perdieron su hueco y reintentaron",
  social_duplicate_updates_total: "Updates reentregados que no se reejecutaron",
  social_commands_total: "Comandos sociales atendidos, por comando",
  social_roulette_rounds_total: "Tiradas de ruleta, por resultado",
  social_roulette_sanctions_total: "Silencios aplicados por la ruleta",
  social_restrict_failures_total:
    "Silencios que no se pudieron aplicar, por motivo",
  social_media_requests_total: "Peticiones de gato/perro, por resultado",
  social_command_duration_ms_sum: "Suma de duraciones de comando en ms",
  social_command_duration_ms_count: "Número de comandos medidos",
};

/**
 * Comprueba que un nombre de métrica no lleva cardinalidad ilimitada.
 *
 * Se usa en un test sobre TODOS los nombres que el módulo puede generar, para
 * que añadir una etiqueta con un id no pueda colarse en una revisión.
 */
export const hasBoundedCardinality = (metricName: string): boolean => {
  const labels = /\{([^}]*)\}/u.exec(metricName)?.[1] ?? "";
  if (labels.length === 0) {
    return true;
  }
  // Ningún valor puede parecer un id: nada de secuencias largas de dígitos.
  return !/"[^"]*\d{4,}[^"]*"/u.test(labels);
};

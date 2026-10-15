import { SOCIAL_METRICS_HELP } from "@superbot/module-social";
import { formatPrometheusMetrics, MetricsRegistry } from "@superbot/shared";

/**
 * Los contadores de ESTE proceso del bot.
 *
 * Un módulo, no un servicio inyectado, porque es exactamente lo que describe el
 * comentario del `/metrics` de la API: «per-instance counters live in the
 * in-memory registry wired by each long-running service». El bot no tenía uno;
 * ahora sí.
 *
 * Consecuencia asumida: los contadores son POR PROCESO y se pierden al
 * reiniciar. Para un contador que Prometheus raspa cada pocos segundos eso es
 * normal — la herramienta ya sabe tratar un contador que vuelve a cero.
 */
export const botMetrics = new MetricsRegistry();

/**
 * Los cortes del histograma de retraso de entrega, en segundos.
 *
 * Elegidos por lo que importa aquí, no por gusto: el `query_id` de una
 * solicitud de unión muere en segundos, así que la diferencia entre 1 s y 5 s
 * decide si esa persona entra o se queda fuera. Por encima de 30 s ya da igual
 * cuánto tarde: el daño está hecho, y por eso el último corte útil es 60.
 */
const CORTES_RETRASO_S = [1, 2, 5, 10, 30, 60] as const;

/**
 * Anota una observación en un histograma al estilo Prometheus.
 *
 * `MetricsRegistry` solo sabe contar, que es justo lo que necesita un
 * histograma: un contador acumulado por cada corte `le`, más `_sum` y
 * `_count`. Con eso, `histogram_quantile` calcula p50/p95/p99 al otro lado sin
 * que este proceso tenga que guardar ninguna muestra.
 */
const observar = (
  nombre: string,
  valor: number,
  cortes: readonly number[],
): void => {
  for (const corte of cortes) {
    if (valor <= corte) {
      botMetrics.increment(`${nombre}_bucket{le="${corte}"}`);
    }
  }
  botMetrics.increment(`${nombre}_bucket{le="+Inf"}`);
  botMetrics.increment(`${nombre}_sum`, valor);
  botMetrics.increment(`${nombre}_count`);
};

/**
 * Cuánto tardó un update en llegarle al bot desde que Telegram lo fechó.
 *
 * Es LA métrica de la incidencia de Guardian: el bot respondía en menos de
 * medio segundo mientras el update tardaba entre 10 y 100 en llegarle, y para
 * entonces la solicitud ya había caducado. Sin esto, ese retraso solo se veía
 * leyendo mensajes de error a mano.
 */
export const observarRetrasoDeEntrega = (segundos: number): void => {
  if (!Number.isFinite(segundos) || segundos < 0) return;
  observar("superbot_bot_update_delay_seconds", segundos, CORTES_RETRASO_S);
};

/** Cuánto tardó el pipeline en procesar un update, ya en nuestras manos. */
export const observarProcesoDeUpdate = (segundos: number): void => {
  if (!Number.isFinite(segundos) || segundos < 0) return;
  observar("superbot_bot_update_process_seconds", segundos, CORTES_RETRASO_S);
};

/**
 * El texto de exposición, con los `# HELP` que Prometheus espera.
 *
 * Las etiquetas vienen ya dentro del nombre (`social_x_total{result="..."}`),
 * que es como se codifican en el formato de texto. El `# HELP` se busca por el
 * nombre SIN etiquetas, porque Prometheus lo declara una vez por familia.
 */
export const renderBotMetrics = (): string => {
  const samples = botMetrics.snapshot();
  return formatPrometheusMetrics([
    {
      name: "superbot_bot_up",
      help: "1 when the bot process is running",
      value: 1,
    },
    {
      name: "superbot_bot_uptime_seconds",
      help: "Process uptime in seconds",
      value: Math.floor(process.uptime()),
    },
    ...samples.map((sample) => ({
      ...sample,
      help:
        SOCIAL_METRICS_HELP[sample.name.split("{")[0] ?? sample.name] ??
        sample.name,
    })),
  ]);
};

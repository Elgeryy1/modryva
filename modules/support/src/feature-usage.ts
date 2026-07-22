/**
 * Detector de features no usadas (ideas #193, #340): sugiere desactivar modulos
 * que estan habilitados pero apenas se usan, para reducir ruido. Logica pura:
 * recibe los contadores de uso por feature y devuelve las candidatas a
 * desactivar; sin I/O, sin reloj, sin azar.
 */

/** Uso de una feature: cuantas veces se uso y si esta habilitada. */
export interface FeatureUse {
  readonly feature: string;
  readonly uses: number;
  readonly enabled: boolean;
}

/**
 * Devuelve los nombres de las features HABILITADAS cuyo numero de usos es menor
 * que `threshold` (candidatas a desactivar por infrautilizadas). Conserva el
 * orden de entrada. Los usos negativos o no finitos cuentan como 0. Pura y
 * determinista.
 */
export const findUnusedFeatures = (
  features: readonly FeatureUse[],
  threshold: number,
): readonly string[] => {
  const limit = Number.isFinite(threshold) ? threshold : 0;
  const unused: string[] = [];
  for (const feature of features) {
    const uses = Number.isFinite(feature.uses) ? Math.max(0, feature.uses) : 0;
    if (feature.enabled && uses < limit) {
      unused.push(feature.feature);
    }
  }
  return unused;
};

/**
 * Construye un texto user-facing sugiriendo desactivar las features
 * infrautilizadas. Con la lista vacia devuelve un mensaje de "todo en uso".
 * Pura y determinista.
 */
export const formatUnusedSuggestion = (unused: readonly string[]): string => {
  if (unused.length === 0) {
    return "✅ Todas las funciones activas se están usando.";
  }
  return `💤 Estas funciones apenas se usan; podrías desactivarlas: ${unused.join(", ")}.`;
};

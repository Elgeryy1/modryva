/**
 * Recomendacion de plan (free / pro / network) a partir del uso real de una
 * comunidad. Logica pura y determinista: recibe metricas planas y devuelve la
 * recomendacion, sin I/O, red, Prisma ni relojes. Los umbrales crecen por
 * escalon y el plan network aparece cuando hay multi-grupo grande. Sin acentos
 * en el codigo a proposito.
 */

/** Metricas de uso mensual de una comunidad. */
export interface UsageStats {
  /** Miembros totales agregados. */
  readonly members: number;
  /** Acciones del bot en el ultimo mes (mensajes, moderaciones, comandos). */
  readonly monthlyActions: number;
  /** Tokens de IA consumidos en el ultimo mes. */
  readonly aiTokens: number;
  /** Numero de grupos gestionados. */
  readonly groups: number;
}

/** Identificador de plan. */
export type PlanId = "free" | "pro" | "network";

/** Resultado de la recomendacion. `wouldSave` solo aparece si hay ahorro. */
export interface PlanRecommendation {
  readonly plan: PlanId;
  readonly reason: string;
  /**
   * Ahorro mensual estimado (en la misma unidad que los precios) por no
   * contratar el plan inmediatamente superior. Se omite para el plan tope.
   */
  readonly wouldSave?: number;
}

/** Topes por dimension para cada escalon. Sobrepasarlos sube de plan. */
export const PLAN_RECOMMENDER_THRESHOLDS = {
  free: {
    members: 200,
    monthlyActions: 1_000,
    aiTokens: 50_000,
    groups: 1,
  },
  pro: {
    members: 5_000,
    monthlyActions: 100_000,
    aiTokens: 2_000_000,
    groups: 5,
  },
} as const;

/** Precio mensual de referencia por plan (unidad neutra). */
export const PLAN_RECOMMENDER_PRICES: Readonly<Record<PlanId, number>> = {
  free: 0,
  pro: 15,
  network: 49,
};

/**
 * Un despliegue se considera "multi-grupo grande" cuando hay al menos estos
 * grupos y ademas suficiente actividad o miembros: entonces se recomienda
 * network aunque cada dimension aislada cupiera en pro.
 */
export const PLAN_RECOMMENDER_MULTIGROUP = {
  minGroups: 3,
  minMembers: 2_000,
  minMonthlyActions: 20_000,
} as const;

type DimKey = "groups" | "members" | "monthlyActions" | "aiTokens";

const TIER_RANK: Readonly<Record<PlanId, number>> = {
  free: 0,
  pro: 1,
  network: 2,
};

/** Escalon minimo que cubre un valor dado sus topes free/pro. Puro. */
const dimensionTier = (
  value: number,
  freeCap: number,
  proCap: number,
): PlanId => (value <= freeCap ? "free" : value <= proCap ? "pro" : "network");

const buildReason = (
  plan: PlanId,
  driver: DimKey,
  u: UsageStats,
  multiGroupLarge: boolean,
): string => {
  if (plan === "free") {
    return "Tu uso encaja en el plan gratis; no necesitas pagar por ahora.";
  }

  if (multiGroupLarge) {
    return "Multiples grupos con alta actividad; el plan network unifica moderacion y facturacion.";
  }

  if (plan === "pro") {
    switch (driver) {
      case "members":
        return `Tu comunidad de ${u.members} miembros supera el plan gratis; pro amplia el limite.`;
      case "monthlyActions":
        return `Con ${u.monthlyActions} acciones al mes te quedas corto en el plan gratis; pro da mas margen.`;
      case "aiTokens":
        return `Consumes ${u.aiTokens} tokens de IA al mes; pro incluye una cuota mayor.`;
      default:
        return `Gestionas ${u.groups} grupos; pro cubre varios grupos.`;
    }
  }

  switch (driver) {
    case "members":
      return `Tu comunidad de ${u.members} miembros necesita la escala del plan network.`;
    case "monthlyActions":
      return `Con ${u.monthlyActions} acciones al mes solo el plan network aguanta el volumen.`;
    case "aiTokens":
      return `Tu consumo de ${u.aiTokens} tokens de IA exige la cuota del plan network.`;
    default:
      return `Administras ${u.groups} grupos; el plan network centraliza la red.`;
  }
};

/**
 * Recomienda el plan mas ajustado al uso real. Toma el escalon mas alto entre
 * todas las dimensiones y, si detecta multi-grupo grande, fuerza network.
 * `wouldSave` refleja lo que costaria de mas el plan inmediatamente superior
 * y se omite cuando ya se recomienda el plan tope. Puro y determinista.
 */
export const recommendPlan = (u: UsageStats): PlanRecommendation => {
  const t = PLAN_RECOMMENDER_THRESHOLDS;

  const tiers: Readonly<Record<DimKey, PlanId>> = {
    members: dimensionTier(u.members, t.free.members, t.pro.members),
    monthlyActions: dimensionTier(
      u.monthlyActions,
      t.free.monthlyActions,
      t.pro.monthlyActions,
    ),
    aiTokens: dimensionTier(u.aiTokens, t.free.aiTokens, t.pro.aiTokens),
    groups: dimensionTier(u.groups, t.free.groups, t.pro.groups),
  };

  // Orden de prioridad para elegir la dimension que justifica la subida.
  const priority: readonly DimKey[] = [
    "groups",
    "members",
    "monthlyActions",
    "aiTokens",
  ];

  let plan: PlanId = "free";
  let driver: DimKey = "members";
  for (const key of priority) {
    const tier = tiers[key];
    if (TIER_RANK[tier] > TIER_RANK[plan]) {
      plan = tier;
      driver = key;
    }
  }

  const mg = PLAN_RECOMMENDER_MULTIGROUP;
  const multiGroupLarge =
    u.groups >= mg.minGroups &&
    (u.members > mg.minMembers || u.monthlyActions > mg.minMonthlyActions);

  if (multiGroupLarge) {
    plan = "network";
    driver = "groups";
  }

  const reason = buildReason(plan, driver, u, multiGroupLarge);

  const savings =
    plan === "free"
      ? PLAN_RECOMMENDER_PRICES.pro - PLAN_RECOMMENDER_PRICES.free
      : plan === "pro"
        ? PLAN_RECOMMENDER_PRICES.network - PLAN_RECOMMENDER_PRICES.pro
        : undefined;

  return {
    plan,
    reason,
    ...(savings !== undefined ? { wouldSave: savings } : {}),
  };
};

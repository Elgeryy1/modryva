export interface DashboardCounts {
  readonly updates: number;
  readonly auditEvents: number;
  readonly activeSanctions: number;
  readonly openTickets: number;
  readonly scheduledPosts: number;
  readonly aiTokens: number;
}

export interface DashboardCard {
  readonly key: string;
  readonly label: string;
  readonly value: number;
}

export interface DashboardData {
  readonly generatedAt: string;
  readonly cards: readonly DashboardCard[];
}

/**
 * Pure projection of raw counts into the dashboard card model consumed by the
 * web panel. Keeping it pure lets both the API and the web app share one source
 * of truth and unit-test the shape without a database.
 */
export const summarizeDashboard = (
  counts: DashboardCounts,
  generatedAt: string,
): DashboardData => ({
  generatedAt,
  cards: [
    { key: "updates", label: "Updates procesados", value: counts.updates },
    { key: "audit", label: "Eventos de auditoria", value: counts.auditEvents },
    {
      key: "sanctions",
      label: "Sanciones activas",
      value: counts.activeSanctions,
    },
    { key: "tickets", label: "Tickets abiertos", value: counts.openTickets },
    {
      key: "posts",
      label: "Publicaciones programadas",
      value: counts.scheduledPosts,
    },
    { key: "ai", label: "Tokens de IA usados", value: counts.aiTokens },
  ],
});

---
id: servicio-dashboard
title: Servicio dashboard
type: service
domain: api
status: implemented
maturity: stable
source: [apps/api/src/dashboard.service.ts]
tags: [modryva, service, api]
aliases: [PrismaDashboardCountsProvider, DashboardCountsProvider]
created: 2026-07-12
updated: 2026-07-12
---

# Servicio dashboard

`PrismaDashboardCountsProvider` (`apps/api/src/dashboard.service.ts:13`) implementa la interfaz `DashboardCountsProvider` y lee **conteos en vivo** de la BD para el panel de la Mini App. Todas las consultas se filtran por tenant cuando se pasa `tenantId`, para que el panel nunca filtre datos entre tenants.

## Método

`counts(tenantId: string | undefined): Promise<DashboardCounts>` (`:16`). Con `tenantFilter = tenantId ? { tenantId } : {}` cuenta en paralelo:
- `updateInbox` (updates)
- `auditLog` (auditEvents)
- `sanction` con `status: "active"` (activeSanctions)
- `ticket` con `status: { not: "closed" }` (openTickets)
- `scheduledPost` con `status: "pending"` (scheduledPosts)
- `aiUsage.aggregate` sumando `tokensIn + tokensOut` (aiTokens)

Devuelve `DashboardCounts`; el controller lo pasa por `summarizeDashboard` (de `@superbot/shared`) antes de responder.

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: `prisma` / `PrismaClient` (`@superbot/data`), `DashboardCounts` (`@superbot/shared`).
- **Utilizado por**: [[Controller dashboard]] ([[Endpoint POST v1 dashboard]]).
- **Consume**: [[Modelo UpdateInbox]], [[Modelo AuditLog]], [[Modelo Sanction]], [[Modelo Ticket]], [[Modelo ScheduledPost]], [[Modelo AiUsage]].
- **Relacionado con**: [[Pantalla dashboard]].

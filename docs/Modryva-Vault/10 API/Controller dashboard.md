---
id: controller-dashboard
title: Controller dashboard
type: controller
domain: api
status: implemented
maturity: stable
source: [apps/api/src/dashboard.controller.ts, apps/api/src/dashboard.service.ts]
tags: [modryva, controller, api]
aliases: [DashboardController]
created: 2026-07-12
updated: 2026-07-12
---

# Controller dashboard

`DashboardController` (`apps/api/src/dashboard.controller.ts:16`). Devuelve los conteos del panel de la Mini App, **escopados al tenant del bot** que sirve. Prefijo `@Controller("v1/dashboard")` con `@UseGuards(InitDataGuard)`.

## Endpoints

| Método | Ruta | Propósito | Auth |
|---|---|---|---|
| POST | `/v1/dashboard` | Conteos del panel del tenant | InitDataGuard |

`dashboard(@Req req)` (`:23`, `@HttpCode(200)`):
- Lee el contexto (`getMiniappContext`), deriva `botKey` de `ctx.botUsername` y busca el tenant `telegram-<botKey>`.
- Llama `provider.counts(tenant?.id)` ([[Servicio dashboard]]) y devuelve `summarizeDashboard(counts, now)` → `DashboardData`.
- Un bot hijo ve solo su propia actividad; si no hay tenant, cuenta global (tenant `undefined`).

Cuerpo esperado: `{}` (la web envía `body: "{}"`, `apps/web/lib/api.ts:148`).

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio dashboard]] (`PrismaDashboardCountsProvider`), `summarizeDashboard` (`@superbot/shared`).
- **Utilizado por**: `getDashboard()` en `apps/web/lib/api.ts:147`.
- **Consume**: [[Modelo Tenant]].
- **Relacionado con**: [[Endpoint POST v1 dashboard]], [[Pantalla dashboard]].

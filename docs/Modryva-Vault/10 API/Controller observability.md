---
id: controller-observability
title: Controller observability
type: controller
domain: api
status: implemented
maturity: stable
source: [apps/api/src/observability.controller.ts]
tags: [modryva, controller, api]
aliases: [ObservabilityController]
created: 2026-07-12
updated: 2026-07-12
---

# Controller observability

`ObservabilityController` (`apps/api/src/observability.controller.ts:10`). Sondas de liveness/readiness y métricas Prometheus. Prefijo `@Controller()` (raíz). **Sin** `InitDataGuard`.

## Endpoints

| Método | Ruta | Propósito | Auth |
|---|---|---|---|
| GET | `/health/live` | Liveness | pública |
| GET | `/health/ready` | Readiness (BD + bot token) | pública |
| GET | `/metrics` | Métricas Prometheus (text/plain) | pública |

- `live()` (`:12`): `{ ok: true, status: "alive" }`.
- `ready()` (`:17`): `evaluateReadiness` sobre `database-url` (`DATABASE_URL`) y `bot-token` (`TELEGRAM_BOT_TOKEN`). Devuelve `ReadinessReport`.
- `metrics()` (`:26`): `@Header("content-type", "text/plain; version=0.0.4")`. Expone `superbot_api_up` (=1) y `superbot_api_uptime_seconds` (`process.uptime()`) vía `formatPrometheusMetrics`.

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: `@superbot/shared` (`evaluateReadiness`, `formatPrometheusMetrics`, `getRuntimeEnv`).
- **Relacionado con**: [[Controller health]].

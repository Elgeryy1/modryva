---
id: controller-health
title: Controller health
type: controller
domain: api
status: implemented
maturity: stable
source: [apps/api/src/health.controller.ts]
tags: [modryva, controller, api]
aliases: [HealthController]
created: 2026-07-12
updated: 2026-07-12
---

# Controller health

`HealthController` (`apps/api/src/health.controller.ts:8`). Sonda de salud básica. Prefijo `@Controller()` (raíz, sin path). **Sin** `InitDataGuard`.

## Endpoints

| Método | Ruta | Propósito | Auth |
|---|---|---|---|
| GET | `/health` | Estado del servicio | pública |

`getHealth()` (`:9`) devuelve `{ ok: true, service: "api", runtime: "nestjs-fastify", manifests: [<nombres>] }`, donde `manifests` son los nombres de `coreManifest` y `securityManifest`.

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: `@superbot/module-core`, `@superbot/module-security`.
- **Relacionado con**: [[Controller observability]], [[Controller bootstrap]].

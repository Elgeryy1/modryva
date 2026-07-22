---
id: controller-bootstrap
title: Controller bootstrap
type: controller
domain: api
status: implemented
maturity: stable
source: [apps/api/src/bootstrap.controller.ts]
tags: [modryva, controller, api]
aliases: [BootstrapController]
created: 2026-07-12
updated: 2026-07-12
---

# Controller bootstrap

`BootstrapController` (`apps/api/src/bootstrap.controller.ts:9`). Publica los manifiestos de módulos y la URL de la web para el arranque del cliente. Prefijo `@Controller("v1")`. **Sin** `InitDataGuard`.

## Endpoints

| Método | Ruta | Propósito | Auth |
|---|---|---|---|
| GET | `/v1/bootstrap` | App name + módulos + URL web | pública |
| GET | `/v1/modules` | Solo la lista de módulos | pública |

- `getBootstrap()` (`:11`): `{ ok: true, appName: "Superbot", modules: [coreManifest, securityManifest], webUrl: TELEGRAM_APP_URL }`.
- `getModules()` (`:23`): `{ ok: true, modules }`.

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: `@superbot/module-core`, `@superbot/module-security`, `getRuntimeEnv` (`@superbot/shared`).
- **Relacionado con**: [[Controller health]].

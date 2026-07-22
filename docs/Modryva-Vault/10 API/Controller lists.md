---
id: controller-lists
title: Controller lists
type: controller
domain: api
status: implemented
maturity: stable
source: [apps/api/src/miniapp/lists.controller.ts, apps/api/src/miniapp/admin.service.ts]
tags: [modryva, controller, api]
aliases: [MiniappListsController]
created: 2026-07-12
updated: 2026-07-12
---

# Controller lists

`MiniappListsController` (`apps/api/src/miniapp/lists.controller.ts:58`). Cubre las secciones de config **con forma de lista** que no encajan en la maquinaria de secciones simples de [[Controller config]]: la **blocklist** (palabras prohibidas + modo de castigo) y los **filters** (disparador→respuesta automática). Prefijo `@Controller("v1/miniapp")` con `@UseGuards(InitDataGuard)` (`:56`).

Instancia `PrismaGroupProtectionRepository` (blocklist), `PrismaFiltersRepository` y `PrismaFoundationRepository` (auditoría) (`:59`–`:61`). Inyecta [[Servicio admin]] (`:64`).

## Endpoints

| Método | Ruta | Propósito | Auth | Línea |
|---|---|---|---|---|
| GET | `groups/:gid/blocklist` | Modo + entradas de la blocklist del chat. | InitDataGuard + admin | `:70` |
| PUT | `groups/:gid/blocklist/mode` | Fija el castigo (`delete`/`warn`/`mute`/`ban`/`kick`); audita `miniapp.blocklist.mode`. | InitDataGuard + admin | `:87` |
| POST | `groups/:gid/blocklist/entries` | Añade disparador (normaliza a minúsculas, colapsa espacios); audita `miniapp.blocklist.add`. | InitDataGuard + admin | `:106` |
| DELETE | `groups/:gid/blocklist/entries/:id` | Borra por disparador (el `id` es el propio trigger); audita `miniapp.blocklist.remove`. | InitDataGuard + admin | `:140` |
| GET | `groups/:gid/filters` | Lista filtros disparador→respuesta. | InitDataGuard + admin | `:158` |
| POST | `groups/:gid/filters` | Crea/actualiza un filtro; audita `miniapp.filter.add`. | InitDataGuard + admin | `:171` |
| DELETE | `groups/:gid/filters/:id` | Borra un filtro por disparador; audita `miniapp.filter.remove`. | InitDataGuard + admin | `:203` |

El `id` que devuelve la lista es el **trigger** (clave única natural por chat, los repos borran por trigger, no por row id) (`:46`–`:55`). Los `BLOCKLIST_MODES` y la normalización espejan los comandos de chat `/addblocklist` y `/filter` (`modules/security/src/blocklists.ts`).

## Autorización

`authorize(req, gid)` (`:221`) = `assertGroupAdmin` + `resolveChat`. Todas las escrituras auditan vía `audit(...)` (`:228`) con `action: miniapp.<x>`.

## Modelos que toca

[[Modelo GroupProtection]] (blocklist: mode + entries), [[Modelo Filter]] (filters) y [[Modelo AuditLog]].

## Consumido desde apps/web

`getBlocklist` (`apps/web/lib/api.ts:166`), `setBlocklistMode` (`:171`), `addBlocklistEntry` (`:177`), `removeBlocklistEntry` (`:187`), `getFilters` (`:199`), `addFilter` (`:202`), `removeFilter` (`:208`).

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla blocklist]], [[Pantalla filters]] vía `apps/web/lib/api.ts`.
- **Consume**: [[Modelo GroupProtection]], [[Modelo Filter]], [[Modelo AuditLog]].
- **Relacionado con**: [[Controller config]], [[API Map]].

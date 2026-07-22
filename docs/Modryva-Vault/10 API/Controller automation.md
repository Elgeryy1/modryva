---
id: controller-automation
title: Controller automation
type: controller
domain: api
status: implemented
maturity: beta
source: [apps/api/src/miniapp/automation.controller.ts, apps/api/src/miniapp/admin.service.ts]
tags: [modryva, controller, api]
aliases: [MiniappAutomationController]
created: 2026-07-12
updated: 2026-07-12
---

# Controller automation

`MiniappAutomationController` (`apps/api/src/miniapp/automation.controller.ts:151`). Constructor de **automatizaciones por grupo** (disparador → condición → acción) alcance `chat` o `network`. Prefijo `@Controller("v1/miniapp")` con `@UseGuards(InitDataGuard)` (`:149`).

Instancia `PrismaAutomationRepository` y `PrismaFederationRepository` (`:152`–`:153`); inyecta [[Servicio admin]] (`:155`). El gate es **solo `assertGroupAdmin`** (misma barra que cualquier sección de `/config`): es un builder por grupo, no la consola network-wide (`:145`–`:148`).

## Endpoints

| Método | Ruta | Propósito | Auth | Línea |
|---|---|---|---|---|
| GET | `groups/:gid/automations` | Lista las automatizaciones de la red del grupo (vacío si no está en red). | InitDataGuard + admin | `:159` |
| POST | `groups/:gid/automations` | Crea una automatización (valida `createSchema`); `scope: network` → `chatId=null`. | InitDataGuard + admin | `:169` |
| PUT | `groups/:gid/automations/:id` | Actualiza (valida `updateSchema`, `stripUndefined`); requiere que pertenezca a la red del grupo. | InitDataGuard + admin propietario | `:196` |
| DELETE | `groups/:gid/automations/:id` | Borra tras `authorizeOwning`. | InitDataGuard + admin propietario | `:218` |
| POST | `groups/:gid/automations/:id/toggle` | Activa/desactiva (`{ enabled }`). | InitDataGuard + admin propietario | `:232` |

Los esquemas Zod validan la forma: `triggerSchema` (`contains_text`, `contains_link`, `new_member`, `report`, `schedule`+cron, `high_risk`) `:31`; `conditionSchema` (`none`, `is_new_user`, `not_in_chat`, `missing_badge`, `source_chat`) `:46`; `actionSchema` (`delete`, `reply`, `quarantine`, `notify_staff`, `log`, `mute`, `webhook`, `assign_mission`) `:66`.

## Autorización

`authorize` (`:251`) devuelve `{ chat, fedId }` resolviendo la federación del chat. `authorizeOwning` (`:269`) además exige que la automatización con ese `id` esté en la lista de la red — evita que un admin de un grupo mute la automatización de otro adivinando el id.

## Modelos que toca

[[Modelo Automation]] (via `PrismaAutomationRepository`), [[Modelo Federation]] (para `fedId`).

## Consumido desde apps/web

`getAutomations` (`apps/web/lib/api-automation.ts:40`), `createAutomation` (`:45`), `updateAutomation` (`:60`), `removeAutomation` (`:76`), `toggleAutomation` (`:82`).

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla automations]] vía `apps/web/lib/api-automation.ts`.
- **Consume**: [[Modelo Automation]], [[Modelo Federation]].
- **Relacionado con**: [[Controller owner-network]], [[Controller backup]], [[API Map]].

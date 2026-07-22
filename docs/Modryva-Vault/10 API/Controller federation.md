---
id: controller-federation
title: Controller federation
type: controller
domain: api
status: implemented
maturity: stable
source: [apps/api/src/miniapp/federation.controller.ts, apps/api/src/miniapp/admin.service.ts]
tags: [modryva, controller, api]
aliases: [MiniappFederationController]
created: 2026-07-12
updated: 2026-07-12
---

# Controller federation

`MiniappFederationController` (`apps/api/src/miniapp/federation.controller.ts:42`). Membresía y administración de la **federación (baneos compartidos entre grupos)** del grupo actual. Espeja los comandos `/newfed /joinfed /leavefed /chatfed /fban` (`modules/security/src/federations.ts`), con el mismo modelo de permisos. Prefijo `@Controller("v1/miniapp")` con `@UseGuards(InitDataGuard)` (`:41`).

Instancia `PrismaFederationRepository` y `PrismaFoundationRepository` (`:43`–`:44`); inyecta [[Servicio admin]] (`:47`).

## Endpoints

| Método | Ruta | Propósito | Auth | Línea |
|---|---|---|---|---|
| GET | `groups/:gid/federation` | Estado de la federación del chat (`view`). | InitDataGuard + admin | `:51` |
| POST | `groups/:gid/federation` | Crea federación y une el chat. | InitDataGuard + admin | `:58` |
| POST | `groups/:gid/federation/join` | Une el chat a una federación por `{ fedId }`. | InitDataGuard + admin | `:90` |
| DELETE | `groups/:gid/federation` | El chat abandona la federación. | InitDataGuard + admin | `:118` |
| POST | `groups/:gid/federation/bans` | Añade un fed-ban (`{ userId, reason? }`). | InitDataGuard + **fed-admin** | `:161` |
| DELETE | `groups/:gid/federation/bans/:userId` | Quita un fed-ban. | InitDataGuard + **fed-admin** | `:129` |
| POST | `groups/:gid/federation/admins` | Añade fed-admin. | InitDataGuard + **owner** | `:214` |
| DELETE | `groups/:gid/federation/admins/:userId` | Quita fed-admin. | InitDataGuard + **owner** | `:245` |
| POST | `groups/:gid/federation/rename` | Renombra la federación. | InitDataGuard + **owner** | `:279` |
| DELETE | `groups/:gid/federation/all` | Elimina la federación entera. | InitDataGuard + **owner** | `:307` |
| POST | `groups/:gid/federation/subscription` | Suscribe la fed a una fed padre (`{ fedId }`). | InitDataGuard + **owner** | `:324` |
| DELETE | `groups/:gid/federation/subscription` | Quita la suscripción. | InitDataGuard + **owner** | `:356` |

## Modelo de permisos

`authorize` (`:450`) = admin del grupo (basta para crear/unir/salir, como `/chatfed`). Banear/desbanear exige `isFedAdmin` (o owner); admins, rename, delete y suscripción exigen ser **owner** (`fed.ownerTelegramId === userId`). La `view` (`:378`) sólo revela **listas de chats/bans/admins** a fed-admins/owner — mismo nivel de sensibilidad que `/fedexport`; un admin de grupo que sólo enlazó su chat ve conteos, no listas. No se puede banear al owner, a uno mismo ni a otro fed-admin (`:192`–`:200`).

## Modelos que toca

[[Modelo Federation]], [[Modelo FederationBan]], [[Modelo FederationAdmin]], [[Modelo FederationChat]], [[Modelo AuditLog]] (`audit(...)` `:457` con `action: miniapp.federation.*`).

## Consumido desde apps/web

`getFederationStatus` (`apps/web/lib/api.ts:243`), `createFederation` (`:246`), `joinFederation` (`:252`), `leaveFederation` (`:258`), `removeFedBan` (`:263`), `addFedBan` (`:268`), `addFedAdmin` (`:273`), `removeFedAdmin` (`:279`), `renameFederation` (`:284`), `deleteFederation` (`:290`), `setFederationSubscription` (`:294`), `clearFederationSubscription` (`:300`).

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla federation]] vía `apps/web/lib/api.ts`.
- **Consume**: [[Modelo Federation]], [[Modelo FederationBan]], [[Modelo AuditLog]].
- **Relacionado con**: [[Controller owner-network]], [[Controller entitlement]], [[API Map]].

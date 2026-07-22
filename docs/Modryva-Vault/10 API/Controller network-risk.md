---
id: controller-network-risk
title: Controller network-risk
type: controller
domain: api
status: implemented
maturity: beta
source: [apps/api/src/miniapp/network-risk.controller.ts, apps/api/src/miniapp/admin.service.ts]
tags: [modryva, controller, api]
aliases: [MiniappNetworkRiskController]
created: 2026-07-12
updated: 2026-07-12
---

# Controller network-risk

`MiniappNetworkRiskController` (`apps/api/src/miniapp/network-risk.controller.ts:30`). Consola de **riesgo de usuarios a nivel de red**: top de perfiles de riesgo y reset de un perfil. Prefijo `@Controller("v1/miniapp")` con `@UseGuards(InitDataGuard)` (`:29`).

Instancia `PrismaFederationRepository` y `PrismaOwnerNetworkRiskRepository` (`:31`–`:32`); inyecta [[Servicio admin]] (`:34`).

## Endpoints

| Método | Ruta | Propósito | Auth | Línea |
|---|---|---|---|---|
| GET | `groups/:gid/network/risk` | Top 20 perfiles de riesgo de la red (`inNetwork: false` si no hay red). | InitDataGuard + **network-admin** | `:38` |
| POST | `groups/:gid/network/risk/:userId/reset` | Resetea el perfil de riesgo de un usuario. | InitDataGuard + **network-admin** | `:57` |

Cada perfil (`toView`, `:127`) expone `score`, `classification` (`classifyRisk`), y contadores: `deletedCount`, `reportCount`, `quarantineCount`, `linkCount`, `sanctionCount`, `chatCount`, `updatedAt`.

## Autorización

`authorize` (`:82`) = admin del grupo; `isNetworkAdmin` (`:74`) = owner de la federación **o** `isFedAdmin`. El GET devuelve `inNetwork: false` si el chat no está en red, pero si lo está y el usuario no es network-admin lanza 403 `not-network-admin` (`:46`). El reset usa `requireNetworkAdmin` (`:98`) que además lanza 400 `not-in-network` si no hay red.

## Modelos que toca

[[Modelo RiskProfile]] (via `PrismaOwnerNetworkRiskRepository`), [[Modelo Federation]].

## Consumido desde apps/web

`getNetworkRisk` (`apps/web/lib/api-risk.ts:26`), `resetNetworkRiskProfile` (`:29`).

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla risk]] vía `apps/web/lib/api-risk.ts`.
- **Consume**: [[Modelo RiskProfile]], [[Modelo Federation]].
- **Relacionado con**: [[Controller user-panel]], [[Controller network-analytics]], [[Controller moderation-inbox]], [[API Map]].

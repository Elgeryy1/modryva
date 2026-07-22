---
id: controller-gamification
title: Controller gamification
type: controller
domain: api
status: implemented
maturity: beta
source: [apps/api/src/miniapp/gamification.controller.ts, apps/api/src/miniapp/admin.service.ts]
tags: [modryva, controller, api]
aliases: [MiniappGamificationController]
created: 2026-07-12
updated: 2026-07-12
---

# Controller gamification

`MiniappGamificationController` (`apps/api/src/miniapp/gamification.controller.ts:37`). Estado de **gamificación** del grupo: rankings (grupo + red), misiones, badges y los **botones de bienvenida** configurables. Prefijo `@Controller("v1/miniapp")` con `@UseGuards(InitDataGuard)` (`:35`).

Instancia `PrismaFederationRepository`, `PrismaGamificationRepository` y `PrismaReputationRepository` (`:38`–`:40`); inyecta [[Servicio admin]] (`:42`).

## Endpoints

| Método | Ruta | Propósito | Auth | Línea |
|---|---|---|---|---|
| GET | `groups/:gid/gamification` | Estado completo: `welcomeButtons`, `groupRanking` (reputación top 20) y, si hay red, `missions`, `badges`, `networkRanking`. | InitDataGuard + admin | `:46` |
| POST | `groups/:gid/gamification/welcome-buttons` | Guarda los toggles de botones de bienvenida (`{ rules, otherGroups, support, verify }`). | InitDataGuard + admin | `:100` |

`welcomeButtonsSchema` (`:28`) valida los cuatro booleanos. Si el chat no está en una federación, la respuesta lleva `inNetwork: false` y sólo `welcomeButtons` + `groupRanking` (`:58`). Con red añade misiones (`ensureMissions`), badges y ranking de red por nº de badges (`:69`).

## Modelos que toca

[[Modelo GamificationWelcomeButtons]] (via `getWelcomeButtons`/`setWelcomeButtons`), [[Modelo Mission]], [[Modelo Badge]], [[Modelo Reputation]] (ranking de grupo), [[Modelo Federation]].

## Consumido desde apps/web

`getGamificationStatus` (`apps/web/lib/api-gamification.ts:37`), `updateWelcomeButtons` (`:51`).

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla gamification]] vía `apps/web/lib/api-gamification.ts`.
- **Consume**: [[Modelo GamificationWelcomeButtons]], [[Modelo Reputation]], [[Modelo Federation]].
- **Relacionado con**: [[Controller games]], [[Controller backup]] (exporta `gamificationWelcomeButtons`), [[Endpoint GET v1 miniapp groups gid gamification]], [[API Map]].

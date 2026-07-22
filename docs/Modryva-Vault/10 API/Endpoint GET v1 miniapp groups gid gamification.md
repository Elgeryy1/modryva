---
id: endpoint-get-v1-miniapp-groups-gid-gamification
title: Endpoint GET v1 miniapp groups gid gamification
type: endpoint
domain: api
status: implemented
maturity: beta
source: [apps/api/src/miniapp/gamification.controller.ts]
tags: [modryva, endpoint, api]
aliases: [GET /v1/miniapp/groups/:gid/gamification]
created: 2026-07-12
updated: 2026-07-12
---

# Endpoint GET v1 miniapp groups gid gamification

`status()` en [[Controller gamification]] (`apps/api/src/miniapp/gamification.controller.ts:46`). Estado de gamificación del grupo (rankings, misiones, badges, botones de bienvenida).

## Entrada

- Path: `:gid`. Cabecera `Authorization: tma <initData>`.

## Salida

- Sin red: `{ inNetwork: false, welcomeButtons, groupRanking }` (`:58`). `groupRanking` = top 20 por reputación (`{ telegramUserId, points }`).
- Con red: añade `fedId`, `missions` (`{ kind, completed, completedAt }`), `badges`, `networkRanking` (`{ telegramUserId, badgeCount }`) (`:79`).

## Auth y errores

`@UseGuards(InitDataGuard)` + `assertGroupAdmin`. Sin errores propios.

## Consumidor

`getGamificationStatus(gid)` en `apps/web/lib/api-gamification.ts:37`.

## Relaciones

- **Pertenece a**: [[Controller gamification]] / [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla gamification]] (`getGamificationStatus`).
- **Consume**: [[Modelo Reputation]], [[Modelo Mission]], [[Modelo Badge]], [[Modelo GamificationWelcomeButtons]], [[Modelo Federation]].
- **Relacionado con**: [[Controller games]], [[API Map]].

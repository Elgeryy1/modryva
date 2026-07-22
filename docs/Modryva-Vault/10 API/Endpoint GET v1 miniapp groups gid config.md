---
id: endpoint-get-v1-miniapp-groups-gid-config
title: Endpoint GET v1 miniapp groups gid config
type: endpoint
domain: api
status: implemented
maturity: stable
source: [apps/api/src/miniapp/config.controller.ts]
tags: [modryva, endpoint, api]
aliases: [GET /v1/miniapp/groups/:gid/config]
created: 2026-07-12
updated: 2026-07-12
---

# Endpoint GET v1 miniapp groups gid config

`snapshot()` en [[Controller config]] (`apps/api/src/miniapp/config.controller.ts:374`). Devuelve un **snapshot** con las cinco secciones más usadas de un vistazo.

## Entrada

- Path: `:gid`. Cabecera `Authorization: tma <initData>`.

## Salida

`{ telegramChatId, title, sections: { welcome, rules, flood, captcha, locks } }` (`:384`). Las secciones se leen en paralelo con `readSection`. Las secciones fuera del snapshot (`warns`, `hygiene`, `membershipGate`, `raid`) se piden una a una con `/config/:section`.

## Auth y errores

`@UseGuards(InitDataGuard)` + `assertGroupAdmin` + `resolveChat`. Sin errores propios más allá de los del guard/autorización.

## Consumidor

No hay wrapper directo dedicado en `apps/web/lib/api.ts`; la web arma la vista de config sección a sección con `getSection` (`api.ts:150`). El snapshot está disponible como `GET /v1/miniapp/groups/:gid/config`.

## Relaciones

- **Pertenece a**: [[Controller config]] / [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]].
- **Utilizado por**: [[Pantalla config]].
- **Consume**: [[Modelo WelcomeConfig]], [[Modelo AntifloodConfig]], [[Modelo CaptchaConfig]], [[Modelo ContentLock]].
- **Relacionado con**: [[Endpoint GET v1 miniapp groups gid config section]], [[API Map]].

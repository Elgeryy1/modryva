---
id: endpoint-get-v1-miniapp-groups-gid-config-section
title: Endpoint GET v1 miniapp groups gid config section
type: endpoint
domain: api
status: implemented
maturity: stable
source: [apps/api/src/miniapp/config.controller.ts]
tags: [modryva, endpoint, api]
aliases: [GET /v1/miniapp/groups/:gid/config/:section]
created: 2026-07-12
updated: 2026-07-12
---

# Endpoint GET v1 miniapp groups gid config section

`section()` en [[Controller config]] (`apps/api/src/miniapp/config.controller.ts:391`). Lee una **sección de configuración** concreta del grupo.

## Entrada

- Path: `:gid` (grupo), `:section` (una de `welcome`, `rules`, `flood`, `captcha`, `locks`, `warns`, `hygiene`, `membershipGate`, `raid`).
- Cabecera `Authorization: tma <initData>`.

## Salida

Objeto con la forma de la sección (`readSection`, `:449`). Ejemplos: `flood` → `{ enabled, messageLimit, windowSeconds, action }`; `captcha` → `{ enabled, mode, failAction, timeoutSeconds, maxAttempts }`; `locks` → `{ locked: string[] }`; `welcome` → `{ welcomeText, goodbyeText }`. Las secciones sin fila devuelven defaults (`FLOOD_DEFAULT`, `CAPTCHA_DEFAULT`, `ANTIRAID_DEFAULT`).

## Auth y errores

`@UseGuards(InitDataGuard)` + `authorize` (`assertGroupAdmin` + `resolveChat`). Si el `section` no es válido → 400 `{ error: "unknown-section" }` (`:397`).

## Consumidor

`getSection<T>(gid, section)` en `apps/web/lib/api.ts:150`.

## Relaciones

- **Pertenece a**: [[Controller config]] / [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]].
- **Utilizado por**: [[Pantalla config]] (`getSection`).
- **Consume**: [[Modelo WelcomeConfig]], [[Modelo AntifloodConfig]], [[Modelo CaptchaConfig]], [[Modelo GroupProtection]].
- **Relacionado con**: [[Endpoint PUT v1 miniapp groups gid config section]], [[Endpoint GET v1 miniapp groups gid config]], [[API Map]].

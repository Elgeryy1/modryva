---
id: endpoint-put-v1-miniapp-groups-gid-config-section
title: Endpoint PUT v1 miniapp groups gid config section
type: endpoint
domain: api
status: implemented
maturity: stable
source: [apps/api/src/miniapp/config.controller.ts]
tags: [modryva, endpoint, api]
aliases: [PUT /v1/miniapp/groups/:gid/config/:section]
created: 2026-07-12
updated: 2026-07-12
---

# Endpoint PUT v1 miniapp groups gid config section

`update()` en [[Controller config]] (`apps/api/src/miniapp/config.controller.ts:404`). Escribe una **sección de configuración** del grupo tras validarla.

## Entrada

- Path: `:gid`, `:section` (ver [[Endpoint GET v1 miniapp groups gid config section]]).
- Body: la forma de la sección; se valida con `SECTION_SCHEMAS[section]` de `@superbot/shared` (`:417`).
- Cabecera `Authorization: tma <initData>`.

## Salida

La sección re-leída (`readSection`, `:439`), para que la web tenga el estado canónico tras el guardado.

## Efectos

`writeSection` (`:541`) hace el upsert en el repo correcto. Además registra auditoría `miniapp.<section>.updated` en [[Modelo AuditLog]] con `{ section, source: "miniapp", telegramUserId }` (`:430`).

## Auth y errores

`@UseGuards(InitDataGuard)` + `assertGroupAdmin`. Errores: 400 `unknown-section` si el section no es válido (`:411`); 400 `invalid-body` si el schema falla (`:418`).

## Consumidor

`putSection<T>(gid, section, body)` en `apps/web/lib/api.ts:153`.

## Relaciones

- **Pertenece a**: [[Controller config]] / [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `SECTION_SCHEMAS` (`@superbot/shared`).
- **Utilizado por**: [[Pantalla config]] (`putSection`).
- **Consume**: [[Modelo WelcomeConfig]], [[Modelo AntifloodConfig]], [[Modelo CaptchaConfig]], [[Modelo GroupProtection]], [[Modelo AuditLog]].
- **Relacionado con**: [[Endpoint GET v1 miniapp groups gid config section]], [[API Map]].

---
id: endpoint-get-v1-miniapp-groups-gid-backup-export
title: Endpoint GET v1 miniapp groups gid backup export
type: endpoint
domain: api
status: implemented
maturity: beta
source: [apps/api/src/miniapp/backup.controller.ts]
tags: [modryva, endpoint, api]
aliases: [GET /v1/miniapp/groups/:gid/backup/export]
created: 2026-07-12
updated: 2026-07-12
---

# Endpoint GET v1 miniapp groups gid backup export

`export()` en [[Controller backup]] (`apps/api/src/miniapp/backup.controller.ts:343`). Exporta toda la config del grupo como `BackupPayload` `version: 2`.

## Entrada

- Path: `:gid`. Cabecera `Authorization: tma <initData>`.

## Salida

`BackupPayload` (`:83`): `{ version: 2, exportedAt, sections, network }`. `sections` incluye welcome, rules, flood, captcha, locks, warns, hygiene, membershipGate, gamificationWelcomeButtons (`exportChat`, `:500`). `network` es `null` si el chat no está en federación, o la capa de red completa (config, roles, rutas, automatizaciones, roles internos) si lo está (`exportNetwork`, `:583`).

## Auth y errores

`@UseGuards(InitDataGuard)` + `assertGroupAdmin`. Sin errores propios.

## Consumidor

`exportBackup(gid)` en `apps/web/lib/api-backup.ts:54`.

## Relaciones

- **Pertenece a**: [[Controller backup]] / [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla backup]] (`exportBackup`).
- **Consume**: [[Modelo WelcomeConfig]], [[Modelo OwnerNetworkConfig]], [[Modelo Automation]].
- **Relacionado con**: [[Endpoint POST v1 miniapp groups gid backup import]], [[API Map]].

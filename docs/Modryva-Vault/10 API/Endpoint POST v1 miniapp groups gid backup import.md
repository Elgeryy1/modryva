---
id: endpoint-post-v1-miniapp-groups-gid-backup-import
title: Endpoint POST v1 miniapp groups gid backup import
type: endpoint
domain: api
status: implemented
maturity: beta
source: [apps/api/src/miniapp/backup.controller.ts]
tags: [modryva, endpoint, api]
aliases: [POST /v1/miniapp/groups/:gid/backup/import]
created: 2026-07-12
updated: 2026-07-12
---

# Endpoint POST v1 miniapp groups gid backup import

`import()` en [[Controller backup]] (`apps/api/src/miniapp/backup.controller.ts:352`). Aplica un backup previamente exportado sobre el grupo.

## Entrada

- Path: `:gid`. Body: `{ payload }` (un `BackupPayload` `version 1` o `2`).
- Cabecera `Authorization: tma <initData>`.

## Salida

El backup **re-exportado** del grupo tras aplicar (`exportChat`, `:376`), para devolver el estado canónico.

## Efectos

`parsePayload` (`:475`) valida versión y `sections`, normalizando con defaults (`normalizeSections`, `:780`). `applySections` (`:635`) escribe todas las secciones; `applyNetworkBackup` (`:696`) **reemplaza** roles/rutas/automatizaciones/roles internos de la red (borra y recrea). Registra auditoría `miniapp.backup.imported` (`:368`).

## Auth y errores

`@UseGuards(InitDataGuard)` + `assertGroupAdmin`. Errores: 400 `invalid-payload` (versión/estructura inválida, `:488`), 400 `not-in-network` si el payload trae capa de red pero el chat no está en federación (`:706`).

## Consumidor

`importBackup(gid, payload)` en `apps/web/lib/api-backup.ts:57`.

## Relaciones

- **Pertenece a**: [[Controller backup]] / [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla backup]] (`importBackup`).
- **Consume**: [[Modelo OwnerNetworkConfig]], [[Modelo Automation]], [[Modelo AuditLog]].
- **Relacionado con**: [[Endpoint GET v1 miniapp groups gid backup export]], [[API Map]].

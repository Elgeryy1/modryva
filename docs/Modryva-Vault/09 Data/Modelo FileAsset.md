---
id: modryva-model-fileasset
title: Modelo FileAsset
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/file-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo FileAsset

## Propósito
Registro de un archivo visto por el bot (por `fileUniqueId` de Telegram): tipo, mime, tamaño, nombre y
estado de escaneo. Tabla `file_assets`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `telegramUserId` | BigInt | Quien lo subió. |
| `fileUniqueId` / `fileId` | String | Identificadores Telegram. |
| `kind` / `mimeType` / `fileSize` / `fileName` | String/Int | Metadatos. |
| `scanStatus` | String | `@default("pending")`. |

## Índices / restricciones
`@@unique([tenantId, fileUniqueId])`; `@@index([tenantId, chatId])`.

## Enums usados
Ninguno.

## Acceso
`file-repository.ts` (registrar archivo, actualizar estado de escaneo).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: filtro de contenido / antivirus
- Relacionado con: [[Modelo ContentLockConfig]], [[Database Map]]

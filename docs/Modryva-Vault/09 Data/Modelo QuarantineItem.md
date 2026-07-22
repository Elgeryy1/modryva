---
id: modryva-model-quarantineitem
title: Modelo QuarantineItem
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/d1-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo QuarantineItem

## Propósito
Mensaje/usuario en cuarentena pendiente de revisión: motivo, estado y quién lo revisó. Tabla
`quarantine_items`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `telegramChatId` | BigInt | Chat (id Telegram). |
| `messageId` | Int? | Mensaje afectado. |
| `actorTelegramId` | BigInt | Autor del mensaje. |
| `username` / `text` | String? | Copia del contenido. |
| `reason` | String | Motivo de cuarentena. |
| `status` | String | `@default("pending")`. |
| `reviewedBy` / `reviewNote` / `reviewedAt` | BigInt? / String? / DateTime? | Revisión. |

## Índices / restricciones
`@@index([tenantId, chatId, status])`, `@@index([tenantId, actorTelegramId])`.

## Enums usados
Ninguno.

## Acceso
`d1-repository.ts` (encolar, listar pendientes, resolver). Ver [[Security Map]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: —
- Relacionado con: [[Modelo QuarantineConfig]], [[Modelo D1Appeal]], [[Database Map]]

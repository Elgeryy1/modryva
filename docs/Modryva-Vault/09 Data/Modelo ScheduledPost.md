---
id: modryva-model-scheduledpost
title: Modelo ScheduledPost
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/scheduled-post-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo ScheduledPost

## Propósito
Publicación programada: el bot envía `text` al chat en `runAt`. Tabla `scheduled_posts`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto interno. |
| `telegramChatId` | BigInt | Chat destino. |
| `text` | String | Contenido. |
| `status` | String | `@default("pending")`. |
| `runAt` / `sentAt` | DateTime / DateTime? | Programación / envío. |
| `createdBy` | String? | Autor. |

## Índices / restricciones
`@@index([status, runAt])` (barrido del scheduler), `@@index([tenantId, chatId])`.

## Enums usados
Ninguno.

## Acceso
`scheduled-post-repository.ts` (crear/listar; el worker envía los vencidos).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: scheduler ([[Infrastructure Map]])
- Relacionado con: [[Modelo Reminder]], [[Modelo PostReaction]], [[Database Map]]

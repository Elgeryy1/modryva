---
id: modryva-model-postreaction
title: Modelo PostReaction
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

# Modelo PostReaction

## Propósito
Reacción (emoji) de un usuario a un mensaje concreto, para botones de reacción propios del bot. Tabla
`post_reactions`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `messageId` | Int | Mensaje. |
| `telegramUserId` | BigInt | Usuario. |
| `emoji` | String | Reacción. |

## Índices / restricciones
`@@unique([chatId, messageId, telegramUserId])`; `@@index([chatId, messageId])`.

## Enums usados
Ninguno.

## Acceso
`scheduled-post-repository.ts` (registrar/contar reacciones a un post).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: —
- Relacionado con: [[Modelo ScheduledPost]], [[Database Map]]

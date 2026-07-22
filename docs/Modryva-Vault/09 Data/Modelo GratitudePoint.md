---
id: modryva-model-gratitudepoint
title: Modelo GratitudePoint
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/gratitude-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo GratitudePoint

## Propósito
Puntos de gratitud acumulados por un usuario en un chat (agradecimientos tipo "+1"/thanks). Tabla
`gratitude_points`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `userTelegramId` | BigInt | Usuario. |
| `points` | Int | `@default(0)`. |

## Índices / restricciones
`@@unique([tenantId, chatId, userTelegramId])`; `@@index([tenantId, chatId])`.

## Enums usados
Ninguno.

## Acceso
`gratitude-repository.ts` (sumar puntos, leaderboard). Ver [[Gratitude Points]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Gratitude Points]]
- Relacionado con: [[Modelo ReputationProfile]], [[Database Map]]

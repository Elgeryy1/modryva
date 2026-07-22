---
id: modryva-model-reputationprofile
title: Modelo ReputationProfile
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/reputation-repository.ts
tags:
  - modryva
  - model
  - data
aliases: [Modelo Reputation]
created: 2026-07-12
updated: 2026-07-12
---

# Modelo ReputationProfile

## Propósito
Perfil de reputación de un usuario en un chat: puntos y XP. Base de rankings/niveles. Tabla
`reputation_profiles`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `telegramUserId` | BigInt | Usuario. |
| `points` / `xp` | Int | `@default(0)`. |

## Índices / restricciones
`@@unique([chatId, telegramUserId])`; `@@index([tenantId, chatId])`, `@@index([chatId, points])`
(leaderboard).

## Enums usados
Ninguno.

## Acceso
`reputation-repository.ts` (sumar puntos/XP, ranking). Resuelve el usuario interno vía
[[Modelo AppUser]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: leaderboards de comunidad
- Relacionado con: [[Modelo GratitudePoint]], [[Modelo UserBadge]], [[Modelo UserActivity]], [[Database Map]]

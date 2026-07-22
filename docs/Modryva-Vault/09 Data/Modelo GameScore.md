---
id: modryva-model-gamescore
title: Modelo GameScore
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/game-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo GameScore

## Propósito
Puntuación acumulada de un usuario en los mini-juegos de un chat (leaderboard de juegos). Tabla
`game_scores`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `telegramUserId` | BigInt | Usuario. |
| `points` | Int | `@default(0)`. |

## Índices / restricciones
`@@unique([chatId, telegramUserId])`; `@@index([chatId, points])` (ranking).

## Enums usados
Ninguno.

## Acceso
`game-repository.ts` (sumar puntos al ganar; leaderboard). Resuelve el usuario interno vía
[[Modelo AppUser]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: leaderboard de juegos
- Relacionado con: [[Modelo GameSession]], [[Modelo ReputationProfile]], [[Database Map]]

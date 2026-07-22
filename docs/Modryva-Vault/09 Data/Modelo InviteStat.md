---
id: modryva-model-invitestat
title: Modelo InviteStat
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/invite-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo InviteStat

## Propósito
Contador de invitaciones por usuario en un chat (quién trajo cuánta gente). Tabla `invite_stats`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `inviterTelegramId` | BigInt | Invitador. |
| `count` | Int | `@default(0)`. |

## Índices / restricciones
`@@unique([chatId, inviterTelegramId])`; `@@index([tenantId, chatId])`, `@@index([chatId, count])`
(ranking).

## Enums usados
Ninguno.

## Acceso
`invite-repository.ts` (incrementar contador al detectar entradas, leaderboard de invitaciones).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: leaderboard de invitaciones
- Relacionado con: [[Modelo Membership]], [[Modelo UserActivity]], [[Database Map]]

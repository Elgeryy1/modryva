---
id: modryva-model-userbadge
title: Modelo UserBadge
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

# Modelo UserBadge

## Propósito
Insignia otorgada a un usuario en un chat (por completar misiones u otros logros). Tabla `user_badges`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `telegramUserId` | BigInt | Usuario. |
| `badgeKey` / `title` | String | Identificador y nombre. |
| `awardedAt` | DateTime | `@default(now())`. |

## Índices / restricciones
`@@unique([tenantId, chatId, telegramUserId, badgeKey])`; `@@index([tenantId, chatId, telegramUserId])`.

## Enums usados
Ninguno.

## Acceso
`d1-repository.ts` (otorgar/listar insignias).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: —
- Relacionado con: [[Modelo Mission]], [[Modelo MissionProgress]], [[Modelo ReputationProfile]], [[Database Map]]

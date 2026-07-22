---
id: modryva-model-useractivity
title: Modelo UserActivity
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/analytics-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo UserActivity

## Propósito
Contador de mensajes por usuario en un chat (para top usuarios / leaderboards de actividad). Guarda
`username` para mostrar nombre sin resolver el id. Tabla `user_activity`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `telegramUserId` | BigInt | Usuario. |
| `username` | String? | Nombre cacheado. |
| `messages` | Int | `@default(0)`. |

## Índices / restricciones
`@@unique([chatId, telegramUserId])`; `@@index([chatId])`.

## Enums usados
Ninguno.

## Acceso
`analytics-repository.ts` (incrementar por mensaje; top usuarios). Ver [[Activity y Analytics]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Activity y Analytics]], [[Recap Semanal]]
- Relacionado con: [[Modelo ActivityDaily]], [[Modelo ReputationProfile]], [[Database Map]]

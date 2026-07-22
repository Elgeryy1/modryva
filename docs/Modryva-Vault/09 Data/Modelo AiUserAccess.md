---
id: modryva-model-aiuseraccess
title: Modelo AiUserAccess
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/ai-access-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo AiUserAccess

## Propósito
Acceso a IA **personal**: a diferencia de [[Modelo AiChatAccess]] (por grupo), sigue al usuario de
Telegram por todos los chats (grupo o DM). Tabla `ai_user_access`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `telegramUserId` | BigInt | `@unique`. |
| `expiresAt` | DateTime | Caducidad. |
| `grantedBy` | String | Origen de la concesión. |

## Índices / restricciones
`telegramUserId @unique`.

## Enums usados
Ninguno.

## Acceso
`ai-access-repository.ts` (crear/renovar; comprobar acceso personal en cualquier chat).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: gate de IA por usuario
- Relacionado con: [[Modelo AiChatAccess]], [[Modelo AiSubscription]], [[Database Map]]

---
id: modryva-model-aisubscription
title: Modelo AiSubscription
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

# Modelo AiSubscription

## Propósito
Suscripción viva de Telegram Stars detrás de un acceso de IA (por chat o personal), con clave
`(scope, targetId)` para casar las renovaciones automáticas (`successful_payment` de cada periodo) sin
correlacionar charge ids. Tabla `ai_subscriptions`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `scope` / `targetId` | String / BigInt | Ámbito (chat/usuario) y destino. |
| `telegramUserId` | BigInt | Pagador. |
| `lastChargeId` | String | Último cargo. |
| `currentPeriodEnd` | DateTime | Fin del periodo actual. |
| `canceled` | Boolean | `@default(false)`. |

## Índices / restricciones
`@@unique([scope, targetId])`.

## Enums usados
Ninguno.

## Acceso
`ai-access-repository.ts` (crear/renovar/cancelar; extiende [[Modelo AiChatAccess]] o
[[Modelo AiUserAccess]] en cada renovación).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: renovación de acceso IA
- Relacionado con: [[Modelo AiChatAccess]], [[Modelo AiUserAccess]], [[Modelo Payment]], [[Database Map]]

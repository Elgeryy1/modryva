---
id: modryva-model-aimemory
title: Modelo AiMemory
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/ai-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo AiMemory

## Propósito
Memoria clave-valor de la IA con `scope` y `subjectId` (recuerdos por usuario/chat/tenant), con
`confidence` y `source`. Tabla `ai_memories`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | Tenant. |
| `scope` / `subjectId` | String | Ámbito y sujeto de la memoria. |
| `chatId` / `telegramUserId` | String? / BigInt? | Contexto opcional. |
| `key` / `value` | String | Dato recordado. |
| `source` | String | `@default("user")`. |
| `confidence` | Float | `@default(0.8)`. |

## Índices / restricciones
`@@unique([tenantId, scope, subjectId, key])`; `@@index([tenantId, scope, subjectId])`,
`@@index([tenantId, chatId])`, `@@index([tenantId, telegramUserId])`.

## Enums usados
Ninguno.

## Acceso
`ai-repository.ts` (upsert de recuerdos; recuperación para el prompt).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Módulo ai]]
- Relacionado con: [[Modelo AiConversation]], [[Database Map]]

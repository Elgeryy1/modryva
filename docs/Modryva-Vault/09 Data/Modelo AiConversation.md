---
id: modryva-model-aiconversation
title: Modelo AiConversation
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

# Modelo AiConversation

## Propósito
Conversación de IA de un usuario en un chat (contenedor de [[Modelo AiMessage]]). Una por
`(chatId, telegramUserId)`. Tabla `ai_conversations`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `telegramUserId` | BigInt | Usuario. |

## Índices / restricciones
`@@unique([chatId, telegramUserId])`; `@@index([tenantId, chatId])`. Relación `messages AiMessage[]`.

## Enums usados
Ninguno.

## Acceso
`ai-repository.ts` (upsert de conversación, cargar historial). Ver [[Módulo ai]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo AiMessage]]
- Relacionado con: [[Modelo AiMemory]], [[Modelo AiUsage]], [[Database Map]]

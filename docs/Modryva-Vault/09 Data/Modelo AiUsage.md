---
id: modryva-model-aiusage
title: Modelo AiUsage
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

# Modelo AiUsage

## Propósito
Registro de consumo de IA por usuario/chat: proveedor y tokens de entrada/salida (para cuotas y coste).
Tabla `ai_usage`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `telegramUserId` | BigInt | Usuario. |
| `provider` | String | Groq / Gemini / OpenRouter… |
| `tokensIn` / `tokensOut` | Int | `@default(0)`. |

## Índices / restricciones
`@@index([tenantId, chatId, createdAt])`. Sin `updatedAt`.

## Enums usados
Ninguno.

## Acceso
`ai-repository.ts` (escritura tras cada llamada al modelo).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: control de cuotas / analítica de IA
- Relacionado con: [[Modelo AiConversation]], [[Modelo AiChatAccess]], [[Database Map]]

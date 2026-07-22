---
id: modryva-model-aimessage
title: Modelo AiMessage
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

# Modelo AiMessage

## Propósito
Mensaje individual (rol + contenido) dentro de una [[Modelo AiConversation]]. Tabla `ai_messages`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `conversationId` | String | FK → [[Modelo AiConversation]] (`onDelete: Cascade`). |
| `role` | String | user / assistant / system. |
| `content` | String | Texto. |

## Índices / restricciones
`@@index([conversationId])`. FK a `AiConversation`. Sin `updatedAt`.

## Enums usados
Ninguno.

## Acceso
`ai-repository.ts` (append de mensajes; reconstruir contexto del prompt).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: —
- Relacionado con: [[Modelo AiConversation]], [[Database Map]]

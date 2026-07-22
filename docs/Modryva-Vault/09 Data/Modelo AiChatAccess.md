---
id: modryva-model-aichataccess
title: Modelo AiChatAccess
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

# Modelo AiChatAccess

## Propósito
Concesión de acceso a IA **por chat** (un grant por grupo), con caducidad. Se crea al canjear un
[[Modelo AiAccessCode]]. Tabla `ai_chat_access`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `chatId` | BigInt | `@unique` (id de Telegram del chat). |
| `expiresAt` | DateTime | Caducidad. |
| `grantedByCode` | String | Código que lo concedió. |

## Índices / restricciones
`chatId @unique`.

## Enums usados
Ninguno.

## Acceso
`ai-access-repository.ts` (crear al canjear; comprobar si un chat tiene IA activa).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: gate de IA por chat
- Relacionado con: [[Modelo AiAccessCode]], [[Modelo AiUserAccess]], [[Database Map]]

---
id: modryva-model-aiaccesscode
title: Modelo AiAccessCode
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

# Modelo AiAccessCode

## Propósito
Código que habilita el uso real de IA (Groq/Gemini/OpenRouter) en un chat concreto, independiente del
master switch global `AI_ENABLED`. Lo genera el dueño de plataforma y se canjea una vez por chat con
`/aicode`. Se guarda el hash del código. Tabla `ai_access_codes`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `codeHash` | String | `@unique` (hash del código). |
| `codePrefix` | String | Prefijo visible. |
| `days` | Int | Duración concedida. |
| `note` | String? | Nota interna. |
| `createdByTelegramId` | BigInt | Emisor. |
| `redeemedByChatId` / `redeemedAt` | BigInt? / DateTime? | Canje. |

## Índices / restricciones
`codeHash @unique`; `@@index([createdByTelegramId])`.

## Enums usados
Ninguno.

## Acceso
`ai-access-repository.ts` (generar y canjear; el canje crea [[Modelo AiChatAccess]]). Ver
[[Comando aipack]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo AiChatAccess]]
- Relacionado con: [[Modelo AiUserAccess]], [[Modelo AiSubscription]], [[Database Map]]

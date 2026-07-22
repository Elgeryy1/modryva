---
id: modryva-model-poll
title: Modelo Poll
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/poll-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo Poll

## Propósito
Encuesta creada en un chat: pregunta, opciones (`Json`) y estado abierto/cerrado. Los votos van en
[[Modelo PollVote]]. Tabla `polls`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `question` | String | Pregunta. |
| `options` | Json | Opciones. |
| `closed` | Boolean | `@default(false)`. |
| `createdBy` | String? | Autor. |

## Índices / restricciones
`@@index([tenantId, chatId])`. Relación `votes PollVote[]`.

## Enums usados
Ninguno.

## Acceso
`poll-repository.ts` (crear/cerrar encuesta, contar resultados).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Polls]]
- Relacionado con: [[Modelo PollVote]], [[Database Map]]

---
id: modryva-model-pollvote
title: Modelo PollVote
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

# Modelo PollVote

## Propósito
Voto de un usuario en una [[Modelo Poll]] (un voto por usuario). Tabla `poll_votes`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `pollId` | String | FK → [[Modelo Poll]] (`onDelete: Cascade`). |
| `telegramUserId` | BigInt | Votante. |
| `optionIndex` | Int | Opción elegida. |

## Índices / restricciones
`@@unique([pollId, telegramUserId])`; `@@index([pollId])`. FK a `Poll`.

## Enums usados
Ninguno.

## Acceso
`poll-repository.ts` (registrar/actualizar voto, upsert por usuario).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: —
- Relacionado con: [[Modelo Poll]], [[Database Map]]

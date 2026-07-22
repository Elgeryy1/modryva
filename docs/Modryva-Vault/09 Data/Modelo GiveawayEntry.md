---
id: modryva-model-giveawayentry
title: Modelo GiveawayEntry
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/giveaway-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo GiveawayEntry

## Propósito
Participación de un usuario en un [[Modelo Giveaway]] (una por usuario). Tabla `giveaway_entries`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `giveawayId` | String | FK → [[Modelo Giveaway]] (`onDelete: Cascade`). |
| `telegramUserId` | BigInt | Participante. |

## Índices / restricciones
`@@unique([giveawayId, telegramUserId])`; `@@index([giveawayId])`. FK a `Giveaway`.

## Enums usados
Ninguno.

## Acceso
`giveaway-repository.ts` (registrar participación; barajar para elegir ganador).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: —
- Relacionado con: [[Modelo Giveaway]], [[Database Map]]

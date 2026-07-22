---
id: modryva-model-tournament
title: Modelo Tournament
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/chip-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo Tournament

## Propósito
Torneo semanal de casino. La puntuación (fichas netas en la ventana ISO-semana) se **deriva de**
[[Modelo ChipLedger]], no se almacena. Se liquida perezosamente en la primera lectura tras cerrar la
ventana: los mejores cobran del `prizePool` (financiado por el rake). Tabla `tournaments`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | Tenant. |
| `period` | String | Semana ISO, p. ej. "2026-W27". |
| `startsAt` / `endsAt` | DateTime | Ventana. |
| `status` | String | `@default("open")` (open/settled). |
| `prizePool` | Int | `@default(0)`. |
| `winners` | Json? | `[{ telegramUserId, prize, net }]` al liquidar. |
| `settledAt` | DateTime? | Liquidación. |

## Índices / restricciones
`@@unique([tenantId, period])`.

## Enums usados
Ninguno.

## Acceso
`chip-repository.ts` (abrir por semana, financiar el pozo con rake, liquidar y pagar).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Servicio casino]]
- Relacionado con: [[Modelo ChipLedger]], [[Modelo Jackpot]], [[Casino Map]], [[Database Map]]

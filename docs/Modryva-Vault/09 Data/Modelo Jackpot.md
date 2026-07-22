---
id: modryva-model-jackpot
title: Modelo Jackpot
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
aliases: [Modelo CasinoJackpot]
created: 2026-07-12
updated: 2026-07-12
---

# Modelo Jackpot

## Propósito
Bote progresivo: un único pozo creciente por tenant. Cada apuesta desvía un pequeño rake al bote (ver
`ChipRepository.placeBet`) y una tirada provably-fair rara lo otorga. Tabla `jackpots`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | `@unique` (un bote por tenant). |
| `amount` | Int | `@default(0)`. |

## Índices / restricciones
`tenantId @unique`.

## Enums usados
Ninguno.

## Acceso
`chip-repository.ts` (acumular rake; otorgar el bote al ganar).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Servicio casino]]
- Relacionado con: [[Modelo ChipWallet]], [[Modelo Tournament]], [[Casino Map]], [[Database Map]]

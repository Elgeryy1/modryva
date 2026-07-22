---
id: modryva-model-casinobet
title: Modelo CasinoBet
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

# Modelo CasinoBet

## Propósito
Apuesta en un juego de casino (crash, mines, blackjack…) con estado mutable (`state Json`) para juegos
por turnos. Congela el trío provably-fair (`serverSeed`, `serverSeedHash`, `clientSeed`, `nonce`) del
momento de la apuesta para reproducir el resultado. Tabla `casino_bets`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | Tenant. |
| `telegramUserId` | BigInt | Jugador. |
| `game` | String | crash / mines / blackjack… |
| `stake` | Int | Apuesta. |
| `status` | String | `@default("open")` (open/settled). |
| `serverSeed` / `serverSeedHash` / `clientSeed` / `nonce` | String / Int | Provably-fair. |
| `state` | Json | Estado del juego. |
| `payout` | Int | `@default(0)`. |

## Índices / restricciones
`@@index([tenantId, telegramUserId, status])`.

## Enums usados
Ninguno.

## Acceso
`chip-repository.ts` (abrir apuesta, actualizar estado por turno, liquidar payout). Ver
[[Casino Bet Lifecycle]], [[Provably Fair]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Servicio casino]] y cada juego ([[Juego Crash]], [[Juego Mines]], [[Juego Blackjack]])
- Relacionado con: [[Modelo ChipWallet]], [[Modelo ChipLedger]], [[Casino Map]], [[Database Map]]

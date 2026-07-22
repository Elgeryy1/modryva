---
id: modryva-model-chipwallet
title: Modelo ChipWallet
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

# Modelo ChipWallet

## Propósito
Monedero de fichas del casino (virtuales, no canjeables) por usuario/tenant. Guarda el par
commit-reveal provably-fair: `serverSeed` (secreto hasta rotación), `serverSeedHash` (commit público) y
`clientSeed`, más un `nonce` que incrementa por apuesta para reproducir cada resultado. Tabla
`chip_wallets`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | Tenant. |
| `telegramUserId` | BigInt | Usuario. |
| `balance` | Int | `@default(0)`. |
| `serverSeed` / `serverSeedHash` / `clientSeed` | String | Provably-fair. |
| `nonce` | Int | `@default(0)`, incrementa por apuesta. |

## Índices / restricciones
`@@unique([tenantId, telegramUserId])`; `@@index([tenantId])`.

## Enums usados
Ninguno.

## Acceso
`chip-repository.ts` (`placeBet`, ajustes de saldo, rotación de semilla). Es el modelo más accedido del
casino. Ver [[Chip Economy]], [[Provably Fair]], [[Módulo games]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo ChipLedger]], [[Modelo CasinoBet]], [[Modelo CasinoDuel]]
- Relacionado con: [[Modelo Jackpot]], [[Casino Map]], [[Database Map]]

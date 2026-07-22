---
id: modryva-model-economywallet
title: Modelo EconomyWallet
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/economy-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo EconomyWallet

## Propósito
Monedero de la economía social ligera por chat (distinta del casino): saldo y marca del último "earn"
para cooldown de recompensas. Tabla `economy_wallets`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `userTelegramId` | BigInt | Usuario. |
| `balance` | Int | `@default(0)`. |
| `lastEarnedMs` | BigInt | `@default(0)` (cooldown). |

## Índices / restricciones
`@@unique([tenantId, chatId, userTelegramId])`.

## Enums usados
Ninguno.

## Acceso
`economy-repository.ts` (earn/gastar con cooldown, saldo).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: economía social de comunidad
- Relacionado con: [[Modelo ChipWallet]], [[Modelo ReputationProfile]], [[Database Map]]

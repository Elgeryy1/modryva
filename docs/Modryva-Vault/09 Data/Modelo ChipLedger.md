---
id: modryva-model-chipledger
title: Modelo ChipLedger
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

# Modelo ChipLedger

## Propósito
Libro mayor de movimientos de fichas (delta + motivo). `refId` liga la fila a su origen (id de apuesta o
día UTC del bono diario); el `@@unique` compuesto hace idempotentes los abonos (diario/bono). `chargeId`
es la clave de idempotencia de Telegram Stars (un abono por compra). Tabla `chip_ledger`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | Tenant. |
| `telegramUserId` | BigInt | Usuario. |
| `delta` | Int | Movimiento (+/-). |
| `reason` | String | Motivo. |
| `refId` | String? | Origen (bet id / día). |
| `chargeId` | String? | `@unique` (idempotencia Stars). |

## Índices / restricciones
`@@unique([tenantId, telegramUserId, reason, refId])`, `chargeId @unique`;
`@@index([tenantId, telegramUserId])`. Sin `updatedAt` (append-only).

## Enums usados
Ninguno.

## Acceso
`chip-repository.ts` (registrar cada movimiento; base de la puntuación de [[Modelo Tournament]] y del
score de duelos). Ver [[Chip Economy]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo Tournament]] (score derivado)
- Relacionado con: [[Modelo ChipWallet]], [[Modelo Payment]], [[Casino Map]], [[Database Map]]

---
id: modryva-model-casinoduel
title: Modelo CasinoDuel
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

# Modelo CasinoDuel

## Propósito
Duelo de fichas 1v1 en un chat: un retador pone `stake`, otro acepta y se resuelve con una tirada.
Estados: open → rolling → settled | cancelled. Tabla `casino_duels`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `challengerId` / `challengerName` | BigInt / String? | Retador. |
| `stake` | Int | Apuesta. |
| `status` | String | `@default("open")`. |
| `opponentId` / `winnerId` | BigInt? | Oponente / ganador. |

## Índices / restricciones
`@@index([tenantId, status])`.

## Enums usados
Ninguno.

## Acceso
`chip-repository.ts` (crear/aceptar/resolver duelo; mueve saldo vía [[Modelo ChipWallet]]/[[Modelo ChipLedger]]).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Servicio casino]]
- Relacionado con: [[Modelo CasinoBet]], [[Modelo ChipWallet]], [[Casino Map]], [[Database Map]]

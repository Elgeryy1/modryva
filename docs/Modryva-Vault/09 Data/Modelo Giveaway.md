---
id: modryva-model-giveaway
title: Modelo Giveaway
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

# Modelo Giveaway

## Propósito
Sorteo en un chat: premio, estado y ganador. Usa `seed` para sorteo reproducible. Las participaciones
van en [[Modelo GiveawayEntry]]. Tabla `giveaways`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `prize` | String | Premio. |
| `status` | String | `@default("open")`. |
| `seed` | String? | Semilla del sorteo. |
| `winnerTelegramId` | BigInt? | Ganador. |
| `createdBy` | String? | Autor. |

## Índices / restricciones
`@@index([tenantId, chatId])`. Relación `entries GiveawayEntry[]`.

## Enums usados
Ninguno.

## Acceso
`giveaway-repository.ts` (crear/cerrar/sortear). Ver [[Giveaways]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Giveaways]]
- Relacionado con: [[Modelo GiveawayEntry]], [[Database Map]]

---
id: enum-managedbotstatus
title: Enum ManagedBotStatus
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
tags:
  - modryva
  - model
  - data
  - enum
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Enum ManagedBotStatus

Estado del ciclo de vida de un bot hijo gestionado por la plataforma ([[Modelo ManagedBot]]).

## Valores

| Valor | Significado |
|---|---|
| `pending` | Alta pendiente de activación. |
| `active` | Bot operativo (valor por defecto: `@default(active)`). |
| `suspended` | Suspendido. |
| `revoked` | Acceso revocado. |
| `failed` | Falló la activación (ver `lastError`). |

## Usado por

- [[Modelo ManagedBot]] — campo `status ManagedBotStatus @default(active)` (con `@@index([status])`).

## Relaciones

- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo ManagedBot]]
- Relacionado con: [[Database Map]], [[Modryva Hub Map]]

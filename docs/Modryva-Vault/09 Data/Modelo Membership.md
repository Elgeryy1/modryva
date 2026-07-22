---
id: modryva-model-membership
title: Modelo Membership
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/foundation-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo Membership

## Propósito
Relación usuario↔chat: pertenencia de un [[Modelo AppUser]] a un [[Modelo Chat]] con su rol y fechas de
alta/baja. Tabla `memberships`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` / `userId` | String | FKs (todas `onDelete: Cascade`). |
| `role` | String | `@default("member")` (member/admin/creator…). |
| `joinedAt` / `leftAt` | DateTime / DateTime? | Ciclo de vida. |

## Índices / restricciones
`@@index([tenantId, chatId])`, `@@index([tenantId, userId])`. FKs a `Tenant`, `Chat`, `AppUser`.

## Enums usados
Ninguno.

## Acceso
`foundation-repository.ts` (upsert al detectar entrada/salida o actividad).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: —
- Relacionado con: [[Modelo AppUser]], [[Modelo Chat]], [[Modelo Tenant]], [[Database Map]]

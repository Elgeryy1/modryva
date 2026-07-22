---
id: modryva-model-sanction
title: Modelo Sanction
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/moderation-repository.ts
  - packages/data/src/expiration-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo Sanction

## Propósito
Sanción aplicada a un [[Modelo AppUser]] (ban, mute, restrict, warn, delete, lock), con vigencia y
estado. Puede ligarse a un [[Modelo ModerationCase]]. Tabla `sanctions`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | Tenant. |
| `caseId` | String? | Caso asociado. |
| `userId` | String | FK → [[Modelo AppUser]] (`onDelete: Cascade`). |
| `kind` | [[Enum SanctionKind]] | Tipo de sanción. |
| `status` | String | `@default("active")`. |
| `startsAt` / `endsAt` | DateTime / DateTime? | Vigencia. |
| `reason` / `payload` | String? / Json? | Detalles. |

## Índices / restricciones
`@@index([tenantId, userId, status])`. FK a `AppUser`.

## Enums usados
[[Enum SanctionKind]]

## Acceso
`moderation-repository.ts` (crear/revertir sanciones vía `updateMany`); `expiration-repository.ts`
(caducar sanciones temporales). Producido por [[Comando ban]], `/mute`, `/warn`, etc. Ver
[[Módulo security]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Comando ban]]
- Relacionado con: [[Modelo AppUser]], [[Modelo ModerationCase]], [[Modelo Warning]], [[Database Map]]

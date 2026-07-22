---
id: modryva-model-warning
title: Modelo Warning
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/moderation-repository.ts
  - packages/data/src/moderation-extra-repository.ts
  - packages/data/src/expiration-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo Warning

## Propósito
Aviso (warn) sobre un [[Modelo AppUser]] con peso y caducidad. Al superar el límite de
[[Modelo WarnPolicyConfig]] se dispara la sanción configurada. Tabla `warnings`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | Tenant. |
| `userId` | String | FK → [[Modelo AppUser]] (`onDelete: Cascade`). |
| `caseId` | String? | Caso asociado. |
| `reason` | String? | Motivo. |
| `weight` | Int | `@default(1)`. |
| `expiresAt` / `expiredAt` | DateTime? | Caducidad programada / efectiva. |

## Índices / restricciones
`@@index([tenantId, userId])`, `@@index([expiresAt, expiredAt])`.

## Enums usados
Ninguno.

## Acceso
`moderation-repository.ts` (crear/contar warns), `moderation-extra-repository.ts` (gestión extra) y
`expiration-repository.ts` (caducar). Ver [[Módulo security]], [[Modelo WarnPolicyConfig]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo WarnPolicyConfig]]
- Relacionado con: [[Modelo AppUser]], [[Modelo Sanction]], [[Modelo ModerationCase]], [[Database Map]]

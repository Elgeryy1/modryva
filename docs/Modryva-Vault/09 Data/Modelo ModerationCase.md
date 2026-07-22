---
id: modryva-model-moderationcase
title: Modelo ModerationCase
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/moderation-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo ModerationCase

## Propósito
Caso de moderación con número correlativo por tenant. Agrupa la acción sobre un usuario sujeto (motivo,
estado, payload). Tabla `moderation_cases`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | FK → [[Modelo Tenant]] (`onDelete: Cascade`). |
| `chatId` | String? | FK → [[Modelo Chat]]. |
| `caseNumber` | Int | Correlativo por tenant. |
| `subjectUserId` | String? | Usuario sancionado. |
| `status` | String | `@default("open")`. |
| `reason` / `payload` | String? / Json? | Detalles. |

## Índices / restricciones
`@@unique([tenantId, caseNumber])`; `@@index([tenantId, chatId])`. El `caseNumber` se calcula con
`aggregate` (max+1) en el repo.

## Enums usados
Ninguno.

## Acceso
`moderation-repository.ts` (crear caso al registrar warn/sanción; listar por usuario).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo Sanction]], [[Modelo Warning]] (via `caseId`)
- Relacionado con: [[Modelo Chat]], [[Modelo Tenant]], [[Security Map]], [[Database Map]]

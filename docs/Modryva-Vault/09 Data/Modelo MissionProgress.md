---
id: modryva-model-missionprogress
title: Modelo MissionProgress
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/d1-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo MissionProgress

## Propósito
Progreso de un usuario hacia una [[Modelo Mission]], con marca de finalización. Tabla
`mission_progress`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `missionId` | String | FK → [[Modelo Mission]] (`onDelete: Cascade`). |
| `telegramUserId` | BigInt | Usuario. |
| `progress` | Int | `@default(0)`. |
| `completedAt` | DateTime? | Finalización. |

## Índices / restricciones
`@@unique([missionId, telegramUserId])`; `@@index([telegramUserId])`. FK a `Mission`.

## Enums usados
Ninguno.

## Acceso
`d1-repository.ts` (incrementar progreso, marcar completada, otorgar [[Modelo UserBadge]]).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: —
- Relacionado con: [[Modelo Mission]], [[Modelo UserBadge]], [[Database Map]]

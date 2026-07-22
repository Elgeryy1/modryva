---
id: modryva-model-mission
title: Modelo Mission
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

# Modelo Mission

## Propósito
Misión/reto de comunidad por chat: objetivo (`goalKind`/`goalTarget`) y `rewardBadge` al completarla.
El progreso por usuario vive en [[Modelo MissionProgress]]. Tabla `missions`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `title` | String | Nombre de la misión. |
| `goalKind` / `goalTarget` | String / Int | Objetivo. |
| `rewardBadge` | String | Insignia de recompensa. |
| `active` | Boolean | `@default(true)`. |

## Índices / restricciones
`@@index([tenantId, chatId, active])`. Relación `progress MissionProgress[]`.

## Enums usados
Ninguno.

## Acceso
`d1-repository.ts` (crear/listar misiones y progresarlas).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo MissionProgress]], [[Modelo UserBadge]]
- Relacionado con: [[Modelo CoopMissionState]], [[Database Map]]

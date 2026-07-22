---
id: modryva-model-coopmissionstate
title: Modelo CoopMissionState
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/coop-mission-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo CoopMissionState

## Propósito
Estado de la misión cooperativa de comunidad de un chat: meta compartida y progreso acumulado del grupo.
Tabla `coop_missions`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `goal` / `progress` | Int | Meta y avance. |
| `description` | String | `@default("")`. |

## Índices / restricciones
`@@unique([tenantId, chatId])` (un estado por chat).

## Enums usados
Ninguno.

## Acceso
`coop-mission-repository.ts` (fijar meta, incrementar progreso). Ver [[Coop Missions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Coop Missions]]
- Relacionado con: [[Modelo Mission]], [[Database Map]]

---
id: modryva-model-activitydaily
title: Modelo ActivityDaily
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/analytics-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo ActivityDaily

## Propósito
Contador de mensajes por chat y día (serie temporal para gráficas de actividad). Tabla `activity_daily`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `day` | String | Día (clave). |
| `messages` | Int | `@default(0)`. |

## Índices / restricciones
`@@unique([chatId, day])`; `@@index([tenantId, chatId])`.

## Enums usados
Ninguno.

## Acceso
`analytics-repository.ts` (incrementar por mensaje; series de actividad). Ver [[Activity y Analytics]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Activity y Analytics]], [[Recap Semanal]]
- Relacionado con: [[Modelo UserActivity]], [[Database Map]]

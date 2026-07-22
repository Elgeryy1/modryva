---
id: modryva-model-task
title: Modelo Task
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/productivity-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo Task

## Propósito
Tarea (to-do) de un usuario en un chat, numerada por chat. Tabla `tasks`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `telegramUserId` | BigInt | Dueño. |
| `title` | String | Descripción. |
| `done` | Boolean | `@default(false)`. |
| `number` | Int | Correlativo por chat. |

## Índices / restricciones
`@@unique([chatId, number])`; `@@index([tenantId, chatId, done])`.

## Enums usados
Ninguno.

## Acceso
`productivity-repository.ts` (añadir/completar/listar tareas).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: —
- Relacionado con: [[Modelo Reminder]], [[Modelo AfkStatus]], [[Database Map]]

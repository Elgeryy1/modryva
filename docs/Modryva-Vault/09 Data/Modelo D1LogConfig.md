---
id: modryva-model-d1logconfig
title: Modelo D1LogConfig
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

# Modelo D1LogConfig

## Propósito
Config del "centro de control D1": a qué chat de log se envían los eventos de un chat vigilado. Tabla
`d1_log_configs`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Chat vigilado. |
| `logTelegramChatId` | BigInt | Chat de log destino. |
| `enabled` | Boolean | `@default(true)`. |

## Índices / restricciones
`@@unique([tenantId, chatId])`; `@@index([tenantId])`.

## Enums usados
Ninguno.

## Acceso
`d1-repository.ts` (get/set del destino de log; el logging real escribe [[Modelo D1Event]]).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo D1Event]]
- Relacionado con: [[Modelo Chat]], [[Observability Map]], [[Database Map]]

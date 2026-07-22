---
id: modryva-model-antiraidevent
title: Modelo AntiraidEvent
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/antiraid-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo AntiraidEvent

## Propósito
Registro de una oleada de entradas detectada: número de joins en la ventana y modo activo. Tabla
`antiraid_events`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `joinCount` / `windowSeconds` | Int | Métrica de la oleada. |
| `mode` | String | Modo aplicado. |

## Índices / restricciones
`@@index([tenantId, chatId, createdAt])`.

## Enums usados
Ninguno.

## Acceso
`antiraid-repository.ts` (escritura al detectar una oleada).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: —
- Relacionado con: [[Modelo AntiraidConfig]], [[Database Map]]

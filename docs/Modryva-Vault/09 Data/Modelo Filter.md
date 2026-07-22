---
id: modryva-model-filter
title: Modelo Filter
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/community-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo Filter

## Propósito
Filtro de auto-respuesta por chat: cuando un mensaje contiene `trigger`, el bot responde `response`
(estilo Rose). Tabla `filters`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `trigger` | String | Palabra/frase disparadora. |
| `response` | String | Respuesta. |
| `createdBy` | String? | Autor. |

## Índices / restricciones
`@@unique([chatId, trigger])`; `@@index([tenantId, chatId])`.

## Enums usados
Ninguno.

## Acceso
`community-repository.ts` (CRUD y match de filtros).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Filters]]
- Relacionado con: [[Modelo CustomCommand]], [[Modelo BlocklistEntry]], [[Database Map]]

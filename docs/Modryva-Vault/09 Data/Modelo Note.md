---
id: modryva-model-note
title: Modelo Note
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

# Modelo Note

## Propósito
Nota guardada por nombre en un chat (estilo `/save`), recuperable con `#nombre` o `/get`. Tabla `notes`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `name` | String | Clave de la nota. |
| `content` | String | Contenido. |
| `createdBy` | String? | Autor. |

## Índices / restricciones
`@@unique([chatId, name])`; `@@index([tenantId, chatId])`.

## Enums usados
Ninguno.

## Acceso
`community-repository.ts` (guardar/obtener/listar/borrar notas).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Módulo community]]
- Relacionado con: [[Modelo CustomCommand]], [[Modelo Filter]], [[Database Map]]

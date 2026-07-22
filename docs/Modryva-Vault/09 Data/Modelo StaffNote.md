---
id: modryva-model-staffnote
title: Modelo StaffNote
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/staff-note-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo StaffNote

## Propósito
Nota interna del staff sobre un chat (bitácora de moderación), con autor. Distinta de [[Modelo Note]]
(pública por nombre). Tabla `staff_notes`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `authorTelegramId` / `authorName` | BigInt? / String? | Autor. |
| `text` | String | Contenido. |

## Índices / restricciones
`@@index([tenantId, chatId])`. Sin `updatedAt` (append-only).

## Enums usados
Ninguno.

## Acceso
`staff-note-repository.ts` (añadir/listar notas de staff).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Módulo security]]
- Relacionado con: [[Modelo Note]], [[Modelo Incident]], [[Database Map]]

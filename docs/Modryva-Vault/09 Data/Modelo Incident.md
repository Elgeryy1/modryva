---
id: modryva-model-incident
title: Modelo Incident
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/incident-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo Incident

## Propósito
Incidente registrado en un chat (bitácora operativa/moderación) con título y estado. Tabla `incidents`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `title` | String | Título. |
| `status` | String | `@default("investigando")`. |

## Índices / restricciones
`@@index([tenantId, chatId])`.

## Enums usados
Ninguno.

## Acceso
`incident-repository.ts` (abrir/actualizar/listar incidentes).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Módulo security]]
- Relacionado con: [[Modelo StaffNote]], [[Modelo D1Event]], [[Database Map]]

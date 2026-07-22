---
id: modryva-model-blocklistconfig
title: Modelo BlocklistConfig
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/group-protection-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo BlocklistConfig

## Propósito
Modo de la lista de bloqueo por chat (qué hacer al coincidir un término: delete/warn/ban…). Tabla
`blocklist_configs`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `chatId` | String | `@unique`. |
| `mode` | String | `@default("delete")`. |

## Índices / restricciones
`chatId @unique`; `@@index([tenantId])`.

## Enums usados
Ninguno.

## Acceso
`group-protection-repository.ts` (config del modo; los términos viven en [[Modelo BlocklistEntry]]).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo BlocklistEntry]]
- Relacionado con: [[Modelo Filter]], [[Modelo Chat]], [[Database Map]]

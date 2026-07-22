---
id: modryva-model-quarantineconfig
title: Modelo QuarantineConfig
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

# Modelo QuarantineConfig

## Propósito
Config de cuarentena por chat: si está activa y su nivel de rigurosidad. Los mensajes sospechosos van a
[[Modelo QuarantineItem]] para revisión humana. Tabla `quarantine_configs`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `chatId` | String | `@unique`. |
| `enabled` | Boolean | `@default(false)`. |
| `strictness` | String | `@default("balanced")`. |

## Índices / restricciones
`chatId @unique`; `@@index([tenantId])`.

## Enums usados
Ninguno.

## Acceso
`d1-repository.ts` (get/set de config de cuarentena).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo QuarantineItem]]
- Relacionado con: [[Modelo Chat]], [[Security Map]], [[Database Map]]

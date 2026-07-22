---
id: enum-modulestatus
title: Enum ModuleStatus
type: model
domain: data
status: implemented
maturity: unknown
source:
  - packages/data/prisma/schema.prisma
tags:
  - modryva
  - model
  - data
  - enum
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Enum ModuleStatus

Estado de activación de un módulo por tenant/chat en [[Modelo ModuleState]].

## Valores

| Valor | Significado |
|---|---|
| `enabled` | Módulo activo. |
| `disabled` | Módulo desactivado (valor por defecto: `@default(disabled)`). |
| `degraded` | Activo pero degradado. |

## Usado por

- [[Modelo ModuleState]] — campo `status ModuleStatus @default(disabled)`.

> Nota: `ModuleState` solo lo escribe `packages/data/prisma/seed.ts`; la activación efectiva de
> features en tiempo de ejecución vive en [[Modelo ChatSetting]]. Ver [[Open Questions]].

## Relaciones

- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo ModuleState]]
- Relacionado con: [[Database Map]]

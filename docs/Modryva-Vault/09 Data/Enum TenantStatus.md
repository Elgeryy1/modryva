---
id: enum-tenantstatus
title: Enum TenantStatus
type: model
domain: data
status: implemented
maturity: stable
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

# Enum TenantStatus

Estado del ciclo de vida de un [[Modelo Tenant]] (workspace multi-bot).

## Valores

| Valor | Significado |
|---|---|
| `active` | Tenant operativo (valor por defecto: `@default(active)`). |
| `suspended` | Suspendido temporalmente. |
| `archived` | Archivado / retirado. |

## Usado por

- [[Modelo Tenant]] — campo `status TenantStatus @default(active)`.

## Relaciones

- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo Tenant]]
- Relacionado con: [[Database Map]]

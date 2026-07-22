---
id: modryva-model-role
title: Modelo Role
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
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo Role

## Propósito
Rol personalizado por tenant para el RBAC interno del grupo (distinto de [[Enum PlatformRole]]). Tabla
`roles`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | FK → [[Modelo Tenant]] (`onDelete: Cascade`). |
| `name` | String | Nombre del rol. |
| `description` | String? | Descripción. |

## Índices / restricciones
`@@unique([tenantId, name])`. Relación `bindings RoleBinding[]`.

## Enums usados
Ninguno.

## Acceso
RBAC de tenant definido en el schema (con relaciones a `Tenant` y `RoleBinding`) pero **sin
repositorio Prisma que lo consulte**. Andamiaje no cableado; ver [[Data Model Overview]] y
[[Open Questions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo RoleBinding]] (relación declarada, sin uso)
- Relacionado con: [[Modelo Permission]], [[Modelo Tenant]], [[Database Map]]

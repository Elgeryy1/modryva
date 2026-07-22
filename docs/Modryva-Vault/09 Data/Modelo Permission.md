---
id: modryva-model-permission
title: Modelo Permission
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

# Modelo Permission

## Propósito
Catálogo global de permisos (por `key`) para el RBAC interno. Tabla `permissions`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `key` | String | `@unique`. |
| `description` | String? | Descripción. |
| `createdAt` | DateTime | `@default(now())` (sin `updatedAt`). |

## Índices / restricciones
`key @unique`. No tiene `tenantId` (es catálogo global).

## Enums usados
Ninguno.

## Acceso
**Sin lector/escritor verificado**. Andamiaje del RBAC no cableado (no hay tabla puente Role↔Permission
declarada). Ver [[Data Model Overview]] y [[Open Questions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: — (sin cablear)
- Relacionado con: [[Modelo Role]], [[Modelo RoleBinding]], [[Database Map]]

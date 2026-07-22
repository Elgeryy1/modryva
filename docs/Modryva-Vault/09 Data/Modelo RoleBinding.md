---
id: modryva-model-rolebinding
title: Modelo RoleBinding
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

# Modelo RoleBinding

## Propósito
Asigna un [[Modelo Role]] a un [[Modelo AppUser]] dentro de un tenant, con caducidad opcional. Tabla
`role_bindings`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `roleId` / `userId` | String | FKs (`onDelete: Cascade`). |
| `expiresAt` | DateTime? | Caducidad de la asignación. |

## Índices / restricciones
`@@index([tenantId, userId])`, `@@index([tenantId, roleId])`. FKs a `Tenant`, `Role`, `AppUser`.

## Enums usados
Ninguno.

## Acceso
**Sin lector/escritor verificado**. Andamiaje del RBAC de tenant no cableado. Ver
[[Data Model Overview]] y [[Open Questions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: — (sin cablear)
- Relacionado con: [[Modelo Role]], [[Modelo AppUser]], [[Modelo Tenant]], [[Database Map]]

---
id: modryva-model-tenant
title: Modelo Tenant
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/foundation-repository.ts
  - packages/data/src/platform-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo Tenant

## Propósito
Raíz de la multi-tenencia. Cada bot gestionado (padre o hijo) es un `Tenant`; casi todos los demás
modelos cuelgan de su `tenantId`. Tabla `tenants`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `id` | String cuid | PK. |
| `name` | String | Nombre visible. |
| `slug` | String | `@unique`. |
| `status` | [[Enum TenantStatus]] | `@default(active)`. |
| `createdAt` / `updatedAt` | DateTime | Timestamps estándar. |

## Índices / restricciones
`slug @unique`. Es el padre relacional (con `onDelete: Cascade`) de ~15 colecciones:
`bots ManagedBot[]`, `chats Chat[]`, `users AppUser[]`, `roles Role[]`, `flags FeatureFlag[]`,
`modules ModuleState[]`, `auditLogs AuditLog[]`, `security SecurityAlert[]`, `settings ChatSetting[]`,
`cases ModerationCase[]`, `memberships Membership[]`, `topics Topic[]`, `roleBindings RoleBinding[]`,
`promoCodes PromoCode[]`, `entitlements Entitlement[]`.

## Enums usados
[[Enum TenantStatus]]

## Acceso
Se crea/upserta en `foundation-repository.ts` (y `seed.ts`); leído/gestionado también en
`platform-repository.ts`. La mayoría de repos reciben `tenantId` como parámetro.

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: prácticamente todos los modelos (via `tenantId`)
- Relacionado con: [[Database Map]], [[Modelo ManagedBot]], [[Modelo Chat]], [[Modelo AppUser]]

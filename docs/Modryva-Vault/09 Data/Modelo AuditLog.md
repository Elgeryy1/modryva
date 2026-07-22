---
id: modryva-model-auditlog
title: Modelo AuditLog
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/foundation-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo AuditLog

## Propósito
Registro de auditoría de acciones: quién (actor) hizo qué sobre qué recurso. Tabla `audit_logs`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String? | FK → [[Modelo Tenant]] (`onDelete: SetNull`). |
| `actorType` | [[Enum AuditActorType]] | `@default(system)`. |
| `actorId` | String? | Id del actor. |
| `action` | String | Acción realizada. |
| `resourceType` / `resourceId` | String? | Recurso afectado. |
| `payload` | Json? | Detalles. |

## Índices / restricciones
`@@index([tenantId, createdAt])`. Sin `updatedAt` (registro inmutable).

## Enums usados
[[Enum AuditActorType]]

## Acceso
`foundation-repository.ts` (escritura de eventos de auditoría).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Observability Map]], [[Security Map]]
- Relacionado con: [[Modelo SecurityAlert]], [[Modelo Tenant]], [[Database Map]]

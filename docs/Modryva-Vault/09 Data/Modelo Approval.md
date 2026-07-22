---
id: modryva-model-approval
title: Modelo Approval
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

# Modelo Approval

## Propósito
Solicitud de aprobación genérica (acción pendiente de confirmación por un actor). Tabla `approvals`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | Tenant. |
| `actorId` | String? | Actor. |
| `action` | String | Acción a aprobar. |
| `status` | String | `@default("pending")`. |
| `payload` | Json? | Datos de la acción. |

## Índices / restricciones
`@@index([tenantId, status])`.

## Enums usados
Ninguno.

## Acceso
**Sin lector/escritor verificado**. Andamiaje de flujo de aprobaciones no cableado. Ver
[[Data Model Overview]] y [[Open Questions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: — (sin cablear)
- Relacionado con: [[Modelo Tenant]], [[Database Map]]

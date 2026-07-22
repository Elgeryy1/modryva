---
id: modryva-model-joboutbox
title: Modelo JobOutbox
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

# Modelo JobOutbox

## Propósito
Bandeja de salida de trabajos diferidos (patrón outbox) con `topic`, `state`, `runAfter` y `lockedAt`.
Tabla `job_outbox`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String? | Tenant. |
| `topic` | String | Tipo de trabajo. |
| `payload` | Json | Datos. |
| `state` | String | `@default("pending")`. |
| `runAfter` / `lockedAt` | DateTime? | Programación y lock. |

## Índices / restricciones
`@@index([tenantId, state])`.

## Enums usados
Ninguno.

## Acceso
**Sin lector/escritor verificado** (infra no cableada). Los trabajos programados en runtime usan modelos
con `runAt` propios ([[Modelo Reminder]], [[Modelo ScheduledPost]]). Ver [[Data Model Overview]] y
[[Open Questions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: — (sin cablear)
- Relacionado con: [[Modelo Reminder]], [[Modelo ScheduledPost]], [[Database Map]]

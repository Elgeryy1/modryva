---
id: modryva-model-idempotencykey
title: Modelo IdempotencyKey
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

# Modelo IdempotencyKey

## Propósito
Clave de idempotencia genérica por `(namespace, key)` para evitar reejecutar operaciones. Tabla
`idempotency_keys`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String? | Tenant. |
| `namespace` | String | Espacio de nombres. |
| `key` | String | Clave. |
| `payload` | Json? | Resultado cacheado. |
| `expiresAt` | DateTime? | Caducidad. |

## Índices / restricciones
`@@unique([namespace, key])`; `@@index([tenantId])`.

## Enums usados
Ninguno.

## Acceso
**Sin lector/escritor verificado** (infra no cableada). En la práctica la idempotencia real se apoya en
los `@@unique` de otros modelos (p. ej. [[Modelo ChipLedger]], [[Modelo Payment]]). Ver
[[Data Model Overview]] y [[Open Questions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: — (sin cablear)
- Relacionado con: [[Modelo UpdateInbox]], [[Database Map]]

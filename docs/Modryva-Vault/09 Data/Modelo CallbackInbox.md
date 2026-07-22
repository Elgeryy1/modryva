---
id: modryva-model-callbackinbox
title: Modelo CallbackInbox
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

# Modelo CallbackInbox

## Propósito
Buzón de callbacks (callback_query de botones) para dedup/idempotencia, análogo a [[Modelo UpdateInbox]].
Tabla `callback_inbox`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String? | Tenant. |
| `callbackId` | String | `@unique`. |
| `payload` | Json | Callback crudo. |
| `processedAt` | DateTime? | Marca de procesado. |

## Índices / restricciones
`callbackId @unique`; `@@index([tenantId])`.

## Enums usados
Ninguno.

## Acceso
**Sin lector/escritor verificado** (infra no cableada). Ver [[Data Model Overview]] y [[Open Questions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: — (sin cablear)
- Relacionado con: [[Modelo UpdateInbox]], [[Database Map]]

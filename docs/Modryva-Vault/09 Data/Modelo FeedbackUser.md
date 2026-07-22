---
id: modryva-model-feedbackuser
title: Modelo FeedbackUser
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/feedback-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo FeedbackUser

## Propósito
Usuario que tiene un hilo de feedback abierto con el staff (relaciona su DM con el chat de staff). Tabla
`feedback_users`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | Tenant. |
| `telegramUserId` | BigInt | Usuario. |

## Índices / restricciones
`@@unique([tenantId, telegramUserId])`; `@@index([tenantId])`.

## Enums usados
Ninguno.

## Acceso
`feedback-repository.ts` (alta/consulta de usuarios en modo feedback).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: —
- Relacionado con: [[Modelo FeedbackConfig]], [[Database Map]]

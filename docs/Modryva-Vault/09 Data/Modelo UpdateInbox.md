---
id: modryva-model-updateinbox
title: Modelo UpdateInbox
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

# Modelo UpdateInbox

## Propósito
Buzón de entrada de updates de Telegram para deduplicación e idempotencia del webhook: cada update se
guarda una vez por `(botKey, updateId)` y se marca `processedAt` al procesarlo. Tabla `update_inbox`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String? | Tenant (opcional). |
| `botKey` | String | Bot destinatario. |
| `updateId` | BigInt | Id del update. |
| `payload` | Json | Update crudo. |
| `processedAt` | DateTime? | Marca de procesado. |

## Índices / restricciones
`@@unique([botKey, updateId])` (dedup); `@@index([tenantId, botKey])`.

## Enums usados
Ninguno.

## Acceso
`foundation-repository.ts` (registrar update entrante; garantía de exactly-once). Es el único modelo de
infra con escritor real (ver [[Data Model Overview]]).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: pipeline de ingesta de webhook ([[Bot Core Map]])
- Relacionado con: [[Modelo CallbackInbox]], [[Modelo IdempotencyKey]], [[Database Map]]

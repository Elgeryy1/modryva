---
id: modryva-model-webhookdelivery
title: Modelo WebhookDelivery
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/webhook-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo WebhookDelivery

## Propósito
Intento de entrega de un evento a un [[Modelo Webhook]]: cuerpo, estado y reintentos. Copia `url`/`secret`
para poder reintentar aunque el webhook cambie. Tabla `webhook_deliveries`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `webhookId` | String | Contexto. |
| `url` / `secret` | String | Destino (copia). |
| `event` / `body` | String | Evento y payload. |
| `status` | String | `@default("pending")`. |
| `attempts` | Int | `@default(0)`. |
| `deliveredAt` | DateTime? | Entrega. |

## Índices / restricciones
`@@index([status, createdAt])` (cola de entrega), `@@index([tenantId])`.

## Enums usados
Ninguno.

## Acceso
`webhook-repository.ts` (encolar; el worker entrega y reintenta con backoff).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: worker de entregas ([[Infrastructure Map]])
- Relacionado con: [[Modelo Webhook]], [[Database Map]]
